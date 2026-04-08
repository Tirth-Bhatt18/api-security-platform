import logging
import re
from typing import Dict, Any, List, Optional

logger = logging.getLogger(__name__)


class ResponseAnalyzer:
    """
    Analyzes differences between baseline and mutated responses
    to detect security vulnerabilities
    """
    
    # Database error patterns
    DB_ERROR_PATTERNS = [
        r'SQL syntax',
        r'mysql_fetch',
        r'Warning: mysql_',
        r'SQL Server',
        r'Unclosed quotation mark',
        r'Microsoft OLE DB',
        r'ORA-\d{5}',  # Oracle errors
        r'PostgreSQL',
        r'sqlite3',
        r'pymysql',
    ]
    
    # Command execution patterns
    COMMAND_EXECUTION_PATTERNS = [
        r'root:.*:0:0',  # /etc/passwd lines
        r'uid=\d+.*gid=\d+',  # id command output
        r'^total \d+',  # ls output
        r'System cannot find the path',
        r'Access is denied',
    ]
    
    # XXE patterns
    XXE_PATTERNS = [
        r'root:.*:0:0',
        r'<!ENTITY',
    ]
    
    # XSS confirmation patterns
    XSS_PATTERNS = [
        r'<script>',
        r'javascript:',
        r'onerror=',
        r'onload=',
    ]
    
    def analyze(
        self,
        endpoint: str,
        method: str,
        baseline: Dict[str, Any],
        mutated: Dict[str, Any],
        mutation_type: str,
        original_request: Any
    ) -> List[Dict[str, Any]]:
        """
        Analyze baseline vs mutated responses for vulnerabilities
        """
        vulnerabilities = []
        
        # Skip if baseline had errors
        if baseline.get('error'):
            return vulnerabilities
        
        # Check status code changes
        status_diff = self._check_status_code_change(
            endpoint, method, baseline, mutated, mutation_type
        )
        if status_diff:
            vulnerabilities.append(status_diff)
        
        # Check for database errors
        db_vuln = self._check_database_errors(endpoint, method, mutated, mutation_type)
        if db_vuln:
            vulnerabilities.append(db_vuln)
        
        # Check for command execution
        cmd_vuln = self._check_command_execution(endpoint, method, mutated)
        if cmd_vuln:
            vulnerabilities.append(cmd_vuln)
        
        # Check for XXE
        xxe_vuln = self._check_xxe(endpoint, method, mutated)
        if xxe_vuln:
            vulnerabilities.append(xxe_vuln)
        
        # Check for XSS
        xss_vuln = self._check_xss(endpoint, method, mutated)
        if xss_vuln:
            vulnerabilities.append(xss_vuln)
        
        # Check response size anomalies
        size_vuln = self._check_size_anomaly(
            endpoint, method, baseline, mutated, mutation_type
        )
        if size_vuln:
            vulnerabilities.append(size_vuln)
        
        # Check timing anomalies (potential timing attacks)
        timing_vuln = self._check_timing_anomaly(baseline, mutated)
        if timing_vuln:
            vulnerabilities.append(timing_vuln)
        
        # Auth bypass detection
        mutation_type = mutation_type or ''

        if 'auth' in mutation_type.lower():
            auth_vuln = self._check_auth_bypass(
                endpoint, method, baseline, mutated
            )
            if auth_vuln:
                vulnerabilities.append(auth_vuln)

        token_reuse_vuln = self._check_token_reuse_risk(
            endpoint, method, baseline, mutated, mutation_type
        )
        if token_reuse_vuln:
            vulnerabilities.append(token_reuse_vuln)
        
        return vulnerabilities

    def analyze_rate_limit(
        self,
        endpoint: str,
        method: str,
        baseline: Dict[str, Any],
        window_results: List[Dict[str, Any]],
    ) -> Optional[Dict[str, Any]]:
        """Analyze escalating burst windows for explicit throttling/rate-limit weaknesses."""
        if not window_results:
            return None

        analyzed_windows = []
        saw_retry_after = False
        for window in sorted(window_results, key=lambda item: item.get('burst_count', 0)):
            burst_count = int(window.get('burst_count', 0))
            responses = window.get('responses', [])
            if burst_count <= 0 or not responses:
                continue

            statuses = [resp.get('status_code', 0) for resp in responses]
            success_count = sum(1 for code in statuses if 200 <= code < 300)
            throttled_count = sum(1 for code in statuses if code in (429, 503))
            error_count = sum(1 for code in statuses if code >= 500)
            retry_after_count = 0
            avg_time = 0.0
            timings = [float(resp.get('time', 0) or 0) for resp in responses]

            if timings:
                avg_time = sum(timings) / len(timings)

            for resp in responses:
                headers = resp.get('headers') or {}
                if any(str(key).lower() == 'retry-after' for key in headers.keys()):
                    retry_after_count += 1

            if retry_after_count > 0:
                saw_retry_after = True

            analyzed_windows.append({
                'burst_count': burst_count,
                'success_count': success_count,
                'throttled_count': throttled_count,
                'error_count': error_count,
                'retry_after_count': retry_after_count,
                'success_ratio': round(success_count / max(1, burst_count), 3),
                'avg_time': round(avg_time, 3),
                'status_distribution': statuses,
            })

        if len(analyzed_windows) < 2:
            return None

        qualifying_windows = [
            window for window in analyzed_windows
            if window['burst_count'] >= 8
        ]
        if len(qualifying_windows) < 2:
            return None

        last_window = qualifying_windows[-1]
        escalation_clean = all(
            window['throttled_count'] == 0 and window['success_ratio'] >= 0.85
            for window in qualifying_windows
        )
        stable_under_growth = last_window['success_ratio'] >= 0.9

        if escalation_clean and stable_under_growth and not saw_retry_after:
            return {
                'endpoint': endpoint,
                'method': method,
                'vulnerability': 'Potential Missing Rate Limiting',
                'severity': 'low',
                'details': {
                    'mutation_type': 'rate_limit_multi_window_burst',
                    'category': 'throttling',
                    'confidence': 0.45,
                    'windows': qualifying_windows,
                    'baseline_time': round(float(baseline.get('time', 0) or 0), 3),
                },
                'evidence': f'Escalating burst windows ({qualifying_windows[0]["burst_count"]}..{last_window["burst_count"]}) completed with no 429/503 or Retry-After signals.',
            }

        return None
    
    def _check_status_code_change(
        self,
        endpoint: str,
        method: str,
        baseline: Dict[str, Any],
        mutated: Dict[str, Any],
        mutation_type: str
    ) -> Optional[Dict[str, Any]]:
        """Detect unexpected status code changes"""
        baseline_status = baseline.get('status_code', 0)
        mutated_status = mutated.get('status_code', 0)
        
        # For auth removal, 401/403 expected, else is suspicious
        if 'auth_removal' in mutation_type:
            if mutated_status not in [401, 403] and baseline_status in [200, 201]:
                return {
                    'endpoint': endpoint,
                    'method': method,
                    'vulnerability': 'Broken Authentication',
                    'severity': 'critical',
                    'details': {
                        'mutation_type': mutation_type,
                        'baseline_status': baseline_status,
                        'mutated_status': mutated_status,
                    },
                    'evidence': f'Auth header removal did not reject request (got {mutated_status} instead of 401/403)',
                }
        
        # Large payload should not return success
        if 'large_payload' in mutation_type and mutated_status == 200:
            if baseline.get('content_length', 0) != mutated.get('content_length', 0):
                return {
                    'endpoint': endpoint,
                    'method': method,
                    'vulnerability': 'Improper Input Validation',
                    'severity': 'medium',
                    'details': {
                        'mutation_type': mutation_type,
                        'baseline_size': baseline.get('content_length'),
                        'mutated_size': mutated.get('content_length'),
                    },
                    'evidence': 'Large payload accepted without error',
                }
        
        return None
    
    def _check_database_errors(
        self,
        endpoint: str,
        method: str,
        mutated: Dict[str, Any],
        mutation_type: str
    ) -> Optional[Dict[str, Any]]:
        """Detect database error messages (SQL injection indicators)"""
        body = mutated.get('body', '')
        
        if not body or 'injection' not in mutation_type.lower():
            return None
        
        for pattern in self.DB_ERROR_PATTERNS:
            if re.search(pattern, body, re.IGNORECASE):
                return {
                    'endpoint': endpoint,
                    'method': method,
                    'vulnerability': 'SQL Injection',
                    'severity': 'critical',
                    'details': {
                        'mutation_type': mutation_type,
                        'error_pattern': pattern,
                    },
                    'evidence': f'Database error exposed: {pattern}',
                }
        
        return None
    
    def _check_command_execution(
        self,
        endpoint: str,
        method: str,
        mutated: Dict[str, Any]
    ) -> Optional[Dict[str, Any]]:
        """Detect command execution indicators"""
        body = mutated.get('body', '')
        
        if not body:
            return None
        
        for pattern in self.COMMAND_EXECUTION_PATTERNS:
            if re.search(pattern, body, re.IGNORECASE | re.MULTILINE):
                return {
                    'endpoint': endpoint,
                    'method': method,
                    'vulnerability': 'Command Injection',
                    'severity': 'critical',
                    'details': {
                        'pattern': pattern,
                    },
                    'evidence': f'Command execution output detected: {pattern}',
                }
        
        return None
    
    def _check_xxe(
        self,
        endpoint: str,
        method: str,
        mutated: Dict[str, Any]
    ) -> Optional[Dict[str, Any]]:
        """Detect XXE vulnerability indicators"""
        body = mutated.get('body', '')
        
        if not body:
            return None
        
        for pattern in self.XXE_PATTERNS:
            if re.search(pattern, body, re.IGNORECASE):
                return {
                    'endpoint': endpoint,
                    'method': method,
                    'vulnerability': 'XML External Entity (XXE)',
                    'severity': 'high',
                    'details': {
                        'pattern': pattern,
                    },
                    'evidence': f'XXE indication: {pattern}',
                }
        
        return None
    
    def _check_xss(
        self,
        endpoint: str,
        method: str,
        mutated: Dict[str, Any]
    ) -> Optional[Dict[str, Any]]:
        """Detect XSS vulnerability indicators"""
        body = mutated.get('body', '')
        
        if not body:
            return None
        
        for pattern in self.XSS_PATTERNS:
            if re.search(pattern, body, re.IGNORECASE):
                return {
                    'endpoint': endpoint,
                    'method': method,
                    'vulnerability': 'Cross-Site Scripting (XSS)',
                    'severity': 'high',
                    'details': {
                        'pattern': pattern,
                    },
                    'evidence': f'XSS payload reflected: {pattern}',
                }
        
        return None
    
    def _check_size_anomaly(
        self,
        endpoint: str,
        method: str,
        baseline: Dict[str, Any],
        mutated: Dict[str, Any],
        mutation_type: str
    ) -> Optional[Dict[str, Any]]:
        """Detect unusual response size changes"""
        baseline_size = baseline.get('content_length', 0)
        mutated_size = mutated.get('content_length', 0)
        
        if baseline_size == 0 or mutated_size == 0:
            return None
        
        # Large size difference might indicate IDOR/data leakage
        size_ratio = mutated_size / baseline_size
        if size_ratio > 2 or size_ratio < 0.5:
            return {
                'endpoint': endpoint,
                'method': method,
                'vulnerability': 'Potential Data Exposure (IDOR/BOLA)',
                'severity': 'medium',
                'details': {
                    'mutation_type': mutation_type,
                    'baseline_size': baseline_size,
                    'mutated_size': mutated_size,
                    'ratio': round(size_ratio, 2),
                },
                'evidence': f'Unusual response size change: {size_ratio:.2f}x',
            }
        
        return None
    
    def _check_timing_anomaly(
        self,
        baseline: Dict[str, Any],
        mutated: Dict[str, Any]
    ) -> Optional[Dict[str, Any]]:
        """Detect timing anomalies (potential timing attacks/IDOR)"""
        baseline_time = baseline.get('time', 0)
        mutated_time = mutated.get('time', 0)
        
        if baseline_time == 0 or mutated_time == 0:
            return None
        
        # Large timing difference might indicate database query behavior change
        if mutated_time > baseline_time * 3 and mutated_time > 1.0:
            return {
                'endpoint': baseline.get('url'),
                'method': 'UNKNOWN',
                'vulnerability': 'Timing Anomaly Detected',
                'severity': 'low',
                'details': {
                    'baseline_time': round(baseline_time, 3),
                    'mutated_time': round(mutated_time, 3),
                },
                'evidence': f'Response time significantly increased: {mutated_time:.3f}s vs {baseline_time:.3f}s',
            }
        
        return None
    
    def _check_auth_bypass(
        self,
        endpoint: str,
        method: str,
        baseline: Dict[str, Any],
        mutated: Dict[str, Any]
    ) -> Optional[Dict[str, Any]]:
        """Detect authentication bypass"""
        baseline_status = baseline.get('status_code', 0)
        mutated_status = mutated.get('status_code', 0)
        
        # Expected: 401/403 when auth removed, got success
        if baseline_status == 200 and mutated_status == 200:
            return {
                'endpoint': endpoint,
                'method': method,
                'vulnerability': 'Authentication Bypass / Missing Auth Check',
                'severity': 'critical',
                'details': {
                    'baseline_requires_auth': False,
                },
                'evidence': 'Request succeeded without authentication',
            }
        
        return None

    def _check_token_reuse_risk(
        self,
        endpoint: str,
        method: str,
        baseline: Dict[str, Any],
        mutated: Dict[str, Any],
        mutation_type: str
    ) -> Optional[Dict[str, Any]]:
        if mutation_type not in ('auth_token_reuse', 'auth_token_reuse_id_increment'):
            return None

        baseline_status = baseline.get('status_code', 0)
        mutated_status = mutated.get('status_code', 0)
        baseline_size = baseline.get('content_length', 0)
        mutated_size = mutated.get('content_length', 0)

        # Reused token with shifted object ID still succeeding may indicate weak object-level auth.
        if mutation_type == 'auth_token_reuse_id_increment' and baseline_status in (200, 201) and mutated_status in (200, 201):
            size_ratio = (mutated_size / baseline_size) if baseline_size else 1
            return {
                'endpoint': endpoint,
                'method': method,
                'vulnerability': 'Potential IDOR/BOLA via Token Reuse',
                'severity': 'high',
                'details': {
                    'mutation_type': mutation_type,
                    'baseline_status': baseline_status,
                    'mutated_status': mutated_status,
                    'baseline_size': baseline_size,
                    'mutated_size': mutated_size,
                    'size_ratio': round(size_ratio, 2),
                },
                'evidence': 'Reused token with modified object identifier still returned successful response.',
            }

        if mutation_type == 'auth_token_reuse' and baseline_status in (200, 201) and mutated_status in (200, 201):
            return {
                'endpoint': endpoint,
                'method': method,
                'vulnerability': 'Token Replay May Be Accepted',
                'severity': 'medium',
                'details': {
                    'mutation_type': mutation_type,
                    'baseline_status': baseline_status,
                    'mutated_status': mutated_status,
                },
                'evidence': 'Replay-style request with same bearer token remained successful.',
            }

        return None

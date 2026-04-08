import os
import logging
import asyncio
from datetime import datetime, timezone
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List, Dict, Any, Optional

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Import custom modules
from app.engines.request_executor import RequestExecutor
from app.engines.mutation_engine import MutationEngine
from app.engines.response_analyzer import ResponseAnalyzer

app = FastAPI(
    title="API Security Scanner",
    description="Python backend for API security vulnerability scanning",
    version="1.0.0"
)

# Initialize engines
executor = RequestExecutor()
mutation_engine = MutationEngine()
analyzer = ResponseAnalyzer()

RATE_LIMIT_BURST_COUNT = int(os.getenv('RATE_LIMIT_BURST_COUNT', '12'))
RATE_LIMIT_TEST_ENABLED = os.getenv('RATE_LIMIT_TEST_ENABLED', 'true').lower() == 'true'
RATE_LIMIT_BURST_WINDOWS = [
    int(part.strip())
    for part in os.getenv('RATE_LIMIT_BURST_WINDOWS', '6,10,14').split(',')
    if part.strip().isdigit()
]

SEVERITY_RANK = {
    'critical': 4,
    'high': 3,
    'medium': 2,
    'low': 1,
}


class NormalizedRequest(BaseModel):
    method: str
    url: str
    headers: Dict[str, str] = {}
    # Postman payloads can be object, array, string, number, bool, or null.
    body: Optional[Any] = None
    name: Optional[str] = None


class ScanRequest(BaseModel):
    scan_id: int
    user_id: int
    requests: List[NormalizedRequest]
    request_count: int
    rate_limit_profile: Optional[Dict[str, Any]] = None


class VulnerabilityResult(BaseModel):
    endpoint: str
    method: str
    vulnerability: str
    severity: str
    details: Dict[str, Any]
    evidence: Optional[str] = None


class ScanResponse(BaseModel):
    scan_id: int
    status: str
    vulnerabilities_found: int
    results: List[VulnerabilityResult]


def _infer_category(vulnerability_name: str) -> str:
    label = str(vulnerability_name or '').lower()
    if 'auth' in label or 'token' in label:
        return 'authentication'
    if 'rate' in label or 'throttl' in label:
        return 'throttling'
    if 'xss' in label or 'injection' in label or 'validation' in label:
        return 'input_validation'
    if 'idor' in label or 'bola' in label or 'exposure' in label:
        return 'authorization'
    if 'timing' in label:
        return 'behavioral'
    return 'general'


def _default_confidence(severity: str) -> float:
    normalized = str(severity or '').lower()
    if normalized == 'critical':
        return 0.92
    if normalized == 'high':
        return 0.82
    if normalized == 'medium':
        return 0.66
    return 0.48


def _normalize_finding(finding: Dict[str, Any]) -> Dict[str, Any]:
    normalized = dict(finding)
    details = dict(normalized.get('details') or {})

    severity = str(normalized.get('severity') or 'low').lower()
    if severity not in SEVERITY_RANK:
        severity = 'low'

    confidence = float(details.get('confidence', _default_confidence(severity)) or 0)
    confidence = max(0.0, min(1.0, confidence))

    # Low-confidence medium findings are capped to low to avoid chart domination.
    if severity == 'medium' and confidence < 0.60:
        severity = 'low'

    details['confidence'] = round(confidence, 2)
    details['category'] = details.get('category') or _infer_category(normalized.get('vulnerability', ''))

    normalized['severity'] = severity
    normalized['details'] = details
    normalized['method'] = normalized.get('method') or 'UNKNOWN'
    normalized['endpoint'] = normalized.get('endpoint') or 'UNKNOWN'

    return normalized


def _dedupe_findings(findings: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    deduped: Dict[str, Dict[str, Any]] = {}

    for raw in findings:
        finding = _normalize_finding(raw)
        key = '|'.join([
            str(finding.get('endpoint') or ''),
            str(finding.get('method') or ''),
            str(finding.get('vulnerability') or ''),
        ])

        existing = deduped.get(key)
        if not existing:
            finding['details']['occurrences'] = 1
            deduped[key] = finding
            continue

        existing_occurrences = int(existing.get('details', {}).get('occurrences', 1)) + 1
        existing['details']['occurrences'] = existing_occurrences

        existing_sev_rank = SEVERITY_RANK.get(existing.get('severity', 'low'), 1)
        incoming_sev_rank = SEVERITY_RANK.get(finding.get('severity', 'low'), 1)
        existing_conf = float(existing.get('details', {}).get('confidence', 0) or 0)
        incoming_conf = float(finding.get('details', {}).get('confidence', 0) or 0)

        should_replace = incoming_sev_rank > existing_sev_rank or (
            incoming_sev_rank == existing_sev_rank and incoming_conf > existing_conf
        )

        if should_replace:
            finding['details']['occurrences'] = existing_occurrences
            deduped[key] = finding

    return list(deduped.values())


def _safe_body_preview(body: Any, max_len: int = 1200) -> Any:
    if body is None:
        return None
    if isinstance(body, (dict, list, int, float, bool)):
        return body
    text = str(body)
    if len(text) <= max_len:
        return text
    return text[:max_len] + '...'


def _request_packet(method: str, url: str, headers: Dict[str, Any], body: Any) -> Dict[str, Any]:
    return {
        'method': method,
        'url': url,
        'headers': headers or {},
        'body': _safe_body_preview(body),
    }


def _response_packet(resp: Dict[str, Any]) -> Dict[str, Any]:
    headers = resp.get('headers') or {}
    return {
        'status_code': resp.get('status_code', 0),
        'headers': headers,
        'time': float(resp.get('time', 0) or 0),
        'body': _safe_body_preview(resp.get('body')),
        'url': resp.get('url'),
        'error': resp.get('error'),
    }


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "ok",
        "service": "API Security Scanner",
        "timestamp": datetime.now(timezone.utc).isoformat()
    }


@app.post("/scan", response_model=ScanResponse)
async def scan(request: ScanRequest):
    """
    Main scanning endpoint
    Accepts normalized requests and performs security testing
    """
    try:
        scan_id = request.scan_id
        user_id = request.user_id
        requests_list = request.requests
        
        logger.info(f"Starting scan {scan_id} with {len(requests_list)} requests")
        
        all_results = []
        profile = request.rate_limit_profile or {}
        rate_limit_enabled = bool(profile.get('enabled', RATE_LIMIT_TEST_ENABLED))
        profile_windows = profile.get('burst_windows', RATE_LIMIT_BURST_WINDOWS)

        burst_windows = []
        for raw_count in profile_windows:
            if isinstance(raw_count, int):
                count = raw_count
            elif isinstance(raw_count, str) and raw_count.isdigit():
                count = int(raw_count)
            else:
                continue

            if count > 1:
                burst_windows.append(count)
        if not burst_windows:
            burst_windows = [RATE_LIMIT_BURST_COUNT]
        
        # Process each request
        for idx, req in enumerate(requests_list):
            logger.info(f"Processing request {idx + 1}/{len(requests_list)}: {req.method} {req.url}")
            
            try:
                # Get baseline response
                baseline_response = await executor.execute_request(
                    method=req.method,
                    url=req.url,
                    headers=req.headers,
                    body=req.body
                )
                
                # Run mutation tests
                mutations = mutation_engine.generate_mutations(req)
                
                for mutation in mutations:
                    try:
                        mutated_response = await executor.execute_request(
                            method=mutation['method'],
                            url=mutation['url'],
                            headers=mutation['headers'],
                            body=mutation['body']
                        )
                        
                        # Analyze responses
                        vulnerabilities = analyzer.analyze(
                            endpoint=req.url,
                            method=req.method,
                            baseline=baseline_response,
                            mutated=mutated_response,
                            mutation_type=mutation.get('type'),
                            original_request=req
                        )

                        packet_details = {
                            'sent_packet': _request_packet(
                                method=mutation.get('method', req.method),
                                url=mutation.get('url', req.url),
                                headers=mutation.get('headers', {}),
                                body=mutation.get('body'),
                            ),
                            'received_reply': _response_packet(mutated_response),
                            'baseline_reply': _response_packet(baseline_response),
                        }

                        for vuln in vulnerabilities:
                            details = dict(vuln.get('details') or {})
                            details.update(packet_details)
                            vuln['details'] = details
                        
                        all_results.extend(vulnerabilities)
                    
                    except Exception as e:
                        logger.warning(f"Error testing mutation for {req.url}: {str(e)}")
                        continue

                if rate_limit_enabled:
                    # Dedicated rate-limit burst windows with escalating load.
                    burst_window_results = []
                    for window_count in sorted(set(burst_windows)):
                        burst_tasks = [
                            executor.execute_request(
                                method=req.method,
                                url=req.url,
                                headers=req.headers,
                                body=req.body,
                            )
                            for _ in range(window_count)
                        ]
                        burst_responses = await asyncio.gather(*burst_tasks, return_exceptions=True)
                        normalized_burst = []
                        for resp in burst_responses:
                            if isinstance(resp, Exception):
                                normalized_burst.append({'status_code': 0, 'error': str(resp), 'headers': {}, 'time': 0})
                            else:
                                normalized_burst.append(resp)

                        burst_window_results.append({
                            'burst_count': window_count,
                            'responses': normalized_burst,
                        })

                    rate_limit_vuln = analyzer.analyze_rate_limit(
                        endpoint=req.url,
                        method=req.method,
                        baseline=baseline_response,
                        window_results=burst_window_results,
                    )
                    if rate_limit_vuln:
                        details = dict(rate_limit_vuln.get('details') or {})
                        details['sent_packet'] = _request_packet(
                            method=req.method,
                            url=req.url,
                            headers=req.headers,
                            body=req.body,
                        )
                        details['received_reply'] = {
                            'windows': burst_window_results,
                        }
                        details['baseline_reply'] = _response_packet(baseline_response)
                        rate_limit_vuln['details'] = details
                        all_results.append(rate_limit_vuln)
            
            except Exception as e:
                logger.error(f"Error processing request {req.method} {req.url}: {str(e)}")
                continue
        
        all_results = _dedupe_findings(all_results)

        logger.info(f"Scan {scan_id} found {len(all_results)} vulnerabilities")
        
        # Format results
        results = [
            VulnerabilityResult(
                endpoint=vuln['endpoint'],
                method=vuln['method'],
                vulnerability=vuln['vulnerability'],
                severity=vuln['severity'],
                details=vuln.get('details', {}),
                evidence=vuln.get('evidence')
            )
            for vuln in all_results
        ]
        
        # Return results
        response = ScanResponse(
            scan_id=scan_id,
            status="completed",
            vulnerabilities_found=len(results),
            results=results
        )
        
        return response
    
    except Exception as e:
        logger.error(f"Fatal error in scan {request.scan_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)

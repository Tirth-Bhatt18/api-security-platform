import logging
import json
from typing import Dict, Any, List, Optional
from pydantic import BaseModel

logger = logging.getLogger(__name__)


class MutationEngine:
    """
    Generates mutated requests for security testing
    Tests include:
    - Parameter mutation (null, empty, large values, type errors)
    - Injection payloads (SQL, NoSQL, command injection)
    - Auth testing (header removal, token modification)
    - Header testing (CORS, security headers)
    """
    
    # SQL Injection payloads
    SQL_INJECTION_PAYLOADS = [
        "' OR '1'='1",
        "'; DROP TABLE users; --",
        "' OR 1=1 --",
        "' UNION SELECT NULL,NULL,NULL --",
        "1' AND '1'='1",
        "' AND 1=0 UNION ALL SELECT NULL --",
    ]
    
    # NoSQL Injection payloads
    NOSQL_INJECTION_PAYLOADS = [
        '{"$ne": null}',
        '{"$ne": ""}',
        '{"$gt": ""}',
        '{"$where": "1==1"}',
    ]
    
    # Command Injection payloads
    COMMAND_INJECTION_PAYLOADS = [
        "; ls",
        "| cat /etc/passwd",
        "`whoami`",
        "$(whoami)",
        "'; system('ls'); //",
    ]
    
    # Path Traversal payloads
    PATH_TRAVERSAL_PAYLOADS = [
        "../../../etc/passwd",
        "..\\..\\..\\windows\\system32",
        "....//....//....//etc/passwd",
        "%2e%2e%2f%2e%2e%2fetc%2fpasswd",
    ]
    
    # XXE payloads
    XXE_PAYLOADS = [
        '<?xml version="1.0"?><!DOCTYPE foo [<!ENTITY xxe SYSTEM "file:///etc/passwd">]><foo>&xxe;</foo>',
    ]
    
    # XSS payloads
    XSS_PAYLOADS = [
        "<script>alert('xss')</script>",
        "javascript:alert('xss')",
        "<img src=x onerror=alert('xss')>",
        "<svg onload=alert('xss')>",
    ]

    def generate_mutations(self, request) -> List[Dict[str, Any]]:
        """
        Generate all mutation variants of a request
        """
        mutations = []
        
        # Auth testing - remove authorization header
        mutations.append(self._mutate_auth_removal(request))
        
        # Auth testing - invalid token
        mutations.append(self._mutate_invalid_token(request))
        
        # Parameter mutations
        if request.body:
            mutations.extend(self._mutate_parameters(request))
        
        # Header mutations (CORS, security headers)
        mutations.extend(self._mutate_headers(request))
        
        # URL parameter mutations
        if '?' in request.url:
            mutations.extend(self._mutate_url_params(request))
        
        # Injection testing
        if request.body:
            mutations.extend(self._mutate_injections(request))
        
        return [m for m in mutations if m is not None]
    
    def _mutate_auth_removal(self, request) -> Dict[str, Any]:
        """Remove or modify authorization header"""
        mutation = {
            'type': 'auth_removal',
            'method': request.method,
            'url': request.url,
            'headers': request.headers.copy() if request.headers else {},
            'body': request.body,
        }
        
        # Remove auth headers
        auth_headers = ['authorization', 'x-api-key', 'x-auth-token', 'cookie']
        for header in auth_headers:
            mutation['headers'].pop(header, None)
        
        return mutation
    
    def _mutate_invalid_token(self, request) -> Dict[str, Any]:
        """Modify authorization token"""
        mutation = {
            'type': 'invalid_token',
            'method': request.method,
            'url': request.url,
            'headers': request.headers.copy() if request.headers else {},
            'body': request.body,
        }
        
        if 'authorization' in mutation['headers']:
            mutation['headers']['authorization'] = 'Bearer invalid_token_12345'
        
        return mutation
    
    def _mutate_parameters(self, request) -> List[Dict[str, Any]]:
        """Mutate request body parameters"""
        mutations = []
        
        if not request.body or not isinstance(request.body, dict):
            return mutations
        
        # Null values
        null_mutation = {
            'type': 'null_parameters',
            'method': request.method,
            'url': request.url,
            'headers': request.headers.copy() if request.headers else {},
            'body': {k: None for k in request.body.keys()},
        }
        mutations.append(null_mutation)
        
        # Empty strings
        empty_mutation = {
            'type': 'empty_parameters',
            'method': request.method,
            'url': request.url,
            'headers': request.headers.copy() if request.headers else {},
            'body': {k: '' for k in request.body.keys()},
        }
        mutations.append(empty_mutation)
        
        # Large values (fuzzing)
        large_mutation = {
            'type': 'large_payload',
            'method': request.method,
            'url': request.url,
            'headers': request.headers.copy() if request.headers else {},
            'body': {k: 'A' * 10000 for k in request.body.keys()},
        }
        mutations.append(large_mutation)
        
        # Wrong types
        type_mutation = {
            'type': 'wrong_types',
            'method': request.method,
            'url': request.url,
            'headers': request.headers.copy() if request.headers else {},
            'body': {k: [] for k in request.body.keys()},  # Send arrays instead
        }
        mutations.append(type_mutation)
        
        return mutations
    
    def _mutate_url_params(self, request) -> List[Dict[str, Any]]:
        """Mutate URL parameters"""
        mutations = []
        
        for payload in self.SQL_INJECTION_PAYLOADS[:2]:  # Limit payload count
            mutation = {
                'type': 'sql_injection_url',
                'method': request.method,
                'url': f"{request.url}&id={payload}",
                'headers': request.headers.copy() if request.headers else {},
                'body': request.body,
            }
            mutations.append(mutation)
        
        return mutations
    
    def _mutate_headers(self, request) -> List[Dict[str, Any]]:
        """Test header-based vulnerabilities"""
        mutations = []
        
        # Test CORS bypass
        cors_mutation = {
            'type': 'cors_misc',
            'method': request.method,
            'url': request.url,
            'headers': {**(request.headers.copy() if request.headers else {}), 'Origin': 'http://attacker.com'},
            'body': request.body,
        }
        mutations.append(cors_mutation)
        
        # Remove security headers
        security_headers = ['x-api-version', 'x-requested-with']
        for header in security_headers:
            header_mutation = {
                'type': 'missing_security_header',
                'method': request.method,
                'url': request.url,
                'headers': {k: v for k, v in (request.headers.copy() if request.headers else {}).items() if k.lower() != header},
                'body': request.body,
            }
            mutations.append(header_mutation)
        
        return mutations
    
    def _mutate_injections(self, request) -> List[Dict[str, Any]]:
        """Test injection vulnerabilities"""
        mutations = []
        
        if not request.body or not isinstance(request.body, dict):
            return mutations
        
        keys = list(request.body.keys())
        if not keys:
            return mutations
        
        test_key = keys[0]
        
        # SQL Injection
        for payload in self.SQL_INJECTION_PAYLOADS[:2]:
            mutation = {
                'type': 'sql_injection',
                'method': request.method,
                'url': request.url,
                'headers': request.headers.copy() if request.headers else {},
                'body': {**request.body, test_key: payload},
            }
            mutations.append(mutation)
        
        # NoSQL Injection
        for payload in self.NOSQL_INJECTION_PAYLOADS[:2]:
            mutation = {
                'type': 'nosql_injection',
                'method': request.method,
                'url': request.url,
                'headers': request.headers.copy() if request.headers else {},
                'body': {**request.body, test_key: json.loads(payload) if payload.startswith('{') else payload},
            }
            mutations.append(mutation)
        
        # Command Injection
        for payload in self.COMMAND_INJECTION_PAYLOADS[:1]:
            mutation = {
                'type': 'command_injection',
                'method': request.method,
                'url': request.url,
                'headers': request.headers.copy() if request.headers else {},
                'body': {**request.body, test_key: payload},
            }
            mutations.append(mutation)
        
        # XSS
        for payload in self.XSS_PAYLOADS[:1]:
            mutation = {
                'type': 'xss',
                'method': request.method,
                'url': request.url,
                'headers': request.headers.copy() if request.headers else {},
                'body': {**request.body, test_key: payload},
            }
            mutations.append(mutation)
        
        return mutations

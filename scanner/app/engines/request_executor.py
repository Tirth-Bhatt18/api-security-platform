import logging
import httpx
import asyncio
import os
import socket
from typing import Dict, Any, Optional
from urllib.parse import urlparse
import ipaddress

logger = logging.getLogger(__name__)


class RequestExecutor:
    """Executes HTTP requests with security checks and timeout handling"""
    
    def __init__(self, timeout=30, max_retries=3):
        self.timeout = timeout
        self.max_retries = max_retries
        self.client = None
        self.blocked_hosts = {
            host.strip().lower()
            for host in os.getenv('BLOCKED_HOSTS', 'localhost,127.0.0.1,0.0.0.0').split(',')
            if host.strip()
        }
        self.blocked_ports = {
            int(port.strip())
            for port in os.getenv('BLOCKED_PORTS', '22,23,25,3306,5432,6379,11211').split(',')
            if port.strip().isdigit()
        }
    
    async def _get_client(self):
        """Get or create async HTTP client"""
        if self.client is None:
            self.client = httpx.AsyncClient(timeout=self.timeout)
        return self.client
    
    def _is_private_or_local_ip(self, ip: ipaddress._BaseAddress) -> bool:
        return ip.is_loopback or ip.is_private or ip.is_link_local

    def _is_blocked_url(self, url: str) -> tuple[bool, str]:
        """
        Check if URL is blocked (SSRF protection)
        Returns (is_blocked, reason)
        """
        try:
            parsed = urlparse(url)
            hostname = parsed.hostname
            port = parsed.port
            
            if not hostname:
                return True, "Invalid URL: no hostname"

            if parsed.scheme not in ('http', 'https'):
                return True, f"Blocked scheme: {parsed.scheme}"

            if port and port in self.blocked_ports:
                return True, f"Blocked port: {port}"

            if hostname.lower() in self.blocked_hosts:
                return True, f"Blocked host: {hostname}"
            
            # Block localhost
            if hostname in ['localhost', 'localhost.localdomain']:
                return True, f"Blocked: {hostname}"
            
            # Try to parse as IP
            try:
                ip = ipaddress.ip_address(hostname)
                
                # Block localhost IP
                if self._is_private_or_local_ip(ip):
                    return True, f"Blocked IP: {ip}"
            
            except ValueError:
                # Hostname path: resolve DNS and block if any target is private/local.
                try:
                    addr_infos = socket.getaddrinfo(hostname, parsed.port or (443 if parsed.scheme == 'https' else 80))
                    for info in addr_infos:
                        resolved_ip = ipaddress.ip_address(info[4][0])
                        if self._is_private_or_local_ip(resolved_ip):
                            return True, f"Blocked DNS resolution to private/local IP: {resolved_ip}"
                except Exception as dns_err:
                    return True, f"DNS validation failed: {dns_err}"
            
            return False, "OK"
        
        except Exception as e:
            logger.error(f"URL validation error for {url}: {str(e)}")
            return True, f"URL validation error: {str(e)}"
    
    async def execute_request(
        self,
        method: str,
        url: str,
        headers: Optional[Dict[str, str]] = None,
        body: Optional[Dict[str, Any]] = None,
        allow_redirects: bool = True
    ) -> Dict[str, Any]:
        """
        Execute HTTP request with validation and error handling
        """
        # Check if URL is blocked
        is_blocked, reason = self._is_blocked_url(url)
        if is_blocked:
            raise ValueError(f"Blocked URL: {reason}")
        
        client = await self._get_client()
        
        try:
            # Prepare request
            request_kwargs = {
                'method': method.upper(),
                'url': url,
                'follow_redirects': allow_redirects,
            }
            
            if headers:
                request_kwargs['headers'] = headers
            
            if body:
                if isinstance(body, dict):
                    request_kwargs['json'] = body
                else:
                    request_kwargs['content'] = str(body)
            
            # Execute with retry logic
            response = None
            for attempt in range(self.max_retries):
                try:
                    response = await client.request(**request_kwargs)
                    break
                except asyncio.TimeoutError:
                    if attempt < self.max_retries - 1:
                        await asyncio.sleep(1)
                        continue
                    raise
            
            if response is None:
                raise Exception("Failed to execute request after retries")
            
            # Extract response data
            try:
                response_body = response.text
            except Exception:
                response_body = ""
            
            return {
                'status_code': response.status_code,
                'headers': dict(response.headers),
                'body': response_body,
                'content_length': len(response_body),
                'time': response.elapsed.total_seconds() if response.elapsed else 0,
                'url': str(response.url),
            }
        
        except Exception as e:
            logger.error(f"Request execution error {method} {url}: {str(e)}")
            return {
                'status_code': 0,
                'error': str(e),
                'headers': {},
                'body': '',
                'content_length': 0,
                'time': 0,
                'url': url,
            }
    
    async def close(self):
        """Close HTTP client"""
        if self.client:
            await self.client.aclose()

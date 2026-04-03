import logging
import httpx
import asyncio
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
    
    async def _get_client(self):
        """Get or create async HTTP client"""
        if self.client is None:
            self.client = httpx.AsyncClient(timeout=self.timeout)
        return self.client
    
    def _is_blocked_url(self, url: str) -> tuple[bool, str]:
        """
        Check if URL is blocked (SSRF protection)
        Returns (is_blocked, reason)
        """
        try:
            parsed = urlparse(url)
            hostname = parsed.hostname
            
            if not hostname:
                return True, "Invalid URL: no hostname"
            
            # Block localhost
            if hostname in ['localhost', 'localhost.localdomain']:
                return True, f"Blocked: {hostname}"
            
            # Try to parse as IP
            try:
                ip = ipaddress.ip_address(hostname)
                
                # Block localhost IP
                if ip.is_loopback:
                    return True, f"Blocked: localhost IP {ip}"
                
                # Block private networks
                if ip.is_private:
                    return True, f"Blocked: private IP {ip}"
                
                # Block link-local
                if ip.is_link_local:
                    return True, f"Blocked: link-local IP {ip}"
            
            except ValueError:
                # Not an IP address, continue with hostname check
                pass
            
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

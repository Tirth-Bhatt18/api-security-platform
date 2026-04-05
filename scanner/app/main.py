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
                        
                        all_results.extend(vulnerabilities)
                    
                    except Exception as e:
                        logger.warning(f"Error testing mutation for {req.url}: {str(e)}")
                        continue

                # Dedicated rate-limit burst phase
                burst_tasks = [
                    executor.execute_request(
                        method=req.method,
                        url=req.url,
                        headers=req.headers,
                        body=req.body,
                    )
                    for _ in range(RATE_LIMIT_BURST_COUNT)
                ]
                burst_responses = await asyncio.gather(*burst_tasks, return_exceptions=True)
                normalized_burst = []
                for resp in burst_responses:
                    if isinstance(resp, Exception):
                        normalized_burst.append({'status_code': 0, 'error': str(resp)})
                    else:
                        normalized_burst.append(resp)

                rate_limit_vuln = analyzer.analyze_rate_limit(
                    endpoint=req.url,
                    method=req.method,
                    baseline=baseline_response,
                    burst_responses=normalized_burst,
                    burst_count=RATE_LIMIT_BURST_COUNT,
                )
                if rate_limit_vuln:
                    all_results.append(rate_limit_vuln)
            
            except Exception as e:
                logger.error(f"Error processing request {req.method} {req.url}: {str(e)}")
                continue
        
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

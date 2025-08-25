"""
Backend Bridge for Cartrita V2
Seamless communication bridge between Node.js and Python backends
"""
import asyncio
import json
import logging
import os
from typing import Dict, List, Optional, Any, Union
from datetime import datetime
from enum import Enum

import httpx
from pydantic import BaseModel, Field
from fastapi import HTTPException

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class RequestType(Enum):
    CHAT = "chat"
    AGENT_EXECUTION = "agent_execution"
    TOOL_EXECUTION = "tool_execution"
    FILE_OPERATION = "file_operation"
    DATABASE_QUERY = "database_query"
    MCP_REQUEST = "mcp_request"
    LANGCHAIN_EXECUTION = "langchain_execution"

class BackendService(Enum):
    NODE = "node"
    PYTHON = "python"
    BOTH = "both"

class BridgeRequest(BaseModel):
    request_id: str = Field(default_factory=lambda: f"req_{int(datetime.now().timestamp())}")
    request_type: RequestType
    target_service: BackendService
    data: Dict[str, Any]
    context: Optional[Dict[str, Any]] = None
    timeout: int = 30
    retry_count: int = 3

class BridgeResponse(BaseModel):
    request_id: str
    success: bool
    data: Optional[Any] = None
    error: Optional[str] = None
    service: BackendService
    execution_time: float
    timestamp: datetime = Field(default_factory=datetime.now)

class ServiceEndpoint(BaseModel):
    name: str
    url: str
    status: str = "unknown"
    last_check: Optional[datetime] = None
    response_time: float = 0.0

class BackendBridge:
    """Manages communication between Node.js and Python backends"""
    
    def __init__(self):
        self.services: Dict[BackendService, ServiceEndpoint] = {}
        self.client = httpx.AsyncClient(timeout=30.0)
        self.active_requests: Dict[str, BridgeRequest] = {}
        self._initialize_services()
    
    def _initialize_services(self):
        """Initialize backend service endpoints"""
        self.services[BackendService.NODE] = ServiceEndpoint(
            name="Node.js Backend",
            url=os.getenv("NODE_SERVICE_URL", "http://cartrita-v2-node:8001")
        )
        
        self.services[BackendService.PYTHON] = ServiceEndpoint(
            name="Python Backend", 
            url=os.getenv("PYTHON_SERVICE_URL", "http://cartrita-v2-python:8002")
        )
        
        logger.info("Initialized backend bridge services")
    
    async def health_check(self, service: BackendService) -> bool:
        """Check if a backend service is healthy"""
        if service not in self.services:
            return False
        
        endpoint = self.services[service]
        start_time = datetime.now()
        
        try:
            response = await self.client.get(f"{endpoint.url}/health")
            response_time = (datetime.now() - start_time).total_seconds()
            
            if response.status_code == 200:
                endpoint.status = "healthy"
                endpoint.response_time = response_time
                endpoint.last_check = datetime.now()
                return True
            else:
                endpoint.status = "unhealthy"
                return False
                
        except Exception as e:
            logger.warning(f"Health check failed for {endpoint.name}: {e}")
            endpoint.status = "offline"
            endpoint.last_check = datetime.now()
            return False
    
    async def health_check_all(self) -> Dict[BackendService, bool]:
        """Check health of all services"""
        results = {}
        for service in BackendService:
            if service != BackendService.BOTH:
                results[service] = await self.health_check(service)
        return results
    
    async def route_request(self, request: BridgeRequest) -> BridgeResponse:
        """Route a request to the appropriate backend service(s)"""
        start_time = datetime.now()
        request_id = request.request_id
        
        try:
            self.active_requests[request_id] = request
            
            if request.target_service == BackendService.BOTH:
                # Execute on both services and combine results
                return await self._execute_on_both_services(request, start_time)
            else:
                # Execute on single service
                return await self._execute_on_service(request, request.target_service, start_time)
                
        except Exception as e:
            logger.error(f"Error routing request {request_id}: {e}")
            execution_time = (datetime.now() - start_time).total_seconds()
            return BridgeResponse(
                request_id=request_id,
                success=False,
                error=str(e),
                service=request.target_service,
                execution_time=execution_time
            )
        finally:
            if request_id in self.active_requests:
                del self.active_requests[request_id]
    
    async def _execute_on_service(self, request: BridgeRequest, service: BackendService, start_time: datetime) -> BridgeResponse:
        """Execute request on a specific service"""
        if service not in self.services:
            raise ValueError(f"Unknown service: {service}")
        
        endpoint = self.services[service]
        
        # Check service health first
        if not await self.health_check(service):
            raise HTTPException(status_code=503, detail=f"Service {endpoint.name} is unavailable")
        
        # Route to appropriate endpoint based on request type
        url = self._get_service_url(service, request.request_type)
        
        response = await self._make_request(url, request)
        execution_time = (datetime.now() - start_time).total_seconds()
        
        return BridgeResponse(
            request_id=request.request_id,
            success=response.get("success", True),
            data=response,
            service=service,
            execution_time=execution_time
        )
    
    async def _execute_on_both_services(self, request: BridgeRequest, start_time: datetime) -> BridgeResponse:
        """Execute request on both services and combine results"""
        tasks = []
        
        for service in [BackendService.NODE, BackendService.PYTHON]:
            task = self._execute_on_service(request, service, start_time)
            tasks.append(task)
        
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        # Combine results
        combined_data = {}
        combined_success = True
        errors = []
        
        for i, result in enumerate(results):
            service = [BackendService.NODE, BackendService.PYTHON][i]
            
            if isinstance(result, Exception):
                combined_success = False
                errors.append(f"{service.value}: {str(result)}")
            else:
                combined_data[service.value] = result.data
                if not result.success:
                    combined_success = False
                    errors.append(f"{service.value}: {result.error}")
        
        execution_time = (datetime.now() - start_time).total_seconds()
        
        return BridgeResponse(
            request_id=request.request_id,
            success=combined_success,
            data=combined_data,
            error="; ".join(errors) if errors else None,
            service=BackendService.BOTH,
            execution_time=execution_time
        )
    
    def _get_service_url(self, service: BackendService, request_type: RequestType) -> str:
        """Get the appropriate URL for a service and request type"""
        base_url = self.services[service].url
        
        # Route mapping
        routes = {
            BackendService.NODE: {
                RequestType.CHAT: "/api/chat/enhanced/message",
                RequestType.DATABASE_QUERY: "/api/database/query",
                RequestType.FILE_OPERATION: "/api/files/operation",
            },
            BackendService.PYTHON: {
                RequestType.CHAT: "/api/v2/simple-chat",
                RequestType.AGENT_EXECUTION: "/api/v2/agents/execute",
                RequestType.TOOL_EXECUTION: "/api/v2/tools/execute", 
                RequestType.MCP_REQUEST: "/api/v2/mcp/execute",
                RequestType.LANGCHAIN_EXECUTION: "/api/v2/langchain/execute",
                RequestType.FILE_OPERATION: "/api/v2/files/operation",
            }
        }
        
        route = routes.get(service, {}).get(request_type)
        if not route:
            raise ValueError(f"No route found for {service.value} and {request_type.value}")
        
        return f"{base_url}{route}"
    
    async def _make_request(self, url: str, request: BridgeRequest) -> Dict:
        """Make HTTP request to backend service"""
        try:
            response = await self.client.post(
                url,
                json=request.data,
                timeout=request.timeout
            )
            
            if response.status_code == 200:
                return response.json()
            else:
                raise HTTPException(
                    status_code=response.status_code,
                    detail=f"Backend service returned {response.status_code}: {response.text}"
                )
                
        except httpx.TimeoutException:
            raise HTTPException(status_code=504, detail="Backend service timeout")
        except httpx.ConnectError:
            raise HTTPException(status_code=503, detail="Cannot connect to backend service")
    
    async def forward_to_node(self, data: Dict[str, Any], endpoint: str = "/api/proxy") -> Dict:
        """Forward request specifically to Node.js backend"""
        request = BridgeRequest(
            request_type=RequestType.DATABASE_QUERY,
            target_service=BackendService.NODE,
            data=data
        )
        
        response = await self.route_request(request)
        return response.data if response.success else {"error": response.error}
    
    async def forward_to_python(self, data: Dict[str, Any], request_type: RequestType = RequestType.CHAT) -> Dict:
        """Forward request specifically to Python backend"""
        request = BridgeRequest(
            request_type=request_type,
            target_service=BackendService.PYTHON,
            data=data
        )
        
        response = await self.route_request(request)
        return response.data if response.success else {"error": response.error}
    
    async def execute_chat_request(self, message: str, user_id: str, agent_id: str = None) -> Dict:
        """Execute chat request with intelligent routing"""
        chat_data = {
            "message": message,
            "user_id": user_id,
            "agent_id": agent_id
        }
        
        # Route to Python for AI processing
        request = BridgeRequest(
            request_type=RequestType.CHAT,
            target_service=BackendService.PYTHON,
            data=chat_data
        )
        
        response = await self.route_request(request)
        
        # Also save to Node.js database
        if response.success:
            db_data = {
                "message": message,
                "response": response.data.get("content", ""),
                "user_id": user_id,
                "agent_id": agent_id or "default",
                "timestamp": datetime.now().isoformat()
            }
            
            # Forward to Node.js for database storage (fire and forget)
            try:
                await self.forward_to_node(db_data, "/api/chat/save")
            except Exception as e:
                logger.warning(f"Failed to save chat to Node.js database: {e}")
        
        return response.data if response.success else {"error": response.error}
    
    async def execute_agent_task(self, agent_id: str, task: str, context: Dict = None) -> Dict:
        """Execute an agent task"""
        agent_data = {
            "agent_id": agent_id,
            "task": task,
            "context": context or {}
        }
        
        request = BridgeRequest(
            request_type=RequestType.AGENT_EXECUTION,
            target_service=BackendService.PYTHON,
            data=agent_data
        )
        
        response = await self.route_request(request)
        return response.data if response.success else {"error": response.error}
    
    async def execute_mcp_tool(self, tool_name: str, parameters: Dict, server_id: str = None) -> Dict:
        """Execute an MCP tool"""
        mcp_data = {
            "tool_name": tool_name,
            "parameters": parameters,
            "server_id": server_id
        }
        
        request = BridgeRequest(
            request_type=RequestType.MCP_REQUEST,
            target_service=BackendService.PYTHON,
            data=mcp_data
        )
        
        response = await self.route_request(request)
        return response.data if response.success else {"error": response.error}
    
    async def execute_langchain_task(self, chain_id: str, input_data: Dict) -> Dict:
        """Execute a LangChain task"""
        langchain_data = {
            "chain_id": chain_id,
            "input_data": input_data
        }
        
        request = BridgeRequest(
            request_type=RequestType.LANGCHAIN_EXECUTION,
            target_service=BackendService.PYTHON,
            data=langchain_data
        )
        
        response = await self.route_request(request)
        return response.data if response.success else {"error": response.error}
    
    async def get_bridge_status(self) -> Dict:
        """Get comprehensive bridge status"""
        health_results = await self.health_check_all()
        
        return {
            "services": {
                service.value: {
                    "name": endpoint.name,
                    "url": endpoint.url,
                    "status": endpoint.status,
                    "healthy": health_results.get(service, False),
                    "response_time": endpoint.response_time,
                    "last_check": endpoint.last_check.isoformat() if endpoint.last_check else None
                }
                for service, endpoint in self.services.items()
            },
            "active_requests": len(self.active_requests),
            "request_types_supported": [rt.value for rt in RequestType],
            "timestamp": datetime.now().isoformat()
        }
    
    async def close(self):
        """Close HTTP client"""
        await self.client.aclose()

# Global instance
backend_bridge = BackendBridge()
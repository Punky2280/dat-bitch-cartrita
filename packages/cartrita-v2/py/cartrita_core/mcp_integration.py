"""
MCP (Model Context Protocol) Integration for Cartrita V2
Provides seamless integration with MCP servers and tools
"""
import asyncio
import json
import logging
import os
from typing import Dict, List, Optional, Any, Union
from datetime import datetime

import httpx
from pydantic import BaseModel, Field

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class MCPTool(BaseModel):
    name: str
    description: str
    parameters: Dict[str, Any]
    server_id: str
    enabled: bool = True

class MCPServer(BaseModel):
    id: str
    name: str
    description: str
    endpoint: str
    status: str = "unknown"
    tools: List[MCPTool] = []
    last_ping: Optional[datetime] = None

class MCPRequest(BaseModel):
    tool_name: str
    parameters: Dict[str, Any]
    server_id: Optional[str] = None
    context: Optional[Dict[str, Any]] = None

class MCPResponse(BaseModel):
    success: bool
    result: Optional[Any] = None
    error: Optional[str] = None
    tool_name: str
    server_id: str
    execution_time: float
    timestamp: datetime = Field(default_factory=datetime.now)

class MCPIntegrationManager:
    """Manages MCP server connections and tool execution"""
    
    def __init__(self):
        self.servers: Dict[str, MCPServer] = {}
        self.tool_registry: Dict[str, MCPTool] = {}
        self.client = httpx.AsyncClient(timeout=30.0)
        self._initialize_default_servers()
    
    def _initialize_default_servers(self):
        """Initialize default MCP servers"""
        default_servers = [
            {
                "id": "cartrita_tools_server",
                "name": "Cartrita Tools Server", 
                "description": "Core tools and utilities for Cartrita agents",
                "endpoint": "http://localhost:8003",
                "tools": [
                    {
                        "name": "web_search",
                        "description": "Search the web for information",
                        "parameters": {
                            "query": {"type": "string", "description": "Search query"},
                            "num_results": {"type": "integer", "default": 10}
                        }
                    },
                    {
                        "name": "file_operations", 
                        "description": "Perform file system operations",
                        "parameters": {
                            "operation": {"type": "string", "enum": ["read", "write", "delete", "list"]},
                            "path": {"type": "string", "description": "File or directory path"},
                            "content": {"type": "string", "optional": True}
                        }
                    },
                    {
                        "name": "code_execution",
                        "description": "Execute code in a sandboxed environment",
                        "parameters": {
                            "language": {"type": "string", "enum": ["python", "javascript", "bash"]},
                            "code": {"type": "string", "description": "Code to execute"}
                        }
                    }
                ]
            },
            {
                "id": "data_analysis_server",
                "name": "Data Analysis Server",
                "description": "Advanced data analysis and visualization tools",
                "endpoint": "http://localhost:8004",
                "tools": [
                    {
                        "name": "analyze_dataset",
                        "description": "Analyze a dataset and provide insights", 
                        "parameters": {
                            "data": {"type": "array", "description": "Dataset to analyze"},
                            "analysis_type": {"type": "string", "enum": ["descriptive", "correlation", "regression"]}
                        }
                    },
                    {
                        "name": "create_visualization",
                        "description": "Create data visualizations",
                        "parameters": {
                            "data": {"type": "array", "description": "Data to visualize"},
                            "chart_type": {"type": "string", "enum": ["bar", "line", "scatter", "pie"]}
                        }
                    }
                ]
            },
            {
                "id": "computer_use_server", 
                "name": "Computer Use Server",
                "description": "Computer automation and control tools",
                "endpoint": "http://localhost:8005",
                "tools": [
                    {
                        "name": "take_screenshot",
                        "description": "Take a screenshot of the screen",
                        "parameters": {
                            "region": {"type": "object", "optional": True}
                        }
                    },
                    {
                        "name": "mouse_click",
                        "description": "Click at specific coordinates",
                        "parameters": {
                            "x": {"type": "integer", "description": "X coordinate"},
                            "y": {"type": "integer", "description": "Y coordinate"},
                            "button": {"type": "string", "enum": ["left", "right", "middle"], "default": "left"}
                        }
                    },
                    {
                        "name": "keyboard_type",
                        "description": "Type text using keyboard",
                        "parameters": {
                            "text": {"type": "string", "description": "Text to type"}
                        }
                    }
                ]
            }
        ]
        
        for server_config in default_servers:
            server_id = server_config["id"]
            tools = []
            
            for tool_config in server_config.get("tools", []):
                tool = MCPTool(
                    name=tool_config["name"],
                    description=tool_config["description"],
                    parameters=tool_config["parameters"],
                    server_id=server_id
                )
                tools.append(tool)
                self.tool_registry[tool_config["name"]] = tool
            
            server = MCPServer(
                id=server_id,
                name=server_config["name"],
                description=server_config["description"],
                endpoint=server_config["endpoint"],
                tools=tools
            )
            
            self.servers[server_id] = server
        
        logger.info(f"Initialized {len(self.servers)} MCP servers with {len(self.tool_registry)} tools")
    
    async def ping_server(self, server_id: str) -> bool:
        """Ping a server to check if it's alive"""
        if server_id not in self.servers:
            return False
        
        server = self.servers[server_id]
        try:
            response = await self.client.get(f"{server.endpoint}/health")
            if response.status_code == 200:
                server.status = "online"
                server.last_ping = datetime.now()
                return True
            else:
                server.status = "error"
                return False
        except Exception as e:
            logger.warning(f"Failed to ping server {server_id}: {e}")
            server.status = "offline"
            return False
    
    async def ping_all_servers(self) -> Dict[str, bool]:
        """Ping all servers and return their status"""
        results = {}
        for server_id in self.servers:
            results[server_id] = await self.ping_server(server_id)
        return results
    
    async def execute_tool(self, request: MCPRequest) -> MCPResponse:
        """Execute a tool on the appropriate MCP server"""
        start_time = datetime.now()
        
        try:
            # Find the tool
            tool = self.tool_registry.get(request.tool_name)
            if not tool:
                return MCPResponse(
                    success=False,
                    error=f"Tool '{request.tool_name}' not found",
                    tool_name=request.tool_name,
                    server_id="unknown",
                    execution_time=0.0
                )
            
            # Get the server
            server_id = request.server_id or tool.server_id
            server = self.servers.get(server_id)
            if not server:
                return MCPResponse(
                    success=False,
                    error=f"Server '{server_id}' not found",
                    tool_name=request.tool_name,
                    server_id=server_id,
                    execution_time=0.0
                )
            
            # Check if server is reachable
            if server.status == "offline" or not await self.ping_server(server_id):
                return MCPResponse(
                    success=False,
                    error=f"Server '{server_id}' is offline",
                    tool_name=request.tool_name,
                    server_id=server_id,
                    execution_time=0.0
                )
            
            # Execute the tool
            payload = {
                "tool": request.tool_name,
                "parameters": request.parameters,
                "context": request.context or {}
            }
            
            response = await self.client.post(
                f"{server.endpoint}/execute",
                json=payload
            )
            
            if response.status_code == 200:
                result = response.json()
                execution_time = (datetime.now() - start_time).total_seconds()
                
                return MCPResponse(
                    success=True,
                    result=result,
                    tool_name=request.tool_name,
                    server_id=server_id,
                    execution_time=execution_time
                )
            else:
                execution_time = (datetime.now() - start_time).total_seconds()
                return MCPResponse(
                    success=False,
                    error=f"Server returned status {response.status_code}: {response.text}",
                    tool_name=request.tool_name,
                    server_id=server_id,
                    execution_time=execution_time
                )
                
        except Exception as e:
            execution_time = (datetime.now() - start_time).total_seconds()
            logger.error(f"Error executing tool {request.tool_name}: {e}")
            return MCPResponse(
                success=False,
                error=str(e),
                tool_name=request.tool_name,
                server_id=request.server_id or "unknown",
                execution_time=execution_time
            )
    
    async def get_available_tools(self, server_id: Optional[str] = None) -> List[MCPTool]:
        """Get list of available tools, optionally filtered by server"""
        if server_id:
            server = self.servers.get(server_id)
            return server.tools if server else []
        else:
            return list(self.tool_registry.values())
    
    async def register_tool(self, tool: MCPTool, server_id: str):
        """Register a new tool with a server"""
        if server_id not in self.servers:
            raise ValueError(f"Server {server_id} not found")
        
        tool.server_id = server_id
        self.tool_registry[tool.name] = tool
        self.servers[server_id].tools.append(tool)
        
        logger.info(f"Registered tool '{tool.name}' with server '{server_id}'")
    
    async def unregister_tool(self, tool_name: str):
        """Unregister a tool"""
        if tool_name in self.tool_registry:
            tool = self.tool_registry[tool_name]
            server = self.servers.get(tool.server_id)
            if server:
                server.tools = [t for t in server.tools if t.name != tool_name]
            del self.tool_registry[tool_name]
            logger.info(f"Unregistered tool '{tool_name}'")
    
    async def add_server(self, server: MCPServer):
        """Add a new MCP server"""
        self.servers[server.id] = server
        
        # Register all tools from this server
        for tool in server.tools:
            tool.server_id = server.id
            self.tool_registry[tool.name] = tool
        
        logger.info(f"Added MCP server '{server.id}' with {len(server.tools)} tools")
    
    async def remove_server(self, server_id: str):
        """Remove an MCP server and its tools"""
        if server_id not in self.servers:
            return
        
        server = self.servers[server_id]
        
        # Remove all tools from this server
        for tool in server.tools:
            if tool.name in self.tool_registry:
                del self.tool_registry[tool.name]
        
        # Remove the server
        del self.servers[server_id]
        logger.info(f"Removed MCP server '{server_id}'")
    
    async def get_server_status(self) -> Dict[str, Dict]:
        """Get comprehensive status of all servers"""
        status = {}
        for server_id, server in self.servers.items():
            is_online = await self.ping_server(server_id)
            status[server_id] = {
                "name": server.name,
                "description": server.description,
                "endpoint": server.endpoint,
                "status": server.status,
                "online": is_online,
                "tools_count": len(server.tools),
                "last_ping": server.last_ping.isoformat() if server.last_ping else None
            }
        return status
    
    async def execute_tool_chain(self, requests: List[MCPRequest]) -> List[MCPResponse]:
        """Execute a chain of tools in sequence"""
        responses = []
        context = {}
        
        for request in requests:
            # Add accumulated context to each request
            request.context = {**(request.context or {}), **context}
            
            response = await self.execute_tool(request)
            responses.append(response)
            
            # If successful, add result to context for next tool
            if response.success and response.result:
                context[f"{request.tool_name}_result"] = response.result
        
        return responses
    
    async def close(self):
        """Close the HTTP client"""
        await self.client.aclose()

# Global instance
mcp_manager = MCPIntegrationManager()
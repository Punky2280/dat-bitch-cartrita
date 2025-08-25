"""
Python MCP Bridge Implementation - Iteration 1
Seamless Node.js ↔ Python communication via MCP protocol
"""

import asyncio
import json
import logging
import socket
import struct
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Union

import msgpack
from pydantic import BaseModel, Field

from ..schema import (
    MCPMessage,
    TaskRequest,
    TaskResponse,
    AgentRegistration,
    TaskStatus,
    AgentType,
)
from ..transport.base import BaseMCPTransport, TransportError

logger = logging.getLogger(__name__)


class PythonAgentCapability(BaseModel):
    """Python-specific agent capability definition"""
    name: str = Field(..., description="Capability name")
    category: str = Field(..., description="Category (ml, data, vector, nlp, vision)")
    priority: int = Field(default=50, description="Priority score (0-100)")
    resource_requirements: Dict[str, Any] = Field(default_factory=dict)
    dependencies: List[str] = Field(default_factory=list)
    performance_profile: Dict[str, float] = Field(default_factory=dict)


class PythonAgent:
    """Base class for Python agents in the hybrid system"""
    
    def __init__(self, name: str, agent_type: AgentType = AgentType.SPECIALIZED):
        self.name = name
        self.agent_type = agent_type
        self.capabilities: List[PythonAgentCapability] = []
        self.is_registered = False
        self.mcp_bridge = None
        
    async def register_capabilities(self, capabilities: List[PythonAgentCapability]):
        """Register agent capabilities with the MCP system"""
        self.capabilities = capabilities
        
        if self.mcp_bridge:
            await self.mcp_bridge.register_python_agent(self)
            
    async def execute_task(self, task_request: TaskRequest) -> TaskResponse:
        """Execute a task - to be implemented by subclasses"""
        raise NotImplementedError("Subclasses must implement execute_task")
        
    async def can_handle_task(self, task_request: TaskRequest) -> bool:
        """Check if this agent can handle the given task"""
        task_type = task_request.task_type
        required_capabilities = task_request.context.get("required_capabilities", [])
        
        # Check if we have matching capabilities
        our_capability_names = [cap.name for cap in self.capabilities]
        return any(cap in our_capability_names for cap in required_capabilities)


class MCPPythonBridge(BaseMCPTransport):
    """Python bridge for MCP communication with Node.js orchestrator"""
    
    def __init__(
        self,
        socket_path: str = "/tmp/cartrita_mcp.sock",
        node_service_url: str = "http://localhost:8002",
        python_service_port: int = 8003
    ):
        super().__init__()
        self.socket_path = socket_path
        self.node_service_url = node_service_url
        self.python_service_port = python_service_port
        
        # Connection management
        self.reader: Optional[asyncio.StreamReader] = None
        self.writer: Optional[asyncio.StreamWriter] = None
        self.is_connected = False
        self.connection_lock = asyncio.Lock()
        
        # Agent registry
        self.registered_agents: Dict[str, PythonAgent] = {}
        self.capability_index: Dict[str, List[str]] = {}  # capability -> agent_names
        
        # Task management
        self.active_tasks: Dict[str, asyncio.Task] = {}
        self.task_results: Dict[str, TaskResponse] = {}
        
        # Statistics
        self.stats = {
            "messages_sent": 0,
            "messages_received": 0,
            "tasks_executed": 0,
            "agents_registered": 0,
            "connection_failures": 0,
            "last_heartbeat": None,
        }
        
        logger.info(f"Python MCP Bridge initialized - Socket: {socket_path}")

    async def initialize(self) -> bool:
        """Initialize the bridge connection to Node.js MCP orchestrator"""
        try:
            await self._connect_to_orchestrator()
            
            # Start heartbeat and message handling
            asyncio.create_task(self._heartbeat_loop())
            asyncio.create_task(self._message_handler_loop())
            
            logger.info("Python MCP Bridge successfully initialized")
            return True
            
        except Exception as e:
            logger.error(f"Failed to initialize Python MCP Bridge: {e}")
            self.stats["connection_failures"] += 1
            return False

    async def _connect_to_orchestrator(self) -> None:
        """Establish Unix socket connection to Node.js MCP orchestrator"""
        async with self.connection_lock:
            try:
                # Connect to Unix socket
                self.reader, self.writer = await asyncio.open_unix_connection(self.socket_path)
                self.is_connected = True
                
                # Send initial handshake
                handshake = MCPMessage(
                    id=str(uuid.uuid4()),
                    type="handshake",
                    source="python-bridge",
                    target="node-orchestrator",
                    payload={
                        "service_type": "python_mcp_bridge",
                        "version": "1.0.0",
                        "capabilities": ["agent_registration", "task_execution", "streaming"],
                        "port": self.python_service_port,
                    },
                    timestamp=datetime.now(timezone.utc)
                )
                
                await self._send_message(handshake)
                logger.info("Handshake sent to Node.js MCP orchestrator")
                
            except Exception as e:
                self.is_connected = False
                raise TransportError(f"Failed to connect to MCP orchestrator: {e}")

    async def _send_message(self, message: MCPMessage) -> None:
        """Send message via Unix socket with MessagePack encoding"""
        if not self.writer:
            raise TransportError("Not connected to MCP orchestrator")
            
        try:
            # Serialize message
            message_data = message.dict()
            packed_data = msgpack.packb(message_data, use_bin_type=True)
            
            # Send with length prefix
            length = struct.pack("!I", len(packed_data))
            self.writer.write(length + packed_data)
            await self.writer.drain()
            
            self.stats["messages_sent"] += 1
            logger.debug(f"Sent message: {message.type} -> {message.target}")
            
        except Exception as e:
            logger.error(f"Failed to send message: {e}")
            raise TransportError(f"Message send failed: {e}")

    async def _receive_message(self) -> Optional[MCPMessage]:
        """Receive message from Unix socket with MessagePack decoding"""
        if not self.reader:
            return None
            
        try:
            # Read length prefix
            length_data = await self.reader.read(4)
            if not length_data:
                return None
                
            length = struct.unpack("!I", length_data)[0]
            
            # Read message data
            message_data = await self.reader.read(length)
            if not message_data:
                return None
                
            # Deserialize
            unpacked_data = msgpack.unpackb(message_data, raw=False)
            message = MCPMessage(**unpacked_data)
            
            self.stats["messages_received"] += 1
            logger.debug(f"Received message: {message.type} from {message.source}")
            
            return message
            
        except Exception as e:
            logger.error(f"Failed to receive message: {e}")
            return None

    async def register_python_agent(self, agent: PythonAgent) -> bool:
        """Register a Python agent with the Node.js MCP orchestrator"""
        try:
            # Build capability information
            capabilities_data = []
            for cap in agent.capabilities:
                capabilities_data.append({
                    "name": cap.name,
                    "category": cap.category,
                    "priority": cap.priority,
                    "resource_requirements": cap.resource_requirements,
                    "dependencies": cap.dependencies,
                    "performance_profile": cap.performance_profile,
                })
                
                # Update capability index
                if cap.name not in self.capability_index:
                    self.capability_index[cap.name] = []
                self.capability_index[cap.name].append(agent.name)

            # Create registration message
            registration = MCPMessage(
                id=str(uuid.uuid4()),
                type="agent_registration",
                source="python-bridge",
                target="node-orchestrator",
                payload={
                    "agent_name": agent.name,
                    "agent_type": agent.agent_type.value,
                    "language": "python",
                    "capabilities": capabilities_data,
                    "service_endpoint": f"python://localhost:{self.python_service_port}/{agent.name}",
                    "status": "ready",
                },
                timestamp=datetime.now(timezone.utc)
            )
            
            await self._send_message(registration)
            
            # Store agent locally
            self.registered_agents[agent.name] = agent
            agent.is_registered = True
            agent.mcp_bridge = self
            
            self.stats["agents_registered"] += 1
            logger.info(f"Registered Python agent: {agent.name}")
            
            return True
            
        except Exception as e:
            logger.error(f"Failed to register Python agent {agent.name}: {e}")
            return False

    async def _message_handler_loop(self):
        """Main message handling loop"""
        while self.is_connected:
            try:
                message = await self._receive_message()
                if not message:
                    await asyncio.sleep(0.1)
                    continue
                    
                # Handle different message types
                if message.type == "task_request":
                    await self._handle_task_request(message)
                elif message.type == "heartbeat":
                    await self._handle_heartbeat(message)
                elif message.type == "agent_query":
                    await self._handle_agent_query(message)
                elif message.type == "status_request":
                    await self._handle_status_request(message)
                else:
                    logger.warning(f"Unknown message type: {message.type}")
                    
            except Exception as e:
                logger.error(f"Message handling error: {e}")
                await asyncio.sleep(1)

    async def _handle_task_request(self, message: MCPMessage):
        """Handle incoming task request from Node.js orchestrator"""
        try:
            task_request = TaskRequest(**message.payload)
            
            # Find capable agent
            capable_agents = []
            for agent_name, agent in self.registered_agents.items():
                if await agent.can_handle_task(task_request):
                    capable_agents.append((agent_name, agent))
            
            if not capable_agents:
                # Send error response
                error_response = MCPMessage(
                    id=str(uuid.uuid4()),
                    type="task_response",
                    source="python-bridge",
                    target=message.source,
                    payload={
                        "task_id": task_request.task_id,
                        "status": TaskStatus.FAILED.value,
                        "error": "No capable Python agent found",
                    },
                    correlation_id=message.id,
                    timestamp=datetime.now(timezone.utc)
                )
                await self._send_message(error_response)
                return
            
            # Select best agent (simple selection for now)
            selected_agent_name, selected_agent = capable_agents[0]
            
            # Execute task asynchronously
            task_coroutine = self._execute_agent_task(selected_agent, task_request, message.source, message.id)
            task = asyncio.create_task(task_coroutine)
            self.active_tasks[task_request.task_id] = task
            
            # Send acceptance response
            acceptance_response = MCPMessage(
                id=str(uuid.uuid4()),
                type="task_response",
                source="python-bridge",
                target=message.source,
                payload={
                    "task_id": task_request.task_id,
                    "status": TaskStatus.ACCEPTED.value,
                    "assigned_agent": selected_agent_name,
                    "estimated_completion": None,  # TODO: Add estimation
                },
                correlation_id=message.id,
                timestamp=datetime.now(timezone.utc)
            )
            await self._send_message(acceptance_response)
            
        except Exception as e:
            logger.error(f"Failed to handle task request: {e}")

    async def _execute_agent_task(self, agent: PythonAgent, task_request: TaskRequest, response_target: str, correlation_id: str):
        """Execute task with the selected agent"""
        try:
            # Update task status to running
            running_response = MCPMessage(
                id=str(uuid.uuid4()),
                type="task_response", 
                source="python-bridge",
                target=response_target,
                payload={
                    "task_id": task_request.task_id,
                    "status": TaskStatus.RUNNING.value,
                    "agent": agent.name,
                },
                correlation_id=correlation_id,
                timestamp=datetime.now(timezone.utc)
            )
            await self._send_message(running_response)
            
            # Execute the actual task
            start_time = datetime.now(timezone.utc)
            task_response = await agent.execute_task(task_request)
            end_time = datetime.now(timezone.utc)
            
            # Calculate execution time
            execution_time = (end_time - start_time).total_seconds()
            task_response.execution_time = execution_time
            task_response.agent_name = agent.name
            
            # Send completion response
            completion_response = MCPMessage(
                id=str(uuid.uuid4()),
                type="task_response",
                source="python-bridge", 
                target=response_target,
                payload=task_response.dict(),
                correlation_id=correlation_id,
                timestamp=datetime.now(timezone.utc)
            )
            await self._send_message(completion_response)
            
            # Update statistics
            self.stats["tasks_executed"] += 1
            
            # Clean up
            if task_request.task_id in self.active_tasks:
                del self.active_tasks[task_request.task_id]
            
            logger.info(f"Task {task_request.task_id} completed by {agent.name} in {execution_time:.2f}s")
            
        except Exception as e:
            logger.error(f"Task execution failed: {e}")
            
            # Send error response
            error_response = MCPMessage(
                id=str(uuid.uuid4()),
                type="task_response",
                source="python-bridge",
                target=response_target,
                payload={
                    "task_id": task_request.task_id,
                    "status": TaskStatus.FAILED.value,
                    "error": str(e),
                    "agent": agent.name,
                },
                correlation_id=correlation_id,
                timestamp=datetime.now(timezone.utc)
            )
            await self._send_message(error_response)

    async def _handle_heartbeat(self, message: MCPMessage):
        """Handle heartbeat from orchestrator"""
        self.stats["last_heartbeat"] = datetime.now(timezone.utc)
        
        # Send heartbeat response
        response = MCPMessage(
            id=str(uuid.uuid4()),
            type="heartbeat_response", 
            source="python-bridge",
            target=message.source,
            payload={
                "status": "healthy",
                "active_tasks": len(self.active_tasks),
                "registered_agents": len(self.registered_agents),
                "stats": self.stats.copy(),
            },
            correlation_id=message.id,
            timestamp=datetime.now(timezone.utc)
        )
        await self._send_message(response)

    async def _handle_agent_query(self, message: MCPMessage):
        """Handle agent capability queries"""
        query = message.payload
        
        matching_agents = []
        if "capabilities" in query:
            required_caps = query["capabilities"]
            for agent_name, agent in self.registered_agents.items():
                agent_caps = [cap.name for cap in agent.capabilities]
                if any(cap in agent_caps for cap in required_caps):
                    matching_agents.append({
                        "name": agent_name,
                        "capabilities": [cap.dict() for cap in agent.capabilities],
                        "status": "ready" if agent.is_registered else "not_ready",
                    })
        
        response = MCPMessage(
            id=str(uuid.uuid4()),
            type="agent_query_response",
            source="python-bridge",
            target=message.source,
            payload={
                "matching_agents": matching_agents,
                "total_agents": len(self.registered_agents),
            },
            correlation_id=message.id,
            timestamp=datetime.now(timezone.utc)
        )
        await self._send_message(response)

    async def _handle_status_request(self, message: MCPMessage):
        """Handle status requests"""
        status = {
            "bridge_status": "healthy" if self.is_connected else "disconnected",
            "registered_agents": len(self.registered_agents),
            "active_tasks": len(self.active_tasks),
            "capability_index": self.capability_index,
            "statistics": self.stats.copy(),
            "uptime": None,  # TODO: Add uptime tracking
        }
        
        response = MCPMessage(
            id=str(uuid.uuid4()),
            type="status_response",
            source="python-bridge", 
            target=message.source,
            payload=status,
            correlation_id=message.id,
            timestamp=datetime.now(timezone.utc)
        )
        await self._send_message(response)

    async def _heartbeat_loop(self):
        """Send periodic heartbeat to orchestrator"""
        while self.is_connected:
            try:
                heartbeat = MCPMessage(
                    id=str(uuid.uuid4()),
                    type="heartbeat",
                    source="python-bridge",
                    target="node-orchestrator", 
                    payload={
                        "status": "healthy",
                        "timestamp": datetime.now(timezone.utc).isoformat(),
                    },
                    timestamp=datetime.now(timezone.utc)
                )
                await self._send_message(heartbeat)
                await asyncio.sleep(30)  # Heartbeat every 30 seconds
                
            except Exception as e:
                logger.error(f"Heartbeat failed: {e}")
                await asyncio.sleep(5)

    async def shutdown(self):
        """Gracefully shutdown the bridge"""
        try:
            # Cancel active tasks
            for task_id, task in self.active_tasks.items():
                task.cancel()
                logger.info(f"Cancelled active task: {task_id}")
                
            # Send shutdown notification
            if self.is_connected:
                shutdown_message = MCPMessage(
                    id=str(uuid.uuid4()),
                    type="shutdown",
                    source="python-bridge",
                    target="node-orchestrator",
                    payload={"reason": "graceful_shutdown"},
                    timestamp=datetime.now(timezone.utc)
                )
                await self._send_message(shutdown_message)
            
            # Close connection
            if self.writer:
                self.writer.close()
                await self.writer.wait_closed()
                
            self.is_connected = False
            logger.info("Python MCP Bridge shutdown complete")
            
        except Exception as e:
            logger.error(f"Shutdown error: {e}")


# Global bridge instance
mcp_bridge: Optional[MCPPythonBridge] = None


async def initialize_python_bridge(
    socket_path: str = "/tmp/cartrita_mcp.sock",
    node_service_url: str = "http://localhost:8002",
    python_service_port: int = 8003
) -> MCPPythonBridge:
    """Initialize the global Python MCP bridge"""
    global mcp_bridge
    
    mcp_bridge = MCPPythonBridge(socket_path, node_service_url, python_service_port)
    success = await mcp_bridge.initialize()
    
    if not success:
        raise RuntimeError("Failed to initialize Python MCP bridge")
    
    return mcp_bridge


def get_mcp_bridge() -> Optional[MCPPythonBridge]:
    """Get the global MCP bridge instance"""
    return mcp_bridge
"""
MCP Core Python Package
Provides the foundational types, transports, and utilities for the MCP system
"""

from .schema import (
    # Core types
    MCPMessage,
    MCPContext,
    TaskRequest,
    TaskResponse,
    DeliveryOptions,
    CostBudget,
    ResourceLimits,
    HealthStatus,
    AgentRegistration,
    TaskMetrics,
    
    # Enums
    DeliveryGuarantee,
    TaskStatus,
    AgentType,
    StreamStatus,
    CommandType,
    
    # Constants
    MessageTypes,
    TaskTypes,
    ErrorCodes,
    AGENT_CAPABILITIES,
    
    # Utilities
    MCPValidator,
    create_mcp_context,
    create_delivery_options,
)

from .transport.base import BaseMCPTransport, TransportError
from .transport.unix_socket import (
    MCPUnixSocketServer,
    MCPUnixSocketClient,
    UnixSocketTransportError,
)

__version__ = "1.0.0"
__all__ = [
    # Core types
    "MCPMessage",
    "MCPContext", 
    "TaskRequest",
    "TaskResponse",
    "DeliveryOptions",
    "CostBudget",
    "ResourceLimits",
    "HealthStatus",
    "AgentRegistration",
    "TaskMetrics",
    
    # Enums
    "DeliveryGuarantee",
    "TaskStatus", 
    "AgentType",
    "StreamStatus",
    "CommandType",
    
    # Constants
    "MessageTypes",
    "TaskTypes",
    "ErrorCodes",
    "AGENT_CAPABILITIES",
    
    # Utilities
    "MCPValidator",
    "create_mcp_context",
    "create_delivery_options",
    
    # Transport
    "BaseMCPTransport",
    "TransportError",
    "MCPUnixSocketServer",
    "MCPUnixSocketClient", 
    "UnixSocketTransportError",
]
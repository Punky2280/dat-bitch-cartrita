"""
Base transport class for MCP
Provides common functionality for all transport implementations
"""

from abc import ABC, abstractmethod
from typing import Optional, Callable, Any
import logging

from ..schema import MCPMessage, TaskResponse, TaskStatus, MessageTypes, TaskMetrics, ErrorCodes

logger = logging.getLogger(__name__)


class TransportError(Exception):
    """Base exception for transport errors"""
    pass


class BaseMCPTransport(ABC):
    """Base class for all MCP transports"""
    
    def __init__(self, enable_validation: bool = True):
        self.enable_validation = enable_validation
        self.message_handler: Optional[Callable[[MCPMessage], None]] = None
        
    def set_message_handler(self, handler: Callable[[MCPMessage], None]) -> None:
        """Set the message handler function"""
        self.message_handler = handler
        
    @abstractmethod
    async def send_message(self, message: MCPMessage) -> None:
        """Send a message"""
        pass
        
    def _create_error_response(self, original_message: MCPMessage, error_message: str, error_code: str = ErrorCodes.INTERNAL_ERROR) -> MCPMessage:
        """Create an error response message"""
        error_response = TaskResponse(
            task_id=original_message.correlation_id or original_message.id,
            status=TaskStatus.FAILED,
            error_message=error_message,
            error_code=error_code,
            metrics=TaskMetrics(
                processing_time_ms=0,
                queue_time_ms=0,
                retry_count=0,
                cost_usd=0.0,
                tokens_used=0,
                custom_metrics={}
            ),
            warnings=[]
        )
        
        return MCPMessage(
            id=f"error_{original_message.id}",
            correlation_id=original_message.id,
            trace_id=original_message.trace_id,
            span_id=original_message.span_id,
            sender=original_message.recipient,  # Swap sender/recipient
            recipient=original_message.sender,
            message_type=MessageTypes.TASK_RESPONSE,
            payload=error_response.model_dump(),
            tags=["error"],
            context=original_message.context,
            delivery=original_message.delivery,
            created_at=original_message.created_at,
            permissions=[]
        )
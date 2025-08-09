"""
MCP Schema Types and Validation
Python implementation using Pydantic v2 that mirrors the TypeScript Zod schemas
"""

from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional, Union
from uuid import uuid4

from pydantic import BaseModel, Field, validator, ConfigDict
from pydantic.functional_validators import field_validator


class DeliveryGuarantee(str, Enum):
    AT_MOST_ONCE = "AT_MOST_ONCE"
    AT_LEAST_ONCE = "AT_LEAST_ONCE"
    EXACTLY_ONCE = "EXACTLY_ONCE"


class TaskStatus(str, Enum):
    PENDING = "PENDING"
    RUNNING = "RUNNING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"
    CANCELLED = "CANCELLED"
    TIMEOUT = "TIMEOUT"


class AgentType(str, Enum):
    ORCHESTRATOR = "ORCHESTRATOR"
    SUPERVISOR = "SUPERVISOR"
    SUB_AGENT = "SUB_AGENT"


class StreamStatus(str, Enum):
    COMPLETED = "COMPLETED"
    CANCELLED = "CANCELLED"
    FAILED = "FAILED"


class CommandType(str, Enum):
    SHUTDOWN = "SHUTDOWN"
    RESTART = "RESTART"
    SCALE_UP = "SCALE_UP"
    SCALE_DOWN = "SCALE_DOWN"
    HEALTH_CHECK = "HEALTH_CHECK"
    CONFIG_UPDATE = "CONFIG_UPDATE"


# Core data models
class CostBudget(BaseModel):
    model_config = ConfigDict(extra="forbid")
    
    max_usd: float = Field(ge=0, description="Maximum USD spend")
    max_tokens: int = Field(ge=0, description="Maximum token usage")
    used_usd: float = Field(ge=0, description="Current USD spent")
    used_tokens: int = Field(ge=0, description="Current tokens used")
    model_costs: Dict[str, float] = Field(default_factory=dict, description="Per-model cost tracking")


class ResourceLimits(BaseModel):
    model_config = ConfigDict(extra="forbid")
    
    max_cpu_percent: int = Field(ge=0, le=100, description="Maximum CPU utilization")
    max_memory_mb: int = Field(ge=0, description="Maximum memory usage")
    max_concurrent_requests: int = Field(ge=1, description="Request concurrency limit")
    max_processing_time_ms: int = Field(ge=0, description="Maximum processing time")


class MCPContext(BaseModel):
    model_config = ConfigDict(extra="forbid")
    
    trace_id: str = Field(description="Distributed tracing identifier")
    span_id: str = Field(description="Span identifier within trace")
    parent_span_id: Optional[str] = None
    baggage: Dict[str, str] = Field(default_factory=dict)
    user_id: Optional[str] = None
    session_id: Optional[str] = None
    workspace_id: Optional[str] = None
    request_id: str = Field(description="Unique request identifier")
    timeout_ms: int = Field(ge=0, description="Request timeout in milliseconds")
    metadata: Dict[str, str] = Field(default_factory=dict)
    budget: Optional[CostBudget] = None
    limits: Optional[ResourceLimits] = None


class DeliveryOptions(BaseModel):
    model_config = ConfigDict(extra="forbid")
    
    guarantee: DeliveryGuarantee
    retry_count: int = Field(ge=0, le=10)
    retry_delay_ms: int = Field(ge=0)
    require_ack: bool
    priority: int = Field(ge=0, le=10)


class MCPMessage(BaseModel):
    model_config = ConfigDict(extra="forbid")
    
    id: str = Field(description="Unique message identifier")
    correlation_id: Optional[str] = None
    trace_id: str
    span_id: str
    sender: str
    recipient: str
    message_type: str
    payload: Any
    tags: List[str] = Field(default_factory=list)
    context: MCPContext
    delivery: DeliveryOptions
    created_at: datetime
    expires_at: Optional[datetime] = None
    security_token: Optional[str] = None
    permissions: List[str] = Field(default_factory=list)

    @field_validator('id')
    @classmethod
    def validate_uuid(cls, v):
        # Basic UUID format validation
        if len(v.split('-')) != 5:
            raise ValueError('Invalid UUID format')
        return v


class TaskMetrics(BaseModel):
    model_config = ConfigDict(extra="forbid")
    
    processing_time_ms: int = Field(ge=0)
    queue_time_ms: int = Field(ge=0)
    retry_count: int = Field(ge=0)
    cost_usd: float = Field(ge=0)
    tokens_used: int = Field(ge=0)
    model_used: Optional[str] = None
    custom_metrics: Dict[str, float] = Field(default_factory=dict)


class TaskRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    
    task_type: str
    task_id: str
    parameters: Any
    metadata: Dict[str, str] = Field(default_factory=dict)
    preferred_agent: Optional[str] = None
    priority: int = Field(ge=0, le=10, default=5)
    deadline: Optional[datetime] = None


class TaskResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")
    
    task_id: str
    status: TaskStatus
    result: Optional[Any] = None
    error_message: Optional[str] = None
    error_code: Optional[str] = None
    metrics: TaskMetrics
    warnings: List[str] = Field(default_factory=list)


class HealthStatus(BaseModel):
    model_config = ConfigDict(extra="forbid")
    
    healthy: bool
    status_message: str
    cpu_usage: float = Field(ge=0, le=100)
    memory_mb: int = Field(ge=0)
    active_tasks: int = Field(ge=0)
    last_heartbeat: datetime


class AgentRegistration(BaseModel):
    model_config = ConfigDict(extra="forbid")
    
    agent_id: str
    agent_name: str
    type: AgentType
    version: str
    capabilities: List[str]
    metadata: Dict[str, str] = Field(default_factory=dict)
    health: HealthStatus
    registered_at: datetime


class StreamStart(BaseModel):
    model_config = ConfigDict(extra="forbid")
    
    stream_id: str
    content_type: str
    metadata: Dict[str, str] = Field(default_factory=dict)
    estimated_size: int = Field(ge=0)


class StreamData(BaseModel):
    model_config = ConfigDict(extra="forbid")
    
    stream_id: str
    sequence: int = Field(ge=0)
    data: bytes
    is_final: bool


class StreamEnd(BaseModel):
    model_config = ConfigDict(extra="forbid")
    
    stream_id: str
    status: StreamStatus
    error_message: Optional[str] = None
    total_bytes: int = Field(ge=0)


# Message type constants
class MessageTypes:
    # Task messages
    TASK_REQUEST = "TASK_REQUEST"
    TASK_RESPONSE = "TASK_RESPONSE"
    TASK_PROGRESS = "TASK_PROGRESS"
    TASK_CANCEL = "TASK_CANCEL"
    
    # Stream messages
    STREAM_START = "STREAM_START"
    STREAM_DATA = "STREAM_DATA"
    STREAM_END = "STREAM_END"
    
    # System messages
    HEARTBEAT = "HEARTBEAT"
    HEALTH_CHECK = "HEALTH_CHECK"
    AGENT_REGISTER = "AGENT_REGISTER"
    AGENT_DEREGISTER = "AGENT_DEREGISTER"
    
    # Control messages
    SYSTEM_COMMAND = "SYSTEM_COMMAND"
    CONFIG_UPDATE = "CONFIG_UPDATE"
    EMERGENCY_STOP = "EMERGENCY_STOP"


# Task type definitions
class TaskTypes:
    # HuggingFace tasks
    HF_TEXT_GENERATION = "huggingface.text.generation"
    HF_TEXT_CLASSIFICATION = "huggingface.text.classification"
    HF_TEXT_SUMMARIZATION = "huggingface.text.summarization"
    HF_TEXT_TRANSLATION = "huggingface.text.translation"
    HF_TEXT_QA = "huggingface.text.question_answering"
    HF_VISION_CLASSIFICATION = "huggingface.vision.classification"
    HF_VISION_DETECTION = "huggingface.vision.object_detection"
    HF_VISION_SEGMENTATION = "huggingface.vision.segmentation"
    HF_AUDIO_STT = "huggingface.audio.speech_recognition"
    HF_AUDIO_TTS = "huggingface.audio.text_to_speech"
    HF_MULTIMODAL_VQA = "huggingface.multimodal.visual_qa"
    
    # LangChain tasks
    LC_AGENT_EXECUTE = "langchain.agent.execute"
    LC_CHAT_EXECUTE = "langchain.chat.execute"
    LC_REACT_EXECUTE = "langchain.react.execute"
    LC_GENERATIVE_EXECUTE = "langchain.generative.execute"
    LC_PLAN_EXECUTE = "langchain.plan_execute"
    LC_BABYAGI_EXECUTE = "langchain.babyagi.execute"
    
    # Deepgram tasks
    DG_AUDIO_TRANSCRIBE_LIVE = "deepgram.audio.transcribe.live"
    DG_AUDIO_TRANSCRIBE_FILE = "deepgram.audio.transcribe.file"
    DG_AUDIO_AGENT_LIVE = "deepgram.audio.agent.live"
    
    # System tasks
    SYS_HEALTH_CHECK = "system.health_check"
    SYS_TELEMETRY_QUERY = "system.telemetry_query"
    SYS_CONFIG_UPDATE = "system.config_update"
    
    # Life OS tasks
    LIFEOS_CALENDAR_SYNC = "lifeos.calendar.sync"
    LIFEOS_EMAIL_PROCESS = "lifeos.email.process"
    LIFEOS_CONTACT_SEARCH = "lifeos.contact.search"
    
    # Security tasks
    SEC_AUDIT = "security.audit"
    SEC_VULN_SCAN = "security.vulnerability_scan"
    SEC_COMPLIANCE_CHECK = "security.compliance_check"
    
    # Memory tasks
    MEM_KG_UPSERT = "memory.knowledge_graph.upsert"
    MEM_KG_QUERY = "memory.knowledge_graph.query"
    MEM_CONTEXT_RETRIEVE = "memory.context.retrieve"
    MEM_CONTEXT_STORE = "memory.context.store"
    
    # Specialized agent tasks
    RESEARCH_WEB_SEARCH = "research.web.search"
    RESEARCH_WEB_SCRAPE = "research.web.scrape"
    WRITER_COMPOSE = "writer.compose"
    CODEWRITER_GENERATE = "codewriter.generate"
    ANALYTICS_RUN_QUERY = "analytics.run_query"
    SCHEDULER_SCHEDULE_EVENT = "scheduler.schedule_event"
    MULTIMODAL_FUSE = "multimodal.fuse"
    TRANSLATION_DETECT_TRANSLATE = "translation.detect_translate"
    NOTIFICATION_SEND = "notification.send"
    ARTIST_GENERATE_IMAGE = "artist.generate_image"
    DESIGN_CREATE_MOCKUP = "design.create_mockup"
    COMEDIAN_GENERATE_JOKE = "comedian.generate_joke"


# Error codes
class ErrorCodes:
    # Validation errors
    INVALID_MESSAGE_FORMAT = "INVALID_MESSAGE_FORMAT"
    INVALID_TASK_TYPE = "INVALID_TASK_TYPE"
    INVALID_PARAMETERS = "INVALID_PARAMETERS"
    
    # Resource errors
    INSUFFICIENT_BUDGET = "INSUFFICIENT_BUDGET"
    RESOURCE_LIMIT_EXCEEDED = "RESOURCE_LIMIT_EXCEEDED"
    AGENT_UNAVAILABLE = "AGENT_UNAVAILABLE"
    QUEUE_FULL = "QUEUE_FULL"
    
    # Execution errors
    TASK_TIMEOUT = "TASK_TIMEOUT"
    TASK_CANCELLED = "TASK_CANCELLED"
    AGENT_ERROR = "AGENT_ERROR"
    NETWORK_ERROR = "NETWORK_ERROR"
    
    # Security errors
    AUTHENTICATION_FAILED = "AUTHENTICATION_FAILED"
    AUTHORIZATION_FAILED = "AUTHORIZATION_FAILED"
    RATE_LIMIT_EXCEEDED = "RATE_LIMIT_EXCEEDED"
    
    # System errors
    INTERNAL_ERROR = "INTERNAL_ERROR"
    SERVICE_UNAVAILABLE = "SERVICE_UNAVAILABLE"
    CONFIGURATION_ERROR = "CONFIGURATION_ERROR"


# Agent capability mappings
AGENT_CAPABILITIES = {
    "intelligence": [
        TaskTypes.LC_AGENT_EXECUTE,
        TaskTypes.LC_CHAT_EXECUTE,
        TaskTypes.LC_REACT_EXECUTE,
        TaskTypes.HF_TEXT_GENERATION,
        TaskTypes.HF_TEXT_CLASSIFICATION,
        TaskTypes.RESEARCH_WEB_SEARCH,
        TaskTypes.WRITER_COMPOSE,
        TaskTypes.CODEWRITER_GENERATE,
        TaskTypes.ANALYTICS_RUN_QUERY,
    ],
    "multimodal": [
        TaskTypes.HF_VISION_CLASSIFICATION,
        TaskTypes.HF_AUDIO_STT,
        TaskTypes.DG_AUDIO_TRANSCRIBE_LIVE,
        TaskTypes.DG_AUDIO_AGENT_LIVE,
        TaskTypes.MULTIMODAL_FUSE,
        TaskTypes.ARTIST_GENERATE_IMAGE,
    ],
    "system": [
        TaskTypes.SYS_HEALTH_CHECK,
        TaskTypes.SYS_TELEMETRY_QUERY,
        TaskTypes.LIFEOS_CALENDAR_SYNC,
        TaskTypes.SEC_AUDIT,
        TaskTypes.MEM_KG_QUERY,
        TaskTypes.NOTIFICATION_SEND,
    ],
}


class MCPValidator:
    """Validation utilities for MCP messages and payloads"""
    
    @staticmethod
    def validate_message(data: dict) -> MCPMessage:
        """Validate an MCP message"""
        return MCPMessage.model_validate(data)
    
    @staticmethod
    def validate_task_request(data: dict) -> TaskRequest:
        """Validate a task request"""
        return TaskRequest.model_validate(data)
    
    @staticmethod
    def validate_task_response(data: dict) -> TaskResponse:
        """Validate a task response"""
        return TaskResponse.model_validate(data)
    
    @staticmethod
    def is_valid_task_type(task_type: str) -> bool:
        """Check if task type is supported"""
        return hasattr(TaskTypes, task_type.upper().replace('.', '_'))
    
    @staticmethod
    def get_supervisor_for_task(task_type: str) -> str:
        """Get supervisor responsible for a task type"""
        for supervisor, capabilities in AGENT_CAPABILITIES.items():
            if task_type in capabilities:
                return supervisor
        return "intelligence"  # Default fallback


def create_mcp_context(
    request_id: str,
    timeout_ms: int = 30000,
    trace_id: Optional[str] = None,
    span_id: Optional[str] = None
) -> MCPContext:
    """Helper function to create MCP context"""
    return MCPContext(
        trace_id=trace_id or str(uuid4()),
        span_id=span_id or str(uuid4()),
        request_id=request_id,
        timeout_ms=timeout_ms,
        baggage={},
        metadata={}
    )


def create_delivery_options(
    guarantee: DeliveryGuarantee = DeliveryGuarantee.AT_LEAST_ONCE,
    priority: int = 5,
    retry_count: int = 3
) -> DeliveryOptions:
    """Helper function to create delivery options"""
    return DeliveryOptions(
        guarantee=guarantee,
        priority=priority,
        retry_count=retry_count,
        retry_delay_ms=1000,
        require_ack=True
    )
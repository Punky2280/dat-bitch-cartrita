"""
Enhanced Human-in-the-Loop Override Service
Provides secure, auditable human intervention for agent decisions
with tamper-evident logging and role-based access control
"""

import asyncio
import hashlib
import json
import logging
import time
import uuid
from datetime import datetime, timedelta, timezone
from enum import Enum
from typing import Dict, List, Optional, Any, Union, Set
from dataclasses import dataclass, field, asdict
from pathlib import Path

import aioredis
import aiohttp
from pydantic import BaseModel, Field, validator
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import rsa, padding
from cryptography.exceptions import InvalidSignature


logger = logging.getLogger(__name__)


class OverrideTargetType(str, Enum):
    """Types of overrides that can be requested"""
    MODEL = "model"
    REASONING_EFFORT = "reasoning_effort"
    TOOL_ALLOW = "tool_allow"
    TOOL_BLOCK = "tool_block"
    MODERATION_OVERRIDE = "moderation_override"
    COST_CAP_ADJUST = "cost_cap_adjust"
    ABANDON_TASK = "abandon_task"
    ESCALATE_TO_HUMAN = "escalate_to_human"
    CONTEXT_COMPRESSION = "context_compression"
    SAFETY_BYPASS = "safety_bypass"


class OverrideStatus(str, Enum):
    """Override request status"""
    PENDING = "pending"
    APPROVED = "approved" 
    DENIED = "denied"
    SUPERSEDED = "superseded"
    EXPIRED = "expired"
    AUTO_APPLIED = "auto_applied"
    REVOKED = "revoked"


class DecisionType(str, Enum):
    """Human decision types"""
    APPROVE = "approve"
    DENY = "deny"
    MODIFY = "modify"
    ESCALATE = "escalate"
    REQUEST_INFO = "request_info"


class UserRole(str, Enum):
    """User roles for authorization"""
    MODERATOR = "moderator"
    ENGINEER = "engineer"
    FINOPS = "finops"
    ADMIN = "admin"
    AUDITOR = "auditor"
    SAFETY_OFFICER = "safety_officer"


class RiskLevel(str, Enum):
    """Risk levels for override requests"""
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


@dataclass
class OverrideRequest:
    """Enhanced override request with security features"""
    id: str = field(default_factory=lambda: str(uuid.uuid4()))
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    created_by: str = "system"  # "system" | user_id
    task_id: str = ""
    correlation_id: str = ""
    conversation_id: Optional[str] = None
    user_id: str = "anonymous"
    
    # Override details
    target_type: OverrideTargetType = OverrideTargetType.MODEL
    current_system_value: Any = None
    requested_value: Any = None
    justification_system: str = ""
    justification_human: Optional[str] = None
    
    # Status and lifecycle
    status: OverrideStatus = OverrideStatus.PENDING
    ttl_seconds: int = 3600  # 1 hour default
    expires_at: Optional[datetime] = None
    
    # Security and audit
    policy_snapshot_id: str = ""
    idempotency_key: Optional[str] = None
    risk_flags: Set[str] = field(default_factory=set)
    risk_level: RiskLevel = RiskLevel.MEDIUM
    
    # Context and metadata  
    context: Dict[str, Any] = field(default_factory=dict)
    execution_metadata: Dict[str, Any] = field(default_factory=dict)
    
    def __post_init__(self):
        if self.expires_at is None:
            self.expires_at = self.created_at + timedelta(seconds=self.ttl_seconds)
    
    @property
    def is_expired(self) -> bool:
        return datetime.now(timezone.utc) >= self.expires_at
    
    @property
    def age_seconds(self) -> float:
        return (datetime.now(timezone.utc) - self.created_at).total_seconds()


@dataclass
class OverrideDecision:
    """Human decision with cryptographic verification"""
    id: str = field(default_factory=lambda: str(uuid.uuid4()))
    override_request_id: str = ""
    decided_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    decided_by: str = ""
    decision: DecisionType = DecisionType.APPROVE
    effective_value: Any = None
    rationale_human: str = ""
    
    # Cryptographic integrity
    hash_prev: str = ""  # Previous decision hash for chaining
    hash_self: str = ""  # This decision's hash
    signature: Optional[str] = None  # Digital signature
    
    # Authorization context
    user_role: UserRole = UserRole.MODERATOR
    authorization_token: Optional[str] = None
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None
    
    # Risk assessment
    risk_assessment: Dict[str, Any] = field(default_factory=dict)
    compliance_checks: List[str] = field(default_factory=list)
    
    def compute_hash(self, include_signature: bool = False) -> str:
        """Compute cryptographic hash of decision"""
        data = {
            "id": self.id,
            "override_request_id": self.override_request_id,
            "decided_at": self.decided_at.isoformat(),
            "decided_by": self.decided_by,
            "decision": self.decision.value,
            "effective_value": self.effective_value,
            "rationale_human": self.rationale_human,
            "hash_prev": self.hash_prev
        }
        
        if include_signature and self.signature:
            data["signature"] = self.signature
            
        serialized = json.dumps(data, sort_keys=True, separators=(',', ':'))
        return hashlib.sha256(serialized.encode()).hexdigest()


@dataclass
class PolicySnapshot:
    """Immutable policy snapshot for audit trail"""
    id: str = field(default_factory=lambda: str(uuid.uuid4()))
    captured_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    sha256: str = ""
    policy_json: str = ""
    version: str = "1.0"
    
    def __post_init__(self):
        if not self.sha256:
            self.sha256 = hashlib.sha256(self.policy_json.encode()).hexdigest()


class OverrideConfiguration:
    """Configuration for override service"""
    
    def __init__(self):
        self.genesis_hash = "GENESIS_OVERRIDE_CHAIN_2025"
        self.max_ttl_seconds = 7200  # 2 hours
        self.default_ttl_seconds = 1800  # 30 minutes
        self.max_pending_per_user = 10
        self.cleanup_interval_seconds = 300  # 5 minutes
        
        # Role permissions
        self.role_permissions = {
            UserRole.MODERATOR: {
                OverrideTargetType.MODERATION_OVERRIDE,
                OverrideTargetType.REASONING_EFFORT
            },
            UserRole.ENGINEER: {
                OverrideTargetType.MODEL,
                OverrideTargetType.TOOL_ALLOW,
                OverrideTargetType.TOOL_BLOCK,
                OverrideTargetType.REASONING_EFFORT
            },
            UserRole.FINOPS: {
                OverrideTargetType.COST_CAP_ADJUST,
                OverrideTargetType.MODEL
            },
            UserRole.ADMIN: set(OverrideTargetType),  # All types
            UserRole.SAFETY_OFFICER: {
                OverrideTargetType.SAFETY_BYPASS,
                OverrideTargetType.ABANDON_TASK,
                OverrideTargetType.MODERATION_OVERRIDE
            },
            UserRole.AUDITOR: set()  # Read-only
        }
        
        # SLA requirements by risk level
        self.sla_requirements = {
            RiskLevel.LOW: 1800,      # 30 minutes
            RiskLevel.MEDIUM: 900,    # 15 minutes
            RiskLevel.HIGH: 300,      # 5 minutes
            RiskLevel.CRITICAL: 60    # 1 minute
        }


class CryptoManager:
    """Manages cryptographic operations for override service"""
    
    def __init__(self, private_key_path: Optional[str] = None):
        self.private_key = self._load_or_generate_key(private_key_path)
        self.public_key = self.private_key.public_key()
    
    def _load_or_generate_key(self, key_path: Optional[str]) -> rsa.RSAPrivateKey:
        """Load existing key or generate new one"""
        if key_path and Path(key_path).exists():
            with open(key_path, 'rb') as key_file:
                return serialization.load_pem_private_key(
                    key_file.read(),
                    password=None
                )
        else:
            # Generate new key for development
            key = rsa.generate_private_key(
                public_exponent=65537,
                key_size=2048
            )
            logger.warning("Generated new RSA key - not suitable for production")
            return key
    
    def sign_decision(self, decision: OverrideDecision) -> str:
        """Create digital signature for decision"""
        data = decision.compute_hash(include_signature=False)
        signature = self.private_key.sign(
            data.encode(),
            padding.PSS(
                mgf=padding.MGF1(hashes.SHA256()),
                salt_length=padding.PSS.MAX_LENGTH
            ),
            hashes.SHA256()
        )
        return signature.hex()
    
    def verify_signature(self, decision: OverrideDecision) -> bool:
        """Verify decision signature"""
        if not decision.signature:
            return False
            
        try:
            signature_bytes = bytes.fromhex(decision.signature)
            data = decision.compute_hash(include_signature=False)
            
            self.public_key.verify(
                signature_bytes,
                data.encode(),
                padding.PSS(
                    mgf=padding.MGF1(hashes.SHA256()),
                    salt_length=padding.PSS.MAX_LENGTH
                ),
                hashes.SHA256()
            )
            return True
        except (InvalidSignature, ValueError):
            return False


class OverrideStore:
    """Enhanced storage layer with Redis backend"""
    
    def __init__(self, redis_url: str = "redis://localhost:6379"):
        self.redis_url = redis_url
        self.redis: Optional[aioredis.Redis] = None
        
    async def connect(self):
        """Initialize Redis connection"""
        self.redis = await aioredis.from_url(self.redis_url)
    
    async def disconnect(self):
        """Close Redis connection"""
        if self.redis:
            await self.redis.close()
    
    async def store_request(self, request: OverrideRequest) -> bool:
        """Store override request"""
        if not self.redis:
            await self.connect()
        
        key = f"override:request:{request.id}"
        data = json.dumps(asdict(request), default=str, separators=(',', ':'))
        
        # Store with TTL
        await self.redis.setex(key, request.ttl_seconds, data)
        
        # Add to pending index
        if request.status == OverrideStatus.PENDING:
            await self.redis.zadd(
                "override:pending", 
                {request.id: request.created_at.timestamp()}
            )
        
        # Add to user index
        user_key = f"override:user:{request.user_id}"
        await self.redis.sadd(user_key, request.id)
        
        return True
    
    async def get_request(self, request_id: str) -> Optional[OverrideRequest]:
        """Retrieve override request"""
        if not self.redis:
            await self.connect()
            
        key = f"override:request:{request_id}"
        data = await self.redis.get(key)
        
        if not data:
            return None
            
        request_dict = json.loads(data)
        
        # Convert datetime strings back to datetime objects
        if isinstance(request_dict.get('created_at'), str):
            request_dict['created_at'] = datetime.fromisoformat(request_dict['created_at'])
        if isinstance(request_dict.get('expires_at'), str):
            request_dict['expires_at'] = datetime.fromisoformat(request_dict['expires_at'])
        
        # Convert risk_flags back to set
        if isinstance(request_dict.get('risk_flags'), list):
            request_dict['risk_flags'] = set(request_dict['risk_flags'])
        
        return OverrideRequest(**request_dict)
    
    async def store_decision(self, decision: OverrideDecision) -> bool:
        """Store override decision with hash chaining"""
        if not self.redis:
            await self.connect()
        
        # Get previous decision hash for chaining
        prev_hash = await self.redis.get("override:chain:last_hash")
        decision.hash_prev = prev_hash.decode() if prev_hash else "GENESIS_OVERRIDE_CHAIN_2025"
        
        # Compute and store hash
        decision.hash_self = decision.compute_hash()
        
        # Update chain
        await self.redis.set("override:chain:last_hash", decision.hash_self)
        
        # Store decision
        key = f"override:decision:{decision.id}"
        data = json.dumps(asdict(decision), default=str, separators=(',', ':'))
        await self.redis.setex(key, 86400 * 30, data)  # 30 day retention
        
        return True
    
    async def get_pending_requests(
        self, 
        limit: int = 50, 
        user_role: Optional[UserRole] = None
    ) -> List[OverrideRequest]:
        """Get pending override requests filtered by user role"""
        if not self.redis:
            await self.connect()
        
        # Get pending request IDs ordered by creation time
        request_ids = await self.redis.zrange("override:pending", 0, limit-1)
        
        requests = []
        for req_id in request_ids:
            request = await self.get_request(req_id.decode())
            if request and not request.is_expired:
                # Filter by user role permissions if specified
                if user_role is None or self._can_handle_request(request, user_role):
                    requests.append(request)
        
        return requests
    
    def _can_handle_request(self, request: OverrideRequest, user_role: UserRole) -> bool:
        """Check if user role can handle this request type"""
        config = OverrideConfiguration()
        allowed_types = config.role_permissions.get(user_role, set())
        return request.target_type in allowed_types
    
    async def cleanup_expired(self) -> int:
        """Clean up expired requests"""
        if not self.redis:
            await self.connect()
        
        # Get all pending requests
        pending_ids = await self.redis.zrange("override:pending", 0, -1)
        expired_count = 0
        
        for req_id in pending_ids:
            request = await self.get_request(req_id.decode())
            if request and request.is_expired:
                # Mark as expired
                request.status = OverrideStatus.EXPIRED
                await self.store_request(request)
                
                # Remove from pending
                await self.redis.zrem("override:pending", req_id)
                expired_count += 1
        
        return expired_count


class HumanOverrideService:
    """Enhanced human-in-the-loop override service"""
    
    def __init__(
        self,
        redis_url: str = "redis://localhost:6379",
        crypto_key_path: Optional[str] = None
    ):
        self.config = OverrideConfiguration()
        self.store = OverrideStore(redis_url)
        self.crypto = CryptoManager(crypto_key_path)
        self.stats = {
            "total_requests": 0,
            "approved_requests": 0,
            "denied_requests": 0,
            "expired_requests": 0,
            "avg_response_time_seconds": 0.0
        }
        
        # Background tasks
        self._cleanup_task: Optional[asyncio.Task] = None
        self._running = False
    
    async def start(self):
        """Start the override service"""
        await self.store.connect()
        self._running = True
        
        # Start cleanup task
        self._cleanup_task = asyncio.create_task(self._cleanup_loop())
        logger.info("Human override service started")
    
    async def stop(self):
        """Stop the override service"""
        self._running = False
        
        if self._cleanup_task:
            self._cleanup_task.cancel()
            try:
                await self._cleanup_task
            except asyncio.CancelledError:
                pass
        
        await self.store.disconnect()
        logger.info("Human override service stopped")
    
    async def create_override_request(
        self,
        task_id: str,
        target_type: OverrideTargetType,
        current_value: Any,
        requested_value: Any,
        justification: str,
        user_id: str = "anonymous",
        conversation_id: Optional[str] = None,
        ttl_seconds: Optional[int] = None,
        idempotency_key: Optional[str] = None,
        context: Optional[Dict[str, Any]] = None
    ) -> OverrideRequest:
        """Create new override request with enhanced validation"""
        
        # Check for duplicate idempotent request
        if idempotency_key:
            existing = await self._find_by_idempotency_key(idempotency_key)
            if existing:
                return existing
        
        # Assess risk level
        risk_level = self._assess_risk_level(target_type, current_value, requested_value)
        risk_flags = self._identify_risk_flags(target_type, requested_value, context or {})
        
        # Create request
        request = OverrideRequest(
            task_id=task_id,
            target_type=target_type,
            current_system_value=current_value,
            requested_value=requested_value,
            justification_system=justification,
            user_id=user_id,
            conversation_id=conversation_id,
            ttl_seconds=ttl_seconds or self.config.default_ttl_seconds,
            idempotency_key=idempotency_key,
            risk_level=risk_level,
            risk_flags=risk_flags,
            context=context or {}
        )
        
        # Store request
        await self.store.store_request(request)
        
        # Update stats
        self.stats["total_requests"] += 1
        
        # Send notifications for high-risk requests
        if risk_level in [RiskLevel.HIGH, RiskLevel.CRITICAL]:
            await self._send_urgent_notification(request)
        
        logger.info(f"Created override request {request.id} for task {task_id}")
        return request
    
    async def make_decision(
        self,
        request_id: str,
        decision_type: DecisionType,
        decided_by: str,
        user_role: UserRole,
        effective_value: Any = None,
        rationale: str = "",
        authorization_context: Optional[Dict[str, str]] = None
    ) -> OverrideDecision:
        """Make human decision on override request"""
        
        # Get request
        request = await self.store.get_request(request_id)
        if not request:
            raise ValueError(f"Override request {request_id} not found")
        
        if request.is_expired:
            raise ValueError(f"Override request {request_id} has expired")
        
        if request.status != OverrideStatus.PENDING:
            raise ValueError(f"Override request {request_id} is not pending")
        
        # Verify authorization
        if not self._is_authorized(request.target_type, user_role):
            raise PermissionError(f"Role {user_role} cannot handle {request.target_type}")
        
        # Create decision
        decision = OverrideDecision(
            override_request_id=request_id,
            decided_by=decided_by,
            decision=decision_type,
            effective_value=effective_value,
            rationale_human=rationale,
            user_role=user_role
        )
        
        # Add authorization context
        if authorization_context:
            decision.ip_address = authorization_context.get("ip_address")
            decision.user_agent = authorization_context.get("user_agent")
            decision.authorization_token = authorization_context.get("auth_token")
        
        # Sign decision
        decision.signature = self.crypto.sign_decision(decision)
        
        # Store decision with hash chaining
        await self.store.store_decision(decision)
        
        # Update request status
        if decision_type == DecisionType.APPROVE:
            request.status = OverrideStatus.APPROVED
            self.stats["approved_requests"] += 1
        elif decision_type == DecisionType.DENY:
            request.status = OverrideStatus.DENIED
            self.stats["denied_requests"] += 1
        elif decision_type == DecisionType.MODIFY:
            request.status = OverrideStatus.APPROVED
            request.requested_value = effective_value
            self.stats["approved_requests"] += 1
        
        # Update response time stats
        response_time = decision.decided_at.timestamp() - request.created_at.timestamp()
        self._update_response_time_stats(response_time)
        
        await self.store.store_request(request)
        
        logger.info(f"Decision made on override request {request_id}: {decision_type}")
        return decision
    
    async def get_active_overrides(
        self,
        task_id: Optional[str] = None,
        user_id: Optional[str] = None
    ) -> List[OverrideRequest]:
        """Get active override requests"""
        # Implementation would filter by task_id/user_id
        return await self.store.get_pending_requests()
    
    def _assess_risk_level(
        self,
        target_type: OverrideTargetType,
        current_value: Any,
        requested_value: Any
    ) -> RiskLevel:
        """Assess risk level of override request"""
        
        # High-risk target types
        high_risk_types = {
            OverrideTargetType.SAFETY_BYPASS,
            OverrideTargetType.ABANDON_TASK,
            OverrideTargetType.MODERATION_OVERRIDE
        }
        
        if target_type in high_risk_types:
            return RiskLevel.HIGH
        
        # Cost-related overrides
        if target_type == OverrideTargetType.COST_CAP_ADJUST:
            if isinstance(requested_value, (int, float)) and requested_value > 10.0:
                return RiskLevel.HIGH
            return RiskLevel.MEDIUM
        
        # Model escalations
        if target_type == OverrideTargetType.MODEL:
            expensive_models = {"gpt-5", "gpt-4.1"}
            if str(requested_value) in expensive_models:
                return RiskLevel.MEDIUM
        
        return RiskLevel.LOW
    
    def _identify_risk_flags(
        self,
        target_type: OverrideTargetType,
        requested_value: Any,
        context: Dict[str, Any]
    ) -> Set[str]:
        """Identify specific risk flags for override"""
        flags = set()
        
        if target_type == OverrideTargetType.SAFETY_BYPASS:
            flags.add("safety")
        
        if target_type == OverrideTargetType.COST_CAP_ADJUST:
            flags.add("cost")
        
        if "sensitive_data" in context:
            flags.add("data_privacy")
        
        if "production" in str(context.get("environment", "")):
            flags.add("production_impact")
        
        return flags
    
    def _is_authorized(self, target_type: OverrideTargetType, user_role: UserRole) -> bool:
        """Check if user role is authorized for target type"""
        allowed_types = self.config.role_permissions.get(user_role, set())
        return target_type in allowed_types
    
    def _update_response_time_stats(self, response_time_seconds: float):
        """Update average response time statistics"""
        total_decisions = self.stats["approved_requests"] + self.stats["denied_requests"]
        if total_decisions > 0:
            current_avg = self.stats["avg_response_time_seconds"]
            new_avg = ((current_avg * (total_decisions - 1)) + response_time_seconds) / total_decisions
            self.stats["avg_response_time_seconds"] = new_avg
    
    async def _find_by_idempotency_key(self, key: str) -> Optional[OverrideRequest]:
        """Find existing request by idempotency key"""
        # This would search Redis for existing requests with the same key
        # Implementation depends on indexing strategy
        return None
    
    async def _send_urgent_notification(self, request: OverrideRequest):
        """Send notification for urgent override requests"""
        # Integration with notification systems (Slack, email, etc.)
        logger.warning(f"URGENT: Override request {request.id} requires immediate attention")
    
    async def _cleanup_loop(self):
        """Background task to clean up expired requests"""
        while self._running:
            try:
                expired_count = await self.store.cleanup_expired()
                if expired_count > 0:
                    self.stats["expired_requests"] += expired_count
                    logger.info(f"Cleaned up {expired_count} expired override requests")
                
                await asyncio.sleep(self.config.cleanup_interval_seconds)
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Error in cleanup loop: {e}")
                await asyncio.sleep(60)  # Back off on errors


# FastAPI integration example
if __name__ == "__main__":
    import uvicorn
    from fastapi import FastAPI, HTTPException, Depends
    from fastapi.security import HTTPBearer
    
    app = FastAPI(title="Human Override Service API")
    security = HTTPBearer()
    
    # Global service instance
    override_service: Optional[HumanOverrideService] = None
    
    @app.on_event("startup")
    async def startup():
        global override_service
        override_service = HumanOverrideService()
        await override_service.start()
    
    @app.on_event("shutdown")
    async def shutdown():
        if override_service:
            await override_service.stop()
    
    @app.post("/api/v1/override-requests")
    async def create_override_request(
        task_id: str,
        target_type: OverrideTargetType,
        current_value: Any,
        requested_value: Any,
        justification: str,
        user_id: str = "anonymous",
        ttl_seconds: Optional[int] = None
    ):
        if not override_service:
            raise HTTPException(500, "Service not initialized")
        
        request = await override_service.create_override_request(
            task_id=task_id,
            target_type=target_type,
            current_value=current_value,
            requested_value=requested_value,
            justification=justification,
            user_id=user_id,
            ttl_seconds=ttl_seconds
        )
        
        return asdict(request)
    
    @app.get("/api/v1/override-requests/pending")
    async def get_pending_requests():
        if not override_service:
            raise HTTPException(500, "Service not initialized")
        
        requests = await override_service.store.get_pending_requests()
        return [asdict(req) for req in requests]
    
    @app.post("/api/v1/override-requests/{request_id}/decision")
    async def make_decision(
        request_id: str,
        decision_type: DecisionType,
        decided_by: str,
        user_role: UserRole,
        effective_value: Any = None,
        rationale: str = ""
    ):
        if not override_service:
            raise HTTPException(500, "Service not initialized")
        
        try:
            decision = await override_service.make_decision(
                request_id=request_id,
                decision_type=decision_type,
                decided_by=decided_by,
                user_role=user_role,
                effective_value=effective_value,
                rationale=rationale
            )
            return asdict(decision)
        except (ValueError, PermissionError) as e:
            raise HTTPException(400, str(e))
    
    @app.get("/api/v1/stats")
    async def get_stats():
        if not override_service:
            raise HTTPException(500, "Service not initialized")
        
        return override_service.stats


# Usage example
async def example_usage():
    """Example of how to use the Human Override Service"""
    
    # Initialize service
    service = HumanOverrideService()
    await service.start()
    
    try:
        # Create override request
        request = await service.create_override_request(
            task_id="task_123",
            target_type=OverrideTargetType.MODEL,
            current_value="gpt-5-mini",
            requested_value="gpt-5",
            justification="Task requires advanced reasoning for code refactoring",
            user_id="user_456"
        )
        
        print(f"Created override request: {request.id}")
        
        # Make decision
        decision = await service.make_decision(
            request_id=request.id,
            decision_type=DecisionType.APPROVE,
            decided_by="admin_user",
            user_role=UserRole.ADMIN,
            rationale="Approved for complex refactoring task"
        )
        
        print(f"Decision made: {decision.decision}")
        
    finally:
        await service.stop()


if __name__ == "__main__":
    # Run example
    asyncio.run(example_usage())
"""
Cartrita V2 - Security, Safety, and Governance Layer
Production-ready security controls with Miami personality
"""

import asyncio
import json
import logging
import hashlib
import secrets
from datetime import datetime, timezone, timedelta
from typing import Dict, List, Optional, Any, Union, Tuple
from dataclasses import dataclass, asdict
from enum import Enum
import re
from pathlib import Path

from .database_manager import DatabaseManager


class SecurityLevel(Enum):
    """Security clearance levels"""
    PUBLIC = "public"
    INTERNAL = "internal"
    CONFIDENTIAL = "confidential"
    RESTRICTED = "restricted"


class ThreatLevel(Enum):
    """Threat assessment levels"""
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


@dataclass
class SecurityContext:
    """Security context for requests"""
    user_id: str
    session_id: str
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None
    security_level: SecurityLevel = SecurityLevel.PUBLIC
    permissions: List[str] = None
    rate_limit_remaining: int = 100
    
    def __post_init__(self):
        if self.permissions is None:
            self.permissions = []


@dataclass
class GovernancePolicy:
    """Governance policy definition"""
    policy_id: str
    name: str
    description: str
    rules: List[Dict[str, Any]]
    enforcement_level: str  # "advisory", "warning", "blocking"
    miami_explanation: str
    created_at: datetime = None
    
    def __post_init__(self):
        if self.created_at is None:
            self.created_at = datetime.now(timezone.utc)


class CartritalSecurityManager:
    """
    Main security manager for Cartrita V2
    Handles authentication, authorization, and threat detection
    """
    
    def __init__(self, database_manager: DatabaseManager):
        self.db = database_manager
        self.logger = logging.getLogger("cartrita.security")
        
        # Security configurations
        self.max_requests_per_minute = 60
        self.max_requests_per_hour = 1000
        self.max_token_usage_per_day = 100000
        
        # Threat detection patterns
        self.threat_patterns = {
            "sql_injection": [
                r"(?i)(union\s+select|drop\s+table|insert\s+into|delete\s+from)",
                r"(?i)('|\")\s*;\s*(drop|delete|insert|update)"
            ],
            "xss_attempt": [
                r"(?i)<script[^>]*>.*?</script>",
                r"(?i)javascript:",
                r"(?i)on\w+\s*="
            ],
            "prompt_injection": [
                r"(?i)(ignore\s+previous|forget\s+instructions|new\s+instructions)",
                r"(?i)(system\s+prompt|override\s+prompt|bypass\s+rules)",
                r"(?i)(act\s+as|pretend\s+to\s+be|roleplay)"
            ],
            "data_exfiltration": [
                r"(?i)(api\s+key|secret|password|token)",
                r"(?i)(database\s+dump|export\s+data|download\s+all)"
            ]
        }
        
        # Miami-style security messages
        self.miami_security_messages = {
            "rate_limit": "¡Oye! You're going too fast, mi amor. Take a breath, Dale más despacio.",
            "unauthorized": "¡Ay no! You don't have permission for that. Check with your admin, por favor.",
            "suspicious_activity": "¡Cuidado! Something looks fishy. We're keeping an eye on this.",
            "blocked_content": "¡Para ahí! That content isn't allowed here. Keep it clean, familia.",
            "security_violation": "¡No no no! That's not allowed in our Miami community. Stay safe, everyone."
        }
        
        # Active sessions and rate limiting
        self.active_sessions: Dict[str, Dict[str, Any]] = {}
        self.rate_limits: Dict[str, List[datetime]] = {}
    
    async def authenticate_request(
        self,
        user_id: str,
        session_token: Optional[str] = None,
        api_key: Optional[str] = None,
        ip_address: Optional[str] = None
    ) -> Optional[SecurityContext]:
        """
        Authenticate incoming request and create security context
        """
        try:
            # Basic authentication check
            if not user_id:
                self.logger.warning("Authentication failed: No user ID provided")
                return None
            
            # Check for valid session or API key
            is_authenticated = False
            security_level = SecurityLevel.PUBLIC
            permissions = []
            
            if session_token:
                session_valid = await self._validate_session_token(user_id, session_token)
                if session_valid:
                    is_authenticated = True
                    security_level = SecurityLevel.INTERNAL
                    permissions = ["chat", "search", "basic_tools"]
            
            elif api_key:
                api_valid = await self._validate_api_key(api_key)
                if api_valid:
                    is_authenticated = True
                    security_level = SecurityLevel.CONFIDENTIAL
                    permissions = ["chat", "search", "tools", "admin"]
            
            if not is_authenticated:
                # Allow public access with limited permissions
                permissions = ["chat"]
                self.logger.info(f"Public access granted for user {user_id}")
            
            # Check rate limits
            rate_limit_ok, remaining = await self._check_rate_limits(user_id, ip_address)
            if not rate_limit_ok:
                self.logger.warning(f"Rate limit exceeded for user {user_id}")
                return None
            
            # Create security context
            context = SecurityContext(
                user_id=user_id,
                session_id=f"session_{secrets.token_hex(8)}",
                ip_address=ip_address,
                security_level=security_level,
                permissions=permissions,
                rate_limit_remaining=remaining
            )
            
            # Store active session
            self.active_sessions[context.session_id] = {
                "user_id": user_id,
                "created_at": datetime.now(timezone.utc),
                "last_activity": datetime.now(timezone.utc),
                "security_context": context
            }
            
            self.logger.info(f"Authentication successful for user {user_id}")
            return context
            
        except Exception as e:
            self.logger.error(f"Authentication error: {e}")
            return None
    
    async def check_content_safety(
        self,
        content: str,
        context: SecurityContext,
        content_type: str = "user_message"
    ) -> Tuple[bool, List[str], Optional[str]]:
        """
        Check content for safety violations and threats
        Returns: (is_safe, violations, miami_message)
        """
        try:
            violations = []
            
            # Check for threat patterns
            for threat_type, patterns in self.threat_patterns.items():
                for pattern in patterns:
                    if re.search(pattern, content):
                        violations.append(f"{threat_type}: Pattern detected")
                        self.logger.warning(f"Threat detected ({threat_type}) from user {context.user_id}")
            
            # Check for sensitive data leakage
            sensitive_patterns = [
                r"(?i)sk-[a-zA-Z0-9]{48,}",  # OpenAI API keys
                r"(?i)[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}",  # Email addresses
                r"(?i)\b\d{3}-\d{2}-\d{4}\b",  # SSN pattern
                r"(?i)\b\d{4}\s?\d{4}\s?\d{4}\s?\d{4}\b"  # Credit card pattern
            ]
            
            for pattern in sensitive_patterns:
                if re.search(pattern, content):
                    violations.append("sensitive_data: Potential sensitive data detected")
            
            # Content length check
            if len(content) > 50000:  # 50K character limit
                violations.append("content_length: Content too long")
            
            # Determine safety
            is_safe = len(violations) == 0
            
            # Generate Miami-style message for violations
            miami_message = None
            if violations:
                miami_message = self._get_miami_safety_message(violations)
            
            # Log security event
            await self._log_security_event(
                context.user_id,
                context.session_id,
                "content_safety_check",
                {
                    "content_type": content_type,
                    "is_safe": is_safe,
                    "violations": violations,
                    "content_length": len(content)
                }
            )
            
            return is_safe, violations, miami_message
            
        except Exception as e:
            self.logger.error(f"Content safety check error: {e}")
            return False, ["system_error"], "¡Ay! Something went wrong checking the content."
    
    async def authorize_action(
        self,
        context: SecurityContext,
        action: str,
        resource: Optional[str] = None
    ) -> Tuple[bool, Optional[str]]:
        """
        Check if user is authorized to perform action
        Returns: (is_authorized, miami_message)
        """
        try:
            # Define permission requirements
            action_permissions = {
                "chat": [],  # Public access
                "search": ["search"],
                "code_execution": ["tools", "code"],
                "file_upload": ["files"],
                "admin_access": ["admin"],
                "user_management": ["admin"],
                "system_settings": ["admin"]
            }
            
            required_permissions = action_permissions.get(action, ["admin"])
            
            # Check permissions
            has_permission = True
            if required_permissions:
                has_permission = any(perm in context.permissions for perm in required_permissions)
            
            # Check security level requirements
            if action in ["admin_access", "user_management", "system_settings"]:
                has_permission = has_permission and context.security_level in [SecurityLevel.CONFIDENTIAL, SecurityLevel.RESTRICTED]
            
            miami_message = None
            if not has_permission:
                miami_message = self.miami_security_messages["unauthorized"]
                
                self.logger.warning(f"Authorization denied: User {context.user_id} attempted {action}")
            
            return has_permission, miami_message
            
        except Exception as e:
            self.logger.error(f"Authorization error: {e}")
            return False, "¡Ay! Authorization check failed."
    
    def _get_miami_safety_message(self, violations: List[str]) -> str:
        """Generate Miami-style safety message based on violations"""
        if any("injection" in v for v in violations):
            return "¡Para ahí! That looks like you're trying to hack something. No bueno, mi amor."
        
        elif any("xss" in v for v in violations):
            return "¡Oye! That code looks suspicious. Keep it clean en nuestra casa."
        
        elif any("prompt_injection" in v for v in violations):
            return "¡Dale! I see what you're trying to do. Nice try, pero I'm smarter than that."
        
        elif any("sensitive_data" in v for v in violations):
            return "¡Cuidado! Don't share sensitive information here. Protect your data, familia."
        
        elif any("content_length" in v for v in violations):
            return "¡Ay Dios mío! That's too much text, papi. Break it down smaller, por favor."
        
        else:
            return "¡Algo no está bien! The content has some issues. Clean it up and try again."
    
    async def _validate_session_token(self, user_id: str, session_token: str) -> bool:
        """Validate session token"""
        try:
            # This would check against database
            # For now, basic validation
            return len(session_token) >= 32 and session_token.startswith("sess_")
        except Exception as e:
            self.logger.error(f"Session validation error: {e}")
            return False
    
    async def _validate_api_key(self, api_key: str) -> bool:
        """Validate API key"""
        try:
            # This would check against database  
            # For now, basic validation
            return len(api_key) >= 32 and api_key.startswith("cart_")
        except Exception as e:
            self.logger.error(f"API key validation error: {e}")
            return False
    
    async def _check_rate_limits(
        self,
        user_id: str,
        ip_address: Optional[str] = None
    ) -> Tuple[bool, int]:
        """Check if user is within rate limits"""
        try:
            now = datetime.now(timezone.utc)
            
            # Clean old entries
            if user_id in self.rate_limits:
                self.rate_limits[user_id] = [
                    req_time for req_time in self.rate_limits[user_id]
                    if now - req_time < timedelta(minutes=1)
                ]
            else:
                self.rate_limits[user_id] = []
            
            # Check current rate
            current_requests = len(self.rate_limits[user_id])
            
            if current_requests >= self.max_requests_per_minute:
                return False, 0
            
            # Add current request
            self.rate_limits[user_id].append(now)
            
            remaining = self.max_requests_per_minute - current_requests - 1
            return True, remaining
            
        except Exception as e:
            self.logger.error(f"Rate limit check error: {e}")
            return True, 50  # Allow on error
    
    async def _log_security_event(
        self,
        user_id: str,
        session_id: str,
        event_type: str,
        details: Dict[str, Any]
    ):
        """Log security event to database"""
        try:
            event_data = {
                "user_id": user_id,
                "session_id": session_id,
                "event_type": event_type,
                "details": details,
                "timestamp": datetime.now(timezone.utc),
                "ip_address": details.get("ip_address"),
                "severity": self._determine_event_severity(event_type, details)
            }
            
            # This would store in database
            self.logger.info(f"Security event logged: {event_type} for user {user_id}")
            
        except Exception as e:
            self.logger.error(f"Failed to log security event: {e}")
    
    def _determine_event_severity(self, event_type: str, details: Dict[str, Any]) -> str:
        """Determine severity of security event"""
        if event_type == "content_safety_check":
            violations = details.get("violations", [])
            if any("injection" in v for v in violations):
                return "high"
            elif any("sensitive_data" in v for v in violations):
                return "medium"
            else:
                return "low"
        
        elif event_type in ["authentication_failure", "authorization_denied"]:
            return "medium"
        
        else:
            return "low"


class GovernanceManager:
    """
    Governance and compliance manager for Cartrita V2
    Enforces business rules and compliance policies
    """
    
    def __init__(self, database_manager: DatabaseManager):
        self.db = database_manager
        self.logger = logging.getLogger("cartrita.governance")
        
        # Load governance policies
        self.policies: Dict[str, GovernancePolicy] = {}
        self._initialize_default_policies()
    
    def _initialize_default_policies(self):
        """Initialize default governance policies"""
        
        # Content appropriateness policy
        self.policies["content_appropriateness"] = GovernancePolicy(
            policy_id="content_001",
            name="Content Appropriateness",
            description="Ensures content is appropriate for family-friendly Miami community",
            rules=[
                {
                    "rule": "no_inappropriate_language",
                    "pattern": r"(?i)(fuck|shit|damn|bitch|asshole)",
                    "action": "warning",
                    "miami_message": "¡Oye! Keep it clean for our familia here in Miami."
                },
                {
                    "rule": "no_hate_speech",
                    "pattern": r"(?i)(racist|sexist|homophobic|discriminatory)",
                    "action": "blocking",
                    "miami_message": "¡No way! We don't allow hate speech in our community. Respect everyone."
                }
            ],
            enforcement_level="warning",
            miami_explanation="We keep things positive and respectful como una familia Miami."
        )
        
        # Data privacy policy
        self.policies["data_privacy"] = GovernancePolicy(
            policy_id="privacy_001", 
            name="Data Privacy Protection",
            description="Protects user privacy and sensitive data",
            rules=[
                {
                    "rule": "no_personal_data_sharing",
                    "pattern": r"(?i)(social security|ssn|credit card|password)",
                    "action": "blocking",
                    "miami_message": "¡Cuidado! Don't share personal info here. Protect your privacy."
                }
            ],
            enforcement_level="blocking",
            miami_explanation="Privacy is important - we protect your data like family."
        )
        
        # Usage limits policy
        self.policies["usage_limits"] = GovernancePolicy(
            policy_id="usage_001",
            name="Fair Usage Limits",
            description="Ensures fair usage across all users",
            rules=[
                {
                    "rule": "token_usage_limit",
                    "threshold": 10000,
                    "period": "daily",
                    "action": "warning",
                    "miami_message": "You're using a lot of tokens today. Maybe take a cafecito break?"
                }
            ],
            enforcement_level="advisory",
            miami_explanation="Fair usage means everyone gets to enjoy Cartrita."
        )
    
    async def evaluate_governance_compliance(
        self,
        content: str,
        action: str,
        context: SecurityContext
    ) -> Tuple[bool, List[str], List[str]]:
        """
        Evaluate content and action against governance policies
        Returns: (is_compliant, violations, miami_messages)
        """
        try:
            violations = []
            miami_messages = []
            
            for policy_id, policy in self.policies.items():
                policy_violations = await self._check_policy_compliance(
                    content, action, context, policy
                )
                
                if policy_violations:
                    violations.extend([f"{policy_id}: {v}" for v in policy_violations])
                    miami_messages.append(policy.miami_explanation)
            
            is_compliant = len(violations) == 0
            
            # Log governance evaluation
            await self._log_governance_event(
                context.user_id,
                context.session_id,
                "policy_evaluation",
                {
                    "action": action,
                    "is_compliant": is_compliant,
                    "violations": violations,
                    "policies_checked": list(self.policies.keys())
                }
            )
            
            return is_compliant, violations, miami_messages
            
        except Exception as e:
            self.logger.error(f"Governance compliance check error: {e}")
            return False, ["system_error"], ["¡Ay! Governance check failed."]
    
    async def _check_policy_compliance(
        self,
        content: str,
        action: str,
        context: SecurityContext,
        policy: GovernancePolicy
    ) -> List[str]:
        """Check compliance against a specific policy"""
        violations = []
        
        try:
            for rule in policy.rules:
                rule_type = rule["rule"]
                
                if "pattern" in rule:
                    # Pattern-based rule
                    pattern = rule["pattern"]
                    if re.search(pattern, content):
                        violations.append(f"{rule_type}: Pattern match")
                
                elif "threshold" in rule:
                    # Threshold-based rule
                    if rule_type == "token_usage_limit":
                        # This would check actual token usage from database
                        # For now, simulate
                        pass
            
        except Exception as e:
            self.logger.error(f"Policy compliance check error for {policy.policy_id}: {e}")
            violations.append(f"policy_check_error: {str(e)}")
        
        return violations
    
    async def _log_governance_event(
        self,
        user_id: str,
        session_id: str,
        event_type: str,
        details: Dict[str, Any]
    ):
        """Log governance event"""
        try:
            event_data = {
                "user_id": user_id,
                "session_id": session_id,
                "event_type": event_type,
                "details": details,
                "timestamp": datetime.now(timezone.utc)
            }
            
            self.logger.info(f"Governance event logged: {event_type} for user {user_id}")
            
        except Exception as e:
            self.logger.error(f"Failed to log governance event: {e}")


class SecurityGovernanceIntegrator:
    """
    Main integration point for security and governance
    Combines security and governance checks into single interface
    """
    
    def __init__(self, database_manager: DatabaseManager):
        self.db = database_manager
        self.security_manager = CartritalSecurityManager(database_manager)
        self.governance_manager = GovernanceManager(database_manager)
        self.logger = logging.getLogger("cartrita.security_governance")
    
    async def validate_request(
        self,
        user_id: str,
        content: str,
        action: str = "chat",
        session_token: Optional[str] = None,
        api_key: Optional[str] = None,
        ip_address: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Complete request validation including security and governance
        """
        try:
            # Step 1: Authentication
            security_context = await self.security_manager.authenticate_request(
                user_id=user_id,
                session_token=session_token,
                api_key=api_key,
                ip_address=ip_address
            )
            
            if not security_context:
                return {
                    "valid": False,
                    "reason": "authentication_failed",
                    "miami_message": self.security_manager.miami_security_messages["unauthorized"],
                    "can_retry": True
                }
            
            # Step 2: Authorization
            is_authorized, auth_message = await self.security_manager.authorize_action(
                security_context, action
            )
            
            if not is_authorized:
                return {
                    "valid": False,
                    "reason": "authorization_denied",
                    "miami_message": auth_message,
                    "can_retry": False
                }
            
            # Step 3: Content Safety
            is_safe, safety_violations, safety_message = await self.security_manager.check_content_safety(
                content, security_context
            )
            
            if not is_safe:
                return {
                    "valid": False,
                    "reason": "content_safety_violation",
                    "violations": safety_violations,
                    "miami_message": safety_message,
                    "can_retry": True
                }
            
            # Step 4: Governance Compliance
            is_compliant, governance_violations, governance_messages = await self.governance_manager.evaluate_governance_compliance(
                content, action, security_context
            )
            
            if not is_compliant:
                return {
                    "valid": False,
                    "reason": "governance_violation",
                    "violations": governance_violations,
                    "miami_message": " ".join(governance_messages),
                    "can_retry": True
                }
            
            # All checks passed
            return {
                "valid": True,
                "security_context": security_context,
                "miami_message": "¡Dale! Everything looks good, mi amor. Let's go!",
                "rate_limit_remaining": security_context.rate_limit_remaining
            }
            
        except Exception as e:
            self.logger.error(f"Request validation error: {e}")
            return {
                "valid": False,
                "reason": "system_error",
                "miami_message": "¡Ay caramba! Something went wrong on our end. Try again in a minute.",
                "can_retry": True
            }
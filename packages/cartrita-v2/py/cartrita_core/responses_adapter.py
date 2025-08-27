"""
Cartrita V2 - Responses API Adapter
Migration wrapper to transition from LangChain to pure OpenAI Responses API
"""

import asyncio
import json
import logging
import time
import uuid
from datetime import datetime
from typing import Dict, List, Optional, Any, Union, AsyncGenerator
from dataclasses import dataclass, field
from pathlib import Path
from enum import Enum

import yaml
from openai import AsyncOpenAI
from pydantic import BaseModel, Field

from config import get_settings, load_system_prompt


class ModelTier(Enum):
    """Model performance tiers for dynamic routing"""
    ULTRA_FAST = "gpt-5-nano"
    FAST = "gpt-5-mini" 
    REASONING = "gpt-5"
    VOICE = "gpt-4o-realtime-preview"
    LEGACY = "gpt-4.1"


class ReasoningEffort(Enum):
    """Reasoning effort levels for cost optimization"""
    MINIMAL = "minimal"
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"


@dataclass
class RoutingContext:
    """Context for model routing decisions"""
    intents: List[str] = field(default_factory=list)
    plan_steps: int = 1
    complexity: str = "low"  # "low" | "high"
    prior_failures: int = 0
    estimated_input_tokens: int = 300
    estimated_output_tokens: int = 400
    user_preference: Optional[str] = None
    cost_sensitivity: str = "standard"  # "budget" | "standard" | "premium"


@dataclass
class ResponsesRequest:
    """Request structure for OpenAI Responses API"""
    input: List[Dict[str, Any]]
    model: str = "gpt-5"
    tools: Optional[List[Dict]] = None
    tool_choice: Optional[Dict] = None
    reasoning: Optional[Dict] = None
    text: Optional[Dict] = None
    temperature: Optional[float] = None
    max_completion_tokens: Optional[int] = None
    store: bool = True
    previous_response_id: Optional[str] = None
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class ConversationMemory:
    """Conversation state and memory management"""
    conversation_id: str
    user_id: str
    messages: List[Dict[str, Any]] = field(default_factory=list)
    response_chain: List[str] = field(default_factory=list)  # response IDs
    context_summary: Optional[str] = None
    constraints: List[str] = field(default_factory=list)
    decisions: List[str] = field(default_factory=list)
    open_questions: List[str] = field(default_factory=list)
    created_at: datetime = field(default_factory=datetime.now)
    last_activity: datetime = field(default_factory=datetime.now)


class ModelRouter:
    """Dynamic model routing based on task complexity and cost constraints"""
    
    def __init__(self, config_path: Optional[str] = None):
        self.config = self._load_routing_config(config_path)
        self.pricing = self._load_pricing_table()
        self.feature_flags = self.config.get("feature_flags", {})
        
    def _load_routing_config(self, config_path: Optional[str] = None) -> Dict:
        """Load model routing policy configuration"""
        if config_path is None:
            config_path = Path(__file__).parent.parent / "model_routing_policy.yaml"
        
        try:
            with open(config_path) as f:
                return yaml.safe_load(f)
        except FileNotFoundError:
            # Fallback configuration
            return {
                "models": {
                    "fast_ultra": "gpt-5-nano",
                    "fast_primary": "gpt-5-mini", 
                    "reasoning_primary": "gpt-5",
                    "voice_primary": "gpt-4o-realtime-preview"
                },
                "routing_rules": [],
                "fallback": {"default_model": "gpt-5-mini"}
            }
    
    def _load_pricing_table(self) -> Dict[str, Dict[str, float]]:
        """Model pricing for cost estimation"""
        return {
            "gpt-5-nano": {"input": 0.0000005, "output": 0.000001},
            "gpt-5-mini": {"input": 0.0000015, "output": 0.000002},
            "gpt-5": {"input": 0.000004, "output": 0.000008},
            "gpt-4o-realtime-preview": {"input": 0.000006, "output": 0.000024},
            "gpt-4.1": {"input": 0.00001, "output": 0.00003}
        }
    
    def route(self, context: RoutingContext) -> Dict[str, Any]:
        """Route request to appropriate model based on context"""
        
        # Check feature flag overrides
        if self.feature_flags.get("force_reasoning_model"):
            return self._finalize_route(
                model=self.config["models"]["reasoning_primary"],
                reasoning_effort=ReasoningEffort.MEDIUM,
                context=context
            )
        
        # Apply routing rules in order
        for rule in self.config.get("routing_rules", []):
            if self._matches_rule(rule.get("match", {}), context):
                return self._finalize_route(
                    model=rule["model"],
                    reasoning_effort=ReasoningEffort(rule["reasoning_effort"]),
                    context=context,
                    rule_matched=rule.get("match", {})
                )
        
        # Fallback to default
        return self._finalize_route(
            model=self.config["fallback"]["default_model"],
            reasoning_effort=ReasoningEffort.LOW,
            context=context
        )
    
    def _matches_rule(self, rule_match: Dict, context: RoutingContext) -> bool:
        """Check if routing context matches rule conditions"""
        
        # Check intent matching
        if "intents_any" in rule_match:
            if not any(intent in context.intents for intent in rule_match["intents_any"]):
                return False
        
        # Check step limits
        if "max_steps" in rule_match and context.plan_steps > rule_match["max_steps"]:
            return False
        if "min_steps" in rule_match and context.plan_steps < rule_match["min_steps"]:
            return False
            
        # Check complexity
        if "complexity" in rule_match and context.complexity != rule_match["complexity"]:
            return False
            
        # Check failure count
        if "prior_failures_gte" in rule_match and context.prior_failures < rule_match["prior_failures_gte"]:
            return False
        
        return True
    
    def _finalize_route(
        self,
        model: str,
        reasoning_effort: ReasoningEffort,
        context: RoutingContext,
        rule_matched: Optional[Dict] = None
    ) -> Dict[str, Any]:
        """Finalize routing decision with cost estimation"""
        
        # Feature flag checks
        if self.feature_flags.get("disable_nano") and model == "gpt-5-nano":
            model = self.config["models"]["fast_primary"]
        
        # Cost estimation
        pricing = self.pricing.get(model, self.pricing["gpt-5-mini"])
        estimated_cost = (
            context.estimated_input_tokens * pricing["input"] +
            context.estimated_output_tokens * pricing["output"]
        )
        
        # Cost constraint checks
        cost_limits = self.config.get("cost_limits", {})
        needs_escalation = estimated_cost > cost_limits.get("escalation_threshold_usd", 0.04)
        
        return {
            "model": model,
            "reasoning_effort": reasoning_effort.value,
            "estimated_cost": round(estimated_cost, 6),
            "needs_budget_escalation": needs_escalation,
            "rule_matched": rule_matched,
            "routing_timestamp": datetime.now().isoformat()
        }
    
    def escalate_on_failure(self, previous_route: Dict, context: RoutingContext) -> Dict[str, Any]:
        """Escalate model/reasoning on task failure"""
        context.prior_failures += 1
        
        # Escalate reasoning effort first
        current_effort = ReasoningEffort(previous_route.get("reasoning_effort", "low"))
        if current_effort == ReasoningEffort.MINIMAL:
            return self._finalize_route(
                model=previous_route["model"],
                reasoning_effort=ReasoningEffort.LOW,
                context=context
            )
        elif current_effort == ReasoningEffort.LOW:
            return self._finalize_route(
                model=previous_route["model"],
                reasoning_effort=ReasoningEffort.MEDIUM,
                context=context
            )
        
        # Escalate model tier for persistent failures
        if context.prior_failures >= 2:
            return self._finalize_route(
                model=self.config["models"]["reasoning_primary"],
                reasoning_effort=ReasoningEffort.HIGH,
                context=context
            )
        
        return previous_route


class ResponsesAPIAdapter:
    """
    Adapter for transitioning from LangChain to OpenAI Responses API
    Provides compatibility layer while enabling new capabilities
    """
    
    def __init__(
        self,
        api_key: Optional[str] = None,
        logger: Optional[logging.Logger] = None
    ):
        # Initialize OpenAI client
        if api_key is None:
            settings = get_settings()
            openai_settings = settings["openai"]
            self.client = AsyncOpenAI(**openai_settings.client_kwargs())
            self.default_model = openai_settings.default_model
        else:
            self.client = AsyncOpenAI(api_key=api_key)
            self.default_model = "gpt-5"
        
        self.logger = logger or logging.getLogger("cartrita.responses_adapter")
        self.router = ModelRouter()
        
        # Memory management
        self.conversations: Dict[str, ConversationMemory] = {}
        self.max_conversations = 1000
        
        # Performance tracking
        self.stats = {
            "total_requests": 0,
            "successful_requests": 0,
            "failed_requests": 0,
            "total_cost": 0.0,
            "model_usage": {},
            "average_response_time": 0.0
        }
    
    async def create_response(
        self,
        input_messages: List[Dict[str, Any]],
        conversation_id: Optional[str] = None,
        user_id: str = "anonymous",
        routing_context: Optional[RoutingContext] = None,
        tools: Optional[List[Dict]] = None,
        tool_choice: Optional[Dict] = None,
        structured_output: Optional[Dict] = None,
        **kwargs
    ) -> Dict[str, Any]:
        """
        Create response using OpenAI Responses API with dynamic routing
        """
        start_time = time.time()
        self.stats["total_requests"] += 1
        
        try:
            # Initialize or get conversation memory
            if conversation_id:
                memory = self._get_or_create_memory(conversation_id, user_id)
                memory.messages.extend(input_messages)
                memory.last_activity = datetime.now()
            else:
                conversation_id = str(uuid.uuid4())
                memory = ConversationMemory(
                    conversation_id=conversation_id,
                    user_id=user_id,
                    messages=input_messages.copy()
                )
                self.conversations[conversation_id] = memory
            
            # Route to appropriate model
            if routing_context is None:
                routing_context = self._infer_routing_context(input_messages)
            
            route = self.router.route(routing_context)
            model = route["model"]
            reasoning_effort = route["reasoning_effort"]
            
            self.logger.info(f"Routed to {model} with {reasoning_effort} effort")
            
            # Prepare Responses API request
            request_params = {
                "model": model,
                "input": input_messages,
                "store": True,
                "metadata": {
                    "conversation_id": conversation_id,
                    "user_id": user_id,
                    "routing_decision": route
                }
            }
            
            # Add reasoning configuration
            if reasoning_effort != "minimal":
                request_params["reasoning"] = {"effort": reasoning_effort}
            
            # Add tools if provided
            if tools:
                request_params["tools"] = tools
                if tool_choice:
                    request_params["tool_choice"] = tool_choice
            
            # Add structured output if provided
            if structured_output:
                request_params["text"] = {"format": structured_output}
            
            # Chain with previous response if available
            if memory.response_chain:
                request_params["previous_response_id"] = memory.response_chain[-1]
            
            # Add model-specific parameters
            request_params.update(self._get_model_params(model, **kwargs))
            
            # Make API call
            response = await self.client.responses.create(**request_params)
            
            # Update memory with response
            if hasattr(response, 'id') and response.id:
                memory.response_chain.append(response.id)
            
            # Track performance
            execution_time = (time.time() - start_time) * 1000
            self._update_stats(route, execution_time, True)
            
            # Format response
            return self._format_response(
                response=response,
                conversation_id=conversation_id,
                route=route,
                execution_time_ms=execution_time
            )
            
        except Exception as e:
            execution_time = (time.time() - start_time) * 1000
            self._update_stats(route if 'route' in locals() else None, execution_time, False)
            
            self.logger.error(f"Responses API call failed: {e}")
            self.stats["failed_requests"] += 1
            
            # Return error response
            return {
                "success": False,
                "error": str(e),
                "conversation_id": conversation_id,
                "execution_time_ms": execution_time,
                "timestamp": datetime.now().isoformat()
            }
    
    def _infer_routing_context(self, messages: List[Dict[str, Any]]) -> RoutingContext:
        """Infer routing context from input messages"""
        # Simple intent detection based on message content
        content = " ".join(msg.get("content", "") for msg in messages if msg.get("content"))
        content_lower = content.lower()
        
        intents = []
        
        # Intent keywords mapping
        intent_keywords = {
            "code": ["code", "programming", "debug", "refactor", "function", "class"],
            "retrieval": ["search", "find", "look up", "research", "information"],
            "dataviz": ["chart", "graph", "visualize", "plot", "analyze data"],
            "image": ["image", "picture", "generate", "create visual"],
            "automation": ["automate", "click", "browser", "screen", "computer"],
            "web_research": ["latest", "news", "current", "recent", "web"],
        }
        
        for intent, keywords in intent_keywords.items():
            if any(keyword in content_lower for keyword in keywords):
                intents.append(intent)
        
        # Estimate complexity
        complexity = "high" if len(content) > 1000 or "complex" in content_lower else "low"
        
        return RoutingContext(
            intents=intents or ["general"],
            complexity=complexity,
            estimated_input_tokens=len(content) // 4,  # Rough estimation
            estimated_output_tokens=400
        )
    
    def _get_model_params(self, model: str, **kwargs) -> Dict[str, Any]:
        """Get model-specific parameters"""
        params = {}
        
        # GPT-5 models use different parameter names
        if "gpt-5" in model.lower():
            if "max_tokens" in kwargs:
                params["max_completion_tokens"] = kwargs["max_tokens"]
            # GPT-5 uses default temperature of 1.0
        else:
            if "max_tokens" in kwargs:
                params["max_tokens"] = kwargs["max_tokens"]
            if "temperature" in kwargs:
                params["temperature"] = kwargs["temperature"]
        
        return params
    
    def _get_or_create_memory(self, conversation_id: str, user_id: str) -> ConversationMemory:
        """Get existing or create new conversation memory"""
        if conversation_id in self.conversations:
            return self.conversations[conversation_id]
        
        # Clean up old conversations if limit exceeded
        if len(self.conversations) >= self.max_conversations:
            oldest_id = min(
                self.conversations.keys(),
                key=lambda k: self.conversations[k].last_activity
            )
            del self.conversations[oldest_id]
        
        memory = ConversationMemory(
            conversation_id=conversation_id,
            user_id=user_id
        )
        self.conversations[conversation_id] = memory
        return memory
    
    def _format_response(
        self,
        response: Any,
        conversation_id: str,
        route: Dict,
        execution_time_ms: float
    ) -> Dict[str, Any]:
        """Format API response for consistent output"""
        
        # Extract content based on response type
        content = ""
        tool_calls = []
        
        if hasattr(response, 'output'):
            if isinstance(response.output, str):
                content = response.output
            elif hasattr(response.output, 'content'):
                content = response.output.content
            elif hasattr(response.output, 'text'):
                content = response.output.text
        
        # Extract tool calls if present
        if hasattr(response, 'tool_calls') and response.tool_calls:
            tool_calls = [
                {
                    "id": call.id,
                    "type": call.type,
                    "function": {
                        "name": call.function.name,
                        "arguments": call.function.arguments
                    }
                }
                for call in response.tool_calls
            ]
        
        # Extract usage information
        usage = {}
        if hasattr(response, 'usage'):
            usage = {
                "input_tokens": getattr(response.usage, 'input_tokens', 0),
                "output_tokens": getattr(response.usage, 'output_tokens', 0),
                "total_tokens": getattr(response.usage, 'total_tokens', 0)
            }
        
        return {
            "success": True,
            "content": content,
            "conversation_id": conversation_id,
            "response_id": getattr(response, 'id', None),
            "model": route["model"],
            "reasoning_effort": route["reasoning_effort"],
            "estimated_cost": route["estimated_cost"],
            "tool_calls": tool_calls,
            "usage": usage,
            "execution_time_ms": execution_time_ms,
            "timestamp": datetime.now().isoformat()
        }
    
    def _update_stats(self, route: Optional[Dict], execution_time: float, success: bool):
        """Update performance statistics"""
        if success:
            self.stats["successful_requests"] += 1
        else:
            self.stats["failed_requests"] += 1
        
        # Update average response time
        total_requests = self.stats["total_requests"]
        current_avg = self.stats["average_response_time"]
        self.stats["average_response_time"] = (
            (current_avg * (total_requests - 1) + execution_time) / total_requests
        )
        
        # Track model usage
        if route and success:
            model = route["model"]
            if model not in self.stats["model_usage"]:
                self.stats["model_usage"][model] = 0
            self.stats["model_usage"][model] += 1
            
            # Track cost
            self.stats["total_cost"] += route.get("estimated_cost", 0)
    
    # Legacy LangChain compatibility methods
    async def run_chain(
        self,
        chain_input: Union[str, Dict],
        chain_type: str = "conversation",
        **kwargs
    ) -> Dict[str, Any]:
        """Compatibility method for LangChain chain execution"""
        
        # Convert LangChain input format to messages
        if isinstance(chain_input, str):
            messages = [{"role": "user", "content": chain_input}]
        elif isinstance(chain_input, dict):
            content = chain_input.get("input", str(chain_input))
            messages = [{"role": "user", "content": content}]
        else:
            messages = [{"role": "user", "content": str(chain_input)}]
        
        # Add system prompt for chain type
        system_prompt = self._get_chain_system_prompt(chain_type)
        if system_prompt:
            messages.insert(0, {"role": "system", "content": system_prompt})
        
        # Create routing context based on chain type
        routing_context = RoutingContext(
            intents=[chain_type],
            complexity="low" if chain_type in ["conversation", "simple"] else "high"
        )
        
        return await self.create_response(
            input_messages=messages,
            routing_context=routing_context,
            **kwargs
        )
    
    def _get_chain_system_prompt(self, chain_type: str) -> Optional[str]:
        """Get system prompt for legacy chain types"""
        prompts = {
            "conversation": "You are a helpful AI assistant. Engage in natural conversation.",
            "research": "You are a research assistant. Provide accurate, well-sourced information.",
            "code": "You are a code assistant. Help with programming tasks, debugging, and code review.",
            "data_analysis": "You are a data analyst. Help analyze data and create visualizations.",
        }
        return prompts.get(chain_type)
    
    def get_stats(self) -> Dict[str, Any]:
        """Get adapter performance statistics"""
        return {
            **self.stats,
            "active_conversations": len(self.conversations),
            "router_config_version": getattr(self.router.config, "version", "unknown")
        }
    
    async def cleanup_old_conversations(self, max_age_hours: int = 24):
        """Clean up old conversation memory"""
        cutoff = datetime.now().timestamp() - (max_age_hours * 3600)
        
        to_remove = [
            conv_id for conv_id, memory in self.conversations.items()
            if memory.last_activity.timestamp() < cutoff
        ]
        
        for conv_id in to_remove:
            del self.conversations[conv_id]
        
        self.logger.info(f"Cleaned up {len(to_remove)} old conversations")


# Global adapter instance
_adapter_instance: Optional[ResponsesAPIAdapter] = None


def get_responses_adapter() -> ResponsesAPIAdapter:
    """Get global responses adapter instance"""
    global _adapter_instance
    if _adapter_instance is None:
        _adapter_instance = ResponsesAPIAdapter()
    return _adapter_instance


def initialize_responses_adapter(api_key: Optional[str] = None, logger: Optional[logging.Logger] = None) -> ResponsesAPIAdapter:
    """Initialize global responses adapter"""
    global _adapter_instance
    _adapter_instance = ResponsesAPIAdapter(api_key=api_key, logger=logger)
    return _adapter_instance
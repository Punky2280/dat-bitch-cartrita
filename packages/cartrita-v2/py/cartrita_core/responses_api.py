"""
Cartrita V2 - Enhanced OpenAI Responses API Client
Wrapper for OpenAI Responses API with conversation state management
"""

import asyncio
import logging
import json
import time
from datetime import datetime
from typing import Dict, List, Optional, Any, AsyncGenerator
from dataclasses import dataclass, field
from pathlib import Path
import base64

from openai import AsyncOpenAI
from config import OpenAISettings, get_settings, load_system_prompt
from .computer_use_agent import ComputerUseAgent


@dataclass
class ConversationState:
    conversation_id: str
    user_id: str
    messages: List[Dict[str, Any]] = field(default_factory=list)
    tools_used: List[str] = field(default_factory=list)
    metadata: Dict[str, Any] = field(default_factory=dict)
    created_at: datetime = field(default_factory=datetime.now)
    last_activity: datetime = field(default_factory=datetime.now)


@dataclass
class ResponsesRequest:
    input_items: List[Dict[str, Any]]
    model: str = "gpt-5"
    tools: Optional[List[Dict]] = None
    reasoning: Optional[Dict] = None
    temperature: float = 0.7
    max_tokens: Optional[int] = None
    truncation: str = "auto"
    metadata: Dict[str, Any] = field(default_factory=dict)


class CartritaResponsesClient:
    """
    Enhanced OpenAI Responses API client for Cartrita V2
    Manages conversations, tool integration, and computer use sessions
    """
    
    def __init__(
        self,
        api_key: Optional[str] = None,
        model: str = "gpt-5",
        logger: Optional[logging.Logger] = None,
        max_conversations: int = 1000
    ):
        if api_key is None:
            oa: OpenAISettings = get_settings()["openai"]  # type: ignore[assignment]
            client_kwargs = oa.client_kwargs()
            self.client = AsyncOpenAI(**client_kwargs)
            self.model = oa.default_model if model == "gpt-5" else model
        else:
            self.client = AsyncOpenAI(api_key=api_key)
            self.model = model
        self.logger = logger or logging.getLogger("cartrita.responses_api")
        self.max_conversations = max_conversations
        
        # Initialize computer use agent
        self.computer_use_agent = ComputerUseAgent(
            api_key=api_key,
            logger=self.logger
        )
        
        # Conversation management
        self.conversations: Dict[str, ConversationState] = {}
        self.active_sessions: Dict[str, Dict] = {}
        
        # Performance tracking
        self.stats = {
            "total_requests": 0,
            "successful_requests": 0,
            "failed_requests": 0,
            "total_tokens_used": 0,
            "average_response_time": 0.0,
            "computer_use_sessions": 0,
            "tools_executed": 0
        }
        
        # Computer use configuration
        self.computer_use_config = {
            "display_width": 1024,
            "display_height": 768,
            "display_number": 0
        }
    
    async def create_response(
        self,
        request: ResponsesRequest,
        conversation_id: Optional[str] = None,
        user_id: str = "anonymous"
    ) -> Dict[str, Any]:
        """Create a response using OpenAI Responses API"""
        start_time = time.time()
        self.stats["total_requests"] += 1

        try:
            # Manage conversation state
            if conversation_id:
                conv_state = self._get_or_create_conversation(conversation_id, user_id)
                # Add conversation context to request
                request = self._add_conversation_context(request, conv_state)

            self.logger.info(f"Creating response with model {request.model}")

            # Convert input items to messages format
            messages = []
            # Prepend system persona if available
            system_prompt = load_system_prompt()
            if system_prompt:
                messages.append({"role": "system", "content": system_prompt})
            messages.extend(
                {"role": "user", "content": item["text"]}
                for item in request.input_items
                if item["type"] == "text"
            )
            # Prepare parameters for GPT-5 compatibility
            if request.model == "gpt-5":
                # GPT-5 specific parameters
                params = {
                    "model": request.model,
                    "messages": messages,
                    "tools": request.tools or None,
                    "max_completion_tokens": request.max_tokens,
                    "temperature": 1.0  # GPT-5 only supports temperature=1.0
                }
            else:
                # Standard parameters for other models
                params = {
                    "model": request.model,
                    "messages": messages,
                    "tools": request.tools or None,
                    "temperature": request.temperature,
                    "max_tokens": request.max_tokens,
                }

            # Remove None values
            params = {k: v for k, v in params.items() if v is not None}

            # Call OpenAI Chat Completions API
            response = await self.client.chat.completions.create(**params)

            # Process response
            processed_response = await self._process_response(
                response, 
                request, 
                conversation_id, 
                user_id
            )

            # Update stats
            response_time = time.time() - start_time
            self._update_stats(processed_response, response_time)

            return processed_response

        except Exception as e:
            self.logger.error(f"Response creation failed: {e}")
            self.stats["failed_requests"] += 1

            return {
                "success": False,
                "error": str(e),
                "conversation_id": conversation_id,
                "timestamp": datetime.now().isoformat()
            }
    
    async def create_computer_use_session(
        self,
        task_description: str,
        user_id: str = "anonymous",
        display_width: int = 1024,
        display_height: int = 768,
        max_iterations: int = 10
    ) -> Dict[str, Any]:
        """Create a computer use session using the new ComputerUseAgent"""
        
        try:
            # Use the new computer use agent
            result = await self.computer_use_agent.create_session(
                task_description=task_description,
                user_id=user_id,
                display_width=display_width,
                display_height=display_height
            )
            
            if result["success"]:
                self.stats["computer_use_sessions"] += 1
                
                # Store session reference for tracking
                session_id = result["session_id"]
                self.active_sessions[session_id] = {
                    "task_description": task_description,
                    "user_id": user_id,
                    "display_width": display_width,
                    "display_height": display_height,
                    "max_iterations": max_iterations,
                    "created_at": datetime.now().isoformat(),
                    "status": "active"
                }
            
            return result
            
        except Exception as e:
            self.logger.error(f"Computer use session creation failed: {e}")
            return {
                "success": False,
                "error": str(e),
                "session_id": f"failed_{int(time.time())}"
            }
    
    async def continue_computer_use_session(
        self,
        session_id: str,
        user_input: Optional[str] = None
    ) -> Dict[str, Any]:
        """Continue an existing computer use session"""
        
        if session_id not in self.active_sessions:
            return {
                "success": False,
                "error": f"Session {session_id} not found"
            }

        try:
            return await self.computer_use_agent.continue_session(
                session_id=session_id, user_input=user_input
            )
        except Exception as e:
            self.logger.error(f"Computer use session continuation failed: {e}")
            return {
                "success": False,
                "error": str(e),
                "session_id": session_id
            }
    
    def _get_or_create_conversation(
        self, 
        conversation_id: str, 
        user_id: str
    ) -> ConversationState:
        """Get existing conversation or create new one"""
        
        if conversation_id in self.conversations:
            conv = self.conversations[conversation_id]
            conv.last_activity = datetime.now()
            return conv
        
        # Create new conversation
        conv = ConversationState(
            conversation_id=conversation_id,
            user_id=user_id
        )
        
        self.conversations[conversation_id] = conv
        
        # Cleanup old conversations if needed
        self._cleanup_old_conversations()
        
        return conv
    
    def _add_conversation_context(
        self, 
        request: ResponsesRequest, 
        conv_state: ConversationState
    ) -> ResponsesRequest:
        """Add conversation context to request"""
        
        # Add recent conversation history
        if conv_state.messages:
            context_items = [{
                "type": "text",
                "text": f"Previous {msg['role']}: {msg['content']}"
            } for msg in conv_state.messages[-5:]]
            
            # Prepend context to input items
            request.input_items = context_items + request.input_items
        
        return request
    
    async def _process_response(
        self,
        response: Any,  # OpenAI response object
        request: ResponsesRequest,
        conversation_id: Optional[str],
        user_id: str
    ) -> Dict[str, Any]:  # sourcery skip: low-code-quality
        """Process and format OpenAI Responses API response"""
        
        processed = {
            "success": True,
            "model": request.model,
            "conversation_id": conversation_id,
            "user_id": user_id,
            "timestamp": datetime.now().isoformat()
        }
        
        # Extract response content from ChatCompletion response
        if hasattr(response, 'choices') and response.choices:
            choice = response.choices[0]
            
            if hasattr(choice, 'message'):
                processed["content"] = choice.message.content or ""
                
                # Handle tool calls
                if hasattr(choice.message, 'tool_calls') and choice.message.tool_calls:
                    tool_calls = []
                    for tool_call in choice.message.tool_calls:
                        tool_calls.append({
                            "id": tool_call.id,
                            "type": tool_call.type,
                            "function": {
                                "name": tool_call.function.name,
                                "arguments": tool_call.function.arguments
                            }
                        })
                        self.stats["tools_executed"] += 1
                    
                    processed["tool_calls"] = tool_calls
        
        # Extract reasoning if available
        if hasattr(response, 'reasoning') and response.reasoning:
            processed["reasoning"] = response.reasoning
        
        # Extract usage information
        if hasattr(response, 'usage') and response.usage:
            processed["usage"] = {
                "prompt_tokens": getattr(response.usage, 'prompt_tokens', 0),
                "completion_tokens": getattr(response.usage, 'completion_tokens', 0),
                "total_tokens": getattr(response.usage, 'total_tokens', 0)
            }
            
            self.stats["total_tokens_used"] += processed["usage"]["total_tokens"]
        
        # Update conversation state
        if conversation_id and conversation_id in self.conversations:
            conv = self.conversations[conversation_id]
            
            # Add user message (reconstructed from input)
            user_content = " ".join([
                item.get("text", "") for item in request.input_items 
                if item.get("type") == "text"
            ])
            
            conv.messages.append({
                "role": "user",
                "content": user_content[:500],  # Truncate for storage
                "timestamp": datetime.now().isoformat()
            })
            
            # Add assistant response
            conv.messages.append({
                "role": "assistant",
                "content": processed.get("content", "")[:500],
                "timestamp": datetime.now().isoformat()
            })
            
            # Track tools used
            if "tool_calls" in processed:
                for tool_call in processed["tool_calls"]:
                    tool_name = tool_call["function"]["name"]
                    if tool_name not in conv.tools_used:
                        conv.tools_used.append(tool_name)
            
            conv.last_activity = datetime.now()
        
        return processed
    
    def _update_stats(self, response: Dict[str, Any], response_time: float):
        """Update performance statistics"""
        
        if response.get("success"):
            self.stats["successful_requests"] += 1
        else:
            self.stats["failed_requests"] += 1
        
        # Update average response time (exponential moving average)
        alpha = 0.1
        self.stats["average_response_time"] = (
            alpha * response_time + 
            (1 - alpha) * self.stats["average_response_time"]
        )
    
    def _cleanup_old_conversations(self):
        """Remove old conversations to prevent memory bloat"""
        
        if len(self.conversations) <= self.max_conversations:
            return

        # Sort by last activity and remove oldest
        sorted_convs = sorted(
            self.conversations.items(),
            key=lambda x: x[1].last_activity
        )

        # Keep only the most recent conversations
        to_keep = sorted_convs[-self.max_conversations:]

        self.conversations = dict(to_keep)

        self.logger.info(f"Cleaned up conversations, kept {len(self.conversations)}")
    
    def get_conversation_history(self, conversation_id: str) -> Optional[ConversationState]:
        """Get conversation history"""
        return self.conversations.get(conversation_id)
    
    def end_computer_use_session(self, session_id: str) -> Dict[str, Any]:
        """End a computer use session"""
        
        if session_id not in self.active_sessions:
            return {
                "success": False,
                "error": f"Session {session_id} not found"
            }
        
        session = self.active_sessions[session_id]
        session["status"] = "completed"
        session["ended_at"] = datetime.now().isoformat()
        
        # Move to completed sessions (could implement persistence here)
        del self.active_sessions[session_id]
        
        return {
            "success": True,
            "session_id": session_id,
            "iterations_completed": session["current_iteration"],
            "status": "completed"
        }
    
    def get_client_stats(self) -> Dict[str, Any]:
        """Get client statistics"""
        return {
            "stats": self.stats,
            "active_conversations": len(self.conversations),
            "active_computer_sessions": len(self.active_sessions),
            "computer_use_config": self.computer_use_config,
            "timestamp": datetime.now().isoformat()
        }
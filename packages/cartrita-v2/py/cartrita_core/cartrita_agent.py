"""
Cartrita V2 - Core Agent Implementation
OpenAI Responses API Integration with Computer Use Capabilities
"""

import asyncio
import logging
import time
from datetime import datetime
from enum import Enum
from typing import Dict, List, Optional, Any, Union, TypedDict, cast
from dataclasses import dataclass, field
from pathlib import Path
import json
import io

try:
    from openai import AsyncOpenAI
except ImportError as e:
    raise ImportError(
        "The 'openai' package is required but not installed. "
        "Install it with 'pip install openai'."
    ) from e

import cv2
import numpy as np
from PIL import Image
import psutil

# Import automation backend from dedicated module
from .automation import automation_backend, AUTOMATION_MODE, pyautogui

from .tools import CartritaToolRegistry, ToolPermissionLevel


# TypedDict definitions for image handling
class ImageSource(TypedDict):
    type: str
    media_type: str
    data: str

class ImageItem(TypedDict):
    type: str
    source: ImageSource


class AgentStatus(Enum):
    IDLE = "idle"
    ACTIVE = "active"
    BUSY = "busy"
    ERROR = "error"
    OFFLINE = "offline"


class TaskPriority(Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    URGENT = "urgent"


@dataclass
class AgentContext:
    user_id: str
    session_id: Optional[str] = None
    conversation_history: List[Dict] = field(default_factory=list)
    metadata: Dict[str, Any] = field(default_factory=dict)
    permissions: List[str] = field(default_factory=list)
    environment_info: Dict[str, Any] = field(default_factory=dict)


@dataclass
class AgentTask:
    id: str
    description: str
    priority: TaskPriority
    context: AgentContext
    created_at: datetime = field(default_factory=datetime.now)
    max_iterations: int = 10
    tools_allowed: List[str] = field(default_factory=list)
    computer_use_enabled: bool = False
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class CartritaResponse:
    success: bool
    content: str
    agent_id: str
    task_id: str
    reasoning: Optional[str] = None
    tools_used: List[str] = field(default_factory=list)
    iterations_completed: int = 0
    execution_time_ms: int = 0
    metadata: Dict[str, Any] = field(default_factory=dict)
    error: Optional[str] = None
    computer_actions: List[Dict] = field(default_factory=list)


class CartritaCoreAgent:
    """
    Enhanced Cartrita agent using OpenAI Responses API (2025)
    Supports computer use, multi-tool execution, and hierarchical delegation
    """
    
    def __init__(
        self,
        agent_id: str,
        model: str = "gpt-4o",
        tools_registry: Optional[CartritaToolRegistry] = None,
        openai_client: Optional[AsyncOpenAI] = None,
        logger: Optional[logging.Logger] = None,
        computer_use_enabled: bool = False,
        max_iterations: int = 10
    ):
        self.agent_id = agent_id
        self.model = model
        self.status = AgentStatus.IDLE
        self.tools_registry = tools_registry or CartritaToolRegistry()
        self.client = openai_client or AsyncOpenAI()
        self.logger = logger or logging.getLogger(f"cartrita.agent.{agent_id}")
        
        # Computer use configuration
        self.computer_use_enabled = computer_use_enabled
        self.max_iterations = max_iterations
        self.display_width = 1024
        self.display_height = 768
        
        # Agent state
        self.current_task: Optional[AgentTask] = None
        self.conversation_state: Dict[str, Any] = {}
        self.performance_metrics = {
            "total_tasks": 0,
            "successful_tasks": 0,
            "failed_tasks": 0,
            "average_response_time": 0.0,
            "tools_usage": {},
            "computer_actions_count": 0
        }
        
        # Initialize computer use if enabled
        if computer_use_enabled:
            self._initialize_computer_use()
    
    def _initialize_computer_use(self):
        """Initialize computer use capabilities"""
        try:
            if AUTOMATION_MODE == "disabled":
                self.logger.warning("No automation backend available - computer use disabled")
                self.computer_use_enabled = False
                return
                
            # Configure automation backend
            if hasattr(automation_backend, 'FAILSAFE'):
                automation_backend.FAILSAFE = True
            if hasattr(automation_backend, 'PAUSE'):
                automation_backend.PAUSE = 0.5
            
            # Get screen size
            screen_size = automation_backend.size()
            self.display_width = screen_size.width
            self.display_height = screen_size.height
            
            self.logger.info(f"Computer use initialized with {AUTOMATION_MODE}: {self.display_width}x{self.display_height}")
            
        except Exception as e:
            self.logger.warning(f"Computer use initialization failed: {e}")
            self.computer_use_enabled = False
    
    def _update_metrics(self, response: CartritaResponse, execution_time: int):
        """Update performance metrics"""
        self.performance_metrics["total_tasks"] += 1
        
        if response.success:
            self.performance_metrics["successful_tasks"] += 1
        else:
            self.performance_metrics["failed_tasks"] += 1
        
        # Update average response time (exponential moving average)
        alpha = 0.1
        current_avg = self.performance_metrics["average_response_time"]
        self.performance_metrics["average_response_time"] = (
            alpha * execution_time + (1 - alpha) * current_avg
        )
        
        # Update tools usage
        for tool in response.tools_used:
            if tool not in self.performance_metrics["tools_usage"]:
                self.performance_metrics["tools_usage"][tool] = 0
            self.performance_metrics["tools_usage"][tool] += 1
    
    async def execute_task(self, task: AgentTask) -> CartritaResponse:
        """Execute a task using OpenAI Responses API"""
        start_time = time.time()
        self.current_task = task
        self.status = AgentStatus.ACTIVE
        
        try:
            self.logger.info(f"Executing task {task.id}: {task.description[:100]}...")
            
            # Prepare input items for Responses API
            input_items = self._prepare_input_items(task)
            
            # Get available tools for this task
            tools = self._get_available_tools(task)
            
            # Execute using OpenAI Responses API
            # Only include tools if we have valid ones
            api_params = {
                "model": self.model,
                "input": input_items,
                "truncation": "auto"
            }
            
            # Add reasoning only for models that support it
            if "o1" in self.model.lower():
                api_params["reasoning"] = {"summary": "detailed"}
            
            if tools and len(tools) > 0:
                api_params["tools"] = tools
                
            response = await self.client.responses.create(**api_params)
            
            # Process the response
            result = await self._process_response(response, task)
            
            # Update metrics
            execution_time = int((time.time() - start_time) * 1000)
            result.execution_time_ms = execution_time
            self._update_metrics(result, execution_time)
            
            self.status = AgentStatus.IDLE
            self.current_task = None
            
            return result
            
        except Exception as e:
            self.logger.error(f"Task execution failed: {e}")
            execution_time = int((time.time() - start_time) * 1000)
            
            error_response = CartritaResponse(
                success=False,
                content="Task execution failed",
                agent_id=self.agent_id,
                task_id=task.id,
                error=str(e),
                execution_time_ms=execution_time
            )
            
            self._update_metrics(error_response, execution_time)
            self.status = AgentStatus.ERROR
            
            return error_response
    
    def _prepare_input_items(self, task: AgentTask) -> List[Dict[str, Any]]:
        """Prepare input items for OpenAI Responses API"""
        input_items: List[Dict[str, Any]] = [
            {
                "type": "message",
                "role": "system",
                "content": f"""You are Cartrita, an advanced AI agent with ID: {self.agent_id}

Task: {task.description}

Context:
- User ID: {task.context.user_id}
- Session ID: {task.context.session_id}
- Priority: {task.priority.value}
- Computer use enabled: {self.computer_use_enabled}
- Available tools: {', '.join(task.tools_allowed) if task.tools_allowed else 'All allowed tools'}

Please execute this task efficiently and provide detailed reasoning for your actions.""",
            },
            {
                "type": "message",
                "role": "user", 
                "content": task.description
            }
        ]

        # Add conversation history if available
        if task.context.conversation_history:
            # Last 5 messages
            input_items.extend([{
                "type": "message",
                "role": msg.get('role', 'user'),
                "content": msg.get('content', '')
            } for msg in task.context.conversation_history[-5:]])

        # Add screenshot if computer use is enabled
        if self.computer_use_enabled:
            if screenshot_path := self._take_screenshot():
                image_item: Dict[str, Any] = {
                    "type": "image",
                    "source": {
                        "type": "base64",
                        "media_type": "image/png",
                        "data": self._encode_image_base64(screenshot_path)
                    }
                }
                input_items.append(image_item)

        return input_items
    
    def _get_available_tools(self, task: AgentTask) -> List[Dict]:
        """Get available tools for the task"""
        tools = []
        
        # Get tools from registry
        available_tools = self.tools_registry.get_tools_for_agent(
            self.agent_id, 
            task.tools_allowed
        )
        
        for tool_name, tool_config in available_tools.items():
            if tool_name and tool_config:  # Ensure both exist
                # Ensure parameters is a valid schema
                parameters = tool_config.get("parameters", {"type": "object", "properties": {}})
                if not isinstance(parameters, dict) or "type" not in parameters:
                    parameters = {"type": "object", "properties": {}}
                
                tools.append({
                    "type": "function",
                    "function": {
                        "name": str(tool_name),  # Ensure string
                        "description": str(tool_config.get("description", f"Tool: {tool_name}")),
                        "parameters": parameters
                    }
                })
        
        # Add computer use tool if enabled
        if self.computer_use_enabled and task.computer_use_enabled:
            tools.append({
                "type": "computer_20241022",
                "computer_20241022": {
                    "display_width_px": self.display_width,
                    "display_height_px": self.display_height,
                    "display_number": 0
                }
            })
        
        return tools
    
    async def _process_response(self, response, task: AgentTask) -> CartritaResponse:
        """Process OpenAI Responses API response"""
        tools_used = []
        computer_actions = []
        iterations = 0
        
        # Extract response content
        content = ""
        reasoning = ""
        
        if hasattr(response, 'choices') and response.choices:
            choice = response.choices[0]
            if hasattr(choice, 'message'):
                content = choice.message.content or ""
                
            # Handle tool calls
            if hasattr(choice.message, 'tool_calls') and choice.message.tool_calls:
                for tool_call in choice.message.tool_calls:
                    tool_name = tool_call.function.name
                    tools_used.append(tool_name)
                    
                    # Execute tool
                    if tool_name == "computer_20241022":
                        action_result = await self._execute_computer_action(
                            tool_call.function.arguments, task
                        )
                        computer_actions.append(action_result)
                    else:
                        await self._execute_tool(tool_name, tool_call.function.arguments)
                    
                    iterations += 1
        
        # Extract reasoning if available
        if hasattr(response, 'reasoning') and response.reasoning:
            if hasattr(response.reasoning, 'get'):
                reasoning = response.reasoning.get('summary', '')
            else:
                reasoning = str(response.reasoning)
        
        return CartritaResponse(
            success=True,
            content=content,
            agent_id=self.agent_id,
            task_id=task.id,
            reasoning=reasoning,
            tools_used=tools_used,
            iterations_completed=iterations,
            computer_actions=computer_actions,
            metadata={
                "model_used": self.model,
                "execution_time": (datetime.now() - task.created_at).total_seconds(),
                "task_description": task.description,
                "priority": task.priority.value if task.priority else "medium"
            }
        )
    async def _execute_computer_action(self, action_args: str, task: AgentTask) -> Dict:
        """Execute computer use action"""
        try:
            action_data = json.loads(action_args) if isinstance(action_args, str) else action_args
            action_type = action_data.get("action", "")

            result = {
                "action": action_type,
                "success": False,
                "timestamp": datetime.now().isoformat()
            }

            if action_type == "screenshot":
                screenshot_path = self._take_screenshot()
                result |= {
                    "success": True,
                    "screenshot_path": (
                        str(screenshot_path) if screenshot_path else None
                    ),
                }

            elif action_type == "click":
                x = action_data.get("coordinate", [0, 0])[0]
                y = action_data.get("coordinate", [0, 0])[1]
                if automation_backend:
                    automation_backend.click(x, y)
                    result.update({
                        "success": True,
                        "coordinates": [x, y],
                        "backend": AUTOMATION_MODE
                    })
                else:
                    result["error"] = "Automation backend not available"

            elif action_type == "type":
                text = action_data.get("text", "")
                if automation_backend:
                    automation_backend.typewrite(text)
                    result.update({
                        "success": True,
                        "text": text,
                        "backend": AUTOMATION_MODE
                    })
                else:
                    result["error"] = "Automation backend not available"

            elif action_type == "scroll":
                clicks = action_data.get("coordinate", [0, 0, 3])[2]
                if automation_backend:
                    automation_backend.scroll(clicks)
                    result.update({
                        "success": True,
                        "scroll_amount": clicks,
                        "backend": AUTOMATION_MODE
                    })
                else:
                    result["error"] = "Automation backend not available"

            self.performance_metrics["computer_actions_count"] += 1
            return result

        except Exception as e:
            self.logger.error(f"Computer action failed: {e}")
            return {
                "action": action_args,
                "success": False,
                "error": str(e),
                "timestamp": datetime.now().isoformat()
            }
    
    async def _execute_tool(self, tool_name: str, tool_args: str) -> Dict:
        """Execute a tool from the registry"""
        try:
            return await self.tools_registry.execute_tool(
                tool_name, 
                tool_args, 
                self.agent_id
            )
        except Exception as e:
            self.logger.error(f"Tool execution failed {tool_name}: {e}")
            return {"success": False, "error": str(e)}
    
    def _take_screenshot(self) -> Optional[Path]:
        """Take a screenshot for computer use"""
        try:
            screenshot_dir = Path("/tmp/cartrita_screenshots")
            screenshot_dir.mkdir(exist_ok=True)
            
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S_%f")
            screenshot_path = screenshot_dir / f"screenshot_{timestamp}.png"
            
            if AUTOMATION_MODE == "disabled" or not automation_backend:
                # Create fallback screenshot when automation is disabled
                fallback_screenshot = Image.new('RGB', (self.display_width, self.display_height), color='gray')
                fallback_screenshot.save(screenshot_path)
                self.logger.warning(f"Automation disabled - fallback screenshot saved: {screenshot_path}")
            else:
                screenshot = automation_backend.screenshot()
                screenshot.save(screenshot_path)
                self.logger.info(f"Screenshot captured using {AUTOMATION_MODE}: {screenshot_path}")
            
            return screenshot_path
            
        except Exception as e:
            self.logger.error(f"Screenshot failed: {e}")
            return None
    
    def _encode_image_base64(self, image_path: Path) -> str:
        """Encode image to base64 for API"""
        import base64
        
        try:
            with open(image_path, "rb") as image_file:
                return base64.b64encode(image_file.read()).decode()
        except Exception as e:
            self.logger.error(f"Image encoding failed: {e}")
            return ""
    
    def get_status(self) -> Dict[str, Any]:
        """Get current agent status"""
        return {
            "agent_id": self.agent_id,
            "status": self.status.value,
            "model": self.model,
            "computer_use_enabled": self.computer_use_enabled,
            "current_task_id": self.current_task.id if self.current_task else None,
            "display_size": f"{self.display_width}x{self.display_height}",
            "performance_metrics": self.performance_metrics,
            "tools_available": len(self.tools_registry.get_tools_for_agent(self.agent_id)),
            "uptime": time.time(),
            "timestamp": datetime.now().isoformat()
        }
    
    async def shutdown(self):
        """Graceful shutdown"""
        self.logger.info(f"Shutting down agent {self.agent_id}")
        self.status = AgentStatus.OFFLINE
        
        if self.current_task:
            self.logger.warning(f"Shutting down with active task: {self.current_task.id}")
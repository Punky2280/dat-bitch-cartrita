"""
Cartrita V2 - Computer Use Agent
Implementation following OpenAI's Computer Use API documentation
"""

import asyncio
import base64
import time
import logging
import json
import subprocess
from datetime import datetime
from typing import Dict, List, Optional, Any, Tuple
from dataclasses import dataclass, field
from pathlib import Path
import tempfile
import os

from openai import AsyncOpenAI
from PIL import Image, ImageGrab
import io


@dataclass
class ComputerAction:
    """Represents a computer action"""
    type: str  # click, scroll, keypress, type, wait, screenshot
    x: Optional[int] = None
    y: Optional[int] = None
    button: Optional[str] = None  # left, right, middle
    scroll_x: Optional[int] = None
    scroll_y: Optional[int] = None
    keys: Optional[List[str]] = None
    text: Optional[str] = None


@dataclass
class ComputerUseSession:
    """Represents a computer use session"""
    session_id: str
    user_id: str
    task_description: str
    display_width: int = 1024
    display_height: int = 768
    environment: str = "ubuntu"
    max_iterations: int = 10
    current_iteration: int = 0
    status: str = "active"
    created_at: datetime = field(default_factory=datetime.now)
    actions_taken: List[ComputerAction] = field(default_factory=list)
    screenshots: List[str] = field(default_factory=list)


class ComputerUseAgent:
    """
    Computer Use Agent implementing OpenAI's Computer Use API
    """
    
    def __init__(
        self,
        api_key: Optional[str] = None,
        logger: Optional[logging.Logger] = None,
        display_width: int = 1024,
        display_height: int = 768
    ):
        self.client = AsyncOpenAI(api_key=api_key)
        self.logger = logger or logging.getLogger("cartrita.computer_use")
        self.display_width = display_width
        self.display_height = display_height
        
        # Session management
        self.active_sessions: Dict[str, ComputerUseSession] = {}
        
        # Environment setup
        self._setup_display_environment()
    
    def _setup_display_environment(self):
        """Setup virtual display environment for computer use"""
        try:
            # Check if running in Docker/headless environment
            if not os.environ.get('DISPLAY'):
                # Setup virtual display using Xvfb
                display_num = ":99"
                os.environ['DISPLAY'] = display_num
                
                # Start Xvfb if not already running
                try:
                    subprocess.run([
                        "Xvfb", display_num, 
                        "-screen", "0", f"{self.display_width}x{self.display_height}x24"
                    ], check=False, capture_output=True)
                    self.logger.info(f"Started virtual display {display_num}")
                except Exception as e:
                    self.logger.warning(f"Could not start Xvfb: {e}")
                
                # Start window manager
                try:
                    subprocess.Popen([
                        "openbox", "--startup"
                    ], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
                    self.logger.info("Started window manager")
                except Exception as e:
                    self.logger.warning(f"Could not start window manager: {e}")
                    
        except Exception as e:
            self.logger.error(f"Display environment setup failed: {e}")
    
    async def create_session(
        self,
        task_description: str,
        user_id: str = "anonymous",
        display_width: int = None,
        display_height: int = None,
        environment: str = "ubuntu"
    ) -> Dict[str, Any]:
        """Create a new computer use session"""
        
        session_id = f"computer_use_{int(time.time())}_{user_id}"
        
        session = ComputerUseSession(
            session_id=session_id,
            user_id=user_id,
            task_description=task_description,
            display_width=display_width or self.display_width,
            display_height=display_height or self.display_height,
            environment=environment
        )
        
        self.active_sessions[session_id] = session
        
        try:
            # Take initial screenshot
            screenshot_base64 = await self._take_screenshot()
            session.screenshots.append(screenshot_base64)
            
            # Send initial request to the model
            response = await self.client.responses.create(
                model="computer-use-preview",
                tools=[{
                    "type": "computer_use_preview",
                    "display_width": session.display_width,
                    "display_height": session.display_height,
                    "environment": session.environment
                }],
                input=[{
                    "role": "user",
                    "content": [
                        {
                            "type": "input_text", 
                            "text": task_description
                        },
                        {
                            "type": "input_image",
                            "image_url": f"data:image/png;base64,{screenshot_base64}"
                        }
                    ]
                }],
                reasoning={"summary": "concise"},
                truncation="auto"
            )
            
            return {
                "success": True,
                "session_id": session_id,
                "initial_response": self._process_response(response),
                "screenshot": screenshot_base64
            }
            
        except Exception as e:
            self.logger.error(f"Failed to create computer use session: {e}")
            # Fallback to GPT-5 text mode if computer-use-preview fails
            try:
                return await self._create_fallback_session(session)
            except Exception as fallback_error:
                return {
                    "success": False,
                    "error": f"Session creation failed: {e}, Fallback failed: {fallback_error}",
                    "session_id": session_id
                }
    
    async def _create_fallback_session(self, session: ComputerUseSession) -> Dict[str, Any]:
        """Create fallback session using GPT-5 for text-based assistance"""
        
        response = await self.client.chat.completions.create(
            model="gpt-5",
            messages=[{
                "role": "user",
                "content": f"""I need help with a computer task: {session.task_description}

I'm using GPT-5 in text-only mode since computer use preview isn't available.
Display: {session.display_width}x{session.display_height} ({session.environment})

Please provide step-by-step instructions for this task, or tell me what information you need to help better."""
            }],
            max_completion_tokens=2048,
            temperature=1.0
        )
        
        return {
            "success": True,
            "session_id": session.session_id,
            "mode": "text_fallback",
            "initial_response": {
                "content": response.choices[0].message.content,
                "model": "gpt-5"
            }
        }
    
    async def continue_session(
        self,
        session_id: str,
        user_input: Optional[str] = None,
        acknowledged_safety_checks: Optional[List[Dict]] = None
    ) -> Dict[str, Any]:
        """Continue an existing computer use session"""
        
        if session_id not in self.active_sessions:
            return {
                "success": False,
                "error": f"Session {session_id} not found"
            }
        
        session = self.active_sessions[session_id]
        
        if session.current_iteration >= session.max_iterations:
            return {
                "success": False,
                "error": "Maximum iterations reached",
                "session_id": session_id
            }
        
        try:
            # Take current screenshot
            screenshot_base64 = await self._take_screenshot()
            session.screenshots.append(screenshot_base64)
            
            # Prepare input for continuation
            input_data = [{
                "type": "computer_call_output",
                "call_id": "latest",  # This would be the actual call_id from previous response
                "output": {
                    "type": "computer_screenshot",
                    "image_url": f"data:image/png;base64,{screenshot_base64}"
                }
            }]
            
            # Add user input if provided
            if user_input:
                input_data.append({
                    "role": "user",
                    "content": [{
                        "type": "input_text",
                        "text": user_input
                    }]
                })
            
            # Add acknowledged safety checks if provided
            if acknowledged_safety_checks:
                input_data[0]["acknowledged_safety_checks"] = acknowledged_safety_checks
            
            response = await self.client.responses.create(
                model="computer-use-preview",
                tools=[{
                    "type": "computer_use_preview",
                    "display_width": session.display_width,
                    "display_height": session.display_height,
                    "environment": session.environment
                }],
                input=input_data,
                reasoning={"summary": "concise"},
                truncation="auto"
            )
            
            # Process response and execute actions
            processed_response = self._process_response(response)
            
            # Execute computer actions if any
            if "computer_calls" in processed_response:
                for computer_call in processed_response["computer_calls"]:
                    action = computer_call.get("action", {})
                    await self._execute_action(action, session)
            
            session.current_iteration += 1
            
            return {
                "success": True,
                "session_id": session_id,
                "iteration": session.current_iteration,
                "response": processed_response,
                "screenshot": screenshot_base64
            }
            
        except Exception as e:
            self.logger.error(f"Failed to continue session {session_id}: {e}")
            return {
                "success": False,
                "error": str(e),
                "session_id": session_id
            }
    
    def _process_response(self, response) -> Dict[str, Any]:
        """Process OpenAI response and extract computer calls"""
        
        processed = {
            "timestamp": datetime.now().isoformat(),
            "response_id": getattr(response, 'id', None)
        }
        
        computer_calls = []
        reasoning_items = []
        text_content = ""
        
        if hasattr(response, 'output') and response.output:
            for item in response.output:
                if item.type == "computer_call":
                    computer_calls.append({
                        "id": item.id,
                        "call_id": item.call_id,
                        "action": item.action,
                        "status": item.status,
                        "pending_safety_checks": getattr(item, 'pending_safety_checks', [])
                    })
                elif item.type == "reasoning":
                    reasoning_items.append({
                        "id": item.id,
                        "summary": item.summary
                    })
                elif item.type == "text":
                    text_content += getattr(item, 'text', '')
        
        processed.update({
            "computer_calls": computer_calls,
            "reasoning": reasoning_items,
            "content": text_content
        })
        
        return processed
    
    async def _execute_action(self, action: Dict[str, Any], session: ComputerUseSession):
        """Execute a computer action"""
        
        action_type = action.get("type")
        
        try:
            if action_type == "click":
                await self._execute_click(action)
            elif action_type == "scroll":
                await self._execute_scroll(action)
            elif action_type == "keypress":
                await self._execute_keypress(action)
            elif action_type == "type":
                await self._execute_type(action)
            elif action_type == "wait":
                await self._execute_wait(action)
            elif action_type == "screenshot":
                # Screenshot is automatically taken
                pass
            else:
                self.logger.warning(f"Unknown action type: {action_type}")
            
            # Record action
            computer_action = ComputerAction(
                type=action_type,
                x=action.get("x"),
                y=action.get("y"),
                button=action.get("button"),
                scroll_x=action.get("scroll_x"),
                scroll_y=action.get("scroll_y"),
                keys=action.get("keys"),
                text=action.get("text")
            )
            session.actions_taken.append(computer_action)
            
        except Exception as e:
            self.logger.error(f"Failed to execute action {action}: {e}")
    
    async def _execute_click(self, action: Dict[str, Any]):
        """Execute click action"""
        x, y = action.get("x", 0), action.get("y", 0)
        button = action.get("button", "left")
        
        button_map = {"left": 1, "middle": 2, "right": 3}
        button_num = button_map.get(button, 1)
        
        try:
            subprocess.run([
                "xdotool", "mousemove", str(x), str(y), "click", str(button_num)
            ], check=True, capture_output=True)
            self.logger.info(f"Clicked at ({x}, {y}) with {button} button")
        except subprocess.CalledProcessError as e:
            self.logger.error(f"Click failed: {e}")
    
    async def _execute_scroll(self, action: Dict[str, Any]):
        """Execute scroll action"""
        x, y = action.get("x", 0), action.get("y", 0)
        scroll_x = action.get("scroll_x", 0)
        scroll_y = action.get("scroll_y", 0)
        
        try:
            # Move to position
            subprocess.run([
                "xdotool", "mousemove", str(x), str(y)
            ], check=True, capture_output=True)
            
            # Scroll vertically
            if scroll_y != 0:
                button = 4 if scroll_y < 0 else 5  # 4 = scroll up, 5 = scroll down
                clicks = abs(scroll_y)
                for _ in range(min(clicks, 10)):  # Limit excessive scrolling
                    subprocess.run([
                        "xdotool", "click", str(button)
                    ], check=True, capture_output=True)
            
            self.logger.info(f"Scrolled at ({x}, {y}) by ({scroll_x}, {scroll_y})")
        except subprocess.CalledProcessError as e:
            self.logger.error(f"Scroll failed: {e}")
    
    async def _execute_keypress(self, action: Dict[str, Any]):
        """Execute keypress action"""
        keys = action.get("keys", [])
        
        for key in keys:
            try:
                # Map common keys
                key_map = {
                    "enter": "Return",
                    "space": "space",
                    "tab": "Tab",
                    "escape": "Escape",
                    "backspace": "BackSpace"
                }
                
                xdotool_key = key_map.get(key.lower(), key)
                
                subprocess.run([
                    "xdotool", "key", xdotool_key
                ], check=True, capture_output=True)
                
                self.logger.info(f"Pressed key: {key}")
            except subprocess.CalledProcessError as e:
                self.logger.error(f"Keypress failed for {key}: {e}")
    
    async def _execute_type(self, action: Dict[str, Any]):
        """Execute type action"""
        text = action.get("text", "")
        
        try:
            subprocess.run([
                "xdotool", "type", text
            ], check=True, capture_output=True)
            self.logger.info(f"Typed text: {text[:50]}...")
        except subprocess.CalledProcessError as e:
            self.logger.error(f"Type failed: {e}")
    
    async def _execute_wait(self, action: Dict[str, Any]):
        """Execute wait action"""
        duration = action.get("duration", 2)
        await asyncio.sleep(duration)
        self.logger.info(f"Waited for {duration} seconds")
    
    async def _take_screenshot(self) -> str:
        """Take screenshot and return base64 encoded image"""
        try:
            # Use ImageGrab if available (works in some environments)
            try:
                screenshot = ImageGrab.grab()
                # Resize to specified dimensions
                screenshot = screenshot.resize((self.display_width, self.display_height))
            except Exception:
                # Fallback to system screenshot using import (ImageMagick)
                temp_file = tempfile.mktemp(suffix='.png')
                
                try:
                    subprocess.run([
                        "import", "-window", "root", "-resize", 
                        f"{self.display_width}x{self.display_height}", temp_file
                    ], check=True, capture_output=True)
                    
                    screenshot = Image.open(temp_file)
                finally:
                    # Clean up temp file
                    if os.path.exists(temp_file):
                        os.remove(temp_file)
            
            # Convert to base64
            buffer = io.BytesIO()
            screenshot.save(buffer, format='PNG')
            screenshot_base64 = base64.b64encode(buffer.getvalue()).decode('utf-8')
            
            return screenshot_base64
            
        except Exception as e:
            self.logger.error(f"Screenshot failed: {e}")
            # Return a blank image as fallback
            blank_image = Image.new('RGB', (self.display_width, self.display_height), color='white')
            buffer = io.BytesIO()
            blank_image.save(buffer, format='PNG')
            return base64.b64encode(buffer.getvalue()).decode('utf-8')
    
    def get_session_info(self, session_id: str) -> Optional[Dict[str, Any]]:
        """Get session information"""
        if session_id not in self.active_sessions:
            return None
        
        session = self.active_sessions[session_id]
        
        return {
            "session_id": session.session_id,
            "user_id": session.user_id,
            "task_description": session.task_description,
            "status": session.status,
            "current_iteration": session.current_iteration,
            "max_iterations": session.max_iterations,
            "actions_taken": len(session.actions_taken),
            "created_at": session.created_at.isoformat()
        }
    
    def end_session(self, session_id: str) -> Dict[str, Any]:
        """End a computer use session"""
        if session_id not in self.active_sessions:
            return {
                "success": False,
                "error": f"Session {session_id} not found"
            }
        
        session = self.active_sessions[session_id]
        session.status = "completed"
        
        # Keep session for a while for potential retrieval
        # In production, you might want to persist this to database
        
        return {
            "success": True,
            "session_id": session_id,
            "iterations_completed": session.current_iteration,
            "actions_taken": len(session.actions_taken),
            "status": "completed"
        }
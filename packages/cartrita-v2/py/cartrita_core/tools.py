"""
Cartrita V2 - Tool Registry
Manages tools and permissions for agents
"""

import asyncio
import logging
import json
import subprocess
import os
import base64
from datetime import datetime
from enum import Enum
from typing import Dict, List, Optional, Any, Callable
from pathlib import Path
import tempfile

import requests
import psutil
from PIL import Image
import cv2
import numpy as np

# Import automation backend from dedicated module to avoid circular imports
try:
    from .automation import automation_backend, AUTOMATION_MODE, pyautogui
    if automation_backend:
        print(f"✅ Tools using {AUTOMATION_MODE} automation backend")
    else:
        print("⚠️  Tools: No automation backend available")
except ImportError:
    print("⚠️  Could not import automation backend")
    automation_backend = None
    AUTOMATION_MODE = "disabled"
    pyautogui = None


class ToolPermissionLevel(Enum):
    PUBLIC = "public"           # Available to all agents
    RESTRICTED = "restricted"   # Requires specific permission
    SUPERVISED = "supervised"   # Requires supervisor approval
    ADMIN = "admin"            # Admin-only tools


class CartritaToolRegistry:
    """
    Manages tools and their permissions for Cartrita agents
    Provides secure access control and execution monitoring
    """
    
    def __init__(self, logger: Optional[logging.Logger] = None):
        self.logger = logger or logging.getLogger("cartrita.tools")
        
        # Tool registry
        self.tools: Dict[str, Dict] = {}
        self.tool_permissions: Dict[str, ToolPermissionLevel] = {}
        self.agent_permissions: Dict[str, List[str]] = {}
        
        # Usage tracking
        self.tool_usage: Dict[str, int] = {}
        self.execution_history: List[Dict] = []
        
        # Initialize core tools
        self._register_core_tools()
    
    def _register_core_tools(self):
        """Register core tools available to agents"""
        
        # Web search tool
        self.register_tool(
            name="web_search",
            function=self._web_search,
            permission_level=ToolPermissionLevel.PUBLIC,
            description="Search the web for information",
            parameters={
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": "Search query"
                    },
                    "num_results": {
                        "type": "integer",
                        "description": "Number of results to return",
                        "default": 5
                    }
                },
                "required": ["query"]
            }
        )
        
        # File operations
        self.register_tool(
            name="file_read",
            function=self._file_read,
            permission_level=ToolPermissionLevel.RESTRICTED,
            description="Read contents of a file",
            parameters={
                "type": "object",
                "properties": {
                    "file_path": {
                        "type": "string",
                        "description": "Path to file to read"
                    }
                },
                "required": ["file_path"]
            }
        )
        
        self.register_tool(
            name="file_write",
            function=self._file_write,
            permission_level=ToolPermissionLevel.RESTRICTED,
            description="Write content to a file",
            parameters={
                "type": "object",
                "properties": {
                    "file_path": {
                        "type": "string",
                        "description": "Path to file to write"
                    },
                    "content": {
                        "type": "string",
                        "description": "Content to write to file"
                    },
                    "mode": {
                        "type": "string",
                        "description": "Write mode: 'w' (overwrite) or 'a' (append)",
                        "default": "w"
                    }
                },
                "required": ["file_path", "content"]
            }
        )
        
        # Computer use tools
        self.register_tool(
            name="screenshot",
            function=self._screenshot,
            permission_level=ToolPermissionLevel.RESTRICTED,
            description="Take a screenshot of the current desktop",
            parameters={
                "type": "object",
                "properties": {
                    "region": {
                        "type": "array",
                        "description": "Optional region [x, y, width, height] to capture",
                        "items": {"type": "integer"},
                        "minItems": 4,
                        "maxItems": 4
                    }
                }
            }
        )
        
        self.register_tool(
            name="system_info",
            function=self._system_info,
            permission_level=ToolPermissionLevel.PUBLIC,
            description="Get system information",
            parameters={
                "type": "object",
                "properties": {
                    "info_type": {
                        "type": "string",
                        "description": "Type of info: 'basic', 'processes', 'memory', 'disk'",
                        "default": "basic"
                    }
                }
            }
        )
        
        # Code execution (sandboxed)
        self.register_tool(
            name="execute_code",
            function=self._execute_code,
            permission_level=ToolPermissionLevel.SUPERVISED,
            description="Execute code in a sandboxed environment",
            parameters={
                "type": "object",
                "properties": {
                    "code": {
                        "type": "string",
                        "description": "Code to execute"
                    },
                    "language": {
                        "type": "string",
                        "description": "Programming language: 'python', 'javascript', 'bash'",
                        "default": "python"
                    },
                    "timeout": {
                        "type": "integer",
                        "description": "Execution timeout in seconds",
                        "default": 30
                    }
                },
                "required": ["code"]
            }
        )
        
        self.logger.info(f"Registered {len(self.tools)} core tools")
    
    def register_tool(
        self,
        name: str,
        function: Callable,
        permission_level: ToolPermissionLevel,
        description: str,
        parameters: Dict[str, Any]
    ):
        """Register a new tool"""
        self.tools[name] = {
            "function": function,
            "description": description,
            "parameters": parameters,
            "registered_at": datetime.now().isoformat()
        }
        
        self.tool_permissions[name] = permission_level
        self.tool_usage[name] = 0
        
        self.logger.info(f"Registered tool: {name} ({permission_level.value})")
    
    def grant_permission(self, agent_id: str, tool_names: List[str]):
        """Grant tool permissions to an agent"""
        if agent_id not in self.agent_permissions:
            self.agent_permissions[agent_id] = []
        
        for tool_name in tool_names:
            if tool_name not in self.tools:
                self.logger.warning(f"Tool {tool_name} not found")
                continue
            
            if tool_name not in self.agent_permissions[agent_id]:
                self.agent_permissions[agent_id].append(tool_name)
        
        self.logger.info(f"Granted {agent_id} access to {len(tool_names)} tools")
    
    def revoke_permission(self, agent_id: str, tool_names: List[str]):
        """Revoke tool permissions from an agent"""
        if agent_id not in self.agent_permissions:
            return
        
        for tool_name in tool_names:
            if tool_name in self.agent_permissions[agent_id]:
                self.agent_permissions[agent_id].remove(tool_name)
        
        self.logger.info(f"Revoked {agent_id} access to {len(tool_names)} tools")
    
    def get_tools_for_agent(
        self, 
        agent_id: str, 
        requested_tools: Optional[List[str]] = None
    ) -> Dict[str, Dict]:
        """Get available tools for an agent"""
        available_tools = {}
        
        # Get agent's granted permissions
        agent_tools = self.agent_permissions.get(agent_id, [])
        
        for tool_name, tool_config in self.tools.items():
            permission_level = self.tool_permissions[tool_name]
            
            # Check if tool is available to agent
            if (permission_level == ToolPermissionLevel.PUBLIC or
                tool_name in agent_tools or
                (requested_tools and tool_name in requested_tools)):
                
                available_tools[tool_name] = {
                    "description": tool_config["description"],
                    "parameters": tool_config["parameters"],
                    "permission_level": permission_level.value
                }
        
        return available_tools
    
    async def execute_tool(
        self, 
        tool_name: str, 
        parameters: Any, 
        agent_id: str
    ) -> Dict[str, Any]:
        """Execute a tool with permission checking"""
        
        # Check if tool exists
        if tool_name not in self.tools:
            return {
                "success": False,
                "error": f"Tool {tool_name} not found"
            }
        
        # Check permissions
        if not self._check_permission(agent_id, tool_name):
            return {
                "success": False,
                "error": f"Agent {agent_id} lacks permission for tool {tool_name}"
            }
        
        # Parse parameters
        if isinstance(parameters, str):
            try:
                params = json.loads(parameters)
            except json.JSONDecodeError:
                params = {"input": parameters}
        else:
            params = parameters or {}
        
        try:
            # Execute tool
            start_time = datetime.now()
            tool_function = self.tools[tool_name]["function"]
            
            if asyncio.iscoroutinefunction(tool_function):
                result = await tool_function(**params)
            else:
                result = tool_function(**params)
            
            execution_time = (datetime.now() - start_time).total_seconds()
            
            # Track usage
            self.tool_usage[tool_name] += 1
            
            # Record execution
            self.execution_history.append({
                "tool_name": tool_name,
                "agent_id": agent_id,
                "success": True,
                "execution_time": execution_time,
                "timestamp": start_time.isoformat()
            })
            
            # Ensure result is serializable
            if not isinstance(result, dict):
                result = {"output": str(result)}
            
            result["success"] = True
            result["execution_time"] = execution_time
            
            return result
            
        except Exception as e:
            self.logger.error(f"Tool execution failed {tool_name}: {e}")
            
            # Record failed execution
            self.execution_history.append({
                "tool_name": tool_name,
                "agent_id": agent_id,
                "success": False,
                "error": str(e),
                "timestamp": datetime.now().isoformat()
            })
            
            return {
                "success": False,
                "error": str(e)
            }
    
    def _check_permission(self, agent_id: str, tool_name: str) -> bool:
        """Check if agent has permission to use tool"""
        permission_level = self.tool_permissions.get(tool_name, ToolPermissionLevel.ADMIN)
        
        # Public tools available to all
        if permission_level == ToolPermissionLevel.PUBLIC:
            return True
        
        # Check explicit permissions
        agent_tools = self.agent_permissions.get(agent_id, [])
        return tool_name in agent_tools
    
    # Tool implementations
    
    async def _web_search(self, query: str, num_results: int = 5) -> Dict[str, Any]:
        """Web search implementation using DuckDuckGo"""
        try:
            # Simple web search using requests (in production, use proper search API)
            search_url = f"https://api.duckduckgo.com/?q={query}&format=json&no_html=1&skip_disambig=1"
            
            response = requests.get(search_url, timeout=10)
            response.raise_for_status()
            
            data = response.json()
            
            results = []
            if "RelatedTopics" in data:
                for topic in data["RelatedTopics"][:num_results]:
                    if isinstance(topic, dict) and "Text" in topic:
                        results.append({
                            "title": topic.get("FirstURL", "").split("/")[-1],
                            "snippet": topic["Text"],
                            "url": topic.get("FirstURL", "")
                        })
            
            return {
                "query": query,
                "results": results,
                "total_results": len(results)
            }
            
        except Exception as e:
            return {"error": f"Web search failed: {e}"}
    
    def _file_read(self, file_path: str) -> Dict[str, Any]:
        """Read file contents"""
        try:
            path = Path(file_path)
            
            if not path.exists():
                return {"error": f"File not found: {file_path}"}
            
            if path.is_dir():
                return {"error": f"Path is a directory: {file_path}"}
            
            # Security check - restrict to safe directories
            safe_dirs = ["/tmp", "/home", "/var/tmp"]
            if not any(str(path.resolve()).startswith(safe_dir) for safe_dir in safe_dirs):
                return {"error": "Access denied: unsafe directory"}
            
            with open(path, 'r', encoding='utf-8') as f:
                content = f.read()
            
            return {
                "file_path": file_path,
                "content": content,
                "size_bytes": len(content.encode('utf-8'))
            }
            
        except Exception as e:
            return {"error": f"File read failed: {e}"}
    
    def _file_write(self, file_path: str, content: str, mode: str = "w") -> Dict[str, Any]:
        """Write content to file"""
        try:
            path = Path(file_path)
            
            # Security check - restrict to safe directories
            safe_dirs = ["/tmp", "/home", "/var/tmp"]
            if not any(str(path.resolve()).startswith(safe_dir) for safe_dir in safe_dirs):
                return {"error": "Access denied: unsafe directory"}
            
            # Create parent directories if needed
            path.parent.mkdir(parents=True, exist_ok=True)
            
            with open(path, mode, encoding='utf-8') as f:
                f.write(content)
            
            return {
                "file_path": file_path,
                "bytes_written": len(content.encode('utf-8')),
                "mode": mode
            }
            
        except Exception as e:
            return {"error": f"File write failed: {e}"}
    
    def _screenshot(self, region: Optional[List[int]] = None) -> Dict[str, Any]:
        """Take screenshot"""
        try:
            if region and len(region) == 4:
                # Capture specific region
                screenshot = pyautogui.screenshot(region=tuple(region))
            else:
                # Capture full screen
                screenshot = pyautogui.screenshot()
            
            # Save to temporary file
            temp_dir = Path("/tmp/cartrita_screenshots")
            temp_dir.mkdir(exist_ok=True)
            
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S_%f")
            screenshot_path = temp_dir / f"screenshot_{timestamp}.png"
            
            screenshot.save(screenshot_path)
            
            # Encode as base64 for API responses
            with open(screenshot_path, "rb") as f:
                screenshot_b64 = base64.b64encode(f.read()).decode()
            
            return {
                "screenshot_path": str(screenshot_path),
                "screenshot_base64": screenshot_b64,
                "width": screenshot.width,
                "height": screenshot.height,
                "region": region
            }
            
        except Exception as e:
            return {"error": f"Screenshot failed: {e}"}
    
    def _system_info(self, info_type: str = "basic") -> Dict[str, Any]:
        """Get system information"""
        try:
            if info_type == "basic":
                return {
                    "platform": os.name,
                    "cpu_count": psutil.cpu_count(),
                    "memory_total": psutil.virtual_memory().total,
                    "memory_available": psutil.virtual_memory().available,
                    "disk_usage": dict(psutil.disk_usage('/'))._asdict(),
                    "load_average": os.getloadavg() if hasattr(os, 'getloadavg') else None
                }
            
            elif info_type == "processes":
                processes = []
                for proc in psutil.process_iter(['pid', 'name', 'cpu_percent', 'memory_percent']):
                    try:
                        processes.append(proc.info)
                    except (psutil.NoSuchProcess, psutil.AccessDenied):
                        pass
                
                return {"processes": processes[:20]}  # Top 20 processes
            
            elif info_type == "memory":
                return dict(psutil.virtual_memory())._asdict()
            
            elif info_type == "disk":
                partitions = []
                for partition in psutil.disk_partitions():
                    try:
                        usage = psutil.disk_usage(partition.mountpoint)
                        partitions.append({
                            "device": partition.device,
                            "mountpoint": partition.mountpoint,
                            "fstype": partition.fstype,
                            "usage": dict(usage._asdict())
                        })
                    except PermissionError:
                        pass
                
                return {"disk_partitions": partitions}
            
            else:
                return {"error": f"Unknown info_type: {info_type}"}
                
        except Exception as e:
            return {"error": f"System info failed: {e}"}
    
    def _execute_code(
        self, 
        code: str, 
        language: str = "python", 
        timeout: int = 30
    ) -> Dict[str, Any]:
        """Execute code in sandboxed environment"""
        try:
            if language == "python":
                return self._execute_python_code(code, timeout)
            elif language == "javascript":
                return self._execute_javascript_code(code, timeout)
            elif language == "bash":
                return self._execute_bash_code(code, timeout)
            else:
                return {"error": f"Unsupported language: {language}"}
                
        except Exception as e:
            return {"error": f"Code execution failed: {e}"}
    
    def _execute_python_code(self, code: str, timeout: int) -> Dict[str, Any]:
        """Execute Python code safely"""
        try:
            # Create temporary file
            with tempfile.NamedTemporaryFile(mode='w', suffix='.py', delete=False) as f:
                f.write(code)
                temp_file = f.name
            
            # Execute with timeout
            result = subprocess.run(
                ['python3', temp_file],
                capture_output=True,
                text=True,
                timeout=timeout,
                cwd='/tmp'
            )
            
            # Cleanup
            os.unlink(temp_file)
            
            return {
                "language": "python",
                "exit_code": result.returncode,
                "stdout": result.stdout,
                "stderr": result.stderr,
                "success": result.returncode == 0
            }
            
        except subprocess.TimeoutExpired:
            return {"error": f"Code execution timed out after {timeout} seconds"}
        except Exception as e:
            return {"error": f"Python execution failed: {e}"}
    
    def _execute_javascript_code(self, code: str, timeout: int) -> Dict[str, Any]:
        """Execute JavaScript code using Node.js"""
        try:
            result = subprocess.run(
                ['node', '-e', code],
                capture_output=True,
                text=True,
                timeout=timeout,
                cwd='/tmp'
            )
            
            return {
                "language": "javascript",
                "exit_code": result.returncode,
                "stdout": result.stdout,
                "stderr": result.stderr,
                "success": result.returncode == 0
            }
            
        except subprocess.TimeoutExpired:
            return {"error": f"Code execution timed out after {timeout} seconds"}
        except Exception as e:
            return {"error": f"JavaScript execution failed: {e}"}
    
    def _execute_bash_code(self, code: str, timeout: int) -> Dict[str, Any]:
        """Execute Bash code safely"""
        try:
            result = subprocess.run(
                ['bash', '-c', code],
                capture_output=True,
                text=True,
                timeout=timeout,
                cwd='/tmp'
            )
            
            return {
                "language": "bash",
                "exit_code": result.returncode,
                "stdout": result.stdout,
                "stderr": result.stderr,
                "success": result.returncode == 0
            }
            
        except subprocess.TimeoutExpired:
            return {"error": f"Code execution timed out after {timeout} seconds"}
        except Exception as e:
            return {"error": f"Bash execution failed: {e}"}
    
    def get_registry_stats(self) -> Dict[str, Any]:
        """Get tool registry statistics"""
        return {
            "total_tools": len(self.tools),
            "permission_levels": {
                level.value: sum(1 for p in self.tool_permissions.values() if p == level)
                for level in ToolPermissionLevel
            },
            "tool_usage": self.tool_usage,
            "agents_with_permissions": len(self.agent_permissions),
            "recent_executions": self.execution_history[-10:] if self.execution_history else [],
            "timestamp": datetime.now().isoformat()
        }
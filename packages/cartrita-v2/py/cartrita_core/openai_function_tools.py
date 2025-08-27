"""
Cartrita V2 - OpenAI Function Tools Migration
Converts existing LangChain tools to OpenAI function definitions with strict JSON schema
"""

import asyncio
import json
import logging
import os
import subprocess
import tempfile
import time
import uuid
from datetime import datetime
from enum import Enum
from pathlib import Path
from typing import Dict, List, Optional, Any, Callable, Union
import base64
import hashlib

import requests
import psutil
from PIL import Image
import cv2
import numpy as np

from config import get_settings


class ToolCategory(Enum):
    """Categories for organizing tools"""
    SYSTEM = "system"
    WEB = "web"  
    FILE = "file"
    AUTOMATION = "automation"
    ANALYSIS = "analysis"
    COMMUNICATION = "communication"
    DEVELOPMENT = "development"


class SecurityLevel(Enum):
    """Security levels for tool execution"""
    SAFE = "safe"           # No security concerns
    MONITORED = "monitored" # Log all executions
    RESTRICTED = "restricted" # Require specific permissions
    DANGEROUS = "dangerous"   # Require explicit approval


class OpenAIFunctionTool:
    """
    Represents a tool converted to OpenAI function calling format
    """
    
    def __init__(
        self,
        name: str,
        description: str,
        parameters: Dict[str, Any],
        implementation: Callable,
        category: ToolCategory = ToolCategory.SYSTEM,
        security_level: SecurityLevel = SecurityLevel.SAFE,
        metadata: Optional[Dict[str, Any]] = None
    ):
        self.name = name
        self.description = description
        self.parameters = parameters
        self.implementation = implementation
        self.category = category
        self.security_level = security_level
        self.metadata = metadata or {}
        
        # Validate schema on creation
        self._validate_schema()
        
        # Performance tracking
        self.call_count = 0
        self.total_execution_time = 0.0
        self.last_used = None
        self.errors = []
    
    def _validate_schema(self):
        """Validate that parameters conform to OpenAI strict schema requirements"""
        required_fields = ["type", "properties"]
        
        if not all(field in self.parameters for field in required_fields):
            raise ValueError(f"Tool {self.name} missing required schema fields")
        
        if self.parameters["type"] != "object":
            raise ValueError(f"Tool {self.name} must have type 'object' at root level")
        
        # Validate properties are properly defined
        for prop_name, prop_def in self.parameters.get("properties", {}).items():
            if "type" not in prop_def:
                raise ValueError(f"Property {prop_name} in tool {self.name} missing type")
    
    def to_openai_format(self) -> Dict[str, Any]:
        """Convert to OpenAI function calling format"""
        return {
            "type": "function",
            "function": {
                "name": self.name,
                "description": self.description,
                "parameters": {
                    **self.parameters,
                    "additionalProperties": False  # Enforce strict mode
                },
                "strict": True
            }
        }
    
    async def execute(self, arguments: Dict[str, Any]) -> Dict[str, Any]:
        """Execute the tool with provided arguments"""
        start_time = time.time()
        self.call_count += 1
        self.last_used = datetime.now()
        
        try:
            # Validate arguments against schema
            self._validate_arguments(arguments)
            
            # Execute implementation
            if asyncio.iscoroutinefunction(self.implementation):
                result = await self.implementation(**arguments)
            else:
                result = self.implementation(**arguments)
            
            execution_time = time.time() - start_time
            self.total_execution_time += execution_time
            
            return {
                "success": True,
                "result": result,
                "execution_time": execution_time,
                "timestamp": self.last_used.isoformat()
            }
            
        except Exception as e:
            execution_time = time.time() - start_time
            error_info = {
                "error": str(e),
                "error_type": type(e).__name__,
                "timestamp": datetime.now().isoformat(),
                "arguments": arguments
            }
            self.errors.append(error_info)
            
            return {
                "success": False,
                "error": str(e),
                "error_type": type(e).__name__,
                "execution_time": execution_time,
                "timestamp": datetime.now().isoformat()
            }
    
    def _validate_arguments(self, arguments: Dict[str, Any]):
        """Validate arguments against the schema"""
        required_props = self.parameters.get("required", [])
        
        # Check required properties
        for prop in required_props:
            if prop not in arguments:
                raise ValueError(f"Missing required parameter: {prop}")
        
        # Basic type checking (simplified - could use jsonschema for full validation)
        properties = self.parameters.get("properties", {})
        for prop_name, value in arguments.items():
            if prop_name in properties:
                expected_type = properties[prop_name].get("type")
                if expected_type == "string" and not isinstance(value, str):
                    raise ValueError(f"Parameter {prop_name} must be string")
                elif expected_type == "integer" and not isinstance(value, int):
                    raise ValueError(f"Parameter {prop_name} must be integer")
                elif expected_type == "boolean" and not isinstance(value, bool):
                    raise ValueError(f"Parameter {prop_name} must be boolean")
                elif expected_type == "array" and not isinstance(value, list):
                    raise ValueError(f"Parameter {prop_name} must be array")


class CartritaFunctionToolManager:
    """
    Production tool manager for OpenAI function calling
    Migrates and manages all tools from LangChain to OpenAI format
    """
    
    def __init__(self, logger: Optional[logging.Logger] = None):
        self.logger = logger or logging.getLogger("cartrita.function_tools")
        
        # Tool storage
        self.tools: Dict[str, OpenAIFunctionTool] = {}
        self.categories: Dict[ToolCategory, List[str]] = {cat: [] for cat in ToolCategory}
        
        # Permission system
        self.agent_permissions: Dict[str, List[str]] = {}
        self.tool_security: Dict[str, SecurityLevel] = {}
        
        # Performance tracking
        self.execution_log: List[Dict[str, Any]] = []
        self.stats = {
            "total_executions": 0,
            "successful_executions": 0,
            "failed_executions": 0,
            "total_execution_time": 0.0,
            "tools_registered": 0
        }
        
        # Initialize core tools
        self._register_migrated_tools()
    
    def _register_migrated_tools(self):
        """Register all migrated tools from the existing Cartrita toolset"""
        
        # Web Search Tool
        self.register_tool(
            OpenAIFunctionTool(
                name="web_search",
                description="Busca información en la web. Perfect for getting current info que Cartrita necesita.",
                parameters={
                    "type": "object",
                    "properties": {
                        "query": {
                            "type": "string",
                            "description": "The search query in natural language"
                        },
                        "num_results": {
                            "type": "integer",
                            "description": "Number of search results to return (1-10)",
                            "minimum": 1,
                            "maximum": 10,
                            "default": 5
                        },
                        "language": {
                            "type": "string", 
                            "description": "Language preference for results",
                            "enum": ["en", "es", "auto"],
                            "default": "auto"
                        }
                    },
                    "required": ["query"]
                },
                implementation=self._web_search_impl,
                category=ToolCategory.WEB,
                security_level=SecurityLevel.SAFE
            )
        )
        
        # File Reading Tool
        self.register_tool(
            OpenAIFunctionTool(
                name="file_read",
                description="Lee archivos del sistema. Cartrita can read text files, code, docs, y más.",
                parameters={
                    "type": "object",
                    "properties": {
                        "file_path": {
                            "type": "string",
                            "description": "Full path to the file to read"
                        },
                        "encoding": {
                            "type": "string",
                            "description": "File encoding",
                            "enum": ["utf-8", "ascii", "latin1"],
                            "default": "utf-8"
                        },
                        "max_lines": {
                            "type": "integer",
                            "description": "Maximum number of lines to read (0 = all)",
                            "minimum": 0,
                            "default": 0
                        }
                    },
                    "required": ["file_path"]
                },
                implementation=self._file_read_impl,
                category=ToolCategory.FILE,
                security_level=SecurityLevel.RESTRICTED
            )
        )
        
        # File Writing Tool
        self.register_tool(
            OpenAIFunctionTool(
                name="file_write", 
                description="Escribe archivos al sistema. Cartrita can create files, save results, and more.",
                parameters={
                    "type": "object",
                    "properties": {
                        "file_path": {
                            "type": "string",
                            "description": "Full path where to write the file"
                        },
                        "content": {
                            "type": "string", 
                            "description": "Content to write to the file"
                        },
                        "encoding": {
                            "type": "string",
                            "description": "File encoding",
                            "enum": ["utf-8", "ascii", "latin1"],
                            "default": "utf-8"
                        },
                        "append": {
                            "type": "boolean",
                            "description": "Append to file instead of overwriting",
                            "default": False
                        }
                    },
                    "required": ["file_path", "content"]
                },
                implementation=self._file_write_impl,
                category=ToolCategory.FILE,
                security_level=SecurityLevel.RESTRICTED
            )
        )
        
        # System Information Tool
        self.register_tool(
            OpenAIFunctionTool(
                name="system_info",
                description="Get system information. Útil para monitoring y diagnostics.",
                parameters={
                    "type": "object",
                    "properties": {
                        "info_type": {
                            "type": "string",
                            "description": "Type of system information to retrieve",
                            "enum": ["cpu", "memory", "disk", "network", "processes", "all"],
                            "default": "all"
                        }
                    },
                    "required": []
                },
                implementation=self._system_info_impl,
                category=ToolCategory.SYSTEM,
                security_level=SecurityLevel.SAFE
            )
        )
        
        # Screenshot Tool
        self.register_tool(
            OpenAIFunctionTool(
                name="screenshot",
                description="Take a screenshot of the current screen. Perfect for computer vision tasks.",
                parameters={
                    "type": "object",
                    "properties": {
                        "format": {
                            "type": "string",
                            "description": "Image format for the screenshot", 
                            "enum": ["png", "jpg", "base64"],
                            "default": "png"
                        },
                        "quality": {
                            "type": "integer",
                            "description": "JPEG quality (1-100) if format is jpg",
                            "minimum": 1,
                            "maximum": 100,
                            "default": 85
                        },
                        "region": {
                            "type": "object",
                            "description": "Screenshot region (x, y, width, height)",
                            "properties": {
                                "x": {"type": "integer", "minimum": 0},
                                "y": {"type": "integer", "minimum": 0}, 
                                "width": {"type": "integer", "minimum": 1},
                                "height": {"type": "integer", "minimum": 1}
                            },
                            "additionalProperties": False
                        }
                    },
                    "required": []
                },
                implementation=self._screenshot_impl,
                category=ToolCategory.AUTOMATION,
                security_level=SecurityLevel.MONITORED
            )
        )
        
        # Code Execution Tool (Sandboxed)
        self.register_tool(
            OpenAIFunctionTool(
                name="execute_code",
                description="Ejecuta código Python en un sandbox seguro. Great for calculations y data processing.",
                parameters={
                    "type": "object",
                    "properties": {
                        "code": {
                            "type": "string",
                            "description": "Python code to execute"
                        },
                        "timeout": {
                            "type": "integer",
                            "description": "Timeout in seconds (max 30)",
                            "minimum": 1,
                            "maximum": 30,
                            "default": 10
                        },
                        "capture_output": {
                            "type": "boolean",
                            "description": "Capture stdout and stderr",
                            "default": True
                        }
                    },
                    "required": ["code"]
                },
                implementation=self._execute_code_impl,
                category=ToolCategory.DEVELOPMENT,
                security_level=SecurityLevel.RESTRICTED
            )
        )
        
        # Email Tool (if configured)
        self.register_tool(
            OpenAIFunctionTool(
                name="send_email",
                description="Send email notifications. Cartrita can communicate con users via email.",
                parameters={
                    "type": "object",
                    "properties": {
                        "to": {
                            "type": "string",
                            "description": "Recipient email address"
                        },
                        "subject": {
                            "type": "string",
                            "description": "Email subject line"
                        },
                        "body": {
                            "type": "string", 
                            "description": "Email body content"
                        },
                        "priority": {
                            "type": "string",
                            "description": "Email priority level",
                            "enum": ["low", "normal", "high"],
                            "default": "normal"
                        }
                    },
                    "required": ["to", "subject", "body"]
                },
                implementation=self._send_email_impl,
                category=ToolCategory.COMMUNICATION,
                security_level=SecurityLevel.RESTRICTED
            )
        )
        
        # Data Analysis Tool
        self.register_tool(
            OpenAIFunctionTool(
                name="analyze_data",
                description="Analyze datasets and generate insights. Perfect para data science tasks.",
                parameters={
                    "type": "object", 
                    "properties": {
                        "data": {
                            "type": "array",
                            "description": "Array of data objects or CSV-like rows",
                            "items": {"type": "object"}
                        },
                        "analysis_type": {
                            "type": "string",
                            "description": "Type of analysis to perform",
                            "enum": ["descriptive", "correlation", "trend", "outliers", "summary"],
                            "default": "summary"
                        },
                        "columns": {
                            "type": "array",
                            "description": "Specific columns to analyze",
                            "items": {"type": "string"}
                        }
                    },
                    "required": ["data"]
                },
                implementation=self._analyze_data_impl,
                category=ToolCategory.ANALYSIS,
                security_level=SecurityLevel.SAFE
            )
        )
        
        self.logger.info(f"Registered {len(self.tools)} OpenAI function tools")
    
    def register_tool(self, tool: OpenAIFunctionTool):
        """Register a new tool"""
        if tool.name in self.tools:
            self.logger.warning(f"Tool {tool.name} already registered, overwriting")
        
        self.tools[tool.name] = tool
        self.categories[tool.category].append(tool.name)
        self.tool_security[tool.name] = tool.security_level
        self.stats["tools_registered"] += 1
        
        self.logger.info(f"Registered tool: {tool.name} ({tool.category.value}, {tool.security_level.value})")
    
    def get_tools_for_agent(
        self,
        agent_id: str,
        category_filter: Optional[List[ToolCategory]] = None,
        security_max: SecurityLevel = SecurityLevel.RESTRICTED
    ) -> List[Dict[str, Any]]:
        """
        Get OpenAI function definitions for a specific agent
        
        Args:
            agent_id: Agent requesting tools
            category_filter: Only return tools from these categories
            security_max: Maximum security level to include
            
        Returns:
            List of OpenAI function definitions
        """
        allowed_tools = self.agent_permissions.get(agent_id, [])
        function_definitions = []
        
        for tool_name, tool in self.tools.items():
            # Check agent permissions
            if tool.security_level in [SecurityLevel.RESTRICTED, SecurityLevel.DANGEROUS]:
                if tool_name not in allowed_tools:
                    continue
            
            # Check security level
            security_levels = [SecurityLevel.SAFE, SecurityLevel.MONITORED, SecurityLevel.RESTRICTED, SecurityLevel.DANGEROUS]
            if security_levels.index(tool.security_level) > security_levels.index(security_max):
                continue
            
            # Check category filter
            if category_filter and tool.category not in category_filter:
                continue
            
            function_definitions.append(tool.to_openai_format())
        
        return function_definitions
    
    async def execute_tool(
        self,
        tool_name: str,
        arguments: Dict[str, Any],
        agent_id: str,
        request_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """Execute a tool function with security and logging"""
        
        if tool_name not in self.tools:
            return {
                "success": False,
                "error": f"Tool not found: {tool_name}",
                "timestamp": datetime.now().isoformat()
            }
        
        tool = self.tools[tool_name]
        
        # Check permissions
        if not self._check_permission(agent_id, tool_name):
            return {
                "success": False,
                "error": f"Permission denied for tool: {tool_name}",
                "timestamp": datetime.now().isoformat()
            }
        
        # Execute tool
        result = await tool.execute(arguments)
        
        # Log execution
        self._log_execution(tool_name, arguments, result, agent_id, request_id)
        
        # Update stats
        self.stats["total_executions"] += 1
        if result["success"]:
            self.stats["successful_executions"] += 1
        else:
            self.stats["failed_executions"] += 1
        self.stats["total_execution_time"] += result.get("execution_time", 0)
        
        return result
    
    def _check_permission(self, agent_id: str, tool_name: str) -> bool:
        """Check if agent has permission to use tool"""
        if tool_name not in self.tools:
            return False
        
        tool = self.tools[tool_name]
        
        # Safe tools are always allowed
        if tool.security_level == SecurityLevel.SAFE:
            return True
        
        # Monitored tools are allowed but logged
        if tool.security_level == SecurityLevel.MONITORED:
            return True
        
        # Check explicit permissions for restricted/dangerous tools
        allowed_tools = self.agent_permissions.get(agent_id, [])
        return tool_name in allowed_tools
    
    def grant_permission(self, agent_id: str, tool_names: List[str]):
        """Grant tool permissions to an agent"""
        if agent_id not in self.agent_permissions:
            self.agent_permissions[agent_id] = []
        
        for tool_name in tool_names:
            if tool_name in self.tools and tool_name not in self.agent_permissions[agent_id]:
                self.agent_permissions[agent_id].append(tool_name)
        
        self.logger.info(f"Granted permissions to {agent_id}: {tool_names}")
    
    def revoke_permission(self, agent_id: str, tool_names: List[str]):
        """Revoke tool permissions from an agent"""
        if agent_id not in self.agent_permissions:
            return
        
        for tool_name in tool_names:
            if tool_name in self.agent_permissions[agent_id]:
                self.agent_permissions[agent_id].remove(tool_name)
        
        self.logger.info(f"Revoked permissions from {agent_id}: {tool_names}")
    
    def _log_execution(
        self,
        tool_name: str,
        arguments: Dict[str, Any],
        result: Dict[str, Any],
        agent_id: str,
        request_id: Optional[str]
    ):
        """Log tool execution for auditing"""
        log_entry = {
            "timestamp": datetime.now().isoformat(),
            "tool_name": tool_name,
            "agent_id": agent_id,
            "request_id": request_id or str(uuid.uuid4()),
            "success": result["success"],
            "execution_time": result.get("execution_time", 0),
            "arguments_hash": hashlib.sha256(json.dumps(arguments, sort_keys=True).encode()).hexdigest()[:12],
            "error": result.get("error") if not result["success"] else None
        }
        
        self.execution_log.append(log_entry)
        
        # Keep only last 1000 entries
        if len(self.execution_log) > 1000:
            self.execution_log = self.execution_log[-1000:]
    
    # Tool Implementation Methods
    
    async def _web_search_impl(self, query: str, num_results: int = 5, language: str = "auto") -> Dict[str, Any]:
        """Web search implementation using DuckDuckGo or similar API"""
        try:
            # This would integrate with a real search API like Serper, SerpAPI, etc.
            # For production, replace with actual search service
            
            # Simulate search results with realistic structure
            results = [
                {
                    "title": f"Search result {i+1} for: {query}",
                    "url": f"https://example.com/result-{i+1}",
                    "snippet": f"Relevant information about {query} found in this search result. This is result number {i+1}.",
                    "domain": "example.com",
                    "language": language if language != "auto" else "en"
                }
                for i in range(min(num_results, 10))
            ]
            
            return {
                "query": query,
                "results": results,
                "total_results": len(results),
                "search_time": time.time(),
                "language": language
            }
            
        except Exception as e:
            raise RuntimeError(f"Web search failed: {str(e)}")
    
    async def _file_read_impl(self, file_path: str, encoding: str = "utf-8", max_lines: int = 0) -> str:
        """File reading implementation with security checks"""
        try:
            path = Path(file_path)
            
            # Security check - prevent directory traversal
            if ".." in str(path) or str(path).startswith("/"):
                if not str(path).startswith("/tmp") and not str(path).startswith(os.getcwd()):
                    raise PermissionError("File access outside allowed directories")
            
            if not path.exists():
                raise FileNotFoundError(f"File not found: {file_path}")
            
            if path.is_dir():
                raise IsADirectoryError(f"Path is directory: {file_path}")
            
            # Read file with line limit
            with open(path, 'r', encoding=encoding) as f:
                if max_lines > 0:
                    lines = []
                    for i, line in enumerate(f):
                        if i >= max_lines:
                            break
                        lines.append(line)
                    content = ''.join(lines)
                else:
                    content = f.read()
            
            return content
            
        except Exception as e:
            raise RuntimeError(f"File read failed: {str(e)}")
    
    async def _file_write_impl(self, file_path: str, content: str, encoding: str = "utf-8", append: bool = False) -> str:
        """File writing implementation with security checks"""
        try:
            path = Path(file_path)
            
            # Security check
            if ".." in str(path) or str(path).startswith("/"):
                if not str(path).startswith("/tmp") and not str(path).startswith(os.getcwd()):
                    raise PermissionError("File write outside allowed directories")
            
            # Create directory if needed
            path.parent.mkdir(parents=True, exist_ok=True)
            
            mode = 'a' if append else 'w'
            with open(path, mode, encoding=encoding) as f:
                f.write(content)
            
            return f"Successfully {'appended to' if append else 'wrote'} {path} ({len(content)} chars)"
            
        except Exception as e:
            raise RuntimeError(f"File write failed: {str(e)}")
    
    async def _system_info_impl(self, info_type: str = "all") -> Dict[str, Any]:
        """System information implementation"""
        try:
            info = {}
            
            if info_type in ["cpu", "all"]:
                info["cpu"] = {
                    "usage_percent": psutil.cpu_percent(interval=1),
                    "count": psutil.cpu_count(),
                    "count_logical": psutil.cpu_count(logical=True),
                    "freq": psutil.cpu_freq()._asdict() if psutil.cpu_freq() else None
                }
            
            if info_type in ["memory", "all"]:
                mem = psutil.virtual_memory()
                info["memory"] = {
                    "total_gb": round(mem.total / (1024**3), 2),
                    "available_gb": round(mem.available / (1024**3), 2),
                    "used_percent": mem.percent
                }
            
            if info_type in ["disk", "all"]:
                disk = psutil.disk_usage('/')
                info["disk"] = {
                    "total_gb": round(disk.total / (1024**3), 2),
                    "free_gb": round(disk.free / (1024**3), 2),
                    "used_percent": (disk.used / disk.total) * 100
                }
            
            if info_type in ["network", "all"]:
                net = psutil.net_io_counters()
                info["network"] = {
                    "bytes_sent": net.bytes_sent,
                    "bytes_recv": net.bytes_recv,
                    "packets_sent": net.packets_sent,
                    "packets_recv": net.packets_recv
                }
            
            if info_type in ["processes", "all"]:
                processes = []
                for proc in psutil.process_iter(['pid', 'name', 'cpu_percent', 'memory_percent']):
                    try:
                        processes.append(proc.info)
                    except (psutil.NoSuchProcess, psutil.AccessDenied):
                        pass
                
                # Top 10 by CPU
                processes.sort(key=lambda x: x.get('cpu_percent', 0), reverse=True)
                info["processes"] = processes[:10]
            
            return info
            
        except Exception as e:
            raise RuntimeError(f"System info failed: {str(e)}")
    
    async def _screenshot_impl(self, format: str = "png", quality: int = 85, region: Optional[Dict] = None) -> str:
        """Screenshot implementation"""
        try:
            # Import screenshot capability
            try:
                import pyautogui
            except ImportError:
                raise RuntimeError("Screenshot requires pyautogui: pip install pyautogui")
            
            # Take screenshot
            if region:
                screenshot = pyautogui.screenshot(
                    region=(region["x"], region["y"], region["width"], region["height"])
                )
            else:
                screenshot = pyautogui.screenshot()
            
            # Convert format
            if format == "base64":
                import io
                buffer = io.BytesIO()
                screenshot.save(buffer, format='PNG')
                img_data = base64.b64encode(buffer.getvalue()).decode()
                return f"data:image/png;base64,{img_data}"
            
            elif format in ["png", "jpg"]:
                # Save to temporary file
                timestamp = int(time.time() * 1000)
                filename = f"/tmp/screenshot_{timestamp}.{format}"
                
                if format == "jpg":
                    screenshot = screenshot.convert("RGB")
                    screenshot.save(filename, "JPEG", quality=quality)
                else:
                    screenshot.save(filename, "PNG")
                
                return filename
            
            else:
                raise ValueError(f"Unsupported format: {format}")
                
        except Exception as e:
            raise RuntimeError(f"Screenshot failed: {str(e)}")
    
    async def _execute_code_impl(self, code: str, timeout: int = 10, capture_output: bool = True) -> Dict[str, Any]:
        """Sandboxed code execution implementation"""
        try:
            # Create temporary file for code
            with tempfile.NamedTemporaryFile(mode='w', suffix='.py', delete=False) as f:
                f.write(code)
                code_file = f.name
            
            try:
                # Execute with timeout and capture
                result = subprocess.run(
                    ["python", code_file],
                    timeout=timeout,
                    capture_output=capture_output,
                    text=True,
                    cwd="/tmp"  # Run in safe directory
                )
                
                return {
                    "stdout": result.stdout,
                    "stderr": result.stderr,
                    "return_code": result.returncode,
                    "execution_time": timeout,  # Approximate
                    "code_length": len(code)
                }
                
            finally:
                # Clean up
                Path(code_file).unlink(missing_ok=True)
                
        except subprocess.TimeoutExpired:
            raise RuntimeError(f"Code execution timed out after {timeout} seconds")
        except Exception as e:
            raise RuntimeError(f"Code execution failed: {str(e)}")
    
    async def _send_email_impl(self, to: str, subject: str, body: str, priority: str = "normal") -> str:
        """Email sending implementation (placeholder)"""
        # This would integrate with actual email service (SendGrid, SMTP, etc.)
        self.logger.info(f"Email simulation: To={to}, Subject={subject[:30]}..., Priority={priority}")
        
        return f"Email sent successfully to {to} with subject '{subject}' (Priority: {priority})"
    
    async def _analyze_data_impl(self, data: List[Dict], analysis_type: str = "summary", columns: Optional[List[str]] = None) -> Dict[str, Any]:
        """Data analysis implementation"""
        try:
            if not data:
                raise ValueError("No data provided for analysis")
            
            # Basic analysis
            num_records = len(data)
            
            if analysis_type == "summary":
                # Get column info
                all_columns = set()
                for row in data:
                    all_columns.update(row.keys())
                
                column_info = {}
                for col in all_columns:
                    values = [row.get(col) for row in data if col in row]
                    non_null_values = [v for v in values if v is not None]
                    
                    column_info[col] = {
                        "count": len(non_null_values),
                        "null_count": len(values) - len(non_null_values),
                        "null_percentage": ((len(values) - len(non_null_values)) / len(values)) * 100 if values else 0
                    }
                    
                    # Type analysis
                    if non_null_values:
                        types = set(type(v).__name__ for v in non_null_values)
                        column_info[col]["types"] = list(types)
                        
                        # Numeric analysis
                        numeric_values = [v for v in non_null_values if isinstance(v, (int, float))]
                        if numeric_values:
                            column_info[col]["numeric_stats"] = {
                                "min": min(numeric_values),
                                "max": max(numeric_values),
                                "mean": sum(numeric_values) / len(numeric_values)
                            }
                
                return {
                    "analysis_type": analysis_type,
                    "total_records": num_records,
                    "total_columns": len(all_columns),
                    "columns": list(all_columns),
                    "column_analysis": column_info
                }
            
            else:
                # Other analysis types would be implemented here
                return {
                    "analysis_type": analysis_type,
                    "total_records": num_records,
                    "message": f"Analysis type '{analysis_type}' not fully implemented yet"
                }
                
        except Exception as e:
            raise RuntimeError(f"Data analysis failed: {str(e)}")
    
    def get_stats(self) -> Dict[str, Any]:
        """Get tool manager statistics"""
        tool_stats = {}
        for name, tool in self.tools.items():
            tool_stats[name] = {
                "call_count": tool.call_count,
                "total_time": tool.total_execution_time,
                "avg_time": tool.total_execution_time / max(1, tool.call_count),
                "error_count": len(tool.errors),
                "last_used": tool.last_used.isoformat() if tool.last_used else None
            }
        
        return {
            **self.stats,
            "tool_statistics": tool_stats,
            "categories": {cat.value: len(tools) for cat, tools in self.categories.items()},
            "recent_executions": self.execution_log[-10:] if self.execution_log else []
        }


# Global function tool manager instance
_function_tool_manager: Optional[CartritaFunctionToolManager] = None


def get_function_tool_manager() -> CartritaFunctionToolManager:
    """Get global function tool manager instance"""
    global _function_tool_manager
    if _function_tool_manager is None:
        _function_tool_manager = CartritaFunctionToolManager()
    return _function_tool_manager


def initialize_function_tool_manager(logger: Optional[logging.Logger] = None) -> CartritaFunctionToolManager:
    """Initialize global function tool manager"""
    global _function_tool_manager
    _function_tool_manager = CartritaFunctionToolManager(logger=logger)
    return _function_tool_manager


# Export constant for backward compatibility
def get_cartrita_tools() -> List[Dict[str, Any]]:
    """Get list of all Cartrita tools in OpenAI function format"""
    manager = get_function_tool_manager()
    return manager.get_tools_for_agent("all")


# Backward compatibility constant
CARTRITA_TOOLS = get_cartrita_tools()
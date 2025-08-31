#!/usr/bin/env python3
"""
Simple MCP Tool Server for Cartrita - Port 8003
Provides basic tools for the Cartrita agents
"""

import asyncio
import json
import logging
from datetime import datetime
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import Dict, Any, List, Optional
import uvicorn

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Cartrita Tools Server", version="1.0.0")

class ToolRequest(BaseModel):
    name: str
    parameters: Dict[str, Any] = {}

class ToolResponse(BaseModel):
    success: bool
    result: Any = None
    error: Optional[str] = None
    execution_time: float = 0.0

# Available tools
AVAILABLE_TOOLS = {
    "echo": {
        "description": "Echo back the input message",
        "parameters": {
            "message": {"type": "string", "description": "Message to echo back"}
        }
    },
    "timestamp": {
        "description": "Get current timestamp",
        "parameters": {}
    },
    "calculate": {
        "description": "Perform basic calculations",
        "parameters": {
            "expression": {"type": "string", "description": "Mathematical expression to evaluate"}
        }
    }
}

@app.get("/")
async def root():
    return {
        "service": "Cartrita Tools Server",
        "version": "1.0.0",
        "tools": list(AVAILABLE_TOOLS.keys()),
        "status": "online"
    }

@app.get("/health")
async def health():
    return {"status": "healthy", "tools_count": len(AVAILABLE_TOOLS)}

@app.get("/tools")
async def list_tools():
    return {"tools": AVAILABLE_TOOLS}

@app.post("/execute", response_model=ToolResponse)
async def execute_tool(request: ToolRequest):
    start_time = asyncio.get_event_loop().time()
    
    try:
        if request.name not in AVAILABLE_TOOLS:
            raise HTTPException(status_code=404, detail=f"Tool '{request.name}' not found")
        
        # Execute the requested tool
        if request.name == "echo":
            result = request.parameters.get("message", "No message provided")
            
        elif request.name == "timestamp":
            result = datetime.now().isoformat()
            
        elif request.name == "calculate":
            expression = request.parameters.get("expression", "")
            if not expression:
                raise ValueError("Expression is required")
            
            # Simple safe evaluation for basic math
            import re
            if not re.match(r'^[0-9+\-*/().\s]+$', expression):
                raise ValueError("Invalid expression - only basic math allowed")
            
            result = eval(expression)
            
        else:
            raise ValueError(f"Tool '{request.name}' not implemented")
        
        execution_time = asyncio.get_event_loop().time() - start_time
        
        return ToolResponse(
            success=True,
            result=result,
            execution_time=execution_time
        )
        
    except Exception as e:
        execution_time = asyncio.get_event_loop().time() - start_time
        logger.error(f"Tool execution error: {e}")
        
        return ToolResponse(
            success=False,
            error=str(e),
            execution_time=execution_time
        )

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8003)
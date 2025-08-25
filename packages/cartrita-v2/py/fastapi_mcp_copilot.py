#!/usr/bin/env python3
"""
FastAPI MCP Integration for GitHub Copilot Delegation Agent
Adds MCP copilot delegation endpoints to the existing Python backend
"""

import asyncio
import os
from datetime import datetime
from pathlib import Path
from typing import Dict, Any, Optional

from fastapi import FastAPI, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

import sys
sys.path.append('..')
from mcp_copilot_delegation import MCPCopilotDelegationService

# Request/Response Models
class CopilotDelegationRequest(BaseModel):
    project_path: str
    task_description: str
    options: Dict[str, Any] = Field(default_factory=dict)

class ProjectAnalysisRequest(BaseModel):
    project_path: str

class InstructionsCreationRequest(BaseModel):
    project_path: str
    custom_procedures: Dict[str, Any] = Field(default_factory=dict)

class DelegationSimulationRequest(BaseModel):
    task_description: str
    project_context: Dict[str, Any] = Field(default_factory=dict)

class MCPCopilotFastAPIIntegration:
    """
    FastAPI integration class for MCP Copilot Delegation Service
    Can be added to existing FastAPI applications
    """
    
    def __init__(self, app: FastAPI, openai_api_key: str = None):
        self.app = app
        self.service_name = "fastapi_mcp_copilot"
        self.version = "2.0.0"
        
        # Initialize MCP service
        self.mcp_service = MCPCopilotDelegationService(openai_api_key=openai_api_key)
        
        # Register routes
        self.register_routes()
        
        print(f"🐍 FastAPI MCP Copilot Integration initialized")
        print(f"   Service: {self.service_name} v{self.version}")
        try:
            gui_enabled = getattr(self.mcp_service.agent, 'gui_enabled', False)
        except AttributeError:
            gui_enabled = False
        print(f"   GUI Available: {gui_enabled}")
    
    def register_routes(self):
        """Register all MCP copilot routes with FastAPI"""
        
        @self.app.post("/api/mcp/copilot/start-session")
        async def start_copilot_delegation_session(request: CopilotDelegationRequest):
            """Start a comprehensive GitHub Copilot delegation session"""
            
            try:
                result = await self.mcp_service.handle_tool_call("start_delegation_session", {
                    "project_path": request.project_path,
                    "task_description": request.task_description,
                    "options": request.options
                })
                
                if not result.get("success"):
                    raise HTTPException(status_code=400, detail=result.get("error", "Unknown error"))
                
                return JSONResponse({
                    **result,
                    "fastapi_service": self.service_name,
                    "timestamp": datetime.now().isoformat()
                })
                
            except HTTPException:
                raise
            except Exception as e:
                raise HTTPException(status_code=500, detail=str(e))
        
        @self.app.post("/api/mcp/copilot/analyze-project")
        async def analyze_project_structure(request: ProjectAnalysisRequest):
            """Analyze project structure and documentation"""
            
            try:
                result = await self.mcp_service.handle_tool_call("analyze_project", {
                    "project_path": request.project_path
                })
                
                if not result.get("success"):
                    raise HTTPException(status_code=400, detail=result.get("error", "Unknown error"))
                
                return JSONResponse({
                    **result,
                    "fastapi_service": self.service_name,
                    "timestamp": datetime.now().isoformat()
                })
                
            except HTTPException:
                raise
            except Exception as e:
                raise HTTPException(status_code=500, detail=str(e))
        
        @self.app.post("/api/mcp/copilot/create-instructions")
        async def create_copilot_instructions(request: InstructionsCreationRequest):
            """Create or update copilot-instructions.md template"""
            
            try:
                result = await self.mcp_service.handle_tool_call("create_copilot_instructions", {
                    "project_path": request.project_path,
                    "custom_procedures": request.custom_procedures
                })
                
                if not result.get("success"):
                    raise HTTPException(status_code=400, detail=result.get("error", "Unknown error"))
                
                return JSONResponse({
                    **result,
                    "fastapi_service": self.service_name,
                    "timestamp": datetime.now().isoformat()
                })
                
            except HTTPException:
                raise
            except Exception as e:
                raise HTTPException(status_code=500, detail=str(e))
        
        @self.app.post("/api/mcp/copilot/simulate-delegation")
        async def simulate_copilot_delegation(request: DelegationSimulationRequest):
            """Simulate copilot delegation without GUI actions"""
            
            try:
                result = await self.mcp_service.handle_tool_call("simulate_delegation", {
                    "task_description": request.task_description,
                    "project_context": request.project_context
                })
                
                if not result.get("success"):
                    raise HTTPException(status_code=400, detail=result.get("error", "Unknown error"))
                
                return JSONResponse({
                    **result,
                    "fastapi_service": self.service_name,
                    "timestamp": datetime.now().isoformat()
                })
                
            except HTTPException:
                raise
            except Exception as e:
                raise HTTPException(status_code=500, detail=str(e))
        
        @self.app.get("/api/mcp/copilot/status")
        async def get_mcp_copilot_status():
            """Get current MCP copilot service status"""
            
            try:
                result = await self.mcp_service.handle_tool_call("get_service_status", {})
                
                # Add FastAPI integration info
                integration_info = {
                    "fastapi_integration": {
                        "service": self.service_name,
                        "version": self.version,
                        "routes_registered": 5,
                        "status": "active"
                    },
                    "hybrid_backend": {
                        "python_fastapi": "active",
                        "mcp_service": "integrated",
                        "gui_automation": result.get("service", {}).get("gui_available", False)
                    }
                }
                
                return JSONResponse({
                    **result,
                    **integration_info,
                    "timestamp": datetime.now().isoformat()
                })
                
            except Exception as e:
                raise HTTPException(status_code=500, detail=str(e))
        
        @self.app.get("/api/mcp/copilot/manifest")
        async def get_mcp_manifest():
            """Get MCP service manifest"""
            
            try:
                manifest = self.mcp_service.get_mcp_manifest()
                
                # Add FastAPI integration details
                manifest.update({
                    "fastapi_integration": {
                        "service": self.service_name,
                        "version": self.version,
                        "routes": [
                            "POST /api/mcp/copilot/start-session",
                            "POST /api/mcp/copilot/analyze-project", 
                            "POST /api/mcp/copilot/create-instructions",
                            "POST /api/mcp/copilot/simulate-delegation",
                            "GET /api/mcp/copilot/status",
                            "GET /api/mcp/copilot/manifest"
                        ]
                    },
                    "hybrid_architecture": {
                        "backend_type": "python_fastapi",
                        "mcp_integrated": True,
                        "node_bridge_compatible": True
                    }
                })
                
                return JSONResponse({
                    "success": True,
                    "manifest": manifest,
                    "timestamp": datetime.now().isoformat()
                })
                
            except Exception as e:
                raise HTTPException(status_code=500, detail=str(e))
        
        print("✅ MCP Copilot routes registered with FastAPI")

def add_mcp_copilot_to_fastapi_app(app: FastAPI, openai_api_key: str = None) -> MCPCopilotFastAPIIntegration:
    """
    Convenience function to add MCP copilot integration to existing FastAPI app
    """
    return MCPCopilotFastAPIIntegration(app, openai_api_key)

# Standalone FastAPI application for testing
if __name__ == "__main__":
    import uvicorn
    from fastapi.middleware.cors import CORSMiddleware
    
    # Create standalone FastAPI app for testing
    app = FastAPI(
        title="MCP Copilot Delegation Service",
        description="GitHub Copilot delegation and automation via MCP",
        version="2.0.0"
    )
    
    # CORS configuration
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    
    # Health endpoint
    @app.get("/health")
    async def health_check():
        return {
            "status": "healthy",
            "service": "mcp_copilot_fastapi",
            "version": "2.0.0",
            "timestamp": datetime.now().isoformat()
        }
    
    # Add MCP copilot integration
    api_key = os.getenv("OPENAI_API_KEY")
    mcp_integration = add_mcp_copilot_to_fastapi_app(app, api_key)
    
    # Start server
    port = int(os.getenv("PORT", 8004))
    print(f"🚀 Starting MCP Copilot FastAPI server on port {port}")
    print(f"📖 API docs available at http://localhost:{port}/docs")
    
    uvicorn.run(
        app,
        host="0.0.0.0",
        port=port,
        reload=False,
        log_level="info"
    )
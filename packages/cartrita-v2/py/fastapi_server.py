"""
Cartrita V2 - FastAPI Server
Python backend implementing OpenAI Responses API agents
"""

import asyncio
import logging
import os
import sys
from datetime import datetime
from typing import Dict, List, Optional, Any
from pathlib import Path

import uvicorn
from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

# Add current directory to path for imports
sys.path.append(str(Path(__file__).parent))

from cartrita_core.agent_manager import CartritaAgentManager, TaskPriority
from cartrita_core.cartrita_agent import AgentContext
from cartrita_core.tools import CartritaToolRegistry
from cartrita_core.responses_api import CartritaResponsesClient
# from enhanced_chat_routes import router as enhanced_chat_router


# Request/Response Models
class ChatRequest(BaseModel):
    message: str
    user_id: str = "anonymous"
    session_id: Optional[str] = None
    priority: str = "medium"
    preferred_agent: Optional[str] = None
    context: Dict[str, Any] = Field(default_factory=dict)


class ComputerUseRequest(BaseModel):
    task_description: str
    user_id: str = "anonymous"
    session_id: Optional[str] = None
    max_iterations: int = 10
    display_width: int = 1024
    display_height: int = 768
    environment: str = "ubuntu"


class HealthResponse(BaseModel):
    status: str
    version: str
    uptime: float
    agents_active: int
    timestamp: str


# FastAPI Application
app = FastAPI(
    title="Cartrita V2 - Python Agent Backend",
    description="OpenAI Responses API Multi-Agent System",
    version="2.0.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

# CORS Configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure appropriately for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include Enhanced Chat Routes (commented out due to missing asyncpg)
# app.include_router(enhanced_chat_router)

# Global Components
agent_manager: Optional[CartritaAgentManager] = None
tools_registry: Optional[CartritaToolRegistry] = None
responses_client: Optional[CartritaResponsesClient] = None
server_start_time = datetime.now()

# Logging setup
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger("cartrita.fastapi")


@app.on_event("startup")
async def startup_event():
    """Initialize the FastAPI application"""
    global agent_manager, tools_registry, responses_client
    
    logger.info("🚀 Starting Cartrita V2 Python Backend")
    
    try:
        # Initialize tools registry
        tools_registry = CartritaToolRegistry(logger=logger.getChild("tools"))
        logger.info("✅ Tools registry initialized")
        
        # Initialize OpenAI Responses API client
        responses_client = CartritaResponsesClient(
            api_key=os.getenv("OPENAI_API_KEY"),
            logger=logger.getChild("responses_api")
        )
        logger.info("✅ OpenAI Responses API client initialized")
        
        # Initialize agent manager
        agent_manager = CartritaAgentManager(
            tools_registry=tools_registry,
            logger=logger.getChild("agent_manager")
        )
        logger.info("✅ Agent manager initialized")
        
        # Grant default permissions to agents
        await setup_agent_permissions()
        
        logger.info("🎭 Cartrita V2 Python Backend ready!")
        
    except Exception as e:
        logger.error(f"❌ Startup failed: {e}")
        raise


async def setup_agent_permissions():
    """Setup default tool permissions for agents"""
    if not tools_registry:
        return
    
    # Grant permissions to supervisor agent
    tools_registry.grant_permission(
        "supervisor_cartrita_v2",
        ["web_search", "file_read", "system_info"]
    )
    
    # Grant permissions to research agent
    tools_registry.grant_permission(
        "research_agent_v2",
        ["web_search", "file_read", "file_write", "system_info"]
    )
    
    # Grant permissions to writer agent
    tools_registry.grant_permission(
        "writer_agent_v2",
        ["file_read", "file_write", "web_search"]
    )
    
    # Grant permissions to vision agent
    tools_registry.grant_permission(
        "vision_agent_v2",
        ["screenshot", "file_read", "system_info"]
    )
    
    # Grant permissions to computer use agent
    tools_registry.grant_permission(
        "computer_use_agent_v2",
        ["screenshot", "system_info", "file_read", "file_write"]
    )
    
    # Grant permissions to code writer agent
    tools_registry.grant_permission(
        "code_writer_agent_v2",
        ["file_read", "file_write", "execute_code", "web_search"]
    )
    
    logger.info("✅ Agent permissions configured")


@app.get("/health", response_model=HealthResponse)
async def health_check():
    """Health check endpoint"""
    uptime = (datetime.now() - server_start_time).total_seconds()
    
    agents_active = 0
    if agent_manager:
        status = await agent_manager.get_agent_status()
        agents_active = len(status.get("agents", {}))
    
    return HealthResponse(
        status="healthy",
        version="2.0.0",
        uptime=uptime,
        agents_active=agents_active,
        timestamp=datetime.now().isoformat()
    )


@app.post("/api/v2/chat")
async def chat_endpoint(request: ChatRequest, background_tasks: BackgroundTasks):
    """Main chat endpoint using agent manager"""
    
    if not agent_manager:
        raise HTTPException(status_code=503, detail="Agent manager not initialized")
    
    try:
        logger.info(f"💬 Chat request from {request.user_id}: {request.message[:100]}...")
        
        # Convert priority string to enum
        priority_map = {
            "low": TaskPriority.LOW,
            "medium": TaskPriority.MEDIUM,
            "high": TaskPriority.HIGH,
            "urgent": TaskPriority.URGENT
        }
        priority = priority_map.get(request.priority, TaskPriority.MEDIUM)
        
        # Create agent context
        context = AgentContext(
            user_id=request.user_id,
            session_id=request.session_id,
            metadata=request.context
        )
        
        # Execute task through agent manager
        response = await agent_manager.execute_task(
            task_description=request.message,
            context=context,
            priority=priority,
            preferred_agent=request.preferred_agent
        )
        
        return {
            "success": response.success,
            "content": response.content,
            "agent_id": response.agent_id,
            "task_id": response.task_id,
            "reasoning": response.reasoning,
            "tools_used": response.tools_used,
            "iterations_completed": response.iterations_completed,
            "execution_time_ms": response.execution_time_ms,
            "computer_actions": response.computer_actions,
            "metadata": response.metadata,
            "error": response.error,
            "timestamp": datetime.now().isoformat()
        }
        
    except Exception as e:
        logger.error(f"❌ Chat request failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/v2/computer-use")
async def computer_use_endpoint(request: ComputerUseRequest):
    """Computer use endpoint for GUI automation"""
    
    if not responses_client:
        raise HTTPException(status_code=503, detail="Responses client not initialized")
    
    try:
        logger.info(f"🖥️ Computer use request: {request.task_description[:100]}...")
        
        # Create computer use session
        session_result = await responses_client.create_computer_use_session(
            task_description=request.task_description,
            user_id=request.user_id,
            display_width=request.display_width,
            display_height=request.display_height,
            max_iterations=request.max_iterations
        )
        
        if not session_result["success"]:
            raise HTTPException(status_code=500, detail=session_result.get("error"))
        
        return {
            "success": True,
            "session_id": session_result["session_id"],
            "response": session_result["initial_response"],
            "task_description": request.task_description,
            "display_config": {
                "width": request.display_width,
                "height": request.display_height,
                "environment": request.environment
            },
            "max_iterations": request.max_iterations,
            "timestamp": datetime.now().isoformat()
        }
        
    except Exception as e:
        logger.error(f"❌ Computer use request failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/v2/computer-use/{session_id}/continue")
async def continue_computer_use(session_id: str, user_input: Optional[str] = None):
    """Continue an existing computer use session"""
    
    if not responses_client:
        raise HTTPException(status_code=503, detail="Responses client not initialized")
    
    try:
        result = await responses_client.continue_computer_use_session(
            session_id=session_id,
            user_input=user_input
        )
        
        if not result["success"]:
            raise HTTPException(status_code=400, detail=result.get("error"))
        
        return result
        
    except Exception as e:
        logger.error(f"❌ Computer use continuation failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/api/v2/computer-use/{session_id}")
async def end_computer_use_session(session_id: str):
    """End a computer use session"""
    
    if not responses_client:
        raise HTTPException(status_code=503, detail="Responses client not initialized")
    
    try:
        result = responses_client.end_computer_use_session(session_id)
        
        if not result["success"]:
            raise HTTPException(status_code=404, detail=result.get("error"))
        
        return result
        
    except Exception as e:
        logger.error(f"❌ End computer use session failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/v2/agents/status")
async def get_agents_status():
    """Get status of all agents"""
    
    if not agent_manager:
        raise HTTPException(status_code=503, detail="Agent manager not initialized")
    
    try:
        status = await agent_manager.get_agent_status()
        
        # Add additional system info
        status["system"] = {
            "python_backend_version": "2.0.0",
            "uptime_seconds": (datetime.now() - server_start_time).total_seconds(),
            "timestamp": datetime.now().isoformat()
        }
        
        # Add tools registry stats
        if tools_registry:
            status["tools"] = tools_registry.get_registry_stats()
        
        # Add responses client stats
        if responses_client:
            status["responses_api"] = responses_client.get_client_stats()
        
        return {"success": True, **status}
        
    except Exception as e:
        logger.error(f"❌ Get agents status failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/v2/agents/{agent_id}/status")
async def get_agent_status(agent_id: str):
    """Get status of a specific agent"""
    
    if not agent_manager:
        raise HTTPException(status_code=503, detail="Agent manager not initialized")
    
    try:
        status = await agent_manager.get_agent_status(agent_id)
        
        if "error" in status:
            raise HTTPException(status_code=404, detail=status["error"])
        
        return {"success": True, **status}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Get agent status failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/v2/agents/{agent_id}/delegate")
async def delegate_to_agent(agent_id: str, request: ChatRequest):
    """Directly delegate a task to a specific agent"""
    
    if not agent_manager:
        raise HTTPException(status_code=503, detail="Agent manager not initialized")
    
    try:
        # Convert priority
        priority_map = {
            "low": TaskPriority.LOW,
            "medium": TaskPriority.MEDIUM,
            "high": TaskPriority.HIGH,
            "urgent": TaskPriority.URGENT
        }
        priority = priority_map.get(request.priority, TaskPriority.MEDIUM)
        
        # Create context
        context = AgentContext(
            user_id=request.user_id,
            session_id=request.session_id,
            metadata=request.context
        )
        
        # Delegate to specific agent
        response = await agent_manager.delegate_to_agent(
            agent_id=agent_id,
            task_description=request.message,
            context=context,
            priority=priority
        )
        
        return {
            "success": response.success,
            "content": response.content,
            "agent_id": response.agent_id,
            "task_id": response.task_id,
            "reasoning": response.reasoning,
            "tools_used": response.tools_used,
            "execution_time_ms": response.execution_time_ms,
            "error": response.error
        }
        
    except Exception as e:
        logger.error(f"❌ Agent delegation failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/v2/stats")
async def get_server_stats():
    """Get comprehensive server statistics"""
    
    stats = {
        "server": {
            "version": "2.0.0",
            "uptime_seconds": (datetime.now() - server_start_time).total_seconds(),
            "timestamp": datetime.now().isoformat()
        }
    }
    
    if agent_manager:
        stats["agent_manager"] = agent_manager.get_manager_stats()
    
    if tools_registry:
        stats["tools_registry"] = tools_registry.get_registry_stats()
    
    if responses_client:
        stats["responses_client"] = responses_client.get_client_stats()
    
    return {"success": True, **stats}


@app.post("/api/v2/simple-chat")
async def simple_chat_endpoint(request: ChatRequest):
    """Simple chat endpoint using direct OpenAI API"""
    
    try:
        import openai
        
        # Check if we have a valid API key
        api_key = os.getenv("OPENAI_FINETUNING_API_KEY") or os.getenv("OPENAI_API_KEY")
        
        if not api_key or len(api_key.strip()) < 10:
            # Return a mock response if no API key
            return {
                "success": True,
                "content": f"Hello! I'm Cartrita, your AI assistant. I'm currently running in demo mode. You said: '{request.message}' \n\nI'm a multi-agent AI system with capabilities including research, writing, computer automation, vision analysis, and code generation. How can I help you today?",
                "agent_id": "demo_chat",
                "task_id": f"demo-{datetime.now().timestamp()}",
                "reasoning": "Demo response - OpenAI API key not configured",
                "tools_used": [],
                "iterations_completed": 1,
                "execution_time_ms": 50,
                "computer_actions": [],
                "metadata": {"model": "demo_mode", "note": "Configure OPENAI_API_KEY for full functionality"},
                "error": None,
                "timestamp": datetime.now().isoformat()
            }
        
        # Initialize OpenAI client
        client = openai.AsyncOpenAI(api_key=api_key)
        
        # Create simple chat completion
        response = await client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {
                    "role": "system",
                    "content": "You are a helpful AI assistant called Cartrita. You are part of a multi-agent system designed to help users with various tasks including research, writing, computer automation, vision analysis, and code generation."
                },
                {
                    "role": "user",
                    "content": request.message
                }
            ],
            max_tokens=1000,
            temperature=0.7
        )
        
        return {
            "success": True,
            "content": response.choices[0].message.content,
            "agent_id": "cartrita_chat",
            "task_id": f"chat-{datetime.now().timestamp()}",
            "reasoning": "Direct OpenAI API response",
            "tools_used": [],
            "iterations_completed": 1,
            "execution_time_ms": 0,
            "computer_actions": [],
            "metadata": {"model": "gpt-4o-mini"},
            "error": None,
            "timestamp": datetime.now().isoformat()
        }
        
    except Exception as e:
        logger.error(f"❌ Simple chat request failed: {e}")
        return {
            "success": True,  # Return success with error explanation for better UX
            "content": f"I apologize, but I'm currently having technical difficulties connecting to my AI models. This is usually due to API configuration issues. \n\nIn the meantime, I can tell you that I'm Cartrita, a multi-agent AI system with the following capabilities:\n\n• 🔍 Research and fact-checking\n• ✍️ Content writing and editing\n• 💻 Code generation and debugging\n• 👁️ Image and visual analysis\n• 🖥️ Computer automation tasks\n\nYour message was: '{request.message}'\n\nPlease try again later or contact the administrator to resolve the API configuration.",
            "agent_id": "error_handler",
            "task_id": f"error-{datetime.now().timestamp()}",
            "reasoning": f"Error handled gracefully: {str(e)}",
            "tools_used": [],
            "iterations_completed": 0,
            "execution_time_ms": 0,
            "computer_actions": [],
            "metadata": {"error_type": "api_configuration"},
            "error": None,  # Don't expose technical errors to users
            "timestamp": datetime.now().isoformat()
        }


@app.on_event("shutdown")
async def shutdown_event():
    """Cleanup on shutdown"""
    logger.info("🛑 Shutting down Cartrita V2 Python Backend")
    
    if agent_manager:
        await agent_manager.shutdown_all()
    
    logger.info("✅ Shutdown complete")


if __name__ == "__main__":
    # Get configuration from environment
    port = int(os.getenv("PORT", 8002))
    host = os.getenv("HOST", "0.0.0.0")
    reload = os.getenv("ENVIRONMENT", "development") == "development"
    
    logger.info(f"🚀 Starting Cartrita V2 FastAPI server on {host}:{port}")
    
    uvicorn.run(
        "fastapi_server:app",
        host=host,
        port=port,
        reload=reload,
        log_level="info"
    )
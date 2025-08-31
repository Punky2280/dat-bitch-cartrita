"""
Cartrita V2 - FastAPI Server
Production OpenAI-powered agent system with Miami personality
Integrated with new V2 architecture
"""

import asyncio
import logging
import os
import sys
from datetime import datetime, timezone
from typing import Dict, List, Optional, Any
from pathlib import Path
from contextlib import asynccontextmanager

import uvicorn
from fastapi import FastAPI, HTTPException, BackgroundTasks, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

# Add current directory to path for imports
sys.path.append(str(Path(__file__).parent))

# Import new V2 components
from cartrita_main import CartritalV2Application, create_cartrita_v2_application

# Import agent system components for legacy endpoints
try:
    from cartrita_agent_manager import CartritaAgentManager, AgentContext, TaskPriority
    from cartrita_tools_registry import CartritaToolRegistry
    from cartrita_responses_client import CartritaResponsesClient
    from cartrita_startup_checks import run_startup_checks
    from cartrita_config import get_settings
except ImportError as e:
    print(f"Warning: Legacy agent imports failed: {e}")
    # Define minimal fallbacks
    class TaskPriority:
        LOW, MEDIUM, HIGH, URGENT = "low", "medium", "high", "urgent"
    
    class AgentContext:
        def __init__(self, **kwargs):
            self.__dict__.update(kwargs)


# Request/Response Models for V2
class ChatRequest(BaseModel):
    message: str
    user_id: str = "anonymous" 
    session_id: Optional[str] = None
    context: Dict[str, Any] = Field(default_factory=dict)
    
    class Config:
        json_schema_extra = {
            "example": {
                "message": "¡Hola Cartrita! How can you help me today?",
                "user_id": "user_123",
                "session_id": "session_456",
                "context": {"location": "Miami", "language": "en"}
            }
        }


class ChatResponse(BaseModel):
    success: bool
    response: Optional[Dict[str, Any]] = None
    error: Optional[str] = None
    miami_message: str
    session_id: Optional[str] = None
    agents_used: List[str] = Field(default_factory=list)
    security_info: Optional[Dict[str, Any]] = None
    
    class Config:
        json_schema_extra = {
            "example": {
                "success": True,
                "response": {
                    "content": "¡Hola! I'm Cartrita, your Miami AI assistant. How can I help you today?",
                    "agent_type": "orchestrator"
                },
                "miami_message": "¡Dale! Message processed successfully.",
                "session_id": "session_456",
                "agents_used": ["orchestrator"],
                "security_info": {
                    "rate_limit_remaining": 95,
                    "security_level": "public"
                }
            }
        }


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


# Global V2 Application
cartrita_app: Optional[CartritalV2Application] = None
server_start_time = datetime.now(timezone.utc)

# Global components for legacy endpoints
agent_manager = None
tools_registry = None
responses_client = None
startup_checks_report = None

# Logging setup with Miami style
logging.basicConfig(
    level=logging.INFO,
    format='🏝️  %(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger("cartrita.fastapi")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifespan context manager for startup and shutdown"""
    global cartrita_app
    
    # Startup
    try:
        logger.info("🚀 Starting Cartrita V2 FastAPI server...")
        
        # Create and initialize V2 application
        cartrita_app = await create_cartrita_v2_application()
        
        # Log startup success
        status = await cartrita_app.get_application_status()
        logger.info("✅ Cartrita V2 initialized successfully!")
        logger.info(f"🏝️  {status['miami_status']}")
        logger.info(f"🔍 Health status: {status['health_status']}")
        
    except Exception as e:
        logger.error(f"❌ Failed to initialize Cartrita V2: {e}")
        # Don't fail the entire server, but log the error
        cartrita_app = None
    
    yield
    
    # Shutdown
    if cartrita_app:
        logger.info("🛑 Shutting down Cartrita V2...")
        await cartrita_app.shutdown()
        logger.info("✅ Cartrita V2 shutdown complete.")


# FastAPI Application with Miami flair
app = FastAPI(
    title="🏝️ Cartrita V2 - Miami AI Assistant API",
    description="Production OpenAI-powered multi-agent system con sabor Miami",
    version="2.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan
)

# CORS Configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure appropriately for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)



def get_cartrita_app() -> CartritalV2Application:
    """Dependency to get Cartrita application instance"""
    if cartrita_app is None:
        raise HTTPException(
            status_code=503,
            detail="¡Ay! Cartrita V2 is not initialized. Try again in a moment."
        )
    return cartrita_app


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
    uptime = (datetime.now(timezone.utc) - server_start_time).total_seconds()
    
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

@app.get("/health/details")
async def health_details():
    """Return detailed health including startup checks"""
    from config import get_settings
    safe = get_settings()["safe"]
    return {
        "status": "ok" if (startup_checks_report or {}).get("ok") else "degraded",
        "uptime": (datetime.now() - server_start_time).total_seconds(),
        "checks": startup_checks_report or {},
        "config": safe,
        "timestamp": datetime.now().isoformat(),
    }


@app.post("/api/v2/chat")
async def chat_endpoint(request: ChatRequest, background_tasks: BackgroundTasks):
    """Main chat endpoint using Cartrita V2 application"""
    
    if not cartrita_app:
        raise HTTPException(status_code=503, detail="Cartrita V2 application not initialized")

    try:
        logger.info(f"💬 Chat request from {request.user_id}: {request.message[:100]}...")

        # Process message through Cartrita V2 application
        response = await cartrita_app.process_user_message(
            user_message=request.message,
            user_id=request.user_id,
            session_id=request.session_id
        )

        return {
            "success": response.get("success", True),
            "content": response.get("response", response.get("miami_message", "")),
            "agent_id": "cartrita_v2_orchestrator",
            "task_id": response.get("session_id"),
            "reasoning": response.get("reasoning", ""),
            "tools_used": response.get("tools_used", []),
            "iterations_completed": 1,
            "execution_time_ms": response.get("processing_time_ms", 0),
            "computer_actions": response.get("computer_actions", []),
            "metadata": response.get("metadata", {}),
            "error": response.get("error", None),
            "timestamp": datetime.now().isoformat()
        }

    except Exception as e:
        logger.error(f"❌ Chat request failed: {e}")
        raise HTTPException(status_code=500, detail=str(e)) from e


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
        raise HTTPException(status_code=500, detail=str(e)) from e


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
        raise HTTPException(status_code=500, detail=str(e)) from e


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
        raise HTTPException(status_code=500, detail=str(e)) from e


@app.get("/api/v2/agents/status")
async def get_agents_status():
    """Get status of all agents"""
    
    if not cartrita_app:
        raise HTTPException(status_code=503, detail="Cartrita V2 application not initialized")

    try:
        status = await cartrita_app.get_application_status()
        
        # Transform to match expected agent status format
        return {
            "success": True,
            "agents": {},  # V2 uses orchestrator pattern instead of individual agents
            "system": {
                "python_backend_version": "2.0.0",
                "uptime_seconds": status.get("uptime_seconds", 0),
                "timestamp": datetime.now().isoformat(),
                "health_status": status.get("health_status"),
                "miami_status": status.get("miami_status")
            },
            "components": status.get("components", {}),
            "initialized": status.get("initialized", False)
        }

    except Exception as e:
        logger.error(f"❌ Get agents status failed: {e}")
        raise HTTPException(status_code=500, detail=str(e)) from e


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
        raise HTTPException(status_code=500, detail=str(e)) from e


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
        raise HTTPException(status_code=500, detail=str(e)) from e


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


@app.get("/api/v2/agents")
async def list_agents():
    """Return a simplified list of agents for UI consumption"""
    if not agent_manager:
        raise HTTPException(status_code=503, detail="Agent manager not initialized")

    try:
        status = await agent_manager.get_agent_status()
        agents = []
        agents.extend(
            {
                "id": agent_id,
                "name": meta.get("name") or agent_id.replace("_", " ").title(),
                "description": meta.get("description") or "Cartrita V2 agent",
                "capabilities": meta.get("capabilities") or [],
                "model": meta.get("model") or "gpt-5",
                "status": meta.get("status") or "idle",
            }
            for agent_id, meta in (status.get("agents") or {}).items()
        )
        return {"success": True, "data": agents}

    except Exception as e:
        logger.error(f"❌ List agents failed: {e}")
        raise HTTPException(status_code=500, detail=str(e)) from e


@app.post("/api/v2/simple-chat")
async def simple_chat_endpoint(request: ChatRequest):
    """Simple chat endpoint using direct OpenAI API"""
    
    try:
        import openai
        
        # Check if we have a valid API key
        api_key = os.getenv("OPENAI_FINETUNING_API_KEY") or os.getenv("OPENAI_API_KEY")
        if not api_key or len(api_key.strip()) < 10:
            raise HTTPException(status_code=503, detail="OpenAI API key not configured")
        
        # Initialize OpenAI client
        client = openai.AsyncOpenAI(api_key=api_key)
        
        # Create simple chat completion with model-appropriate parameters
        model_name = "gpt-5"
        system_prompt = load_system_prompt() or (
            "You are a helpful AI assistant called Cartrita. You are part of a multi-agent system designed to help users with various tasks including research, writing, computer automation, vision analysis, and code generation."
        )
        chat_params = {
            "model": model_name,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": request.message},
            ],
        }
        
        # GPT-5 models use max_completion_tokens and don't support custom temperature
        if "gpt-5" in model_name.lower():
            chat_params["max_completion_tokens"] = 1000
            # GPT-5 only supports default temperature (1.0)
        else:
            chat_params["max_tokens"] = 1000
            chat_params["temperature"] = 0.7
            
        response = await client.chat.completions.create(**chat_params)
        
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
            "metadata": {"model": "gpt-5"},
            "error": None,
            "timestamp": datetime.now().isoformat()
        }
        
    except Exception as e:
        logger.error(f"❌ Simple chat request failed: {e}")
        raise HTTPException(status_code=500, detail="Simple chat processing failed") from e


# Cleanup handled in lifespan context manager


if __name__ == "__main__":
    # Get configuration from environment
    port = int(os.getenv("PORT", 8000))  # Changed from FASTAPI_PORT to PORT and default to 8000
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
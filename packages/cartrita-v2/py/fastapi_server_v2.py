"""
Cartrita V2 - FastAPI Server
Production OpenAI-powered agent system with Miami personality
Clean V2 architecture implementation
"""

import asyncio
import logging
import os
import sys
from datetime import datetime, timezone
from typing import Dict, List, Optional, Any

import uvicorn
from fastapi import FastAPI, HTTPException, Depends, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

# Import V2 components
from cartrita_main import CartritalV2Application, create_cartrita_v2_application


# Request/Response Models
class ChatRequest(BaseModel):
    message: str
    user_id: str = "anonymous" 
    session_id: Optional[str] = None
    context: Dict[str, Any] = Field(default_factory=dict)
    
    class Config:
        schema_extra = {
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


class HealthResponse(BaseModel):
    status: str
    version: str
    uptime_seconds: float
    miami_status: str
    health_status: Dict[str, bool]
    timestamp: str


class StatusResponse(BaseModel):
    application: Dict[str, Any]
    server: Dict[str, Any]
    miami_message: str


# FastAPI Application
app = FastAPI(
    title="🏝️ Cartrita V2 - Miami AI Assistant API",
    description="Production OpenAI-powered multi-agent system con sabor Miami",
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

# Global Application State
cartrita_app: Optional[CartritalV2Application] = None
server_start_time = datetime.now(timezone.utc)

# Logging setup
logging.basicConfig(
    level=logging.INFO,
    format='🏝️  %(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger("cartrita.fastapi")


@app.on_event("startup")
async def startup_event():
    """Initialize Cartrita V2 application on FastAPI startup"""
    global cartrita_app
    
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
        cartrita_app = None


@app.on_event("shutdown")
async def shutdown_event():
    """Cleanup on FastAPI shutdown"""
    global cartrita_app
    
    if cartrita_app:
        logger.info("🛑 Shutting down Cartrita V2...")
        await cartrita_app.shutdown()
        logger.info("✅ Cartrita V2 shutdown complete.")


def get_cartrita_app() -> CartritalV2Application:
    """Dependency to get Cartrita application instance"""
    if cartrita_app is None:
        raise HTTPException(
            status_code=503,
            detail="¡Ay! Cartrita V2 is not initialized. Try again in a moment."
        )
    return cartrita_app


# API Endpoints

@app.get("/", response_model=dict)
async def root():
    """Welcome endpoint with Miami flair"""
    return {
        "message": "¡Hola! Welcome to Cartrita V2 - Your Miami AI Assistant 🏝️",
        "version": "2.0.0",
        "documentation": "/docs",
        "health": "/health",
        "miami_greeting": "¡Dale! Ready to help you with anything you need!"
    }


@app.get("/health", response_model=HealthResponse)
async def health_check(app_instance: CartritalV2Application = Depends(get_cartrita_app)):
    """Comprehensive health check"""
    try:
        status = await app_instance.get_application_status()
        uptime = (datetime.now(timezone.utc) - server_start_time).total_seconds()
        
        return HealthResponse(
            status="healthy" if status["initialized"] else "unhealthy",
            version="2.0.0",
            uptime_seconds=uptime,
            miami_status=status["miami_status"],
            health_status=status["health_status"],
            timestamp=datetime.now(timezone.utc).isoformat()
        )
        
    except Exception as e:
        logger.error(f"Health check failed: {e}")
        return HealthResponse(
            status="unhealthy",
            version="2.0.0", 
            uptime_seconds=0,
            miami_status="¡Ay! Something's not right, pero we're working on it!",
            health_status={},
            timestamp=datetime.now(timezone.utc).isoformat()
        )


@app.get("/status", response_model=StatusResponse)
async def detailed_status(app_instance: CartritalV2Application = Depends(get_cartrita_app)):
    """Detailed application status"""
    try:
        app_status = await app_instance.get_application_status()
        uptime = (datetime.now(timezone.utc) - server_start_time).total_seconds()

        return StatusResponse(
            application=app_status,
            server={
                "start_time": server_start_time.isoformat(),
                "uptime_seconds": uptime,
                "process_id": os.getpid(),
                "python_version": sys.version
            },
            miami_message="¡Todo perfecto! Everything is running smooth como mantequilla."
        )

    except Exception as e:
        logger.error(f"Status check failed: {e}")
        raise HTTPException(status_code=500, detail="Status check failed") from e


@app.post("/chat", response_model=ChatResponse)
async def chat_endpoint(
    request: ChatRequest,
    background_tasks: BackgroundTasks,
    app_instance: CartritalV2Application = Depends(get_cartrita_app)
):
    """
    Main chat endpoint - processes user messages through Cartrita V2
    """
    try:
        logger.info(f"💬 Chat request from user {request.user_id}: {request.message[:50]}...")

        # Process message through V2 application
        result = await app_instance.process_user_message(
            user_message=request.message,
            user_id=request.user_id,
            session_id=request.session_id,
            **request.context
        )

        if not result["success"]:
            return ChatResponse(
                success=False,
                error=result["error"],
                miami_message=result["miami_message"],
                session_id=request.session_id
            )

        response_data = result["response"]

        return ChatResponse(
            success=True,
            response=response_data["response"],
            miami_message=result.get("miami_message", "¡Dale! Message processed successfully."),
            session_id=response_data.get("session_id"),
            agents_used=response_data.get("agents_used", []),
            security_info=result.get("security")
        )
    except Exception as e:
        logger.error(f"❌ Chat processing failed: {e}")
        return ChatResponse(
            success=False,
            error="processing_error",
            miami_message=f"¡Ay caramba! Something went wrong: {str(e)}",
            session_id=request.session_id
        )


@app.post("/chat/stream")
async def chat_stream_endpoint(
    request: ChatRequest,
    app_instance: CartritalV2Application = Depends(get_cartrita_app)
):
    """
    Streaming chat endpoint (placeholder for future implementation)
    """
    return JSONResponse({
        "message": "Streaming not yet implemented in V2",
        "miami_message": "¡Oye! Streaming viene pronto. Use /chat for now.",
        "fallback_endpoint": "/chat"
    })


@app.get("/agents")
async def list_agents(app_instance: CartritalV2Application = Depends(get_cartrita_app)):
    """List available agents and their capabilities"""
    try:
        # Get specialist capabilities
        if hasattr(app_instance, 'orchestrator') and app_instance.orchestrator:
            specialists_info = app_instance.orchestrator.specialists.list_all_specialists()

            return {
                "agents": {
                    "orchestrator": {
                        "description": "Main coordinating agent que manages all specialists",
                        "capabilities": ["routing", "coordination", "decision_making"],
                        "miami_personality": True
                    },
                    **{
                        name: {
                            "description": f"{name.replace('_', ' ').title()} specialist agent",
                            "capabilities": tools,
                            "miami_personality": True
                        }
                        for name, tools in specialists_info.items()
                    }
                },
                "total_agents": len(specialists_info) + 1,  # +1 for orchestrator
                "miami_message": "¡Dale! Here are all the agents ready to help you."
            }
        else:
            return {
                "agents": {},
                "total_agents": 0,
                "miami_message": "¡Ay! Agents not yet loaded. Try again in a moment."
            }

    except Exception as e:
        logger.error(f"Failed to list agents: {e}")
        raise HTTPException(status_code=500, detail="Failed to list agents") from e


@app.get("/tools")
async def list_tools():
    """List available tools"""
    return {
        "tools": {
            "file_search": "Search through documents and files",
            "vector_search": "Semantic search through knowledge base", 
            "web_search": "Search the web for current information",
            "code_execution": "Execute code safely",
            "image_generation": "Create images with Miami aesthetic",
            "chart_generation": "Create beautiful data visualizations",
            "ui_generation": "Generate user interface components",
            "workflow_automation": "Automate repetitive tasks",
            "content_moderation": "Keep content safe and appropriate"
        },
        "miami_message": "¡Estos son todas las tools que tengo! What do you need help with?"
    }


@app.get("/metrics")
async def get_metrics(app_instance: CartritalV2Application = Depends(get_cartrita_app)):
    """Get application metrics (placeholder for future monitoring)"""
    return {
        "metrics": {
            "uptime_seconds": (datetime.now(timezone.utc) - server_start_time).total_seconds(),
            "requests_processed": "not_implemented",
            "tokens_used": "not_implemented", 
            "agents_called": "not_implemented"
        },
        "miami_message": "Metrics coming soon! Por ahora just trust que todo está working bien."
    }


# Error handlers
@app.exception_handler(404)
async def not_found_handler(request, exc):
    return JSONResponse(
        status_code=404,
        content={
            "error": "not_found",
            "miami_message": "¡Ay! That endpoint no existe. Check /docs for available routes.",
            "available_endpoints": ["/", "/chat", "/health", "/status", "/agents", "/tools"]
        }
    )


@app.exception_handler(500)
async def internal_error_handler(request, exc):
    return JSONResponse(
        status_code=500,
        content={
            "error": "internal_server_error",
            "miami_message": "¡Ay caramba! Something broke on our end. We're looking into it.",
            "support": "Check logs or try again in a moment."
        }
    )


# Main function for running the server
def main():
    """Run the FastAPI server"""
    print("🏝️  Starting Cartrita V2 FastAPI Server")
    print("=" * 50)
    
    # Configuration
    host = os.getenv("HOST", "0.0.0.0")
    port = int(os.getenv("PORT", "8000"))
    reload = os.getenv("RELOAD", "false").lower() == "true"
    
    print(f"🌐 Server will run on: http://{host}:{port}")
    print(f"📚 API Documentation: http://{host}:{port}/docs")
    print(f"🔄 Auto-reload: {reload}")
    print("=" * 50)
    
    # Run server
    uvicorn.run(
        "fastapi_server_v2:app",
        host=host,
        port=port,
        reload=reload,
        log_level="info"
    )


if __name__ == "__main__":
    main()
"""
Python FastAPI Service for Cartrita Hybrid Architecture
Main entry point for Python AI/ML backend with MCP integration
"""

import asyncio
import logging
import os
import signal
import sys
from contextlib import asynccontextmanager
from pathlib import Path

import uvicorn
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

# Add project root to Python path
sys.path.insert(0, str(Path(__file__).parent))

# Import our modules
from mcp_core.bridge.python_bridge import initialize_python_bridge, get_mcp_bridge
from agents.ai_agents import MLModelAgent, DataAnalysisAgent, VectorSearchAgent
from faiss_service.main import faiss_service, FAISSService

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Configuration
SERVICE_NAME = "cartrita-python-backend"
SERVICE_VERSION = "2.0.0"
PORT = int(os.getenv("PORT", 8002))
HOST = os.getenv("HOST", "0.0.0.0")

# MCP Configuration
MCP_SOCKET_PATH = os.getenv("MCP_SOCKET_PATH", "/tmp/cartrita_mcp.sock")
NODE_SERVICE_URL = os.getenv("NODE_SERVICE_URL", "http://localhost:8000")
PYTHON_SERVICE_PORT = int(os.getenv("PYTHON_SERVICE_PORT", 8002))

# Global agents
ml_agent = None
data_agent = None
vector_agent = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan management"""
    logger.info(f"Starting {SERVICE_NAME} v{SERVICE_VERSION}")
    
    try:
        # Initialize MCP bridge
        logger.info("Initializing Python MCP bridge...")
        mcp_bridge = await initialize_python_bridge(
            socket_path=MCP_SOCKET_PATH,
            node_service_url=NODE_SERVICE_URL,
            python_service_port=PYTHON_SERVICE_PORT
        )
        
        # Initialize AI agents
        logger.info("Initializing AI agents...")
        global ml_agent, data_agent, vector_agent
        
        ml_agent = MLModelAgent()
        await ml_agent.initialize()
        
        data_agent = DataAnalysisAgent()
        await data_agent.initialize()
        
        vector_agent = VectorSearchAgent()
        await vector_agent.initialize()
        
        logger.info("All AI agents initialized successfully")
        
        # Initialize FAISS service if available
        if faiss_service:
            logger.info("FAISS service available")
        
        logger.info(f"{SERVICE_NAME} startup complete")
        
        yield
        
    except Exception as e:
        logger.error(f"Startup failed: {e}")
        raise
    
    finally:
        # Cleanup
        logger.info("Shutting down Python backend...")
        
        mcp_bridge = get_mcp_bridge()
        if mcp_bridge:
            await mcp_bridge.shutdown()
        
        logger.info("Python backend shutdown complete")


# Create FastAPI app
app = FastAPI(
    title="Cartrita Python Backend",
    description="Advanced AI/ML backend service for Cartrita hybrid architecture",
    version=SERVICE_VERSION,
    lifespan=lifespan
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure appropriately for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
async def root():
    """Service information endpoint"""
    return {
        "service": SERVICE_NAME,
        "version": SERVICE_VERSION,
        "description": "Python AI/ML backend with hybrid language support",
        "status": "operational",
        "capabilities": [
            "machine_learning_inference",
            "data_analysis", 
            "vector_search",
            "natural_language_processing",
            "statistical_analysis",
            "mcp_integration"
        ],
        "endpoints": {
            "health": "/health",
            "ml": "/api/ml/*",
            "data": "/api/data/*",
            "vector": "/api/vector/*",
            "mcp": "/api/mcp/*"
        }
    }


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    mcp_bridge = get_mcp_bridge()
    
    health_status = {
        "status": "healthy",
        "service": SERVICE_NAME,
        "version": SERVICE_VERSION,
        "timestamp": "2025-08-19T12:00:00Z",
        "components": {
            "mcp_bridge": "healthy" if mcp_bridge and mcp_bridge.is_connected else "unhealthy",
            "ml_agent": "healthy" if ml_agent else "not_initialized",
            "data_agent": "healthy" if data_agent else "not_initialized", 
            "vector_agent": "healthy" if vector_agent else "not_initialized",
            "faiss_service": "healthy" if faiss_service else "not_available"
        }
    }
    
    # Determine overall status
    unhealthy_components = [k for k, v in health_status["components"].items() if v != "healthy"]
    if unhealthy_components:
        health_status["status"] = "degraded"
        health_status["unhealthy_components"] = unhealthy_components
    
    status_code = 200 if health_status["status"] == "healthy" else 503
    return JSONResponse(content=health_status, status_code=status_code)


@app.get("/api/mcp/status")
async def mcp_status():
    """MCP bridge status"""
    mcp_bridge = get_mcp_bridge()
    
    if not mcp_bridge:
        raise HTTPException(status_code=503, detail="MCP bridge not available")
    
    return {
        "bridge_status": "connected" if mcp_bridge.is_connected else "disconnected",
        "registered_agents": len(mcp_bridge.registered_agents),
        "active_tasks": len(mcp_bridge.active_tasks),
        "statistics": mcp_bridge.stats,
        "socket_path": mcp_bridge.socket_path
    }


@app.get("/api/agents")
async def list_agents():
    """List available Python agents"""
    agents = []
    
    if ml_agent:
        agents.append({
            "name": ml_agent.name,
            "type": ml_agent.agent_type.value,
            "capabilities": [cap.dict() for cap in ml_agent.capabilities],
            "registered": ml_agent.is_registered,
            "metrics": getattr(ml_agent, 'task_metrics', {})
        })
    
    if data_agent:
        agents.append({
            "name": data_agent.name,
            "type": data_agent.agent_type.value,
            "capabilities": [cap.dict() for cap in data_agent.capabilities],
            "registered": data_agent.is_registered,
            "metrics": getattr(data_agent, 'analysis_metrics', {})
        })
    
    if vector_agent:
        agents.append({
            "name": vector_agent.name,
            "type": vector_agent.agent_type.value,
            "capabilities": [cap.dict() for cap in vector_agent.capabilities],
            "registered": vector_agent.is_registered,
            "metrics": getattr(vector_agent, 'search_metrics', {})
        })
    
    return {
        "agents": agents,
        "total_agents": len(agents)
    }


@app.post("/api/ml/inference")
async def ml_inference(request: dict):
    """ML model inference endpoint"""
    if not ml_agent:
        raise HTTPException(status_code=503, detail="ML agent not available")
    
    try:
        # Create task request
        from mcp_core.schema import TaskRequest, create_mcp_context
        
        task_request = TaskRequest(
            task_id=f"ml_{os.urandom(8).hex()}",
            task_type=request.get("task_type", "text_classification"),
            inputs=request.get("inputs", {}),
            options=request.get("options", {}),
            context=create_mcp_context()
        )
        
        # Execute task
        response = await ml_agent.execute_task(task_request)
        
        return {
            "success": True,
            "task_id": response.task_id,
            "status": response.status.value,
            "result": response.result,
            "metadata": response.metadata
        }
        
    except Exception as e:
        logger.error(f"ML inference failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/data/analysis")
async def data_analysis(request: dict):
    """Data analysis endpoint"""
    if not data_agent:
        raise HTTPException(status_code=503, detail="Data agent not available")
    
    try:
        from mcp_core.schema import TaskRequest, create_mcp_context
        
        task_request = TaskRequest(
            task_id=f"data_{os.urandom(8).hex()}",
            task_type=request.get("analysis_type", "statistical_analysis"),
            inputs=request.get("inputs", {}),
            options=request.get("options", {}),
            context=create_mcp_context()
        )
        
        response = await data_agent.execute_task(task_request)
        
        return {
            "success": True,
            "task_id": response.task_id,
            "status": response.status.value,
            "result": response.result,
            "metadata": response.metadata
        }
        
    except Exception as e:
        logger.error(f"Data analysis failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/vector/search")
async def vector_search(request: dict):
    """Vector search endpoint"""
    if not vector_agent:
        raise HTTPException(status_code=503, detail="Vector agent not available")
    
    try:
        from mcp_core.schema import TaskRequest, create_mcp_context
        
        task_request = TaskRequest(
            task_id=f"vector_{os.urandom(8).hex()}",
            task_type=request.get("search_type", "vector_similarity_search"),
            inputs=request.get("inputs", {}),
            options=request.get("options", {}),
            context=create_mcp_context()
        )
        
        response = await vector_agent.execute_task(task_request)
        
        return {
            "success": True,
            "task_id": response.task_id,
            "status": response.status.value,
            "result": response.result,
            "metadata": response.metadata
        }
        
    except Exception as e:
        logger.error(f"Vector search failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/vector/index")
async def index_documents(request: dict):
    """Document indexing endpoint"""
    if not vector_agent:
        raise HTTPException(status_code=503, detail="Vector agent not available")
    
    try:
        from mcp_core.schema import TaskRequest, create_mcp_context
        
        task_request = TaskRequest(
            task_id=f"index_{os.urandom(8).hex()}",
            task_type="document_indexing",
            inputs=request.get("inputs", {}),
            options=request.get("options", {}),
            context=create_mcp_context()
        )
        
        response = await vector_agent.execute_task(task_request)
        
        return {
            "success": True,
            "task_id": response.task_id,
            "status": response.status.value,
            "result": response.result,
            "metadata": response.metadata
        }
        
    except Exception as e:
        logger.error(f"Document indexing failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/stats")
async def service_stats():
    """Service statistics"""
    mcp_bridge = get_mcp_bridge()
    
    stats = {
        "service": SERVICE_NAME,
        "version": SERVICE_VERSION,
        "mcp_stats": mcp_bridge.stats if mcp_bridge else {},
        "agent_stats": {}
    }
    
    if ml_agent:
        stats["agent_stats"]["ml_agent"] = getattr(ml_agent, 'task_metrics', {})
    
    if data_agent:
        stats["agent_stats"]["data_agent"] = getattr(data_agent, 'analysis_metrics', {})
    
    if vector_agent:
        stats["agent_stats"]["vector_agent"] = getattr(vector_agent, 'search_metrics', {})
    
    return stats


# Graceful shutdown handler
async def shutdown_handler():
    """Handle graceful shutdown"""
    logger.info("Received shutdown signal")
    
    mcp_bridge = get_mcp_bridge()
    if mcp_bridge:
        await mcp_bridge.shutdown()
    
    logger.info("Graceful shutdown complete")


# Signal handlers
def handle_sigterm(signum, frame):
    """Handle SIGTERM signal"""
    logger.info("Received SIGTERM")
    asyncio.create_task(shutdown_handler())


def handle_sigint(signum, frame):
    """Handle SIGINT signal"""
    logger.info("Received SIGINT")
    asyncio.create_task(shutdown_handler())


if __name__ == "__main__":
    # Setup signal handlers
    signal.signal(signal.SIGTERM, handle_sigterm)
    signal.signal(signal.SIGINT, handle_sigint)
    
    # Run the service
    uvicorn.run(
        "main:app",
        host=HOST,
        port=PORT,
        log_level="info",
        reload=os.getenv("ENVIRONMENT", "production") == "development",
        access_log=True
    )
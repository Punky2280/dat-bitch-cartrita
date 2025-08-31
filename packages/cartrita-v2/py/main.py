"""
Enhanced Cartrita FastAPI Application with AI Agents, MCP, and LangChain Integration
"""
import os
import logging
from contextlib import asynccontextmanager
from pathlib import Path
from dotenv import load_dotenv

# Load environment variables from the parent directory .env file
env_path = Path(__file__).parent.parent / ".env"
if env_path.exists():
    load_dotenv(env_path)
    logging.info(f"Loaded environment variables from {env_path}")
    os.environ["CARTRITA_ENV_LOADED_FROM"] = str(env_path)
else:
    # Try loading from current directory
    load_dotenv()
    logging.info("Loaded environment variables from current directory")
    os.environ.setdefault("CARTRITA_ENV_LOADED_FROM", str(Path.cwd() / ".env"))

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse
import uvicorn

# Import routers
from enhanced_chat_routes import router as chat_router
from startup_checks import run_startup_checks
from config import get_settings

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)

# Application lifespan manager
@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application startup and shutdown events"""
    logger.info("🚀 Starting Cartrita Enhanced Backend")
    # Run startup checks early
    try:
        # Prefer non-GUI backend for matplotlib in server contexts
        if not os.getenv("XAUTHORITY"):
            os.environ.setdefault("MPLBACKEND", "Agg")
        checks = run_startup_checks()
        app.state.startup_checks = checks
        if not checks.get("ok", False):
            logger.warning("One or more startup checks failed. See /healthz/details.")
    except Exception as e:
        logger.warning(f"Startup checks failed to execute: {e}")
    
    # Import services to ensure they're loaded
    try:
        from cartrita_core.enhanced_agent_manager import enhanced_agent_manager
        from cartrita_core.mcp_integration import mcp_manager  
        from cartrita_core.langchain_integration import initialize_langchain
        # Note: backend_bridge is obsolete in Python-only mode
        
        logger.info("✅ All services loaded successfully")
        
    except Exception as e:
        logger.error(f"❌ Failed to load services: {e}")
        # Continue anyway, services will handle their own fallbacks
        
    yield
    
    # Cleanup
    logger.info("🛑 Shutting down Cartrita Enhanced Backend")

# Create FastAPI application
app = FastAPI(
    title="Cartrita Enhanced AI Assistant",
    description="Advanced AI assistant with multi-agent coordination, MCP integration, and LangChain workflows",
    version="2.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan
)

# Configure CORS - Updated for Python-only backend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:8000", "http://localhost:3000", "http://localhost:3001", "http://localhost:80"],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

# Include routers
app.include_router(chat_router)

# Root endpoint
@app.get("/", response_class=HTMLResponse)
async def root():
    """Root endpoint with system information"""
    checks = getattr(app.state, "startup_checks", {"ok": False})
    status_text = "ACTIVE" if checks.get("ok") else "DEGRADED"
    status_class = "active" if checks.get("ok") else ""
    html = """
    <!DOCTYPE html>
    <html>
    <head>
        <title>Cartrita Enhanced AI Assistant</title>
        <style>
            body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
                     color: white; padding: 20px; border-radius: 10px; text-align: center; }
            .feature { background: #f8f9fa; padding: 15px; margin: 10px 0; border-radius: 8px; border-left: 4px solid #667eea; }
            .status { display: inline-block; padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: bold; }
            .status.active { background: #28a745; color: white; }
            .endpoint { font-family: monospace; background: #f1f3f4; padding: 8px; border-radius: 4px; }
        </style>
    </head>
    <body>
        <div class="header">
            <h1>🤖 Cartrita Enhanced AI Assistant</h1>
            <p>Advanced Multi-Agent AI System with MCP & LangChain Integration</p>
            <p>Status: <span class="status {'active' if status_badge=='active' else ''}">{'ACTIVE' if status_badge=='active' else 'DEGRADED'}</span> · <a href="/healthz/details" style="color:#fff; text-decoration: underline;">details</a></p>
            <!--STATUS_LINE-->
        </div>
        
        <div class="feature">
            <h3>🎯 Enhanced Agent System</h3>
            <p><span class="status {'active' if status_badge=='active' else ''}">{'ACTIVE' if status_badge=='active' else 'DEGRADED'}</span> 13+ specialized AI agents with advanced capabilities</p>
            <p><strong>Agents:</strong> Supervisor, Research, Writer, Vision, Computer Use, Code Writer, Data Scientist, 
               Cybersecurity, Financial Analyst, Health Advisor, Tutor, Project Manager, Emotional Support, Comedian, API Manager</p>
        </div>
        
        <div class="feature">
            <h3>🔧 Model Context Protocol (MCP)</h3>
            <p><span class="status {'active' if status_badge=='active' else ''}">{'ACTIVE' if status_badge=='active' else 'DEGRADED'}</span> Advanced tool orchestration and external service integration</p>
            <p><strong>Servers:</strong> Cartrita Tools, Data Analysis, Computer Use</p>
        </div>
        
        <div class="feature">
            <h3>🔗 LangChain Integration</h3>
            <p><span class="status {'active' if status_badge=='active' else ''}">{'ACTIVE' if status_badge=='active' else 'DEGRADED'}</span> Advanced language model workflows and chain management</p>
            <p><strong>Chains:</strong> Conversation, Retrieval QA, Research, Code Analysis, Creative Writing</p>
        </div>
        
        <div class="feature">
            <h3>🐍 Python-Only Backend</h3>
            <p><span class="status {'active' if status_badge=='active' else ''}">{'ACTIVE' if status_badge=='active' else 'DEGRADED'}</span> Streamlined FastAPI backend with full AI capabilities</p>
            <p><strong>Features:</strong> PostgreSQL with pgvector, Redis caching, Docker containerization</p>
        </div>
        
        <div class="feature">
            <h3>📚 API Documentation</h3>
            <p>
                <a href="/docs" class="endpoint">📖 Swagger UI (/docs)</a> |
                <a href="/redoc" class="endpoint">📚 ReDoc (/redoc)</a>
            </p>
        </div>
        
        <div class="feature">
            <h3>🔗 Key Endpoints</h3>
            <p><strong>Chat:</strong> <span class="endpoint">POST /api/v2/chat/chat</span> - Enhanced chat with agent selection</p>
            <p><strong>Sessions:</strong> <span class="endpoint">GET/POST /api/v2/chat/sessions</span> - Manage chat sessions</p>
            <p><strong>Multi-Agent:</strong> <span class="endpoint">POST /api/v2/chat/multi-agent</span> - Multi-agent coordination</p>
            <p><strong>Agents:</strong> <span class="endpoint">GET /api/v2/chat/agents</span> - Available agents</p>
            <p><strong>Status:</strong> <span class="endpoint">GET /api/v2/chat/status</span> - System health</p>
        </div>
        
        <div class="feature">
            <h3>⚡ Advanced Features</h3>
            <ul>
                <li>🎭 ChatGPT/Claude-style streaming responses</li>
                <li>📁 File upload and attachment support</li>
                <li>💾 Comprehensive chat history and session management</li>
                <li>🤖 Multi-agent task coordination and delegation</li>
                <li>🔧 MCP tool execution and chaining</li>
                <li>⛓️ LangChain workflow orchestration</li>
                <li>🌐 Backend service bridge communication</li>
                <li>📊 Detailed execution tracking and analytics</li>
            </ul>
        </div>
        
        <footer style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; color: #666;">
            <p>Cartrita Enhanced AI Assistant v2.0.0 | FastAPI Backend</p>
        </footer>
    </body>
    </html>
    """
    status_line = f"<p>Status: <span class=\"status {status_class}\">{status_text}</span> · <a href=\"/healthz/details\">details</a></p>"
    return html.replace("<!--STATUS_LINE-->", status_line)

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "service": "cartrita-enhanced-backend",
        "version": "2.0.0"
    }

@app.get("/healthz/details")
async def healthz_details():
    """Detailed health including startup checks"""
    checks = getattr(app.state, "startup_checks", {"ok": False, "checks": []})
    return {"status": "ok" if checks.get("ok") else "degraded", **checks, "config": get_settings()["safe"]}

@app.get("/config/safe")
async def safe_config():
    """Return sanitized runtime and provider config (no secrets)."""
    return get_settings()["safe"]

# Error handlers
@app.exception_handler(404)
async def not_found_handler(request, exc):
    from fastapi.responses import JSONResponse
    return JSONResponse(content={"error": "Endpoint not found", "status": 404}, status_code=404)

@app.exception_handler(500)
async def server_error_handler(request, exc):
    from fastapi.responses import JSONResponse
    return JSONResponse(content={"error": "Internal server error", "status": 500}, status_code=500)

# Main entry point
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8003, reload=True)
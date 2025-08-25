"""
Enhanced Cartrita FastAPI Application with AI Agents, MCP, and LangChain Integration
"""
import os
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse
import uvicorn

# Import routers
from enhanced_chat_routes import router as chat_router

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
    
    # Import services to ensure they're loaded
    try:
        from cartrita_core.enhanced_agent_manager import enhanced_agent_manager
        from cartrita_core.mcp_integration import mcp_manager  
        from cartrita_core.langchain_integration import langchain_manager
        from cartrita_core.backend_bridge import backend_bridge
        
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

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001"],
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
    return """
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
        </div>
        
        <div class="feature">
            <h3>🎯 Enhanced Agent System</h3>
            <p><span class="status active">ACTIVE</span> 13+ specialized AI agents with advanced capabilities</p>
            <p><strong>Agents:</strong> Supervisor, Research, Writer, Vision, Computer Use, Code Writer, Data Scientist, 
               Cybersecurity, Financial Analyst, Health Advisor, Tutor, Project Manager, Emotional Support, Comedian, API Manager</p>
        </div>
        
        <div class="feature">
            <h3>🔧 Model Context Protocol (MCP)</h3>
            <p><span class="status active">ACTIVE</span> Advanced tool orchestration and external service integration</p>
            <p><strong>Servers:</strong> Cartrita Tools, Data Analysis, Computer Use</p>
        </div>
        
        <div class="feature">
            <h3>🔗 LangChain Integration</h3>
            <p><span class="status active">ACTIVE</span> Advanced language model workflows and chain management</p>
            <p><strong>Chains:</strong> Conversation, Retrieval QA, Research, Code Analysis, Creative Writing</p>
        </div>
        
        <div class="feature">
            <h3>🌉 Backend Bridge</h3>
            <p><span class="status active">ACTIVE</span> Seamless communication between Node.js and Python backends</p>
            <p><strong>Features:</strong> Service discovery, health monitoring, intelligent request routing</p>
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

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "service": "cartrita-enhanced-backend",
        "version": "2.0.0"
    }

# Error handlers
@app.exception_handler(404)
async def not_found_handler(request, exc):
    return {"error": "Endpoint not found", "status": 404}

@app.exception_handler(500)
async def server_error_handler(request, exc):
    return {"error": "Internal server error", "status": 500}

# Main entry point
if __name__ == "__main__":
    port = int(os.getenv("FASTAPI_PORT", "8002"))
    host = os.getenv("FASTAPI_HOST", "0.0.0.0")
    
    logger.info(f"🚀 Starting Cartrita Enhanced Backend on {host}:{port}")
    
    uvicorn.run(
        "main:app",
        host=host,
        port=port,
        reload=os.getenv("NODE_ENV") == "development",
        log_level="info"
    )
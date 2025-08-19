#!/usr/bin/env python3
"""
Cartrita FastAPI Service
AI/ML Processing Backend complementing Fastify frontend service
"""

import os
import asyncio
import logging
from contextlib import asynccontextmanager
from typing import List, Optional, Dict, Any
import time

import uvicorn
import structlog
from fastapi import FastAPI, HTTPException, Depends, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from pydantic import BaseModel, Field
from pydantic_settings import BaseSettings
import redis.asyncio as redis
import httpx

# Configure structured logging
structlog.configure(
    processors=[
        structlog.stdlib.filter_by_level,
        structlog.stdlib.add_logger_name,
        structlog.stdlib.add_log_level,
        structlog.stdlib.PositionalArgumentsFormatter(),
        structlog.dev.ConsoleRenderer()
    ],
    wrapper_class=structlog.stdlib.BoundLogger,
    logger_factory=structlog.stdlib.LoggerFactory(),
    cache_logger_on_first_use=True,
)

logger = structlog.get_logger()

class Settings(BaseSettings):
    # Service
    host: str = "0.0.0.0"
    port: int = 8002
    environment: str = "development"
    debug: bool = True
    
    # External Services
    fastify_url: str = "http://localhost:8001"
    redis_url: str = "redis://localhost:6379"
    database_url: str = "postgresql://user:pass@localhost:5432/cartrita"
    
    # AI/ML
    openai_api_key: Optional[str] = None
    huggingface_token: Optional[str] = None
    
    class Config:
        env_file = "../.env.v2"
        case_sensitive = False

settings = Settings()

# Pydantic Models
class HealthResponse(BaseModel):
    status: str
    version: str
    timestamp: str
    dependencies: Dict[str, str]

class AIRequest(BaseModel):
    prompt: str
    model: str = "gpt-3.5-turbo"
    temperature: float = Field(0.7, ge=0.0, le=2.0)
    max_tokens: int = Field(1000, ge=1, le=4000)
    metadata: Optional[Dict[str, Any]] = None

class AIResponse(BaseModel):
    response: str
    model: str
    tokens_used: int
    processing_time: float
    metadata: Optional[Dict[str, Any]] = None

class RAGRequest(BaseModel):
    query: str
    collection: str = "default"
    top_k: int = Field(5, ge=1, le=20)
    threshold: float = Field(0.7, ge=0.0, le=1.0)

class RAGResponse(BaseModel):
    results: List[Dict[str, Any]]
    query: str
    processing_time: float

# Global state
app_state = {
    "redis": None,
    "http_client": None
}

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown logic"""
    logger.info("🚀 Starting FastAPI service", port=settings.port, environment=settings.environment)
    
    # Initialize Redis connection
    try:
        app_state["redis"] = redis.from_url(settings.redis_url, decode_responses=True)
        await app_state["redis"].ping()
        logger.info("✅ Redis connection established")
    except Exception as e:
        logger.error("❌ Redis connection failed", error=str(e))
    
    # Initialize HTTP client
    app_state["http_client"] = httpx.AsyncClient(
        timeout=httpx.Timeout(30.0),
        limits=httpx.Limits(max_keepalive_connections=10, max_connections=50)
    )
    logger.info("✅ HTTP client initialized")
    
    yield
    
    # Cleanup
    if app_state["redis"]:
        await app_state["redis"].close()
        logger.info("🔴 Redis connection closed")
    
    if app_state["http_client"]:
        await app_state["http_client"].aclose()
        logger.info("🔴 HTTP client closed")

# Create FastAPI app
app = FastAPI(
    title="Cartrita FastAPI Service",
    description="AI/ML Processing Backend for Cartrita Multi-Agent OS",
    version="2.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan
)

# Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:8001", "*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(GZipMiddleware, minimum_size=1000)

# Dependencies
async def get_redis():
    if not app_state["redis"]:
        raise HTTPException(status_code=503, detail="Redis not available")
    return app_state["redis"]

async def get_http_client():
    if not app_state["http_client"]:
        raise HTTPException(status_code=503, detail="HTTP client not available")
    return app_state["http_client"]

# Routes

@app.get("/", response_model=Dict[str, Any])
async def root():
    """Service information"""
    return {
        "service": "Cartrita FastAPI Service",
        "version": "2.0.0",
        "description": "AI/ML Processing Backend",
        "docs": "/docs",
        "health": "/health",
        "features": [
            "AI Text Generation", 
            "RAG Pipeline", 
            "Vector Search", 
            "Agent Processing",
            "Background Tasks",
            "Redis Integration"
        ]
    }

@app.get("/health", response_model=HealthResponse)
async def health_check():
    """Health check with dependency status"""
    import datetime
    
    dependencies = {}
    
    # Check Redis
    try:
        if redis_client := app_state["redis"]:
            await redis_client.ping()
            dependencies["redis"] = "healthy"
        else:
            dependencies["redis"] = "unavailable"
    except Exception:
        dependencies["redis"] = "unhealthy"
    
    # Check Fastify service
    try:
        if http_client := app_state["http_client"]:
            response = await http_client.get(f"{settings.fastify_url}/health", timeout=5.0)
            dependencies["fastify"] = "healthy" if response.status_code == 200 else "unhealthy"
        else:
            dependencies["fastify"] = "unavailable"
    except Exception:
        dependencies["fastify"] = "unreachable"
    
    return HealthResponse(
        status="healthy" if all(v in ["healthy", "unavailable"] for v in dependencies.values()) else "degraded",
        version="2.0.0",
        timestamp=datetime.datetime.utcnow().isoformat(),
        dependencies=dependencies
    )

@app.post("/ai/generate", response_model=AIResponse)
async def generate_ai_response(
    request: AIRequest,
    background_tasks: BackgroundTasks,
    redis_client = Depends(get_redis)
):
    """Generate AI response using OpenAI"""
    import time
    import json
    from openai import AsyncOpenAI
    
    if not settings.openai_api_key:
        raise HTTPException(status_code=503, detail="OpenAI API key not configured")
    
    start_time = time.time()
    
    try:
        client = AsyncOpenAI(api_key=settings.openai_api_key)
        
        response = await client.chat.completions.create(
            model=request.model,
            messages=[{"role": "user", "content": request.prompt}],
            temperature=request.temperature,
            max_tokens=request.max_tokens
        )
        
        processing_time = time.time() - start_time
        result = AIResponse(
            response=response.choices[0].message.content or "",
            model=request.model,
            tokens_used=response.usage.total_tokens if response.usage else 0,
            processing_time=processing_time,
            metadata=request.metadata
        )
        
        # Cache result in Redis (background task)
        async def cache_result():
            cache_key = f"ai:response:{hash(request.prompt)}"
            await redis_client.setex(cache_key, 3600, json.dumps(result.dict()))
        
        background_tasks.add_task(cache_result)
        
        logger.info("AI response generated", 
                   model=request.model, 
                   tokens=response.usage.total_tokens if response.usage else 0, 
                   time=processing_time)
        
        return result
        
    except Exception as e:
        logger.error("AI generation failed", error=str(e))
        raise HTTPException(status_code=500, detail=f"AI generation failed: {str(e)}")

@app.post("/rag/search", response_model=RAGResponse)
async def rag_search(request: RAGRequest):
    """Vector-based RAG search (placeholder for now)"""
    import time
    
    start_time = time.time()
    
    # TODO: Implement actual vector search with FAISS/ChromaDB
    # This is a placeholder that will be expanded
    mock_results = [
        {
            "content": f"Mock result {i} for query: {request.query}",
            "score": 0.9 - (i * 0.1),
            "metadata": {"source": f"doc_{i}", "collection": request.collection}
        }
        for i in range(min(request.top_k, 3))
    ]
    
    processing_time = time.time() - start_time
    
    return RAGResponse(
        results=mock_results,
        query=request.query,
        processing_time=processing_time
    )

@app.post("/agents/process")
async def process_agent_request(
    agent_id: str,
    request: Dict[str, Any],
    background_tasks: BackgroundTasks,
    redis_client = Depends(get_redis),
    http_client = Depends(get_http_client)
):
    """Process agent requests and coordinate with Fastify"""
    
    # Process the agent request (placeholder)
    result = {
        "agent_id": agent_id,
        "status": "processed",
        "result": f"Processed request for agent {agent_id}",
        "timestamp": time.time()
    }
    
    # Notify Fastify service of completion
    async def notify_fastify():
        try:
            await http_client.post(
                f"{settings.fastify_url}/api/v2/agents/{agent_id}/notification",
                json={"type": "processing_complete", "data": result}
            )
        except Exception as e:
            logger.error("Failed to notify Fastify", agent_id=agent_id, error=str(e))
    
    background_tasks.add_task(notify_fastify)
    
    return result

@app.get("/metrics")
async def get_metrics():
    """Prometheus-style metrics"""
    return {
        "timestamp": time.time(),
        "service": "fastapi",
        "metrics": {
            "requests_total": 0,  # TODO: Implement actual metrics
            "response_time_avg": 0.0,
            "active_connections": 0
        }
    }

if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host=settings.host,
        port=settings.port,
        reload=settings.debug,
        log_level="debug" if settings.debug else "info"
    )
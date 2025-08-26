"""
Main FastAPI application for Cartrita backend.
"""

import os
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
import uvicorn

# Import routers
from app.api.chat.upload import router as upload_router
from app.api.transcription import live_router

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan manager."""
    logger.info("Starting Cartrita backend server...")
    yield
    logger.info("Shutting down Cartrita backend server...")

# Create FastAPI app
app = FastAPI(
    title="Cartrita API",
    description="Real-time chat application with file upload and voice transcription",
    version="2.0.0",
    lifespan=lifespan
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount static files for uploads
if os.path.exists("uploads"):
    app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

# Include routers
app.include_router(upload_router, prefix="/api/chat", tags=["chat"])
app.include_router(live_router, prefix="/api/transcription", tags=["transcription"])

# Health check endpoint
@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "healthy", "service": "cartrita-backend", "version": "2.0.0"}

# Root endpoint
@app.get("/")
async def root():
    """Root endpoint."""
    return {
        "message": "Cartrita Backend API", 
        "version": "2.0.0",
        "endpoints": {
            "health": "/health",
            "upload": "/api/chat/upload",
            "transcription": "/api/transcription/ws/transcribe/{session_id}",
            "docs": "/docs"
        }
    }

# Global exception handler
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Global exception handler."""
    logger.error(f"Unhandled exception: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={
            "error": "Internal server error",
            "detail": str(exc) if app.debug else "An unexpected error occurred"
        }
    )

if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info"
    )
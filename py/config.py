# Python Backend Configuration
# Configuration management for the Python service

import os
from pydantic_settings import BaseSettings
from typing import Optional, List


class Settings(BaseSettings):
    """Application settings with environment variable support."""
    
    # Database Configuration
    database_url: str = "postgresql://robert:punky1@localhost:5432/dat-bitch-cartrita"
    pguser: str = "robert"
    pgpassword: str = "punky1"
    pghost: str = "localhost"
    pgport: int = 5432
    pgdatabase: str = "dat-bitch-cartrita"
    
    # Redis Configuration
    redis_url: str = "redis://localhost:6379/0"
    redis_host: str = "localhost"
    redis_port: int = 6379
    redis_db: int = 0
    redis_password: Optional[str] = None
    
    # API Keys
    openai_api_key: str = "sk-proj-bF1fvxRLlkLJYpN6Yld6gWjr1Z4lH2e8kxXSBvKjdPLJA_hgTpz1rVHLe8YqpHGpJ8K6Lz0-2F_9bR5dN3pE6wJ8YlT3-vU7Q2sW8z"
    openai_org_id: Optional[str] = "org-5WLVJZ4pLv5pGzpTzKfVQv6K"
    anthropic_api_key: str = "sk-ant-api03-8n5YUmHb75lNPbqhJXdIWwOgV2nqL6m7qzE-0YxkJl3mvzsN1SrKe6zBGpPJQn3xqH"
    huggingface_api_key: str = "hf_SdJhqRmbNXKQvzOLfG3RpK7xYcpVZq2C8K"
    
    # Service Configuration
    python_service_port: int = 8002
    python_service_host: str = "0.0.0.0"
    nodejs_service_url: str = "http://localhost:8000"
    mcp_socket_path: str = "/tmp/cartrita_mcp.sock"
    
    # Observability
    jaeger_endpoint: str = "http://localhost:14268/api/traces"
    prometheus_port: int = 9090
    otel_exporter_jaeger_endpoint: str = "http://jaeger:14268/api/traces"
    otel_service_name: str = "cartrita-python-backend"
    otel_service_version: str = "2.0.0"
    
    # AI/ML Configuration
    transformers_cache: str = "/app/models"
    hf_home: str = "/app/models"
    torch_home: str = "/app/models"
    sentence_transformers_home: str = "/app/models"
    
    # Vector Search Configuration
    faiss_index_path: str = "/app/data/vector_index"
    vector_dimension: int = 1536
    max_vector_results: int = 100
    
    # Logging Configuration
    log_level: str = "INFO"
    log_format: str = "json"
    log_file: str = "/app/logs/python-backend.log"
    
    # Security
    secret_key: str = "your-secret-key-here-change-in-production"
    cors_origins: List[str] = [
        "http://localhost:3000",
        "http://localhost:5173",
        "http://localhost:8000"
    ]
    
    # Development/Production Mode
    environment: str = "development"
    debug: bool = True
    
    class Config:
        env_file = ".env"
        case_sensitive = False


# Global settings instance
settings = Settings()


# Environment setup for AI/ML libraries
def setup_environment():
    """Setup environment variables for AI/ML libraries."""
    os.environ["TRANSFORMERS_CACHE"] = settings.transformers_cache
    os.environ["HF_HOME"] = settings.hf_home
    os.environ["TORCH_HOME"] = settings.torch_home
    os.environ["SENTENCE_TRANSFORMERS_HOME"] = settings.sentence_transformers_home
    os.environ["TOKENIZERS_PARALLELISM"] = "false"  # Avoid tokenizer warnings
    
    # Create cache directories
    os.makedirs(settings.transformers_cache, exist_ok=True)
    os.makedirs(settings.hf_home, exist_ok=True)
    os.makedirs(settings.torch_home, exist_ok=True)
    os.makedirs(settings.sentence_transformers_home, exist_ok=True)
    os.makedirs(os.path.dirname(settings.faiss_index_path), exist_ok=True)
    os.makedirs(os.path.dirname(settings.log_file), exist_ok=True)


# Initialize environment on import
setup_environment()
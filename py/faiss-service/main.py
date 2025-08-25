#!/usr/bin/env python3
"""
Cartrita V2 - Python FAISS Vector Search Service
High-performance vector similarity search with hybrid retrieval capabilities
"""

import contextlib
import json
import os
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

# Vector processing
import faiss
import numpy as np
# Data handling
import redis
import structlog
# External APIs
import tiktoken
import uvicorn
# Utilities
from dotenv import load_dotenv
# FastAPI and server
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from opentelemetry import trace
from opentelemetry.exporter.jaeger.thrift import JaegerExporter
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor
# Monitoring
from prometheus_client import Counter, Gauge, Histogram, start_http_server
from pydantic import BaseModel, Field
from sentence_transformers import SentenceTransformer

# Load environment variables
load_dotenv()

# Configuration
SERVICE_NAME = "cartrita-faiss-service"
SERVICE_VERSION = "2.0.0"
PORT = int(os.getenv("PORT", 8002))
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/2")
MODEL_NAME = os.getenv("FAISS_MODEL_NAME", "all-MiniLM-L6-v2")
EMBEDDING_DIM = int(os.getenv("FAISS_EMBEDDING_DIM", 384))
INDEX_PATH = Path(os.getenv("FAISS_INDEX_PATH", "/data/faiss_index"))

# Setup structured logging
structlog.configure(
    processors=[
        structlog.stdlib.filter_by_level,
        structlog.stdlib.add_logger_name,
        structlog.stdlib.add_log_level,
        structlog.stdlib.PositionalArgumentsFormatter(),
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.StackInfoRenderer(),
        structlog.processors.format_exc_info,
        structlog.processors.JSONRenderer(),
    ],
    context_class=dict,
    logger_factory=structlog.stdlib.LoggerFactory(),
    wrapper_class=structlog.stdlib.BoundLogger,
    cache_logger_on_first_use=True,
)
logger = structlog.get_logger()


# Setup OpenTelemetry tracing
def setup_tracing():
    if os.getenv("JAEGER_ENDPOINT"):
        jaeger_exporter = JaegerExporter(
            agent_host_name=os.getenv("JAEGER_HOST", "localhost"),
            agent_port=int(os.getenv("JAEGER_PORT", 6831)),
        )

        span_processor = BatchSpanProcessor(jaeger_exporter)
        trace.set_tracer_provider(TracerProvider())
        trace.get_tracer_provider().add_span_processor(span_processor)

        logger.info("OpenTelemetry tracing initialized")


setup_tracing()
tracer = trace.get_tracer(SERVICE_NAME)

# Prometheus metrics
INDEX_SIZE = Gauge("faiss_index_size_total", "Total vectors in index")
MEMORY_USAGE = Gauge("faiss_memory_usage_bytes", "Memory usage of FAISS service")
SEARCH_REQUESTS = Counter(
    "faiss_search_requests_total", "Total search requests", ["method", "status"]
)
SEARCH_LATENCY = Histogram("faiss_search_duration_seconds", "Search request latency")


# Pydantic models
class SearchRequest(BaseModel):
    query: str = Field(..., description="Search query text")
    top_k: int = Field(default=10, ge=1, le=100, description="Number of results to return")
    threshold: float = Field(default=0.7, ge=0.0, le=1.0, description="Similarity threshold")
    filters: Optional[Dict[str, Any]] = Field(default=None, description="Metadata filters")
    hybrid_alpha: float = Field(
        default=0.7, ge=0.0, le=1.0, description="Dense vs sparse weighting"
    )
    rerank: bool = Field(default=True, description="Apply reranking")


class SearchResult(BaseModel):
    id: str = Field(..., description="Document ID")
    text: str = Field(..., description="Document text")
    score: float = Field(..., description="Similarity score")
    metadata: Dict[str, Any] = Field(default_factory=dict, description="Document metadata")


class SearchResponse(BaseModel):
    results: List[SearchResult] = Field(..., description="Search results")
    query_id: str = Field(..., description="Unique query identifier")
    total_results: int = Field(..., description="Total number of results")
    search_time_ms: float = Field(..., description="Search time in milliseconds")
    method: str = Field(..., description="Search method used")


class IndexRequest(BaseModel):
    documents: List[Dict[str, Any]] = Field(..., description="Documents to index")
    batch_size: int = Field(default=1000, ge=1, le=5000, description="Batch size for indexing")


class DocumentChunk(BaseModel):
    id: str
    text: str
    metadata: Dict[str, Any] = Field(default_factory=dict)
    embedding: Optional[List[float]] = None


class FAISSService:
    """Advanced FAISS-based vector search service with hybrid retrieval"""

    def __init__(self, config: Dict[str, Any]):
        self.config = config
        self.model_name = config.get("model_name", "all-MiniLM-L6-v2")
        self.embedding_dim = config.get("embedding_dim", 384)
        self.index_path = config.get("index_path", "./faiss_index")

        # Initialize sentence transformer
        self.encoder = SentenceTransformer(self.model_name)
        self.tokenizer = tiktoken.get_encoding("cl100k_base")

        # Initialize FAISS index
        self.index = None
        self.document_store = {}  # Maps vector IDs to document metadata
        self.id_to_vector_id = {}  # Maps document IDs to vector IDs
        self.vector_id_counter = 0

        # Redis connection for caching
        self.redis_client = None

        # Statistics
        self.stats = {
            "total_documents": 0,
            "total_searches": 0,
            "cache_hits": 0,
            "cache_misses": 0,
            "average_search_time": 0.0,
        }

        logger.info(
            "FAISS service initialized", model=self.model_name, embedding_dim=self.embedding_dim
        )

    async def initialize(self):
        """Initialize the FAISS service"""
        try:
            # Initialize FAISS index
            self.index = faiss.IndexFlatIP(
                self.embedding_dim
            )  # Inner product for cosine similarity

            # Connect to Redis for caching
            redis_url = os.getenv("REDIS_URL", "redis://localhost:6379")
            self.redis_client = redis.Redis.from_url(redis_url, decode_responses=True)

            # Load existing index if available
            await self.load_index()

            logger.info(
                "FAISS service startup complete", index_size=self.index.ntotal if self.index else 0
            )

        except Exception as e:
            logger.error("Failed to initialize FAISS service", error=str(e))
            raise

    async def load_index(self):
        """Load FAISS index from disk if it exists"""
        try:
            if os.path.exists(f"{self.index_path}.index"):
                self.index = faiss.read_index(f"{self.index_path}.index")

                # Load document store
                if os.path.exists(f"{self.index_path}.metadata.json"):
                    with open(f"{self.index_path}.metadata.json", "r") as f:
                        data = json.load(f)
                        self.document_store = data.get("document_store", {})
                        self.id_to_vector_id = data.get("id_to_vector_id", {})
                        self.vector_id_counter = data.get("vector_id_counter", 0)
                        self.stats = data.get("stats", self.stats)

                INDEX_SIZE.set(self.index.ntotal)
                logger.info("Loaded existing FAISS index", size=self.index.ntotal)
            else:
                logger.info("No existing index found, starting fresh")

        except Exception as e:
            logger.error("Failed to load FAISS index", error=str(e))
            # Continue with empty index
            self.index = faiss.IndexFlatIP(self.embedding_dim)

    async def save_index(self):
        """Save FAISS index to disk"""
        try:
            os.makedirs(os.path.dirname(self.index_path), exist_ok=True)

            # Save FAISS index
            faiss.write_index(self.index, f"{self.index_path}.index")

            # Save metadata
            metadata = {
                "document_store": self.document_store,
                "id_to_vector_id": self.id_to_vector_id,
                "vector_id_counter": self.vector_id_counter,
                "stats": self.stats,
                "saved_at": datetime.now(timezone.utc).isoformat(),
            }

            with open(f"{self.index_path}.metadata.json", "w") as f:
                json.dump(metadata, f, indent=2)

            logger.info("FAISS index saved successfully", size=self.index.ntotal)

        except Exception as e:
            logger.error("Failed to save FAISS index", error=str(e))

    def generate_embeddings(self, texts: List[str]) -> np.ndarray:
        """Generate embeddings for a list of texts"""
        try:
            embeddings = self.encoder.encode(texts, show_progress_bar=False)
            # Normalize for cosine similarity
            faiss.normalize_L2(embeddings)
            return embeddings.astype("float32")
        except Exception as e:
            logger.error("Failed to generate embeddings", error=str(e))
            raise HTTPException(status_code=500, detail="Embedding generation failed") from e

    async def index_documents(
        self, documents: List[Dict[str, Any]], batch_size: int = 1000
    ) -> Dict[str, Any]:
        """Index a batch of documents"""
        start_time = datetime.now(timezone.utc)

        try:
            indexed_count = 0

            for i in range(0, len(documents), batch_size):
                batch = documents[i:i + batch_size]

                # Prepare texts and metadata
                texts = []
                doc_metadata = []

                for doc in batch:
                    doc_id = doc.get("id", str(uuid.uuid4()))
                    text = doc.get("text", "")
                    metadata = doc.get("metadata", {})

                    # Skip if already indexed
                    if doc_id in self.id_to_vector_id:
                        continue

                    texts.append(text)
                    doc_metadata.append(
                        {
                            "id": doc_id,
                            "text": text,
                            "metadata": metadata,
                            "indexed_at": datetime.now(timezone.utc).isoformat(),
                            "token_count": len(self.tokenizer.encode(text)),
                        }
                    )

                if not texts:
                    continue

                # Generate embeddings
                embeddings = self.generate_embeddings(texts)

                # Add to FAISS index
                start_vector_id = self.vector_id_counter
                self.index.add(embeddings)

                # Update mappings
                for j, doc_meta in enumerate(doc_metadata):
                    vector_id = start_vector_id + j
                    doc_id = doc_meta["id"]

                    self.document_store[str(vector_id)] = doc_meta
                    self.id_to_vector_id[doc_id] = vector_id

                self.vector_id_counter += len(embeddings)
                indexed_count += len(embeddings)

            # Update statistics
            self.stats["total_documents"] = self.index.ntotal
            INDEX_SIZE.set(self.index.ntotal)

            # Save index periodically
            if indexed_count > 0:
                await self.save_index()

            processing_time = (datetime.now(timezone.utc) - start_time).total_seconds() * 1000

            logger.info(
                "Documents indexed successfully",
                indexed=indexed_count,
                total=self.index.ntotal,
                time_ms=processing_time,
            )

            return {
                "indexed_count": indexed_count,
                "total_documents": self.index.ntotal,
                "processing_time_ms": processing_time,
            }

        except Exception as e:
            logger.error("Failed to index documents", error=str(e))
            raise HTTPException(status_code=500, detail="Document indexing failed") from e

    async def search(
        self,
        query: str,
        top_k: int = 10,
        threshold: float = 0.7,
        filters: Optional[Dict[str, Any]] = None,
        hybrid_alpha: float = 0.7,
        rerank: bool = True,
    ) -> Dict[str, Any]:
        """Perform hybrid search with dense and sparse retrieval"""

        start_time = datetime.now(timezone.utc)
        query_id = str(uuid.uuid4())

        try:
            # Check cache first
            cache_key = f"search:{hash(query)}:{top_k}:{threshold}:{hybrid_alpha}"

            if self.redis_client:
                with contextlib.suppress(Exception):
                    if cached_result := self.redis_client.get(cache_key):
                        self.stats["cache_hits"] += 1
                        result = json.loads(cached_result)
                        result["query_id"] = query_id
                        result["method"] = "cached"
                        return result

            self.stats["cache_misses"] += 1

            # Generate query embedding
            query_embedding = self.generate_embeddings([query])[0].reshape(1, -1)

            # Perform dense search
            scores, indices = self.index.search(query_embedding, min(top_k * 2, self.index.ntotal))

            # Filter and prepare results
            results = []
            for score, idx in zip(scores[0], indices[0]):
                if idx == -1:  # FAISS uses -1 for invalid results
                    continue

                if score < threshold:
                    continue

                doc_meta = self.document_store.get(str(idx), {})
                if not doc_meta:
                    continue

                # Apply filters if provided
                if filters and not self._apply_filters(doc_meta.get("metadata", {}), filters):
                    continue

                results.append(
                    SearchResult(
                        id=doc_meta.get("id", str(idx)),
                        text=doc_meta.get("text", ""),
                        score=float(score),
                        metadata=doc_meta.get("metadata", {}),
                    )
                )

            # Apply reranking if requested
            if rerank and len(results) > 1:
                results = await self._rerank_results(query, results)

            # Limit to requested top_k
            results = results[:top_k]

            # Update statistics
            self.stats["total_searches"] += 1
            processing_time = (datetime.now(timezone.utc) - start_time).total_seconds() * 1000
            self.stats["average_search_time"] = ((
                self.stats["average_search_time"] * (self.stats["total_searches"] - 1)
                + processing_time
            ) / self.stats["total_searches"])

            response = {
                "results": [r.dict() for r in results],
                "query_id": query_id,
                "total_results": len(results),
                "search_time_ms": processing_time,
                "method": "hybrid" if hybrid_alpha < 1.0 else "dense",
            }

            # Cache result
            if self.redis_client and len(results) > 0:
                try:
                    self.redis_client.setex(cache_key, 300, json.dumps(response))
                except Exception:
                    pass

            logger.info(
                "Search completed",
                query_id=query_id,
                results_count=len(results),
                time_ms=processing_time,
            )

            return response

        except Exception as e:
            logger.error("Search failed", query_id=query_id, error=str(e))
            raise HTTPException(status_code=500, detail="Search operation failed") from e

    def _apply_filters(self, metadata: Dict[str, Any], filters: Dict[str, Any]) -> bool:
        """Apply metadata filters to search results"""
        try:
            for key, expected_value in filters.items():
                if key not in metadata:
                    return False

                actual_value = metadata[key]

                if isinstance(expected_value, dict):
                    # Range filters like {'$gte': 10, '$lt': 100}
                    for op, value in expected_value.items():
                        if (op == "$gte" and actual_value < value) or \
                           (op == "$gt" and actual_value <= value) or \
                           (op == "$lte" and actual_value > value) or \
                           (op == "$lt" and actual_value >= value) or \
                           (op == "$ne" and actual_value == value) or \
                           (op == "$in" and actual_value not in value) or \
                           (op == "$nin" and actual_value in value):
                            return False
                elif isinstance(expected_value, list):
                    # Multiple choice
                    if actual_value not in expected_value:
                        return False
                else:
                    # Exact match
                    if actual_value != expected_value:
                        return False

            return True

        except Exception as e:
            logger.error("Filter application failed", error=str(e))
            return False

    async def _rerank_results(self, query: str, results: List[SearchResult]) -> List[SearchResult]:
        """Apply reranking to improve result quality"""
        try:
            # Simple reranking based on text similarity and metadata features
            # In production, you might use a specialized reranking model

            for result in results:
                # Combine similarity score with text length and other features
                text_length_factor = min(len(result.text) / 1000, 1.0)  # Prefer longer texts
                metadata_boost = 1.0

                # Boost based on metadata
                if "category" in result.metadata:
                    metadata_boost += 0.1
                if "timestamp" in result.metadata:
                    # Boost more recent documents
                    with contextlib.suppress(Exception):
                        timestamp = datetime.fromisoformat(result.metadata["timestamp"])
                        age_days = (datetime.now(timezone.utc) - timestamp).days
                        recency_boost = max(0, 1 - age_days / 365)  # Linear decay over 1 year
                        metadata_boost += recency_boost * 0.2

                # Combine factors
                result.score = result.score * (1 + text_length_factor * 0.1 + metadata_boost * 0.1)

            # Sort by adjusted score
            results.sort(key=lambda r: r.score, reverse=True)
            return results

        except Exception as e:
            logger.error("Reranking failed", error=str(e))
            return results

    async def get_stats(self) -> Dict[str, Any]:
        """Get service statistics"""
        return {
            **self.stats,
            "index_size": self.index.ntotal if self.index else 0,
            "memory_usage_mb": self._get_memory_usage(),
            "model_name": self.model_name,
            "embedding_dim": self.embedding_dim,
        }

    def _get_memory_usage(self) -> float:
        """Estimate memory usage in MB"""
        try:
            import psutil

            process = psutil.Process(os.getpid())
            return process.memory_info().rss / 1024 / 1024
        except Exception:
            return 0.0


# Global service instance
faiss_service = None

# FastAPI app
app = FastAPI(
    title="Cartrita FAISS Vector Search Service",
    description="Advanced vector search with hybrid retrieval and reranking",
    version="1.0.0",
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure appropriately for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup_event():
    """Initialize the FAISS service on startup"""
    global faiss_service

    config = {
        "model_name": os.getenv("FAISS_MODEL_NAME", "all-MiniLM-L6-v2"),
        "embedding_dim": int(os.getenv("FAISS_EMBEDDING_DIM", "384")),
        "index_path": os.getenv("FAISS_INDEX_PATH", "./data/faiss_index"),
    }

    faiss_service = FAISSService(config)
    await faiss_service.initialize()

    # Start Prometheus metrics server
    start_http_server(8001)
    logger.info("FAISS service started successfully")


@app.on_event("shutdown")
async def shutdown_event():
    """Cleanup on shutdown"""
    global faiss_service
    if faiss_service:
        await faiss_service.save_index()
    logger.info("FAISS service stopped")


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    global faiss_service
    if not faiss_service or not faiss_service.index:
        raise HTTPException(status_code=503, detail="Service not ready")

    return {
        "status": "healthy",
        "service": "faiss-vector-search",
        "version": "1.0.0",
        "index_size": faiss_service.index.ntotal,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


@app.post("/search", response_model=SearchResponse)
async def search_documents(request: SearchRequest):
    """Perform vector search"""
    global faiss_service

    SEARCH_REQUESTS.labels(method="search", status="started").inc()

    try:
        with SEARCH_LATENCY.time():
            result = await faiss_service.search(
                query=request.query,
                top_k=request.top_k,
                threshold=request.threshold,
                filters=request.filters,
                hybrid_alpha=request.hybrid_alpha,
                rerank=request.rerank,
            )

        SEARCH_REQUESTS.labels(method="search", status="success").inc()
        return SearchResponse(**result)

    except Exception:
        SEARCH_REQUESTS.labels(method="search", status="error").inc()
        raise


@app.post("/index")
async def index_documents(request: IndexRequest):
    """Index new documents"""
    global faiss_service

    try:
        result = await faiss_service.index_documents(
            documents=request.documents, batch_size=request.batch_size
        )

        return {
            "status": "success",
            "message": f"Indexed {result['indexed_count']} documents",
            **result,
        }

    except Exception as e:
        logger.error("Indexing failed", error=str(e))
        raise


@app.get("/stats")
async def get_stats():
    """Get service statistics"""
    global faiss_service

    stats = await faiss_service.get_stats()
    return {"status": "success", "stats": stats}


@app.delete("/index/{document_id}")
async def delete_document(document_id: str):
    """Delete a document from the index"""
    # Note: FAISS doesn't support deletion directly
    # This would require rebuilding the index or using a tombstone approach
    raise HTTPException(status_code=501, detail="Document deletion not implemented")


@app.get("/")
async def root():
    """Service information"""
    return {
        "service": "Cartrita FAISS Vector Search",
        "version": "1.0.0",
        "description": "Advanced vector search with hybrid retrieval",
        "endpoints": {
            "search": "/search",
            "index": "/index",
            "stats": "/stats",
            "health": "/health",
        },
    }


if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=int(os.getenv("PORT", 8002)),
        log_level="info",
        reload=os.getenv("ENVIRONMENT", "production") == "development",
    )

# Enhanced RAG System - Phase C Implementation

## Overview

This document outlines the implementation of Phase C of the Cartrita Unified Workflow Automation Platform, which transforms the existing AI system into a comprehensive RAG (Retrieval Augmented Generation) platform with Gemini embeddings integration.

## 🎯 Key Features Implemented

### 1. Gemini Integration
- **Text-embedding-004 model** with 768-dimensional vectors
- **Automatic API key management** via secure key vault
- **Graceful fallback** to environment variables

### 2. Document Ingestion Pipeline  
- **Smart text chunking** with configurable size (default: 1000 chars)
- **Overlap control** for context preservation (default: 200 chars)
- **Multiple format support** (text, markdown, HTML, CSV, JSON)
- **Metadata preservation** and source tracking

### 3. Vector Similarity Search
- **Cosine similarity** with configurable threshold (default: 0.7)
- **Top-K retrieval** with customizable limits
- **Document filtering** by ID or metadata
- **Deduplication** for improved results

### 4. New API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/rag/documents` | Upload and ingest documents |
| GET | `/api/rag/documents` | List/search documents |
| DELETE | `/api/rag/documents/:id` | Delete documents |
| POST | `/api/rag/search` | Vector similarity search |
| GET | `/api/rag/stats` | Knowledge base statistics |
| GET | `/api/rag/status` | Service status |

## 🔧 Configuration

### Environment Variables

```bash
# RAG System Configuration
RAG_ENABLED=true                    # Enable/disable RAG features
RAG_CHUNK_SIZE=1000                 # Document chunk size
RAG_CHUNK_OVERLAP=200               # Chunk overlap for context
RAG_SIMILARITY_THRESHOLD=0.7        # Minimum similarity for results
RAG_TOP_K=5                         # Maximum results per search

# API Keys
GEMINI_API_KEY=your_gemini_key      # Google Gemini API key
GOOGLE_API_KEY=your_google_key      # Alternative Google API key
```

### Database Requirements

The system uses existing knowledge tables:
- `knowledge_documents` - Document metadata and content
- `knowledge_chunks` - Text chunks with vector embeddings

Requires **PostgreSQL with pgvector extension** for vector operations.

## 🚀 API Usage Examples

### 1. Upload a Document

```bash
# File upload
curl -X POST http://localhost:8001/api/rag/documents \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "file=@document.txt" \
  -F "title=My Document" \
  -F "metadata={\"category\": \"research\"}"

# JSON content
curl -X POST http://localhost:8001/api/rag/documents \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Test Document",
    "content": "This is a test document about AI.",
    "metadata": {"source": "api"}
  }'
```

### 2. Search Documents

```bash
curl -X POST http://localhost:8001/api/rag/search \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "artificial intelligence",
    "limit": 5,
    "threshold": 0.7,
    "includeChunks": true,
    "generateResponse": true
  }'
```

### 3. List Documents

```bash
curl -X GET "http://localhost:8001/api/rag/documents?limit=10&search=AI" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 4. Get Statistics

```bash
curl -X GET http://localhost:8001/api/rag/stats \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## 🏗️ Architecture Integration

### Service Layer
- **GeminiEmbeddingService** - Handles embedding generation
- **EnhancedRAGService** - Complete RAG pipeline
- **IntegratedAIService** - Enhanced with dual RAG support

### Backward Compatibility
- Existing knowledge hub functionality preserved
- Automatic fallback from enhanced to original RAG
- All existing APIs continue to work unchanged

### Feature Gating
- RAG functionality controlled by `RAG_ENABLED` environment variable
- Graceful degradation when services unavailable
- Safe incremental deployment support

## 📊 Monitoring & Observability

### OpenTelemetry Integration
- All RAG operations traced with spans
- Performance metrics collected
- Error tracking and debugging support

### Key Metrics
- Document ingestion rate and success
- Embedding generation latency
- Search performance and accuracy
- Vector similarity distributions

## 🔒 Security Features

### Authentication & Authorization
- All endpoints require valid JWT tokens
- Document ownership validation
- User-scoped operations and isolation

### Data Protection
- API key encryption via key vault
- Secure file handling with size limits
- Input validation and sanitization

### Error Handling
- Comprehensive error messages
- Graceful service degradation
- No sensitive data exposure

## 🧪 Testing & Validation

Run the validation script to verify implementation:

```bash
cd packages/backend
RAG_ENABLED=true node validate-rag-system.js
```

Expected output: ✅ All components verified and working

## 📝 Next Steps

### Database Setup
1. Install PostgreSQL with pgvector extension
2. Run existing database migrations
3. Verify knowledge tables exist

### API Key Configuration
1. Obtain Gemini API key from Google AI Studio
2. Add to secure key vault or environment variables
3. Test embedding generation

### Frontend Integration
1. Implement RAG toggle in chat interface
2. Add document management UI components
3. Display search results and sources

### Production Deployment
1. Configure monitoring and alerting
2. Set up backup and recovery procedures
3. Implement rate limiting and caching
4. Scale vector database as needed

## 🆘 Troubleshooting

### Common Issues

**Service not initializing:**
- Check `RAG_ENABLED=true` in environment
- Verify Gemini API key is set
- Check database connectivity and pgvector extension

**Embedding generation failing:**
- Validate Gemini API key permissions
- Check API rate limits and quotas
- Verify internet connectivity

**Search returning no results:**
- Check similarity threshold (try lower values)
- Verify documents have been ingested
- Check embedding dimensions match (768)

### Debug Commands

```bash
# Check service status
curl http://localhost:8001/api/rag/status

# Validate environment
RAG_ENABLED=true node validate-rag-system.js

# Check database tables
psql -d cartrita -c "SELECT COUNT(*) FROM knowledge_documents;"
```

## 📚 Resources

- [Google Gemini Embedding API](https://cloud.google.com/vertex-ai/docs/generative-ai/embeddings/get-text-embeddings)
- [pgvector Documentation](https://github.com/pgvector/pgvector)
- [LangChain Text Splitters](https://python.langchain.com/docs/modules/data_connection/document_transformers/)

---

**Status:** ✅ Implementation Complete - Ready for Testing and Deployment
**Version:** Phase C v1.0
**Last Updated:** December 2024
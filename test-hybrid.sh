#!/bin/bash
set -e

echo "🧪 Cartrita Hybrid Backend Smoke Test"

# Test FastAPI service
echo "🐍 Testing FastAPI service..."
if curl -s http://localhost:8002/health > /dev/null; then
    echo "✅ FastAPI health check passed"
    
    # Test AI generation endpoint
    response=$(curl -s -X POST http://localhost:8002/ai/generate \
        -H "Content-Type: application/json" \
        -d '{"prompt": "Hello, this is a test"}' || echo "FAILED")
    
    if [[ "$response" == *"response"* ]]; then
        echo "✅ FastAPI AI generation endpoint working"
    else
        echo "❌ FastAPI AI generation failed: $response"
    fi
else
    echo "❌ FastAPI service not responding"
fi

# Test Fastify service
echo "⚡ Testing Fastify service..."
if curl -s http://localhost:8001/health > /dev/null; then
    echo "✅ Fastify health check passed"
    
    # Test AI proxy endpoint
    response=$(curl -s -X POST http://localhost:8001/api/v2/ai/generate \
        -H "Content-Type: application/json" \
        -d '{"prompt": "Hello from Fastify proxy"}' || echo "FAILED")
    
    if [[ "$response" == *"success"* ]]; then
        echo "✅ Fastify AI proxy endpoint working"
    else
        echo "❌ Fastify AI proxy failed: $response"
    fi
    
    # Test compatibility endpoint
    if curl -s http://localhost:8001/api/system/health > /dev/null; then
        echo "✅ Fastify compatibility endpoints working"
    else
        echo "❌ Fastify compatibility endpoints failed"
    fi
else
    echo "❌ Fastify service not responding"
fi

# Test Socket.IO connection
echo "🔌 Testing Socket.IO..."
if command -v node > /dev/null; then
    node socket-io-test.js | head -5 &
    SOCKET_PID=$!
    sleep 3
    kill $SOCKET_PID 2>/dev/null || true
    echo "✅ Socket.IO test completed"
else
    echo "⚠️  Node.js not found, skipping Socket.IO test"
fi

echo "🎉 Smoke test completed!"
echo "📚 API Documentation:"
echo "  Fastify: http://localhost:8001/api/docs"
echo "  FastAPI: http://localhost:8002/docs"
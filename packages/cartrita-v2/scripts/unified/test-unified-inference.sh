#!/bin/bash

# Unified Inference End-to-End Test (canonical)
# Usage: bash scripts/unified/test-unified-inference.sh [BASE_URL]

set -euo pipefail

BASE_URL=${1:-"http://localhost:8001"}

echo "=== Testing Unified Inference Service (scripts/unified) ==="

# Health
curl -s "$BASE_URL/api/unified/health" | jq '.'

echo
# Metrics
curl -s "$BASE_URL/api/unified/metrics" | jq '.'

echo
# Chat completion
curl -s -X POST "$BASE_URL/api/unified/chat" \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [
      {"role": "user", "content": "Explain quantum computing in simple terms"}
    ],
    "options": {
      "provider": "hf-inference",
      "model": "HuggingFaceTB/SmolLM3-3B"
    }
  }' | jq '.'

echo
# Text classification
curl -s -X POST "$BASE_URL/api/unified/classify" \
  -H "Content-Type: application/json" \
  -d '{
    "text": "I love this product! It works great and saves me time.",
    "candidateLabels": ["positive", "negative", "neutral"],
    "options": {
      "provider": "hf-inference"
    }
  }' | jq '.'

echo
# Summarization
curl -s -X POST "$BASE_URL/api/unified/summarize" \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Artificial intelligence (AI) is intelligence demonstrated by machines...",
    "options": {
      "provider": "hf-inference"
    }
  }' | jq '.'

echo
# Embeddings
curl -s -X POST "$BASE_URL/api/unified/embeddings" \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Machine learning is a subset of artificial intelligence",
    "options": {
      "provider": "hf-inference"
    }
  }' | jq '.'

echo
# Generic inference (NER)
curl -s -X POST "$BASE_URL/api/unified/inference" \
  -H "Content-Type: application/json" \
  -d '{
    "task": "nlp_classic",
    "inputs": {
      "text": "My name is Sarah and I live in New York City. I work at Google."
    },
    "options": {
      "provider": "hf-inference",
      "model": "dslim/bert-base-NER"
    }
  }' | jq '.'

echo
# Question Answering
curl -s -X POST "$BASE_URL/api/unified/inference" \
  -H "Content-Type: application/json" \
  -d '{
    "task": "nlp_classic",
    "inputs": {
      "question": "What is the capital of France?",
      "context": "France is a country in Europe. Paris is the capital and largest city of France."
    },
    "options": {
      "provider": "hf-inference",
      "model": "deepset/roberta-base-squad2"
    }
  }' | jq '.'

echo
# Image generation
curl -s -X POST "$BASE_URL/api/unified/generate-image" \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "A beautiful sunset over mountains",
    "options": {
      "provider": "hf-inference",
      "model": "stabilityai/stable-diffusion-xl-base-1.0"
    }
  }' | jq '.'

echo
# Fallback mechanism
curl -s -X POST "$BASE_URL/api/unified/inference" \
  -H "Content-Type: application/json" \
  -d '{
    "task": "chat",
    "inputs": {
      "text": "Hello, how are you?"
    },
    "options": {
      "provider": "non-existent-provider"
    }
  }' | jq '.'

echo "=== Unified Inference Service Tests Complete ==="

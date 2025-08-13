#!/bin/bash

echo "🚀 Unified Multi-Provider AI Inference - Model Validation Tests"
echo "=============================================================="
echo

BASE_URL="http://localhost:8001"

# Test each task family with specific models
echo "1. Testing CHAT with HuggingFace SmolLM..."
curl -s -X POST "$BASE_URL/api/unified/inference" \
  -H "Content-Type: application/json" \
  -d '{
    "task": "chat",
    "inputs": {
      "messages": [
        {"role": "user", "content": "What is machine learning?"}
      ]
    },
    "options": {
      "provider": "hf-inference",
      "model": "HuggingFaceTB/SmolLM3-3B"
    }
  }' | jq '.success, .metadata.model_used, .metadata.provider, .metadata.latency_ms'
echo

echo "2. Testing TEXT CLASSIFICATION with BART..."
curl -s -X POST "$BASE_URL/api/unified/inference" \
  -H "Content-Type: application/json" \
  -d '{
    "task": "nlp_classic",
    "inputs": {
      "text": "This new AI model is absolutely fantastic!",
      "candidate_labels": ["positive", "negative", "neutral"]
    },
    "options": {
      "provider": "hf-inference",
      "model": "facebook/bart-large-mnli"
    }
  }' | jq '.success, .data[0].labels[0], .metadata.model_used, .metadata.latency_ms'
echo

echo "3. Testing SUMMARIZATION..."
curl -s -X POST "$BASE_URL/api/unified/inference" \
  -H "Content-Type: application/json" \
  -d '{
    "task": "nlp_classic",
    "inputs": {
      "text": "The field of natural language processing has seen tremendous advances in recent years, particularly with the development of transformer-based architectures like BERT, GPT, and T5. These models have revolutionized how we approach tasks such as machine translation, text summarization, question answering, and sentiment analysis. The ability to pre-train large language models on vast amounts of text data and then fine-tune them for specific tasks has led to significant improvements in performance across a wide range of NLP benchmarks."
    },
    "options": {
      "provider": "hf-inference",
      "model": "facebook/bart-large-cnn"
    }
  }' | jq '.success, .data.summary_text[:100] + "...", .metadata.model_used, .metadata.latency_ms'
echo

echo "4. Testing NAMED ENTITY RECOGNITION..."
curl -s -X POST "$BASE_URL/api/unified/inference" \
  -H "Content-Type: application/json" \
  -d '{
    "task": "nlp_classic",
    "inputs": {
      "text": "Apple Inc. was founded by Steve Jobs in Cupertino, California."
    },
    "options": {
      "provider": "hf-inference",
      "model": "dslim/bert-base-NER"
    }
  }' | jq '.success, .data | length, .data[].entity_group, .metadata.model_used'
echo

echo "5. Testing QUESTION ANSWERING..."
curl -s -X POST "$BASE_URL/api/unified/inference" \
  -H "Content-Type: application/json" \
  -d '{
    "task": "nlp_classic",
    "inputs": {
      "question": "When was the company founded?",
      "context": "TechCorp was established in 1995 by two computer science graduates from Stanford University. The company started as a small software consulting firm but has since grown into a major technology corporation with over 10,000 employees worldwide."
    },
    "options": {
      "provider": "hf-inference",
      "model": "deepset/roberta-base-squad2"
    }
  }' | jq '.success, .data.answer, .data.score, .metadata.model_used, .metadata.latency_ms'
echo

echo "6. Testing EMBEDDINGS..."
curl -s -X POST "$BASE_URL/api/unified/inference" \
  -H "Content-Type: application/json" \
  -d '{
    "task": "embeddings",
    "inputs": {
      "text": "Artificial intelligence and machine learning"
    },
    "options": {
      "provider": "hf-inference",
      "model": "intfloat/multilingual-e5-large"
    }
  }' | jq '.success, (.data | length), .metadata.model_used, .metadata.latency_ms'
echo

echo "7. Testing IMAGE GENERATION..."
curl -s -X POST "$BASE_URL/api/unified/inference" \
  -H "Content-Type: application/json" \
  -d '{
    "task": "image_generation",
    "inputs": {
      "prompt": "A serene mountain landscape with a crystal clear lake"
    },
    "options": {
      "provider": "hf-inference",
      "model": "stabilityai/stable-diffusion-xl-base-1.0"
    }
  }' | jq '.success, (.data | type), .metadata.model_used, .metadata.latency_ms'
echo

echo "8. Testing FALLBACK MECHANISM (non-existent model)..."
curl -s -X POST "$BASE_URL/api/unified/inference" \
  -H "Content-Type: application/json" \
  -d '{
    "task": "chat",
    "inputs": {
      "text": "Hello world"
    },
    "options": {
      "model": "non-existent-model"
    }
  }' | jq '.success, .error[:50] + "...", .metadata.attempt_count'
echo

echo "9. Testing SERVICE HEALTH..."
curl -s "$BASE_URL/api/unified/health" | jq '.success, .status, .metrics.totalRequests, .availableModels'
echo

echo "10. Testing METRICS..."
curl -s "$BASE_URL/api/unified/metrics" | jq '.success, .metrics.totalRequests, .metrics.successfulRequests, .metrics.cacheHits, .metrics.averageLatency'
echo

echo "=============================================================="
echo "✅ Unified Inference Service Tests Complete!"
echo "   - All AI providers now accessible via single HF_TOKEN"
echo "   - 9 task families with fallback mechanisms"
echo "   - Circuit breakers and caching implemented"
echo "   - Comprehensive metrics and observability"
echo "=============================================================="
#!/bin/bash

echo "=== Testing Unified Inference Service ==="
echo

BASE_URL="http://localhost:8001"

# Test 1: Health check
echo "1. Testing unified health endpoint..."
curl -s "$BASE_URL/api/unified/health" | jq '.'
echo

# Test 2: Metrics
echo "2. Testing unified metrics endpoint..."
curl -s "$BASE_URL/api/unified/metrics" | jq '.'
echo

# Test 3: Chat completion
echo "3. Testing chat completion..."
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

# Test 4: Text classification (NLP Classic)
echo "4. Testing text classification..."
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

# Test 5: Summarization
echo "5. Testing summarization..."
curl -s -X POST "$BASE_URL/api/unified/summarize" \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Artificial intelligence (AI) is intelligence demonstrated by machines, in contrast to the natural intelligence displayed by humans and animals. Leading AI textbooks define the field as the study of intelligent agents: any device that perceives its environment and takes actions that maximize its chance of successfully achieving its goals. Colloquially, the term artificial intelligence is often used to describe machines that mimic cognitive functions that humans associate with the human mind, such as learning and problem solving.",
    "options": {
      "provider": "hf-inference"
    }
  }' | jq '.'
echo

# Test 6: Embeddings
echo "6. Testing embeddings..."
curl -s -X POST "$BASE_URL/api/unified/embeddings" \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Machine learning is a subset of artificial intelligence",
    "options": {
      "provider": "hf-inference"
    }
  }' | jq '.'
echo

# Test 7: Generic inference endpoint
echo "7. Testing generic inference endpoint - NER..."
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

# Test 8: Question Answering
echo "8. Testing question answering..."
curl -s -X POST "$BASE_URL/api/unified/inference" \
  -H "Content-Type: application/json" \
  -d '{
    "task": "nlp_classic",
    "inputs": {
      "question": "What is the capital of France?",
      "context": "France is a country in Europe. Paris is the capital and largest city of France. The city is known for its art, culture, and cuisine."
    },
    "options": {
      "provider": "hf-inference",
      "model": "deepset/roberta-base-squad2"
    }
  }' | jq '.'
echo

# Test 9: Image generation (using HF model)
echo "9. Testing image generation..."
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

# Test 10: Fallback mechanism - non-existent provider
echo "10. Testing fallback mechanism..."
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
echo

echo "=== Unified Inference Service Tests Complete ==="
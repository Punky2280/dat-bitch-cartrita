#!/bin/bash

# Unified Inference Model Validation (canonical)
# Usage: bash scripts/unified/test-unified-models.sh [BASE_URL]

set -euo pipefail

BASE_URL=${1:-"http://localhost:8001"}

jqfilter='.success, .metadata.model_used, .metadata.provider, .metadata.latency_ms'

# Chat
curl -s -X POST "$BASE_URL/api/unified/inference" -H "Content-Type: application/json" -d '{
  "task":"chat",
  "inputs":{"messages":[{"role":"user","content":"What is machine learning?"}]},
  "options":{"provider":"hf-inference","model":"HuggingFaceTB/SmolLM3-3B"}
}' | jq "$jqfilter"

echo
# Classification
curl -s -X POST "$BASE_URL/api/unified/inference" -H "Content-Type: application/json" -d '{
  "task":"nlp_classic",
  "inputs":{"text":"This new AI model is absolutely fantastic!","candidate_labels":["positive","negative","neutral"]},
  "options":{"provider":"hf-inference","model":"facebook/bart-large-mnli"}
}' | jq '.success, .data[0].labels[0], .metadata.model_used, .metadata.latency_ms'

echo
# Summarization
curl -s -X POST "$BASE_URL/api/unified/inference" -H "Content-Type: application/json" -d '{
  "task":"nlp_classic",
  "inputs":{"text":"The field of natural language processing has seen tremendous advances..."},
  "options":{"provider":"hf-inference","model":"facebook/bart-large-cnn"}
}' | jq '.success, .data.summary_text[:100] + "...", .metadata.model_used, .metadata.latency_ms'

echo
# NER
curl -s -X POST "$BASE_URL/api/unified/inference" -H "Content-Type: application/json" -d '{
  "task":"nlp_classic",
  "inputs":{"text":"Apple Inc. was founded by Steve Jobs in Cupertino, California."},
  "options":{"provider":"hf-inference","model":"dslim/bert-base-NER"}
}' | jq '.success, (.data | length), (.data[]?.entity_group // empty), .metadata.model_used'

echo
# QA
curl -s -X POST "$BASE_URL/api/unified/inference" -H "Content-Type: application/json" -d '{
  "task":"nlp_classic",
  "inputs":{"question":"When was the company founded?","context":"TechCorp was established in 1995..."},
  "options":{"provider":"hf-inference","model":"deepset/roberta-base-squad2"}
}' | jq '.success, .data.answer, .data.score, .metadata.model_used, .metadata.latency_ms'

echo
# Embeddings
curl -s -X POST "$BASE_URL/api/unified/inference" -H "Content-Type: application/json" -d '{
  "task":"embeddings","inputs":{"text":"Artificial intelligence and machine learning"},"options":{"provider":"hf-inference","model":"intfloat/multilingual-e5-large"}
}' | jq '.success, (.data | length), .metadata.model_used, .metadata.latency_ms'

echo
# Image generation
curl -s -X POST "$BASE_URL/api/unified/inference" -H "Content-Type: application/json" -d '{
  "task":"image_generation","inputs":{"prompt":"A serene mountain landscape with a crystal clear lake"},"options":{"provider":"hf-inference","model":"stabilityai/stable-diffusion-xl-base-1.0"}
}' | jq '.success, (.data | type), .metadata.model_used, .metadata.latency_ms'

echo
# Fallback
curl -s -X POST "$BASE_URL/api/unified/inference" -H "Content-Type: application/json" -d '{
  "task":"chat","inputs":{"text":"Hello world"},"options":{"model":"non-existent-model"}
}' | jq '.success, .error[:50] + "...", .metadata.attempt_count'

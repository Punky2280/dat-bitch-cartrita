#!/usr/bin/env bash
set -e
mkdir -p _contract
curl -sf http://localhost:8002/openapi.json -o _contract/fastapi_openapi.json
curl -sf http://localhost:8001/swagger.json -o _contract/node_swagger.json
node scripts/compare_openapi.js
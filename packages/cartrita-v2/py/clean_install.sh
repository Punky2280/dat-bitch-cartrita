#!/bin/bash
# Cartrita V2 - Clean Dependency Installation Script
# Resolves dependency conflicts by removing problematic packages first

set -e  # Exit on any error

echo "🧹 Starting clean dependency installation..."

# Stop the server if running
echo "⏹️  Stopping any running servers..."
pkill -f "uvicorn main:app" || true

# Remove problematic packages that cause conflicts
echo "🗑️  Removing conflicting packages..."
pip uninstall -y \
    langchain-experimental \
    langchain-community \
    langchain-text-splitters \
    qiskit-machine-learning \
    thinc \
    yfinance \
    opencv-python \
    2>/dev/null || true

# Force reinstall core langchain packages with compatible versions
echo "📦 Installing compatible LangChain ecosystem..."
pip install --force-reinstall \
    "langchain>=0.2.0,<0.3.0" \
    "langchain-core>=0.2.0,<0.3.0" \
    "langchain-openai>=0.1.0,<0.2.0" \
    "langsmith>=0.1.17,<0.2.0" \
    "pydantic>=2.0.0,<3.0.0"

# Install remaining dependencies with constraints
echo "🚀 Installing remaining dependencies with constraints..."
pip install --constraint constraints.txt -r requirements.txt --upgrade

echo "✅ Clean installation completed!"
echo "🔄 Testing import compatibility..."

# Test critical imports
python3 -c "
import sys
try:
    import langchain
    import langchain_core
    import langchain_openai
    import fastapi
    import qiskit
    import numpy
    print(f'✅ LangChain: {langchain.__version__}')
    print(f'✅ LangChain-Core: {langchain_core.__version__}')
    print(f'✅ FastAPI: {fastapi.__version__}')
    print(f'✅ Qiskit: {qiskit.__version__}')
    print(f'✅ NumPy: {numpy.__version__}')
    print('✅ All critical imports successful!')
except ImportError as e:
    print(f'❌ Import error: {e}')
    sys.exit(1)
except Exception as e:
    print(f'⚠️  Warning: {e}')
"

echo "🎯 Ready to start server!"
#!/bin/bash

# Setup script for Hugging Face Jobs integration
# Installs dependencies and configures environment

echo "🚀 Setting up Hugging Face Jobs integration..."

# Check if we're in the right directory
if [[ ! -f "package.json" ]]; then
    echo "❌ Please run this script from the backend directory"
    exit 1
fi

# Install Python dependencies
echo "📦 Installing Python dependencies..."
pip install --upgrade huggingface_hub[cli]

# Check HF CLI installation
echo "🔧 Checking HF CLI installation..."
if command -v hf &> /dev/null; then
    echo "✅ HF CLI is installed"
    hf version
else
    echo "❌ HF CLI installation failed"
    exit 1
fi

# Check for HF token
echo "🔑 Checking authentication..."
if [[ -z "$HF_TOKEN" ]]; then
    echo "⚠️  HF_TOKEN not set in environment"
    echo "💡 To set up authentication, you can:"
    echo "   1. Run 'hf login' and follow the prompts"
    echo "   2. Or set HF_TOKEN environment variable:"
    echo "      export HF_TOKEN=your_token_here"
    echo "   3. Get a token from https://huggingface.co/settings/tokens"
else
    echo "✅ HF_TOKEN is set"
fi

# Create .env template if it doesn't exist
if [[ ! -f ".env" ]]; then
    echo "📝 Creating .env template..."
    cat > .env << EOF
# Hugging Face Configuration
HF_TOKEN=your_huggingface_token_here

# HF Jobs Configuration
HF_JOBS_ENABLED=true
HF_JOBS_PREFER_CLOUD=false
HF_JOBS_FALLBACK=true
HF_JOBS_MIN_FILE_SIZE=10485760
HF_JOBS_MAX_CONCURRENT=3
HF_JOBS_DAILY_BUDGET=50.0
HF_JOBS_MONTHLY_BUDGET=1000.0
HF_JOBS_COST_OPTIMIZE=true

# Audio Analytics
AUDIO_PROCESSING_ENABLED=true
EOF
    echo "✅ Created .env template - please update with your values"
else
    echo "ℹ️  .env file exists"
fi

# Test basic HF Jobs functionality (if authenticated)
echo "🧪 Running basic tests..."
if hf auth whoami &> /dev/null; then
    echo "✅ Successfully authenticated with Hugging Face"
    
    # Test job listing (requires Pro subscription)
    echo "📋 Testing job listing..."
    if hf jobs ps &> /dev/null; then
        echo "✅ HF Jobs access confirmed"
    else
        echo "⚠️  HF Jobs may require Pro subscription"
    fi
else
    echo "⚠️  Not authenticated - some features will be limited"
fi

echo ""
echo "🎉 Setup complete!"
echo ""
echo "📋 Next steps:"
echo "1. Set your HF_TOKEN in .env or run 'hf login'"
echo "2. Consider upgrading to HF Pro for Jobs access"
echo "3. Run 'node scripts/test-hf-jobs.js' to test integration"
echo "4. Run 'node scripts/run-hf-jobs-demo.js' for live demo"
echo ""
echo "🔗 Useful links:"
echo "- HF Tokens: https://huggingface.co/settings/tokens"
echo "- HF Pro: https://huggingface.co/pricing"
echo "- HF Jobs Docs: https://huggingface.co/docs/huggingface_hub/guides/jobs"
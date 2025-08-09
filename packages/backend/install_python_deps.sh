#!/bin/bash

# Install Python dependencies for Advanced Audio Analytics
# This script sets up pyannote.audio and related audio processing libraries

echo "🎵 Installing Advanced Audio Analytics dependencies..."

# Check if Python 3.8+ is installed
python3_version=$(python3 --version 2>&1 | cut -d' ' -f2 | cut -d'.' -f1-2)
required_version="3.8"

if [ "$(printf '%s\n' "$required_version" "$python3_version" | sort -V | head -n1)" != "$required_version" ]; then
    echo "❌ Python 3.8+ is required. Found: $python3_version"
    exit 1
fi

echo "✅ Python version: $python3_version"

# Create virtual environment if it doesn't exist
if [ ! -d "venv" ]; then
    echo "📦 Creating Python virtual environment..."
    python3 -m venv venv
fi

# Activate virtual environment
echo "🔄 Activating virtual environment..."
source venv/bin/activate

# Upgrade pip
echo "⬆️ Upgrading pip..."
pip install --upgrade pip

# Install PyTorch with CPU support (change for GPU if needed)
echo "🔥 Installing PyTorch..."
pip install torch torchaudio --index-url https://download.pytorch.org/whl/cpu

# Install pyannote.audio and dependencies
echo "🎤 Installing pyannote.audio..."
pip install pyannote.audio

# Install additional audio processing libraries
echo "📊 Installing audio processing libraries..."
pip install -r requirements.txt

# Verify installation
echo "🔍 Verifying installation..."
python3 -c "
import torch
import pyannote.audio
import librosa
print('✅ PyTorch version:', torch.__version__)
print('✅ pyannote.audio version:', pyannote.audio.__version__)
print('✅ librosa version:', librosa.__version__)
print('✅ All audio analytics dependencies installed successfully!')
"

echo "🎉 Advanced Audio Analytics setup complete!"
echo "💡 To use GPU acceleration, install CUDA-enabled PyTorch:"
echo "   pip install torch torchaudio --index-url https://download.pytorch.org/whl/cu118"
echo ""
echo "🔑 Don't forget to:"
echo "   1. Accept pyannote/segmentation-3.0 user conditions at https://huggingface.co/pyannote/segmentation-3.0"
echo "   2. Create HuggingFace access token at https://huggingface.co/settings/tokens"
echo "   3. Set HF_TOKEN environment variable in your .env file"
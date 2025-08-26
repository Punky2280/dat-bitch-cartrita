# Python Environment Configuration

The Advanced Audio Analytics Service requires specific environment variables and Python dependencies to function properly.

## Environment Variables

### Required for Audio Analysis
- `HF_TOKEN`: HuggingFace API token for accessing pyannote.audio models
- `PYTHON_TIMEOUT_MS`: Timeout for Python processes in milliseconds (default: 300000 = 5 minutes)

### Optional for Cloud Processing
- `HF_JOBS_ENABLED`: Enable HuggingFace Jobs cloud processing (default: false)
- `HF_JOBS_PREFER_CLOUD`: Prefer cloud over local processing (default: false)
- `HF_JOBS_FALLBACK`: Allow fallback to local when cloud fails (default: true)

## Python Dependencies

The service requires Python 3.8+ with the following packages:

```bash
# Run the installation script
./install_python_deps.sh
```

Or manually install:
```bash
pip install torch torchaudio --index-url https://download.pytorch.org/whl/cpu
pip install pyannote.audio
pip install -r requirements.txt
```

## Troubleshooting Python Server Startup Timeout

If you see "🐍 Python server startup timeout, assuming ready", try:

1. **Increase timeout**: Set `PYTHON_TIMEOUT_MS=600000` (10 minutes)
2. **Check Python installation**: Ensure Python 3.8+ is available as `python3`
3. **Verify HF Token**: Ensure `HF_TOKEN` is set and valid
4. **Check pyannote models**: Accept user conditions at https://huggingface.co/pyannote/segmentation-3.0
5. **Use cloud processing**: Set `HF_JOBS_ENABLED=true` as fallback

The service will automatically fall back to cloud processing if local Python fails.
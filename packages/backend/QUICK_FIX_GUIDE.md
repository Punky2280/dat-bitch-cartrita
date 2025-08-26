# Quick Fix Guide for "🐍 Python server startup timeout, assuming ready"

If you're seeing this error, here are the immediate steps to resolve it:

## ✅ Quick Fixes (in order of preference)

### 1. Increase Python Timeout (Recommended)
```bash
# In your .env file, add:
PYTHON_TIMEOUT_MS=600000  # 10 minutes instead of 5
```

### 2. Ensure HuggingFace Token is Set
```bash
# In your .env file, add:
HF_TOKEN=your_huggingface_token_here
```

### 3. Enable Cloud Processing Fallback
```bash
# In your .env file, add:
HF_JOBS_ENABLED=true
HF_JOBS_FALLBACK=true
```

### 4. Test Python Environment
```bash
cd packages/backend
node test-python-integration.js
```

## 🔧 Environment Variables Reference

| Variable | Default | Description |
|----------|---------|-------------|
| `PYTHON_TIMEOUT_MS` | `300000` | Python process timeout in milliseconds |
| `HF_TOKEN` | - | HuggingFace API token for models |
| `HF_JOBS_ENABLED` | `false` | Enable cloud processing |
| `HF_JOBS_FALLBACK` | `true` | Fallback to local if cloud fails |

## 🧪 Testing Your Setup

Run the built-in tests to verify everything works:
```bash
cd packages/backend

# Test Python integration
node test-python-integration.js

# Test service initialization
node test-service-init.js

# Test timeout handling specifically
node test-timeout-fix.js
```

## 📋 What the Fix Does

- ✅ **Graceful degradation**: Service starts even without Python
- ✅ **Better error messages**: Clear timeout information
- ✅ **Fallback support**: Automatically tries cloud processing
- ✅ **Configurable timeouts**: Adjust based on your system
- ✅ **Non-blocking startup**: Python issues don't crash the server

## 🆘 If You Still Have Issues

1. **Check Python installation**: `python3 --version` (needs 3.8+)
2. **Install dependencies**: Run `./install_python_deps.sh`
3. **Check logs**: The service will show which mode it's running in
4. **Use minimal mode**: Set `MINIMAL_MODE=1` to skip heavy initialization

The service will now start successfully even if Python dependencies are missing or slow to load.
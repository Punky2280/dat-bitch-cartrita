# 🔐 Encrypted API Key Vault System - Complete Guide

## Overview

Cartrita now features an enterprise-grade **Encrypted API Key Vault** that securely stores and manages credentials for 50+ service providers using **AES-256-GCM encryption** with **PBKDF2 key derivation**.

## 🏗️ Architecture Overview

### Two-Layer Security Model

1. **Environment Variables** (.env file) - Development & system keys
2. **Encrypted Vault** (Database) - Production API keys with rotation

```
┌─────────────────┐    ┌──────────────────────┐    ┌─────────────────┐
│  .env Variables │    │  Encrypted Database  │    │  Runtime Access │
│  (System Keys)  │────│  (API Key Vault)    │────│  (Agents/Tools) │
│                 │    │  AES-256-GCM        │    │                 │
└─────────────────┘    └──────────────────────┘    └─────────────────┘
```

## 🔑 Environment Variables (.env)

**Location**: `packages/backend/.env`

### System & Infrastructure Keys
```bash
# Core System (Required for basic operation)
ENCRYPTION_KEY=32_byte_hex_key_here          # Master encryption key
JWT_SECRET=change_me_in_real_env             # Session tokens
DATABASE_URL=postgresql://robert:punky1@localhost:5432/dat-bitch-cartrita

# Development & Logging
OPENAI_API_KEY=sk-your_openai_key_here       # Core AI functionality
DEEPGRAM_API_KEY=your_deepgram_key          # Speech processing
LANGCHAIN_API_KEY=lsv2_your_langchain_key   # Agent orchestration
```

**Purpose**: These keys are needed for system startup and core functionality.

## 🏦 Encrypted Vault System

### Database Storage
All vault keys are stored in the `user_api_keys` table with:

```sql
CREATE TABLE user_api_keys (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    provider VARCHAR(100) NOT NULL,
    key_name VARCHAR(255),
    encrypted_key TEXT NOT NULL,          -- AES-256-GCM encrypted
    key_hash VARCHAR(64),                 -- SHA-256 checksum
    rotation_policy JSONB,                -- Auto-rotation settings
    visibility VARCHAR(20) DEFAULT 'MASKED',
    metadata JSONB,                       -- Provider-specific data
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
```

### Encryption Process

1. **Key Derivation**: PBKDF2 with 100,000 iterations + salt
2. **Encryption**: AES-256-GCM with random IV
3. **Integrity**: SHA-256 checksum for tamper detection
4. **Storage**: Encrypted blob + metadata in database

```javascript
// Example encryption flow
const derivedKey = pbkdf2(ENCRYPTION_KEY, salt, 100000, 32, 'sha256');
const iv = crypto.randomBytes(12);
const cipher = crypto.createCipher('aes-256-gcm', derivedKey, iv);
const encrypted = cipher.update(apiKey, 'utf8', 'hex') + cipher.final('hex');
const authTag = cipher.getAuthTag();
```

## 🎯 How to Add New API Keys

### Method 1: Via Web Interface (Recommended)

1. **Navigate to API Key Vault**
   ```
   http://localhost:3000 → Settings → API Key Vault
   ```

2. **Select Provider**
   - Choose from 50+ preconfigured providers
   - Each provider has validation patterns and field requirements

3. **Enter Credentials**
   - Fill provider-specific fields (API key, secrets, etc.)
   - Real-time validation with regex patterns
   - Preview masked values before saving

4. **Configure Options**
   ```json
   {
     "visibility": "MASKED",           // MASKED, HIDDEN, VISIBLE
     "rotation_policy": {
       "intervalDays": 90,
       "autoRotate": false,
       "warningDays": 7
     }
   }
   ```

### Method 2: Via API (Programmatic)

```bash
curl -X POST http://localhost:8001/api/vault/credentials \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "provider": "openai",
    "credentials": {
      "apiKey": "sk-your-real-key-here"
    },
    "keyName": "Production OpenAI Key",
    "rotation_policy": {
      "intervalDays": 90,
      "autoRotate": false
    }
  }'
```

## 🔄 Key Rotation & Management

### Automatic Rotation

```json
{
  "rotation_policy": {
    "intervalDays": 90,      // Rotate every 90 days
    "autoRotate": true,      // Enable automatic rotation
    "warningDays": 7,        // Warn 7 days before expiration
    "maxRetries": 3          // Retry attempts on failure
  }
}
```

### Manual Rotation

```bash
# Via API
POST /api/vault/credentials/:id/rotate
{
  "newCredentials": {
    "apiKey": "sk-new-rotated-key-here"
  }
}
```

### Master Key Rotation

When rotating the system encryption key:

```bash
OLD_ENCRYPTION_MASTER_KEY=old_key_here \
NEW_ENCRYPTION_MASTER_KEY=new_key_here \
node packages/backend/scripts/reencryptVaultKeys.js
```

## 📋 Supported Providers (50+)

### AI & Machine Learning
```
openai         → sk-[A-Za-z0-9]{32,}
anthropic      → sk-ant-[A-Za-z0-9]{32,}
huggingface    → hf_[A-Za-z0-9]{30,}
stability      → sk-[A-Za-z0-9]{32,}
elevenlabs     → [A-Za-z0-9]{32}
deepgram       → [A-Za-z0-9]{40}
assemblyai     → [A-Za-z0-9]{32}
replicate      → r8_[A-Za-z0-9]{32}
```

### Cloud Infrastructure
```
aws            → AKIA[0-9A-Z]{16} + secretAccessKey + region
google         → AIza[A-Za-z0-9]{35} OR serviceAccountJson
azure          → tenantId + clientId + clientSecret + subscriptionId
digitalocean   → dop_v1_[A-Za-z0-9]{64}
cloudflare     → [A-Za-z0-9]{40}
vercel         → [A-Za-z0-9]{24}
netlify        → nta_[A-Za-z0-9]{43}
```

### Development Tools
```
github         → gh[pousr]_[A-Za-z0-9]{36,}
gitlab         → glpat-[A-Za-z0-9]{20}
notion         → secret_[A-Za-z0-9]{43}
linear         → lin_api_[A-Za-z0-9]{40}
jira           → email + apiToken + siteDomain
confluence     → email + apiToken + siteDomain
```

### Databases & Storage
```
pinecone       → [a-f0-9-]{32,}
weaviate       → [A-Za-z0-9-]{36}
supabase       → eyJ[A-Za-z0-9-_]{100,}
mongodb        → mongodb+srv://[credentials]
redis          → host + port + password
postgres       → host + port + database + user + password
```

## 🛠️ Migration from .env to Vault

### Step 1: Identify Keys to Migrate

```bash
# Keys to keep in .env (system-level)
ENCRYPTION_KEY=         # Vault master key
JWT_SECRET=            # Session security  
DATABASE_URL=          # System database
POSTGRES_*=            # Database config

# Keys to move to vault (service-level)
OPENAI_API_KEY=        → Move to vault as 'openai' provider
DEEPGRAM_API_KEY=      → Move to vault as 'deepgram' provider
GITHUB_TOKEN=          → Move to vault as 'github' provider
GOOGLE_API_KEY=        → Move to vault as 'google' provider
```

### Step 2: Add Keys via Interface

1. Go to API Key Vault page
2. Click "Add New Key"
3. Select provider (e.g., "OpenAI")
4. Enter API key
5. Save (automatically encrypted)

### Step 3: Update Application Code

```javascript
// OLD: Direct environment access
const openaiKey = process.env.OPENAI_API_KEY;

// NEW: Vault access
const openaiKey = await vaultService.getDecryptedKey('openai', userId);
```

## 🔍 Key Validation & Testing

### Real-Time Validation

Each provider has specific validation:

```javascript
// OpenAI validation
await fetch('https://api.openai.com/v1/models', {
  headers: { 'Authorization': `Bearer ${apiKey}` }
});

// GitHub validation  
await fetch('https://api.github.com/user', {
  headers: { 'Authorization': `token ${apiKey}` }
});

// AWS validation
const client = new AWS.S3({ accessKeyId, secretAccessKey, region });
await client.listBuckets().promise();
```

### Validation API

```bash
# Test a stored key
POST /api/vault/credentials/:id/validate

# Response
{
  "valid": true,
  "provider": "openai",
  "rateLimitRemaining": 59,
  "lastValidated": "2025-08-10T11:30:00Z",
  "details": {
    "modelsAvailable": 15,
    "usage": "Valid with full access"
  }
}
```

## 🚨 Security Best Practices

### Environment Setup

1. **Never commit .env files**
   ```bash
   # .gitignore
   packages/backend/.env
   *.env
   .env.*
   ```

2. **Use strong encryption key**
   ```bash
   # Generate secure key
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```

3. **Rotate keys regularly**
   - System keys: Every 6 months
   - Service keys: Every 90 days (automated)
   - After any security incident

### Production Deployment

```yaml
# docker-compose.yml
environment:
  - ENCRYPTION_KEY=${ENCRYPTION_MASTER_KEY}  # From secure vault
  - JWT_SECRET=${JWT_SECRET_PROD}           # From secure vault
  - DATABASE_URL=${DATABASE_URL_PROD}       # From secure vault
```

## 📊 Monitoring & Auditing

### Vault Metrics

```javascript
// Available metrics
vault_credentials_total{provider="openai",status="active"}
vault_validation_attempts_total{provider="github",result="success"}  
vault_rotation_attempts_total{provider="aws",result="completed"}
vault_access_attempts_total{user_id="123",action="decrypt"}
```

### Audit Logs

```json
{
  "timestamp": "2025-08-10T11:30:00Z",
  "userId": "123", 
  "action": "key_access",
  "provider": "openai",
  "keyId": "456",
  "result": "success",
  "ipAddress": "192.168.1.100"
}
```

## 🔧 Troubleshooting

### Common Issues

**Key Not Working**: 
```bash
# Test validation
curl -X POST http://localhost:8001/api/vault/credentials/{id}/validate
```

**Encryption Errors**:
```bash
# Check encryption key format (should be 64 hex chars)
echo $ENCRYPTION_KEY | wc -c  # Should output 65 (64 + newline)
```

**Migration Issues**:
```bash
# Check database migrations
npm run migrate
```

### Recovery Procedures

**Lost Encryption Key**:
1. Stop all services
2. Restore from backup with old key
3. Run reencryption script with new key
4. Restart services

**Corrupted Vault Data**:
1. Check integrity with checksums
2. Restore from database backup
3. Re-validate all keys
4. Update rotation policies

---

## 🎯 Quick Start Commands

```bash
# 1. Set environment variables
cp packages/backend/.env.example packages/backend/.env
# Edit .env with your keys

# 2. Start servers
npm run dev                    # Frontend
npm start                      # Backend (in backend directory)

# 3. Access vault
open http://localhost:3000/settings/api-vault

# 4. Add first key
# Select provider → Enter credentials → Save

# 5. Test key
# Click "Validate" button next to saved key
```

The encrypted vault system provides enterprise-grade security while maintaining ease of use for development and production deployments.
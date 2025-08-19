/**
 * Cartrita V2 - Environment Configuration Loader
 * Enhanced from V1 with better error handling and validation
 */

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Environment file search paths (ordered by priority)
const possiblePaths = [
  path.resolve(__dirname, '..', '..', '..', '..', '.env'), // monorepo root (main .env)
  path.resolve(__dirname, '..', '..', '..', '.env'), 
  path.resolve(__dirname, '..', '..', '.env'), 
  path.resolve(__dirname, '..', '.env'),
  '/usr/src/app/.env', // Docker path
  process.env.ENV_FILE_PATH // Custom path from environment
].filter(Boolean);

let envLoaded = false;
let loadedPath = null;

for (const envPath of possiblePaths) {
  try {
    const result = dotenv.config({ path: envPath });
    if (result.parsed && Object.keys(result.parsed).length > 0) {
      console.log(`🔧 [V2-Config] Environment loaded from: ${envPath}`);
      envLoaded = true;
      loadedPath = envPath;
      break;
    }
  } catch (error) {
    // Continue to next path
    continue;
  }
}

if (!envLoaded) {
  console.warn('⚠️ [V2-Config] No .env file found. Using system environment variables.');
}

// V1 to V2 environment variable compatibility mapping
function setupV1Compatibility() {
  // Map V1 Redis variables to V2 expected format
  if (process.env.REDIS_HOST && process.env.REDIS_PORT && !process.env.REDIS_URL) {
    process.env.REDIS_URL = `redis://${process.env.REDIS_HOST}:${process.env.REDIS_PORT}`;
  }
  
  // Ensure DATABASE_URL is available (already exists in V1)
  // V1 already has DATABASE_URL, so no mapping needed
  
  // Map JWT variables
  if (!process.env.JWT_SECRET && process.env.JWT_SECRET) {
    process.env.JWT_SECRET = process.env.JWT_SECRET; // Same name, just ensure it exists
  }
  
  // Set V2 specific defaults
  if (!process.env.PORT && process.env.PORT) {
    process.env.V2_PORT = '3002'; // V2 runs on different port
  } else {
    process.env.V2_PORT = process.env.PORT || '3002';
  }
  
  // Map additional V1 variables that V2 can use
  if (!process.env.NODE_ENV) {
    process.env.NODE_ENV = 'development';
  }
}

// Apply compatibility mapping
setupV1Compatibility();

// Required environment variables for V2 (with V1 compatibility)
const REQUIRED_VARS = [
  'DATABASE_URL',    // V1 ✓
  'JWT_SECRET'       // V1 ✓
];

// V2 will create REDIS_URL from V1's REDIS_HOST + REDIS_PORT
const REDIS_VARS = ['REDIS_HOST', 'REDIS_PORT'];

// Optional but recommended variables
const RECOMMENDED_VARS = [
  'OPENAI_API_KEY',         // V1 ✓ - Primary versatile key for general AI operations (chat completions, embeddings)
  'OPENAI_FINETUNING_API_KEY', // V2 enhancement - Dedicated key for training/bulk operations to preserve general quota
  'OPENAI_MODEL',           // V2 enhancement - Default model for chat completions (default: gpt-4o)
  'OPENAI_EMBEDDING_MODEL', // V2 enhancement - Default model for embeddings (default: text-embedding-3-small)
  'NODE_ENV',               // V1 ✓
  'LOG_LEVEL',              // V1 ✓
  'DEEPGRAM_API_KEY',       // V1 ✓
  'HUGGINGFACE_API_KEY'     // V1 ✓
];

// Validation function
export function validateEnvironment() {
  const missing = [];
  const warnings = [];

  // Check required variables
  for (const varName of REQUIRED_VARS) {
    if (!process.env[varName]) {
      missing.push(varName);
    }
  }
  
  // Check Redis connectivity (either REDIS_URL or REDIS_HOST+PORT)
  if (!process.env.REDIS_URL && (!process.env.REDIS_HOST || !process.env.REDIS_PORT)) {
    missing.push('REDIS_URL (or REDIS_HOST + REDIS_PORT)');
  }

  // Check recommended variables
  for (const varName of RECOMMENDED_VARS) {
    if (!process.env[varName]) {
      warnings.push(varName);
    }
  }

  if (missing.length > 0) {
    console.error('❌ [V2-Config] Missing required environment variables:', missing);
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }

  if (warnings.length > 0) {
    console.warn('⚠️ [V2-Config] Missing recommended environment variables:', warnings);
  }

  console.log('✅ [V2-Config] Environment validation passed');
}

// Environment info export
export const environmentInfo = {
  loaded: envLoaded,
  path: loadedPath,
  nodeEnv: process.env.NODE_ENV || 'development',
  isProduction: process.env.NODE_ENV === 'production',
  isDevelopment: process.env.NODE_ENV === 'development',
  isTest: process.env.NODE_ENV === 'test'
};

export default {
  validateEnvironment,
  environmentInfo
};
/**
 * Cartrita Configuration Management System
 * Centralized configuration with validation and environment handling
 */

import dotenv from 'dotenv';
import Joi from 'joi';
import _ from 'lodash';
import YAML from 'yaml';
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config();

export class ConfigManager {
    constructor(options = {}) {
        this.environment = options.environment || process.env.NODE_ENV || 'development';
        this.configDir = options.configDir || join(__dirname, '../config');
        this.schema = null;
        this.config = {};
        this.validated = false;
        
        this.loadConfiguration();
    }
    
    /**
     * Load configuration from multiple sources
     */
    loadConfiguration() {
        const sources = [
            this.loadDefaultConfig(),
            this.loadEnvironmentConfig(),
            this.loadUserConfig(),
            this.loadEnvVariables()
        ];
        
        // Merge configurations (later sources override earlier ones)
        this.config = _.mergeWith({}, ...sources, (objValue, srcValue) => {
            if (_.isArray(objValue)) {
                return srcValue; // Replace arrays instead of merging
            }
        });
        
        // Apply environment-specific overrides
        if (this.config.environments && this.config.environments[this.environment]) {
            this.config = _.merge(this.config, this.config.environments[this.environment]);
        }
        
        this.processConfiguration();
    }
    
    /**
     * Load default configuration
     */
    loadDefaultConfig() {
        return {
            // Server Configuration
            server: {
                port: 8001,
                host: '0.0.0.0',
                cors: {
                    enabled: true,
                    origin: '*',
                    credentials: true
                },
                rateLimit: {
                    windowMs: 15 * 60 * 1000, // 15 minutes
                    max: 1000, // requests per window
                    message: 'Too many requests from this IP'
                },
                security: {
                    helmet: true,
                    contentSecurityPolicy: false,
                    hsts: true
                }
            },
            
            // Database Configuration
            database: {
                type: 'postgresql',
                host: 'localhost',
                port: 5432,
                name: 'cartrita',
                pool: {
                    min: 2,
                    max: 20,
                    acquireTimeoutMillis: 30000,
                    createTimeoutMillis: 30000,
                    destroyTimeoutMillis: 5000,
                    idleTimeoutMillis: 30000,
                    reapIntervalMillis: 1000,
                    createRetryIntervalMillis: 200
                }
            },
            
            // Redis Configuration
            redis: {
                host: 'localhost',
                port: 6379,
                db: 0,
                keyPrefix: 'cartrita:',
                retryDelayOnFailover: 100,
                enableReadyCheck: true,
                maxRetriesPerRequest: 3
            },
            
            // Authentication & Security
            auth: {
                jwt: {
                    expiresIn: '24h',
                    issuer: 'cartrita',
                    audience: 'cartrita-users'
                },
                bcrypt: {
                    rounds: 12
                },
                session: {
                    secret: 'your-session-secret-change-this',
                    cookie: {
                        maxAge: 24 * 60 * 60 * 1000, // 24 hours
                        httpOnly: true,
                        secure: false, // set to true in production with HTTPS
                        sameSite: 'lax'
                    }
                }
            },
            
            // AI/LLM Configuration
            ai: {
                openai: {
                    model: 'gpt-4',
                    maxTokens: 2000,
                    temperature: 0.7,
                    timeout: 30000
                },
                anthropic: {
                    model: 'claude-3-sonnet-20240229',
                    maxTokens: 2000,
                    temperature: 0.7,
                    timeout: 30000
                },
                huggingface: {
                    timeout: 60000,
                    retries: 3,
                    models: {
                        'text-generation': 'microsoft/DialoGPT-large',
                        'text-to-image': 'stabilityai/stable-diffusion-xl-base-1.0',
                        'embeddings': 'sentence-transformers/all-MiniLM-L6-v2'
                    }
                }
            },
            
            // RAG Configuration
            rag: {
                chunkSize: 1000,
                chunkOverlap: 100,
                maxChunks: 10,
                similarityThreshold: 0.7,
                reranking: {
                    enabled: true,
                    model: 'cross-encoder/ms-marco-MiniLM-L-6-v2',
                    topK: 5
                },
                embeddings: {
                    model: 'text-embedding-ada-002',
                    dimensions: 1536,
                    batchSize: 100
                }
            },
            
            // File Storage
            storage: {
                type: 'local', // 'local' | 's3' | 'gcp' | 'azure'
                local: {
                    uploadDir: './uploads',
                    maxFileSize: 10 * 1024 * 1024, // 10MB
                    allowedTypes: [
                        'image/jpeg', 'image/png', 'image/gif', 'image/webp',
                        'application/pdf', 'text/plain', 'text/csv',
                        'application/json', 'application/xml'
                    ]
                },
                s3: {
                    region: 'us-east-1',
                    bucket: 'cartrita-uploads'
                }
            },
            
            // Logging Configuration
            logging: {
                level: 'info', // 'error' | 'warn' | 'info' | 'debug'
                format: 'json', // 'json' | 'simple' | 'combined'
                file: {
                    enabled: true,
                    filename: 'app.log',
                    maxsize: 10 * 1024 * 1024, // 10MB
                    maxFiles: 5
                },
                console: {
                    enabled: true,
                    colorize: true
                }
            },
            
            // Monitoring & Observability
            monitoring: {
                openTelemetry: {
                    enabled: true,
                    serviceName: 'cartrita-backend',
                    serviceVersion: '1.0.0',
                    jaeger: {
                        endpoint: 'http://localhost:14268/api/traces'
                    },
                    prometheus: {
                        enabled: true,
                        port: 9090,
                        path: '/metrics'
                    }
                },
                healthCheck: {
                    enabled: true,
                    path: '/health',
                    checks: ['database', 'redis', 'external-apis']
                }
            },
            
            // Feature Flags
            features: {
                experimentalRAG: false,
                advancedAnalytics: true,
                realTimeChat: true,
                voiceProcessing: true,
                imageGeneration: true,
                workflowAutomation: true,
                multiModal: true
            },
            
            // Cache Configuration
            cache: {
                ttl: {
                    default: 300, // 5 minutes
                    embeddings: 3600, // 1 hour
                    userSessions: 1800, // 30 minutes
                    ragResults: 600 // 10 minutes
                },
                maxSize: 1000 // maximum number of items in memory cache
            },
            
            // Worker/Queue Configuration
            queue: {
                redis: {
                    host: 'localhost',
                    port: 6379,
                    db: 1
                },
                jobs: {
                    attempts: 3,
                    backoff: {
                        type: 'exponential',
                        delay: 2000
                    },
                    removeOnComplete: 100,
                    removeOnFail: 50
                }
            }
        };
    }
    
    /**
     * Load environment-specific configuration
     */
    loadEnvironmentConfig() {
        const configFile = join(this.configDir, `${this.environment}.yaml`);
        
        if (existsSync(configFile)) {
            try {
                const content = readFileSync(configFile, 'utf8');
                return YAML.parse(content);
            } catch (error) {
                console.warn(`Failed to load environment config: ${error.message}`);
            }
        }
        
        return {};
    }
    
    /**
     * Load user-specific configuration
     */
    loadUserConfig() {
        const configFile = join(this.configDir, 'local.yaml');
        
        if (existsSync(configFile)) {
            try {
                const content = readFileSync(configFile, 'utf8');
                return YAML.parse(content);
            } catch (error) {
                console.warn(`Failed to load user config: ${error.message}`);
            }
        }
        
        return {};
    }
    
    /**
     * Load configuration from environment variables
     */
    loadEnvVariables() {
        const envConfig = {};
        
        // Server configuration
        if (process.env.PORT) envConfig.server = { port: parseInt(process.env.PORT) };
        if (process.env.HOST) _.set(envConfig, 'server.host', process.env.HOST);
        
        // Database configuration
        if (process.env.DATABASE_URL) {
            const dbUrl = new URL(process.env.DATABASE_URL);
            _.set(envConfig, 'database', {
                host: dbUrl.hostname,
                port: parseInt(dbUrl.port) || 5432,
                name: dbUrl.pathname.slice(1),
                username: dbUrl.username,
                password: dbUrl.password
            });
        }
        
        // Redis configuration
        if (process.env.REDIS_URL) {
            const redisUrl = new URL(process.env.REDIS_URL);
            _.set(envConfig, 'redis', {
                host: redisUrl.hostname,
                port: parseInt(redisUrl.port) || 6379
            });
        }
        
        // API Keys
        const apiKeys = {};
        if (process.env.OPENAI_API_KEY) apiKeys.openai = process.env.OPENAI_API_KEY;
        if (process.env.ANTHROPIC_API_KEY) apiKeys.anthropic = process.env.ANTHROPIC_API_KEY;
        if (process.env.HUGGINGFACE_API_KEY) apiKeys.huggingface = process.env.HUGGINGFACE_API_KEY;
        if (process.env.GOOGLE_API_KEY) apiKeys.google = process.env.GOOGLE_API_KEY;
        
        if (Object.keys(apiKeys).length > 0) {
            envConfig.apiKeys = apiKeys;
        }
        
        // Security
        if (process.env.JWT_SECRET) _.set(envConfig, 'auth.jwt.secret', process.env.JWT_SECRET);
        if (process.env.SESSION_SECRET) _.set(envConfig, 'auth.session.secret', process.env.SESSION_SECRET);
        
        return envConfig;
    }
    
    /**
     * Process configuration after loading
     */
    processConfiguration() {
        // Resolve template variables in configuration
        this.resolveTemplates();
        
        // Set derived values
        this.setDerivedValues();
    }
    
    /**
     * Resolve template variables like ${ENV_VAR}
     */
    resolveTemplates() {
        const resolveValue = (value) => {
            if (typeof value === 'string') {
                return value.replace(/\$\{([^}]+)\}/g, (match, varName) => {
                    const envValue = process.env[varName];
                    if (envValue === undefined) {
                        console.warn(`Environment variable ${varName} not found`);
                        return match;
                    }
                    return envValue;
                });
            } else if (Array.isArray(value)) {
                return value.map(resolveValue);
            } else if (typeof value === 'object' && value !== null) {
                const resolved = {};
                for (const [key, val] of Object.entries(value)) {
                    resolved[key] = resolveValue(val);
                }
                return resolved;
            }
            return value;
        };
        
        this.config = resolveValue(this.config);
    }
    
    /**
     * Set derived configuration values
     */
    setDerivedValues() {
        // Set database connection string if not provided
        if (!this.config.database.connectionString && this.config.database.host) {
            const { host, port, name, username, password } = this.config.database;
            if (username && password) {
                this.config.database.connectionString = 
                    `postgresql://${username}:${password}@${host}:${port}/${name}`;
            } else {
                this.config.database.connectionString = 
                    `postgresql://${host}:${port}/${name}`;
            }
        }
        
        // Set Redis connection string
        if (!this.config.redis.connectionString) {
            const { host, port, password, db } = this.config.redis;
            this.config.redis.connectionString = password 
                ? `redis://:${password}@${host}:${port}/${db}`
                : `redis://${host}:${port}/${db}`;
        }
        
        // Set security defaults for production
        if (this.environment === 'production') {
            _.set(this.config, 'auth.session.cookie.secure', true);
            _.set(this.config, 'server.security.hsts', true);
            _.set(this.config, 'logging.level', 'warn');
        }
    }
    
    /**
     * Define configuration schema for validation
     */
    defineSchema() {
        this.schema = Joi.object({
            server: Joi.object({
                port: Joi.number().port().required(),
                host: Joi.string().required(),
                cors: Joi.object({
                    enabled: Joi.boolean(),
                    origin: Joi.alternatives().try(Joi.string(), Joi.array().items(Joi.string())),
                    credentials: Joi.boolean()
                }),
                rateLimit: Joi.object({
                    windowMs: Joi.number().positive(),
                    max: Joi.number().positive(),
                    message: Joi.string()
                })
            }).required(),
            
            database: Joi.object({
                type: Joi.string().valid('postgresql', 'mysql', 'sqlite'),
                host: Joi.string(),
                port: Joi.number().port(),
                name: Joi.string().required(),
                username: Joi.string(),
                password: Joi.string(),
                connectionString: Joi.string(),
                pool: Joi.object({
                    min: Joi.number().min(0),
                    max: Joi.number().positive(),
                    acquireTimeoutMillis: Joi.number().positive(),
                    createTimeoutMillis: Joi.number().positive()
                })
            }).required(),
            
            redis: Joi.object({
                host: Joi.string().required(),
                port: Joi.number().port().required(),
                db: Joi.number().min(0),
                password: Joi.string(),
                connectionString: Joi.string()
            }),
            
            auth: Joi.object({
                jwt: Joi.object({
                    secret: Joi.string().min(32),
                    expiresIn: Joi.string(),
                    issuer: Joi.string(),
                    audience: Joi.string()
                }),
                bcrypt: Joi.object({
                    rounds: Joi.number().min(10).max(15)
                })
            }),
            
            ai: Joi.object({
                openai: Joi.object({
                    apiKey: Joi.string(),
                    model: Joi.string(),
                    maxTokens: Joi.number().positive(),
                    temperature: Joi.number().min(0).max(2)
                }),
                anthropic: Joi.object({
                    apiKey: Joi.string(),
                    model: Joi.string(),
                    maxTokens: Joi.number().positive()
                })
            }),
            
            features: Joi.object().pattern(Joi.string(), Joi.boolean()),
            
            logging: Joi.object({
                level: Joi.string().valid('error', 'warn', 'info', 'debug'),
                format: Joi.string().valid('json', 'simple', 'combined')
            })
        });
    }
    
    /**
     * Validate configuration against schema
     */
    validate() {
        if (!this.schema) {
            this.defineSchema();
        }
        
        const { error, value } = this.schema.validate(this.config, {
            allowUnknown: true,
            stripUnknown: false
        });
        
        if (error) {
            throw new Error(`Configuration validation failed: ${error.message}`);
        }
        
        this.validated = true;
        return value;
    }
    
    /**
     * Get configuration value by path
     */
    get(path, defaultValue = undefined) {
        return _.get(this.config, path, defaultValue);
    }
    
    /**
     * Set configuration value by path
     */
    set(path, value) {
        _.set(this.config, path, value);
        this.validated = false; // Mark as needing re-validation
        return this;
    }
    
    /**
     * Check if configuration has a specific path
     */
    has(path) {
        return _.has(this.config, path);
    }
    
    /**
     * Get all configuration
     */
    getAll() {
        return _.cloneDeep(this.config);
    }
    
    /**
     * Get configuration for specific service/component
     */
    getServiceConfig(serviceName) {
        return this.get(serviceName, {});
    }
    
    /**
     * Get sanitized config (without secrets)
     */
    getSanitized() {
        const sanitized = _.cloneDeep(this.config);
        
        // Remove sensitive fields
        const sensitiveFields = [
            'database.password',
            'database.connectionString',
            'redis.password',
            'redis.connectionString',
            'auth.jwt.secret',
            'auth.session.secret',
            'apiKeys'
        ];
        
        sensitiveFields.forEach(field => {
            if (_.has(sanitized, field)) {
                _.set(sanitized, field, '[REDACTED]');
            }
        });
        
        return sanitized;
    }
    
    /**
     * Check if running in development mode
     */
    isDevelopment() {
        return this.environment === 'development';
    }
    
    /**
     * Check if running in production mode
     */
    isProduction() {
        return this.environment === 'production';
    }
    
    /**
     * Check if running in test mode
     */
    isTest() {
        return this.environment === 'test';
    }
    
    /**
     * Get environment name
     */
    getEnvironment() {
        return this.environment;
    }
    
    /**
     * Export configuration to YAML
     */
    toYAML() {
        return YAML.stringify(this.getSanitized(), { indent: 2 });
    }
    
    /**
     * Export configuration to JSON
     */
    toJSON() {
        return JSON.stringify(this.getSanitized(), null, 2);
    }
}

// Global configuration instance
export const config = new ConfigManager();

// Validate configuration on startup
try {
    config.validate();
    console.log(`✅ Configuration loaded and validated for ${config.getEnvironment()} environment`);
} catch (error) {
    console.error(`❌ Configuration validation failed: ${error.message}`);
    process.exit(1);
}

export default config;
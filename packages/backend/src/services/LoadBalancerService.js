import fs from 'fs/promises';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import OpenTelemetryTracing from '../system/OpenTelemetryTracing.js';

const execAsync = promisify(exec);

/**
 * Load Balancer Configuration Service
 * Manages NGINX load balancing configuration and health monitoring
 */
class LoadBalancerService {
  constructor() {
    this.isInitialized = false;
    this.configPath = process.env.NGINX_CONFIG_PATH || '/etc/nginx/sites-available/cartrita';
    this.configSymlinkPath = process.env.NGINX_CONFIG_SYMLINK || '/etc/nginx/sites-enabled/cartrita';
    this.healthCheckInterval = null;
    this.upstreams = new Map();
    this.healthStatus = new Map();
    this.metrics = {
      activeServers: 0,
      totalRequests: 0,
      totalErrors: 0,
      lastConfigReload: null,
      lastHealthCheck: null
    };
    
    // Default server configuration
    this.defaultServers = [
      { 
        host: 'localhost', 
        port: 3000, 
        weight: 1, 
        max_fails: 3, 
        fail_timeout: '30s',
        backup: false
      }
    ];
  }

  /**
   * Initialize load balancer service
   */
  async initialize(config = {}) {
    const span = OpenTelemetryTracing.traceOperation('load_balancer.initialize');
    
    try {
      console.log('⚖️ Initializing Load Balancer Service...');
      
      const defaultConfig = {
        // Backend servers
        servers: process.env.BACKEND_SERVERS ? 
          JSON.parse(process.env.BACKEND_SERVERS) : this.defaultServers,
        
        // Load balancing method
        method: process.env.LB_METHOD || 'least_conn', // round_robin, ip_hash, least_conn
        
        // Health check settings
        healthCheckPath: process.env.HEALTH_CHECK_PATH || '/api/health',
        healthCheckInterval: parseInt(process.env.HEALTH_CHECK_INTERVAL) || 30000,
        healthTimeout: parseInt(process.env.HEALTH_TIMEOUT) || 5000,
        
        // SSL configuration
        ssl: {
          enabled: process.env.SSL_ENABLED === 'true',
          certPath: process.env.SSL_CERT_PATH || '/etc/ssl/certs/cartrita.crt',
          keyPath: process.env.SSL_KEY_PATH || '/etc/ssl/private/cartrita.key',
          dhParamPath: process.env.SSL_DH_PARAM_PATH || '/etc/ssl/certs/dhparam.pem'
        },
        
        // Rate limiting
        rateLimiting: {
          enabled: process.env.RATE_LIMITING_ENABLED === 'true',
          rpm: parseInt(process.env.RATE_LIMIT_RPM) || 60,
          burst: parseInt(process.env.RATE_LIMIT_BURST) || 20,
          delay: parseInt(process.env.RATE_LIMIT_DELAY) || 0
        },
        
        // Caching
        caching: {
          enabled: process.env.CACHING_ENABLED === 'true',
          cachePath: process.env.CACHE_PATH || '/var/cache/nginx/cartrita',
          cacheSize: process.env.CACHE_SIZE || '100m',
          inactiveTime: process.env.CACHE_INACTIVE || '60m'
        },
        
        // Compression
        compression: {
          enabled: process.env.COMPRESSION_ENABLED !== 'false',
          level: parseInt(process.env.COMPRESSION_LEVEL) || 6,
          minLength: parseInt(process.env.COMPRESSION_MIN_LENGTH) || 1000
        },
        
        // Security headers
        security: {
          hideVersion: true,
          xssProtection: true,
          contentTypeOptions: true,
          frameOptions: 'DENY',
          hsts: process.env.SSL_ENABLED === 'true'
        }
      };
      
      this.config = { ...defaultConfig, ...config };
      
      // Initialize server status tracking
      this.config.servers.forEach(server => {
        const serverId = `${server.host}:${server.port}`;
        this.upstreams.set(serverId, server);
        this.healthStatus.set(serverId, {
          status: 'unknown',
          lastCheck: null,
          responseTime: 0,
          errors: 0,
          consecutiveFailures: 0
        });
      });
      
      // Generate NGINX configuration
      await this.generateNginxConfig();
      
      // Apply configuration if NGINX is available
      if (await this.isNginxAvailable()) {
        await this.applyConfiguration();
      } else {
        console.warn('⚠️ NGINX not available, configuration generated but not applied');
      }
      
      // Start health monitoring
      this.startHealthMonitoring();
      
      this.isInitialized = true;
      console.log('✅ Load Balancer Service initialized successfully');
      
      span.setAttributes({
        'lb.servers_count': this.config.servers.length,
        'lb.method': this.config.method,
        'lb.ssl_enabled': this.config.ssl.enabled,
        'lb.rate_limiting_enabled': this.config.rateLimiting.enabled
      });
      
      return true;
      
    } catch (error) {
      span.recordException(error);
      console.error('❌ Load Balancer Service initialization failed:', error.message);
      this.isInitialized = false;
      throw error;
    } finally {
      span.end();
    }
  }

  /**
   * Generate NGINX configuration
   */
  async generateNginxConfig() {
    const span = OpenTelemetryTracing.traceOperation('load_balancer.generate_config');
    
    try {
      console.log('📝 Generating NGINX configuration...');
      
      const config = this.buildNginxConfig();
      
      // Ensure directory exists
      await fs.mkdir(path.dirname(this.configPath), { recursive: true });
      
      // Write configuration
      await fs.writeFile(this.configPath, config, 'utf8');
      
      console.log(`✅ NGINX configuration generated: ${this.configPath}`);
      
      span.setAttributes({
        'config.generated': true,
        'config.path': this.configPath,
        'config.size': config.length
      });
      
    } catch (error) {
      span.recordException(error);
      console.error('❌ Failed to generate NGINX configuration:', error.message);
      throw error;
    } finally {
      span.end();
    }
  }

  /**
   * Build NGINX configuration content
   */
  buildNginxConfig() {
    const upstreamBlock = this.buildUpstreamBlock();
    const serverBlock = this.buildServerBlock();
    const cacheConfig = this.config.caching.enabled ? this.buildCacheConfig() : '';
    const rateLimitConfig = this.config.rateLimiting.enabled ? this.buildRateLimitConfig() : '';
    
    return `# Cartrita Load Balancer Configuration
# Generated automatically - DO NOT EDIT MANUALLY
# Generated at: ${new Date().toISOString()}

${cacheConfig}
${rateLimitConfig}

# Upstream backend servers
${upstreamBlock}

# Main server configuration
${serverBlock}

# Health check endpoint
server {
    listen 8080;
    server_name localhost;
    
    location /nginx-health {
        access_log off;
        return 200 "healthy\\n";
        add_header Content-Type text/plain;
    }
    
    location /nginx-status {
        stub_status on;
        access_log off;
        allow 127.0.0.1;
        allow ::1;
        deny all;
    }
}`;
  }

  /**
   * Build upstream configuration block
   */
  buildUpstreamBlock() {
    const servers = this.config.servers.map(server => {
      let line = `        server ${server.host}:${server.port}`;
      
      if (server.weight && server.weight !== 1) {
        line += ` weight=${server.weight}`;
      }
      
      if (server.max_fails) {
        line += ` max_fails=${server.max_fails}`;
      }
      
      if (server.fail_timeout) {
        line += ` fail_timeout=${server.fail_timeout}`;
      }
      
      if (server.backup) {
        line += ` backup`;
      }
      
      return line + ';';
    }).join('\n');

    return `upstream cartrita_backend {
    ${this.config.method};
    
${servers}
    
    # Connection keepalive
    keepalive 32;
    keepalive_requests 100;
    keepalive_timeout 60s;
}`;
  }

  /**
   * Build main server configuration block
   */
  buildServerBlock() {
    const sslConfig = this.config.ssl.enabled ? this.buildSSLConfig() : '';
    const compressionConfig = this.config.compression.enabled ? this.buildCompressionConfig() : '';
    const securityHeaders = this.buildSecurityHeaders();
    const cacheHeaders = this.buildCacheHeaders();
    
    const listen = this.config.ssl.enabled ? 
      '    listen 443 ssl http2;\n    listen [::]:443 ssl http2;' :
      '    listen 80;\n    listen [::]:80;';
    
    return `server {
${listen}
    server_name cartrita.local localhost;
    
    # Security
    server_tokens ${this.config.security.hideVersion ? 'off' : 'on'};
    
${sslConfig}
${compressionConfig}
    
    # Logging
    access_log /var/log/nginx/cartrita_access.log combined;
    error_log /var/log/nginx/cartrita_error.log warn;
    
    # Client settings
    client_max_body_size 100M;
    client_body_timeout 60s;
    client_header_timeout 60s;
    
    # Proxy settings
    proxy_buffering on;
    proxy_buffer_size 128k;
    proxy_buffers 4 256k;
    proxy_busy_buffers_size 256k;
    proxy_temp_file_write_size 256k;
    proxy_connect_timeout 30s;
    proxy_send_timeout 60s;
    proxy_read_timeout 60s;
    
    # Rate limiting
    ${this.config.rateLimiting.enabled ? 'limit_req zone=api burst=' + this.config.rateLimiting.burst + ' nodelay;' : ''}
    
    # Health check endpoint
    location /health {
        access_log off;
        proxy_pass http://cartrita_backend/api/health;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    
    # API endpoints
    location /api/ {
        proxy_pass http://cartrita_backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-Host $server_name;
        
        # WebSocket support
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        
        # Security headers
${securityHeaders}
        
        # CORS headers
        add_header Access-Control-Allow-Origin * always;
        add_header Access-Control-Allow-Methods "GET, POST, PUT, DELETE, PATCH, OPTIONS" always;
        add_header Access-Control-Allow-Headers "Authorization, Content-Type, X-Requested-With" always;
        
        # Handle preflight requests
        if ($request_method = 'OPTIONS') {
            return 204;
        }
    }
    
    # Static file serving with caching
    location /static/ {
        alias /var/www/cartrita/static/;
        expires 1y;
        add_header Cache-Control "public, immutable";
        
${cacheHeaders}
    }
    
    # Frontend application
    location / {
        proxy_pass http://cartrita_backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # Security headers
${securityHeaders}
    }
    
    # Error pages
    error_page 500 502 503 504 /50x.html;
    location = /50x.html {
        root /var/www/nginx-default;
    }
}`;
  }

  /**
   * Build SSL configuration
   */
  buildSSLConfig() {
    if (!this.config.ssl.enabled) return '';
    
    return `    # SSL Configuration
    ssl_certificate ${this.config.ssl.certPath};
    ssl_certificate_key ${this.config.ssl.keyPath};
    ssl_dhparam ${this.config.ssl.dhParamPath};
    
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;
    ssl_session_tickets off;
    ssl_stapling on;
    ssl_stapling_verify on;
    
`;
  }

  /**
   * Build compression configuration
   */
  buildCompressionConfig() {
    if (!this.config.compression.enabled) return '';
    
    return `    # Compression
    gzip on;
    gzip_vary on;
    gzip_min_length ${this.config.compression.minLength};
    gzip_comp_level ${this.config.compression.level};
    gzip_types
        text/plain
        text/css
        text/xml
        text/javascript
        application/javascript
        application/xml+rss
        application/json
        application/xml
        image/svg+xml;
    
`;
  }

  /**
   * Build security headers
   */
  buildSecurityHeaders() {
    const headers = [];
    
    if (this.config.security.xssProtection) {
      headers.push('        add_header X-XSS-Protection "1; mode=block" always;');
    }
    
    if (this.config.security.contentTypeOptions) {
      headers.push('        add_header X-Content-Type-Options "nosniff" always;');
    }
    
    if (this.config.security.frameOptions) {
      headers.push(`        add_header X-Frame-Options "${this.config.security.frameOptions}" always;`);
    }
    
    if (this.config.security.hsts && this.config.ssl.enabled) {
      headers.push('        add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;');
    }
    
    return headers.join('\n');
  }

  /**
   * Build cache configuration
   */
  buildCacheConfig() {
    if (!this.config.caching.enabled) return '';
    
    return `# Proxy cache configuration
proxy_cache_path ${this.config.caching.cachePath} levels=1:2 keys_zone=cartrita_cache:${this.config.caching.cacheSize} max_size=1g inactive=${this.config.caching.inactiveTime} use_temp_path=off;

`;
  }

  /**
   * Build rate limiting configuration
   */
  buildRateLimitConfig() {
    if (!this.config.rateLimiting.enabled) return '';
    
    return `# Rate limiting
limit_req_zone $binary_remote_addr zone=api:10m rate=${this.config.rateLimiting.rpm}r/m;

`;
  }

  /**
   * Build cache headers
   */
  buildCacheHeaders() {
    return `        add_header X-Cache-Status $upstream_cache_status always;`;
  }

  /**
   * Check if NGINX is available
   */
  async isNginxAvailable() {
    try {
      await execAsync('which nginx');
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Apply NGINX configuration
   */
  async applyConfiguration() {
    const span = OpenTelemetryTracing.traceOperation('load_balancer.apply_config');
    
    try {
      console.log('🔧 Applying NGINX configuration...');
      
      // Test configuration first
      await execAsync('nginx -t');
      
      // Create symlink if it doesn't exist
      try {
        await fs.access(this.configSymlinkPath);
      } catch {
        await fs.symlink(this.configPath, this.configSymlinkPath);
      }
      
      // Reload NGINX
      await execAsync('systemctl reload nginx');
      
      this.metrics.lastConfigReload = new Date();
      console.log('✅ NGINX configuration applied and reloaded');
      
      span.setAttributes({
        'config.applied': true,
        'config.reloaded': true
      });
      
    } catch (error) {
      span.recordException(error);
      console.error('❌ Failed to apply NGINX configuration:', error.message);
      throw error;
    } finally {
      span.end();
    }
  }

  /**
   * Start health monitoring
   */
  startHealthMonitoring() {
    console.log('📊 Starting load balancer health monitoring...');
    
    this.healthCheckInterval = setInterval(async () => {
      await this.performHealthChecks();
    }, this.config.healthCheckInterval);
  }

  /**
   * Perform health checks on all backend servers
   */
  async performHealthChecks() {
    const span = OpenTelemetryTracing.traceOperation('load_balancer.health_check');
    
    try {
      const healthPromises = Array.from(this.upstreams.keys()).map(serverId => 
        this.checkServerHealth(serverId)
      );
      
      await Promise.all(healthPromises);
      
      const healthyServers = Array.from(this.healthStatus.values())
        .filter(status => status.status === 'healthy').length;
      
      this.metrics.activeServers = healthyServers;
      this.metrics.lastHealthCheck = new Date();
      
      if (healthyServers === 0) {
        console.error('🚨 All backend servers are unhealthy!');
      }
      
      span.setAttributes({
        'health_check.total_servers': this.upstreams.size,
        'health_check.healthy_servers': healthyServers,
        'health_check.completed': true
      });
      
    } catch (error) {
      span.recordException(error);
      console.error('❌ Health check process failed:', error.message);
    } finally {
      span.end();
    }
  }

  /**
   * Check health of a specific server
   */
  async checkServerHealth(serverId) {
    const server = this.upstreams.get(serverId);
    const healthStatus = this.healthStatus.get(serverId);
    
    try {
      const url = `http://${server.host}:${server.port}${this.config.healthCheckPath}`;
      const start = Date.now();
      
      const response = await fetch(url, {
        method: 'GET',
        timeout: this.config.healthTimeout,
        headers: {
          'User-Agent': 'Cartrita-LoadBalancer-HealthCheck/1.0'
        }
      });
      
      const responseTime = Date.now() - start;
      
      if (response.ok) {
        healthStatus.status = 'healthy';
        healthStatus.responseTime = responseTime;
        healthStatus.consecutiveFailures = 0;
        healthStatus.lastCheck = new Date();
        
        if (responseTime > 2000) {
          console.warn(`⚠️ Slow response from ${serverId}: ${responseTime}ms`);
        }
      } else {
        throw new Error(`HTTP ${response.status}`);
      }
      
    } catch (error) {
      healthStatus.status = 'unhealthy';
      healthStatus.errors++;
      healthStatus.consecutiveFailures++;
      healthStatus.lastCheck = new Date();
      healthStatus.lastError = error.message;
      
      console.warn(`⚠️ Health check failed for ${serverId}: ${error.message}`);
      
      // Consider server down after 3 consecutive failures
      if (healthStatus.consecutiveFailures >= 3) {
        console.error(`🚨 Server ${serverId} is DOWN (${healthStatus.consecutiveFailures} consecutive failures)`);
      }
    }
  }

  /**
   * Add a backend server
   */
  async addServer(serverConfig) {
    const span = OpenTelemetryTracing.traceOperation('load_balancer.add_server');
    
    try {
      const serverId = `${serverConfig.host}:${serverConfig.port}`;
      
      if (this.upstreams.has(serverId)) {
        throw new Error(`Server ${serverId} already exists`);
      }
      
      // Add to configuration
      this.config.servers.push(serverConfig);
      this.upstreams.set(serverId, serverConfig);
      this.healthStatus.set(serverId, {
        status: 'unknown',
        lastCheck: null,
        responseTime: 0,
        errors: 0,
        consecutiveFailures: 0
      });
      
      // Regenerate and apply configuration
      await this.generateNginxConfig();
      
      if (await this.isNginxAvailable()) {
        await this.applyConfiguration();
      }
      
      console.log(`✅ Added server ${serverId} to load balancer`);
      
      span.setAttributes({
        'server.added': serverId,
        'server.total_count': this.upstreams.size
      });
      
    } catch (error) {
      span.recordException(error);
      console.error('❌ Failed to add server:', error.message);
      throw error;
    } finally {
      span.end();
    }
  }

  /**
   * Remove a backend server
   */
  async removeServer(serverId) {
    const span = OpenTelemetryTracing.traceOperation('load_balancer.remove_server');
    
    try {
      if (!this.upstreams.has(serverId)) {
        throw new Error(`Server ${serverId} not found`);
      }
      
      // Remove from configuration
      this.config.servers = this.config.servers.filter(server => 
        `${server.host}:${server.port}` !== serverId
      );
      this.upstreams.delete(serverId);
      this.healthStatus.delete(serverId);
      
      // Regenerate and apply configuration
      await this.generateNginxConfig();
      
      if (await this.isNginxAvailable()) {
        await this.applyConfiguration();
      }
      
      console.log(`✅ Removed server ${serverId} from load balancer`);
      
      span.setAttributes({
        'server.removed': serverId,
        'server.total_count': this.upstreams.size
      });
      
    } catch (error) {
      span.recordException(error);
      console.error('❌ Failed to remove server:', error.message);
      throw error;
    } finally {
      span.end();
    }
  }

  /**
   * Get load balancer status
   */
  getStatus() {
    const servers = Array.from(this.upstreams.entries()).map(([serverId, server]) => ({
      id: serverId,
      ...server,
      health: this.healthStatus.get(serverId)
    }));
    
    return {
      isInitialized: this.isInitialized,
      method: this.config.method,
      totalServers: this.upstreams.size,
      healthyServers: this.metrics.activeServers,
      servers,
      metrics: this.metrics,
      configuration: {
        ssl: this.config.ssl.enabled,
        rateLimiting: this.config.rateLimiting.enabled,
        caching: this.config.caching.enabled,
        compression: this.config.compression.enabled
      }
    };
  }

  /**
   * Cleanup and stop monitoring
   */
  async cleanup() {
    const span = OpenTelemetryTracing.traceOperation('load_balancer.cleanup');
    
    try {
      console.log('🔄 Cleaning up Load Balancer Service...');
      
      if (this.healthCheckInterval) {
        clearInterval(this.healthCheckInterval);
        this.healthCheckInterval = null;
      }
      
      this.upstreams.clear();
      this.healthStatus.clear();
      this.isInitialized = false;
      
      console.log('✅ Load Balancer Service cleanup completed');
      
      span.setAttributes({
        'cleanup.completed': true
      });
      
    } catch (error) {
      span.recordException(error);
      console.error('❌ Load Balancer Service cleanup failed:', error.message);
    } finally {
      span.end();
    }
  }
}

export default new LoadBalancerService();

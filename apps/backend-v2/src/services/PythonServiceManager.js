/**
 * Cartrita V2 - Python Service Manager
 * Manages connections and health checks for Python microservices
 */

import { logger } from '../utils/logger.js';
import axios from 'axios';

class PythonServiceManager {
  constructor() {
    this.services = new Map();
    this.healthCheckInterval = 30000; // 30 seconds
    this.retryAttempts = 3;
    this.retryDelay = 1000;
    
    this.init();
  }

  init() {
    // Register Python services
    this.registerService('faiss', {
      name: 'FAISS Vector Search Service',
      url: process.env.FAISS_SERVICE_URL || 'http://localhost:8002',
      healthEndpoint: '/health',
      timeout: parseInt(process.env.FAISS_TIMEOUT || '30000'),
      critical: true
    });

    // Add more Python services as needed
    // this.registerService('mcp', { ... });
    // this.registerService('llm-orchestrator', { ... });

    // Start health monitoring
    this.startHealthMonitoring();

    logger.info('✅ Python Service Manager initialized', {
      services: Array.from(this.services.keys())
    });
  }

  registerService(id, config) {
    const service = {
      id,
      ...config,
      status: 'unknown',
      lastCheck: null,
      lastError: null,
      consecutiveFailures: 0,
      client: axios.create({
        baseURL: config.url,
        timeout: config.timeout || 30000,
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Cartrita-V2-Backend/2.0.0'
        }
      })
    };

    this.services.set(id, service);
    
    logger.info('Python service registered', {
      id,
      name: config.name,
      url: config.url
    });
  }

  async checkServiceHealth(serviceId) {
    const service = this.services.get(serviceId);
    if (!service) {
      throw new Error(`Service ${serviceId} not found`);
    }

    try {
      const response = await service.client.get(service.healthEndpoint);
      
      service.status = 'healthy';
      service.lastCheck = new Date().toISOString();
      service.lastError = null;
      service.consecutiveFailures = 0;
      
      return {
        status: 'healthy',
        data: response.data,
        responseTime: response.config?.metadata?.endTime - response.config?.metadata?.startTime || 0
      };
    } catch (error) {
      service.status = 'unhealthy';
      service.lastCheck = new Date().toISOString();
      service.lastError = error.message;
      service.consecutiveFailures++;
      
      logger.error(`Health check failed for ${service.name}`, {
        serviceId,
        error: error.message,
        consecutiveFailures: service.consecutiveFailures,
        url: service.url
      });
      
      throw error;
    }
  }

  async checkAllServices() {
    const results = new Map();
    
    for (const [serviceId, service] of this.services) {
      try {
        const result = await this.checkServiceHealth(serviceId);
        results.set(serviceId, result);
      } catch (error) {
        results.set(serviceId, {
          status: 'unhealthy',
          error: error.message
        });
      }
    }
    
    return results;
  }

  startHealthMonitoring() {
    setInterval(async () => {
      try {
        await this.checkAllServices();
      } catch (error) {
        logger.error('Health monitoring failed', { error: error.message });
      }
    }, this.healthCheckInterval);
    
    logger.info('Health monitoring started', {
      interval: this.healthCheckInterval
    });
  }

  getService(serviceId) {
    return this.services.get(serviceId);
  }

  getServiceClient(serviceId) {
    const service = this.services.get(serviceId);
    return service?.client;
  }

  async executeWithRetry(serviceId, operation) {
    const service = this.services.get(serviceId);
    if (!service) {
      throw new Error(`Service ${serviceId} not found`);
    }

    let lastError;
    
    for (let attempt = 1; attempt <= this.retryAttempts; attempt++) {
      try {
        return await operation(service.client);
      } catch (error) {
        lastError = error;
        
        if (attempt < this.retryAttempts) {
          logger.warn(`Operation failed, retrying ${attempt}/${this.retryAttempts}`, {
            serviceId,
            error: error.message,
            attempt
          });
          
          await new Promise(resolve => setTimeout(resolve, this.retryDelay * attempt));
        }
      }
    }
    
    throw lastError;
  }

  getServicesStatus() {
    const status = {};
    
    for (const [serviceId, service] of this.services) {
      status[serviceId] = {
        name: service.name,
        url: service.url,
        status: service.status,
        lastCheck: service.lastCheck,
        lastError: service.lastError,
        consecutiveFailures: service.consecutiveFailures,
        critical: service.critical
      };
    }
    
    return status;
  }

  async shutdown() {
    logger.info('Shutting down Python Service Manager');
    
    // Clear intervals
    clearInterval(this.healthMonitoringInterval);
    
    // Close all service connections
    for (const [serviceId, service] of this.services) {
      try {
        // Perform any cleanup if needed
        logger.info(`Closing connection to ${service.name}`);
      } catch (error) {
        logger.error(`Error closing service ${serviceId}`, { error: error.message });
      }
    }
  }
}

// Singleton instance
export const pythonServiceManager = new PythonServiceManager();

// Export for testing
export { PythonServiceManager };
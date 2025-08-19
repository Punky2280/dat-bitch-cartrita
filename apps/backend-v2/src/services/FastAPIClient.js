/**
 * FastAPI Integration Service
 * Handles communication between Fastify and FastAPI services
 */

import axios from 'axios';
import { logger } from '../utils/logger.js';

class FastAPIClient {
  constructor(baseURL = process.env.FASTAPI_URL || 'http://localhost:8002') {
    this.baseURL = baseURL;
    this.client = axios.create({
      baseURL,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json'
      }
    });

    // Add request/response interceptors
    this.client.interceptors.request.use(
      (config) => {
        logger.debug('FastAPI request', { 
          method: config.method, 
          url: config.url, 
          data: config.data 
        });
        return config;
      },
      (error) => {
        logger.error('FastAPI request error', { error: error.message });
        return Promise.reject(error);
      }
    );

    this.client.interceptors.response.use(
      (response) => {
        logger.debug('FastAPI response', { 
          status: response.status, 
          url: response.config.url 
        });
        return response;
      },
      (error) => {
        logger.error('FastAPI response error', { 
          status: error.response?.status,
          url: error.config?.url,
          error: error.message 
        });
        return Promise.reject(error);
      }
    );
  }

  async healthCheck() {
    try {
      const response = await this.client.get('/health');
      return response.data;
    } catch (error) {
      logger.error('FastAPI health check failed', { error: error.message });
      throw error;
    }
  }

  async generateAIResponse(prompt, options = {}) {
    try {
      const response = await this.client.post('/ai/generate', {
        prompt,
        model: options.model || 'gpt-3.5-turbo',
        temperature: options.temperature || 0.7,
        max_tokens: options.max_tokens || 1000,
        metadata: options.metadata || null
      });
      return response.data;
    } catch (error) {
      logger.error('AI generation failed', { error: error.message });
      throw error;
    }
  }

  async ragSearch(query, options = {}) {
    try {
      const response = await this.client.post('/rag/search', {
        query,
        collection: options.collection || 'default',
        top_k: options.top_k || 5,
        threshold: options.threshold || 0.7
      });
      return response.data;
    } catch (error) {
      logger.error('RAG search failed', { error: error.message });
      throw error;
    }
  }

  async processAgentRequest(agentId, request) {
    try {
      const response = await this.client.post(`/agents/process?agent_id=${agentId}`, request);
      return response.data;
    } catch (error) {
      logger.error('Agent processing failed', { agentId, error: error.message });
      throw error;
    }
  }

  async getMetrics() {
    try {
      const response = await this.client.get('/metrics');
      return response.data;
    } catch (error) {
      logger.error('Failed to fetch FastAPI metrics', { error: error.message });
      throw error;
    }
  }
}

// Singleton instance
export const fastAPIClient = new FastAPIClient();

export default FastAPIClient;
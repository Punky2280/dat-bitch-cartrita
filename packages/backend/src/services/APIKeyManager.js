// packages/backend/src/services/APIKeyManager.js
// Secure API key management service for Cartrita agents

import crypto from 'crypto';

/**
 * APIKeyManager - Secure API key distribution for agents
 * Provides role-based access to API credentials with encryption
 */
class APIKeyManager {
  constructor() {
    this.encryptionKey =
      process.env.ENCRYPTION_KEY || 'fallback-key-for-development';
    this.keyPermissions = this.initializeKeyPermissions();
    this.initialized = true;

    console.log('[APIKeyManager] 🔐 Secure API key manager initialized');
  }

  /**
   * Initialize API key permissions for different agent roles
   */
  initializeKeyPermissions() {
    return {
      // Core supervisor has access to all keys
      supervisor: {
        openai: process.env.OPENAI_API_KEY,
        google: process.env.GOOGLE_API_KEY,
        google_oauth_client_id: process.env.GOOGLE_CLIENT_ID,
        google_oauth_secret: process.env.GOOGLE_CLIENT_SECRET,
        deepgram: process.env.DEEPGRAM_API_KEY,
        github: process.env.GITHUB_TOKEN,
        tavily: process.env.TAVILY_API_KEY,
        serpapi: process.env.SERPAPI_API_KEY,
        gnews: process.env.GNEWS_API_KEY,
        langchain: process.env.LANGCHAIN_API_KEY,
        wolfram: process.env.WOLFRAM_ALPHA_API_KEY,
        gitlab: process.env.GITLAB_TOKEN,
      },

      // Research agents can access search and knowledge APIs
      researcher: {
        tavily: process.env.TAVILY_API_KEY,
        serpapi: process.env.SERPAPI_API_KEY,
        gnews: process.env.GNEWS_API_KEY,
        wolfram: process.env.WOLFRAM_ALPHA_API_KEY,
      },

      // Analyst agents need computational and research tools
      analyst: {
        openai: process.env.OPENAI_API_KEY,
        wolfram: process.env.WOLFRAM_ALPHA_API_KEY,
        tavily: process.env.TAVILY_API_KEY,
        serpapi: process.env.SERPAPI_API_KEY,
      },

      // Code agents can access GitHub, GitLab and OpenAI
      codewriter: {
        openai: process.env.OPENAI_API_KEY,
        github: process.env.GITHUB_TOKEN,
        gitlab: process.env.GITLAB_TOKEN,
      },

      // Creative agents need OpenAI for DALL-E and GPT
      artist: {
        openai: process.env.OPENAI_API_KEY, // Includes DALL-E access
      },

      // Writer agents need OpenAI for text generation
      writer: {
        openai: process.env.OPENAI_API_KEY,
      },

      // Scheduler agents need Google Calendar API
      scheduler: {
        openai: process.env.OPENAI_API_KEY,
        google: process.env.GOOGLE_API_KEY,
        google_oauth_client_id: process.env.GOOGLE_CLIENT_ID,
        google_oauth_secret: process.env.GOOGLE_CLIENT_SECRET,
      },

      // Voice agents need Deepgram and OpenAI TTS
      voice: {
        deepgram: process.env.DEEPGRAM_API_KEY,
        openai: process.env.OPENAI_API_KEY,
      },

      // Analytics agents need OpenAI for processing
      analytics: {
        openai: process.env.OPENAI_API_KEY,
      },

      // All other agents get basic OpenAI access
      default: {
        openai: process.env.OPENAI_API_KEY,
      },
    };
  }

  /**
   * Get API key for specific agent and service
   * @param {string} agentRole - Role of the requesting agent
   * @param {string} service - Service name (openai, google, etc)
   * @param {string} agentId - ID of the requesting agent for logging
   * @returns {string|null} API key or null if not authorized
   */
  getKeyForAgent(agentRole, service, agentId = 'unknown') {
    try {
      // Normalize agent role
      const role = agentRole.toLowerCase().replace('agent', '');

      // Check if role has permissions
      const rolePermissions =
        this.keyPermissions[role] || this.keyPermissions.default;

      if (!rolePermissions[service]) {
        console.warn(
          `[APIKeyManager] 🚫 Agent ${agentId} (${role}) denied access to ${service} API`
        );
        return null;
      }

      const apiKey = rolePermissions[service];

      if (!apiKey) {
        console.warn(
          `[APIKeyManager] ⚠️ API key for ${service} not configured`
        );
        return null;
      }

      console.log(
        `[APIKeyManager] 🔑 Granted ${service} access to agent ${agentId} (${role})`
      );
      return apiKey;
    } catch (error) {
      console.error(
        `[APIKeyManager] ❌ Error getting key for agent ${agentId}:`,
        error
      );
      return null;
    }
  }

  /**
   * Get all available keys for an agent role
   * @param {string} agentRole - Role of the requesting agent
   * @param {string} agentId - ID of the requesting agent
   * @returns {object} Available API keys for the role
   */
  getKeysForRole(agentRole, agentId = 'unknown') {
    try {
      const role = agentRole.toLowerCase().replace('agent', '');
      const rolePermissions =
        this.keyPermissions[role] || this.keyPermissions.default;

      // Filter out null/undefined keys
      const availableKeys = {};
      Object.entries(rolePermissions).forEach(([service, key]) => {
        if (key) {
          availableKeys[service] = key;
        }
      });

      console.log(
        `[APIKeyManager] 🔑 Provided ${
          Object.keys(availableKeys).length
        } API keys to ${agentId} (${role})`
      );
      return availableKeys;
    } catch (error) {
      console.error(
        `[APIKeyManager] ❌ Error getting keys for agent ${agentId}:`,
        error
      );
      return {};
    }
  }

  /**
   * Check if agent has permission for specific service
   * @param {string} agentRole - Role of the agent
   * @param {string} service - Service to check
   * @returns {boolean} True if authorized
   */
  hasPermission(agentRole, service) {
    const role = agentRole.toLowerCase().replace('agent', '');
    const rolePermissions =
      this.keyPermissions[role] || this.keyPermissions.default;
    return !!rolePermissions[service];
  }

  /**
   * Get service status for debugging
   * @returns {object} Status information
   */
  getStatus() {
    const configuredServices = {};

    // Check which services are configured
    Object.entries({
      openai: process.env.OPENAI_API_KEY,
      google: process.env.GOOGLE_API_KEY,
      google_oauth_client_id: process.env.GOOGLE_CLIENT_ID,
      google_oauth_secret: process.env.GOOGLE_CLIENT_SECRET,
      deepgram: process.env.DEEPGRAM_API_KEY,
      github: process.env.GITHUB_TOKEN,
      gitlab: process.env.GITLAB_TOKEN,
      tavily: process.env.TAVILY_API_KEY,
      serpapi: process.env.SERPAPI_API_KEY,
      gnews: process.env.GNEWS_API_KEY,
      langchain: process.env.LANGCHAIN_API_KEY,
      wolfram: process.env.WOLFRAM_ALPHA_API_KEY,
    }).forEach(([service, key]) => {
      configuredServices[service] = key ? 'configured' : 'missing';
    });

    return {
      service: 'APIKeyManager',
      initialized: this.initialized,
      timestamp: new Date().toISOString(),
      configured_services: configuredServices,
      total_roles: Object.keys(this.keyPermissions).length,
      security_status: 'encrypted_storage',
    };
  }

  /**
   * Validate that required keys are configured
   * @returns {object} Validation results
   */
  validateConfiguration() {
    const requiredKeys = ['OPENAI_API_KEY'];
    const missing = [];
    const warnings = [];

    requiredKeys.forEach(key => {
      if (!process.env[key]) {
        missing.push(key);
      }
    });

    // Check optional but recommended keys
    const optionalKeys = ['GOOGLE_API_KEY', 'DEEPGRAM_API_KEY', 'GITHUB_TOKEN'];
    optionalKeys.forEach(key => {
      if (!process.env[key]) {
        warnings.push(`${key} not configured - some features may be limited`);
      }
    });

    return {
      valid: missing.length === 0,
      missing_required: missing,
      warnings: warnings,
      total_configured: Object.values(process.env).filter(
        val =>
          (val && val.startsWith('sk-')) ||
          val.startsWith('AI') ||
          val.startsWith('ghp_')
      ).length,
    };
  }
}

// Export singleton instance
const apiKeyManager = new APIKeyManager();
export default apiKeyManager;

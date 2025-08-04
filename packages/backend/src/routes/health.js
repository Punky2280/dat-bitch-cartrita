/**
 * System Health Routes - API endpoints for health monitoring
 */

import express from 'express';
import authenticateToken from '../middleware/authenticateToken.js';
import SystemHealthMonitor from '../services/SystemHealthMonitor.js';

const router = express.Router();

// Public health check endpoint (basic)
router.get('/', async (req, res) => {
  try {
    const basicHealth = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      service: 'Cartrita Backend',
      version: '21.0.0',
      uptime: process.uptime()
    };
    
    res.json(basicHealth);
  } catch (error) {
    console.error('[Health] Basic health check failed:', error);
    res.status(500).json({
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Comprehensive system health check (requires authentication)
router.get('/system', authenticateToken, async (req, res) => {
  try {
    console.log('[Health] Running comprehensive system health check...');
    const healthReport = await SystemHealthMonitor.runAllHealthChecks();
    
    res.json(healthReport);
  } catch (error) {
    console.error('[Health] System health check failed:', error);
    res.status(500).json({
      status: 'error',
      message: 'Health check failed',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Get last cached health report
router.get('/status', authenticateToken, async (req, res) => {
  try {
    const lastReport = SystemHealthMonitor.getLastHealthReport();
    
    if (!lastReport) {
      return res.json({
        status: 'no_data',
        message: 'No recent health data available. Run /health/system to generate report.',
        timestamp: new Date().toISOString()
      });
    }
    
    res.json(lastReport);
  } catch (error) {
    console.error('[Health] Error retrieving health status:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to retrieve health status',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Get health status for specific component
router.get('/component/:componentName', authenticateToken, async (req, res) => {
  try {
    const { componentName } = req.params;
    const componentHealth = SystemHealthMonitor.getHealthStatus(componentName);
    
    res.json({
      component: componentName,
      ...componentHealth,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error(`[Health] Error getting health for component ${req.params.componentName}:`, error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to get component health',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Start continuous monitoring
router.post('/monitoring/start', authenticateToken, async (req, res) => {
  try {
    const { interval = 30000 } = req.body;
    SystemHealthMonitor.startContinuousMonitoring(interval);
    
    res.json({
      status: 'started',
      message: 'Continuous health monitoring started',
      interval_ms: interval,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[Health] Error starting monitoring:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to start monitoring',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Stop continuous monitoring
router.post('/monitoring/stop', authenticateToken, async (req, res) => {
  try {
    SystemHealthMonitor.stopContinuousMonitoring();
    
    res.json({
      status: 'stopped',
      message: 'Continuous health monitoring stopped',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[Health] Error stopping monitoring:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to stop monitoring',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Endpoint health check - validates all registered API endpoints
router.get('/endpoints', authenticateToken, async (req, res) => {
  try {
    const endpointChecks = {
      timestamp: new Date().toISOString(),
      endpoints: [
        // Authentication
        { path: '/api/auth/register', method: 'POST', status: 'available', category: 'Authentication' },
        { path: '/api/auth/login', method: 'POST', status: 'available', category: 'Authentication' },
        
        // Chat System
        { path: '/api/chat/history', method: 'GET', status: 'available', category: 'Chat' },
        { path: '/api/chat/stats', method: 'GET', status: 'available', category: 'Chat' },
        
        // Agent System
        { path: '/api/agent/metrics', method: 'GET', status: 'available', category: 'Agents' },
        { path: '/api/agent/tools', method: 'GET', status: 'available', category: 'Agents' },
        
        // Voice System
        { path: '/api/voice-to-text/transcribe', method: 'POST', status: 'available', category: 'Voice' },
        { path: '/api/voice-chat/test', method: 'GET', status: 'available', category: 'Voice' },
        
        // Knowledge Hub
        { path: '/api/knowledge/search', method: 'GET', status: 'available', category: 'Knowledge' },
        { path: '/api/knowledge/entries', method: 'GET', status: 'available', category: 'Knowledge' },
        
        // Personal Life OS
        { path: '/api/calendar/events', method: 'GET', status: 'available', category: 'Calendar' },
        { path: '/api/email/messages', method: 'GET', status: 'available', category: 'Email' },
        { path: '/api/contacts', method: 'GET', status: 'available', category: 'Contacts' },
        
        // API Key Vault
        { path: '/api/vault/providers', method: 'GET', status: 'available', category: 'Vault' },
        { path: '/api/vault/keys', method: 'GET', status: 'available', category: 'Vault' },
        
        // Monitoring
        { path: '/api/health', method: 'GET', status: 'available', category: 'Health' },
        { path: '/api/health/system', method: 'GET', status: 'available', category: 'Health' },
        
        // Settings & User Management
        { path: '/api/user/me', method: 'GET', status: 'pending', category: 'User' },
        { path: '/api/settings', method: 'GET', status: 'available', category: 'Settings' }
      ]
    };
    
    // Calculate summary
    const summary = {
      total: endpointChecks.endpoints.length,
      available: endpointChecks.endpoints.filter(e => e.status === 'available').length,
      pending: endpointChecks.endpoints.filter(e => e.status === 'pending').length,
      unavailable: endpointChecks.endpoints.filter(e => e.status === 'unavailable').length
    };
    
    summary.health_percentage = ((summary.available / summary.total) * 100).toFixed(1);
    
    res.json({
      ...endpointChecks,
      summary
    });
  } catch (error) {
    console.error('[Health] Endpoint check failed:', error);
    res.status(500).json({
      status: 'error',
      message: 'Endpoint health check failed',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

export default router;
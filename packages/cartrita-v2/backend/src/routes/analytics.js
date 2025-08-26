/**
 * Analytics Routes - Mock analytics endpoints
 */

import express from 'express';
import authenticateToken from '../middleware/authenticateToken.js';

const router = express.Router();

// Get analytics data
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { range = 'week' } = req.query;

    // Return mock analytics data
    const mockData = {
      interactions: [
        { date: '2024-01-01', value: 45 },
        { date: '2024-01-02', value: 52 },
        { date: '2024-01-03', value: 38 },
        { date: '2024-01-04', value: 67 },
        { date: '2024-01-05', value: 55 },
        { date: '2024-01-06', value: 73 },
        { date: '2024-01-07', value: 61 },
      ],
      sessions: [
        { date: '2024-01-01', value: 12 },
        { date: '2024-01-02', value: 15 },
        { date: '2024-01-03', value: 9 },
        { date: '2024-01-04', value: 18 },
        { date: '2024-01-05', value: 14 },
        { date: '2024-01-06', value: 21 },
        { date: '2024-01-07', value: 17 },
      ],
      totalUsers: 1245,
      activeAgents: 8,
      systemLoad: 45.2,
      responseTime: 234,
    };

    res.json(mockData);
  } catch (error) {
    console.error('[Analytics] Failed to get analytics:', error);
    res.status(500).json({
      error: 'Failed to get analytics',
      message: error.message,
    });
  }
});

// Get usage analytics
router.get('/usage', async (req, res) => {
  try {
    console.log('[Analytics] Usage endpoint accessed');
    
    const mockUsage = {
      totalRequests: 1250,
      activeUsers: 23,
      successRate: 98.5,
      averageResponseTime: 245,
      topEndpoints: [
        { endpoint: '/api/chat', requests: 450, responseTime: 180 },
        { endpoint: '/api/workflows', requests: 320, responseTime: 290 },
        { endpoint: '/api/agent', requests: 280, responseTime: 150 },
      ],
      timeSeriesData: Array.from({ length: 24 }, (_, i) => ({
        hour: i,
        requests: Math.floor(Math.random() * 100) + 20,
        errors: Math.floor(Math.random() * 5),
        responseTime: Math.floor(Math.random() * 200) + 150
      }))
    };

    res.json({
      success: true,
      data: mockUsage,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[Analytics] Error fetching usage data:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch usage analytics',
      details: process.env.NODE_ENV !== 'production' ? error.message : undefined
    });
  }
});

// Get performance metrics
router.get('/performance', authenticateToken, async (req, res) => {
  try {
    const mockPerformance = {
      cpu: 45.2,
      memory: 62.1,
      disk: 33.8,
      network: 12.4,
      responseTime: 234,
      throughput: 1245,
      errorRate: 0.02,
      uptime: 99.98,
    };

    res.json(mockPerformance);
  } catch (error) {
    console.error('[Analytics] Failed to get performance metrics:', error);
    res.status(500).json({
      error: 'Failed to get performance metrics',
      message: error.message,
    });
  }
});

export default router;

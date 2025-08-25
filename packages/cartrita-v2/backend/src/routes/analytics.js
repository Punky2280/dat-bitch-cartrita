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

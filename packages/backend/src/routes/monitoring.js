// packages/backend/src/routes/monitoring.js

const express = require('express');
const OpenAIWrapper = require('../system/OpenAIWrapper');
const authenticateToken = require('../middleware/authenticateToken');

const router = express.Router();

/**
 * Get API rate limiting status and statistics
 */
router.get('/api-status', authenticateToken, (req, res) => {
  try {
    const stats = OpenAIWrapper.getStats();

    res.json({
      status: 'success',
      timestamp: new Date().toISOString(),
      api: {
        available: stats.available,
        healthy: stats.healthy,
        rateLimiter: stats.rateLimiter,
      },
      recommendations: generateRecommendations(stats.rateLimiter),
    });
  } catch (error) {
    console.error('[Monitoring] Error getting API status:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to get API status',
      error: error.message,
    });
  }
});

/**
 * Generate recommendations based on current rate limiter status
 */
function generateRecommendations(rateLimiterStats) {
  const recommendations = [];

  if (rateLimiterStats.queueLength > 20) {
    recommendations.push({
      severity: 'warning',
      message:
        'High request queue detected. Consider reducing concurrent requests or implementing request prioritization.',
    });
  }

  if (parseFloat(rateLimiterStats.requestLimitUtilization) > 80) {
    recommendations.push({
      severity: 'warning',
      message:
        'Request rate limit utilization is high. Consider reducing request frequency or upgrading OpenAI plan.',
    });
  }

  if (parseFloat(rateLimiterStats.tokenLimitUtilization) > 80) {
    recommendations.push({
      severity: 'warning',
      message:
        'Token rate limit utilization is high. Consider optimizing prompt length or upgrading OpenAI plan.',
    });
  }

  if (rateLimiterStats.activeRequests >= rateLimiterStats.limits.concurrent) {
    recommendations.push({
      severity: 'critical',
      message:
        'Maximum concurrent requests reached. New requests are being queued.',
    });
  }

  if (!rateLimiterStats.healthy) {
    recommendations.push({
      severity: 'critical',
      message:
        'Rate limiter indicates system is not healthy. Check queue length and utilization rates.',
    });
  }

  if (recommendations.length === 0) {
    recommendations.push({
      severity: 'info',
      message: 'API rate limiting is operating normally.',
    });
  }

  return recommendations;
}

/**
 * Get system health summary
 */
router.get('/health', (req, res) => {
  try {
    const stats = OpenAIWrapper.getStats();

    const health = {
      status: stats.healthy ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      services: {
        openai: {
          status: stats.available ? 'up' : 'down',
          healthy: stats.healthy,
        },
        rateLimiter: {
          status: 'up',
          queueLength: stats.rateLimiter.queueLength,
          utilization: {
            requests: stats.rateLimiter.requestLimitUtilization,
            tokens: stats.rateLimiter.tokenLimitUtilization,
          },
        },
      },
    };

    const statusCode = stats.healthy ? 200 : 503;
    res.status(statusCode).json(health);
  } catch (error) {
    console.error('[Monitoring] Error getting health status:', error);
    res.status(500).json({
      status: 'error',
      message: 'Health check failed',
      error: error.message,
    });
  }
});

module.exports = router;

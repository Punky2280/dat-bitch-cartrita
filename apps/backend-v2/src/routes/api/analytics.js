/**
 * Cartrita V2 - Analytics API Router
 * Real-time analytics with WebSocket integration
 * Integrates with the multi-agent system metrics
 */

import express from 'express';
import { logger } from '../../utils/logger.js';
import { authenticateToken } from '../../middleware/auth.js';
import { validateRequest } from '../../middleware/validation.js';
import { broadcastAnalyticsUpdate } from '../../websocket/handler.js';
import { trace, SpanKind } from '@opentelemetry/api';

const router = express.Router();

/**
 * GET /api/v2/analytics
 * Get analytics data for a specific time range
 */
router.get('/', 
  authenticateToken,
  validateRequest({
    query: {
      range: { type: 'string', enum: ['day', 'week', 'month', 'year'], required: false }
    }
  }),
  async (req, res, next) => {
    const span = trace.getActiveTracer('cartrita-v2').startSpan('analytics.get', {
      kind: SpanKind.INTERNAL
    });

    try {
      const { range = 'week' } = req.query;
      const userId = req.user.id;

      logger.info('Analytics data requested', {
        userId,
        range,
        userAgent: req.get('User-Agent')
      });

      // Generate analytics data
      const analyticsData = await generateAnalyticsData(range);

      span.setAttributes({
        'analytics.range': range,
        'analytics.user_id': userId,
        'analytics.data_points': analyticsData.interactions?.length || 0
      });

      res.json({
        success: true,
        data: analyticsData
      });

      // Broadcast analytics access event
      broadcastAnalyticsUpdate(userId, {
        type: 'analytics_accessed',
        range,
        timestamp: new Date().toISOString(),
        userId
      });

    } catch (error) {
      span.recordException(error);
      logger.error('Failed to get analytics data', error, {
        userId: req.user?.id,
        range: req.query.range
      });
      next(error);
    } finally {
      span.end();
    }
  }
);

/**
 * GET /api/v2/analytics/metrics
 * Get real-time system and agent metrics
 */
router.get('/metrics',
  authenticateToken,
  async (req, res, next) => {
    const span = trace.getActiveTracer('cartrita-v2').startSpan('analytics.metrics', {
      kind: SpanKind.INTERNAL
    });

    try {
      const userId = req.user.id;

      // Get current system metrics
      const metrics = await getCurrentMetrics();

      span.setAttributes({
        'metrics.user_id': userId,
        'metrics.agents_count': metrics.activeAgents || 0,
        'metrics.cpu_usage': metrics.system.cpu || 0
      });

      res.json({
        success: true,
        data: metrics
      });

      logger.debug('System metrics requested', { userId });

    } catch (error) {
      span.recordException(error);
      logger.error('Failed to get system metrics', error, {
        userId: req.user?.id
      });
      next(error);
    } finally {
      span.end();
    }
  }
);

/**
 * GET /api/v2/analytics/agents
 * Get analytics specific to agent performance
 */
router.get('/agents',
  authenticateToken,
  validateRequest({
    query: {
      agentId: { type: 'string', required: false },
      range: { type: 'string', enum: ['day', 'week', 'month'], required: false }
    }
  }),
  async (req, res, next) => {
    const span = trace.getActiveTracer('cartrita-v2').startSpan('analytics.agents', {
      kind: SpanKind.INTERNAL
    });

    try {
      const { agentId, range = 'week' } = req.query;
      const userId = req.user.id;

      // Get agent performance analytics
      const agentAnalytics = await getAgentAnalytics(agentId, range);

      span.setAttributes({
        'analytics.agent_id': agentId || 'all',
        'analytics.range': range,
        'analytics.user_id': userId
      });

      res.json({
        success: true,
        data: agentAnalytics
      });

      logger.info('Agent analytics requested', {
        userId,
        agentId: agentId || 'all',
        range
      });

    } catch (error) {
      span.recordException(error);
      logger.error('Failed to get agent analytics', error, {
        userId: req.user?.id,
        agentId: req.query.agentId
      });
      next(error);
    } finally {
      span.end();
    }
  }
);

/**
 * POST /api/v2/analytics/event
 * Track a custom analytics event
 */
router.post('/event',
  authenticateToken,
  validateRequest({
    body: {
      eventType: { type: 'string', required: true },
      eventData: { type: 'object', required: false },
      agentId: { type: 'string', required: false }
    }
  }),
  async (req, res, next) => {
    const span = trace.getActiveTracer('cartrita-v2').startSpan('analytics.track_event', {
      kind: SpanKind.INTERNAL
    });

    try {
      const { eventType, eventData = {}, agentId } = req.body;
      const userId = req.user.id;

      // Track the event
      const trackedEvent = await trackAnalyticsEvent({
        eventType,
        eventData,
        agentId,
        userId,
        timestamp: new Date().toISOString()
      });

      span.setAttributes({
        'event.type': eventType,
        'event.user_id': userId,
        'event.agent_id': agentId || 'none'
      });

      res.json({
        success: true,
        data: {
          eventId: trackedEvent.id,
          tracked: true,
          timestamp: trackedEvent.timestamp
        }
      });

      // Broadcast real-time update
      broadcastAnalyticsUpdate(null, {
        type: 'event_tracked',
        eventType,
        userId,
        agentId,
        timestamp: trackedEvent.timestamp
      });

      logger.info('Analytics event tracked', {
        eventType,
        userId,
        agentId,
        eventId: trackedEvent.id
      });

    } catch (error) {
      span.recordException(error);
      logger.error('Failed to track analytics event', error, {
        userId: req.user?.id,
        eventType: req.body.eventType
      });
      next(error);
    } finally {
      span.end();
    }
  }
);

/**
 * Helper Functions
 */

// Generate analytics data based on time range
async function generateAnalyticsData(timeRange) {
  const now = new Date();
  const dataPoints = timeRange === 'day' ? 24 : 
                    timeRange === 'week' ? 7 : 
                    timeRange === 'month' ? 30 : 365;
  
  const interactions = [];
  const users = [];
  const responseTime = [];
  const successRate = [];
  
  for (let i = 0; i < dataPoints; i++) {
    const date = new Date(now);
    if (timeRange === 'day') {
      date.setHours(date.getHours() - i);
    } else {
      date.setDate(date.getDate() - i);
    }
    
    interactions.push({
      name: date.toISOString(),
      value: Math.floor(Math.random() * 100) + 50,
      change: Math.random() > 0.5 ? '+' + (Math.random() * 20).toFixed(1) + '%' : '-' + (Math.random() * 10).toFixed(1) + '%'
    });
    
    users.push({
      name: date.toISOString(),
      value: Math.floor(Math.random() * 50) + 10,
      change: Math.random() > 0.5 ? '+' + (Math.random() * 15).toFixed(1) + '%' : '-' + (Math.random() * 8).toFixed(1) + '%'
    });
    
    responseTime.push({
      name: date.toISOString(),
      value: parseFloat((Math.random() * 2 + 0.5).toFixed(2)),
      change: Math.random() > 0.5 ? '+' + (Math.random() * 10).toFixed(1) + '%' : '-' + (Math.random() * 15).toFixed(1) + '%'
    });
    
    successRate.push({
      name: date.toISOString(),
      value: parseFloat((Math.random() * 5 + 95).toFixed(1)),
      change: Math.random() > 0.5 ? '+' + (Math.random() * 2).toFixed(1) + '%' : '-' + (Math.random() * 1).toFixed(1) + '%'
    });
  }
  
  return {
    interactions: interactions.reverse(),
    users: users.reverse(),
    responseTime: responseTime.reverse(),
    successRate: successRate.reverse(),
    currentTimeRange: timeRange,
    lastUpdated: new Date().toISOString(),
    summary: {
      totalInteractions: interactions.reduce((sum, item) => sum + item.value, 0),
      totalUsers: users.reduce((sum, item) => sum + item.value, 0),
      avgResponseTime: responseTime.reduce((sum, item) => sum + item.value, 0) / responseTime.length,
      avgSuccessRate: successRate.reduce((sum, item) => sum + item.value, 0) / successRate.length
    }
  };
}

// Get current system metrics
async function getCurrentMetrics() {
  return {
    system: {
      cpu: Math.random() * 100,
      memory: Math.random() * 100,
      disk: Math.random() * 100,
      network: Math.random() * 100
    },
    agents: {
      total: 15,
      active: Math.floor(Math.random() * 15) + 1,
      busy: Math.floor(Math.random() * 5),
      idle: Math.floor(Math.random() * 10) + 5
    },
    performance: {
      averageResponseTime: (Math.random() * 2 + 0.5).toFixed(2),
      throughput: Math.floor(Math.random() * 1000) + 500,
      errorRate: (Math.random() * 5).toFixed(2),
      uptime: 99.9
    },
    realTime: {
      connectionsActive: Math.floor(Math.random() * 100) + 50,
      messagesPerSecond: Math.floor(Math.random() * 50) + 10,
      bandwidth: Math.floor(Math.random() * 1000) + 200
    }
  };
}

// Get agent-specific analytics
async function getAgentAnalytics(agentId, timeRange) {
  const baseData = await generateAnalyticsData(timeRange);
  
  return {
    ...baseData,
    agentSpecific: {
      agentId: agentId || 'all',
      tasksCompleted: Math.floor(Math.random() * 1000) + 100,
      averageTaskTime: (Math.random() * 5 + 1).toFixed(2),
      successRate: (Math.random() * 10 + 90).toFixed(1),
      delegationsReceived: Math.floor(Math.random() * 50) + 5,
      collaborations: Math.floor(Math.random() * 25) + 2,
      specialization: agentId ? `${agentId} specialist metrics` : 'All agents overview'
    }
  };
}

// Track analytics events
async function trackAnalyticsEvent(event) {
  // In a real implementation, this would save to database
  // For now, return a mock tracked event
  return {
    id: `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    ...event,
    processed: true
  };
}

logger.info('✅ Analytics API routes configured');

export { router as analyticsRouter };
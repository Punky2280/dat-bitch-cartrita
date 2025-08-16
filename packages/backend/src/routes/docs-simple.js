/**
 * @fileoverview Simple API Documentation Route Test
 */

import express from 'express';

const router = express.Router();

router.get('/health', (req, res) => {
  res.json({
    success: true,
    service: 'API Documentation',
    status: 'healthy',
    timestamp: new Date().toISOString()
  });
});

router.get('/test', (req, res) => {
  res.json({
    success: true,
    message: 'API Documentation routes are working',
    endpoints: [
      'GET /api/docs/health',
      'GET /api/docs/test',
      'GET /api/docs/openapi.json'
    ]
  });
});

router.get('/openapi.json', (req, res) => {
  res.json({
    openapi: '3.0.0',
    info: {
      title: 'Cartrita AI OS API',
      version: '1.0.0',
      description: 'Test API documentation endpoint'
    },
    servers: [
      {
        url: 'http://localhost:8001',
        description: 'Development server'
      }
    ],
    paths: {
      '/api/docs/health': {
        get: {
          summary: 'API Documentation health check',
          responses: {
            '200': {
              description: 'Service is healthy',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean' },
                      status: { type: 'string' }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  });
});

export { router };
export default router;

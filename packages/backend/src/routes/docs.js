/**
 * @fileoverview API Documentation Routes (Task 20)
 * Serves OpenAPI specification and interactive documentation
 */

import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { getAPIDocumentationService } from '../services/APIDocumentationService.js';
import { traceOperation } from '../system/OpenTelemetryTracing.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

/**
 * @route GET /api/docs
 * @description Get interactive API documentation (Swagger UI)
 * @returns {text/html} Interactive documentation interface
 */
router.get('/', async (req, res) => {
  try {
    const swaggerUIHTML = await generateSwaggerUIHTML();
    res.setHeader('Content-Type', 'text/html');
    res.send(swaggerUIHTML);
  } catch (error) {
    console.error('[Documentation] Error serving Swagger UI:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to load API documentation'
    });
  }
});

/**
 * @route GET /api/docs/openapi.json
 * @description Get OpenAPI 3.0 specification
 * @returns {application/json} Complete OpenAPI specification
 */
router.get('/openapi.json', async (req, res) => {
  await traceOperation('api-docs.get-openapi-spec', async () => {
    try {
      const docService = getAPIDocumentationService();
      const openAPISpec = await docService.generateOpenAPISpec();
      
      res.setHeader('Content-Type', 'application/json');
      res.json(openAPISpec);
    } catch (error) {
      console.error('[Documentation] Error generating OpenAPI spec:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to generate OpenAPI specification'
      });
    }
  });
});

/**
 * @route GET /api/docs/routes
 * @description Get discovered routes information
 * @returns {application/json} List of all discovered API routes
 */
router.get('/routes', async (req, res) => {
  await traceOperation('api-docs.get-routes', async () => {
    try {
      const docService = getAPIDocumentationService();
      const routes = await docService.discoverRoutes();
      
      res.json({
        success: true,
        data: {
          routes,
          stats: docService.getDocumentationStats(),
          discoveredAt: new Date().toISOString()
        }
      });
    } catch (error) {
      console.error('[Documentation] Error discovering routes:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to discover API routes'
      });
    }
  });
});

/**
 * @route GET /api/docs/stats
 * @description Get documentation generation statistics
 * @returns {application/json} Documentation coverage and metrics
 */
router.get('/stats', async (req, res) => {
  try {
    const docService = getAPIDocumentationService();
    const stats = docService.getDocumentationStats();
    
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('[Documentation] Error getting stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get documentation statistics'
    });
  }
});

/**
 * @route POST /api/docs/refresh
 * @description Refresh API documentation by re-scanning routes
 * @returns {application/json} Updated documentation statistics
 */
router.post('/refresh', async (req, res) => {
  await traceOperation('api-docs.refresh', async () => {
    try {
      const docService = getAPIDocumentationService();
      
      // Re-discover routes and regenerate documentation
      const routes = await docService.discoverRoutes();
      await docService.generateOpenAPISpec();
      
      const stats = docService.getDocumentationStats();
      
      res.json({
        success: true,
        message: 'API documentation refreshed successfully',
        data: {
          routesDiscovered: routes.length,
          stats,
          refreshedAt: new Date().toISOString()
        }
      });
    } catch (error) {
      console.error('[Documentation] Error refreshing documentation:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to refresh API documentation'
      });
    }
  });
});

/**
 * @route GET /api/docs/export
 * @description Export OpenAPI specification to file
 * @returns {application/json} Export confirmation and file path
 */
router.get('/export', async (req, res) => {
  try {
    const docService = getAPIDocumentationService();
    const filePath = await docService.exportOpenAPISpec();
    
    res.json({
      success: true,
      message: 'OpenAPI specification exported successfully',
      data: {
        filePath,
        exportedAt: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('[Documentation] Error exporting OpenAPI spec:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to export OpenAPI specification'
    });
  }
});

/**
 * @route GET /api/docs/health
 * @description Health check for documentation service
 * @returns {application/json} Service health status
 */
router.get('/health', async (req, res) => {
  try {
    const docService = getAPIDocumentationService();
    const stats = docService.getDocumentationStats();
    
    const health = {
      status: stats.routesDiscovered > 0 ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      service: 'API Documentation Generator',
      metrics: {
        routesDiscovered: stats.routesDiscovered,
        endpointsDocumented: stats.endpointsDocumented,
        coverage: Math.round(stats.coverage * 100) / 100,
        lastScan: stats.lastScan,
        scanTime: stats.scanTime
      }
    };

    res.json({
      success: true,
      data: health
    });
  } catch (error) {
    console.error('[Documentation] Health check failed:', error);
    res.status(500).json({
      success: false,
      error: 'Documentation service health check failed'
    });
  }
});

/**
 * Generate Swagger UI HTML interface
 */
async function generateSwaggerUIHTML() {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Cartrita AI OS - API Documentation</title>
    <link rel="stylesheet" type="text/css" href="https://unpkg.com/swagger-ui-dist@5.9.0/swagger-ui.css" />
    <link rel="icon" type="image/png" href="/favicon.png" sizes="32x32" />
    <style>
      html {
        box-sizing: border-box;
        overflow: -moz-scrollbars-vertical;
        overflow-y: scroll;
      }
      *, *:before, *:after {
        box-sizing: inherit;
      }
      body {
        margin: 0;
        background: #fafafa;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Roboto", "Oxygen", "Ubuntu", "Cantarell", "Fira Sans", "Droid Sans", "Helvetica Neue", sans-serif;
      }
      
      .custom-header {
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        padding: 20px;
        text-align: center;
        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
      }
      
      .custom-header h1 {
        margin: 0 0 10px 0;
        font-size: 2.2em;
        font-weight: 300;
      }
      
      .custom-header p {
        margin: 0;
        opacity: 0.9;
        font-size: 1.1em;
      }
      
      .stats-bar {
        background: white;
        padding: 15px 20px;
        border-bottom: 1px solid #e0e0e0;
        display: flex;
        justify-content: center;
        flex-wrap: wrap;
        gap: 30px;
      }
      
      .stat-item {
        display: flex;
        align-items: center;
        gap: 8px;
        color: #666;
        font-size: 14px;
      }
      
      .stat-value {
        font-weight: 600;
        color: #333;
      }
      
      .refresh-button {
        position: fixed;
        bottom: 30px;
        right: 30px;
        background: #667eea;
        color: white;
        border: none;
        border-radius: 50px;
        padding: 12px 20px;
        cursor: pointer;
        box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
        font-size: 14px;
        z-index: 1000;
        transition: all 0.3s ease;
      }
      
      .refresh-button:hover {
        background: #5a67d8;
        transform: translateY(-2px);
        box-shadow: 0 6px 16px rgba(102, 126, 234, 0.4);
      }
      
      #swagger-ui {
        max-width: none;
      }
    </style>
</head>
<body>
    <div class="custom-header">
        <h1>🤖 Cartrita AI OS</h1>
        <p>Comprehensive API Documentation</p>
    </div>
    
    <div class="stats-bar">
        <div class="stat-item">
            📊 <span>Routes:</span> <span class="stat-value" id="routes-count">Loading...</span>
        </div>
        <div class="stat-item">
            📝 <span>Documented:</span> <span class="stat-value" id="docs-count">Loading...</span>
        </div>
        <div class="stat-item">
            📈 <span>Coverage:</span> <span class="stat-value" id="coverage">Loading...</span>
        </div>
        <div class="stat-item">
            🕐 <span>Last Updated:</span> <span class="stat-value" id="last-updated">Loading...</span>
        </div>
    </div>
    
    <div id="swagger-ui"></div>
    
    <button class="refresh-button" onclick="refreshDocs()">
        🔄 Refresh Documentation
    </button>

    <script src="https://unpkg.com/swagger-ui-dist@5.9.0/swagger-ui-bundle.js"></script>
    <script src="https://unpkg.com/swagger-ui-dist@5.9.0/swagger-ui-standalone-preset.js"></script>
    <script>
    window.onload = function() {
      const ui = SwaggerUIBundle({
        url: '/api/docs/openapi.json',
        dom_id: '#swagger-ui',
        deepLinking: true,
        presets: [
          SwaggerUIBundle.presets.apis,
          SwaggerUIStandalonePreset
        ],
        plugins: [
          SwaggerUIBundle.plugins.DownloadUrl
        ],
        layout: "StandaloneLayout",
        showExtensions: true,
        showCommonExtensions: true,
        tryItOutEnabled: true,
        requestInterceptor: (request) => {
          // Add default headers
          request.headers['Accept'] = 'application/json';
          return request;
        }
      });
      
      // Load documentation stats
      loadStats();
    }
    
    async function loadStats() {
      try {
        const response = await fetch('/api/docs/stats');
        const data = await response.json();
        
        if (data.success) {
          const stats = data.data;
          document.getElementById('routes-count').textContent = stats.totalRoutes || 0;
          document.getElementById('docs-count').textContent = stats.endpointsDocumented || 0;
          document.getElementById('coverage').textContent = (stats.coverage || 0).toFixed(1) + '%';
          document.getElementById('last-updated').textContent = stats.lastScan 
            ? new Date(stats.lastScan).toLocaleString() 
            : 'Never';
        }
      } catch (error) {
        console.error('Failed to load documentation stats:', error);
      }
    }
    
    async function refreshDocs() {
      const button = document.querySelector('.refresh-button');
      const originalText = button.innerHTML;
      
      button.innerHTML = '⏳ Refreshing...';
      button.disabled = true;
      
      try {
        const response = await fetch('/api/docs/refresh', { method: 'POST' });
        const data = await response.json();
        
        if (data.success) {
          // Reload the Swagger UI
          window.location.reload();
        } else {
          alert('Failed to refresh documentation: ' + (data.error || 'Unknown error'));
        }
      } catch (error) {
        console.error('Failed to refresh documentation:', error);
        alert('Failed to refresh documentation. Please try again.');
      } finally {
        button.innerHTML = originalText;
        button.disabled = false;
      }
    }
    </script>
</body>
</html>`;
}

export { router };
export default router;

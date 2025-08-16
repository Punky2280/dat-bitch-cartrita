/**
 * @fileoverview API Documentation Generator Service (Task 20)
 * Automatically generates comprehensive API documentation from route definitions
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import OpenTelemetryTracing from '../system/OpenTelemetryTracing.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * API Documentation Generator
 * 
 * Features:
 * - Auto-discovery of API routes from filesystem
 * - OpenAPI 3.0 specification generation
 * - JSDoc comment parsing for endpoint metadata
 * - Authentication requirement detection
 * - Request/response schema extraction
 * - Interactive documentation generation
 */
class APIDocumentationService {
  constructor() {
    this.openAPISpec = this.initializeOpenAPISpec();
    this.discoveredRoutes = new Map();
    this.routeMetadata = new Map();
    this.examples = new Map();
    this.lastScan = null;
    
    // Track metrics
    this.metrics = {
      routesDiscovered: 0,
      endpointsDocumented: 0,
      lastUpdated: null,
      scanTime: 0
    };

    // Initialize tracing
    this.tracer = OpenTelemetryTracing.getTracer('api-documentation-service');
  }

  /**
   * Initialize base OpenAPI specification
   */
  initializeOpenAPISpec() {
    return {
      openapi: '3.0.0',
      info: {
        title: 'Cartrita AI OS API',
        description: 'Comprehensive API documentation for the Cartrita AI Operating System',
        version: '2.1.0',
        contact: {
          name: 'Cartrita Development Team',
          url: 'https://github.com/Punky2280/dat-bitch-cartrita'
        },
        license: {
          name: 'MIT',
          url: 'https://opensource.org/licenses/MIT'
        }
      },
      servers: [
        {
          url: 'http://localhost:8001',
          description: 'Development server'
        },
        {
          url: 'https://api.cartrita.ai',
          description: 'Production server'
        }
      ],
      components: {
        securitySchemes: {
          BearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT'
          },
          ApiKeyAuth: {
            type: 'apiKey',
            in: 'header',
            name: 'X-API-Key'
          }
        },
        schemas: {},
        responses: {
          UnauthorizedError: {
            description: 'Authentication information is missing or invalid',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    error: { type: 'string', example: 'Unauthorized: No token provided.' }
                  }
                }
              }
            }
          },
          NotFoundError: {
            description: 'The specified resource was not found',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    error: { type: 'string', example: 'Endpoint not found' },
                    path: { type: 'string', example: '/api/nonexistent' }
                  }
                }
              }
            }
          },
          ValidationError: {
            description: 'Request validation failed',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    error: { type: 'string', example: 'Validation failed' },
                    details: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          field: { type: 'string' },
                          message: { type: 'string' }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      },
      paths: {},
      tags: [
        {
          name: 'Authentication',
          description: 'User authentication and authorization'
        },
        {
          name: 'Agents',
          description: 'AI agent management and interaction'
        },
        {
          name: 'Chat',
          description: 'Chat history and conversation management'
        },
        {
          name: 'Workflows',
          description: 'Workflow creation and execution'
        },
        {
          name: 'Knowledge',
          description: 'Knowledge hub and semantic search'
        },
        {
          name: 'Monitoring',
          description: 'System monitoring and health checks'
        },
        {
          name: 'Performance',
          description: 'Performance monitoring and optimization'
        }
      ]
    };
  }

  /**
   * Discover all API routes by scanning route files
   */
  async discoverRoutes() {
    const span = this.tracer.startSpan('api-documentation.discover-routes');
    const startTime = Date.now();

    try {
      const routesDir = path.join(__dirname, '../routes');
      const routeFiles = await this.scanDirectory(routesDir);

      this.discoveredRoutes.clear();
      this.metrics.routesDiscovered = 0;

      for (const filePath of routeFiles) {
        await this.analyzeRouteFile(filePath);
      }

      this.lastScan = new Date();
      this.metrics.scanTime = Date.now() - startTime;
      
      span.setAttributes({
        'api.routes.discovered': this.metrics.routesDiscovered,
        'api.scan.duration': this.metrics.scanTime
      });

      console.log(`[APIDocumentationService] Discovered ${this.metrics.routesDiscovered} routes in ${this.metrics.scanTime}ms`);
      
      return Array.from(this.discoveredRoutes.values());
    } catch (error) {
      span.recordException(error);
      console.error('[APIDocumentationService] Route discovery failed:', error);
      throw error;
    } finally {
      span.end();
    }
  }

  /**
   * Scan directory for route files
   */
  async scanDirectory(dir) {
    const files = [];
    
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        
        if (entry.isDirectory()) {
          const subFiles = await this.scanDirectory(fullPath);
          files.push(...subFiles);
        } else if (entry.isFile() && entry.name.endsWith('.js')) {
          files.push(fullPath);
        }
      }
    } catch (error) {
      console.warn(`[APIDocumentationService] Could not scan directory ${dir}:`, error.message);
    }
    
    return files;
  }

  /**
   * Analyze a route file to extract API endpoints
   */
  async analyzeRouteFile(filePath) {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const fileName = path.basename(filePath, '.js');
      
      // Extract route definitions using regex patterns
      const routePatterns = [
        /router\.(get|post|put|delete|patch)\s*\(\s*['"`]([^'"`]+)['"`]\s*,?\s*([^,\)]+)?\s*,?\s*(async\s*)?\([^)]*\)\s*=>\s*{/g,
        /app\.(get|post|put|delete|patch)\s*\(\s*['"`]([^'"`]+)['"`]\s*,?\s*([^,\)]+)?\s*,?\s*(async\s*)?\([^)]*\)\s*=>\s*{/g
      ];

      const routes = [];
      
      for (const pattern of routePatterns) {
        let match;
        while ((match = pattern.exec(content)) !== null) {
          const [fullMatch, method, path, middleware, isAsync] = match;
          
          // Extract JSDoc comments before the route definition
          const beforeMatch = content.substring(0, match.index);
          const jsDocMatch = beforeMatch.match(/\/\*\*[\s\S]*?\*\/\s*$/);
          const jsDoc = jsDocMatch ? jsDocMatch[0] : null;
          
          const routeInfo = {
            method: method.toUpperCase(),
            path: this.normalizePath(path),
            file: fileName,
            filePath,
            middleware: this.parseMiddleware(middleware),
            isAsync: !!isAsync,
            jsDoc: this.parseJSDoc(jsDoc),
            lineNumber: this.getLineNumber(content, match.index)
          };

          routes.push(routeInfo);
          this.metrics.routesDiscovered++;
        }
      }

      if (routes.length > 0) {
        this.discoveredRoutes.set(fileName, routes);
        console.log(`[APIDocumentationService] Found ${routes.length} routes in ${fileName}`);
      }

      return routes;
    } catch (error) {
      console.warn(`[APIDocumentationService] Could not analyze route file ${filePath}:`, error.message);
      return [];
    }
  }

  /**
   * Normalize API path for OpenAPI spec
   */
  normalizePath(path) {
    // Convert Express-style parameters to OpenAPI format
    return path
      .replace(/:([a-zA-Z_][a-zA-Z0-9_]*)/g, '{$1}')
      .replace(/\*/, '{proxy+}');
  }

  /**
   * Parse middleware from route definition
   */
  parseMiddleware(middleware) {
    if (!middleware) return [];
    
    const middlewares = [];
    
    // Common middleware patterns
    if (middleware.includes('authenticateToken')) {
      middlewares.push({
        name: 'authenticateToken',
        type: 'auth',
        description: 'Requires valid JWT token'
      });
    }
    
    if (middleware.includes('adminRequired')) {
      middlewares.push({
        name: 'adminRequired',
        type: 'auth',
        description: 'Requires admin privileges'
      });
    }
    
    return middlewares;
  }

  /**
   * Parse JSDoc comments to extract API documentation
   */
  parseJSDoc(jsDoc) {
    if (!jsDoc) return null;

    const parsed = {
      description: '',
      summary: '',
      parameters: [],
      responses: {},
      tags: [],
      examples: []
    };

    // Extract description
    const descMatch = jsDoc.match(/\/\*\*\s*\n?\s*\*\s*(.+?)(?:\n|\*\/)/);
    if (descMatch) {
      parsed.summary = descMatch[1].trim();
    }

    // Extract @param tags
    const paramMatches = jsDoc.matchAll(/@param\s+\{([^}]+)\}\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*-?\s*(.+)/g);
    for (const match of paramMatches) {
      const [, type, name, description] = match;
      parsed.parameters.push({
        name,
        type: this.normalizeType(type),
        description: description.trim(),
        required: !type.includes('?')
      });
    }

    // Extract @returns/@return tags
    const returnMatch = jsDoc.match(/@returns?\s+\{([^}]+)\}\s*(.+)/);
    if (returnMatch) {
      const [, type, description] = returnMatch;
      parsed.responses['200'] = {
        description: description.trim(),
        schema: { type: this.normalizeType(type) }
      };
    }

    // Extract @tags
    const tagMatches = jsDoc.matchAll(/@tag\s+([a-zA-Z0-9_-]+)/g);
    for (const match of tagMatches) {
      parsed.tags.push(match[1]);
    }

    return parsed;
  }

  /**
   * Normalize type from JSDoc to OpenAPI type
   */
  normalizeType(type) {
    const typeMap = {
      'string': 'string',
      'number': 'number',
      'boolean': 'boolean',
      'object': 'object',
      'array': 'array',
      'Object': 'object',
      'Array': 'array',
      'String': 'string',
      'Number': 'number',
      'Boolean': 'boolean'
    };

    return typeMap[type] || 'string';
  }

  /**
   * Get line number for a given position in content
   */
  getLineNumber(content, position) {
    return content.substring(0, position).split('\n').length;
  }

  /**
   * Generate complete OpenAPI specification
   */
  async generateOpenAPISpec() {
    const span = this.tracer.startSpan('api-documentation.generate-openapi');

    try {
      await this.discoverRoutes();
      
      // Reset paths
      this.openAPISpec.paths = {};

      // Process discovered routes
      for (const [fileName, routes] of this.discoveredRoutes) {
        for (const route of routes) {
          const pathKey = `/api${route.path}`;
          
          if (!this.openAPISpec.paths[pathKey]) {
            this.openAPISpec.paths[pathKey] = {};
          }

          this.openAPISpec.paths[pathKey][route.method.toLowerCase()] = this.generateEndpointSpec(route);
          this.metrics.endpointsDocumented++;
        }
      }

      this.metrics.lastUpdated = new Date();
      
      span.setAttributes({
        'api.endpoints.documented': this.metrics.endpointsDocumented,
        'api.paths.total': Object.keys(this.openAPISpec.paths).length
      });

      return this.openAPISpec;
    } catch (error) {
      span.recordException(error);
      throw error;
    } finally {
      span.end();
    }
  }

  /**
   * Generate OpenAPI specification for a single endpoint
   */
  generateEndpointSpec(route) {
    const spec = {
      summary: route.jsDoc?.summary || `${route.method} ${route.path}`,
      description: route.jsDoc?.description || `${route.method} endpoint for ${route.path}`,
      tags: route.jsDoc?.tags?.length > 0 ? route.jsDoc.tags : [this.inferTag(route.file)],
      parameters: [],
      responses: {
        '200': {
          description: 'Successful response',
          content: {
            'application/json': {
              schema: { type: 'object' }
            }
          }
        }
      }
    };

    // Add authentication if middleware requires it
    if (route.middleware.some(m => m.type === 'auth')) {
      spec.security = [{ BearerAuth: [] }];
      spec.responses['401'] = { $ref: '#/components/responses/UnauthorizedError' };
    }

    // Add path parameters
    const pathParams = route.path.match(/{([^}]+)}/g);
    if (pathParams) {
      for (const param of pathParams) {
        const paramName = param.slice(1, -1);
        spec.parameters.push({
          name: paramName,
          in: 'path',
          required: true,
          schema: { type: 'string' },
          description: `${paramName} parameter`
        });
      }
    }

    // Add JSDoc parameters
    if (route.jsDoc?.parameters) {
      for (const param of route.jsDoc.parameters) {
        spec.parameters.push({
          name: param.name,
          in: 'query',
          required: param.required,
          schema: { type: param.type },
          description: param.description
        });
      }
    }

    // Add request body for POST/PUT/PATCH methods
    if (['POST', 'PUT', 'PATCH'].includes(route.method)) {
      spec.requestBody = {
        description: 'Request payload',
        required: true,
        content: {
          'application/json': {
            schema: { type: 'object' }
          }
        }
      };
    }

    // Add JSDoc responses
    if (route.jsDoc?.responses) {
      Object.assign(spec.responses, route.jsDoc.responses);
    }

    // Add common error responses
    spec.responses['404'] = { $ref: '#/components/responses/NotFoundError' };
    spec.responses['400'] = { $ref: '#/components/responses/ValidationError' };

    return spec;
  }

  /**
   * Infer tag from filename
   */
  inferTag(fileName) {
    const tagMap = {
      'auth': 'Authentication',
      'agent': 'Agents',
      'agents': 'Agents', 
      'chat': 'Chat',
      'chatHistory': 'Chat',
      'workflows': 'Workflows',
      'knowledge': 'Knowledge',
      'monitoring': 'Monitoring',
      'performance': 'Performance',
      'user': 'Users',
      'vault': 'Vault',
      'health': 'Health'
    };

    return tagMap[fileName] || 'API';
  }

  /**
   * Get documentation statistics
   */
  getDocumentationStats() {
    return {
      ...this.metrics,
      totalRoutes: Array.from(this.discoveredRoutes.values()).reduce((sum, routes) => sum + routes.length, 0),
      routeFiles: this.discoveredRoutes.size,
      lastScan: this.lastScan,
      coverage: this.metrics.endpointsDocumented / Math.max(this.metrics.routesDiscovered, 1) * 100
    };
  }

  /**
   * Export OpenAPI spec to file
   */
  async exportOpenAPISpec(outputPath = null) {
    const spec = await this.generateOpenAPISpec();
    const defaultPath = path.join(__dirname, '../../docs/api/openapi.json');
    const filePath = outputPath || defaultPath;

    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, JSON.stringify(spec, null, 2));

    console.log(`[APIDocumentationService] OpenAPI spec exported to ${filePath}`);
    return filePath;
  }
}

// Singleton instance
let apiDocumentationService = null;

/**
 * Get singleton instance of API Documentation Service
 */
export function getAPIDocumentationService() {
  if (!apiDocumentationService) {
    apiDocumentationService = new APIDocumentationService();
  }
  return apiDocumentationService;
}

export default APIDocumentationService;

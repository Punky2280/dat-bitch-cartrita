/**
 * Cartrita V2 - Main API Router (Fastify)
 * Routes all API endpoints with versioning and documentation
 */

// Fastify API Router Plugin
export async function apiV2Router(fastify, options) {
  // Add API version header hook
  fastify.addHook('onSend', async (request, reply) => {
    reply.header('X-API-Version', '2.0.0');
  });

  // API Information
  fastify.get('/', async (request, reply) => {
    return {
      success: true,
      data: {
        name: 'Cartrita V2 Multi-Agent OS API',
        version: '2.0.0',
        description: 'Enhanced AI Multi-Agent Operating System API with Fastify',
        documentation: '/api/docs',
        endpoints: {
          auth: '/api/v2/auth',
          users: '/api/v2/users',
          agents: '/api/v2/agents',
          analytics: '/api/v2/analytics',
          realtime: '/api/v2/realtime',
          chat: '/api/v2/chat',
          workflows: '/api/v2/workflows',
          files: '/api/v2/files',
          rag: '/api/v2/rag',
          system: '/api/v2/system',
          gpt5: '/api/v2/gpt5',
          sourcery: '/api/v2/sourcery'
        },
        features: [
          'Multi-Agent AI System',
          'RAG Pipeline with Hybrid Retrieval',
          'Real-time WebSocket Communication',
          'Workflow Automation',
          'File Processing',
          'Vector Search',
          'Authentication & Authorization',
          'OpenTelemetry Observability',
          'High-Performance Fastify Server',
          'GPT-5 Advanced Features Integration',
          'Sourcery Code Quality Analysis',
          'Optimal Model Assignment for Agents'
        ]
      }
    };
  });

  // --- Compatibility Endpoints (non-versioned) ---
  // These endpoints satisfy existing frontend expectations while v2 routes evolve.
  // Keep responses matching the frontend services’ expected shapes.

  // Settings
  fastify.get('/settings', async (request, reply) => {
    return {
      theme: 'dark',
      language: 'en',
      notifications: true,
      soundEnabled: true,
      autoSave: true,
      apiKeys: {},
      displayName: '',
      email: '',
      timezone: 'UTC',
      enable2FA: false,
      sessionTimeout: '1h',
      dataEncryption: true,
      emailNotifications: true,
      pushNotifications: true,
      soundNotifications: true,
      agentUpdates: true,
      systemAlerts: true,
      accentColor: 'cyan',
      animations: true,
      autoSaveInterval: '5m',
      enableTelemetry: true,
      enableCaching: true,
      enableCompression: true,
      enableBackups: true
    };
  });

  fastify.put('/settings', async (request, reply) => {
    const body = request.body || {};
    // Echo back merged settings for now
    return {
      theme: body.theme ?? 'dark',
      language: body.language ?? 'en',
      notifications: body.notifications ?? true,
      soundEnabled: body.soundEnabled ?? true,
      autoSave: body.autoSave ?? true,
      apiKeys: body.apiKeys ?? {},
      displayName: body.displayName ?? '',
      email: body.email ?? '',
      timezone: body.timezone ?? 'UTC',
      enable2FA: body.enable2FA ?? false,
      sessionTimeout: body.sessionTimeout ?? '1h',
      dataEncryption: body.dataEncryption ?? true,
      emailNotifications: body.emailNotifications ?? true,
      pushNotifications: body.pushNotifications ?? true,
      soundNotifications: body.soundNotifications ?? true,
      agentUpdates: body.agentUpdates ?? true,
      systemAlerts: body.systemAlerts ?? true,
      accentColor: body.accentColor ?? 'cyan',
      animations: body.animations ?? true,
      autoSaveInterval: body.autoSaveInterval ?? '5m',
      enableTelemetry: body.enableTelemetry ?? true,
      enableCaching: body.enableCaching ?? true,
      enableCompression: body.enableCompression ?? true,
      enableBackups: body.enableBackups ?? true
    };
  });

  fastify.put('/settings/api-keys', async (request, reply) => {
    // Accept and acknowledge API key updates
    return { success: true };
  });

  // System health (two aliases to satisfy frontend calls)
  fastify.get('/health/system', async (request, reply) => {
    return { status: 'online', message: 'System operational' };
  });

  fastify.get('/system/health', async (request, reply) => {
    const os = await import('os');
    const cpuUsage = process.cpuUsage();
    const cpuPercent = Math.min((cpuUsage.user + cpuUsage.system) / 10000, 100);
    const memUsage = process.memoryUsage();
    // Basic shape used by frontend SystemService.getSystemMetrics
    return {
      cpu: Math.round(cpuPercent * 10) / 10,
      memory: memUsage.rss,
      disk: 50,
      uptime: process.uptime(),
      activeAgents: (global.socketIO?.engine?.clientsCount) || 0,
      connections: (global.socketIO?.engine?.clientsCount) || 0
    };
  });

  // Minimal chat message endpoint for smoke testing
  fastify.post('/chat/message', async (request, reply) => {
    const { content = '', sessionId } = request.body || {};
    const message = {
      id: `msg_${Date.now()}`,
      content: `Echo: ${String(content)}`,
      role: 'assistant',
      timestamp: new Date().toISOString(),
      metadata: { model: 'cartrita-v2-echo', tokens: content?.length || 0, processingTime: 1 }
    };
    return { message, sessionId: sessionId || `sess_${new Date().toISOString().slice(0,10)}` };
  });

  // V2 API routes
  await fastify.register(async function (fastify) {
    // Import and register specific route handlers
    const { agentsRouter } = await import('./agents.js');
    const { analyticsRouter } = await import('./analytics.js');
    const { realtimeRouter } = await import('./realtime.js');
    // Temporarily commented out - GPT5Service dependency issue
    // const { gpt5Router } = await import('./gpt5.js');
    // Temporarily commented out - SourceryService dependency issue
    // const { sourceryRouter } = await import('./sourcery.js');
    const { aiRouter } = await import('./ai.js');

    await fastify.register(agentsRouter, { prefix: '/agents' });
    await fastify.register(analyticsRouter, { prefix: '/analytics' });
    await fastify.register(realtimeRouter, { prefix: '/realtime' });
    // await fastify.register(gpt5Router, { prefix: '/gpt5' });
    // await fastify.register(sourceryRouter, { prefix: '/sourcery' });
    await fastify.register(aiRouter, { prefix: '/ai' });

    // TODO: Complete remaining route imports
    // await fastify.register(authRouter, { prefix: '/auth' });
    // await fastify.register(usersRouter, { prefix: '/users' });
    // await fastify.register(chatRouter, { prefix: '/chat' });
    // await fastify.register(workflowsRouter, { prefix: '/workflows' });
    // await fastify.register(filesRouter, { prefix: '/files' });
    // await fastify.register(ragRouter, { prefix: '/rag' });
    // await fastify.register(systemRouter, { prefix: '/system' });

    // Temporary placeholder routes for V2 API
    fastify.get('/status', async (request, reply) => {
      return {
        success: true,
        data: {
          status: 'operational',
          version: '2.0.0',
          server: 'Fastify',
          timestamp: new Date().toISOString(),
          uptime: process.uptime(),
          message: 'Cartrita V2 Backend is running with Fastify performance'
        }
      };
    });

  }, { prefix: '/v2' });

  // API Documentation
  fastify.get('/docs', async (request, reply) => {
    return {
      success: true,
      data: {
        title: 'Cartrita V2 API Documentation',
        version: '2.0.0',
        server: 'Fastify',
        description: 'High-performance API documentation for Cartrita Multi-Agent OS',
        baseUrl: `${request.protocol}://${request.hostname}/api`,
        endpoints: {
          '/': 'API Information',
          '/v2/status': 'API Status',
          '/v2/auth/login': 'User Authentication',
          '/v2/auth/register': 'User Registration',
          '/v2/agents': 'Agent Management',
          '/v2/agents/{id}/chat': 'Chat with Agent',
          '/v2/analytics': 'Real-time Analytics',
          '/v2/analytics/metrics': 'System Metrics',
          '/v2/realtime/system/stats': 'Real-time System Statistics',
          '/v2/realtime/agent/status': 'Real-time Agent Status',
          '/v2/realtime/activity/feed': 'Real-time Activity Feed',
          '/v2/realtime/analytics/metrics': 'Real-time Analytics Metrics',
          '/v2/chat/history': 'Chat History',
          '/v2/workflows': 'Workflow Management',
          '/v2/workflows/{id}/execute': 'Execute Workflow',
          '/v2/files/upload': 'File Upload',
          '/v2/rag/search': 'RAG Search',
          '/v2/system/health': 'System Health',
          '/v2/gpt5/generate': 'GPT-5 Text Generation',
          '/v2/gpt5/verbosity': 'GPT-5 Verbosity Control',
          '/v2/gpt5/freeform': 'GPT-5 Freeform Function Calling',
          '/v2/gpt5/cfg': 'GPT-5 Context-Free Grammar',
          '/v2/gpt5/minimal': 'GPT-5 Minimal Reasoning',
          '/v2/gpt5/models': 'Available GPT-5 Models',
          '/v2/gpt5/features': 'GPT-5 Feature Support',
          '/v2/gpt5/metrics': 'GPT-5 Usage Metrics',
          '/v2/sourcery/analyze': 'Code Quality Analysis',
          '/v2/sourcery/refactor': 'Automated Refactoring',
          '/v2/sourcery/report': 'Quality Report Generation',
          '/v2/sourcery/metrics': 'Sourcery Usage Metrics'
        },
        authentication: {
          type: 'JWT Bearer Token',
          header: 'Authorization: Bearer <token>',
          loginEndpoint: '/api/v2/auth/login'
        },
        websocket: {
          endpoint: '/ws',
          events: [
            'authenticate',
            'agent_message',
            'subscribe_agent_status',
            'subscribe_workflow',
            'subscribe_analytics'
          ]
        },
        performance: {
          server: 'Fastify v4',
          features: ['async/await', 'schema-validation', 'high-throughput'],
          bodyLimit: '10MB',
          compression: 'gzip, deflate'
        },
        advancedFeatures: {
          gpt5: {
            verbosityLevels: ['low', 'medium', 'high'],
            freeformFunctionCalling: true,
            contextFreeGrammar: true,
            minimalReasoning: true,
            supportedModels: ['gpt-5-preview', 'gpt-5-mini', 'gpt-5-pro', 'gpt-5-ultra']
          },
          sourcery: {
            supportedLanguages: ['javascript', 'typescript', 'python', 'java', 'go'],
            codeQualityAnalysis: true,
            automatedRefactoring: true,
            securityScanning: true,
            technicalDebtCalculation: true
          },
          agentOptimization: {
            dynamicModelAssignment: true,
            performanceTracking: true,
            complexityAnalysis: true,
            resourceOptimization: true
          }
        }
      }
    };
  });

  console.log('✅ Fastify API routes configured');
}
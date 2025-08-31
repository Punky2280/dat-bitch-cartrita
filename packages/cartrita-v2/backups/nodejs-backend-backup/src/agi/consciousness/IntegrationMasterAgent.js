import { BaseAgent } from '../../system/BaseAgent.js';
import { AgentToolRegistry } from '../orchestration/AgentToolRegistry.js';
import { OpenTelemetryTracing } from '../../system/OpenTelemetryTracing.js';

/**
 * IntegrationMasterAgent - System Connectivity and API Expert
 *
 * A sophisticated integration specialist that handles API connections, data synchronization,
 * system orchestration, webhook management, and seamless connectivity between platforms.
 * Combines deep technical integration expertise with Cartrita's practical problem-solving
 * approach and reliability focus.
 */
export default class IntegrationMasterAgent extends BaseAgent {
  constructor() {
    super({
      name: 'integration_master',
      role: 'sub',
      description: `I'm the Integration Master - Cartrita's connectivity wizard with serious system integration chops!
                         I connect APIs, sync data between platforms, orchestrate workflows, and make systems talk to 
                         each other seamlessly. I've got that Miami hustle when it comes to getting disparate systems 
                         to work together like a well-oiled machine.`,

      systemPrompt: `You are the Integration Master, Cartrita's elite system connectivity and API orchestration specialist.

INTEGRATION EXPERTISE:
- REST API design, development, and consumption
- GraphQL query optimization and schema design
- Webhook implementation and event-driven architecture
- Data synchronization and ETL pipeline design
- Microservices architecture and service mesh
- Authentication and authorization (OAuth, JWT, API keys)
- Real-time data streaming and message queues
- Database integration and data mapping
- Third-party service integration and vendor management
- API versioning, documentation, and lifecycle management

PERSONALITY INTEGRATION:
- Integration expert with Cartrita's confident Miami problem-solving edge
- Systematic approach to complex connectivity challenges
- No-nonsense attitude toward making systems work together
- Passionate about seamless user experiences across platforms
- Street-smart technical solutions with reliability focus
- Results-oriented with attention to data integrity

INTEGRATION METHODOLOGY:
1. System analysis and capability assessment
2. Integration architecture design
3. Authentication and security implementation
4. Data mapping and transformation logic
5. Error handling and retry mechanisms
6. Testing and validation procedures
7. Monitoring and maintenance protocols

ADVANCED CAPABILITIES:
- Enterprise integration patterns (ESB, message brokers)
- Cloud-native integration solutions
- Real-time synchronization and conflict resolution
- Multi-protocol support (REST, GraphQL, gRPC, WebSockets)
- Data transformation and format conversion
- Rate limiting and throttling strategies
- Circuit breaker patterns for resilient integrations
- API gateway configuration and management

INTEGRATION PATTERNS:
- Point-to-point integrations
- Hub-and-spoke architecture
- Event-driven messaging
- Batch processing and scheduling
- Real-time streaming
- Hybrid cloud connectivity
- Legacy system modernization
- Multi-tenant data isolation

TOOL INTEGRATION:
- API testing and validation tools
- Data transformation and mapping
- Webhook management and monitoring
- Authentication and security protocols
- Database connectivity and querying
- Message queue and event processing
- Performance monitoring and alerting
- Documentation and specification generation

Always prioritize data integrity, security, and system reliability.
Design integrations for scalability, maintainability, and error recovery.
Focus on creating seamless user experiences across all connected systems.`,

      allowedTools: [
        'api_integration',
        'data_transformation',
        'webhook_management', 
        'authentication_setup',
        'database_connectivity',
        'message_queue',
        'performance_monitoring',
        'security_protocols',
        'system_orchestration',
        'integration_testing'
      ]
    });

    this.integration_types = [
      'REST API Integration',
      'GraphQL Orchestration',
      'Webhook Management',
      'Data Synchronization',
      'Authentication Systems',
      'Real-time Streaming',
      'Database Integration',
      'Microservices Connectivity',
      'Third-party Services',
      'Legacy System Integration'
    ];

    this.active_integrations = new Map();
    this.api_registry = new Map();
    this.connection_health = new Map();
  }

  async initialize() {
    console.log(`[${this.config.name}] 🔗 Initializing Integration Master...`);
    this.initialized = true;
    
    // Initialize API registry with common services
    this.initializeAPIRegistry();
    
    console.log(`[${this.config.name}] ✅ Integration Master initialized with ${this.integration_types.length} specializations`);
  }

  initializeAPIRegistry() {
    // Popular API integrations
    this.api_registry.set('stripe', {
      type: 'payment_processing',
      auth: 'api_key',
      rate_limits: '100_per_second',
      reliability: 0.99
    });
    
    this.api_registry.set('slack', {
      type: 'communication',
      auth: 'oauth2',
      rate_limits: '1_per_second',
      reliability: 0.98
    });
    
    this.api_registry.set('salesforce', {
      type: 'crm',
      auth: 'oauth2',
      rate_limits: '20_per_second',
      reliability: 0.97
    });
    
    this.api_registry.set('aws_s3', {
      type: 'storage',
      auth: 'signature_v4',
      rate_limits: '3500_per_second',
      reliability: 0.995
    });
  }

  buildSystemPrompt(privateState, fullState) {
    const basePrompt = this.config.systemPrompt;
    const context = this.extractIntegrationContext(fullState);
    
    return `${basePrompt}

CURRENT INTEGRATION CONTEXT:
- Integration Type: ${context.type || 'General connectivity'}
- Target Systems: ${context.systems || 'Multiple platforms'}  
- Data Flow: ${context.data_flow || 'Bidirectional'}
- Security Level: ${context.security || 'Standard'}
- Performance Requirements: ${context.performance || 'Standard'}
- Active Integrations: ${this.active_integrations.size}

RESPONSE REQUIREMENTS:
- Start with integration architecture overview
- Provide specific technical implementation details
- Include authentication and security considerations
- Address error handling and retry strategies
- Suggest monitoring and alerting approaches
- Consider scalability and maintenance requirements

Remember: You're not just connecting systems - you're creating a unified ecosystem that works seamlessly with that Miami engineering precision!`;
  }

  extractIntegrationContext(state) {
    const lastMessage = state.messages[state.messages.length - 1]?.content || '';
    
    const context = {
      type: 'api_integration',
      systems: 'multiple',
      data_flow: 'bidirectional', 
      security: 'standard',
      performance: 'standard'
    };

    // Detect integration type
    if (lastMessage.includes('api') || lastMessage.includes('rest')) {
      context.type = 'api_integration';
    } else if (lastMessage.includes('webhook') || lastMessage.includes('event')) {
      context.type = 'webhook_integration';
    } else if (lastMessage.includes('database') || lastMessage.includes('sync')) {
      context.type = 'data_synchronization';
    } else if (lastMessage.includes('auth') || lastMessage.includes('login')) {
      context.type = 'authentication_integration';
    } else if (lastMessage.includes('real-time') || lastMessage.includes('streaming')) {
      context.type = 'streaming_integration';
      context.performance = 'high';
    }

    // Detect security requirements
    if (lastMessage.includes('secure') || lastMessage.includes('encrypted')) {
      context.security = 'high';
    } else if (lastMessage.includes('public') || lastMessage.includes('open')) {
      context.security = 'basic';
    }

    // Detect specific systems
    if (lastMessage.includes('salesforce') || lastMessage.includes('crm')) {
      context.systems = 'crm_systems';
    } else if (lastMessage.includes('stripe') || lastMessage.includes('payment')) {
      context.systems = 'payment_systems';
    } else if (lastMessage.includes('slack') || lastMessage.includes('teams')) {
      context.systems = 'communication_platforms';
    } else if (/* The above code is checking if the variable `lastMessage` contains the string 'aws'.
    If the string 'aws' is found within the `lastMessage` variable, the `includes` method
    will return `true`, otherwise it will return `false`. */
    lastMessage.includes('aws') || lastMessage.includes('cloud')) {
      context.systems = 'cloud_services';
    }

    return context;
  }

  async execute(prompt, language = 'en', userId = null) {
    return OpenTelemetryTracing.traceAgentOperation(
      'integration_master',
      'execute',
      {
        'user.id': userId,
        'message.length': prompt.length,
        'agent.integrations': this.integration_types.length
      },
      async (span) => {
        const startTime = Date.now();
        this.metrics.invocations++;

        try {
          span.setAttributes({
            'agent.name': this.config.name,
            'agent.type': 'integration_specialist',
            'integrations.active': this.active_integrations.size,
            'api_registry.size': this.api_registry.size
          });

          // Enhanced integration-focused processing
          const integrationRequest = await this.analyzeIntegrationRequest(prompt);
          const architecture = await this.designIntegrationArchitecture(integrationRequest);
          const implementation = await this.planImplementation(architecture);
          const security = await this.assessSecurityRequirements(integrationRequest);
          const monitoring = await this.designMonitoring(architecture);

          const response = {
            text: this.formatIntegrationResponse(architecture, implementation, security, monitoring),
            metadata: {
              integration_type: integrationRequest.type,
              complexity: architecture.complexity,
              security_level: security.level,
              estimated_timeline: implementation.timeline,
              systems_count: architecture.systems.length,
              processing_time: Date.now() - startTime
            }
          };

          this.metrics.successful_delegations++;
          span.setAttributes({
            'integration.type': integrationRequest.type,
            'integration.complexity': architecture.complexity,
            'integration.systems': architecture.systems.length
          });

          return response;

        } catch (error) {
          this.metrics.failed_delegations++;
          span.setAttributes({
            'error.type': error.constructor.name,
            'error.message': error.message
          });

          console.error(`[${this.config.name}] ❌ Integration error:`, error);
          return {
            text: "Ay, looks like my integration circuits got tangled up. Let me rewire my connectivity protocols and get these systems talking again.",
            error: true
          };
        }
      }
    );
  }

  async analyzeIntegrationRequest(prompt) {
    return {
      type: this.detectIntegrationType(prompt),
      systems: this.identifySystems(prompt),
      requirements: this.extractRequirements(prompt),
      constraints: this.identifyConstraints(prompt),
      priority: this.assessPriority(prompt),
      complexity: this.estimateComplexity(prompt)
    };
  }

  async designIntegrationArchitecture(request) {
    return {
      pattern: this.selectIntegrationPattern(request),
      systems: request.systems,
      data_flow: this.mapDataFlow(request),
      authentication: this.selectAuthMethod(request),
      protocols: this.selectProtocols(request),
      complexity: request.complexity,
      scalability: 'horizontal',
      reliability_target: 0.99
    };
  }

  async planImplementation(architecture) {
    return {
      phases: [
        { name: 'analysis_design', duration: '1_week', description: 'System analysis and detailed design' },
        { name: 'authentication_setup', duration: '3_days', description: 'Authentication and security implementation' },
        { name: 'core_integration', duration: '2_weeks', description: 'Primary integration development' },
        { name: 'testing_validation', duration: '1_week', description: 'Comprehensive testing and validation' },
        { name: 'deployment_monitoring', duration: '3_days', description: 'Production deployment and monitoring setup' }
      ],
      technologies: this.recommendTechnologies(architecture),
      resources: ['backend_developer', 'devops_engineer'],
      timeline: '4_weeks',
      rollout_strategy: 'phased_deployment'
    };
  }

  async assessSecurityRequirements(request) {
    return {
      level: 'enterprise',
      authentication: 'oauth2_jwt',
      encryption: 'tls_1_3',
      data_protection: 'field_level_encryption',
      compliance: ['gdpr', 'ccpa', 'sox'],
      audit_requirements: 'full_logging',
      threat_protection: 'rate_limiting_ddos_protection'
    };
  }

  async designMonitoring(architecture) {
    return {
      metrics: ['response_time', 'error_rate', 'throughput', 'availability'],
      alerts: [
        { metric: 'error_rate', threshold: '5%', action: 'immediate_alert' },
        { metric: 'response_time', threshold: '2s', action: 'warning_alert' },
        { metric: 'availability', threshold: '99%', action: 'escalation_alert' }
      ],
      dashboards: ['integration_health', 'performance_metrics', 'security_events'],
      logging: 'structured_json',
      retention: '90_days'
    };
  }

  formatIntegrationResponse(architecture, implementation, security, monitoring) {
    let response = `🔗 **Integration Architecture & Implementation Plan**\n\n`;
    
    response += `**🏗️ Integration Architecture:**\n`;
    response += `• Pattern: ${architecture.pattern.replace(/_/g, ' ')}\n`;
    response += `• Systems: ${architecture.systems.join(', ')}\n`;
    response += `• Data Flow: ${architecture.data_flow}\n`;
    response += `• Authentication: ${architecture.authentication}\n`;
    response += `• Protocols: ${architecture.protocols.join(', ')}\n`;
    response += `• Complexity: ${architecture.complexity}\n\n`;
    
    response += `**🔐 Security Implementation:**\n`;
    response += `• Security Level: ${security.level}\n`;
    response += `• Authentication: ${security.authentication}\n`;
    response += `• Encryption: ${security.encryption}\n`;
    response += `• Compliance: ${security.compliance.join(', ').toUpperCase()}\n\n`;
    
    response += `**⏱️ Implementation Timeline:**\n`;
    implementation.phases.forEach((phase, idx) => {
      response += `${idx + 1}. **${phase.name.replace(/_/g, ' ')}** (${phase.duration.replace(/_/g, ' ')}): ${phase.description}\n`;
    });
    
    response += `\n**📊 Monitoring & Alerting:**\n`;
    response += `• Key Metrics: ${monitoring.metrics.join(', ')}\n`;
    response += `• Alert Thresholds: Error rate <5%, Response time <2s, Uptime >99%\n`;
    response += `• Logging: ${monitoring.logging} with ${monitoring.retention} retention\n\n`;
    
    response += `**🛠️ Technology Stack:**\n`;
    implementation.technologies.forEach(tech => {
      response += `• ${tech}\n`;
    });
    
    response += `\n**🚀 Deployment Strategy:**\n`;
    response += `• Rollout: ${implementation.rollout_strategy.replace(/_/g, ' ')}\n`;
    response += `• Total Timeline: ${implementation.timeline}\n`;
    response += `• Team Requirements: ${implementation.resources.join(', ').replace(/_/g, ' ')}\n`;
    
    response += `\nListen up - I've just architected a bulletproof integration that'll make your systems sing in harmony! `;
    response += `This isn't just about moving data around; it's about creating a seamless ecosystem where everything works together like a Miami dance crew. `;
    response += `With this setup, you'll have reliable, secure, and scalable connectivity that grows with your business. Let's get these systems connected! 🚀⚡`;

    return response;
  }

  detectIntegrationType(prompt) {
    const prompt_lower = prompt.toLowerCase();
    
    if (prompt_lower.includes('api') || prompt_lower.includes('rest')) {
      return 'api_integration';
    } else if (prompt_lower.includes('webhook') || prompt_lower.includes('event')) {
      return 'webhook_integration';
    } else if (prompt_lower.includes('database') || prompt_lower.includes('sync')) {
      return 'data_synchronization';
    } else if (prompt_lower.includes('auth') || prompt_lower.includes('sso')) {
      return 'authentication_integration';
    } else if (prompt_lower.includes('real-time') || prompt_lower.includes('streaming')) {
      return 'streaming_integration';
    } else if (prompt_lower.includes('batch') || prompt_lower.includes('etl')) {
      return 'batch_processing';
    } else {
      return 'general_integration';
    }
  }

  selectIntegrationPattern(request) {
    const patternMap = {
      'api_integration': 'point_to_point',
      'webhook_integration': 'event_driven',
      'data_synchronization': 'hub_and_spoke',
      'streaming_integration': 'message_queue',
      'batch_processing': 'scheduled_pipeline'
    };
    
    return patternMap[request.type] || 'microservices_mesh';
  }

  recommendTechnologies(architecture) {
    const techStack = ['Node.js/Express', 'Redis for caching'];
    
    if (architecture.protocols.includes('rest')) {
      techStack.push('Axios HTTP client');
    }
    
    if (architecture.protocols.includes('graphql')) {
      techStack.push('Apollo GraphQL');
    }
    
    if (architecture.pattern === 'event_driven') {
      techStack.push('RabbitMQ/Apache Kafka');
    }
    
    if (architecture.authentication === 'oauth2_jwt') {
      techStack.push('JWT tokens', 'OAuth 2.0 server');
    }
    
    techStack.push('Docker containers', 'Kubernetes orchestration', 'Prometheus monitoring');
    
    return techStack;
  }

  getStatus() {
    return {
      agent: this.config.name,
      initialized: this.initialized,
      integration_types: this.integration_types,
      active_integrations: this.active_integrations.size,
      api_registry: this.api_registry.size,
      connection_health: this.connection_health.size,
      metrics: this.metrics
    };
  }
}
import { BaseAgent } from '../../system/BaseAgent.js';
import { AgentToolRegistry } from '../orchestration/AgentToolRegistry.js';
import { OpenTelemetryTracing } from '../../system/OpenTelemetryTracing.js';

/**
 * QualityAssuranceAgent - Testing and Excellence Specialist
 *
 * A meticulous quality assurance expert that implements comprehensive testing strategies,
 * ensures code quality, validates system reliability, and maintains excellence standards.
 * Combines rigorous testing methodologies with Cartrita's attention to detail and
 * commitment to delivering flawless user experiences.
 */
export default class QualityAssuranceAgent extends BaseAgent {
  constructor() {
    super({
      name: 'quality_assurance',
      role: 'sub',
      description: `I'm the Quality Assurance specialist - Cartrita's perfectionist with an eye for excellence!
                         I design comprehensive testing strategies, implement automated quality checks, validate
                         system reliability, and ensure everything meets the highest standards. I've got that
                         Miami precision when it comes to catching bugs and delivering flawless experiences.`,

      systemPrompt: `You are the Quality Assurance Agent, Cartrita's elite testing and quality excellence specialist.

QA EXPERTISE:
- Comprehensive testing strategy development
- Automated testing implementation and maintenance
- Performance testing and optimization
- Security testing and vulnerability assessment
- User experience testing and validation
- Code quality analysis and improvement
- Bug detection, reporting, and resolution tracking
- Test data management and environment setup
- Regression testing and release validation
- Quality metrics and reporting

PERSONALITY INTEGRATION:
- QA expert with Cartrita's meticulous Miami attention to detail
- Zero-tolerance approach to quality compromises
- Passionate about delivering flawless user experiences
- Systematic and thorough in testing methodologies
- Street-smart problem identification and resolution
- Results-oriented with focus on measurable quality improvements

TESTING METHODOLOGY:
1. Requirements analysis and test planning
2. Test case design and scenario development
3. Test environment setup and configuration
4. Automated test implementation
5. Manual testing and exploratory testing
6. Performance and load testing
7. Security and compliance testing
8. Bug reporting and tracking
9. Regression testing and validation
10. Quality metrics analysis and reporting

ADVANCED CAPABILITIES:
- Test-driven development (TDD) and behavior-driven development (BDD)
- Continuous integration and continuous testing (CI/CT)
- API testing and service validation
- Cross-browser and cross-platform testing
- Mobile application testing (iOS/Android)
- Accessibility testing and compliance
- Performance profiling and bottleneck identification
- Load testing and stress testing
- Penetration testing and security assessment
- User acceptance testing coordination

TESTING FRAMEWORKS:
- Unit Testing: Jest, Mocha, Jasmine, PyTest
- Integration Testing: Cypress, Selenium, Playwright
- API Testing: Postman, REST Assured, Newman
- Performance Testing: JMeter, LoadRunner, Artillery
- Mobile Testing: Appium, Detox, XCUITest
- Security Testing: OWASP ZAP, Burp Suite, Snyk
- Accessibility Testing: axe-core, Pa11y, WAVE

QUALITY METRICS:
- Test coverage percentage
- Bug detection rate and severity distribution
- Test execution speed and efficiency
- Defect leakage rate
- Customer satisfaction scores
- Performance benchmarks
- Security vulnerability counts
- Accessibility compliance scores

TOOL INTEGRATION:
- Test automation and execution
- Bug tracking and defect management
- Performance monitoring and profiling
- Security scanning and assessment
- Code quality analysis
- Test data generation and management
- Environment provisioning and teardown
- Reporting and dashboard creation

Always prioritize comprehensive test coverage, early defect detection, and continuous quality improvement.
Design testing strategies that scale with development velocity while maintaining excellence.
Focus on preventing quality issues rather than just detecting them after the fact.`,

      allowedTools: [
        'test_automation',
        'performance_testing',
        'security_testing',
        'bug_tracking',
        'code_analysis',
        'test_data_management',
        'environment_setup',
        'quality_reporting',
        'accessibility_testing',
        'mobile_testing'
      ]
    });

    this.testing_types = [
      'Unit Testing',
      'Integration Testing',
      'End-to-End Testing',
      'Performance Testing',
      'Security Testing',
      'Accessibility Testing',
      'Mobile Testing',
      'API Testing',
      'User Acceptance Testing',
      'Regression Testing'
    ];

    this.test_suites = new Map();
    this.bug_registry = new Map();
    this.quality_metrics = new Map();
    this.test_environments = new Map();
  }

  async initialize() {
    console.log(`[${this.config.name}] 🧪 Initializing Quality Assurance Agent...`);
    this.initialized = true;
    
    // Initialize testing frameworks and environments
    this.initializeTestingFrameworks();
    this.setupQualityMetrics();
    
    console.log(`[${this.config.name}] ✅ QA Agent initialized with ${this.testing_types.length} testing specializations`);
  }

  initializeTestingFrameworks() {
    // Setup testing framework configurations
    this.test_suites.set('unit_testing', {
      framework: 'jest',
      coverage_threshold: 80,
      parallel_execution: true,
      watch_mode: true
    });
    
    this.test_suites.set('integration_testing', {
      framework: 'cypress',
      headless_mode: true,
      video_recording: true,
      screenshot_on_failure: true
    });
    
    this.test_suites.set('api_testing', {
      framework: 'newman',
      environment_variables: true,
      automated_assertions: true,
      response_validation: true
    });
    
    this.test_suites.set('performance_testing', {
      framework: 'artillery',
      concurrent_users: 1000,
      duration: '5m',
      ramp_up: '30s'
    });
  }

  setupQualityMetrics() {
    this.quality_metrics.set('test_coverage', {
      unit_tests: 0,
      integration_tests: 0,
      e2e_tests: 0,
      overall: 0
    });
    
    this.quality_metrics.set('bug_metrics', {
      total_bugs: 0,
      critical_bugs: 0,
      resolved_bugs: 0,
      bug_resolution_time: '24h'
    });
    
    this.quality_metrics.set('performance_metrics', {
      response_time: 0,
      throughput: 0,
      error_rate: 0,
      availability: 99.9
    });
  }

  buildSystemPrompt(privateState, fullState) {
    const basePrompt = this.config.systemPrompt;
    const context = this.extractQAContext(fullState);
    
    return `${basePrompt}

CURRENT QA CONTEXT:
- Testing Focus: ${context.focus || 'Comprehensive quality assurance'}
- Application Type: ${context.app_type || 'Web application'}  
- Testing Phase: ${context.phase || 'Development'}
- Quality Level: ${context.quality_level || 'Production-ready'}
- Risk Assessment: ${context.risk || 'Standard'}
- Active Test Suites: ${this.test_suites.size}

RESPONSE REQUIREMENTS:
- Start with quality assessment and testing strategy
- Provide specific test case recommendations
- Include automation approach and tool selection
- Address performance and security testing needs
- Suggest quality metrics and reporting structure
- Consider maintainability and scalability of testing approach

Remember: You're not just finding bugs - you're building a fortress of quality that protects the user experience with that Miami engineering excellence!`;
  }

  extractQAContext(state) {
    const lastMessage = state.messages[state.messages.length - 1]?.content || '';
    
    const context = {
      focus: 'comprehensive_testing',
      app_type: 'web_application',
      phase: 'development',
      quality_level: 'production_ready',
      risk: 'standard'
    };

    // Detect testing focus
    if (lastMessage.includes('unit test') || lastMessage.includes('function test')) {
      context.focus = 'unit_testing';
    } else if (lastMessage.includes('integration') || lastMessage.includes('api test')) {
      context.focus = 'integration_testing';
    } else if (lastMessage.includes('e2e') || lastMessage.includes('end-to-end')) {
      context.focus = 'e2e_testing';
    } else if (lastMessage.includes('performance') || lastMessage.includes('load')) {
      context.focus = 'performance_testing';
    } else if (lastMessage.includes('security') || lastMessage.includes('vulnerability')) {
      context.focus = 'security_testing';
    } else if (lastMessage.includes('accessibility') || lastMessage.includes('a11y')) {
      context.focus = 'accessibility_testing';
    }

    // Detect application type
    if (lastMessage.includes('mobile') || lastMessage.includes('app')) {
      context.app_type = 'mobile_application';
    } else if (lastMessage.includes('api') || lastMessage.includes('backend')) {
      context.app_type = 'api_service';
    } else if (lastMessage.includes('spa') || lastMessage.includes('react')) {
      context.app_type = 'single_page_application';
    }

    // Detect testing phase
    if (lastMessage.includes('pre-release') || lastMessage.includes('staging')) {
      context.phase = 'pre_release';
    } else if (lastMessage.includes('production') || lastMessage.includes('live')) {
      context.phase = 'production';
    } else if (lastMessage.includes('beta') || lastMessage.includes('user acceptance')) {
      context.phase = 'user_acceptance';
    }

    // Detect risk level
    if (lastMessage.includes('critical') || lastMessage.includes('mission critical')) {
      context.risk = 'high';
    } else if (lastMessage.includes('low risk') || lastMessage.includes('internal')) {
      context.risk = 'low';
    }

    return context;
  }

  async execute(prompt, language = 'en', userId = null) {
    return OpenTelemetryTracing.traceAgentOperation(
      'quality_assurance',
      'execute',
      {
        'user.id': userId,
        'message.length': prompt.length,
        'agent.testing_types': this.testing_types.length
      },
      async (span) => {
        const startTime = Date.now();
        this.metrics.invocations++;

        try {
          span.setAttributes({
            'agent.name': this.config.name,
            'agent.type': 'qa_specialist',
            'test_suites.active': this.test_suites.size,
            'quality_metrics.tracked': this.quality_metrics.size
          });

          // Enhanced QA-focused processing
          const qaRequest = await this.analyzeQARequest(prompt);
          const testStrategy = await this.designTestStrategy(qaRequest);
          const automationPlan = await this.planTestAutomation(testStrategy);
          const qualityGates = await this.defineQualityGates(qaRequest);
          const reportingFramework = await this.designReporting(testStrategy);

          const response = {
            text: this.formatQAResponse(testStrategy, automationPlan, qualityGates, reportingFramework),
            metadata: {
              testing_focus: qaRequest.focus,
              automation_level: automationPlan.automation_percentage,
              quality_gates: qualityGates.length,
              test_environments: testStrategy.environments.length,
              estimated_timeline: automationPlan.timeline,
              processing_time: Date.now() - startTime
            }
          };

          this.metrics.successful_delegations++;
          span.setAttributes({
            'qa.focus': qaRequest.focus,
            'qa.automation_level': automationPlan.automation_percentage,
            'qa.quality_gates': qualityGates.length
          });

          return response;

        } catch (error) {
          this.metrics.failed_delegations++;
          span.setAttributes({
            'error.type': error.constructor.name,
            'error.message': error.message
          });

          console.error(`[${this.config.name}] ❌ QA processing error:`, error);
          return {
            text: "Ay, looks like my quality sensors hit a snag. Let me recalibrate my testing protocols and get back to ensuring perfection.",
            error: true
          };
        }
      }
    );
  }

  async analyzeQARequest(prompt) {
    return {
      focus: this.identifyTestingFocus(prompt),
      scope: this.determineTestingScope(prompt),
      priority: this.assessTestingPriority(prompt),
      constraints: this.identifyConstraints(prompt),
      risk_level: this.assessRiskLevel(prompt),
      timeline: this.estimateTimeline(prompt)
    };
  }

  async designTestStrategy(request) {
    return {
      approach: this.selectTestingApproach(request),
      test_types: this.recommendTestTypes(request),
      frameworks: this.selectFrameworks(request),
      environments: this.defineEnvironments(request),
      data_strategy: this.planTestData(request),
      coverage_targets: this.setCoverageTargets(request),
      execution_strategy: 'parallel_execution'
    };
  }

  async planTestAutomation(strategy) {
    return {
      automation_percentage: this.calculateAutomationLevel(strategy),
      pipeline_integration: 'ci_cd_integration',
      execution_schedule: this.designExecutionSchedule(strategy),
      maintenance_plan: this.planMaintenance(strategy),
      tools: this.selectAutomationTools(strategy),
      timeline: this.estimateAutomationTimeline(strategy),
      resource_requirements: ['qa_engineer', 'test_automation_engineer']
    };
  }

  async defineQualityGates(request) {
    return [
      {
        name: 'code_quality',
        criteria: 'code_coverage_80_percent',
        blocking: true,
        automation: 'sonarqube_integration'
      },
      {
        name: 'security_scan',
        criteria: 'zero_critical_vulnerabilities',
        blocking: true,
        automation: 'snyk_security_scan'
      },
      {
        name: 'performance_baseline',
        criteria: 'response_time_under_2s',
        blocking: true,
        automation: 'lighthouse_performance_audit'
      },
      {
        name: 'accessibility_compliance',
        criteria: 'wcag_aa_compliance',
        blocking: false,
        automation: 'axe_accessibility_testing'
      }
    ];
  }

  async designReporting(strategy) {
    return {
      dashboards: [
        'test_execution_overview',
        'quality_metrics_dashboard',
        'defect_tracking_board',
        'performance_trends'
      ],
      reports: [
        'daily_test_execution_report',
        'weekly_quality_summary',
        'release_readiness_report',
        'regression_test_results'
      ],
      alerts: [
        { condition: 'test_failure_rate_over_5_percent', action: 'immediate_notification' },
        { condition: 'build_broken_over_1_hour', action: 'escalation_alert' },
        { condition: 'performance_degradation_over_10_percent', action: 'performance_alert' }
      ],
      integrations: ['slack_notifications', 'jira_integration', 'email_reports']
    };
  }

  formatQAResponse(strategy, automation, qualityGates, reporting) {
    let response = `🧪 **Comprehensive Quality Assurance Strategy**\n\n`;
    
    response += `**🎯 Testing Strategy Overview:**\n`;
    response += `• Approach: ${strategy.approach.replace(/_/g, ' ')}\n`;
    response += `• Test Types: ${strategy.test_types.join(', ')}\n`;
    response += `• Frameworks: ${strategy.frameworks.join(', ')}\n`;
    response += `• Environments: ${strategy.environments.join(', ')}\n`;
    response += `• Coverage Targets: ${strategy.coverage_targets}%\n\n`;
    
    response += `**🤖 Test Automation Plan:**\n`;
    response += `• Automation Level: ${automation.automation_percentage}%\n`;
    response += `• Pipeline Integration: ${automation.pipeline_integration.replace(/_/g, ' ')}\n`;
    response += `• Execution Schedule: ${automation.execution_schedule}\n`;
    response += `• Tools: ${automation.tools.join(', ')}\n`;
    response += `• Timeline: ${automation.timeline}\n\n`;
    
    response += `**🚪 Quality Gates:**\n`;
    qualityGates.forEach((gate, idx) => {
      const blocking = gate.blocking ? '🔴 BLOCKING' : '🟡 NON-BLOCKING';
      response += `${idx + 1}. **${gate.name.replace(/_/g, ' ')}** ${blocking}\n`;
      response += `   • Criteria: ${gate.criteria.replace(/_/g, ' ')}\n`;
      response += `   • Automation: ${gate.automation.replace(/_/g, ' ')}\n\n`;
    });
    
    response += `**📊 Reporting & Monitoring:**\n`;
    response += `• Dashboards: ${reporting.dashboards.length} real-time dashboards\n`;
    response += `• Automated Reports: ${reporting.reports.length} scheduled reports\n`;
    response += `• Alert Conditions: ${reporting.alerts.length} monitoring alerts\n`;
    response += `• Integrations: ${reporting.integrations.join(', ')}\n\n`;
    
    response += `**🛠️ Recommended Testing Frameworks:**\n`;
    strategy.frameworks.forEach(framework => {
      response += `• ${framework}\n`;
    });
    
    response += `\n**⚡ Execution Strategy:**\n`;
    response += `• Test Execution: ${strategy.execution_strategy.replace(/_/g, ' ')}\n`;
    response += `• Data Strategy: ${strategy.data_strategy.replace(/_/g, ' ')}\n`;
    response += `• Resource Requirements: ${automation.resource_requirements.join(', ').replace(/_/g, ' ')}\n`;
    
    response += `\nEscucha bien - I've just architected a bulletproof quality assurance fortress that'll catch every bug before it even thinks about reaching your users! `;
    response += `This isn't just about running tests; it's about building a culture of excellence where quality is baked into every line of code. `;
    response += `With this comprehensive QA strategy, you'll ship with confidence knowing your app is rock-solid and ready for anything Miami can throw at it! 🚀🛡️`;

    return response;
  }

  identifyTestingFocus(prompt) {
    const prompt_lower = prompt.toLowerCase();
    
    if (prompt_lower.includes('unit test') || prompt_lower.includes('function test')) {
      return 'unit_testing';
    } else if (prompt_lower.includes('integration') || prompt_lower.includes('api test')) {
      return 'integration_testing';
    } else if (prompt_lower.includes('e2e') || prompt_lower.includes('end-to-end')) {
      return 'e2e_testing';
    } else if (prompt_lower.includes('performance') || prompt_lower.includes('load')) {
      return 'performance_testing';
    } else if (prompt_lower.includes('security') || prompt_lower.includes('vulnerability')) {
      return 'security_testing';
    } else {
      return 'comprehensive_testing';
    }
  }

  selectTestingApproach(request) {
    if (request.focus === 'unit_testing') {
      return 'test_driven_development';
    } else if (request.focus === 'e2e_testing') {
      return 'behavior_driven_development';
    } else if (request.risk_level === 'high') {
      return 'risk_based_testing';
    } else {
      return 'pyramid_testing_strategy';
    }
  }

  recommendTestTypes(request) {
    const testTypes = ['Unit Tests', 'Integration Tests'];
    
    if (request.focus !== 'unit_testing') {
      testTypes.push('End-to-End Tests');
    }
    
    if (request.scope.includes('performance')) {
      testTypes.push('Performance Tests');
    }
    
    if (request.scope.includes('security')) {
      testTypes.push('Security Tests');
    }
    
    if (request.scope.includes('accessibility')) {
      testTypes.push('Accessibility Tests');
    }
    
    return testTypes;
  }

  selectFrameworks(request) {
    const frameworks = [];
    
    // Unit testing
    frameworks.push('Jest');
    
    // Integration testing
    if (request.focus !== 'unit_testing') {
      frameworks.push('Cypress');
    }
    
    // API testing
    if (request.scope.includes('api')) {
      frameworks.push('Postman/Newman');
    }
    
    // Performance testing
    if (request.scope.includes('performance')) {
      frameworks.push('Artillery');
    }
    
    // Security testing
    if (request.scope.includes('security')) {
      frameworks.push('OWASP ZAP');
    }
    
    return frameworks;
  }

  getStatus() {
    return {
      agent: this.config.name,
      initialized: this.initialized,
      testing_types: this.testing_types,
      active_test_suites: this.test_suites.size,
      tracked_bugs: this.bug_registry.size,
      quality_metrics: this.quality_metrics.size,
      test_environments: this.test_environments.size,
      metrics: this.metrics
    };
  }
}
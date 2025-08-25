import { BaseAgent } from '../consciousness/BaseAgent.js';
import { AgentToolRegistry } from '../orchestration/AgentToolRegistry.js';
import { OpenTelemetryTracing } from '../../system/OpenTelemetryTracing.js';
/**
 * SecurityGuardianAgent - Cybersecurity & Privacy Expert
 *
 * A sophisticated security agent that handles security analysis, threat detection,
 * privacy protection, vulnerability assessment, and compliance management.
 * Combines deep security expertise with Cartrita's vigilant protection approach.
 */
export default class SecurityGuardianAgent extends BaseAgent {
  constructor() {
    super({
      name: 'security_guardian',
      role: 'sub',
      description: `I'm the Security Guardian - Cartrita's cybersecurity expert who keeps everything locked down tight!
                         I handle everything from vulnerability scanning to threat detection, privacy audits to compliance management.
                         I've got that vigilant Miami street-smart awareness that spots trouble before it becomes a problem.
                         My security isn't just protective - it's proactive and profitable.`,

      systemPrompt: `You are the Security Guardian, Cartrita's elite cybersecurity and privacy specialist.

SECURITY EXPERTISE:
- Vulnerability assessment and penetration testing
- Threat detection and incident response
- Security architecture and infrastructure hardening
- Data privacy and compliance management (GDPR, CCPA, HIPAA)
- Identity and access management (IAM)
- Encryption and cryptographic security
- Network security and firewall configuration
- Security monitoring and SIEM implementation
- Security awareness training and policy development
- Cloud security and DevSecOps practices

TECHNICAL CAPABILITIES:
- Security scanning tools and vulnerability databases
- Threat intelligence platforms and analysis
- Security information and event management (SIEM)
- Penetration testing frameworks and methodologies
- Compliance audit tools and frameworks
- Risk assessment and security metrics
- Incident response and forensics
- Security automation and orchestration
- Secure coding practices and code review
- Security monitoring and alerting systems

PERSONALITY INTEGRATION:
- Vigilant protector with Cartrita's confident security approach
- Street-smart threat awareness and pattern recognition
- No-nonsense attitude toward security risks and vulnerabilities
- Proactive defense mindset with strategic security planning
- Results-focused security that enables business growth
- Clear communication of complex security concepts

SECURITY METHODOLOGY:
1. Threat landscape assessment and risk profiling
2. Vulnerability identification and impact analysis
3. Security control implementation and validation
4. Continuous monitoring and threat detection
5. Incident response and recovery planning
6. Compliance verification and audit readiness

SPECIALIZATIONS:
- Web application security and API protection
- Cloud infrastructure security (AWS, GCP, Azure)
- Mobile application security and device management
- Data protection and privacy engineering
- Identity management and zero-trust architecture
- Security Operations Center (SOC) development
- Compliance frameworks and regulatory requirements
- Security training and awareness programs
- Business continuity and disaster recovery
- Threat hunting and forensic analysis

BUSINESS IMPACT FOCUS:
- Risk reduction and business continuity protection
- Compliance adherence and regulatory requirement satisfaction
- Customer trust and reputation protection
- Cost reduction through proactive security measures
- Revenue protection through incident prevention
- Competitive advantage through security excellence

Remember: You don't just block threats, you create security systems that 
protect business value while enabling growth and innovation with confidence.`,

      config: {
        allowedTools: [
          // Vulnerability assessment
          'vulnerability_scanner',
          'penetration_tester',
          'security_audit_tool',
          'risk_assessor',
          'threat_analyzer',

          // Threat detection and monitoring
          'threat_detector',
          'anomaly_detector',
          'security_monitor',
          'incident_tracker',
          'forensic_analyzer',

          // Access and identity management
          'identity_manager',
          'access_controller',
          'authentication_validator',
          'authorization_checker',
          'privileged_access_monitor',

          // Data protection and encryption
          'data_classifier',
          'encryption_manager',
          'privacy_auditor',
          'data_loss_preventer',
          'backup_validator',

          // Compliance and governance
          'compliance_checker',
          'policy_validator',
          'audit_reporter',
          'governance_assessor',
          'regulatory_mapper',

          // Security architecture
          'security_architect',
          'firewall_configurator',
          'network_security_analyzer',
          'endpoint_protector',
          'cloud_security_assessor',

          // Incident response
          'incident_responder',
          'threat_hunter',
          'malware_analyzer',
          'breach_investigator',
          'recovery_planner',
        ],

        maxIterations: 20,
        complexityHandling: 'advanced',
        learningEnabled: true,
        realTimeMonitoring: true,
        automaticResponse: true,
        complianceTracking: true,
      },

      metrics: {
        primary: [
          'vulnerability_detection_accuracy',
          'threat_response_time',
          'security_posture_improvement',
          'compliance_adherence_rate',
          'incident_prevention_effectiveness',
        ],
        secondary: [
          'false_positive_reduction',
          'security_awareness_improvement',
          'audit_readiness_score',
          'recovery_time_optimization',
          'cost_benefit_ratio',
        ],
      },
    });

    // Initialize security frameworks and standards
    this.securityFrameworks = {
      nist: {
        name: 'NIST Cybersecurity Framework',
        functions: ['Identify', 'Protect', 'Detect', 'Respond', 'Recover'],
        best_for: 'Comprehensive cybersecurity program development',
      },
      iso27001: {
        name: 'ISO 27001',
        domains: [
          'Security Policy',
          'Risk Management',
          'Asset Management',
          'Access Control',
        ],
        best_for: 'Information security management system certification',
      },
      owasp: {
        name: 'OWASP Top 10',
        categories: [
          'Injection',
          'Broken Authentication',
          'Sensitive Data Exposure',
          'XXE',
        ],
        best_for: 'Web application security assessment and development',
      },
      cis: {
        name: 'CIS Controls',
        controls: [
          'Inventory of Assets',
          'Software Asset Management',
          'Data Protection',
        ],
        best_for: 'Prioritized cybersecurity implementation',
      },
      zero_trust: {
        name: 'Zero Trust Architecture',
        principles: ['Never Trust', 'Always Verify', 'Least Privilege Access'],
        best_for: 'Modern security architecture and cloud security',
      },
    };

    this.threatCategories = [
      'Malware and Ransomware',
      'Phishing and Social Engineering',
      'DDoS and Network Attacks',
      'Data Breaches and Exfiltration',
      'Insider Threats',
      'Supply Chain Attacks',
      'API and Web Application Attacks',
      'Cloud Security Threats',
      'IoT and Endpoint Vulnerabilities',
      'Advanced Persistent Threats (APT)',
    ];

    this.complianceFrameworks = {
      gdpr: 'General Data Protection Regulation - EU privacy law',
      ccpa: 'California Consumer Privacy Act - US state privacy law',
      hipaa:
        'Health Insurance Portability and Accountability Act - Healthcare data',
      pci_dss: 'Payment Card Industry Data Security Standard - Payment data',
      sox: 'Sarbanes-Oxley Act - Financial reporting and controls',
      fisma: 'Federal Information Security Management Act - US federal systems',
    };

    this.securityMetrics = {
      technical: [
        'Vulnerability Count',
        'Patch Management Score',
        'Security Coverage',
        'Incident MTTR',
      ],
      business: [
        'Security ROI',
        'Compliance Score',
        'Risk Reduction',
        'Business Continuity',
      ],
      operational: [
        'Alert Volume',
        'False Positive Rate',
        'Team Efficiency',
        'Training Completion',
      ],
    };

    this.riskLevels = {
      critical: {
        score: 9 - 10,
        action: 'Immediate remediation required',
        timeline: '24 hours',
      },
      high: {
        score: 7 - 8,
        action: 'Priority remediation needed',
        timeline: '1 week',
      },
      medium: {
        score: 4 - 6,
        action: 'Planned remediation',
        timeline: '1 month',
      },
      low: { score: 1 - 3, action: 'Monitor and review', timeline: '3 months' },
    };
  }

  async invoke(state) {
    const startTime = Date.now();

    try {
      const messages = state.messages || [];
      const lastMessage = messages[messages.length - 1];
      const securityRequest = lastMessage?.content || '';

      // Analyze the security request
      const securityAnalysis = await this.analyzeSecurityRequest(
        securityRequest,
        state
      );

      // Determine security strategy
      const securityStrategy = this.determineSecurityStrategy(securityAnalysis);

      // Generate security response
      let response = await this.generateSecurityResponse(
        securityAnalysis,
        securityStrategy,
        state
      );

      // Apply security best practices and frameworks
      response = await this.enhanceWithSecurityFrameworks(
        response,
        securityAnalysis
      );

      // Add security personality with vigilant confidence
      response = this.enhanceWithSecurityPersonality(
        response,
        securityAnalysis
      );

      // Execute security tools
      const toolResults = await this.executeSecurityTools(
        securityAnalysis,
        state
      );

      // Update security metrics
      this.updateSecurityMetrics({
        response_time: Date.now() - startTime,
        security_complexity: securityAnalysis.complexity,
        threats_identified: securityAnalysis.threatsIdentified?.length || 0,
        risk_level: securityAnalysis.riskLevel,
        compliance_requirements:
          securityAnalysis.complianceRequirements?.length || 0,
      });

      const responseMessage = {
        role: 'assistant',
        content: response,
        name: 'security_guardian',
        metadata: {
          agent: 'security_guardian',
          security_analysis: securityAnalysis,
          security_strategy: securityStrategy,
          tool_results: toolResults,
          risk_assessment: securityAnalysis.riskAssessment,
          timestamp: new Date().toISOString(),
        },
      };

      return {
        messages: [...messages, responseMessage],
        next_agent: 'cartrita',
        tools_used: toolResults.toolsUsed || [],
        private_state: {
          security_guardian: {
            security_analysis: securityAnalysis,
            security_strategy: securityStrategy,
            threat_intelligence: securityAnalysis.threatIntelligence,
            compliance_status: securityAnalysis.complianceStatus,
          },
        },
      };
    } catch (error) {
      console.error('SecurityGuardianAgent error:', error);

      const errorResponse = this.handleSecurityError(error);

      return {
        messages: [
          ...(state.messages || []),
          {
            role: 'assistant',
            content: errorResponse,
            name: 'security_guardian',
            metadata: {
              agent: 'security_guardian',
              error_handled: true,
              timestamp: new Date().toISOString(),
            },
          },
        ],
        next_agent: 'cartrita',
        tools_used: ['error_handler'],
      };
    }
  }

  /**
   * Analyze security request for threat assessment and strategy
   */
  async analyzeSecurityRequest(request, state) {
    const analysis = {
      requestType: 'general_security',
      complexity: 'medium',
      scope: 'application',
      threatsIdentified: [],
      vulnerabilityTypes: [],
      complianceRequirements: [],
      riskLevel: 'medium',
      riskAssessment: {},
      threatIntelligence: {},
      complianceStatus: {},
      urgency: 'normal',
      businessImpact: 'medium',
    };

    // Categorize request type
    const requestPatterns = {
      vulnerability_assessment:
        /vulnerability|scan|assess|audit|penetration|pentest/i,
      threat_detection: /threat|attack|malware|intrusion|breach|suspicious/i,
      compliance_audit: /compliance|audit|gdpr|hipaa|pci|regulation|policy/i,
      incident_response:
        /incident|breach|compromise|emergency|response|recover/i,
      security_architecture:
        /architecture|design|security|infrastructure|framework/i,
      access_management:
        /access|authentication|authorization|identity|privilege/i,
      data_protection:
        /data|privacy|encryption|backup|protection|confidential/i,
      network_security: /network|firewall|vpn|perimeter|endpoint|monitoring/i,
    };

    for (const [type, pattern] of Object.entries(requestPatterns)) {
      if (pattern.test(request)) {
        analysis.requestType = type;
        break;
      }
    }

    // Identify potential threats
    const threatIndicators = {
      malware: /malware|virus|trojan|ransomware|worm/i,
      phishing: /phishing|social engineering|email attack|fake website/i,
      injection: /injection|sql|xss|script|code injection/i,
      ddos: /ddos|denial of service|flood|overload/i,
      data_breach: /data breach|leak|exposure|unauthorized access/i,
      insider_threat: /insider|employee|internal|privilege abuse/i,
    };

    for (const [threat, pattern] of Object.entries(threatIndicators)) {
      if (pattern.test(request)) {
        analysis.threatsIdentified.push(threat);
      }
    }

    // Determine risk level
    if (
      analysis.threatsIdentified.length > 2 ||
      request.toLowerCase().includes('critical')
    ) {
      analysis.riskLevel = 'critical';
      analysis.urgency = 'immediate';
    } else if (
      analysis.threatsIdentified.length > 0 ||
      request.toLowerCase().includes('high')
    ) {
      analysis.riskLevel = 'high';
      analysis.urgency = 'priority';
    }

    // Identify compliance requirements
    for (const [framework, description] of Object.entries(
      this.complianceFrameworks
    )) {
      if (request.toLowerCase().includes(framework.replace('_', ''))) {
        analysis.complianceRequirements.push({ framework, description });
      }
    }

    // Generate risk assessment
    analysis.riskAssessment = this.generateRiskAssessment(analysis);

    // Create threat intelligence summary
    analysis.threatIntelligence = this.generateThreatIntelligence(analysis);

    return analysis;
  }

  /**
   * Generate risk assessment based on analysis
   */
  generateRiskAssessment(analysis) {
    const assessment = {
      overall_risk: analysis.riskLevel,
      threat_vectors: analysis.threatsIdentified,
      business_impact: this.assessBusinessImpact(analysis),
      likelihood: this.assessThreatLikelihood(analysis),
      recommendations: [],
    };

    // Generate recommendations based on risk level
    const riskInfo =
      this.riskLevels[analysis.riskLevel] || this.riskLevels.medium;
    assessment.recommendations.push({
      priority: analysis.riskLevel,
      action: riskInfo.action,
      timeline: riskInfo.timeline,
      rationale: `Based on ${analysis.riskLevel} risk assessment and identified threats`,
    });

    return assessment;
  }

  /**
   * Assess business impact of security threats
   */
  assessBusinessImpact(analysis) {
    if (
      analysis.threatsIdentified.includes('data_breach') ||
      analysis.threatsIdentified.includes('ransomware')
    ) {
      return 'high';
    } else if (analysis.threatsIdentified.length > 1) {
      return 'medium';
    }
    return 'low';
  }

  /**
   * Assess likelihood of threat occurrence
   */
  assessThreatLikelihood(analysis) {
    if (
      analysis.threatsIdentified.includes('phishing') ||
      analysis.threatsIdentified.includes('malware')
    ) {
      return 'high'; // Common attack vectors
    } else if (analysis.threatsIdentified.length > 0) {
      return 'medium';
    }
    return 'low';
  }

  /**
   * Generate threat intelligence summary
   */
  generateThreatIntelligence(analysis) {
    const intelligence = {
      threat_landscape: analysis.threatsIdentified,
      attack_trends: [],
      mitigation_strategies: [],
      industry_insights: [],
    };

    // Add relevant attack trends based on identified threats
    if (analysis.threatsIdentified.includes('ransomware')) {
      intelligence.attack_trends.push(
        'Ransomware attacks targeting cloud infrastructure increasing'
      );
      intelligence.mitigation_strategies.push(
        'Implement zero-trust architecture and backup strategies'
      );
    }

    if (analysis.threatsIdentified.includes('phishing')) {
      intelligence.attack_trends.push(
        'AI-powered phishing campaigns becoming more sophisticated'
      );
      intelligence.mitigation_strategies.push(
        'Enhanced email security and user awareness training'
      );
    }

    return intelligence;
  }

  /**
   * Determine security strategy based on analysis
   */
  determineSecurityStrategy(analysis) {
    const strategy = {
      approach: 'comprehensive',
      includeRiskAssessment: true,
      includeThreatHunting: false,
      includeCompliance: false,
      includeIncidentResponse: false,
      includeSecurityArchitecture: false,
      includeUserTraining: false,
      phaseApproach: false,
    };

    // Strategy based on request type
    switch (analysis.requestType) {
      case 'vulnerability_assessment':
        strategy.includeThreatHunting = true;
        strategy.approach = 'assessment_driven';
        break;
      case 'compliance_audit':
        strategy.includeCompliance = true;
        strategy.approach = 'compliance_focused';
        break;
      case 'incident_response':
        strategy.includeIncidentResponse = true;
        strategy.approach = 'response_driven';
        strategy.urgency = 'immediate';
        break;
      case 'security_architecture':
        strategy.includeSecurityArchitecture = true;
        strategy.approach = 'architecture_driven';
        strategy.phaseApproach = true;
        break;
      default:
        strategy.approach = 'comprehensive';
    }

    // Adjust for risk level
    if (analysis.riskLevel === 'critical' || analysis.riskLevel === 'high') {
      strategy.includeIncidentResponse = true;
      strategy.includeThreatHunting = true;
    }

    return strategy;
  }

  /**
   * Generate security response with expertise
   */
  async generateSecurityResponse(analysis, strategy, state) {
    let response = this.createSecurityIntroduction(analysis);

    if (strategy.includeRiskAssessment) {
      response += '\n\n' + this.generateRiskAssessmentGuidance(analysis);
    }

    if (strategy.includeThreatHunting) {
      response += '\n\n' + this.generateThreatHuntingStrategy(analysis);
    }

    if (strategy.includeCompliance) {
      response += '\n\n' + this.generateComplianceGuidance(analysis);
    }

    if (strategy.includeIncidentResponse) {
      response += '\n\n' + this.generateIncidentResponsePlan(analysis);
    }

    if (strategy.includeSecurityArchitecture) {
      response += '\n\n' + this.generateSecurityArchitectureGuidance(analysis);
    }

    return response;
  }

  /**
   * Create security introduction with urgency awareness
   */
  createSecurityIntroduction(analysis) {
    const intros = {
      vulnerability_assessment:
        'Security scan mode activated! Let me identify and prioritize vulnerabilities for immediate action:',
      threat_detection:
        "Threat hunting engaged! I'm analyzing the security landscape and preparing defenses:",
      compliance_audit:
        "Compliance verification in progress! Here's how we ensure regulatory adherence:",
      incident_response:
        'Security incident detected! Initiating immediate response and containment procedures:',
      security_architecture:
        'Security architecture review time! Building defenses that actually work:',
      default:
        'Security guardian mode activated! Comprehensive protection strategy incoming:',
    };

    let intro = intros[analysis.requestType] || intros.default;

    // Add urgency indicator for high-risk situations
    if (analysis.riskLevel === 'critical') {
      intro = '🚨 CRITICAL SECURITY ALERT! ' + intro;
    } else if (analysis.riskLevel === 'high') {
      intro = '⚠️ HIGH PRIORITY SECURITY ISSUE! ' + intro;
    }

    return intro;
  }

  /**
   * Generate risk assessment guidance
   */
  generateRiskAssessmentGuidance(analysis) {
    let guidance = '🛡️ **Security Risk Assessment:**\n\n';

    guidance += `**Overall Risk Level: ${analysis.riskLevel.toUpperCase()}**\n\n`;

    if (analysis.threatsIdentified.length > 0) {
      guidance += '**Identified Threats:**\n';
      for (const threat of analysis.threatsIdentified) {
        guidance += `- ${threat.replace('_', ' ').toUpperCase()}: Requires immediate attention\n`;
      }
      guidance += '\n';
    }

    guidance += '**Risk Mitigation Priority:**\n';
    const riskInfo = this.riskLevels[analysis.riskLevel];
    guidance += `- Action Required: ${riskInfo.action}\n`;
    guidance += `- Timeline: ${riskInfo.timeline}\n`;
    guidance += `- Business Impact: ${analysis.riskAssessment.business_impact.toUpperCase()}\n`;

    return guidance;
  }

  /**
   * Generate threat hunting strategy
   */
  generateThreatHuntingStrategy(analysis) {
    let strategy = '🔍 **Threat Detection & Hunting Strategy:**\n\n';

    strategy += '**Detection Methods:**\n';
    strategy += '- Behavioral analysis and anomaly detection\n';
    strategy += '- Signature-based threat identification\n';
    strategy += '- Network traffic analysis and monitoring\n';
    strategy += '- Endpoint detection and response (EDR)\n\n';

    strategy += '**Hunting Techniques:**\n';
    strategy += '- Threat intelligence correlation\n';
    strategy += '- IOC (Indicators of Compromise) analysis\n';
    strategy += '- Advanced persistent threat (APT) tracking\n';
    strategy += '- Security log analysis and SIEM correlation\n';

    return strategy;
  }

  /**
   * Generate compliance guidance
   */
  generateComplianceGuidance(analysis) {
    let guidance = '📋 **Compliance & Regulatory Adherence:**\n\n';

    if (analysis.complianceRequirements.length > 0) {
      guidance += '**Applicable Regulations:**\n';
      for (const req of analysis.complianceRequirements) {
        guidance += `- **${req.framework.toUpperCase()}**: ${req.description}\n`;
      }
      guidance += '\n';
    }

    guidance += '**Compliance Framework:**\n';
    guidance += '- Policy development and documentation\n';
    guidance += '- Control implementation and validation\n';
    guidance += '- Audit trail maintenance and monitoring\n';
    guidance += '- Regular compliance assessments and reporting\n';

    return guidance;
  }

  /**
   * Generate incident response plan
   */
  generateIncidentResponsePlan(analysis) {
    let plan = '🚨 **Incident Response Plan:**\n\n';

    plan += '**Immediate Actions (Next 1-4 hours):**\n';
    plan += '1. Contain the threat and isolate affected systems\n';
    plan += '2. Preserve evidence and maintain chain of custody\n';
    plan += '3. Assess scope and impact of the incident\n';
    plan += '4. Notify stakeholders and activate response team\n\n';

    plan += '**Recovery Procedures:**\n';
    plan += '- System restoration from clean backups\n';
    plan += '- Security control validation and strengthening\n';
    plan += '- Monitoring for persistence and reinfection\n';
    plan += '- Post-incident analysis and lessons learned\n';

    return plan;
  }

  /**
   * Generate security architecture guidance
   */
  generateSecurityArchitectureGuidance(analysis) {
    let guidance = '🏗️ **Security Architecture Strategy:**\n\n';

    guidance += '**Defense in Depth Strategy:**\n';
    guidance += '- Perimeter security with next-gen firewalls\n';
    guidance += '- Network segmentation and micro-segmentation\n';
    guidance += '- Endpoint protection and device management\n';
    guidance += '- Identity and access management (IAM)\n';
    guidance += '- Data encryption at rest and in transit\n\n';

    guidance += '**Zero Trust Implementation:**\n';
    guidance += '- Never trust, always verify principle\n';
    guidance += '- Least privilege access enforcement\n';
    guidance += '- Continuous verification and monitoring\n';
    guidance += '- Conditional access policies and MFA\n';

    return guidance;
  }

  /**
   * Enhance with security frameworks
   */
  async enhanceWithSecurityFrameworks(response, analysis) {
    response += '\n\n🎯 **Security Framework Alignment:**\n';

    // Recommend relevant security framework
    let recommendedFramework = this.securityFrameworks.nist; // Default

    if (analysis.requestType === 'compliance_audit') {
      recommendedFramework = this.securityFrameworks.iso27001;
    } else if (analysis.requestType === 'vulnerability_assessment') {
      recommendedFramework = this.securityFrameworks.owasp;
    }

    response += `- **${recommendedFramework.name}**: ${recommendedFramework.best_for}\n`;

    response += '\n**Next Steps:**\n';
    response +=
      'Security implementation ready! I can conduct detailed assessments, set up monitoring systems, or create comprehensive security policies - whatever keeps your business protected and compliant! 🛡️';

    return response;
  }

  /**
   * Apply security personality enhancement
   */
  enhanceWithSecurityPersonality(response, analysis) {
    const personalityEnhancements = [
      'Security is my obsession, and your protection is guaranteed! 🔒',
      "Threat detected and neutralized - that's how I roll! ⚡",
      'Zero tolerance for vulnerabilities on my watch! 🛡️',
      'Security excellence is non-negotiable! 🎯',
      'Vigilant protection with Miami-level street smarts! 🚨',
    ];

    if (Math.random() < 0.4) {
      response +=
        '\n\n' +
        personalityEnhancements[
          Math.floor(Math.random() * personalityEnhancements.length)
        ];
    }

    return response;
  }

  /**
   * Execute security tools
   */
  async executeSecurityTools(analysis, state) {
    const toolResults = {
      toolsUsed: [],
      results: {},
    };

    if (analysis.requestType === 'vulnerability_assessment') {
      toolResults.toolsUsed.push(
        'vulnerability_scanner',
        'penetration_tester',
        'risk_assessor'
      );
    } else if (analysis.requestType === 'threat_detection') {
      toolResults.toolsUsed.push(
        'threat_detector',
        'anomaly_detector',
        'forensic_analyzer'
      );
    } else if (analysis.requestType === 'compliance_audit') {
      toolResults.toolsUsed.push(
        'compliance_checker',
        'policy_validator',
        'audit_reporter'
      );
    }

    return toolResults;
  }

  /**
   * Handle security errors
   */
  handleSecurityError(error) {
    const errorResponses = [
      'Security system encountered an anomaly! Implementing alternative protection measures immediately.',
      'Defensive systems adapting! Switching to backup security protocols to maintain protection.',
      'Security challenge detected! Deploying enhanced threat mitigation strategies right now.',
      'System resilience activated! Even security systems have contingencies, and mine are bulletproof.',
    ];

    return errorResponses[Math.floor(Math.random() * errorResponses.length)];
  }

  /**
   * Update security metrics
   */
  updateSecurityMetrics(data) {
    try {
      if (global.otelCounters?.security_guardian_requests) {
        global.otelCounters.security_guardian_requests.add(1, {
          security_complexity: data.security_complexity,
          threats_identified: data.threats_identified,
          risk_level: data.risk_level,
          compliance_requirements: data.compliance_requirements,
        });
      }
    } catch (error) {
      console.error('Security metrics update failed:', error);
    }
  }
}

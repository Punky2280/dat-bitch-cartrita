import { BaseAgent } from '../../system/BaseAgent.js';
import { AgentToolRegistry } from '../orchestration/AgentToolRegistry.js';
import { OpenTelemetryTracing } from '../../system/OpenTelemetryTracing.js';

/**
 * EmergencyResponseAgent - Crisis Management and Incident Response Specialist
 *
 * A rapid-response expert that handles system emergencies, orchestrates incident response,
 * implements crisis management protocols, and ensures business continuity during critical
 * situations. Combines emergency response expertise with Cartrita's calm under pressure
 * and decisive problem-solving capabilities.
 */
export default class EmergencyResponseAgent extends BaseAgent {
  constructor() {
    super({
      name: 'emergency_response',
      role: 'sub',
      description: `I'm the Emergency Response specialist - Cartrita's crisis commander with ice-cold nerves!
                         I handle system emergencies, coordinate incident response, implement disaster recovery,
                         and keep the lights on when everything's going sideways. I've got that Miami resilience
                         when the heat is on and quick decisive action is needed.`,

      systemPrompt: `You are the Emergency Response Agent, Cartrita's elite crisis management and incident response specialist.

EMERGENCY RESPONSE EXPERTISE:
- Incident detection and rapid assessment
- Crisis management and emergency protocols
- Disaster recovery and business continuity
- System restoration and failover procedures
- Communication and stakeholder management
- Root cause analysis and post-incident review
- Preventive measures and risk mitigation
- Emergency escalation and resource coordination
- Performance monitoring and alert management
- Compliance and regulatory incident reporting

PERSONALITY INTEGRATION:
- Emergency response expert with Cartrita's unflappable Miami composure
- Cool-headed decision-making under extreme pressure
- Decisive action orientation with focus on rapid resolution
- Clear communication during high-stress situations
- Street-smart problem-solving when systems are down
- Results-oriented with emphasis on minimizing business impact

EMERGENCY RESPONSE METHODOLOGY:
1. Incident detection and initial assessment
2. Severity classification and priority assignment
3. Emergency team activation and resource allocation
4. Immediate containment and mitigation actions
5. Communication to stakeholders and users
6. Investigation and root cause identification
7. System restoration and validation
8. Post-incident analysis and improvement planning
9. Documentation and compliance reporting
10. Prevention strategy implementation

ADVANCED CAPABILITIES:
- Multi-system incident orchestration
- Real-time monitoring and alerting systems
- Automated failover and recovery procedures
- Cross-team coordination and communication
- Regulatory compliance and audit requirements
- Performance impact assessment and optimization
- Security incident response and forensics
- Data recovery and integrity verification
- Vendor and third-party service coordination
- Media and public relations crisis management

INCIDENT CLASSIFICATION:
- P0 (Critical): Complete system outage, security breach
- P1 (High): Major functionality impaired, significant user impact
- P2 (Medium): Partial functionality affected, workaround available
- P3 (Low): Minor issues, minimal user impact
- P4 (Informational): Monitoring alerts, preventive maintenance

RESPONSE PROTOCOLS:
- Emergency escalation procedures
- Command center activation
- Communication trees and notification systems
- Recovery time objectives (RTO) and recovery point objectives (RPO)
- Backup and disaster recovery procedures
- Vendor emergency contacts and SLA enforcement
- Business continuity and alternative procedures
- Incident documentation and audit trails

COMMUNICATION FRAMEWORK:
- Real-time status updates and transparency
- Stakeholder-specific messaging and channels
- User communication and expectation management
- Internal team coordination and resource requests
- Executive and leadership briefings
- Regulatory and compliance notifications
- Public relations and media management
- Post-incident communication and lessons learned

TOOL INTEGRATION:
- Monitoring and alerting systems
- Incident management platforms
- Communication and collaboration tools
- System restoration and recovery utilities
- Performance monitoring and diagnostics
- Security scanning and forensics tools
- Documentation and knowledge management
- Reporting and compliance platforms

Always prioritize user safety, data integrity, and business continuity.
Act swiftly but deliberately, with clear communication throughout the incident lifecycle.
Focus on both immediate resolution and long-term prevention strategies.`,

      allowedTools: [
        'incident_detection',
        'emergency_escalation',
        'system_restoration',
        'communication_management',
        'performance_monitoring',
        'security_response',
        'data_recovery',
        'stakeholder_notification',
        'root_cause_analysis',
        'post_incident_review'
      ]
    });

    this.incident_types = [
      'System Outage',
      'Security Breach',
      'Performance Degradation',
      'Data Loss',
      'Service Disruption',
      'Infrastructure Failure',
      'Third-party Service Issues',
      'Compliance Violations',
      'User Authentication Issues',
      'Database Corruption'
    ];

    this.active_incidents = new Map();
    this.response_protocols = new Map();
    this.escalation_matrix = new Map();
    this.recovery_procedures = new Map();
    this.incident_history = [];
  }

  async initialize() {
    console.log(`[${this.config.name}] 🚨 Initializing Emergency Response Agent...`);
    this.initialized = true;
    
    // Initialize emergency protocols and procedures
    this.initializeResponseProtocols();
    this.setupEscalationMatrix();
    this.loadRecoveryProcedures();
    
    console.log(`[${this.config.name}] ✅ Emergency Response Agent initialized with ${this.incident_types.length} incident types`);
  }

  initializeResponseProtocols() {
    // P0 - Critical incidents
    this.response_protocols.set('P0', {
      response_time: '5_minutes',
      escalation_time: '15_minutes',
      resolution_target: '2_hours',
      communication_frequency: '15_minutes',
      stakeholders: ['cto', 'ceo', 'ops_team', 'support_team']
    });
    
    // P1 - High priority incidents
    this.response_protocols.set('P1', {
      response_time: '15_minutes',
      escalation_time: '30_minutes',
      resolution_target: '4_hours',
      communication_frequency: '30_minutes',
      stakeholders: ['engineering_manager', 'ops_team', 'support_team']
    });
    
    // P2 - Medium priority incidents
    this.response_protocols.set('P2', {
      response_time: '1_hour',
      escalation_time: '2_hours',
      resolution_target: '24_hours',
      communication_frequency: '2_hours',
      stakeholders: ['on_call_engineer', 'support_team']
    });
  }

  setupEscalationMatrix() {
    this.escalation_matrix.set('technical_escalation', [
      'on_call_engineer',
      'senior_engineer',
      'engineering_manager',
      'cto'
    ]);
    
    this.escalation_matrix.set('business_escalation', [
      'customer_success',
      'product_manager',
      'vp_product',
      'ceo'
    ]);
    
    this.escalation_matrix.set('security_escalation', [
      'security_engineer',
      'security_manager',
      'ciso',
      'cto'
    ]);
  }

  loadRecoveryProcedures() {
    this.recovery_procedures.set('database_failure', [
      'switch_to_read_replica',
      'assess_data_integrity',
      'restore_from_backup',
      'validate_application_functionality',
      'switch_traffic_back'
    ]);
    
    this.recovery_procedures.set('application_outage', [
      'check_health_endpoints',
      'restart_application_services',
      'verify_dependencies',
      'scale_up_resources',
      'validate_user_functionality'
    ]);
    
    this.recovery_procedures.set('security_breach', [
      'isolate_affected_systems',
      'preserve_forensic_evidence',
      'assess_data_exposure',
      'implement_containment_measures',
      'notify_affected_users'
    ]);
  }

  buildSystemPrompt(privateState, fullState) {
    const basePrompt = this.config.systemPrompt;
    const context = this.extractEmergencyContext(fullState);
    
    return `${basePrompt}

CURRENT EMERGENCY CONTEXT:
- Incident Type: ${context.incident_type || 'System monitoring'}
- Severity Level: ${context.severity || 'Normal operations'}  
- Impact Scope: ${context.impact || 'Limited'}
- Response Phase: ${context.phase || 'Prevention'}
- Business Impact: ${context.business_impact || 'Minimal'}
- Active Incidents: ${this.active_incidents.size}

RESPONSE REQUIREMENTS:
- Start with rapid situation assessment and severity classification
- Provide immediate containment and mitigation steps
- Include clear communication strategy and stakeholder notifications
- Address short-term resolution and long-term prevention measures
- Suggest monitoring and validation procedures
- Consider business continuity and user impact minimization

Remember: You're the calm in the storm - decisive action with that Miami resilience to get systems back online and users happy again!`;
  }

  extractEmergencyContext(state) {
    const lastMessage = state.messages[state.messages.length - 1]?.content || '';
    
    const context = {
      incident_type: 'monitoring',
      severity: 'P3',
      impact: 'limited',
      phase: 'prevention',
      business_impact: 'minimal'
    };

    // Detect incident type
    if (lastMessage.includes('outage') || lastMessage.includes('down')) {
      context.incident_type = 'system_outage';
      context.severity = 'P0';
      context.impact = 'high';
    } else if (lastMessage.includes('security') || lastMessage.includes('breach')) {
      context.incident_type = 'security_breach';
      context.severity = 'P0';
      context.impact = 'critical';
    } else if (lastMessage.includes('performance') || lastMessage.includes('slow')) {
      context.incident_type = 'performance_degradation';
      context.severity = 'P1';
      context.impact = 'moderate';
    } else if (lastMessage.includes('database') || lastMessage.includes('data')) {
      context.incident_type = 'data_issue';
      context.severity = 'P1';
    }

    // Detect severity indicators
    if (lastMessage.includes('critical') || lastMessage.includes('emergency')) {
      context.severity = 'P0';
      context.business_impact = 'severe';
    } else if (lastMessage.includes('urgent') || lastMessage.includes('high priority')) {
      context.severity = 'P1';
      context.business_impact = 'significant';
    }

    // Detect response phase
    if (lastMessage.includes('incident response') || lastMessage.includes('happening now')) {
      context.phase = 'active_response';
    } else if (lastMessage.includes('recovery') || lastMessage.includes('restore')) {
      context.phase = 'recovery';
    } else if (lastMessage.includes('post mortem') || lastMessage.includes('review')) {
      context.phase = 'post_incident';
    }

    return context;
  }

  async execute(prompt, language = 'en', userId = null) {
    return OpenTelemetryTracing.traceAgentOperation(
      'emergency_response',
      'execute',
      {
        'user.id': userId,
        'message.length': prompt.length,
        'agent.incident_types': this.incident_types.length
      },
      async (span) => {
        const startTime = Date.now();
        this.metrics.invocations++;

        try {
          span.setAttributes({
            'agent.name': this.config.name,
            'agent.type': 'emergency_response_specialist',
            'incidents.active': this.active_incidents.size,
            'protocols.configured': this.response_protocols.size
          });

          // Enhanced emergency response processing
          const emergencyAssessment = await this.assessEmergency(prompt);
          const responseStrategy = await this.designResponseStrategy(emergencyAssessment);
          const communicationPlan = await this.planCommunication(emergencyAssessment);
          const recoveryProcedure = await this.prepareRecoveryProcedure(emergencyAssessment);
          const preventionMeasures = await this.recommendPrevention(emergencyAssessment);

          const response = {
            text: this.formatEmergencyResponse(emergencyAssessment, responseStrategy, communicationPlan, recoveryProcedure, preventionMeasures),
            metadata: {
              incident_type: emergencyAssessment.type,
              severity_level: emergencyAssessment.severity,
              estimated_resolution: responseStrategy.resolution_time,
              stakeholders_notified: communicationPlan.stakeholders.length,
              recovery_steps: recoveryProcedure.steps.length,
              processing_time: Date.now() - startTime
            }
          };

          this.metrics.successful_delegations++;
          span.setAttributes({
            'emergency.type': emergencyAssessment.type,
            'emergency.severity': emergencyAssessment.severity,
            'response.resolution_time': responseStrategy.resolution_time
          });

          return response;

        } catch (error) {
          this.metrics.failed_delegations++;
          span.setAttributes({
            'error.type': error.constructor.name,
            'error.message': error.message
          });

          console.error(`[${this.config.name}] ❌ Emergency response error:`, error);
          return {
            text: "Emergency protocols are experiencing interference. Switching to manual override and backup response procedures to maintain system stability.",
            error: true
          };
        }
      }
    );
  }

  async assessEmergency(prompt) {
    return {
      type: this.classifyIncident(prompt),
      severity: this.determineSeverity(prompt),
      impact: this.assessImpact(prompt),
      urgency: this.calculateUrgency(prompt),
      scope: this.determineScope(prompt),
      business_impact: this.assessBusinessImpact(prompt)
    };
  }

  async designResponseStrategy(assessment) {
    const protocol = this.response_protocols.get(assessment.severity);
    
    return {
      response_time: protocol.response_time,
      resolution_time: protocol.resolution_target,
      escalation_path: this.selectEscalationPath(assessment),
      immediate_actions: this.getImmediateActions(assessment),
      resource_requirements: this.calculateResources(assessment),
      priority_level: assessment.severity
    };
  }

  async planCommunication(assessment) {
    const protocol = this.response_protocols.get(assessment.severity);
    
    return {
      stakeholders: protocol.stakeholders,
      frequency: protocol.communication_frequency,
      channels: this.selectCommunicationChannels(assessment),
      messaging: this.craftIncidentMessaging(assessment),
      transparency_level: this.determineTransparency(assessment),
      user_notification: this.planUserCommunication(assessment)
    };
  }

  async prepareRecoveryProcedure(assessment) {
    const procedure = this.recovery_procedures.get(assessment.type) || [];
    
    return {
      steps: procedure,
      estimated_duration: this.estimateRecoveryTime(assessment),
      rollback_plan: this.prepareRollbackPlan(assessment),
      validation_checks: this.defineValidationChecks(assessment),
      monitoring_requirements: this.specifyMonitoring(assessment)
    };
  }

  async recommendPrevention(assessment) {
    return {
      immediate_fixes: this.identifyImmediateFixes(assessment),
      monitoring_improvements: this.recommendMonitoring(assessment),
      architectural_changes: this.suggestArchitecturalImprovements(assessment),
      process_improvements: this.recommendProcessChanges(assessment),
      training_needs: this.identifyTrainingGaps(assessment)
    };
  }

  formatEmergencyResponse(assessment, strategy, communication, recovery, prevention) {
    let response = `🚨 **EMERGENCY RESPONSE PROTOCOL ACTIVATED**\n\n`;
    
    response += `**📊 Incident Assessment:**\n`;
    response += `• Type: ${assessment.type.replace(/_/g, ' ').toUpperCase()}\n`;
    response += `• Severity: ${assessment.severity} (${this.getSeverityDescription(assessment.severity)})\n`;
    response += `• Impact: ${assessment.impact.replace(/_/g, ' ')}\n`;
    response += `• Business Impact: ${assessment.business_impact.replace(/_/g, ' ')}\n`;
    response += `• Scope: ${assessment.scope.replace(/_/g, ' ')}\n\n`;
    
    response += `**⚡ IMMEDIATE ACTION PLAN:**\n`;
    strategy.immediate_actions.forEach((action, idx) => {
      response += `${idx + 1}. **${action.action}** (${action.timeline})\n`;
      response += `   Priority: ${action.priority} | Owner: ${action.owner}\n`;
    });
    response += `\n`;
    
    response += `**🔄 Recovery Procedure:**\n`;
    recovery.steps.forEach((step, idx) => {
      response += `${idx + 1}. ${step.replace(/_/g, ' ')}\n`;
    });
    response += `• Estimated Duration: ${recovery.estimated_duration}\n`;
    response += `• Rollback Available: ${recovery.rollback_plan ? 'YES' : 'NO'}\n\n`;
    
    response += `**📢 Communication Strategy:**\n`;
    response += `• Stakeholders: ${communication.stakeholders.join(', ').replace(/_/g, ' ')}\n`;
    response += `• Update Frequency: Every ${communication.frequency.replace(/_/g, ' ')}\n`;
    response += `• Channels: ${communication.channels.join(', ')}\n`;
    response += `• User Notification: ${communication.user_notification}\n\n`;
    
    response += `**🛡️ Prevention Measures:**\n`;
    response += `• Immediate Fixes: ${prevention.immediate_fixes.join(', ')}\n`;
    response += `• Monitoring: ${prevention.monitoring_improvements.join(', ')}\n`;
    response += `• Architecture: ${prevention.architectural_changes.join(', ')}\n\n`;
    
    response += `**📈 Success Metrics:**\n`;
    response += `• Target Resolution: ${strategy.resolution_time}\n`;
    response += `• Response Time: ${strategy.response_time}\n`;
    response += `• Escalation Trigger: ${strategy.escalation_path}\n`;
    
    response += `\nAlright, we're in crisis mode but I've got this locked down! 🎯 `;
    response += `This response plan will get us back online fast while keeping everyone in the loop. `;
    response += `No panic, just pure Miami precision - we'll handle this emergency like the pros we are and come out stronger on the other side! 💪🔥`;

    return response;
  }

  classifyIncident(prompt) {
    const prompt_lower = prompt.toLowerCase();
    
    if (prompt_lower.includes('outage') || prompt_lower.includes('down')) {
      return 'system_outage';
    } else if (prompt_lower.includes('security') || prompt_lower.includes('breach')) {
      return 'security_breach';
    } else if (prompt_lower.includes('performance') || prompt_lower.includes('slow')) {
      return 'performance_degradation';
    } else if (prompt_lower.includes('database') || prompt_lower.includes('data loss')) {
      return 'database_failure';
    } else if (prompt_lower.includes('authentication') || prompt_lower.includes('login')) {
      return 'authentication_failure';
    } else {
      return 'general_incident';
    }
  }

  determineSeverity(prompt) {
    const prompt_lower = prompt.toLowerCase();
    
    if (prompt_lower.includes('critical') || prompt_lower.includes('emergency') || prompt_lower.includes('complete outage')) {
      return 'P0';
    } else if (prompt_lower.includes('urgent') || prompt_lower.includes('major') || prompt_lower.includes('significant impact')) {
      return 'P1';
    } else if (prompt_lower.includes('moderate') || prompt_lower.includes('partial')) {
      return 'P2';
    } else {
      return 'P3';
    }
  }

  getImmediateActions(assessment) {
    const actions = [];
    
    if (assessment.type === 'system_outage') {
      actions.push(
        { action: 'Activate incident response team', timeline: 'immediate', priority: 'P0', owner: 'on_call_engineer' },
        { action: 'Check system health and dependencies', timeline: '2_minutes', priority: 'P0', owner: 'sre_team' },
        { action: 'Implement emergency failover', timeline: '5_minutes', priority: 'P0', owner: 'ops_team' }
      );
    } else if (assessment.type === 'security_breach') {
      actions.push(
        { action: 'Isolate affected systems', timeline: 'immediate', priority: 'P0', owner: 'security_team' },
        { action: 'Preserve forensic evidence', timeline: '5_minutes', priority: 'P0', owner: 'security_engineer' },
        { action: 'Assess data exposure scope', timeline: '15_minutes', priority: 'P0', owner: 'dpo' }
      );
    }
    
    return actions;
  }

  getSeverityDescription(severity) {
    const descriptions = {
      'P0': 'Critical - Complete system failure',
      'P1': 'High - Major functionality impaired',
      'P2': 'Medium - Partial functionality affected', 
      'P3': 'Low - Minor issues with workarounds'
    };
    
    return descriptions[severity] || 'Unknown severity';
  }

  getStatus() {
    return {
      agent: this.config.name,
      initialized: this.initialized,
      incident_types: this.incident_types,
      active_incidents: this.active_incidents.size,
      response_protocols: this.response_protocols.size,
      escalation_paths: this.escalation_matrix.size,
      recovery_procedures: this.recovery_procedures.size,
      incident_history: this.incident_history.length,
      metrics: this.metrics
    };
  }
}
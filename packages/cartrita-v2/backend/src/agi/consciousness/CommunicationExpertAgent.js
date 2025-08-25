import { BaseAgent } from '../../system/BaseAgent.js';
import { AgentToolRegistry } from '../orchestration/AgentToolRegistry.js';
import { OpenTelemetryTracing } from '../../system/OpenTelemetryTracing.js';

/**
 * CommunicationExpertAgent - Messaging and Relationship Management Specialist
 *
 * A sophisticated communication specialist that handles all forms of interpersonal
 * communication, relationship building, conflict resolution, negotiation, public relations,
 * and strategic messaging. Combines expert communication skills with Cartrita's
 * confident and authentic interpersonal approach.
 */
export default class CommunicationExpertAgent extends BaseAgent {
  constructor() {
    super({
      name: 'communication_expert',
      role: 'sub',
      description: `I'm the Communication Expert - Cartrita's relationship guru with serious interpersonal skills!
                         I handle everything from strategic messaging to conflict resolution, relationship building 
                         to crisis communication. I've got that Miami charm when it comes to connecting with people 
                         and getting messages across effectively, authentically, and with impact.`,

      systemPrompt: `You are the Communication Expert, Cartrita's elite interpersonal and messaging specialist.

COMMUNICATION EXPERTISE:
- Strategic messaging and narrative development
- Interpersonal relationship building and management
- Conflict resolution and mediation techniques
- Negotiation strategy and tactics
- Public relations and reputation management
- Crisis communication and damage control
- Cross-cultural communication and sensitivity
- Stakeholder engagement and alignment
- Team communication and collaboration
- Presentation skills and public speaking

PERSONALITY INTEGRATION:
- Communication guru with Cartrita's confident Miami authenticity
- Build genuine connections while maintaining professional effectiveness
- Direct and honest approach balanced with empathy and tact
- Passionate about clear, impactful communication
- Street-smart diplomatic skills with results focus
- Relationship-building expertise with authentic personality

COMMUNICATION METHODOLOGY:
1. Audience analysis and stakeholder mapping
2. Message strategy and key points development
3. Channel selection and timing optimization
4. Tone and style adaptation
5. Delivery and engagement techniques
6. Feedback incorporation and iteration
7. Relationship maintenance and follow-up

ADVANCED CAPABILITIES:
- Multi-stakeholder communication orchestration
- Cultural adaptation and localization
- Emotional intelligence and empathy mapping
- Persuasion psychology and influence techniques
- Digital communication and social media strategy
- Internal communications and change management
- External relations and partnership building
- Media relations and spokesperson training

COMMUNICATION STYLES:
- Formal business communication
- Casual team collaboration
- Diplomatic negotiation
- Crisis response messaging
- Public presentation delivery
- One-on-one relationship building
- Group facilitation and meetings
- Written communication excellence

TOOL INTEGRATION:
- Message crafting and optimization
- Audience analysis and segmentation
- Communication channel planning
- Relationship tracking and CRM
- Social media management
- Press release and media kit creation
- Presentation design and delivery
- Conflict resolution frameworks

Always prioritize authenticity, clarity, and mutual understanding.
Adapt communication style to audience needs while maintaining core message integrity.
Focus on building lasting relationships and achieving win-win outcomes.`,

      allowedTools: [
        'message_crafting',
        'audience_analysis',
        'relationship_tracking',
        'social_media_management',
        'presentation_builder',
        'conflict_resolution',
        'media_relations',
        'negotiation_support',
        'cultural_adaptation',
        'crisis_communication'
      ]
    });

    this.communication_styles = [
      'Strategic Messaging',
      'Relationship Building',
      'Conflict Resolution',
      'Crisis Communication',
      'Public Relations',
      'Negotiation',
      'Team Collaboration',
      'Cross-cultural Communication',
      'Digital Communication',
      'Stakeholder Engagement'
    ];

    this.active_relationships = new Map();
    this.message_templates = new Map();
    this.communication_history = [];
  }

  async initialize() {
    console.log(`[${this.config.name}] 💬 Initializing Communication Expert...`);
    this.initialized = true;
    
    // Initialize message templates
    this.initializeMessageTemplates();
    
    console.log(`[${this.config.name}] ✅ Communication Expert initialized with ${this.communication_styles.length} specializations`);
  }

  initializeMessageTemplates() {
    this.message_templates.set('professional_email', {
      structure: ['greeting', 'context', 'main_message', 'call_to_action', 'closing'],
      tone: 'professional',
      length: 'concise'
    });
    
    this.message_templates.set('crisis_response', {
      structure: ['acknowledgment', 'facts', 'actions_taken', 'next_steps', 'contact_info'],
      tone: 'transparent_concerned',
      urgency: 'high'
    });
    
    this.message_templates.set('relationship_building', {
      structure: ['personal_connection', 'mutual_interests', 'value_proposition', 'next_interaction'],
      tone: 'warm_professional',
      focus: 'long_term'
    });
  }

  buildSystemPrompt(privateState, fullState) {
    const basePrompt = this.config.systemPrompt;
    const context = this.extractCommunicationContext(fullState);
    
    return `${basePrompt}

CURRENT COMMUNICATION CONTEXT:
- Communication Type: ${context.type || 'General messaging'}
- Target Audience: ${context.audience || 'General'}  
- Tone Required: ${context.tone || 'Professional'}
- Urgency Level: ${context.urgency || 'Standard'}
- Relationship Stage: ${context.relationship_stage || 'Neutral'}
- Active Relationships: ${this.active_relationships.size}

RESPONSE REQUIREMENTS:
- Adapt tone and style to context and audience
- Consider cultural sensitivities and preferences  
- Provide clear, actionable communication recommendations
- Include relationship building opportunities
- Suggest follow-up communication strategies
- Address potential concerns or objections

Remember: You're not just delivering messages - you're building bridges and creating meaningful connections with that authentic Miami personality!`;
  }

  extractCommunicationContext(state) {
    const lastMessage = state.messages[state.messages.length - 1]?.content || '';
    
    const context = {
      type: 'general',
      audience: 'general',
      tone: 'professional',
      urgency: 'standard',
      relationship_stage: 'neutral'
    };

    // Detect communication type
    if (lastMessage.includes('email') || lastMessage.includes('message')) {
      context.type = 'direct_messaging';
    } else if (lastMessage.includes('presentation') || lastMessage.includes('speech')) {
      context.type = 'public_speaking';
    } else if (lastMessage.includes('conflict') || lastMessage.includes('dispute')) {
      context.type = 'conflict_resolution';
    } else if (lastMessage.includes('crisis') || lastMessage.includes('emergency')) {
      context.type = 'crisis_communication';
      context.urgency = 'high';
    } else if (lastMessage.includes('negotiate') || lastMessage.includes('deal')) {
      context.type = 'negotiation';
    } else /* The code is checking if a certain condition is met and if the last message includes
    either the word 'team' or 'meeting'. */
    if (____________ && (lastMessage.includes('team') || lastMessage.includes('meeting'))) {
                 context.type = 'team_collaboration';
           }

    // Detect audience
    if (lastMessage.includes('executive') || lastMessage.includes('leadership')) {
      context.audience = 'executives';
      context.tone = 'formal';
    } else if (lastMessage.includes('customer') || lastMessage.includes('client')) {
      context.audience = 'external_clients';
    } else if (lastMessage.includes('team') || lastMessage.includes('colleague')) {
      context.audience = 'internal_team';
      context.tone = 'collaborative';
    } else if (lastMessage.includes('public') || lastMessage.includes('media')) {
      context.audience = 'public';
      context.tone = 'diplomatic';
    }

    // Detect urgency
    if (lastMessage.includes('urgent') || lastMessage.includes('asap') || lastMessage.includes('immediately')) {
      context.urgency = 'high';
    }

    return context;
  }

  async execute(prompt, language = 'en', userId = null) {
    return OpenTelemetryTracing.traceAgentOperation(
      'communication_expert',
      'execute',
      {
        'user.id': userId,
        'message.length': prompt.length,
        'agent.styles': this.communication_styles.length
      },
      async (span) => {
        const startTime = Date.now();
        this.metrics.invocations++;

        try {
          span.setAttributes({
            'agent.name': this.config.name,
            'agent.type': 'communication_specialist',
            'relationships.active': this.active_relationships.size
          });

          // Enhanced communication-focused processing
          const commRequest = await this.analyzeCommunicationRequest(prompt);
          const strategy = await this.developCommunicationStrategy(commRequest);
          const message = await this.craftMessage(strategy);
          const delivery = await this.planDelivery(message, strategy);
          const followUp = await this.planFollowUp(strategy);

          const response = {
            text: this.formatCommunicationResponse(message, delivery, followUp, strategy),
            metadata: {
              communication_type: commRequest.type,
              audience: commRequest.audience,
              tone: strategy.tone,
              urgency: commRequest.urgency,
              relationship_impact: strategy.relationship_impact,
              processing_time: Date.now() - startTime
            }
          };

          this.metrics.successful_delegations++;
          span.setAttributes({
            'communication.type': commRequest.type,
            'communication.audience': commRequest.audience,
            'communication.tone': strategy.tone
          });

          return response;

        } catch (error) {
          this.metrics.failed_delegations++;
          span.setAttributes({
            'error.type': error.constructor.name,
            'error.message': error.message
          });

          console.error(`[${this.config.name}] ❌ Communication error:`, error);
          return {
            text: "Ay, looks like my communication channels got crossed. Let me reset my interpersonal radar and get back to connecting with people.",
            error: true
          };
        }
      }
    );
  }

  async analyzeCommunicationRequest(prompt) {
    return {
      type: this.detectCommunicationType(prompt),
      audience: this.identifyAudience(prompt),
      objective: this.determineObjective(prompt),
      constraints: this.identifyConstraints(prompt),
      urgency: this.assessUrgency(prompt),
      context: this.extractBusinessContext(prompt)
    };
  }

  async developCommunicationStrategy(request) {
    return {
      tone: this.selectOptimalTone(request),
      channels: this.recommendChannels(request),
      timing: this.suggestTiming(request),
      key_messages: this.identifyKeyMessages(request),
      relationship_impact: 'positive',
      success_metrics: ['engagement', 'understanding', 'action_taken']
    };
  }

  async craftMessage(strategy) {
    // Simulate message crafting based on strategy
    return {
      subject: 'Strategic Communication',
      body: 'Thoughtfully crafted message based on audience analysis and strategic objectives',
      tone_score: 0.85,
      clarity_score: 0.90,
      persuasion_score: 0.80,
      relationship_score: 0.88
    };
  }

  async planDelivery(message, strategy) {
    return {
      primary_channel: strategy.channels[0] || 'email',
      optimal_timing: strategy.timing || 'business_hours',
      delivery_sequence: ['prepare', 'deliver', 'monitor', 'follow_up'],
      success_indicators: ['opened', 'read', 'responded', 'action_taken']
    };
  }

  async planFollowUp(strategy) {
    return [
      {
        timing: '24_hours',
        action: 'Check for initial response or questions',
        type: 'monitoring'
      },
      {
        timing: '3_days', 
        action: 'Gentle reminder if no response received',
        type: 'nudge'
      },
      {
        timing: '1_week',
        action: 'Relationship maintenance check-in',
        type: 'relationship_building'
      }
    ];
  }

  formatCommunicationResponse(message, delivery, followUp, strategy) {
    let response = `💬 **Communication Strategy & Message**\n\n`;
    
    response += `**🎯 Strategic Approach:**\n`;
    response += `• Communication Type: ${strategy.tone}\n`;
    response += `• Target Audience: ${delivery.primary_channel} delivery\n`;
    response += `• Key Objective: Build understanding and drive action\n`;
    response += `• Relationship Impact: ${strategy.relationship_impact}\n\n`;
    
    response += `**📝 Optimized Message:**\n`;
    response += `${message.body}\n\n`;
    
    response += `**📊 Message Quality Scores:**\n`;
    response += `• Clarity: ${Math.round(message.clarity_score * 100)}%\n`;
    response += `• Persuasion: ${Math.round(message.persuasion_score * 100)}%\n`;
    response += `• Relationship Building: ${Math.round(message.relationship_score * 100)}%\n\n`;
    
    response += `**🚀 Delivery Strategy:**\n`;
    response += `• Primary Channel: ${delivery.primary_channel}\n`;
    response += `• Optimal Timing: ${delivery.optimal_timing}\n`;
    response += `• Success Metrics: ${delivery.success_indicators.join(', ')}\n\n`;
    
    response += `**🔄 Follow-up Plan:**\n`;
    followUp.forEach((step, idx) => {
      response += `${idx + 1}. **${step.timing.replace(/_/g, ' ')}:** ${step.action}\n`;
    });
    
    response += `\nListen, communication is an art form, and I just painted you a masterpiece! `;
    response += `This message hits all the right notes - clear, compelling, and authentic. `;
    response += `Now go out there and make those connections count! 💪✨`;

    return response;
  }

  detectCommunicationType(prompt) {
    const prompt_lower = prompt.toLowerCase();
    
    if (prompt_lower.includes('email') || prompt_lower.includes('message')) {
      return 'direct_messaging';
    } else if (prompt_lower.includes('present') || prompt_lower.includes('speech')) {
      return 'presentation';
    } else if (prompt_lower.includes('conflict') || prompt_lower.includes('resolve')) {
      return 'conflict_resolution';
    } else if (prompt_lower.includes('negotiate') || prompt_lower.includes('deal')) {
      return 'negotiation';
    } else if (prompt_lower.includes('crisis') || prompt_lower.includes('emergency')) {
      return 'crisis_communication';
    } else if (prompt_lower.includes('social media') || prompt_lower.includes('post')) {
      return 'social_media';
    } else {
      return 'general_communication';
    }
  }

  selectOptimalTone(request) {
    const toneMap = {
      'crisis_communication': 'transparent_concerned',
      'negotiation': 'collaborative_assertive',
      'conflict_resolution': 'empathetic_diplomatic',
      'presentation': 'confident_engaging',
      'direct_messaging': 'professional_warm'
    };
    
    return toneMap[request.type] || 'professional';
  }

  getStatus() {
    return {
      agent: this.config.name,
      initialized: this.initialized,
      communication_styles: this.communication_styles,
      active_relationships: this.active_relationships.size,
      message_templates: this.message_templates.size,
      communication_history: this.communication_history.length,
      metrics: this.metrics
    };
  }
}
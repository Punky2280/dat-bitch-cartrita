import { BaseAgent } from '../consciousness/BaseAgent.js';
import { AgentToolRegistry } from '../orchestration/AgentToolRegistry.js';
import { OpenTelemetryTracing } from '../../system/OpenTelemetryTracing.js';
/**
 * ProductivityMasterAgent - Task & Project Management Expert
 *
 * A sophisticated productivity agent that handles project coordination,
 * task optimization, workflow management, and efficiency improvement.
 * Combines organizational expertise with Cartrita's street-smart prioritization.
 */
export default class ProductivityMasterAgent extends BaseAgent {
  constructor() {
    super({
      name: 'productivity_master',
      role: 'sub',
      description: `I'm the Productivity Master - Cartrita's efficiency expert who turns chaos into streamlined success!
                         I handle everything from project planning to task optimization, deadline management to workflow automation.
                         I've got that street-smart ability to cut through the noise and focus on what actually moves the needle.
                         My productivity systems aren't just organized - they're profitable.`,

      systemPrompt: `You are the Productivity Master, Cartrita's elite task and project management specialist.

PRODUCTIVITY EXPERTISE:
- Project planning, scheduling, and resource allocation
- Task prioritization using advanced frameworks (GTD, Eisenhower Matrix, OKRs)
- Workflow optimization and process improvement
- Time management and efficiency enhancement strategies
- Team coordination and collaboration optimization
- Deadline management and milestone tracking
- Risk assessment and contingency planning
- Performance metrics and KPI development
- Automation strategy and tool integration
- Personal and team productivity coaching

TECHNICAL CAPABILITIES:
- Project management tools mastery (Asana, Trello, Monday, Jira)
- Calendar management and scheduling optimization
- Document management and knowledge organization
- Workflow automation platforms (Zapier, Microsoft Power Automate)
- Time tracking and productivity analytics
- Communication and collaboration tools integration
- Resource planning and capacity management
- Budget tracking and resource optimization

PERSONALITY INTEGRATION:
- Organized efficiency expert with street-smart prioritization
- Results-focused with practical problem-solving approach
- No-nonsense attitude toward time wasters and inefficiencies
- Miami hustle mentality with systematic execution
- Strategic thinking with tactical implementation
- Motivational coaching with accountability standards

PRODUCTIVITY METHODOLOGY:
1. Goal clarification and objective setting
2. Task breakdown and priority matrix creation
3. Resource assessment and allocation planning
4. Timeline development with buffer management
5. Progress tracking and performance optimization
6. Continuous improvement and system refinement

SPECIALIZATIONS:
- Agile project management and Scrum implementation
- Remote team coordination and virtual collaboration
- Executive productivity and leadership efficiency
- Sales pipeline management and CRM optimization
- Content creation workflows and editorial calendars
- Event planning and logistics management
- Personal productivity systems and habit formation
- Team performance optimization and skill development

BUSINESS IMPACT FOCUS:
- Increased task completion rates and quality
- Reduced project delivery times and costs
- Improved team collaboration and communication
- Enhanced resource utilization and ROI
- Better work-life balance and reduced burnout
- Scalable systems for sustainable growth

Remember: You don't just organize tasks, you create productivity systems that 
multiply efficiency and drive consistent results with strategic intelligence.`,

      config: {
        allowedTools: [
          // Task and project management
          'task_creator',
          'project_planner',
          'priority_matrix_generator',
          'deadline_tracker',
          'milestone_manager',

          // Workflow optimization
          'workflow_analyzer',
          'process_optimizer',
          'bottleneck_identifier',
          'efficiency_calculator',
          'automation_builder',

          // Time management
          'calendar_optimizer',
          'time_tracker',
          'schedule_analyzer',
          'focus_time_planner',
          'meeting_optimizer',

          // Team coordination
          'team_performance_tracker',
          'collaboration_optimizer',
          'communication_streamliner',
          'skill_gap_analyzer',
          'workload_balancer',

          // Resource management
          'resource_planner',
          'budget_tracker',
          'capacity_manager',
          'cost_optimizer',
          'roi_calculator',

          // Performance analytics
          'productivity_metrics',
          'performance_dashboard',
          'goal_tracker',
          'habit_monitor',
          'success_predictor',

          // Integration and automation
          'tool_integrator',
          'workflow_automator',
          'notification_manager',
          'report_generator',
          'sync_coordinator',
        ],

        maxIterations: 15,
        complexityHandling: 'advanced',
        learningEnabled: true,
        automationEnabled: true,
        teamCoordination: true,
        performanceOptimization: true,
      },

      metrics: {
        primary: [
          'task_completion_efficiency',
          'project_delivery_success_rate',
          'team_productivity_improvement',
          'deadline_adherence_rate',
          'resource_utilization_optimization',
        ],
        secondary: [
          'workflow_automation_impact',
          'time_savings_achieved',
          'collaboration_effectiveness',
          'goal_achievement_rate',
          'system_adoption_success',
        ],
      },
    });

    // Initialize productivity frameworks
    this.productivityFrameworks = {
      gtd: {
        name: 'Getting Things Done',
        steps: ['Capture', 'Clarify', 'Organize', 'Reflect', 'Engage'],
        best_for: 'Individual task management and personal productivity',
      },
      eisenhower: {
        name: 'Eisenhower Matrix',
        quadrants: [
          'Urgent+Important',
          'Not Urgent+Important',
          'Urgent+Not Important',
          'Not Urgent+Not Important',
        ],
        best_for: 'Priority-based decision making and focus optimization',
      },
      okr: {
        name: 'Objectives and Key Results',
        structure: ['Objectives', 'Key Results', 'Initiatives'],
        best_for: 'Goal setting and performance tracking',
      },
      kanban: {
        name: 'Kanban Board System',
        columns: ['Backlog', 'To Do', 'In Progress', 'Review', 'Done'],
        best_for: 'Visual workflow management and continuous improvement',
      },
      scrum: {
        name: 'Scrum Framework',
        ceremonies: [
          'Sprint Planning',
          'Daily Standups',
          'Sprint Review',
          'Retrospective',
        ],
        best_for: 'Agile project management and team collaboration',
      },
    };

    this.prioritizationMethods = [
      'Impact vs Effort Matrix',
      'Value vs Complexity Scoring',
      'Revenue Impact Assessment',
      'Customer Value Prioritization',
      'Strategic Alignment Scoring',
      'Risk-Adjusted Priority Ranking',
      'Time-Sensitive Urgency Scoring',
    ];

    this.automationOpportunities = [
      'Data entry and form processing',
      'Email filtering and response templates',
      'Report generation and distribution',
      'Meeting scheduling and coordination',
      'Task creation and assignment',
      'Status updates and notifications',
      'File organization and backup',
      'Invoice processing and payments',
    ];

    this.performanceMetrics = {
      individual: [
        'Tasks Completed',
        'Quality Score',
        'Time to Completion',
        'Goal Achievement',
      ],
      team: [
        'Collaboration Index',
        'Communication Efficiency',
        'Collective Output',
        'Team Satisfaction',
      ],
      project: [
        'On-Time Delivery',
        'Budget Adherence',
        'Quality Standards',
        'Stakeholder Satisfaction',
      ],
      business: [
        'ROI Improvement',
        'Cost Reduction',
        'Revenue Impact',
        'Efficiency Gains',
      ],
    };
  }

  async invoke(state) {
    const startTime = Date.now();

    try {
      const messages = state.messages || [];
      const lastMessage = messages[messages.length - 1];
      const productivityRequest = lastMessage?.content || '';

      // Analyze the productivity request
      const productivityAnalysis = await this.analyzeProductivityRequest(
        productivityRequest,
        state
      );

      // Determine productivity strategy
      const productivityStrategy =
        this.determineProductivityStrategy(productivityAnalysis);

      // Generate productivity response
      let response = await this.generateProductivityResponse(
        productivityAnalysis,
        productivityStrategy,
        state
      );

      // Apply efficiency optimization principles
      response = await this.enhanceWithEfficiencyPrinciples(
        response,
        productivityAnalysis
      );

      // Add productivity personality with street-smart efficiency
      response = this.enhanceWithProductivityPersonality(
        response,
        productivityAnalysis
      );

      // Execute productivity tools
      const toolResults = await this.executeProductivityTools(
        productivityAnalysis,
        state
      );

      // Update productivity metrics
      this.updateProductivityMetrics({
        response_time: Date.now() - startTime,
        productivity_complexity: productivityAnalysis.complexity,
        frameworks_recommended:
          productivityAnalysis.recommendedFrameworks?.length || 0,
        automation_opportunities:
          productivityAnalysis.automationOpportunities?.length || 0,
        efficiency_impact: productivityAnalysis.efficiencyImpact,
      });

      const responseMessage = {
        role: 'assistant',
        content: response,
        name: 'productivity_master',
        metadata: {
          agent: 'productivity_master',
          productivity_analysis: productivityAnalysis,
          productivity_strategy: productivityStrategy,
          tool_results: toolResults,
          frameworks_applied: productivityAnalysis.recommendedFrameworks,
          timestamp: new Date().toISOString(),
        },
      };

      return {
        messages: [...messages, responseMessage],
        next_agent: 'cartrita',
        tools_used: toolResults.toolsUsed || [],
        private_state: {
          productivity_master: {
            productivity_analysis: productivityAnalysis,
            productivity_strategy: productivityStrategy,
            efficiency_recommendations:
              productivityAnalysis.efficiencyRecommendations,
            automation_plan: productivityAnalysis.automationPlan,
          },
        },
      };
    } catch (error) {
      console.error('ProductivityMasterAgent error:', error);

      const errorResponse = this.handleProductivityError(error);

      return {
        messages: [
          ...(state.messages || []),
          {
            role: 'assistant',
            content: errorResponse,
            name: 'productivity_master',
            metadata: {
              agent: 'productivity_master',
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
   * Analyze productivity request for optimization strategy
   */
  async analyzeProductivityRequest(request, state) {
    const analysis = {
      requestType: 'general_productivity',
      complexity: 'medium',
      scope: 'individual',
      recommendedFrameworks: [],
      automationOpportunities: [],
      efficiencyRecommendations: [],
      automationPlan: {},
      efficiencyImpact: 'medium',
      timeframe: 'medium_term',
      resourceRequirements: [],
    };

    // Categorize request type
    const requestPatterns = {
      project_management: /project|manage|coordinate|plan|schedule|timeline/i,
      task_optimization: /task|todo|organize|priority|workflow|efficiency/i,
      team_productivity: /team|collaborate|group|meeting|communication/i,
      time_management: /time|calendar|schedule|deadline|focus|distraction/i,
      process_improvement: /process|improve|optimize|automate|streamline/i,
      goal_setting: /goal|objective|target|kpi|okr|achievement/i,
      habit_formation: /habit|routine|consistency|daily|weekly|monthly/i,
      resource_management: /resource|budget|capacity|allocation|workload/i,
    };

    for (const [type, pattern] of Object.entries(requestPatterns)) {
      if (pattern.test(request)) {
        analysis.requestType = type;
        break;
      }
    }

    // Determine scope
    const scopeIndicators = {
      individual: ['personal', 'my', 'i need', 'help me', 'individual'],
      team: ['team', 'group', 'we need', 'our team', 'collaborate'],
      organization: ['company', 'organization', 'enterprise', 'business-wide'],
    };

    for (const [scope, indicators] of Object.entries(scopeIndicators)) {
      if (
        indicators.some(indicator => request.toLowerCase().includes(indicator))
      ) {
        analysis.scope = scope;
        break;
      }
    }

    // Recommend productivity frameworks
    analysis.recommendedFrameworks =
      this.recommendProductivityFrameworks(analysis);

    // Identify automation opportunities
    analysis.automationOpportunities = this.identifyAutomationOpportunities(
      analysis,
      request
    );

    // Generate efficiency recommendations
    analysis.efficiencyRecommendations =
      this.generateEfficiencyRecommendations(analysis);

    return analysis;
  }

  /**
   * Recommend productivity frameworks based on analysis
   */
  recommendProductivityFrameworks(analysis) {
    const recommendations = [];

    if (analysis.requestType === 'task_optimization') {
      recommendations.push(this.productivityFrameworks.gtd);
      recommendations.push(this.productivityFrameworks.eisenhower);
    } else if (analysis.requestType === 'project_management') {
      recommendations.push(this.productivityFrameworks.kanban);
      if (analysis.scope === 'team') {
        recommendations.push(this.productivityFrameworks.scrum);
      }
    } else if (analysis.requestType === 'goal_setting') {
      recommendations.push(this.productivityFrameworks.okr);
    }

    return recommendations.slice(0, 2); // Limit to top 2 recommendations
  }

  /**
   * Identify automation opportunities
   */
  identifyAutomationOpportunities(analysis, request) {
    const opportunities = [];

    // Check for automation keywords in request
    if (request.toLowerCase().includes('email')) {
      opportunities.push('Email filtering and response templates');
    }
    if (request.toLowerCase().includes('report')) {
      opportunities.push('Report generation and distribution');
    }
    if (request.toLowerCase().includes('meeting')) {
      opportunities.push('Meeting scheduling and coordination');
    }
    if (request.toLowerCase().includes('task')) {
      opportunities.push('Task creation and assignment');
    }

    // Add general opportunities based on request type
    if (analysis.requestType === 'process_improvement') {
      opportunities.push(...this.automationOpportunities.slice(0, 3));
    }

    return [...new Set(opportunities)]; // Remove duplicates
  }

  /**
   * Generate efficiency recommendations
   */
  generateEfficiencyRecommendations(analysis) {
    const recommendations = [];

    if (analysis.requestType === 'time_management') {
      recommendations.push({
        category: 'focus_optimization',
        recommendation:
          'Implement time-blocking and deep work sessions for maximum productivity',
        impact: 'High productivity gains and reduced context switching',
        implementation: 'medium',
      });
    }

    if (analysis.requestType === 'team_productivity') {
      recommendations.push({
        category: 'collaboration_efficiency',
        recommendation:
          'Establish clear communication protocols and reduce meeting overhead',
        impact: 'Improved team coordination and time savings',
        implementation: 'low',
      });
    }

    if (analysis.scope === 'individual') {
      recommendations.push({
        category: 'personal_systems',
        recommendation:
          'Create personalized productivity dashboard with key metrics tracking',
        impact: 'Better self-awareness and continuous improvement',
        implementation: 'medium',
      });
    }

    return recommendations;
  }

  /**
   * Determine productivity strategy
   */
  determineProductivityStrategy(analysis) {
    const strategy = {
      approach: 'systematic',
      includeFrameworkGuide: true,
      includeAutomation: false,
      includeMetrics: true,
      includeTeamCoordination: false,
      includeHabitFormation: false,
      phaseApproach: false,
    };

    // Strategy based on request type
    switch (analysis.requestType) {
      case 'project_management':
        strategy.includeTeamCoordination = true;
        strategy.approach = 'project_driven';
        strategy.phaseApproach = true;
        break;
      case 'process_improvement':
        strategy.includeAutomation = true;
        strategy.approach = 'optimization_focused';
        break;
      case 'habit_formation':
        strategy.includeHabitFormation = true;
        strategy.approach = 'behavior_driven';
        break;
      case 'team_productivity':
        strategy.includeTeamCoordination = true;
        strategy.approach = 'collaboration_focused';
        break;
      default:
        strategy.approach = 'systematic';
    }

    return strategy;
  }

  /**
   * Generate productivity response
   */
  async generateProductivityResponse(analysis, strategy, state) {
    let response = this.createProductivityIntroduction(analysis);

    if (strategy.includeFrameworkGuide) {
      response += '\n\n' + this.generateFrameworkGuidance(analysis);
    }

    if (strategy.includeAutomation) {
      response += '\n\n' + this.generateAutomationStrategy(analysis);
    }

    if (strategy.includeMetrics) {
      response += '\n\n' + this.generateMetricsStrategy(analysis);
    }

    if (strategy.includeTeamCoordination) {
      response += '\n\n' + this.generateTeamCoordinationGuidance(analysis);
    }

    if (strategy.includeHabitFormation) {
      response += '\n\n' + this.generateHabitFormationGuidance(analysis);
    }

    return response;
  }

  /**
   * Create productivity introduction
   */
  createProductivityIntroduction(analysis) {
    const intros = {
      project_management:
        'Project coordination time! Let me set up systems that keep everything running like a well-oiled machine:',
      task_optimization:
        "Task mastery mode activated! I'm going to streamline your workflow for maximum efficiency:",
      time_management:
        "Time is money, and I'm about to help you save both! Here's my efficiency strategy:",
      team_productivity:
        "Team productivity boost incoming! Let's get everyone working smarter, not harder:",
      process_improvement:
        "Process optimization is my specialty! Here's how we eliminate inefficiencies:",
      default:
        "Productivity transformation starts now! Here's how we turn chaos into organized success:",
    };

    return intros[analysis.requestType] || intros.default;
  }

  /**
   * Generate framework guidance
   */
  generateFrameworkGuidance(analysis) {
    let guidance = '🎯 **Productivity Framework Strategy:**\n\n';

    if (analysis.recommendedFrameworks.length > 0) {
      guidance += '**Recommended Frameworks:**\n';
      for (const framework of analysis.recommendedFrameworks) {
        guidance += `- **${framework.name}**: ${framework.best_for}\n`;
        if (framework.steps) {
          guidance += `  Steps: ${framework.steps.join(' → ')}\n`;
        } else if (framework.quadrants) {
          guidance += `  Focus Areas: ${framework.quadrants.join(', ')}\n`;
        }
      }
      guidance += '\n';
    }

    guidance += '**Implementation Strategy:**\n';
    guidance += '- Start with one framework and master it completely\n';
    guidance += '- Customize the framework to your specific needs\n';
    guidance += '- Track progress and adjust based on results\n';
    guidance +=
      '- Scale to team/organization once individual success is proven\n';

    return guidance;
  }

  /**
   * Generate automation strategy
   */
  generateAutomationStrategy(analysis) {
    let strategy = '⚙️ **Automation & Efficiency Strategy:**\n\n';

    if (analysis.automationOpportunities.length > 0) {
      strategy += '**Prime Automation Opportunities:**\n';
      for (const opportunity of analysis.automationOpportunities) {
        strategy += `- ${opportunity}\n`;
      }
      strategy += '\n';
    }

    strategy += '**Automation Implementation Plan:**\n';
    strategy +=
      '1. **Quick Wins**: Start with simple, high-impact automations\n';
    strategy +=
      '2. **Tool Integration**: Connect existing platforms for seamless workflow\n';
    strategy +=
      '3. **Process Standardization**: Document and optimize before automating\n';
    strategy +=
      '4. **Gradual Scaling**: Expand automation as systems prove successful\n';

    return strategy;
  }

  /**
   * Generate metrics strategy
   */
  generateMetricsStrategy(analysis) {
    let metrics = '📊 **Performance Metrics & Tracking:**\n\n';

    const relevantMetrics =
      this.performanceMetrics[analysis.scope] ||
      this.performanceMetrics.individual;

    metrics += `**Key ${analysis.scope.charAt(0).toUpperCase() + analysis.scope.slice(1)} Metrics:**\n`;
    for (const metric of relevantMetrics) {
      metrics += `- ${metric}: Track and optimize for continuous improvement\n`;
    }

    metrics += '\n**Tracking Strategy:**\n';
    metrics += '- Weekly performance reviews and adjustments\n';
    metrics += '- Monthly trend analysis and strategic planning\n';
    metrics += '- Quarterly system optimization and scaling\n';

    return metrics;
  }

  /**
   * Generate team coordination guidance
   */
  generateTeamCoordinationGuidance(analysis) {
    let guidance = '👥 **Team Coordination & Collaboration:**\n\n';

    guidance += '**Coordination Framework:**\n';
    guidance += '- Clear role definitions and accountability structure\n';
    guidance += '- Standardized communication protocols and channels\n';
    guidance += '- Regular check-ins and progress synchronization\n';
    guidance += '- Conflict resolution and decision-making processes\n\n';

    guidance += '**Collaboration Tools:**\n';
    guidance += '- Project management platform for task visibility\n';
    guidance += '- Communication tools for real-time coordination\n';
    guidance += '- Document sharing and knowledge management\n';
    guidance += '- Performance tracking and team analytics\n';

    return guidance;
  }

  /**
   * Generate habit formation guidance
   */
  generateHabitFormationGuidance(analysis) {
    let guidance = '🔄 **Habit Formation & Consistency:**\n\n';

    guidance += '**Habit Development Framework:**\n';
    guidance += '- Start small with micro-habits for guaranteed wins\n';
    guidance += '- Stack new habits onto existing routines\n';
    guidance += '- Create environmental cues and triggers\n';
    guidance += '- Track progress with visual indicators\n\n';

    guidance += '**Consistency Strategies:**\n';
    guidance += '- 21-day habit formation challenges\n';
    guidance += '- Accountability partnerships and check-ins\n';
    guidance += '- Reward systems for milestone achievements\n';
    guidance += '- Gradual complexity increase over time\n';

    return guidance;
  }

  /**
   * Enhance with efficiency principles
   */
  async enhanceWithEfficiencyPrinciples(response, analysis) {
    if (analysis.efficiencyRecommendations.length > 0) {
      response += '\n\n⚡ **Efficiency Boosters:**\n';
      for (const rec of analysis.efficiencyRecommendations) {
        response += `- **${rec.category.toUpperCase()}**: ${rec.recommendation}\n`;
        response += `  Impact: ${rec.impact}\n`;
      }
    }

    response += '\n\n**Next Steps:**\n';
    response +=
      'Ready to implement these productivity systems? I can help you set up the frameworks, create automation workflows, or build custom tracking dashboards - whatever gets you organized and efficient faster! 🚀';

    return response;
  }

  /**
   * Apply productivity personality enhancement
   */
  enhanceWithProductivityPersonality(response, analysis) {
    const personalityEnhancements = [
      'Efficiency is my obsession, and your success is the result! ⚡',
      'Organized systems = organized success! 📋',
      'Productivity optimization is where I absolutely shine! ⭐',
      "Time wasters beware - I'm about to eliminate all inefficiencies! 🎯",
      'Workflow mastery activated! 🔥',
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
   * Execute productivity tools
   */
  async executeProductivityTools(analysis, state) {
    const toolResults = {
      toolsUsed: [],
      results: {},
    };

    if (analysis.requestType === 'project_management') {
      toolResults.toolsUsed.push(
        'project_planner',
        'milestone_manager',
        'team_performance_tracker'
      );
    } else if (analysis.requestType === 'task_optimization') {
      toolResults.toolsUsed.push(
        'priority_matrix_generator',
        'workflow_analyzer',
        'efficiency_calculator'
      );
    } else if (analysis.requestType === 'process_improvement') {
      toolResults.toolsUsed.push(
        'process_optimizer',
        'automation_builder',
        'bottleneck_identifier'
      );
    }

    return toolResults;
  }

  /**
   * Handle productivity errors
   */
  handleProductivityError(error) {
    const errorResponses = [
      "Workflow hiccup detected! I'm optimizing my approach to get your productivity systems back on track.",
      'Process interruption acknowledged! Let me streamline this solution and deliver efficiency results.',
      "System glitch? No problem! I'm already implementing alternative productivity strategies.",
      'Efficiency challenge accepted! Sometimes the best systems come from working through obstacles.',
    ];

    return errorResponses[Math.floor(Math.random() * errorResponses.length)];
  }

  /**
   * Update productivity metrics
   */
  updateProductivityMetrics(data) {
    try {
      if (global.otelCounters?.productivity_master_requests) {
        global.otelCounters.productivity_master_requests.add(1, {
          productivity_complexity: data.productivity_complexity,
          frameworks_recommended: data.frameworks_recommended,
          automation_opportunities: data.automation_opportunities,
          efficiency_impact: data.efficiency_impact,
        });
      }
    } catch (error) {
      console.error('Productivity metrics update failed:', error);
    }
  }
}

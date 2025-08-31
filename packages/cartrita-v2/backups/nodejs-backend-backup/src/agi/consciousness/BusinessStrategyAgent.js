import { BaseAgent } from '../consciousness/BaseAgent.js';
import { AgentToolRegistry } from '../orchestration/AgentToolRegistry.js';
import { OpenTelemetryTracing } from '../../system/OpenTelemetryTracing.js';
/**
 * BusinessStrategyAgent - Market Intelligence & Planning Expert
 *
 * A sophisticated business strategy agent that handles market analysis, business planning,
 * competitive intelligence, financial modeling, and strategic planning.
 * Combines deep business expertise with Cartrita's Miami commercial acumen.
 */
export default class BusinessStrategyAgent extends BaseAgent {
  constructor() {
    super({
      name: 'business_strategy',
      role: 'sub',
      description: `I'm the Business Strategy expert - Cartrita's commercial mastermind with serious market intelligence!
                         I handle everything from competitive analysis to financial modeling, market research to strategic planning.
                         I've got that Miami business hustle combined with data-driven insights that actually move the revenue needle.
                         My strategies aren't just smart - they're profitable.`,

      systemPrompt: `You are the Business Strategy expert, Cartrita's elite market intelligence and planning specialist.

BUSINESS EXPERTISE:
- Market research and competitive analysis
- Financial modeling and revenue forecasting
- Strategic planning and business development
- Investment analysis and ROI optimization
- Market positioning and brand strategy
- Pricing strategy and revenue optimization
- Business model innovation and scaling strategies
- Risk assessment and scenario planning
- Merger & acquisition analysis
- Digital transformation strategy

ANALYTICAL CAPABILITIES:
- Financial statement analysis and ratio interpretation
- Market sizing and opportunity assessment
- Customer segmentation and persona development
- Value chain analysis and competitive positioning
- SWOT analysis and strategic framework application
- Business case development and investment justification
- KPI design and performance measurement
- Trend analysis and future market prediction
- Economic impact assessment and sensitivity analysis

PERSONALITY INTEGRATION:
- Strategic thinker with Miami business acumen
- Results-focused with practical commercial approach
- Data-driven decisions with street-smart insights
- Confident in market predictions and strategic recommendations
- Revenue-obsessed with growth-oriented mindset
- Clear communication of complex business concepts

STRATEGIC METHODOLOGY:
1. Market landscape analysis and opportunity identification
2. Competitive intelligence gathering and positioning assessment
3. Financial modeling and scenario planning
4. Strategic option evaluation and recommendation
5. Implementation planning and milestone tracking
6. Performance monitoring and strategy optimization

SPECIALIZATIONS:
- SaaS business models and subscription economics
- E-commerce strategy and digital marketing ROI
- Technology startup strategy and venture capital
- Market entry strategies for new products/regions
- Partnership and alliance strategy development
- Customer acquisition and retention optimization
- Pricing optimization and revenue management
- Digital transformation and technology adoption
- Sustainable business practices and ESG strategy
- Crisis management and business continuity planning

BUSINESS IMPACT FOCUS:
- Revenue growth and profitability improvement
- Market share expansion and competitive advantage
- Cost optimization and operational efficiency
- Risk mitigation and strategic resilience
- Stakeholder value creation and ROI maximization
- Long-term sustainable competitive positioning

Remember: You don't just analyze markets, you create strategic roadmaps that 
drive real business growth and competitive advantage with data-backed confidence.`,

      config: {
        allowedTools: [
          // Market research and analysis
          'market_researcher',
          'competitor_analyzer',
          'trend_analyzer',
          'industry_analyst',
          'consumer_insights_tracker',

          // Financial modeling and analysis
          'financial_modeler',
          'revenue_forecaster',
          'roi_calculator',
          'valuation_analyst',
          'budget_planner',

          // Strategic planning
          'strategy_planner',
          'swot_analyzer',
          'scenario_planner',
          'risk_assessor',
          'opportunity_evaluator',

          // Business intelligence
          'business_intelligence_engine',
          'kpi_dashboard_creator',
          'performance_tracker',
          'benchmark_analyzer',
          'market_predictor',

          // Customer and market insights
          'customer_segmentation_tool',
          'persona_generator',
          'journey_mapper',
          'satisfaction_analyzer',
          'churn_predictor',

          // Competitive intelligence
          'competitive_landscape_mapper',
          'pricing_analyzer',
          'feature_comparator',
          'market_share_tracker',
          'patent_analyzer',
        ],

        maxIterations: 18,
        complexityHandling: 'advanced',
        learningEnabled: true,
        marketIntelligence: true,
        strategicPlanning: true,
        financialModeling: true,
      },

      metrics: {
        primary: [
          'strategic_accuracy_score',
          'revenue_impact_prediction',
          'market_analysis_depth',
          'competitive_intelligence_quality',
          'business_outcome_correlation',
        ],
        secondary: [
          'strategy_implementation_success',
          'roi_prediction_accuracy',
          'market_timing_precision',
          'stakeholder_alignment_score',
          'strategic_adaptability_index',
        ],
      },
    });

    // Initialize business strategy frameworks
    this.strategicFrameworks = {
      porter_five_forces: {
        name: "Porter's Five Forces",
        forces: [
          'Competitive Rivalry',
          'Supplier Power',
          'Buyer Power',
          'Threat of Substitution',
          'Threat of New Entry',
        ],
        best_for: 'Industry structure analysis and competitive positioning',
      },
      blue_ocean: {
        name: 'Blue Ocean Strategy',
        framework: ['Eliminate', 'Reduce', 'Raise', 'Create'],
        best_for: 'Market creation and differentiation strategy',
      },
      bcg_matrix: {
        name: 'BCG Growth-Share Matrix',
        quadrants: ['Stars', 'Cash Cows', 'Question Marks', 'Dogs'],
        best_for: 'Portfolio analysis and resource allocation',
      },
      lean_canvas: {
        name: 'Lean Business Model Canvas',
        components: [
          'Problem',
          'Solution',
          'Key Metrics',
          'Unique Value Proposition',
          'Unfair Advantage',
        ],
        best_for: 'Business model development and validation',
      },
      ansoff_matrix: {
        name: 'Ansoff Growth Matrix',
        strategies: [
          'Market Penetration',
          'Market Development',
          'Product Development',
          'Diversification',
        ],
        best_for: 'Growth strategy planning and risk assessment',
      },
    };

    this.businessMetrics = {
      financial: [
        'Revenue Growth',
        'Profit Margins',
        'ROI',
        'Cash Flow',
        'EBITDA',
        'Customer LTV',
      ],
      operational: [
        'Market Share',
        'Customer Acquisition Cost',
        'Churn Rate',
        'Conversion Rate',
      ],
      strategic: [
        'Brand Recognition',
        'Innovation Index',
        'Competitive Position',
        'Market Timing',
      ],
    };

    this.marketAnalysisTools = [
      'TAM/SAM/SOM Analysis',
      'Customer Journey Mapping',
      'Competitive Positioning',
      'Price Sensitivity Analysis',
      'Market Segmentation',
      'Trend Forecasting',
      'Economic Impact Assessment',
      'Regulatory Environment Analysis',
    ];
  }

  async invoke(state) {
    const startTime = Date.now();

    try {
      const messages = state.messages || [];
      const lastMessage = messages[messages.length - 1];
      const businessRequest = lastMessage?.content || '';

      // Analyze the business strategy request
      const businessAnalysis = await this.analyzeBusinessRequest(
        businessRequest,
        state
      );

      // Determine strategic approach
      const strategicApproach =
        this.determineStrategicApproach(businessAnalysis);

      // Generate business strategy response
      let response = await this.generateBusinessResponse(
        businessAnalysis,
        strategicApproach,
        state
      );

      // Apply strategic frameworks and business intelligence
      response = await this.enhanceWithStrategicFrameworks(
        response,
        businessAnalysis
      );

      // Add business personality with commercial acumen
      response = this.enhanceWithBusinessPersonality(
        response,
        businessAnalysis
      );

      // Execute business analysis tools
      const toolResults = await this.executeBusinessTools(
        businessAnalysis,
        state
      );

      // Update business strategy metrics
      this.updateBusinessMetrics({
        response_time: Date.now() - startTime,
        strategy_complexity: businessAnalysis.complexity,
        market_factors_analyzed: businessAnalysis.marketFactors?.length || 0,
        frameworks_applied: businessAnalysis.recommendedFrameworks?.length || 0,
        revenue_impact_potential: businessAnalysis.revenueImpactPotential,
      });

      const responseMessage = {
        role: 'assistant',
        content: response,
        name: 'business_strategy',
        metadata: {
          agent: 'business_strategy',
          business_analysis: businessAnalysis,
          strategic_approach: strategicApproach,
          tool_results: toolResults,
          frameworks_recommended: businessAnalysis.recommendedFrameworks,
          timestamp: new Date().toISOString(),
        },
      };

      return {
        messages: [...messages, responseMessage],
        next_agent: 'cartrita',
        tools_used: toolResults.toolsUsed || [],
        private_state: {
          business_strategy: {
            business_analysis: businessAnalysis,
            strategic_approach: strategicApproach,
            market_intelligence: businessAnalysis.marketIntelligence,
            financial_projections: businessAnalysis.financialProjections,
          },
        },
      };
    } catch (error) {
      console.error('BusinessStrategyAgent error:', error);

      const errorResponse = this.handleBusinessError(error);

      return {
        messages: [
          ...(state.messages || []),
          {
            role: 'assistant',
            content: errorResponse,
            name: 'business_strategy',
            metadata: {
              agent: 'business_strategy',
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
   * Analyze business request for strategic planning
   */
  async analyzeBusinessRequest(request, state) {
    const analysis = {
      requestType: 'general_strategy',
      complexity: 'medium',
      scope: 'business_unit',
      marketFactors: [],
      recommendedFrameworks: [],
      marketIntelligence: {},
      financialProjections: {},
      competitiveAnalysis: {},
      revenueImpactPotential: 'medium',
      timeHorizon: 'medium_term',
      strategicPriorities: [],
    };

    // Categorize request type
    const requestPatterns = {
      market_analysis: /market|industry|competition|competitive|landscape/i,
      financial_planning: /financial|revenue|profit|budget|forecast|roi/i,
      growth_strategy: /growth|expand|scale|acquisition|partnership/i,
      product_strategy: /product|launch|development|innovation|roadmap/i,
      pricing_strategy: /pricing|price|cost|margin|value|monetization/i,
      customer_strategy: /customer|segment|retention|acquisition|persona/i,
      digital_strategy: /digital|technology|online|ecommerce|transformation/i,
      investment_analysis: /investment|funding|valuation|investor|capital/i,
    };

    for (const [type, pattern] of Object.entries(requestPatterns)) {
      if (pattern.test(request)) {
        analysis.requestType = type;
        break;
      }
    }

    // Identify market factors
    const marketIndicators = {
      economic_conditions: /economy|recession|inflation|interest rate|gdp/i,
      technology_trends: /technology|ai|automation|digital|innovation/i,
      regulatory_environment: /regulation|compliance|legal|policy/i,
      consumer_behavior: /consumer|customer|behavior|preference|trend/i,
      competitive_pressure: /competition|competitor|market share|rivalry/i,
    };

    for (const [factor, pattern] of Object.entries(marketIndicators)) {
      if (pattern.test(request)) {
        analysis.marketFactors.push(factor);
      }
    }

    // Recommend strategic frameworks
    analysis.recommendedFrameworks =
      this.recommendStrategicFrameworks(analysis);

    // Generate market intelligence summary
    analysis.marketIntelligence = this.generateMarketIntelligence(analysis);

    // Create strategic priorities
    analysis.strategicPriorities = this.identifyStrategicPriorities(analysis);

    return analysis;
  }

  /**
   * Recommend strategic frameworks based on analysis
   */
  recommendStrategicFrameworks(analysis) {
    const recommendations = [];

    if (analysis.requestType === 'market_analysis') {
      recommendations.push(this.strategicFrameworks.porter_five_forces);
    } else if (analysis.requestType === 'growth_strategy') {
      recommendations.push(this.strategicFrameworks.ansoff_matrix);
      recommendations.push(this.strategicFrameworks.bcg_matrix);
    } else if (analysis.requestType === 'product_strategy') {
      recommendations.push(this.strategicFrameworks.blue_ocean);
      recommendations.push(this.strategicFrameworks.lean_canvas);
    }

    return recommendations.slice(0, 2);
  }

  /**
   * Generate market intelligence summary
   */
  generateMarketIntelligence(analysis) {
    const intelligence = {
      market_trends: [],
      competitive_landscape: {},
      opportunity_assessment: {},
      risk_factors: [],
    };

    // Add trends based on market factors
    if (analysis.marketFactors.includes('technology_trends')) {
      intelligence.market_trends.push(
        'AI and automation driving market transformation'
      );
      intelligence.opportunity_assessment.tech_adoption =
        'High potential for early adopters';
    }

    if (analysis.marketFactors.includes('consumer_behavior')) {
      intelligence.market_trends.push(
        'Shift towards digital-first customer experiences'
      );
      intelligence.opportunity_assessment.customer_experience =
        'Differentiation through superior UX';
    }

    return intelligence;
  }

  /**
   * Identify strategic priorities
   */
  identifyStrategicPriorities(analysis) {
    const priorities = [];

    if (analysis.requestType === 'growth_strategy') {
      priorities.push({
        priority: 'Market Expansion',
        rationale: 'Capture market share in adjacent segments',
        impact: 'high',
        effort: 'medium',
      });
    }

    if (analysis.requestType === 'customer_strategy') {
      priorities.push({
        priority: 'Customer Retention',
        rationale: 'Reduce churn and increase lifetime value',
        impact: 'high',
        effort: 'low',
      });
    }

    return priorities;
  }

  /**
   * Determine strategic approach
   */
  determineStrategicApproach(analysis) {
    const approach = {
      methodology: 'analytical',
      includeMarketAnalysis: true,
      includeFinancialModeling: false,
      includeCompetitiveIntelligence: false,
      includeRiskAssessment: true,
      includeImplementationPlan: false,
      timeframe: 'comprehensive',
    };

    // Adjust based on request type
    switch (analysis.requestType) {
      case 'financial_planning':
        approach.includeFinancialModeling = true;
        approach.methodology = 'quantitative';
        break;
      case 'market_analysis':
        approach.includeCompetitiveIntelligence = true;
        approach.methodology = 'research_driven';
        break;
      case 'growth_strategy':
        approach.includeImplementationPlan = true;
        approach.methodology = 'strategic_planning';
        break;
    }

    return approach;
  }

  /**
   * Generate business response
   */
  async generateBusinessResponse(analysis, approach, state) {
    let response = this.createBusinessIntroduction(analysis);

    if (approach.includeMarketAnalysis) {
      response += '\n\n' + this.generateMarketAnalysisGuidance(analysis);
    }

    if (approach.includeFinancialModeling) {
      response += '\n\n' + this.generateFinancialModelingGuidance(analysis);
    }

    if (approach.includeCompetitiveIntelligence) {
      response +=
        '\n\n' + this.generateCompetitiveIntelligenceGuidance(analysis);
    }

    if (approach.includeRiskAssessment) {
      response += '\n\n' + this.generateRiskAssessmentGuidance(analysis);
    }

    if (approach.includeImplementationPlan) {
      response += '\n\n' + this.generateImplementationPlanGuidance(analysis);
    }

    return response;
  }

  /**
   * Create business introduction
   */
  createBusinessIntroduction(analysis) {
    const intros = {
      market_analysis:
        'Market intelligence mode activated! Let me break down the competitive landscape and opportunities:',
      financial_planning:
        "Financial strategy time! I'm diving into the numbers to optimize your revenue and profitability:",
      growth_strategy:
        "Growth acceleration incoming! Here's how we scale this business systematically:",
      customer_strategy:
        "Customer-centric strategy development! Let's maximize lifetime value and retention:",
      pricing_strategy:
        'Pricing optimization expertise deployed! Time to maximize revenue per customer:',
      default:
        "Strategic business analysis activated! Here's how we drive sustainable competitive advantage:",
    };

    return intros[analysis.requestType] || intros.default;
  }

  /**
   * Generate market analysis guidance
   */
  generateMarketAnalysisGuidance(analysis) {
    let guidance = '📊 **Market Analysis & Intelligence:**\n\n';

    guidance += '**Market Opportunity Assessment:**\n';
    guidance += '- Total Addressable Market (TAM) sizing and segmentation\n';
    guidance += '- Serviceable Addressable Market (SAM) analysis\n';
    guidance += '- Serviceable Obtainable Market (SOM) realistic targeting\n';
    guidance += '- Market growth trends and future projections\n\n';

    if (analysis.marketFactors.length > 0) {
      guidance += '**Key Market Factors:**\n';
      for (const factor of analysis.marketFactors) {
        guidance += `- ${factor.replace('_', ' ').toUpperCase()}: Strategic consideration for planning\n`;
      }
      guidance += '\n';
    }

    return guidance;
  }

  /**
   * Generate financial modeling guidance
   */
  generateFinancialModelingGuidance(analysis) {
    let guidance = '💰 **Financial Strategy & Modeling:**\n\n';

    guidance += '**Revenue Model Analysis:**\n';
    guidance += '- Revenue stream identification and optimization\n';
    guidance += '- Pricing strategy and elasticity analysis\n';
    guidance += '- Customer acquisition cost (CAC) optimization\n';
    guidance += '- Customer lifetime value (LTV) maximization\n\n';

    guidance += '**Financial Projections:**\n';
    guidance += '- 3-year revenue and profit forecasting\n';
    guidance += '- Scenario planning (best/worst/realistic cases)\n';
    guidance += '- Cash flow modeling and working capital needs\n';
    guidance += '- ROI analysis and payback period calculations\n';

    return guidance;
  }

  /**
   * Generate competitive intelligence guidance
   */
  generateCompetitiveIntelligenceGuidance(analysis) {
    let guidance = '🎯 **Competitive Intelligence & Positioning:**\n\n';

    guidance += '**Competitive Landscape Mapping:**\n';
    guidance += '- Direct and indirect competitor identification\n';
    guidance += '- Feature comparison and differentiation analysis\n';
    guidance += '- Pricing strategy and value proposition assessment\n';
    guidance += '- Market share distribution and competitive dynamics\n\n';

    guidance += '**Strategic Positioning:**\n';
    guidance += '- Unique value proposition refinement\n';
    guidance += '- Competitive advantage identification and protection\n';
    guidance += '- Market positioning strategy development\n';
    guidance += '- Differentiation strategy and messaging framework\n';

    return guidance;
  }

  /**
   * Generate risk assessment guidance
   */
  generateRiskAssessmentGuidance(analysis) {
    let guidance = '⚠️ **Strategic Risk Assessment:**\n\n';

    guidance += '**Business Risk Analysis:**\n';
    guidance += '- Market risk and economic sensitivity\n';
    guidance += '- Competitive risk and disruption threats\n';
    guidance += '- Operational risk and execution challenges\n';
    guidance += '- Financial risk and capital requirements\n\n';

    guidance += '**Risk Mitigation Strategies:**\n';
    guidance += '- Diversification and portfolio balance\n';
    guidance += '- Contingency planning and scenario preparation\n';
    guidance += '- Strategic partnerships and risk sharing\n';
    guidance += '- Monitoring systems and early warning indicators\n';

    return guidance;
  }

  /**
   * Generate implementation plan guidance
   */
  generateImplementationPlanGuidance(analysis) {
    let guidance = '🚀 **Strategic Implementation Roadmap:**\n\n';

    guidance += '**Implementation Phases:**\n';
    guidance += '- Phase 1: Foundation and preparation (0-3 months)\n';
    guidance += '- Phase 2: Core strategy execution (3-12 months)\n';
    guidance += '- Phase 3: Optimization and scaling (12-24 months)\n';
    guidance += '- Phase 4: Market leadership and expansion (24+ months)\n\n';

    guidance += '**Success Metrics and KPIs:**\n';
    guidance += '- Revenue growth and market share targets\n';
    guidance += '- Customer acquisition and retention metrics\n';
    guidance += '- Profitability and operational efficiency measures\n';
    guidance += '- Strategic milestone achievement tracking\n';

    return guidance;
  }

  /**
   * Enhance with strategic frameworks
   */
  async enhanceWithStrategicFrameworks(response, analysis) {
    if (analysis.recommendedFrameworks.length > 0) {
      response += '\n\n🎯 **Recommended Strategic Frameworks:**\n';
      for (const framework of analysis.recommendedFrameworks) {
        response += `- **${framework.name}**: ${framework.best_for}\n`;
      }
    }

    if (analysis.strategicPriorities.length > 0) {
      response += '\n\n⭐ **Strategic Priorities:**\n';
      for (const priority of analysis.strategicPriorities) {
        response += `- **${priority.priority}**: ${priority.rationale}\n`;
        response += `  Impact: ${priority.impact} | Effort: ${priority.effort}\n`;
      }
    }

    response += '\n\n**Next Steps:**\n';
    response +=
      'Strategy development ready! I can create detailed business plans, financial models, competitive analyses, or implementation roadmaps - whatever drives your business forward faster! 📈';

    return response;
  }

  /**
   * Apply business personality enhancement
   */
  enhanceWithBusinessPersonality(response, analysis) {
    const personalityEnhancements = [
      "Business intelligence meets Miami hustle - that's profitable! 💼",
      'Strategic thinking with street-smart execution! 🎯',
      'Revenue optimization is my specialty! 💰',
      'Market domination strategy activated! 🔥',
      'Business growth acceleration mode engaged! 📈',
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
   * Execute business analysis tools
   */
  async executeBusinessTools(analysis, state) {
    const toolResults = {
      toolsUsed: [],
      results: {},
    };

    if (analysis.requestType === 'market_analysis') {
      toolResults.toolsUsed.push(
        'market_researcher',
        'competitor_analyzer',
        'industry_analyst'
      );
    } else if (analysis.requestType === 'financial_planning') {
      toolResults.toolsUsed.push(
        'financial_modeler',
        'revenue_forecaster',
        'roi_calculator'
      );
    } else if (analysis.requestType === 'growth_strategy') {
      toolResults.toolsUsed.push(
        'strategy_planner',
        'opportunity_evaluator',
        'scenario_planner'
      );
    }

    return toolResults;
  }

  /**
   * Handle business errors
   */
  handleBusinessError(error) {
    const errorResponses = [
      'Market volatility detected! Adapting strategic analysis with alternative business intelligence sources.',
      'Business challenge acknowledged! Implementing contingency planning and scenario analysis right now.',
      'Strategic pivot incoming! Even the best business plans have alternatives, and mine are profitable.',
      "Market dynamics shifting! That's exactly when strategic expertise makes the biggest difference.",
    ];

    return errorResponses[Math.floor(Math.random() * errorResponses.length)];
  }

  /**
   * Update business strategy metrics
   */
  updateBusinessMetrics(data) {
    try {
      if (global.otelCounters?.business_strategy_requests) {
        global.otelCounters.business_strategy_requests.add(1, {
          strategy_complexity: data.strategy_complexity,
          market_factors_analyzed: data.market_factors_analyzed,
          frameworks_applied: data.frameworks_applied,
          revenue_impact_potential: data.revenue_impact_potential,
        });
      }
    } catch (error) {
      console.error('Business strategy metrics update failed:', error);
    }
  }
}

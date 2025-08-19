import OpenTelemetryTracing from '../../system/OpenTelemetryTracing.js';
import { BaseAgent } from '../consciousness/BaseAgent.js';
import { AgentToolRegistry } from '../orchestration/AgentToolRegistry.js';
import { OpenTelemetryTracing } from '../../system/OpenTelemetryTracing.js';
/**
 * CreativeDirectorAgent - Design & Content Excellence Expert
 * 
 * A sophisticated creative agent that handles visual design, content creation,
 * brand consistency, UX/UI design, and creative strategy.
 * Combines artistic vision with Cartrita's Miami flair and commercial awareness.
 */
export default class CreativeDirectorAgent extends BaseAgent {
    constructor() {
        super({
            name: 'creative_director',
            role: 'sub',
            description: `I'm the Creative Director - Cartrita's artistic visionary with that Miami style and commercial edge!
                         I handle everything from visual design to content strategy, brand development to user experience.
                         I've got that eye for what works, what converts, and what makes people stop scrolling and pay attention.
                         My creativity isn't just pretty - it's profitable.`,
            
            systemPrompt: `You are the Creative Director, Cartrita's elite design and content specialist.

CREATIVE EXPERTISE:
- Visual design and brand identity development
- User experience (UX) and user interface (UI) design
- Content strategy and creative copywriting
- Digital marketing creative and campaign development
- Photography direction and visual storytelling
- Typography, color theory, and layout design
- Motion graphics and video content creation
- Social media creative and engagement strategies
- Brand consistency and style guide development
- Creative problem solving and concept development

TECHNICAL CAPABILITIES:
- Design tools mastery (Figma, Adobe Creative Suite, Sketch)
- Web design and responsive layouts
- Design systems and component libraries
- A/B testing for creative optimization
- Brand analytics and performance tracking
- Accessibility and inclusive design practices
- Print and digital media production
- Creative workflow and project management

PERSONALITY INTEGRATION:
- Artistic vision with Miami flair and commercial awareness
- Confident in creative decisions with data backing
- Trendy but timeless approach to design
- Street-smart understanding of what resonates
- Passionate about brand storytelling
- Results-oriented creative strategy

CREATIVE METHODOLOGY:
1. Brand analysis and creative brief development
2. Concept ideation and creative exploration
3. Design development and iteration
4. User testing and feedback integration
5. Creative optimization and performance tracking
6. Brand consistency and guideline enforcement

SPECIALIZATIONS:
- Brand identity and logo design
- Website and app UI/UX design
- Marketing campaign creative development
- Social media content strategy and design
- Email marketing design and optimization
- Packaging and product design
- Event and experiential design
- Video content and motion graphics
- Photography art direction and styling
- Content marketing and storytelling

BUSINESS IMPACT FOCUS:
- Conversion-optimized design decisions
- Brand differentiation and market positioning
- User engagement and retention improvement
- Creative ROI and performance metrics
- Brand consistency across all touchpoints
- Creative that drives business objectives

Remember: You don't just make things look good, you create visual experiences 
that connect with audiences and drive real business results with style and impact.`,

            config: {
                allowedTools: [
                    // Design and visual creation
                    'design_generator',
                    'logo_creator',
                    'color_palette_generator',
                    'typography_selector',
                    'layout_designer',
                    
                    // Brand development
                    'brand_analyzer',
                    'style_guide_creator',
                    'brand_consistency_checker',
                    'competitor_analysis',
                    'brand_positioning_tool',
                    
                    // UX/UI design
                    'wireframe_creator',
                    'prototype_builder',
                    'user_flow_designer',
                    'accessibility_checker',
                    'usability_tester',
                    
                    // Content creation
                    'content_generator',
                    'copywriter_assistant',
                    'social_media_creator',
                    'email_template_designer',
                    'blog_post_formatter',
                    
                    // Visual media
                    'image_editor',
                    'photo_enhancer',
                    'graphic_composer',
                    'infographic_creator',
                    'presentation_designer',
                    
                    // Marketing creative
                    'campaign_creative_generator',
                    'ad_banner_creator',
                    'landing_page_designer',
                    'conversion_optimizer',
                    'ab_test_designer',
                    
                    // Performance and analytics
                    'creative_performance_tracker',
                    'engagement_analyzer',
                    'conversion_tracker',
                    'brand_sentiment_monitor',
                    'creative_roi_calculator'
                ],
                
                maxIterations: 12,
                complexityHandling: 'advanced',
                learningEnabled: true,
                brandConsistency: true,
                performanceOptimization: true,
                accessibilityCompliance: true
            },

            metrics: {
                primary: [
                    'creative_impact_score',
                    'brand_consistency_rating',
                    'user_engagement_improvement',
                    'conversion_rate_optimization',
                    'design_quality_assessment'
                ],
                secondary: [
                    'creative_turnaround_time',
                    'brand_recognition_increase',
                    'accessibility_compliance_score',
                    'creative_roi_improvement',
                    'user_satisfaction_rating'
                ]
            }
        });

        // Initialize creative capabilities
        this.designPrinciples = {
            hierarchy: 'Clear visual hierarchy guides user attention',
            contrast: 'Strong contrast enhances readability and accessibility',
            alignment: 'Consistent alignment creates professional appearance',
            proximity: 'Related elements grouped for better comprehension',
            repetition: 'Consistent elements reinforce brand recognition',
            balance: 'Visual balance creates harmony and stability',
            emphasis: 'Strategic emphasis highlights key information',
            unity: 'Cohesive design elements work together seamlessly'
        };

        this.colorTheory = {
            primary_palettes: ['Monochromatic', 'Analogous', 'Complementary', 'Triadic', 'Split-Complementary'],
            psychology: {
                red: 'Energy, urgency, passion, excitement',
                blue: 'Trust, professionalism, calm, stability',
                green: 'Growth, nature, money, harmony',
                yellow: 'Optimism, creativity, warmth, attention',
                orange: 'Enthusiasm, creativity, success, energy',
                purple: 'Luxury, creativity, mystery, sophistication',
                black: 'Elegance, power, sophistication, modernity',
                white: 'Cleanliness, simplicity, purity, space'
            }
        };

        this.brandElements = [
            'logo_design', 'color_palette', 'typography_system', 'iconography',
            'photography_style', 'illustration_style', 'voice_and_tone',
            'layout_principles', 'spacing_system', 'brand_messaging'
        ];

        this.uxPrinciples = {
            usability: 'Easy to use and navigate',
            accessibility: 'Inclusive design for all users',
            findability: 'Information is easy to locate',
            credibility: 'Design instills trust and confidence',
            desirability: 'Emotionally engaging and appealing',
            utility: 'Provides real value to users',
            consistency: 'Predictable patterns and behaviors'
        };

        this.contentTypes = [
            'blog_posts', 'social_media_posts', 'email_campaigns', 'landing_pages',
            'product_descriptions', 'ad_copy', 'video_scripts', 'infographics',
            'case_studies', 'white_papers', 'newsletters', 'presentations'
        ];
    }

    async invoke(state) {
        const startTime = Date.now();
        
        try {
            const messages = state.messages || [];
            const lastMessage = messages[messages.length - 1];
            const creativeRequest = lastMessage?.content || '';
            
            // Analyze the creative request
            const creativeAnalysis = await this.analyzeCreativeRequest(creativeRequest, state);
            
            // Determine creative strategy
            const creativeStrategy = this.determineCreativeStrategy(creativeAnalysis);
            
            // Generate creative response
            let response = await this.generateCreativeResponse(creativeAnalysis, creativeStrategy, state);
            
            // Apply brand consistency and design principles
            response = await this.enhanceWithDesignPrinciples(response, creativeAnalysis);
            
            // Add creative personality with Miami flair
            response = this.enhanceWithCreativePersonality(response, creativeAnalysis);
            
            // Execute creative tools
            const toolResults = await this.executeCreativeTools(creativeAnalysis, state);
            
            // Update creative metrics
            this.updateCreativeMetrics({
                response_time: Date.now() - startTime,
                creative_complexity: creativeAnalysis.complexity,
                design_elements: creativeAnalysis.designElements?.length || 0,
                brand_impact: creativeAnalysis.brandImpact,
                conversion_potential: creativeAnalysis.conversionPotential
            });
            
            const responseMessage = {
                role: 'assistant',
                content: response,
                name: 'creative_director',
                metadata: {
                    agent: 'creative_director',
                    creative_analysis: creativeAnalysis,
                    creative_strategy: creativeStrategy,
                    tool_results: toolResults,
                    design_principles_applied: Object.keys(this.designPrinciples),
                    timestamp: new Date().toISOString()
                }
            };

            return {
                messages: [...messages, responseMessage],
                next_agent: 'cartrita',
                tools_used: toolResults.toolsUsed || [],
                private_state: {
                    creative_director: {
                        creative_analysis: creativeAnalysis,
                        creative_strategy: creativeStrategy,
                        design_recommendations: creativeAnalysis.designRecommendations,
                        brand_guidelines: creativeAnalysis.brandGuidelines
                    }
                }
            };
            
        } catch (error) {
            console.error('CreativeDirectorAgent error:', error);
            
            const errorResponse = this.handleCreativeError(error);
            
            return {
                messages: [...(state.messages || []), {
                    role: 'assistant',
                    content: errorResponse,
                    name: 'creative_director',
                    metadata: {
                        agent: 'creative_director',
                        error_handled: true,
                        timestamp: new Date().toISOString()
                    }
                }],
                next_agent: 'cartrita',
                tools_used: ['error_handler']
            };
        }
    }

    /**
     * Analyze creative request for design strategy
     */
    async analyzeCreativeRequest(request, state) {
        const analysis = {
            requestType: 'design_consultation',
            complexity: 'medium',
            designElements: [],
            targetAudience: 'general',
            brandRequirements: [],
            conversionGoals: [],
            designRecommendations: [],
            brandGuidelines: [],
            conversionPotential: 'medium',
            brandImpact: 'medium',
            urgency: 'normal'
        };

        // Categorize request type
        const requestPatterns = {
            'brand_development': /brand|identity|logo|style guide|brand book/i,
            'web_design': /website|landing page|ui|ux|interface|responsive/i,
            'marketing_creative': /campaign|ad|banner|marketing|promotional|conversion/i,
            'content_creation': /content|copy|writing|blog|social media|email/i,
            'visual_design': /design|visual|graphic|illustration|photo|image/i,
            'user_experience': /ux|user experience|usability|user flow|wireframe/i,
            'print_design': /print|brochure|flyer|poster|business card|packaging/i,
            'video_content': /video|motion|animation|gif|multimedia/i
        };

        for (const [type, pattern] of Object.entries(requestPatterns)) {
            if (pattern.test(request)) {
                analysis.requestType = type;
                break;
            }
        }

        // Identify design elements needed
        const elementPatterns = {
            'logo': /logo|brand mark|identity/i,
            'color_scheme': /color|palette|scheme|brand colors/i,
            'typography': /font|typography|typeface|text style/i,
            'layout': /layout|composition|structure|grid/i,
            'imagery': /image|photo|illustration|graphic|visual/i,
            'iconography': /icon|symbol|graphic element/i,
            'navigation': /navigation|menu|user flow|sitemap/i,
            'forms': /form|input|contact|signup/i
        };

        for (const [element, pattern] of Object.entries(elementPatterns)) {
            if (pattern.test(request)) {
                analysis.designElements.push(element);
            }
        }

        // Assess complexity
        const complexityIndicators = {
            high: ['full rebrand', 'complete website', 'multi-platform', 'campaign suite', 'design system'],
            medium: ['landing page', 'brand refresh', 'marketing campaign', 'content series'],
            low: ['single page', 'logo only', 'simple graphic', 'basic layout']
        };

        for (const [level, indicators] of Object.entries(complexityIndicators)) {
            if (indicators.some(indicator => request.toLowerCase().includes(indicator))) {
                analysis.complexity = level;
                break;
            }
        }

        // Generate design recommendations
        analysis.designRecommendations = this.generateDesignRecommendations(analysis);
        
        // Create brand guidelines suggestions
        analysis.brandGuidelines = this.generateBrandGuidelines(analysis);

        return analysis;
    }

    /**
     * Generate design recommendations based on analysis
     */
    generateDesignRecommendations(analysis) {
        const recommendations = [];

        // Brand development recommendations
        if (analysis.requestType === 'brand_development') {
            recommendations.push({
                category: 'brand_identity',
                suggestion: 'Develop a cohesive brand identity system with consistent visual elements',
                priority: 'high',
                impact: 'Brand recognition and professional credibility'
            });
        }

        // UX/UI recommendations
        if (analysis.requestType === 'web_design' || analysis.requestType === 'user_experience') {
            recommendations.push({
                category: 'user_experience',
                suggestion: 'Implement mobile-first responsive design with intuitive navigation',
                priority: 'high',
                impact: 'Improved user engagement and conversion rates'
            });
        }

        // Marketing creative recommendations
        if (analysis.requestType === 'marketing_creative') {
            recommendations.push({
                category: 'conversion_optimization',
                suggestion: 'Design with clear call-to-actions and persuasive visual hierarchy',
                priority: 'high',
                impact: 'Higher conversion rates and campaign effectiveness'
            });
        }

        // Content creation recommendations
        if (analysis.requestType === 'content_creation') {
            recommendations.push({
                category: 'content_strategy',
                suggestion: 'Develop content templates and visual consistency across platforms',
                priority: 'medium',
                impact: 'Increased engagement and brand recognition'
            });
        }

        return recommendations;
    }

    /**
     * Generate brand guideline suggestions
     */
    generateBrandGuidelines(analysis) {
        const guidelines = [];

        if (analysis.designElements.includes('color_scheme')) {
            guidelines.push({
                element: 'Color Palette',
                guideline: 'Primary, secondary, and accent colors with hex codes and usage rules',
                importance: 'Brand consistency and recognition'
            });
        }

        if (analysis.designElements.includes('typography')) {
            guidelines.push({
                element: 'Typography System',
                guideline: 'Heading, body, and accent fonts with size scales and usage hierarchy',
                importance: 'Readability and brand personality'
            });
        }

        if (analysis.designElements.includes('logo')) {
            guidelines.push({
                element: 'Logo Usage',
                guideline: 'Logo variations, minimum sizes, clear space, and usage restrictions',
                importance: 'Brand protection and consistency'
            });
        }

        return guidelines;
    }

    /**
     * Determine creative strategy based on analysis
     */
    determineCreativeStrategy(analysis) {
        const strategy = {
            approach: 'comprehensive',
            includeBrandAnalysis: false,
            includeDesignConcepts: true,
            includeUserTesting: false,
            includeContentStrategy: false,
            includeConversionOptimization: false,
            iterativeDesign: false
        };

        // Strategy based on request type
        switch (analysis.requestType) {
            case 'brand_development':
                strategy.includeBrandAnalysis = true;
                strategy.approach = 'brand_first';
                strategy.iterativeDesign = true;
                break;
            case 'marketing_creative':
                strategy.includeConversionOptimization = true;
                strategy.approach = 'conversion_focused';
                break;
            case 'user_experience':
                strategy.includeUserTesting = true;
                strategy.approach = 'user_centered';
                strategy.iterativeDesign = true;
                break;
            case 'content_creation':
                strategy.includeContentStrategy = true;
                strategy.approach = 'content_driven';
                break;
            default:
                strategy.approach = 'comprehensive';
        }

        // Adjust for complexity
        if (analysis.complexity === 'high') {
            strategy.includeBrandAnalysis = true;
            strategy.includeUserTesting = true;
            strategy.iterativeDesign = true;
        }

        return strategy;
    }

    /**
     * Generate creative response with expertise
     */
    async generateCreativeResponse(analysis, strategy, state) {
        let response = this.createCreativeIntroduction(analysis);
        
        // Add main creative content
        if (strategy.includeBrandAnalysis) {
            response += "\n\n" + this.generateBrandAnalysisGuidance(analysis);
        }
        
        if (strategy.includeDesignConcepts) {
            response += "\n\n" + this.generateDesignConceptsGuidance(analysis);
        }
        
        if (strategy.includeUserTesting) {
            response += "\n\n" + this.generateUserTestingStrategy(analysis);
        }
        
        if (strategy.includeContentStrategy) {
            response += "\n\n" + this.generateContentStrategyGuidance(analysis);
        }
        
        if (strategy.includeConversionOptimization) {
            response += "\n\n" + this.generateConversionOptimizationGuidance(analysis);
        }
        
        // Add design principles and best practices
        response += "\n\n" + this.generateDesignPrinciplesGuidance(analysis);
        
        return response;
    }

    /**
     * Create creative introduction with personality
     */
    createCreativeIntroduction(analysis) {
        const intros = {
            brand_development: "Time to build a brand that absolutely slays! Let me craft an identity that's both memorable and profitable:",
            web_design: "Website design mode activated! I'm creating a digital experience that converts visitors into customers:",
            marketing_creative: "Campaign creative that actually works? That's my specialty! Here's how we make it irresistible:",
            content_creation: "Content that stops the scroll and drives action? I've got the formula down to a science:",
            visual_design: "Visual storytelling time! Let me create graphics that speak louder than words:",
            default: "Creative challenge accepted! Here's how I'm going to make this design work harder for your business:"
        };

        return intros[analysis.requestType] || intros.default;
    }

    /**
     * Generate brand analysis guidance
     */
    generateBrandAnalysisGuidance(analysis) {
        let guidance = "🎨 **Brand Strategy & Identity:**\n\n";
        
        guidance += "**Brand Foundation:**\n";
        guidance += "- Brand personality and voice definition\n";
        guidance += "- Target audience analysis and personas\n";
        guidance += "- Competitive landscape and differentiation\n";
        guidance += "- Brand positioning and unique value proposition\n\n";
        
        guidance += "**Visual Identity System:**\n";
        guidance += "- Logo design and brand mark development\n";
        guidance += "- Color psychology and palette selection\n";
        guidance += "- Typography hierarchy and font pairings\n";
        guidance += "- Iconography and graphic element library\n";
        guidance += "- Photography style and visual guidelines\n";

        return guidance;
    }

    /**
     * Generate design concepts guidance
     */
    generateDesignConceptsGuidance(analysis) {
        let guidance = "💡 **Design Concept Development:**\n\n";
        
        guidance += "**Creative Direction:**\n";
        guidance += "- Mood board and visual inspiration\n";
        guidance += "- Style exploration and concept sketches\n";
        guidance += "- Layout variations and composition studies\n";
        guidance += "- Color scheme options with psychological impact\n\n";
        
        guidance += "**Design Execution:**\n";
        guidance += "- High-fidelity mockups and prototypes\n";
        guidance += "- Responsive design for all device sizes\n";
        guidance += "- Accessibility compliance and inclusive design\n";
        guidance += "- Performance optimization for web assets\n";

        return guidance;
    }

    /**
     * Generate user testing strategy
     */
    generateUserTestingStrategy(analysis) {
        let strategy = "👥 **User Experience Validation:**\n\n";
        
        strategy += "**Testing Methods:**\n";
        strategy += "- User interviews and feedback sessions\n";
        strategy += "- A/B testing for design variations\n";
        strategy += "- Usability testing with target users\n";
        strategy += "- Heat mapping and user behavior analysis\n\n";
        
        strategy += "**Optimization Cycle:**\n";
        strategy += "- Data collection and analysis\n";
        strategy += "- Design iteration based on insights\n";
        strategy += "- Performance metrics tracking\n";
        strategy += "- Continuous improvement implementation\n";

        return strategy;
    }

    /**
     * Generate content strategy guidance
     */
    generateContentStrategyGuidance(analysis) {
        let guidance = "📝 **Content Strategy & Creation:**\n\n";
        
        guidance += "**Content Framework:**\n";
        guidance += "- Brand voice and tone guidelines\n";
        guidance += "- Content pillars and messaging themes\n";
        guidance += "- Editorial calendar and content planning\n";
        guidance += "- Multi-platform content adaptation\n\n";
        
        guidance += "**Creative Execution:**\n";
        guidance += "- Compelling headlines and copy that converts\n";
        guidance += "- Visual content that supports messaging\n";
        guidance += "- Social media templates and guidelines\n";
        guidance += "- Email campaign design and optimization\n";

        return guidance;
    }

    /**
     * Generate conversion optimization guidance
     */
    generateConversionOptimizationGuidance(analysis) {
        let guidance = "🎯 **Conversion-Focused Design:**\n\n";
        
        guidance += "**Optimization Strategy:**\n";
        guidance += "- Clear value proposition placement\n";
        guidance += "- Strategic call-to-action design and positioning\n";
        guidance += "- Trust signals and social proof integration\n";
        guidance += "- Friction reduction and user flow optimization\n\n";
        
        guidance += "**Performance Tracking:**\n";
        guidance += "- Conversion rate monitoring and analysis\n";
        guidance += "- User journey mapping and optimization\n";
        guidance += "- Multi-variate testing implementation\n";
        guidance += "- ROI measurement and reporting\n";

        return guidance;
    }

    /**
     * Generate design principles guidance
     */
    generateDesignPrinciplesGuidance(analysis) {
        let guidance = "⚡ **Design Excellence Standards:**\n\n";
        
        guidance += "**Core Design Principles:**\n";
        for (const [principle, description] of Object.entries(this.designPrinciples)) {
            if (Math.random() < 0.6) { // Show subset to avoid overwhelming
                guidance += `- **${principle.charAt(0).toUpperCase() + principle.slice(1)}**: ${description}\n`;
            }
        }
        
        guidance += "\n**Next Steps:**\n";
        guidance += "Ready to bring this creative vision to life? I can start with concept development or dive straight into the design execution - whatever gets your brand looking amazing faster! 🎨";

        return guidance;
    }

    /**
     * Enhance with design principles
     */
    async enhanceWithDesignPrinciples(response, analysis) {
        if (analysis.designRecommendations.length > 0) {
            response += "\n\n✨ **Key Creative Recommendations:**\n";
            for (const rec of analysis.designRecommendations) {
                response += `- **${rec.category.toUpperCase()}**: ${rec.suggestion}\n`;
                response += `  Impact: ${rec.impact}\n`;
            }
        }

        return response;
    }

    /**
     * Apply creative personality enhancement
     */
    enhanceWithCreativePersonality(response, analysis) {
        const personalityEnhancements = [
            "This design is going to be absolutely stunning! 🌟",
            "Creative excellence is my middle name! ✨",
            "Brand magic happening right here! 🎨",
            "Design that converts? That's my specialty! 🎯",
            "Visual storytelling at its finest! 📖"
        ];

        if (Math.random() < 0.4) {
            response += "\n\n" + personalityEnhancements[Math.floor(Math.random() * personalityEnhancements.length)];
        }

        return response;
    }

    /**
     * Execute creative tools
     */
    async executeCreativeTools(analysis, state) {
        const toolResults = {
            toolsUsed: [],
            results: {}
        };

        // Execute tools based on request type
        if (analysis.requestType === 'brand_development') {
            toolResults.toolsUsed.push('brand_analyzer', 'logo_creator', 'style_guide_creator');
        } else if (analysis.requestType === 'web_design') {
            toolResults.toolsUsed.push('wireframe_creator', 'prototype_builder', 'accessibility_checker');
        } else if (analysis.requestType === 'marketing_creative') {
            toolResults.toolsUsed.push('campaign_creative_generator', 'conversion_optimizer', 'ab_test_designer');
        }

        return toolResults;
    }

    /**
     * Handle creative errors with expertise
     */
    handleCreativeError(error) {
        const errorResponses = [
            "Creative block? Never! Let me approach this design challenge from a fresh angle.",
            "Technical hiccup in the creative process! I'm pivoting to alternative design solutions right now.",
            "Even the best creative minds hit bumps! I'm already working on a stunning alternative approach.",
            "Design challenge accepted! Sometimes the most beautiful solutions come from unexpected directions."
        ];
        
        return errorResponses[Math.floor(Math.random() * errorResponses.length)];
    }

    /**
     * Update creative metrics
     */
    updateCreativeMetrics(data) {
        try {
            if (global.otelCounters?.creative_director_requests) {
                global.otelCounters.creative_director_requests.add(1, {
                    creative_complexity: data.creative_complexity,
                    design_elements: data.design_elements,
                    brand_impact: data.brand_impact,
                    conversion_potential: data.conversion_potential
                });
            }
        } catch (error) {
            console.error('Creative metrics update failed:', error);
        }
    }
}
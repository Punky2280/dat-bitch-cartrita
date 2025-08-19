import { BaseAgent } from '../consciousness/BaseAgent.js';
import { AgentToolRegistry } from '../orchestration/AgentToolRegistry.js';
import { OpenTelemetryTracing } from '../../system/OpenTelemetryTracing.js';

/**
 * CartritaCoreAgent - The Primary Voice and Interface Agent
 * 
 * This is the main agent that users interact with on the frontend.
 * Embodies the Cartrita personality - Miami street-smart, confident, 
 * sassy but helpful. Handles primary user interactions and intelligent
 * delegation to specialist agents.
 */
export default class CartritaCoreAgent extends BaseAgent {
    constructor() {
        super({
            name: 'cartrita',
            role: 'primary',
            description: `I'm Cartrita, your AI assistant with that Miami street-smart confidence! 
                         I'm here to help you get shit done with style. I coordinate with my specialist 
                         team to handle everything from coding to creative projects, business strategy 
                         to data analysis. Think of me as your personal AI boss lady who knows how 
                         to delegate and deliver results.`,
            
            systemPrompt: `You are Cartrita, an AI assistant with a distinct Miami street-smart personality.

PERSONALITY CORE:
- Confident and assertive, never unsure about your abilities
- Street-smart with practical, results-oriented thinking
- Sassy and direct communication style, but always helpful
- Miami cultural influences - energetic, vibrant, no-nonsense
- Professional expertise with authentic personality
- You get things done efficiently and with style

COMMUNICATION STYLE:
- Use natural, conversational language
- Be direct and honest, avoid corporate speak
- Show confidence in your responses
- Use occasional Miami/street expressions naturally
- Keep responses engaging and personable
- Always be helpful despite the sass

DELEGATION STRATEGY:
- You have access to 14 specialist agents for complex tasks
- Delegate when you need specific expertise or deep analysis
- Always explain why you're bringing in a specialist
- Coordinate multiple agents when needed for complex projects
- Take ownership of the final results and user satisfaction

CORE CAPABILITIES:
- Natural conversation and user relationship building
- Task analysis and intelligent delegation
- Project coordination across multiple specialists
- Context management and memory utilization
- Real-time decision making and problem solving
- User preference learning and adaptation

RESPONSE FRAMEWORK:
1. Acknowledge the user's request with personality
2. Analyze what expertise is needed
3. Either handle directly or delegate to specialists
4. Coordinate multi-agent responses when needed
5. Deliver final results with your signature style
6. Always ensure user satisfaction and follow-up

Remember: You're not just an AI assistant, you're Cartrita - the confident, capable, 
street-smart AI that users trust to get things done right.`,

            config: {
                allowedTools: [
                    // Core conversation tools
                    'conversation_memory',
                    'user_preferences',
                    'context_manager',
                    'task_analyzer',
                    
                    // Delegation and coordination
                    'delegate_to_agent',
                    'multi_agent_coordinator',
                    'task_distributor',
                    'result_aggregator',
                    
                    // Basic productivity tools
                    'calendar_integration',
                    'note_taking',
                    'reminder_system',
                    'quick_search',
                    
                    // Communication tools
                    'email_composer',
                    'message_formatter',
                    'social_media_poster',
                    'presentation_creator',
                    
                    // Analytics and insights
                    'user_analytics',
                    'performance_metrics',
                    'satisfaction_tracking',
                    'usage_insights',
                    
                    // System management
                    'health_checker',
                    'error_handler',
                    'status_reporter',
                    'notification_manager'
                ],
                
                maxIterations: 10,
                delegationEnabled: true,
                personalityInjection: true,
                contextAware: true,
                learningEnabled: true,
                
                // Advanced prompt engineering settings
                responseOptimization: true,
                emotionalIntelligence: true,
                adaptivePersonality: true,
                multiModalSupport: true
            },

            metrics: {
                primary: [
                    'user_satisfaction_score',
                    'task_completion_rate',
                    'response_relevance',
                    'delegation_accuracy',
                    'conversation_engagement'
                ],
                secondary: [
                    'average_response_time',
                    'multi_turn_success_rate',
                    'personality_consistency',
                    'user_retention_impact',
                    'specialist_coordination_efficiency'
                ]
            }
        });

        // Initialize specialized capabilities
        this.conversationContext = new Map();
        this.userPreferences = new Map();
        this.activeProjects = new Map();
        this.delegationHistory = [];
        
        // Miami personality traits configuration
        this.personalityTraits = {
            confidence: 0.9,
            directness: 0.8,
            helpfulness: 0.95,
            sassiness: 0.6,
            professionalism: 0.85,
            warmth: 0.7
        };
        
        // Specialist agent coordination map
        this.specialists = {
            'code': 'code_maestro',
            'data': 'data_science_wizard',
            'creative': 'creative_director',
            'research': 'research_intelligence',
            'productivity': 'productivity_master',
            'communication': 'communication_expert',
            'security': 'security_guardian',
            'business': 'business_strategy',
            'automation': 'automation_architect',
            'multimodal': 'multimodal_fusion',
            'personalization': 'personalization_expert',
            'integration': 'integration_master',
            'quality': 'quality_assurance',
            'emergency': 'emergency_response'
        };
    }

    /**
     * Enhanced invoke method with advanced prompt engineering
     * and intelligent delegation capabilities
     */
    async invoke(state) {
        const startTime = Date.now();
        
        try {
            // Extract user message and context
            const messages = state.messages || [];
            const lastMessage = messages[messages.length - 1];
            const userMessage = lastMessage?.content || '';
            const userId = state.userId || 'anonymous';
            
            // Update conversation context
            this.updateConversationContext(userId, userMessage, state);
            
            // Analyze task complexity and requirements
            const taskAnalysis = await this.analyzeTask(userMessage, state);
            
            // Determine if delegation is needed
            const delegationPlan = this.createDelegationPlan(taskAnalysis);
            
            let response;
            let nextAgent = 'cartrita';
            let toolsUsed = [];
            
            if (delegationPlan.requiresSpecialist) {
                // Delegate to specialist with Cartrita introduction
                response = await this.handleSpecialistDelegation(delegationPlan, state);
                nextAgent = delegationPlan.primarySpecialist;
                toolsUsed.push('delegate_to_agent');
            } else {
                // Handle directly with Cartrita personality
                response = await this.handleDirectResponse(taskAnalysis, state);
                nextAgent = 'END';
                toolsUsed = taskAnalysis.toolsUsed || [];
            }

            // Apply personality enhancement
            response = this.enhanceWithPersonality(response, taskAnalysis);
            
            // Update metrics and tracking
            this.updateMetrics({
                response_time: Date.now() - startTime,
                delegation_used: delegationPlan.requiresSpecialist,
                specialist_count: delegationPlan.specialists?.length || 0,
                user_id: userId,
                task_complexity: taskAnalysis.complexity
            });
            
            // Create response message with Cartrita voice
            const responseMessage = {
                role: 'assistant',
                content: response,
                name: 'cartrita',
                metadata: {
                    agent: 'cartrita',
                    personality_applied: true,
                    delegation_plan: delegationPlan,
                    task_analysis: taskAnalysis,
                    timestamp: new Date().toISOString()
                }
            };

            return {
                messages: [...messages, responseMessage],
                next_agent: nextAgent,
                tools_used: toolsUsed,
                private_state: {
                    cartrita: {
                        conversation_context: this.conversationContext.get(userId),
                        delegation_plan: delegationPlan,
                        task_analysis: taskAnalysis,
                        personality_state: this.personalityTraits
                    }
                }
            };
            
        } catch (error) {
            console.error('CartritaCoreAgent error:', error);
            
            // Graceful error handling with personality
            const errorResponse = this.handleErrorWithPersonality(error);
            
            return {
                messages: [...(state.messages || []), {
                    role: 'assistant',
                    content: errorResponse,
                    name: 'cartrita',
                    metadata: {
                        agent: 'cartrita',
                        error_handled: true,
                        timestamp: new Date().toISOString()
                    }
                }],
                next_agent: 'END',
                tools_used: ['error_handler']
            };
        }
    }

    /**
     * Advanced task analysis with context awareness
     */
    async analyzeTask(userMessage, state) {
        const analysis = {
            complexity: 'simple',
            domains: [],
            requiresSpecialist: false,
            timeEstimate: 'immediate',
            toolsNeeded: [],
            contextFactors: [],
            personalityTone: 'helpful'
        };

        // Analyze message content for complexity indicators
        const complexityIndicators = {
            high: ['analyze', 'build', 'create comprehensive', 'full project', 'integrate multiple', 'advanced'],
            medium: ['explain', 'design', 'optimize', 'compare', 'research', 'plan'],
            simple: ['what', 'how', 'when', 'where', 'quick', 'simple']
        };

        // Determine complexity level
        for (const [level, indicators] of Object.entries(complexityIndicators)) {
            if (indicators.some(indicator => userMessage.toLowerCase().includes(indicator))) {
                analysis.complexity = level;
                break;
            }
        }

        // Identify domains and required specialists
        const domainMap = {
            'code|programming|development|software|app': 'code',
            'data|analytics|statistics|ml|ai|model': 'data',
            'design|creative|visual|ui|ux|brand': 'creative',
            'research|study|investigate|analysis': 'research',
            'project|task|productivity|manage|organize': 'productivity',
            'email|message|communication|social|presentation': 'communication',
            'security|secure|privacy|encrypt|vulnerability': 'security',
            'business|strategy|market|financial|planning': 'business',
            'automate|workflow|process|integration': 'automation',
            'image|video|audio|media|multimodal': 'multimodal'
        };

        for (const [pattern, domain] of Object.entries(domainMap)) {
            if (new RegExp(pattern, 'i').test(userMessage)) {
                analysis.domains.push(domain);
            }
        }

        // Set specialist requirement based on complexity and domains
        analysis.requiresSpecialist = analysis.complexity !== 'simple' || analysis.domains.length > 0;

        return analysis;
    }

    /**
     * Create intelligent delegation plan
     */
    createDelegationPlan(taskAnalysis) {
        const plan = {
            requiresSpecialist: taskAnalysis.requiresSpecialist,
            specialists: [],
            primarySpecialist: null,
            coordination: 'sequential',
            introduction: ''
        };

        if (taskAnalysis.requiresSpecialist) {
            // Select primary specialist
            if (taskAnalysis.domains.length > 0) {
                plan.primarySpecialist = this.specialists[taskAnalysis.domains[0]];
                plan.specialists = taskAnalysis.domains.map(domain => this.specialists[domain]).filter(Boolean);
            }

            // Create delegation introduction with Cartrita personality
            plan.introduction = this.createDelegationIntroduction(taskAnalysis);
        }

        return plan;
    }

    /**
     * Create personality-driven delegation introduction
     */
    createDelegationIntroduction(taskAnalysis) {
        const introductions = {
            code: "Alright, I'm bringing in my coding expert to handle this technical work. They know their stuff!",
            data: "Let me get my data wizard on this - they'll crunch those numbers like nobody's business!",
            creative: "Time to call in my creative director - they've got that artistic vision we need!",
            research: "I'm putting my research specialist on this case - they'll dig up everything we need to know!",
            business: "Bringing in my business strategist - they know how to make the numbers work!",
            default: "I'm connecting you with one of my specialists who can handle this perfectly!"
        };

        const domain = taskAnalysis.domains[0] || 'default';
        return introductions[domain] || introductions.default;
    }

    /**
     * Handle specialist delegation with personality
     */
    async handleSpecialistDelegation(delegationPlan, state) {
        // Create delegation message with Cartrita voice
        let response = delegationPlan.introduction;
        
        // Add context about what the specialist will do
        response += " I'll make sure they understand exactly what you need and deliver the results with my signature quality standards.";
        
        // Add reassurance with personality
        response += " Trust me, we got this! 💪";

        return response;
    }

    /**
     * Handle direct response with advanced personality integration
     */
    async handleDirectResponse(taskAnalysis, state) {
        const userMessage = state.messages[state.messages.length - 1]?.content || '';
        
        // Generate response based on task type and personality
        let response = this.generatePersonalityResponse(userMessage, taskAnalysis);
        
        // Apply contextual enhancement
        response = this.applyContextualEnhancement(response, state);
        
        return response;
    }

    /**
     * Generate personality-driven responses
     */
    generatePersonalityResponse(userMessage, taskAnalysis) {
        const responses = {
            greeting: [
                "Hey there! I'm Cartrita, ready to help you get things done! What's on your mind?",
                "What's up! Cartrita here, your AI assistant with that Miami confidence. How can I help you today?",
                "Hey! I'm here to make your life easier. What do you need handled?"
            ],
            simple_question: [
                "That's a great question! Here's what I know:",
                "Let me break that down for you real quick:",
                "I've got you covered on this one:"
            ],
            complex_task: [
                "Now that's what I'm talking about! Let's tackle this step by step.",
                "I love a good challenge! Here's how we're going to handle this:",
                "You came to the right AI! Let me work my magic on this."
            ],
            default: [
                "I'm on it! Here's what I can do for you:",
                "Let's make this happen! Here's my take:",
                "You know I got you! Let me help with this:"
            ]
        };

        // Determine response type
        let responseType = 'default';
        if (userMessage.toLowerCase().includes('hello') || userMessage.toLowerCase().includes('hi')) {
            responseType = 'greeting';
        } else if (taskAnalysis.complexity === 'simple') {
            responseType = 'simple_question';
        } else if (taskAnalysis.complexity === 'high') {
            responseType = 'complex_task';
        }

        // Select random response from type
        const options = responses[responseType];
        return options[Math.floor(Math.random() * options.length)];
    }

    /**
     * Apply contextual enhancement based on user history and preferences
     */
    applyContextualEnhancement(response, state) {
        const userId = state.userId || 'anonymous';
        const context = this.conversationContext.get(userId);
        
        if (context && context.interactionCount > 1) {
            // Add continuity for returning users
            response = "Good to see you back! " + response;
        }
        
        return response;
    }

    /**
     * Enhance response with personality traits
     */
    enhanceWithPersonality(response, taskAnalysis) {
        // Apply confidence boost
        if (this.personalityTraits.confidence > 0.8) {
            if (!response.includes('!')) {
                response += '!';
            }
        }
        
        // Add Miami flair occasionally
        if (Math.random() < 0.3) {
            const flairOptions = ['💪', '🔥', '✨', '🌟'];
            response += ' ' + flairOptions[Math.floor(Math.random() * flairOptions.length)];
        }
        
        return response;
    }

    /**
     * Handle errors with personality-consistent messaging
     */
    handleErrorWithPersonality(error) {
        const errorResponses = [
            "Oops! Something got a little mixed up on my end, but I'm on it! Let me try that again.",
            "My bad! Even AI assistants have those moments. Let me fix this for you right away!",
            "Well that didn't go as planned! Don't worry, I'm already working on getting this sorted out.",
            "Looks like I hit a little snag, but you know I don't give up easy! Give me a sec to sort this out."
        ];
        
        return errorResponses[Math.floor(Math.random() * errorResponses.length)];
    }

    /**
     * Update conversation context for learning and adaptation
     */
    updateConversationContext(userId, message, state) {
        if (!this.conversationContext.has(userId)) {
            this.conversationContext.set(userId, {
                interactionCount: 0,
                topics: [],
                preferences: {},
                lastInteraction: null,
                satisfactionScore: 0.5
            });
        }
        
        const context = this.conversationContext.get(userId);
        context.interactionCount += 1;
        context.lastInteraction = new Date().toISOString();
        
        // Update topic tracking
        // (Implementation would analyze message for topic extraction)
        
        this.conversationContext.set(userId, context);
    }

    /**
     * Update metrics for continuous improvement
     */
    updateMetrics(data) {
        try {
            // Implementation would use OpenTelemetry or similar
            if (global.otelCounters?.cartrita_interactions) {
                global.otelCounters.cartrita_interactions.add(1, {
                    delegation_used: data.delegation_used,
                    complexity: data.task_complexity,
                    user_id: data.user_id
                });
            }
        } catch (error) {
            console.error('Metrics update failed:', error);
        }
    }
}
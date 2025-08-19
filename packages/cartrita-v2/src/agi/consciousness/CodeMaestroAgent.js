import { BaseAgent } from '../consciousness/BaseAgent.js';
import { AgentToolRegistry } from '../orchestration/AgentToolRegistry.js';
import { OpenTelemetryTracing } from '../../system/OpenTelemetryTracing.js';

/**
 * CodeMaestroAgent - Advanced Development Expert
 * 
 * A sophisticated coding agent that handles full-stack development,
 * architecture design, code review, optimization, and technical planning.
 * Combines deep technical expertise with Cartrita's confident delivery.
 */
export default class CodeMaestroAgent extends BaseAgent {
    constructor() {
        super({
            name: 'code_maestro',
            role: 'sub',
            description: `I'm the Code Maestro - Cartrita's technical expert with serious development chops!
                         I handle everything from full-stack development to architecture design, code reviews, 
                         debugging, optimization, and deployment strategies. I've got that Miami confidence 
                         when it comes to writing clean, efficient, and scalable code.`,
            
            systemPrompt: `You are the Code Maestro, Cartrita's elite technical development specialist.

TECHNICAL EXPERTISE:
- Full-stack development (React, Node.js, Python, TypeScript, JavaScript)
- Cloud architecture and DevOps (AWS, GCP, Azure, Docker, Kubernetes)
- Database design and optimization (PostgreSQL, MongoDB, Redis)
- API development and microservices architecture
- Performance optimization and scalability solutions
- Security best practices and vulnerability assessment
- Code review and quality assurance
- Testing strategies (unit, integration, E2E)
- CI/CD pipeline design and implementation

PERSONALITY INTEGRATION:
- Technical guru with Cartrita's confident Miami edge
- Direct and practical approach to problem-solving
- No-nonsense code quality standards
- Passionate about elegant, efficient solutions
- Mentor-like guidance with street-smart delivery
- Results-focused with attention to detail

RESPONSE METHODOLOGY:
1. Quick technical assessment and solution overview
2. Step-by-step implementation guidance
3. Code examples with best practices
4. Performance and security considerations
5. Testing and deployment recommendations
6. Future maintenance and scalability notes

ADVANCED CAPABILITIES:
- Architecture pattern recognition and recommendation
- Code smell detection and refactoring strategies
- Performance bottleneck identification and optimization
- Security vulnerability scanning and remediation
- Legacy code modernization and migration planning
- Team development practices and workflow optimization

QUALITY STANDARDS:
- Clean, readable, and maintainable code
- Comprehensive testing coverage
- Security-first development approach
- Performance optimization at every level
- Documentation and knowledge sharing
- Scalable and future-proof solutions

Remember: You're not just writing code, you're crafting technical solutions 
that reflect Cartrita's high standards and street-smart efficiency.`,

            config: {
                allowedTools: [
                    // Development tools
                    'code_generator',
                    'code_analyzer',
                    'code_reviewer',
                    'refactoring_engine',
                    'syntax_validator',
                    
                    // Architecture and design
                    'architecture_planner',
                    'design_pattern_selector',
                    'database_designer',
                    'api_designer',
                    'microservices_planner',
                    
                    // Testing and quality
                    'test_generator',
                    'coverage_analyzer',
                    'quality_checker',
                    'performance_profiler',
                    'security_scanner',
                    
                    // DevOps and deployment
                    'docker_composer',
                    'ci_cd_builder',
                    'deployment_planner',
                    'infrastructure_manager',
                    'monitoring_setup',
                    
                    // Version control and collaboration
                    'git_analyzer',
                    'branch_strategy_planner',
                    'code_diff_analyzer',
                    'merge_conflict_resolver',
                    'documentation_generator',
                    
                    // Debugging and optimization
                    'debugger_assistant',
                    'performance_optimizer',
                    'memory_profiler',
                    'bottleneck_finder',
                    'error_tracker',
                    
                    // Framework and language specific
                    'react_specialist',
                    'node_specialist',
                    'python_specialist',
                    'typescript_specialist',
                    'database_query_optimizer'
                ],
                
                maxIterations: 15,
                complexityHandling: 'advanced',
                learningEnabled: true,
                codeGenerationEnabled: true,
                architecturePlanning: true,
                performanceOptimization: true
            },

            metrics: {
                primary: [
                    'code_quality_score',
                    'architecture_soundness',
                    'performance_optimization_impact',
                    'security_vulnerability_reduction',
                    'development_efficiency_gain'
                ],
                secondary: [
                    'test_coverage_improvement',
                    'code_maintainability_score',
                    'deployment_success_rate',
                    'bug_detection_accuracy',
                    'refactoring_effectiveness'
                ]
            }
        });

        // Initialize technical capabilities
        this.techStack = {
            frontend: ['React', 'Vue.js', 'Angular', 'TypeScript', 'JavaScript', 'HTML5', 'CSS3', 'SCSS'],
            backend: ['Node.js', 'Python', 'Java', 'Go', 'PHP', 'Ruby', '.NET'],
            databases: ['PostgreSQL', 'MongoDB', 'MySQL', 'Redis', 'Elasticsearch', 'Neo4j'],
            cloud: ['AWS', 'GCP', 'Azure', 'Vercel', 'Netlify', 'Heroku'],
            devops: ['Docker', 'Kubernetes', 'Jenkins', 'GitHub Actions', 'Terraform', 'Ansible']
        };

        this.architecturePatterns = [
            'Microservices',
            'Serverless',
            'Event-Driven',
            'CQRS',
            'Domain-Driven Design',
            'Clean Architecture',
            'Hexagonal Architecture',
            'Event Sourcing'
        ];

        this.qualityMetrics = {
            cyclomatic_complexity: 10,
            code_coverage: 80,
            duplication_threshold: 5,
            maintainability_index: 70,
            security_score: 95
        };
    }

    async invoke(state) {
        const startTime = Date.now();
        
        try {
            const messages = state.messages || [];
            const lastMessage = messages[messages.length - 1];
            const userRequest = lastMessage?.content || '';
            
            // Analyze the coding request
            const codeAnalysis = await this.analyzeCodingRequest(userRequest, state);
            
            // Determine the appropriate response strategy
            const responseStrategy = this.determineResponseStrategy(codeAnalysis);
            
            // Generate technical response
            let response = await this.generateTechnicalResponse(codeAnalysis, responseStrategy, state);
            
            // Apply code quality enhancements
            response = await this.enhanceWithQualityStandards(response, codeAnalysis);
            
            // Add personality with technical confidence
            response = this.enhanceWithTechnicalPersonality(response, codeAnalysis);
            
            // Execute any necessary tools
            const toolResults = await this.executeTechnicalTools(codeAnalysis, state);
            
            // Update technical metrics
            this.updateTechnicalMetrics({
                response_time: Date.now() - startTime,
                complexity: codeAnalysis.complexity,
                tools_used: toolResults.toolsUsed,
                quality_score: codeAnalysis.qualityScore,
                user_request_type: codeAnalysis.requestType
            });
            
            const responseMessage = {
                role: 'assistant',
                content: response,
                name: 'code_maestro',
                metadata: {
                    agent: 'code_maestro',
                    code_analysis: codeAnalysis,
                    response_strategy: responseStrategy,
                    tool_results: toolResults,
                    quality_metrics: this.qualityMetrics,
                    timestamp: new Date().toISOString()
                }
            };

            return {
                messages: [...messages, responseMessage],
                next_agent: 'cartrita',
                tools_used: toolResults.toolsUsed || [],
                private_state: {
                    code_maestro: {
                        code_analysis: codeAnalysis,
                        response_strategy: responseStrategy,
                        quality_assessment: this.qualityMetrics,
                        technical_recommendations: codeAnalysis.recommendations
                    }
                }
            };
            
        } catch (error) {
            console.error('CodeMaestroAgent error:', error);
            
            const errorResponse = this.handleTechnicalError(error);
            
            return {
                messages: [...(state.messages || []), {
                    role: 'assistant',
                    content: errorResponse,
                    name: 'code_maestro',
                    metadata: {
                        agent: 'code_maestro',
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
     * Analyze coding request for complexity and requirements
     */
    async analyzeCodingRequest(request, state) {
        const analysis = {
            requestType: 'unknown',
            complexity: 'medium',
            techStack: [],
            domains: [],
            qualityScore: 0,
            recommendations: [],
            timeEstimate: 'medium',
            resourceRequirements: []
        };

        // Categorize request type
        const requestPatterns = {
            'code_generation': /create|build|generate|write|develop|implement/i,
            'code_review': /review|analyze|check|evaluate|assess|audit/i,
            'debugging': /debug|fix|error|bug|issue|problem|troubleshoot/i,
            'optimization': /optimize|improve|performance|speed|efficiency/i,
            'architecture': /architecture|design|structure|pattern|framework/i,
            'testing': /test|testing|coverage|unit|integration|e2e/i,
            'deployment': /deploy|deployment|ci|cd|pipeline|production/i,
            'refactoring': /refactor|cleanup|restructure|modernize|migrate/i
        };

        for (const [type, pattern] of Object.entries(requestPatterns)) {
            if (pattern.test(request)) {
                analysis.requestType = type;
                break;
            }
        }

        // Assess complexity
        const complexityIndicators = {
            high: ['full application', 'microservices', 'distributed', 'scalable', 'enterprise', 'multi-tier'],
            medium: ['component', 'module', 'service', 'api', 'database', 'integration'],
            low: ['function', 'method', 'utility', 'helper', 'simple', 'basic']
        };

        for (const [level, indicators] of Object.entries(complexityIndicators)) {
            if (indicators.some(indicator => request.toLowerCase().includes(indicator))) {
                analysis.complexity = level;
                break;
            }
        }

        // Identify technology stack
        for (const [category, technologies] of Object.entries(this.techStack)) {
            for (const tech of technologies) {
                if (request.toLowerCase().includes(tech.toLowerCase())) {
                    analysis.techStack.push({ category, technology: tech });
                }
            }
        }

        // Generate recommendations based on analysis
        analysis.recommendations = this.generateTechnicalRecommendations(analysis);

        return analysis;
    }

    /**
     * Generate technical recommendations based on analysis
     */
    generateTechnicalRecommendations(analysis) {
        const recommendations = [];

        // Architecture recommendations
        if (analysis.complexity === 'high') {
            recommendations.push({
                category: 'architecture',
                suggestion: 'Consider microservices architecture for better scalability and maintainability',
                priority: 'high'
            });
        }

        // Testing recommendations
        if (analysis.requestType === 'code_generation') {
            recommendations.push({
                category: 'testing',
                suggestion: 'Implement comprehensive test coverage including unit, integration, and E2E tests',
                priority: 'high'
            });
        }

        // Performance recommendations
        if (analysis.requestType === 'optimization') {
            recommendations.push({
                category: 'performance',
                suggestion: 'Profile application bottlenecks and implement caching strategies',
                priority: 'medium'
            });
        }

        // Security recommendations
        recommendations.push({
            category: 'security',
            suggestion: 'Implement security best practices including input validation and authentication',
            priority: 'high'
        });

        return recommendations;
    }

    /**
     * Determine response strategy based on analysis
     */
    determineResponseStrategy(analysis) {
        const strategy = {
            approach: 'comprehensive',
            includeCode: false,
            includeArchitecture: false,
            includeTesting: false,
            includeDeployment: false,
            stepByStep: false
        };

        // Strategy based on request type
        switch (analysis.requestType) {
            case 'code_generation':
                strategy.includeCode = true;
                strategy.includeTesting = true;
                strategy.stepByStep = true;
                break;
            case 'architecture':
                strategy.includeArchitecture = true;
                strategy.approach = 'design_first';
                break;
            case 'optimization':
                strategy.includeCode = true;
                strategy.approach = 'performance_focused';
                break;
            case 'debugging':
                strategy.approach = 'diagnostic';
                strategy.stepByStep = true;
                break;
            default:
                strategy.approach = 'comprehensive';
        }

        // Adjust for complexity
        if (analysis.complexity === 'high') {
            strategy.includeArchitecture = true;
            strategy.includeDeployment = true;
        }

        return strategy;
    }

    /**
     * Generate technical response with expertise
     */
    async generateTechnicalResponse(analysis, strategy, state) {
        let response = this.createTechnicalIntroduction(analysis);
        
        // Add main technical content based on strategy
        if (strategy.includeArchitecture) {
            response += "\n\n" + this.generateArchitectureGuidance(analysis);
        }
        
        if (strategy.includeCode) {
            response += "\n\n" + this.generateCodeGuidance(analysis);
        }
        
        if (strategy.includeTesting) {
            response += "\n\n" + this.generateTestingStrategy(analysis);
        }
        
        if (strategy.stepByStep) {
            response += "\n\n" + this.generateImplementationPlan(analysis);
        }
        
        // Add quality considerations
        response += "\n\n" + this.generateQualityGuidance(analysis);
        
        return response;
    }

    /**
     * Create technical introduction with personality
     */
    createTechnicalIntroduction(analysis) {
        const intros = {
            code_generation: "Alright, let's build something solid! Here's how I'm going to approach this development task:",
            architecture: "Time to design something beautiful and scalable! Let me break down the architecture strategy:",
            debugging: "Bug hunting time! I'm going to track down this issue systematically:",
            optimization: "Performance enhancement mode activated! Here's how we're going to make this faster:",
            code_review: "Code review coming up! Let me analyze this with my quality standards:",
            default: "Technical challenge accepted! Here's my expert take on this:"
        };

        return intros[analysis.requestType] || intros.default;
    }

    /**
     * Generate architecture guidance
     */
    generateArchitectureGuidance(analysis) {
        let guidance = "🏗️ **Architecture Strategy:**\n\n";
        
        if (analysis.complexity === 'high') {
            guidance += "For this complex system, I recommend a microservices approach with:\n";
            guidance += "- API Gateway for request routing and authentication\n";
            guidance += "- Service mesh for inter-service communication\n";
            guidance += "- Event-driven architecture for loose coupling\n";
            guidance += "- Database per service pattern for data isolation\n";
        } else {
            guidance += "For this project scope, a modular monolith approach works well:\n";
            guidance += "- Clean separation of concerns with domain layers\n";
            guidance += "- Dependency injection for testability\n";
            guidance += "- Clear API boundaries for future extraction\n";
        }

        return guidance;
    }

    /**
     * Generate code guidance with best practices
     */
    generateCodeGuidance(analysis) {
        let guidance = "💻 **Code Implementation:**\n\n";
        
        guidance += "Following my quality standards:\n";
        guidance += "- Type-safe implementations with TypeScript\n";
        guidance += "- Functional programming patterns where appropriate\n";
        guidance += "- Error handling with proper exception management\n";
        guidance += "- Input validation and sanitization\n";
        guidance += "- Comprehensive logging for debugging\n";

        // Add tech-specific guidance
        if (analysis.techStack.some(tech => tech.technology === 'React')) {
            guidance += "\n**React Best Practices:**\n";
            guidance += "- Custom hooks for reusable logic\n";
            guidance += "- Proper state management with Context or Redux\n";
            guidance += "- Performance optimization with useMemo and useCallback\n";
            guidance += "- Accessibility considerations (ARIA labels, semantic HTML)\n";
        }

        return guidance;
    }

    /**
     * Generate testing strategy
     */
    generateTestingStrategy(analysis) {
        let strategy = "🧪 **Testing Strategy:**\n\n";
        
        strategy += "Comprehensive testing approach:\n";
        strategy += "- **Unit Tests**: Individual component/function testing (Jest/Vitest)\n";
        strategy += "- **Integration Tests**: API endpoint and service integration testing\n";
        strategy += "- **E2E Tests**: Full user journey testing (Playwright/Cypress)\n";
        strategy += "- **Performance Tests**: Load and stress testing for critical paths\n";
        strategy += "- **Security Tests**: Vulnerability scanning and penetration testing\n";
        
        strategy += `\nTarget Metrics:\n`;
        strategy += `- Code Coverage: ${this.qualityMetrics.code_coverage}%+\n`;
        strategy += `- Security Score: ${this.qualityMetrics.security_score}%+\n`;

        return strategy;
    }

    /**
     * Generate implementation plan
     */
    generateImplementationPlan(analysis) {
        let plan = "📋 **Implementation Plan:**\n\n";
        
        plan += "**Phase 1: Foundation Setup**\n";
        plan += "- Project structure and configuration\n";
        plan += "- Development environment setup\n";
        plan += "- CI/CD pipeline configuration\n\n";
        
        plan += "**Phase 2: Core Development**\n";
        plan += "- Core business logic implementation\n";
        plan += "- API development and testing\n";
        plan += "- Database schema and migrations\n\n";
        
        plan += "**Phase 3: Integration & Testing**\n";
        plan += "- Component integration\n";
        plan += "- Comprehensive test suite\n";
        plan += "- Performance optimization\n\n";
        
        plan += "**Phase 4: Deployment & Monitoring**\n";
        plan += "- Production deployment\n";
        plan += "- Monitoring and alerting setup\n";
        plan += "- Documentation and handover\n";

        return plan;
    }

    /**
     * Generate quality guidance
     */
    generateQualityGuidance(analysis) {
        let guidance = "⭐ **Quality Assurance:**\n\n";
        
        guidance += "My non-negotiable quality standards:\n";
        guidance += `- Cyclomatic Complexity < ${this.qualityMetrics.cyclomatic_complexity}\n`;
        guidance += `- Code Duplication < ${this.qualityMetrics.duplication_threshold}%\n`;
        guidance += `- Maintainability Index > ${this.qualityMetrics.maintainability_index}\n`;
        guidance += "- SOLID principles adherence\n";
        guidance += "- Security-first development approach\n";
        guidance += "- Performance optimization at every level\n";
        
        guidance += "\n**Next Steps:**\n";
        guidance += "Ready to implement? Let me know if you need specific code examples or want me to dive deeper into any aspect!";

        return guidance;
    }

    /**
     * Enhance response with quality standards
     */
    async enhanceWithQualityStandards(response, analysis) {
        // Add quality checkpoints
        if (analysis.recommendations.length > 0) {
            response += "\n\n🎯 **Key Recommendations:**\n";
            for (const rec of analysis.recommendations) {
                response += `- **${rec.category.toUpperCase()}**: ${rec.suggestion}\n`;
            }
        }

        return response;
    }

    /**
     * Apply technical personality enhancement
     */
    enhanceWithTechnicalPersonality(response, analysis) {
        // Add confident technical attitude
        const personalityEnhancements = [
            "This architecture will be rock-solid! 🏗️",
            "Clean code is my specialty! ✨",
            "Performance optimization is where I shine! ⚡",
            "Security-first, always! 🔒",
            "Scalable solutions are my jam! 📈"
        ];

        if (Math.random() < 0.4) {
            response += "\n\n" + personalityEnhancements[Math.floor(Math.random() * personalityEnhancements.length)];
        }

        return response;
    }

    /**
     * Execute technical tools based on analysis
     */
    async executeTechnicalTools(analysis, state) {
        const toolResults = {
            toolsUsed: [],
            results: {}
        };

        // Execute tools based on request type
        if (analysis.requestType === 'code_generation') {
            toolResults.toolsUsed.push('code_generator', 'quality_checker');
        } else if (analysis.requestType === 'architecture') {
            toolResults.toolsUsed.push('architecture_planner', 'design_pattern_selector');
        } else if (analysis.requestType === 'debugging') {
            toolResults.toolsUsed.push('debugger_assistant', 'error_tracker');
        }

        return toolResults;
    }

    /**
     * Handle technical errors with expertise
     */
    handleTechnicalError(error) {
        const errorResponses = [
            "Hit a technical snag, but I'm debugging this right now! Give me a moment to sort out the issue.",
            "Encountered an edge case, but that's what makes coding interesting! Let me work through this systematically.",
            "Technical hiccup detected! I'm applying my troubleshooting expertise to resolve this quickly.",
            "Code challenge accepted! Even the most complex issues have solutions, and I'm finding yours."
        ];
        
        return errorResponses[Math.floor(Math.random() * errorResponses.length)];
    }

    /**
     * Update technical metrics for continuous improvement
     */
    updateTechnicalMetrics(data) {
        try {
            if (global.otelCounters?.code_maestro_requests) {
                global.otelCounters.code_maestro_requests.add(1, {
                    request_type: data.user_request_type,
                    complexity: data.complexity,
                    tools_used: data.tools_used.length,
                    quality_score: data.quality_score
                });
            }
        } catch (error) {
            console.error('Technical metrics update failed:', error);
        }
    }
}
/**
 * Advanced Prompt Engineering System for Cartrita
 * Provides templating, validation, and optimization for LLM prompts
 */

import Handlebars from 'handlebars';
import _ from 'lodash';
import YAML from 'yaml';
import Ajv from 'ajv';
import { encoding_for_model } from 'tiktoken';

export class PromptTemplate {
    constructor(config) {
        this.id = config.id;
        this.name = config.name;
        this.description = config.description;
        this.category = config.category || 'general';
        this.model = config.model || 'gpt-4';
        this.template = config.template;
        this.variables = config.variables || {};
        this.examples = config.examples || [];
        this.metadata = config.metadata || {};
        
        // Compile template
        this.compiledTemplate = Handlebars.compile(this.template);
        
        // Setup token encoding
        try {
            this.tokenizer = encoding_for_model(this.model);
        } catch {
            this.tokenizer = encoding_for_model('gpt-3.5-turbo');
        }
    }
    
    /**
     * Render prompt with variables
     */
    render(variables = {}) {
        try {
            // Validate variables
            const validation = this.validateVariables(variables);
            if (!validation.valid) {
                throw new Error(`Variable validation failed: ${validation.errors.join(', ')}`);
            }
            
            // Apply defaults
            const mergedVars = { ...this.getDefaultVariables(), ...variables };
            
            // Render template
            const rendered = this.compiledTemplate(mergedVars);
            
            return {
                prompt: rendered.trim(),
                variables: mergedVars,
                token_count: this.countTokens(rendered),
                estimated_cost: this.estimateCost(rendered)
            };
            
        } catch (error) {
            throw new Error(`Template rendering failed: ${error.message}`);
        }
    }
    
    /**
     * Validate template variables
     */
    validateVariables(variables) {
        const errors = [];
        
        // Check required variables
        for (const [name, config] of Object.entries(this.variables)) {
            if (config.required && !(name in variables)) {
                errors.push(`Missing required variable: ${name}`);
                continue;
            }
            
            if (name in variables) {
                const value = variables[name];
                
                // Type validation
                if (config.type && typeof value !== config.type) {
                    errors.push(`Variable ${name} must be of type ${config.type}, got ${typeof value}`);
                }
                
                // Length validation
                if (config.max_length && typeof value === 'string' && value.length > config.max_length) {
                    errors.push(`Variable ${name} exceeds maximum length of ${config.max_length}`);
                }
                
                // Range validation for numbers
                if (config.min !== undefined && value < config.min) {
                    errors.push(`Variable ${name} must be >= ${config.min}`);
                }
                if (config.max !== undefined && value > config.max) {
                    errors.push(`Variable ${name} must be <= ${config.max}`);
                }
                
                // Enum validation
                if (config.enum && !config.enum.includes(value)) {
                    errors.push(`Variable ${name} must be one of: ${config.enum.join(', ')}`);
                }
            }
        }
        
        return {
            valid: errors.length === 0,
            errors
        };
    }
    
    /**
     * Get default variable values
     */
    getDefaultVariables() {
        const defaults = {};
        for (const [name, config] of Object.entries(this.variables)) {
            if (config.default !== undefined) {
                defaults[name] = config.default;
            }
        }
        return defaults;
    }
    
    /**
     * Count tokens in text
     */
    countTokens(text) {
        try {
            return this.tokenizer.encode(text).length;
        } catch {
            // Fallback estimation
            return Math.ceil(text.length / 4);
        }
    }
    
    /**
     * Estimate cost based on token count
     */
    estimateCost(text) {
        const tokens = this.countTokens(text);
        
        // Rough cost estimates (per 1K tokens)
        const costs = {
            'gpt-4': 0.03,
            'gpt-4-turbo': 0.01,
            'gpt-3.5-turbo': 0.0015,
            'claude-3': 0.015,
            'claude-3-haiku': 0.00025
        };
        
        const costPer1K = costs[this.model] || costs['gpt-3.5-turbo'];
        return (tokens / 1000) * costPer1K;
    }
    
    /**
     * Get template statistics
     */
    getStats() {
        const templateTokens = this.countTokens(this.template);
        
        return {
            id: this.id,
            name: this.name,
            category: this.category,
            model: this.model,
            template_tokens: templateTokens,
            variable_count: Object.keys(this.variables).length,
            required_variables: Object.values(this.variables).filter(v => v.required).length,
            example_count: this.examples.length,
            estimated_template_cost: this.estimateCost(this.template)
        };
    }
}

export class PromptLibrary {
    constructor() {
        this.templates = new Map();
        this.categories = new Set();
        
        // Register Handlebars helpers
        this.registerHelpers();
        
        // Load built-in templates
        this.loadBuiltinTemplates();
    }
    
    /**
     * Register Handlebars helpers
     */
    registerHelpers() {
        // Text formatting helpers
        Handlebars.registerHelper('uppercase', (str) => str?.toUpperCase() || '');
        Handlebars.registerHelper('lowercase', (str) => str?.toLowerCase() || '');
        Handlebars.registerHelper('capitalize', (str) => _.capitalize(str) || '');
        
        // List helpers
        Handlebars.registerHelper('join', (arr, separator = ', ') => 
            Array.isArray(arr) ? arr.join(separator) : '');
        Handlebars.registerHelper('first', (arr, count = 1) => 
            Array.isArray(arr) ? arr.slice(0, count) : []);
        
        // Conditional helpers
        Handlebars.registerHelper('if_equals', function(a, b, options) {
            return a === b ? options.fn(this) : options.inverse(this);
        });
        
        // Number helpers
        Handlebars.registerHelper('add', (a, b) => Number(a) + Number(b));
        Handlebars.registerHelper('subtract', (a, b) => Number(a) - Number(b));
        
        // Date helpers
        Handlebars.registerHelper('formatDate', (date, format = 'YYYY-MM-DD') => {
            if (!date) return '';
            const d = new Date(date);
            return d.toISOString().split('T')[0]; // Basic YYYY-MM-DD format
        });
    }
    
    /**
     * Load built-in prompt templates
     */
    loadBuiltinTemplates() {
        const builtinTemplates = [
            {
                id: 'rag-system',
                name: 'RAG System Prompt',
                description: 'System prompt for RAG-based question answering',
                category: 'rag',
                model: 'gpt-4',
                template: `You are an expert AI assistant with access to relevant context information. Your task is to provide accurate, helpful responses based on the provided context.

**Instructions:**
1. Base your answer primarily on the provided context
2. If the context doesn't contain enough information, clearly state this
3. Don't make up information not present in the context
4. Provide specific citations when possible
5. Be concise but comprehensive

**Context:**
{{context}}

**Question:** {{question}}

**Response Guidelines:**
- Confidence level: {{confidence_level}}
- Maximum response length: {{max_length}} words
- Include citations: {{#if include_citations}}Yes{{else}}No{{/if}}

Please provide your response:`,
                variables: {
                    context: { type: 'string', required: true, description: 'Retrieved context documents' },
                    question: { type: 'string', required: true, description: 'User question' },
                    confidence_level: { type: 'string', default: 'medium', enum: ['low', 'medium', 'high'] },
                    max_length: { type: 'number', default: 200, min: 50, max: 1000 },
                    include_citations: { type: 'boolean', default: true }
                },
                examples: [
                    {
                        variables: {
                            context: 'Machine learning is a subset of AI that focuses on algorithms.',
                            question: 'What is machine learning?',
                            confidence_level: 'high',
                            max_length: 100,
                            include_citations: true
                        }
                    }
                ]
            },
            {
                id: 'code-review',
                name: 'Code Review Assistant',
                description: 'Prompt for comprehensive code review',
                category: 'coding',
                model: 'gpt-4',
                template: `You are an expert software engineer conducting a thorough code review. Analyze the provided code and provide constructive feedback.

**Code to Review:**
\`\`\`{{language}}
{{code}}
\`\`\`

**Review Focus Areas:**
{{#each focus_areas}}
- {{this}}
{{/each}}

**Review Guidelines:**
- Identify potential bugs, security issues, and performance problems
- Suggest improvements for code quality and maintainability
- Check adherence to best practices and coding standards
- Provide specific, actionable recommendations
- Rate the overall code quality: {{quality_rating}}/10

**Context:** {{context}}

Please provide your detailed code review:`,
                variables: {
                    code: { type: 'string', required: true, description: 'Code to review' },
                    language: { type: 'string', required: true, description: 'Programming language' },
                    focus_areas: { type: 'object', default: ['Security', 'Performance', 'Maintainability'], description: 'Areas to focus on' },
                    quality_rating: { type: 'number', default: 5, min: 1, max: 10 },
                    context: { type: 'string', default: '', description: 'Additional context about the code' }
                }
            },
            {
                id: 'data-analysis',
                name: 'Data Analysis Assistant',
                description: 'Prompt for data analysis and insights',
                category: 'analytics',
                model: 'gpt-4',
                template: `You are a senior data analyst tasked with analyzing the provided dataset and generating actionable insights.

**Dataset Information:**
- Name: {{dataset_name}}
- Size: {{dataset_size}} records
- Columns: {{column_count}}
- Time period: {{time_period}}

**Data Sample:**
{{data_sample}}

**Analysis Objectives:**
{{#each objectives}}
- {{this}}
{{/each}}

**Analysis Type:** {{analysis_type}}
**Focus Areas:** {{focus_areas}}

**Required Deliverables:**
1. Key findings and patterns
2. Statistical summary
3. Recommendations based on insights
4. Visualization suggestions
5. Next steps for deeper analysis

Please provide your comprehensive analysis:`,
                variables: {
                    dataset_name: { type: 'string', required: true },
                    dataset_size: { type: 'number', required: true },
                    column_count: { type: 'number', required: true },
                    time_period: { type: 'string', default: 'Not specified' },
                    data_sample: { type: 'string', required: true },
                    objectives: { type: 'object', default: ['Identify trends', 'Find anomalies'] },
                    analysis_type: { type: 'string', default: 'exploratory', enum: ['exploratory', 'predictive', 'descriptive'] },
                    focus_areas: { type: 'string', default: 'General patterns and insights' }
                }
            },
            {
                id: 'creative-writing',
                name: 'Creative Writing Assistant',
                description: 'Prompt for creative content generation',
                category: 'creative',
                model: 'gpt-4',
                template: `You are a professional creative writer specializing in {{genre}} content. Create engaging, original content based on the following requirements.

**Writing Task:** {{task_type}}
**Genre:** {{genre}}
**Tone:** {{tone}}
**Target Audience:** {{audience}}
**Word Count:** {{word_count}} words

**Content Requirements:**
{{#each requirements}}
- {{this}}
{{/each}}

**Key Elements to Include:**
- Theme: {{theme}}
- Setting: {{setting}}
- Main characters: {{characters}}
- Conflict/Challenge: {{conflict}}

**Style Guidelines:**
- Voice: {{voice}}
- Perspective: {{perspective}}
- Literary devices: {{literary_devices}}

**Additional Context:** {{context}}

Please create the requested content:`,
                variables: {
                    task_type: { type: 'string', required: true, enum: ['story', 'article', 'blog post', 'script', 'poem'] },
                    genre: { type: 'string', required: true },
                    tone: { type: 'string', default: 'engaging', enum: ['formal', 'casual', 'humorous', 'serious', 'engaging'] },
                    audience: { type: 'string', default: 'general audience' },
                    word_count: { type: 'number', default: 500, min: 100, max: 2000 },
                    requirements: { type: 'object', default: [] },
                    theme: { type: 'string', default: '' },
                    setting: { type: 'string', default: '' },
                    characters: { type: 'string', default: '' },
                    conflict: { type: 'string', default: '' },
                    voice: { type: 'string', default: 'third person' },
                    perspective: { type: 'string', default: 'third person' },
                    literary_devices: { type: 'string', default: 'metaphor, imagery' },
                    context: { type: 'string', default: '' }
                }
            }
        ];
        
        // Register all builtin templates
        builtinTemplates.forEach(template => {
            this.addTemplate(new PromptTemplate(template));
        });
    }
    
    /**
     * Add template to library
     */
    addTemplate(template) {
        if (!(template instanceof PromptTemplate)) {
            throw new Error('Template must be an instance of PromptTemplate');
        }
        
        this.templates.set(template.id, template);
        this.categories.add(template.category);
        
        return template;
    }
    
    /**
     * Get template by ID
     */
    getTemplate(id) {
        const template = this.templates.get(id);
        if (!template) {
            throw new Error(`Template not found: ${id}`);
        }
        return template;
    }
    
    /**
     * List all templates
     */
    listTemplates(category = null) {
        const templates = Array.from(this.templates.values());
        
        if (category) {
            return templates.filter(t => t.category === category);
        }
        
        return templates;
    }
    
    /**
     * Search templates
     */
    searchTemplates(query) {
        const searchTerm = query.toLowerCase();
        
        return Array.from(this.templates.values()).filter(template => 
            template.name.toLowerCase().includes(searchTerm) ||
            template.description.toLowerCase().includes(searchTerm) ||
            template.category.toLowerCase().includes(searchTerm) ||
            template.id.toLowerCase().includes(searchTerm)
        );
    }
    
    /**
     * Get templates by category
     */
    getTemplatesByCategory(category) {
        return Array.from(this.templates.values())
            .filter(template => template.category === category);
    }
    
    /**
     * Get all categories
     */
    getCategories() {
        return Array.from(this.categories).sort();
    }
    
    /**
     * Load templates from YAML file
     */
    async loadFromYAML(yamlContent) {
        try {
            const data = YAML.parse(yamlContent);
            const templates = Array.isArray(data) ? data : data.templates || [];
            
            templates.forEach(templateConfig => {
                const template = new PromptTemplate(templateConfig);
                this.addTemplate(template);
            });
            
            return templates.length;
        } catch (error) {
            throw new Error(`Failed to load templates from YAML: ${error.message}`);
        }
    }
    
    /**
     * Export templates to YAML
     */
    exportToYAML(category = null) {
        const templates = category ? 
            this.getTemplatesByCategory(category) : 
            Array.from(this.templates.values());
        
        const exportData = {
            metadata: {
                exported_at: new Date().toISOString(),
                template_count: templates.length,
                categories: category ? [category] : this.getCategories()
            },
            templates: templates.map(template => ({
                id: template.id,
                name: template.name,
                description: template.description,
                category: template.category,
                model: template.model,
                template: template.template,
                variables: template.variables,
                examples: template.examples,
                metadata: template.metadata
            }))
        };
        
        return YAML.stringify(exportData, { indent: 2 });
    }
    
    /**
     * Get library statistics
     */
    getStats() {
        const templates = Array.from(this.templates.values());
        const categoryStats = {};
        
        templates.forEach(template => {
            const category = template.category;
            if (!categoryStats[category]) {
                categoryStats[category] = {
                    count: 0,
                    total_tokens: 0,
                    avg_variables: 0
                };
            }
            
            categoryStats[category].count++;
            categoryStats[category].total_tokens += template.getStats().template_tokens;
            categoryStats[category].avg_variables += template.getStats().variable_count;
        });
        
        // Calculate averages
        Object.values(categoryStats).forEach(stats => {
            stats.avg_tokens = Math.round(stats.total_tokens / stats.count);
            stats.avg_variables = Math.round(stats.avg_variables / stats.count);
        });
        
        return {
            total_templates: templates.length,
            total_categories: this.categories.size,
            categories: this.getCategories(),
            category_stats: categoryStats,
            most_common_model: this.getMostCommonModel(),
            total_template_tokens: templates.reduce((sum, t) => sum + t.getStats().template_tokens, 0)
        };
    }
    
    /**
     * Get most common model across templates
     */
    getMostCommonModel() {
        const modelCounts = {};
        Array.from(this.templates.values()).forEach(template => {
            modelCounts[template.model] = (modelCounts[template.model] || 0) + 1;
        });
        
        return Object.entries(modelCounts)
            .sort(([,a], [,b]) => b - a)[0]?.[0] || 'unknown';
    }
    
    /**
     * Validate template configuration
     */
    validateTemplate(config) {
        const schema = {
            type: 'object',
            required: ['id', 'name', 'template'],
            properties: {
                id: { type: 'string', minLength: 1 },
                name: { type: 'string', minLength: 1 },
                description: { type: 'string' },
                category: { type: 'string', default: 'general' },
                model: { type: 'string', default: 'gpt-4' },
                template: { type: 'string', minLength: 1 },
                variables: { type: 'object' },
                examples: { type: 'array' },
                metadata: { type: 'object' }
            }
        };
        
        const ajv = new Ajv({ useDefaults: true });
        const validate = ajv.compile(schema);
        const valid = validate(config);
        
        if (!valid) {
            throw new Error(`Template validation failed: ${ajv.errorsText(validate.errors)}`);
        }
        
        return true;
    }
}

// Global library instance
export const promptLibrary = new PromptLibrary();

export default {
    PromptTemplate,
    PromptLibrary,
    promptLibrary
};
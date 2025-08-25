#!/usr/bin/env node

import { Pool } from 'pg';
import OpenAI from 'openai';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const pool = new Pool({
  user: process.env.POSTGRES_USER,
  host: 'localhost', // Connect to localhost, not 'db' container
  database: process.env.POSTGRES_DB,
  password: process.env.POSTGRES_PASSWORD,
  port: process.env.POSTGRES_PORT || 5432,
});

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Comprehensive workflow tools database
const workflowTools = [
  // OpenAI-Only Development Tools
  {
    title: 'Code Linter and Formatter',
    description:
      'Automatically lint and format code according to style guidelines using LLM analysis',
    category_id: 1,
    tool_type: 'dev',
    complexity_level: 'intermediate',
    use_case: 'Ensure consistent code quality and formatting across projects',
    prerequisites: ['Basic programming knowledge', 'Code to analyze'],
    technologies: ['OpenAI API', 'LangChain'],
    api_requirements: ['OpenAI API Key'],
    estimated_time: '5-10 minutes',
    difficulty_rating: 3,
    tags: ['code-quality', 'formatting', 'linting', 'automation'],
    is_white_hat: true,
    safety_notes: 'Only analyze code you own or have permission to review',
  },
  {
    title: 'Automated Code Commenter',
    description:
      'Generate comprehensive docstrings and inline comments for existing code',
    category_id: 1,
    tool_type: 'dev',
    complexity_level: 'beginner',
    use_case: 'Document legacy code or improve code readability',
    prerequisites: ['Code files to document'],
    technologies: ['OpenAI API', 'AST parsing'],
    api_requirements: ['OpenAI API Key'],
    estimated_time: '2-5 minutes per file',
    difficulty_rating: 2,
    tags: ['documentation', 'comments', 'code-analysis'],
    is_white_hat: true,
  },
  {
    title: 'Function Dependency Mapper',
    description: 'Extract and visualize function dependencies from codebase',
    category_id: 1,
    tool_type: 'dev',
    complexity_level: 'advanced',
    use_case:
      'Understand complex codebases and identify refactoring opportunities',
    prerequisites: ['Programming knowledge', 'Codebase access'],
    technologies: ['OpenAI API', 'Graph visualization'],
    api_requirements: ['OpenAI API Key'],
    estimated_time: '10-30 minutes',
    difficulty_rating: 4,
    tags: ['dependency-analysis', 'visualization', 'refactoring'],
    is_white_hat: true,
  },
  {
    title: 'Unit Test Generator',
    description:
      'Auto-generate comprehensive unit tests for functions and classes',
    category_id: 8,
    tool_type: 'testing',
    complexity_level: 'intermediate',
    use_case: 'Quickly create test coverage for existing code',
    prerequisites: ['Code to test', 'Testing framework knowledge'],
    technologies: ['OpenAI API', 'Testing frameworks'],
    api_requirements: ['OpenAI API Key'],
    estimated_time: '5-15 minutes',
    difficulty_rating: 3,
    tags: ['testing', 'unit-tests', 'automation', 'tdd'],
    is_white_hat: true,
  },
  {
    title: 'API Documentation Generator',
    description:
      'Generate OpenAPI/Swagger documentation from code or endpoints',
    category_id: 6,
    tool_type: 'documentation',
    complexity_level: 'intermediate',
    use_case: 'Create comprehensive API documentation automatically',
    prerequisites: ['API code or endpoint list'],
    technologies: ['OpenAI API', 'OpenAPI/Swagger'],
    api_requirements: ['OpenAI API Key'],
    estimated_time: '10-20 minutes',
    difficulty_rating: 3,
    tags: ['api', 'documentation', 'swagger', 'openapi'],
    is_white_hat: true,
  },

  // Security & Compliance Tools (White-hat)
  {
    title: 'Secret Scanner',
    description:
      'Scan codebase for hardcoded secrets, API keys, and credentials',
    category_id: 2,
    tool_type: 'security',
    complexity_level: 'beginner',
    use_case: 'Identify security vulnerabilities before deployment',
    prerequisites: ['Codebase access', 'Security awareness'],
    technologies: ['OpenAI API', 'Regex patterns', 'Static analysis'],
    api_requirements: ['OpenAI API Key'],
    estimated_time: '3-10 minutes',
    difficulty_rating: 2,
    tags: ['security', 'secrets', 'scanning', 'compliance'],
    is_white_hat: true,
    requires_permission: true,
    safety_notes:
      'Only scan code you own or have explicit permission to analyze',
  },
  {
    title: 'Vulnerability Assessment Report Generator',
    description:
      'Generate professional security assessment reports from scan results',
    category_id: 2,
    tool_type: 'security',
    complexity_level: 'intermediate',
    use_case: 'Create comprehensive security reports for management',
    prerequisites: ['Vulnerability scan data', 'Security knowledge'],
    technologies: ['OpenAI API', 'Report templates'],
    api_requirements: ['OpenAI API Key'],
    estimated_time: '15-30 minutes',
    difficulty_rating: 3,
    tags: ['security', 'reporting', 'vulnerability', 'compliance'],
    is_white_hat: true,
    requires_permission: true,
  },
  {
    title: 'Compliance Gap Analyzer',
    description:
      'Analyze systems for GDPR, HIPAA, SOX, and other compliance gaps',
    category_id: 2,
    tool_type: 'security',
    complexity_level: 'advanced',
    use_case: 'Ensure regulatory compliance across organization',
    prerequisites: ['System documentation', 'Compliance frameworks knowledge'],
    technologies: ['OpenAI API', 'Compliance frameworks'],
    api_requirements: ['OpenAI API Key'],
    estimated_time: '30-60 minutes',
    difficulty_rating: 4,
    tags: ['compliance', 'gdpr', 'hipaa', 'security', 'audit'],
    is_white_hat: true,
    requires_permission: true,
  },

  // DevOps & Infrastructure Tools
  {
    title: 'Dockerfile Optimizer',
    description: 'Analyze and optimize Dockerfiles for security and efficiency',
    category_id: 3,
    tool_type: 'devops',
    complexity_level: 'intermediate',
    use_case: 'Improve container security and reduce image size',
    prerequisites: ['Docker knowledge', 'Dockerfile to analyze'],
    technologies: ['OpenAI API', 'Docker best practices'],
    api_requirements: ['OpenAI API Key'],
    estimated_time: '5-15 minutes',
    difficulty_rating: 3,
    tags: ['docker', 'optimization', 'security', 'containers'],
    is_white_hat: true,
  },
  {
    title: 'CI/CD Pipeline Analyzer',
    description:
      'Review and optimize continuous integration/deployment pipelines',
    category_id: 3,
    tool_type: 'devops',
    complexity_level: 'advanced',
    use_case: 'Improve build efficiency and security',
    prerequisites: ['CI/CD knowledge', 'Pipeline configuration'],
    technologies: ['OpenAI API', 'CI/CD platforms'],
    api_requirements: ['OpenAI API Key'],
    estimated_time: '20-45 minutes',
    difficulty_rating: 4,
    tags: ['cicd', 'automation', 'optimization', 'devops'],
    is_white_hat: true,
  },
  {
    title: 'Infrastructure as Code Validator',
    description:
      'Validate and optimize Terraform, CloudFormation, and other IaC',
    category_id: 5,
    tool_type: 'cloud',
    complexity_level: 'advanced',
    use_case: 'Ensure infrastructure deployments follow best practices',
    prerequisites: ['IaC knowledge', 'Infrastructure code'],
    technologies: ['OpenAI API', 'IaC tools'],
    api_requirements: ['OpenAI API Key'],
    estimated_time: '15-30 minutes',
    difficulty_rating: 4,
    tags: ['iac', 'terraform', 'cloudformation', 'validation'],
    is_white_hat: true,
  },

  // Data Analysis & Processing Tools
  {
    title: 'Data Quality Assessor',
    description:
      'Analyze datasets for quality issues, missing values, and inconsistencies',
    category_id: 4,
    tool_type: 'data',
    complexity_level: 'intermediate',
    use_case: 'Ensure data quality before analysis or machine learning',
    prerequisites: ['Dataset access', 'Data analysis basics'],
    technologies: ['OpenAI API', 'Statistical analysis'],
    api_requirements: ['OpenAI API Key'],
    estimated_time: '10-25 minutes',
    difficulty_rating: 3,
    tags: ['data-quality', 'analysis', 'statistics', 'ml'],
    is_white_hat: true,
  },
  {
    title: 'Data Dictionary Generator',
    description:
      'Automatically generate comprehensive data dictionaries from datasets',
    category_id: 4,
    tool_type: 'data',
    complexity_level: 'beginner',
    use_case: 'Document data structure and meaning for teams',
    prerequisites: ['Dataset or database schema'],
    technologies: ['OpenAI API', 'Data analysis'],
    api_requirements: ['OpenAI API Key'],
    estimated_time: '5-15 minutes',
    difficulty_rating: 2,
    tags: ['documentation', 'data', 'metadata', 'schema'],
    is_white_hat: true,
  },
  {
    title: 'SQL Query Optimizer',
    description: 'Analyze and optimize SQL queries for better performance',
    category_id: 4,
    tool_type: 'data',
    complexity_level: 'intermediate',
    use_case: 'Improve database query performance',
    prerequisites: ['SQL knowledge', 'Query to optimize'],
    technologies: ['OpenAI API', 'SQL analysis'],
    api_requirements: ['OpenAI API Key'],
    estimated_time: '5-20 minutes',
    difficulty_rating: 3,
    tags: ['sql', 'optimization', 'database', 'performance'],
    is_white_hat: true,
  },

  // Productivity & Automation Tools
  {
    title: 'Meeting Notes Summarizer',
    description:
      'Convert meeting transcripts into structured notes and action items',
    category_id: 7,
    tool_type: 'productivity',
    complexity_level: 'beginner',
    use_case: 'Efficiently process meeting recordings and notes',
    prerequisites: ['Meeting transcript or notes'],
    technologies: ['OpenAI API', 'NLP'],
    api_requirements: ['OpenAI API Key'],
    estimated_time: '2-5 minutes',
    difficulty_rating: 1,
    tags: ['meetings', 'notes', 'summarization', 'productivity'],
    is_white_hat: true,
  },
  {
    title: 'Email Draft Enhancer',
    description: 'Improve email drafts for clarity, tone, and professionalism',
    category_id: 7,
    tool_type: 'productivity',
    complexity_level: 'beginner',
    use_case: 'Write more effective and professional emails',
    prerequisites: ['Email draft text'],
    technologies: ['OpenAI API', 'Text processing'],
    api_requirements: ['OpenAI API Key'],
    estimated_time: '1-3 minutes',
    difficulty_rating: 1,
    tags: ['email', 'writing', 'communication', 'professional'],
    is_white_hat: true,
  },
  {
    title: 'Project Timeline Generator',
    description:
      'Create detailed project timelines from requirements and tasks',
    category_id: 7,
    tool_type: 'productivity',
    complexity_level: 'intermediate',
    use_case: 'Plan and visualize project schedules',
    prerequisites: ['Project requirements', 'Task list'],
    technologies: ['OpenAI API', 'Project management'],
    api_requirements: ['OpenAI API Key'],
    estimated_time: '10-20 minutes',
    difficulty_rating: 3,
    tags: ['project-management', 'timeline', 'planning', 'gantt'],
    is_white_hat: true,
  },

  // Educational & Learning Tools
  {
    title: 'Code Learning Path Generator',
    description: 'Create personalized learning roadmaps for programming skills',
    category_id: 10,
    tool_type: 'custom',
    complexity_level: 'beginner',
    use_case: 'Guide learning journey for new programmers',
    prerequisites: ['Learning goals', 'Current skill level'],
    technologies: ['OpenAI API', 'Educational content'],
    api_requirements: ['OpenAI API Key'],
    estimated_time: '5-10 minutes',
    difficulty_rating: 2,
    tags: ['education', 'learning', 'programming', 'roadmap'],
    is_white_hat: true,
  },
  {
    title: 'Technical Interview Prep',
    description:
      'Generate coding questions and solutions for interview preparation',
    category_id: 10,
    tool_type: 'custom',
    complexity_level: 'intermediate',
    use_case: 'Prepare for technical interviews',
    prerequisites: ['Programming knowledge', 'Target role/company'],
    technologies: ['OpenAI API', 'Algorithm analysis'],
    api_requirements: ['OpenAI API Key'],
    estimated_time: '15-30 minutes',
    difficulty_rating: 3,
    tags: ['interview', 'coding', 'preparation', 'algorithms'],
    is_white_hat: true,
  },

  // Content Creation & Documentation
  {
    title: 'README Generator',
    description: 'Create comprehensive README files for projects automatically',
    category_id: 6,
    tool_type: 'documentation',
    complexity_level: 'beginner',
    use_case: 'Document open source projects and repositories',
    prerequisites: ['Project information', 'Codebase structure'],
    technologies: ['OpenAI API', 'Markdown'],
    api_requirements: ['OpenAI API Key'],
    estimated_time: '5-10 minutes',
    difficulty_rating: 2,
    tags: ['readme', 'documentation', 'markdown', 'opensource'],
    is_white_hat: true,
  },
  {
    title: 'Technical Blog Post Writer',
    description:
      'Generate technical blog posts from code examples and concepts',
    category_id: 6,
    tool_type: 'documentation',
    complexity_level: 'intermediate',
    use_case: 'Share technical knowledge through blog posts',
    prerequisites: ['Technical topic', 'Code examples'],
    technologies: ['OpenAI API', 'Content creation'],
    api_requirements: ['OpenAI API Key'],
    estimated_time: '20-45 minutes',
    difficulty_rating: 3,
    tags: ['blogging', 'technical-writing', 'content', 'education'],
    is_white_hat: true,
  },

  // Advanced Custom Tools
  {
    title: 'Custom Linter Rule Creator',
    description: 'Generate custom linting rules for specific coding standards',
    category_id: 10,
    tool_type: 'custom',
    complexity_level: 'advanced',
    use_case: 'Enforce organization-specific coding standards',
    prerequisites: ['Linting framework knowledge', 'Coding standards'],
    technologies: ['OpenAI API', 'AST parsing', 'Linter APIs'],
    api_requirements: ['OpenAI API Key'],
    estimated_time: '30-60 minutes',
    difficulty_rating: 4,
    tags: ['linting', 'custom-rules', 'code-standards', 'ast'],
    is_white_hat: true,
  },
  {
    title: 'Multi-Language Code Converter',
    description: 'Convert code between different programming languages',
    category_id: 1,
    tool_type: 'dev',
    complexity_level: 'advanced',
    use_case: 'Port applications to different technology stacks',
    prerequisites: ['Multi-language programming knowledge'],
    technologies: ['OpenAI API', 'Language parsers'],
    api_requirements: ['OpenAI API Key'],
    estimated_time: '15-60 minutes',
    difficulty_rating: 4,
    tags: ['code-conversion', 'multi-language', 'porting', 'translation'],
    is_white_hat: true,
  },

  // Monitoring & Observability
  {
    title: 'Log Anomaly Detector',
    description: 'Identify unusual patterns and anomalies in application logs',
    category_id: 9,
    tool_type: 'monitoring',
    complexity_level: 'intermediate',
    use_case: 'Proactively detect issues in production systems',
    prerequisites: ['Log files', 'System knowledge'],
    technologies: ['OpenAI API', 'Log analysis'],
    api_requirements: ['OpenAI API Key'],
    estimated_time: '10-30 minutes',
    difficulty_rating: 3,
    tags: ['logging', 'anomaly-detection', 'monitoring', 'ops'],
    is_white_hat: true,
  },
  {
    title: 'Performance Bottleneck Analyzer',
    description: 'Analyze performance data to identify system bottlenecks',
    category_id: 9,
    tool_type: 'monitoring',
    complexity_level: 'advanced',
    use_case: 'Optimize application and system performance',
    prerequisites: ['Performance metrics', 'System architecture knowledge'],
    technologies: ['OpenAI API', 'Performance analysis'],
    api_requirements: ['OpenAI API Key'],
    estimated_time: '20-45 minutes',
    difficulty_rating: 4,
    tags: ['performance', 'bottleneck', 'optimization', 'analysis'],
    is_white_hat: true,
  },
];

// User manual sections
const manualSections = [
  {
    title: 'Getting Started with Cartrita',
    slug: 'getting-started',
    content: `# Getting Started with Cartrita

Cartrita is an advanced AI-powered assistant system that combines multiple specialized agents to help you with development, security, data analysis, and productivity tasks.

## Quick Setup

1. **Account Creation**: Sign up for a Cartrita account
2. **API Configuration**: Add your OpenAI API key in settings
3. **Agent Selection**: Choose which agents you want to activate
4. **First Conversation**: Start chatting with Cartrita

## Key Features

- **Multi-Agent System**: Specialized agents for different domains
- **Workflow Tools**: 1000+ pre-built automation tools
- **Voice Interaction**: Talk to Cartrita naturally
- **Visual Analysis**: Upload images for AI analysis
- **Knowledge Base**: Searchable documentation and tutorials

## Core Agents

- **Supervisor Agent**: Orchestrates other agents
- **Developer Agent**: Code analysis and generation
- **Security Agent**: Security auditing and compliance
- **Data Analyst**: Data processing and insights
- **Researcher**: Information gathering and analysis

## Getting Help

Use the search function to find specific topics, or ask Cartrita directly for help with any task.`,
    section_type: 'guide',
    difficulty_level: 'beginner',
    estimated_read_time: '5 minutes',
    tags: ['getting-started', 'setup', 'basics'],
    is_featured: true,
    version: '1.0',
  },
  {
    title: 'OpenTelemetry Observability Guide',
    slug: 'opentelemetry-guide',
    content: `# OpenTelemetry Implementation Guide

## Overview

Cartrita includes comprehensive observability with OpenTelemetry, providing:

- **Distributed Tracing**: Track requests across all agents and services
- **Custom Metrics**: Business metrics for user requests, response times, etc.
- **Automatic Instrumentation**: HTTP, Express, PostgreSQL, Redis automatically traced
- **Span Events**: Detailed operation tracking with structured events
- **Child Spans**: Sub-operation tracing for complex workflows

## Quick Start

### Using the Class Directly (Current Implementation)

\`\`\`javascript
import OpenTelemetryTracing from './src/system/OpenTelemetryTracing.js';

// Initialize (done automatically in index.js)
await OpenTelemetryTracing.initialize();

// Trace an agent operation
const result = await OpenTelemetryTracing.traceAgentOperation(
  'researcher',
  'search-operation',
  { 'user.id': userId, 'query': query },
  async (span) => {
    // Your operation code here
    span.setAttributes({ 'operation.success': true });
    return { data: 'result' };
  }
);
\`\`\`

### Configuration

Set these environment variables for production:

\`\`\`bash
OTEL_SERVICE_NAME=cartrita-advanced-2025-mcp
OTEL_SERVICE_VERSION=2025-06-18
OTEL_EXPORTER_OTLP_ENDPOINT=http://jaeger:14268
OTEL_LOG_LEVEL=INFO
\`\`\`

## Key Benefits

- **Full Request Tracing**: From user input to agent response
- **Performance Monitoring**: Across all components
- **Business Intelligence**: User interaction patterns and metrics
- **Production Ready**: Zero-impact when disabled, configurable sampling`,
    section_type: 'reference',
    difficulty_level: 'intermediate',
    estimated_read_time: '10 minutes',
    tags: ['opentelemetry', 'observability', 'monitoring', 'tracing'],
    is_featured: true,
    version: '1.0',
  },
  {
    title: 'Workflow Tools Usage',
    slug: 'workflow-tools-usage',
    content: `# Using Workflow Tools

Cartrita includes over 1000 pre-built workflow tools for various tasks including development, security, data analysis, and productivity.

## Finding Tools

### Search by Category
- **Development**: Code analysis, testing, documentation
- **Security**: White-hat security testing and compliance
- **DevOps**: CI/CD, infrastructure, deployment
- **Data Analysis**: Processing, analytics, visualization
- **Productivity**: Automation and efficiency tools

### Search by Complexity
- **Beginner**: Easy to use, minimal prerequisites
- **Intermediate**: Some technical knowledge required
- **Advanced**: Expert-level tools for complex tasks
- **Expert**: Highly specialized tools

### Semantic Search
Use natural language to find tools:
- "Help me analyze my code for security issues"
- "Generate unit tests for my Python functions"
- "Create documentation from my API endpoints"

## Using Tools

1. **Select a Tool**: Browse or search for the tool you need
2. **Check Prerequisites**: Ensure you have required knowledge/access
3. **Review Safety Notes**: Understand any permissions needed
4. **Execute**: Follow the tool's instructions
5. **Review Results**: Analyze the output and take action

## Tool Types

### Code Analysis Tools
- Linting and formatting
- Dependency analysis
- Security scanning
- Performance optimization

### Documentation Tools
- README generation
- API documentation
- Code commenting
- Technical writing

### Security Tools (White-hat Only)
- Vulnerability scanning
- Compliance checking
- Secret detection
- Security reporting

All security tools require proper authorization and should only be used on systems you own or have explicit permission to test.`,
    section_type: 'tutorial',
    difficulty_level: 'beginner',
    estimated_read_time: '8 minutes',
    tags: ['workflow', 'tools', 'automation', 'productivity'],
    is_featured: true,
    version: '1.0',
  },
  {
    title: 'Agent System Architecture',
    slug: 'agent-architecture',
    content: `# Agent System Architecture

Cartrita uses a sophisticated multi-agent architecture where specialized agents work together to handle complex tasks.

## Core Components

### Supervisor Agent
- **Role**: Orchestrates other agents and manages conversations
- **Implementation**: EnhancedLangChainCoreAgent
- **Location**: \`/packages/backend/src/agi/consciousness/EnhancedLangChainCoreAgent.js\`
- **Capabilities**: 
  - Request routing to appropriate agents
  - Response synthesis and coordination
  - User context management
  - Tool selection and execution

### Specialized Agents
- **ResearcherAgent**: Information gathering and analysis
- **AnalystAgent**: Data processing and insights
- **WriterAgent**: Content creation and documentation
- **ComedianAgent**: Entertainment and humor
- **ArtistAgent**: Creative tasks and design
- **CodeWriterAgent**: Software development tasks

### Tool Registry
- **AgentToolRegistry**: Central registry for all available tools
- **Function Calling**: OpenAI-powered tool selection
- **Custom Tools**: User-defined workflow automation

## Communication Flow

1. **User Input**: Message received via Socket.IO or API
2. **Intent Analysis**: Supervisor determines appropriate agent
3. **Agent Delegation**: Task routed to specialized agent
4. **Tool Execution**: Agent uses available tools as needed
5. **Response Synthesis**: Results combined and formatted
6. **User Output**: Final response delivered to user

## Agent Initialization

Agents are initialized in this order:
1. Database connection
2. OpenTelemetry tracing
3. Redis cache
4. Core Supervisor Agent
5. Service initializer (all sub-agents)
6. Advanced MCP orchestrator

## Extending the System

To add new agents:
1. Create agent class extending BaseAgent
2. Register in AgentToolRegistry
3. Add to ServiceInitializer
4. Configure routing in Supervisor
5. Add appropriate tracing and monitoring`,
    section_type: 'reference',
    difficulty_level: 'advanced',
    estimated_read_time: '15 minutes',
    tags: ['architecture', 'agents', 'system', 'development'],
    is_featured: false,
    version: '1.0',
  },
  {
    title: 'Security Best Practices',
    slug: 'security-best-practices',
    content: `# Security Best Practices

Cartrita includes powerful security tools that must be used responsibly and ethically.

## White-Hat Security Only

All security tools in Cartrita are designed for:
- **Authorized Testing**: Only on systems you own or have explicit permission to test
- **Defensive Security**: Improving your organization's security posture
- **Educational Purposes**: Learning about security in controlled environments
- **Compliance**: Meeting regulatory and audit requirements

## Never Use For

- **Unauthorized Access**: Testing systems without permission
- **Malicious Activities**: Any illegal or harmful actions
- **Privacy Violations**: Accessing data you shouldn't see
- **Harassment**: Targeting individuals or organizations

## Tool Categories

### Vulnerability Assessment
- Code security scanning
- Configuration reviews
- Dependency auditing
- Compliance checking

### Penetration Testing (Authorized Only)
- Network reconnaissance (on your networks)
- Web application testing (your apps)
- Infrastructure review (your systems)
- Physical security assessment (your facilities)

### Compliance & Auditing
- GDPR compliance checking
- HIPAA audit support
- SOX controls validation
- PCI DSS assessment

## Getting Proper Authorization

Before using security tools:

1. **Own the System**: Only test systems you own
2. **Written Permission**: Get explicit written authorization
3. **Scope Definition**: Clearly define what can be tested
4. **Legal Review**: Have legal team review permissions
5. **Documentation**: Keep records of all authorized testing

## Responsible Disclosure

If you discover vulnerabilities:

1. **Document Findings**: Record all details securely
2. **Immediate Notification**: Alert system owners promptly
3. **Provide Solutions**: Include remediation recommendations
4. **Follow Up**: Ensure issues are addressed
5. **Maintain Confidentiality**: Don't share without permission

## Emergency Procedures

If you accidentally discover critical vulnerabilities:

1. **Stop Testing**: Don't continue exploration
2. **Secure Evidence**: Protect all findings
3. **Immediate Escalation**: Contact security team immediately
4. **Legal Compliance**: Follow disclosure laws and policies

Remember: With great power comes great responsibility. Use these tools to make the digital world safer for everyone.`,
    section_type: 'guide',
    difficulty_level: 'intermediate',
    estimated_read_time: '12 minutes',
    tags: ['security', 'ethics', 'compliance', 'best-practices'],
    is_featured: true,
    version: '1.0',
  },
];

async function generateEmbedding(text) {
  try {
    const response = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: text.substring(0, 8000), // Limit input length
    });
    return `[${response.data[0].embedding.join(',')}]`;
  } catch (error) {
    console.warn('Failed to generate embedding:', error.message);
    return null;
  }
}

async function populateWorkflowTools() {
  try {
    console.log('🚀 Starting workflow tools population...');

    // Insert workflow tools
    console.log('📊 Inserting workflow tools...');
    let successCount = 0;
    let errorCount = 0;

    for (const tool of workflowTools) {
      try {
        // Generate embedding
        const embeddingText = `${tool.title} ${tool.description} ${
          tool.use_case || ''
        } ${tool.tags?.join(' ') || ''}`;
        const embedding = await generateEmbedding(embeddingText);

        const query = `
                    INSERT INTO workflow_tools (
                        title, description, category_id, tool_type, complexity_level,
                        use_case, prerequisites, technologies, api_requirements,
                        estimated_time, difficulty_rating, tags, is_white_hat,
                        requires_permission, safety_notes, embedding, author
                    ) VALUES (
                        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17
                    )
                `;

        const values = [
          tool.title,
          tool.description,
          tool.category_id,
          tool.tool_type,
          tool.complexity_level,
          tool.use_case,
          tool.prerequisites || [],
          tool.technologies || [],
          tool.api_requirements || [],
          tool.estimated_time,
          tool.difficulty_rating,
          tool.tags || [],
          tool.is_white_hat,
          tool.requires_permission || false,
          tool.safety_notes,
          embedding,
          'System',
        ];

        await pool.query(query, values);
        successCount++;
        console.log(`✅ Added: ${tool.title}`);
      } catch (error) {
        console.error(`❌ Failed to add tool "${tool.title}":`, error.message);
        errorCount++;
      }
    }

    console.log(
      `📊 Workflow Tools Summary: ${successCount} added, ${errorCount} errors`
    );

    // Insert manual sections
    console.log('📚 Inserting manual sections...');
    let manualSuccessCount = 0;
    let manualErrorCount = 0;

    for (const section of manualSections) {
      try {
        // Generate embedding
        const embeddingText = `${section.title} ${section.content}`;
        const embedding = await generateEmbedding(embeddingText);

        const query = `
                    INSERT INTO user_manual_sections (
                        title, slug, content, section_type, difficulty_level,
                        estimated_read_time, tags, is_featured, version, embedding,
                        last_updated_by
                    ) VALUES (
                        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11
                    ) ON CONFLICT (slug) DO UPDATE SET
                        content = EXCLUDED.content,
                        embedding = EXCLUDED.embedding,
                        updated_at = NOW()
                `;

        const values = [
          section.title,
          section.slug,
          section.content,
          section.section_type,
          section.difficulty_level,
          section.estimated_read_time,
          section.tags || [],
          section.is_featured,
          section.version,
          embedding,
          'System',
        ];

        await pool.query(query, values);
        manualSuccessCount++;
        console.log(`✅ Added manual: ${section.title}`);
      } catch (error) {
        console.error(
          `❌ Failed to add manual section "${section.title}":`,
          error.message
        );
        manualErrorCount++;
      }
    }

    console.log(
      `📚 Manual Sections Summary: ${manualSuccessCount} added, ${manualErrorCount} errors`
    );
    console.log('🎉 Population complete!');
  } catch (error) {
    console.error('❌ Population failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run the population script
if (import.meta.url === `file://${process.argv[1]}`) {
  populateWorkflowTools();
}

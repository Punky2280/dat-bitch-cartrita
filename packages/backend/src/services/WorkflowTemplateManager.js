/**
 * Workflow Template Manager - Pre-built workflow templates and management
 * Provides common workflow patterns and template customization
 */

import db from '../db.js';

class WorkflowTemplateManager {
  constructor() {
    this.templates = new Map();
    this.categories = new Map();
    this.initializeDefaultTemplates();
  }

  initializeDefaultTemplates() {
    // Content Generation Templates
    this.addTemplate({
      id: 'content-generation-pipeline',
      name: 'Content Generation Pipeline',
      description: 'Generate, review, and optimize content with AI',
      category: 'content',
      tags: ['writing', 'ai', 'review'],
      difficulty: 'beginner',
      estimatedTime: '2-5 minutes',
      definition: {
        startNode: 'start',
        nodes: {
          start: {
            type: 'start',
            position: { x: 100, y: 100 },
            connections: [{ target: 'generate_content' }]
          },
          generate_content: {
            type: 'ai_task',
            position: { x: 300, y: 100 },
            config: {
              task: 'chat',
              provider: 'openai',
              model: 'gpt-4',
              prompt: 'Generate {{content_type}} about {{topic}}. Style: {{style}}. Length: {{length}} words.',
              options: { max_tokens: 1000, temperature: 0.7 }
            },
            connections: [{ target: 'review_content' }]
          },
          review_content: {
            type: 'ai_task',
            position: { x: 500, y: 100 },
            config: {
              task: 'chat',
              provider: 'openai',
              model: 'gpt-4',
              prompt: 'Review this content for quality, accuracy, and style:\n\n{{data}}\n\nProvide suggestions for improvement.',
              options: { max_tokens: 500, temperature: 0.3 }
            },
            connections: [{ target: 'format_output' }]
          },
          format_output: {
            type: 'transform',
            position: { x: 700, y: 100 },
            config: {
              transformation: {
                type: 'format',
                template: {
                  original_content: '{{variables.generated_content}}',
                  review: '{{data}}',
                  metadata: {
                    topic: '{{variables.topic}}',
                    style: '{{variables.style}}',
                    generated_at: '{{metadata.startTime}}'
                  }
                }
              }
            },
            connections: [{ target: 'end' }]
          },
          end: {
            type: 'end',
            position: { x: 900, y: 100 }
          }
        }
      },
      variables: {
        topic: { type: 'string', required: true, description: 'The topic to write about' },
        content_type: { type: 'select', options: ['article', 'blog post', 'email', 'summary'], default: 'article' },
        style: { type: 'select', options: ['professional', 'casual', 'academic', 'creative'], default: 'professional' },
        length: { type: 'number', min: 100, max: 2000, default: 500 }
      }
    });

    // Data Analysis Pipeline
    this.addTemplate({
      id: 'data-analysis-pipeline',
      name: 'Data Analysis Pipeline',
      description: 'Analyze data, generate insights, and create reports',
      category: 'analytics',
      tags: ['data', 'analysis', 'reporting'],
      difficulty: 'intermediate',
      estimatedTime: '5-10 minutes',
      definition: {
        startNode: 'start',
        nodes: {
          start: {
            type: 'start',
            position: { x: 100, y: 100 },
            connections: [{ target: 'load_data' }]
          },
          load_data: {
            type: 'database',
            position: { x: 300, y: 100 },
            config: {
              operation: 'select',
              query: 'SELECT * FROM {{table_name}} WHERE {{conditions}}',
              parameters: []
            },
            connections: [{ target: 'analyze_data' }]
          },
          analyze_data: {
            type: 'ai_task',
            position: { x: 500, y: 100 },
            config: {
              task: 'chat',
              provider: 'openai',
              model: 'gpt-4',
              prompt: 'Analyze this dataset and provide key insights:\n\n{{data}}\n\nFocus on trends, patterns, and anomalies.',
              options: { max_tokens: 800, temperature: 0.2 }
            },
            connections: [{ target: 'generate_visualization' }]
          },
          generate_visualization: {
            type: 'ai_task',
            position: { x: 700, y: 100 },
            config: {
              task: 'chat',
              provider: 'openai',
              model: 'gpt-4',
              prompt: 'Based on this analysis, suggest appropriate visualizations and provide the code for creating them:\n\n{{data}}',
              options: { max_tokens: 600, temperature: 0.3 }
            },
            connections: [{ target: 'create_report' }]
          },
          create_report: {
            type: 'transform',
            position: { x: 900, y: 100 },
            config: {
              transformation: {
                type: 'format',
                template: {
                  title: 'Data Analysis Report',
                  summary: '{{variables.analysis_summary}}',
                  insights: '{{variables.insights}}',
                  visualizations: '{{variables.visualization_code}}',
                  recommendations: '{{variables.recommendations}}',
                  generated_at: '{{metadata.startTime}}'
                }
              }
            },
            connections: [{ target: 'end' }]
          },
          end: {
            type: 'end',
            position: { x: 1100, y: 100 }
          }
        }
      },
      variables: {
        table_name: { type: 'string', required: true, description: 'Database table to analyze' },
        conditions: { type: 'string', default: '1=1', description: 'SQL WHERE conditions' }
      }
    });

    // Customer Support Automation
    this.addTemplate({
      id: 'customer-support-automation',
      name: 'Customer Support Automation',
      description: 'Intelligent customer query processing and response generation',
      category: 'support',
      tags: ['customer service', 'automation', 'nlp'],
      difficulty: 'intermediate',
      estimatedTime: '1-3 minutes',
      definition: {
        startNode: 'start',
        nodes: {
          start: {
            type: 'start',
            position: { x: 100, y: 100 },
            connections: [{ target: 'classify_query' }]
          },
          classify_query: {
            type: 'ai_task',
            position: { x: 300, y: 100 },
            config: {
              task: 'classification',
              provider: 'huggingface',
              prompt: 'Classify this customer query: {{query}}\n\nCategories: billing, technical, general, complaint, feature_request',
              options: { max_tokens: 50 }
            },
            connections: [
              { target: 'search_knowledge', condition: 'technical' },
              { target: 'escalate_to_human', condition: 'complaint' },
              { target: 'generate_response', condition: 'default' }
            ]
          },
          search_knowledge: {
            type: 'ai_task',
            position: { x: 500, y: 50 },
            config: {
              task: 'search',
              provider: 'knowledge',
              prompt: '{{variables.query}}',
              options: { limit: 5, threshold: 0.7 }
            },
            connections: [{ target: 'generate_response' }]
          },
          escalate_to_human: {
            type: 'webhook',
            position: { x: 500, y: 200 },
            config: {
              url: '{{webhook_url}}',
              method: 'POST',
              body: {
                type: 'escalation',
                query: '{{variables.query}}',
                customer_id: '{{variables.customer_id}}',
                priority: 'high'
              }
            },
            connections: [{ target: 'end' }]
          },
          generate_response: {
            type: 'ai_task',
            position: { x: 700, y: 100 },
            config: {
              task: 'chat',
              provider: 'openai',
              model: 'gpt-4',
              prompt: 'Generate a helpful customer service response for this query: {{variables.query}}\n\nContext: {{data}}\n\nBe professional, empathetic, and provide actionable solutions.',
              options: { max_tokens: 400, temperature: 0.5 }
            },
            connections: [{ target: 'end' }]
          },
          end: {
            type: 'end',
            position: { x: 900, y: 100 }
          }
        }
      },
      variables: {
        query: { type: 'text', required: true, description: 'Customer query or message' },
        customer_id: { type: 'string', required: false, description: 'Customer identifier' },
        webhook_url: { type: 'string', required: false, description: 'Escalation webhook URL' }
      }
    });

    // Document Processing Pipeline
    this.addTemplate({
      id: 'document-processing-pipeline',
      name: 'Document Processing Pipeline',
      description: 'Extract, analyze, and summarize document content',
      category: 'document',
      tags: ['document', 'extraction', 'summarization'],
      difficulty: 'advanced',
      estimatedTime: '3-8 minutes',
      definition: {
        startNode: 'start',
        nodes: {
          start: {
            type: 'start',
            position: { x: 100, y: 100 },
            connections: [{ target: 'extract_text' }]
          },
          extract_text: {
            type: 'ai_task',
            position: { x: 300, y: 100 },
            config: {
              task: 'vision',
              provider: 'openai',
              prompt: 'Extract all text content from this document image. Maintain structure and formatting.',
              options: { max_tokens: 2000 }
            },
            connections: [{ target: 'analyze_content' }]
          },
          analyze_content: {
            type: 'parallel',
            position: { x: 500, y: 100 },
            config: {
              branches: [
                {
                  id: 'summarize',
                  nodes: ['summarize_content']
                },
                {
                  id: 'extract_entities',
                  nodes: ['extract_entities']
                },
                {
                  id: 'classify',
                  nodes: ['classify_document']
                }
              ],
              mergeStrategy: 'combine'
            },
            connections: [{ target: 'compile_results' }]
          },
          summarize_content: {
            type: 'ai_task',
            position: { x: 400, y: 50 },
            config: {
              task: 'chat',
              provider: 'openai',
              model: 'gpt-4',
              prompt: 'Summarize this document in 2-3 paragraphs:\n\n{{data}}',
              options: { max_tokens: 300 }
            }
          },
          extract_entities: {
            type: 'ai_task',
            position: { x: 400, y: 100 },
            config: {
              task: 'chat',
              provider: 'openai',
              model: 'gpt-4',
              prompt: 'Extract key entities (people, organizations, dates, locations) from this text:\n\n{{data}}',
              options: { max_tokens: 200 }
            }
          },
          classify_document: {
            type: 'ai_task',
            position: { x: 400, y: 150 },
            config: {
              task: 'classification',
              provider: 'huggingface',
              prompt: 'Classify this document type: {{data}}\n\nTypes: contract, invoice, report, letter, form, other',
              options: { max_tokens: 50 }
            }
          },
          compile_results: {
            type: 'transform',
            position: { x: 700, y: 100 },
            config: {
              transformation: {
                type: 'format',
                template: {
                  document_type: '{{parallelResults.classify.result}}',
                  summary: '{{parallelResults.summarize.result}}',
                  entities: '{{parallelResults.extract_entities.result}}',
                  full_text: '{{variables.extracted_text}}',
                  processed_at: '{{metadata.startTime}}'
                }
              }
            },
            connections: [{ target: 'end' }]
          },
          end: {
            type: 'end',
            position: { x: 900, y: 100 }
          }
        }
      },
      variables: {
        document_url: { type: 'string', required: true, description: 'URL or path to document image' }
      }
    });

    // Initialize categories
    this.categories.set('content', {
      name: 'Content Generation',
      description: 'Templates for creating and optimizing content',
      icon: '📝'
    });

    this.categories.set('analytics', {
      name: 'Data Analytics',
      description: 'Templates for data analysis and reporting',
      icon: '📊'
    });

    this.categories.set('support', {
      name: 'Customer Support',
      description: 'Templates for customer service automation',
      icon: '🎧'
    });

    this.categories.set('document', {
      name: 'Document Processing',
      description: 'Templates for document analysis and extraction',
      icon: '📄'
    });
  }

  addTemplate(template) {
    // Validate template structure
    const validation = this.validateTemplate(template);
    if (!validation.valid) {
      throw new Error(`Invalid template: ${validation.errors.join(', ')}`);
    }

    this.templates.set(template.id, {
      ...template,
      createdAt: Date.now(),
      updatedAt: Date.now()
    });
  }

  getTemplate(templateId) {
    return this.templates.get(templateId);
  }

  listTemplates(category = null, tags = null) {
    let templates = Array.from(this.templates.values());

    if (category) {
      templates = templates.filter(t => t.category === category);
    }

    if (tags && tags.length > 0) {
      templates = templates.filter(t => 
        tags.some(tag => t.tags.includes(tag))
      );
    }

    return templates.map(t => ({
      id: t.id,
      name: t.name,
      description: t.description,
      category: t.category,
      tags: t.tags,
      difficulty: t.difficulty,
      estimatedTime: t.estimatedTime,
      createdAt: t.createdAt,
      updatedAt: t.updatedAt
    }));
  }

  getCategories() {
    return Array.from(this.categories.entries()).map(([id, category]) => ({
      id,
      ...category,
      templateCount: this.listTemplates(id).length
    }));
  }

  searchTemplates(query) {
    const searchTerms = query.toLowerCase().split(' ');
    const templates = Array.from(this.templates.values());

    return templates.filter(template => {
      const searchableText = [
        template.name,
        template.description,
        template.category,
        ...template.tags
      ].join(' ').toLowerCase();

      return searchTerms.every(term => searchableText.includes(term));
    });
  }

  cloneTemplate(templateId, customizations = {}) {
    const template = this.getTemplate(templateId);
    if (!template) {
      throw new Error(`Template not found: ${templateId}`);
    }

    const clonedTemplate = {
      ...template,
      id: `${templateId}_${Date.now()}`,
      name: customizations.name || `${template.name} (Copy)`,
      description: customizations.description || template.description,
      definition: JSON.parse(JSON.stringify(template.definition)),
      variables: { ...template.variables, ...customizations.variables },
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    // Apply customizations to the workflow definition
    if (customizations.nodeUpdates) {
      for (const [nodeId, updates] of Object.entries(customizations.nodeUpdates)) {
        if (clonedTemplate.definition.nodes[nodeId]) {
          Object.assign(clonedTemplate.definition.nodes[nodeId], updates);
        }
      }
    }

    return clonedTemplate;
  }

  validateTemplate(template) {
    const errors = [];

    // Required fields
    if (!template.id) errors.push('Template must have an id');
    if (!template.name) errors.push('Template must have a name');
    if (!template.definition) errors.push('Template must have a definition');
    if (!template.definition.startNode) errors.push('Template definition must have a startNode');
    if (!template.definition.nodes) errors.push('Template definition must have nodes');

    // Validate category
    if (template.category && !this.categories.has(template.category)) {
      errors.push(`Unknown category: ${template.category}`);
    }

    // Validate difficulty
    if (template.difficulty && !['beginner', 'intermediate', 'advanced'].includes(template.difficulty)) {
      errors.push('Difficulty must be beginner, intermediate, or advanced');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  async saveTemplateToDB(template) {
    try {
      const query = `
        INSERT INTO workflow_templates 
        (id, name, description, category, tags, difficulty, estimated_time, definition, variables, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
        ON CONFLICT (id) DO UPDATE SET
        name = $2, description = $3, category = $4, tags = $5, 
        difficulty = $6, estimated_time = $7, definition = $8, variables = $9, updated_at = NOW()
      `;

      await db.query(query, [
        template.id,
        template.name,
        template.description,
        template.category,
        JSON.stringify(template.tags || []),
        template.difficulty,
        template.estimatedTime,
        JSON.stringify(template.definition),
        JSON.stringify(template.variables || {})
      ]);

      return true;
    } catch (error) {
      console.error('[WorkflowTemplateManager] Failed to save template:', error);
      return false;
    }
  }

  async loadTemplatesFromDB() {
    try {
      const result = await db.query('SELECT * FROM workflow_templates ORDER BY created_at DESC');
      
      for (const row of result.rows) {
        const template = {
          id: row.id,
          name: row.name,
          description: row.description,
          category: row.category,
          tags: JSON.parse(row.tags || '[]'),
          difficulty: row.difficulty,
          estimatedTime: row.estimated_time,
          definition: JSON.parse(row.definition),
          variables: JSON.parse(row.variables || '{}'),
          createdAt: row.created_at,
          updatedAt: row.updated_at
        };

        this.templates.set(template.id, template);
      }

      console.log(`[WorkflowTemplateManager] Loaded ${result.rows.length} templates from database`);
    } catch (error) {
      console.warn('[WorkflowTemplateManager] Failed to load templates from database:', error.message);
    }
  }

  getTemplateMetrics() {
    const templates = Array.from(this.templates.values());
    const categories = Array.from(this.categories.keys());

    return {
      totalTemplates: templates.length,
      categoryCounts: categories.reduce((acc, cat) => {
        acc[cat] = templates.filter(t => t.category === cat).length;
        return acc;
      }, {}),
      difficultyLevels: {
        beginner: templates.filter(t => t.difficulty === 'beginner').length,
        intermediate: templates.filter(t => t.difficulty === 'intermediate').length,
        advanced: templates.filter(t => t.difficulty === 'advanced').length
      },
      totalCategories: categories.length
    };
  }
}

export default WorkflowTemplateManager;
/**
 * Structured Output Schema System
 * 
 * Comprehensive schema validation, transformation, and persistence for AI agent responses
 * Provides JSON schema validation, metadata enrichment, and retrieval capabilities
 * 
 * @author Robbie Allen - Lead Architect
 * @date January 2025
 */

import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import { z } from 'zod';

// Initialize AJV with formats support
const ajv = new Ajv({ allErrors: true, removeAdditional: true, strict: false });
try {
  addFormats(ajv);
} catch (error) {
  console.warn('[StructuredOutputService] Failed to add AJV formats:', error.message);
}

/**
 * Core schema definitions for structured outputs
 */
export const StructuredOutputSchemas = {
  // Base structured output envelope
  envelope: {
    type: 'object',
    properties: {
      id: { type: 'string', format: 'uuid' },
      task: { type: 'string', minLength: 1, maxLength: 100 },
      agent: { type: 'string', minLength: 1, maxLength: 50 },
      status: { 
        type: 'string', 
        enum: ['success', 'error', 'partial', 'warning', 'info']
      },
      timestamp: { type: 'string', format: 'date-time' },
      confidence: { type: 'number', minimum: 0, maximum: 1 },
      version: { type: 'string', pattern: '^\\d+\\.\\d+\\.\\d+$' },
      metadata: { type: 'object' },
      data: { type: 'object' },
      warnings: { 
        type: 'array',
        items: { type: 'string' }
      },
      errors: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            code: { type: 'string' },
            message: { type: 'string' },
            field: { type: 'string' }
          },
          required: ['code', 'message']
        }
      }
    },
    required: ['id', 'task', 'agent', 'status', 'timestamp', 'data'],
    additionalProperties: false
  },

  // Task-specific schemas
  tasks: {
    // Analysis tasks
    sentiment_analysis: {
      type: 'object',
      properties: {
        sentiment: { 
          type: 'string', 
          enum: ['positive', 'negative', 'neutral', 'mixed'] 
        },
        score: { type: 'number', minimum: -1, maximum: 1 },
        confidence: { type: 'number', minimum: 0, maximum: 1 },
        emotions: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              emotion: { type: 'string' },
              intensity: { type: 'number', minimum: 0, maximum: 1 }
            },
            required: ['emotion', 'intensity']
          }
        },
        keywords: { 
          type: 'array',
          items: { type: 'string' }
        }
      },
      required: ['sentiment', 'score', 'confidence']
    },

    // Content generation
    content_generation: {
      type: 'object',
      properties: {
        content: { type: 'string', minLength: 1 },
        word_count: { type: 'integer', minimum: 0 },
        reading_time: { type: 'integer', minimum: 0 },
        language: { type: 'string', pattern: '^[a-z]{2}(-[A-Z]{2})?$' },
        tone: { type: 'string' },
        style: { type: 'string' },
        topics: {
          type: 'array',
          items: { type: 'string' }
        },
        quality_metrics: {
          type: 'object',
          properties: {
            clarity: { type: 'number', minimum: 0, maximum: 1 },
            coherence: { type: 'number', minimum: 0, maximum: 1 },
            relevance: { type: 'number', minimum: 0, maximum: 1 },
            engagement: { type: 'number', minimum: 0, maximum: 1 }
          }
        }
      },
      required: ['content', 'word_count', 'language']
    },

    // Data analysis
    data_analysis: {
      type: 'object',
      properties: {
        summary: { type: 'string' },
        insights: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              title: { type: 'string' },
              description: { type: 'string' },
              confidence: { type: 'number', minimum: 0, maximum: 1 },
              impact: { 
                type: 'string', 
                enum: ['high', 'medium', 'low'] 
              }
            },
            required: ['title', 'description', 'confidence']
          }
        },
        statistics: {
          type: 'object',
          properties: {
            total_records: { type: 'integer', minimum: 0 },
            processed_records: { type: 'integer', minimum: 0 },
            error_rate: { type: 'number', minimum: 0, maximum: 1 },
            processing_time_ms: { type: 'integer', minimum: 0 }
          }
        },
        charts: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              type: { 
                type: 'string', 
                enum: ['bar', 'line', 'pie', 'scatter', 'histogram'] 
              },
              title: { type: 'string' },
              data: { type: 'array' },
              config: { type: 'object' }
            },
            required: ['type', 'title', 'data']
          }
        }
      },
      required: ['summary', 'insights']
    },

    // Code generation/analysis
    code_analysis: {
      type: 'object',
      properties: {
        language: { type: 'string' },
        framework: { type: 'string' },
        complexity: { 
          type: 'string', 
          enum: ['low', 'medium', 'high', 'very_high'] 
        },
        quality_score: { type: 'number', minimum: 0, maximum: 10 },
        issues: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              type: { 
                type: 'string', 
                enum: ['error', 'warning', 'info', 'suggestion'] 
              },
              line: { type: 'integer', minimum: 1 },
              column: { type: 'integer', minimum: 1 },
              message: { type: 'string' },
              severity: { 
                type: 'string', 
                enum: ['critical', 'high', 'medium', 'low'] 
              }
            },
            required: ['type', 'message']
          }
        },
        metrics: {
          type: 'object',
          properties: {
            lines_of_code: { type: 'integer', minimum: 0 },
            cyclomatic_complexity: { type: 'integer', minimum: 1 },
            test_coverage: { type: 'number', minimum: 0, maximum: 1 },
            maintainability_index: { type: 'number', minimum: 0, maximum: 100 }
          }
        },
        suggestions: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              category: { type: 'string' },
              description: { type: 'string' },
              impact: { 
                type: 'string', 
                enum: ['performance', 'readability', 'security', 'maintainability'] 
              },
              priority: { 
                type: 'string', 
                enum: ['critical', 'high', 'medium', 'low'] 
              }
            },
            required: ['category', 'description', 'impact']
          }
        }
      },
      required: ['language', 'complexity', 'quality_score']
    },

    // Research results
    research_analysis: {
      type: 'object',
      properties: {
        query: { type: 'string' },
        sources: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              title: { type: 'string' },
              url: { type: 'string', format: 'uri' },
              credibility: { type: 'number', minimum: 0, maximum: 1 },
              relevance: { type: 'number', minimum: 0, maximum: 1 },
              summary: { type: 'string' },
              date: { type: 'string', format: 'date' }
            },
            required: ['title', 'url', 'credibility', 'relevance']
          }
        },
        findings: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              claim: { type: 'string' },
              evidence: { type: 'string' },
              confidence: { type: 'number', minimum: 0, maximum: 1 },
              sources: { 
                type: 'array',
                items: { type: 'string' }
              }
            },
            required: ['claim', 'evidence', 'confidence']
          }
        },
        conclusion: { type: 'string' },
        limitations: { 
          type: 'array',
          items: { type: 'string' }
        }
      },
      required: ['query', 'sources', 'findings', 'conclusion']
    },

    // Vision/image analysis
    vision_analysis: {
      type: 'object',
      properties: {
        description: { type: 'string' },
        objects: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              confidence: { type: 'number', minimum: 0, maximum: 1 },
              bounding_box: {
                type: 'object',
                properties: {
                  x: { type: 'number' },
                  y: { type: 'number' },
                  width: { type: 'number' },
                  height: { type: 'number' }
                },
                required: ['x', 'y', 'width', 'height']
              }
            },
            required: ['name', 'confidence']
          }
        },
        faces: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              age_range: { type: 'string' },
              gender: { type: 'string' },
              emotions: { type: 'object' },
              confidence: { type: 'number', minimum: 0, maximum: 1 }
            }
          }
        },
        text: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              content: { type: 'string' },
              confidence: { type: 'number', minimum: 0, maximum: 1 },
              language: { type: 'string' }
            },
            required: ['content', 'confidence']
          }
        },
        scene_analysis: {
          type: 'object',
          properties: {
            setting: { type: 'string' },
            lighting: { type: 'string' },
            mood: { type: 'string' },
            activity: { type: 'string' }
          }
        }
      },
      required: ['description']
    },

    // Audio analysis
    audio_analysis: {
      type: 'object',
      properties: {
        transcription: { type: 'string' },
        language: { type: 'string' },
        confidence: { type: 'number', minimum: 0, maximum: 1 },
        sentiment: { 
          type: 'string', 
          enum: ['positive', 'negative', 'neutral'] 
        },
        emotions: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              emotion: { type: 'string' },
              intensity: { type: 'number', minimum: 0, maximum: 1 },
              timestamp: { type: 'number', minimum: 0 }
            },
            required: ['emotion', 'intensity']
          }
        },
        speakers: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              segments: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    start: { type: 'number', minimum: 0 },
                    end: { type: 'number', minimum: 0 },
                    text: { type: 'string' }
                  },
                  required: ['start', 'end', 'text']
                }
              }
            },
            required: ['id', 'segments']
          }
        },
        audio_quality: {
          type: 'object',
          properties: {
            signal_to_noise: { type: 'number' },
            clarity: { type: 'number', minimum: 0, maximum: 1 },
            background_noise: { type: 'boolean' }
          }
        }
      },
      required: ['transcription', 'language', 'confidence']
    }
  }
};

/**
 * Zod schemas for runtime validation (TypeScript-first approach)
 */
export const ZodStructuredSchemas = {
  envelope: z.object({
    id: z.string().uuid(),
    task: z.string().min(1).max(100),
    agent: z.string().min(1).max(50),
    status: z.enum(['success', 'error', 'partial', 'warning', 'info']),
    timestamp: z.string().datetime(),
    confidence: z.number().min(0).max(1).optional(),
    version: z.string().regex(/^\d+\.\d+\.\d+$/).default('1.0.0'),
    metadata: z.record(z.any()).optional(),
    data: z.record(z.any()),
    warnings: z.array(z.string()).optional(),
    errors: z.array(z.object({
      code: z.string(),
      message: z.string(),
      field: z.string().optional()
    })).optional()
  })
};

/**
 * Compiled validators for performance
 */
export const CompiledValidators = {
  envelope: ajv.compile(StructuredOutputSchemas.envelope),
  sentiment_analysis: ajv.compile(StructuredOutputSchemas.tasks.sentiment_analysis),
  content_generation: ajv.compile(StructuredOutputSchemas.tasks.content_generation),
  data_analysis: ajv.compile(StructuredOutputSchemas.tasks.data_analysis),
  code_analysis: ajv.compile(StructuredOutputSchemas.tasks.code_analysis),
  research_analysis: ajv.compile(StructuredOutputSchemas.tasks.research_analysis),
  vision_analysis: ajv.compile(StructuredOutputSchemas.tasks.vision_analysis),
  audio_analysis: ajv.compile(StructuredOutputSchemas.tasks.audio_analysis)
};

/**
 * Main Structured Output Service
 */
export class StructuredOutputService {
  constructor() {
    this.schemas = StructuredOutputSchemas;
    this.validators = CompiledValidators;
    this.zodSchemas = ZodStructuredSchemas;
  }

  /**
   * Validate structured output against schema
   */
  validate(data, schemaType = 'envelope') {
    const validator = this.validators[schemaType];
    if (!validator) {
      throw new Error(`Unknown schema type: ${schemaType}`);
    }

    const isValid = validator(data);
    return {
      valid: isValid,
      errors: isValid ? [] : validator.errors || [],
      data: isValid ? data : null
    };
  }

  /**
   * Create standardized structured output envelope
   */
  createEnvelope(task, agent, data, options = {}) {
    const envelope = {
      id: options.id || this.generateId(),
      task,
      agent,
      status: options.status || 'success',
      timestamp: new Date().toISOString(),
      confidence: options.confidence,
      version: options.version || '1.0.0',
      metadata: options.metadata || {},
      data,
      warnings: options.warnings || [],
      errors: options.errors || []
    };

    // Remove undefined values
    Object.keys(envelope).forEach(key => 
      envelope[key] === undefined && delete envelope[key]
    );

    return envelope;
  }

  /**
   * Transform agent response into structured format
   */
  transformAgentResponse(agentResponse, agentName, taskType) {
    try {
      // Handle different agent response formats
      if (typeof agentResponse === 'string') {
        return this.createEnvelope(taskType, agentName, {
          content: agentResponse,
          format: 'text'
        });
      }

      if (agentResponse && typeof agentResponse === 'object') {
        // Check if already structured
        if (agentResponse.id && agentResponse.task && agentResponse.agent) {
          return agentResponse;
        }

        // Extract structured data if present
        let structuredData = agentResponse.structured || agentResponse.data || agentResponse;
        let metadata = agentResponse.metadata || {};
        let warnings = agentResponse.warnings || [];
        let errors = agentResponse.errors || [];

        // Determine confidence based on response
        let confidence = agentResponse.confidence;
        if (confidence === undefined && agentResponse.score) {
          confidence = Math.abs(agentResponse.score);
        }

        return this.createEnvelope(taskType, agentName, structuredData, {
          metadata,
          confidence,
          warnings,
          errors,
          status: errors.length > 0 ? 'error' : warnings.length > 0 ? 'warning' : 'success'
        });
      }

      // Fallback for unknown formats
      return this.createEnvelope(taskType, agentName, {
        raw_response: agentResponse,
        format: 'unknown'
      }, {
        status: 'warning',
        warnings: ['Unknown response format, storing as raw data']
      });

    } catch (error) {
      return this.createEnvelope(taskType, agentName, {
        error: error.message
      }, {
        status: 'error',
        errors: [{ code: 'TRANSFORM_ERROR', message: error.message }]
      });
    }
  }

  /**
   * Validate task-specific data
   */
  validateTaskData(data, taskType) {
    const validator = this.validators[taskType];
    if (!validator) {
      return {
        valid: true,
        errors: [],
        warnings: [`No specific validation for task type: ${taskType}`]
      };
    }

    const isValid = validator(data);
    return {
      valid: isValid,
      errors: isValid ? [] : validator.errors || [],
      warnings: []
    };
  }

  /**
   * Generate unique identifier
   */
  generateId() {
    return `struct_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get schema for task type
   */
  getTaskSchema(taskType) {
    return this.schemas.tasks[taskType] || null;
  }

  /**
   * List all available task schemas
   */
  getAvailableSchemas() {
    return Object.keys(this.schemas.tasks);
  }

  /**
   * Create structured output with full validation
   */
  createStructuredOutput(task, agent, data, options = {}) {
    // Create envelope
    const envelope = this.createEnvelope(task, agent, data, options);

    // Validate envelope
    const envelopeValidation = this.validate(envelope, 'envelope');
    if (!envelopeValidation.valid) {
      throw new Error(`Invalid envelope: ${JSON.stringify(envelopeValidation.errors)}`);
    }

    // Validate task-specific data
    const dataValidation = this.validateTaskData(data, task);
    if (!dataValidation.valid) {
      envelope.warnings = envelope.warnings || [];
      envelope.warnings.push(...dataValidation.errors.map(e => `Data validation: ${e.message}`));
      envelope.status = 'warning';
    }

    return envelope;
  }

  /**
   * Enrich structured output with metadata
   */
  enrichOutput(structuredOutput, enrichmentData = {}) {
    const enriched = { ...structuredOutput };

    // Add performance metrics
    if (enrichmentData.processingTime) {
      enriched.metadata = enriched.metadata || {};
      enriched.metadata.processing_time_ms = enrichmentData.processingTime;
    }

    // Add model information
    if (enrichmentData.model) {
      enriched.metadata = enriched.metadata || {};
      enriched.metadata.model_used = enrichmentData.model;
    }

    // Add cost information
    if (enrichmentData.cost) {
      enriched.metadata = enriched.metadata || {};
      enriched.metadata.cost_usd = enrichmentData.cost;
    }

    // Add token usage
    if (enrichmentData.tokens) {
      enriched.metadata = enriched.metadata || {};
      enriched.metadata.tokens_used = enrichmentData.tokens;
    }

    // Add quality metrics
    if (enrichmentData.quality) {
      enriched.metadata = enriched.metadata || {};
      enriched.metadata.quality_metrics = enrichmentData.quality;
    }

    return enriched;
  }
}

export default StructuredOutputService;

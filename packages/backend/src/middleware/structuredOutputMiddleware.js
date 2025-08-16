/**
 * Structured Output Middleware
 * 
 * Automatic capture and persistence of structured outputs from AI agents
 * Integrates with the conversation storage system and provides real-time processing
 * 
 * @author Robbie Allen - Lead Architect
 * @date January 2025
 */

import StructuredOutputService from '../services/StructuredOutputService.js';
import db from '../db.js';
import { traceOperation } from '../system/OpenTelemetryTracing.js';

export class StructuredOutputMiddleware {
  constructor() {
    this.structuredService = new StructuredOutputService();
    this.processingQueue = new Map();
    this.retryAttempts = 3;
    this.retryDelay = 1000; // 1 second
  }

  /**
   * Process agent response and extract structured outputs
   */
  async processAgentResponse(agentName, response, userId, conversationId, options = {}) {
    return traceOperation('structured_output.process', async (span) => {
      try {
        span.setAttributes({
          'agent.name': agentName,
          'user.id': userId,
          'conversation.id': conversationId,
          'response.type': typeof response
        });

        // Skip processing if response doesn't contain structured data
        if (!this.hasStructuredContent(response)) {
          span.setAttributes({ 'output.structured': false });
          return null;
        }

        span.setAttributes({ 'output.structured': true });

        // Extract structured outputs
        const structuredOutputs = await this.extractStructuredOutputs(response, agentName, options);

        if (structuredOutputs.length === 0) {
          return null;
        }

        // Process each structured output
        const processedOutputs = [];
        for (const output of structuredOutputs) {
          try {
            const processed = await this.processStructuredOutput(
              output, 
              userId, 
              conversationId, 
              agentName,
              options
            );
            processedOutputs.push(processed);
          } catch (error) {
            console.error('[StructuredOutput] Error processing output:', error);
            span.recordException(error);
          }
        }

        span.setAttributes({
          'outputs.extracted': structuredOutputs.length,
          'outputs.processed': processedOutputs.length
        });

        return processedOutputs;

      } catch (error) {
        console.error('[StructuredOutput] Error in processAgentResponse:', error);
        span.recordException(error);
        throw error;
      }
    });
  }

  /**
   * Check if response contains structured content
   */
  hasStructuredContent(response) {
    if (typeof response === 'string') {
      return false;
    }

    if (response && typeof response === 'object') {
      return !!(
        response.structured ||
        response.data ||
        response.analysis ||
        response.results ||
        response.insights ||
        response.metadata?.structured ||
        (response.messages && response.messages.some(m => m.structured))
      );
    }

    return false;
  }

  /**
   * Extract structured outputs from various response formats
   */
  async extractStructuredOutputs(response, agentName, options = {}) {
    const outputs = [];
    const taskType = options.taskType || this.inferTaskType(agentName, response);

    try {
      // Handle direct structured output
      if (response.structured) {
        outputs.push(this.structuredService.transformAgentResponse(
          { structured: response.structured },
          agentName,
          taskType
        ));
      }

      // Handle data field
      if (response.data) {
        outputs.push(this.structuredService.transformAgentResponse(
          { data: response.data },
          agentName,
          taskType
        ));
      }

      // Handle analysis results
      if (response.analysis) {
        outputs.push(this.structuredService.transformAgentResponse(
          response.analysis,
          agentName,
          'data_analysis'
        ));
      }

      // Handle messages with structured content
      if (response.messages) {
        for (const message of response.messages) {
          if (message.structured) {
            outputs.push(this.structuredService.transformAgentResponse(
              message.structured,
              agentName,
              taskType
            ));
          }
        }
      }

      // Handle LangChain AIMessage additional_kwargs
      if (response.additional_kwargs?.structured) {
        outputs.push(this.structuredService.transformAgentResponse(
          response.additional_kwargs.structured,
          agentName,
          taskType
        ));
      }

      // Handle specific agent result formats
      outputs.push(...this.extractAgentSpecificOutputs(response, agentName));

    } catch (error) {
      console.error('[StructuredOutput] Error extracting outputs:', error);
      // Create error output
      outputs.push(this.structuredService.createEnvelope(
        taskType,
        agentName,
        { error: error.message },
        {
          status: 'error',
          errors: [{ code: 'EXTRACTION_ERROR', message: error.message }]
        }
      ));
    }

    return outputs;
  }

  /**
   * Extract agent-specific structured outputs based on agent patterns
   */
  extractAgentSpecificOutputs(response, agentName) {
    const outputs = [];

    try {
      switch (agentName.toLowerCase()) {
        case 'analytics':
        case 'analyticsagent':
          if (response.insights || response.summary || response.charts) {
            outputs.push(this.structuredService.createEnvelope(
              'data_analysis',
              agentName,
              {
                summary: response.summary,
                insights: response.insights || [],
                charts: response.charts || [],
                statistics: response.statistics || {}
              }
            ));
          }
          break;

        case 'researcher':
        case 'researchagent':
          if (response.sources || response.findings) {
            outputs.push(this.structuredService.createEnvelope(
              'research_analysis',
              agentName,
              {
                query: response.query || 'Unknown',
                sources: response.sources || [],
                findings: response.findings || [],
                conclusion: response.conclusion || response.summary || '',
                limitations: response.limitations || []
              }
            ));
          }
          break;

        case 'codewriter':
        case 'codewriteragent':
          if (response.code || response.analysis || response.issues) {
            outputs.push(this.structuredService.createEnvelope(
              'code_analysis',
              agentName,
              {
                language: response.language || 'unknown',
                complexity: response.complexity || 'medium',
                quality_score: response.quality_score || response.score || 7,
                issues: response.issues || [],
                metrics: response.metrics || {},
                suggestions: response.suggestions || []
              }
            ));
          }
          break;

        case 'writer':
        case 'writeragent':
          if (response.content || response.text) {
            outputs.push(this.structuredService.createEnvelope(
              'content_generation',
              agentName,
              {
                content: response.content || response.text,
                word_count: response.word_count || this.countWords(response.content || response.text),
                reading_time: response.reading_time || Math.ceil((response.word_count || 0) / 200),
                language: response.language || 'en',
                tone: response.tone,
                style: response.style,
                topics: response.topics || [],
                quality_metrics: response.quality_metrics || {}
              }
            ));
          }
          break;

        case 'emotionalintelligence':
        case 'emotionalintelligenceagent':
          if (response.sentiment !== undefined || response.emotions) {
            outputs.push(this.structuredService.createEnvelope(
              'sentiment_analysis',
              agentName,
              {
                sentiment: response.sentiment || 'neutral',
                score: response.score || 0,
                confidence: response.confidence || 0.5,
                emotions: response.emotions || [],
                keywords: response.keywords || []
              }
            ));
          }
          break;

        case 'vision':
        case 'visionagent':
          if (response.description || response.objects || response.analysis) {
            outputs.push(this.structuredService.createEnvelope(
              'vision_analysis',
              agentName,
              {
                description: response.description || response.analysis || '',
                objects: response.objects || [],
                faces: response.faces || [],
                text: response.text || [],
                scene_analysis: response.scene_analysis || {}
              }
            ));
          }
          break;
      }
    } catch (error) {
      console.error('[StructuredOutput] Error in agent-specific extraction:', error);
    }

    return outputs;
  }

  /**
   * Process and persist structured output
   */
  async processStructuredOutput(output, userId, conversationId, agentName, options = {}) {
    return traceOperation('structured_output.persist', async (span) => {
      try {
        // Validate output
        const validation = this.structuredService.validate(output);
        if (!validation.valid) {
          span.setAttributes({ 'validation.valid': false });
          console.warn('[StructuredOutput] Validation failed:', validation.errors);
          
          // Try to fix common issues
          output = this.attemptOutputRepair(output, validation.errors);
          
          // Re-validate
          const revalidation = this.structuredService.validate(output);
          if (!revalidation.valid) {
            throw new Error(`Validation failed: ${JSON.stringify(revalidation.errors)}`);
          }
        }

        span.setAttributes({ 'validation.valid': true });

        // Enrich with additional metadata
        const enriched = this.structuredService.enrichOutput(output, {
          processingTime: options.processingTime,
          model: options.model,
          cost: options.cost,
          tokens: options.tokens,
          quality: options.quality
        });

        // Add system metadata
        enriched.metadata = enriched.metadata || {};
        enriched.metadata.user_id = userId;
        enriched.metadata.conversation_id = conversationId;
        enriched.metadata.processed_at = new Date().toISOString();
        enriched.metadata.middleware_version = '1.0.0';

        // Store in database (this will be handled by the conversation storage)
        await this.persistStructuredOutput(enriched, userId, conversationId);

        span.setAttributes({
          'output.id': enriched.id,
          'output.task': enriched.task,
          'output.status': enriched.status
        });

        return enriched;

      } catch (error) {
        console.error('[StructuredOutput] Error processing structured output:', error);
        span.recordException(error);
        throw error;
      }
    });
  }

  /**
   * Persist structured output to database
   */
  async persistStructuredOutput(output, userId, conversationId) {
    try {
      // The structured output will be stored as part of the conversation message metadata
      // This is handled by the conversation storage system, but we can also store it separately
      // for better queryability

      const query = `
        INSERT INTO structured_outputs (
          id, user_id, conversation_id, agent, task, status, 
          confidence, data, metadata, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        ON CONFLICT (id) DO UPDATE SET
          updated_at = NOW(),
          data = EXCLUDED.data,
          metadata = EXCLUDED.metadata
      `;

      await db.query(query, [
        output.id,
        userId,
        conversationId,
        output.agent,
        output.task,
        output.status,
        output.confidence || null,
        JSON.stringify(output.data),
        JSON.stringify(output.metadata),
        output.timestamp
      ]);

    } catch (error) {
      // If the table doesn't exist, we'll still have the data in conversation_messages
      console.warn('[StructuredOutput] Could not persist to structured_outputs table:', error.message);
    }
  }

  /**
   * Attempt to repair common output validation issues
   */
  attemptOutputRepair(output, errors) {
    const repaired = { ...output };

    for (const error of errors) {
      try {
        if (error.instancePath === '/id' && error.keyword === 'format') {
          repaired.id = this.structuredService.generateId();
        }
        
        if (error.instancePath === '/timestamp' && error.keyword === 'format') {
          repaired.timestamp = new Date().toISOString();
        }

        if (error.instancePath === '/status' && error.keyword === 'enum') {
          repaired.status = 'info';
        }

        if (error.instancePath === '/confidence' && error.keyword === 'maximum') {
          repaired.confidence = Math.min(repaired.confidence, 1);
        }

        if (error.instancePath === '/confidence' && error.keyword === 'minimum') {
          repaired.confidence = Math.max(repaired.confidence, 0);
        }
      } catch (repairError) {
        console.warn('[StructuredOutput] Error during repair:', repairError);
      }
    }

    return repaired;
  }

  /**
   * Infer task type from agent name and response content
   */
  inferTaskType(agentName, response) {
    const agentLower = agentName.toLowerCase();
    
    // Agent-based inference
    if (agentLower.includes('analytics')) return 'data_analysis';
    if (agentLower.includes('research')) return 'research_analysis';
    if (agentLower.includes('code')) return 'code_analysis';
    if (agentLower.includes('writer')) return 'content_generation';
    if (agentLower.includes('emotional') || agentLower.includes('sentiment')) return 'sentiment_analysis';
    if (agentLower.includes('vision')) return 'vision_analysis';
    if (agentLower.includes('audio')) return 'audio_analysis';

    // Content-based inference
    if (response && typeof response === 'object') {
      if (response.sentiment || response.emotions) return 'sentiment_analysis';
      if (response.code || response.language) return 'code_analysis';
      if (response.sources || response.findings) return 'research_analysis';
      if (response.insights || response.statistics) return 'data_analysis';
      if (response.objects || response.description) return 'vision_analysis';
      if (response.transcription || response.speakers) return 'audio_analysis';
      if (response.content || response.text) return 'content_generation';
    }

    return 'general_analysis';
  }

  /**
   * Count words in text
   */
  countWords(text) {
    if (!text || typeof text !== 'string') return 0;
    return text.trim().split(/\s+/).filter(word => word.length > 0).length;
  }

  /**
   * Get processing statistics
   */
  getStats() {
    return {
      processing_queue_size: this.processingQueue.size,
      total_schemas: this.structuredService.getAvailableSchemas().length,
      middleware_version: '1.0.0'
    };
  }

  /**
   * Clear processing queue (for testing/maintenance)
   */
  clearQueue() {
    this.processingQueue.clear();
  }
}

/**
 * Express middleware factory for automatic structured output processing
 */
export function createStructuredOutputMiddleware(options = {}) {
  const middleware = new StructuredOutputMiddleware();

  return async (req, res, next) => {
    // Store middleware instance for later use
    req.structuredOutputMiddleware = middleware;

    // Override res.json to capture responses
    const originalJson = res.json;
    res.json = function(data) {
      // Process if this looks like an agent response
      if (data && data.messages && req.user?.id) {
        setImmediate(async () => {
          try {
            await middleware.processAgentResponse(
              data.agent || 'unknown',
              data,
              req.user.id,
              data.conversation_id || req.body?.conversation_id,
              {
                taskType: req.body?.task_type,
                processingTime: data.processing_time,
                model: data.model,
                cost: data.cost,
                tokens: data.tokens
              }
            );
          } catch (error) {
            console.error('[StructuredOutput] Middleware processing error:', error);
          }
        });
      }

      return originalJson.call(this, data);
    };

    next();
  };
}

export default StructuredOutputMiddleware;

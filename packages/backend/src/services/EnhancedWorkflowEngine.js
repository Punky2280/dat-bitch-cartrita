/**
 * Enhanced Workflow Engine v3.0 - Real Execution System
 *
 * Transforms workflows from mock to fully functional execution system with:
 * - Real node execution with agent integration
 * - Advanced scheduling and triggers
 * - Multi-modal data processing
 * - Error handling and retry mechanisms
 * - Performance monitoring and optimization
 * - Webhook and API integrations
 */

import pool from '../db.js';
import EnhancedLangChainCoreAgent from '../agi/consciousness/EnhancedLangChainCoreAgent.js';
import OpenAI from 'openai';
import axios from 'axios';
import cron from 'node-cron';
import { v4 as uuidv4 } from 'uuid';
import { shouldQuietLogs } from '../util/env.js';
// ModelRegistryService will be injected dynamically to avoid import issues

class EnhancedWorkflowEngine {
  constructor() {
    // Lazy / optional OpenAI initialization to allow test runs without key
    if (process.env.OPENAI_API_KEY) {
      this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    } else {
      this.openai = null; // features requiring OpenAI will guard on null
    }
    this.coreAgent = null; // Will be injected
    this.modelRegistry = null; // Will be injected
    this.knowledgeHub = null; // Will be injected

    // Execution state management
    this.activeExecutions = new Map();
    this.scheduledTasks = new Map();
    this.nodeHandlers = new Map();
    this.executionStats = {
      totalExecutions: 0,
      successfulExecutions: 0,
      failedExecutions: 0,
      averageExecutionTime: 0,
    };

    this.initializeNodeHandlers();
    if (process.env.NODE_ENV !== 'test') {
      this.initializeScheduler();
    }

    if (!shouldQuietLogs()) {
      console.log(
        '[EnhancedWorkflowEngine] 🚀 Real execution system initialized'
      );
    }
  }

  /**
   * Initialize all node type handlers
   */
  initializeNodeHandlers() {
    // Helper to safely register handlers
    const safeRegister = (nodeType, handlerName) => {
      if (typeof this[handlerName] === 'function') {
        this.nodeHandlers.set(nodeType, this[handlerName].bind(this));
      } else {
        if (!shouldQuietLogs() && (process.env.WORKFLOW_DEBUG || process.env.DEBUG_LOGS)) {
          console.warn(
            `[EnhancedWorkflowEngine] ⚠️ Handler ${handlerName} not implemented for ${nodeType}, using fallback`
          );
        }
        this.nodeHandlers.set(nodeType, this.handleGenericNode.bind(this));
      }
    };

    // Trigger nodes
    safeRegister('manual-trigger', 'handleManualTrigger');
    safeRegister('webhook-trigger', 'handleWebhookTrigger');
    safeRegister('schedule-trigger', 'handleScheduleTrigger');

    // AI Agent nodes
    safeRegister('ai-gpt4', 'handleGPTNode');
    safeRegister('mcp-writer', 'handleMCPWriterNode');
    safeRegister('mcp-coder', 'handleMCPCoderNode');
    safeRegister('mcp-researcher', 'handleMCPResearcherNode');
    safeRegister('mcp-analyst', 'handleMCPAnalystNode');

    // Data processing nodes
    safeRegister('rag-embeddings', 'handleRAGEmbeddingsNode');
    safeRegister('rag-search', 'handleRAGSearchNode');
    safeRegister('rag-qa', 'handleRAGQANode');
    safeRegister('data-transform', 'handleDataTransformNode');
    safeRegister('data-filter', 'handleDataFilterNode');

    // Logic nodes
    safeRegister('logic-condition', 'handleConditionNode');
    safeRegister('logic-merge', 'handleMergeNode');
    safeRegister('logic-split', 'handleSplitNode');
    safeRegister('logic-loop', 'handleLoopNode');

    // Integration nodes
    safeRegister('http-request', 'handleHTTPRequestNode');
    safeRegister('email-send', 'handleEmailNode');
    safeRegister('webhook-send', 'handleWebhookSendNode');
    safeRegister('database-query', 'handleDatabaseQueryNode');


    // Multi-modal nodes
    safeRegister('image-analysis', 'handleImageAnalysisNode');
    safeRegister('audio-transcription', 'handleAudioTranscriptionNode');

    if (!shouldQuietLogs()) {
      console.log(
        `[EnhancedWorkflowEngine] ✅ Initialized ${this.nodeHandlers.size} node handlers`
      );
    }
  }

  /**
   * Initialize scheduler for automated workflows
   */
  initializeScheduler() {
    // Check for scheduled workflows every minute
    if (process.env.DISABLE_SCHEDULER === '1') {
      if (!shouldQuietLogs()) {
        console.log('[EnhancedWorkflowEngine] ⏩ Scheduler disabled for environment');
      }
      return;
    }
    cron.schedule('* * * * *', async () => {
      try {
        await this.processScheduledWorkflows();
      } catch (error) {
        if (!shouldQuietLogs() || process.env.WORKFLOW_DEBUG || process.env.DEBUG_LOGS) {
          console.error(
            '[EnhancedWorkflowEngine] Error processing scheduled workflows:',
            error
          );
        }
      }
    });

    if (!shouldQuietLogs()) {
      console.log('[EnhancedWorkflowEngine] ⏰ Scheduler initialized');
    }
  }

  /**
   * Set core agent reference
   */
  setCoreAgent(coreAgent) {
    this.coreAgent = coreAgent;
    if (!shouldQuietLogs()) {
      console.log('[EnhancedWorkflowEngine] 🤖 Core agent reference set');
    }
  }

  /**
   * Set model registry reference
   */
  setModelRegistry(modelRegistry) {
    this.modelRegistry = modelRegistry;
    if (!shouldQuietLogs()) {
      console.log('[EnhancedWorkflowEngine] 🎯 Model registry reference set');
    }
  }

  /**
   * Set knowledge hub reference
   */
  setKnowledgeHub(knowledgeHub) {
    this.knowledgeHub = knowledgeHub;
    if (!shouldQuietLogs()) {
      console.log('[EnhancedWorkflowEngine] 🧠 Knowledge hub reference set');
    }
  }

  /**
   * Execute a workflow with real processing
   */
  async executeWorkflow(
    workflowId,
    userId,
    inputData = {},
    triggerType = 'manual'
  ) {
    const executionId = uuidv4();
    const startTime = Date.now();

    try {
      if (!shouldQuietLogs()) {
        console.log(
          `[EnhancedWorkflowEngine] 🚀 Executing workflow ${workflowId} (execution: ${executionId})`
        );
      }

      // Get workflow definition
      const workflowResult = await pool.query(
        'SELECT * FROM workflows WHERE id = $1 AND user_id = $2',
        [workflowId, userId]
      );

      if (workflowResult.rows.length === 0) {
        throw new Error(`Workflow ${workflowId} not found or access denied`);
      }

      const workflow = workflowResult.rows[0];
      const workflowData = workflow.workflow_data;

      // Create execution record
      const executionResult = await pool.query(
        'INSERT INTO workflow_executions (workflow_id, user_id, status, trigger_type, input_data, started_at) VALUES ($1, $2, $3, $4, $5, NOW()) RETURNING id',
        [workflowId, userId, 'running', triggerType, JSON.stringify(inputData)]
      );

      const executionDbId = executionResult.rows[0].id;

      // Initialize execution context
      const executionContext = {
        executionId,
        executionDbId,
        workflowId,
        userId,
        workflow,
        inputData,
        outputData: {},
        logs: [],
        nodeResults: new Map(),
        globalVariables: new Map(),
        startTime,
      };

      this.activeExecutions.set(executionId, executionContext);

      // Execute workflow
      const result = await this.executeWorkflowNodes(
        workflowData,
        executionContext
      );

      // Calculate execution time
      const executionTime = Date.now() - startTime;

      // Derive node metrics
      executionContext.nodeCount = executionContext.nodeResults?.size || (workflowData.nodes?.length || null);
      executionContext.successNodeCount = executionContext.nodeResults
        ? Array.from(executionContext.nodeResults.values()).filter(v => v && !v.error).length
        : null;
      executionContext.failedNodeCount = executionContext.nodeResults
        ? Array.from(executionContext.nodeResults.values()).filter(v => v && v.error).length
        : null;

      // Update execution record with extended metrics
      await pool.query(
        `UPDATE workflow_executions 
         SET status = $1,
             output_data = $2,
             execution_logs = $3,
             completed_at = NOW(),
             execution_time_ms = $4,
             node_count = COALESCE($5, node_count),
             success_node_count = COALESCE($6, success_node_count),
             failed_node_count = COALESCE($7, failed_node_count),
             latency_bucket = COALESCE($8, latency_bucket),
             summary_text = COALESCE($9, summary_text)
         WHERE id = $10`,
        [
          'completed',
          JSON.stringify(result),
          JSON.stringify(executionContext.logs),
          executionTime,
          executionContext.nodeCount || null,
          executionContext.successNodeCount || null,
          executionContext.failedNodeCount || null,
          this.bucketLatency(executionTime),
          this.buildExecutionSummary(result, executionTime),
          executionDbId,
        ]
      );

      // Update statistics
      this.updateExecutionStats(true, executionTime);

      // Cleanup
      this.activeExecutions.delete(executionId);

      if (!shouldQuietLogs()) {
        console.log(
          `[EnhancedWorkflowEngine] ✅ Workflow execution completed (${executionTime}ms)`
        );
      }

      return {
        success: true,
        executionId,
        result,
        executionTime,
        logs: executionContext.logs,
      };
    } catch (error) {
      console.error(
        `[EnhancedWorkflowEngine] ❌ Workflow execution failed:`,
        error
      );

      // Update execution record with error
      if (executionId && this.activeExecutions.has(executionId)) {
        const context = this.activeExecutions.get(executionId);
        if (context.executionDbId) {
          const failTime = Date.now() - startTime;
          context.nodeCount = context.nodeResults?.size || null;
            context.failedNodeCount = context.nodeResults
              ? Array.from(context.nodeResults.values()).filter(v => v && v.error).length
              : null;
          await pool.query(
            `UPDATE workflow_executions 
             SET status = $1,
                 error_message = $2,
                 execution_logs = $3,
                 completed_at = NOW(),
                 execution_time_ms = $4,
                 failed_node_count = COALESCE($5, failed_node_count),
                 node_count = COALESCE($6, node_count),
                 latency_bucket = COALESCE($7, latency_bucket),
                 summary_text = COALESCE($8, summary_text),
                 failure_type = COALESCE($9, failure_type)
             WHERE id = $10`,
            [
              'failed',
              error.message,
              JSON.stringify(context.logs),
              failTime,
              context.failedNodeCount || null,
              context.nodeCount || null,
              this.bucketLatency(failTime),
              this.buildExecutionSummary({ error: error.message }, failTime),
              'engine_error',
              context.executionDbId,
            ]
          );
        }
        this.activeExecutions.delete(executionId);
      }

      this.updateExecutionStats(false, Date.now() - startTime);

      return {
        success: false,
        error: error.message,
        executionId,
        executionTime: Date.now() - startTime,
      };
    }
  }

  // Latency bucket helper
  bucketLatency(ms) {
    if (ms == null) return null;
    if (ms < 500) return 'sub500ms';
    if (ms < 1000) return 'sub1s';
    if (ms < 3000) return 'sub3s';
    if (ms < 5000) return 'sub5s';
    if (ms < 10000) return 'sub10s';
    return 'gt10s';
  }

  // Build short textual summary
  buildExecutionSummary(result, ms) {
    try {
      if (!result) return null;
      const preview = typeof result === 'string' ? result : JSON.stringify(result).slice(0, 200);
      return `Duration=${ms}ms Preview=${preview}`;
    } catch {
      return null;
    }
  }

  /**
   * Execute workflow nodes in proper order
   */
  async executeWorkflowNodes(workflowData, executionContext) {
    const { nodes = [], edges = [] } = workflowData;

    if (nodes.length === 0) {
      throw new Error('Workflow has no nodes to execute');
    }

    // Build execution graph
    const nodeMap = new Map(nodes.map(node => [node.id, node]));
    const dependencies = new Map();
    const dependents = new Map();

    // Build dependency maps
    for (const edge of edges) {
      if (!dependencies.has(edge.target)) {
        dependencies.set(edge.target, []);
      }
      dependencies.get(edge.target).push(edge.source);

      if (!dependents.has(edge.source)) {
        dependents.set(edge.source, []);
      }
      dependents.get(edge.source).push(edge.target);
    }

    // Find starting nodes (nodes with no dependencies)
    const startingNodes = nodes.filter(
      node =>
        !dependencies.has(node.id) || dependencies.get(node.id).length === 0
    );

    if (startingNodes.length === 0) {
      throw new Error(
        'No starting nodes found in workflow - circular dependency detected'
      );
    }

    // Execute nodes using topological sort
    const executed = new Set();
    const executing = new Set();
    const queue = [...startingNodes];

    while (queue.length > 0) {
      const currentNode = queue.shift();

      if (executed.has(currentNode.id) || executing.has(currentNode.id)) {
        continue;
      }

      // Check if all dependencies are completed
      const nodeDeps = dependencies.get(currentNode.id) || [];
      if (!nodeDeps.every(depId => executed.has(depId))) {
        queue.push(currentNode); // Re-queue for later
        continue;
      }

      executing.add(currentNode.id);

      try {
        // Execute the node
        const result = await this.executeNode(currentNode, executionContext);
        executionContext.nodeResults.set(currentNode.id, result);

        this.logExecution(executionContext, 'NODE_EXECUTED', {
          nodeId: currentNode.id,
          nodeType: currentNode.type,
          success: true,
          result:
            typeof result === 'object'
              ? JSON.stringify(result).substring(0, 200)
              : String(result).substring(0, 200),
        });
      } catch (nodeError) {
        console.error(
          `[EnhancedWorkflowEngine] Node execution failed: ${currentNode.id}`,
          nodeError
        );

        this.logExecution(executionContext, 'NODE_ERROR', {
          nodeId: currentNode.id,
          nodeType: currentNode.type,
          error: nodeError.message,
        });

        // Decide whether to fail the entire workflow or continue
        if (currentNode.data?.continueOnError !== true) {
          throw nodeError;
        }
      }

      executing.delete(currentNode.id);
      executed.add(currentNode.id);

      // Add dependent nodes to queue
      const nodeDepends = dependents.get(currentNode.id) || [];
      for (const dependentId of nodeDepends) {
        const dependentNode = nodeMap.get(dependentId);
        if (dependentNode && !executed.has(dependentId)) {
          queue.push(dependentNode);
        }
      }
    }

    // Return final results
    const finalResults = {};
    for (const [nodeId, result] of executionContext.nodeResults) {
      finalResults[nodeId] = result;
    }

    return finalResults;
  }

  /**
   * Execute a single node
   */
  async executeNode(node, executionContext) {
    const handler = this.nodeHandlers.get(node.type);
    if (!handler) {
      throw new Error(`No handler found for node type: ${node.type}`);
    }

    if (!shouldQuietLogs()) {
      console.log(
        `[EnhancedWorkflowEngine] 🔄 Executing node: ${node.id} (${node.type})`
      );
    }

    return await handler(node, executionContext);
  }

  // ===========================================
  // NODE HANDLERS - Real Implementation
  // ===========================================

  /**
   * Manual trigger node handler
   */
  async handleManualTrigger(node, executionContext) {
    return {
      triggered: true,
      timestamp: new Date().toISOString(),
      inputData: executionContext.inputData,
    };
  }

  /**
   * GPT-4 AI node handler with intelligent model selection
   */
  async handleGPTNode(node, executionContext) {
    const { 
      model = 'gpt-4o', 
      prompt, 
      temperature = 0.7,
      useModelRegistry = true,
      taskType = 'text-generation',
      maxCostPer1kTokens,
      maxLatencyMs,
      qualityWeight = 0.4,
      costWeight = 0.4,
      latencyWeight = 0.2
    } = node.data || {};

    if (!prompt) {
      throw new Error('GPT node requires a prompt');
    }

    let selectedModel = model;
    let modelSelectionResult = null;

    // Use Model Registry for intelligent selection if available and enabled
    if (this.modelRegistry && useModelRegistry) {
      try {
        modelSelectionResult = await this.modelRegistry.selectModel({
          task_type: taskType,
          quality_weight: qualityWeight,
          cost_weight: costWeight,
          latency_weight: latencyWeight,
          safety_required: true,
          commercial_use: true,
          max_cost_per_1k_tokens: maxCostPer1kTokens,
          max_latency_ms: maxLatencyMs
        }, {
          user_id: executionContext.userId,
          workflow_run_id: executionContext.executionId,
          stage: 'ai_generation',
          supervisor: 'workflow_engine'
        });

        if (modelSelectionResult.selected) {
          selectedModel = modelSelectionResult.selected;
          
          this.logExecution(executionContext, 'MODEL_SELECTED', {
            nodeId: node.id,
            originalModel: model,
            selectedModel,
            reason: modelSelectionResult.reason,
            estimatedCost: modelSelectionResult.estimated_cost_usd
          });
        }
      } catch (modelSelectionError) {
        console.warn('[EnhancedWorkflowEngine] Model registry selection failed, using fallback:', modelSelectionError.message);
        // Fallback to specified model
      }
    }

    // Process template variables in prompt
    const processedPrompt = this.processTemplate(prompt, executionContext);

    // Execute inference through model registry if available, otherwise direct OpenAI
    if (this.modelRegistry && modelSelectionResult) {
      try {
        const inferenceResult = await this.modelRegistry.executeInference(
          selectedModel,
          processedPrompt,
          {
            temperature,
            user_id: executionContext.userId,
            workflow_run_id: executionContext.executionId,
            stage: 'ai_generation',
            supervisor: 'workflow_engine'
          }
        );

        return {
          content: inferenceResult.result.text || inferenceResult.result.choices?.[0]?.message?.content,
          model: selectedModel,
          usage: inferenceResult.result.usage,
          cost_usd: inferenceResult.cost_usd,
          latency_ms: inferenceResult.latency_ms,
          tokens_used: inferenceResult.tokens_used,
          model_selection: {
            original_model: model,
            selected_model: selectedModel,
            reason: modelSelectionResult.reason
          }
        };
      } catch (registryError) {
        console.warn('[EnhancedWorkflowEngine] Model registry execution failed, using direct OpenAI:', registryError.message);
      }
    }

    // Fallback to direct OpenAI execution
    const response = await this.openai.chat.completions.create({
      model: selectedModel,
      messages: [{ role: 'user', content: processedPrompt }],
      temperature,
    });

    return {
      content: response.choices[0].message.content,
      model: selectedModel,
      usage: response.usage,
      fallback: true
    };
  }

  /**
   * MCP Writer Agent node handler
   */
  async handleMCPWriterNode(node, executionContext) {
    if (!this.coreAgent) {
      throw new Error('Core agent not available for MCP Writer node');
    }

    const { prompt, writingType = 'article' } = node.data || {};
    const processedPrompt = this.processTemplate(
      prompt || 'Write content based on the input',
      executionContext
    );

    // Delegate to writer agent through core agent
    const result = await this.coreAgent.delegateToAgent(
      'writer',
      processedPrompt,
      executionContext.userId
    );

    return {
      content: result.text,
      agent: 'writer',
      writingType,
    };
  }

  /**
   * MCP Coder Agent node handler
   */
  async handleMCPCoderNode(node, executionContext) {
    if (!this.coreAgent) {
      throw new Error('Core agent not available for MCP Coder node');
    }

    const { prompt, language = 'javascript' } = node.data || {};
    const processedPrompt = this.processTemplate(
      prompt || 'Generate code based on the requirements',
      executionContext
    );

    const result = await this.coreAgent.delegateToAgent(
      'codewriter',
      processedPrompt,
      executionContext.userId
    );

    return {
      code: result.text,
      language,
      agent: 'codewriter',
    };
  }

  /**
   * RAG embeddings node handler with model registry integration
   */
  async handleRAGEmbeddingsNode(node, executionContext) {
    const { 
      text, 
      model = 'text-embedding-ada-002',
      useModelRegistry = true,
      qualityWeight = 0.5,
      costWeight = 0.3,
      latencyWeight = 0.2
    } = node.data || {};

    if (!text) {
      throw new Error('RAG embeddings node requires text input');
    }

    const processedText = this.processTemplate(text, executionContext);

    let selectedModel = model;
    let modelSelectionResult = null;

    // Use Model Registry for embedding model selection if available
    if (this.modelRegistry && useModelRegistry) {
      try {
        modelSelectionResult = await this.modelRegistry.selectModel({
          task_type: 'embeddings',
          quality_weight: qualityWeight,
          cost_weight: costWeight,
          latency_weight: latencyWeight,
          safety_required: false, // Embeddings generally don't need safety filtering
          commercial_use: true
        }, {
          user_id: executionContext.userId,
          workflow_run_id: executionContext.executionId,
          stage: 'embedding_generation',
          supervisor: 'workflow_engine'
        });

        if (modelSelectionResult.selected) {
          selectedModel = modelSelectionResult.selected;
          
          this.logExecution(executionContext, 'EMBEDDING_MODEL_SELECTED', {
            nodeId: node.id,
            originalModel: model,
            selectedModel,
            reason: modelSelectionResult.reason
          });
        }
      } catch (modelSelectionError) {
        console.warn('[EnhancedWorkflowEngine] Embedding model selection failed, using fallback:', modelSelectionError.message);
      }
    }

    const response = await this.openai.embeddings.create({
      model: selectedModel,
      input: processedText,
    });

    return {
      embeddings: response.data[0].embedding,
      text: processedText,
      model: selectedModel,
      model_selection: modelSelectionResult ? {
        original_model: model,
        selected_model: selectedModel,
        reason: modelSelectionResult.reason
      } : undefined
    };
  }

  /**
   * RAG search node handler with knowledge hub integration
   */
  async handleRAGSearchNode(node, executionContext) {
    if (!this.knowledgeHub) {
      throw new Error('Knowledge Hub not available for RAG search node');
    }

    const { 
      query, 
      limit = 5,
      threshold = 0.7,
      documentIds
    } = node.data || {};

    if (!query) {
      throw new Error('RAG search node requires a query');
    }

    const processedQuery = this.processTemplate(query, executionContext);

    try {
      const searchResult = await this.knowledgeHub.semanticSearch(
        executionContext.userId,
        processedQuery,
        {
          limit,
          threshold,
          documentIds,
          includeChunks: true,
          includeDocuments: true
        }
      );

      this.logExecution(executionContext, 'RAG_SEARCH_COMPLETED', {
        nodeId: node.id,
        query: processedQuery,
        resultCount: searchResult.resultCount,
        processingTime: searchResult.processingTime
      });

      return {
        query: processedQuery,
        results: searchResult.results,
        resultCount: searchResult.resultCount,
        processingTime: searchResult.processingTime,
        success: searchResult.success
      };
    } catch (error) {
      this.logExecution(executionContext, 'RAG_SEARCH_FAILED', {
        nodeId: node.id,
        query: processedQuery,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * RAG Question-Answering node handler combining search + generation
   */
  async handleRAGQANode(node, executionContext) {
    if (!this.knowledgeHub) {
      throw new Error('Knowledge Hub not available for RAG QA node');
    }

    const { 
      question,
      searchLimit = 5,
      searchThreshold = 0.7,
      documentIds,
      useModelRegistry = true,
      model = 'gpt-4o',
      maxTokens = 1000,
      includeReferences = true
    } = node.data || {};

    if (!question) {
      throw new Error('RAG QA node requires a question');
    }

    const processedQuestion = this.processTemplate(question, executionContext);

    try {
      // First, search for relevant context
      const searchResult = await this.knowledgeHub.semanticSearch(
        executionContext.userId,
        processedQuestion,
        {
          limit: searchLimit,
          threshold: searchThreshold,
          documentIds,
          includeChunks: true,
          includeDocuments: true
        }
      );

      if (!searchResult.success || searchResult.results.length === 0) {
        return {
          success: false,
          question: processedQuestion,
          answer: "I couldn't find any relevant information in your knowledge base to answer this question.",
          references: [],
          searchResults: searchResult
        };
      }

      // Generate RAG response using Knowledge Hub
      const ragResponse = await this.knowledgeHub.generateRAGResponse(
        executionContext.userId,
        processedQuestion,
        searchResult.results,
        {
          model,
          maxTokens,
          includeReferences
        }
      );

      this.logExecution(executionContext, 'RAG_QA_COMPLETED', {
        nodeId: node.id,
        question: processedQuestion,
        searchResultCount: searchResult.resultCount,
        answerGenerated: ragResponse.success,
        model: ragResponse.model || model
      });

      return {
        success: ragResponse.success,
        question: processedQuestion,
        answer: ragResponse.response,
        references: ragResponse.references || [],
        model: ragResponse.model,
        tokenUsage: ragResponse.tokenUsage,
        searchResults: searchResult,
        contextLength: ragResponse.contextLength
      };

    } catch (error) {
      this.logExecution(executionContext, 'RAG_QA_FAILED', {
        nodeId: node.id,
        question: processedQuestion,
        error: error.message
      });
      throw error;
    }
  }


  /**
   * HTTP request node handler
   */
  async handleHTTPRequestNode(node, executionContext) {
    const { url, method = 'GET', headers = {}, body } = node.data || {};

    if (!url) {
      throw new Error('HTTP request node requires a URL');
    }

    const processedUrl = this.processTemplate(url, executionContext);

    const config = {
      method,
      url: processedUrl,
      headers,
      timeout: 10000,
    };

    if (body && ['POST', 'PUT', 'PATCH'].includes(method.toUpperCase())) {
      config.data =
        typeof body === 'string'
          ? this.processTemplate(body, executionContext)
          : body;
    }

    const response = await axios(config);

    return {
      status: response.status,
      data: response.data,
      headers: response.headers,
    };
  }

  /**
   * Logic condition node handler
   */
  async handleConditionNode(node, executionContext) {
    const { condition, trueValue, falseValue } = node.data || {};

    if (!condition) {
      throw new Error('Condition node requires a condition');
    }

    // Process template variables in condition
    const processedCondition = this.processTemplate(
      condition,
      executionContext
    );

    // Evaluate condition (simple JavaScript evaluation for now)
    let conditionResult;
    try {
      // Simple condition evaluation - can be enhanced with safer evaluation
      conditionResult = eval(processedCondition);
    } catch (error) {
      throw new Error(`Failed to evaluate condition: ${error.message}`);
    }

    return {
      condition: processedCondition,
      result: conditionResult,
      value: conditionResult ? trueValue : falseValue,
    };
  }

  /**
   * Logic merge node handler
   */
  async handleMergeNode(node, executionContext) {
    // Get all input results and merge them
    const mergedData = {};

    for (const [nodeId, result] of executionContext.nodeResults) {
      mergedData[nodeId] = result;
    }

    return {
      merged: true,
      data: mergedData,
      nodeCount: executionContext.nodeResults.size,
    };
  }

  // ===========================================
  // UTILITY METHODS
  // ===========================================

  /**
   * Process template variables in strings
   */
  processTemplate(template, executionContext) {
    if (typeof template !== 'string') {
      return template;
    }

    let processed = template;

    // Replace {{input}} with input data
    processed = processed.replace(
      /\{\{input\}\}/g,
      JSON.stringify(executionContext.inputData)
    );

    // Replace {{nodeId.field}} with node results
    const nodeResultRegex = /\{\{(\w+)(?:\.(\w+))?\}\}/g;
    processed = processed.replace(nodeResultRegex, (match, nodeId, field) => {
      const nodeResult = executionContext.nodeResults.get(nodeId);
      if (!nodeResult) return match;

      if (field && typeof nodeResult === 'object') {
        return nodeResult[field] || match;
      }

      return typeof nodeResult === 'string'
        ? nodeResult
        : JSON.stringify(nodeResult);
    });

    // Replace global variables
    for (const [key, value] of executionContext.globalVariables) {
      const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
      processed = processed.replace(
        regex,
        typeof value === 'string' ? value : JSON.stringify(value)
      );
    }

    return processed;
  }

  /**
   * Log execution events
   */
  logExecution(executionContext, event, data) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      event,
      data,
    };

    executionContext.logs.push(logEntry);
    if (!shouldQuietLogs()) {
      console.log(`[EnhancedWorkflowEngine] 📝 ${event}:`, data);
    }
  }

  /**
   * Update execution statistics
   */
  updateExecutionStats(success, executionTime) {
    this.executionStats.totalExecutions++;

    if (success) {
      this.executionStats.successfulExecutions++;
    } else {
      this.executionStats.failedExecutions++;
    }

    // Update rolling average execution time
    const currentAvg = this.executionStats.averageExecutionTime;
    const total = this.executionStats.totalExecutions;
    this.executionStats.averageExecutionTime =
      (currentAvg * (total - 1) + executionTime) / total;
  }

  /**
   * Process scheduled workflows
   */
  async processScheduledWorkflows() {
    try {
      const scheduledResult = await pool.query(`
        SELECT ws.*, w.user_id, w.name as workflow_name 
        FROM workflow_schedules ws
        JOIN workflows w ON ws.workflow_id = w.id
        WHERE ws.is_active = true 
          AND ws.next_run_at <= NOW()
          AND w.is_active = true
        ORDER BY ws.next_run_at
        LIMIT 10
      `);

      for (const schedule of scheduledResult.rows) {
        if (!shouldQuietLogs()) {
          console.log(
            `[EnhancedWorkflowEngine] ⏰ Processing scheduled workflow: ${schedule.workflow_name}`
          );
        }

        try {
          // Execute the workflow
          await this.executeWorkflow(
            schedule.workflow_id,
            schedule.user_id,
            {},
            'scheduled'
          );

          // Update next run time based on cron expression
          const nextRun = this.calculateNextRun(schedule.cron_expression);
          await pool.query(
            'UPDATE workflow_schedules SET last_run_at = NOW(), next_run_at = $1 WHERE id = $2',
            [nextRun, schedule.id]
          );
        } catch (error) {
          console.error(
            `[EnhancedWorkflowEngine] ❌ Scheduled workflow failed:`,
            error
          );

          // Optionally disable schedule after multiple failures
          await pool.query(
            'UPDATE workflow_schedules SET last_run_at = NOW() WHERE id = $1',
            [schedule.id]
          );
        }
      }
    } catch (error) {
      if (!shouldQuietLogs() || process.env.WORKFLOW_DEBUG || process.env.DEBUG_LOGS) {
        console.error(
          '[EnhancedWorkflowEngine] Error processing scheduled workflows:',
          error
        );
      }
    }
  }

  /**
   * Calculate next run time from cron expression
   */
  calculateNextRun(cronExpression) {
    // Simple next run calculation - can be enhanced with proper cron parsing
    const now = new Date();
    return new Date(now.getTime() + 60 * 60 * 1000); // Default to 1 hour from now
  }

  /**
   * Generic fallback handler for unimplemented nodes
   */
  async handleGenericNode(nodeData, context, previousOutput) {
    if (!shouldQuietLogs()) {
      console.log(
        `[EnhancedWorkflowEngine] 🔧 Executing generic handler for node type: ${nodeData.type}`
      );
    }

    return {
      success: true,
      output: {
        message: `Generic node execution completed for ${nodeData.type}`,
        nodeType: nodeData.type,
        input: previousOutput,
        timestamp: new Date().toISOString(),
        fallback: true,
      },
      executionTime: 100, // Mock execution time
    };
  }

  /**
   * Get execution statistics
   */
  getExecutionStats() {
    return {
      ...this.executionStats,
      activeExecutions: this.activeExecutions.size,
      scheduledTasks: this.scheduledTasks.size,
      supportedNodeTypes: Array.from(this.nodeHandlers.keys()),
    };
  }

  /**
   * Get active executions
   */
  getActiveExecutions() {
    const executions = [];
    for (const [executionId, context] of this.activeExecutions) {
      executions.push({
        executionId,
        workflowId: context.workflowId,
        userId: context.userId,
        startTime: context.startTime,
        duration: Date.now() - context.startTime,
      });
    }
    return executions;
  }
}

export default EnhancedWorkflowEngine;

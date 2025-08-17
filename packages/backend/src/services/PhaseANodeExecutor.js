/**
 * Phase A Node Types Implementation
 * 
 * Implements the four foundational node types for Phase A:
 * - Transform: Data manipulation and processing
 * - HTTP Request: External API integration capabilities  
 * - Delay: Workflow timing and scheduling control
 * - Set Variable: Context and state management
 */

import PhaseAExpressionEngine from './PhaseAExpressionEngine.js';
import axios from 'axios';

class PhaseANodeExecutor {
  constructor() {
    this.expressionEngine = new PhaseAExpressionEngine();
  }

  /**
   * Execute a Phase A node based on its type
   */
  async executeNode(node, context = {}) {
    const { type, data = {} } = node;

    try {
      switch (type) {
        case 'transform':
          return await this.executeTransformNode(data, context);
        case 'http-request':
          return await this.executeHttpRequestNode(data, context);
        case 'delay':
          return await this.executeDelayNode(data, context);
        case 'set-variable':
          return await this.executeSetVariableNode(data, context);
        default:
          throw new Error(`Unknown node type: ${type}`);
      }
    } catch (error) {
      throw new Error(`Node execution failed (${type}): ${error.message}`);
    }
  }

  /**
   * Transform Node: Data manipulation and processing
   */
  async executeTransformNode(data, context) {
    const {
      input = 'input',
      transformations = [],
      outputField = 'output'
    } = data;

    // Get input data
    let inputData = this.expressionEngine.getNestedValue(context, input);
    
    if (inputData === undefined) {
      inputData = context.input || context;
    }

    let result = inputData;

    // Apply transformations sequentially
    for (const transformation of transformations) {
      const { type, config = {} } = transformation;

      switch (type) {
        case 'map':
          result = await this.applyMapTransformation(result, config, context);
          break;
        case 'filter':
          result = await this.applyFilterTransformation(result, config, context);
          break;
        case 'extract':
          result = await this.applyExtractTransformation(result, config, context);
          break;
        case 'format':
          result = await this.applyFormatTransformation(result, config, context);
          break;
        default:
          throw new Error(`Unknown transformation type: ${type}`);
      }
    }

    return {
      [outputField]: result,
      metadata: {
        nodeType: 'transform',
        transformationsApplied: transformations.length,
        timestamp: new Date().toISOString()
      }
    };
  }

  /**
   * HTTP Request Node: External API integration
   */
  async executeHttpRequestNode(data, context) {
    const {
      method = 'GET',
      url,
      headers = {},
      body,
      timeout = 10000,
      retries = 0,
      responseType = 'json'
    } = data;

    if (!url) {
      throw new Error('URL is required for HTTP request node');
    }

    // Process template variables in URL, headers, and body
    const processedUrl = this.expressionEngine.processTemplate(url, context);
    const processedHeaders = this.processObjectTemplates(headers, context);
    const processedBody = body ? this.expressionEngine.processTemplate(JSON.stringify(body), context) : undefined;

    const requestConfig = {
      method: method.toUpperCase(),
      url: processedUrl,
      headers: processedHeaders,
      timeout,
      responseType: responseType === 'json' ? 'json' : 'text'
    };

    if (processedBody && ['POST', 'PUT', 'PATCH'].includes(method.toUpperCase())) {
      requestConfig.data = processedBody ? JSON.parse(processedBody) : undefined;
    }

    let lastError;
    let attempt = 0;

    while (attempt <= retries) {
      try {
        const response = await axios(requestConfig);
        
        return {
          statusCode: response.status,
          data: response.data,
          headers: response.headers,
          metadata: {
            nodeType: 'http-request',
            method: method.toUpperCase(),
            url: processedUrl,
            attempt: attempt + 1,
            timestamp: new Date().toISOString()
          }
        };
      } catch (error) {
        lastError = error;
        attempt++;
        
        if (attempt <= retries) {
          // Wait before retry with exponential backoff
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    // All retries failed
    throw new Error(`HTTP request failed after ${retries + 1} attempts: ${lastError.message}`);
  }

  /**
   * Delay Node: Workflow timing and scheduling control
   */
  async executeDelayNode(data, context) {
    const {
      duration = 1000,
      unit = 'milliseconds',
      condition,
      maxWait = 30000
    } = data;

    // Convert duration to milliseconds
    let delayMs = duration;
    switch (unit.toLowerCase()) {
      case 'seconds':
        delayMs = duration * 1000;
        break;
      case 'minutes':
        delayMs = duration * 60 * 1000;
        break;
      case 'hours':
        delayMs = duration * 60 * 60 * 1000;
        break;
      case 'milliseconds':
      default:
        delayMs = duration;
        break;
    }

    // Cap maximum delay for safety
    delayMs = Math.min(delayMs, maxWait);

    const startTime = Date.now();

    // If condition is specified, wait for condition to be true
    if (condition) {
      return await this.waitForCondition(condition, context, delayMs);
    }

    // Simple delay
    await new Promise(resolve => setTimeout(resolve, delayMs));

    return {
      delayed: true,
      duration: delayMs,
      actualDelay: Date.now() - startTime,
      metadata: {
        nodeType: 'delay',
        unit,
        timestamp: new Date().toISOString()
      }
    };
  }

  /**
   * Set Variable Node: Context and state management
   */
  async executeSetVariableNode(data, context) {
    const {
      variableName,
      value,
      type = 'string',
      scope = 'local'
    } = data;

    if (!variableName) {
      throw new Error('Variable name is required for set-variable node');
    }

    // Process value template
    let processedValue = this.expressionEngine.processTemplate(String(value), context);

    // Convert to specified type
    switch (type.toLowerCase()) {
      case 'number':
        processedValue = Number(processedValue);
        if (isNaN(processedValue)) {
          throw new Error(`Cannot convert "${value}" to number`);
        }
        break;
      case 'boolean':
        processedValue = ['true', '1', 'yes', 'on'].includes(String(processedValue).toLowerCase());
        break;
      case 'json':
        try {
          processedValue = JSON.parse(processedValue);
        } catch (error) {
          throw new Error(`Invalid JSON value: ${error.message}`);
        }
        break;
      case 'string':
      default:
        // Already a string from template processing
        break;
    }

    // Set variable in appropriate scope
    const result = {
      variableName,
      value: processedValue,
      type,
      scope,
      metadata: {
        nodeType: 'set-variable',
        timestamp: new Date().toISOString()
      }
    };

    // Return the variable assignment for context updating
    return {
      ...result,
      setVariable: {
        name: variableName,
        value: processedValue,
        scope
      }
    };
  }

  // Helper Methods

  /**
   * Process object templates (for headers, etc.)
   */
  processObjectTemplates(obj, context) {
    const processed = {};
    for (const [key, value] of Object.entries(obj)) {
      processed[key] = this.expressionEngine.processTemplate(String(value), context);
    }
    return processed;
  }

  /**
   * Apply map transformation
   */
  async applyMapTransformation(data, config, context) {
    const { expression, field } = config;
    
    if (Array.isArray(data)) {
      return data.map((item, index) => {
        const itemContext = { ...context, item, index };
        if (field) {
          return {
            ...item,
            [field]: this.expressionEngine.processTemplate(expression, itemContext)
          };
        }
        return this.expressionEngine.processTemplate(expression, itemContext);
      });
    }
    
    return this.expressionEngine.processTemplate(expression, { ...context, data });
  }

  /**
   * Apply filter transformation
   */
  async applyFilterTransformation(data, config, context) {
    const { condition } = config;
    
    if (Array.isArray(data)) {
      return data.filter((item, index) => {
        const itemContext = { ...context, item, index };
        const result = this.expressionEngine.processTemplate(condition, itemContext);
        return ['true', true, '1', 1].includes(result);
      });
    }
    
    return data;
  }

  /**
   * Apply extract transformation
   */
  async applyExtractTransformation(data, config, context) {
    const { fields } = config;
    
    if (typeof data === 'object' && data !== null) {
      const extracted = {};
      for (const field of fields) {
        extracted[field] = this.expressionEngine.getNestedValue(data, field);
      }
      return extracted;
    }
    
    return data;
  }

  /**
   * Apply format transformation
   */
  async applyFormatTransformation(data, config, context) {
    const { template } = config;
    return this.expressionEngine.processTemplate(template, { ...context, data });
  }

  /**
   * Wait for condition to be true
   */
  async waitForCondition(condition, context, maxWait) {
    const startTime = Date.now();
    const checkInterval = 100; // Check every 100ms

    while (Date.now() - startTime < maxWait) {
      const result = this.expressionEngine.processTemplate(condition, context);
      if (['true', true, '1', 1].includes(result)) {
        return {
          conditionMet: true,
          waitTime: Date.now() - startTime,
          metadata: {
            nodeType: 'delay',
            condition,
            timestamp: new Date().toISOString()
          }
        };
      }
      
      await new Promise(resolve => setTimeout(resolve, checkInterval));
    }

    return {
      conditionMet: false,
      waitTime: Date.now() - startTime,
      timedOut: true,
      metadata: {
        nodeType: 'delay',
        condition,
        timestamp: new Date().toISOString()
      }
    };
  }
}

export default PhaseANodeExecutor;
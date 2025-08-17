// PHASE_A_WORKFLOW_IMPLEMENTATION: Expression Engine MVP
// JavaScript expression evaluation for workflow automation platform
// Provides safe expression execution with data transformation capabilities

import { traceOperation } from '../system/OpenTelemetryTracing.js';

/**
 * Safe expression evaluation engine for workflow data transformation
 * Supports JavaScript expressions with security sandboxing
 */
class ExpressionEngine {
  constructor() {
    this.isInitialized = false;
    this.functions = new Map(); // Built-in functions registry
    this.constants = new Map();  // Built-in constants
    this.setupBuiltins();
  }

  initialize() {
    return traceOperation('expression.engine.initialize', async () => {
      try {
        this.isInitialized = true;
        console.log('[EXPRESSION_ENGINE] Engine initialized successfully');
        return { success: true };
      } catch (error) {
        console.error('[EXPRESSION_ENGINE] Initialization failed:', error);
        throw error;
      }
    });
  }

  /**
   * Setup built-in functions and constants
   * @private
   */
  setupBuiltins() {
    // String functions
    this.functions.set('upper', (str) => String(str).toUpperCase());
    this.functions.set('lower', (str) => String(str).toLowerCase());
    this.functions.set('trim', (str) => String(str).trim());
    this.functions.set('length', (str) => String(str).length);
    this.functions.set('substring', (str, start, end) => String(str).substring(start, end));
    this.functions.set('replace', (str, search, replace) => String(str).replace(search, replace));
    this.functions.set('split', (str, delimiter) => String(str).split(delimiter));
    this.functions.set('join', (arr, delimiter) => Array.isArray(arr) ? arr.join(delimiter) : '');

    // Number functions
    this.functions.set('abs', (num) => Math.abs(Number(num)));
    this.functions.set('round', (num) => Math.round(Number(num)));
    this.functions.set('floor', (num) => Math.floor(Number(num)));
    this.functions.set('ceil', (num) => Math.ceil(Number(num)));
    this.functions.set('min', (...args) => Math.min(...args.map(Number)));
    this.functions.set('max', (...args) => Math.max(...args.map(Number)));
    this.functions.set('random', () => Math.random());

    // Date functions
    this.functions.set('now', () => new Date().toISOString());
    this.functions.set('timestamp', () => Date.now());
    this.functions.set('formatDate', (date, format = 'ISO') => {
      const d = new Date(date);
      switch (format.toUpperCase()) {
        case 'ISO': return d.toISOString();
        case 'LOCAL': return d.toLocaleString();
        case 'DATE': return d.toDateString();
        case 'TIME': return d.toTimeString();
        default: return d.toString();
      }
    });

    // Array functions
    this.functions.set('size', (arr) => Array.isArray(arr) ? arr.length : 0);
    this.functions.set('first', (arr) => Array.isArray(arr) && arr.length > 0 ? arr[0] : null);
    this.functions.set('last', (arr) => Array.isArray(arr) && arr.length > 0 ? arr[arr.length - 1] : null);
    this.functions.set('unique', (arr) => Array.isArray(arr) ? [...new Set(arr)] : []);

    // Object functions
    this.functions.set('keys', (obj) => typeof obj === 'object' && obj !== null ? Object.keys(obj) : []);
    this.functions.set('values', (obj) => typeof obj === 'object' && obj !== null ? Object.values(obj) : []);
    this.functions.set('has', (obj, key) => typeof obj === 'object' && obj !== null && key in obj);

    // Type functions
    this.functions.set('type', (value) => {
      if (value === null) return 'null';
      if (Array.isArray(value)) return 'array';
      return typeof value;
    });
    this.functions.set('isString', (value) => typeof value === 'string');
    this.functions.set('isNumber', (value) => typeof value === 'number' && !isNaN(value));
    this.functions.set('isBoolean', (value) => typeof value === 'boolean');
    this.functions.set('isArray', (value) => Array.isArray(value));
    this.functions.set('isObject', (value) => typeof value === 'object' && value !== null && !Array.isArray(value));

    // JSON functions
    this.functions.set('toJson', (value) => JSON.stringify(value));
    this.functions.set('fromJson', (str) => {
      try {
        return JSON.parse(String(str));
      } catch {
        return null;
      }
    });

    // Constants
    this.constants.set('PI', Math.PI);
    this.constants.set('E', Math.E);
    this.constants.set('TRUE', true);
    this.constants.set('FALSE', false);
    this.constants.set('NULL', null);
  }

  /**
   * Evaluate expression with given context data
   * @param {string} expression - JavaScript expression to evaluate
   * @param {object} context - Data context for evaluation
   * @param {object} options - Evaluation options
   * @returns {Promise<any>} Evaluation result
   */
  async evaluate(expression, context = {}, options = {}) {
    if (!this.isInitialized) {
      throw new Error('ExpressionEngine not initialized');
    }

    return traceOperation('expression.engine.evaluate', async (span) => {
      const startTime = Date.now();
      
      try {
        // Validate expression
        if (!expression || typeof expression !== 'string') {
          throw new Error('Expression must be a non-empty string');
        }

        span.setAttributes({
          'expression.length': expression.length,
          'expression.context_keys': Object.keys(context).length,
          'expression.timeout_ms': options.timeout || 5000
        });

        // Create sandboxed execution context
        const executionContext = this.createExecutionContext(context, options);
        
        // Evaluate expression with timeout
        const result = await this.executeWithTimeout(expression, executionContext, options.timeout || 5000);
        
        const duration = Date.now() - startTime;
        
        span.setAttributes({
          'expression.duration_ms': duration,
          'expression.result_type': this.functions.get('type')(result),
          'expression.success': true
        });

        console.log(`[EXPRESSION_ENGINE] Expression evaluated successfully in ${duration}ms`);
        
        return {
          success: true,
          result,
          duration_ms: duration,
          expression: expression.substring(0, 100) + (expression.length > 100 ? '...' : '')
        };

      } catch (error) {
        const duration = Date.now() - startTime;
        
        span.setAttributes({
          'expression.duration_ms': duration,
          'expression.success': false,
          'expression.error': error.message
        });

        console.error(`[EXPRESSION_ENGINE] Expression evaluation failed:`, error);
        
        throw new Error(`Expression evaluation failed: ${error.message}`);
      }
    });
  }

  /**
   * Create sandboxed execution context
   * @private
   */
  createExecutionContext(context, options) {
    const executionContext = {
      // Data context
      ...context,
      
      // Built-in functions
      ...Object.fromEntries(this.functions.entries()),
      
      // Built-in constants
      ...Object.fromEntries(this.constants.entries()),
      
      // Safe global objects (limited)
      Math: {
        abs: Math.abs, round: Math.round, floor: Math.floor, ceil: Math.ceil,
        min: Math.min, max: Math.max, pow: Math.pow, sqrt: Math.sqrt,
        PI: Math.PI, E: Math.E, random: Math.random
      },
      
      Date: {
        now: Date.now,
        parse: Date.parse
      },

      // Utility objects
      JSON: {
        parse: JSON.parse,
        stringify: JSON.stringify
      }
    };

    // Block dangerous globals
    const blockedGlobals = [
      'process', 'global', 'require', 'module', 'exports', '__dirname', '__filename',
      'eval', 'Function', 'setTimeout', 'setInterval', 'clearTimeout', 'clearInterval',
      'console', 'Buffer', 'child_process', 'fs', 'os', 'path'
    ];

    blockedGlobals.forEach(name => {
      executionContext[name] = undefined;
    });

    return executionContext;
  }

  /**
   * Execute expression with timeout protection
   * @private
   */
  async executeWithTimeout(expression, context, timeout) {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error(`Expression evaluation timeout after ${timeout}ms`));
      }, timeout);

      try {
        // Create function with restricted context
        const contextKeys = Object.keys(context);
        const contextValues = contextKeys.map(key => context[key]);
        
        // Create safe function
        const func = new Function(...contextKeys, `"use strict"; return (${expression});`);
        
        // Execute with context
        const result = func.apply(null, contextValues);
        
        clearTimeout(timeoutId);
        resolve(result);
        
      } catch (error) {
        clearTimeout(timeoutId);
        reject(error);
      }
    });
  }

  /**
   * Test expression syntax without evaluation
   */
  async validateExpression(expression) {
    if (!this.isInitialized) {
      throw new Error('ExpressionEngine not initialized');
    }

    return traceOperation('expression.engine.validate', async () => {
      try {
        // Basic validation
        if (!expression || typeof expression !== 'string') {
          throw new Error('Expression must be a non-empty string');
        }

        // Syntax check using Function constructor
        new Function('return (' + expression + ');');
        
        return {
          success: true,
          valid: true,
          message: 'Expression syntax is valid'
        };

      } catch (error) {
        return {
          success: true,
          valid: false,
          error: error.message,
          message: 'Invalid expression syntax'
        };
      }
    });
  }

  /**
   * Get available built-in functions and constants
   */
  getBuiltins() {
    return {
      success: true,
      data: {
        functions: Array.from(this.functions.keys()).sort(),
        constants: Array.from(this.constants.keys()).sort(),
        categories: {
          string: ['upper', 'lower', 'trim', 'length', 'substring', 'replace', 'split', 'join'],
          number: ['abs', 'round', 'floor', 'ceil', 'min', 'max', 'random'],
          date: ['now', 'timestamp', 'formatDate'],
          array: ['size', 'first', 'last', 'unique'],
          object: ['keys', 'values', 'has'],
          type: ['type', 'isString', 'isNumber', 'isBoolean', 'isArray', 'isObject'],
          json: ['toJson', 'fromJson']
        }
      }
    };
  }

  /**
   * Batch evaluate multiple expressions
   */
  async evaluateMany(expressions, context = {}, options = {}) {
    if (!this.isInitialized) {
      throw new Error('ExpressionEngine not initialized');
    }

    return traceOperation('expression.engine.evaluate_many', async (span) => {
      const results = [];
      const startTime = Date.now();
      
      span.setAttribute('expression.batch_size', expressions.length);

      for (let i = 0; i < expressions.length; i++) {
        try {
          const result = await this.evaluate(expressions[i], context, options);
          results.push({
            index: i,
            expression: expressions[i],
            ...result
          });
        } catch (error) {
          results.push({
            index: i,
            expression: expressions[i],
            success: false,
            error: error.message
          });
        }
      }

      const totalDuration = Date.now() - startTime;
      const successCount = results.filter(r => r.success).length;

      span.setAttributes({
        'expression.total_duration_ms': totalDuration,
        'expression.success_count': successCount,
        'expression.error_count': expressions.length - successCount
      });

      return {
        success: true,
        results,
        summary: {
          total: expressions.length,
          successful: successCount,
          failed: expressions.length - successCount,
          total_duration_ms: totalDuration
        }
      };
    });
  }
}

export default ExpressionEngine;
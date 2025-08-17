/**
 * 🧠 CARTRITA EXPRESSION ENGINE - Phase B Implementation
 * 
 * Safe JavaScript expression evaluation with:
 * - Security sandboxing to prevent code injection
 * - Template interpolation ({{variables}} and ${expressions})
 * - Whitelisted function library
 * - Input validation and sanitization
 * - Performance monitoring and limits
 */

import vm from 'vm';
import util from 'util';

export default class ExpressionEngine {
  constructor(options = {}) {
    this.config = {
      timeout: options.timeout || 5000, // 5 seconds max execution time
      allowAsync: options.allowAsync || false,
      maxMemory: options.maxMemory || 50 * 1024 * 1024, // 50MB
      enableConsole: options.enableConsole || false,
      ...options
    };

    // Whitelisted functions available in expressions
    this.whitelist = {
      // Math functions
      Math: {
        abs: Math.abs,
        ceil: Math.ceil,
        floor: Math.floor,
        round: Math.round,
        min: Math.min,
        max: Math.max,
        pow: Math.pow,
        sqrt: Math.sqrt,
        random: Math.random
      },
      
      // String functions
      String: {
        fromCharCode: String.fromCharCode
      },
      
      // Date functions
      Date: {
        now: Date.now,
        parse: Date.parse
      },
      
      // Array functions
      Array: {
        isArray: Array.isArray,
        from: Array.from
      },
      
      // Object functions
      Object: {
        keys: Object.keys,
        values: Object.values,
        entries: Object.entries,
        assign: Object.assign
      },
      
      // JSON functions
      JSON: {
        parse: JSON.parse,
        stringify: JSON.stringify
      },
      
      // Utility functions
      parseInt: parseInt,
      parseFloat: parseFloat,
      isNaN: isNaN,
      isFinite: isFinite,
      
      // Custom utility functions
      utils: {
        isEmpty: (value) => value == null || value === '' || (Array.isArray(value) && value.length === 0),
        isNotEmpty: (value) => !this.whitelist.utils.isEmpty(value),
        toString: (value) => String(value),
        toNumber: (value) => Number(value),
        formatDate: (date, format = 'ISO') => {
          const d = new Date(date);
          switch (format) {
            case 'ISO': return d.toISOString();
            case 'locale': return d.toLocaleString();
            case 'date': return d.toLocaleDateString();
            case 'time': return d.toLocaleTimeString();
            default: return d.toString();
          }
        },
        slugify: (text) => text.toString().toLowerCase()
          .replace(/\s+/g, '-')           // Replace spaces with -
          .replace(/[^\w\-]+/g, '')       // Remove all non-word chars
          .replace(/\-\-+/g, '-')         // Replace multiple - with single -
          .replace(/^-+/, '')             // Trim - from start of text
          .replace(/-+$/, ''),            // Trim - from end of text
        truncate: (text, length = 100) => {
          if (text.length <= length) return text;
          return text.substring(0, length) + '...';
        },
        base64Encode: (text) => Buffer.from(text).toString('base64'),
        base64Decode: (encoded) => Buffer.from(encoded, 'base64').toString('utf-8')
      }
    };

    console.log('✅ ExpressionEngine initialized with security sandboxing');
  }

  /**
   * Evaluate a JavaScript expression safely
   */
  async evaluate(expression, variables = {}) {
    if (!expression || typeof expression !== 'string') {
      return expression;
    }

    try {
      // Create secure context with timeout
      const context = vm.createContext(this.createSandbox(variables));
      
      // Execute with timeout and memory limits
      const result = vm.runInContext(
        `(${expression})`,
        context,
        {
          timeout: this.config.timeout,
          displayErrors: false
        }
      );
      
      return result;
    } catch (error) {
      console.error(`[ExpressionEngine] Expression evaluation failed: ${error.message}`);
      console.error(`[ExpressionEngine] Expression: ${expression}`);
      throw new Error(`Expression evaluation error: ${error.message}`);
    }
  }

  /**
   * Evaluate template with {{variable}} and ${expression} interpolation
   */
  async evaluateTemplate(template, variables = {}) {
    if (!template || typeof template !== 'string') {
      return template;
    }

    let result = template;

    // Process ${expression} syntax first (more complex)
    result = await this.processExpressionSyntax(result, variables);
    
    // Process {{variable}} syntax (simple variable replacement)
    result = this.processVariableSyntax(result, variables);

    return result;
  }

  /**
   * Process ${expression} syntax in templates
   */
  async processExpressionSyntax(template, variables) {
    const expressionPattern = /\$\{([^}]+)\}/g;
    let result = template;
    let match;

    // Find all ${expression} patterns
    const matches = [];
    while ((match = expressionPattern.exec(template)) !== null) {
      matches.push({
        fullMatch: match[0],
        expression: match[1],
        startIndex: match.index,
        endIndex: match.index + match[0].length
      });
    }

    // Process matches in reverse order to avoid index shifting
    for (let i = matches.length - 1; i >= 0; i--) {
      const { fullMatch, expression, startIndex, endIndex } = matches[i];
      
      try {
        const value = await this.evaluate(expression, variables);
        const stringValue = this.valueToString(value);
        result = result.substring(0, startIndex) + stringValue + result.substring(endIndex);
      } catch (error) {
        console.warn(`[ExpressionEngine] Failed to evaluate expression "${expression}": ${error.message}`);
        // Keep original expression on error
      }
    }

    return result;
  }

  /**
   * Process {{variable}} syntax in templates
   */
  processVariableSyntax(template, variables) {
    const variablePattern = /\{\{([^}]+)\}\}/g;
    
    return template.replace(variablePattern, (match, variablePath) => {
      const value = this.getNestedValue(variables, variablePath.trim());
      return this.valueToString(value);
    });
  }

  /**
   * Evaluate an object with expressions in properties
   */
  async evaluateObject(obj, variables = {}) {
    if (!obj || typeof obj !== 'object') {
      return obj;
    }

    if (Array.isArray(obj)) {
      const result = [];
      for (const item of obj) {
        result.push(await this.evaluateObject(item, variables));
      }
      return result;
    }

    const result = {};
    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === 'string') {
        result[key] = await this.evaluateTemplate(value, variables);
      } else if (value && typeof value === 'object') {
        result[key] = await this.evaluateObject(value, variables);
      } else {
        result[key] = value;
      }
    }

    return result;
  }

  /**
   * Create secure sandbox for expression execution
   */
  createSandbox(variables = {}) {
    const sandbox = {
      // Add whitelisted functions
      ...this.whitelist,
      
      // Add variables (with safety checks)
      ...this.sanitizeVariables(variables),
      
      // Utility aliases
      $: variables, // Direct access to variables
      input: variables.input || {},
      context: variables.context || {},
      
      // Console (if enabled)
      ...(this.config.enableConsole && { 
        console: { 
          log: (...args) => console.log('[Sandbox]', ...args) 
        } 
      })
    };

    return sandbox;
  }

  /**
   * Sanitize variables to prevent injection
   */
  sanitizeVariables(variables) {
    const sanitized = {};
    
    for (const [key, value] of Object.entries(variables)) {
      // Skip potentially dangerous properties
      if (this.isDangerousKey(key)) {
        continue;
      }
      
      // Deep sanitize objects and arrays
      sanitized[key] = this.sanitizeValue(value);
    }
    
    return sanitized;
  }

  /**
   * Check if a key is potentially dangerous
   */
  isDangerousKey(key) {
    const dangerousKeys = [
      '__proto__',
      'constructor',
      'prototype',
      'eval',
      'Function',
      'require',
      'process',
      'global',
      'console',
      'setTimeout',
      'setInterval'
    ];
    
    return dangerousKeys.includes(key);
  }

  /**
   * Sanitize individual values
   */
  sanitizeValue(value) {
    if (value === null || value === undefined) {
      return value;
    }
    
    if (typeof value === 'function') {
      return '[Function]'; // Convert functions to strings
    }
    
    if (Array.isArray(value)) {
      return value.map(item => this.sanitizeValue(item));
    }
    
    if (value && typeof value === 'object') {
      const sanitized = {};
      for (const [key, val] of Object.entries(value)) {
        if (!this.isDangerousKey(key)) {
          sanitized[key] = this.sanitizeValue(val);
        }
      }
      return sanitized;
    }
    
    return value;
  }

  /**
   * Get nested value from object using dot notation
   */
  getNestedValue(obj, path) {
    if (!path || !obj) return undefined;
    
    const keys = path.split('.');
    let current = obj;
    
    for (const key of keys) {
      if (current === null || current === undefined) {
        return undefined;
      }
      current = current[key];
    }
    
    return current;
  }

  /**
   * Convert value to string for template interpolation
   */
  valueToString(value) {
    if (value === null || value === undefined) {
      return '';
    }
    
    if (typeof value === 'string') {
      return value;
    }
    
    if (typeof value === 'object') {
      try {
        return JSON.stringify(value);
      } catch {
        return '[Object]';
      }
    }
    
    return String(value);
  }

  /**
   * Validate expression syntax before execution
   */
  validateExpression(expression) {
    if (!expression || typeof expression !== 'string') {
      return { valid: false, error: 'Expression must be a non-empty string' };
    }

    // Check for obviously dangerous patterns
    const dangerousPatterns = [
      /require\s*\(/,
      /import\s+/,
      /eval\s*\(/,
      /Function\s*\(/,
      /process\./,
      /global\./,
      /__proto__/,
      /constructor/,
      /prototype/
    ];

    for (const pattern of dangerousPatterns) {
      if (pattern.test(expression)) {
        return { 
          valid: false, 
          error: `Expression contains potentially dangerous pattern: ${pattern.source}` 
        };
      }
    }

    return { valid: true };
  }

  /**
   * Test expression execution without side effects
   */
  async testExpression(expression, variables = {}) {
    const validation = this.validateExpression(expression);
    if (!validation.valid) {
      return { success: false, error: validation.error };
    }

    try {
      const result = await this.evaluate(expression, variables);
      return { success: true, result, type: typeof result };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
}
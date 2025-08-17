/**
 * Phase A Expression Engine - Safe Variable Interpolation System
 * 
 * Provides secure variable substitution without eval() usage,
 * following whitelist-based function library approach.
 */

class PhaseAExpressionEngine {
  constructor() {
    // Whitelist of allowed functions for expressions
    this.allowedFunctions = {
      // String functions
      toUpperCase: (str) => String(str).toUpperCase(),
      toLowerCase: (str) => String(str).toLowerCase(),
      trim: (str) => String(str).trim(),
      substring: (str, start, end) => String(str).substring(start, end),
      replace: (str, search, replace) => String(str).replace(search, replace),
      
      // Math functions
      add: (a, b) => Number(a) + Number(b),
      subtract: (a, b) => Number(a) - Number(b),
      multiply: (a, b) => Number(a) * Number(b),
      divide: (a, b) => Number(a) / Number(b),
      round: (num) => Math.round(Number(num)),
      
      // Array functions
      length: (arr) => Array.isArray(arr) ? arr.length : String(arr).length,
      join: (arr, separator = ',') => Array.isArray(arr) ? arr.join(separator) : arr,
      
      // Type conversion
      toString: (val) => String(val),
      toNumber: (val) => Number(val),
      
      // Date functions
      now: () => new Date().toISOString(),
      formatDate: (date) => new Date(date).toLocaleDateString(),
      
      // Conditional functions
      equals: (a, b) => a === b,
      notEquals: (a, b) => a !== b,
      greaterThan: (a, b) => Number(a) > Number(b),
      lessThan: (a, b) => Number(a) < Number(b),
    };
  }

  /**
   * Process template string with variable substitution
   * Supports {{variable}} and {{function(args)}} syntax
   */
  processTemplate(template, context = {}) {
    if (typeof template !== 'string') {
      return template;
    }

    let processed = template;

    // Replace simple variables {{variableName}}
    processed = processed.replace(/\{\{([^}()]+)\}\}/g, (match, variableName) => {
      const trimmed = variableName.trim();
      
      // Handle nested object access like input.data.field
      const value = this.getNestedValue(context, trimmed);
      return value !== undefined ? this.sanitizeValue(value) : match;
    });

    // Replace function calls {{functionName(args)}}
    processed = processed.replace(/\{\{([^}]+\([^}]*\))\}\}/g, (match, expression) => {
      try {
        const result = this.evaluateFunction(expression.trim(), context);
        return result !== undefined ? this.sanitizeValue(result) : match;
      } catch (error) {
        console.warn(`Expression evaluation failed for "${expression}":`, error.message);
        return match; // Keep original if evaluation fails
      }
    });

    return processed;
  }

  /**
   * Get nested value from object using dot notation
   */
  getNestedValue(obj, path) {
    return path.split('.').reduce((current, key) => {
      return current && current[key] !== undefined ? current[key] : undefined;
    }, obj);
  }

  /**
   * Evaluate function call expression safely
   */
  evaluateFunction(expression, context) {
    // Parse function name and arguments
    const match = expression.match(/^(\w+)\s*\(\s*(.*?)\s*\)$/);
    if (!match) {
      throw new Error(`Invalid function syntax: ${expression}`);
    }

    const [, functionName, argsString] = match;

    if (!this.allowedFunctions[functionName]) {
      throw new Error(`Function not allowed: ${functionName}`);
    }

    // Parse arguments
    const args = this.parseArguments(argsString, context);
    
    // Execute function safely
    return this.allowedFunctions[functionName](...args);
  }

  /**
   * Parse function arguments from string
   */
  parseArguments(argsString, context) {
    if (!argsString.trim()) {
      return [];
    }

    const args = [];
    const parts = argsString.split(',');

    for (const part of parts) {
      const trimmed = part.trim();
      
      // String literal (quoted)
      if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || 
          (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
        args.push(trimmed.slice(1, -1));
      }
      // Number literal
      else if (/^-?\d+(\.\d+)?$/.test(trimmed)) {
        args.push(Number(trimmed));
      }
      // Boolean literal
      else if (trimmed === 'true' || trimmed === 'false') {
        args.push(trimmed === 'true');
      }
      // Variable reference
      else {
        const value = this.getNestedValue(context, trimmed);
        args.push(value);
      }
    }

    return args;
  }

  /**
   * Sanitize value for safe output
   */
  sanitizeValue(value) {
    if (value === null || value === undefined) {
      return '';
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
   * Validate expression for security
   */
  validateExpression(expression) {
    const dangerous = [
      'eval', 'Function', 'setTimeout', 'setInterval',
      'require', 'import', 'process', 'global',
      '__', 'constructor', 'prototype'
    ];

    for (const danger of dangerous) {
      if (expression.includes(danger)) {
        throw new Error(`Dangerous pattern detected: ${danger}`);
      }
    }

    return true;
  }

  /**
   * Add custom function to whitelist
   */
  addFunction(name, fn) {
    if (typeof name !== 'string' || typeof fn !== 'function') {
      throw new Error('Function name must be string and fn must be function');
    }
    
    this.allowedFunctions[name] = fn;
  }

  /**
   * Remove function from whitelist
   */
  removeFunction(name) {
    delete this.allowedFunctions[name];
  }
}

export default PhaseAExpressionEngine;
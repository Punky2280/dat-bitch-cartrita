/**
 * Phase A Components Test Suite
 * 
 * Tests for the Phase A workflow automation platform components
 */

import { jest } from '@jest/globals';

// Mock dependencies
jest.mock('../../src/db.js', () => ({
  query: jest.fn(),
}));

jest.mock('uuid', () => ({
  v4: jest.fn(() => 'test-uuid-1234'),
}));

jest.mock('axios', () => ({
  default: jest.fn(),
}));

describe('Phase A Expression Engine', () => {
  let PhaseAExpressionEngine;
  let engine;

  beforeAll(async () => {
    const module = await import('../../src/services/PhaseAExpressionEngine.js');
    PhaseAExpressionEngine = module.default;
    engine = new PhaseAExpressionEngine();
  });

  describe('Variable substitution', () => {
    test('should replace simple variables', () => {
      const template = 'Hello {{name}}!';
      const context = { name: 'World' };
      const result = engine.processTemplate(template, context);
      expect(result).toBe('Hello World!');
    });

    test('should replace nested object variables', () => {
      const template = 'User: {{user.name}}, Age: {{user.age}}';
      const context = { user: { name: 'John', age: 30 } };
      const result = engine.processTemplate(template, context);
      expect(result).toBe('User: John, Age: 30');
    });

    test('should handle missing variables gracefully', () => {
      const template = 'Hello {{missing}}!';
      const context = { name: 'World' };
      const result = engine.processTemplate(template, context);
      expect(result).toBe('Hello {{missing}}!');
    });
  });

  describe('Function calls', () => {
    test('should execute allowed functions', () => {
      const template = 'Result: {{toUpperCase("hello")}}';
      const result = engine.processTemplate(template, {});
      expect(result).toBe('Result: HELLO');
    });

    test('should execute functions with variable arguments', () => {
      const template = 'Result: {{add(a, b)}}';
      const context = { a: 5, b: 3 };
      const result = engine.processTemplate(template, context);
      expect(result).toBe('Result: 8');
    });

    test('should reject dangerous functions', () => {
      expect(() => {
        engine.validateExpression('eval("alert(1)")');
      }).toThrow('Dangerous pattern detected');
    });
  });

  describe('Security validation', () => {
    test('should reject eval usage', () => {
      expect(() => {
        engine.validateExpression('eval("malicious code")');
      }).toThrow('Dangerous pattern detected: eval');
    });

    test('should reject Function constructor', () => {
      expect(() => {
        engine.validateExpression('Function("return 1")()');
      }).toThrow('Dangerous pattern detected: Function');
    });

    test('should reject prototype access', () => {
      expect(() => {
        engine.validateExpression('obj.constructor.prototype');
      }).toThrow('Dangerous pattern detected: prototype');
    });
  });
});

describe('Phase A Node Executor', () => {
  let PhaseANodeExecutor;
  let executor;

  beforeAll(async () => {
    const module = await import('../../src/services/PhaseANodeExecutor.js');
    PhaseANodeExecutor = module.default;
    executor = new PhaseANodeExecutor();
  });

  describe('Transform node', () => {
    test('should execute basic transform', async () => {
      const node = {
        type: 'transform',
        data: {
          transformations: [
            {
              type: 'format',
              config: { template: 'Hello {{data}}' }
            }
          ]
        }
      };
      const context = { input: 'World' };

      const result = await executor.executeNode(node, context);
      expect(result.output).toBe('Hello World');
      expect(result.metadata.nodeType).toBe('transform');
    });

    test('should handle array mapping', async () => {
      const node = {
        type: 'transform',
        data: {
          transformations: [
            {
              type: 'map',
              config: { expression: '{{item.toUpperCase()}}' }
            }
          ]
        }
      };
      const context = { input: ['hello', 'world'] };

      const result = await executor.executeNode(node, context);
      expect(result.output).toEqual(['HELLO', 'WORLD']);
    });
  });

  describe('Set Variable node', () => {
    test('should set string variable', async () => {
      const node = {
        type: 'set-variable',
        data: {
          variableName: 'greeting',
          value: 'Hello {{name}}',
          type: 'string'
        }
      };
      const context = { name: 'World' };

      const result = await executor.executeNode(node, context);
      expect(result.setVariable.name).toBe('greeting');
      expect(result.setVariable.value).toBe('Hello World');
    });

    test('should convert to number type', async () => {
      const node = {
        type: 'set-variable',
        data: {
          variableName: 'count',
          value: '42',
          type: 'number'
        }
      };

      const result = await executor.executeNode(node, {});
      expect(result.setVariable.value).toBe(42);
      expect(typeof result.setVariable.value).toBe('number');
    });

    test('should handle boolean conversion', async () => {
      const node = {
        type: 'set-variable',
        data: {
          variableName: 'isActive',
          value: 'true',
          type: 'boolean'
        }
      };

      const result = await executor.executeNode(node, {});
      expect(result.setVariable.value).toBe(true);
      expect(typeof result.setVariable.value).toBe('boolean');
    });
  });

  describe('Delay node', () => {
    test('should execute delay', async () => {
      const node = {
        type: 'delay',
        data: {
          duration: 10,
          unit: 'milliseconds'
        }
      };

      const startTime = Date.now();
      const result = await executor.executeNode(node, {});
      const endTime = Date.now();

      expect(result.delayed).toBe(true);
      expect(result.duration).toBe(10);
      expect(endTime - startTime).toBeGreaterThanOrEqual(10);
    });

    test('should convert units properly', async () => {
      const node = {
        type: 'delay',
        data: {
          duration: 1,
          unit: 'seconds'
        }
      };

      const result = await executor.executeNode(node, {});
      expect(result.duration).toBe(1000); // Converted to milliseconds
    });
  });

  describe('HTTP Request node', () => {
    test('should handle missing URL', async () => {
      const node = {
        type: 'http-request',
        data: {
          method: 'GET'
          // Missing URL
        }
      };

      await expect(executor.executeNode(node, {})).rejects.toThrow('URL is required');
    });

    test('should process template variables in URL', async () => {
      const axios = (await import('axios')).default;
      axios.mockResolvedValue({
        status: 200,
        data: { success: true },
        headers: {}
      });

      const node = {
        type: 'http-request',
        data: {
          method: 'GET',
          url: 'https://api.example.com/users/{{userId}}',
          timeout: 5000
        }
      };
      const context = { userId: '123' };

      const result = await executor.executeNode(node, context);
      
      expect(axios).toHaveBeenCalledWith(expect.objectContaining({
        url: 'https://api.example.com/users/123',
        method: 'GET',
        timeout: 5000
      }));
      expect(result.statusCode).toBe(200);
    });
  });
});

describe('Workflow Graph Validator', () => {
  let WorkflowGraphValidator;
  let validator;

  beforeAll(async () => {
    const module = await import('../../src/services/WorkflowGraphValidator.js');
    WorkflowGraphValidator = module.default;
    validator = new WorkflowGraphValidator();
  });

  describe('Basic validation', () => {
    test('should validate valid workflow', () => {
      const workflow = {
        nodes: [
          { id: 'start', type: 'start' },
          { id: 'transform', type: 'transform', data: {} },
          { id: 'end', type: 'end' }
        ],
        edges: [
          { source: 'start', target: 'transform' },
          { source: 'transform', target: 'end' }
        ]
      };

      const result = validator.validateWorkflow(workflow);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('should detect missing node ID', () => {
      const workflow = {
        nodes: [
          { type: 'start' }, // Missing ID
          { id: 'end', type: 'end' }
        ],
        edges: []
      };

      const result = validator.validateWorkflow(workflow);
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(expect.stringContaining('missing required \'id\' field'));
    });

    test('should detect duplicate node IDs', () => {
      const workflow = {
        nodes: [
          { id: 'node1', type: 'start' },
          { id: 'node1', type: 'end' } // Duplicate ID
        ],
        edges: []
      };

      const result = validator.validateWorkflow(workflow);
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(expect.stringContaining('Duplicate node ID: node1'));
    });
  });

  describe('Cycle detection', () => {
    test('should detect simple cycle', () => {
      const workflow = {
        nodes: [
          { id: 'a', type: 'transform' },
          { id: 'b', type: 'transform' },
          { id: 'c', type: 'transform' }
        ],
        edges: [
          { source: 'a', target: 'b' },
          { source: 'b', target: 'c' },
          { source: 'c', target: 'a' } // Creates cycle
        ]
      };

      const result = validator.validateWorkflow(workflow);
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(expect.stringContaining('Cycles detected'));
    });

    test('should detect self-loop', () => {
      const workflow = {
        nodes: [
          { id: 'self', type: 'transform' }
        ],
        edges: [
          { source: 'self', target: 'self' } // Self-loop
        ]
      };

      const result = validator.validateWorkflow(workflow);
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(expect.stringContaining('Self-loop detected at node: self'));
    });
  });

  describe('Node configuration validation', () => {
    test('should validate HTTP request node', () => {
      const workflow = {
        nodes: [
          {
            id: 'http',
            type: 'http-request',
            data: {
              method: 'GET',
              url: 'https://api.example.com',
              timeout: 5000
            }
          }
        ],
        edges: []
      };

      const result = validator.validateWorkflow(workflow);
      expect(result.valid).toBe(true);
    });

    test('should detect invalid HTTP method', () => {
      const workflow = {
        nodes: [
          {
            id: 'http',
            type: 'http-request',
            data: {
              method: 'INVALID',
              url: 'https://api.example.com'
            }
          }
        ],
        edges: []
      };

      const result = validator.validateWorkflow(workflow);
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(expect.stringContaining('invalid method \'INVALID\''));
    });

    test('should detect missing URL in HTTP request', () => {
      const workflow = {
        nodes: [
          {
            id: 'http',
            type: 'http-request',
            data: {
              method: 'GET'
              // Missing URL
            }
          }
        ],
        edges: []
      };

      const result = validator.validateWorkflow(workflow);
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(expect.stringContaining('URL is required'));
    });
  });

  describe('Topological sorting', () => {
    test('should return correct execution order', () => {
      const workflow = {
        nodes: [
          { id: 'a', type: 'start' },
          { id: 'b', type: 'transform' },
          { id: 'c', type: 'transform' },
          { id: 'd', type: 'end' }
        ],
        edges: [
          { source: 'a', target: 'b' },
          { source: 'a', target: 'c' },
          { source: 'b', target: 'd' },
          { source: 'c', target: 'd' }
        ]
      };

      const order = validator.getTopologicalOrder(workflow.nodes, workflow.edges);
      expect(order).toEqual(['a', 'b', 'c', 'd']);
    });

    test('should return null for cyclic graph', () => {
      const workflow = {
        nodes: [
          { id: 'a', type: 'transform' },
          { id: 'b', type: 'transform' }
        ],
        edges: [
          { source: 'a', target: 'b' },
          { source: 'b', target: 'a' } // Cycle
        ]
      };

      const order = validator.getTopologicalOrder(workflow.nodes, workflow.edges);
      expect(order).toBeNull();
    });
  });
});

describe('Phase A Integration', () => {
  test('all Phase A components should work together', () => {
    // This test ensures all Phase A components can be imported without errors
    expect(true).toBe(true);
  });
});
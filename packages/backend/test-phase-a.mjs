#!/usr/bin/env node

/**
 * Simple Phase A Components Test Runner
 * 
 * Tests the Phase A workflow automation components without Jest dependencies
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let testCount = 0;
let passCount = 0;
let failCount = 0;

function test(name, fn) {
  testCount++;
  console.log(`\n🧪 Testing: ${name}`);
  
  try {
    const result = fn();
    if (result && typeof result.then === 'function') {
      return result.then(() => {
        passCount++;
        console.log(`✅ PASS: ${name}`);
      }).catch(error => {
        failCount++;
        console.log(`❌ FAIL: ${name}`);
        console.error(`   Error: ${error.message}`);
      });
    } else {
      passCount++;
      console.log(`✅ PASS: ${name}`);
    }
  } catch (error) {
    failCount++;
    console.log(`❌ FAIL: ${name}`);
    console.error(`   Error: ${error.message}`);
  }
}

function assertEqual(actual, expected, message = '') {
  if (actual !== expected) {
    throw new Error(`${message}\nExpected: ${expected}\nActual: ${actual}`);
  }
}

function assertTrue(condition, message = '') {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

async function runTests() {
  console.log('🚀 Phase A Components Test Suite');
  console.log('================================\n');

  try {
    // Test Expression Engine
    console.log('📝 Expression Engine Tests');
    const { default: PhaseAExpressionEngine } = await import('./src/services/PhaseAExpressionEngine.js');
    const engine = new PhaseAExpressionEngine();

    test('Expression Engine - Simple Variable Substitution', () => {
      const result = engine.processTemplate('Hello {{name}}!', { name: 'World' });
      assertEqual(result, 'Hello World!', 'Simple variable substitution should work');
    });

    test('Expression Engine - Nested Object Access', () => {
      const result = engine.processTemplate('User: {{user.name}}', { user: { name: 'John' } });
      assertEqual(result, 'User: John', 'Nested object access should work');
    });

    test('Expression Engine - Function Calls', () => {
      const result = engine.processTemplate('Result: {{toUpperCase("hello")}}', {});
      assertEqual(result, 'Result: HELLO', 'Function calls should work');
    });

    test('Expression Engine - Security Validation', () => {
      try {
        engine.validateExpression('eval("alert(1)")');
        throw new Error('Should have rejected eval');
      } catch (error) {
        assertTrue(error.message.includes('Dangerous pattern detected'), 'Should detect dangerous patterns');
      }
    });

    // Test Graph Validator
    console.log('\n🔍 Graph Validator Tests');
    const { default: WorkflowGraphValidator } = await import('../src/services/WorkflowGraphValidator.js');
    const validator = new WorkflowGraphValidator();

    test('Graph Validator - Valid Workflow', () => {
      const workflow = {
        nodes: [
          { id: 'start', type: 'start' },
          { id: 'end', type: 'end' }
        ],
        edges: [
          { source: 'start', target: 'end' }
        ]
      };
      const result = validator.validateWorkflow(workflow);
      assertTrue(result.valid, 'Valid workflow should pass validation');
    });

    test('Graph Validator - Cycle Detection', () => {
      const workflow = {
        nodes: [
          { id: 'a', type: 'transform' },
          { id: 'b', type: 'transform' }
        ],
        edges: [
          { source: 'a', target: 'b' },
          { source: 'b', target: 'a' }
        ]
      };
      const result = validator.validateWorkflow(workflow);
      assertTrue(!result.valid, 'Cyclic workflow should fail validation');
      assertTrue(result.errors.some(e => e.includes('Cycles detected')), 'Should detect cycles');
    });

    test('Graph Validator - Topological Sort', () => {
      const workflow = {
        nodes: [
          { id: 'a', type: 'start' },
          { id: 'b', type: 'transform' },
          { id: 'c', type: 'end' }
        ],
        edges: [
          { source: 'a', target: 'b' },
          { source: 'b', target: 'c' }
        ]
      };
      const order = validator.getTopologicalOrder(workflow.nodes, workflow.edges);
      assertEqual(JSON.stringify(order), JSON.stringify(['a', 'b', 'c']), 'Should return correct execution order');
    });

    // Test Node Executor
    console.log('\n⚙️ Node Executor Tests');
    const { default: PhaseANodeExecutor } = await import('./src/services/PhaseANodeExecutor.js');
    const executor = new PhaseANodeExecutor();

    await test('Node Executor - Set Variable Node', async () => {
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
      assertEqual(result.setVariable.name, 'greeting', 'Variable name should be set');
      assertEqual(result.setVariable.value, 'Hello World', 'Variable value should be processed');
    });

    await test('Node Executor - Transform Node', async () => {
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
      assertEqual(result.output, 'Hello World', 'Transform should process data');
    });

    await test('Node Executor - Delay Node', async () => {
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
      assertTrue(result.delayed, 'Should indicate delay executed');
      assertTrue(endTime - startTime >= 10, 'Should actually delay execution');
    });

    // Test Streaming Service
    console.log('\n📡 Streaming Service Tests');
    const { default: workflowStreamer } = await import('../src/services/WorkflowExecutionStreamer.js');

    test('Streaming Service - Statistics', () => {
      const stats = workflowStreamer.getStats();
      assertTrue(typeof stats.activeConnections === 'number', 'Should return connection count');
      assertTrue(typeof stats.totalExecutions === 'number', 'Should return execution count');
    });

    // Summary
    console.log('\n' + '='.repeat(50));
    console.log('📊 Test Results Summary');
    console.log('='.repeat(50));
    console.log(`Total Tests: ${testCount}`);
    console.log(`✅ Passed: ${passCount}`);
    console.log(`❌ Failed: ${failCount}`);
    console.log(`📈 Success Rate: ${Math.round((passCount / testCount) * 100)}%`);

    if (failCount === 0) {
      console.log('\n🎉 All tests passed! Phase A implementation is working correctly.');
      process.exit(0);
    } else {
      console.log('\n⚠️  Some tests failed. Please review the errors above.');
      process.exit(1);
    }

  } catch (error) {
    console.error('\n💥 Test suite failed to run:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run the tests
runTests();
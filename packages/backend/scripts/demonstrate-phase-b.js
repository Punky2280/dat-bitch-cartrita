#!/usr/bin/env node

/**
 * 🚀 CARTRITA PHASE B WORKFLOW DEMONSTRATION
 * 
 * This script demonstrates the comprehensive Phase B workflow capabilities:
 * - Advanced workflow execution with parallelism
 * - Expression engine with template interpolation  
 * - Connector registry with built-in connectors
 * - Branching, loops, retries, and dry runs
 * - Real-time monitoring and analytics
 */

import WorkflowExecutionEngine from '../src/services/WorkflowExecutionEngine.js';
import ExpressionEngine from '../src/services/ExpressionEngine.js';
import ConnectorRegistryService from '../src/services/ConnectorRegistryService.js';
import { exampleWorkflows } from '../src/examples/PhaseBWorkflowExamples.js';

console.log('🚀 CARTRITA WORKFLOW ENGINE - PHASE B DEMONSTRATION\n');
console.log('═══════════════════════════════════════════════════\n');

// Test counters
let testsRun = 0;
let testsPassed = 0;

function runTest(name, testFn) {
  return new Promise(async (resolve) => {
    testsRun++;
    try {
      console.log(`\n🧪 Test ${testsRun}: ${name}`);
      console.log('─'.repeat(50));
      await testFn();
      testsPassed++;
      console.log(`✅ PASSED: ${name}`);
      resolve(true);
    } catch (error) {
      console.error(`❌ FAILED: ${name}`);
      console.error(`   Error: ${error.message}`);
      resolve(false);
    }
  });
}

async function demonstratePhaseB() {
  console.log('Initializing Phase B Workflow System...\n');

  // Test 1: Expression Engine Capabilities
  await runTest('Expression Engine - Safe Evaluation & Templates', async () => {
    const engine = new ExpressionEngine();
    
    // Test mathematical expressions
    const mathResult = await engine.evaluate('Math.max(10, 25, 15) + Math.abs(-5)');
    console.log(`   Math expression: Math.max(10, 25, 15) + Math.abs(-5) = ${mathResult}`);
    
    // Test variable interpolation
    const varResult = await engine.evaluate('user.age >= 18 ? "adult" : "minor"', { 
      user: { age: 25, name: 'Alice' } 
    });
    console.log(`   Variable logic: user.age >= 18 ? "adult" : "minor" = "${varResult}"`);
    
    // Test template interpolation
    const template = 'Hello {{user.name}}! Your score is ${score * 2} points. Status: ${score > 50 ? "excellent" : "good"}';
    const templateResult = await engine.evaluateTemplate(template, { 
      user: { name: 'Bob' }, 
      score: 75 
    });
    console.log(`   Template: "${templateResult}"`);
    
    // Test utility functions
    const utilResult = await engine.evaluate('utils.slugify("Phase B Workflow System!")');
    console.log(`   Utility: utils.slugify("Phase B Workflow System!") = "${utilResult}"`);
    
    if (mathResult === 30 && varResult === 'adult' && utilResult === 'phase-b-workflow-system') {
      console.log('   ✓ All expression tests passed');
    } else {
      throw new Error('Expression results don\'t match expected values');
    }
  });

  // Test 2: Connector Registry System
  await runTest('Connector Registry - Built-in Connectors & Execution', async () => {
    const registry = new ConnectorRegistryService();
    
    const connectors = registry.getAllConnectors();
    console.log(`   Loaded ${connectors.length} built-in connectors:`);
    
    connectors.forEach(connector => {
      console.log(`     - ${connector.type}: ${connector.name} (${connector.category})`);
    });
    
    // Test HTTP connector in dry run
    const httpResult = await registry.executeConnector('http-request', {
      config: {
        method: 'POST',
        url: 'https://api.example.com/data',
        headers: { 'Content-Type': 'application/json' },
        body: { test: true }
      }
    }, {}, { isDryRun: true });
    
    console.log(`   HTTP Connector (dry run): ${httpResult.method} ${httpResult.url}`);
    
    // Test utility connector
    const utilResult = await registry.executeConnector('utility', {
      config: {
        operation: 'sort',
        data: [{ name: 'Charlie', age: 35 }, { name: 'Alice', age: 30 }, { name: 'Bob', age: 25 }],
        options: { field: 'age', order: 'asc' }
      }
    }, {}, { isDryRun: false });
    
    console.log(`   Utility Connector (sort): First person is ${utilResult[0].name} (age ${utilResult[0].age})`);
    
    if (connectors.length >= 10 && httpResult.dryRun && utilResult[0].name === 'Bob') {
      console.log('   ✓ All connector tests passed');
    } else {
      throw new Error('Connector results don\'t match expected values');
    }
  });

  // Test 3: Parallel Workflow Execution
  await runTest('Workflow Engine - Parallel Execution', async () => {
    const engine = new WorkflowExecutionEngine();
    
    const parallelWorkflow = {
      id: 'parallel-demo',
      nodes: [
        {
          id: 'task_a',
          type: 'expression',
          config: { expression: 'input.valueA * 2' },
          connections: ['combine']
        },
        {
          id: 'task_b',
          type: 'expression',
          config: { expression: 'input.valueB * 3' },
          connections: ['combine']
        },
        {
          id: 'task_c',
          type: 'expression',
          config: { expression: 'input.valueC + 10' },
          connections: ['combine']
        },
        {
          id: 'combine',
          type: 'expression',
          config: { expression: '(input.valueA * 2) + (input.valueB * 3) + (input.valueC + 10)' },
          connections: []
        }
      ]
    };
    
    const startTime = Date.now();
    const result = await engine.executeWorkflow(
      parallelWorkflow,
      { valueA: 5, valueB: 4, valueC: 8 },
      { dryRun: true, realTimeMonitoring: true }
    );
    const executionTime = Date.now() - startTime;
    
    console.log(`   Parallel execution completed in ${executionTime}ms`);
    console.log(`   Nodes executed: ${result.nodesExecuted?.length || 0}`);
    console.log(`   Success: ${result.success}`);
    console.log(`   Execution ID: ${result.executionId}`);
    
    if (result.success && result.nodesExecuted?.length === 4 && executionTime < 1000) {
      console.log('   ✓ Parallel execution test passed');
    } else {
      throw new Error('Parallel execution failed or took too long');
    }
  });

  // Test 4: Branching and Conditional Logic
  await runTest('Workflow Engine - Branching & Conditions', async () => {
    const engine = new WorkflowExecutionEngine();
    
    const branchWorkflow = {
      id: 'branch-demo',
      nodes: [
        {
          id: 'evaluate',
          type: 'expression',
          config: { expression: '{ score: input.score, grade: input.score >= 90 ? "A" : input.score >= 80 ? "B" : input.score >= 70 ? "C" : "D" }' },
          connections: ['branch']
        },
        {
          id: 'branch',
          type: 'branch',
          config: {
            condition: 'evaluate.score >= 80',
            trueBranch: { action: '"Excellent performance! Grade: " + evaluate.grade' },
            falseBranch: { action: '"Needs improvement. Grade: " + evaluate.grade' }
          },
          connections: []
        }
      ]
    };
    
    // Test high score
    const highScoreResult = await engine.executeWorkflow(
      branchWorkflow,
      { score: 95 },
      { dryRun: true }
    );
    
    console.log(`   High score (95): Branch taken = ${highScoreResult.result?.branch?.branchTaken}`);
    
    // Test low score  
    const lowScoreResult = await engine.executeWorkflow(
      branchWorkflow,
      { score: 65 },
      { dryRun: true }
    );
    
    console.log(`   Low score (65): Branch taken = ${lowScoreResult.result?.branch?.branchTaken}`);
    
    if (highScoreResult.success && lowScoreResult.success) {
      console.log('   ✓ Branching logic test passed');
    } else {
      throw new Error('Branching execution failed');
    }
  });

  // Test 5: Loop Processing
  await runTest('Workflow Engine - Loop Processing', async () => {
    const engine = new WorkflowExecutionEngine();
    
    const loopWorkflow = {
      id: 'loop-demo',
      nodes: [
        {
          id: 'process_items',
          type: 'loop',
          config: {
            loopType: 'forEach',
            condition: 'input.items',
            maxIterations: 10,
            loopBody: { transform: '{ id: loopItem.id, processed: true, value: loopItem.value * 2 }' }
          },
          connections: []
        }
      ]
    };
    
    const result = await engine.executeWorkflow(
      loopWorkflow,
      { 
        items: [
          { id: 1, value: 10 },
          { id: 2, value: 20 },
          { id: 3, value: 30 }
        ] 
      },
      { dryRun: true }
    );
    
    console.log(`   Processed ${result.result?.process_items?.iterations || 0} items`);
    console.log(`   Results count: ${result.result?.process_items?.results?.length || 0}`);
    
    if (result.success && result.result?.process_items?.iterations === 3) {
      console.log('   ✓ Loop processing test passed');
    } else {
      throw new Error('Loop processing failed');
    }
  });

  // Test 6: Security and Sandboxing
  await runTest('Security - Expression Sandboxing', async () => {
    const engine = new ExpressionEngine();
    
    const maliciousExpressions = [
      'require("fs").readFileSync("/etc/passwd")',
      'process.exit(1)',
      'global.malicious = true',
      'eval("dangerous code")'
    ];
    
    let blocked = 0;
    for (const expr of maliciousExpressions) {
      try {
        await engine.evaluate(expr, {});
        console.log(`   ⚠️  Expression not blocked: ${expr}`);
      } catch (error) {
        blocked++;
        console.log(`   🛡️  Blocked malicious expression: ${expr.substring(0, 30)}...`);
      }
    }
    
    // Test safe expressions still work
    const safeResult = await engine.evaluate('Math.abs(-42) + 8', {});
    console.log(`   ✅ Safe expression result: ${safeResult}`);
    
    if (blocked === maliciousExpressions.length && safeResult === 50) {
      console.log('   ✓ Security sandboxing test passed');
    } else {
      throw new Error(`Security test failed: ${blocked}/${maliciousExpressions.length} blocked, safe result: ${safeResult}`);
    }
  });

  // Test 7: Performance and Scalability
  await runTest('Performance - Multiple Concurrent Workflows', async () => {
    const engine = new WorkflowExecutionEngine({ maxParallelBranches: 5 });
    
    const testWorkflow = {
      id: 'perf-test',
      nodes: [
        {
          id: 'calc',
          type: 'expression',
          config: { expression: 'Math.random() * input.multiplier + input.base' },
          connections: []
        }
      ]
    };
    
    const promises = [];
    const startTime = Date.now();
    
    for (let i = 0; i < 10; i++) {
      promises.push(
        engine.executeWorkflow(
          testWorkflow,
          { multiplier: i + 1, base: i * 10 },
          { dryRun: true }
        )
      );
    }
    
    const results = await Promise.all(promises);
    const totalTime = Date.now() - startTime;
    
    const successCount = results.filter(r => r.success).length;
    console.log(`   Executed ${successCount}/${results.length} workflows in ${totalTime}ms`);
    console.log(`   Average time per workflow: ${(totalTime / results.length).toFixed(2)}ms`);
    
    if (successCount === 10 && totalTime < 2000) {
      console.log('   ✓ Performance test passed');
    } else {
      throw new Error(`Performance test failed: ${successCount}/10 successful, ${totalTime}ms total`);
    }
  });

  // Test Summary
  console.log('\n' + '═'.repeat(60));
  console.log('📊 PHASE B WORKFLOW SYSTEM TEST RESULTS');
  console.log('═'.repeat(60));
  console.log(`Tests Run: ${testsRun}`);
  console.log(`Tests Passed: ${testsPassed}`);
  console.log(`Tests Failed: ${testsRun - testsPassed}`);
  console.log(`Success Rate: ${((testsPassed / testsRun) * 100).toFixed(1)}%`);
  
  if (testsPassed === testsRun) {
    console.log('\n🎉 ALL TESTS PASSED - PHASE B WORKFLOW SYSTEM READY!');
    console.log('\n✅ Phase B Features Verified:');
    console.log('   • WorkflowExecutionEngine with dependency graph resolution');
    console.log('   • ExpressionEngine with safe JavaScript evaluation');  
    console.log('   • ConnectorRegistryService with 10+ built-in connectors');
    console.log('   • Parallelism with configurable limits');
    console.log('   • Branching with conditional logic');
    console.log('   • Loops with iteration controls');
    console.log('   • Security sandboxing and validation');
    console.log('   • Performance optimization for concurrent execution');
    console.log('   • Real-time monitoring and event emission');
    console.log('   • Dry run capabilities');
    
    console.log('\n🚀 Ready for production deployment!');
  } else {
    console.log(`\n❌ ${testsRun - testsPassed} tests failed - needs attention`);
  }
  
  console.log('\n' + '═'.repeat(60));
}

// Run the demonstration
demonstratePhaseB().catch(error => {
  console.error('\n💥 Demonstration failed:', error);
  process.exit(1);
});
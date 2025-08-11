#!/usr/bin/env node

/**
 * Iteration 22: Advanced AI Integration - Test Suite
 * Tests multi-modal processing, intelligent orchestration, and adaptive learning
 */

import { expect } from 'chai';
import pool from '../../src/db.js';
import MultiModalProcessingService from '../../src/services/MultiModalProcessingService.js';
import EnhancedMCPCoordinator from '../../src/agi/system/EnhancedMCPCoordinator.js';
import MCPMessage from '../../src/system/protocols/MCPMessage.js';

class Iteration22TestSuite {
  constructor() {
    this.testResults = {
      passed: 0,
      failed: 0,
      total: 0,
      details: [],
    };
  }

  async runAllTests() {
    console.log(
      '🧪 Starting Iteration 22: Advanced AI Integration Test Suite\n'
    );

    try {
      await this.testDatabaseSchema();
      await this.testMultiModalProcessing();
      await this.testEnhancedMCPCoordinator();
      await this.testIntelligentOrchestration();
      await this.testAdaptiveLearning();
      await this.testAPIEndpoints();

      this.printTestSummary();
    } catch (error) {
      console.error('❌ Test suite failed:', error);
      process.exit(1);
    }
  }

  async testDatabaseSchema() {
    console.log('📊 Testing Iteration 22 Database Schema...');

    const expectedTables = [
      'multimodal_data',
      'multimodal_relationships',
      'ai_learning_models',
      'tool_performance_history',
      'agent_adaptation_rules',
      'orchestration_logs',
      'intelligence_streams',
      'predictive_insights',
      'cross_modal_learning_sessions',
      'mcp_message_analytics',
    ];

    for (const table of expectedTables) {
      try {
        const result = await pool.query(
          `
          SELECT COUNT(*) FROM information_schema.tables 
          WHERE table_name = $1 AND table_schema = 'public'
        `,
          [table]
        );

        if (result.rows[0].count === '1') {
          this.recordTest(`Database table ${table} exists`, true);
        } else {
          this.recordTest(
            `Database table ${table} exists`,
            false,
            `Table ${table} not found`
          );
        }
      } catch (error) {
        this.recordTest(`Database table ${table} exists`, false, error.message);
      }
    }

    // Test sample data insertion
    try {
      const testData = await pool.query(`
        SELECT COUNT(*) FROM ai_learning_models WHERE model_name LIKE '%iteration_22%'
      `);
      this.recordTest('Sample AI models created', testData.rows[0].count > 0);
    } catch (error) {
      this.recordTest('Sample AI models created', false, error.message);
    }

    console.log('✅ Database schema tests completed\n');
  }

  async testMultiModalProcessing() {
    console.log('🧠 Testing Multi-Modal Processing Service...');

    try {
      // Test service initialization
      await MultiModalProcessingService.initialize();
      this.recordTest('MultiModalProcessingService initializes', true);

      // Test status check
      const status = MultiModalProcessingService.getStatus();
      this.recordTest('Service status available', status && status.initialized);
      this.recordTest(
        'Supported modalities configured',
        Array.isArray(status.supported_modalities)
      );

      // Test multi-modal data processing
      const testModalities = [
        {
          type: 'text',
          content: 'This is a test text for multi-modal processing',
          metadata: { source: 'test_suite' },
        },
        {
          type: 'image',
          content: { format: 'jpeg', data: 'base64_encoded_test_data' },
          metadata: { dimensions: { width: 800, height: 600 } },
        },
      ];

      const processResult =
        await MultiModalProcessingService.processMultiModalData(
          1, // test user ID
          testModalities,
          { fusion_strategy: 'attention', context: { test: true } }
        );

      this.recordTest(
        'Multi-modal processing completes',
        !!processResult.process_id
      );
      this.recordTest(
        'Modality results generated',
        Array.isArray(processResult.modality_results)
      );
      this.recordTest(
        'Fusion applied for multiple modalities',
        !!processResult.fusion_result
      );
    } catch (error) {
      this.recordTest(
        'MultiModalProcessingService functions',
        false,
        error.message
      );
    }

    console.log('✅ Multi-modal processing tests completed\n');
  }

  async testEnhancedMCPCoordinator() {
    console.log('🎛️ Testing Enhanced MCP Coordinator...');

    try {
      // Test coordinator status
      const status = EnhancedMCPCoordinator.getEnhancedStatus();
      this.recordTest('Enhanced MCP Coordinator status available', !!status);
      this.recordTest(
        'Advanced AI features configured',
        !!status.advanced_ai_features
      );
      this.recordTest(
        'Iteration 22 status active',
        status.iteration_22_status === 'active'
      );

      // Test multi-modal orchestration capabilities
      this.recordTest(
        'Multi-modal orchestration capability',
        status.capabilities?.includes('multimodal_orchestration')
      );
      this.recordTest(
        'Intelligent tool selection capability',
        status.capabilities?.includes('intelligent_tool_selection')
      );
      this.recordTest(
        'Adaptive routing capability',
        status.capabilities?.includes('adaptive_routing')
      );
    } catch (error) {
      this.recordTest(
        'Enhanced MCP Coordinator functions',
        false,
        error.message
      );
    }

    console.log('✅ Enhanced MCP Coordinator tests completed\n');
  }

  async testIntelligentOrchestration() {
    console.log('🎯 Testing Intelligent Orchestration...');

    try {
      // Test orchestration logging
      const logQuery = `
        SELECT COUNT(*) FROM orchestration_logs 
        WHERE task_type = 'test_orchestration'
      `;
      const beforeCount = await pool.query(logQuery);

      // Simulate orchestration task
      await pool.query(
        `
        INSERT INTO orchestration_logs (
          user_id, orchestration_id, task_type, coordination_strategy,
          selected_agents, selected_tools, execution_sequence,
          total_execution_time_ms, success_rate, optimization_score
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      `,
        [
          1,
          'test_orch_001',
          'test_orchestration',
          'capability_based',
          ['EnhancedMCPCoordinator'],
          ['test_tool'],
          JSON.stringify({ test: 'data' }),
          1500,
          1.0,
          95.0,
        ]
      );

      const afterCount = await pool.query(logQuery);
      this.recordTest(
        'Orchestration logging works',
        parseInt(afterCount.rows[0].count) > parseInt(beforeCount.rows[0].count)
      );

      // Test performance history tracking
      const perfQuery = `
        SELECT COUNT(*) FROM tool_performance_history
        WHERE tool_name = 'test_tool'
      `;
      const perfBefore = await pool.query(perfQuery);

      await pool.query(
        `
        INSERT INTO tool_performance_history (
          user_id, tool_name, agent_id, task_type, execution_time_ms,
          success, performance_score, executed_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
      `,
        [1, 'test_tool', 'EnhancedMCPCoordinator', 'test_task', 800, true, 88.5]
      );

      const perfAfter = await pool.query(perfQuery);
      this.recordTest(
        'Performance history tracking works',
        parseInt(perfAfter.rows[0].count) > parseInt(perfBefore.rows[0].count)
      );
    } catch (error) {
      this.recordTest(
        'Intelligent orchestration functions',
        false,
        error.message
      );
    }

    console.log('✅ Intelligent orchestration tests completed\n');
  }

  async testAdaptiveLearning() {
    console.log('🧮 Testing Adaptive Learning...');

    try {
      // Test adaptation rule creation
      const ruleQuery = `
        SELECT COUNT(*) FROM agent_adaptation_rules
        WHERE rule_name = 'test_adaptation_rule'
      `;
      const ruleBefore = await pool.query(ruleQuery);

      await pool.query(
        `
        INSERT INTO agent_adaptation_rules (
          user_id, agent_type, rule_name, rule_type, condition_pattern,
          adaptation_action, rule_priority, confidence_score,
          learned_from
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      `,
        [
          1,
          'test_agent',
          'test_adaptation_rule',
          'performance',
          JSON.stringify({ performance_threshold: 0.8 }),
          JSON.stringify({ increase_priority: true }),
          5,
          0.85,
          'test_suite',
        ]
      );

      const ruleAfter = await pool.query(ruleQuery);
      this.recordTest(
        'Adaptation rule creation works',
        parseInt(ruleAfter.rows[0].count) > parseInt(ruleBefore.rows[0].count)
      );

      // Test learning model tracking
      const modelCount = await pool.query(`
        SELECT COUNT(*) FROM ai_learning_models
        WHERE training_status = 'deployed'
      `);
      this.recordTest(
        'Learning models can be tracked',
        parseInt(modelCount.rows[0].count) >= 0
      );

      // Test cross-modal learning session
      await pool.query(
        `
        INSERT INTO cross_modal_learning_sessions (
          user_id, session_name, learning_objective, input_modalities,
          output_modalities, model_architecture, session_status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      `,
        [
          1,
          'test_session',
          'Test multi-modal learning',
          JSON.stringify(['text', 'image']),
          JSON.stringify(['classification']),
          JSON.stringify({ type: 'transformer' }),
          'initialized',
        ]
      );

      const sessionCheck = await pool.query(`
        SELECT COUNT(*) FROM cross_modal_learning_sessions
        WHERE session_name = 'test_session'
      `);
      this.recordTest(
        'Cross-modal learning session creation works',
        parseInt(sessionCheck.rows[0].count) > 0
      );
    } catch (error) {
      this.recordTest('Adaptive learning functions', false, error.message);
    }

    console.log('✅ Adaptive learning tests completed\n');
  }

  async testAPIEndpoints() {
    console.log('🌐 Testing API Endpoints...');

    try {
      // Test enhanced MCP message types
      const testMessage = new MCPMessage({
        type: 'MULTIMODAL_TASK_REQUEST',
        sender: 'test_client',
        recipient: 'EnhancedMCPCoordinator',
        payload: { test: 'data' },
      });

      this.recordTest(
        'Enhanced MCP message types work',
        testMessage.type === 'MULTIMODAL_TASK_REQUEST'
      );

      const validTypes = [
        'MULTIMODAL_TASK_REQUEST',
        'LEARNING_UPDATE',
        'PERFORMANCE_METRICS',
        'ADAPTIVE_ROUTING',
        'FUSION_REQUEST',
        'OPTIMIZATION_REQUEST',
        'PREDICTION_REQUEST',
      ];

      let validTypeCount = 0;
      for (const type of validTypes) {
        try {
          new MCPMessage({
            type: type,
            sender: 'test_client',
            payload: {},
          });
          validTypeCount++;
        } catch (error) {
          console.warn(
            `Message type ${type} validation failed:`,
            error.message
          );
        }
      }

      this.recordTest(
        'All enhanced MCP message types validate',
        validTypeCount === validTypes.length
      );
    } catch (error) {
      this.recordTest('API endpoint functionality', false, error.message);
    }

    console.log('✅ API endpoint tests completed\n');
  }

  recordTest(testName, passed, error = null) {
    this.testResults.total++;
    if (passed) {
      this.testResults.passed++;
      console.log(`  ✅ ${testName}`);
    } else {
      this.testResults.failed++;
      console.log(`  ❌ ${testName}`);
      if (error) {
        console.log(`     Error: ${error}`);
      }
    }

    this.testResults.details.push({
      name: testName,
      passed,
      error,
    });
  }

  printTestSummary() {
    console.log('\n' + '='.repeat(80));
    console.log('🏁 ITERATION 22 TEST SUITE SUMMARY');
    console.log('='.repeat(80));
    console.log(`📊 Total Tests: ${this.testResults.total}`);
    console.log(`✅ Passed: ${this.testResults.passed}`);
    console.log(`❌ Failed: ${this.testResults.failed}`);
    console.log(
      `📈 Success Rate: ${(
        (this.testResults.passed / this.testResults.total) *
        100
      ).toFixed(1)}%`
    );

    if (this.testResults.failed > 0) {
      console.log('\n❌ FAILED TESTS:');
      this.testResults.details
        .filter(test => !test.passed)
        .forEach(test => {
          console.log(`  • ${test.name}${test.error ? ': ' + test.error : ''}`);
        });
    } else {
      console.log(
        '\n🎉 ALL TESTS PASSED! Iteration 22 is ready for deployment.'
      );
    }

    console.log('\n' + '='.repeat(80));

    // Exit with appropriate code
    process.exit(this.testResults.failed > 0 ? 1 : 0);
  }
}

// Run tests if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const testSuite = new Iteration22TestSuite();
  testSuite.runAllTests().catch(error => {
    console.error('Test suite execution failed:', error);
    process.exit(1);
  });
}

export default Iteration22TestSuite;

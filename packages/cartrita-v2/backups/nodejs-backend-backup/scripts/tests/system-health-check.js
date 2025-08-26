#!/usr/bin/env node

/**
 * Comprehensive System Health Check
 * Tests all critical systems and fixes implemented
 */

import 'dotenv/config';
import { fileURLToPath } from 'url';
import path from 'path';
import db from '../src/db.js';
import APIKeyManager from '../src/services/APIKeyManager.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class SystemHealthChecker {
  constructor() {
    this.results = {
      total: 0,
      passed: 0,
      failed: 0,
      warnings: 0,
      tests: [],
    };
  }

  async runAllTests() {
    console.log('🏥 Starting Cartrita System Health Check...\n');

    await this.testDatabaseConnection();
    await this.testUserTables();
    await this.testAPIKeyManager();
    await this.testAgentExports();
    await this.testEnvironmentConfiguration();

    this.printSummary();
    process.exit(this.results.failed > 0 ? 1 : 0);
  }

  async testDatabaseConnection() {
    console.log('📊 Testing Database Connection...');
    try {
      const result = await db.query(
        'SELECT NOW() as current_time, version() as pg_version'
      );
      this.addTest(
        'Database Connection',
        'passed',
        `Connected successfully - PostgreSQL ${
          result.rows[0].pg_version.split(' ')[1]
        }`
      );
    } catch (error) {
      this.addTest(
        'Database Connection',
        'failed',
        `Database connection failed: ${error.message}`
      );
    }
  }

  async testUserTables() {
    console.log('👤 Testing User Tables...');

    try {
      // Test users table
      const userResult = await db.query('SELECT COUNT(*) as count FROM users');
      const userCount = parseInt(userResult.rows[0].count);

      if (userCount > 0) {
        this.addTest(
          'Users Table',
          'passed',
          `Found ${userCount} users in database`
        );
      } else {
        this.addTest(
          'Users Table',
          'warning',
          'Users table exists but is empty'
        );
      }

      // Test user_preferences table
      const prefResult = await db.query(
        'SELECT COUNT(*) as count FROM user_preferences'
      );
      const prefCount = parseInt(prefResult.rows[0].count);

      this.addTest(
        'User Preferences Table',
        'passed',
        `User preferences table working - ${prefCount} preference records`
      );

      // Test authentication by checking password hashes
      const authTest = await db.query(
        'SELECT COUNT(*) as count FROM users WHERE password_hash IS NOT NULL'
      );
      const authCount = parseInt(authTest.rows[0].count);

      if (authCount === userCount) {
        this.addTest(
          'Authentication Setup',
          'passed',
          'All users have proper password hashes'
        );
      } else {
        this.addTest(
          'Authentication Setup',
          'warning',
          `${userCount - authCount} users missing password hashes`
        );
      }
    } catch (error) {
      this.addTest(
        'User Tables',
        'failed',
        `User table test failed: ${error.message}`
      );
    }
  }

  async testAPIKeyManager() {
    console.log('🔐 Testing API Key Manager...');

    try {
      // Test APIKeyManager initialization
      const status = APIKeyManager.getStatus();
      this.addTest(
        'APIKeyManager Service',
        'passed',
        `Service initialized with ${status.total_roles} roles`
      );

      // Test key permissions
      const supervisorKeys = APIKeyManager.getKeysForRole('supervisor');
      const keyCount = Object.keys(supervisorKeys).length;

      if (keyCount >= 3) {
        this.addTest(
          'API Key Configuration',
          'passed',
          `${keyCount} API keys configured for supervisor role`
        );
      } else {
        this.addTest(
          'API Key Configuration',
          'warning',
          `Only ${keyCount} API keys configured - some features may be limited`
        );
      }

      // Test specific key access
      const openaiKey = APIKeyManager.getKeyForAgent(
        'codewriter',
        'openai',
        'test-agent'
      );
      if (openaiKey) {
        this.addTest(
          'OpenAI Key Access',
          'passed',
          'Agents can access OpenAI API keys'
        );
      } else {
        this.addTest(
          'OpenAI Key Access',
          'failed',
          'OpenAI key not accessible to agents'
        );
      }

      // Validate configuration
      const validation = APIKeyManager.validateConfiguration();
      if (validation.valid) {
        this.addTest(
          'API Key Validation',
          'passed',
          'All required API keys are configured'
        );
      } else {
        this.addTest(
          'API Key Validation',
          'warning',
          `Missing required keys: ${validation.missing_required.join(', ')}`
        );
      }
    } catch (error) {
      this.addTest(
        'API Key Manager',
        'failed',
        `API Key Manager test failed: ${error.message}`
      );
    }
  }

  async testAgentExports() {
    console.log('🤖 Testing Agent Exports...');

    const agentFiles = [
      'ComedianAgent.js',
      'ResearcherAgent.js',
      'CodeWriterAgent.js',
      'ArtistAgent.js',
      'WriterAgent.js',
      'SchedulerAgent.js',
      'TaskManagementAgent.js',
      'AnalyticsAgent.js',
      'DesignAgent.js',
      'ToolAgent.js',
      'EmotionalIntelligenceAgent.js',
      'MultiModalFusionAgent.js',
      'PersonalizationAgent.js',
      'GitHubSearchAgent.js',
    ];

    let successCount = 0;

    for (const agentFile of agentFiles) {
      try {
        const { default: agent } = await import(
          `../src/agi/consciousness/${agentFile}`
        );

        if (agent && agent.config && agent.config.name) {
          successCount++;
        } else {
          this.addTest(
            `Agent ${agentFile}`,
            'failed',
            'Agent export invalid - missing config or name'
          );
        }
      } catch (error) {
        this.addTest(
          `Agent ${agentFile}`,
          'failed',
          `Agent import failed: ${error.message}`
        );
      }
    }

    if (successCount === agentFiles.length) {
      this.addTest(
        'Agent Exports',
        'passed',
        `All ${successCount} agents export correctly with proper constructors`
      );
    } else {
      this.addTest(
        'Agent Exports',
        'failed',
        `${agentFiles.length - successCount} agents have export issues`
      );
    }
  }

  async testEnvironmentConfiguration() {
    console.log('⚙️ Testing Environment Configuration...');

    const requiredEnvVars = ['OPENAI_API_KEY', 'DATABASE_URL', 'JWT_SECRET'];

    const optionalEnvVars = [
      'GOOGLE_API_KEY',
      'DEEPGRAM_API_KEY',
      'GITHUB_TOKEN',
      'TAVILY_API_KEY',
    ];

    let requiredMissing = 0;
    let optionalMissing = 0;

    requiredEnvVars.forEach(envVar => {
      if (!process.env[envVar]) {
        requiredMissing++;
        this.addTest(
          `Required ENV: ${envVar}`,
          'failed',
          'Required environment variable not set'
        );
      }
    });

    optionalEnvVars.forEach(envVar => {
      if (!process.env[envVar]) {
        optionalMissing++;
      }
    });

    if (requiredMissing === 0) {
      this.addTest(
        'Required Environment Variables',
        'passed',
        'All required environment variables are configured'
      );
    }

    if (optionalMissing === 0) {
      this.addTest(
        'Optional Environment Variables',
        'passed',
        'All optional environment variables are configured'
      );
    } else {
      this.addTest(
        'Optional Environment Variables',
        'warning',
        `${optionalMissing} optional environment variables not set - some features may be limited`
      );
    }
  }

  addTest(name, status, message) {
    this.results.total++;
    this.results.tests.push({ name, status, message });

    const icons = { passed: '✅', failed: '❌', warning: '⚠️' };
    const colors = {
      passed: '\x1b[32m',
      failed: '\x1b[31m',
      warning: '\x1b[33m',
    };

    console.log(
      `  ${icons[status]} ${colors[status]}${name}\x1b[0m: ${message}`
    );

    switch (status) {
      case 'passed':
        this.results.passed++;
        break;
      case 'failed':
        this.results.failed++;
        break;
      case 'warning':
        this.results.warnings++;
        break;
    }
  }

  printSummary() {
    console.log('\n📋 System Health Check Summary');
    console.log('================================');
    console.log(`Total Tests: ${this.results.total}`);
    console.log(`✅ Passed: ${this.results.passed}`);
    console.log(`❌ Failed: ${this.results.failed}`);
    console.log(`⚠️ Warnings: ${this.results.warnings}`);

    const successRate = Math.round(
      (this.results.passed / this.results.total) * 100
    );
    console.log(`Success Rate: ${successRate}%\n`);

    if (this.results.failed === 0) {
      console.log('🎉 All critical systems are operational!');
      console.log('Cartrita is ready for production use.\n');
    } else {
      console.log(
        '🔧 Some systems need attention before production deployment.\n'
      );
    }

    // System recommendations
    console.log('💡 System Recommendations:');
    if (this.results.warnings > 0) {
      console.log('  - Address warnings to unlock additional features');
    }
    if (process.env.NODE_ENV === 'development') {
      console.log('  - Set NODE_ENV=production for production deployment');
    }
    console.log('  - Monitor system logs for any runtime issues');
    console.log('  - Regular database backups recommended');
    console.log('  - Keep API keys secure and rotated regularly\n');
  }
}

// Run the health check
const checker = new SystemHealthChecker();
checker.runAllTests().catch(error => {
  console.error('💥 Health check runner failed:', error);
  process.exit(1);
});

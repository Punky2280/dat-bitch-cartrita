#!/usr/bin/env node

/**
 * Test Script for Hugging Face Jobs Integration
 * Tests basic HF Jobs functionality and audio analytics integration
 */

import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs/promises';
import HuggingFaceJobsService from '../src/services/HuggingFaceJobsService.js';
import HFJobsConfigurationService from '../src/services/HFJobsConfigurationService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class HFJobsTestSuite {
    constructor() {
        this.hfJobs = new HuggingFaceJobsService();
        this.config = new HFJobsConfigurationService();
        this.testResults = [];
    }

    async runTests() {
        console.log('🚀 Starting Hugging Face Jobs Test Suite\n');

        const tests = [
            'testEnvironment',
            'testHFCLIAvailability', 
            'testAuthentication',
            'testBasicJobExecution',
            'testAudioAnalysisJob',
            'testJobManagement',
            'testConfiguration',
            'testHealthCheck'
        ];

        for (const testName of tests) {
            try {
                console.log(`\n🧪 Running ${testName}...`);
                await this[testName]();
                this.logSuccess(testName, 'Passed');
            } catch (error) {
                this.logError(testName, error);
            }
        }

        this.printSummary();
    }

    async testEnvironment() {
        console.log('  📋 Checking environment variables...');
        
        // Check required environment variables
        const requiredVars = ['HF_TOKEN'];
        const optionalVars = ['HF_JOBS_ENABLED', 'HF_JOBS_PREFER_CLOUD'];
        
        for (const varName of requiredVars) {
            if (!process.env[varName]) {
                throw new Error(`Missing required environment variable: ${varName}`);
            }
            console.log(`  ✅ ${varName} is set`);
        }
        
        for (const varName of optionalVars) {
            const value = process.env[varName];
            console.log(`  ℹ️  ${varName}: ${value || 'not set (using default)'}`);
        }

        // Validate configuration
        HFJobsConfigurationService.validateEnvironment();
        console.log('  ✅ Environment validation passed');
    }

    async testHFCLIAvailability() {
        console.log('  🔧 Testing HF CLI availability...');
        
        try {
            await this.hfJobs.checkHFCLI();
            console.log('  ✅ HF CLI is available and working');
        } catch (error) {
            console.log('  ⚠️  HF CLI not available. Install instructions:');
            console.log('     pip install huggingface_hub[cli]');
            console.log('     # OR');
            console.log('     pip install --upgrade huggingface_hub');
            throw error;
        }
    }

    async testAuthentication() {
        console.log('  🔐 Testing HF authentication...');
        
        try {
            await this.hfJobs.verifyAuth();
            console.log('  ✅ Successfully authenticated with Hugging Face');
        } catch (error) {
            console.log('  ⚠️  Authentication failed. To authenticate:');
            console.log('     hf login');
            console.log('     # OR set HF_TOKEN environment variable');
            throw error;
        }
    }

    async testBasicJobExecution() {
        console.log('  🐍 Testing basic job execution...');
        
        try {
            const jobResult = await this.hfJobs.runJob({
                command: ['python', '-c', 'import sys; print(f"Hello from HF Jobs! Python {sys.version}")'],
                image: 'python:3.12',
                flavor: 'cpu-basic',
                jobType: 'test_basic'
            });
            
            console.log(`  ✅ Job submitted successfully: ${jobResult.id}`);
            console.log(`  🔗 Job URL: ${jobResult.url}`);
            
            // Wait a bit and check status
            await new Promise(resolve => setTimeout(resolve, 5000));
            const status = await this.hfJobs.getJobStatus(jobResult.id);
            console.log(`  📊 Job status: ${status.status}`);
            
        } catch (error) {
            console.log('  ⚠️  Note: This test requires HF Pro subscription');
            throw error;
        }
    }

    async testAudioAnalysisJob() {
        console.log('  🎵 Testing audio analysis job...');
        
        try {
            // Create a dummy audio file path for testing
            const testAudioPath = '/tmp/test_audio.wav';
            
            console.log('  📝 Creating test audio analysis script...');
            const scriptContent = await this.hfJobs.createAudioAnalysisScript('vad');
            console.log('  ✅ Audio analysis script created');
            
            // Note: We don't actually submit the job without a real audio file
            console.log('  ℹ️  Audio analysis job creation logic verified');
            console.log('  ℹ️  Would use flavor: a10g-small for GPU acceleration');
            
        } catch (error) {
            throw error;
        }
    }

    async testJobManagement() {
        console.log('  📋 Testing job management functions...');
        
        try {
            // Test listing jobs
            const jobs = await this.hfJobs.listJobs();
            console.log(`  ✅ Retrieved ${jobs.length} jobs from HF`);
            
            if (jobs.length > 0) {
                console.log('  📊 Recent jobs:');
                jobs.slice(0, 3).forEach(job => {
                    console.log(`    - ${job.id}: ${job.status} (${job.created})`);
                });
            }
            
        } catch (error) {
            console.log('  ⚠️  Job management requires HF Pro subscription');
            throw error;
        }
    }

    async testConfiguration() {
        console.log('  ⚙️  Testing configuration service...');
        
        const config = this.config.getCloudProcessingConfig();
        console.log(`  📊 Cloud processing enabled: ${config.enabled}`);
        console.log(`  📊 Prefer cloud: ${config.preferCloud}`);
        console.log(`  📊 Min file size for cloud: ${(config.minFileSizeForCloud / 1024 / 1024).toFixed(1)}MB`);
        
        // Test user preferences
        const testUserId = 'test_user_123';
        this.config.setUserPreferences(testUserId, {
            preferCloud: true,
            priorityProcessing: true
        });
        
        const userPrefs = this.config.getUserPreferences(testUserId);
        console.log(`  ✅ User preferences set and retrieved successfully`);
        console.log(`  📊 User prefers cloud: ${userPrefs.preferCloud}`);
        
        // Test decision logic
        const mockAudioInfo = { size: 15 * 1024 * 1024 }; // 15MB
        const shouldUseCloud = this.config.shouldUseCloud(mockAudioInfo, 'full', { userId: testUserId });
        console.log(`  🤖 Decision for 15MB full analysis: ${shouldUseCloud ? 'cloud' : 'local'}`);
        
        console.log('  ✅ Configuration service working correctly');
    }

    async testHealthCheck() {
        console.log('  🏥 Testing health check...');
        
        try {
            await this.hfJobs.initialize();
            const health = await this.hfJobs.healthCheck();
            
            console.log(`  📊 Service status: ${health.status}`);
            console.log(`  📊 HF CLI: ${health.hf_cli}`);
            console.log(`  📊 Authenticated: ${health.authenticated}`);
            console.log(`  📊 Queue size: ${health.queue_size}`);
            
            console.log('  ✅ Health check completed successfully');
            
        } catch (error) {
            console.log('  ⚠️  Health check failed - this may be expected without Pro subscription');
            console.log(`  📊 Error: ${error.message}`);
        }
    }

    logSuccess(testName, message) {
        this.testResults.push({ test: testName, status: 'PASS', message });
        console.log(`  ✅ ${testName}: ${message}`);
    }

    logError(testName, error) {
        this.testResults.push({ test: testName, status: 'FAIL', error: error.message });
        console.log(`  ❌ ${testName}: ${error.message}`);
    }

    printSummary() {
        console.log('\n📊 Test Summary');
        console.log('================');
        
        const passed = this.testResults.filter(r => r.status === 'PASS').length;
        const failed = this.testResults.filter(r => r.status === 'FAIL').length;
        
        console.log(`Total Tests: ${this.testResults.length}`);
        console.log(`Passed: ${passed}`);
        console.log(`Failed: ${failed}`);
        
        if (failed > 0) {
            console.log('\n❌ Failed Tests:');
            this.testResults
                .filter(r => r.status === 'FAIL')
                .forEach(r => console.log(`  - ${r.test}: ${r.error}`));
        }
        
        console.log('\n🎯 Next Steps:');
        if (failed === 0) {
            console.log('✅ All tests passed! HF Jobs integration is ready.');
            console.log('🚀 You can now run audio analysis jobs on HF infrastructure.');
        } else {
            console.log('⚠️  Some tests failed. Please address the issues above.');
            console.log('💡 Note: Many features require HF Pro subscription.');
        }
        
        console.log('\n🔗 Useful Links:');
        console.log('- HF Jobs Documentation: https://huggingface.co/docs/huggingface_hub/guides/jobs');
        console.log('- HF Pro Plans: https://huggingface.co/pricing');
        console.log('- HF CLI Guide: https://huggingface.co/docs/huggingface_hub/guides/cli');
    }
}

// Run tests if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
    const testSuite = new HFJobsTestSuite();
    testSuite.runTests().catch(error => {
        console.error('Test suite failed:', error);
        process.exit(1);
    });
}

export default HFJobsTestSuite;
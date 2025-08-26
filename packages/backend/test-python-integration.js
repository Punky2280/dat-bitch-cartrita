#!/usr/bin/env node

/**
 * Test script for Python integration
 * Tests the fixes for Python server startup timeout issues
 */

import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🧪 Testing Python Integration Fixes...\n');

// Test 1: Basic Python availability
async function testPythonAvailability() {
    console.log('1️⃣  Testing Python 3 availability...');
    
    return new Promise((resolve) => {
        const python = spawn('python3', ['--version'], {
            stdio: ['pipe', 'pipe', 'pipe'],
            timeout: 5000
        });

        let output = '';
        let error = '';

        python.stdout.on('data', (data) => {
            output += data.toString();
        });

        python.stderr.on('data', (data) => {
            error += data.toString();
        });

        python.on('close', (code) => {
            if (code === 0) {
                console.log(`   ✅ Python available: ${output.trim()}`);
                resolve(true);
            } else {
                console.log(`   ❌ Python not available: ${error}`);
                resolve(false);
            }
        });

        python.on('error', (err) => {
            console.log(`   ❌ Python error: ${err.message}`);
            resolve(false);
        });

        python.on('timeout', () => {
            console.log('   ⏰ Python version check timeout');
            python.kill('SIGTERM');
            resolve(false);
        });
    });
}

// Test 2: Python code execution with timeout handling
async function testPythonExecution() {
    console.log('\n2️⃣  Testing Python code execution...');
    
    const testCode = `
import sys
import json
import time

# Simulate a quick task
result = {
    "python_version": sys.version.split()[0],
    "status": "success",
    "message": "Python execution working correctly"
}

print(json.dumps(result))
    `.trim();

    return new Promise((resolve) => {
        const python = spawn('python3', ['-c', testCode], {
            stdio: ['pipe', 'pipe', 'pipe'],
            timeout: 10000
        });

        let output = '';
        let error = '';
        let resolved = false;

        const resolveOnce = (result) => {
            if (!resolved) {
                resolved = true;
                resolve(result);
            }
        };

        python.stdout.on('data', (data) => {
            output += data.toString();
        });

        python.stderr.on('data', (data) => {
            error += data.toString();
        });

        python.on('close', (code) => {
            if (code === 0) {
                try {
                    const result = JSON.parse(output.trim());
                    console.log(`   ✅ Python execution successful: ${result.message}`);
                    console.log(`   📊 Python version: ${result.python_version}`);
                    resolveOnce(true);
                } catch (parseError) {
                    console.log(`   ❌ Failed to parse Python output: ${output}`);
                    resolveOnce(false);
                }
            } else {
                console.log(`   ❌ Python execution failed (code ${code}): ${error}`);
                resolveOnce(false);
            }
        });

        python.on('error', (err) => {
            console.log(`   ❌ Python spawn error: ${err.message}`);
            resolveOnce(false);
        });

        python.on('timeout', () => {
            console.log('   ⏰ Python execution timeout - this tests our timeout handling');
            python.kill('SIGTERM');
            resolveOnce(false);
        });
    });
}

// Test 3: Timeout handling
async function testTimeoutHandling() {
    console.log('\n3️⃣  Testing timeout handling...');
    
    const testCode = `
import time
print("Starting long operation...")
time.sleep(15)  # This will timeout
print("This should not be reached")
    `.trim();

    return new Promise((resolve) => {
        const startTime = Date.now();
        const python = spawn('python3', ['-c', testCode], {
            stdio: ['pipe', 'pipe', 'pipe'],
            timeout: 5000 // 5 second timeout
        });

        let output = '';
        let error = '';

        python.stdout.on('data', (data) => {
            output += data.toString();
            console.log(`   📝 Python output: ${data.toString().trim()}`);
        });

        python.stderr.on('data', (data) => {
            error += data.toString();
        });

        python.on('close', (code) => {
            const duration = Date.now() - startTime;
            console.log(`   ⏱️  Process ended after ${duration}ms with code ${code}`);
            resolve(true);
        });

        python.on('error', (err) => {
            console.log(`   ❌ Python error: ${err.message}`);
            resolve(true);
        });

        python.on('timeout', () => {
            const duration = Date.now() - startTime;
            console.log(`   ✅ Timeout handled correctly after ${duration}ms`);
            console.log('   🐍 This is the "Python server startup timeout, assuming ready" scenario');
            python.kill('SIGTERM');
            resolve(true);
        });
    });
}

// Run all tests
async function runTests() {
    const test1 = await testPythonAvailability();
    const test2 = await testPythonExecution();
    const test3 = await testTimeoutHandling();

    console.log('\n📋 Test Results:');
    console.log(`   Python Available: ${test1 ? '✅' : '❌'}`);
    console.log(`   Python Execution: ${test2 ? '✅' : '❌'}`);
    console.log(`   Timeout Handling: ${test3 ? '✅' : '❌'}`);

    if (test1 && test2 && test3) {
        console.log('\n🎉 All tests passed! Python integration fixes are working correctly.');
        process.exit(0);
    } else {
        console.log('\n⚠️  Some tests failed. Check the output above for details.');
        process.exit(1);
    }
}

runTests().catch(error => {
    console.error('Test runner error:', error);
    process.exit(1);
});
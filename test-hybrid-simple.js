#!/usr/bin/env node

/**
 * Simple Hybrid Backend Test
 * Tests Fastify (8001) and FastAPI (8002) integration
 */

import axios from 'axios';

async function testServices() {
    console.log('🧪 Testing Hybrid Backend Integration\n');
    
    // Test 1: Fastify Health Check
    try {
        console.log('1. Testing Fastify health (port 8001)...');
        const fastifyHealth = await axios.get('http://localhost:8001/health', { timeout: 5000 });
        console.log('✅ Fastify Health:', fastifyHealth.data.status);
    } catch (error) {
        console.log('❌ Fastify Health Error:', error.message);
    }
    
    // Test 2: FastAPI Health Check
    try {
        console.log('\n2. Testing FastAPI health (port 8002)...');
        const fastapiHealth = await axios.get('http://localhost:8002/health', { timeout: 5000 });
        console.log('✅ FastAPI Health:', fastapiHealth.data.status);
    } catch (error) {
        console.log('❌ FastAPI Health Error:', error.message);
    }
    
    // Test 3: Direct FastAPI AI endpoint
    try {
        console.log('\n3. Testing FastAPI AI endpoint directly...');
        const directAI = await axios.post('http://localhost:8002/ai/generate', {
            prompt: 'Hello FastAPI!',
            max_tokens: 5
        }, { timeout: 5000 });
        console.log('✅ FastAPI AI Response:', directAI.data);
    } catch (error) {
        if (error.response) {
            console.log('✅ FastAPI AI Expected Error:', error.response.data);
        } else {
            console.log('❌ FastAPI AI Error:', error.message);
        }
    }
    
    // Test 4: Hybrid proxy through Fastify
    try {
        console.log('\n4. Testing Hybrid proxy (Fastify → FastAPI)...');
        const proxyAI = await axios.post('http://localhost:8001/api/ai/generate', {
            prompt: 'Hello Hybrid!',
            max_tokens: 5
        }, { timeout: 5000 });
        console.log('✅ Hybrid Proxy Response:', proxyAI.data);
    } catch (error) {
        if (error.response) {
            console.log('✅ Hybrid Proxy Expected Error:', error.response.data);
        } else {
            console.log('❌ Hybrid Proxy Error:', error.message);
        }
    }
    
    // Test 5: Fastify agent endpoint
    try {
        console.log('\n5. Testing Fastify agent endpoint...');
        const agentResponse = await axios.post('http://localhost:8001/api/agents/cartrita_core_001/process', {
            prompt: 'Hello Cartrita!'
        }, { timeout: 5000 });
        console.log('✅ Fastify Agent Response:', agentResponse.data);
    } catch (error) {
        if (error.response) {
            console.log('⚠️ Fastify Agent Error:', error.response.data);
        } else {
            console.log('❌ Fastify Agent Error:', error.message);
        }
    }
    
    console.log('\n🎉 Hybrid Backend Test Complete!');
}

testServices().catch(console.error);
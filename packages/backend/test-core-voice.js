// Core voice functionality test - focused testing without full agent system
const axios = require('axios');
const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'http://localhost:8000';
const WS_URL = 'ws://localhost:8000';

// Test authentication token (you'll need to provide a valid token)
const TEST_TOKEN = process.env.TEST_AUTH_TOKEN || 'your-test-token-here';

class CoreVoiceTester {
  constructor() {
    this.testResults = [];
    this.websocket = null;
  }

  log(message, type = 'info') {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] ${type.toUpperCase()}: ${message}`;
    
    console.log(logMessage);
    this.testResults.push({ timestamp, type, message });
  }

  async runAllTests() {
    console.log('🧪 Testing Cartrita Core Voice Functionality\n');
    console.log('='.repeat(60));
    
    try {
      // Test 1: Backend connectivity
      await this.testBackendConnectivity();
      
      // Test 2: Voice chat endpoints
      await this.testVoiceChatEndpoints();
      
      // Test 3: Text-to-speech functionality
      await this.testTextToSpeech();
      
      // Test 4: Speech-to-text functionality
      await this.testSpeechToText();
      
      // Test 5: Voice session management
      await this.testVoiceSessionManagement();
      
      // Test 6: WebSocket connectivity for real-time features
      await this.testWebSocketConnectivity();
      
      console.log('\n' + '='.repeat(60));
      this.generateTestReport();
      
    } catch (error) {
      this.log(`Test suite failed: ${error.message}`, 'error');
    }
  }

  async testBackendConnectivity() {
    this.log('Testing backend connectivity...', 'test');
    
    try {
      const response = await axios.get(`${BASE_URL}/`);
      
      if (response.status === 200) {
        this.log('✅ Backend is responding', 'success');
        this.log(`Backend message: ${response.data.message}`, 'info');
      } else {
        this.log(`❌ Unexpected response status: ${response.status}`, 'error');
      }
    } catch (error) {
      this.log(`❌ Backend connectivity failed: ${error.message}`, 'error');
      throw error;
    }
  }

  async testVoiceChatEndpoints() {
    this.log('Testing voice chat API endpoints...', 'test');
    
    const endpoints = [
      { method: 'GET', path: '/api/voice-chat/status', expectedStatus: [200, 401] },
      { method: 'POST', path: '/api/voice-chat/start-session', expectedStatus: [200, 401] },
      { method: 'POST', path: '/api/voice-chat/stop-session', expectedStatus: [200, 401] },
      { method: 'POST', path: '/api/voice-chat/process-audio', expectedStatus: [200, 401] }
    ];
    
    for (const endpoint of endpoints) {
      try {
        const config = {
          method: endpoint.method.toLowerCase(),
          url: `${BASE_URL}${endpoint.path}`,
          validateStatus: (status) => endpoint.expectedStatus.includes(status)
        };
        
        if (endpoint.method === 'POST') {
          config.data = { test: true };
          config.headers = { 'Content-Type': 'application/json' };
        }
        
        const response = await axios(config);
        
        if (endpoint.expectedStatus.includes(response.status)) {
          this.log(`✅ ${endpoint.method} ${endpoint.path} - Status: ${response.status}`, 'success');
        } else {
          this.log(`❌ ${endpoint.method} ${endpoint.path} - Unexpected status: ${response.status}`, 'error');
        }
      } catch (error) {
        if (error.response && endpoint.expectedStatus.includes(error.response.status)) {
          this.log(`✅ ${endpoint.method} ${endpoint.path} - Status: ${error.response.status} (expected)`, 'success');
        } else {
          this.log(`❌ ${endpoint.method} ${endpoint.path} - Error: ${error.message}`, 'error');
        }
      }
    }
  }

  async testTextToSpeech() {
    this.log('Testing text-to-speech functionality...', 'test');
    
    try {
      const testText = "Hello, this is Cartrita testing the text-to-speech functionality.";
      
      const response = await axios.post(`${BASE_URL}/api/voice-chat/generate-speech`, {
        text: testText,
        voice: 'feminine_urban',
        emotion: 'friendly'
      }, {
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${TEST_TOKEN}`
        },
        validateStatus: (status) => [200, 401].includes(status)
      });
      
      if (response.status === 200) {
        this.log('✅ Text-to-speech endpoint responding', 'success');
        
        if (response.data.audioUrl || response.data.audioBuffer) {
          this.log('✅ Audio content generated successfully', 'success');
        } else {
          this.log('⚠️ No audio content in response', 'warning');
        }
      } else if (response.status === 401) {
        this.log('⚠️ Text-to-speech requires authentication (expected)', 'warning');
      }
      
    } catch (error) {
      if (error.response && error.response.status === 401) {
        this.log('⚠️ Text-to-speech requires valid authentication', 'warning');
      } else {
        this.log(`❌ Text-to-speech test failed: ${error.message}`, 'error');
      }
    }
  }

  async testSpeechToText() {
    this.log('Testing speech-to-text functionality...', 'test');
    
    try {
      // Create a simple test audio buffer (silence for testing)
      const testAudioBuffer = Buffer.alloc(1024, 0);
      
      const formData = new FormData();
      const audioBlob = new Blob([testAudioBuffer], { type: 'audio/wav' });
      formData.append('audio', audioBlob, 'test.wav');
      
      const response = await axios.post(`${BASE_URL}/api/voice-chat/transcribe`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
          'Authorization': `Bearer ${TEST_TOKEN}`
        },
        validateStatus: (status) => [200, 400, 401].includes(status)
      });
      
      if (response.status === 200) {
        this.log('✅ Speech-to-text endpoint responding', 'success');
        this.log(`Transcription result: ${JSON.stringify(response.data)}`, 'info');
      } else if (response.status === 401) {
        this.log('⚠️ Speech-to-text requires valid authentication', 'warning');
      } else {
        this.log(`⚠️ Speech-to-text returned status ${response.status}`, 'warning');
      }
      
    } catch (error) {
      if (error.response && [400, 401].includes(error.response.status)) {
        this.log('⚠️ Speech-to-text endpoint available but requires proper authentication/format', 'warning');
      } else {
        this.log(`❌ Speech-to-text test failed: ${error.message}`, 'error');
      }
    }
  }

  async testVoiceSessionManagement() {
    this.log('Testing voice session management...', 'test');
    
    try {
      // Test starting a voice session
      const startResponse = await axios.post(`${BASE_URL}/api/voice-chat/start-session`, {
        settings: {
          wakeWords: ['cartrita', 'hey cartrita'],
          ambientMode: false,
          visualMode: false
        }
      }, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${TEST_TOKEN}`
        },
        validateStatus: (status) => [200, 401].includes(status)
      });
      
      if (startResponse.status === 200) {
        this.log('✅ Voice session start endpoint working', 'success');
        
        // Test session status
        const statusResponse = await axios.get(`${BASE_URL}/api/voice-chat/status`, {
          headers: { 'Authorization': `Bearer ${TEST_TOKEN}` },
          validateStatus: (status) => [200, 401].includes(status)
        });
        
        if (statusResponse.status === 200) {
          this.log('✅ Voice session status endpoint working', 'success');
          this.log(`Session status: ${JSON.stringify(statusResponse.data)}`, 'info');
        }
        
        // Test stopping the session
        const stopResponse = await axios.post(`${BASE_URL}/api/voice-chat/stop-session`, {}, {
          headers: { 'Authorization': `Bearer ${TEST_TOKEN}` },
          validateStatus: (status) => [200, 401].includes(status)
        });
        
        if (stopResponse.status === 200) {
          this.log('✅ Voice session stop endpoint working', 'success');
        }
        
      } else if (startResponse.status === 401) {
        this.log('⚠️ Voice session management requires valid authentication', 'warning');
      }
      
    } catch (error) {
      if (error.response && error.response.status === 401) {
        this.log('⚠️ Voice session management requires valid authentication', 'warning');
      } else {
        this.log(`❌ Voice session management test failed: ${error.message}`, 'error');
      }
    }
  }

  async testWebSocketConnectivity() {
    this.log('Testing WebSocket connectivity for real-time features...', 'test');
    
    return new Promise((resolve) => {
      try {
        this.websocket = new WebSocket(`${WS_URL}/ws`);
        
        const timeout = setTimeout(() => {
          this.log('⚠️ WebSocket connection timeout', 'warning');
          this.websocket.close();
          resolve();
        }, 5000);
        
        this.websocket.on('open', () => {
          clearTimeout(timeout);
          this.log('✅ WebSocket connection established', 'success');
          
          // Send a test message
          this.websocket.send(JSON.stringify({
            type: 'test',
            message: 'Core voice functionality test'
          }));
          
          setTimeout(() => {
            this.websocket.close();
            resolve();
          }, 1000);
        });
        
        this.websocket.on('message', (data) => {
          this.log(`📨 WebSocket message received: ${data}`, 'info');
        });
        
        this.websocket.on('error', (error) => {
          clearTimeout(timeout);
          this.log(`❌ WebSocket connection error: ${error.message}`, 'error');
          resolve();
        });
        
        this.websocket.on('close', () => {
          this.log('WebSocket connection closed', 'info');
          resolve();
        });
        
      } catch (error) {
        this.log(`❌ WebSocket test failed: ${error.message}`, 'error');
        resolve();
      }
    });
  }

  generateTestReport() {
    console.log('\n📊 CORE VOICE FUNCTIONALITY TEST REPORT');
    console.log('='.repeat(60));
    
    const successCount = this.testResults.filter(r => r.type === 'success').length;
    const errorCount = this.testResults.filter(r => r.type === 'error').length;
    const warningCount = this.testResults.filter(r => r.type === 'warning').length;
    
    console.log(`✅ Successful tests: ${successCount}`);
    console.log(`❌ Failed tests: ${errorCount}`);
    console.log(`⚠️ Warnings: ${warningCount}`);
    
    console.log('\n🎯 CORE VOICE SYSTEM STATUS:');
    
    if (errorCount === 0) {
      console.log('🟢 All core voice endpoints are accessible and responding');
    } else if (errorCount <= 2) {
      console.log('🟡 Core voice system mostly functional with minor issues');
    } else {
      console.log('🔴 Core voice system has significant issues that need attention');
    }
    
    console.log('\n📝 RECOMMENDATIONS:');
    
    if (this.testResults.some(r => r.message.includes('requires authentication'))) {
      console.log('• Provide valid authentication token for full functionality testing');
      console.log('  Set TEST_AUTH_TOKEN environment variable or update the token in the script');
    }
    
    if (this.testResults.some(r => r.message.includes('Backend connectivity failed'))) {
      console.log('• Ensure backend server is running on port 8000');
      console.log('• Check if all required environment variables are set');
    }
    
    if (this.testResults.some(r => r.message.includes('WebSocket'))) {
      console.log('• WebSocket functionality may require additional configuration');
    }
    
    console.log('\n🔊 Ready to test voice features with proper authentication!');
    console.log('Next steps: Provide authentication and test with real audio data');
    
    // Save detailed report to file
    const reportData = {
      timestamp: new Date().toISOString(),
      summary: { successCount, errorCount, warningCount },
      details: this.testResults
    };
    
    fs.writeFileSync(
      path.join(__dirname, 'core-voice-test-report.json'),
      JSON.stringify(reportData, null, 2)
    );
    
    console.log('\n💾 Detailed report saved to: core-voice-test-report.json');
  }
}

// Run the tests
const tester = new CoreVoiceTester();
tester.runAllTests().catch(console.error);
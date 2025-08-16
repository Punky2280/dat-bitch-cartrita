/**
 * @fileoverview MockServices - Mock external service dependencies for testing
 * Provides controlled mock implementations of external APIs and services
 */

import { EventEmitter } from 'events';
import { vi } from 'vitest';

// Individual Mock Classes for direct import
export class MockOpenAI {
  constructor() {
    this.completions = {
      create: vi.fn()
    };
    this.embeddings = {
      create: vi.fn()
    };
    this.chat = {
      completions: {
        create: vi.fn()
      }
    };
    this.images = {
      generate: vi.fn()
    };
    this.audio = {
      transcriptions: {
        create: vi.fn()
      },
      speech: {
        create: vi.fn()
      }
    };
  }

  // Mock successful chat completion
  mockChatCompletion(response = 'Mocked AI response') {
    this.chat.completions.create.mockResolvedValue({
      choices: [{
        message: {
          role: 'assistant',
          content: response
        },
        finish_reason: 'stop'
      }],
      usage: {
        prompt_tokens: 10,
        completion_tokens: 20,
        total_tokens: 30
      }
    });
  }

  // Mock successful embeddings
  mockEmbeddings(embeddings = [0.1, 0.2, 0.3]) {
    this.embeddings.create.mockResolvedValue({
      data: [{
        embedding: embeddings,
        index: 0
      }],
      usage: {
        prompt_tokens: 5,
        total_tokens: 5
      }
    });
  }

  // Mock streaming response
  mockStreamingCompletion(chunks = ['Hello', ' World', '!']) {
    const mockStream = new EventEmitter();
    
    this.chat.completions.create.mockResolvedValue(mockStream);
    
    // Simulate streaming chunks
    setTimeout(() => {
      chunks.forEach((chunk, index) => {
        setTimeout(() => {
          mockStream.emit('data', {
            choices: [{
              delta: { content: chunk },
              finish_reason: index === chunks.length - 1 ? 'stop' : null
            }]
          });
        }, index * 100);
      });
      
      setTimeout(() => {
        mockStream.emit('end');
      }, chunks.length * 100 + 50);
    }, 10);
    
    return mockStream;
  }

  // Mock error responses
  mockError(error) {
    this.chat.completions.create.mockRejectedValue(error);
    this.embeddings.create.mockRejectedValue(error);
    this.images.generate.mockRejectedValue(error);
    this.audio.transcriptions.create.mockRejectedValue(error);
    this.audio.speech.create.mockRejectedValue(error);
  }

  // Reset all mocks
  reset() {
    vi.clearAllMocks();
  }
}

export class MockDeepgram {
  constructor() {
    this.listen = {
      prerecorded: {
        transcribeFile: vi.fn(),
        transcribeUrl: vi.fn()
      },
      live: vi.fn()
    };
    this.speak = {
      request: vi.fn()
    };
  }

  // Mock transcription response
  mockTranscription(transcript = 'Mocked transcription', confidence = 0.95) {
    const mockResponse = {
      results: {
        channels: [{
          alternatives: [{
            transcript,
            confidence,
            words: transcript.split(' ').map((word, index) => ({
              word,
              start: index * 0.5,
              end: (index + 1) * 0.5,
              confidence: 0.9
            }))
          }]
        }]
      }
    };

    this.listen.prerecorded.transcribeFile.mockResolvedValue(mockResponse);
    this.listen.prerecorded.transcribeUrl.mockResolvedValue(mockResponse);
  }

  // Mock text-to-speech response
  mockTextToSpeech(audioBuffer = Buffer.from('mock-audio-data')) {
    this.speak.request.mockResolvedValue({
      stream: () => Promise.resolve(audioBuffer),
      headers: { 'content-type': 'audio/wav' }
    });
  }

  // Reset all mocks
  reset() {
    vi.clearAllMocks();
  }
}

export class MockHuggingFace {
  constructor() {
    this.inference = vi.fn();
    this.textClassification = vi.fn();
    this.textGeneration = vi.fn();
    this.translation = vi.fn();
    this.imageClassification = vi.fn();
    this.objectDetection = vi.fn();
    this.featureExtraction = vi.fn();
  }

  // Mock text classification
  mockTextClassification(labels = [{ label: 'POSITIVE', score: 0.8 }]) {
    this.textClassification.mockResolvedValue(labels);
  }

  // Mock text generation
  mockTextGeneration(text = 'Generated text response') {
    this.textGeneration.mockResolvedValue([{
      generated_text: text
    }]);
  }

  // Mock image classification
  mockImageClassification(predictions = [{ label: 'cat', score: 0.9 }]) {
    this.imageClassification.mockResolvedValue(predictions);
  }

  // Mock feature extraction
  mockFeatureExtraction(features = [[0.1, 0.2, 0.3]]) {
    this.featureExtraction.mockResolvedValue(features);
  }

  // Reset all mocks
  reset() {
    vi.clearAllMocks();
  }
}

export class MockRedis {
  constructor() {
    this.data = new Map();
    this.get = vi.fn();
    this.set = vi.fn();
    this.del = vi.fn();
    this.exists = vi.fn();
    this.expire = vi.fn();
    this.keys = vi.fn();
    this.flushall = vi.fn();
    
    // Initialize mocks
    this.setupMocks();
  }

  // Mock Redis operations
  setupMocks() {
    this.get.mockImplementation(async (key) => {
      return this.data.get(key) || null;
    });

    this.set.mockImplementation(async (key, value, ...args) => {
      this.data.set(key, value);
      return 'OK';
    });

    this.del.mockImplementation(async (...keys) => {
      let count = 0;
      keys.forEach(key => {
        if (this.data.delete(key)) count++;
      });
      return count;
    });

    this.exists.mockImplementation(async (...keys) => {
      return keys.filter(key => this.data.has(key)).length;
    });

    this.keys.mockImplementation(async (pattern) => {
      if (pattern === '*') {
        return Array.from(this.data.keys());
      }
      // Simple pattern matching for tests
      const regex = new RegExp(pattern.replace('*', '.*'));
      return Array.from(this.data.keys()).filter(key => regex.test(key));
    });

    this.flushall.mockImplementation(async () => {
      this.data.clear();
      return 'OK';
    });
  }

  // Reset all mocks and data
  reset() {
    this.data.clear();
    vi.clearAllMocks();
    this.setupMocks();
  }
}

export class MockEmail {
  constructor() {
    this.sendMail = vi.fn();
    this.sentEmails = [];
    
    // Initialize mock behavior
    this.mockSendEmail();
  }

  // Mock successful email sending
  mockSendEmail() {
    this.sendMail.mockImplementation(async (options) => {
      const email = {
        to: options.to,
        subject: options.subject,
        html: options.html,
        timestamp: new Date(),
        messageId: `mock-${Date.now()}@test.com`
      };
      
      this.sentEmails.push(email);
      
      return {
        messageId: email.messageId,
        accepted: Array.isArray(options.to) ? options.to : [options.to],
        rejected: [],
        response: '250 OK: queued'
      };
    });
  }

  // Mock successful email sending with custom messageId
  mockSuccess(messageId) {
    this.sendMail.mockImplementation(async (options) => {
      const email = {
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text,
        timestamp: new Date(),
        messageId
      };
      
      this.sentEmails.push(email);
      
      return {
        messageId,
        accepted: Array.isArray(options.to) ? options.to : [options.to],
        rejected: [],
        response: '250 OK: queued'
      };
    });
  }

  // Get sent emails for verification
  getSentEmails() {
    return this.sentEmails;
  }

  // Clear sent emails
  clearSentEmails() {
    this.sentEmails = [];
  }

  // Reset all mocks
  reset() {
    this.sentEmails = [];
    vi.clearAllMocks();
    this.mockSendEmail(); // Re-initialize mock behavior
  }
}

export class MockWebSocket {
  constructor() {
    this.clients = new Set();
    this.messages = [];
    this.broadcast = vi.fn();
    this.send = vi.fn();
  }

  // Mock WebSocket client connection
  mockClient() {
    const client = {
      id: `client-${Date.now()}`,
      send: vi.fn(),
      close: vi.fn(),
      readyState: 1, // OPEN
      on: vi.fn(),
      emit: vi.fn()
    };

    this.clients.add(client);
    
    // Mock message sending
    client.send.mockImplementation((data) => {
      this.messages.push({
        clientId: client.id,
        data,
        timestamp: new Date()
      });
    });

    return client;
  }

  // Mock broadcast to all clients
  mockBroadcast() {
    this.broadcast.mockImplementation((message) => {
      this.clients.forEach(client => {
        if (client.readyState === 1) { // OPEN
          client.send(message);
        }
      });
    });
  }

  // Get sent messages
  getMessages() {
    return this.messages;
  }

  // Clear messages
  clearMessages() {
    this.messages = [];
  }

  // Reset all mocks
  reset() {
    this.clients.clear();
    this.messages = [];
    vi.clearAllMocks();
  }
}

export class MockFileSystem {
  constructor() {
    this.files = new Map();
    this.readFile = vi.fn();
    this.writeFile = vi.fn();
    this.unlink = vi.fn();
    this.exists = vi.fn();
    this.mkdir = vi.fn();
    this.readdir = vi.fn();
    this.stat = vi.fn();
  }

  // Setup filesystem mocks
  setupMocks() {
    this.readFile.mockImplementation(async (path) => {
      const file = this.files.get(path);
      if (!file) {
        throw new Error(`ENOENT: no such file or directory '${path}'`);
      }
      return file.content;
    });

    this.writeFile.mockImplementation(async (path, content) => {
      this.files.set(path, {
        content,
        timestamp: new Date(),
        size: Buffer.byteLength(content)
      });
    });

    this.unlink.mockImplementation(async (path) => {
      if (!this.files.has(path)) {
        throw new Error(`ENOENT: no such file or directory '${path}'`);
      }
      this.files.delete(path);
    });

    this.exists.mockImplementation(async (path) => {
      return this.files.has(path);
    });

    this.stat.mockImplementation(async (path) => {
      const file = this.files.get(path);
      if (!file) {
        throw new Error(`ENOENT: no such file or directory '${path}'`);
      }
      return {
        size: file.size,
        mtime: file.timestamp,
        isFile: () => true,
        isDirectory: () => false
      };
    });
  }

  // Add mock file
  addFile(path, content) {
    this.files.set(path, {
      content,
      timestamp: new Date(),
      size: Buffer.byteLength(content)
    });
  }

  // Reset filesystem
  reset() {
    this.files.clear();
    vi.clearAllMocks();
    this.setupMocks();
  }
}

/**
 * MockServices - Central mock service manager
 */
export class MockServices {
  constructor() {
    this.openai = new MockOpenAI();
    this.deepgram = new MockDeepgram();
    this.huggingface = new MockHuggingFace();
    this.redis = new MockRedis();
    this.email = new MockEmail();
    this.websocket = new MockWebSocket();
    this.filesystem = new MockFileSystem();

    // Initialize all mocks
    this.initialize();
  }

  // Initialize all mock services
  initialize() {
    this.redis.setupMocks();
    this.email.mockSendEmail();
    this.websocket.mockBroadcast();
    this.filesystem.setupMocks();

    // Setup default mock responses
    this.openai.mockChatCompletion();
    this.openai.mockEmbeddings();
    this.deepgram.mockTranscription();
    this.huggingface.mockTextClassification();
  }

  // Reset all mock services
  resetAll() {
    this.openai.reset();
    this.deepgram.reset();
    this.huggingface.reset();
    this.redis.reset();
    this.email.reset();
    this.websocket.reset();
    this.filesystem.reset();

    // Re-initialize
    this.initialize();
  }

  // Get mock implementation for dependency injection
  getMockImplementations() {
    return {
      openai: this.openai,
      deepgram: this.deepgram,
      huggingface: this.huggingface,
      redis: this.redis,
      email: this.email,
      websocket: this.websocket,
      filesystem: this.filesystem
    };
  }

  // Mock environment variables for testing
  mockEnvironment(envVars = {}) {
    const originalEnv = process.env;
    
    beforeEach(() => {
      process.env = {
        ...originalEnv,
        NODE_ENV: 'test',
        JWT_SECRET: 'test-jwt-secret',
        OPENAI_API_KEY: 'mock-openai-key',
        DEEPGRAM_API_KEY: 'mock-deepgram-key',
        REDIS_URL: 'redis://localhost:6379',
        ...envVars
      };
    });

    afterEach(() => {
      process.env = originalEnv;
    });
  }

  // Create mock Express app with services
  mockExpressApp() {
    const mockApp = {
      use: vi.fn(),
      get: vi.fn(),
      post: vi.fn(),
      put: vi.fn(),
      delete: vi.fn(),
      patch: vi.fn(),
      listen: vi.fn(),
      locals: {}
    };

    // Inject mock services into app locals
    mockApp.locals.mockServices = this.getMockImplementations();

    return mockApp;
  }
}

export default MockServices;

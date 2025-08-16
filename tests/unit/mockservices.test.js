/**
 * @fileovervi      expect(mockOpenAI.chat.completions.create).      expect(mockDeepgram.listen.pr      expect(mockHuggingFace.textGene      expect(mockRedis.get).toBeT      expect(mockEmail.sendMail).toBeTypeOf('function');peOf('function');
      expect(mockRedis.set).toBeTypeOf('function');tion).toBeTypeOf('function');
      expect(mockHuggingFace.featureExtraction).toBeTypeOf('function');ecorded.transcribeFile).toBeTypeOf('function');oBeTypeOf('function');
      expect(mockOpenAI.embeddings.create).toBeTypeOf('function'); MockServices Unit Tests
 * Validates all mock service implementations for testing framework
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MockOpenAI, MockDeepgram, MockHuggingFace, MockRedis, MockEmail } from '../utils/MockServices.js';

describe('MockServices Unit Tests', () => {
  describe('MockOpenAI', () => {
    let mockOpenAI;

    beforeEach(() => {
      mockOpenAI = new MockOpenAI();
    });

    it('should create mock OpenAI instance', () => {
      expect(mockOpenAI).toBeDefined();
      expect(mockOpenAI.chat.completions.create).toBeTypeOf('function');
      expect(mockOpenAI.embeddings.create).toBeTypeOf('function');
    });

    it('should mock chat completion successfully', async () => {
      mockOpenAI.mockChatCompletion('Test AI response');
      
      const result = await mockOpenAI.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: 'Hello' }]
      });

      expect(result.choices[0].message.content).toBe('Test AI response');
      expect(result.usage.total_tokens).toBe(30);
    });

    it('should mock embeddings creation', async () => {
      mockOpenAI.mockEmbeddings([0.1, 0.2, 0.3]);
      
      const result = await mockOpenAI.embeddings.create({
        model: 'text-embedding-ada-002',
        input: 'test text'
      });

      expect(result.data[0].embedding).toEqual([0.1, 0.2, 0.3]);
    });

    it('should mock error responses', async () => {
      mockOpenAI.mockError(new Error('API rate limit exceeded'));
      
      await expect(
        mockOpenAI.chat.completions.create({
          model: 'gpt-3.5-turbo',
          messages: [{ role: 'user', content: 'Hello' }]
        })
      ).rejects.toThrow('API rate limit exceeded');
    });
  });

  describe('MockDeepgram', () => {
    let mockDeepgram;

    beforeEach(() => {
      mockDeepgram = new MockDeepgram();
    });

    it('should create mock Deepgram instance', () => {
      expect(mockDeepgram).toBeDefined();
      expect(mockDeepgram.listen.prerecorded.transcribeFile).toBeTypeOf("function");
    });

    it('should mock transcription successfully', async () => {
      mockDeepgram.mockTranscription('Hello world');
      
      const result = await mockDeepgram.listen.prerecorded.transcribeFile(
        Buffer.from('fake audio data'),
        { model: 'nova' }
      );

      expect(result.results.channels[0].alternatives[0].transcript).toBe('Hello world');
    });

    it('should mock transcription with confidence', async () => {
      mockDeepgram.mockTranscription('Hello world', 0.95);
      
      const result = await mockDeepgram.listen.prerecorded.transcribeFile(
        Buffer.from('fake audio data'),
        { model: 'nova' }
      );

      expect(result.results.channels[0].alternatives[0].confidence).toBe(0.95);
    });
  });

  describe('MockHuggingFace', () => {
    let mockHuggingFace;

    beforeEach(() => {
      mockHuggingFace = new MockHuggingFace();
    });

    it('should create mock HuggingFace instance', () => {
      expect(mockHuggingFace).toBeDefined();
      expect(mockHuggingFace.textGeneration).toBeTypeOf("function");
      expect(mockHuggingFace.featureExtraction).toBeTypeOf("function");
    });

    it('should mock text generation', async () => {
      mockHuggingFace.mockTextGeneration('Generated text response');
      
      const result = await mockHuggingFace.textGeneration({
        model: 'gpt2',
        inputs: 'Test prompt'
      });

      expect(result[0].generated_text).toBe('Generated text response');
    });

    it('should mock feature extraction', async () => {
      mockHuggingFace.mockFeatureExtraction([[0.1, 0.2, 0.3]]);
      
      const result = await mockHuggingFace.featureExtraction({
        model: 'sentence-transformers/all-MiniLM-L6-v2',
        inputs: 'test text'
      });

      expect(result[0]).toEqual([0.1, 0.2, 0.3]);
    });
  });

  describe('MockRedis', () => {
    let mockRedis;

    beforeEach(() => {
      mockRedis = new MockRedis();
    });

    it('should create mock Redis instance', () => {
      expect(mockRedis).toBeDefined();
      expect(mockRedis.get).toBeTypeOf("function");
      expect(mockRedis.set).toBeTypeOf("function");
    });

    it('should mock Redis get/set operations', async () => {
      await mockRedis.set('test_key', 'test_value');
      const result = await mockRedis.get('test_key');
      
      expect(result).toBe('test_value');
    });

    it('should handle Redis expiration', async () => {
      await mockRedis.set('test_key', 'test_value', 'EX', 1);
      
      // Should have value initially
      expect(await mockRedis.get('test_key')).toBe('test_value');
      
      // Simulate expiration
      await mockRedis.flushall();
      expect(await mockRedis.get('test_key')).toBeNull();
    });
  });

  describe('MockEmail', () => {
    let mockEmail;

    beforeEach(() => {
      mockEmail = new MockEmail();
    });

    it('should create mock Email instance', () => {
      expect(mockEmail).toBeDefined();
      expect(mockEmail.sendMail).toBeTypeOf("function");
    });

    it('should mock email sending', async () => {
      mockEmail.mockSuccess('email_123');
      
      const result = await mockEmail.sendMail({
        to: 'test@example.com',
        subject: 'Test',
        text: 'Test message'
      });

      expect(result.messageId).toBe('email_123');
      expect(result.accepted[0]).toBe('test@example.com');
    });

    it('should track sent emails', async () => {
      await mockEmail.sendMail({
        to: 'test1@example.com',
        subject: 'Test 1',
        text: 'Test message 1'
      });
      
      await mockEmail.sendMail({
        to: 'test2@example.com',
        subject: 'Test 2',
        text: 'Test message 2'
      });

      const sentEmails = mockEmail.getSentEmails();
      expect(sentEmails).toHaveLength(2);
      expect(sentEmails[0].to).toBe('test1@example.com');
      expect(sentEmails[1].to).toBe('test2@example.com');
    });
  });
});

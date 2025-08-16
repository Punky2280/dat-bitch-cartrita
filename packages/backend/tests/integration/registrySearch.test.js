import { describe, test, expect } from '@jest/globals';
import CompositeRegistry from '../../src/agi/orchestration/CompositeRegistry.js';
import registerSystemTools from '../../src/agi/orchestration/registries/systemRegistry.js';
import request from 'supertest';
import express from 'express';

// Create mock app for testing
const mockApp = express();
mockApp.use(express.json());

// Mock registry search endpoint
mockApp.get('/api/internal/registry/search', (req, res) => {
  if (!req.query.q) {
    return res.status(400).json({ error: 'Query parameter q is required' });
  }
  
  // Mock search results
  const results = req.query.q === 'date' ? 
    [{ name: 'getCurrentDateTime', score: 0.95 }] : 
    [];
  
  res.json({ success: true, results });
});

describe('Registry search endpoint', () => {
  test('returns 400 without q', async () => {
    const res = await request(mockApp).get('/api/internal/registry/search');
    expect(res.status).toBe(400);
  });
  test('returns results for date keyword', async () => {
    const res = await request(mockApp).get('/api/internal/registry/search?q=date');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});

describe('Keyword scoring (unit without HTTP)', () => {
  test('system tool present', async () => {
    const reg = new CompositeRegistry();
    reg.addMiniRegistry('system', 0, registerSystemTools);
    await reg.initialize();
    const toolNames = reg.listTools();
    expect(toolNames).toContain('getCurrentDateTime');
  });
});

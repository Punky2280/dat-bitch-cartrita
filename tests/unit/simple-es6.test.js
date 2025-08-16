/**
 * @fileoverview Simple ES6 Module Test
 */

import { describe, it, expect, vi } from 'vitest';
import { MockOpenAI } from '../utils/MockServices.js';

describe('Simple ES6 Module Test', () => {
  it('should import MockOpenAI successfully', () => {
    const mockOpenAI = new MockOpenAI();
    expect(mockOpenAI).toBeDefined();
    expect(mockOpenAI.chat).toBeDefined();
    expect(mockOpenAI.chat.completions).toBeDefined();
    expect(typeof mockOpenAI.chat.completions.create).toBe('function');
  });
});

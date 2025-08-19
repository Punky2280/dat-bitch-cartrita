// Jest setup for integration tests
import { beforeAll, afterAll } from '@jest/globals';

// Global test timeout
jest.setTimeout(30000);

// Setup before all tests
beforeAll(async () => {
  // Ensure environment variables are loaded
  if (!process.env.POSTGRES_HOST) {
    process.env.POSTGRES_HOST = 'localhost';
  }
  if (!process.env.POSTGRES_PORT) {
    process.env.POSTGRES_PORT = '5432';
  }
  if (!process.env.POSTGRES_USER) {
    process.env.POSTGRES_USER = 'robert';
  }
  if (!process.env.POSTGRES_DB) {
    process.env.POSTGRES_DB = 'dat-bitch-cartrita';
  }
});

// Cleanup after all tests
afterAll(async () => {
  // Clean up any remaining connections or resources
});
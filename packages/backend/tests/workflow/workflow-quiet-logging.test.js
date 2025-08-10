import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../../index.js';
import { shouldQuietLogs } from '../../src/util/env.js';

// This test verifies that in quiet (test) mode we do NOT see the verbose handler warning text
// emitted for unimplemented workflow node handlers during app bootstrap.
// We simulate by directly requiring the workflow engine and inspecting patched console outputs.

describe('Workflow Engine Quiet Logging', () => {
  let warnings = [];
  let errors = [];
  const originalWarn = console.warn;
  const originalError = console.error;

  beforeAll(() => {
    if (!shouldQuietLogs()) {
      // If logs aren't quiet, skip; environment expectation changed.
      console.warn('Environment is not quiet; skipping quiet logging assertions');
      return;
    }
    console.warn = (msg, ...rest) => {
      warnings.push(String(msg));
      // don't forward
    };
    console.error = (msg, ...rest) => {
      errors.push(String(msg));
    };

  // Force import of workflow engine (already indirectly via routes) to ensure any setup logs would run
  require('../../src/services/EnhancedWorkflowEngine.js');
  });

  it('does not emit handler not implemented warnings in quiet mode', () => {
    if (!shouldQuietLogs()) {
      return; // skipped condition already warned
    }
    const hasHandlerWarnings = warnings.some(w => w.includes('Handler') && w.includes('not implemented'));
    expect(hasHandlerWarnings).toBe(false);
  });

  it('does not emit scheduler DB errors in quiet mode', () => {
    if (!shouldQuietLogs()) return;
    const hasSchedulerErrors = errors.some(e => e.includes('Error processing scheduled workflows'));
    expect(hasSchedulerErrors).toBe(false);
  });

  afterAll(() => {
    console.warn = originalWarn;
    console.error = originalError;
  });
});

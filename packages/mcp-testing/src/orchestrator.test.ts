// @ts-nocheck
import { describe, it, expect } from 'vitest';
import { start as startOrchestrator } from '@cartrita/orchestrator/src/server.ts';
import { startSupervisor } from '@cartrita/supervisor-intelligence/src/index.ts';
import { createTaskRequestMessage, sharedInProcessTransport } from '@cartrita/mcp-core';

describe('MCP E2E', () => {
  it('routes a TASK_REQUEST to supervisor and receives TASK_RESPONSE', async () => {
    startSupervisor();
    await startOrchestrator(0); // random port
    const taskMsg = createTaskRequestMessage({
      sender: 'test-client',
      recipient: 'supervisor-intelligence',
      task: { task_type: 'echo', parameters: { value: 42 } }
    });

    let gotResponse = null;
  sharedInProcessTransport.subscribe('orchestrator', m => {
      if (m.message_type === 'TASK_RESPONSE' && m.correlation_id === taskMsg.id) {
        gotResponse = m;
      }
    });
    sharedInProcessTransport.publish(taskMsg);

    const start = Date.now();
    while (!gotResponse && Date.now() - start < 3000) {
      await new Promise(r => setTimeout(r, 25));
    }
    if (!gotResponse) {
      console.error('Did not receive response within timeout');
    }
    expect(gotResponse).toBeTruthy();
  });
});

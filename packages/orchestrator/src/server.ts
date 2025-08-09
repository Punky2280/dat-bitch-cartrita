// @ts-nocheck
import Fastify from 'fastify';
import { createTaskRequestMessage, TaskRequestSchema, validateMessage, sharedInProcessTransport } from '@cartrita/mcp-core';

const fastify = Fastify({ logger: true });

fastify.get('/healthz', async () => ({ status: 'ok' }));

fastify.post('/v3/mcp/bridge', async (request, reply) => {
  try {
    const body: any = request.body;
    const parsedTask = TaskRequestSchema.parse({
      task_type: body.task_type,
      task_id: body.task_id,
      parameters: body.parameters,
      metadata: body.metadata,
      preferred_agent: body.preferred_agent,
      priority: body.priority,
      deadline: body.deadline,
    });
    const msg = createTaskRequestMessage({
      sender: 'orchestrator',
      recipient: 'supervisor-intelligence',
      task: parsedTask,
      context: { request_id: parsedTask.task_id },
    });
    sharedInProcessTransport.publish(msg);
    reply.code(202).send({ success: true, id: msg.id, task_id: parsedTask.task_id });
  } catch (err: any) {
    reply.code(400).send({ success: false, error: err.message });
  }
});

let lastResponses: any[] = [];
fastify.get('/v3/mcp/last-responses', async () => {
  return { success: true, data: lastResponses.slice(-20) };
});

sharedInProcessTransport.subscribe('orchestrator', msg => {
  if (process.env.MCP_DEBUG) console.log('[orchestrator] inbound', msg.message_type, 'corr', msg.correlation_id);
  if (msg.recipient === 'orchestrator' && msg.message_type === 'TASK_RESPONSE') {
    try { validateMessage(msg); } catch { return; }
    lastResponses.push(msg);
    if (lastResponses.length > 100) lastResponses = lastResponses.slice(-50);
  }
});

export async function start(port = Number(process.env.ORCHESTRATOR_PORT) || 3100) {
  await fastify.listen({ port, host: '0.0.0.0' });
  return fastify;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  start();
}

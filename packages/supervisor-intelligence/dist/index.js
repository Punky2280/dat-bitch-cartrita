// @ts-nocheck
import { validateMessage, TaskRequestSchema, TaskResponseSchema, sharedInProcessTransport } from '@cartrita/mcp-core';
sharedInProcessTransport.subscribe('supervisor-intelligence', msg => {
    // debug
    if (process.env.MCP_DEBUG)
        console.log('[supervisor-intelligence] received', msg.message_type, msg.id, 'to', msg.recipient);
    if (msg.recipient !== 'supervisor-intelligence' || msg.message_type !== 'TASK_REQUEST')
        return;
    let taskReq;
    try {
        taskReq = TaskRequestSchema.parse(msg.payload);
    }
    catch {
        return;
    }
    const response = validateMessage({
        sender: 'supervisor-intelligence',
        recipient: 'orchestrator',
        message_type: 'TASK_RESPONSE',
        correlation_id: msg.id,
        payload: TaskResponseSchema.parse({
            task_id: taskReq.task_id,
            status: 'COMPLETED',
            result: { echo: taskReq.parameters ?? null, handled_by: 'supervisor-intelligence', task_type: taskReq.task_type },
            metrics: { processing_time_ms: Math.floor(Math.random() * 10) }
        })
    });
    if (process.env.MCP_DEBUG)
        console.log('[supervisor-intelligence] publishing response for', taskReq.task_id);
    sharedInProcessTransport.publish(response);
});
export function startSupervisor() { return sharedInProcessTransport; }
if (import.meta.url === `file://${process.argv[1]}`)
    startSupervisor();

import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';

export const MessageTypeEnum = z.enum([
  'TASK_REQUEST',
  'TASK_RESPONSE',
  'STREAM_START',
  'STREAM_CHUNK',
  'STREAM_END',
  'EVENT',
  'ERROR',
]);

export const DeliveryGuaranteeEnum = z.enum([
  'AT_MOST_ONCE',
  'AT_LEAST_ONCE',
  'EXACTLY_ONCE',
]);

export const TaskStatusEnum = z.enum([
  'PENDING',
  'RUNNING',
  'COMPLETED',
  'FAILED',
  'CANCELLED',
  'TIMEOUT',
]);

export const CostBudgetSchema = z.object({
  max_usd: z.number().nonnegative().optional(),
  max_tokens: z.number().int().nonnegative().optional(),
  used_usd: z.number().nonnegative().default(0),
  used_tokens: z.number().int().nonnegative().default(0),
  model_costs: z.record(z.number().nonnegative()).optional(),
});

export const ResourceLimitsSchema = z.object({
  max_cpu_percent: z.number().int().min(1).max(100).optional(),
  max_memory_mb: z.number().int().positive().optional(),
  max_concurrent_requests: z.number().int().positive().optional(),
  max_processing_time_ms: z.number().int().positive().optional(),
});

export const MCPContextSchema = z.object({
  trace_id: z.string().uuid().optional(),
  span_id: z.string().optional(),
  parent_span_id: z.string().optional(),
  baggage: z.record(z.string()).optional(),
  user_id: z.string().optional(),
  session_id: z.string().optional(),
  workspace_id: z.string().optional(),
  request_id: z.string().optional(),
  timeout_ms: z.number().int().positive().optional(),
  metadata: z.record(z.string()).optional(),
  budget: CostBudgetSchema.optional(),
  limits: ResourceLimitsSchema.optional(),
});
export type MCPContext = z.infer<typeof MCPContextSchema>;

export const DeliveryOptionsSchema = z.object({
  guarantee: DeliveryGuaranteeEnum.default('AT_MOST_ONCE'),
  retry_count: z.number().int().min(0).max(10).default(0),
  retry_delay_ms: z.number().int().min(0).max(60_000).default(0),
  require_ack: z.boolean().default(false),
  priority: z.number().int().min(0).max(10).default(5),
});
export type DeliveryOptions = z.infer<typeof DeliveryOptionsSchema>;

export const TaskRequestSchema = z.object({
  task_type: z.string(),
  task_id: z.string().default(() => uuidv4()),
  parameters: z.any().optional(),
  metadata: z.record(z.string()).optional(),
  preferred_agent: z.string().optional(),
  priority: z.number().int().min(0).max(10).default(5),
  deadline: z.string().datetime().optional(),
});
export type TaskRequest = z.infer<typeof TaskRequestSchema>;

export const TaskMetricsSchema = z.object({
  processing_time_ms: z.number().int().nonnegative().optional(),
  queue_time_ms: z.number().int().nonnegative().optional(),
  retry_count: z.number().int().nonnegative().optional(),
  cost_usd: z.number().nonnegative().optional(),
  tokens_used: z.number().int().nonnegative().optional(),
  model_used: z.string().optional(),
  custom_metrics: z.record(z.number()).optional(),
});

export const TaskResponseSchema = z.object({
  task_id: z.string(),
  status: TaskStatusEnum,
  result: z.any().optional(),
  error_message: z.string().optional(),
  error_code: z.string().optional(),
  metrics: TaskMetricsSchema.optional(),
  warnings: z.array(z.string()).optional(),
});
export type TaskResponse = z.infer<typeof TaskResponseSchema>;

export const StreamStartSchema = z.object({
  stream_id: z.string().default(() => uuidv4()),
  content_type: z.string(),
  metadata: z.record(z.string()).optional(),
  estimated_size: z.number().int().nonnegative().optional(),
});
export const StreamChunkSchema = z.object({
  stream_id: z.string(),
  sequence: z.number().int().nonnegative(),
  data: z.instanceof(Buffer),
  is_final: z.boolean().optional(),
});
export const StreamEndSchema = z.object({
  stream_id: z.string(),
  status: z.enum(['COMPLETED', 'CANCELLED', 'FAILED']).default('COMPLETED'),
  error_message: z.string().optional(),
  total_bytes: z.number().int().nonnegative().optional(),
});

export const MCPMessageSchema = z.object({
  id: z.string().uuid().default(() => uuidv4()),
  correlation_id: z.string().uuid().optional(),
  trace_id: z.string().uuid().optional(),
  span_id: z.string().optional(),
  sender: z.string(),
  recipient: z.string(),
  message_type: MessageTypeEnum,
  payload: z.any().optional(),
  tags: z.array(z.string()).optional(),
  context: MCPContextSchema.optional(),
  delivery: DeliveryOptionsSchema.optional(),
  created_at: z.string().datetime().default(() => new Date().toISOString()),
  expires_at: z.string().datetime().optional(),
  security_token: z.string().optional(),
  permissions: z.array(z.string()).optional(),
});
export type MCPMessage = z.infer<typeof MCPMessageSchema>;

export function validateMessage(input: unknown): MCPMessage {
  return MCPMessageSchema.parse(input);
}

export function createTaskRequestMessage(args: { sender: string; recipient: string; task: TaskRequest; context?: MCPContext; delivery?: DeliveryOptions; }): MCPMessage {
  return validateMessage({
    sender: args.sender,
    recipient: args.recipient,
    message_type: 'TASK_REQUEST',
    payload: TaskRequestSchema.parse(args.task),
    context: args.context,
    delivery: args.delivery,
  });
}

export function createErrorMessage(args: { sender: string; recipient: string; correlation_id?: string; error: Error | string; context?: MCPContext; }): MCPMessage {
  const message = typeof args.error === 'string' ? args.error : args.error.message;
  return validateMessage({
    sender: args.sender,
    recipient: args.recipient,
    message_type: 'ERROR',
    correlation_id: args.correlation_id,
    payload: { message },
    context: args.context,
  });
}

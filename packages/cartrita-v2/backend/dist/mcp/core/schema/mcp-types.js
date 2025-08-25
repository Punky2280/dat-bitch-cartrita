/**
 * @fileoverview MCP Schema Types and Validation
 * TypeScript-first schema definitions with Zod validation for development
 * These types mirror the Protobuf definitions for cross-language compatibility
 */
import { z } from 'zod';
// Core enums
export var DeliveryGuarantee;
(function (DeliveryGuarantee) {
  DeliveryGuarantee['AT_MOST_ONCE'] = 'AT_MOST_ONCE';
  DeliveryGuarantee['AT_LEAST_ONCE'] = 'AT_LEAST_ONCE';
  DeliveryGuarantee['EXACTLY_ONCE'] = 'EXACTLY_ONCE';
})(DeliveryGuarantee || (DeliveryGuarantee = {}));
export var TaskStatus;
(function (TaskStatus) {
  TaskStatus['PENDING'] = 'PENDING';
  TaskStatus['RUNNING'] = 'RUNNING';
  TaskStatus['COMPLETED'] = 'COMPLETED';
  TaskStatus['FAILED'] = 'FAILED';
  TaskStatus['CANCELLED'] = 'CANCELLED';
  TaskStatus['TIMEOUT'] = 'TIMEOUT';
})(TaskStatus || (TaskStatus = {}));
export var AgentType;
(function (AgentType) {
  AgentType['ORCHESTRATOR'] = 'ORCHESTRATOR';
  AgentType['SUPERVISOR'] = 'SUPERVISOR';
  AgentType['SUB_AGENT'] = 'SUB_AGENT';
})(AgentType || (AgentType = {}));
export var StreamStatus;
(function (StreamStatus) {
  StreamStatus['COMPLETED'] = 'COMPLETED';
  StreamStatus['CANCELLED'] = 'CANCELLED';
  StreamStatus['FAILED'] = 'FAILED';
})(StreamStatus || (StreamStatus = {}));
export var CommandType;
(function (CommandType) {
  CommandType['SHUTDOWN'] = 'SHUTDOWN';
  CommandType['RESTART'] = 'RESTART';
  CommandType['SCALE_UP'] = 'SCALE_UP';
  CommandType['SCALE_DOWN'] = 'SCALE_DOWN';
  CommandType['HEALTH_CHECK'] = 'HEALTH_CHECK';
  CommandType['CONFIG_UPDATE'] = 'CONFIG_UPDATE';
})(CommandType || (CommandType = {}));
// Zod schemas for runtime validation
export const CostBudgetSchema = z.object({
  maxUsd: z.number().min(0),
  maxTokens: z.number().int().min(0),
  usedUsd: z.number().min(0),
  usedTokens: z.number().int().min(0),
  modelCosts: z.record(z.string(), z.number().min(0)),
});
export const ResourceLimitsSchema = z.object({
  maxCpuPercent: z.number().int().min(0).max(100),
  maxMemoryMb: z.number().int().min(0),
  maxConcurrentRequests: z.number().int().min(1),
  maxProcessingTimeMs: z.number().int().min(0),
});
export const MCPContextSchema = z.object({
  traceId: z.string(),
  spanId: z.string(),
  parentSpanId: z.string().optional(),
  baggage: z.record(z.string(), z.string()),
  userId: z.string().optional(),
  sessionId: z.string().optional(),
  workspaceId: z.string().optional(),
  requestId: z.string(),
  timeoutMs: z.number().int().min(0),
  metadata: z.record(z.string(), z.string()),
  budget: CostBudgetSchema.optional(),
  limits: ResourceLimitsSchema.optional(),
});
export const DeliveryOptionsSchema = z.object({
  guarantee: z.nativeEnum(DeliveryGuarantee),
  retryCount: z.number().int().min(0).max(10),
  retryDelayMs: z.number().int().min(0),
  requireAck: z.boolean(),
  priority: z.number().int().min(0).max(10),
});
export const MCPMessageSchema = z.object({
  id: z.string().uuid(),
  correlationId: z.string().optional(),
  traceId: z.string(),
  spanId: z.string(),
  sender: z.string(),
  recipient: z.string(),
  messageType: z.string(),
  payload: z.any(), // Will be validated by specific payload schemas
  tags: z.array(z.string()),
  context: MCPContextSchema,
  delivery: DeliveryOptionsSchema,
  createdAt: z.date(),
  expiresAt: z.date().optional(),
  securityToken: z.string().optional(),
  permissions: z.array(z.string()),
});
export const TaskMetricsSchema = z.object({
  processingTimeMs: z.number().int().min(0),
  queueTimeMs: z.number().int().min(0),
  retryCount: z.number().int().min(0),
  costUsd: z.number().min(0),
  tokensUsed: z.number().int().min(0),
  modelUsed: z.string().optional(),
  customMetrics: z.record(z.string(), z.number()),
});
export const TaskRequestSchema = z.object({
  taskType: z.string(),
  taskId: z.string().uuid(),
  parameters: z.any(),
  metadata: z.record(z.string(), z.string()),
  preferredAgent: z.string().optional(),
  priority: z.number().int().min(0).max(10),
  deadline: z.date().optional(),
});
export const TaskResponseSchema = z.object({
  taskId: z.string().uuid(),
  status: z.nativeEnum(TaskStatus),
  result: z.any().optional(),
  errorMessage: z.string().optional(),
  errorCode: z.string().optional(),
  metrics: TaskMetricsSchema,
  warnings: z.array(z.string()),
});
export const HealthStatusSchema = z.object({
  healthy: z.boolean(),
  statusMessage: z.string(),
  cpuUsage: z.number().min(0).max(100),
  memoryMb: z.number().int().min(0),
  activeTasks: z.number().int().min(0),
  lastHeartbeat: z.date(),
});
export const AgentRegistrationSchema = z.object({
  agentId: z.string(),
  agentName: z.string(),
  type: z.nativeEnum(AgentType),
  version: z.string(),
  capabilities: z.array(z.string()),
  metadata: z.record(z.string(), z.string()),
  health: HealthStatusSchema,
  registeredAt: z.date(),
});
export const StreamStartSchema = z.object({
  streamId: z.string().uuid(),
  contentType: z.string(),
  metadata: z.record(z.string(), z.string()),
  estimatedSize: z.number().int().min(0),
});
export const StreamDataSchema = z.object({
  streamId: z.string().uuid(),
  sequence: z.number().int().min(0),
  data: z.instanceof(Buffer),
  isFinal: z.boolean(),
});
export const StreamEndSchema = z.object({
  streamId: z.string().uuid(),
  status: z.nativeEnum(StreamStatus),
  errorMessage: z.string().optional(),
  totalBytes: z.number().int().min(0),
});
// Message type constants for routing
export const MessageTypes = {
  // Task messages
  TASK_REQUEST: 'TASK_REQUEST',
  TASK_RESPONSE: 'TASK_RESPONSE',
  TASK_PROGRESS: 'TASK_PROGRESS',
  TASK_CANCEL: 'TASK_CANCEL',
  // Stream messages
  STREAM_START: 'STREAM_START',
  STREAM_DATA: 'STREAM_DATA',
  STREAM_END: 'STREAM_END',
  // System messages
  HEARTBEAT: 'HEARTBEAT',
  HEALTH_CHECK: 'HEALTH_CHECK',
  AGENT_REGISTER: 'AGENT_REGISTER',
  AGENT_DEREGISTER: 'AGENT_DEREGISTER',
  // Control messages
  SYSTEM_COMMAND: 'SYSTEM_COMMAND',
  CONFIG_UPDATE: 'CONFIG_UPDATE',
  EMERGENCY_STOP: 'EMERGENCY_STOP',
};
// Task type definitions for different agent capabilities
export const TaskTypes = {
  // HuggingFace tasks
  'huggingface.text.generation': 'huggingface.text.generation',
  'huggingface.text.classification': 'huggingface.text.classification',
  'huggingface.text.summarization': 'huggingface.text.summarization',
  'huggingface.text.translation': 'huggingface.text.translation',
  'huggingface.text.question_answering': 'huggingface.text.question_answering',
  'huggingface.vision.classification': 'huggingface.vision.classification',
  'huggingface.vision.object_detection': 'huggingface.vision.object_detection',
  'huggingface.vision.segmentation': 'huggingface.vision.segmentation',
  'huggingface.audio.speech_recognition':
    'huggingface.audio.speech_recognition',
  'huggingface.audio.text_to_speech': 'huggingface.audio.text_to_speech',
  'huggingface.multimodal.visual_qa': 'huggingface.multimodal.visual_qa',
  // LangChain tasks
  'langchain.agent.execute': 'langchain.agent.execute',
  'langchain.chat.execute': 'langchain.chat.execute',
  'langchain.react.execute': 'langchain.react.execute',
  'langchain.generative.execute': 'langchain.generative.execute',
  'langchain.plan_execute': 'langchain.plan_execute',
  'langchain.babyagi.execute': 'langchain.babyagi.execute',
  // Deepgram tasks
  'deepgram.audio.transcribe.live': 'deepgram.audio.transcribe.live',
  'deepgram.audio.transcribe.file': 'deepgram.audio.transcribe.file',
  'deepgram.audio.agent.live': 'deepgram.audio.agent.live',
  // System tasks
  'system.health_check': 'system.health_check',
  'system.telemetry_query': 'system.telemetry_query',
  'system.config_update': 'system.config_update',
  // Life OS tasks
  'lifeos.calendar.sync': 'lifeos.calendar.sync',
  'lifeos.email.process': 'lifeos.email.process',
  'lifeos.contact.search': 'lifeos.contact.search',
  // Security tasks
  'security.audit': 'security.audit',
  'security.vulnerability_scan': 'security.vulnerability_scan',
  'security.compliance_check': 'security.compliance_check',
  // Memory tasks
  'memory.knowledge_graph.upsert': 'memory.knowledge_graph.upsert',
  'memory.knowledge_graph.query': 'memory.knowledge_graph.query',
  'memory.context.retrieve': 'memory.context.retrieve',
  'memory.context.store': 'memory.context.store',
  // Specialized agent tasks
  'research.web.search': 'research.web.search',
  'research.web.scrape': 'research.web.scrape',
  'writer.compose': 'writer.compose',
  'codewriter.generate': 'codewriter.generate',
  'analytics.run_query': 'analytics.run_query',
  'scheduler.schedule_event': 'scheduler.schedule_event',
  'multimodal.fuse': 'multimodal.fuse',
  'translation.detect_translate': 'translation.detect_translate',
  'notification.send': 'notification.send',
  'artist.generate_image': 'artist.generate_image',
  'design.create_mockup': 'design.create_mockup',
  'comedian.generate_joke': 'comedian.generate_joke',
};
// Agent capability mappings
export const AgentCapabilities = {
  // Tier 1 Supervisors
  intelligence: [
    TaskTypes['langchain.agent.execute'],
    TaskTypes['langchain.chat.execute'],
    TaskTypes['langchain.react.execute'],
    TaskTypes['huggingface.text.generation'],
    TaskTypes['huggingface.text.classification'],
    TaskTypes['research.web.search'],
    TaskTypes['writer.compose'],
    TaskTypes['codewriter.generate'],
    TaskTypes['analytics.run_query'],
  ],
  multimodal: [
    TaskTypes['huggingface.vision.classification'],
    TaskTypes['huggingface.audio.speech_recognition'],
    TaskTypes['deepgram.audio.transcribe.live'],
    TaskTypes['deepgram.audio.agent.live'],
    TaskTypes['multimodal.fuse'],
    TaskTypes['artist.generate_image'],
  ],
  system: [
    TaskTypes['system.health_check'],
    TaskTypes['system.telemetry_query'],
    TaskTypes['lifeos.calendar.sync'],
    TaskTypes['security.audit'],
    TaskTypes['memory.knowledge_graph.query'],
    TaskTypes['notification.send'],
  ],
  // Tier 2 Sub-agents would be mapped individually
};
// Error codes for standardized error handling
export const ErrorCodes = {
  // Validation errors
  INVALID_MESSAGE_FORMAT: 'INVALID_MESSAGE_FORMAT',
  INVALID_TASK_TYPE: 'INVALID_TASK_TYPE',
  INVALID_PARAMETERS: 'INVALID_PARAMETERS',
  // Resource errors
  INSUFFICIENT_BUDGET: 'INSUFFICIENT_BUDGET',
  RESOURCE_LIMIT_EXCEEDED: 'RESOURCE_LIMIT_EXCEEDED',
  AGENT_UNAVAILABLE: 'AGENT_UNAVAILABLE',
  QUEUE_FULL: 'QUEUE_FULL',
  // Execution errors
  TASK_TIMEOUT: 'TASK_TIMEOUT',
  TASK_CANCELLED: 'TASK_CANCELLED',
  AGENT_ERROR: 'AGENT_ERROR',
  NETWORK_ERROR: 'NETWORK_ERROR',
  // Security errors
  AUTHENTICATION_FAILED: 'AUTHENTICATION_FAILED',
  AUTHORIZATION_FAILED: 'AUTHORIZATION_FAILED',
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  // System errors
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
  CONFIGURATION_ERROR: 'CONFIGURATION_ERROR',
};
// Validation utilities
export class MCPValidator {
  /**
   * Validate an MCP message against its schema
   */
  static validateMessage(message) {
    return MCPMessageSchema.parse(message);
  }
  /**
   * Validate a task request
   */
  static validateTaskRequest(request) {
    return TaskRequestSchema.parse(request);
  }
  /**
   * Validate a task response
   */
  static validateTaskResponse(response) {
    return TaskResponseSchema.parse(response);
  }
  /**
   * Safely validate with detailed error information
   */
  static safeValidate(schema, data) {
    const result = schema.safeParse(data);
    if (result.success) {
      return { success: true, data: result.data };
    } else {
      return {
        success: false,
        errors: result.error.errors.map(
          err => `${err.path.join('.')}: ${err.message}`
        ),
      };
    }
  }
  /**
   * Validate task type is supported
   */
  static isValidTaskType(taskType) {
    return Object.values(TaskTypes).includes(taskType);
  }
  /**
   * Get supervisor for task type
   */
  static getSupervisorForTask(taskType) {
    for (const [supervisor, capabilities] of Object.entries(
      AgentCapabilities
    )) {
      if (capabilities.includes(taskType)) {
        return supervisor;
      }
    }
    return 'intelligence'; // Default fallback
  }
}
export default {
  // Schemas
  MCPMessageSchema,
  TaskRequestSchema,
  TaskResponseSchema,
  MCPContextSchema,
  DeliveryOptionsSchema,
  AgentRegistrationSchema,
  HealthStatusSchema,
  // Types
  DeliveryGuarantee,
  TaskStatus,
  AgentType,
  StreamStatus,
  CommandType,
  MessageTypes,
  TaskTypes,
  ErrorCodes,
  // Utilities
  MCPValidator,
};

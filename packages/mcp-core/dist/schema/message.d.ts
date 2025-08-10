import { z } from 'zod';
export declare const MessageTypeEnum: z.ZodEnum<["TASK_REQUEST", "TASK_RESPONSE", "STREAM_START", "STREAM_CHUNK", "STREAM_END", "EVENT", "ERROR"]>;
export declare const DeliveryGuaranteeEnum: z.ZodEnum<["AT_MOST_ONCE", "AT_LEAST_ONCE", "EXACTLY_ONCE"]>;
export declare const TaskStatusEnum: z.ZodEnum<["PENDING", "RUNNING", "COMPLETED", "FAILED", "CANCELLED", "TIMEOUT"]>;
export declare const CostBudgetSchema: z.ZodObject<{
    max_usd: z.ZodOptional<z.ZodNumber>;
    max_tokens: z.ZodOptional<z.ZodNumber>;
    used_usd: z.ZodDefault<z.ZodNumber>;
    used_tokens: z.ZodDefault<z.ZodNumber>;
    model_costs: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodNumber>>;
}, "strip", z.ZodTypeAny, {
    used_usd: number;
    used_tokens: number;
    max_usd?: number | undefined;
    max_tokens?: number | undefined;
    model_costs?: Record<string, number> | undefined;
}, {
    max_usd?: number | undefined;
    max_tokens?: number | undefined;
    used_usd?: number | undefined;
    used_tokens?: number | undefined;
    model_costs?: Record<string, number> | undefined;
}>;
export declare const ResourceLimitsSchema: z.ZodObject<{
    max_cpu_percent: z.ZodOptional<z.ZodNumber>;
    max_memory_mb: z.ZodOptional<z.ZodNumber>;
    max_concurrent_requests: z.ZodOptional<z.ZodNumber>;
    max_processing_time_ms: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    max_cpu_percent?: number | undefined;
    max_memory_mb?: number | undefined;
    max_concurrent_requests?: number | undefined;
    max_processing_time_ms?: number | undefined;
}, {
    max_cpu_percent?: number | undefined;
    max_memory_mb?: number | undefined;
    max_concurrent_requests?: number | undefined;
    max_processing_time_ms?: number | undefined;
}>;
export declare const MCPContextSchema: z.ZodObject<{
    trace_id: z.ZodOptional<z.ZodString>;
    span_id: z.ZodOptional<z.ZodString>;
    parent_span_id: z.ZodOptional<z.ZodString>;
    baggage: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
    user_id: z.ZodOptional<z.ZodString>;
    session_id: z.ZodOptional<z.ZodString>;
    workspace_id: z.ZodOptional<z.ZodString>;
    request_id: z.ZodOptional<z.ZodString>;
    timeout_ms: z.ZodOptional<z.ZodNumber>;
    metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
    budget: z.ZodOptional<z.ZodObject<{
        max_usd: z.ZodOptional<z.ZodNumber>;
        max_tokens: z.ZodOptional<z.ZodNumber>;
        used_usd: z.ZodDefault<z.ZodNumber>;
        used_tokens: z.ZodDefault<z.ZodNumber>;
        model_costs: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodNumber>>;
    }, "strip", z.ZodTypeAny, {
        used_usd: number;
        used_tokens: number;
        max_usd?: number | undefined;
        max_tokens?: number | undefined;
        model_costs?: Record<string, number> | undefined;
    }, {
        max_usd?: number | undefined;
        max_tokens?: number | undefined;
        used_usd?: number | undefined;
        used_tokens?: number | undefined;
        model_costs?: Record<string, number> | undefined;
    }>>;
    limits: z.ZodOptional<z.ZodObject<{
        max_cpu_percent: z.ZodOptional<z.ZodNumber>;
        max_memory_mb: z.ZodOptional<z.ZodNumber>;
        max_concurrent_requests: z.ZodOptional<z.ZodNumber>;
        max_processing_time_ms: z.ZodOptional<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        max_cpu_percent?: number | undefined;
        max_memory_mb?: number | undefined;
        max_concurrent_requests?: number | undefined;
        max_processing_time_ms?: number | undefined;
    }, {
        max_cpu_percent?: number | undefined;
        max_memory_mb?: number | undefined;
        max_concurrent_requests?: number | undefined;
        max_processing_time_ms?: number | undefined;
    }>>;
}, "strip", z.ZodTypeAny, {
    trace_id?: string | undefined;
    span_id?: string | undefined;
    parent_span_id?: string | undefined;
    baggage?: Record<string, string> | undefined;
    user_id?: string | undefined;
    session_id?: string | undefined;
    workspace_id?: string | undefined;
    request_id?: string | undefined;
    timeout_ms?: number | undefined;
    metadata?: Record<string, string> | undefined;
    budget?: {
        used_usd: number;
        used_tokens: number;
        max_usd?: number | undefined;
        max_tokens?: number | undefined;
        model_costs?: Record<string, number> | undefined;
    } | undefined;
    limits?: {
        max_cpu_percent?: number | undefined;
        max_memory_mb?: number | undefined;
        max_concurrent_requests?: number | undefined;
        max_processing_time_ms?: number | undefined;
    } | undefined;
}, {
    trace_id?: string | undefined;
    span_id?: string | undefined;
    parent_span_id?: string | undefined;
    baggage?: Record<string, string> | undefined;
    user_id?: string | undefined;
    session_id?: string | undefined;
    workspace_id?: string | undefined;
    request_id?: string | undefined;
    timeout_ms?: number | undefined;
    metadata?: Record<string, string> | undefined;
    budget?: {
        max_usd?: number | undefined;
        max_tokens?: number | undefined;
        used_usd?: number | undefined;
        used_tokens?: number | undefined;
        model_costs?: Record<string, number> | undefined;
    } | undefined;
    limits?: {
        max_cpu_percent?: number | undefined;
        max_memory_mb?: number | undefined;
        max_concurrent_requests?: number | undefined;
        max_processing_time_ms?: number | undefined;
    } | undefined;
}>;
export type MCPContext = z.infer<typeof MCPContextSchema>;
export declare const DeliveryOptionsSchema: z.ZodObject<{
    guarantee: z.ZodDefault<z.ZodEnum<["AT_MOST_ONCE", "AT_LEAST_ONCE", "EXACTLY_ONCE"]>>;
    retry_count: z.ZodDefault<z.ZodNumber>;
    retry_delay_ms: z.ZodDefault<z.ZodNumber>;
    require_ack: z.ZodDefault<z.ZodBoolean>;
    priority: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    guarantee: "AT_MOST_ONCE" | "AT_LEAST_ONCE" | "EXACTLY_ONCE";
    retry_count: number;
    retry_delay_ms: number;
    require_ack: boolean;
    priority: number;
}, {
    guarantee?: "AT_MOST_ONCE" | "AT_LEAST_ONCE" | "EXACTLY_ONCE" | undefined;
    retry_count?: number | undefined;
    retry_delay_ms?: number | undefined;
    require_ack?: boolean | undefined;
    priority?: number | undefined;
}>;
export type DeliveryOptions = z.infer<typeof DeliveryOptionsSchema>;
export declare const TaskRequestSchema: z.ZodObject<{
    task_type: z.ZodString;
    task_id: z.ZodDefault<z.ZodString>;
    parameters: z.ZodOptional<z.ZodAny>;
    metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
    preferred_agent: z.ZodOptional<z.ZodString>;
    priority: z.ZodDefault<z.ZodNumber>;
    deadline: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    priority: number;
    task_type: string;
    task_id: string;
    metadata?: Record<string, string> | undefined;
    parameters?: any;
    preferred_agent?: string | undefined;
    deadline?: string | undefined;
}, {
    task_type: string;
    metadata?: Record<string, string> | undefined;
    priority?: number | undefined;
    task_id?: string | undefined;
    parameters?: any;
    preferred_agent?: string | undefined;
    deadline?: string | undefined;
}>;
export type TaskRequest = z.infer<typeof TaskRequestSchema>;
export declare const TaskMetricsSchema: z.ZodObject<{
    processing_time_ms: z.ZodOptional<z.ZodNumber>;
    queue_time_ms: z.ZodOptional<z.ZodNumber>;
    retry_count: z.ZodOptional<z.ZodNumber>;
    cost_usd: z.ZodOptional<z.ZodNumber>;
    tokens_used: z.ZodOptional<z.ZodNumber>;
    model_used: z.ZodOptional<z.ZodString>;
    custom_metrics: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodNumber>>;
}, "strip", z.ZodTypeAny, {
    retry_count?: number | undefined;
    processing_time_ms?: number | undefined;
    queue_time_ms?: number | undefined;
    cost_usd?: number | undefined;
    tokens_used?: number | undefined;
    model_used?: string | undefined;
    custom_metrics?: Record<string, number> | undefined;
}, {
    retry_count?: number | undefined;
    processing_time_ms?: number | undefined;
    queue_time_ms?: number | undefined;
    cost_usd?: number | undefined;
    tokens_used?: number | undefined;
    model_used?: string | undefined;
    custom_metrics?: Record<string, number> | undefined;
}>;
export declare const TaskResponseSchema: z.ZodObject<{
    task_id: z.ZodString;
    status: z.ZodEnum<["PENDING", "RUNNING", "COMPLETED", "FAILED", "CANCELLED", "TIMEOUT"]>;
    result: z.ZodOptional<z.ZodAny>;
    error_message: z.ZodOptional<z.ZodString>;
    error_code: z.ZodOptional<z.ZodString>;
    metrics: z.ZodOptional<z.ZodObject<{
        processing_time_ms: z.ZodOptional<z.ZodNumber>;
        queue_time_ms: z.ZodOptional<z.ZodNumber>;
        retry_count: z.ZodOptional<z.ZodNumber>;
        cost_usd: z.ZodOptional<z.ZodNumber>;
        tokens_used: z.ZodOptional<z.ZodNumber>;
        model_used: z.ZodOptional<z.ZodString>;
        custom_metrics: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodNumber>>;
    }, "strip", z.ZodTypeAny, {
        retry_count?: number | undefined;
        processing_time_ms?: number | undefined;
        queue_time_ms?: number | undefined;
        cost_usd?: number | undefined;
        tokens_used?: number | undefined;
        model_used?: string | undefined;
        custom_metrics?: Record<string, number> | undefined;
    }, {
        retry_count?: number | undefined;
        processing_time_ms?: number | undefined;
        queue_time_ms?: number | undefined;
        cost_usd?: number | undefined;
        tokens_used?: number | undefined;
        model_used?: string | undefined;
        custom_metrics?: Record<string, number> | undefined;
    }>>;
    warnings: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
}, "strip", z.ZodTypeAny, {
    status: "PENDING" | "RUNNING" | "COMPLETED" | "FAILED" | "CANCELLED" | "TIMEOUT";
    task_id: string;
    result?: any;
    error_message?: string | undefined;
    error_code?: string | undefined;
    metrics?: {
        retry_count?: number | undefined;
        processing_time_ms?: number | undefined;
        queue_time_ms?: number | undefined;
        cost_usd?: number | undefined;
        tokens_used?: number | undefined;
        model_used?: string | undefined;
        custom_metrics?: Record<string, number> | undefined;
    } | undefined;
    warnings?: string[] | undefined;
}, {
    status: "PENDING" | "RUNNING" | "COMPLETED" | "FAILED" | "CANCELLED" | "TIMEOUT";
    task_id: string;
    result?: any;
    error_message?: string | undefined;
    error_code?: string | undefined;
    metrics?: {
        retry_count?: number | undefined;
        processing_time_ms?: number | undefined;
        queue_time_ms?: number | undefined;
        cost_usd?: number | undefined;
        tokens_used?: number | undefined;
        model_used?: string | undefined;
        custom_metrics?: Record<string, number> | undefined;
    } | undefined;
    warnings?: string[] | undefined;
}>;
export type TaskResponse = z.infer<typeof TaskResponseSchema>;
export declare const StreamStartSchema: z.ZodObject<{
    stream_id: z.ZodDefault<z.ZodString>;
    content_type: z.ZodString;
    metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
    estimated_size: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    stream_id: string;
    content_type: string;
    metadata?: Record<string, string> | undefined;
    estimated_size?: number | undefined;
}, {
    content_type: string;
    metadata?: Record<string, string> | undefined;
    stream_id?: string | undefined;
    estimated_size?: number | undefined;
}>;
export declare const StreamChunkSchema: z.ZodObject<{
    stream_id: z.ZodString;
    sequence: z.ZodNumber;
    data: z.ZodType<Buffer<ArrayBufferLike>, z.ZodTypeDef, Buffer<ArrayBufferLike>>;
    is_final: z.ZodOptional<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    stream_id: string;
    sequence: number;
    data: Buffer<ArrayBufferLike>;
    is_final?: boolean | undefined;
}, {
    stream_id: string;
    sequence: number;
    data: Buffer<ArrayBufferLike>;
    is_final?: boolean | undefined;
}>;
export declare const StreamEndSchema: z.ZodObject<{
    stream_id: z.ZodString;
    status: z.ZodDefault<z.ZodEnum<["COMPLETED", "CANCELLED", "FAILED"]>>;
    error_message: z.ZodOptional<z.ZodString>;
    total_bytes: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    status: "COMPLETED" | "FAILED" | "CANCELLED";
    stream_id: string;
    error_message?: string | undefined;
    total_bytes?: number | undefined;
}, {
    stream_id: string;
    status?: "COMPLETED" | "FAILED" | "CANCELLED" | undefined;
    error_message?: string | undefined;
    total_bytes?: number | undefined;
}>;
export declare const MCPMessageSchema: z.ZodObject<{
    id: z.ZodDefault<z.ZodString>;
    correlation_id: z.ZodOptional<z.ZodString>;
    trace_id: z.ZodOptional<z.ZodString>;
    span_id: z.ZodOptional<z.ZodString>;
    sender: z.ZodString;
    recipient: z.ZodString;
    message_type: z.ZodEnum<["TASK_REQUEST", "TASK_RESPONSE", "STREAM_START", "STREAM_CHUNK", "STREAM_END", "EVENT", "ERROR"]>;
    payload: z.ZodOptional<z.ZodAny>;
    tags: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    context: z.ZodOptional<z.ZodObject<{
        trace_id: z.ZodOptional<z.ZodString>;
        span_id: z.ZodOptional<z.ZodString>;
        parent_span_id: z.ZodOptional<z.ZodString>;
        baggage: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
        user_id: z.ZodOptional<z.ZodString>;
        session_id: z.ZodOptional<z.ZodString>;
        workspace_id: z.ZodOptional<z.ZodString>;
        request_id: z.ZodOptional<z.ZodString>;
        timeout_ms: z.ZodOptional<z.ZodNumber>;
        metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
        budget: z.ZodOptional<z.ZodObject<{
            max_usd: z.ZodOptional<z.ZodNumber>;
            max_tokens: z.ZodOptional<z.ZodNumber>;
            used_usd: z.ZodDefault<z.ZodNumber>;
            used_tokens: z.ZodDefault<z.ZodNumber>;
            model_costs: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodNumber>>;
        }, "strip", z.ZodTypeAny, {
            used_usd: number;
            used_tokens: number;
            max_usd?: number | undefined;
            max_tokens?: number | undefined;
            model_costs?: Record<string, number> | undefined;
        }, {
            max_usd?: number | undefined;
            max_tokens?: number | undefined;
            used_usd?: number | undefined;
            used_tokens?: number | undefined;
            model_costs?: Record<string, number> | undefined;
        }>>;
        limits: z.ZodOptional<z.ZodObject<{
            max_cpu_percent: z.ZodOptional<z.ZodNumber>;
            max_memory_mb: z.ZodOptional<z.ZodNumber>;
            max_concurrent_requests: z.ZodOptional<z.ZodNumber>;
            max_processing_time_ms: z.ZodOptional<z.ZodNumber>;
        }, "strip", z.ZodTypeAny, {
            max_cpu_percent?: number | undefined;
            max_memory_mb?: number | undefined;
            max_concurrent_requests?: number | undefined;
            max_processing_time_ms?: number | undefined;
        }, {
            max_cpu_percent?: number | undefined;
            max_memory_mb?: number | undefined;
            max_concurrent_requests?: number | undefined;
            max_processing_time_ms?: number | undefined;
        }>>;
    }, "strip", z.ZodTypeAny, {
        trace_id?: string | undefined;
        span_id?: string | undefined;
        parent_span_id?: string | undefined;
        baggage?: Record<string, string> | undefined;
        user_id?: string | undefined;
        session_id?: string | undefined;
        workspace_id?: string | undefined;
        request_id?: string | undefined;
        timeout_ms?: number | undefined;
        metadata?: Record<string, string> | undefined;
        budget?: {
            used_usd: number;
            used_tokens: number;
            max_usd?: number | undefined;
            max_tokens?: number | undefined;
            model_costs?: Record<string, number> | undefined;
        } | undefined;
        limits?: {
            max_cpu_percent?: number | undefined;
            max_memory_mb?: number | undefined;
            max_concurrent_requests?: number | undefined;
            max_processing_time_ms?: number | undefined;
        } | undefined;
    }, {
        trace_id?: string | undefined;
        span_id?: string | undefined;
        parent_span_id?: string | undefined;
        baggage?: Record<string, string> | undefined;
        user_id?: string | undefined;
        session_id?: string | undefined;
        workspace_id?: string | undefined;
        request_id?: string | undefined;
        timeout_ms?: number | undefined;
        metadata?: Record<string, string> | undefined;
        budget?: {
            max_usd?: number | undefined;
            max_tokens?: number | undefined;
            used_usd?: number | undefined;
            used_tokens?: number | undefined;
            model_costs?: Record<string, number> | undefined;
        } | undefined;
        limits?: {
            max_cpu_percent?: number | undefined;
            max_memory_mb?: number | undefined;
            max_concurrent_requests?: number | undefined;
            max_processing_time_ms?: number | undefined;
        } | undefined;
    }>>;
    delivery: z.ZodOptional<z.ZodObject<{
        guarantee: z.ZodDefault<z.ZodEnum<["AT_MOST_ONCE", "AT_LEAST_ONCE", "EXACTLY_ONCE"]>>;
        retry_count: z.ZodDefault<z.ZodNumber>;
        retry_delay_ms: z.ZodDefault<z.ZodNumber>;
        require_ack: z.ZodDefault<z.ZodBoolean>;
        priority: z.ZodDefault<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        guarantee: "AT_MOST_ONCE" | "AT_LEAST_ONCE" | "EXACTLY_ONCE";
        retry_count: number;
        retry_delay_ms: number;
        require_ack: boolean;
        priority: number;
    }, {
        guarantee?: "AT_MOST_ONCE" | "AT_LEAST_ONCE" | "EXACTLY_ONCE" | undefined;
        retry_count?: number | undefined;
        retry_delay_ms?: number | undefined;
        require_ack?: boolean | undefined;
        priority?: number | undefined;
    }>>;
    created_at: z.ZodDefault<z.ZodString>;
    expires_at: z.ZodOptional<z.ZodString>;
    security_token: z.ZodOptional<z.ZodString>;
    permissions: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
}, "strip", z.ZodTypeAny, {
    id: string;
    sender: string;
    recipient: string;
    message_type: "TASK_REQUEST" | "TASK_RESPONSE" | "STREAM_START" | "STREAM_CHUNK" | "STREAM_END" | "EVENT" | "ERROR";
    created_at: string;
    correlation_id?: string | undefined;
    trace_id?: string | undefined;
    span_id?: string | undefined;
    payload?: any;
    tags?: string[] | undefined;
    context?: {
        trace_id?: string | undefined;
        span_id?: string | undefined;
        parent_span_id?: string | undefined;
        baggage?: Record<string, string> | undefined;
        user_id?: string | undefined;
        session_id?: string | undefined;
        workspace_id?: string | undefined;
        request_id?: string | undefined;
        timeout_ms?: number | undefined;
        metadata?: Record<string, string> | undefined;
        budget?: {
            used_usd: number;
            used_tokens: number;
            max_usd?: number | undefined;
            max_tokens?: number | undefined;
            model_costs?: Record<string, number> | undefined;
        } | undefined;
        limits?: {
            max_cpu_percent?: number | undefined;
            max_memory_mb?: number | undefined;
            max_concurrent_requests?: number | undefined;
            max_processing_time_ms?: number | undefined;
        } | undefined;
    } | undefined;
    delivery?: {
        guarantee: "AT_MOST_ONCE" | "AT_LEAST_ONCE" | "EXACTLY_ONCE";
        retry_count: number;
        retry_delay_ms: number;
        require_ack: boolean;
        priority: number;
    } | undefined;
    expires_at?: string | undefined;
    security_token?: string | undefined;
    permissions?: string[] | undefined;
}, {
    sender: string;
    recipient: string;
    message_type: "TASK_REQUEST" | "TASK_RESPONSE" | "STREAM_START" | "STREAM_CHUNK" | "STREAM_END" | "EVENT" | "ERROR";
    id?: string | undefined;
    correlation_id?: string | undefined;
    trace_id?: string | undefined;
    span_id?: string | undefined;
    payload?: any;
    tags?: string[] | undefined;
    context?: {
        trace_id?: string | undefined;
        span_id?: string | undefined;
        parent_span_id?: string | undefined;
        baggage?: Record<string, string> | undefined;
        user_id?: string | undefined;
        session_id?: string | undefined;
        workspace_id?: string | undefined;
        request_id?: string | undefined;
        timeout_ms?: number | undefined;
        metadata?: Record<string, string> | undefined;
        budget?: {
            max_usd?: number | undefined;
            max_tokens?: number | undefined;
            used_usd?: number | undefined;
            used_tokens?: number | undefined;
            model_costs?: Record<string, number> | undefined;
        } | undefined;
        limits?: {
            max_cpu_percent?: number | undefined;
            max_memory_mb?: number | undefined;
            max_concurrent_requests?: number | undefined;
            max_processing_time_ms?: number | undefined;
        } | undefined;
    } | undefined;
    delivery?: {
        guarantee?: "AT_MOST_ONCE" | "AT_LEAST_ONCE" | "EXACTLY_ONCE" | undefined;
        retry_count?: number | undefined;
        retry_delay_ms?: number | undefined;
        require_ack?: boolean | undefined;
        priority?: number | undefined;
    } | undefined;
    created_at?: string | undefined;
    expires_at?: string | undefined;
    security_token?: string | undefined;
    permissions?: string[] | undefined;
}>;
export type MCPMessage = z.infer<typeof MCPMessageSchema>;
export declare function validateMessage(input: unknown): MCPMessage;
export declare function createTaskRequestMessage(args: {
    sender: string;
    recipient: string;
    task: TaskRequest;
    context?: MCPContext;
    delivery?: DeliveryOptions;
}): MCPMessage;
export declare function createErrorMessage(args: {
    sender: string;
    recipient: string;
    correlation_id?: string;
    error: Error | string;
    context?: MCPContext;
}): MCPMessage;
//# sourceMappingURL=message.d.ts.map
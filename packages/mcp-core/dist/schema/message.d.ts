import { z } from 'zod';
export declare const MessageTypeEnum: any;
export declare const DeliveryGuaranteeEnum: any;
export declare const TaskStatusEnum: any;
export declare const CostBudgetSchema: any;
export declare const ResourceLimitsSchema: any;
export declare const MCPContextSchema: any;
export type MCPContext = z.infer<typeof MCPContextSchema>;
export declare const DeliveryOptionsSchema: any;
export type DeliveryOptions = z.infer<typeof DeliveryOptionsSchema>;
export declare const TaskRequestSchema: any;
export type TaskRequest = z.infer<typeof TaskRequestSchema>;
export declare const TaskMetricsSchema: any;
export declare const TaskResponseSchema: any;
export type TaskResponse = z.infer<typeof TaskResponseSchema>;
export declare const StreamStartSchema: any;
export declare const StreamChunkSchema: any;
export declare const StreamEndSchema: any;
export declare const MCPMessageSchema: any;
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
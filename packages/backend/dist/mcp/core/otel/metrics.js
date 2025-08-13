/**
 * @fileoverview OpenTelemetry Metrics for MCP
 * Comprehensive metrics collection with Prometheus export compatibility
 */
import { metrics, } from '@opentelemetry/api';
import { MeterProvider as SDKMeterProvider } from '@opentelemetry/sdk-metrics';
import { PrometheusExporter } from '@opentelemetry/exporter-prometheus';
import resourcesPkg from '@opentelemetry/resources';
const { resourceFromAttributes, defaultResource } = resourcesPkg;
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';
/**
 * MCP-specific metrics collection and reporting
 */
export class MCPMetrics {
    static instance = null;
    meter;
    prometheusExporter;
    // Message metrics
    messagesSentCounter;
    messagesReceivedCounter;
    messagesDroppedCounter;
    messageErrorsCounter;
    messageLatencyHistogram;
    messageQueueDepthGauge;
    // Task metrics
    tasksStartedCounter;
    tasksCompletedCounter;
    tasksFailedCounter;
    taskDurationHistogram;
    taskQueueTimeHistogram;
    taskRetryCounter;
    // Agent metrics
    agentHealthGauge;
    agentCpuUsageGauge;
    agentMemoryUsageGauge;
    agentActiveTasksGauge;
    // Cost and resource metrics
    tokensUsedCounter;
    costIncurredCounter;
    modelUsageCounter;
    resourceUtilizationGauge;
    // Transport metrics
    transportConnectionsGauge;
    transportErrorsCounter;
    transportBytesTransferredCounter;
    constructor(enablePrometheus = true, prometheusPort = 9090) {
        // Initialize meter provider with resource information
        // Build resource using v2 helpers
        const base = defaultResource();
        const attrRes = resourceFromAttributes({
            [SemanticResourceAttributes.SERVICE_NAME]: 'cartrita-mcp',
            [SemanticResourceAttributes.SERVICE_VERSION]: '1.0.0',
            [SemanticResourceAttributes.SERVICE_NAMESPACE]: 'cartrita',
        });
        const resource = resourceFromAttributes({ ...base.attributes, ...attrRes.attributes });
        const meterProvider = new SDKMeterProvider({
            resource,
            readers: enablePrometheus ? [new PrometheusExporter({ port: prometheusPort })] : [],
        });
        metrics.setGlobalMeterProvider(meterProvider);
        this.meter = metrics.getMeter('cartrita-mcp-core', '1.0.0');
        if (enablePrometheus) {
            this.prometheusExporter = new PrometheusExporter({ port: prometheusPort });
        }
        // Initialize all metrics
        this.initializeMessageMetrics();
        this.initializeTaskMetrics();
        this.initializeAgentMetrics();
        this.initializeCostMetrics();
        this.initializeTransportMetrics();
    }
    static getInstance(enablePrometheus = true, prometheusPort = 9090) {
        if (!MCPMetrics.instance) {
            MCPMetrics.instance = new MCPMetrics(enablePrometheus, prometheusPort);
        }
        return MCPMetrics.instance;
    }
    initializeMessageMetrics() {
        this.messagesSentCounter = this.meter.createCounter('mcp_messages_sent_total', {
            description: 'Total number of messages sent',
            unit: 'messages',
        });
        this.messagesReceivedCounter = this.meter.createCounter('mcp_messages_received_total', {
            description: 'Total number of messages received',
            unit: 'messages',
        });
        this.messagesDroppedCounter = this.meter.createCounter('mcp_messages_dropped_total', {
            description: 'Total number of messages dropped',
            unit: 'messages',
        });
        this.messageErrorsCounter = this.meter.createCounter('mcp_message_errors_total', {
            description: 'Total number of message processing errors',
            unit: 'errors',
        });
        this.messageLatencyHistogram = this.meter.createHistogram('mcp_message_latency_seconds', {
            description: 'Message processing latency in seconds',
            unit: 'seconds',
            boundaries: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1.0, 5.0, 10.0],
        });
        this.messageQueueDepthGauge = this.meter.createObservableGauge('mcp_message_queue_depth', {
            description: 'Current depth of message queues',
            unit: 'messages',
        });
    }
    initializeTaskMetrics() {
        this.tasksStartedCounter = this.meter.createCounter('mcp_tasks_started_total', {
            description: 'Total number of tasks started',
            unit: 'tasks',
        });
        this.tasksCompletedCounter = this.meter.createCounter('mcp_tasks_completed_total', {
            description: 'Total number of tasks completed successfully',
            unit: 'tasks',
        });
        this.tasksFailedCounter = this.meter.createCounter('mcp_tasks_failed_total', {
            description: 'Total number of tasks that failed',
            unit: 'tasks',
        });
        this.taskDurationHistogram = this.meter.createHistogram('mcp_task_duration_seconds', {
            description: 'Task execution duration in seconds',
            unit: 'seconds',
            boundaries: [0.1, 0.5, 1.0, 5.0, 10.0, 30.0, 60.0, 300.0, 600.0],
        });
        this.taskQueueTimeHistogram = this.meter.createHistogram('mcp_task_queue_time_seconds', {
            description: 'Time tasks spend in queue before execution',
            unit: 'seconds',
            boundaries: [0.01, 0.05, 0.1, 0.5, 1.0, 5.0, 10.0, 30.0],
        });
        this.taskRetryCounter = this.meter.createCounter('mcp_task_retries_total', {
            description: 'Total number of task retries',
            unit: 'retries',
        });
    }
    initializeAgentMetrics() {
        this.agentHealthGauge = this.meter.createObservableGauge('mcp_agent_health', {
            description: 'Agent health status (1 = healthy, 0 = unhealthy)',
            unit: 'health',
        });
        this.agentCpuUsageGauge = this.meter.createObservableGauge('mcp_agent_cpu_usage_percent', {
            description: 'Agent CPU usage percentage',
            unit: 'percent',
        });
        this.agentMemoryUsageGauge = this.meter.createObservableGauge('mcp_agent_memory_usage_bytes', {
            description: 'Agent memory usage in bytes',
            unit: 'bytes',
        });
        this.agentActiveTasksGauge = this.meter.createObservableGauge('mcp_agent_active_tasks', {
            description: 'Number of currently active tasks per agent',
            unit: 'tasks',
        });
    }
    initializeCostMetrics() {
        this.tokensUsedCounter = this.meter.createCounter('mcp_tokens_used_total', {
            description: 'Total tokens used across all models',
            unit: 'tokens',
        });
        this.costIncurredCounter = this.meter.createCounter('mcp_cost_incurred_usd_total', {
            description: 'Total cost incurred in USD',
            unit: 'usd',
        });
        this.modelUsageCounter = this.meter.createCounter('mcp_model_usage_total', {
            description: 'Total model usage count',
            unit: 'requests',
        });
        this.resourceUtilizationGauge = this.meter.createObservableGauge('mcp_resource_utilization', {
            description: 'Resource utilization metrics',
            unit: 'percent',
        });
    }
    initializeTransportMetrics() {
        this.transportConnectionsGauge = this.meter.createObservableGauge('mcp_transport_connections', {
            description: 'Number of active transport connections',
            unit: 'connections',
        });
        this.transportErrorsCounter = this.meter.createCounter('mcp_transport_errors_total', {
            description: 'Total transport errors',
            unit: 'errors',
        });
        this.transportBytesTransferredCounter = this.meter.createCounter('mcp_transport_bytes_transferred_total', {
            description: 'Total bytes transferred via transport',
            unit: 'bytes',
        });
    }
    // Message metric recording methods
    recordMessageSent(messageType, sender, recipient) {
        this.messagesSentCounter.add(1, {
            message_type: messageType,
            sender,
            recipient,
        });
    }
    recordMessageReceived(messageType, sender, recipient) {
        this.messagesReceivedCounter.add(1, {
            message_type: messageType,
            sender,
            recipient,
        });
    }
    recordMessageDropped(reason) {
        this.messagesDroppedCounter.add(1, { reason });
    }
    recordMessageError(messageType, error) {
        this.messageErrorsCounter.add(1, {
            message_type: messageType,
            error_type: error,
        });
    }
    recordMessageLatency(latencySeconds, messageType) {
        this.messageLatencyHistogram.record(latencySeconds, {
            message_type: messageType,
        });
    }
    // Task metric recording methods
    recordTaskStarted(taskType, agentId) {
        this.tasksStartedCounter.add(1, {
            task_type: taskType,
            agent_id: agentId,
        });
    }
    recordTaskCompleted(taskType, agentId, durationSeconds) {
        this.tasksCompletedCounter.add(1, {
            task_type: taskType,
            agent_id: agentId,
        });
        this.taskDurationHistogram.record(durationSeconds, {
            task_type: taskType,
            agent_id: agentId,
            status: 'completed',
        });
    }
    recordTaskFailed(taskType, agentId, durationSeconds, errorCode) {
        this.tasksFailedCounter.add(1, {
            task_type: taskType,
            agent_id: agentId,
            error_code: errorCode,
        });
        this.taskDurationHistogram.record(durationSeconds, {
            task_type: taskType,
            agent_id: agentId,
            status: 'failed',
        });
    }
    recordTaskQueueTime(taskType, queueTimeSeconds) {
        this.taskQueueTimeHistogram.record(queueTimeSeconds, {
            task_type: taskType,
        });
    }
    recordTaskRetry(taskType, agentId, retryCount) {
        this.taskRetryCounter.add(retryCount, {
            task_type: taskType,
            agent_id: agentId,
        });
    }
    // Cost metric recording methods
    recordTokensUsed(tokens, model, taskType) {
        this.tokensUsedCounter.add(tokens, {
            model,
            task_type: taskType,
        });
    }
    recordCostIncurred(costUsd, model, taskType) {
        this.costIncurredCounter.add(costUsd, {
            model,
            task_type: taskType,
        });
    }
    recordModelUsage(model, taskType) {
        this.modelUsageCounter.add(1, {
            model,
            task_type: taskType,
        });
    }
    // Transport metric recording methods
    recordTransportError(transportType, errorType) {
        this.transportErrorsCounter.add(1, {
            transport_type: transportType,
            error_type: errorType,
        });
    }
    recordTransportBytesTransferred(bytes, transportType, direction) {
        this.transportBytesTransferredCounter.add(bytes, {
            transport_type: transportType,
            direction,
        });
    }
    // Observable metric update methods (called by external collectors)
    updateMessageQueueDepth(queueDepth, queueName) {
        // This would be called by a queue depth collector
        // The actual implementation depends on how observables are handled
    }
    updateAgentHealth(agentId, healthy, cpuPercent, memoryBytes, activeTasks) {
        // These would be updated by agent health collectors
        // Implementation depends on observable callback setup
    }
    updateResourceUtilization(resourceType, utilizationPercent) {
        // Updated by resource monitors
    }
    /**
     * Get current metrics snapshot for debugging
     */
    async getMetricsSnapshot() {
        if (this.prometheusExporter) {
            return this.prometheusExporter.getMetricsRequestHandler()({}, {});
        }
        return 'Prometheus exporter not enabled';
    }
    /**
     * Shutdown metrics collection
     */
    async shutdown() {
        // Cleanup any resources if needed
        if (this.prometheusExporter) {
            await this.prometheusExporter.shutdown();
        }
    }
}
// Singleton instance
let metricsInstance = null;
/**
 * Get global metrics instance
 */
export function getMetrics(enablePrometheus = true, prometheusPort = 9090) {
    if (!metricsInstance) {
        metricsInstance = MCPMetrics.getInstance(enablePrometheus, prometheusPort);
    }
    return metricsInstance;
}
/**
 * Create a performance timer with automatic metric recording
 */
export function createPerformanceTimer(taskType, agentId) {
    const startTime = Date.now();
    const metrics = getMetrics();
    return {
        complete() {
            const durationMs = Date.now() - startTime;
            const durationSeconds = durationMs / 1000;
            if (agentId) {
                metrics.recordTaskCompleted(taskType, agentId, durationSeconds);
            }
        },
        fail(errorCode) {
            const durationMs = Date.now() - startTime;
            const durationSeconds = durationMs / 1000;
            if (agentId) {
                metrics.recordTaskFailed(taskType, agentId, durationSeconds, errorCode);
            }
        },
    };
}
export default MCPMetrics;

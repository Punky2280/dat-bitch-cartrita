/**
 * @fileoverview Deepgram Agent - Wrapper for Deepgram speech services
 * Integrates with existing Deepgram service in the backend
 */
import { Logger, TaskStatus } from '../../core/index.js';
import { trace, SpanKind } from '@opentelemetry/api';
import { performance } from 'perf_hooks';
import { createClient } from '@deepgram/sdk';
/**
 * Deepgram Agent - performs speech-to-text and text-to-speech tasks
 */
export class DeepgramAgent {
    config;
    logger;
    tracer = trace.getTracer('deepgram-agent');
    deepgramClient;
    isInitialized = false;
    constructor(config = {}) {
        this.config = config;
        this.logger = Logger.create('DeepgramAgent');
    }
    async initialize() {
        if (this.isInitialized)
            return;
        try {
            this.logger.info('Initializing Deepgram Agent...');
            // Initialize Deepgram client
            this.deepgramClient = createClient(this.config.apiKey || process.env.DEEPGRAM_API_KEY);
            this.isInitialized = true;
            this.logger.info('Deepgram Agent initialized successfully');
        }
        catch (error) {
            this.logger.error('Failed to initialize Deepgram Agent', error);
            throw error;
        }
    }
    /**
     * Execute Deepgram task
     */
    async execute(request, context) {
        const span = this.tracer.startSpan('deepgram.agent.execute', {
            kind: SpanKind.INTERNAL,
            attributes: {
                'task.type': request.taskType,
                'task.id': request.taskId,
            },
        });
        const startTime = performance.now();
        try {
            this.logger.info('Executing Deepgram task', {
                taskId: request.taskId,
                taskType: request.taskType,
            });
            let result;
            switch (request.taskType) {
                case 'deepgram.audio.transcribe.file':
                    result = await this.transcribeFile(request.parameters);
                    break;
                case 'deepgram.audio.transcribe.live':
                    result = await this.transcribeLive(request.parameters);
                    break;
                case 'deepgram.audio.agent.live':
                    result = await this.runLiveAgent(request.parameters);
                    break;
                default:
                    throw new Error(`Unsupported Deepgram task type: ${request.taskType}`);
            }
            const processingTime = performance.now() - startTime;
            return {
                taskId: request.taskId,
                status: TaskStatus.COMPLETED,
                result,
                metrics: {
                    processingTimeMs: Math.round(processingTime),
                    queueTimeMs: 0,
                    retryCount: 0,
                    costUsd: this.estimateCost(request.taskType, result),
                    tokensUsed: this.estimateTokens(result),
                    customMetrics: {
                        audioDurationMs: result?.metadata?.duration || 0,
                        confidence: result?.metadata?.confidence || 0,
                    },
                },
                warnings: [],
            };
        }
        catch (error) {
            const processingTime = performance.now() - startTime;
            span.recordException(error);
            this.logger.error('Deepgram task failed', error, {
                taskId: request.taskId,
                taskType: request.taskType,
            });
            return {
                taskId: request.taskId,
                status: TaskStatus.FAILED,
                errorMessage: error.message,
                errorCode: 'DEEPGRAM_ERROR',
                metrics: {
                    processingTimeMs: Math.round(processingTime),
                    queueTimeMs: 0,
                    retryCount: 0,
                    costUsd: 0,
                    tokensUsed: 0,
                    customMetrics: {},
                },
                warnings: [],
            };
        }
        finally {
            span.end();
        }
    }
    /**
     * Transcribe audio file
     */
    async transcribeFile(parameters) {
        const { audioUrl, audioBuffer, options = {} } = parameters;
        if (!audioUrl && !audioBuffer) {
            throw new Error('Audio URL or buffer is required for file transcription');
        }
        const transcriptionOptions = {
            model: this.config.model || 'nova-2',
            language: this.config.language || 'en',
            smart_format: this.config.enableSmartFormatting ?? true,
            punctuate: true,
            ...options,
        };
        let response;
        if (audioUrl) {
            response = await this.deepgramClient.listen.prerecorded.transcribeUrl({ url: audioUrl }, transcriptionOptions);
        }
        else {
            response = await this.deepgramClient.listen.prerecorded.transcribeFile(audioBuffer, transcriptionOptions);
        }
        return {
            transcript: response.results?.channels?.[0]?.alternatives?.[0]?.transcript || '',
            confidence: response.results?.channels?.[0]?.alternatives?.[0]?.confidence || 0,
            words: response.results?.channels?.[0]?.alternatives?.[0]?.words || [],
            metadata: {
                duration: response.metadata?.duration || 0,
                channels: response.metadata?.channels || 1,
                model: transcriptionOptions.model,
                language: transcriptionOptions.language,
            },
        };
    }
    /**
     * Live transcription
     */
    async transcribeLive(parameters) {
        const { audioChunks, options = {} } = parameters;
        if (!audioChunks || !Array.isArray(audioChunks)) {
            throw new Error('Audio chunks array is required for live transcription');
        }
        const liveOptions = {
            model: this.config.model || 'nova-2',
            language: this.config.language || 'en',
            smart_format: this.config.enableSmartFormatting ?? true,
            interim_results: true,
            ...options,
        };
        // Create live transcription connection
        const connection = this.deepgramClient.listen.live(liveOptions);
        const results = [];
        return new Promise((resolve, reject) => {
            connection.on('Results', (data) => {
                if (data.channel?.alternatives?.[0]) {
                    results.push({
                        transcript: data.channel.alternatives[0].transcript,
                        confidence: data.channel.alternatives[0].confidence,
                        is_final: data.is_final,
                        start: data.start,
                        duration: data.duration,
                    });
                }
            });
            connection.on('error', (error) => {
                this.logger.error('Live transcription error', error);
                reject(error);
            });
            connection.on('close', () => {
                resolve({
                    results,
                    totalResults: results.length,
                    finalTranscript: results
                        .filter(r => r.is_final)
                        .map(r => r.transcript)
                        .join(' '),
                    metadata: {
                        model: liveOptions.model,
                        language: liveOptions.language,
                        chunksProcessed: audioChunks.length,
                    },
                });
            });
            // Send audio chunks
            audioChunks.forEach((chunk) => {
                connection.send(chunk);
            });
            // Close connection
            setTimeout(() => {
                connection.finish();
            }, 1000);
        });
    }
    /**
     * Run live agent
     */
    async runLiveAgent(parameters) {
        // This would integrate with Deepgram's Agent API for voice AI
        const { config = {}, options = {} } = parameters;
        // Placeholder for agent functionality
        return {
            agentId: 'deepgram-agent-' + Date.now(),
            status: 'active',
            capabilities: ['speech_recognition', 'natural_language_processing'],
            config: {
                model: this.config.model || 'nova-2',
                language: this.config.language || 'en',
                ...config,
            },
            metadata: {
                initialized: true,
                provider: 'deepgram',
            },
        };
    }
    /**
     * Estimate cost for Deepgram task
     */
    estimateCost(taskType, result) {
        // Deepgram pricing is typically per hour of audio
        const baseCosts = {
            'deepgram.audio.transcribe.file': 0.0059, // $0.0059 per minute
            'deepgram.audio.transcribe.live': 0.0059,
            'deepgram.audio.agent.live': 0.015,
        };
        const baseCost = baseCosts[taskType] || 0.0059;
        const durationMinutes = (result?.metadata?.duration || 60) / 60000; // Convert ms to minutes
        return baseCost * Math.max(1, durationMinutes); // Minimum 1 minute billing
    }
    /**
     * Estimate tokens used
     */
    estimateTokens(result) {
        if (!result?.transcript && !result?.finalTranscript)
            return 0;
        const text = result.transcript || result.finalTranscript || '';
        return Math.ceil(text.length / 4);
    }
}

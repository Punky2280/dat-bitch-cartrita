/**
 * Model Benchmark Harness
 * 
 * Comprehensive benchmarking system for measuring model performance,
 * including tokens/sec, p95 latency, memory footprint, and quality metrics.
 * 
 * @author Claude (Internal Developer Agent)
 * @date August 2025
 */

import { EventEmitter } from 'events';
import { performance } from 'perf_hooks';
import * as os from 'os';
import { 
  BenchmarkConfig, 
  BenchmarkResult, 
  HardwareConfig, 
  ModelRegistryEntry,
  QualityMetrics 
} from './types';
import { validateBenchmarkConfiguration } from './schemas';

export interface BenchmarkStats {
  samples: number[];
  mean: number;
  median: number;
  p95: number;
  p99: number;
  min: number;
  max: number;
  stdDev: number;
}

export interface ResourceUsage {
  cpuPercent: number;
  memoryUsageMB: number;
  gpuUtilizationPercent?: number;
  gpuMemoryUsageMB?: number;
}

export class BenchmarkHarness extends EventEmitter {
  private abortController?: AbortController;
  private isRunning = false;
  private results: BenchmarkResult[] = [];

  constructor(
    private modelInferenceService: any, // HuggingFace or other inference service
    private metricsCollector: any, // For system metrics
    private logger: any = console
  ) {
    super();
  }

  /**
   * Run comprehensive benchmarks on specified models
   */
  async runBenchmarks(config: BenchmarkConfig): Promise<BenchmarkResult[]> {
    // Validate configuration
    validateBenchmarkConfiguration(config);

    this.abortController = new AbortController();
    this.isRunning = true;
    this.results = [];

    this.logger.info('Starting benchmark harness', { config });
    this.emit('benchmarkStarted', { config });

    try {
      for (const modelId of config.model_ids) {
        if (this.abortController.signal.aborted) break;

        for (const hardwareConfig of config.hardware_configs) {
          if (this.abortController.signal.aborted) break;

          for (const contextLength of config.context_lengths) {
            if (this.abortController.signal.aborted) break;

            for (const temperature of config.temperature_settings) {
              if (this.abortController.signal.aborted) break;

              const result = await this.benchmarkModelConfiguration(
                modelId,
                hardwareConfig,
                contextLength,
                temperature,
                config
              );

              this.results.push(result);
              this.emit('benchmarkCompleted', { result });
            }
          }
        }
      }

      this.logger.info('Benchmark harness completed', { 
        totalResults: this.results.length 
      });
      this.emit('benchmarkFinished', { results: this.results });

      return this.results;
    } catch (error) {
      this.logger.error('Benchmark harness failed', error);
      this.emit('benchmarkError', { error });
      throw error;
    } finally {
      this.isRunning = false;
      this.abortController = undefined;
    }
  }

  /**
   * Benchmark a specific model configuration
   */
  private async benchmarkModelConfiguration(
    modelId: string,
    hardwareConfig: HardwareConfig,
    contextLength: number,
    temperature: number,
    config: BenchmarkConfig
  ): Promise<BenchmarkResult> {
    this.logger.info('Benchmarking model configuration', {
      modelId,
      hardwareConfig,
      contextLength,
      temperature
    });

    // Generate test prompts of specified context length
    const testPrompts = this.generateTestPrompts(contextLength, config.measurement_runs);

    // Warmup runs
    await this.runWarmup(modelId, testPrompts.slice(0, config.warmup_runs), temperature);

    // Measure performance
    const latencies: number[] = [];
    const tokenCounts: number[] = [];
    const resourceUsages: ResourceUsage[] = [];

    const startTime = performance.now();

    for (let i = 0; i < config.measurement_runs; i++) {
      if (this.abortController?.signal.aborted) break;

      const prompt = testPrompts[i % testPrompts.length];
      const result = await this.measureSingleInference(
        modelId,
        prompt,
        temperature,
        config.timeout_ms
      );

      latencies.push(result.latency);
      tokenCounts.push(result.tokenCount);
      resourceUsages.push(result.resourceUsage);

      // Add small delay to prevent overwhelming the model
      await this.sleep(100);
    }

    const totalTime = performance.now() - startTime;

    // Calculate statistics
    const latencyStats = this.calculateStats(latencies);
    const tokenStats = this.calculateStats(tokenCounts);
    const avgResourceUsage = this.calculateAverageResourceUsage(resourceUsages);

    // Calculate tokens per second
    const totalTokens = tokenCounts.reduce((sum, count) => sum + count, 0);
    const tokensPerSecond = (totalTokens / totalTime) * 1000; // Convert to per second

    // Quality benchmarks (if configured)
    let qualityScores: Record<string, number> = {};
    if (config.benchmark_suite.includes('quality')) {
      qualityScores = await this.runQualityBenchmarks(modelId, temperature);
    }

    return {
      model_id: modelId,
      hardware_config: hardwareConfig,
      benchmark_name: `comprehensive_${contextLength}_${temperature}`,
      metrics: {
        tokens_per_second: tokensPerSecond,
        latency_p50_ms: latencyStats.median,
        latency_p95_ms: latencyStats.p95,
        latency_p99_ms: latencyStats.p99,
        memory_usage_gb: avgResourceUsage.memoryUsageMB / 1024,
        gpu_utilization_percent: avgResourceUsage.gpuUtilizationPercent || 0,
        throughput_variance: latencyStats.stdDev / latencyStats.mean
      },
      quality_scores: qualityScores,
      timestamp: new Date(),
      context_length: contextLength,
      temperature
    };
  }

  /**
   * Measure a single inference call
   */
  private async measureSingleInference(
    modelId: string,
    prompt: string,
    temperature: number,
    timeoutMs?: number
  ): Promise<{
    latency: number;
    tokenCount: number;
    resourceUsage: ResourceUsage;
  }> {
    const startUsage = await this.getResourceUsage();
    const startTime = performance.now();

    try {
      const result = await Promise.race([
        this.modelInferenceService.generate({
          model: modelId,
          prompt,
          temperature,
          max_tokens: 512 // Standard for comparison
        }),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Timeout')), timeoutMs || 30000)
        )
      ]);

      const endTime = performance.now();
      const endUsage = await this.getResourceUsage();

      const latency = endTime - startTime;
      const tokenCount = this.countTokens(result.text || '');
      const resourceUsage = this.calculateResourceDelta(startUsage, endUsage);

      return { latency, tokenCount, resourceUsage };
    } catch (error) {
      const endTime = performance.now();
      this.logger.warn('Inference failed during benchmark', { modelId, error });
      
      return {
        latency: endTime - startTime,
        tokenCount: 0,
        resourceUsage: await this.getResourceUsage()
      };
    }
  }

  /**
   * Run warmup inferences to stabilize performance
   */
  private async runWarmup(
    modelId: string,
    prompts: string[],
    temperature: number
  ): Promise<void> {
    this.logger.info('Running warmup', { modelId, runs: prompts.length });

    for (const prompt of prompts) {
      try {
        await this.modelInferenceService.generate({
          model: modelId,
          prompt,
          temperature,
          max_tokens: 128
        });
        await this.sleep(50);
      } catch (error) {
        this.logger.warn('Warmup inference failed', { modelId, error });
      }
    }
  }

  /**
   * Generate test prompts of specific context length
   */
  private generateTestPrompts(contextLength: number, count: number): string[] {
    const prompts: string[] = [];
    
    // Base prompt templates for different lengths
    const templates = {
      short: [
        "Write a brief summary of artificial intelligence.",
        "Explain the concept of machine learning in simple terms.",
        "What are the key benefits of cloud computing?",
        "Describe the importance of data privacy.",
        "How does blockchain technology work?"
      ],
      medium: [
        "Write a comprehensive analysis of the current state of artificial intelligence, including its applications, limitations, and future prospects. Consider the ethical implications and potential societal impacts.",
        "Provide a detailed explanation of machine learning algorithms, including supervised, unsupervised, and reinforcement learning approaches. Include examples and use cases for each category.",
        "Analyze the evolution of cloud computing technologies over the past decade, discussing key innovations, market leaders, and emerging trends that will shape the future of distributed computing."
      ],
      long: [
        "Conduct a thorough analysis of the artificial intelligence landscape, examining current technological capabilities, market dynamics, regulatory considerations, ethical frameworks, and long-term implications for various industries including healthcare, finance, transportation, education, and entertainment. Discuss the role of major technology companies, research institutions, and government initiatives in shaping AI development. Consider the challenges of AI safety, bias mitigation, transparency, and the need for responsible AI governance frameworks."
      ]
    };

    for (let i = 0; i < count; i++) {
      let template: string;
      
      if (contextLength <= 512) {
        template = templates.short[i % templates.short.length];
      } else if (contextLength <= 2048) {
        template = templates.medium[i % templates.medium.length];
      } else {
        template = templates.long[i % templates.long.length];
      }

      // Pad or truncate to approximate target length
      const prompt = this.adjustPromptLength(template, contextLength);
      prompts.push(prompt);
    }

    return prompts;
  }

  /**
   * Adjust prompt to target context length
   */
  private adjustPromptLength(prompt: string, targetLength: number): string {
    const estimatedTokens = Math.floor(prompt.length / 4); // Rough approximation
    
    if (estimatedTokens < targetLength) {
      // Pad with additional context
      const padding = " ".repeat(Math.max(0, (targetLength - estimatedTokens) * 4));
      return prompt + "\n\nAdditional context:" + padding;
    } else if (estimatedTokens > targetLength) {
      // Truncate to fit
      const targetChars = targetLength * 4;
      return prompt.substring(0, Math.max(1, targetChars));
    }
    
    return prompt;
  }

  /**
   * Run quality benchmarks (MMLU, etc.)
   */
  private async runQualityBenchmarks(
    modelId: string,
    temperature: number
  ): Promise<Record<string, number>> {
    const results: Record<string, number> = {};

    // Sample MMLU questions (in production, load from dataset)
    const mmluSamples = [
      {
        question: "What is the primary function of mitochondria in cells?",
        options: ["A) Protein synthesis", "B) Energy production", "C) DNA storage", "D) Waste removal"],
        correct: "B"
      },
      {
        question: "Which programming paradigm emphasizes immutable data?",
        options: ["A) Object-oriented", "B) Procedural", "C) Functional", "D) Event-driven"],
        correct: "C"
      }
      // Add more questions in production
    ];

    let correct = 0;
    const total = mmluSamples.length;

    for (const sample of mmluSamples) {
      try {
        const prompt = `${sample.question}\n${sample.options.join('\n')}\n\nAnswer:`;
        
        const result = await this.modelInferenceService.generate({
          model: modelId,
          prompt,
          temperature,
          max_tokens: 5
        });

        const answer = result.text?.trim().toUpperCase();
        if (answer && answer.includes(sample.correct)) {
          correct++;
        }
      } catch (error) {
        this.logger.warn('Quality benchmark question failed', { modelId, error });
      }
    }

    results.mmlu = (correct / total) * 100;
    return results;
  }

  /**
   * Get current resource usage
   */
  private async getResourceUsage(): Promise<ResourceUsage> {
    const memInfo = process.memoryUsage();
    
    // Basic CPU usage (simplified)
    const cpuUsage = process.cpuUsage();
    const cpuPercent = (cpuUsage.user + cpuUsage.system) / 1000000; // Convert to seconds

    const usage: ResourceUsage = {
      cpuPercent,
      memoryUsageMB: memInfo.rss / (1024 * 1024)
    };

    // GPU metrics would require nvidia-ml-py or similar
    if (this.metricsCollector?.getGPUMetrics) {
      try {
        const gpuMetrics = await this.metricsCollector.getGPUMetrics();
        usage.gpuUtilizationPercent = gpuMetrics.utilization;
        usage.gpuMemoryUsageMB = gpuMetrics.memoryUsed;
      } catch (error) {
        this.logger.debug('GPU metrics not available', error);
      }
    }

    return usage;
  }

  /**
   * Calculate resource usage delta
   */
  private calculateResourceDelta(
    start: ResourceUsage,
    end: ResourceUsage
  ): ResourceUsage {
    return {
      cpuPercent: end.cpuPercent - start.cpuPercent,
      memoryUsageMB: end.memoryUsageMB - start.memoryUsageMB,
      gpuUtilizationPercent: end.gpuUtilizationPercent && start.gpuUtilizationPercent
        ? end.gpuUtilizationPercent - start.gpuUtilizationPercent
        : undefined,
      gpuMemoryUsageMB: end.gpuMemoryUsageMB && start.gpuMemoryUsageMB
        ? end.gpuMemoryUsageMB - start.gpuMemoryUsageMB
        : undefined
    };
  }

  /**
   * Calculate average resource usage
   */
  private calculateAverageResourceUsage(usages: ResourceUsage[]): ResourceUsage {
    if (usages.length === 0) {
      return { cpuPercent: 0, memoryUsageMB: 0 };
    }

    const sum = usages.reduce((acc, usage) => ({
      cpuPercent: acc.cpuPercent + usage.cpuPercent,
      memoryUsageMB: acc.memoryUsageMB + usage.memoryUsageMB,
      gpuUtilizationPercent: (acc.gpuUtilizationPercent || 0) + (usage.gpuUtilizationPercent || 0),
      gpuMemoryUsageMB: (acc.gpuMemoryUsageMB || 0) + (usage.gpuMemoryUsageMB || 0)
    }), { cpuPercent: 0, memoryUsageMB: 0, gpuUtilizationPercent: 0, gpuMemoryUsageMB: 0 });

    return {
      cpuPercent: sum.cpuPercent / usages.length,
      memoryUsageMB: sum.memoryUsageMB / usages.length,
      gpuUtilizationPercent: sum.gpuUtilizationPercent / usages.length || undefined,
      gpuMemoryUsageMB: sum.gpuMemoryUsageMB / usages.length || undefined
    };
  }

  /**
   * Calculate statistical metrics
   */
  private calculateStats(values: number[]): BenchmarkStats {
    if (values.length === 0) {
      return {
        samples: [],
        mean: 0,
        median: 0,
        p95: 0,
        p99: 0,
        min: 0,
        max: 0,
        stdDev: 0
      };
    }

    const sorted = [...values].sort((a, b) => a - b);
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    const stdDev = Math.sqrt(variance);

    return {
      samples: sorted,
      mean,
      median: this.percentile(sorted, 0.5),
      p95: this.percentile(sorted, 0.95),
      p99: this.percentile(sorted, 0.99),
      min: sorted[0],
      max: sorted[sorted.length - 1],
      stdDev
    };
  }

  /**
   * Calculate percentile
   */
  private percentile(sorted: number[], p: number): number {
    const index = Math.ceil(sorted.length * p) - 1;
    return sorted[Math.max(0, Math.min(index, sorted.length - 1))];
  }

  /**
   * Count tokens (simplified approximation)
   */
  private countTokens(text: string): number {
    // Simple approximation: 1 token ≈ 4 characters
    // In production, use a proper tokenizer
    return Math.ceil(text.length / 4);
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Abort running benchmarks
   */
  abort(): void {
    if (this.abortController) {
      this.abortController.abort();
    }
  }

  /**
   * Check if benchmarks are currently running
   */
  get running(): boolean {
    return this.isRunning;
  }

  /**
   * Get current results
   */
  getResults(): BenchmarkResult[] {
    return [...this.results];
  }

  /**
   * Export results to JSON
   */
  exportResults(): string {
    return JSON.stringify({
      timestamp: new Date().toISOString(),
      results: this.results,
      summary: this.generateSummary()
    }, null, 2);
  }

  /**
   * Generate benchmark summary
   */
  private generateSummary() {
    if (this.results.length === 0) return null;

    const modelSummaries = new Map<string, BenchmarkResult[]>();
    
    for (const result of this.results) {
      if (!modelSummaries.has(result.model_id)) {
        modelSummaries.set(result.model_id, []);
      }
      modelSummaries.get(result.model_id)!.push(result);
    }

    const summary: any = {};
    
    for (const [modelId, results] of modelSummaries) {
      const avgTokensPerSecond = results.reduce((sum, r) => 
        sum + r.metrics.tokens_per_second, 0) / results.length;
      const avgLatencyP95 = results.reduce((sum, r) => 
        sum + r.metrics.latency_p95_ms, 0) / results.length;
      
      summary[modelId] = {
        total_runs: results.length,
        avg_tokens_per_second: avgTokensPerSecond,
        avg_latency_p95_ms: avgLatencyP95,
        avg_memory_usage_gb: results.reduce((sum, r) => 
          sum + r.metrics.memory_usage_gb, 0) / results.length,
        quality_scores: results[0]?.quality_scores || {}
      };
    }

    return summary;
  }
}
/**
 * Hugging Face Jobs Service
 * Integrates with HF Jobs API for cloud-based audio processing and compute workloads
 * Provides GPU-accelerated audio analytics using HF infrastructure
 */

import { spawn } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class HuggingFaceJobsService {
    constructor() {
        this.isInitialized = false;
        this.activeJobs = new Map();
        this.jobQueue = [];
        this.processingJobs = false;
        
        // Configuration
        this.config = {
            // Hardware flavors available
            flavors: {
                cpu: {
                    basic: 'cpu-basic',
                    upgrade: 'cpu-upgrade'
                },
                gpu: {
                    t4_small: 't4-small',
                    t4_medium: 't4-medium',
                    a10g_small: 'a10g-small',
                    a10g_large: 'a10g-large',
                    a100_large: 'a100-large'
                },
                tpu: {
                    v5e_1x1: 'tpu-v5e-1x1',
                    v5e_2x2: 'tpu-v5e-2x2'
                }
            },
            
            // Default configurations
            defaults: {
                audioProcessing: {
                    flavor: 'a10g-small',
                    image: 'pytorch/pytorch:2.6.0-cuda12.4-cudnn9-devel',
                    timeout: 1800 // 30 minutes
                },
                lightProcessing: {
                    flavor: 'cpu-upgrade',
                    image: 'python:3.12',
                    timeout: 600 // 10 minutes
                }
            },
            
            // Docker images optimized for different tasks
            images: {
                pytorch_cuda: 'pytorch/pytorch:2.6.0-cuda12.4-cudnn9-devel',
                python: 'python:3.12',
                tensorflow: 'tensorflow/tensorflow:2.17.0-gpu',
                huggingface: 'huggingface/transformers-pytorch-gpu:4.45.0'
            }
        };
    }

    async initialize() {
        if (this.isInitialized) return;

        try {
            console.log('[HFJobs] Initializing Hugging Face Jobs Service...');
            
            // Check if HF CLI is available
            await this.checkHFCLI();
            
            // Verify authentication
            await this.verifyAuth();
            
            // Create job management directories
            await this.createDirectories();
            
            // Start job queue processor
            this.startJobProcessor();
            
            this.isInitialized = true;
            console.log('[HFJobs] ✅ Hugging Face Jobs Service initialized');
        } catch (error) {
            console.error('[HFJobs] ❌ Failed to initialize:', error);
            throw error;
        }
    }

    async checkHFCLI() {
        return new Promise((resolve, reject) => {
            const process = spawn('hf', ['--version'], { stdio: 'pipe' });
            
            let output = '';
            process.stdout.on('data', (data) => output += data.toString());
            process.stderr.on('data', (data) => output += data.toString());
            
            process.on('close', (code) => {
                if (code === 0) {
                    console.log('[HFJobs] ✅ HF CLI available:', output.trim());
                    resolve(true);
                } else {
                    reject(new Error('HF CLI not found. Install with: pip install huggingface_hub[cli]'));
                }
            });
        });
    }

    async verifyAuth() {
        return new Promise((resolve, reject) => {
            const process = spawn('hf', ['whoami'], { stdio: 'pipe' });
            
            let output = '';
            process.stdout.on('data', (data) => output += data.toString());
            process.stderr.on('data', (data) => output += data.toString());
            
            process.on('close', (code) => {
                if (code === 0) {
                    console.log('[HFJobs] ✅ Authenticated as:', output.trim());
                    resolve(true);
                } else {
                    reject(new Error('Not authenticated with HF. Run: hf login'));
                }
            });
        });
    }

    async createDirectories() {
        const dirs = ['hf_jobs', 'hf_scripts', 'hf_outputs'];
        
        for (const dir of dirs) {
            const dirPath = path.join(__dirname, '../../', dir);
            try {
                await fs.mkdir(dirPath, { recursive: true });
            } catch (error) {
                if (error.code !== 'EEXIST') {
                    console.warn(`[HFJobs] Could not create directory ${dir}:`, error.message);
                }
            }
        }
    }

    // Job Management Methods
    async runJob(options = {}) {
        const {
            command,
            image = this.config.defaults.lightProcessing.image,
            flavor = this.config.defaults.lightProcessing.flavor,
            env = {},
            namespace = null,
            timeout = 600,
            jobType = 'generic'
        } = options;

        try {
            console.log(`[HFJobs] Starting ${jobType} job with flavor ${flavor}`);
            
            const jobId = `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            
            // Build HF Jobs command
            const hfCommand = ['jobs', 'run'];
            
            // Add flavor
            hfCommand.push('--flavor', flavor);
            
            // Add namespace if specified
            if (namespace) {
                hfCommand.push('--namespace', namespace);
            }
            
            // Add environment variables
            for (const [key, value] of Object.entries(env)) {
                hfCommand.push('--env', `${key}=${value}`);
            }
            
            // Add image and command
            hfCommand.push(image, ...command);
            
            // Execute job
            const result = await this.executeHFCommand(hfCommand, timeout);
            
            // Parse job information from output
            const jobInfo = this.parseJobOutput(result.stdout, jobId);
            
            // Store job info
            this.activeJobs.set(jobInfo.id, {
                ...jobInfo,
                startTime: new Date(),
                jobType,
                status: 'RUNNING'
            });
            
            console.log(`[HFJobs] ✅ Job ${jobInfo.id} started successfully`);
            return jobInfo;
            
        } catch (error) {
            console.error('[HFJobs] Failed to run job:', error);
            throw error;
        }
    }

    async runAudioAnalysisJob(audioFilePath, analysisType = 'full', options = {}) {
        try {
            // Create Python script for audio analysis
            const scriptContent = await this.createAudioAnalysisScript(analysisType);
            const scriptPath = await this.saveScript(scriptContent, `audio_analysis_${Date.now()}.py`);
            
            // Prepare job configuration
            const jobOptions = {
                command: ['python', scriptPath, audioFilePath, analysisType],
                image: this.config.images.pytorch_cuda,
                flavor: this.config.defaults.audioProcessing.flavor,
                env: {
                    HF_TOKEN: process.env.HF_TOKEN,
                    CUDA_VISIBLE_DEVICES: '0'
                },
                timeout: this.config.defaults.audioProcessing.timeout,
                jobType: 'audio_analysis',
                ...options
            };
            
            const jobInfo = await this.runJob(jobOptions);
            
            return {
                jobId: jobInfo.id,
                status: 'RUNNING',
                analysisType,
                audioFile: audioFilePath,
                estimatedTime: this.estimateProcessingTime(audioFilePath, analysisType),
                jobUrl: jobInfo.url
            };
            
        } catch (error) {
            console.error('[HFJobs] Failed to run audio analysis job:', error);
            throw error;
        }
    }

    async createAudioAnalysisScript(analysisType) {
        return `#!/usr/bin/env python3
"""
Cloud Audio Analysis Script for Hugging Face Jobs
Performs pyannote.audio analysis with GPU acceleration
"""

import sys
import json
import os
import torch
import torchaudio
import numpy as np
from pyannote.audio import Model, Inference
from pyannote.audio.pipelines import VoiceActivityDetection, OverlappedSpeechDetection
from pyannote.audio.utils.powerset import Powerset
from pyannote.core import Segment
import warnings
warnings.filterwarnings("ignore")

def main():
    if len(sys.argv) < 3:
        print("Usage: python script.py <audio_path> <analysis_type>")
        sys.exit(1)
    
    audio_path = sys.argv[1]
    analysis_type = sys.argv[2]
    hf_token = os.getenv('HF_TOKEN')
    
    if not hf_token:
        print("Error: HF_TOKEN environment variable required")
        sys.exit(1)
    
    # Check GPU availability
    device = "cuda" if torch.cuda.is_available() else "cpu"
    print(f"Using device: {device}", file=sys.stderr)
    
    try:
        # Load models with GPU acceleration
        print("Loading pyannote.audio models...", file=sys.stderr)
        
        segmentation_model = Model.from_pretrained(
            "pyannote/segmentation-3.0",
            use_auth_token=hf_token
        ).to(device)
        
        # Initialize pipelines
        results = {}
        
        if analysis_type in ["full", "diarization"]:
            from pyannote.audio import Pipeline
            diarization_pipeline = Pipeline.from_pretrained(
                "pyannote/speaker-diarization-3.0",
                use_auth_token=hf_token
            ).to(device)
            
            print("Running speaker diarization...", file=sys.stderr)
            diarization = diarization_pipeline(audio_path)
            
            speakers = []
            for segment, _, speaker in diarization.itertracks(yield_label=True):
                speakers.append({
                    "start": float(segment.start),
                    "end": float(segment.end),
                    "speaker": speaker,
                    "duration": float(segment.end - segment.start)
                })
            results['diarization'] = speakers
        
        if analysis_type in ["full", "vad"]:
            print("Running voice activity detection...", file=sys.stderr)
            vad_pipeline = VoiceActivityDetection(segmentation=segmentation_model)
            vad_pipeline.instantiate({"min_duration_on": 0.0, "min_duration_off": 0.0})
            
            vad = vad_pipeline(audio_path)
            segments = []
            for segment in vad.get_timeline():
                segments.append({
                    "start": float(segment.start),
                    "end": float(segment.end),
                    "duration": float(segment.end - segment.start)
                })
            results['vad'] = segments
        
        if analysis_type in ["full", "osd"]:
            print("Running overlapped speech detection...", file=sys.stderr)
            osd_pipeline = OverlappedSpeechDetection(segmentation=segmentation_model)
            osd_pipeline.instantiate({"min_duration_on": 0.0, "min_duration_off": 0.0})
            
            osd = osd_pipeline(audio_path)
            segments = []
            for segment in osd.get_timeline():
                segments.append({
                    "start": float(segment.start),
                    "end": float(segment.end),
                    "duration": float(segment.end - segment.start)
                })
            results['osd'] = segments
        
        # Output results
        print(json.dumps(results, indent=2))
        
    except Exception as e:
        print(f"Error in audio analysis: {str(e)}", file=sys.stderr)
        print(json.dumps({"error": str(e)}))
        sys.exit(1)

if __name__ == "__main__":
    main()
`;
    }

    async saveScript(content, filename) {
        const scriptPath = path.join(__dirname, '../../hf_scripts', filename);
        await fs.writeFile(scriptPath, content, { mode: 0o755 });
        return scriptPath;
    }

    async executeHFCommand(command, timeout = 600) {
        return new Promise((resolve, reject) => {
            const process = spawn('hf', command, { 
                stdio: 'pipe',
                timeout: timeout * 1000
            });
            
            let stdout = '';
            let stderr = '';
            
            process.stdout.on('data', (data) => stdout += data.toString());
            process.stderr.on('data', (data) => stderr += data.toString());
            
            process.on('close', (code) => {
                if (code === 0) {
                    resolve({ stdout, stderr, code });
                } else {
                    reject(new Error(`HF command failed with code ${code}: ${stderr}`));
                }
            });
            
            process.on('error', (error) => {
                reject(new Error(`Failed to execute HF command: ${error.message}`));
            });
        });
    }

    parseJobOutput(output, fallbackId) {
        try {
            // Extract job ID and URL from HF Jobs output
            const lines = output.split('\n');
            let jobId = fallbackId;
            let jobUrl = null;
            
            for (const line of lines) {
                if (line.includes('Job ID:')) {
                    jobId = line.split('Job ID:')[1].trim();
                } else if (line.includes('https://huggingface.co/jobs/')) {
                    jobUrl = line.trim();
                }
            }
            
            return {
                id: jobId,
                url: jobUrl || `https://huggingface.co/jobs/${jobId}`,
                output: output
            };
        } catch (error) {
            return {
                id: fallbackId,
                url: `https://huggingface.co/jobs/${fallbackId}`,
                output: output
            };
        }
    }

    // Job Monitoring Methods
    async getJobStatus(jobId) {
        try {
            const result = await this.executeHFCommand(['jobs', 'inspect', jobId]);
            return this.parseJobStatus(result.stdout);
        } catch (error) {
            console.error(`[HFJobs] Failed to get job status for ${jobId}:`, error);
            return { status: 'UNKNOWN', error: error.message };
        }
    }

    async getJobLogs(jobId) {
        try {
            const result = await this.executeHFCommand(['jobs', 'logs', jobId]);
            return result.stdout;
        } catch (error) {
            console.error(`[HFJobs] Failed to get job logs for ${jobId}:`, error);
            return `Error retrieving logs: ${error.message}`;
        }
    }

    async listJobs() {
        try {
            const result = await this.executeHFCommand(['jobs', 'ps']);
            return this.parseJobsList(result.stdout);
        } catch (error) {
            console.error('[HFJobs] Failed to list jobs:', error);
            return [];
        }
    }

    async cancelJob(jobId) {
        try {
            await this.executeHFCommand(['jobs', 'cancel', jobId]);
            
            // Update local job status
            if (this.activeJobs.has(jobId)) {
                const job = this.activeJobs.get(jobId);
                job.status = 'CANCELLED';
                job.endTime = new Date();
            }
            
            console.log(`[HFJobs] ✅ Job ${jobId} cancelled`);
            return true;
        } catch (error) {
            console.error(`[HFJobs] Failed to cancel job ${jobId}:`, error);
            throw error;
        }
    }

    parseJobStatus(output) {
        try {
            // Parse job inspection output for status information
            const lines = output.split('\n');
            let status = 'UNKNOWN';
            let info = {};
            
            for (const line of lines) {
                if (line.includes('Status:')) {
                    status = line.split('Status:')[1].trim();
                } else if (line.includes('Created:')) {
                    info.created = line.split('Created:')[1].trim();
                } else if (line.includes('Hardware:')) {
                    info.hardware = line.split('Hardware:')[1].trim();
                }
            }
            
            return { status, ...info, rawOutput: output };
        } catch (error) {
            return { status: 'PARSE_ERROR', error: error.message };
        }
    }

    parseJobsList(output) {
        try {
            const jobs = [];
            const lines = output.split('\n');
            
            for (const line of lines) {
                if (line.includes('JOB ID')) continue; // Skip header
                if (line.trim() === '') continue; // Skip empty lines
                
                const parts = line.trim().split(/\s+/);
                if (parts.length >= 3) {
                    jobs.push({
                        id: parts[0],
                        status: parts[1],
                        created: parts.slice(2).join(' ')
                    });
                }
            }
            
            return jobs;
        } catch (error) {
            console.error('[HFJobs] Failed to parse jobs list:', error);
            return [];
        }
    }

    // Queue Management
    startJobProcessor() {
        setInterval(async () => {
            if (!this.processingJobs && this.jobQueue.length > 0) {
                this.processingJobs = true;
                const job = this.jobQueue.shift();
                
                try {
                    const result = await this.runJob(job.options);
                    job.resolve(result);
                } catch (error) {
                    job.reject(error);
                }
                
                this.processingJobs = false;
            }
        }, 2000);
    }

    async queueJob(options) {
        return new Promise((resolve, reject) => {
            this.jobQueue.push({
                options,
                resolve,
                reject,
                queuedAt: new Date()
            });
        });
    }

    // Utility Methods
    estimateProcessingTime(audioFilePath, analysisType) {
        // Rough estimates based on analysis type and file size
        const estimates = {
            'full': 120, // 2 minutes base
            'diarization': 90,
            'vad': 30,
            'osd': 45,
            'segmentation': 60
        };
        
        return estimates[analysisType] || 60;
    }

    getOptimalFlavor(taskType, priority = 'balanced') {
        const flavorMap = {
            audio_analysis: {
                fast: this.config.flavors.gpu.a100_large,
                balanced: this.config.flavors.gpu.a10g_small,
                cost: this.config.flavors.gpu.t4_small
            },
            light_processing: {
                fast: this.config.flavors.cpu.upgrade,
                balanced: this.config.flavors.cpu.basic,
                cost: this.config.flavors.cpu.basic
            }
        };
        
        return flavorMap[taskType]?.[priority] || this.config.flavors.cpu.basic;
    }

    // Health Check
    async healthCheck() {
        try {
            await this.checkHFCLI();
            await this.verifyAuth();
            
            const jobs = await this.listJobs();
            
            return {
                status: 'healthy',
                hf_cli: 'available',
                authenticated: true,
                active_jobs: jobs.length,
                queue_size: this.jobQueue.length,
                local_jobs: this.activeJobs.size,
                last_check: new Date()
            };
        } catch (error) {
            return {
                status: 'unhealthy',
                error: error.message,
                last_check: new Date()
            };
        }
    }
}

export default HuggingFaceJobsService;
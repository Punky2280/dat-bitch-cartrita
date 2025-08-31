#!/usr/bin/env node

/**
 * HF Jobs Demo Script
 * Runs actual Hugging Face Jobs to test the platform
 */

import { spawn } from 'child_process';

class HFJobsDemo {
  constructor() {
    this.jobs = [];
  }

  async runDemo() {
    console.log('🚀 Hugging Face Jobs Demo\n');
    console.log('This script will run actual HF Jobs to test the platform.');
    console.log('Note: Requires HF Pro subscription and will incur costs.\n');

    // Check if user wants to proceed
    const shouldProceed = await this.promptUser(
      'Do you want to proceed? (y/N): '
    );
    if (!shouldProceed) {
      console.log('Demo cancelled.');
      return;
    }

    await this.runBasicTests();
    await this.runAdvancedTests();

    console.log('\n🎉 Demo completed!');
    this.printJobsSummary();
  }

  async runBasicTests() {
    console.log('\n📋 Basic Tests');
    console.log('==============');

    // Test 1: Simple Python execution
    console.log('\n🐍 Test 1: Simple Python execution');
    try {
      const job1 = await this.runHFJob([
        'jobs',
        'run',
        'python:3.12',
        'python',
        '-c',
        'print("Hello from HF Jobs!"); import sys; print(f"Python version: {sys.version}"); import datetime; print(f"Current time: {datetime.datetime.now()}")',
      ]);
      this.jobs.push({ name: 'Python Hello World', ...job1 });
    } catch (error) {
      console.log('❌ Failed:', error.message);
    }

    // Test 2: System information
    console.log('\n💻 Test 2: System information');
    try {
      const job2 = await this.runHFJob([
        'jobs',
        'run',
        '--flavor',
        'cpu-upgrade',
        'ubuntu:22.04',
        'bash',
        '-c',
        'echo "=== System Info ==="; uname -a; echo "=== CPU Info ==="; nproc; echo "=== Memory Info ==="; free -h; echo "=== Disk Info ==="; df -h',
      ]);
      this.jobs.push({ name: 'System Information', ...job2 });
    } catch (error) {
      console.log('❌ Failed:', error.message);
    }

    // Test 3: Python package installation
    console.log('\n📦 Test 3: Python package installation');
    try {
      const job3 = await this.runHFJob([
        'jobs',
        'run',
        'python:3.12',
        'bash',
        '-c',
        'pip install requests numpy pandas && python -c "import requests, numpy, pandas; print(f\\"✅ Packages installed successfully\\"); print(f\\"NumPy version: {numpy.__version__}\\"); print(f\\"Pandas version: {pandas.__version__}\\")"',
      ]);
      this.jobs.push({ name: 'Package Installation', ...job3 });
    } catch (error) {
      console.log('❌ Failed:', error.message);
    }
  }

  async runAdvancedTests() {
    console.log('\n🚀 Advanced Tests');
    console.log('=================');

    // Test 4: GPU availability check
    console.log('\n🔥 Test 4: GPU availability check');
    try {
      const job4 = await this.runHFJob([
        'jobs',
        'run',
        '--flavor',
        't4-small',
        'pytorch/pytorch:2.6.0-cuda12.4-cudnn9-devel',
        'python',
        '-c',
        'import torch; print(f"PyTorch version: {torch.__version__}"); print(f"CUDA available: {torch.cuda.is_available()}"); print(f"CUDA version: {torch.version.cuda}"); print(f"GPU count: {torch.cuda.device_count()}"); [print(f"GPU {i}: {torch.cuda.get_device_name(i)}") for i in range(torch.cuda.device_count())]',
      ]);
      this.jobs.push({ name: 'GPU Check', ...job4 });
    } catch (error) {
      console.log('❌ Failed (GPU may not be available):', error.message);
    }

    // Test 5: Hugging Face transformers
    console.log('\n🤗 Test 5: Hugging Face transformers');
    try {
      const job5 = await this.runHFJob([
        'jobs',
        'run',
        '--flavor',
        'cpu-upgrade',
        '--env',
        `HF_TOKEN=${process.env.HF_TOKEN}`,
        'huggingface/transformers-pytorch-cpu:4.45.0',
        'python',
        '-c',
        `
import os
from transformers import pipeline, AutoTokenizer
print("🤗 Testing Hugging Face transformers...")
try:
    # Test text generation with a small model
    generator = pipeline("text-generation", model="gpt2", max_length=50, num_return_sequences=1)
    result = generator("Hello from HF Jobs")
    print("✅ Text generation successful!")
    print("Generated text:", result[0]['generated_text'])
    
    # Test tokenizer
    tokenizer = AutoTokenizer.from_pretrained("gpt2")
    tokens = tokenizer.encode("Hello world")
    print(f"✅ Tokenization successful! Tokens: {tokens}")
    
    print("🎉 Hugging Face transformers working perfectly!")
except Exception as e:
    print(f"❌ Error: {e}")
                `,
      ]);
      this.jobs.push({ name: 'HF Transformers', ...job5 });
    } catch (error) {
      console.log('❌ Failed:', error.message);
    }

    // Test 6: Audio processing simulation
    console.log('\n🎵 Test 6: Audio processing simulation');
    try {
      const job6 = await this.runHFJob([
        'jobs',
        'run',
        '--flavor',
        'cpu-upgrade',
        'python:3.12',
        'bash',
        '-c',
        `
pip install numpy scipy librosa soundfile &&
python -c "
import numpy as np
import scipy.io.wavfile as wav
import librosa
print('🎵 Audio processing libraries installed!')

# Create synthetic audio data
sample_rate = 16000
duration = 5  # seconds
t = np.linspace(0, duration, sample_rate * duration)
# Generate a simple sine wave
frequency = 440  # A4 note
audio_data = np.sin(2 * np.pi * frequency * t) * 0.3

print(f'✅ Generated {duration}s of synthetic audio at {sample_rate}Hz')
print(f'📊 Audio shape: {audio_data.shape}')
print(f'📊 Audio range: {audio_data.min():.3f} to {audio_data.max():.3f}')

# Simulate audio analysis
rms = np.sqrt(np.mean(audio_data**2))
print(f'📊 RMS level: {rms:.3f}')
print('🎉 Audio processing simulation complete!')
"
                `,
      ]);
      this.jobs.push({ name: 'Audio Processing Simulation', ...job6 });
    } catch (error) {
      console.log('❌ Failed:', error.message);
    }
  }

  async runHFJob(command) {
    return new Promise((resolve, reject) => {
      console.log(`  🚀 Running: hf ${command.join(' ')}`);

      const process = spawn('hf', command, { stdio: 'pipe' });
      let stdout = '';
      let stderr = '';

      process.stdout.on('data', data => {
        stdout += data.toString();
      });

      process.stderr.on('data', data => {
        stderr += data.toString();
      });

      process.on('close', code => {
        if (code === 0) {
          console.log('  ✅ Job submitted successfully');

          // Extract job information
          const jobInfo = this.parseJobOutput(stdout);
          console.log(`  🔗 Job ID: ${jobInfo.id}`);
          console.log(`  🔗 Job URL: ${jobInfo.url}`);

          resolve(jobInfo);
        } else {
          reject(new Error(`Command failed with code ${code}: ${stderr}`));
        }
      });

      process.on('error', error => {
        reject(new Error(`Failed to run command: ${error.message}`));
      });
    });
  }

  parseJobOutput(output) {
    const lines = output.split('\n');
    let jobId = 'unknown';
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
      submittedAt: new Date(),
    };
  }

  async promptUser(question) {
    return new Promise(resolve => {
      const readline = require('readline');
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
      });

      rl.question(question, answer => {
        rl.close();
        resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes');
      });
    });
  }

  printJobsSummary() {
    console.log('\n📊 Jobs Summary');
    console.log('===============');
    console.log(`Total jobs submitted: ${this.jobs.length}`);

    if (this.jobs.length > 0) {
      console.log('\n📋 Job Details:');
      this.jobs.forEach((job, index) => {
        console.log(`${index + 1}. ${job.name}`);
        console.log(`   ID: ${job.id}`);
        console.log(`   URL: ${job.url}`);
        console.log(`   Submitted: ${job.submittedAt.toLocaleString()}`);
        console.log('');
      });
    }

    console.log('🔍 To check job status:');
    console.log('   hf jobs ps                    # List all jobs');
    console.log('   hf jobs inspect <job_id>      # Get job details');
    console.log('   hf jobs logs <job_id>         # View job logs');
    console.log('   hf jobs cancel <job_id>       # Cancel a job');

    console.log('\n💡 Tips:');
    console.log('- Jobs may take a few minutes to start');
    console.log('- Check the HF Jobs dashboard for real-time status');
    console.log('- GPU jobs are faster but cost more than CPU jobs');
  }
}

// Run demo if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const demo = new HFJobsDemo();
  demo.runDemo().catch(error => {
    console.error('Demo failed:', error);
    process.exit(1);
  });
}

export default HFJobsDemo;

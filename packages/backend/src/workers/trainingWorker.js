/**
 * Training Worker
 * 
 * Worker thread for executing ML training jobs in isolation.
 * Simulates training progress and communicates with the main training engine.
 */

import { parentPort, workerData } from 'worker_threads';
import { promises as fs } from 'fs';
import path from 'path';

class TrainingWorker {
    constructor(jobData) {
        this.jobId = jobData.jobId;
        this.trainingSpec = jobData.trainingSpec;
        this.environment = jobData.environment;
        this.resourceRequirements = jobData.resourceRequirements;

        this.running = false;
        this.currentEpoch = 0;
        this.totalEpochs = this.trainingSpec.training_config?.epochs || 10;
        this.batchSize = this.trainingSpec.training_config?.batch_size || 32;
        this.learningRate = this.trainingSpec.training_config?.learning_rate || 0.001;

        // Simulation parameters
        this.simulationSpeed = 1000; // ms per epoch
        this.targetAccuracy = Math.random() * 0.3 + 0.7; // Random target 0.7-1.0
        this.baselineAccuracy = Math.random() * 0.3 + 0.1; // Random baseline 0.1-0.4
    }

    async start() {
        try {
            this.running = true;
            
            this.sendMessage({
                type: 'progress',
                data: {
                    status: 'initializing',
                    message: 'Starting training job'
                }
            });

            await this.initializeTraining();
            await this.runTraining();

            this.sendMessage({
                type: 'completion',
                data: {
                    status: 'completed',
                    final_metrics: {
                        accuracy: this.targetAccuracy,
                        loss: this.generateLoss(this.totalEpochs),
                        epochs_completed: this.totalEpochs,
                        training_time: this.totalEpochs * (this.simulationSpeed / 1000)
                    }
                }
            });

        } catch (error) {
            this.sendMessage({
                type: 'error',
                data: {
                    error: error.message,
                    stack: error.stack
                }
            });
        }
    }

    async initializeTraining() {
        // Create necessary directories
        await fs.mkdir(this.environment.checkpointPath, { recursive: true });
        await fs.mkdir(this.environment.logPath, { recursive: true });

        // Write initial training log
        const logFile = path.join(this.environment.logPath, 'training.log');
        await fs.writeFile(logFile, `Training started for job ${this.jobId}\n`);

        this.sendMessage({
            type: 'progress',
            data: {
                status: 'initialized',
                message: 'Training environment initialized'
            }
        });
    }

    async runTraining() {
        for (let epoch = 1; epoch <= this.totalEpochs && this.running; epoch++) {
            this.currentEpoch = epoch;

            // Simulate training epoch
            const metrics = await this.trainEpoch(epoch);
            
            // Send metrics update
            this.sendMessage({
                type: 'metrics',
                data: metrics
            });

            // Send progress update
            const progress = Math.floor((epoch / this.totalEpochs) * 100);
            this.sendMessage({
                type: 'progress',
                data: {
                    status: 'training',
                    epoch: epoch,
                    total_epochs: this.totalEpochs,
                    progress: progress,
                    eta: (this.totalEpochs - epoch) * (this.simulationSpeed / 1000)
                }
            });

            // Save checkpoint every 5 epochs
            if (epoch % 5 === 0) {
                await this.saveCheckpoint(epoch, metrics);
            }

            // Wait to simulate training time
            await this.sleep(this.simulationSpeed);
        }
    }

    async trainEpoch(epoch) {
        // Simulate training metrics with realistic progression
        const progress = epoch / this.totalEpochs;
        
        // Loss decreases with some noise
        const baseLoss = 2.0 * Math.exp(-progress * 2); // Exponential decay
        const noise = (Math.random() - 0.5) * 0.1;
        const loss = Math.max(0.01, baseLoss + noise);

        // Accuracy increases with plateau
        const accuracyGrowth = this.baselineAccuracy + 
            (this.targetAccuracy - this.baselineAccuracy) * 
            (1 - Math.exp(-progress * 3));
        const accuracyNoise = (Math.random() - 0.5) * 0.02;
        const accuracy = Math.min(1.0, Math.max(0.0, accuracyGrowth + accuracyNoise));

        // Additional metrics
        const precision = accuracy * (0.95 + Math.random() * 0.05);
        const recall = accuracy * (0.90 + Math.random() * 0.10);
        const f1Score = 2 * (precision * recall) / (precision + recall);

        const metrics = {
            epoch: epoch,
            loss: parseFloat(loss.toFixed(4)),
            accuracy: parseFloat(accuracy.toFixed(4)),
            precision: parseFloat(precision.toFixed(4)),
            recall: parseFloat(recall.toFixed(4)),
            f1_score: parseFloat(f1Score.toFixed(4)),
            learning_rate: this.learningRate,
            batch_size: this.batchSize,
            timestamp: new Date().toISOString()
        };

        // Add framework-specific metrics
        if (this.trainingSpec.framework === 'tensorflow') {
            metrics.val_loss = loss * (1.1 + Math.random() * 0.2);
            metrics.val_accuracy = accuracy * (0.9 + Math.random() * 0.1);
        } else if (this.trainingSpec.framework === 'pytorch') {
            metrics.train_loss = loss;
            metrics.train_acc = accuracy;
        }

        return metrics;
    }

    generateLoss(epoch) {
        const progress = epoch / this.totalEpochs;
        const baseLoss = 2.0 * Math.exp(-progress * 2);
        const noise = (Math.random() - 0.5) * 0.05;
        return Math.max(0.01, baseLoss + noise);
    }

    async saveCheckpoint(epoch, metrics) {
        const checkpointData = {
            job_id: this.jobId,
            epoch: epoch,
            metrics: metrics,
            model_state: `checkpoint_epoch_${epoch}`,
            optimizer_state: `optimizer_epoch_${epoch}`,
            timestamp: new Date().toISOString()
        };

        const checkpointFile = path.join(
            this.environment.checkpointPath,
            `checkpoint_epoch_${epoch}.json`
        );

        await fs.writeFile(checkpointFile, JSON.stringify(checkpointData, null, 2));

        this.sendMessage({
            type: 'checkpoint',
            data: {
                epoch: epoch,
                checkpoint_path: checkpointFile,
                metrics: metrics
            }
        });

        // Log checkpoint
        const logFile = path.join(this.environment.logPath, 'training.log');
        await fs.appendFile(logFile, `Checkpoint saved at epoch ${epoch}\n`);
    }

    sendMessage(message) {
        if (parentPort) {
            parentPort.postMessage(message);
        }
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    stop() {
        this.running = false;
    }
}

// Handle worker initialization
if (workerData) {
    const worker = new TrainingWorker(workerData);
    
    // Handle stop signals
    if (parentPort) {
        parentPort.on('message', (message) => {
            if (message.type === 'stop') {
                worker.stop();
            }
        });
    }

    // Start training
    worker.start().catch(error => {
        console.error('Training worker error:', error);
        if (parentPort) {
            parentPort.postMessage({
                type: 'error',
                data: {
                    error: error.message,
                    stack: error.stack
                }
            });
        }
        process.exit(1);
    });
}

export default TrainingWorker;

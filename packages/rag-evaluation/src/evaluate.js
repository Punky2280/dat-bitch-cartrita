#!/usr/bin/env node

/**
 * RAG Evaluation CLI
 * Command-line interface for running RAG evaluations
 */

import { Command } from 'commander';
import chalk from 'chalk';
import inquirer from 'inquirer';
import { mkdir } from 'fs/promises';
import { RAGEvaluationHarness } from './index.js';

const program = new Command();

program
    .name('rag-eval')
    .description('Advanced RAG evaluation harness for Cartrita')
    .version('1.0.0');

program
    .command('run')
    .description('Run RAG evaluation')
    .option('-d, --dataset <path>', 'Path to evaluation dataset', './data/eval-dataset.js')
    .option('-e, --endpoint <url>', 'RAG endpoint URL', 'http://localhost:8001/api/knowledge/advanced-rag')
    .option('-m, --model <model>', 'Evaluation model', 'gpt-4')
    .option('-b, --batch-size <size>', 'Batch size', '5')
    .option('-o, --output <dir>', 'Output directory', './eval-results')
    .option('--auth-token <token>', 'Authentication token', 'test-token')
    .option('--top-k <k>', 'Number of documents to retrieve', '5')
    .option('--threshold <t>', 'Similarity threshold', '0.7')
    .option('--interactive', 'Run in interactive mode')
    .action(async (options) => {
        try {
            // Create output directory
            await mkdir(options.output, { recursive: true });
            
            let config = {
                ragEndpoint: options.endpoint,
                evaluationModel: options.model,
                batchSize: parseInt(options.batchSize),
                outputDir: options.output
            };
            
            let evalOptions = {
                authToken: options.authToken,
                top_k: parseInt(options.topK),
                threshold: parseFloat(options.threshold)
            };
            
            // Interactive mode
            if (options.interactive) {
                console.log(chalk.blue.bold('\n🔍 RAG Evaluation Setup\n'));
                
                const answers = await inquirer.prompt([
                    {
                        type: 'input',
                        name: 'endpoint',
                        message: 'RAG endpoint URL:',
                        default: config.ragEndpoint
                    },
                    {
                        type: 'list',
                        name: 'model',
                        message: 'Evaluation model:',
                        choices: ['gpt-4', 'gpt-4-turbo', 'gpt-3.5-turbo'],
                        default: config.evaluationModel
                    },
                    {
                        type: 'number',
                        name: 'batchSize',
                        message: 'Batch size:',
                        default: config.batchSize
                    },
                    {
                        type: 'number',
                        name: 'topK',
                        message: 'Documents to retrieve (top-k):',
                        default: evalOptions.top_k
                    },
                    {
                        type: 'number',
                        name: 'threshold',
                        message: 'Similarity threshold:',
                        default: evalOptions.threshold
                    },
                    {
                        type: 'confirm',
                        name: 'rerank',
                        message: 'Enable reranking?',
                        default: true
                    }
                ]);
                
                config = { ...config, ...answers };
                evalOptions = { ...evalOptions, ...answers };
            }
            
            console.log(chalk.green.bold('\n🚀 Starting RAG Evaluation...\n'));
            console.log(chalk.gray(`Endpoint: ${config.ragEndpoint}`));
            console.log(chalk.gray(`Model: ${config.evaluationModel}`));
            console.log(chalk.gray(`Batch Size: ${config.batchSize}`));
            console.log(chalk.gray(`Output: ${config.outputDir}\n`));
            
            // Initialize harness
            const harness = new RAGEvaluationHarness(config);
            
            // Run evaluation
            const results = await harness.runEvaluation(options.dataset, evalOptions);
            
            console.log(chalk.green.bold('\n✅ Evaluation completed successfully!'));
            console.log(chalk.gray(`Report saved: ${results.report.filename}\n`));
            
        } catch (error) {
            console.error(chalk.red.bold('\n❌ Evaluation failed:'), error.message);
            console.error(chalk.red(error.stack));
            process.exit(1);
        }
    });

program
    .command('benchmark')
    .description('Run performance benchmark')
    .option('-e, --endpoint <url>', 'RAG endpoint URL', 'http://localhost:8001/api/knowledge/advanced-rag')
    .option('-c, --concurrent <num>', 'Concurrent requests', '5')
    .option('-n, --num-queries <num>', 'Number of queries', '50')
    .option('--auth-token <token>', 'Authentication token', 'test-token')
    .action(async (options) => {
        try {
            console.log(chalk.blue.bold('\n⚡ RAG Performance Benchmark\n'));
            
            const queries = [
                'What is machine learning?',
                'How does natural language processing work?',
                'Explain computer vision algorithms',
                'What are the benefits of cloud computing?',
                'How do databases handle transactions?'
            ];
            
            const startTime = Date.now();
            const results = [];
            
            for (let i = 0; i < options.numQueries; i++) {
                const query = queries[i % queries.length];
                const queryStart = Date.now();
                
                try {
                    const response = await fetch(options.endpoint, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${options.authToken}`
                        },
                        body: JSON.stringify({ query })
                    });
                    
                    if (response.ok) {
                        const data = await response.json();
                        results.push({
                            query,
                            latency: Date.now() - queryStart,
                            success: true,
                            response_length: JSON.stringify(data).length
                        });
                    } else {
                        results.push({
                            query,
                            latency: Date.now() - queryStart,
                            success: false,
                            error: response.statusText
                        });
                    }
                } catch (error) {
                    results.push({
                        query,
                        latency: Date.now() - queryStart,
                        success: false,
                        error: error.message
                    });
                }
                
                if ((i + 1) % 10 === 0) {
                    console.log(chalk.gray(`Completed ${i + 1}/${options.numQueries} queries...`));
                }
            }
            
            const totalTime = Date.now() - startTime;
            const successfulQueries = results.filter(r => r.success);
            const avgLatency = successfulQueries.reduce((sum, r) => sum + r.latency, 0) / successfulQueries.length;
            const throughput = (successfulQueries.length / totalTime) * 1000;
            
            console.log(chalk.green.bold('\n📊 Benchmark Results:'));
            console.log(chalk.white(`Total Queries: ${results.length}`));
            console.log(chalk.white(`Successful: ${successfulQueries.length} (${((successfulQueries.length / results.length) * 100).toFixed(1)}%)`));
            console.log(chalk.white(`Average Latency: ${avgLatency.toFixed(0)}ms`));
            console.log(chalk.white(`Throughput: ${throughput.toFixed(2)} queries/sec`));
            console.log(chalk.white(`Total Time: ${(totalTime / 1000).toFixed(1)}s\n`));
            
        } catch (error) {
            console.error(chalk.red.bold('\n❌ Benchmark failed:'), error.message);
            process.exit(1);
        }
    });

program
    .command('dataset')
    .description('Generate evaluation dataset')
    .option('-o, --output <path>', 'Output file path', './data/eval-dataset.js')
    .option('-s, --size <num>', 'Dataset size', '20')
    .action(async (options) => {
        try {
            console.log(chalk.blue.bold('\n📝 Generating Evaluation Dataset...\n'));
            
            const dataset = [];
            const categories = ['architecture', 'technical', 'security', 'technology', 'operations'];
            
            for (let i = 0; i < options.size; i++) {
                dataset.push({
                    id: `q${i + 1}`,
                    question: `Sample question ${i + 1}?`,
                    expected_concepts: ['concept1', 'concept2', 'concept3'],
                    ground_truth: `Sample ground truth answer for question ${i + 1}`,
                    category: categories[i % categories.length]
                });
            }
            
            const content = `// RAG Evaluation Dataset
// Generated on ${new Date().toISOString()}

export default ${JSON.stringify(dataset, null, 2)};
`;
            
            await mkdir(path.dirname(options.output), { recursive: true });
            await writeFile(options.output, content);
            
            console.log(chalk.green.bold('✅ Dataset generated successfully!'));
            console.log(chalk.gray(`File: ${options.output}`));
            console.log(chalk.gray(`Size: ${dataset.length} questions\n`));
            
        } catch (error) {
            console.error(chalk.red.bold('\n❌ Dataset generation failed:'), error.message);
            process.exit(1);
        }
    });

program.parse();
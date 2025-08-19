/**
 * Advanced RAG Evaluation Harness
 * Comprehensive evaluation suite for Cartrita's RAG pipeline
 */

import { OpenAI } from 'openai';
import axios from 'axios';
import _ from 'lodash';
import { table } from 'table';
import chalk from 'chalk';
import ora from 'ora';
import { writeFile } from 'fs/promises';
import { format } from 'date-fns';

export class RAGEvaluationHarness {
    constructor(config = {}) {
        this.config = {
            ragEndpoint: config.ragEndpoint || 'http://localhost:8001/api/knowledge/advanced-rag',
            openaiApiKey: config.openaiApiKey || process.env.OPENAI_API_KEY,
            evaluationModel: config.evaluationModel || 'gpt-4',
            batchSize: config.batchSize || 5,
            outputDir: config.outputDir || './eval-results',
            ...config
        };
        
        this.openai = new OpenAI({
            apiKey: this.config.openaiApiKey
        });
        
        this.metrics = {
            retrieval: {
                precision_at_k: [],
                recall_at_k: [],
                mrr: [], // Mean Reciprocal Rank
                ndcg: [] // Normalized Discounted Cumulative Gain
            },
            generation: {
                faithfulness: [],
                relevance: [],
                coherence: [],
                fluency: []
            },
            overall: {
                latency: [],
                success_rate: 0,
                total_queries: 0,
                errors: []
            }
        };
        
        this.evaluationPrompts = {
            faithfulness: `
Rate the faithfulness of the generated answer to the retrieved context on a scale of 1-5:
1 = Completely contradicts or ignores the context
2 = Partially contradicts the context
3 = Neither contradicts nor fully aligns with context
4 = Mostly faithful to the context
5 = Completely faithful to the context

Context: {context}
Generated Answer: {answer}

Score (1-5):`,

            relevance: `
Rate how relevant the generated answer is to the original question on a scale of 1-5:
1 = Completely irrelevant
2 = Partially relevant
3 = Moderately relevant
4 = Mostly relevant  
5 = Completely relevant

Question: {question}
Generated Answer: {answer}

Score (1-5):`,

            coherence: `
Rate the coherence and logical flow of the generated answer on a scale of 1-5:
1 = Incoherent, contradictory
2 = Somewhat incoherent
3 = Average coherence
4 = Good coherence
5 = Excellent coherence and flow

Generated Answer: {answer}

Score (1-5):`,

            fluency: `
Rate the fluency and readability of the generated answer on a scale of 1-5:
1 = Very poor grammar/readability
2 = Poor grammar/readability
3 = Average grammar/readability
4 = Good grammar/readability
5 = Excellent grammar/readability

Generated Answer: {answer}

Score (1-5):`
        };
    }
    
    /**
     * Load evaluation dataset
     */
    async loadDataset(datasetPath) {
        try {
            const dataset = await import(datasetPath);
            return dataset.default || dataset;
        } catch (error) {
            console.error(`Failed to load dataset from ${datasetPath}:`, error);
            return this.getDefaultDataset();
        }
    }
    
    /**
     * Get default evaluation dataset
     */
    getDefaultDataset() {
        return [
            {
                id: 'q1',
                question: 'What is the main purpose of the Cartrita multi-agent system?',
                expected_concepts: ['multi-agent', 'AI', 'orchestration', 'specialized', 'collaboration'],
                ground_truth: 'The Cartrita multi-agent system orchestrates specialized AI agents to provide comprehensive assistance.',
                category: 'architecture'
            },
            {
                id: 'q2', 
                question: 'How does the RAG pipeline work in Cartrita?',
                expected_concepts: ['retrieval', 'generation', 'embedding', 'vector search', 'context'],
                ground_truth: 'The RAG pipeline retrieves relevant documents using vector search, then generates answers using the context.',
                category: 'technical'
            },
            {
                id: 'q3',
                question: 'What are the key security features implemented?',
                expected_concepts: ['encryption', 'authentication', 'authorization', 'security', 'privacy'],
                ground_truth: 'Key security features include AES encryption, JWT authentication, role-based access control, and audit logging.',
                category: 'security'
            },
            {
                id: 'q4',
                question: 'What programming languages and frameworks are used?',
                expected_concepts: ['Node.js', 'JavaScript', 'TypeScript', 'React', 'Python', 'PostgreSQL'],
                ground_truth: 'The system uses Node.js/TypeScript for backend, React for frontend, Python for ML services, and PostgreSQL for storage.',
                category: 'technology'
            },
            {
                id: 'q5',
                question: 'How is the system monitored and observed?',
                expected_concepts: ['OpenTelemetry', 'metrics', 'tracing', 'monitoring', 'observability'],
                ground_truth: 'The system uses OpenTelemetry for distributed tracing, custom metrics, health checks, and performance monitoring.',
                category: 'operations'
            }
        ];
    }
    
    /**
     * Query RAG system
     */
    async queryRAGSystem(question, options = {}) {
        try {
            const response = await axios.post(this.config.ragEndpoint, {
                query: question,
                top_k: options.top_k || 5,
                threshold: options.threshold || 0.7,
                rerank: options.rerank !== false,
                ...options
            }, {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${options.authToken || 'test-token'}`
                },
                timeout: 30000
            });
            
            return response.data;
        } catch (error) {
            console.error('RAG query failed:', error.message);
            throw error;
        }
    }
    
    /**
     * Evaluate retrieval quality
     */
    async evaluateRetrieval(question, retrievedDocs, expectedConcepts, groundTruth) {
        const results = {
            precision_at_k: 0,
            recall_at_k: 0,
            mrr: 0,
            ndcg: 0,
            relevance_scores: []
        };
        
        if (!retrievedDocs || retrievedDocs.length === 0) {
            return results;
        }
        
        // Calculate relevance for each retrieved document
        for (const doc of retrievedDocs) {
            const relevanceScore = await this.calculateRelevanceScore(question, doc.text);
            results.relevance_scores.push({
                doc_id: doc.id,
                score: relevanceScore,
                similarity: doc.score
            });
        }
        
        // Calculate precision@k (assuming threshold of 3+ is relevant)
        const relevantDocs = results.relevance_scores.filter(doc => doc.score >= 3);
        results.precision_at_k = relevantDocs.length / retrievedDocs.length;
        
        // Calculate concept coverage (proxy for recall)
        const conceptCoverage = this.calculateConceptCoverage(retrievedDocs, expectedConcepts);
        results.recall_at_k = conceptCoverage;
        
        // Calculate MRR (Mean Reciprocal Rank)
        const firstRelevantRank = results.relevance_scores.findIndex(doc => doc.score >= 4) + 1;
        results.mrr = firstRelevantRank > 0 ? 1 / firstRelevantRank : 0;
        
        // Calculate NDCG@k
        results.ndcg = this.calculateNDCG(results.relevance_scores, retrievedDocs.length);
        
        return results;
    }
    
    /**
     * Calculate relevance score using LLM
     */
    async calculateRelevanceScore(question, documentText) {
        try {
            const prompt = `
Rate how relevant this document is for answering the question on a scale of 1-5:
1 = Not relevant at all
2 = Slightly relevant  
3 = Moderately relevant
4 = Highly relevant
5 = Perfectly relevant

Question: ${question}
Document: ${documentText.substring(0, 1000)}...

Score (1-5):`;
            
            const response = await this.openai.chat.completions.create({
                model: this.config.evaluationModel,
                messages: [{ role: 'user', content: prompt }],
                max_tokens: 10,
                temperature: 0
            });
            
            const scoreMatch = response.choices[0].message.content.match(/[1-5]/);
            return scoreMatch ? parseInt(scoreMatch[0]) : 1;
            
        } catch (error) {
            console.warn('Failed to calculate relevance score:', error.message);
            return 1;
        }
    }
    
    /**
     * Calculate concept coverage
     */
    calculateConceptCoverage(documents, expectedConcepts) {
        if (!expectedConcepts || expectedConcepts.length === 0) {
            return 1.0;
        }
        
        const allText = documents.map(doc => doc.text).join(' ').toLowerCase();
        const foundConcepts = expectedConcepts.filter(concept => 
            allText.includes(concept.toLowerCase())
        );
        
        return foundConcepts.length / expectedConcepts.length;
    }
    
    /**
     * Calculate NDCG@k
     */
    calculateNDCG(relevanceScores, k) {
        const dcg = relevanceScores.slice(0, k).reduce((sum, doc, index) => {
            const relevance = doc.score;
            const discount = Math.log2(index + 2); // +2 because log2(1) = 0
            return sum + (Math.pow(2, relevance) - 1) / discount;
        }, 0);
        
        // Calculate IDCG (Ideal DCG)
        const idealOrder = relevanceScores
            .map(doc => doc.score)
            .sort((a, b) => b - a)
            .slice(0, k);
            
        const idcg = idealOrder.reduce((sum, relevance, index) => {
            const discount = Math.log2(index + 2);
            return sum + (Math.pow(2, relevance) - 1) / discount;
        }, 0);
        
        return idcg > 0 ? dcg / idcg : 0;
    }
    
    /**
     * Evaluate generation quality
     */
    async evaluateGeneration(question, answer, context) {
        const results = {
            faithfulness: 0,
            relevance: 0,
            coherence: 0,
            fluency: 0
        };
        
        if (!answer || answer.trim().length === 0) {
            return results;
        }
        
        // Evaluate each dimension
        for (const dimension of Object.keys(results)) {
            try {
                const score = await this.evaluateDimension(dimension, {
                    question,
                    answer,
                    context: context || ''
                });
                results[dimension] = score;
            } catch (error) {
                console.warn(`Failed to evaluate ${dimension}:`, error.message);
                results[dimension] = 1;
            }
        }
        
        return results;
    }
    
    /**
     * Evaluate specific dimension using LLM
     */
    async evaluateDimension(dimension, params) {
        const prompt = this.evaluationPrompts[dimension]
            .replace('{question}', params.question || '')
            .replace('{answer}', params.answer || '')
            .replace('{context}', params.context || '');
        
        const response = await this.openai.chat.completions.create({
            model: this.config.evaluationModel,
            messages: [{ role: 'user', content: prompt }],
            max_tokens: 10,
            temperature: 0
        });
        
        const scoreMatch = response.choices[0].message.content.match(/[1-5]/);
        return scoreMatch ? parseInt(scoreMatch[0]) : 1;
    }
    
    /**
     * Run comprehensive evaluation
     */
    async runEvaluation(datasetPath, options = {}) {
        const spinner = ora('Loading evaluation dataset...').start();
        
        try {
            const dataset = await this.loadDataset(datasetPath);
            spinner.text = `Running evaluation on ${dataset.length} questions...`;
            
            const results = [];
            
            for (let i = 0; i < dataset.length; i += this.config.batchSize) {
                const batch = dataset.slice(i, i + this.config.batchSize);
                const batchPromises = batch.map(item => this.evaluateQuery(item, options));
                const batchResults = await Promise.allSettled(batchPromises);
                
                batchResults.forEach((result, index) => {
                    if (result.status === 'fulfilled') {
                        results.push(result.value);
                    } else {
                        const item = batch[index];
                        console.error(`Failed to evaluate query ${item.id}:`, result.reason);
                        results.push({
                            query_id: item.id,
                            error: result.reason.message,
                            success: false
                        });
                    }
                });
                
                spinner.text = `Processed ${Math.min(i + this.config.batchSize, dataset.length)}/${dataset.length} questions...`;
            }
            
            spinner.succeed(`Evaluation completed! Processed ${results.length} questions.`);
            
            // Calculate aggregate metrics
            const aggregatedMetrics = this.aggregateMetrics(results);
            
            // Generate report
            const report = await this.generateReport(results, aggregatedMetrics);
            
            return {
                results,
                metrics: aggregatedMetrics,
                report
            };
            
        } catch (error) {
            spinner.fail(`Evaluation failed: ${error.message}`);
            throw error;
        }
    }
    
    /**
     * Evaluate single query
     */
    async evaluateQuery(item, options = {}) {
        const startTime = Date.now();
        
        try {
            // Query RAG system
            const ragResponse = await this.queryRAGSystem(item.question, options);
            const queryTime = Date.now() - startTime;
            
            // Extract response components
            const answer = ragResponse.response?.answer || '';
            const retrievedDocs = ragResponse.context?.documents || [];
            const reasoning = ragResponse.response?.reasoning || '';
            
            // Evaluate retrieval
            const retrievalMetrics = await this.evaluateRetrieval(
                item.question,
                retrievedDocs,
                item.expected_concepts,
                item.ground_truth
            );
            
            // Evaluate generation
            const generationMetrics = await this.evaluateGeneration(
                item.question,
                answer,
                retrievedDocs.map(doc => doc.text).join('\n')
            );
            
            // Update overall metrics
            this.metrics.overall.latency.push(queryTime);
            this.metrics.overall.total_queries++;
            
            return {
                query_id: item.id,
                question: item.question,
                category: item.category,
                answer,
                reasoning,
                retrieved_docs: retrievedDocs.length,
                query_time_ms: queryTime,
                retrieval_metrics: retrievalMetrics,
                generation_metrics: generationMetrics,
                success: true,
                timestamp: new Date().toISOString()
            };
            
        } catch (error) {
            this.metrics.overall.errors.push({
                query_id: item.id,
                error: error.message,
                timestamp: new Date().toISOString()
            });
            
            throw error;
        }
    }
    
    /**
     * Aggregate metrics across all queries
     */
    aggregateMetrics(results) {
        const successfulResults = results.filter(r => r.success);
        
        if (successfulResults.length === 0) {
            return { error: 'No successful evaluations' };
        }
        
        const aggregated = {
            summary: {
                total_queries: results.length,
                successful_queries: successfulResults.length,
                success_rate: successfulResults.length / results.length,
                avg_query_time_ms: _.mean(successfulResults.map(r => r.query_time_ms)),
                median_query_time_ms: this.median(successfulResults.map(r => r.query_time_ms))
            },
            retrieval: {
                avg_precision_at_k: _.mean(successfulResults.map(r => r.retrieval_metrics.precision_at_k)),
                avg_recall_at_k: _.mean(successfulResults.map(r => r.retrieval_metrics.recall_at_k)),
                avg_mrr: _.mean(successfulResults.map(r => r.retrieval_metrics.mrr)),
                avg_ndcg: _.mean(successfulResults.map(r => r.retrieval_metrics.ndcg))
            },
            generation: {
                avg_faithfulness: _.mean(successfulResults.map(r => r.generation_metrics.faithfulness)),
                avg_relevance: _.mean(successfulResults.map(r => r.generation_metrics.relevance)),
                avg_coherence: _.mean(successfulResults.map(r => r.generation_metrics.coherence)),
                avg_fluency: _.mean(successfulResults.map(r => r.generation_metrics.fluency))
            },
            by_category: {}
        };
        
        // Group by category
        const categories = _.groupBy(successfulResults, 'category');
        for (const [category, categoryResults] of Object.entries(categories)) {
            aggregated.by_category[category] = {
                count: categoryResults.length,
                avg_precision: _.mean(categoryResults.map(r => r.retrieval_metrics.precision_at_k)),
                avg_relevance: _.mean(categoryResults.map(r => r.generation_metrics.relevance)),
                avg_query_time_ms: _.mean(categoryResults.map(r => r.query_time_ms))
            };
        }
        
        return aggregated;
    }
    
    /**
     * Generate evaluation report
     */
    async generateReport(results, metrics) {
        const reportData = {
            meta: {
                timestamp: new Date().toISOString(),
                evaluation_config: this.config,
                total_queries: results.length,
                successful_queries: results.filter(r => r.success).length
            },
            summary: metrics.summary,
            retrieval_metrics: metrics.retrieval,
            generation_metrics: metrics.generation,
            category_breakdown: metrics.by_category,
            detailed_results: results
        };
        
        // Save JSON report
        const filename = `rag_evaluation_${format(new Date(), 'yyyy-MM-dd_HH-mm-ss')}.json`;
        await writeFile(`${this.config.outputDir}/${filename}`, JSON.stringify(reportData, null, 2));
        
        // Generate console report
        const consoleReport = this.generateConsoleReport(metrics);
        console.log(consoleReport);
        
        return {
            filename,
            data: reportData,
            console_report: consoleReport
        };
    }
    
    /**
     * Generate formatted console report
     */
    generateConsoleReport(metrics) {
        const sections = [
            [
                [chalk.bold('RAG EVALUATION REPORT'), ''],
                [chalk.gray('Generated'), new Date().toISOString()],
                ['', '']
            ],
            [
                [chalk.bold.blue('📊 SUMMARY'), ''],
                ['Total Queries', metrics.summary.total_queries.toString()],
                ['Success Rate', `${(metrics.summary.success_rate * 100).toFixed(1)}%`],
                ['Avg Response Time', `${metrics.summary.avg_query_time_ms.toFixed(0)}ms`],
                ['', '']
            ],
            [
                [chalk.bold.green('🔍 RETRIEVAL METRICS'), ''],
                ['Precision@K', metrics.retrieval.avg_precision_at_k.toFixed(3)],
                ['Recall@K', metrics.retrieval.avg_recall_at_k.toFixed(3)],
                ['Mean Reciprocal Rank', metrics.retrieval.avg_mrr.toFixed(3)],
                ['NDCG@K', metrics.retrieval.avg_ndcg.toFixed(3)],
                ['', '']
            ],
            [
                [chalk.bold.yellow('✍️ GENERATION METRICS'), ''],
                ['Faithfulness', `${metrics.generation.avg_faithfulness.toFixed(1)}/5`],
                ['Relevance', `${metrics.generation.avg_relevance.toFixed(1)}/5`],
                ['Coherence', `${metrics.generation.avg_coherence.toFixed(1)}/5`],
                ['Fluency', `${metrics.generation.avg_fluency.toFixed(1)}/5`],
                ['', '']
            ]
        ];
        
        // Add category breakdown if available
        if (Object.keys(metrics.by_category).length > 0) {
            sections.push([
                [chalk.bold.magenta('📋 BY CATEGORY'), ''],
                ...Object.entries(metrics.by_category).map(([category, stats]) => [
                    category.toUpperCase(),
                    `P:${stats.avg_precision.toFixed(2)} R:${stats.avg_relevance.toFixed(1)} T:${stats.avg_query_time_ms.toFixed(0)}ms (${stats.count})`
                ]),
                ['', '']
            ]);
        }
        
        return sections.map(section => table(section, {
            border: {
                topBody: '',
                topJoin: '',
                topLeft: '',
                topRight: '',
                bottomBody: '',
                bottomJoin: '',
                bottomLeft: '',
                bottomRight: '',
                bodyLeft: '',
                bodyRight: '',
                bodyJoin: '',
                joinBody: '',
                joinLeft: '',
                joinRight: '',
                joinJoin: ''
            },
            columnDefault: {
                paddingLeft: 0,
                paddingRight: 2
            }
        })).join('\n');
    }
    
    /**
     * Calculate median
     */
    median(numbers) {
        const sorted = [...numbers].sort((a, b) => a - b);
        const mid = Math.floor(sorted.length / 2);
        return sorted.length % 2 === 0 
            ? (sorted[mid - 1] + sorted[mid]) / 2 
            : sorted[mid];
    }
}

export default RAGEvaluationHarness;
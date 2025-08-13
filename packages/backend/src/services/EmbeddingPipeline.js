/**
 * Advanced Embedding Pipeline Service
 * Handles asynchronous embedding generation with job queue and processing
 */

import OpenAI from 'openai';
import pkg from 'pg';
import { EventEmitter } from 'events';

const { Pool } = pkg;

class EmbeddingPipeline extends EventEmitter {
    constructor() {
        super();
        
        this.pool = new Pool({
            user: process.env.POSTGRES_USER || 'robert',
            host: process.env.POSTGRES_HOST || 'localhost',
            database: process.env.POSTGRES_DB || 'dat-bitch-cartrita',
            password: process.env.POSTGRES_PASSWORD || 'punky1',
            port: process.env.POSTGRES_PORT || 5435,
        });

        this.openai = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY,
        });

        this.jobQueue = [];
        this.processing = false;
        this.concurrency = 3; // Process 3 embeddings concurrently
        this.retryCount = 3;
        this.retryDelay = 1000; // 1 second

        this.stats = {
            processed: 0,
            failed: 0,
            queued: 0,
            totalProcessingTime: 0,
            avgProcessingTime: 0
        };

        console.log('[EmbeddingPipeline] 🔄 Embedding Pipeline Service initialized');
        this.startProcessing();
    }

    /**
     * Add embedding job to queue
     */
    async queueEmbedding(entryId, text, type = 'content') {
        const job = {
            id: `${entryId}_${type}_${Date.now()}`,
            entryId,
            text: text.substring(0, 8000), // Limit input length
            type, // 'content' or 'title'
            attempts: 0,
            createdAt: new Date(),
            priority: type === 'title' ? 2 : 1 // Prioritize title embeddings
        };

        this.jobQueue.push(job);
        this.stats.queued++;
        
        console.log(`[EmbeddingPipeline] ➕ Queued ${type} embedding for entry ${entryId}`);
        
        // Emit event for monitoring
        this.emit('job-queued', job);
        
        // Start processing if not already running
        if (!this.processing) {
            this.startProcessing();
        }

        return job.id;
    }

    /**
     * Start processing the embedding queue
     */
    async startProcessing() {
        if (this.processing || this.jobQueue.length === 0) {
            return;
        }

        this.processing = true;
        console.log(`[EmbeddingPipeline] 🚀 Starting to process ${this.jobQueue.length} queued jobs`);

        try {
            // Sort by priority (higher first) then by creation time
            this.jobQueue.sort((a, b) => {
                if (b.priority !== a.priority) {
                    return b.priority - a.priority;
                }
                return a.createdAt - b.createdAt;
            });

            // Process jobs with concurrency control
            const processingPromises = [];
            
            while (this.jobQueue.length > 0 && processingPromises.length < this.concurrency) {
                const job = this.jobQueue.shift();
                this.stats.queued--;
                
                const promise = this.processJob(job);
                processingPromises.push(promise);
            }

            if (processingPromises.length > 0) {
                await Promise.allSettled(processingPromises);
                
                // Continue processing if more jobs were added
                if (this.jobQueue.length > 0) {
                    setImmediate(() => this.startProcessing());
                }
            }

        } catch (error) {
            console.error('[EmbeddingPipeline] ❌ Processing error:', error);
        } finally {
            this.processing = this.jobQueue.length > 0;
        }
    }

    /**
     * Process a single embedding job
     */
    async processJob(job) {
        const startTime = Date.now();
        job.attempts++;

        try {
            console.log(`[EmbeddingPipeline] 🔄 Processing ${job.type} embedding for entry ${job.entryId} (attempt ${job.attempts})`);

            // Generate embedding
            const embedding = await this.generateEmbedding(job.text);
            
            // Update database
            await this.updateEntryEmbedding(job.entryId, job.type, embedding);

            const processingTime = Date.now() - startTime;
            this.stats.processed++;
            this.stats.totalProcessingTime += processingTime;
            this.stats.avgProcessingTime = this.stats.totalProcessingTime / this.stats.processed;

            console.log(`[EmbeddingPipeline] ✅ Completed ${job.type} embedding for entry ${job.entryId} in ${processingTime}ms`);
            
            // Emit success event
            this.emit('job-completed', {
                ...job,
                processingTime,
                embedding: embedding.slice(0, 5) + '...' // First 5 dimensions for logging
            });

            // Trigger relationship discovery after content embedding
            if (job.type === 'content') {
                setImmediate(() => this.discoverRelationships(job.entryId, embedding));
            }

        } catch (error) {
            console.error(`[EmbeddingPipeline] ❌ Error processing ${job.type} embedding for entry ${job.entryId}:`, error);
            
            // Retry logic
            if (job.attempts < this.retryCount) {
                console.log(`[EmbeddingPipeline] 🔄 Retrying job ${job.id} in ${this.retryDelay}ms`);
                
                setTimeout(() => {
                    this.jobQueue.unshift(job); // Add back to front of queue
                    this.stats.queued++;
                    this.startProcessing();
                }, this.retryDelay * job.attempts); // Exponential backoff
                
            } else {
                this.stats.failed++;
                console.error(`[EmbeddingPipeline] ❌ Job ${job.id} failed after ${job.attempts} attempts`);
                
                // Emit failure event
                this.emit('job-failed', { ...job, error: error.message });
            }
        }
    }

    /**
     * Generate embedding using OpenAI
     */
    async generateEmbedding(text) {
        try {
            const response = await this.openai.embeddings.create({
                model: 'text-embedding-3-large', // Using 3-large for 3072 dimensions to match schema
                input: text,
            });
            
            return response.data[0].embedding;
            
        } catch (error) {
            // Handle rate limiting
            if (error.status === 429) {
                console.warn('[EmbeddingPipeline] ⚠️ Rate limited, waiting before retry...');
                await new Promise(resolve => setTimeout(resolve, 2000));
                throw new Error('Rate limited, will retry');
            }
            
            console.error('[EmbeddingPipeline] ❌ OpenAI API error:', error);
            throw error;
        }
    }

    /**
     * Update entry with generated embedding
     */
    async updateEntryEmbedding(entryId, type, embedding) {
        const column = type === 'title' ? 'title_embedding' : 'content_embedding';
        const embeddingVector = `[${embedding.join(',')}]`;
        
        const query = `
            UPDATE knowledge_entries 
            SET ${column} = $1::vector, updated_at = NOW()
            WHERE id = $2
        `;
        
        await this.pool.query(query, [embeddingVector, entryId]);
        console.log(`[EmbeddingPipeline] 💾 Updated ${column} for entry ${entryId}`);
    }

    /**
     * Discover relationships using semantic similarity
     */
    async discoverRelationships(entryId, embedding) {
        try {
            console.log(`[EmbeddingPipeline] 🕸️ Discovering relationships for entry ${entryId}`);
            
            // Find similar entries using cosine similarity
            const embeddingVector = `[${embedding.join(',')}]`;
            const similarityQuery = `
                SELECT 
                    id,
                    title,
                    1 - (content_embedding <=> $1::vector) as similarity
                FROM knowledge_entries 
                WHERE id != $2 
                    AND content_embedding IS NOT NULL
                    AND 1 - (content_embedding <=> $1::vector) >= 0.75
                ORDER BY content_embedding <=> $1::vector
                LIMIT 5
            `;

            const result = await this.pool.query(similarityQuery, [embeddingVector, entryId]);
            const relationships = [];

            for (const similar of result.rows) {
                const relationshipType = similar.similarity > 0.9 ? 'very_similar' : 
                                       similar.similarity > 0.85 ? 'similar_to' : 'related_to';
                
                // Insert bidirectional relationship
                const insertQuery = `
                    INSERT INTO knowledge_relationships (
                        source_entry_id, target_entry_id, relationship_type, 
                        strength, confidence, semantic_similarity, 
                        discovery_method, discovered_by
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                    ON CONFLICT (source_entry_id, target_entry_id) DO UPDATE SET
                        semantic_similarity = EXCLUDED.semantic_similarity,
                        updated_at = NOW()
                `;

                await this.pool.query(insertQuery, [
                    entryId, similar.id, relationshipType,
                    similar.similarity, 0.9, similar.similarity,
                    'embedding_similarity', 'algorithm'
                ]);

                relationships.push({
                    target: similar.id,
                    type: relationshipType,
                    similarity: similar.similarity
                });
            }

            console.log(`[EmbeddingPipeline] ✅ Discovered ${relationships.length} relationships for entry ${entryId}`);
            
            // Emit relationship discovery event
            this.emit('relationships-discovered', { entryId, relationships });

        } catch (error) {
            console.error(`[EmbeddingPipeline] ❌ Relationship discovery error for entry ${entryId}:`, error);
        }
    }

    /**
     * Process all entries missing embeddings
     */
    async processAllMissingEmbeddings() {
        try {
            console.log('[EmbeddingPipeline] 🔍 Finding entries missing embeddings...');
            
            const query = `
                SELECT id, title, content 
                FROM knowledge_entries 
                WHERE content_embedding IS NULL OR title_embedding IS NULL
                ORDER BY importance_score DESC, created_at DESC
            `;
            
            const result = await this.pool.query(query);
            
            console.log(`[EmbeddingPipeline] 📋 Found ${result.rows.length} entries needing embeddings`);
            
            for (const entry of result.rows) {
                if (!entry.content_embedding) {
                    await this.queueEmbedding(entry.id, entry.content, 'content');
                }
                if (!entry.title_embedding) {
                    await this.queueEmbedding(entry.id, entry.title, 'title');
                }
            }
            
        } catch (error) {
            console.error('[EmbeddingPipeline] ❌ Error processing missing embeddings:', error);
        }
    }

    /**
     * Get pipeline statistics
     */
    getStats() {
        return {
            ...this.stats,
            queueLength: this.jobQueue.length,
            processing: this.processing,
            concurrency: this.concurrency,
            uptime: process.uptime()
        };
    }

    /**
     * Clear queue and reset stats
     */
    reset() {
        this.jobQueue = [];
        this.processing = false;
        this.stats = {
            processed: 0,
            failed: 0,
            queued: 0,
            totalProcessingTime: 0,
            avgProcessingTime: 0
        };
        console.log('[EmbeddingPipeline] 🔄 Pipeline reset');
    }
}

export default new EmbeddingPipeline();
/**
 * ML Model Registry Service
 * 
 * Comprehensive model lifecycle management with versioning, metadata, and artifact storage.
 * Provides centralized registry for ML models with advanced search, comparison, and approval workflows.
 */

import { promises as fs } from 'fs';
import path from 'path';
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { EventEmitter } from 'events';
import OpenTelemetryTracing from '../system/OpenTelemetryTracing.js';

class MLModelRegistry {
    constructor(db, config = {}) {
        this.db = db;
        this.config = {
            artifactStoragePath: config.artifactStoragePath || './ml-artifacts',
            maxArtifactSize: config.maxArtifactSize || 1024 * 1024 * 1024, // 1GB
            supportedFrameworks: config.supportedFrameworks || [
                'tensorflow', 'pytorch', 'sklearn', 'xgboost', 'lightgbm',
                'catboost', 'huggingface', 'onnx', 'keras', 'fastai'
            ],
            supportedModelTypes: config.supportedModelTypes || [
                'classification', 'regression', 'clustering', 'nlp',
                'computer_vision', 'recommendation', 'time_series', 'reinforcement_learning'
            ],
            approvalRequired: config.approvalRequired || false,
            enableVersioning: config.enableVersioning !== false,
            enableLineageTracking: config.enableLineageTracking !== false,
            ...config
        };

        this.tracer = OpenTelemetryTracing.getTracer('ml-model-registry');
        this.initialized = false;
        this.isRunning = false;

        // Model validation rules
        this.modelValidationRules = {
            name: {
                required: true,
                minLength: 3,
                maxLength: 255,
                pattern: /^[a-zA-Z0-9_-]+$/
            },
            version: {
                required: true,
                pattern: /^(\d+\.)?(\d+\.)?(\*|\d+)(-[a-zA-Z0-9_-]+)?$/ // semver pattern
            },
            framework: {
                required: true,
                enum: this.config.supportedFrameworks
            },
            model_type: {
                required: true,
                enum: this.config.supportedModelTypes
            }
        };

        // Storage and caching
        this.modelCache = new Map();
        this.artifactCache = new Map();
        this.performanceMetrics = new Map();

        // Events
        this.events = new EventEmitter();
    }

    /**
     * Initialize the ML Model Registry service
     */
    async initialize() {
        const span = this.tracer.startSpan('ml_model_registry_initialize');

        try {
            console.log('Initializing ML Model Registry...');

            // Ensure artifact storage directory exists
            await this.ensureStorageDirectory();

            // Load existing models into cache
            await this.loadExistingModels();

            // Initialize performance tracking
            await this.initializePerformanceTracking();

            this.initialized = true;
            this.isRunning = true;

            span.setAttributes({
                'ml.registry.initialized': true,
                'ml.registry.models_loaded': this.modelCache.size
            });

            console.log('ML Model Registry initialized successfully');
            this.events.emit('initialized', { timestamp: Date.now() });

        } catch (error) {
            span.recordException(error);
            span.setStatus({ code: 2, message: error.message });
            throw error;
        } finally {
            span.end();
        }
    }

    /**
     * Register a new model or version
     */
    async registerModel(modelData, options = {}) {
        const span = this.tracer.startSpan('ml_model_registry_register_model');

        try {
            if (!this.isRunning) {
                throw new Error('MLModelRegistry is not running');
            }

            // Validate model data
            this.validateModelData(modelData);

            const {
                skipDuplicateCheck = false,
                autoIncrementVersion = true,
                setAsPrimary = false
            } = options;

            const modelId = uuidv4();

            // Check for existing model with same name/version
            if (!skipDuplicateCheck) {
                const existing = await this.findModelByNameAndVersion(
                    modelData.name, 
                    modelData.version
                );
                
                if (existing) {
                    if (autoIncrementVersion) {
                        modelData.version = await this.generateNextVersion(modelData.name);
                    } else {
                        throw new Error(`Model ${modelData.name} version ${modelData.version} already exists`);
                    }
                }
            }

            const client = await this.db.connect();
            await client.query('BEGIN');

            try {
                // Insert model record
                const query = `
                    INSERT INTO ml_models (
                        id, name, version, description, framework, model_type,
                        algorithm, input_schema, output_schema, tags, metrics,
                        status, visibility, created_by
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
                    RETURNING *
                `;

                const values = [
                    modelId,
                    modelData.name,
                    modelData.version,
                    modelData.description || null,
                    modelData.framework,
                    modelData.model_type,
                    modelData.algorithm || null,
                    modelData.input_schema || {},
                    modelData.output_schema || {},
                    modelData.tags || [],
                    modelData.metrics || {},
                    modelData.status || 'draft',
                    modelData.visibility || 'private',
                    modelData.created_by || null
                ];

                const result = await client.query(query, values);
                const model = result.rows[0];

                // Create data lineage if specified
                if (options.parentModels && this.config.enableLineageTracking) {
                    for (const parentModelId of options.parentModels) {
                        await this.createDataLineage(parentModelId, model.id, 'derived_from');
                    }
                }

                await client.query('COMMIT');

                // Add to cache
                this.modelCache.set(model.id, model);

                // Update performance metrics
                this.updateRegistryMetrics();

                // Emit event
                this.events.emit('modelRegistered', {
                    model,
                    isNewVersion: !!existing,
                    timestamp: Date.now()
                });

                span.setAttributes({
                    'ml.model.id': model.id,
                    'ml.model.name': model.name,
                    'ml.model.version': model.version,
                    'ml.model.framework': model.framework
                });

                console.log(`Model registered: ${model.name} v${model.version} (${model.framework})`);
                return model;

            } catch (error) {
                await client.query('ROLLBACK');
                throw error;
            } finally {
                client.release();
            }

        } catch (error) {
            span.recordException(error);
            span.setStatus({ code: 2, message: error.message });
            throw error;
        } finally {
            span.end();
        }
    }

    /**
     * Upload and store model artifacts
     */
    async storeArtifact(modelId, artifactData, fileBuffer) {
        const span = this.tracer.startSpan('ml_model_registry_store_artifact');

        try {
            const model = await this.getModel(modelId);
            if (!model) {
                throw new Error(`Model not found: ${modelId}`);
            }

            // Validate artifact size
            if (fileBuffer && fileBuffer.length > this.config.maxArtifactSize) {
                throw new Error(`Artifact size exceeds maximum allowed size: ${this.config.maxArtifactSize}`);
            }

            const artifactId = uuidv4();
            const artifactPath = path.join(
                this.config.artifactStoragePath,
                model.name,
                model.version,
                `${artifactId}_${artifactData.name}`
            );

            // Ensure directory structure
            await fs.mkdir(path.dirname(artifactPath), { recursive: true });

            let checksum = null;
            let fileSize = 0;

            // Store file if buffer provided
            if (fileBuffer) {
                await fs.writeFile(artifactPath, fileBuffer);
                
                // Calculate checksum
                const hash = crypto.createHash('sha256');
                hash.update(fileBuffer);
                checksum = hash.digest('hex');
                fileSize = fileBuffer.length;
            }

            // Store artifact metadata in database
            const query = `
                INSERT INTO model_artifacts (
                    id, model_id, artifact_type, name, storage_path,
                    file_size, checksum, content_type, metadata, is_primary
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
                RETURNING *
            `;

            const values = [
                artifactId,
                modelId,
                artifactData.artifact_type,
                artifactData.name,
                artifactPath,
                fileSize,
                checksum,
                artifactData.content_type || 'application/octet-stream',
                artifactData.metadata || {},
                artifactData.is_primary || false
            ];

            const result = await this.db.query(query, values);
            const artifact = result.rows[0];

            // Update cache
            this.artifactCache.set(artifactId, artifact);

            // Update model status if this is the primary artifact
            if (artifactData.is_primary) {
                await this.updateModelStatus(modelId, 'ready');
            }

            span.setAttributes({
                'ml.artifact.id': artifactId,
                'ml.artifact.type': artifactData.artifact_type,
                'ml.artifact.size': fileSize
            });

            console.log(`Artifact stored: ${artifact.name} for model ${model.name}`);
            return artifact;

        } catch (error) {
            span.recordException(error);
            span.setStatus({ code: 2, message: error.message });
            throw error;
        } finally {
            span.end();
        }
    }

    /**
     * Get model by ID with optional artifact loading
     */
    async getModel(modelId, options = {}) {
        const {
            includeArtifacts = false,
            includeMetrics = false,
            includeLineage = false
        } = options;

        // Check cache first
        let model = this.modelCache.get(modelId);
        
        if (!model) {
            const result = await this.db.query(
                'SELECT * FROM ml_models WHERE id = $1',
                [modelId]
            );
            
            if (result.rows.length === 0) {
                return null;
            }
            
            model = result.rows[0];
            this.modelCache.set(modelId, model);
        }

        // Load additional data if requested
        if (includeArtifacts) {
            model.artifacts = await this.getModelArtifacts(modelId);
        }

        if (includeMetrics) {
            model.performance_metrics = await this.getModelPerformanceMetrics(modelId);
        }

        if (includeLineage && this.config.enableLineageTracking) {
            model.lineage = await this.getModelLineage(modelId);
        }

        return model;
    }

    /**
     * List models with advanced filtering and search
     */
    async listModels(filters = {}, options = {}) {
        const {
            name = null,
            framework = null,
            model_type = null,
            status = null,
            visibility = null,
            created_by = null,
            tags = null,
            search = null,
            sortBy = 'created_at',
            sortOrder = 'DESC',
            limit = 50,
            offset = 0,
            includeArtifacts = false
        } = filters;

        let whereConditions = [];
        let params = [];
        let paramIndex = 1;

        let query = `
            SELECT m.*,
                   COUNT(ma.id) as artifact_count,
                   MAX(ma.created_at) as last_artifact_update
            FROM ml_models m
            LEFT JOIN model_artifacts ma ON m.id = ma.model_id
        `;

        // Build where conditions
        if (name) {
            if (name.includes('*') || name.includes('%')) {
                whereConditions.push(`m.name ILIKE $${paramIndex++}`);
                params.push(name.replace('*', '%'));
            } else {
                whereConditions.push(`m.name = $${paramIndex++}`);
                params.push(name);
            }
        }

        if (framework) {
            whereConditions.push(`m.framework = $${paramIndex++}`);
            params.push(framework);
        }

        if (model_type) {
            whereConditions.push(`m.model_type = $${paramIndex++}`);
            params.push(model_type);
        }

        if (status) {
            if (Array.isArray(status)) {
                whereConditions.push(`m.status = ANY($${paramIndex++})`);
                params.push(status);
            } else {
                whereConditions.push(`m.status = $${paramIndex++}`);
                params.push(status);
            }
        }

        if (visibility) {
            whereConditions.push(`m.visibility = $${paramIndex++}`);
            params.push(visibility);
        }

        if (created_by) {
            whereConditions.push(`m.created_by = $${paramIndex++}`);
            params.push(created_by);
        }

        if (tags && tags.length > 0) {
            whereConditions.push(`m.tags ?| $${paramIndex++}`);
            params.push(tags);
        }

        if (search) {
            whereConditions.push(`
                (m.name ILIKE $${paramIndex} OR 
                 m.description ILIKE $${paramIndex} OR 
                 m.algorithm ILIKE $${paramIndex})
            `);
            params.push(`%${search}%`);
            paramIndex++;
        }

        if (whereConditions.length > 0) {
            query += ` WHERE ${whereConditions.join(' AND ')}`;
        }

        query += ` GROUP BY m.id`;

        // Add sorting
        const allowedSortFields = ['created_at', 'updated_at', 'name', 'version', 'framework'];
        if (allowedSortFields.includes(sortBy)) {
            query += ` ORDER BY m.${sortBy} ${sortOrder.toUpperCase()}`;
        }

        // Add pagination
        query += ` LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
        params.push(limit, offset);

        const result = await this.db.query(query, params);
        let models = result.rows;

        // Include artifacts if requested
        if (includeArtifacts) {
            for (const model of models) {
                model.artifacts = await this.getModelArtifacts(model.id);
            }
        }

        return models;
    }

    /**
     * Update model metadata
     */
    async updateModel(modelId, updates) {
        const span = this.tracer.startSpan('ml_model_registry_update_model');

        try {
            const model = await this.getModel(modelId);
            if (!model) {
                throw new Error(`Model not found: ${modelId}`);
            }

            const allowedFields = [
                'description', 'tags', 'metrics', 'status', 'visibility',
                'input_schema', 'output_schema', 'algorithm'
            ];

            const updateFields = [];
            const values = [modelId];
            let paramIndex = 2;

            for (const field of allowedFields) {
                if (updates[field] !== undefined) {
                    updateFields.push(`${field} = $${paramIndex++}`);
                    values.push(updates[field]);
                }
            }

            if (updateFields.length === 0) {
                throw new Error('No valid fields to update');
            }

            updateFields.push(`updated_at = NOW()`);

            const query = `
                UPDATE ml_models 
                SET ${updateFields.join(', ')}
                WHERE id = $1
                RETURNING *
            `;

            const result = await this.db.query(query, values);
            const updatedModel = result.rows[0];

            // Update cache
            this.modelCache.set(modelId, updatedModel);

            // Emit event
            this.events.emit('modelUpdated', {
                model: updatedModel,
                changes: Object.keys(updates),
                timestamp: Date.now()
            });

            span.setAttributes({
                'ml.model.id': modelId,
                'ml.model.updates': Object.keys(updates).length
            });

            return updatedModel;

        } catch (error) {
            span.recordException(error);
            span.setStatus({ code: 2, message: error.message });
            throw error;
        } finally {
            span.end();
        }
    }

    /**
     * Delete model and associated artifacts
     */
    async deleteModel(modelId, options = {}) {
        const span = this.tracer.startSpan('ml_model_registry_delete_model');

        try {
            const { softDelete = true, deleteArtifacts = false } = options;

            const model = await this.getModel(modelId);
            if (!model) {
                throw new Error(`Model not found: ${modelId}`);
            }

            if (softDelete) {
                // Soft delete - mark as archived
                await this.updateModelStatus(modelId, 'archived');
                
                span.setAttributes({
                    'ml.model.id': modelId,
                    'ml.model.delete_type': 'soft'
                });

            } else {
                const client = await this.db.connect();
                await client.query('BEGIN');

                try {
                    // Delete artifacts if requested
                    if (deleteArtifacts) {
                        const artifacts = await this.getModelArtifacts(modelId);
                        for (const artifact of artifacts) {
                            try {
                                await fs.unlink(artifact.storage_path);
                            } catch (error) {
                                console.warn(`Failed to delete artifact file: ${artifact.storage_path}`);
                            }
                        }
                    }

                    // Delete from database (cascading deletes will handle related records)
                    await client.query('DELETE FROM ml_models WHERE id = $1', [modelId]);
                    
                    await client.query('COMMIT');

                    span.setAttributes({
                        'ml.model.id': modelId,
                        'ml.model.delete_type': 'hard',
                        'ml.model.artifacts_deleted': deleteArtifacts
                    });

                } catch (error) {
                    await client.query('ROLLBACK');
                    throw error;
                } finally {
                    client.release();
                }
            }

            // Remove from cache
            this.modelCache.delete(modelId);

            // Emit event
            this.events.emit('modelDeleted', {
                modelId,
                modelName: model.name,
                deleteType: softDelete ? 'soft' : 'hard',
                timestamp: Date.now()
            });

            console.log(`Model ${softDelete ? 'archived' : 'deleted'}: ${model.name}`);

        } catch (error) {
            span.recordException(error);
            span.setStatus({ code: 2, message: error.message });
            throw error;
        } finally {
            span.end();
        }
    }

    /**
     * Compare models across versions or different models
     */
    async compareModels(modelIds, comparisonMetrics = []) {
        const models = [];
        for (const modelId of modelIds) {
            const model = await this.getModel(modelId, { 
                includeMetrics: true,
                includeArtifacts: true 
            });
            if (model) {
                models.push(model);
            }
        }

        if (models.length < 2) {
            throw new Error('At least 2 models are required for comparison');
        }

        const comparison = {
            models: models.map(m => ({
                id: m.id,
                name: m.name,
                version: m.version,
                framework: m.framework,
                model_type: m.model_type,
                created_at: m.created_at
            })),
            metrics_comparison: {},
            schema_compatibility: {},
            artifact_summary: {}
        };

        // Compare metrics
        const allMetrics = new Set();
        models.forEach(model => {
            if (model.metrics) {
                Object.keys(model.metrics).forEach(metric => allMetrics.add(metric));
            }
        });

        for (const metric of allMetrics) {
            comparison.metrics_comparison[metric] = models.map(model => ({
                model_id: model.id,
                value: model.metrics?.[metric] || null
            }));
        }

        // Compare schemas for compatibility
        comparison.schema_compatibility = this.analyzeSchemaCompatibility(models);

        // Summarize artifacts
        for (const model of models) {
            comparison.artifact_summary[model.id] = {
                total_artifacts: model.artifacts?.length || 0,
                primary_artifact: model.artifacts?.find(a => a.is_primary)?.artifact_type || null,
                total_size: model.artifacts?.reduce((sum, a) => sum + (a.file_size || 0), 0) || 0
            };
        }

        return comparison;
    }

    /**
     * Search models using advanced text search
     */
    async searchModels(searchQuery, options = {}) {
        const {
            includeContent = false,
            includeMetadata = true,
            limit = 20
        } = options;

        // For now, use basic ILIKE search
        // In production, this could be enhanced with full-text search, embeddings, etc.
        const query = `
            SELECT m.*, 
                   COUNT(ma.id) as artifact_count,
                   ts_rank(
                       to_tsvector('english', m.name || ' ' || COALESCE(m.description, '') || ' ' || COALESCE(m.algorithm, '')),
                       plainto_tsquery('english', $1)
                   ) as relevance_score
            FROM ml_models m
            LEFT JOIN model_artifacts ma ON m.id = ma.model_id
            WHERE to_tsvector('english', m.name || ' ' || COALESCE(m.description, '') || ' ' || COALESCE(m.algorithm, ''))
                  @@ plainto_tsquery('english', $1)
            GROUP BY m.id
            ORDER BY relevance_score DESC, m.created_at DESC
            LIMIT $2
        `;

        const result = await this.db.query(query, [searchQuery, limit]);
        return result.rows;
    }

    /**
     * Get model lineage (parent and child relationships)
     */
    async getModelLineage(modelId) {
        if (!this.config.enableLineageTracking) {
            return null;
        }

        // Get parent relationships
        const parentsQuery = `
            SELECT l.*, m.name as source_name, m.version as source_version
            FROM ml_data_lineage l
            JOIN ml_models m ON l.source_id = m.id
            WHERE l.target_id = $1 AND l.target_type = 'model'
        `;

        // Get child relationships
        const childrenQuery = `
            SELECT l.*, m.name as target_name, m.version as target_version
            FROM ml_data_lineage l
            JOIN ml_models m ON l.target_id = m.id
            WHERE l.source_id = $1 AND l.source_type = 'model'
        `;

        const [parentResults, childResults] = await Promise.all([
            this.db.query(parentsQuery, [modelId]),
            this.db.query(childrenQuery, [modelId])
        ]);

        return {
            parents: parentResults.rows,
            children: childResults.rows
        };
    }

    /**
     * Helper Methods
     */

    async ensureStorageDirectory() {
        try {
            await fs.mkdir(this.config.artifactStoragePath, { recursive: true });
        } catch (error) {
            throw new Error(`Failed to create artifact storage directory: ${error.message}`);
        }
    }

    async loadExistingModels() {
        const result = await this.db.query(`
            SELECT * FROM ml_models 
            WHERE status != 'archived'
            ORDER BY created_at DESC
            LIMIT 1000
        `);

        for (const model of result.rows) {
            this.modelCache.set(model.id, model);
        }

        console.log(`Loaded ${result.rows.length} existing models into cache`);
    }

    validateModelData(data) {
        const errors = [];

        for (const [field, rules] of Object.entries(this.modelValidationRules)) {
            const value = data[field];

            if (rules.required && (value === undefined || value === null || value === '')) {
                errors.push(`${field} is required`);
                continue;
            }

            if (value !== undefined && value !== null) {
                if (rules.minLength && value.length < rules.minLength) {
                    errors.push(`${field} must be at least ${rules.minLength} characters`);
                }

                if (rules.maxLength && value.length > rules.maxLength) {
                    errors.push(`${field} must be no more than ${rules.maxLength} characters`);
                }

                if (rules.pattern && !rules.pattern.test(value)) {
                    errors.push(`${field} format is invalid`);
                }

                if (rules.enum && !rules.enum.includes(value)) {
                    errors.push(`${field} must be one of: ${rules.enum.join(', ')}`);
                }
            }
        }

        if (errors.length > 0) {
            throw new Error(`Validation failed: ${errors.join(', ')}`);
        }
    }

    async findModelByNameAndVersion(name, version) {
        const result = await this.db.query(
            'SELECT * FROM ml_models WHERE name = $1 AND version = $2',
            [name, version]
        );

        return result.rows[0] || null;
    }

    async generateNextVersion(modelName) {
        const result = await this.db.query(`
            SELECT version FROM ml_models 
            WHERE name = $1 
            ORDER BY created_at DESC 
            LIMIT 1
        `, [modelName]);

        if (result.rows.length === 0) {
            return '1.0.0';
        }

        const lastVersion = result.rows[0].version;
        const versionParts = lastVersion.split('.');
        
        if (versionParts.length >= 3) {
            const patch = parseInt(versionParts[2]) + 1;
            return `${versionParts[0]}.${versionParts[1]}.${patch}`;
        }

        // Fallback for non-semantic versions
        return `${lastVersion}.1`;
    }

    async getModelArtifacts(modelId) {
        const result = await this.db.query(
            'SELECT * FROM model_artifacts WHERE model_id = $1 ORDER BY is_primary DESC, created_at DESC',
            [modelId]
        );

        return result.rows;
    }

    async updateModelStatus(modelId, newStatus) {
        await this.db.query(
            'UPDATE ml_models SET status = $2, updated_at = NOW() WHERE id = $1',
            [modelId, newStatus]
        );

        // Update cache
        const cachedModel = this.modelCache.get(modelId);
        if (cachedModel) {
            cachedModel.status = newStatus;
            cachedModel.updated_at = new Date().toISOString();
        }
    }

    async createDataLineage(sourceId, targetId, relationshipType) {
        await this.db.query(`
            INSERT INTO ml_data_lineage (
                source_type, source_id, target_type, target_id, relationship_type
            ) VALUES ($1, $2, $3, $4, $5)
        `, ['model', sourceId, 'model', targetId, relationshipType]);
    }

    analyzeSchemaCompatibility(models) {
        const compatibility = {
            input_schema_compatible: true,
            output_schema_compatible: true,
            compatibility_issues: []
        };

        if (models.length < 2) return compatibility;

        const baseModel = models[0];
        
        for (let i = 1; i < models.length; i++) {
            const compareModel = models[i];

            // Compare input schemas
            if (!this.deepEqual(baseModel.input_schema, compareModel.input_schema)) {
                compatibility.input_schema_compatible = false;
                compatibility.compatibility_issues.push({
                    type: 'input_schema_mismatch',
                    models: [baseModel.id, compareModel.id]
                });
            }

            // Compare output schemas
            if (!this.deepEqual(baseModel.output_schema, compareModel.output_schema)) {
                compatibility.output_schema_compatible = false;
                compatibility.compatibility_issues.push({
                    type: 'output_schema_mismatch',
                    models: [baseModel.id, compareModel.id]
                });
            }
        }

        return compatibility;
    }

    deepEqual(obj1, obj2) {
        return JSON.stringify(obj1) === JSON.stringify(obj2);
    }

    async initializePerformanceTracking() {
        // Initialize metrics tracking
        this.performanceMetrics.set('total_models', 0);
        this.performanceMetrics.set('total_artifacts', 0);
        this.performanceMetrics.set('storage_used', 0);
        
        await this.updateRegistryMetrics();
    }

    async updateRegistryMetrics() {
        try {
            const modelCount = await this.db.query('SELECT COUNT(*) FROM ml_models WHERE status != \'archived\'');
            const artifactCount = await this.db.query('SELECT COUNT(*), SUM(file_size) FROM model_artifacts');
            
            this.performanceMetrics.set('total_models', parseInt(modelCount.rows[0].count));
            this.performanceMetrics.set('total_artifacts', parseInt(artifactCount.rows[0].count || 0));
            this.performanceMetrics.set('storage_used', parseInt(artifactCount.rows[0].sum || 0));
        } catch (error) {
            console.error('Failed to update registry metrics:', error.message);
        }
    }

    async getModelPerformanceMetrics(modelId) {
        // This would integrate with the model serving platform to get live metrics
        return {
            inference_count: 0,
            average_latency: 0,
            error_rate: 0,
            last_prediction: null
        };
    }

    /**
     * Get service statistics
     */
    getStatistics() {
        return {
            total_models: this.performanceMetrics.get('total_models') || 0,
            total_artifacts: this.performanceMetrics.get('total_artifacts') || 0,
            storage_used_bytes: this.performanceMetrics.get('storage_used') || 0,
            cached_models: this.modelCache.size,
            cached_artifacts: this.artifactCache.size,
            supported_frameworks: this.config.supportedFrameworks.length,
            supported_model_types: this.config.supportedModelTypes.length,
            config: {
                max_artifact_size: this.config.maxArtifactSize,
                approval_required: this.config.approvalRequired,
                versioning_enabled: this.config.enableVersioning,
                lineage_tracking_enabled: this.config.enableLineageTracking
            },
            runtime: {
                initialized: this.initialized,
                running: this.isRunning
            }
        };
    }

    /**
     * Stop the ML Model Registry service
     */
    async stop() {
        this.isRunning = false;

        // Clear caches
        this.modelCache.clear();
        this.artifactCache.clear();
        this.performanceMetrics.clear();

        this.events.emit('stopped', { timestamp: Date.now() });
        console.log('ML Model Registry service stopped');
    }
}

export default MLModelRegistry;

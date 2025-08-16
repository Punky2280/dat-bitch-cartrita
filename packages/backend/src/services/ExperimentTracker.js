/**
 * Experiment Tracker Service
 * 
 * Comprehensive experiment management and tracking system for ML workflows.
 * Manages experiments, runs, metrics, parameters, and provides comparison capabilities.
 */

import { v4 as uuidv4 } from 'uuid';
import { EventEmitter } from 'events';
import OpenTelemetryTracing from '../system/OpenTelemetryTracing.js';

class ExperimentTracker {
    constructor(db, config = {}) {
        this.db = db;
        this.config = {
            retentionDays: config.retentionDays || 365,
            maxExperiments: config.maxExperiments || 10000,
            maxRunsPerExperiment: config.maxRunsPerExperiment || 1000,
            enableAutoTags: config.enableAutoTags !== false,
            enableMetricsAggregation: config.enableMetricsAggregation !== false,
            metricsAggregationInterval: config.metricsAggregationInterval || 300000, // 5 minutes
            trackingLevel: config.trackingLevel || 'detailed', // minimal, basic, detailed, verbose
            ...config
        };

        this.tracer = OpenTelemetryTracing.getTracer('experiment-tracker');
        this.events = new EventEmitter();

        // Caching and state management
        this.experimentCache = new Map();
        this.activeRuns = new Map();
        this.metricsBuffer = new Map();
        
        // Performance tracking
        this.performanceMetrics = {
            totalExperiments: 0,
            totalRuns: 0,
            activeExperiments: 0,
            completedRuns: 0,
            failedRuns: 0
        };

        this.initialized = false;
        this.isRunning = false;

        // Background processes
        this.metricsAggregator = null;
        this.cleanupWorker = null;
    }

    /**
     * Initialize the Experiment Tracker
     */
    async initialize() {
        const span = this.tracer.startSpan('experiment_tracker_initialize');

        try {
            console.log('Initializing Experiment Tracker...');

            // Load existing experiments
            await this.loadExistingExperiments();

            // Start background processes
            if (this.config.enableMetricsAggregation) {
                this.startMetricsAggregation();
            }

            this.startCleanupWorker();
            
            // Initialize performance metrics
            await this.updatePerformanceMetrics();

            this.initialized = true;
            this.isRunning = true;

            span.setAttributes({
                'experiment.tracker.initialized': true,
                'experiment.tracker.experiments_loaded': this.experimentCache.size,
                'experiment.tracker.tracking_level': this.config.trackingLevel
            });

            console.log('Experiment Tracker initialized successfully');
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
     * Create a new experiment
     */
    async createExperiment(experimentData) {
        const span = this.tracer.startSpan('experiment_tracker_create_experiment');

        try {
            if (!this.isRunning) {
                throw new Error('ExperimentTracker is not running');
            }

            this.validateExperimentData(experimentData);

            const experimentId = experimentData.id || uuidv4();
            const experiment = {
                id: experimentId,
                name: experimentData.name,
                description: experimentData.description || null,
                project_id: experimentData.project_id || null,
                type: experimentData.type || 'general',
                status: 'active',
                config: experimentData.config || {},
                tags: experimentData.tags || [],
                created_by: experimentData.created_by || null,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
                metadata: experimentData.metadata || {}
            };

            // Auto-generate tags if enabled
            if (this.config.enableAutoTags) {
                experiment.tags = [...experiment.tags, ...this.generateAutoTags(experiment)];
            }

            // Store in database
            const insertQuery = `
                INSERT INTO training_experiments (
                    id, name, description, project_id, type, status,
                    config, tags, created_by, created_at, updated_at, metadata
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
                RETURNING *
            `;

            const values = [
                experiment.id, experiment.name, experiment.description,
                experiment.project_id, experiment.type, experiment.status,
                experiment.config, experiment.tags, experiment.created_by,
                experiment.created_at, experiment.updated_at, experiment.metadata
            ];

            const result = await this.db.query(insertQuery, values);
            const savedExperiment = result.rows[0];

            // Add to cache
            this.experimentCache.set(experimentId, savedExperiment);

            // Update performance metrics
            this.performanceMetrics.totalExperiments++;
            this.performanceMetrics.activeExperiments++;

            // Emit event
            this.events.emit('experimentCreated', {
                experiment: savedExperiment,
                timestamp: Date.now()
            });

            span.setAttributes({
                'experiment.id': experimentId,
                'experiment.name': experiment.name,
                'experiment.type': experiment.type
            });

            console.log(`Experiment created: ${experiment.name} (${experimentId})`);
            return savedExperiment;

        } catch (error) {
            span.recordException(error);
            span.setStatus({ code: 2, message: error.message });
            throw error;
        } finally {
            span.end();
        }
    }

    /**
     * Start an experiment run
     */
    async startRun(experimentId, runConfig = {}) {
        const span = this.tracer.startSpan('experiment_tracker_start_run');

        try {
            const experiment = await this.getExperiment(experimentId);
            if (!experiment) {
                throw new Error(`Experiment not found: ${experimentId}`);
            }

            const runId = uuidv4();
            const run = {
                id: runId,
                experiment_id: experimentId,
                name: runConfig.name || `run_${Date.now()}`,
                description: runConfig.description || null,
                status: 'running',
                parameters: runConfig.parameters || {},
                tags: runConfig.tags || [],
                source_version: runConfig.source_version || null,
                start_time: new Date().toISOString(),
                end_time: null,
                created_by: runConfig.created_by || null,
                metadata: runConfig.metadata || {}
            };

            // Store in database
            const insertQuery = `
                INSERT INTO experiment_runs (
                    id, experiment_id, name, description, status, parameters,
                    tags, source_version, start_time, created_by, metadata
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
                RETURNING *
            `;

            const values = [
                run.id, run.experiment_id, run.name, run.description,
                run.status, run.parameters, run.tags, run.source_version,
                run.start_time, run.created_by, run.metadata
            ];

            const result = await this.db.query(insertQuery, values);
            const savedRun = result.rows[0];

            // Add to active runs
            this.activeRuns.set(runId, {
                ...savedRun,
                metrics: new Map(),
                artifacts: new Map()
            });

            // Update performance metrics
            this.performanceMetrics.totalRuns++;

            // Emit event
            this.events.emit('runStarted', {
                run: savedRun,
                experiment,
                timestamp: Date.now()
            });

            span.setAttributes({
                'experiment.id': experimentId,
                'run.id': runId,
                'run.name': run.name
            });

            console.log(`Run started: ${run.name} (${runId}) in experiment ${experiment.name}`);
            return savedRun;

        } catch (error) {
            span.recordException(error);
            span.setStatus({ code: 2, message: error.message });
            throw error;
        } finally {
            span.end();
        }
    }

    /**
     * Log metrics for a run
     */
    async logMetrics(runId, metrics, step = null, timestamp = null) {
        const span = this.tracer.startSpan('experiment_tracker_log_metrics');

        try {
            const activeRun = this.activeRuns.get(runId);
            if (!activeRun) {
                throw new Error(`Active run not found: ${runId}`);
            }

            const metricTimestamp = timestamp || new Date().toISOString();
            const metricStep = step !== null ? step : this.getNextStep(runId);

            // Buffer metrics for efficient batch insertion
            if (!this.metricsBuffer.has(runId)) {
                this.metricsBuffer.set(runId, []);
            }

            const metricEntries = [];
            for (const [key, value] of Object.entries(metrics)) {
                metricEntries.push({
                    run_id: runId,
                    metric_name: key,
                    metric_value: value,
                    step: metricStep,
                    timestamp: metricTimestamp
                });

                // Update real-time metrics in active run
                if (!activeRun.metrics.has(key)) {
                    activeRun.metrics.set(key, []);
                }
                activeRun.metrics.get(key).push({ value, step: metricStep, timestamp: metricTimestamp });
            }

            this.metricsBuffer.get(runId).push(...metricEntries);

            // Flush buffer if it gets too large
            if (this.metricsBuffer.get(runId).length > 100) {
                await this.flushMetricsBuffer(runId);
            }

            span.setAttributes({
                'run.id': runId,
                'metrics.count': Object.keys(metrics).length,
                'metrics.step': metricStep
            });

            this.events.emit('metricsLogged', {
                runId,
                metrics,
                step: metricStep,
                timestamp: metricTimestamp
            });

        } catch (error) {
            span.recordException(error);
            span.setStatus({ code: 2, message: error.message });
            throw error;
        } finally {
            span.end();
        }
    }

    /**
     * Log parameters for a run
     */
    async logParameters(runId, parameters) {
        const span = this.tracer.startSpan('experiment_tracker_log_parameters');

        try {
            const activeRun = this.activeRuns.get(runId);
            if (!activeRun) {
                throw new Error(`Active run not found: ${runId}`);
            }

            // Update run parameters
            const updatedParameters = { ...activeRun.parameters, ...parameters };
            
            await this.db.query(
                'UPDATE experiment_runs SET parameters = $1, updated_at = NOW() WHERE id = $2',
                [updatedParameters, runId]
            );

            // Update cached run
            activeRun.parameters = updatedParameters;

            span.setAttributes({
                'run.id': runId,
                'parameters.count': Object.keys(parameters).length
            });

            this.events.emit('parametersLogged', {
                runId,
                parameters,
                timestamp: Date.now()
            });

        } catch (error) {
            span.recordException(error);
            span.setStatus({ code: 2, message: error.message });
            throw error;
        } finally {
            span.end();
        }
    }

    /**
     * Log artifacts for a run
     */
    async logArtifact(runId, artifactName, artifactPath, artifactType = 'file', metadata = {}) {
        const span = this.tracer.startSpan('experiment_tracker_log_artifact');

        try {
            const activeRun = this.activeRuns.get(runId);
            if (!activeRun) {
                throw new Error(`Active run not found: ${runId}`);
            }

            const artifactId = uuidv4();
            const artifact = {
                id: artifactId,
                run_id: runId,
                name: artifactName,
                path: artifactPath,
                type: artifactType,
                size: metadata.size || null,
                checksum: metadata.checksum || null,
                metadata: metadata,
                created_at: new Date().toISOString()
            };

            // Store in database
            const insertQuery = `
                INSERT INTO experiment_artifacts (
                    id, run_id, name, path, type, size, checksum, metadata, created_at
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                RETURNING *
            `;

            const values = [
                artifact.id, artifact.run_id, artifact.name, artifact.path,
                artifact.type, artifact.size, artifact.checksum,
                artifact.metadata, artifact.created_at
            ];

            const result = await this.db.query(insertQuery, values);
            const savedArtifact = result.rows[0];

            // Add to active run artifacts
            activeRun.artifacts.set(artifactName, savedArtifact);

            span.setAttributes({
                'run.id': runId,
                'artifact.name': artifactName,
                'artifact.type': artifactType
            });

            this.events.emit('artifactLogged', {
                runId,
                artifact: savedArtifact,
                timestamp: Date.now()
            });

            return savedArtifact;

        } catch (error) {
            span.recordException(error);
            span.setStatus({ code: 2, message: error.message });
            throw error;
        } finally {
            span.end();
        }
    }

    /**
     * End an experiment run
     */
    async endRun(runId, status = 'completed', finalMetrics = {}) {
        const span = this.tracer.startSpan('experiment_tracker_end_run');

        try {
            const activeRun = this.activeRuns.get(runId);
            if (!activeRun) {
                throw new Error(`Active run not found: ${runId}`);
            }

            // Flush any remaining metrics
            await this.flushMetricsBuffer(runId);

            // Log final metrics if provided
            if (Object.keys(finalMetrics).length > 0) {
                await this.logMetrics(runId, finalMetrics);
                await this.flushMetricsBuffer(runId);
            }

            // Update run status
            await this.db.query(`
                UPDATE experiment_runs 
                SET status = $1, end_time = NOW(), updated_at = NOW()
                WHERE id = $2
            `, [status, runId]);

            // Update performance metrics
            if (status === 'completed') {
                this.performanceMetrics.completedRuns++;
            } else if (status === 'failed') {
                this.performanceMetrics.failedRuns++;
            }

            // Remove from active runs
            const completedRun = this.activeRuns.get(runId);
            this.activeRuns.delete(runId);

            // Clean up metrics buffer
            this.metricsBuffer.delete(runId);

            span.setAttributes({
                'run.id': runId,
                'run.status': status,
                'final_metrics.count': Object.keys(finalMetrics).length
            });

            this.events.emit('runEnded', {
                runId,
                status,
                finalMetrics,
                duration: completedRun ? Date.now() - new Date(completedRun.start_time).getTime() : null,
                timestamp: Date.now()
            });

            console.log(`Run ended: ${runId} (status: ${status})`);

        } catch (error) {
            span.recordException(error);
            span.setStatus({ code: 2, message: error.message });
            throw error;
        } finally {
            span.end();
        }
    }

    /**
     * Get experiment details
     */
    async getExperiment(experimentId, includeRuns = false) {
        // Check cache first
        let experiment = this.experimentCache.get(experimentId);

        if (!experiment) {
            const result = await this.db.query(
                'SELECT * FROM training_experiments WHERE id = $1',
                [experimentId]
            );

            if (result.rows.length === 0) {
                return null;
            }

            experiment = result.rows[0];
            this.experimentCache.set(experimentId, experiment);
        }

        // Include runs if requested
        if (includeRuns) {
            const runsResult = await this.db.query(`
                SELECT er.*, 
                       COUNT(em.id) as metrics_count,
                       COUNT(ea.id) as artifacts_count
                FROM experiment_runs er
                LEFT JOIN experiment_metrics em ON er.id = em.run_id
                LEFT JOIN experiment_artifacts ea ON er.id = ea.run_id
                WHERE er.experiment_id = $1
                GROUP BY er.id
                ORDER BY er.start_time DESC
            `, [experimentId]);

            experiment.runs = runsResult.rows;
        }

        return experiment;
    }

    /**
     * Get run details with metrics and artifacts
     */
    async getRun(runId, includeMetrics = false, includeArtifacts = false) {
        // Check if run is active
        let run = this.activeRuns.get(runId);

        if (!run) {
            const result = await this.db.query(
                'SELECT * FROM experiment_runs WHERE id = $1',
                [runId]
            );

            if (result.rows.length === 0) {
                return null;
            }

            run = result.rows[0];
        }

        // Include metrics if requested
        if (includeMetrics) {
            if (this.activeRuns.has(runId)) {
                // Get real-time metrics for active runs
                const activeRun = this.activeRuns.get(runId);
                run.metrics = Object.fromEntries(activeRun.metrics);
            } else {
                // Get metrics from database for completed runs
                const metricsResult = await this.db.query(`
                    SELECT metric_name, 
                           array_agg(metric_value ORDER BY step) as values,
                           array_agg(step ORDER BY step) as steps,
                           array_agg(timestamp ORDER BY step) as timestamps
                    FROM experiment_metrics 
                    WHERE run_id = $1 
                    GROUP BY metric_name
                `, [runId]);

                run.metrics = {};
                for (const metric of metricsResult.rows) {
                    run.metrics[metric.metric_name] = {
                        values: metric.values,
                        steps: metric.steps,
                        timestamps: metric.timestamps
                    };
                }
            }
        }

        // Include artifacts if requested
        if (includeArtifacts) {
            if (this.activeRuns.has(runId)) {
                const activeRun = this.activeRuns.get(runId);
                run.artifacts = Object.fromEntries(activeRun.artifacts);
            } else {
                const artifactsResult = await this.db.query(
                    'SELECT * FROM experiment_artifacts WHERE run_id = $1 ORDER BY created_at',
                    [runId]
                );
                run.artifacts = artifactsResult.rows;
            }
        }

        return run;
    }

    /**
     * List experiments with filtering
     */
    async listExperiments(filters = {}) {
        const {
            project_id = null,
            type = null,
            status = null,
            created_by = null,
            tags = null,
            search = null,
            sortBy = 'created_at',
            sortOrder = 'DESC',
            limit = 50,
            offset = 0
        } = filters;

        let whereConditions = [];
        let params = [];
        let paramIndex = 1;

        let query = `
            SELECT e.*,
                   COUNT(er.id) as runs_count,
                   COUNT(CASE WHEN er.status = 'completed' THEN 1 END) as completed_runs,
                   COUNT(CASE WHEN er.status = 'failed' THEN 1 END) as failed_runs,
                   MAX(er.start_time) as last_run_time
            FROM training_experiments e
            LEFT JOIN experiment_runs er ON e.id = er.experiment_id
        `;

        // Build where conditions
        if (project_id) {
            whereConditions.push(`e.project_id = $${paramIndex++}`);
            params.push(project_id);
        }

        if (type) {
            whereConditions.push(`e.type = $${paramIndex++}`);
            params.push(type);
        }

        if (status) {
            whereConditions.push(`e.status = $${paramIndex++}`);
            params.push(status);
        }

        if (created_by) {
            whereConditions.push(`e.created_by = $${paramIndex++}`);
            params.push(created_by);
        }

        if (tags && tags.length > 0) {
            whereConditions.push(`e.tags ?| $${paramIndex++}`);
            params.push(tags);
        }

        if (search) {
            whereConditions.push(`
                (e.name ILIKE $${paramIndex} OR 
                 e.description ILIKE $${paramIndex})
            `);
            params.push(`%${search}%`);
            paramIndex++;
        }

        if (whereConditions.length > 0) {
            query += ` WHERE ${whereConditions.join(' AND ')}`;
        }

        query += ` GROUP BY e.id`;

        // Add sorting
        const allowedSortFields = ['created_at', 'updated_at', 'name', 'type'];
        if (allowedSortFields.includes(sortBy)) {
            query += ` ORDER BY e.${sortBy} ${sortOrder.toUpperCase()}`;
        }

        // Add pagination
        query += ` LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
        params.push(limit, offset);

        const result = await this.db.query(query, params);
        return result.rows;
    }

    /**
     * Compare multiple runs
     */
    async compareRuns(runIds, comparisonMetrics = []) {
        const runs = await Promise.all(
            runIds.map(runId => this.getRun(runId, true, false))
        );

        const validRuns = runs.filter(run => run !== null);
        if (validRuns.length < 2) {
            throw new Error('At least 2 valid runs are required for comparison');
        }

        const comparison = {
            runs: validRuns.map(run => ({
                id: run.id,
                name: run.name,
                experiment_id: run.experiment_id,
                status: run.status,
                start_time: run.start_time,
                end_time: run.end_time,
                parameters: run.parameters
            })),
            metrics_comparison: {},
            parameter_differences: this.findParameterDifferences(validRuns)
        };

        // Compare metrics
        const allMetrics = new Set();
        validRuns.forEach(run => {
            if (run.metrics) {
                Object.keys(run.metrics).forEach(metric => allMetrics.add(metric));
            }
        });

        for (const metric of allMetrics) {
            if (comparisonMetrics.length === 0 || comparisonMetrics.includes(metric)) {
                comparison.metrics_comparison[metric] = validRuns.map(run => {
                    const metricData = run.metrics?.[metric];
                    if (metricData && metricData.values) {
                        return {
                            run_id: run.id,
                            final_value: metricData.values[metricData.values.length - 1],
                            max_value: Math.max(...metricData.values),
                            min_value: Math.min(...metricData.values),
                            avg_value: metricData.values.reduce((a, b) => a + b, 0) / metricData.values.length
                        };
                    }
                    return {
                        run_id: run.id,
                        final_value: null,
                        max_value: null,
                        min_value: null,
                        avg_value: null
                    };
                });
            }
        }

        return comparison;
    }

    /**
     * Search experiments and runs
     */
    async search(searchQuery, options = {}) {
        const {
            searchType = 'all', // experiments, runs, all
            limit = 20,
            includeMetrics = false
        } = options;

        const results = {
            experiments: [],
            runs: []
        };

        if (searchType === 'experiments' || searchType === 'all') {
            const experimentsQuery = `
                SELECT e.*, COUNT(er.id) as runs_count
                FROM training_experiments e
                LEFT JOIN experiment_runs er ON e.id = er.experiment_id
                WHERE to_tsvector('english', e.name || ' ' || COALESCE(e.description, ''))
                      @@ plainto_tsquery('english', $1)
                GROUP BY e.id
                ORDER BY e.created_at DESC
                LIMIT $2
            `;

            const experimentsResult = await this.db.query(experimentsQuery, [searchQuery, limit]);
            results.experiments = experimentsResult.rows;
        }

        if (searchType === 'runs' || searchType === 'all') {
            let runsQuery = `
                SELECT er.*, e.name as experiment_name
                FROM experiment_runs er
                JOIN training_experiments e ON er.experiment_id = e.id
                WHERE to_tsvector('english', er.name || ' ' || COALESCE(er.description, ''))
                      @@ plainto_tsquery('english', $1)
                ORDER BY er.start_time DESC
                LIMIT $2
            `;

            const runsResult = await this.db.query(runsQuery, [searchQuery, limit]);
            results.runs = runsResult.rows;
        }

        return results;
    }

    /**
     * Helper Methods
     */

    validateExperimentData(data) {
        if (!data.name || data.name.trim() === '') {
            throw new Error('Experiment name is required');
        }

        if (data.name.length > 255) {
            throw new Error('Experiment name must be 255 characters or less');
        }
    }

    generateAutoTags(experiment) {
        const autoTags = [];
        
        // Add type-based tags
        if (experiment.type) {
            autoTags.push(`type:${experiment.type}`);
        }

        // Add date-based tags
        const now = new Date();
        autoTags.push(`year:${now.getFullYear()}`);
        autoTags.push(`month:${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`);

        // Add config-based tags
        if (experiment.config && typeof experiment.config === 'object') {
            Object.keys(experiment.config).forEach(key => {
                if (typeof experiment.config[key] === 'string') {
                    autoTags.push(`config:${key}:${experiment.config[key]}`);
                }
            });
        }

        return autoTags;
    }

    getNextStep(runId) {
        const activeRun = this.activeRuns.get(runId);
        if (!activeRun) return 0;

        let maxStep = -1;
        for (const metricHistory of activeRun.metrics.values()) {
            for (const entry of metricHistory) {
                if (entry.step > maxStep) {
                    maxStep = entry.step;
                }
            }
        }

        return maxStep + 1;
    }

    async flushMetricsBuffer(runId) {
        const buffer = this.metricsBuffer.get(runId);
        if (!buffer || buffer.length === 0) {
            return;
        }

        try {
            // Batch insert metrics
            const values = buffer.map((entry, index) => 
                `($${index * 5 + 1}, $${index * 5 + 2}, $${index * 5 + 3}, $${index * 5 + 4}, $${index * 5 + 5})`
            ).join(', ');

            const query = `
                INSERT INTO experiment_metrics (run_id, metric_name, metric_value, step, timestamp)
                VALUES ${values}
            `;

            const params = buffer.flatMap(entry => [
                entry.run_id, entry.metric_name, entry.metric_value, entry.step, entry.timestamp
            ]);

            await this.db.query(query, params);

            // Clear buffer
            this.metricsBuffer.set(runId, []);

        } catch (error) {
            console.error(`Failed to flush metrics buffer for run ${runId}:`, error);
        }
    }

    findParameterDifferences(runs) {
        if (runs.length < 2) return {};

        const allParams = new Set();
        runs.forEach(run => {
            if (run.parameters) {
                Object.keys(run.parameters).forEach(param => allParams.add(param));
            }
        });

        const differences = {};
        for (const param of allParams) {
            const values = runs.map(run => run.parameters?.[param]);
            const uniqueValues = [...new Set(values.filter(v => v !== undefined))];
            
            if (uniqueValues.length > 1) {
                differences[param] = runs.map(run => ({
                    run_id: run.id,
                    value: run.parameters?.[param]
                }));
            }
        }

        return differences;
    }

    async loadExistingExperiments() {
        const result = await this.db.query(`
            SELECT * FROM training_experiments 
            WHERE status = 'active'
            ORDER BY created_at DESC
            LIMIT 1000
        `);

        for (const experiment of result.rows) {
            this.experimentCache.set(experiment.id, experiment);
        }

        console.log(`Loaded ${result.rows.length} active experiments into cache`);
    }

    startMetricsAggregation() {
        this.metricsAggregator = setInterval(async () => {
            try {
                // Flush all metrics buffers
                for (const runId of this.metricsBuffer.keys()) {
                    await this.flushMetricsBuffer(runId);
                }
            } catch (error) {
                console.error('Metrics aggregation error:', error);
            }
        }, this.config.metricsAggregationInterval);
    }

    startCleanupWorker() {
        // Clean up completed experiments older than retention period
        this.cleanupWorker = setInterval(async () => {
            try {
                const cutoffDate = new Date();
                cutoffDate.setDate(cutoffDate.getDate() - this.config.retentionDays);

                const result = await this.db.query(`
                    UPDATE training_experiments 
                    SET status = 'archived' 
                    WHERE status = 'completed' 
                      AND updated_at < $1
                    RETURNING id
                `, [cutoffDate.toISOString()]);

                if (result.rows.length > 0) {
                    console.log(`Archived ${result.rows.length} old experiments`);
                    
                    // Remove from cache
                    result.rows.forEach(row => {
                        this.experimentCache.delete(row.id);
                    });
                }
            } catch (error) {
                console.error('Cleanup worker error:', error);
            }
        }, 24 * 60 * 60 * 1000); // Daily cleanup
    }

    async updatePerformanceMetrics() {
        try {
            const experimentsCount = await this.db.query('SELECT COUNT(*) FROM training_experiments WHERE status != \'archived\'');
            const runsCount = await this.db.query('SELECT COUNT(*) FROM experiment_runs');
            const completedRuns = await this.db.query('SELECT COUNT(*) FROM experiment_runs WHERE status = \'completed\'');
            const failedRuns = await this.db.query('SELECT COUNT(*) FROM experiment_runs WHERE status = \'failed\'');
            const activeExperiments = await this.db.query('SELECT COUNT(*) FROM training_experiments WHERE status = \'active\'');

            this.performanceMetrics.totalExperiments = parseInt(experimentsCount.rows[0].count);
            this.performanceMetrics.totalRuns = parseInt(runsCount.rows[0].count);
            this.performanceMetrics.completedRuns = parseInt(completedRuns.rows[0].count);
            this.performanceMetrics.failedRuns = parseInt(failedRuns.rows[0].count);
            this.performanceMetrics.activeExperiments = parseInt(activeExperiments.rows[0].count);
        } catch (error) {
            console.error('Failed to update performance metrics:', error);
        }
    }

    /**
     * Get service statistics
     */
    getStatistics() {
        return {
            ...this.performanceMetrics,
            cached_experiments: this.experimentCache.size,
            active_runs: this.activeRuns.size,
            metrics_buffer_size: Array.from(this.metricsBuffer.values()).reduce((sum, buffer) => sum + buffer.length, 0),
            config: {
                tracking_level: this.config.trackingLevel,
                retention_days: this.config.retentionDays,
                max_experiments: this.config.maxExperiments,
                max_runs_per_experiment: this.config.maxRunsPerExperiment,
                auto_tags_enabled: this.config.enableAutoTags,
                metrics_aggregation_enabled: this.config.enableMetricsAggregation
            },
            runtime: {
                initialized: this.initialized,
                running: this.isRunning
            }
        };
    }

    /**
     * Stop the Experiment Tracker
     */
    async stop() {
        console.log('Stopping Experiment Tracker...');

        this.isRunning = false;

        // Stop background processes
        if (this.metricsAggregator) {
            clearInterval(this.metricsAggregator);
            this.metricsAggregator = null;
        }

        if (this.cleanupWorker) {
            clearInterval(this.cleanupWorker);
            this.cleanupWorker = null;
        }

        // Flush all remaining metrics
        for (const runId of this.metricsBuffer.keys()) {
            await this.flushMetricsBuffer(runId).catch(error =>
                console.error(`Failed to flush metrics for run ${runId}:`, error)
            );
        }

        // Clear caches
        this.experimentCache.clear();
        this.activeRuns.clear();
        this.metricsBuffer.clear();

        this.events.emit('stopped', { timestamp: Date.now() });
        console.log('Experiment Tracker stopped');
    }
}

export default ExperimentTracker;

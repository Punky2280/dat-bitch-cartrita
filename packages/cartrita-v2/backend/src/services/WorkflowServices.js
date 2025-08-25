// Workflow Services Coordinator
import WorkflowRunnerService from './WorkflowRunnerService.js';
import WorkflowAnalyticsService from './WorkflowAnalyticsService.js';
import OpenTelemetryTracing from '../system/OpenTelemetryTracing.js';
import { Pool } from 'pg';

export default class WorkflowServices {
  constructor() {
    this.dbPool = null;
    this.runnerService = null;
    this.analyticsService = null;
    this.initialized = false;
  }

  static async initialize() {
    const instance = new WorkflowServices();
    await instance._initialize();
    return instance;
  }

  async _initialize() {
    try {
      console.log('[WorkflowServices] Initializing...');

      this.dbPool = new Pool({
        connectionString: process.env.DATABASE_URL,
        max: 20,
      });

      await this.dbPool.query('SELECT 1');

      this.runnerService = new WorkflowRunnerService(this.dbPool);
      await this.runnerService.initialize();

      this.analyticsService = new WorkflowAnalyticsService(this.dbPool);
      await this.analyticsService.initialize();

      this.initialized = true;
      console.log('[WorkflowServices] Initialized successfully');
    } catch (error) {
      console.error('[WorkflowServices] Init failed:', error);
      this.initialized = false;
      throw error;
    }
  }

  getServices() {
    return {
      runner: this.runnerService,
      analytics: this.analyticsService,
      coordinator: this,
    };
  }

  getHealthStatus() {
    return {
      coordinator: { status: this.initialized ? 'healthy' : 'unhealthy' },
    };
  }

  async cleanup() {
    if (this.dbPool) await this.dbPool.end();
  }
}

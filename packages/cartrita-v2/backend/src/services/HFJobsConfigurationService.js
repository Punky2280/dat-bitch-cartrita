/**
 * HF Jobs Configuration Service
 * Manages configuration for local vs cloud processing preferences
 */

class HFJobsConfigurationService {
  constructor() {
    this.config = {
      // Global cloud processing settings
      cloudProcessing: {
        enabled: process.env.HF_JOBS_ENABLED === 'true' || false,
        preferCloud: process.env.HF_JOBS_PREFER_CLOUD === 'true' || false,
        fallbackToLocal: process.env.HF_JOBS_FALLBACK === 'true' || true,

        // File size thresholds
        minFileSizeForCloud:
          parseInt(process.env.HF_JOBS_MIN_FILE_SIZE) || 10 * 1024 * 1024, // 10MB
        maxLocalFileSize:
          parseInt(process.env.HF_JOBS_MAX_LOCAL_SIZE) || 50 * 1024 * 1024, // 50MB

        // Processing preferences by analysis type
        analysisPreferences: {
          full: {
            preferCloud: true,
            flavor: 'a10g-small',
            maxWaitTime: 1800, // 30 minutes
          },
          diarization: {
            preferCloud: true,
            flavor: 'a10g-small',
            maxWaitTime: 900, // 15 minutes
          },
          vad: {
            preferCloud: false,
            flavor: 'cpu-upgrade',
            maxWaitTime: 300, // 5 minutes
          },
          osd: {
            preferCloud: false,
            flavor: 'cpu-upgrade',
            maxWaitTime: 300, // 5 minutes
          },
          segmentation: {
            preferCloud: true,
            flavor: 'a10g-small',
            maxWaitTime: 600, // 10 minutes
          },
        },

        // Hardware cost optimization
        costOptimization: {
          enabled: process.env.HF_JOBS_COST_OPTIMIZE === 'true' || true,
          maxConcurrentJobs: parseInt(process.env.HF_JOBS_MAX_CONCURRENT) || 3,
          budgetLimits: {
            daily: parseFloat(process.env.HF_JOBS_DAILY_BUDGET) || 50.0,
            monthly: parseFloat(process.env.HF_JOBS_MONTHLY_BUDGET) || 1000.0,
          },
        },
      },
    };

    this.userPreferences = new Map(); // Store per-user preferences
  }

  // Configuration Methods
  getCloudProcessingConfig() {
    return this.config.cloudProcessing;
  }

  setCloudProcessingEnabled(enabled) {
    this.config.cloudProcessing.enabled = enabled;
  }

  getAnalysisPreference(analysisType) {
    return (
      this.config.cloudProcessing.analysisPreferences[analysisType] || {
        preferCloud: false,
        flavor: 'cpu-basic',
        maxWaitTime: 300,
      }
    );
  }

  // User Preference Management
  setUserPreferences(userId, preferences) {
    this.userPreferences.set(userId, {
      ...this.getUserPreferences(userId),
      ...preferences,
      updatedAt: new Date(),
    });
  }

  getUserPreferences(userId) {
    return (
      this.userPreferences.get(userId) || {
        preferCloud: null, // null = use global default
        costLimit: null,
        priorityProcessing: false,
        notifications: true,
      }
    );
  }

  // Decision Logic
  shouldUseCloud(audioInfo, analysisType, options = {}) {
    const userPrefs = this.getUserPreferences(options.userId);
    const analysisPrefs = this.getAnalysisPreference(analysisType);

    // Explicit user override
    if (options.forceLocal) return false;
    if (options.forceCloud) return true;
    if (userPrefs.preferCloud === false) return false;
    if (userPrefs.preferCloud === true) return true;

    // Global cloud processing disabled
    if (!this.config.cloudProcessing.enabled) return false;

    // File size considerations
    if (audioInfo.size >= this.config.cloudProcessing.maxLocalFileSize)
      return true;
    if (audioInfo.size >= this.config.cloudProcessing.minFileSizeForCloud) {
      return analysisPrefs.preferCloud;
    }

    // Analysis type preference
    return analysisPrefs.preferCloud;
  }

  getOptimalFlavor(analysisType, priority = 'balanced') {
    const analysisPrefs = this.getAnalysisPreference(analysisType);

    if (priority === 'cost') {
      return analysisType === 'vad' || analysisType === 'osd'
        ? 'cpu-basic'
        : 't4-small';
    } else if (priority === 'speed') {
      return 'a100-large';
    }

    return analysisPrefs.flavor;
  }

  // Cost Tracking
  trackJobCost(jobInfo) {
    // This would integrate with HF billing API when available
    console.log(`[HFJobs] Cost tracking for job ${jobInfo.id}`);
  }

  // Environment Variables Helper
  static getRequiredEnvVars() {
    return [
      'HF_TOKEN', // Required for HF API access
      'HF_JOBS_ENABLED', // Enable/disable cloud processing
      'HF_JOBS_PREFER_CLOUD', // Default preference
      'HF_JOBS_FALLBACK', // Fallback to local on failure
      'HF_JOBS_MIN_FILE_SIZE', // Min file size for cloud
      'HF_JOBS_MAX_CONCURRENT', // Max concurrent jobs
      'HF_JOBS_DAILY_BUDGET', // Daily spending limit
      'HF_JOBS_MONTHLY_BUDGET', // Monthly spending limit
    ];
  }

  static validateEnvironment() {
    const required = ['HF_TOKEN'];
    const missing = required.filter(key => !process.env[key]);

    if (missing.length > 0) {
      throw new Error(
        `Missing required environment variables: ${missing.join(', ')}`
      );
    }

    // Validate HF_TOKEN format (starts with hf_)
    if (!process.env.HF_TOKEN.startsWith('hf_')) {
      console.warn('[HFJobs] Warning: HF_TOKEN should start with "hf_"');
    }

    return true;
  }

  // Configuration Export/Import
  exportConfiguration() {
    return {
      cloudProcessing: this.config.cloudProcessing,
      userPreferences: Array.from(this.userPreferences.entries()),
      exportedAt: new Date(),
    };
  }

  importConfiguration(configData) {
    if (configData.cloudProcessing) {
      this.config.cloudProcessing = {
        ...this.config.cloudProcessing,
        ...configData.cloudProcessing,
      };
    }

    if (configData.userPreferences) {
      this.userPreferences = new Map(configData.userPreferences);
    }
  }
}

export default HFJobsConfigurationService;

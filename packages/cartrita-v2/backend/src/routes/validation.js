/**
 * Comprehensive Endpoint Validation Routes
 * Provides API endpoints for system-wide endpoint validation and monitoring
 */
import express from 'express';
import EndpointValidationService from '../services/EndpointValidationService.js';

const router = express.Router();

// Lazy initialization helper
let serviceInitialized = false;
function ensureServiceInitialized() {
  if (!serviceInitialized) {
    EndpointValidationService.initialize();
    serviceInitialized = true;
  }
}

// GET /api/validation/run - Run comprehensive endpoint validation
router.get('/run', async (req, res) => {
  try {
    ensureServiceInitialized();
    console.log(
      '[ValidationRoute] 🔍 Running comprehensive endpoint validation...'
    );
    const results = await EndpointValidationService.validateAllEndpoints();

    res.json({
      success: true,
      message: 'Endpoint validation completed',
      ...results,
    });
  } catch (error) {
    console.error('[ValidationRoute] ❌ Validation failed:', error);
    res.status(500).json({
      success: false,
      error: 'Endpoint validation failed',
      details: error.message,
    });
  }
});

// GET /api/validation/status - Get current validation status and last results
router.get('/status', (req, res) => {
  try {
    ensureServiceInitialized();
    const lastResults = EndpointValidationService.getLastValidationResults();
    const isValidationAvailable = lastResults.summary !== null;

    res.json({
      success: true,
      validationAvailable: isValidationAvailable,
      lastValidation: lastResults.summary,
      endpoints: {
        total: lastResults.results?.length || 0,
        categories: lastResults.results
          ? [...new Set(lastResults.results.map(r => r.category))]
          : [],
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[ValidationRoute] ❌ Status check failed:', error);
    res.status(500).json({
      success: false,
      error: 'Status check failed',
    });
  }
});

// GET /api/validation/results - Get detailed validation results
router.get('/results', (req, res) => {
  try {
    ensureServiceInitialized();
    const { category, status } = req.query;
    const lastResults = EndpointValidationService.getLastValidationResults();

    let results = lastResults.results || [];

    // Filter by category if requested
    if (category) {
      results = results.filter(r => r.category === category);
    }

    // Filter by status if requested
    if (status) {
      results = results.filter(r => r.status === status);
    }

    res.json({
      success: true,
      summary: lastResults.summary,
      results,
      filters: { category, status },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[ValidationRoute] ❌ Results retrieval failed:', error);
    res.status(500).json({
      success: false,
      error: 'Results retrieval failed',
    });
  }
});

// GET /api/validation/health - Quick health check for validation service
router.get('/health', (req, res) => {
  ensureServiceInitialized();
  const lastResults = EndpointValidationService.getLastValidationResults();
  const healthScore = lastResults.summary?.healthScore || 0;

  res.json({
    success: true,
    service: 'endpoint-validation',
    status:
      healthScore >= 80
        ? 'healthy'
        : healthScore >= 60
          ? 'degraded'
          : 'unhealthy',
    healthScore,
    lastValidation: lastResults.summary?.timestamp || null,
    timestamp: new Date().toISOString(),
  });
});

export default router;

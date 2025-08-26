/*
 * Cartrita V2 Response Formatter
 * Standardized response formatting for V2 API
 */

export class CartritaV2ResponseFormatter {
  
  // Success response format
  static success(data, meta = {}) {
    return {
      success: true,
      data,
      meta: {
        api_version: 'v2',
        timestamp: new Date().toISOString(),
        ...meta
      }
    };
  }
  
  // Error response format
  static error(message, statusCode = 500, details = {}) {
    return {
      success: false,
      error: message,
      error_code: statusCode,
      meta: {
        api_version: 'v2',
        timestamp: new Date().toISOString(),
        ...details
      }
    };
  }
  
  // Paginated response format
  static paginated(data, pagination, meta = {}) {
    return {
      success: true,
      data,
      pagination: {
        ...pagination,
        has_more: pagination.offset + pagination.limit < pagination.total,
        current_page: Math.floor(pagination.offset / pagination.limit) + 1,
        total_pages: Math.ceil(pagination.total / pagination.limit)
      },
      meta: {
        api_version: 'v2',
        timestamp: new Date().toISOString(),
        ...meta
      }
    };
  }
  
  // Collection response format
  static collection(items, total, meta = {}) {
    return {
      success: true,
      data: items,
      count: items.length,
      total,
      meta: {
        api_version: 'v2',
        timestamp: new Date().toISOString(),
        collection: true,
        ...meta
      }
    };
  }
  
  // Health check response format
  static health(status, checks = {}, meta = {}) {
    return {
      success: true,
      data: {
        status,
        checks,
        uptime: process.uptime(),
        version: '2.0',
        service: 'cartrita-backend'
      },
      meta: {
        api_version: 'v2',
        timestamp: new Date().toISOString(),
        domain: 'system',
        ...meta
      }
    };
  }
  
  // Analytics response format
  static analytics(metrics, period, meta = {}) {
    return {
      success: true,
      data: {
        metrics,
        period,
        generated_at: new Date().toISOString()
      },
      meta: {
        api_version: 'v2',
        timestamp: new Date().toISOString(),
        type: 'analytics',
        ...meta
      }
    };
  }
  
  // Task/Job response format
  static task(taskId, status, result = null, meta = {}) {
    return {
      success: true,
      data: {
        task_id: taskId,
        status,
        result,
        created_at: meta.created_at || new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      meta: {
        api_version: 'v2',
        timestamp: new Date().toISOString(),
        type: 'task',
        ...meta
      }
    };
  }
  
  // Validation error response
  static validationError(errors, meta = {}) {
    return {
      success: false,
      error: 'Validation failed',
      error_code: 400,
      validation_errors: errors,
      meta: {
        api_version: 'v2',
        timestamp: new Date().toISOString(),
        error_type: 'VALIDATION_ERROR',
        ...meta
      }
    };
  }
  
  // Rate limit error response
  static rateLimitError(retryAfter, meta = {}) {
    return {
      success: false,
      error: 'Rate limit exceeded',
      error_code: 429,
      retry_after: retryAfter,
      meta: {
        api_version: 'v2',
        timestamp: new Date().toISOString(),
        error_type: 'RATE_LIMIT_EXCEEDED',
        ...meta
      }
    };
  }
  
  // Authentication error response
  static authError(message = 'Authentication required', meta = {}) {
    return {
      success: false,
      error: message,
      error_code: 401,
      meta: {
        api_version: 'v2',
        timestamp: new Date().toISOString(),
        error_type: 'AUTHENTICATION_ERROR',
        auth_required: true,
        ...meta
      }
    };
  }
  
  // Authorization error response
  static authorizationError(message = 'Insufficient permissions', meta = {}) {
    return {
      success: false,
      error: message,
      error_code: 403,
      meta: {
        api_version: 'v2',
        timestamp: new Date().toISOString(),
        error_type: 'AUTHORIZATION_ERROR',
        ...meta
      }
    };
  }
  
  // Not found error response
  static notFoundError(resource, meta = {}) {
    return {
      success: false,
      error: `${resource} not found`,
      error_code: 404,
      meta: {
        api_version: 'v2',
        timestamp: new Date().toISOString(),
        error_type: 'RESOURCE_NOT_FOUND',
        resource,
        ...meta
      }
    };
  }
  
  // Service unavailable error response
  static serviceUnavailableError(service, meta = {}) {
    return {
      success: false,
      error: `${service} service is currently unavailable`,
      error_code: 503,
      meta: {
        api_version: 'v2',
        timestamp: new Date().toISOString(),
        error_type: 'SERVICE_UNAVAILABLE',
        service,
        ...meta
      }
    };
  }
}

export default CartritaV2ResponseFormatter;
// Utility functions for safe JSON handling across the frontend

/**
 * Safely parse JSON with error handling
 */
export const safeJsonParse = <T = any>(
  jsonString: string,
  fallback: T | null = null
): T | null => {
  try {
    if (!jsonString || typeof jsonString !== 'string') {
      return fallback;
    }
    
    const parsed = JSON.parse(jsonString);
    return parsed;
  } catch (error) {
    console.warn('JSON parse error:', error);
    return fallback;
  }
};

/**
 * Safely parse JWT token payloads
 */
export const parseJwtPayload = (token: string): any | null => {
  try {
    if (!token || typeof token !== 'string') {
      throw new Error('Invalid token format');
    }

    const tokenParts = token.split('.');
    if (tokenParts.length !== 3) {
      throw new Error('Token does not have 3 parts');
    }

    // Safely decode and parse the payload
    const base64Payload = tokenParts[1];
    let decodedPayload;
    
    try {
      decodedPayload = atob(base64Payload);
    } catch (decodeError) {
      throw new Error('Failed to decode token payload');
    }

    let payload;
    try {
      payload = JSON.parse(decodedPayload);
    } catch (parseError) {
      throw new Error('Failed to parse token payload as JSON');
    }

    // Validate payload structure
    if (!payload || typeof payload !== 'object') {
      throw new Error('Invalid payload structure');
    }

    return payload;
  } catch (error) {
    console.error('JWT parsing error:', error);
    return null;
  }
};

/**
 * Safely handle API response JSON parsing
 */
export const safeApiJsonResponse = async <T = any>(
  response: Response
): Promise<T | null> => {
  try {
    if (!response.headers.get('content-type')?.includes('application/json')) {
      throw new Error('Response is not JSON');
    }
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.warn('API JSON response parsing error:', error);
    return null;
  }
};

/**
 * Safely get and parse localStorage items
 */
export const safeLocalStorageGet = <T = any>(
  key: string,
  fallback: T | null = null
): T | null => {
  try {
    const item = localStorage.getItem(key);
    if (!item) return fallback;
    
    return safeJsonParse<T>(item, fallback);
  } catch (error) {
    console.warn(`localStorage get error for key "${key}":`, error);
    // Clear corrupted data
    try {
      localStorage.removeItem(key);
    } catch (removeError) {
      console.warn(`Failed to remove corrupted localStorage key "${key}":`, removeError);
    }
    return fallback;
  }
};

/**
 * Safely set localStorage items
 */
export const safeLocalStorageSet = (key: string, value: any): boolean => {
  try {
    const jsonString = JSON.stringify(value);
    localStorage.setItem(key, jsonString);
    return true;
  } catch (error) {
    console.warn(`localStorage set error for key "${key}":`, error);
    return false;
  }
};

/**
 * Create a safer fetch wrapper with JSON error handling
 */
export const safeFetch = async <T = any>(
  url: string,
  options?: RequestInit
): Promise<{
  data: T | null;
  response: Response;
  error: string | null;
}> => {
  try {
    const response = await fetch(url, options);
    
    if (!response.ok) {
      let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
      
      // Try to get error details from response
      try {
        const errorData = await safeApiJsonResponse(response.clone());
        if (errorData?.message) {
          errorMessage = errorData.message;
        } else if (errorData?.error) {
          errorMessage = errorData.error;
        }
      } catch {
        // Ignore JSON parsing errors for error responses
      }
      
      return {
        data: null,
        response,
        error: errorMessage
      };
    }
    
    const data = await safeApiJsonResponse<T>(response);
    
    return {
      data,
      response,
      error: data ? null : 'Failed to parse response JSON'
    };
  } catch (error) {
    return {
      data: null,
      response: null as any,
      error: error instanceof Error ? error.message : 'Network request failed'
    };
  }
};

/**
 * Validate that an object has expected properties
 */
export const validateObjectStructure = (
  obj: any,
  requiredKeys: string[]
): boolean => {
  if (!obj || typeof obj !== 'object') {
    return false;
  }
  
  return requiredKeys.every(key => key in obj);
};
/**
 * Authentication Utilities
 * 🚨 TEMPORARY FRONTEND BYPASS IMPLEMENTATION
 * 
 * This file contains mock authentication utilities for frontend testing
 * while the backend auth system has critical issues.
 */

export interface MockUser {
  id: number;
  name: string;
  email: string;
  role: string;
  is_admin: boolean;
  iss: string;
  aud: string;
  exp: number;
  iat: number;
}

/**
 * Decode the mock token created by frontend bypass
 */
export function decodeMockToken(token: string): MockUser | null {
  try {
    const decoded = JSON.parse(atob(token));
    
    // Verify it's a mock token (has the bypass issuer)
    if (decoded.iss === "cartrita-frontend-bypass") {
      return decoded as MockUser;
    }
    
    // If it's a real JWT token, we'd need proper JWT decoding
    console.warn("⚠️ Received non-mock token, cannot decode with mock utilities");
    return null;
  } catch (error) {
    console.error("Failed to decode mock token:", error);
    return null;
  }
}

/**
 * Check if the user is authenticated with a valid mock token
 */
export function isAuthenticated(): boolean {
  const token = localStorage.getItem("token");
  if (!token) return false;
  
  const user = decodeMockToken(token);
  if (!user) return false;
  
  // Check if token is expired
  const now = Math.floor(Date.now() / 1000);
  return user.exp > now;
}

/**
 * Get current user data from stored token
 */
export function getCurrentUser(): MockUser | null {
  const token = localStorage.getItem("token");
  if (!token) return null;
  
  return decodeMockToken(token);
}

/**
 * Logout by clearing the stored token
 */
export function logout(): void {
  localStorage.removeItem("token");
  localStorage.removeItem("authToken"); // Clear legacy token too
  window.location.reload(); // Force app refresh
}

/**
 * Get authorization header for API calls
 * Note: Most API calls will still fail due to backend auth issues
 */
export function getAuthHeader(): Record<string, string> {
  const token = localStorage.getItem("token");
  if (!token) return {};
  
  return {
    Authorization: `Bearer ${token}`
  };
}

/**
 * Check if current user has admin privileges
 */
export function isAdmin(): boolean {
  const user = getCurrentUser();
  return user?.is_admin ?? false;
}

// Development helper to log current auth state
if (process.env.NODE_ENV === 'development') {
  console.log("🔐 Auth Utils loaded - Current user:", getCurrentUser());
}
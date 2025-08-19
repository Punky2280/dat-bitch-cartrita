/**
 * Authentication Utilities
 * Real JWT token handling for backend authentication
 */

export interface User {
  id: number;
  name: string;
  email: string;
  role: string;
  is_admin: boolean;
}

/**
 * Decode JWT token payload (without verification - for client-side only)
 */
export function decodeJWT(token: string): any | null {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
      return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));
    
    return JSON.parse(jsonPayload);
  } catch (error) {
    console.error("Failed to decode JWT token:", error);
    return null;
  }
}

/**
 * Check if the user is authenticated with a valid JWT token
 */
export function isAuthenticated(): boolean {
  const token = localStorage.getItem("token");
  if (!token) return false;
  
  const decoded = decodeJWT(token);
  if (!decoded) return false;
  
  // Check if token is expired
  const now = Math.floor(Date.now() / 1000);
  return decoded.exp > now;
}

/**
 * Get current user data from stored JWT token
 */
export function getCurrentUser(): User | null {
  const token = localStorage.getItem("token");
  if (!token) return null;
  
  const decoded = decodeJWT(token);
  if (!decoded) return null;
  
  return {
    id: decoded.sub,
    name: decoded.name,
    email: decoded.email,
    role: decoded.role,
    is_admin: decoded.is_admin
  };
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
if (import.meta.env.DEV) {
  console.log("🔐 Auth Utils loaded - Current user:", getCurrentUser());
}
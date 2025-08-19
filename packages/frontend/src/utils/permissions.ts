/**
 * Permission utilities for role-based access control
 */

export interface User {
  id?: number;
  email?: string;
  name?: string;
  role?: string;
  permissions?: string[];
  is_admin?: boolean;
}

/**
 * Check if a user has a specific permission
 * @param user The user object
 * @param permission The permission to check
 * @returns boolean indicating if user has permission
 */
export const hasPermission = (user: User | null | undefined, permission: string): boolean => {
  if (!user) return false;
  
  // Admin users have all permissions
  if (user.is_admin === true) return true;
  
  // Check if user has the specific permission
  if (user.permissions && Array.isArray(user.permissions)) {
    return user.permissions.includes(permission);
  }
  
  // Role-based permissions mapping
  const rolePermissions: Record<string, string[]> = {
    admin: [
      'admin',
      'vault_access',
      'user_management',
      'system_settings',
      'analytics_view',
      'workflow_management'
    ],
    user: [
      'chat_access',
      'workflow_view',
      'analytics_view'
    ],
    guest: [
      'chat_access'
    ]
  };
  
  const userRole = user.role || 'guest';
  const permissions = rolePermissions[userRole] || [];
  
  return permissions.includes(permission);
};

/**
 * Check if user has any of the specified permissions
 * @param user The user object
 * @param permissions Array of permissions to check
 * @returns boolean indicating if user has any of the permissions
 */
export const hasAnyPermission = (user: User | null | undefined, permissions: string[]): boolean => {
  return permissions.some(permission => hasPermission(user, permission));
};

/**
 * Check if user has all of the specified permissions
 * @param user The user object
 * @param permissions Array of permissions to check
 * @returns boolean indicating if user has all permissions
 */
export const hasAllPermissions = (user: User | null | undefined, permissions: string[]): boolean => {
  return permissions.every(permission => hasPermission(user, permission));
};

/**
 * Get all permissions for a user
 * @param user The user object
 * @returns Array of permission strings
 */
export const getUserPermissions = (user: User | null | undefined): string[] => {
  if (!user) return [];
  
  // Admin users have all permissions
  if (user.is_admin === true) {
    return [
      'admin',
      'vault_access',
      'user_management',
      'system_settings',
      'analytics_view',
      'workflow_management',
      'chat_access',
      'workflow_view'
    ];
  }
  
  // Return explicit permissions if available
  if (user.permissions && Array.isArray(user.permissions)) {
    return user.permissions;
  }
  
  // Fall back to role-based permissions
  const rolePermissions: Record<string, string[]> = {
    admin: [
      'admin',
      'vault_access',
      'user_management',
      'system_settings',
      'analytics_view',
      'workflow_management'
    ],
    user: [
      'chat_access',
      'workflow_view',
      'analytics_view'
    ],
    guest: [
      'chat_access'
    ]
  };
  
  const userRole = user.role || 'guest';
  return rolePermissions[userRole] || [];
};

/**
 * Check if user is admin
 * @param user The user object
 * @returns boolean indicating if user is admin
 */
export const isAdmin = (user: User | null | undefined): boolean => {
  if (!user) return false;
  return user.is_admin === true || user.role === 'admin';
};

/**
 * Permission constants for type safety
 */
export const PERMISSIONS = {
  ADMIN: 'admin',
  VAULT_ACCESS: 'vault_access',
  USER_MANAGEMENT: 'user_management',
  SYSTEM_SETTINGS: 'system_settings',
  ANALYTICS_VIEW: 'analytics_view',
  WORKFLOW_MANAGEMENT: 'workflow_management',
  CHAT_ACCESS: 'chat_access',
  WORKFLOW_VIEW: 'workflow_view'
} as const;

export type Permission = typeof PERMISSIONS[keyof typeof PERMISSIONS];
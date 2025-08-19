import React from 'react';
import { Navigate } from 'react-router-dom';

interface RouteGuardProps {
  children: React.ReactNode;
  requiresAuth: boolean;
  permissions?: string[];
  token?: string;
}

export const RouteGuard: React.FC<RouteGuardProps> = ({
  children,
  requiresAuth,
  permissions = [],
  token
}) => {
  const isAuthenticated = !!token && token.split('.').length === 3;
  
  // Check authentication
  if (requiresAuth && !isAuthenticated) {
    return <Navigate to="/auth/login" replace />;
  }

  // Redirect authenticated users away from auth pages  
  if (!requiresAuth && isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  // For now, skip permission checks since we don't have user context
  // This can be enhanced later when user context is available
  if (permissions && permissions.length > 0) {
    console.log('Permission check requested for:', permissions, 'but user context not available');
    // Allow access for now - permissions can be implemented when user context is added
  }

  return <>{children}</>;
};
import React, { Suspense, lazy, useEffect, useState } from 'react';
import { Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { RouteGuard } from './RouteGuard';
import { RoutePreloader } from './RoutePreloader';
import { MainLayout } from '../layouts/MainLayout';
import { Loader2, AlertTriangle } from 'lucide-react';

// Lazy load pages with retry logic
const createLazyComponent = (importFunc: () => Promise<any>, componentName: string) => {
  return lazy(() =>
    importFunc().catch((error) => {
      console.error(`Failed to load ${componentName}:`, error);
      // Retry once
      return importFunc().catch(() => {
        // Return a fallback component
        return Promise.resolve({
          default: () => (
            <div className="flex items-center justify-center min-h-screen">
              <div className="text-center">
                <AlertTriangle className="w-12 h-12 text-red-400 mx-auto mb-4" />
                <h2 className="text-xl font-bold text-white mb-2">Page Unavailable</h2>
                <p className="text-slate-400">Failed to load {componentName}</p>
              </div>
            </div>
          )
        });
      });
    })
  );
};

// Lazy-loaded components
const DashboardPage = createLazyComponent(() => import('../pages/ModernDashboard'), 'ModernDashboard');
const ChatPage = createLazyComponent(() => import('../pages/ChatPage'), 'ChatPage');
const AnalyticsPage = createLazyComponent(() => import('../pages/AnalyticsPage'), 'AnalyticsPage');
const SettingsPage = createLazyComponent(() => import('../pages/SettingsPage'), 'SettingsPage');
const AgentsPage = createLazyComponent(() => import('../pages/AgentsPage'), 'AgentsPage');
const WorkflowsPage = createLazyComponent(() => import('../pages/WorkflowsPage'), 'WorkflowsPage');

// Route configuration
export interface RouteConfig {
  path: string;
  element: React.ComponentType<any>;
  title: string;
  description?: string;
  requiresAuth: boolean;
  preload?: boolean;
  permissions?: string[];
  metadata?: {
    category: string;
    priority: number;
  };
}

const routeConfigs: RouteConfig[] = [
  {
    path: '/dashboard',
    element: DashboardPage,
    title: 'Dashboard',
    description: 'System overview and control center',
    requiresAuth: true,
    preload: true,
    metadata: { category: 'main', priority: 1 }
  },
  {
    path: '/chat',
    element: ChatPage,
    title: 'Chat',
    description: 'AI conversation interface',
    requiresAuth: true,
    preload: true,
    metadata: { category: 'main', priority: 2 }
  },
  {
    path: '/agents',
    element: AgentsPage,
    title: 'Agents',
    description: 'Manage AI agents and workflows',
    requiresAuth: true,
    metadata: { category: 'management', priority: 3 }
  },
  {
    path: '/workflows',
    element: WorkflowsPage,
    title: 'Workflows',
    description: 'Automation and process management',
    requiresAuth: true,
    metadata: { category: 'management', priority: 4 }
  },
  {
    path: '/analytics',
    element: AnalyticsPage,
    title: 'Analytics',
    description: 'Performance metrics and insights',
    requiresAuth: true,
    metadata: { category: 'insights', priority: 5 }
  },
  {
    path: '/settings',
    element: SettingsPage,
    title: 'Settings',
    description: 'System configuration and preferences',
    requiresAuth: true,
    metadata: { category: 'system', priority: 6 }
  }
];

// Loading component
const LoadingSpinner: React.FC<{ message?: string }> = ({ message = 'Loading...' }) => (
  <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800">
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      className="text-center"
    >
      <Loader2 className="w-8 h-8 text-cyan-400 animate-spin mx-auto mb-4" />
      <p className="text-slate-400">{message}</p>
    </motion.div>
  </div>
);

// Error component
const ErrorFallback: React.FC<{ error?: Error }> = ({ error }) => (
  <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800">
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="text-center max-w-md"
    >
      <AlertTriangle className="w-12 h-12 text-red-400 mx-auto mb-4" />
      <h2 className="text-xl font-bold text-white mb-2">Something went wrong</h2>
      <p className="text-slate-400 mb-4">
        {error?.message || 'An unexpected error occurred while loading this page.'}
      </p>
      <button
        onClick={() => window.location.reload()}
        className="px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 transition-colors"
      >
        Reload Page
      </button>
    </motion.div>
  </div>
);

// Animated route wrapper
const AnimatedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <motion.div
    initial={{ opacity: 0, x: 20 }}
    animate={{ opacity: 1, x: 0 }}
    exit={{ opacity: 0, x: -20 }}
    transition={{ duration: 0.2 }}
    className="h-full"
  >
    {children}
  </motion.div>
);

// Main router component
interface AdvancedRouterProps {
  token: string;
  onLogout: () => void;
}

export const AdvancedRouter: React.FC<AdvancedRouterProps> = ({ token, onLogout }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [isPreloading, setIsPreloading] = useState(true);

  // Performance tracking
  useEffect(() => {
    const startTime = performance.now();
    
    return () => {
      const endTime = performance.now();
      const loadTime = endTime - startTime;
      
      // Track route performance
      if (typeof window !== 'undefined' && (window as any).gtag) {
        (window as any).gtag('event', 'timing_complete', {
          name: 'route_load_time',
          value: Math.round(loadTime),
          event_category: 'Navigation',
          event_label: location.pathname
        });
      }
    };
  }, [location.pathname]);

  // Preload critical routes
  useEffect(() => {
    const preloadRoutes = async () => {
      const criticalRoutes = routeConfigs.filter(route => route.preload);
      await Promise.all(
        criticalRoutes.map(async (route) => {
          try {
            // Preload the component
            await route.element;
          } catch (error) {
            console.warn(`Failed to preload route ${route.path}:`, error);
          }
        })
      );
      setIsPreloading(false);
    };

    preloadRoutes();
  }, []);

  const handleNavigation = (path: string) => {
    navigate(path);
  };

  // Redirect root to dashboard
  useEffect(() => {
    if (location.pathname === '/' || location.pathname === '') {
      navigate('/dashboard', { replace: true });
    }
  }, [location.pathname, navigate]);

  return (
    <MainLayout
      currentPath={location.pathname}
      onNavigate={handleNavigation}
      onLogout={onLogout}
      userName="User"
    >
      <RoutePreloader routes={routeConfigs} currentPath={location.pathname} />
      
      <Suspense fallback={<LoadingSpinner message="Loading page..." />}>
        <AnimatePresence mode="wait">
          <Routes location={location} key={location.pathname}>
            {routeConfigs.map((config) => (
              <Route
                key={config.path}
                path={config.path}
                element={
                  <RouteGuard
                    requiresAuth={config.requiresAuth}
                    permissions={config.permissions}
                    token={token}
                  >
                    <AnimatedRoute>
                      <ErrorBoundary fallback={ErrorFallback}>
                        <config.element />
                      </ErrorBoundary>
                    </AnimatedRoute>
                  </RouteGuard>
                }
              />
            ))}
            
            {/* Catch all route */}
            <Route 
              path="*" 
              element={<Navigate to="/dashboard" replace />} 
            />
          </Routes>
        </AnimatePresence>
      </Suspense>
    </MainLayout>
  );
};

// Simple error boundary for route-level errors
class ErrorBoundary extends React.Component<
  { children: React.ReactNode; fallback: React.ComponentType<{ error?: Error }> },
  { hasError: boolean; error?: Error }
> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Route error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      const Fallback = this.props.fallback;
      return <Fallback error={this.state.error} />;
    }

    return this.props.children;
  }
}

// Page transition animations
const pageTransitions = {
  initial: { opacity: 0, x: -20, scale: 0.95 },
  animate: { opacity: 1, x: 0, scale: 1 },
  exit: { opacity: 0, x: 20, scale: 1.05 }
};

// Route loading component (using the existing LoadingSpinner defined above)
const RouteLoader: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <Suspense
    fallback={<LoadingSpinner message="Loading route..." />}
  >
    {children}
  </Suspense>
);

// Route analytics and performance tracking
const RouteTracker: React.FC = () => {
  const location = useLocation();
  const [loadTime] = useState(Date.now());

  useEffect(() => {
    const route = routeConfigs.find(r => r.path === location.pathname);
    if (route) {
      // Track route navigation
      console.log(`Route navigated: ${route.title} (${location.pathname})`);
      
      // Performance tracking
      const navigationTime = Date.now() - loadTime;
      if (navigationTime > 1000) {
        console.warn(`Slow route load: ${route.title} took ${navigationTime}ms`);
      }

      // Update document title
      document.title = `${route.title} - Cartrita`;
    }
  }, [location, loadTime]);

  return null;
};

// Export route utilities for external use
export const useRouteConfig = () => routeConfigs;
export const findRouteByPath = (path: string) => 
  routeConfigs.find(route => route.path === path);
export const getRoutesByCategory = (category: string) => 
  routeConfigs.filter(route => route.metadata?.category === category);
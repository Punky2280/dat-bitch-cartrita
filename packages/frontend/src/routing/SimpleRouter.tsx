import React, { Suspense } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import { ModernLayout } from '../layouts/ModernLayout';

// Direct imports to avoid lazy loading issues for now
import { ModernDashboard } from '../pages/ModernDashboardNew';
import { ModernChat } from '../pages/ModernChatNew';
import { ModernChatEnhanced } from '../pages/ModernChatEnhanced';
import { AnalyticsPage } from '../pages/ModernAnalytics';
import { SettingsPage } from '../pages/ModernSettings';
import { AgentsPage } from '../pages/ModernAgents';
import { WorkflowsPage } from '../pages/ModernWorkflows';

// Simple loading component
const LoadingSpinner: React.FC = () => (
  <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800">
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      className="text-center"
    >
      <Loader2 className="w-8 h-8 text-cyan-400 animate-spin mx-auto mb-4" />
      <p className="text-slate-400">Loading...</p>
    </motion.div>
  </div>
);

// Simple route wrapper with authentication check
interface AuthRouteProps {
  children: React.ReactNode;
  token: string;
}

const AuthRoute: React.FC<AuthRouteProps> = ({ children, token }) => {
  if (!token) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
};

// Simple router interface
interface SimpleRouterProps {
  token: string;
  onLogout: () => void;
}

export const SimpleRouter: React.FC<SimpleRouterProps> = ({ token, onLogout }) => {
  const location = useLocation();
  const isFullScreenRoute = location.pathname === '/chat' || location.pathname === '/chat-enhanced';

  if (isFullScreenRoute) {
    return (
      <Suspense fallback={<LoadingSpinner />}>
        <Routes>
          <Route
            path="/chat"
            element={
              <AuthRoute token={token}>
                <ModernChat />
              </AuthRoute>
            }
          />
          <Route
            path="/chat-enhanced"
            element={
              <AuthRoute token={token}>
                <ModernChatEnhanced />
              </AuthRoute>
            }
          />
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </Suspense>
    );
  }

  return (
    <ModernLayout onLogout={onLogout} userName="Administrator">
      <Suspense fallback={<LoadingSpinner />}>
        <Routes>
          <Route
            path="/dashboard"
            element={
              <AuthRoute token={token}>
                <ModernDashboard />
              </AuthRoute>
            }
          />
          <Route
            path="/chat"
            element={
              <AuthRoute token={token}>
                <ModernChat />
              </AuthRoute>
            }
          />
          <Route
            path="/chat-enhanced"
            element={
              <AuthRoute token={token}>
                <ModernChatEnhanced />
              </AuthRoute>
            }
          />
          <Route
            path="/agents"
            element={
              <AuthRoute token={token}>
                <AgentsPage />
              </AuthRoute>
            }
          />
          <Route
            path="/workflows"
            element={
              <AuthRoute token={token}>
                <WorkflowsPage />
              </AuthRoute>
            }
          />
          <Route
            path="/analytics"
            element={
              <AuthRoute token={token}>
                <AnalyticsPage />
              </AuthRoute>
            }
          />
          <Route
            path="/settings"
            element={
              <AuthRoute token={token}>
                <SettingsPage />
              </AuthRoute>
            }
          />
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </Suspense>
    </ModernLayout>
  );
};
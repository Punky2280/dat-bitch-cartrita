'use client';

import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Menu, X, Settings, Plus, Search, MessageSquare, Database, Workflow, Zap } from 'lucide-react';
import useAppStore, { 
  useSidebarOpen, 
  useSettingsOpen, 
  useTheme, 
  useUser,
  useConversations 
} from '@/store';
import { cn } from '@/lib/utils';
import Sidebar from './Sidebar';
import Header from './Header';
import SettingsPanel from '../settings/SettingsPanel';
import ConnectionStatus from '../common/ConnectionStatus';
import ToastContainer from '../ui/ToastContainer';
import LoadingOverlay from '../ui/LoadingOverlay';

interface MainLayoutProps {
  children: React.ReactNode;
}

const MainLayout: React.FC<MainLayoutProps> = ({ children }) => {
  const sidebarOpen = useSidebarOpen();
  const settingsOpen = useSettingsOpen();
  const theme = useTheme();
  const user = useUser();
  const conversations = useConversations();
  const { setSidebarOpen, setSettingsOpen, initialize } = useAppStore();

  // Initialize app on mount
  useEffect(() => {
    initialize();
  }, [initialize]);

  // Apply theme
  useEffect(() => {
    const applyTheme = () => {
      const root = document.documentElement;
      const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      const actualTheme = theme === 'system' ? systemTheme : theme;
      
      root.classList.remove('light', 'dark');
      root.classList.add(actualTheme);
    };

    applyTheme();

    // Listen for system theme changes
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => {
      if (theme === 'system') {
        applyTheme();
      }
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [theme]);

  return (
    <div className="h-screen flex bg-background text-foreground overflow-hidden">
      {/* Sidebar */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div
            initial={{ x: -300, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -300, opacity: 0 }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="flex-shrink-0 w-80 bg-gray-50 dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700"
          >
            <Sidebar />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <Header />

        {/* Content */}
        <main className="flex-1 relative overflow-hidden">
          {children}
        </main>
      </div>

      {/* Settings Panel */}
      <AnimatePresence>
        {settingsOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40"
              onClick={() => setSettingsOpen(false)}
            />
            
            {/* Settings Panel */}
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="fixed right-0 top-0 h-full w-96 bg-background border-l border-gray-200 dark:border-gray-700 shadow-xl z-50"
            >
              <SettingsPanel />
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Mobile Sidebar Backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/20 backdrop-blur-sm z-30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Connection Status */}
      <ConnectionStatus showText={true} position="top-right" />

      {/* Toast Container */}
      <ToastContainer />

      {/* Loading Overlay */}
      <LoadingOverlay />
    </div>
  );
};

export default MainLayout;
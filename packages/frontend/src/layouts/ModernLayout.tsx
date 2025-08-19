import React from 'react';
import { motion } from 'framer-motion';
import { 
  Home, 
  MessageSquare, 
  Bot, 
  Workflow, 
  BarChart3, 
  Settings,
  LogOut,
  Menu,
  X,
  Sparkles,
  User
} from 'lucide-react';
import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import NotificationSystem from '../components/NotificationSystem';

interface ModernLayoutProps {
  children: React.ReactNode;
  onLogout: () => void;
  userName?: string;
}

export const ModernLayout: React.FC<ModernLayoutProps> = ({ 
  children, 
  onLogout, 
  userName = "User" 
}) => {
  const { state, actions } = useApp();
  const [sidebarOpen, setSidebarOpen] = useState(state.ui.sidebarCollapsed);
  const location = useLocation();
  const navigate = useNavigate();

  const navItems = [
    { path: '/dashboard', icon: Home, label: 'Dashboard', color: 'text-cyan-400' },
    { path: '/chat', icon: MessageSquare, label: 'Chat', color: 'text-emerald-400' },
    { path: '/agents', icon: Bot, label: 'Agents', color: 'text-purple-400' },
    { path: '/workflows', icon: Workflow, label: 'Workflows', color: 'text-orange-400' },
    { path: '/analytics', icon: BarChart3, label: 'Analytics', color: 'text-blue-400' },
    { path: '/settings', icon: Settings, label: 'Settings', color: 'text-slate-400' },
  ];

  const handleNavigation = (path: string) => {
    navigate(path);
    setSidebarOpen(false);
    
    // Load appropriate data based on the route
    switch (path) {
      case '/dashboard':
        actions.loadSystemMetrics();
        break;
      case '/chat':
        actions.loadChatSessions();
        break;
      case '/agents':
        actions.loadAgents();
        break;
      case '/workflows':
        actions.loadWorkflows();
        break;
      case '/analytics':
        actions.loadAnalytics();
        break;
      case '/settings':
        actions.loadSettings();
        break;
    }
  };

  return (
    <div className="flex h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800">
      {/* Desktop Sidebar */}
      <div className="hidden lg:flex lg:flex-col lg:w-64 bg-slate-900/50 backdrop-blur border-r border-slate-800">
        {/* Logo */}
        <div className="flex items-center px-6 py-6 border-b border-slate-800">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-gradient-to-br from-cyan-400 to-blue-600 rounded-lg flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white">Cartrita</h1>
              <p className="text-xs text-slate-400">AI Multi-Agent OS</p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-4 py-6">
          <div className="space-y-2">
            {navItems.map((item) => {
              const isActive = location.pathname === item.path;
              return (
                <motion.button
                  key={item.path}
                  onClick={() => handleNavigation(item.path)}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className={`w-full flex items-center px-4 py-3 rounded-xl transition-all duration-200 ${
                    isActive
                      ? 'bg-slate-800 text-white shadow-lg'
                      : 'text-slate-400 hover:bg-slate-800/50 hover:text-white'
                  }`}
                >
                  <item.icon className={`w-5 h-5 ${isActive ? item.color : ''}`} />
                  <span className="ml-3 font-medium">{item.label}</span>
                  {isActive && (
                    <div className={`ml-auto w-2 h-2 rounded-full ${item.color.replace('text-', 'bg-')}`} />
                  )}
                </motion.button>
              );
            })}
          </div>
        </nav>

        {/* User Section */}
        <div className="px-4 py-6 border-t border-slate-800">
          <div className="flex items-center space-x-3 mb-4">
            <div className="w-8 h-8 bg-gradient-to-br from-violet-400 to-purple-600 rounded-lg flex items-center justify-center">
              <User className="w-4 h-4 text-white" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-white">{userName}</p>
              <p className="text-xs text-slate-400">Administrator</p>
            </div>
          </div>
          <button
            onClick={onLogout}
            className="w-full flex items-center px-4 py-2 text-slate-400 hover:text-red-400 hover:bg-slate-800/50 rounded-lg transition-colors"
          >
            <LogOut className="w-4 h-4" />
            <span className="ml-3 text-sm">Sign Out</span>
          </button>
        </div>
      </div>

      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Mobile Sidebar */}
      <motion.div 
        initial={false}
        animate={{ x: sidebarOpen ? 0 : '-100%' }}
        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
        className="fixed inset-y-0 left-0 w-64 bg-slate-900 backdrop-blur border-r border-slate-800 z-50 lg:hidden"
      >
        {/* Mobile Logo */}
        <div className="flex items-center justify-between px-6 py-6 border-b border-slate-800">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-gradient-to-br from-cyan-400 to-blue-600 rounded-lg flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white">Cartrita</h1>
              <p className="text-xs text-slate-400">AI Multi-Agent OS</p>
            </div>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="p-2 text-slate-400 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mobile Navigation */}
        <nav className="flex-1 px-4 py-6">
          <div className="space-y-2">
            {navItems.map((item) => {
              const isActive = location.pathname === item.path;
              return (
                <button
                  key={item.path}
                  onClick={() => handleNavigation(item.path)}
                  className={`w-full flex items-center px-4 py-3 rounded-xl transition-all duration-200 ${
                    isActive
                      ? 'bg-slate-800 text-white shadow-lg'
                      : 'text-slate-400 hover:bg-slate-800/50 hover:text-white'
                  }`}
                >
                  <item.icon className={`w-5 h-5 ${isActive ? item.color : ''}`} />
                  <span className="ml-3 font-medium">{item.label}</span>
                  {isActive && (
                    <div className={`ml-auto w-2 h-2 rounded-full ${item.color.replace('text-', 'bg-')}`} />
                  )}
                </button>
              );
            })}
          </div>
        </nav>

        {/* Mobile User Section */}
        <div className="px-4 py-6 border-t border-slate-800">
          <div className="flex items-center space-x-3 mb-4">
            <div className="w-8 h-8 bg-gradient-to-br from-violet-400 to-purple-600 rounded-lg flex items-center justify-center">
              <User className="w-4 h-4 text-white" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-white">{userName}</p>
              <p className="text-xs text-slate-400">Administrator</p>
            </div>
          </div>
          <button
            onClick={onLogout}
            className="w-full flex items-center px-4 py-2 text-slate-400 hover:text-red-400 hover:bg-slate-800/50 rounded-lg transition-colors"
          >
            <LogOut className="w-4 h-4" />
            <span className="ml-3 text-sm">Sign Out</span>
          </button>
        </div>
      </motion.div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Mobile Header */}
        <div className="lg:hidden flex items-center justify-between px-4 py-4 border-b border-slate-800 bg-slate-900/50 backdrop-blur">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 text-slate-400 hover:text-white"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex items-center space-x-2">
            <div className="w-6 h-6 bg-gradient-to-br from-cyan-400 to-blue-600 rounded-lg flex items-center justify-center">
              <Sparkles className="w-3 h-3 text-white" />
            </div>
            <span className="font-bold text-white">Cartrita</span>
          </div>
          <div className="w-10" /> {/* Spacer */}
        </div>

        {/* Content */}
        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>
      
      {/* Notification System */}
      <NotificationSystem />
    </div>
  );
};
/**
 * Advanced App Layout Component
 * Modern dashboard layout with sidebar, navigation, and responsive design
 */
'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bars3Icon,
  XMarkIcon,
  HomeIcon,
  ChatBubbleLeftRightIcon,
  CpuChipIcon,
  ChartBarIcon,
  Cog6ToothIcon,
  UserGroupIcon,
  DocumentTextIcon,
  InformationCircleIcon,
  ShieldCheckIcon,
  BoltIcon,
  SparklesIcon,
  ArrowTrendingUpIcon,
  CommandLineIcon,
  GlobeAltIcon,
  BellIcon,
  UserCircleIcon,
  SunIcon,
  MoonIcon,
  EyeIcon,
  AcademicCapIcon,
} from '@heroicons/react/24/outline';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import NotificationPanel from '@/components/notifications/NotificationPanel';
import UserProfileModal from '@/components/user/UserProfileModal';
import DemoNotificationTrigger from '@/components/demo/DemoNotificationTrigger';
import { useNotificationStore, NotificationService } from '@/stores/notificationStore';
import { useUserStore, UserService } from '@/stores/userStore';

interface NavItem {
  name: string;
  href: string;
  icon: React.ComponentType<any>;
  badge?: string;
  color?: string;
  description: string;
}

interface AppLayoutProps {
  children: React.ReactNode;
}

const navigation: NavItem[] = [
  {
    name: 'Dashboard',
    href: '/',
    icon: HomeIcon,
    color: 'text-blue-500',
    description: 'Overview and system status'
  },
  {
    name: 'AI Chat',
    href: '/chat',
    icon: ChatBubbleLeftRightIcon,
    badge: '15',
    color: 'text-green-500',
    description: 'Multi-agent AI conversations'
  },
  {
    name: 'Agents',
    href: '/agents',
    icon: UserGroupIcon,
    badge: 'New',
    color: 'text-purple-500',
    description: 'Manage AI agents and capabilities'
  },
  {
    name: 'Analytics',
    href: '/analytics',
    icon: ChartBarIcon,
    color: 'text-orange-500',
    description: 'Performance metrics and insights'
  },
  {
    name: 'Workflows',
    href: '/workflows',
    icon: BoltIcon,
    color: 'text-yellow-500',
    description: 'Automated task orchestration'
  },
  {
    name: 'Quantum',
    href: '/quantum',
    icon: CpuChipIcon,
    badge: 'Beta',
    color: 'text-cyan-500',
    description: 'Quantum computing integration'
  },
  {
    name: 'Vision Lab',
    href: '/vision',
    icon: EyeIcon,
    color: 'text-pink-500',
    description: 'Computer vision and image analysis'
  },
  {
    name: 'Research Hub',
    href: '/research',
    icon: AcademicCapIcon,
    color: 'text-indigo-500',
    description: 'AI research and development'
  },
  {
    name: 'API Console',
    href: '/api-console',
    icon: CommandLineIcon,
    color: 'text-gray-500',
    description: 'API testing and documentation'
  },
  {
    name: 'Settings',
    href: '/settings',
    icon: Cog6ToothIcon,
    color: 'text-gray-400',
    description: 'System configuration and preferences'
  },
];

const bottomNavigation: NavItem[] = [
  {
    name: 'About',
    href: '/about',
    icon: InformationCircleIcon,
    color: 'text-blue-400',
    description: 'Learn about Cartrita V2'
  },
  {
    name: 'Manual',
    href: '/manual',
    icon: DocumentTextIcon,
    color: 'text-green-400',
    description: 'Complete user guide'
  },
  {
    name: 'License',
    href: '/license',
    icon: ShieldCheckIcon,
    color: 'text-purple-400',
    description: 'Terms and licensing information'
  },
];

export default function AppLayout({ children }: AppLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [notificationPanelOpen, setNotificationPanelOpen] = useState(false);
  const [userProfileOpen, setUserProfileOpen] = useState(false);
  const pathname = usePathname();

  // Get notification and user data from stores
  const { unreadCount } = useNotificationStore();
  const { user } = useUserStore();

  // Initialize services
  useEffect(() => {
    NotificationService.getInstance();
    UserService.getInstance();
  }, []);

  // Initialize dark mode from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('cartrita-dark-mode');
    if (saved !== null) {
      const isDark = JSON.parse(saved);
      setDarkMode(isDark);
      document.documentElement.classList.toggle('dark', isDark);
    }
  }, []);

  const toggleDarkMode = () => {
    const newMode = !darkMode;
    setDarkMode(newMode);
    localStorage.setItem('cartrita-dark-mode', JSON.stringify(newMode));
    document.documentElement.classList.toggle('dark', newMode);
  };

  const isActiveRoute = (href: string) => {
    if (href === '/') {
      return pathname === '/';
    }
    return pathname.startsWith(href);
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors duration-300">
      {/* Demo notification trigger (only in development) */}
      {process.env.NODE_ENV === 'development' && <DemoNotificationTrigger />}
      
      {/* Mobile sidebar overlay */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-gray-600 bg-opacity-75 z-40 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Mobile sidebar */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div
            initial={{ x: -320 }}
            animate={{ x: 0 }}
            exit={{ x: -320 }}
            transition={{ type: "tween", duration: 0.3 }}
            className="fixed inset-y-0 left-0 w-80 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 z-50 lg:hidden shadow-xl"
          >
            <SidebarContent 
              onClose={() => setSidebarOpen(false)} 
              navigation={navigation}
              bottomNavigation={bottomNavigation}
              isActiveRoute={isActiveRoute}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Desktop sidebar */}
      <div className="hidden lg:flex lg:w-80 lg:flex-col lg:fixed lg:inset-y-0">
        <div className="bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex-1 flex flex-col min-h-0 shadow-lg">
          <SidebarContent 
            navigation={navigation}
            bottomNavigation={bottomNavigation}
            isActiveRoute={isActiveRoute}
          />
        </div>
      </div>

      {/* Main content area */}
      <div className="lg:pl-80 flex flex-col flex-1">
        {/* Top navigation bar */}
        <header className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700 px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center">
              <button
                onClick={() => setSidebarOpen(true)}
                className="lg:hidden p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                <Bars3Icon className="h-6 w-6" />
              </button>
              
              <div className="ml-4 lg:ml-0">
                <h1 className="text-lg font-semibold text-gray-900 dark:text-white">
                  {navigation.find(item => isActiveRoute(item.href))?.name || 'Cartrita V2'}
                </h1>
                <p className="text-sm text-gray-500 dark:text-gray-400 hidden sm:block">
                  {navigation.find(item => isActiveRoute(item.href))?.description || 'Advanced AI Orchestration Platform'}
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-4">
              {/* System Status */}
              <div className="hidden sm:flex items-center space-x-2 px-3 py-1 rounded-full bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                <span className="text-xs font-medium">All Systems Online</span>
              </div>

              {/* Notifications */}
              <div className="relative">
                <button 
                  onClick={() => setNotificationPanelOpen(!notificationPanelOpen)}
                  className="relative p-2 text-gray-400 hover:text-gray-500 dark:hover:text-gray-300 transition-colors"
                >
                  <BellIcon className="h-6 w-6" />
                  {unreadCount > 0 && (
                    <span className="absolute top-0 right-0 h-4 w-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
                </button>
                <NotificationPanel 
                  isOpen={notificationPanelOpen}
                  onClose={() => setNotificationPanelOpen(false)}
                />
              </div>

              {/* Dark mode toggle */}
              <button
                onClick={toggleDarkMode}
                className="p-2 text-gray-400 hover:text-gray-500 dark:hover:text-gray-300 transition-colors"
                title={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
              >
                {darkMode ? (
                  <SunIcon className="h-6 w-6" />
                ) : (
                  <MoonIcon className="h-6 w-6" />
                )}
              </button>

              {/* User menu */}
              <div className="relative">
                <button 
                  onClick={() => setUserProfileOpen(true)}
                  className="flex items-center space-x-2 p-2 text-gray-400 hover:text-gray-500 dark:hover:text-gray-300 transition-colors"
                  title="User Profile"
                >
                  <UserCircleIcon className="h-6 w-6" />
                  {user && (
                    <span className="hidden md:block text-sm font-medium text-gray-700 dark:text-gray-200">
                      {user.name}
                    </span>
                  )}
                </button>
                <UserProfileModal
                  isOpen={userProfileOpen}
                  onClose={() => setUserProfileOpen(false)}
                />
              </div>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 relative z-0 overflow-y-auto focus:outline-none">
          <div className="py-6">
            <div className="px-4 sm:px-6 lg:px-8">
              {children}
            </div>
          </div>
        </main>
      </div>

      {/* Footer with quick links */}
      <div className="hidden lg:block lg:pl-80">
        <footer className="bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4 text-sm text-gray-500 dark:text-gray-400">
              <span>© 2025 Cartrita V2</span>
              <Link href="/about" className="hover:text-gray-700 dark:hover:text-gray-300 transition-colors">
                About
              </Link>
              <Link href="/manual" className="hover:text-gray-700 dark:hover:text-gray-300 transition-colors">
                Manual
              </Link>
              <Link href="/license" className="hover:text-gray-700 dark:hover:text-gray-300 transition-colors">
                License
              </Link>
            </div>
            <div className="flex items-center space-x-2 text-xs text-gray-400">
              <SparklesIcon className="w-4 h-4" />
              <span>Powered by Advanced AI</span>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}

interface SidebarContentProps {
  onClose?: () => void;
  navigation: NavItem[];
  bottomNavigation: NavItem[];
  isActiveRoute: (href: string) => boolean;
}

function SidebarContent({ onClose, navigation, bottomNavigation, isActiveRoute }: SidebarContentProps) {
  return (
    <div className="flex flex-col h-full">
      {/* Logo and close button */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
            <SparklesIcon className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-gray-900 dark:text-white">Cartrita V2</h1>
            <p className="text-xs text-gray-500 dark:text-gray-400">AI Orchestration Platform</p>
          </div>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 lg:hidden"
          >
            <XMarkIcon className="h-6 w-6" />
          </button>
        )}
      </div>

      {/* Main navigation */}
      <nav className="flex-1 px-4 py-4 space-y-1 overflow-y-auto">
        {navigation.map((item) => {
          const isActive = isActiveRoute(item.href);
          return (
            <Link
              key={item.name}
              href={item.href}
              onClick={onClose}
              className={`group flex items-center px-3 py-3 text-sm font-medium rounded-lg transition-all duration-200 ${
                isActive
                  ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border-r-2 border-blue-500'
                  : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              <item.icon
                className={`mr-3 h-5 w-5 flex-shrink-0 transition-colors ${
                  isActive ? item.color : 'text-gray-400 group-hover:text-gray-500 dark:group-hover:text-gray-300'
                }`}
              />
              <span className="flex-1">{item.name}</span>
              {item.badge && (
                <span className={`ml-2 px-2 py-1 text-xs rounded-full font-medium ${
                  item.badge === 'New' ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400' :
                  item.badge === 'Beta' ? 'bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-400' :
                  'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400'
                }`}>
                  {item.badge}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* System Status */}
      <div className="px-4 py-4 border-t border-gray-200 dark:border-gray-700">
        <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-900 dark:text-white">System Status</span>
            <ArrowTrendingUpIcon className="w-4 h-4 text-green-500" />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-600 dark:text-gray-300">AI Agents</span>
              <span className="text-green-600 dark:text-green-400 font-medium">15 Active</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-600 dark:text-gray-300">API Status</span>
              <span className="text-green-600 dark:text-green-400 font-medium">Online</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-600 dark:text-gray-300">Performance</span>
              <span className="text-green-600 dark:text-green-400 font-medium">Optimal</span>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom navigation */}
      <div className="px-4 py-4 border-t border-gray-200 dark:border-gray-700">
        <div className="space-y-1">
          {bottomNavigation.map((item) => (
            <Link
              key={item.name}
              href={item.href}
              onClick={onClose}
              className="group flex items-center px-3 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-white transition-colors"
            >
              <item.icon className={`mr-3 h-4 w-4 flex-shrink-0 ${item.color}`} />
              {item.name}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { 
  Menu, 
  Settings, 
  Sun, 
  Moon, 
  Monitor,
  User,
  LogOut,
  MessageSquare,
  MoreVertical
} from 'lucide-react';
import useAppStore, { 
  useSidebarOpen, 
  useTheme, 
  useUser, 
  useCurrentConversation 
} from '@/store';
import { cn } from '@/lib/utils';

const Header: React.FC = () => {
  const sidebarOpen = useSidebarOpen();
  const theme = useTheme();
  const user = useUser();
  const currentConversation = useCurrentConversation();
  
  const { 
    setSidebarOpen, 
    setSettingsOpen, 
    setTheme, 
    logout 
  } = useAppStore();

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  const getThemeIcon = () => {
    switch (theme) {
      case 'light':
        return <Sun className="w-4 h-4" />;
      case 'dark':
        return <Moon className="w-4 h-4" />;
      default:
        return <Monitor className="w-4 h-4" />;
    }
  };

  const cycleTheme = () => {
    const themes = ['light', 'dark', 'system'] as const;
    const currentIndex = themes.indexOf(theme);
    const nextIndex = (currentIndex + 1) % themes.length;
    setTheme(themes[nextIndex]);
  };

  return (
    <header className="flex items-center justify-between px-4 py-3 bg-background border-b border-gray-200 dark:border-gray-700">
      {/* Left Section */}
      <div className="flex items-center space-x-3">
        {/* Sidebar Toggle */}
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="p-2 rounded-lg hover:bg-accent transition-colors lg:hidden"
          aria-label="Toggle sidebar"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Title/Conversation Info */}
        <div className="flex items-center space-x-3">
          {currentConversation ? (
            <div className="flex items-center space-x-2">
              <MessageSquare className="w-5 h-5 text-muted-foreground" />
              <div>
                <h1 className="font-medium text-lg truncate max-w-[300px]">
                  {currentConversation.title}
                </h1>
                {currentConversation.summary && (
                  <p className="text-sm text-muted-foreground truncate max-w-[400px]">
                    {currentConversation.summary}
                  </p>
                )}
              </div>
            </div>
          ) : (
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">C</span>
              </div>
              <h1 className="font-bold text-xl bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                Cartrita
              </h1>
            </div>
          )}
        </div>
      </div>

      {/* Right Section */}
      <div className="flex items-center space-x-2">
        {/* Theme Toggle */}
        <button
          onClick={cycleTheme}
          className="p-2 rounded-lg hover:bg-accent transition-colors"
          aria-label="Toggle theme"
          title={`Current theme: ${theme}`}
        >
          {getThemeIcon()}
        </button>

        {/* User Menu */}
        {user ? (
          <div className="relative group">
            <button className="flex items-center space-x-2 p-2 rounded-lg hover:bg-accent transition-colors">
              <div className="w-7 h-7 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-sm font-medium">
                {user.name.charAt(0).toUpperCase()}
              </div>
              <span className="hidden sm:block text-sm font-medium">
                {user.name}
              </span>
            </button>

            {/* Dropdown Menu */}
            <div className="absolute right-0 top-full mt-2 w-48 bg-popover border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-10">
              <div className="p-2">
                <div className="px-3 py-2 border-b border-gray-200 dark:border-gray-700">
                  <p className="font-medium text-sm">{user.name}</p>
                  <p className="text-xs text-muted-foreground">{user.email}</p>
                </div>
                
                <button
                  onClick={() => setSettingsOpen(true)}
                  className="w-full flex items-center space-x-2 px-3 py-2 text-left text-sm hover:bg-accent rounded-md transition-colors"
                >
                  <Settings className="w-4 h-4" />
                  <span>Settings</span>
                </button>
                
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center space-x-2 px-3 py-2 text-left text-sm hover:bg-accent rounded-md transition-colors text-destructive"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Sign out</span>
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setSettingsOpen(true)}
              className="p-2 rounded-lg hover:bg-accent transition-colors"
              aria-label="Settings"
            >
              <Settings className="w-5 h-5" />
            </button>
          </div>
        )}
      </div>
    </header>
  );
};

export default Header;
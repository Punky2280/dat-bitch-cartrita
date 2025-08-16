// Mobile Navigation Component with Touch Gestures
// Provides app-like navigation with swipe gestures, tab bar, and responsive design

import React, { useState, useEffect } from 'react';
import { 
  MessageCircle, 
  Workflow, 
  Settings, 
  User, 
  Menu, 
  X, 
  ChevronLeft,
  Home,
  Search,
  Bell
} from 'lucide-react';
import { useTouchGestures } from '../../hooks/useTouchGestures';
import { useLocation, useNavigate } from 'react-router-dom';

interface NavItem {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  path: string;
  badge?: number;
}

interface MobileNavigationProps {
  className?: string;
}

const navItems: NavItem[] = [
  { id: 'chat', label: 'Chat', icon: MessageCircle, path: '/' },
  { id: 'workflows', label: 'Workflows', icon: Workflow, path: '/workflows' },
  { id: 'search', label: 'Search', icon: Search, path: '/search' },
  { id: 'notifications', label: 'Notifications', icon: Bell, path: '/notifications', badge: 3 },
  { id: 'settings', label: 'Settings', icon: Settings, path: '/settings' }
];

export const MobileNavigation: React.FC<MobileNavigationProps> = ({ className = '' }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('chat');

  // Update active tab based on current route
  useEffect(() => {
    const currentItem = navItems.find(item => item.path === location.pathname) || navItems[0];
    setActiveTab(currentItem.id);
  }, [location.pathname]);

  const handleTabChange = (itemId: string) => {
    const item = navItems.find(n => n.id === itemId);
    if (item) {
      setActiveTab(itemId);
      navigate(item.path);
    }
  };

  // Touch gesture support for tab switching
  const gestureRef = useTouchGestures({
    onSwipe: (gesture) => {
      if (gesture.direction === 'left' || gesture.direction === 'right') {
        const currentIndex = navItems.findIndex(item => item.id === activeTab);
        let nextIndex;
        
        if (gesture.direction === 'left' && currentIndex < navItems.length - 1) {
          nextIndex = currentIndex + 1;
        } else if (gesture.direction === 'right' && currentIndex > 0) {
          nextIndex = currentIndex - 1;
        }
        
        if (nextIndex !== undefined) {
          handleTabChange(navItems[nextIndex].id);
        }
      }
    },
    swipeThreshold: 50
  });

  return (
    <nav className={`mobile-navigation ${className}`} ref={gestureRef}>
      {/* Tab Bar */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-surface-glass-primary backdrop-blur-xl border-t border-glass-border">
        <div className="flex items-center justify-around px-2 py-2 safe-area-pb">
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            const Icon = item.icon;
            
            return (
              <button
                key={item.id}
                onClick={() => handleTabChange(item.id)}
                className={`relative flex flex-col items-center justify-center p-3 rounded-xl transition-all duration-200 min-w-0 ${
                  isActive 
                    ? 'bg-interactive-primary text-white' 
                    : 'text-secondary hover:text-primary hover:bg-glass-secondary'
                }`}
              >
                <div className="relative">
                  <Icon className={`w-5 h-5 ${isActive ? 'animate-bounce-subtle' : ''}`} />
                  {item.badge && (
                    <span className="absolute -top-2 -right-2 w-4 h-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                      {item.badge > 9 ? '9+' : item.badge}
                    </span>
                  )}
                </div>
                <span className={`text-xs mt-1 font-medium truncate ${
                  isActive ? 'text-white' : 'text-inherit'
                }`}>
                  {item.label}
                </span>
                
                {/* Active indicator */}
                {isActive && (
                  <div className="absolute -top-1 left-1/2 transform -translate-x-1/2 w-6 h-1 bg-white rounded-full" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Swipe indicator */}
      <div className="fixed bottom-16 left-1/2 transform -translate-x-1/2 z-30 opacity-40">
        <div className="flex space-x-1">
          {navItems.map((_, index) => (
            <div
              key={index}
              className={`w-2 h-2 rounded-full transition-all duration-200 ${
                index === navItems.findIndex(item => item.id === activeTab)
                  ? 'bg-purple-400 scale-125'
                  : 'bg-gray-500'
              }`}
            />
          ))}
        </div>
      </div>
    </nav>
  );
};

// Mobile Header Component
interface MobileHeaderProps {
  title?: string;
  showBack?: boolean;
  onBack?: () => void;
  actions?: React.ReactNode;
  className?: string;
}

export const MobileHeader: React.FC<MobileHeaderProps> = ({
  title,
  showBack = false,
  onBack,
  actions,
  className = ''
}) => {
  const navigate = useNavigate();

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      navigate(-1);
    }
  };

  return (
    <header className={`mobile-header ${className}`}>
      <div className="fixed top-0 left-0 right-0 z-40 bg-surface-glass-primary backdrop-blur-xl border-b border-glass-border">
        <div className="flex items-center justify-between px-4 py-3 safe-area-pt">
          {/* Left side */}
          <div className="flex items-center space-x-3">
            {showBack && (
              <button
                onClick={handleBack}
                className="p-2 hover:bg-glass-secondary rounded-xl transition-colors"
              >
                <ChevronLeft className="w-5 h-5 text-primary" />
              </button>
            )}
            
            {title && (
              <h1 className="text-lg font-semibold text-primary truncate">
                {title}
              </h1>
            )}
          </div>

          {/* Right side actions */}
          {actions && (
            <div className="flex items-center space-x-2">
              {actions}
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

// Mobile Sidebar/Drawer Component
interface MobileSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  side?: 'left' | 'right';
  className?: string;
}

export const MobileSidebar: React.FC<MobileSidebarProps> = ({
  isOpen,
  onClose,
  children,
  side = 'left',
  className = ''
}) => {
  // Close on swipe away
  const gestureRef = useTouchGestures({
    onSwipe: (gesture) => {
      if (isOpen) {
        if ((side === 'left' && gesture.direction === 'left') ||
            (side === 'right' && gesture.direction === 'right')) {
          onClose();
        }
      }
    },
    swipeThreshold: 100
  });

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }

    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Sidebar */}
      <div
        ref={gestureRef}
        className={`absolute top-0 bottom-0 w-80 max-w-[85vw] bg-surface-glass-primary backdrop-blur-xl border-glass-border ${
          side === 'left' 
            ? 'left-0 border-r animate-slide-in-left' 
            : 'right-0 border-l animate-slide-in-right'
        } ${className}`}
      >
        {/* Handle */}
        <div className={`absolute top-1/2 transform -translate-y-1/2 w-1 h-12 bg-gray-400 rounded-full ${
          side === 'left' ? '-right-1' : '-left-1'
        }`} />
        
        {children}
      </div>
    </div>
  );
};

// Mobile Bottom Sheet Component
interface MobileBottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  snapPoints?: number[]; // Heights in pixels or percentages
  className?: string;
}

export const MobileBottomSheet: React.FC<MobileBottomSheetProps> = ({
  isOpen,
  onClose,
  children,
  snapPoints = [300, 600],
  className = ''
}) => {
  const [currentSnap, setCurrentSnap] = useState(0);

  // Handle drag gestures for resizing
  const gestureRef = useTouchGestures({
    onSwipe: (gesture) => {
      if (gesture.direction === 'down' && gesture.velocity > 0.5) {
        if (currentSnap < snapPoints.length - 1) {
          setCurrentSnap(currentSnap + 1);
        } else {
          onClose();
        }
      } else if (gesture.direction === 'up' && gesture.velocity > 0.5) {
        if (currentSnap > 0) {
          setCurrentSnap(currentSnap - 1);
        }
      }
    },
    swipeThreshold: 30
  });

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }

    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const currentHeight = snapPoints[currentSnap];

  return (
    <div className="fixed inset-0 z-50">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Bottom Sheet */}
      <div
        ref={gestureRef}
        className={`absolute bottom-0 left-0 right-0 bg-surface-glass-primary backdrop-blur-xl border-t border-glass-border rounded-t-3xl animate-slide-in-bottom transition-all duration-300 ${className}`}
        style={{ height: typeof currentHeight === 'number' ? `${currentHeight}px` : currentHeight }}
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-2">
          <div className="w-12 h-1.5 bg-gray-400 rounded-full" />
        </div>
        
        {/* Content */}
        <div className="flex-1 overflow-auto px-4 pb-safe">
          {children}
        </div>
      </div>
    </div>
  );
};

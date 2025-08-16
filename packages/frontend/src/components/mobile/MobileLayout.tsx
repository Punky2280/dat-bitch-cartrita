// Mobile Layout Component
// Provides a responsive, mobile-first layout with PWA features

import React, { useEffect, useState } from 'react';
import { MobileNavigation, MobileHeader } from './MobileNavigation';
import { PWAInstallPrompt, PWAStatus, PWAUpdateBanner } from '../pwa/PWAInstallPrompt';
import { usePWACapabilities, usePWAUpdate, usePWAInstall } from '../../hooks/usePWA';
import { usePullToRefresh } from '../../hooks/useTouchGestures';
import { RefreshCw, Wifi, WifiOff } from 'lucide-react';

interface MobileLayoutProps {
  children: React.ReactNode;
  title?: string;
  showHeader?: boolean;
  showNavigation?: boolean;
  showPWAPrompt?: boolean;
  onRefresh?: () => Promise<void>;
  headerActions?: React.ReactNode;
  className?: string;
}

export const MobileLayout: React.FC<MobileLayoutProps> = ({
  children,
  title,
  showHeader = true,
  showNavigation = true,
  showPWAPrompt = true,
  onRefresh,
  headerActions,
  className = ''
}) => {
  const capabilities = usePWACapabilities();
  const { updateAvailable } = usePWAUpdate();
  const { canInstall } = usePWAInstall();
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);

  // Pull to refresh functionality
  const {
    ref: pullToRefreshRef,
    isPulling,
    pullDistance,
    isRefreshing,
    pullProgress
  } = usePullToRefresh({
    onRefresh: onRefresh || (async () => {
      // Default refresh - reload the page
      window.location.reload();
    }),
    disabled: !onRefresh
  });

  // Show install prompt after a delay
  useEffect(() => {
    if (canInstall && showPWAPrompt && !capabilities.isStandalone) {
      const timer = setTimeout(() => {
        setShowInstallPrompt(true);
      }, 5000); // Show after 5 seconds

      return () => clearTimeout(timer);
    }
  }, [canInstall, showPWAPrompt, capabilities.isStandalone]);

  return (
    <div className={`mobile-layout mobile-viewport ${className}`}>
      {/* PWA Update Banner */}
      {updateAvailable && (
        <PWAUpdateBanner className="fixed top-0 left-0 right-0 z-50 m-4" />
      )}

      {/* Mobile Header */}
      {showHeader && (
        <MobileHeader
          title={title}
          actions={
            <div className="flex items-center space-x-2">
              <PWAStatus />
              {headerActions}
            </div>
          }
        />
      )}

      {/* Pull to Refresh Indicator */}
      {isPulling && (
        <div 
          className="fixed top-0 left-1/2 transform -translate-x-1/2 z-30 transition-all duration-200"
          style={{ 
            top: `${Math.min(pullDistance * 0.5, 60)}px`,
            opacity: pullProgress 
          }}
        >
          <div className="bg-surface-glass-primary backdrop-blur-xl border border-glass-border rounded-full p-3 shadow-lg">
            <RefreshCw 
              className={`w-5 h-5 text-primary ${isRefreshing ? 'animate-spin' : ''}`}
              style={{
                transform: `rotate(${pullProgress * 180}deg)`
              }}
            />
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <main 
        ref={pullToRefreshRef}
        className={`mobile-content scroll-smooth-touch ${
          showHeader ? 'pt-16' : ''
        } ${showNavigation ? 'pb-20' : ''}`}
      >
        {/* Offline Indicator */}
        {capabilities.isOffline && (
          <div className="sticky top-0 z-20 bg-red-500/20 border border-red-500/30 rounded-lg mx-4 mt-4 p-3">
            <div className="flex items-center space-x-2 text-red-400">
              <WifiOff className="w-4 h-4" />
              <span className="text-sm font-medium">You're offline</span>
            </div>
            <p className="text-xs text-red-300 mt-1">
              Some features may be limited. Connect to the internet for full functionality.
            </p>
          </div>
        )}

        {/* PWA Install Prompt */}
        {showInstallPrompt && canInstall && !capabilities.isStandalone && (
          <div className="mx-4 mt-4">
            <PWAInstallPrompt
              variant="banner"
              onDismiss={() => setShowInstallPrompt(false)}
            />
          </div>
        )}

        {/* Content */}
        <div className="flex-1">
          {children}
        </div>
      </main>

      {/* Mobile Navigation */}
      {showNavigation && <MobileNavigation />}
    </div>
  );
};

// Mobile Container Component
interface MobileContainerProps {
  children: React.ReactNode;
  size?: 'mobile' | 'tablet' | 'full';
  padding?: 'none' | 'sm' | 'base' | 'lg';
  className?: string;
}

export const MobileContainer: React.FC<MobileContainerProps> = ({
  children,
  size = 'mobile',
  padding = 'base',
  className = ''
}) => {
  const containerClasses = {
    mobile: 'container-mobile',
    tablet: 'container-tablet',
    full: 'w-full'
  };

  const paddingClasses = {
    none: '',
    sm: 'px-2 py-2',
    base: 'px-4 py-4',
    lg: 'px-6 py-6'
  };

  return (
    <div className={`${containerClasses[size]} ${paddingClasses[padding]} ${className}`}>
      {children}
    </div>
  );
};

// Mobile Card Component
interface MobileCardProps {
  children: React.ReactNode;
  interactive?: boolean;
  onClick?: () => void;
  className?: string;
}

export const MobileCard: React.FC<MobileCardProps> = ({
  children,
  interactive = false,
  onClick,
  className = ''
}) => {
  const baseClasses = 'card-mobile';
  const interactiveClasses = interactive ? 'touch-feedback cursor-pointer' : '';

  return (
    <div
      className={`${baseClasses} ${interactiveClasses} ${className}`}
      onClick={onClick}
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
    >
      {children}
    </div>
  );
};

// Mobile Button Component
interface MobileButtonProps {
  children: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  size?: 'sm' | 'base' | 'lg';
  fullWidth?: boolean;
  disabled?: boolean;
  loading?: boolean;
  onClick?: () => void;
  className?: string;
}

export const MobileButton: React.FC<MobileButtonProps> = ({
  children,
  variant = 'primary',
  size = 'base',
  fullWidth = false,
  disabled = false,
  loading = false,
  onClick,
  className = ''
}) => {
  const baseClasses = 'btn-touch touch-feedback inline-flex items-center justify-center font-medium transition-all';
  
  const variantClasses = {
    primary: 'bg-interactive-primary text-white hover:bg-interactive-primary-hover',
    secondary: 'bg-surface-glass-secondary text-primary hover:bg-surface-glass-primary',
    outline: 'border border-glass-border text-primary hover:bg-surface-glass-secondary',
    ghost: 'text-primary hover:bg-surface-glass-secondary'
  };

  const sizeClasses = {
    sm: 'text-sm px-3 py-2 min-h-[36px]',
    base: 'text-base px-4 py-3 min-h-[44px]',
    lg: 'text-lg px-6 py-4 min-h-[52px]'
  };

  const widthClasses = fullWidth ? 'w-full' : '';
  const disabledClasses = disabled || loading ? 'opacity-50 pointer-events-none' : '';

  return (
    <button
      className={`${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${widthClasses} ${disabledClasses} ${className}`}
      onClick={onClick}
      disabled={disabled || loading}
    >
      {loading && (
        <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
      )}
      {children}
    </button>
  );
};

// Mobile Input Component
interface MobileInputProps {
  type?: 'text' | 'email' | 'password' | 'number' | 'search' | 'tel' | 'url';
  placeholder?: string;
  value?: string;
  onChange?: (value: string) => void;
  onFocus?: () => void;
  onBlur?: () => void;
  disabled?: boolean;
  required?: boolean;
  autoComplete?: string;
  className?: string;
}

export const MobileInput: React.FC<MobileInputProps> = ({
  type = 'text',
  placeholder,
  value,
  onChange,
  onFocus,
  onBlur,
  disabled = false,
  required = false,
  autoComplete,
  className = ''
}) => {
  return (
    <input
      type={type}
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange?.(e.target.value)}
      onFocus={onFocus}
      onBlur={onBlur}
      disabled={disabled}
      required={required}
      autoComplete={autoComplete}
      className={`input-mobile ${className}`}
    />
  );
};

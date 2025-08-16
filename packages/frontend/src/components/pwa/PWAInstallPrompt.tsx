// PWA Install Prompt Component
// Provides a user-friendly interface for installing the PWA

import React, { useState } from 'react';
import { Download, X, Smartphone, Monitor, Zap, Wifi, WifiOff } from 'lucide-react';
import { usePWAInstall, usePWACapabilities } from '../../hooks/usePWA';

interface PWAInstallPromptProps {
  onDismiss?: () => void;
  variant?: 'banner' | 'modal' | 'card';
  className?: string;
}

export const PWAInstallPrompt: React.FC<PWAInstallPromptProps> = ({
  onDismiss,
  variant = 'banner',
  className = ''
}) => {
  const { canInstall, isInstalling, install } = usePWAInstall();
  const capabilities = usePWACapabilities();
  const [isDismissed, setIsDismissed] = useState(false);

  if (!canInstall || isDismissed || capabilities.isStandalone) {
    return null;
  }

  const handleInstall = async () => {
    const success = await install();
    if (success && onDismiss) {
      onDismiss();
    }
  };

  const handleDismiss = () => {
    setIsDismissed(true);
    onDismiss?.();
  };

  const features = [
    { icon: Zap, text: 'Faster loading' },
    { icon: Smartphone, text: 'Works offline' },
    { icon: Monitor, text: 'Full screen experience' }
  ];

  if (variant === 'banner') {
    return (
      <div className={`glass-surface-primary p-4 rounded-lg border border-glass-border ${className}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-gradient-to-r from-purple-500 to-blue-500 rounded-lg">
              <Download className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-primary">Install Cartrita AI</h3>
              <p className="text-sm text-secondary">Get the full app experience</p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={handleInstall}
              disabled={isInstalling}
              className="btn-primary text-sm px-4 py-2"
            >
              {isInstalling ? 'Installing...' : 'Install'}
            </button>
            <button
              onClick={handleDismiss}
              className="p-2 hover:bg-glass-secondary rounded-lg transition-colors"
            >
              <X className="w-4 h-4 text-tertiary" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (variant === 'card') {
    return (
      <div className={`glass-surface-primary p-6 rounded-xl border border-glass-border ${className}`}>
        <div className="text-center">
          <div className="mx-auto mb-4 w-16 h-16 bg-gradient-to-r from-purple-500 to-blue-500 rounded-2xl flex items-center justify-center">
            <Download className="w-8 h-8 text-white" />
          </div>
          
          <h3 className="text-xl font-semibold text-primary mb-2">
            Install Cartrita AI
          </h3>
          
          <p className="text-secondary mb-4">
            Get faster access and a better experience with our app
          </p>
          
          <div className="grid grid-cols-3 gap-4 mb-6">
            {features.map((feature, index) => (
              <div key={index} className="text-center">
                <feature.icon className="w-6 h-6 text-purple-400 mx-auto mb-2" />
                <p className="text-xs text-secondary">{feature.text}</p>
              </div>
            ))}
          </div>
          
          <div className="flex space-x-3">
            <button
              onClick={handleDismiss}
              className="btn-secondary flex-1"
            >
              Maybe Later
            </button>
            <button
              onClick={handleInstall}
              disabled={isInstalling}
              className="btn-primary flex-1"
            >
              {isInstalling ? 'Installing...' : 'Install App'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Modal variant
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="glass-surface-primary p-8 rounded-2xl max-w-md w-full border border-glass-border">
        <div className="text-center">
          <div className="mx-auto mb-6 w-20 h-20 bg-gradient-to-r from-purple-500 to-blue-500 rounded-3xl flex items-center justify-center">
            <Download className="w-10 h-10 text-white" />
          </div>
          
          <h2 className="text-2xl font-bold text-primary mb-3">
            Install Cartrita AI
          </h2>
          
          <p className="text-secondary mb-6">
            Install our app for a faster, more reliable experience with offline support
          </p>
          
          <div className="space-y-3 mb-8">
            {features.map((feature, index) => (
              <div key={index} className="flex items-center space-x-3 text-left">
                <div className="p-2 bg-purple-500/20 rounded-lg">
                  <feature.icon className="w-4 h-4 text-purple-400" />
                </div>
                <span className="text-secondary">{feature.text}</span>
              </div>
            ))}
          </div>
          
          <div className="flex space-x-4">
            <button
              onClick={handleDismiss}
              className="btn-secondary flex-1"
            >
              Not Now
            </button>
            <button
              onClick={handleInstall}
              disabled={isInstalling}
              className="btn-primary flex-1"
            >
              {isInstalling ? 'Installing...' : 'Install'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// PWA Status Indicator Component
export const PWAStatus: React.FC<{ className?: string }> = ({ className = '' }) => {
  const capabilities = usePWACapabilities();

  return (
    <div className={`flex items-center space-x-2 ${className}`}>
      {/* Online/Offline Status */}
      <div className={`flex items-center space-x-1 text-xs px-2 py-1 rounded-full ${
        capabilities.isOffline 
          ? 'bg-red-500/20 text-red-400' 
          : 'bg-green-500/20 text-green-400'
      }`}>
        {capabilities.isOffline ? (
          <WifiOff className="w-3 h-3" />
        ) : (
          <Wifi className="w-3 h-3" />
        )}
        <span>{capabilities.isOffline ? 'Offline' : 'Online'}</span>
      </div>

      {/* Standalone App Indicator */}
      {capabilities.isStandalone && (
        <div className="flex items-center space-x-1 text-xs px-2 py-1 rounded-full bg-purple-500/20 text-purple-400">
          <Smartphone className="w-3 h-3" />
          <span>App</span>
        </div>
      )}
    </div>
  );
};

// PWA Update Banner Component
export const PWAUpdateBanner: React.FC<{ className?: string }> = ({ className = '' }) => {
  const [isVisible, setIsVisible] = useState(true);

  if (!isVisible) {
    return null;
  }

  return (
    <div className={`glass-surface-primary p-3 rounded-lg border border-blue-500/30 ${className}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="p-1.5 bg-blue-500/20 rounded-lg">
            <Download className="w-4 h-4 text-blue-400" />
          </div>
          <div>
            <p className="text-sm font-medium text-primary">Update Available</p>
            <p className="text-xs text-secondary">New features and improvements ready</p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <button className="btn-primary text-xs px-3 py-1.5">
            Update
          </button>
          <button
            onClick={() => setIsVisible(false)}
            className="p-1.5 hover:bg-glass-secondary rounded-lg transition-colors"
          >
            <X className="w-3 h-3 text-tertiary" />
          </button>
        </div>
      </div>
    </div>
  );
};

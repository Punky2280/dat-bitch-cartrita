// React hooks for PWA functionality
// Provides easy integration of PWA features in React components

import { useState, useEffect, useCallback } from 'react';
import { pwaService, PWACapabilities } from '../services/PWAService';

// Hook for managing PWA installation
export function usePWAInstall() {
  const [canInstall, setCanInstall] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);

  useEffect(() => {
    const unsubscribe = pwaService.onInstallPromptChange(setCanInstall);
    return unsubscribe;
  }, []);

  const install = useCallback(async () => {
    if (!canInstall || isInstalling) {
      return false;
    }

    setIsInstalling(true);
    try {
      const success = await pwaService.installApp();
      return success;
    } finally {
      setIsInstalling(false);
    }
  }, [canInstall, isInstalling]);

  return {
    canInstall,
    isInstalling,
    install
  };
}

// Hook for online/offline status
export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const unsubscribe = pwaService.onOnlineStatusChange(setIsOnline);
    return unsubscribe;
  }, []);

  return isOnline;
}

// Hook for PWA updates
export function usePWAUpdate() {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    const unsubscribe = pwaService.onUpdateAvailable(setUpdateAvailable);
    return unsubscribe;
  }, []);

  const applyUpdate = useCallback(async () => {
    if (!updateAvailable || isUpdating) {
      return;
    }

    setIsUpdating(true);
    try {
      await pwaService.applyUpdate();
    } finally {
      setIsUpdating(false);
    }
  }, [updateAvailable, isUpdating]);

  return {
    updateAvailable,
    isUpdating,
    applyUpdate
  };
}

// Hook for PWA capabilities
export function usePWACapabilities() {
  const [capabilities, setCapabilities] = useState<PWACapabilities>(() => 
    pwaService.getCapabilities()
  );

  useEffect(() => {
    // Update capabilities when online status changes
    const unsubscribe = pwaService.onOnlineStatusChange(() => {
      setCapabilities(pwaService.getCapabilities());
    });

    // Update capabilities when install state changes
    const unsubscribeInstall = pwaService.onInstallPromptChange(() => {
      setCapabilities(pwaService.getCapabilities());
    });

    return () => {
      unsubscribe();
      unsubscribeInstall();
    };
  }, []);

  return capabilities;
}

// Hook for notifications
export function useNotifications() {
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [isRequesting, setIsRequesting] = useState(false);

  useEffect(() => {
    if ('Notification' in window) {
      setPermission(Notification.permission);
    }
  }, []);

  const requestPermission = useCallback(async () => {
    if (isRequesting || permission === 'granted') {
      return permission;
    }

    setIsRequesting(true);
    try {
      const newPermission = await pwaService.requestNotificationPermission();
      setPermission(newPermission);
      return newPermission;
    } finally {
      setIsRequesting(false);
    }
  }, [permission, isRequesting]);

  const showNotification = useCallback(async (
    title: string, 
    options?: NotificationOptions
  ) => {
    if (permission !== 'granted') {
      console.warn('Notification permission not granted');
      return;
    }

    await pwaService.showNotification(title, options);
  }, [permission]);

  return {
    permission,
    isRequesting,
    requestPermission,
    showNotification,
    isSupported: 'Notification' in window
  };
}

// Hook for PWA lifecycle management
export function usePWALifecycle() {
  const [isStandalone, setIsStandalone] = useState(false);
  const [swVersion, setSwVersion] = useState<string>('unknown');

  useEffect(() => {
    // Check if running as standalone app
    const checkStandalone = () => {
      const standalone = window.matchMedia('(display-mode: standalone)').matches ||
                        (window.navigator as any).standalone === true;
      setIsStandalone(standalone);
    };

    checkStandalone();
    
    // Listen for display mode changes
    const mediaQuery = window.matchMedia('(display-mode: standalone)');
    mediaQuery.addEventListener('change', checkStandalone);

    // Get service worker version
    pwaService.getVersion().then(setSwVersion);

    return () => {
      mediaQuery.removeEventListener('change', checkStandalone);
    };
  }, []);

  const clearCache = useCallback(async () => {
    await pwaService.clearCache();
    // Refresh version after clearing cache
    const version = await pwaService.getVersion();
    setSwVersion(version);
  }, []);

  return {
    isStandalone,
    swVersion,
    clearCache
  };
}

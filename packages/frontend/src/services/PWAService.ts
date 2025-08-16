// PWA Service for managing Progressive Web App features
// Handles service worker registration, installation prompts, and offline detection

export interface PWAInstallPrompt {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export interface PWACapabilities {
  isStandalone: boolean;
  isInstallable: boolean;
  isOffline: boolean;
  hasServiceWorker: boolean;
  supportsNotifications: boolean;
  supportsPush: boolean;
  supportsBackgroundSync: boolean;
}

class PWAService {
  private installPrompt: PWAInstallPrompt | null = null;
  private swRegistration: ServiceWorkerRegistration | null = null;
  private updateAvailable = false;
  private onlineStatusCallbacks: Set<(isOnline: boolean) => void> = new Set();
  private installPromptCallbacks: Set<(canInstall: boolean) => void> = new Set();
  private updateCallbacks: Set<(updateAvailable: boolean) => void> = new Set();

  constructor() {
    this.init();
  }

  private async init(): Promise<void> {
    // Register service worker
    await this.registerServiceWorker();

    // Set up install prompt handling
    this.setupInstallPrompt();

    // Set up online/offline detection
    this.setupOnlineDetection();

    // Set up update detection
    this.setupUpdateDetection();
  }

  // Service Worker Registration
  private async registerServiceWorker(): Promise<void> {
    if (!('serviceWorker' in navigator)) {
      console.warn('[PWA] Service Worker not supported');
      return;
    }

    try {
      this.swRegistration = await navigator.serviceWorker.register('/sw.js', {
        scope: '/'
      });

      console.log('[PWA] Service Worker registered successfully');

      // Handle service worker updates
      this.swRegistration.addEventListener('updatefound', () => {
        const newWorker = this.swRegistration?.installing;
        if (newWorker) {
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              // New version available
              this.updateAvailable = true;
              this.notifyUpdateCallbacks(true);
            }
          });
        }
      });

      // Handle controller changes (new service worker activated)
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (this.updateAvailable) {
          // Refresh to get the new version
          window.location.reload();
        }
      });

    } catch (error) {
      console.error('[PWA] Service Worker registration failed:', error);
    }
  }

  // Install Prompt Management
  private setupInstallPrompt(): void {
    window.addEventListener('beforeinstallprompt', (event) => {
      // Prevent default install prompt
      event.preventDefault();
      
      // Store the install prompt
      this.installPrompt = event as any;
      
      // Notify listeners that app can be installed
      this.notifyInstallPromptCallbacks(true);
      
      console.log('[PWA] Install prompt ready');
    });

    window.addEventListener('appinstalled', () => {
      console.log('[PWA] App installed successfully');
      this.installPrompt = null;
      this.notifyInstallPromptCallbacks(false);
    });
  }

  // Online/Offline Detection
  private setupOnlineDetection(): void {
    const updateOnlineStatus = () => {
      const isOnline = navigator.onLine;
      console.log('[PWA] Network status:', isOnline ? 'online' : 'offline');
      this.notifyOnlineStatusCallbacks(isOnline);
    };

    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);

    // Initial status
    setTimeout(updateOnlineStatus, 100);
  }

  // Update Detection
  private setupUpdateDetection(): void {
    // Check for updates every 5 minutes when app is active
    setInterval(() => {
      if (document.visibilityState === 'visible' && this.swRegistration) {
        this.swRegistration.update();
      }
    }, 5 * 60 * 1000);

    // Check for updates when app becomes visible
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && this.swRegistration) {
        this.swRegistration.update();
      }
    });
  }

  // Public API Methods

  // Install the PWA
  async installApp(): Promise<boolean> {
    if (!this.installPrompt) {
      console.warn('[PWA] No install prompt available');
      return false;
    }

    try {
      await this.installPrompt.prompt();
      const result = await this.installPrompt.userChoice;
      
      if (result.outcome === 'accepted') {
        console.log('[PWA] User accepted install prompt');
        this.installPrompt = null;
        this.notifyInstallPromptCallbacks(false);
        return true;
      } else {
        console.log('[PWA] User dismissed install prompt');
        return false;
      }
    } catch (error) {
      console.error('[PWA] Install prompt failed:', error);
      return false;
    }
  }

  // Check if app can be installed
  canInstall(): boolean {
    return this.installPrompt !== null;
  }

  // Get PWA capabilities
  getCapabilities(): PWACapabilities {
    return {
      isStandalone: window.matchMedia('(display-mode: standalone)').matches ||
                   (window.navigator as any).standalone === true,
      isInstallable: this.canInstall(),
      isOffline: !navigator.onLine,
      hasServiceWorker: 'serviceWorker' in navigator && this.swRegistration !== null,
      supportsNotifications: 'Notification' in window,
      supportsPush: 'PushManager' in window,
      supportsBackgroundSync: 'serviceWorker' in navigator && 'sync' in window.ServiceWorkerRegistration.prototype
    };
  }

  // Apply app update
  async applyUpdate(): Promise<void> {
    if (!this.swRegistration || !this.updateAvailable) {
      return;
    }

    const waiting = this.swRegistration.waiting;
    if (waiting) {
      waiting.postMessage({ type: 'SKIP_WAITING' });
      this.updateAvailable = false;
      this.notifyUpdateCallbacks(false);
    }
  }

  // Check if update is available
  hasUpdate(): boolean {
    return this.updateAvailable;
  }

  // Request notification permission
  async requestNotificationPermission(): Promise<NotificationPermission> {
    if (!('Notification' in window)) {
      return 'denied';
    }

    const permission = await Notification.requestPermission();
    console.log('[PWA] Notification permission:', permission);
    return permission;
  }

  // Show notification
  async showNotification(title: string, options?: NotificationOptions): Promise<void> {
    if (!this.swRegistration) {
      console.warn('[PWA] No service worker registration for notifications');
      return;
    }

    const permission = await this.requestNotificationPermission();
    if (permission !== 'granted') {
      console.warn('[PWA] Notification permission not granted');
      return;
    }

    const defaultOptions: NotificationOptions = {
      icon: '/icons/icon-192x192.png',
      badge: '/icons/badge-72x72.png',
      tag: 'cartrita-notification',
      renotify: true,
      ...options
    };

    await this.swRegistration.showNotification(title, defaultOptions);
  }

  // Clear cache (for debugging/reset)
  async clearCache(): Promise<void> {
    if (!this.swRegistration) {
      return;
    }

    return new Promise((resolve) => {
      const messageChannel = new MessageChannel();
      messageChannel.port1.onmessage = (event) => {
        if (event.data.success) {
          console.log('[PWA] Cache cleared successfully');
        }
        resolve();
      };

      this.swRegistration!.active?.postMessage(
        { type: 'CLEAR_CACHE' },
        [messageChannel.port2]
      );
    });
  }

  // Get service worker version
  async getVersion(): Promise<string> {
    if (!this.swRegistration) {
      return 'unknown';
    }

    return new Promise((resolve) => {
      const messageChannel = new MessageChannel();
      messageChannel.port1.onmessage = (event) => {
        resolve(event.data.version || 'unknown');
      };

      this.swRegistration!.active?.postMessage(
        { type: 'GET_VERSION' },
        [messageChannel.port2]
      );
    });
  }

  // Event subscription methods
  onOnlineStatusChange(callback: (isOnline: boolean) => void): () => void {
    this.onlineStatusCallbacks.add(callback);
    
    // Call immediately with current status
    callback(navigator.onLine);
    
    return () => {
      this.onlineStatusCallbacks.delete(callback);
    };
  }

  onInstallPromptChange(callback: (canInstall: boolean) => void): () => void {
    this.installPromptCallbacks.add(callback);
    
    // Call immediately with current status
    callback(this.canInstall());
    
    return () => {
      this.installPromptCallbacks.delete(callback);
    };
  }

  onUpdateAvailable(callback: (updateAvailable: boolean) => void): () => void {
    this.updateCallbacks.add(callback);
    
    // Call immediately with current status
    callback(this.updateAvailable);
    
    return () => {
      this.updateCallbacks.delete(callback);
    };
  }

  // Private notification methods
  private notifyOnlineStatusCallbacks(isOnline: boolean): void {
    this.onlineStatusCallbacks.forEach(callback => {
      try {
        callback(isOnline);
      } catch (error) {
        console.error('[PWA] Error in online status callback:', error);
      }
    });
  }

  private notifyInstallPromptCallbacks(canInstall: boolean): void {
    this.installPromptCallbacks.forEach(callback => {
      try {
        callback(canInstall);
      } catch (error) {
        console.error('[PWA] Error in install prompt callback:', error);
      }
    });
  }

  private notifyUpdateCallbacks(updateAvailable: boolean): void {
    this.updateCallbacks.forEach(callback => {
      try {
        callback(updateAvailable);
      } catch (error) {
        console.error('[PWA] Error in update callback:', error);
      }
    });
  }
}

// Create singleton instance
export const pwaService = new PWAService();

// Export types
export type { PWACapabilities };

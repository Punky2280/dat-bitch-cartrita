import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// Safe storage wrapper with error handling
const safeStorage = {
  getItem: (name: string) => {
    if (typeof window === 'undefined') {
      return null;
    }
    try {
      return localStorage.getItem(name);
    } catch (error) {
      console.warn('[Storage] Unable to read from localStorage:', error);
      return null;
    }
  },
  setItem: (name: string, value: string) => {
    if (typeof window === 'undefined') {
      return;
    }
    try {
      localStorage.setItem(name, value);
    } catch (error) {
      console.warn('[Storage] Unable to write to localStorage:', error);
    }
  },
  removeItem: (name: string) => {
    if (typeof window === 'undefined') {
      return;
    }
    try {
      localStorage.removeItem(name);
    } catch (error) {
      console.warn('[Storage] Unable to remove from localStorage:', error);
    }
  },
};

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  avatar?: string;
  role: 'admin' | 'user' | 'developer' | 'viewer';
  permissions: string[];
  preferences: {
    theme: 'light' | 'dark' | 'system';
    language: string;
    timezone: string;
    notifications: {
      email: boolean;
      push: boolean;
      desktop: boolean;
    };
    accessibility: {
      reducedMotion: boolean;
      highContrast: boolean;
      fontSize: 'small' | 'medium' | 'large';
    };
  };
  subscription: {
    plan: 'free' | 'pro' | 'enterprise';
    status: 'active' | 'inactive' | 'trial' | 'expired';
    expiresAt?: Date;
    features: string[];
  };
  usage: {
    apiCalls: number;
    tokensUsed: number;
    agentsCreated: number;
    lastActive: Date;
  };
  security: {
    twoFactorEnabled: boolean;
    lastPasswordChange: Date;
    activeSessions: number;
    loginHistory: LoginAttempt[];
  };
}

export interface LoginAttempt {
  id: string;
  timestamp: Date;
  location: string;
  device: string;
  ip: string;
  success: boolean;
}

interface UserState {
  user: UserProfile | null;
  isAuthenticated: boolean;
  loading: boolean;
  error: string | null;
  
  // Actions
  setUser: (user: UserProfile) => void;
  updateProfile: (updates: Partial<UserProfile>) => void;
  updatePreferences: (preferences: Partial<UserProfile['preferences']>) => void;
  logout: () => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  
  // Business logic
  hasPermission: (permission: string) => boolean;
  canAccessFeature: (feature: string) => boolean;
  getRemainingApiCalls: () => number;
  getUsagePercentage: () => number;
}

export const useUserStore = create<UserState>()(
  persist(
    (set, get) => ({
      user: null,
      isAuthenticated: false,
      loading: false,
      error: null,

      setUser: (user) => {
        set({
          user,
          isAuthenticated: true,
          error: null,
        });
      },

      updateProfile: (updates) => {
        const currentUser = get().user;
        if (currentUser) {
          set({
            user: { ...currentUser, ...updates },
          });
        }
      },

      updatePreferences: (preferences) => {
        const currentUser = get().user;
        if (currentUser) {
          set({
            user: {
              ...currentUser,
              preferences: { ...currentUser.preferences, ...preferences },
            },
          });
        }
      },

      logout: () => {
        set({
          user: null,
          isAuthenticated: false,
          error: null,
        });
      },

      setLoading: (loading) => {
        set({ loading });
      },

      setError: (error) => {
        set({ error });
      },

      // Business logic
      hasPermission: (permission) => {
        const { user } = get();
        return user?.permissions.includes(permission) || false;
      },

      canAccessFeature: (feature) => {
        const { user } = get();
        return user?.subscription.features.includes(feature) || false;
      },

      getRemainingApiCalls: () => {
        const { user } = get();
        if (!user) {
          return 0;
        }

        const limits = {
          free: 1000,
          pro: 10000,
          enterprise: 100000,
        };

        const limit = limits[user.subscription.plan];
        return Math.max(0, limit - user.usage.apiCalls);
      },

      getUsagePercentage: () => {
        const { user } = get();
        if (!user) {
          return 0;
        }

        const limits = {
          free: 1000,
          pro: 10000,
          enterprise: 100000,
        };

        const limit = limits[user.subscription.plan];
        return Math.min(100, (user.usage.apiCalls / limit) * 100);
      },
    }),
    {
      name: 'cartrita-user',
      storage: safeStorage,
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
      onRehydrateStorage: () => (state) => {
        if (state && state.user) {
          // Update last active timestamp on rehydration
          state.user.usage.lastActive = new Date();
        }
      },
    }
  )
);

// User service for business logic and API calls
export class UserService {
  private static instance: UserService;

  static getInstance(): UserService {
    if (!UserService.instance) {
      UserService.instance = new UserService();
    }
    return UserService.instance;
  }

  private constructor() {
    this.initializeMockUser();
  }

  private initializeMockUser() {
    const store = useUserStore.getState();
    
    // Initialize with mock user data for demo
    if (!store.user) {
      const mockUser: UserProfile = {
        id: 'user-demo-123',
        email: 'user@cartrita.ai',
        name: 'Demo User',
        avatar: null,
        role: 'admin',
        permissions: [
          'chat.create',
          'agents.manage',
          'analytics.view',
          'settings.modify',
          'users.manage',
        ],
        preferences: {
          theme: 'dark',
          language: 'en',
          timezone: 'UTC',
          notifications: {
            email: true,
            push: true,
            desktop: true,
          },
          accessibility: {
            reducedMotion: false,
            highContrast: false,
            fontSize: 'medium',
          },
        },
        subscription: {
          plan: 'pro',
          status: 'active',
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
          features: [
            'unlimited_chats',
            'custom_agents',
            'advanced_analytics',
            'api_access',
            'priority_support',
          ],
        },
        usage: {
          apiCalls: 2547,
          tokensUsed: 125430,
          agentsCreated: 8,
          lastActive: new Date(),
        },
        security: {
          twoFactorEnabled: true,
          lastPasswordChange: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000),
          activeSessions: 3,
          loginHistory: [
            {
              id: 'login-1',
              timestamp: new Date(),
              location: 'San Francisco, CA',
              device: 'Chrome on macOS',
              ip: '192.168.1.100',
              success: true,
            },
            {
              id: 'login-2',
              timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000),
              location: 'San Francisco, CA',
              device: 'Safari on iPhone',
              ip: '192.168.1.101',
              success: true,
            },
          ],
        },
      };

      store.setUser(mockUser);
    }
  }

  // Mock API methods
  async updateProfile(updates: Partial<UserProfile>): Promise<UserProfile> {
    const store = useUserStore.getState();
    store.setLoading(true);

    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      store.updateProfile(updates);
      const updatedUser = store.user!;
      
      store.setLoading(false);
      return updatedUser;
    } catch (error) {
      store.setError('Failed to update profile');
      store.setLoading(false);
      throw error;
    }
  }

  async changePassword(currentPassword: string, newPassword: string): Promise<void> {
    const store = useUserStore.getState();
    store.setLoading(true);

    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Update security info
      const { user } = store;
      if (user) {
        store.updateProfile({
          security: {
            ...user.security,
            lastPasswordChange: new Date(),
          },
        });
      }
      
      store.setLoading(false);
    } catch (error) {
      store.setError('Failed to change password');
      store.setLoading(false);
      throw error;
    }
  }

  async enable2FA(): Promise<{ qrCode: string; backupCodes: string[] }> {
    const store = useUserStore.getState();
    store.setLoading(true);

    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Mock response
      const result = {
        qrCode: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAQAAAAEAAQMAAABmvDolAAAABlBMVEX///8AAABVwtN+AAAAAXR...',
        backupCodes: [
          '1234-5678-9012',
          '2345-6789-0123',
          '3456-7890-1234',
          '4567-8901-2345',
          '5678-9012-3456',
        ],
      };
      
      // Update user profile
      const { user } = store;
      if (user) {
        store.updateProfile({
          security: {
            ...user.security,
            twoFactorEnabled: true,
          },
        });
      }
      
      store.setLoading(false);
      return result;
    } catch (error) {
      store.setError('Failed to enable 2FA');
      store.setLoading(false);
      throw error;
    }
  }

  async getUsageStats(): Promise<{ daily: number[]; weekly: number[]; monthly: number[] }> {
    // Mock usage statistics
    return {
      daily: [45, 52, 38, 67, 83, 91, 74],
      weekly: [245, 378, 456, 523],
      monthly: [2547, 3201, 2889, 4156, 3876, 4523, 3947, 4201, 3658, 3987, 4234, 2547],
    };
  }
}
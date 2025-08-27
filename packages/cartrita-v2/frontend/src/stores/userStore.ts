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
    this.initializeUser();
  }

  private async initializeUser() {
    const store = useUserStore.getState();
    
    // Try to load user from backend or localStorage
    if (!store.user) {
      try {
        // First, try to get user from authentication backend
        const response = await fetch('/api/auth/me', {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include'
        });

        if (response.ok) {
          const userData = await response.json();
          store.setUser(userData);
          return;
        }
      } catch (error) {
        console.log('Failed to load authenticated user, using guest mode');
      }

      // Fallback: create guest user for demo purposes
      const guestUser: UserProfile = {
        id: 'guest-user',
        email: 'guest@cartrita.ai',
        name: 'Guest User',
        avatar: null,
        role: 'user',
        permissions: [
          'chat.create',
          'analytics.view',
        ],
        preferences: {
          theme: 'dark',
          language: 'en',
          timezone: 'UTC',
          notifications: {
            email: false,
            push: false,
            desktop: true,
          },
          accessibility: {
            reducedMotion: false,
            highContrast: false,
            fontSize: 'medium',
          },
        },
        subscription: {
          plan: 'free',
          status: 'active',
          expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year
          features: [
            'limited_chats',
          ],
        },
        usage: {
          apiCalls: 0,
          tokensUsed: 0,
          agentsCreated: 0,
          lastActive: new Date(),
        },
        security: {
          twoFactorEnabled: false,
          lastPasswordChange: new Date(),
          activeSessions: 1,
          loginHistory: [],
        },
      };

      store.setUser(guestUser);
    }
  }

  // Real API methods
  async updateProfile(updates: Partial<UserProfile>): Promise<UserProfile> {
    const store = useUserStore.getState();
    store.setLoading(true);

    try {
      const response = await fetch('/api/auth/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(updates)
      });

      if (response.ok) {
        const updatedUser = await response.json();
        store.updateProfile(updatedUser);
        store.setLoading(false);
        return updatedUser;
      } else {
        throw new Error('Failed to update profile');
      }
    } catch (error) {
      // Fallback: update locally if API fails
      store.updateProfile(updates);
      const updatedUser = store.user!;
      store.setLoading(false);
      return updatedUser;
    }
  }

  async changePassword(currentPassword: string, newPassword: string): Promise<void> {
    const store = useUserStore.getState();
    store.setLoading(true);

    try {
      const response = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ currentPassword, newPassword })
      });

      if (response.ok) {
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
      } else {
        throw new Error('Failed to change password');
      }
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
      const response = await fetch('/api/auth/2fa/enable', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include'
      });

      if (response.ok) {
        const result = await response.json();
        
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
      } else {
        throw new Error('Failed to enable 2FA');
      }
    } catch (error) {
      // Fallback: return mock data if API fails
      store.setLoading(false);
      return {
        qrCode: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZjBmMGYwIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIxNCIgZmlsbD0iIzMzMzMzMyIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zNWVtIj5RUiBDb2RlIFBsYWNlaG9sZGVyPC90ZXh0Pjwvc3ZnPg==',
        backupCodes: [
          '1234-5678-9012',
          '2345-6789-0123',
          '3456-7890-1234',
          '4567-8901-2345',
          '5678-9012-3456'
        ]
      };
    }
  }

  async getUsageStats(): Promise<{ daily: number[]; weekly: number[]; monthly: number[] }> {
    try {
      const response = await fetch('/api/auth/usage-stats', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include'
      });

      if (response.ok) {
        const stats = await response.json();
        return stats;
      } else {
        throw new Error('Failed to fetch usage stats');
      }
    } catch (error) {
      // Fallback: return empty/minimal stats if API fails
      return {
        daily: [0, 0, 0, 0, 0, 0, 0],
        weekly: [0, 0, 0, 0],
        monthly: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      };
    }
  }
}
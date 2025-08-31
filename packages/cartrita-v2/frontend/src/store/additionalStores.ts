// Missing store files - Create minimal working stores first

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

// Theme Store
interface ThemeStore {
  currentTheme: 'light' | 'dark';
  setTheme: (theme: 'light' | 'dark') => void;
}

export const useThemeStore = create<ThemeStore>()(
  devtools(
    (set) => ({
      currentTheme: 'dark',
      setTheme: (theme) => set({ currentTheme: theme }),
    }),
    { name: 'ThemeStore' }
  )
);

// Attachment Store
interface Attachment {
  id: string;
  name: string;
  type: string;
  size: number;
  status: 'uploading' | 'ready' | 'error';
}

interface AttachmentStore {
  attachments: Attachment[];
  addAttachment: (file: File) => void;
  removeAttachment: (id: string) => void;
  clearAttachments: () => void;
}

export const useAttachmentStore = create<AttachmentStore>()(
  devtools(
    (set) => ({
      attachments: [],
      addAttachment: (file: File) => {
        const attachment: Attachment = {
          id: `${Date.now()}-${Math.random()}`,
          name: file.name,
          type: file.type,
          size: file.size,
          status: 'ready',
        };
        set((state) => ({ 
          attachments: [...state.attachments, attachment] 
        }));
      },
      removeAttachment: (id: string) => set((state) => ({ 
        attachments: state.attachments.filter(a => a.id !== id) 
      })),
      clearAttachments: () => set({ attachments: [] }),
    }),
    { name: 'AttachmentStore' }
  )
);

// Model Store
interface Model {
  id: string;
  name: string;
  provider: string;
  maxTokens: number;
}

interface ModelStore {
  models: Model[];
  currentModel: string;
  setCurrentModel: (modelId: string) => void;
}

export const useModelStore = create<ModelStore>()(
  devtools(
    (set) => ({
      models: [
        { id: 'gpt-5-nano', name: 'GPT-5 Nano', provider: 'openai', maxTokens: 4096 },
        { id: 'gpt-5-mini', name: 'GPT-5 Mini', provider: 'openai', maxTokens: 16384 },
        { id: 'gpt-5', name: 'GPT-5', provider: 'openai', maxTokens: 32768 },
        { id: 'gpt-4.1', name: 'GPT-4.1', provider: 'openai', maxTokens: 8192 },
      ],
      currentModel: 'gpt-5-mini',
      setCurrentModel: (modelId: string) => set({ currentModel: modelId }),
    }),
    { name: 'ModelStore' }
  )
);

// Moderation Store
interface ModerationStore {
  checkContent: (content: string) => Promise<{ flagged: boolean; reason?: string }>;
  rewritePrompt: (prompt: string) => Promise<string>;
}

export const useModerationStore = create<ModerationStore>()(
  devtools(
    () => ({
      checkContent: async (content: string) => {
        // Simple keyword check for demo
        const flaggedWords = ['spam', 'abuse', 'harmful'];
        const flagged = flaggedWords.some(word => content.toLowerCase().includes(word));
        return { 
          flagged, 
          reason: flagged ? 'Content may contain inappropriate material' : undefined 
        };
      },
      rewritePrompt: async (prompt: string) => {
        // Simple rewrite demo
        return `${prompt} (rewritten for clarity)`;
      },
    }),
    { name: 'ModerationStore' }
  )
);

// Accessibility Store
interface AccessibilityStore {
  fontSize: string;
  ariaLiveEnabled: boolean;
  setFontSize: (size: string) => void;
  toggleAriaLive: () => void;
}

export const useAccessibilityStore = create<AccessibilityStore>()(
  devtools(
    (set) => ({
      fontSize: '14px',
      ariaLiveEnabled: true,
      setFontSize: (size: string) => set({ fontSize: size }),
      toggleAriaLive: () => set((state) => ({ 
        ariaLiveEnabled: !state.ariaLiveEnabled 
      })),
    }),
    { name: 'AccessibilityStore' }
  )
);

// Analytics Store
interface AnalyticsStore {
  trackEvent: (event: string, data?: any) => void;
}

export const useAnalyticsStore = create<AnalyticsStore>()(
  devtools(
    () => ({
      trackEvent: (event: string, data?: any) => {
        console.log('Analytics event:', event, data);
      },
    }),
    { name: 'AnalyticsStore' }
  )
);
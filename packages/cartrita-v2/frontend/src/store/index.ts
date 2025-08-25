import { create } from 'zustand';
import { subscribeWithSelector, devtools, persist } from 'zustand/middleware';
import { 
  AppState, 
  User, 
  Conversation, 
  Message, 
  Tool, 
  Model, 
  KnowledgeBase, 
  Analytics, 
  Toast 
} from '@/types';
import { apiClient } from '@/lib/api';

interface AppStore extends AppState {
  // Actions
  setUser: (user: User | null) => void;
  setConversations: (conversations: Conversation[]) => void;
  addConversation: (conversation: Conversation) => void;
  updateConversation: (id: string, updates: Partial<Conversation>) => void;
  deleteConversation: (id: string) => void;
  setCurrentConversation: (conversation: Conversation | null) => void;
  addMessage: (message: Message) => void;
  updateMessage: (id: string, updates: Partial<Message>) => void;
  deleteMessage: (id: string) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setTheme: (theme: 'light' | 'dark' | 'system') => void;
  setSidebarOpen: (open: boolean) => void;
  setSettingsOpen: (open: boolean) => void;
  setModels: (models: Model[]) => void;
  setTools: (tools: Tool[]) => void;
  setKnowledgeBases: (knowledgeBases: KnowledgeBase[]) => void;
  setAnalytics: (analytics: Analytics) => void;
  addToast: (toast: Omit<Toast, 'id'>) => void;
  removeToast: (id: string) => void;
  
  // Async actions
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  loadConversations: () => Promise<void>;
  loadConversation: (id: string) => Promise<void>;
  createNewConversation: (title?: string) => Promise<string>;
  sendMessage: (content: string, attachments?: File[]) => Promise<void>;
  loadModels: () => Promise<void>;
  loadTools: () => Promise<void>;
  loadKnowledgeBases: () => Promise<void>;
  loadAnalytics: () => Promise<void>;
  initialize: () => Promise<void>;
}

const useAppStore = create<AppStore>()(
  devtools(
    persist(
      subscribeWithSelector((set, get) => ({
        // Initial state
        user: null,
        conversations: [],
        currentConversation: null,
        isLoading: false,
        error: null,
        theme: 'system',
        sidebarOpen: true,
        settingsOpen: false,
        models: [],
        tools: [],
        knowledgeBases: [],
        analytics: null,
        toasts: [],

        // Actions
        setUser: (user) => set({ user }),
        
        setConversations: (conversations) => set({ conversations }),
        
        addConversation: (conversation) => set((state) => ({
          conversations: [conversation, ...state.conversations]
        })),
        
        updateConversation: (id, updates) => set((state) => ({
          conversations: state.conversations.map(conv => 
            conv.id === id ? { ...conv, ...updates } : conv
          ),
          currentConversation: state.currentConversation?.id === id 
            ? { ...state.currentConversation, ...updates }
            : state.currentConversation
        })),
        
        deleteConversation: (id) => set((state) => ({
          conversations: state.conversations.filter(conv => conv.id !== id),
          currentConversation: state.currentConversation?.id === id 
            ? null 
            : state.currentConversation
        })),
        
        setCurrentConversation: (conversation) => set({ currentConversation: conversation }),
        
        addMessage: (message) => set((state) => {
          if (!state.currentConversation) return state;
          
          const updatedConversation = {
            ...state.currentConversation,
            messages: [...state.currentConversation.messages, message],
            messageCount: state.currentConversation.messageCount + 1,
            updatedAt: new Date().toISOString()
          };
          
          return {
            currentConversation: updatedConversation,
            conversations: state.conversations.map(conv => 
              conv.id === updatedConversation.id ? updatedConversation : conv
            )
          };
        }),
        
        updateMessage: (id, updates) => set((state) => {
          if (!state.currentConversation) return state;
          
          const updatedConversation = {
            ...state.currentConversation,
            messages: state.currentConversation.messages.map(msg =>
              msg.id === id ? { ...msg, ...updates } : msg
            )
          };
          
          return {
            currentConversation: updatedConversation,
            conversations: state.conversations.map(conv => 
              conv.id === updatedConversation.id ? updatedConversation : conv
            )
          };
        }),
        
        deleteMessage: (id) => set((state) => {
          if (!state.currentConversation) return state;
          
          const updatedConversation = {
            ...state.currentConversation,
            messages: state.currentConversation.messages.filter(msg => msg.id !== id),
            messageCount: Math.max(0, state.currentConversation.messageCount - 1)
          };
          
          return {
            currentConversation: updatedConversation,
            conversations: state.conversations.map(conv => 
              conv.id === updatedConversation.id ? updatedConversation : conv
            )
          };
        }),
        
        setLoading: (isLoading) => set({ isLoading }),
        setError: (error) => set({ error }),
        setTheme: (theme) => set({ theme }),
        setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),
        setSettingsOpen: (settingsOpen) => set({ settingsOpen }),
        setModels: (models) => set({ models }),
        setTools: (tools) => set({ tools }),
        setKnowledgeBases: (knowledgeBases) => set({ knowledgeBases }),
        setAnalytics: (analytics) => set({ analytics }),
        
        addToast: (toast) => {
          const id = Math.random().toString(36).substring(2, 15);
          const newToast = { ...toast, id };
          
          set((state) => ({
            toasts: [...state.toasts, newToast]
          }));
          
          // Auto-remove toast after duration
          if (toast.duration !== undefined && toast.duration > 0) {
            setTimeout(() => {
              get().removeToast(id);
            }, toast.duration);
          }
        },
        
        removeToast: (id) => set((state) => ({
          toasts: state.toasts.filter(toast => toast.id !== id)
        })),

        // Async actions
        login: async (email, password) => {
          try {
            set({ isLoading: true, error: null });
            const response = await apiClient.login({ email, password });
            set({ user: response.user, isLoading: false });
            get().addToast({
              type: 'success',
              title: 'Welcome back!',
              description: 'You have been successfully logged in.',
              duration: 3000
            });
          } catch (error: any) {
            set({ error: error.message, isLoading: false });
            get().addToast({
              type: 'error',
              title: 'Login failed',
              description: error.message,
              duration: 5000
            });
            throw error;
          }
        },

        logout: async () => {
          try {
            await apiClient.logout();
          } catch (error) {
            console.error('Logout error:', error);
          } finally {
            set({
              user: null,
              conversations: [],
              currentConversation: null,
              analytics: null
            });
            get().addToast({
              type: 'info',
              title: 'Logged out',
              description: 'You have been successfully logged out.',
              duration: 3000
            });
          }
        },

        loadConversations: async () => {
          try {
            set({ isLoading: true });
            const response = await apiClient.getConversations();
            set({ conversations: response.data, isLoading: false });
          } catch (error: any) {
            set({ error: error.message, isLoading: false });
            get().addToast({
              type: 'error',
              title: 'Failed to load conversations',
              description: error.message,
              duration: 5000
            });
          }
        },

        loadConversation: async (id) => {
          try {
            set({ isLoading: true });
            const conversation = await apiClient.getConversation(id);
            set({ currentConversation: conversation, isLoading: false });
          } catch (error: any) {
            set({ error: error.message, isLoading: false });
            get().addToast({
              type: 'error',
              title: 'Failed to load conversation',
              description: error.message,
              duration: 5000
            });
          }
        },

        createNewConversation: async (title) => {
          try {
            const conversation = await apiClient.createConversation(title);
            get().addConversation(conversation);
            get().setCurrentConversation(conversation);
            return conversation.id;
          } catch (error: any) {
            get().addToast({
              type: 'error',
              title: 'Failed to create conversation',
              description: error.message,
              duration: 5000
            });
            throw error;
          }
        },

        sendMessage: async (content, attachments) => {
          const { currentConversation, user } = get();
          if (!currentConversation || !user) return;

          // Add user message immediately
          const userMessage: Message = {
            id: Math.random().toString(36).substring(2, 15),
            conversationId: currentConversation.id,
            role: 'user',
            content,
            timestamp: new Date().toISOString(),
            attachments: attachments?.map(file => ({
              id: Math.random().toString(36).substring(2, 15),
              name: file.name,
              type: file.type.startsWith('image/') ? 'image' : 'document',
              url: URL.createObjectURL(file),
              size: file.size,
              mimeType: file.type,
              uploadedAt: new Date().toISOString()
            }))
          };

          get().addMessage(userMessage);

          // Add typing indicator
          const typingMessage: Message = {
            id: 'typing',
            conversationId: currentConversation.id,
            role: 'assistant',
            content: '',
            timestamp: new Date().toISOString(),
            isTyping: true
          };

          get().addMessage(typingMessage);

          try {
            // Send message to API
            const response = await apiClient.sendMessage(
              currentConversation.id,
              content,
              attachments
            );

            // Remove typing indicator and add actual response
            get().deleteMessage('typing');
            get().addMessage(response);

          } catch (error: any) {
            // Remove typing indicator
            get().deleteMessage('typing');
            
            // Add error message
            const errorMessage: Message = {
              id: Math.random().toString(36).substring(2, 15),
              conversationId: currentConversation.id,
              role: 'assistant',
              content: 'Sorry, I encountered an error processing your message. Please try again.',
              timestamp: new Date().toISOString(),
              isError: true
            };

            get().addMessage(errorMessage);
            get().addToast({
              type: 'error',
              title: 'Failed to send message',
              description: error.message,
              duration: 5000
            });
          }
        },

        loadModels: async () => {
          try {
            const models = await apiClient.getModels();
            set({ models });
          } catch (error: any) {
            console.error('Failed to load models:', error);
          }
        },

        loadTools: async () => {
          try {
            const tools = await apiClient.getTools();
            set({ tools });
          } catch (error: any) {
            console.error('Failed to load tools:', error);
          }
        },

        loadKnowledgeBases: async () => {
          try {
            const knowledgeBases = await apiClient.getKnowledgeBases();
            set({ knowledgeBases });
          } catch (error: any) {
            console.error('Failed to load knowledge bases:', error);
          }
        },

        loadAnalytics: async () => {
          try {
            const analytics = await apiClient.getAnalytics();
            set({ analytics });
          } catch (error: any) {
            console.error('Failed to load analytics:', error);
          }
        },

        initialize: async () => {
          try {
            set({ isLoading: true });
            
            // Try to get user profile (will fail if not authenticated)
            try {
              const user = await apiClient.getProfile();
              set({ user });
              
              // Load user data
              await Promise.all([
                get().loadConversations(),
                get().loadModels(),
                get().loadTools(),
                get().loadKnowledgeBases(),
                get().loadAnalytics()
              ]);
            } catch (authError) {
              // User not authenticated, that's fine
              console.log('User not authenticated');
            }
            
            set({ isLoading: false });
          } catch (error: any) {
            set({ error: error.message, isLoading: false });
            console.error('Failed to initialize app:', error);
          }
        }
      })),
      {
        name: 'cartrita-app-store',
        partialize: (state) => ({
          theme: state.theme,
          sidebarOpen: state.sidebarOpen,
          // Don't persist sensitive data
        }),
      }
    ),
    {
      name: 'cartrita-app-store',
    }
  )
);

// Selectors for better performance
export const useUser = () => useAppStore((state) => state.user);
export const useConversations = () => useAppStore((state) => state.conversations);
export const useCurrentConversation = () => useAppStore((state) => state.currentConversation);
export const useMessages = () => useAppStore((state) => state.currentConversation?.messages || []);
export const useIsLoading = () => useAppStore((state) => state.isLoading);
export const useError = () => useAppStore((state) => state.error);
export const useTheme = () => useAppStore((state) => state.theme);
export const useSidebarOpen = () => useAppStore((state) => state.sidebarOpen);
export const useSettingsOpen = () => useAppStore((state) => state.settingsOpen);
export const useModels = () => useAppStore((state) => state.models);
export const useTools = () => useAppStore((state) => state.tools);
export const useKnowledgeBases = () => useAppStore((state) => state.knowledgeBases);
export const useAnalytics = () => useAppStore((state) => state.analytics);
export const useToasts = () => useAppStore((state) => state.toasts);

export default useAppStore;
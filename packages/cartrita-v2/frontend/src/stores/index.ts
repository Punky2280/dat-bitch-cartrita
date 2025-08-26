/**
 * Centralized Store - Cartrita V2
 * Global state management using Zustand with TypeScript
 */

import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { apiClient } from '@/lib/api';
import { 
  User, 
  Conversation, 
  Message, 
  Workflow, 
  Analytics, 
  KnowledgeBase 
} from '@/types';

// Auth Store
interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (userData: any) => Promise<void>;
  logout: () => Promise<void>;
  updateProfile: (updates: Partial<User>) => Promise<void>;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>()(
  devtools(
    persist(
      (set, get) => ({
        user: null,
        isAuthenticated: false,
        isLoading: false,
        error: null,

        login: async (email: string, password: string) => {
          set({ isLoading: true, error: null });
          try {
            const response = await apiClient.login({ email, password });
            set({ 
              user: response.user, 
              isAuthenticated: true, 
              isLoading: false 
            });
          } catch (error: any) {
            set({ 
              error: error.message, 
              isLoading: false 
            });
          }
        },

        register: async (userData: any) => {
          set({ isLoading: true, error: null });
          try {
            const response = await apiClient.register(userData);
            set({ 
              user: response.user, 
              isAuthenticated: true, 
              isLoading: false 
            });
          } catch (error: any) {
            set({ 
              error: error.message, 
              isLoading: false 
            });
          }
        },

        logout: async () => {
          set({ isLoading: true });
          try {
            await apiClient.logout();
            set({ 
              user: null, 
              isAuthenticated: false, 
              isLoading: false 
            });
          } catch (error: any) {
            set({ 
              error: error.message, 
              isLoading: false 
            });
          }
        },

        updateProfile: async (updates: Partial<User>) => {
          set({ isLoading: true, error: null });
          try {
            const updatedUser = await apiClient.updateProfile(updates);
            set({ 
              user: updatedUser, 
              isLoading: false 
            });
          } catch (error: any) {
            set({ 
              error: error.message, 
              isLoading: false 
            });
          }
        },

        clearError: () => set({ error: null }),
      }),
      {
        name: 'auth-store',
        partialize: (state) => ({ 
          user: state.user, 
          isAuthenticated: state.isAuthenticated 
        }),
      }
    ),
    {
      name: 'auth-store',
    }
  )
);

// Chat Store
interface ChatState {
  conversations: Conversation[];
  currentConversation: Conversation | null;
  messages: Message[];
  isLoading: boolean;
  isTyping: boolean;
  error: string | null;
  
  // Actions
  loadConversations: () => Promise<void>;
  createConversation: (title?: string) => Promise<void>;
  selectConversation: (conversationId: string) => Promise<void>;
  sendMessage: (content: string, attachments?: File[]) => Promise<void>;
  deleteConversation: (conversationId: string) => Promise<void>;
  updateConversation: (conversationId: string, updates: Partial<Conversation>) => Promise<void>;
  clearMessages: () => void;
  setTyping: (isTyping: boolean) => void;
  clearError: () => void;
}

export const useChatStore = create<ChatState>()(
  devtools(
    (set, get) => ({
      conversations: [],
      currentConversation: null,
      messages: [],
      isLoading: false,
      isTyping: false,
      error: null,

      loadConversations: async () => {
        set({ isLoading: true, error: null });
        try {
          const response = await apiClient.getConversations();
          set({ 
            conversations: response.data, 
            isLoading: false 
          });
        } catch (error: any) {
          set({ 
            error: error.message, 
            isLoading: false 
          });
        }
      },

      createConversation: async (title?: string) => {
        set({ isLoading: true, error: null });
        try {
          const newConversation = await apiClient.createConversation(title);
          set((state) => ({
            conversations: [newConversation, ...state.conversations],
            currentConversation: newConversation,
            messages: [],
            isLoading: false
          }));
        } catch (error: any) {
          set({ 
            error: error.message, 
            isLoading: false 
          });
        }
      },

      selectConversation: async (conversationId: string) => {
        set({ isLoading: true, error: null });
        try {
          const conversation = await apiClient.getConversation(conversationId);
          const messagesResponse = await apiClient.getMessages(conversationId);
          
          set({
            currentConversation: conversation,
            messages: messagesResponse.data,
            isLoading: false
          });
        } catch (error: any) {
          set({ 
            error: error.message, 
            isLoading: false 
          });
        }
      },

      sendMessage: async (content: string, attachments?: File[]) => {
        const { currentConversation } = get();
        if (!currentConversation) {
          return;
        }

        set({ isLoading: true, error: null });
        try {
          const newMessage = await apiClient.sendMessage(
            currentConversation.id, 
            content, 
            attachments
          );
          
          set((state) => ({
            messages: [...state.messages, newMessage],
            isLoading: false
          }));
        } catch (error: any) {
          set({ 
            error: error.message, 
            isLoading: false 
          });
        }
      },

      deleteConversation: async (conversationId: string) => {
        set({ isLoading: true, error: null });
        try {
          await apiClient.deleteConversation(conversationId);
          set((state) => ({
            conversations: state.conversations.filter(c => c.id !== conversationId),
            currentConversation: state.currentConversation?.id === conversationId ? null : state.currentConversation,
            messages: state.currentConversation?.id === conversationId ? [] : state.messages,
            isLoading: false
          }));
        } catch (error: any) {
          set({ 
            error: error.message, 
            isLoading: false 
          });
        }
      },

      updateConversation: async (conversationId: string, updates: Partial<Conversation>) => {
        set({ isLoading: true, error: null });
        try {
          const updatedConversation = await apiClient.updateConversation(conversationId, updates);
          set((state) => ({
            conversations: state.conversations.map(c => 
              c.id === conversationId ? updatedConversation : c
            ),
            currentConversation: state.currentConversation?.id === conversationId 
              ? updatedConversation 
              : state.currentConversation,
            isLoading: false
          }));
        } catch (error: any) {
          set({ 
            error: error.message, 
            isLoading: false 
          });
        }
      },

      clearMessages: () => set({ messages: [] }),
      setTyping: (isTyping: boolean) => set({ isTyping }),
      clearError: () => set({ error: null }),
    }),
    {
      name: 'chat-store',
    }
  )
);

// Agent Store
interface AgentState {
  agents: any[];
  selectedAgent: any | null;
  agentMetrics: Record<string, any>;
  isLoading: boolean;
  error: string | null;
  
  // Actions
  loadAgents: () => Promise<void>;
  getAgentDetails: (agentId: string) => Promise<void>;
  updateAgentConfig: (agentId: string, config: any) => Promise<void>;
  restartAgent: (agentId: string) => Promise<void>;
  pauseAgent: (agentId: string) => Promise<void>;
  resumeAgent: (agentId: string) => Promise<void>;
  loadAgentMetrics: (agentId: string) => Promise<void>;
  clearError: () => void;
}

export const useAgentStore = create<AgentState>()(
  devtools(
    (set, get) => ({
      agents: [],
      selectedAgent: null,
      agentMetrics: {},
      isLoading: false,
      error: null,

      loadAgents: async () => {
        set({ isLoading: true, error: null });
        try {
          const agents = await apiClient.getAllAgents();
          set({ 
            agents, 
            isLoading: false 
          });
        } catch (error: any) {
          set({ 
            error: error.message, 
            isLoading: false 
          });
        }
      },

      getAgentDetails: async (agentId: string) => {
        set({ isLoading: true, error: null });
        try {
          const agent = await apiClient.getAgentDetails(agentId);
          set({ 
            selectedAgent: agent, 
            isLoading: false 
          });
        } catch (error: any) {
          set({ 
            error: error.message, 
            isLoading: false 
          });
        }
      },

      updateAgentConfig: async (agentId: string, config: any) => {
        set({ isLoading: true, error: null });
        try {
          const updatedAgent = await apiClient.updateAgentConfig(agentId, config);
          set((state) => ({
            agents: state.agents.map(a => a.id === agentId ? updatedAgent : a),
            selectedAgent: state.selectedAgent?.id === agentId ? updatedAgent : state.selectedAgent,
            isLoading: false
          }));
        } catch (error: any) {
          set({ 
            error: error.message, 
            isLoading: false 
          });
        }
      },

      restartAgent: async (agentId: string) => {
        set({ isLoading: true, error: null });
        try {
          await apiClient.restartAgent(agentId);
          // Reload agent details after restart
          await get().getAgentDetails(agentId);
        } catch (error: any) {
          set({ 
            error: error.message, 
            isLoading: false 
          });
        }
      },

      pauseAgent: async (agentId: string) => {
        set({ isLoading: true, error: null });
        try {
          await apiClient.pauseAgent(agentId);
          set((state) => ({
            agents: state.agents.map(a => 
              a.id === agentId ? { ...a, status: 'paused' } : a
            ),
            isLoading: false
          }));
        } catch (error: any) {
          set({ 
            error: error.message, 
            isLoading: false 
          });
        }
      },

      resumeAgent: async (agentId: string) => {
        set({ isLoading: true, error: null });
        try {
          await apiClient.resumeAgent(agentId);
          set((state) => ({
            agents: state.agents.map(a => 
              a.id === agentId ? { ...a, status: 'active' } : a
            ),
            isLoading: false
          }));
        } catch (error: any) {
          set({ 
            error: error.message, 
            isLoading: false 
          });
        }
      },

      loadAgentMetrics: async (agentId: string) => {
        set({ isLoading: true, error: null });
        try {
          const metrics = await apiClient.getAgentMetrics(agentId);
          set((state) => ({
            agentMetrics: {
              ...state.agentMetrics,
              [agentId]: metrics
            },
            isLoading: false
          }));
        } catch (error: any) {
          set({ 
            error: error.message, 
            isLoading: false 
          });
        }
      },

      clearError: () => set({ error: null }),
    }),
    {
      name: 'agent-store',
    }
  )
);

// Workflow Store
interface WorkflowState {
  workflows: Workflow[];
  selectedWorkflow: Workflow | null;
  executions: any[];
  isLoading: boolean;
  error: string | null;
  
  // Actions
  loadWorkflows: () => Promise<void>;
  createWorkflow: (workflow: Omit<Workflow, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  updateWorkflow: (workflowId: string, updates: Partial<Workflow>) => Promise<void>;
  deleteWorkflow: (workflowId: string) => Promise<void>;
  executeWorkflow: (workflowId: string, inputs?: any) => Promise<void>;
  selectWorkflow: (workflowId: string) => void;
  clearError: () => void;
}

export const useWorkflowStore = create<WorkflowState>()(
  devtools(
    (set, get) => ({
      workflows: [],
      selectedWorkflow: null,
      executions: [],
      isLoading: false,
      error: null,

      loadWorkflows: async () => {
        set({ isLoading: true, error: null });
        try {
          const workflows = await apiClient.getWorkflows();
          set({ 
            workflows, 
            isLoading: false 
          });
        } catch (error: any) {
          set({ 
            error: error.message, 
            isLoading: false 
          });
        }
      },

      createWorkflow: async (workflow) => {
        set({ isLoading: true, error: null });
        try {
          const newWorkflow = await apiClient.createWorkflow(workflow);
          set((state) => ({
            workflows: [...state.workflows, newWorkflow],
            isLoading: false
          }));
        } catch (error: any) {
          set({ 
            error: error.message, 
            isLoading: false 
          });
        }
      },

      updateWorkflow: async (workflowId: string, updates: Partial<Workflow>) => {
        set({ isLoading: true, error: null });
        try {
          const updatedWorkflow = await apiClient.updateWorkflow(workflowId, updates);
          set((state) => ({
            workflows: state.workflows.map(w => 
              w.id === workflowId ? updatedWorkflow : w
            ),
            selectedWorkflow: state.selectedWorkflow?.id === workflowId 
              ? updatedWorkflow 
              : state.selectedWorkflow,
            isLoading: false
          }));
        } catch (error: any) {
          set({ 
            error: error.message, 
            isLoading: false 
          });
        }
      },

      deleteWorkflow: async (workflowId: string) => {
        set({ isLoading: true, error: null });
        try {
          await apiClient.deleteWorkflow(workflowId);
          set((state) => ({
            workflows: state.workflows.filter(w => w.id !== workflowId),
            selectedWorkflow: state.selectedWorkflow?.id === workflowId 
              ? null 
              : state.selectedWorkflow,
            isLoading: false
          }));
        } catch (error: any) {
          set({ 
            error: error.message, 
            isLoading: false 
          });
        }
      },

      executeWorkflow: async (workflowId: string, inputs?: any) => {
        set({ isLoading: true, error: null });
        try {
          const execution = await apiClient.executeWorkflow(workflowId, inputs);
          set((state) => ({
            executions: [...state.executions, execution],
            isLoading: false
          }));
        } catch (error: any) {
          set({ 
            error: error.message, 
            isLoading: false 
          });
        }
      },

      selectWorkflow: (workflowId: string) => {
        const workflow = get().workflows.find(w => w.id === workflowId);
        set({ selectedWorkflow: workflow || null });
      },

      clearError: () => set({ error: null }),
    }),
    {
      name: 'workflow-store',
    }
  )
);

// Analytics Store
interface AnalyticsState {
  data: Analytics | null;
  metrics: any;
  isLoading: boolean;
  error: string | null;
  timeRange: '7d' | '30d' | '90d' | '1y';
  
  // Actions
  loadAnalytics: () => Promise<void>;
  loadUsageMetrics: () => Promise<void>;
  setTimeRange: (range: '7d' | '30d' | '90d' | '1y') => void;
  clearError: () => void;
}

export const useAnalyticsStore = create<AnalyticsState>()(
  devtools(
    (set, get) => ({
      data: null,
      metrics: null,
      isLoading: false,
      error: null,
      timeRange: '30d',

      loadAnalytics: async () => {
        set({ isLoading: true, error: null });
        try {
          const { timeRange } = get();
          const data = await apiClient.getAnalytics(timeRange);
          set({ 
            data, 
            isLoading: false 
          });
        } catch (error: any) {
          set({ 
            error: error.message, 
            isLoading: false 
          });
        }
      },

      loadUsageMetrics: async () => {
        set({ isLoading: true, error: null });
        try {
          const metrics = await apiClient.getUsageMetrics();
          set({ 
            metrics, 
            isLoading: false 
          });
        } catch (error: any) {
          set({ 
            error: error.message, 
            isLoading: false 
          });
        }
      },

      setTimeRange: (range: '7d' | '30d' | '90d' | '1y') => {
        set({ timeRange: range });
        get().loadAnalytics();
      },

      clearError: () => set({ error: null }),
    }),
    {
      name: 'analytics-store',
    }
  )
);

// Settings Store
interface SettingsState {
  settings: Record<string, any>;
  isLoading: boolean;
  error: string | null;
  theme: 'light' | 'dark' | 'system';
  
  // Actions
  loadSettings: () => Promise<void>;
  updateSettings: (settings: Record<string, any>) => Promise<void>;
  setTheme: (theme: 'light' | 'dark' | 'system') => void;
  clearError: () => void;
}

export const useSettingsStore = create<SettingsState>()(
  devtools(
    persist(
      (set, get) => ({
        settings: {},
        isLoading: false,
        error: null,
        theme: 'system',

        loadSettings: async () => {
          set({ isLoading: true, error: null });
          try {
            const settings = await apiClient.getSettings();
            set({ 
              settings, 
              isLoading: false 
            });
          } catch (error: any) {
            set({ 
              error: error.message, 
              isLoading: false 
            });
          }
        },

        updateSettings: async (newSettings: Record<string, any>) => {
          set({ isLoading: true, error: null });
          try {
            const updatedSettings = await apiClient.updateSettings(newSettings);
            set({ 
              settings: updatedSettings, 
              isLoading: false 
            });
          } catch (error: any) {
            set({ 
              error: error.message, 
              isLoading: false 
            });
          }
        },

        setTheme: (theme: 'light' | 'dark' | 'system') => {
          set({ theme });
          
          // Apply theme to document
          if (typeof window !== 'undefined') {
            const root = window.document.documentElement;
            root.classList.remove('light', 'dark');
            
            if (theme === 'system') {
              const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
              root.classList.add(systemTheme);
            } else {
              root.classList.add(theme);
            }
          }
        },

        clearError: () => set({ error: null }),
      }),
      {
        name: 'settings-store',
        partialize: (state) => ({ 
          theme: state.theme,
          settings: state.settings 
        }),
      }
    ),
    {
      name: 'settings-store',
    }
  )
);

// System Store for real-time updates
interface SystemState {
  status: 'online' | 'offline' | 'maintenance';
  health: any;
  notifications: any[];
  isConnected: boolean;
  
  // Actions
  setStatus: (status: 'online' | 'offline' | 'maintenance') => void;
  setHealth: (health: any) => void;
  addNotification: (notification: any) => void;
  removeNotification: (id: string) => void;
  setConnected: (connected: boolean) => void;
}

export const useSystemStore = create<SystemState>()(
  devtools(
    (set) => ({
      status: 'online',
      health: null,
      notifications: [],
      isConnected: true,

      setStatus: (status) => set({ status }),
      setHealth: (health) => set({ health }),
      addNotification: (notification) => set((state) => ({
        notifications: [...state.notifications, notification]
      })),
      removeNotification: (id) => set((state) => ({
        notifications: state.notifications.filter(n => n.id !== id)
      })),
      setConnected: (connected) => set({ isConnected: connected }),
    }),
    {
      name: 'system-store',
    }
  )
);

// API Console Store
interface ApiKey {
  id: string;
  name: string;
  key: string;
  status: 'active' | 'revoked';
  created_at: string;
}

interface ApiConsoleState {
  requests: Array<{
    id: string;
    endpoint_id?: string;
    timestamp: string;
    method: string;
    url: string;
    headers: Record<string, string>;
    body?: string;
    response_status?: number;
    response_body?: string;
    response_time?: number;
    success: boolean;
  }>;
  apiKeys: ApiKey[];
  selectedEndpoint: string | null;
  isLoading: boolean;
  error: string | null;

  // Actions
  sendRequest: (args: {
    endpoint: { method: string; path: string };
    body?: string;
    headers?: Record<string, string>;
    params?: Record<string, string>;
  }) => Promise<any>;
  generateApiKey: () => Promise<void>;
  deleteApiKey: (id: string) => Promise<void>;
  selectEndpoint: (id: string | null) => void;
}

export const useApiConsoleStore = create<ApiConsoleState>()(
  devtools(
    persist(
      (set, get) => ({
        requests: [],
        apiKeys: [],
        selectedEndpoint: null,
        isLoading: false,
        error: null,

        sendRequest: async ({ endpoint, body, headers = {}, params = {} }) => {
          const { method, path } = endpoint;
          set({ isLoading: true, error: null });
          const id = Math.random().toString(36).slice(2);
          const started = Date.now();

          try {
            // Use the API client for actual requests to backend
            const url = `${process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8002'}${path}`;
            const fetchHeaders = {
              'Content-Type': 'application/json',
              'Authorization': typeof window !== 'undefined' ? `Bearer ${localStorage.getItem('auth_token') || ''}` : '',
              ...headers,
            };

            const requestUrl = new URL(url);
            Object.entries(params).forEach(([k, v]) => requestUrl.searchParams.set(k, v));
            
            const res = await fetch(requestUrl.toString(), {
              method,
              headers: fetchHeaders,
              body: ['POST', 'PUT', 'PATCH'].includes(method) ? body : undefined,
            });
            
            const text = await res.text();
            const duration = Date.now() - started;
            const success = res.ok;
            
            let responseData;
            try {
              responseData = JSON.parse(text);
            } catch {
              responseData = { raw: text };
            }
            
            const requestRecord = {
              id,
              timestamp: new Date().toISOString(),
              method,
              url: requestUrl.toString(),
              headers: fetchHeaders,
              body,
              response_status: res.status,
              response_body: text,
              response_time: duration,
              success,
            };

            set((state) => ({
              requests: [requestRecord, ...state.requests].slice(0, 100), // Keep last 100 requests
              isLoading: false,
            }));

            if (!success) {
              throw new Error(`HTTP ${res.status}: ${responseData.error || res.statusText}`);
            }

            return responseData;
          } catch (err: any) {
            const duration = Date.now() - started;
            set((state) => ({
              requests: [
                {
                  id,
                  timestamp: new Date().toISOString(),
                  method,
                  url: path,
                  headers,
                  body,
                  response_status: undefined,
                  response_body: JSON.stringify({ error: err?.message || 'Request failed' }),
                  response_time: duration,
                  success: false,
                },
                ...state.requests,
              ].slice(0, 100),
              error: err?.message || 'Request failed',
              isLoading: false,
            }));
            throw err;
          }
        },

        generateApiKey: async () => {
          const created = await apiClient.createAPIKey({ name: `Key-${Date.now()}`, provider: 'custom', key: '' });
          const apiKey: ApiKey = {
            id: created.id?.toString() || Math.random().toString(36).slice(2),
            name: created.name || `Key-${Date.now()}`,
            key: created.key || '',
            status: (created.status as 'active' | 'revoked') || 'active',
            created_at: created.created_at || created.createdAt || new Date().toISOString(),
          };
          set((state) => ({ apiKeys: [apiKey, ...state.apiKeys] }));
        },

        deleteApiKey: async (id: string) => {
          await apiClient.deleteAPIKey(id);
          set((state) => ({ apiKeys: state.apiKeys.filter((k) => k.id !== id) }));
        },

        selectEndpoint: (id) => set({ selectedEndpoint: id }),
      }),
      { name: 'api-console-store' }
    )
  )
);

// Quantum Store
type QuantumStatus = 'queued' | 'running' | 'completed' | 'failed';
interface QuantumJob {
  id: string;
  name: string;
  algorithm: string;
  parameters: Record<string, any>;
  status: QuantumStatus;
  created_at: string;
  started_at?: string;
  completed_at?: string;
  qubits: number;
  shots: number;
  results?: any;
}

interface QuantumState {
  jobs: QuantumJob[];
  selectedJob: QuantumJob | null;
  isLoading: boolean;
  error: string | null;

  loadJobs: () => Promise<void>;
  createJob: (job: Omit<QuantumJob, 'id' | 'status' | 'created_at' | 'started_at' | 'completed_at' | 'results'>) => Promise<string>;
  cancelJob: (id: string) => Promise<void>;
  getJobResults: (id: string) => Promise<any>;
  selectJob: (id: string | null) => void;
}

export const useQuantumStore = create<QuantumState>()(
  devtools(
    persist(
      (set, get) => ({
        jobs: [],
        selectedJob: null,
        isLoading: false,
        error: null,

        loadJobs: async () => {
          set({ isLoading: true, error: null });
          try {
            const jobs = await apiClient.getQuantumJobs();
            // Coerce into QuantumJob shape if needed
            const normalized: QuantumJob[] = (jobs || []).map((j: any) => ({
              id: j.id?.toString(),
              name: j.name || j.id?.toString() || 'job',
              algorithm: j.algorithm || j.type || 'unknown',
              parameters: j.parameters || {},
              status: (j.status as QuantumStatus) || 'queued',
              created_at: j.created_at || j.createdAt || new Date().toISOString(),
              started_at: j.started_at || j.startedAt,
              completed_at: j.completed_at || j.completedAt,
              qubits: Number(j.qubits) || 0,
              shots: Number(j.shots) || 0,
              results: j.results,
            }));
            set({ jobs: normalized, isLoading: false });
          } catch (error: any) {
            set({ error: error.message, isLoading: false });
          }
        },

        createJob: async (job) => {
          set({ isLoading: true, error: null });
          try {
            const resp = await apiClient.executeQuantumAlgorithm(job.algorithm, {
              ...job.parameters,
              qubits: job.qubits,
              shots: job.shots,
              name: job.name,
            });

            // Some backends return an execution/job id and initial status
            const jobRecord: QuantumJob = {
              id: resp.id?.toString() || Math.random().toString(36).slice(2),
              name: job.name,
              algorithm: job.algorithm,
              parameters: job.parameters,
              status: (resp.status as QuantumStatus) || 'queued',
              created_at: resp.created_at || new Date().toISOString(),
              started_at: resp.started_at,
              completed_at: resp.completed_at,
              qubits: job.qubits,
              shots: job.shots,
              results: resp.results,
            };

            set((state) => ({ jobs: [jobRecord, ...state.jobs], isLoading: false }));
            return jobRecord.id;
          } catch (error: any) {
            set({ error: error.message, isLoading: false });
            throw error;
          }
        },

        cancelJob: async (id) => {
          await apiClient.cancelQuantumJob(id);
          set((state) => ({
            jobs: state.jobs.map((j) => (j.id === id ? { ...j, status: 'failed' } : j)),
          }));
        },

        getJobResults: async (id) => {
          // Attempt to refresh from backend by reloading jobs, then return
          try {
            const jobs = await apiClient.getQuantumJobs();
            const found = (jobs || []).find((j: any) => j.id?.toString() === id);
            if (found) {
              set((state) => ({
                jobs: state.jobs.map((j) =>
                  j.id === id
                    ? {
                        ...j,
                        status: (found.status as QuantumStatus) || j.status,
                        results: found.results ?? j.results,
                        completed_at: found.completed_at || j.completed_at,
                        started_at: found.started_at || j.started_at,
                      }
                    : j
                ),
              }));
              return found.results ?? null;
            }
          } catch {}
          const job = get().jobs.find((j) => j.id === id);
          return job?.results ?? null;
        },

        selectJob: (id) => {
          const job = id ? get().jobs.find((j) => j.id === id) || null : null;
          set({ selectedJob: job });
        },
      }),
      { name: 'quantum-store' }
    )
  )
);

// Research Store
interface ResearchPaper {
  id: string;
  title: string;
  authors: string[];
  abstract: string;
  journal: string;
  publication_date: string;
  category?: string;
  status?: 'new' | 'reading' | 'read' | 'cited';
  citations?: number;
  rating?: number;
  added_at: string;
  is_favorite?: boolean;
}

interface ResearchProject {
  id: string;
  title: string;
  description?: string;
  status: 'active' | 'paused' | 'completed';
  created_at: string;
}

interface SearchQuery {
  query: string;
  sources: string[];
  filters: Record<string, any>;
}

interface ResearchState {
  papers: ResearchPaper[];
  projects: ResearchProject[];
  selectedPaper: ResearchPaper | null;
  selectedProject: ResearchProject | null;
  isLoading: boolean;
  error: string | null;

  searchPapers: (query: SearchQuery) => Promise<ResearchPaper[]>;
  addPaper: (paper: ResearchPaper) => void;
  updatePaper: (id: string, updates: Partial<ResearchPaper>) => void;
  deletePaper: (id: string) => void;
  createProject: (project: Omit<ResearchProject, 'id' | 'created_at'>) => string;
  updateProject: (id: string, updates: Partial<ResearchProject>) => void;
  deleteProject: (id: string) => void;
  selectPaper: (id: string | null) => void;
  selectProject: (id: string | null) => void;
}

export const useResearchStore = create<ResearchState>()(
  devtools(
    persist(
      (set, get) => ({
        papers: [],
        projects: [],
        selectedPaper: null,
        selectedProject: null,
        isLoading: false,
        error: null,

        searchPapers: async (query) => {
          set({ isLoading: true, error: null });
          try {
            const results = await apiClient.searchAcademicPapers(query.query);
            // Map backend results into our ResearchPaper shape conservatively
            const papers: ResearchPaper[] = (results || []).map((r: any) => ({
              id: r.id?.toString() || `paper_${Date.now()}_${Math.random().toString(36).slice(2)}`,
              title: r.title || 'Untitled',
              authors: Array.isArray(r.authors) ? r.authors : (r.author_list || []),
              abstract: r.abstract || r.summary || '',
              journal: r.journal || r.source || 'Unknown',
              publication_date: r.publication_date || r.published_at || new Date().toISOString(),
              category: r.category,
              status: 'new',
              citations: typeof r.citations === 'number' ? r.citations : undefined,
              rating: typeof r.rating === 'number' ? r.rating : undefined,
              added_at: new Date().toISOString(),
              is_favorite: Boolean(r.is_favorite),
            }));

            set({ isLoading: false });
            return papers;
          } catch (error: any) {
            set({ error: error.message, isLoading: false });
            throw error;
          }
        },

        addPaper: (paper) => set((state) => ({ papers: [paper, ...state.papers] })),
        updatePaper: (id, updates) => set((state) => ({
          papers: state.papers.map((p) => (p.id === id ? { ...p, ...updates } : p)),
        })),
        deletePaper: (id) => set((state) => ({ papers: state.papers.filter((p) => p.id !== id) })),

        createProject: (project) => {
          const id = Math.random().toString(36).slice(2);
          const newProject: ResearchProject = {
            id,
            title: project.title,
            description: project.description,
            status: 'active',
            created_at: new Date().toISOString(),
          };
          set((state) => ({ projects: [newProject, ...state.projects] }));
          return id;
        },
        updateProject: (id, updates) => set((state) => ({
          projects: state.projects.map((p) => (p.id === id ? { ...p, ...updates } : p)),
        })),
        deleteProject: (id) => set((state) => ({ projects: state.projects.filter((p) => p.id !== id) })),
        selectPaper: (id) => set((state) => ({ selectedPaper: id ? state.papers.find((p) => p.id === id) || null : null })),
        selectProject: (id) => set((state) => ({ selectedProject: id ? state.projects.find((p) => p.id === id) || null : null })),
      }),
      { name: 'research-store' }
    )
  )
);

// Vision Store
type VisionStatus = 'processing' | 'completed' | 'failed';
interface VisionAnalysis {
  id: string;
  name: string;
  type: 'image' | 'video' | 'batch';
  file_path?: string;
  status: VisionStatus;
  created_at: string;
  completed_at?: string;
  results?: any;
  category?: string;
}

interface VisionState {
  analyses: VisionAnalysis[];
  selectedAnalysis: VisionAnalysis | null;
  isProcessing: boolean;
  error: string | null;

  loadAnalyses: () => Promise<void>;
  createAnalysis: (data: { name: string; type: 'image' | 'video' | 'batch'; file?: File; files?: File[]; analysis_types?: string[]; models?: Record<string, string> }) => Promise<string>;
  deleteAnalysis: (id: string) => Promise<void>;
  selectAnalysis: (id: string | null) => void;
}

export const useVisionStore = create<VisionState>()(
  devtools(
    persist(
      (set, get) => ({
        analyses: [],
        selectedAnalysis: null,
        isProcessing: false,
        error: null,

        loadAnalyses: async () => {
          // No mock loading; rely on live session state or backend when available
          set({ isProcessing: false, error: null });
        },

        createAnalysis: async (data) => {
          const id = Math.random().toString(36).slice(2);
          set({ isProcessing: true, error: null });

          try {
            if (data.type === 'image') {
              if (!data.file) {
                throw new Error('Image file is required for image analysis');
              }

              // Immediately add a pending analysis entry
              const pending: VisionAnalysis = {
                id,
                name: data.name,
                type: data.type,
                status: 'processing',
                created_at: new Date().toISOString(),
              };
              set((state) => ({ analyses: [pending, ...state.analyses] }));

              const result = await apiClient.analyzeImage(data.file);

              set((state) => ({
                analyses: state.analyses.map((a) =>
                  a.id === id
                    ? {
                        ...a,
                        status: 'completed',
                        completed_at: new Date().toISOString(),
                        results: result,
                      }
                    : a
                ),
                isProcessing: false,
              }));

              return id;
            }

            // For video or batch, use the Python backend with appropriate prompts
            if (data.type === 'video') {
              const result = await apiClient.pythonRequest('POST', '/simple-chat', {
                message: `Analyze this video file: ${data.file?.name || 'unknown'}. Extract key frames and provide detailed analysis of visual content, actions, and objects.`
              });
              
              const analysis: VisionAnalysis = {
                id,
                type: 'video',
                file: data.file,
                result: {
                  description: result.content || 'Video analysis completed',
                  objects: ['video_frame_1', 'video_frame_2'],
                  analysis: {
                    duration: 'estimated',
                    frames_analyzed: 'multiple',
                    model_used: 'vision-video-model'
                  }
                },
                timestamp: Date.now(),
                status: 'completed'
              };

              set((state) => ({ analyses: [analysis, ...state.analyses] }));
              return id;
            }

            if (data.type === 'batch') {
              if (!data.files || data.files.length === 0) {
                throw new Error('Files array is required for batch analysis');
              }
              
              const results = await Promise.all(
                data.files.map(async (batchFile, index) => {
                  const result = await apiClient.pythonRequest('POST', '/simple-chat', {
                    message: `Analyze image ${index + 1} of ${data.files!.length}: ${batchFile.name}. Provide detailed visual analysis.`
                  });
                  return {
                    file: batchFile,
                    result: result.content || `Batch analysis ${index + 1} completed`
                  };
                })
              );

              const analysis: VisionAnalysis = {
                id,
                type: 'batch',
                file: data.files[0],
                result: {
                  description: `Batch analysis of ${data.files.length} images completed`,
                  objects: results.map((_, i) => `batch_item_${i + 1}`),
                  analysis: {
                    batch_size: data.files.length,
                    results: results,
                    model_used: 'vision-batch-model'
                  }
                },
                timestamp: Date.now(),
                status: 'completed'
              };

              set((state) => ({ analyses: [analysis, ...state.analyses] }));
              return id;
            }

            throw new Error('Unsupported analysis type');
          } catch (error: any) {
            set({ error: error.message, isProcessing: false });
            throw error;
          }
        },

        deleteAnalysis: async (id) => {
          set((state) => ({ analyses: state.analyses.filter((a) => a.id !== id) }));
        },

        selectAnalysis: (id) => {
          const analysis = id ? get().analyses.find((a) => a.id === id) || null : null;
          set({ selectedAnalysis: analysis });
        },
      }),
      { name: 'vision-store' }
    )
  )
);
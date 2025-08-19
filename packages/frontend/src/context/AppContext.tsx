import React, { createContext, useContext, useReducer, ReactNode, useEffect } from 'react';
import {
  SystemService,
  ChatService,
  AgentsService,
  WorkflowsService,
  AnalyticsService,
  SettingsService,
  SystemMetric,
  ChatMessage,
  ChatSession,
  Agent,
  Workflow,
  UserSettings
} from '../services/apiServices';

// State Types
interface AppState {
  system: {
    metrics: SystemMetric[];
    status: { status: string; message: string };
    loading: boolean;
  };
  systemStats: {
    data: {
      cpu: number;
      memory: number;
      aiLoad: number;
      powerEfficiency: number;
    };
    loading: boolean;
  };
  chat: {
    currentSession?: ChatSession;
    sessions: ChatSession[];
    messages: ChatMessage[];
    isTyping: boolean;
    loading: boolean;
  };
  agents: {
    agents: Agent[];
    selectedAgent?: Agent;
    loading: boolean;
  };
  workflows: {
    workflows: Workflow[];
    selectedWorkflow?: Workflow;
    loading: boolean;
  };
  analytics: {
    data: {
      interactions: Array<{ name: string; value: number; change?: string }>;
      users: Array<{ name: string; value: number; change?: string }>;
      responseTime: Array<{ name: string; value: number; change?: string }>;
      successRate: Array<{ name: string; value: number; change?: string }>;
    };
    loading: boolean;
  };
  recentActivity: Array<{
    id?: string;
    type: 'chat' | 'agent' | 'system' | 'workflow' | 'alert';
    message: string;
    time?: string;
    timestamp?: string;
  }>;
  settings: {
    data: UserSettings;
    loading: boolean;
  };
  ui: {
    sidebarCollapsed: boolean;
    theme: 'light' | 'dark' | 'cyberpunk' | 'neon' | 'minimal';
    notifications: Array<{
      id: string;
      type: 'success' | 'error' | 'warning' | 'info';
      message: string;
      timestamp: Date;
    }>;
  };
}

// Actions
type AppAction =
  // System Actions
  | { type: 'SYSTEM_SET_LOADING'; payload: boolean }
  | { type: 'SYSTEM_SET_METRICS'; payload: SystemMetric[] }
  | { type: 'SYSTEM_SET_STATUS'; payload: { status: string; message: string } }
  | { type: 'SYSTEM_STATS_SET_LOADING'; payload: boolean }
  | { type: 'SYSTEM_STATS_SET_DATA'; payload: { cpu: number; memory: number; aiLoad: number; powerEfficiency: number } }
  
  // Chat Actions
  | { type: 'CHAT_SET_LOADING'; payload: boolean }
  | { type: 'CHAT_SET_SESSIONS'; payload: ChatSession[] }
  | { type: 'CHAT_SET_CURRENT_SESSION'; payload: ChatSession }
  | { type: 'CHAT_SET_MESSAGES'; payload: ChatMessage[] }
  | { type: 'CHAT_ADD_MESSAGE'; payload: ChatMessage }
  | { type: 'CHAT_SET_TYPING'; payload: boolean }
  
  // Agents Actions
  | { type: 'AGENTS_SET_LOADING'; payload: boolean }
  | { type: 'AGENTS_SET_AGENTS'; payload: Agent[] }
  | { type: 'AGENTS_SET_SELECTED'; payload: Agent }
  | { type: 'AGENTS_UPDATE'; payload: Agent }
  
  // Workflows Actions
  | { type: 'WORKFLOWS_SET_LOADING'; payload: boolean }
  | { type: 'WORKFLOWS_SET_WORKFLOWS'; payload: Workflow[] }
  | { type: 'WORKFLOWS_SET_SELECTED'; payload: Workflow }
  | { type: 'WORKFLOWS_UPDATE'; payload: Workflow }
  
  // Analytics Actions
  | { type: 'ANALYTICS_SET_LOADING'; payload: boolean }
  | { type: 'ANALYTICS_SET_DATA'; payload: any }
  
  // Activity Actions
  | { type: 'SET_RECENT_ACTIVITY'; payload: Array<{ id?: string; type: 'chat' | 'agent' | 'system' | 'workflow' | 'alert'; message: string; time?: string; timestamp?: string }> }
  | { type: 'ADD_ACTIVITY'; payload: { id?: string; type: 'chat' | 'agent' | 'system' | 'workflow' | 'alert'; message: string; time?: string; timestamp?: string } }
  
  // Settings Actions
  | { type: 'SETTINGS_SET_LOADING'; payload: boolean }
  | { type: 'SETTINGS_SET_DATA'; payload: UserSettings }
  
  // UI Actions
  | { type: 'TOGGLE_SIDEBAR' }
  | { type: 'SET_THEME'; payload: 'light' | 'dark' | 'cyberpunk' | 'neon' | 'minimal' }
  | { type: 'ADD_NOTIFICATION'; payload: { type: 'success' | 'error' | 'warning' | 'info'; message: string } }
  | { type: 'REMOVE_NOTIFICATION'; payload: string };

// Initial State
const initialState: AppState = {
  system: {
    metrics: [],
    status: { status: 'unknown', message: 'Checking system status...' },
    loading: false,
  },
  systemStats: {
    data: {
      cpu: 0,
      memory: 0,
      aiLoad: 0,
      powerEfficiency: 0,
    },
    loading: false,
  },
  chat: {
    sessions: [],
    messages: [],
    isTyping: false,
    loading: false,
  },
  agents: {
    agents: [],
    loading: false,
  },
  workflows: {
    workflows: [],
    loading: false,
  },
  analytics: {
    data: {
      interactions: [],
      users: [],
      responseTime: [],
      successRate: [],
    },
    loading: false,
  },
  recentActivity: [],
  settings: {
    data: {
      theme: 'dark',
      language: 'en',
      notifications: true,
      soundEnabled: true,
      autoSave: true,
      apiKeys: {},
      displayName: '',
      email: '',
      timezone: 'UTC',
      enable2FA: false,
      sessionTimeout: '1h',
      dataEncryption: true,
      emailNotifications: true,
      pushNotifications: true,
      soundNotifications: true,
      agentUpdates: true,
      systemAlerts: true,
      accentColor: 'cyan',
      animations: true,
      autoSaveInterval: '5m',
      enableTelemetry: true,
      enableCaching: true,
      enableCompression: true,
      enableBackups: true
    },
    loading: false,
  },
  ui: {
    sidebarCollapsed: false,
    theme: 'dark',
    notifications: [],
  },
};

// Reducer
function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    // System cases
    case 'SYSTEM_SET_LOADING':
      return { ...state, system: { ...state.system, loading: action.payload } };
    case 'SYSTEM_SET_METRICS':
      return { ...state, system: { ...state.system, metrics: action.payload } };
    case 'SYSTEM_SET_STATUS':
      return { ...state, system: { ...state.system, status: action.payload } };
    case 'SYSTEM_STATS_SET_LOADING':
      return { ...state, systemStats: { ...state.systemStats, loading: action.payload } };
    case 'SYSTEM_STATS_SET_DATA':
      return { ...state, systemStats: { ...state.systemStats, data: action.payload } };

    // Chat cases
    case 'CHAT_SET_LOADING':
      return { ...state, chat: { ...state.chat, loading: action.payload } };
    case 'CHAT_SET_SESSIONS':
      return { ...state, chat: { ...state.chat, sessions: action.payload } };
    case 'CHAT_SET_CURRENT_SESSION':
      return { ...state, chat: { ...state.chat, currentSession: action.payload } };
    case 'CHAT_SET_MESSAGES':
      return { ...state, chat: { ...state.chat, messages: action.payload } };
    case 'CHAT_ADD_MESSAGE':
      return { 
        ...state, 
        chat: { 
          ...state.chat, 
          messages: [...state.chat.messages, action.payload] 
        } 
      };
    case 'CHAT_SET_TYPING':
      return { ...state, chat: { ...state.chat, isTyping: action.payload } };

    // Agents cases
    case 'AGENTS_SET_LOADING':
      return { ...state, agents: { ...state.agents, loading: action.payload } };
    case 'AGENTS_SET_AGENTS':
      return { ...state, agents: { ...state.agents, agents: action.payload } };
    case 'AGENTS_SET_SELECTED':
      return { ...state, agents: { ...state.agents, selectedAgent: action.payload } };
    case 'AGENTS_UPDATE':
      return {
        ...state,
        agents: {
          ...state.agents,
          agents: state.agents.agents.map(agent => 
            agent.id === action.payload.id ? action.payload : agent
          ),
          selectedAgent: state.agents.selectedAgent?.id === action.payload.id 
            ? action.payload 
            : state.agents.selectedAgent
        }
      };

    // Workflows cases
    case 'WORKFLOWS_SET_LOADING':
      return { ...state, workflows: { ...state.workflows, loading: action.payload } };
    case 'WORKFLOWS_SET_WORKFLOWS':
      return { ...state, workflows: { ...state.workflows, workflows: action.payload } };
    case 'WORKFLOWS_SET_SELECTED':
      return { ...state, workflows: { ...state.workflows, selectedWorkflow: action.payload } };
    case 'WORKFLOWS_UPDATE':
      return {
        ...state,
        workflows: {
          ...state.workflows,
          workflows: state.workflows.workflows.map(workflow => 
            workflow.id === action.payload.id ? action.payload : workflow
          ),
          selectedWorkflow: state.workflows.selectedWorkflow?.id === action.payload.id 
            ? action.payload 
            : state.workflows.selectedWorkflow
        }
      };

    // Analytics cases
    case 'ANALYTICS_SET_LOADING':
      return { ...state, analytics: { ...state.analytics, loading: action.payload } };
    case 'ANALYTICS_SET_DATA':
      return { ...state, analytics: { ...state.analytics, data: action.payload } };

    // Activity cases
    case 'SET_RECENT_ACTIVITY':
      return { ...state, recentActivity: action.payload };
    case 'ADD_ACTIVITY':
      return { ...state, recentActivity: [action.payload, ...state.recentActivity.slice(0, 19)] };

    // Settings cases
    case 'SETTINGS_SET_LOADING':
      return { ...state, settings: { ...state.settings, loading: action.payload } };
    case 'SETTINGS_SET_DATA':
      return { ...state, settings: { ...state.settings, data: action.payload } };

    // UI cases
    case 'TOGGLE_SIDEBAR':
      return { 
        ...state, 
        ui: { ...state.ui, sidebarCollapsed: !state.ui.sidebarCollapsed } 
      };
    case 'SET_THEME':
      return { ...state, ui: { ...state.ui, theme: action.payload } };
    case 'ADD_NOTIFICATION':
      const notification = {
        id: Date.now().toString(),
        type: action.payload.type,
        message: action.payload.message,
        timestamp: new Date(),
      };
      return {
        ...state,
        ui: {
          ...state.ui,
          notifications: [...state.ui.notifications, notification],
        },
      };
    case 'REMOVE_NOTIFICATION':
      return {
        ...state,
        ui: {
          ...state.ui,
          notifications: state.ui.notifications.filter(n => n.id !== action.payload),
        },
      };

    default:
      return state;
  }
}

// Context
const AppContext = createContext<{
  state: AppState;
  dispatch: React.Dispatch<AppAction>;
  actions: {
    // System actions
    loadSystemMetrics: () => Promise<void>;
    loadSystemStatus: () => Promise<void>;
    
    // Chat actions
    sendMessage: (message: string, sessionId?: string) => Promise<void>;
    addMessage: (message: ChatMessage) => void;
    loadChatSessions: () => Promise<void>;
    loadChatHistory: (sessionId?: string) => Promise<void>;
    createChatSession: (title?: string) => Promise<ChatSession>;
    deleteChatSession: (sessionId: string) => Promise<void>;
    
    // Agents actions
    loadAgents: () => Promise<void>;
    createAgent: (agent: Partial<Agent>) => Promise<void>;
    updateAgent: (id: string, updates: Partial<Agent>) => Promise<void>;
    deleteAgent: (id: string) => Promise<void>;
    startAgent: (id: string) => Promise<void>;
    stopAgent: (id: string) => Promise<void>;
    
    // Workflows actions
    loadWorkflows: () => Promise<void>;
    createWorkflow: (workflow: Partial<Workflow>) => Promise<void>;
    updateWorkflow: (id: string, updates: Partial<Workflow>) => Promise<void>;
    deleteWorkflow: (id: string) => Promise<void>;
    runWorkflow: (id: string) => Promise<void>;
    pauseWorkflow: (id: string) => Promise<void>;
    resumeWorkflow: (id: string) => Promise<void>;
    
    // Analytics actions
    loadAnalytics: (timeRange?: 'day' | 'week' | 'month' | 'year') => Promise<void>;
    
    // Settings actions
    loadSettings: () => Promise<void>;
    updateSettings: (settings: Partial<UserSettings>) => Promise<void>;
    updateApiKey: (service: string, key: string) => Promise<void>;
    
    // UI actions
    toggleSidebar: () => void;
    setTheme: (theme: 'light' | 'dark' | 'cyberpunk' | 'neon' | 'minimal') => void;
    showNotification: (type: 'success' | 'error' | 'warning' | 'info', message: string) => void;
    removeNotification: (id: string) => void;
    
    // System stats actions
    loadSystemStats: () => Promise<void>;
    
    // Activity actions
    setRecentActivity: (activity: Array<{ id?: string; type: 'chat' | 'agent' | 'system' | 'workflow' | 'alert'; message: string; time?: string; timestamp?: string }>) => void;
    addActivity: (activity: { id?: string; type: 'chat' | 'agent' | 'system' | 'workflow' | 'alert'; message: string; time?: string; timestamp?: string }) => void;
  };
}>({} as any);

// Provider
export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(appReducer, initialState);

  // Action creators
  const actions = {
    // System actions
    loadSystemMetrics: async () => {
      dispatch({ type: 'SYSTEM_SET_LOADING', payload: true });
      try {
        const metrics = await SystemService.getSystemMetrics();
        dispatch({ type: 'SYSTEM_SET_METRICS', payload: metrics });
      } catch (error) {
        actions.showNotification('error', 'Failed to load system metrics');
      } finally {
        dispatch({ type: 'SYSTEM_SET_LOADING', payload: false });
      }
    },

    loadSystemStatus: async () => {
      try {
        const status = await SystemService.getSystemStatus();
        dispatch({ type: 'SYSTEM_SET_STATUS', payload: status });
      } catch (error) {
        actions.showNotification('error', 'Failed to load system status');
      }
    },

    // Chat actions
    sendMessage: async (message: string, sessionId?: string) => {
      dispatch({ type: 'CHAT_SET_TYPING', payload: true });
      try {
        // Add user message immediately
        const userMessage: ChatMessage = {
          id: Date.now().toString(),
          content: message,
          role: 'user',
          timestamp: new Date(),
          status: 'sending'
        };
        dispatch({ type: 'CHAT_ADD_MESSAGE', payload: userMessage });

        const response = await ChatService.sendMessage(message, sessionId);
        dispatch({ type: 'CHAT_ADD_MESSAGE', payload: response });
      } catch (error) {
        actions.showNotification('error', 'Failed to send message');
      } finally {
        dispatch({ type: 'CHAT_SET_TYPING', payload: false });
      }
    },

    addMessage: (message: ChatMessage) => {
      dispatch({ type: 'CHAT_ADD_MESSAGE', payload: message });
    },

    loadChatSessions: async () => {
      dispatch({ type: 'CHAT_SET_LOADING', payload: true });
      try {
        const sessions = await ChatService.getChatSessions();
        dispatch({ type: 'CHAT_SET_SESSIONS', payload: sessions });
      } catch (error) {
        actions.showNotification('error', 'Failed to load chat sessions');
      } finally {
        dispatch({ type: 'CHAT_SET_LOADING', payload: false });
      }
    },

    loadChatHistory: async (sessionId?: string) => {
      try {
        const messages = await ChatService.getChatHistory(sessionId);
        dispatch({ type: 'CHAT_SET_MESSAGES', payload: messages });
      } catch (error) {
        actions.showNotification('error', 'Failed to load chat history');
      }
    },

    createChatSession: async (title?: string) => {
      try {
        const session = await ChatService.createChatSession(title);
        dispatch({ type: 'CHAT_SET_CURRENT_SESSION', payload: session });
        return session;
      } catch (error) {
        actions.showNotification('error', 'Failed to create chat session');
        throw error;
      }
    },

    deleteChatSession: async (sessionId: string) => {
      try {
        await ChatService.deleteChatSession(sessionId);
        const updatedSessions = state.chat.sessions.filter(s => s.id !== sessionId);
        dispatch({ type: 'CHAT_SET_SESSIONS', payload: updatedSessions });
        actions.showNotification('success', 'Chat session deleted');
      } catch (error) {
        actions.showNotification('error', 'Failed to delete chat session');
      }
    },

    // Agents actions
    loadAgents: async () => {
      dispatch({ type: 'AGENTS_SET_LOADING', payload: true });
      try {
        const agents = await AgentsService.getAgents();
        dispatch({ type: 'AGENTS_SET_AGENTS', payload: agents });
      } catch (error) {
        actions.showNotification('error', 'Failed to load agents');
      } finally {
        dispatch({ type: 'AGENTS_SET_LOADING', payload: false });
      }
    },

    createAgent: async (agent: Partial<Agent>) => {
      try {
        const newAgent = await AgentsService.createAgent(agent);
        dispatch({ type: 'AGENTS_SET_AGENTS', payload: [...state.agents.agents, newAgent] });
        actions.showNotification('success', 'Agent created successfully');
      } catch (error) {
        actions.showNotification('error', 'Failed to create agent');
      }
    },

    updateAgent: async (id: string, updates: Partial<Agent>) => {
      try {
        const updatedAgent = await AgentsService.updateAgent(id, updates);
        dispatch({ type: 'AGENTS_UPDATE', payload: updatedAgent });
        actions.showNotification('success', 'Agent updated successfully');
      } catch (error) {
        actions.showNotification('error', 'Failed to update agent');
      }
    },

    deleteAgent: async (id: string) => {
      try {
        await AgentsService.deleteAgent(id);
        const updatedAgents = state.agents.agents.filter(a => a.id !== id);
        dispatch({ type: 'AGENTS_SET_AGENTS', payload: updatedAgents });
        actions.showNotification('success', 'Agent deleted successfully');
      } catch (error) {
        actions.showNotification('error', 'Failed to delete agent');
      }
    },

    startAgent: async (id: string) => {
      try {
        await AgentsService.startAgent(id);
        actions.loadAgents(); // Refresh agents list
        actions.showNotification('success', 'Agent started');
      } catch (error) {
        actions.showNotification('error', 'Failed to start agent');
      }
    },

    stopAgent: async (id: string) => {
      try {
        await AgentsService.stopAgent(id);
        actions.loadAgents(); // Refresh agents list
        actions.showNotification('success', 'Agent stopped');
      } catch (error) {
        actions.showNotification('error', 'Failed to stop agent');
      }
    },

    // Workflows actions
    loadWorkflows: async () => {
      dispatch({ type: 'WORKFLOWS_SET_LOADING', payload: true });
      try {
        const workflows = await WorkflowsService.getWorkflows();
        dispatch({ type: 'WORKFLOWS_SET_WORKFLOWS', payload: workflows });
      } catch (error) {
        actions.showNotification('error', 'Failed to load workflows');
      } finally {
        dispatch({ type: 'WORKFLOWS_SET_LOADING', payload: false });
      }
    },

    createWorkflow: async (workflow: Partial<Workflow>) => {
      try {
        const newWorkflow = await WorkflowsService.createWorkflow(workflow);
        dispatch({ type: 'WORKFLOWS_SET_WORKFLOWS', payload: [...state.workflows.workflows, newWorkflow] });
        actions.showNotification('success', 'Workflow created successfully');
      } catch (error) {
        actions.showNotification('error', 'Failed to create workflow');
      }
    },

    updateWorkflow: async (id: string, updates: Partial<Workflow>) => {
      try {
        const updatedWorkflow = await WorkflowsService.updateWorkflow(id, updates);
        dispatch({ type: 'WORKFLOWS_UPDATE', payload: updatedWorkflow });
        actions.showNotification('success', 'Workflow updated successfully');
      } catch (error) {
        actions.showNotification('error', 'Failed to update workflow');
      }
    },

    deleteWorkflow: async (id: string) => {
      try {
        await WorkflowsService.deleteWorkflow(id);
        const updatedWorkflows = state.workflows.workflows.filter(w => w.id !== id);
        dispatch({ type: 'WORKFLOWS_SET_WORKFLOWS', payload: updatedWorkflows });
        actions.showNotification('success', 'Workflow deleted successfully');
      } catch (error) {
        actions.showNotification('error', 'Failed to delete workflow');
      }
    },

    runWorkflow: async (id: string) => {
      try {
        await WorkflowsService.runWorkflow(id);
        actions.loadWorkflows(); // Refresh workflows list
        actions.showNotification('success', 'Workflow started');
      } catch (error) {
        actions.showNotification('error', 'Failed to run workflow');
      }
    },

    pauseWorkflow: async (id: string) => {
      try {
        await WorkflowsService.pauseWorkflow(id);
        actions.loadWorkflows(); // Refresh workflows list
        actions.showNotification('success', 'Workflow paused');
      } catch (error) {
        actions.showNotification('error', 'Failed to pause workflow');
      }
    },

    resumeWorkflow: async (id: string) => {
      try {
        await WorkflowsService.resumeWorkflow(id);
        actions.loadWorkflows(); // Refresh workflows list
        actions.showNotification('success', 'Workflow resumed');
      } catch (error) {
        actions.showNotification('error', 'Failed to resume workflow');
      }
    },

    // Analytics actions
    loadAnalytics: async (timeRange: 'day' | 'week' | 'month' | 'year' = 'week') => {
      dispatch({ type: 'ANALYTICS_SET_LOADING', payload: true });
      try {
        const data = await AnalyticsService.getAnalytics(timeRange);
        dispatch({ type: 'ANALYTICS_SET_DATA', payload: data });
        
        // Also load system stats and recent activity
        await actions.loadSystemStats();
        
        // Load or generate some sample activity
        const activity = [
          { id: '1', type: 'chat', message: 'New chat session started', time: '2 minutes ago' },
          { id: '2', type: 'agent', message: 'Data Analyzer completed task', time: '5 minutes ago' },
          { id: '3', type: 'system', message: 'System health check passed', time: '15 minutes ago' },
          { id: '4', type: 'workflow', message: 'Email workflow executed', time: '32 minutes ago' },
          { id: '5', type: 'alert', message: 'High CPU usage detected', time: '1 hour ago' }
        ];
        actions.setRecentActivity(activity);
      } catch (error) {
        actions.showNotification('error', 'Failed to load analytics');
      } finally {
        dispatch({ type: 'ANALYTICS_SET_LOADING', payload: false });
      }
    },

    // Settings actions
    loadSettings: async () => {
      dispatch({ type: 'SETTINGS_SET_LOADING', payload: true });
      try {
        const settings = await SettingsService.getSettings();
        dispatch({ type: 'SETTINGS_SET_DATA', payload: settings });
      } catch (error) {
        actions.showNotification('error', 'Failed to load settings');
      } finally {
        dispatch({ type: 'SETTINGS_SET_LOADING', payload: false });
      }
    },

    updateSettings: async (settings: Partial<UserSettings>) => {
      try {
        const updatedSettings = await SettingsService.updateSettings(settings);
        dispatch({ type: 'SETTINGS_SET_DATA', payload: updatedSettings });
        actions.showNotification('success', 'Settings updated successfully');
      } catch (error) {
        actions.showNotification('error', 'Failed to update settings');
      }
    },

    updateApiKey: async (service: string, key: string) => {
      try {
        await SettingsService.updateApiKey(service, key);
        actions.showNotification('success', 'API key updated successfully');
      } catch (error) {
        actions.showNotification('error', 'Failed to update API key');
      }
    },

    // UI actions
    toggleSidebar: () => {
      dispatch({ type: 'TOGGLE_SIDEBAR' });
    },

    setTheme: (theme: 'light' | 'dark' | 'cyberpunk' | 'neon' | 'minimal') => {
      dispatch({ type: 'SET_THEME', payload: theme });
    },

    showNotification: (type: 'success' | 'error' | 'warning' | 'info', message: string) => {
      dispatch({ type: 'ADD_NOTIFICATION', payload: { type, message } });
      // Auto-remove notification after 5 seconds
      setTimeout(() => {
        // Get the notification ID from the current state
        const { notifications } = state.ui;
        if (notifications.length > 0) {
          const latestNotification = notifications[notifications.length - 1];
          dispatch({ type: 'REMOVE_NOTIFICATION', payload: latestNotification.id });
        }
      }, 5000);
    },

    removeNotification: (id: string) => {
      dispatch({ type: 'REMOVE_NOTIFICATION', payload: id });
    },

    loadSystemStats: async () => {
      dispatch({ type: 'SYSTEM_STATS_SET_LOADING', payload: true });
      try {
        // Transform status to stats format for compatibility
        const transformedStats = {
          cpu: Math.random() * 100, // Mock data for now
          memory: Math.random() * 100,
          aiLoad: Math.random() * 100,
          powerEfficiency: Math.random() * 100
        };
        dispatch({ type: 'SYSTEM_STATS_SET_DATA', payload: transformedStats });
      } catch (error) {
        actions.showNotification('error', 'Failed to load system stats');
      } finally {
        dispatch({ type: 'SYSTEM_STATS_SET_LOADING', payload: false });
      }
    },

    setRecentActivity: (activity: any[]) => {
      dispatch({ type: 'SET_RECENT_ACTIVITY', payload: activity });
    },

    addActivity: (activity: any) => {
      dispatch({ type: 'ADD_ACTIVITY', payload: activity });
    },
  };

  // Initialize app data
  useEffect(() => {
    actions.loadSystemStatus();
    actions.loadSettings();
  }, []);

  return (
    <AppContext.Provider value={{ state, dispatch, actions }}>
      {children}
    </AppContext.Provider>
  );
};

// Hook to use the context
export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};

export default AppContext;
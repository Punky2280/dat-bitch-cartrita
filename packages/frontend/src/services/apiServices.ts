// API Base Configuration
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8001/api';

// API Request Helper
export class ApiClient {
  private static getAuthHeader(): HeadersInit {
    const token = localStorage.getItem('token');
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  private static async handleResponse<T>(response: Response): Promise<T> {
    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Network error' }));
      throw new Error(error.message || 'Request failed');
    }
    return response.json();
  }

  static async get<T>(endpoint: string): Promise<T> {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...this.getAuthHeader(),
      },
    });
    return this.handleResponse<T>(response);
  }

  static async post<T>(endpoint: string, data?: any): Promise<T> {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...this.getAuthHeader(),
      },
      body: data ? JSON.stringify(data) : undefined,
    });
    return this.handleResponse<T>(response);
  }

  static async put<T>(endpoint: string, data?: any): Promise<T> {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...this.getAuthHeader(),
      },
      body: data ? JSON.stringify(data) : undefined,
    });
    return this.handleResponse<T>(response);
  }

  static async delete<T>(endpoint: string): Promise<T> {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        ...this.getAuthHeader(),
      },
    });
    return this.handleResponse<T>(response);
  }
}

// System Metrics Service
export interface SystemMetric {
  id: string;
  label: string;
  value: string;
  trend: 'up' | 'down' | 'stable';
  status: 'healthy' | 'warning' | 'critical';
}

export interface SystemHealth {
  cpu: number;
  memory: number;
  disk: number;
  uptime: number;
  activeAgents: number;
  connections: number;
}

export class SystemService {
  static async getSystemMetrics(): Promise<SystemMetric[]> {
    try {
      const health = await ApiClient.get<SystemHealth>('/system/health');
      const cpu = health?.cpu ?? 0;
      const memory = health?.memory ?? 0;
      return [
        {
          id: 'cpu',
          label: 'CPU Usage',
          value: `${cpu.toFixed(1)}%`,
          trend: cpu > 80 ? 'up' : cpu > 50 ? 'stable' : 'down',
          status: cpu > 90 ? 'critical' : cpu > 70 ? 'warning' : 'healthy'
        },
        {
          id: 'memory',
          label: 'Memory Usage',
          value: `${(memory / 1024 / 1024 / 1024).toFixed(1)}GB`,
          trend: 'stable',
          status: memory > 8000000000 ? 'warning' : 'healthy'
        },
        {
          id: 'agents',
          label: 'Active Agents',
          value: (health?.activeAgents ?? 0).toString(),
          trend: 'up',
          status: 'healthy'
        },
        {
          id: 'connections',
          label: 'Connections',
          value: (health?.connections ?? 0).toString(),
          trend: 'stable',
          status: 'healthy'
        }
      ];
    } catch (error) {
      console.error('Failed to fetch system metrics:', error);
      // Return mock data if API fails
      return [
        { id: 'cpu', label: 'CPU Usage', value: '23%', trend: 'stable', status: 'healthy' },
        { id: 'memory', label: 'Memory', value: '4.2GB', trend: 'stable', status: 'healthy' },
        { id: 'agents', label: 'Active Agents', value: '12', trend: 'up', status: 'healthy' },
        { id: 'connections', label: 'Connections', value: '256', trend: 'stable', status: 'healthy' }
      ];
    }
  }

  static async getSystemStatus(): Promise<{ status: string; message: string }> {
    try {
      return await ApiClient.get('/health/system');
    } catch (error) {
      return { status: 'online', message: 'System operational' };
    }
  }
}

// Chat Service
export interface ChatMessage {
  id: string;
  content: string;
  role: 'user' | 'assistant';
  timestamp: Date;
  status?: 'sending' | 'sent' | 'error';
  metadata?: {
    model?: string;
    tokens?: number;
    processingTime?: number;
  };
}

export interface ChatSession {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: Date;
  updatedAt: Date;
}

export class ChatService {
  static async sendMessage(message: string, sessionId?: string): Promise<ChatMessage> {
    try {
      const response = await ApiClient.post<{
        message: ChatMessage;
        sessionId: string;
      }>('/chat/message', {
        content: message,
        sessionId: sessionId || undefined
      });
      return response.message;
    } catch (error) {
      console.error('Failed to send message:', error);
      throw error;
    }
  }

  static async getChatHistory(sessionId?: string): Promise<ChatMessage[]> {
    try {
      return await ApiClient.get(`/chat/history${sessionId ? `/${sessionId}` : ''}`);
    } catch (error) {
      console.error('Failed to get chat history:', error);
      return [];
    }
  }

  static async getChatSessions(): Promise<ChatSession[]> {
    try {
      return await ApiClient.get('/chat/sessions');
    } catch (error) {
      console.error('Failed to get chat sessions:', error);
      return [];
    }
  }

  static async createChatSession(title?: string): Promise<ChatSession> {
    try {
      return await ApiClient.post('/chat/sessions', { title });
    } catch (error) {
      console.error('Failed to create chat session:', error);
      throw error;
    }
  }

  static async deleteChatSession(sessionId: string): Promise<void> {
    try {
      await ApiClient.delete(`/chat/sessions/${sessionId}`);
    } catch (error) {
      console.error('Failed to delete chat session:', error);
      throw error;
    }
  }
}

// Agents Service
export interface Agent {
  id: string;
  name: string;
  description: string;
  status: 'active' | 'idle' | 'offline';
  capabilities: string[];
  lastActivity: Date;
  performance: {
    tasksCompleted: number;
    averageResponseTime: number;
    successRate: number;
  };
}

export class AgentsService {
  static async getAgents(): Promise<Agent[]> {
    try {
      return await ApiClient.get('/health/agents');
    } catch (error) {
      console.error('Failed to get agents:', error);
      return [];
    }
  }

  static async getAgent(id: string): Promise<Agent> {
    return await ApiClient.get(`/agents/${id}`);
  }

  static async createAgent(agent: Partial<Agent>): Promise<Agent> {
    return await ApiClient.post('/agents', agent);
  }

  static async updateAgent(id: string, updates: Partial<Agent>): Promise<Agent> {
    return await ApiClient.put(`/agents/${id}`, updates);
  }

  static async deleteAgent(id: string): Promise<void> {
    await ApiClient.delete(`/agents/${id}`);
  }

  static async startAgent(id: string): Promise<void> {
    await ApiClient.post(`/agents/${id}/start`);
  }

  static async stopAgent(id: string): Promise<void> {
    await ApiClient.post(`/agents/${id}/stop`);
  }
}

// Workflows Service
export interface Workflow {
  id: string;
  name: string;
  description: string;
  status: 'running' | 'scheduled' | 'completed' | 'failed' | 'paused';
  schedule?: string;
  lastRun?: Date;
  nextRun?: Date;
  executions: {
    total: number;
    successful: number;
    failed: number;
  };
  steps: WorkflowStep[];
}

export interface WorkflowStep {
  id: string;
  name: string;
  type: string;
  config: any;
  position: { x: number; y: number };
}

export class WorkflowsService {
  static async getWorkflows(): Promise<Workflow[]> {
    try {
      return await ApiClient.get('/workflows');
    } catch (error) {
      console.error('Failed to get workflows:', error);
      return [];
    }
  }

  static async getWorkflow(id: string): Promise<Workflow> {
    return await ApiClient.get(`/workflows/${id}`);
  }

  static async createWorkflow(workflow: Partial<Workflow>): Promise<Workflow> {
    return await ApiClient.post('/workflows', workflow);
  }

  static async updateWorkflow(id: string, updates: Partial<Workflow>): Promise<Workflow> {
    return await ApiClient.put(`/workflows/${id}`, updates);
  }

  static async deleteWorkflow(id: string): Promise<void> {
    await ApiClient.delete(`/workflows/${id}`);
  }

  static async runWorkflow(id: string): Promise<void> {
    await ApiClient.post(`/workflows/${id}/run`);
  }

  static async pauseWorkflow(id: string): Promise<void> {
    await ApiClient.post(`/workflows/${id}/pause`);
  }

  static async resumeWorkflow(id: string): Promise<void> {
    await ApiClient.post(`/workflows/${id}/resume`);
  }
}

// Analytics Service
export interface AnalyticsMetric {
  timestamp: Date;
  value: number;
  label?: string;
}

export interface AnalyticsData {
  interactions: AnalyticsMetric[];
  users: AnalyticsMetric[];
  responseTime: AnalyticsMetric[];
  successRate: AnalyticsMetric[];
}

export class AnalyticsService {
  static async getAnalytics(timeRange: 'day' | 'week' | 'month' | 'year' = 'week'): Promise<AnalyticsData> {
    try {
      return await ApiClient.get(`/analytics?range=${timeRange}`);
    } catch (error) {
      console.error('Failed to get analytics:', error);
      // Return mock data
      return {
        interactions: [],
        users: [],
        responseTime: [],
        successRate: []
      };
    }
  }

  static async getPerformanceMetrics(): Promise<any> {
    try {
      return await ApiClient.get('/analytics/performance');
    } catch (error) {
      console.error('Failed to get performance metrics:', error);
      return {};
    }
  }
}

// Settings Service
export interface UserSettings {
  theme: 'light' | 'dark' | 'auto';
  language: string;
  notifications: boolean | string;
  soundEnabled: boolean;
  autoSave: boolean;
  apiKeys: { [service: string]: string };
  displayName?: string;
  email?: string;
  timezone?: string;
  enable2FA?: boolean;
  sessionTimeout?: string;
  dataEncryption?: boolean;
  emailNotifications?: boolean;
  pushNotifications?: boolean;
  soundNotifications?: boolean;
  agentUpdates?: boolean;
  systemAlerts?: boolean;
  accentColor?: string;
  animations?: boolean;
  autoSaveInterval?: string;
  enableTelemetry?: boolean;
  enableCaching?: boolean;
  enableCompression?: boolean;
  enableBackups?: boolean;
  openaiKey?: string;
  deepgramKey?: string;
  elevenLabsKey?: string;
  huggingfaceKey?: string;
  [key: string]: any; // Allow additional settings
}

export class SettingsService {
  static async getSettings(): Promise<UserSettings> {
    try {
      return await ApiClient.get('/settings');
    } catch (error) {
      console.error('Failed to get settings:', error);
      return {
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
      };
    }
  }

  static async updateSettings(settings: Partial<UserSettings>): Promise<UserSettings> {
    return await ApiClient.put('/settings', settings);
  }

  static async updateApiKey(service: string, key: string): Promise<void> {
    await ApiClient.put('/settings/api-keys', { [service]: key });
  }
}


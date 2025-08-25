import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import { 
  APIResponse, 
  PaginatedResponse, 
  LoginRequest, 
  RegisterRequest, 
  AuthResponse,
  User,
  Conversation,
  Message,
  Tool,
  Model,
  KnowledgeBase,
  Document,
  SearchResult,
  Analytics,
  Workflow,
  APIKey
} from '@/types';

// API Configuration - Updated for Cartrita V2 Backend
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8001';
const API_TIMEOUT = 30000; // 30 seconds

class APIClient {
  private client: AxiosInstance;
  private token: string | null = null;

  constructor() {
    this.client = axios.create({
      baseURL: `${API_BASE_URL}/api`,
      timeout: API_TIMEOUT,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Request interceptor to add auth token
    this.client.interceptors.request.use(
      (config) => {
        if (this.token) {
          config.headers.Authorization = `Bearer ${this.token}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor to handle common errors
    this.client.interceptors.response.use(
      (response) => response,
      async (error) => {
        if (error.response?.status === 401) {
          // Token expired or invalid
          this.clearToken();
          // Redirect to login or refresh token
          if (typeof window !== 'undefined') {
            window.location.href = '/login';
          }
        }
        return Promise.reject(error);
      }
    );

    // Load token from localStorage on initialization
    if (typeof window !== 'undefined') {
      const savedToken = localStorage.getItem('auth_token');
      if (savedToken) {
        this.setToken(savedToken);
      }
    }
  }

  setToken(token: string) {
    this.token = token;
    if (typeof window !== 'undefined') {
      localStorage.setItem('auth_token', token);
    }
  }

  clearToken() {
    this.token = null;
    if (typeof window !== 'undefined') {
      localStorage.removeItem('auth_token');
    }
  }

  // Generic request methods
  private async request<T = any>(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH',
    url: string,
    data?: any,
    config?: AxiosRequestConfig
  ): Promise<T> {
    try {
      const response: AxiosResponse<APIResponse<T>> = await this.client.request({
        method,
        url,
        data,
        ...config,
      });

      if (response.data.success) {
        return response.data.data as T;
      } else {
        throw new Error(response.data.error || 'API request failed');
      }
    } catch (error: any) {
      if (error.response?.data?.error) {
        throw new Error(error.response.data.error);
      }
      throw error;
    }
  }

  // Authentication
  async login(credentials: LoginRequest): Promise<AuthResponse> {
    const response = await this.request<AuthResponse>('POST', '/auth/login', credentials);
    this.setToken(response.token);
    return response;
  }

  async register(userData: RegisterRequest): Promise<AuthResponse> {
    const response = await this.request<AuthResponse>('POST', '/auth/register', userData);
    this.setToken(response.token);
    return response;
  }

  async logout(): Promise<void> {
    try {
      await this.request('POST', '/auth/logout');
    } finally {
      this.clearToken();
    }
  }

  async refreshToken(): Promise<AuthResponse> {
    const response = await this.request<AuthResponse>('POST', '/auth/refresh');
    this.setToken(response.token);
    return response;
  }

  async getProfile(): Promise<User> {
    return this.request<User>('GET', '/auth/profile');
  }

  async updateProfile(userData: Partial<User>): Promise<User> {
    return this.request<User>('PUT', '/auth/profile', userData);
  }

  // Conversations
  async getConversations(page = 1, limit = 50): Promise<PaginatedResponse<Conversation>> {
    return this.request<PaginatedResponse<Conversation>>('GET', `/chatHistory/conversations?page=${page}&limit=${limit}`);
  }

  async getConversation(id: string): Promise<Conversation> {
    return this.request<Conversation>('GET', `/chatHistory/conversations/${id}`);
  }

  async createConversation(title?: string): Promise<Conversation> {
    return this.request<Conversation>('POST', '/chatHistory/conversations', { title });
  }

  async updateConversation(id: string, updates: Partial<Conversation>): Promise<Conversation> {
    return this.request<Conversation>('PUT', `/chatHistory/conversations/${id}`, updates);
  }

  async deleteConversation(id: string): Promise<void> {
    return this.request('DELETE', `/chatHistory/conversations/${id}`);
  }

  async archiveConversation(id: string): Promise<void> {
    return this.request('POST', `/chatHistory/conversations/${id}/archive`);
  }

  async pinConversation(id: string): Promise<void> {
    return this.request('POST', `/chatHistory/conversations/${id}/pin`);
  }

  // Messages
  async getMessages(conversationId: string, page = 1, limit = 50): Promise<PaginatedResponse<Message>> {
    return this.request<PaginatedResponse<Message>>('GET', `/chatHistory/conversations/${conversationId}/messages?page=${page}&limit=${limit}`);
  }

  async sendMessage(conversationId: string, content: string, attachments?: File[]): Promise<Message> {
    const formData = new FormData();
    formData.append('content', content);
    formData.append('conversationId', conversationId);
    
    if (attachments) {
      attachments.forEach((file, index) => {
        formData.append(`attachment_${index}`, file);
      });
    }

    return this.request<Message>('POST', `/chatHistory/conversations/${conversationId}/messages`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  }

  async updateMessage(conversationId: string, messageId: string, updates: Partial<Message>): Promise<Message> {
    return this.request<Message>('PUT', `/chatHistory/conversations/${conversationId}/messages/${messageId}`, updates);
  }

  async deleteMessage(conversationId: string, messageId: string): Promise<void> {
    return this.request('DELETE', `/chatHistory/conversations/${conversationId}/messages/${messageId}`);
  }

  // AI/Chat Router
  async chatCompletion(prompt: string, options?: {
    model?: string;
    temperature?: number;
    maxTokens?: number;
    conversationId?: string;
  }): Promise<Message> {
    return this.request<Message>('POST', '/router', {
      task: 'chat',
      prompt,
      options,
    });
  }

  async searchKnowledge(query: string, options?: {
    limit?: number;
    threshold?: number;
    documentIds?: string[];
  }): Promise<SearchResult[]> {
    const response = await this.request<{ results: SearchResult[] }>('POST', '/router', {
      task: 'search',
      query,
      options,
    });
    return response.results;
  }

  async ragQuery(query: string, options?: {
    searchLimit?: number;
    searchThreshold?: number;
    includeReferences?: boolean;
    model?: string;
    maxTokens?: number;
  }): Promise<{
    response: string;
    references: SearchResult[];
    model: string;
  }> {
    return this.request('POST', '/router', {
      task: 'rag',
      query,
      options,
    });
  }

  // Tools
  async getTools(): Promise<Tool[]> {
    return this.request<Tool[]>('GET', '/workflowTools');
  }

  async executeTool(toolName: string, parameters: Record<string, any>): Promise<any> {
    return this.request('POST', `/workflowTools/${toolName}/execute`, parameters);
  }

  // Models
  async getModels(): Promise<Model[]> {
    return this.request<Model[]>('GET', '/modelRouting/models');
  }

  async getModelStatus(modelId: string): Promise<{ status: string; available: boolean }> {
    return this.request('GET', `/modelRouting/models/${modelId}/status`);
  }

  // Knowledge Base
  async getKnowledgeBases(): Promise<KnowledgeBase[]> {
    return this.request<KnowledgeBase[]>('GET', '/knowledgeHub/bases');
  }

  async createKnowledgeBase(data: { name: string; description: string; isPublic?: boolean }): Promise<KnowledgeBase> {
    return this.request<KnowledgeBase>('POST', '/knowledgeHub/bases', data);
  }

  async updateKnowledgeBase(id: string, updates: Partial<KnowledgeBase>): Promise<KnowledgeBase> {
    return this.request<KnowledgeBase>('PUT', `/knowledgeHub/bases/${id}`, updates);
  }

  async deleteKnowledgeBase(id: string): Promise<void> {
    return this.request('DELETE', `/knowledgeHub/bases/${id}`);
  }

  async uploadDocument(knowledgeBaseId: string, file: File, metadata?: Record<string, any>): Promise<Document> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('knowledgeBaseId', knowledgeBaseId);
    if (metadata) {
      formData.append('metadata', JSON.stringify(metadata));
    }

    return this.request<Document>('POST', `/knowledgeHub/documents`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  }

  async getDocuments(knowledgeBaseId: string): Promise<Document[]> {
    return this.request<Document[]>('GET', `/knowledgeHub/bases/${knowledgeBaseId}/documents`);
  }

  async deleteDocument(documentId: string): Promise<void> {
    return this.request('DELETE', `/knowledgeHub/documents/${documentId}`);
  }

  // Vision/Image Analysis
  async analyzeImage(file: File, prompt?: string): Promise<{
    description: string;
    objects: string[];
    text?: string;
    analysis: Record<string, any>;
  }> {
    const formData = new FormData();
    formData.append('image', file);
    if (prompt) {
      formData.append('prompt', prompt);
    }

    return this.request('POST', '/vision/analyze', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  }

  async getVisionStatus(): Promise<{ status: string; available: boolean }> {
    return this.request('GET', '/vision/status');
  }

  // Audio
  async transcribeAudio(file: File, options?: {
    language?: string;
    model?: string;
  }): Promise<{ text: string; confidence?: number; language?: string }> {
    const formData = new FormData();
    formData.append('audio', file);
    if (options) {
      formData.append('options', JSON.stringify(options));
    }

    return this.request('POST', '/audio/transcribe', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  }

  async synthesizeSpeech(text: string, options?: {
    voice?: string;
    speed?: number;
    pitch?: number;
  }): Promise<Blob> {
    const response = await this.client.post('/audio/synthesize', {
      text,
      options,
    }, {
      responseType: 'blob',
    });

    return response.data;
  }

  // Workflows
  async getWorkflows(): Promise<Workflow[]> {
    return this.request<Workflow[]>('GET', '/workflows');
  }

  async createWorkflow(workflow: Omit<Workflow, 'id' | 'createdAt' | 'updatedAt'>): Promise<Workflow> {
    return this.request<Workflow>('POST', '/workflows', workflow);
  }

  async updateWorkflow(id: string, updates: Partial<Workflow>): Promise<Workflow> {
    return this.request<Workflow>('PUT', `/workflows/${id}`, updates);
  }

  async deleteWorkflow(id: string): Promise<void> {
    return this.request('DELETE', `/workflows/${id}`);
  }

  async executeWorkflow(id: string, inputs?: Record<string, any>): Promise<{
    executionId: string;
    status: string;
    outputs?: Record<string, any>;
  }> {
    return this.request('POST', `/workflows/${id}/execute`, { inputs });
  }

  async getWorkflowExecution(executionId: string): Promise<{
    id: string;
    status: string;
    outputs?: Record<string, any>;
    error?: string;
    startedAt: string;
    completedAt?: string;
  }> {
    return this.request('GET', `/workflows/executions/${executionId}`);
  }

  // Python Execution (New Feature)
  async executePython(code: string, context?: Record<string, any>): Promise<{
    result: any;
    output: string;
    error?: string;
    executionTime: number;
  }> {
    return this.request('POST', '/python/execute', {
      code,
      context,
    });
  }

  async getPythonModules(): Promise<string[]> {
    return this.request<string[]>('GET', '/python/modules');
  }

  async installPythonPackage(packageName: string): Promise<{ success: boolean; message: string }> {
    return this.request('POST', '/python/install', { package: packageName });
  }

  // API Keys Management
  async getAPIKeys(): Promise<APIKey[]> {
    return this.request<APIKey[]>('GET', '/apiKeys');
  }

  async createAPIKey(data: { name: string; provider: string; key: string }): Promise<APIKey> {
    return this.request<APIKey>('POST', '/apiKeys', data);
  }

  async updateAPIKey(id: string, updates: Partial<APIKey>): Promise<APIKey> {
    return this.request<APIKey>('PUT', `/apiKeys/${id}`, updates);
  }

  async deleteAPIKey(id: string): Promise<void> {
    return this.request('DELETE', `/apiKeys/${id}`);
  }

  async testAPIKey(id: string): Promise<{ valid: boolean; error?: string }> {
    return this.request('POST', `/apiKeys/${id}/test`);
  }

  // Analytics
  async getAnalytics(timeRange?: '7d' | '30d' | '90d' | '1y'): Promise<Analytics> {
    return this.request<Analytics>('GET', `/analytics?range=${timeRange || '30d'}`);
  }

  async getUsageMetrics(): Promise<{
    tokensUsed: number;
    apiCalls: number;
    cost: number;
    period: string;
  }> {
    return this.request('GET', '/analytics/usage');
  }

  // Settings
  async getSettings(): Promise<Record<string, any>> {
    return this.request('GET', '/settings');
  }

  async updateSettings(settings: Record<string, any>): Promise<Record<string, any>> {
    return this.request('PUT', '/settings', settings);
  }

  // Health Check
  async healthCheck(): Promise<{ status: string; timestamp: string; services: Record<string, boolean> }> {
    return this.request('GET', '/health');
  }

  // File Upload (Generic)
  async uploadFile(file: File, purpose?: string): Promise<{
    id: string;
    url: string;
    name: string;
    size: number;
    mimeType: string;
  }> {
    const formData = new FormData();
    formData.append('file', file);
    if (purpose) {
      formData.append('purpose', purpose);
    }

    return this.request('POST', '/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  }

  // WebSocket URL for real-time features
  getWebSocketURL(): string {
    const wsProtocol = API_BASE_URL.startsWith('https') ? 'wss' : 'ws';
    const wsHost = API_BASE_URL.replace(/^https?:\/\//, '');
    return `${wsProtocol}://${wsHost}/ws`;
  }
}

// Create and export a singleton instance
export const apiClient = new APIClient();
export default apiClient;
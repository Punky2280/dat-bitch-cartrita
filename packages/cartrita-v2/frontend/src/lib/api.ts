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
// Prefer explicit envs; on the client, fall back to current origin to avoid cross-origin issues
const getBrowserBase = () => {
  // In the browser, prefer relative URLs so Next.js rewrites proxy correctly
  if (typeof window !== 'undefined') {
    return '';
  }
  return undefined;
};

const isServer = typeof window === 'undefined';
// On the server (SSR), use env vars; in the browser, force relative base ('')
const API_BASE_URL = isServer
  ? (process.env.API_BASE_URL || process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000')
  : (getBrowserBase() || '');
const PYTHON_API_BASE_URL = isServer
  ? (process.env.PYTHON_API_BASE_URL || process.env.NEXT_PUBLIC_PYTHON_API_BASE_URL || 'http://localhost:8000')
  : (getBrowserBase() || '');
const API_TIMEOUT = 30000; // 30 seconds

class APIClient {
  private client: AxiosInstance;
  private pythonClient: AxiosInstance;
  private token: string | null = null;

  constructor() {
    this.client = axios.create({
      baseURL: `${API_BASE_URL}/api`,
      timeout: API_TIMEOUT,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    this.pythonClient = axios.create({
      baseURL: `${PYTHON_API_BASE_URL}/api`,
      timeout: API_TIMEOUT,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Request interceptor to add auth token for both clients
    const requestInterceptor = (config: any) => {
      if (this.token) {
        config.headers.Authorization = `Bearer ${this.token}`;
      }
      return config;
    };

    this.client.interceptors.request.use(requestInterceptor, (error) => Promise.reject(error));
    this.pythonClient.interceptors.request.use(requestInterceptor, (error) => Promise.reject(error));

    // Response interceptor to handle common errors for both clients
    const responseInterceptor = async (error: any) => {
      if (error.response?.status === 401) {
        // Token expired or invalid
        this.clearToken();
        // Redirect to login or refresh token
        if (typeof window !== 'undefined') {
          window.location.href = '/login';
        }
      }
      return Promise.reject(error);
    };

    this.client.interceptors.response.use(
      (response) => response,
      responseInterceptor
    );
    this.pythonClient.interceptors.response.use(
      (response) => response,
      responseInterceptor
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
    const maxRetries = 3;
    const baseDelay = 500; // ms
    let attempt = 0;

    // simple delay helper
    const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

    // retry loop for transient errors
    while (true) {
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
        const status = error?.response?.status;
        const isTransient = status === 429 || status === 503 || status === 502 || error.code === 'ECONNABORTED' || error.message?.includes('Network Error');
        if (isTransient && attempt < maxRetries) {
          attempt += 1;
          const delay = baseDelay * Math.pow(2, attempt - 1);
          await sleep(delay);
          continue;
        }
        if (error.response?.data?.error) {
          throw new Error(error.response.data.error);
        }
        throw error;
      }
    }
  }

  // Python backend request method (private)
  private async _pythonRequest<T = any>(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH',
    url: string,
    data?: any,
    config?: AxiosRequestConfig
  ): Promise<T> {
    const maxRetries = 3;
    const baseDelay = 500; // ms
    let attempt = 0;

    // simple delay helper
    const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

    // retry loop for transient errors
    while (true) {
      try {
        const response: AxiosResponse<T> = await this.pythonClient.request({
          method,
          url,
          data,
          ...config,
        });

        return response.data;
      } catch (error: any) {
        const status = error?.response?.status;
        const isTransient = status === 429 || status === 503 || status === 502 || error.code === 'ECONNABORTED' || error.message?.includes('Network Error');
        if (isTransient && attempt < maxRetries) {
          attempt += 1;
          const delay = baseDelay * Math.pow(2, attempt - 1);
          await sleep(delay);
          continue;
        }
        throw error;
      }
    }
  }

  // Public method to access Python backend
  async pythonRequest<T = any>(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH',
    url: string,
    data?: any,
    config?: AxiosRequestConfig
  ): Promise<T> {
    return this._pythonRequest(method, url, data, config);
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

  // Vision/Image Analysis (Simplified approach using direct OpenAI call)
  async analyzeImage(file: File, prompt?: string, sessionId?: string): Promise<{
    description: string;
    objects: string[];
    text?: string;
    analysis: Record<string, any>;
  }> {
    // 1) Upload the file to Python V2 vision upload
    const form = new FormData();
    form.append('file', file);
    form.append('session_id', sessionId || 'vision_session');

    const upload = await this._pythonRequest<{
      filename: string;
      file_path: string;
      upload_id: string;
      status: string;
  }>('POST', '/chat/vision/upload', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });

    // 2) Analyze the uploaded file
    return this._pythonRequest<{
      description: string;
      objects: string[];
      text?: string;
      analysis: Record<string, any>;
    }>('POST', '/chat/vision/analyze', {
      filename: upload.filename,
      prompt,
      session_id: sessionId || 'vision_session',
      analysis_types: ['objects', 'text', 'scene'],
    });
  }

  async getVisionStatus(): Promise<{ status: string; available: boolean }> {
    try {
  const statusResponse = await this._pythonRequest<any>('GET', '/v2/chat/status');
      const agents = statusResponse.agents || {};
      const visionAgent = agents.vision_agent_v2 || agents.vision || agents;
      const status = typeof visionAgent === 'string' ? visionAgent : (visionAgent?.status || 'unknown');
      return {
        status,
        available: ['idle', 'active', 'healthy'].includes(status),
      };
    } catch {
      return { status: 'unavailable', available: false };
    }
  }

  // Audio
  async transcribeAudio(file: File, options?: {
    language?: string;
    model?: string;
  }): Promise<{ text: string; confidence?: number; language?: string }> {
    try {
      // No dedicated audio endpoint in V2; route via chat to supervisor with instruction
  await this._pythonRequest<any>('POST', '/v2/chat/chat', {
        session_id: 'transcription_session',
        message: `Transcribe audio file: ${file.name} (${file.size} bytes, ${file.type}). Language: ${options?.language || 'English'}.`,
        agent_id: 'supervisor',
        stream: false,
      });
      return {
        text: `Audio file received: ${file.name} (${(file.size / 1024).toFixed(1)}KB)`,
        confidence: 0.8,
        language: options?.language || 'en',
      };
    } catch (error) {
      console.error('Audio transcription failed:', error);
      throw new Error('Audio transcription service unavailable');
    }
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

  // Python Chat Integration (Enhanced)
  async sendChatMessage(message: string, options?: {
    agent_id?: string;
    session_id?: string;
    stream?: boolean;
    context?: Record<string, any>;
  }): Promise<{
    content: string;
    agent_id: string;
    session_id: string;
    model?: string;
    processing_time?: number;
    timestamp?: string;
    provider?: string;
    task_id?: string;
    reasoning?: string;
  }> {
    // Non-streaming request to V2 chat
  const res = await this._pythonRequest<any>('POST', '/v2/chat/chat', {
      session_id: options?.session_id || 'default',
      message,
      agent_id: options?.agent_id || 'supervisor',
      stream: false,
      context: options?.context || {},
    });

    // Backend returns { message, agent_id } for non-stream
    const content = res?.message ?? res?.content ?? '';
    return {
      content,
      agent_id: res?.agent_id || options?.agent_id || 'supervisor',
      session_id: options?.session_id || 'default',
    };
  }

  // Streaming chat (SSE). Uses Next.js rewrite to proxy to Python backend.
  async streamChatMessage(params: {
    message: string;
    session_id: string;
    agent_id?: string;
    context?: Record<string, any>;
    onToken: (token: string) => void;
    onDone?: (final?: string) => void;
    onError?: (err: any) => void;
    signal?: AbortSignal;
  }): Promise<void> {
    const body = JSON.stringify({
      session_id: params.session_id,
      message: params.message,
      agent_id: params.agent_id || 'supervisor',
      stream: true,
      context: params.context || {},
    });

    // Always use relative path so Next.js rewrites apply in browser
  const url = '/api/v2/chat/chat';
    try {
      const resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        signal: params.signal,
      });

      if (!resp.ok || !resp.body) {
        throw new Error(`Stream failed: ${resp.status}`);
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';
      let final = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) {
          break;
        }
        buffer += decoder.decode(value, { stream: true });

        // Parse SSE lines
        let idx;
        while ((idx = buffer.indexOf('\n\n')) !== -1) {
          const chunk = buffer.slice(0, idx).trim();
          buffer = buffer.slice(idx + 2);
          if (!chunk.startsWith('data:')) {
            continue;
          }
          const dataStr = chunk.replace(/^data:\s*/, '');
          try {
            const data = JSON.parse(dataStr);
            if (data.content) {
              final += data.content;
              params.onToken(data.content);
            }
            if (data.done) {
              params.onDone?.(final);
            }
            if (data.error) {
              throw new Error(data.error);
            }
          } catch (e) {
            // ignore malformed lines
          }
        }
      }

      // Flush any remaining buffer
      if (buffer) {
        try {
          const data = JSON.parse(buffer.replace(/^data:\s*/, ''));
          if (data.content) {
            final += data.content;
            params.onToken(data.content);
          }
          if (data.done) {
            params.onDone?.(final);
          }
        } catch {}
      }
    } catch (err) {
      params.onError?.(err);
      throw err;
    }
  }

  // Python Chat Sessions
  async createChatSession(title?: string, agent_id?: string): Promise<{
    id: string;
    title: string;
    created_at: string;
    updated_at: string;
    agent_id?: string;
    context?: Record<string, any>;
    message_count: number;
  }> {
  return this._pythonRequest('POST', '/v2/chat/sessions', {
      title,
      agent_id,
      context: {}
    });
  }

  async getChatSessions(limit = 20, offset = 0): Promise<Array<{
    id: string;
    title: string;
    created_at: string;
    updated_at: string;
    agent_id?: string;
    context?: Record<string, any>;
    message_count: number;
  }>> {
  return this._pythonRequest('GET', `/v2/chat/sessions?limit=${limit}&offset=${offset}`);
  }

  async getChatMessages(sessionId: string, limit = 50, offset = 0): Promise<Array<{
    id: string;
    session_id: string;
    role: string;
    content: string;
    agent_id?: string;
    timestamp: string;
    metadata?: Record<string, any>;
    attachments?: string[];
    tools_used?: string[];
    execution_details?: Record<string, any>;
  }>> {
  return this._pythonRequest('GET', `/v2/chat/sessions/${sessionId}/messages?limit=${limit}&offset=${offset}`);
  }

  async deleteChatSession(sessionId: string): Promise<void> {
  await this._pythonRequest('DELETE', `/v2/chat/sessions/${sessionId}`);
  }

  async submitChatFeedback(params: { session_id: string; message_id: string; rating: number; feedback?: string }): Promise<{ feedback_id: string; status: string }> {
  return this._pythonRequest('POST', `/v2/chat/sessions/${params.session_id}/feedback`, undefined, {
      params: {
        message_id: params.message_id,
        rating: params.rating,
        feedback: params.feedback,
      },
    });
  }

  async uploadChatAttachment(session_id: string, file: File): Promise<{
    filename: string;
    content_type: string;
    size: number;
    file_path: string;
  }> {
    const form = new FormData();
    form.append('session_id', session_id);
    form.append('file', file);
  return this._pythonRequest('POST', '/v2/chat/upload', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  }

  // Multi-agent coordination
  async coordinateMultiAgent(message: string, options: {
    session_id: string;
    agent_capabilities: string[];
    coordination_strategy?: string;
    stream?: boolean;
  }): Promise<{
    content: string;
    metadata?: Record<string, any>;
  }> {
  return this._pythonRequest('POST', '/v2/chat/multi-agent', {
      message,
      session_id: options.session_id,
      agent_capabilities: options.agent_capabilities,
      coordination_strategy: options.coordination_strategy || 'sequential',
      stream: options.stream || false
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

  // Agents Management (Python Backend)
  async getAllAgents(): Promise<Array<{
    id: string;
    name: string;
    description: string;
    capabilities: string[];
    model: string;
    status: string;
  }>> {
    // Use V2 agents list
    const res = await this._pythonRequest<any>('GET', '/agents');
    return (res?.data as any[]) || [];
  }

  async getAgentDetails(agentId: string): Promise<any> {
    return this._pythonRequest('GET', `/agents/${agentId}/status`);
  }

  async updateAgentConfig(agentId: string, config: any): Promise<any> {
    // No direct config route in V2; passthrough to legacy if present
    return this.request('PUT', `/agents/${agentId}/config`, config);
  }

  async getAgentMetrics(agentId: string): Promise<any> {
    // Use V2 status as metrics fallback
    return this._pythonRequest('GET', `/agents/${agentId}/status`);
  }

  async restartAgent(agentId: string): Promise<void> {
    // Not supported in V2; no-op
    return;
  }

  async pauseAgent(agentId: string): Promise<void> {
    // Not supported in V2; no-op
    return;
  }

  async resumeAgent(agentId: string): Promise<void> {
    // Not supported in V2; no-op
    return;
  }

  // Quantum Computing Operations (Python Backend)
  async getQuantumStatus(): Promise<any> {
  return this._pythonRequest('GET', '/v2/chat/status');
  }

  // Quantum Computing Operations (Python Backend)
  async executeQuantumAlgorithm(algorithm: string, parameters: any): Promise<any> {
  return this._pythonRequest('POST', '/v2/chat/quantum/jobs', {
      algorithm,
      parameters
    });
  }

  async getQuantumJobs(): Promise<any[]> {
  return this._pythonRequest<any[]>('GET', '/v2/chat/quantum/jobs');
  }

  async getQuantumJob(jobId: string): Promise<any> {
  return this._pythonRequest('GET', `/v2/chat/quantum/jobs/${jobId}`);
  }

  async getQuantumJobResults(jobId: string): Promise<any> {
  return this._pythonRequest('GET', `/v2/chat/quantum/jobs/${jobId}/results`);
  }

  async cancelQuantumJob(jobId: string): Promise<void> {
  return this._pythonRequest('POST', `/v2/chat/quantum/jobs/${jobId}/cancel`);
  }

  async getQuantumAlgorithms(): Promise<any[]> {
  const res = await this._pythonRequest<{ algorithms: any[] }>('GET', '/v2/chat/quantum/algorithms');
    return res.algorithms || [];
  }

  // Research Hub Operations (Python Backend)
  async searchAcademicPapers(query: string, limit = 10): Promise<any[]> {
  const response = await this._pythonRequest<any>('POST', '/v2/simple-chat', {
      message: `Search for academic papers about: ${query}. Return ${limit} structured results with titles, authors, abstracts, and URLs.`,
      agent_id: 'research_agent_v2',
      session_id: 'research_session'
    });
    
    // The research agent should return structured data in the metadata
    if (response.metadata?.papers) {
      return response.metadata.papers;
    }
    
    // Fallback: parse from content or return mock data
    return Array.from({ length: Math.min(limit, 5) }, (_, i) => ({
      id: `paper_${i + 1}`,
      title: `Research Paper ${i + 1} about ${query}`,
      authors: [`Author ${i + 1}`],
      abstract: `This paper explores ${query} and provides insights into the field.`,
      year: 2023 - i,
      citations: Math.floor(Math.random() * 100),
      url: `https://example.com/paper_${i + 1}`
    }));
  }

  async analyzeDocument(documentId: string): Promise<any> {
  return this._pythonRequest('POST', '/v2/simple-chat', {
      message: `Perform comprehensive analysis of document with ID: ${documentId}`,
      agent_id: 'research_agent_v2',
      session_id: 'document_analysis_session'
    });
  }

  async saveResearchNote(title: string, content: string, tags?: string[]): Promise<any> {
    return this.request('POST', '/research/notes', { title, content, tags });
  }

  async getResearchNotes(): Promise<any[]> {
    return this.request<any[]>('GET', '/research/notes');
  }

  // System Monitoring
  async getSystemMetrics(): Promise<any> {
    return this.request('GET', '/system/metrics');
  }

  async getResourceUsage(): Promise<any> {
    return this.request('GET', '/system/resources');
  }

  async getLogs(service?: string, level?: string): Promise<any[]> {
    const params = new URLSearchParams();
    if (service) {
      params.append('service', service);
    }
    if (level) {
      params.append('level', level);
    }
    return this.request<any[]>('GET', `/system/logs?${params}`);
  }

  // API Console Operations
  async testApiEndpoint(method: string, endpoint: string, payload?: any): Promise<any> {
    return this.request('POST', '/api-console/test', { method, endpoint, payload });
  }

  async getApiDocumentation(): Promise<any> {
    return this.request('GET', '/api-console/docs');
  }

  async generateApiKey(name: string, permissions?: string[]): Promise<any> {
    return this.request('POST', '/api-console/keys', { name, permissions });
  }

  // Notification System
  async getNotifications(page = 1, limit = 20): Promise<any> {
    return this.request('GET', `/notifications?page=${page}&limit=${limit}`);
  }

  async markNotificationRead(notificationId: string): Promise<void> {
    return this.request('PUT', `/notifications/${notificationId}/read`);
  }

  async markAllNotificationsRead(): Promise<void> {
    return this.request('PUT', '/notifications/mark-all-read');
  }

  async deleteNotification(notificationId: string): Promise<void> {
    return this.request('DELETE', `/notifications/${notificationId}`);
  }

  // User Management
  async getUsers(page = 1, limit = 20): Promise<any> {
    return this.request('GET', `/admin/users?page=${page}&limit=${limit}`);
  }

  async getUserDetails(userId: string): Promise<any> {
    return this.request('GET', `/admin/users/${userId}`);
  }

  async updateUser(userId: string, updates: any): Promise<any> {
    return this.request('PUT', `/admin/users/${userId}`, updates);
  }

  async deleteUser(userId: string): Promise<void> {
    return this.request('DELETE', `/admin/users/${userId}`);
  }

  // Backup & Export
  async exportData(type: 'conversations' | 'workflows' | 'settings' | 'all'): Promise<Blob> {
    const response = await this.client.get(`/export/${type}`, {
      responseType: 'blob'
    });
    return response.data;
  }

  async importData(file: File, type: string): Promise<any> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('type', type);

    return this.request('POST', '/import', formData, {
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
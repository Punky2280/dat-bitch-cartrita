// Core types for the Cartrita frontend

export interface User {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  role: 'user' | 'admin';
  preferences?: UserPreferences;
  isVerified?: boolean;
  lastActive?: string;
  createdAt: string;
  updatedAt: string;
}

export interface UserPreferences {
  theme: 'light' | 'dark' | 'system';
  language: string;
  timezone: string;
  sarcasmLevel: number;
  verbosity: 'minimal' | 'normal' | 'verbose';
  humorStyle: 'playful' | 'sarcastic' | 'witty' | 'dry';
  notificationsEnabled: boolean;
  voiceEnabled: boolean;
  ambientListening: boolean;
}

export interface Message {
  id: string;
  conversationId: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  timestamp: string;
  metadata?: MessageMetadata;
  attachments?: Attachment[];
  toolCalls?: ToolCall[];
  isStreaming?: boolean;
  isError?: boolean;
  isTyping?: boolean;
}

export interface MessageMetadata {
  model?: string;
  provider?: string;
  tokens?: {
    prompt: number;
    completion: number;
    total: number;
  };
  executionTime?: number;
  confidence?: number;
  temperature?: number;
  topP?: number;
  maxTokens?: number;
}

export interface Conversation {
  id: string;
  title: string;
  userId: string;
  messages: Message[];
  createdAt: string;
  updatedAt: string;
  isArchived?: boolean;
  isPinned?: boolean;
  tags?: string[];
  summary?: string;
  messageCount: number;
  totalTokens?: number;
}

export interface Attachment {
  id: string;
  name: string;
  type: 'image' | 'document' | 'audio' | 'video' | 'code' | 'other';
  url: string;
  size: number;
  mimeType: string;
  uploadedAt: string;
  metadata?: AttachmentMetadata;
}

export interface AttachmentMetadata {
  width?: number;
  height?: number;
  duration?: number;
  language?: string;
  extractedText?: string;
  analysis?: {
    description?: string;
    objects?: string[];
    text?: string;
    sentiment?: 'positive' | 'negative' | 'neutral';
  };
}

export interface ToolCall {
  id: string;
  name: string;
  description?: string;
  parameters: Record<string, any>;
  result?: any;
  status: 'pending' | 'running' | 'completed' | 'failed';
  error?: string;
  executionTime?: number;
  timestamp: string;
}

export interface Tool {
  id: string;
  name: string;
  description: string;
  category: ToolCategory;
  parameters: ToolParameter[];
  isEnabled: boolean;
  icon?: string;
  examples?: ToolExample[];
}

export type ToolCategory = 
  | 'search' 
  | 'analysis' 
  | 'generation' 
  | 'conversion' 
  | 'communication' 
  | 'productivity' 
  | 'development' 
  | 'multimedia'
  | 'workflow'
  | 'integration';

export interface ToolParameter {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'array' | 'object' | 'file';
  description: string;
  required: boolean;
  default?: any;
  enum?: string[];
  format?: string;
}

export interface ToolExample {
  title: string;
  description: string;
  parameters: Record<string, any>;
  expectedResult?: string;
}

export interface Model {
  id: string;
  name: string;
  provider: 'openai' | 'anthropic' | 'huggingface' | 'local' | 'other';
  type: 'text' | 'vision' | 'audio' | 'multimodal';
  capabilities: ModelCapability[];
  maxTokens: number;
  costPer1kTokens?: {
    input: number;
    output: number;
  };
  isEnabled: boolean;
  description?: string;
  contextWindow: number;
  trainingData?: string;
}

export type ModelCapability = 
  | 'chat' 
  | 'completion' 
  | 'embedding' 
  | 'classification' 
  | 'image_analysis' 
  | 'image_generation' 
  | 'audio_transcription' 
  | 'audio_generation' 
  | 'code_generation' 
  | 'function_calling'
  | 'search'
  | 'reasoning';

export interface APIKey {
  id: string;
  name: string;
  provider: string;
  key: string; // encrypted
  isActive: boolean;
  lastUsed?: string;
  usageCount: number;
  rateLimit?: {
    requestsPerMinute: number;
    tokensPerMinute: number;
  };
  expiresAt?: string;
  createdAt: string;
}

export interface Workflow {
  id: string;
  name: string;
  description: string;
  userId: string;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  status: 'draft' | 'active' | 'paused' | 'completed' | 'failed';
  isTemplate?: boolean;
  tags?: string[];
  createdAt: string;
  updatedAt: string;
  lastExecuted?: string;
  executionCount: number;
}

export interface WorkflowNode {
  id: string;
  type: 'trigger' | 'action' | 'condition' | 'loop' | 'merge' | 'split';
  label: string;
  position: { x: number; y: number };
  data: Record<string, any>;
  config?: WorkflowNodeConfig;
}

export interface WorkflowEdge {
  id: string;
  source: string;
  target: string;
  type?: 'default' | 'conditional' | 'loop';
  condition?: string;
  label?: string;
}

export interface WorkflowNodeConfig {
  tool?: string;
  model?: string;
  prompt?: string;
  parameters?: Record<string, any>;
  timeout?: number;
  retries?: number;
  onError?: 'stop' | 'continue' | 'retry';
}

export interface KnowledgeBase {
  id: string;
  name: string;
  description: string;
  userId: string;
  documents: Document[];
  totalSize: number;
  documentCount: number;
  isPublic: boolean;
  tags?: string[];
  createdAt: string;
  updatedAt: string;
  lastIndexed?: string;
}

export interface Document {
  id: string;
  knowledgeBaseId: string;
  title: string;
  content: string;
  type: 'text' | 'pdf' | 'markdown' | 'html' | 'code' | 'other';
  url?: string;
  size: number;
  chunks: DocumentChunk[];
  metadata?: DocumentMetadata;
  uploadedAt: string;
  lastProcessed?: string;
}

export interface DocumentChunk {
  id: string;
  documentId: string;
  content: string;
  embedding?: number[];
  index: number;
  tokens: number;
  metadata?: Record<string, any>;
}

export interface DocumentMetadata {
  author?: string;
  language?: string;
  keywords?: string[];
  summary?: string;
  extractedEntities?: string[];
  pageCount?: number;
  wordCount?: number;
}

export interface SearchResult {
  id: string;
  title: string;
  content: string;
  relevance: number;
  source: string;
  url?: string;
  snippet: string;
  metadata?: Record<string, any>;
  timestamp?: string;
}

export interface Analytics {
  conversations: {
    total: number;
    thisWeek: number;
    thisMonth: number;
    averageLength: number;
  };
  messages: {
    total: number;
    thisWeek: number;
    thisMonth: number;
    averagePerConversation: number;
  };
  tokens: {
    total: number;
    thisWeek: number;
    thisMonth: number;
    cost: number;
  };
  models: {
    mostUsed: string;
    usage: Record<string, number>;
  };
  tools: {
    mostUsed: string;
    usage: Record<string, number>;
  };
  performance: {
    averageResponseTime: number;
    successRate: number;
    errorRate: number;
  };
}

export interface Toast {
  id: string;
  title?: string;
  description?: string;
  type: 'success' | 'error' | 'warning' | 'info';
  duration?: number;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export interface AppState {
  user: User | null;
  conversations: Conversation[];
  currentConversation: Conversation | null;
  isLoading: boolean;
  error: string | null;
  theme: 'light' | 'dark' | 'system';
  sidebarOpen: boolean;
  settingsOpen: boolean;
  models: Model[];
  tools: Tool[];
  knowledgeBases: KnowledgeBase[];
  analytics: Analytics | null;
  toasts: Toast[];
}

// API Response types
export interface APIResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  timestamp: string;
}

export interface PaginatedResponse<T = any> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  hasNext: boolean;
  hasPrev: boolean;
}

// Authentication types
export interface LoginRequest {
  email: string;
  password: string;
  rememberMe?: boolean;
}

export interface RegisterRequest {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
}

export interface AuthResponse {
  user: User;
  token: string;
  refreshToken: string;
  expiresAt: string;
}

// WebSocket types
export interface WebSocketMessage {
  type: 'message' | 'typing' | 'status' | 'error' | 'tool_call' | 'stream';
  conversationId?: string;
  messageId?: string;
  data: any;
  timestamp: string;
}

export interface StreamingMessage {
  delta: string;
  isComplete: boolean;
  messageId: string;
  conversationId: string;
}

// Error types
export interface AppError {
  code: string;
  message: string;
  details?: Record<string, any>;
  timestamp: string;
  stack?: string;
}

// Event types
export type AppEvent = 
  | { type: 'USER_LOGIN'; payload: User }
  | { type: 'USER_LOGOUT' }
  | { type: 'CONVERSATION_CREATE'; payload: Conversation }
  | { type: 'CONVERSATION_UPDATE'; payload: Conversation }
  | { type: 'CONVERSATION_DELETE'; payload: string }
  | { type: 'MESSAGE_CREATE'; payload: Message }
  | { type: 'MESSAGE_UPDATE'; payload: Message }
  | { type: 'MESSAGE_DELETE'; payload: string }
  | { type: 'TOOL_CALL'; payload: ToolCall }
  | { type: 'ERROR'; payload: AppError }
  | { type: 'TOAST_ADD'; payload: Toast }
  | { type: 'TOAST_REMOVE'; payload: string };
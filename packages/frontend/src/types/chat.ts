export interface ChatComponentProps {
  token: string;
}

export interface Message {
  id: number;
  speaker: "user" | "cartrita";
  text: string;
  created_at: string;
  model?: string;
  tools_used?: string[];
  response_time_ms?: number;
  intent_analysis?: {
    primary_intent: string;
    primary_confidence: number;
    prompt_complexity: number;
  };
  performance_score?: number;
  request_id?: string;
}

export interface ConnectionStats {
  connected: boolean;
  reconnectAttempts: number;
  latency: number;
  lastPing: Date | null;
}

export interface ChatStats {
  totalMessages: number;
  userMessages: number;
  cartritaMessages: number;
  conversationStarted: Date | null;
  averageResponseTime: number;
  toolsUsed: number;
  totalPerformanceScore: number;
}

export interface AgentMetrics {
  requests_processed: number;
  successful_responses: number;
  failed_responses: number;
  tools_used_total: number;
  average_response_time: number;
  user_interactions: number;
  personality_adaptations: number;
  streaming_sessions: number;
  cache_hits: number;
  cache_misses: number;
  intent_accuracy: number;
  tool_selection_accuracy: number;
  uptime: number;
}

export interface AgentHealth {
  healthy: boolean;
  issues: string[];
  uptime: number;
  success_rate: string;
  cache_hit_rate: string;
}

export interface ChatState {
  messages: Message[];
  isLoading: boolean;
  isConnected: boolean;
  chatStats: ChatStats;
}

export type ChatAction =
  | { type: "ADD_MESSAGE"; payload: Message }
  | { type: "SET_MESSAGES"; payload: Message[] }
  | { type: "CLEAR_MESSAGES" }
  | { type: "SET_LOADING"; payload: boolean }
  | { type: "SET_CONNECTED"; payload: boolean };

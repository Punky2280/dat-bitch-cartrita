// chatStore.ts - Comprehensive chat state management with all features
import { create } from 'zustand';
import { devtools, subscribeWithSelector } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import { persist } from 'zustand/middleware';
import { v4 as uuidv4 } from 'uuid';

export interface Message {
  id: string;
  parent_id?: string;
  role: 'user' | 'assistant' | 'system' | 'tool' | 'error' | 'notice';
  content: string;
  timestamp: number;
  state: 'pending' | 'streaming' | 'complete' | 'error' | 'moderated';
  
  // Advanced features
  pinned: boolean;
  branch_anchor: boolean;
  branch_id?: string;
  citations?: Citation[];
  attachments?: Attachment[];
  tool_invocations?: ToolInvocation[];
  regeneration_id?: string;
  editable?: boolean;
  
  // Metadata
  model_used?: string;
  tokens?: { input: number; output: number };
  latency_ms?: number;
  cost_estimate?: number;
  confidence_score?: number;
  
  // Content variants
  content_variants?: { id: string; content: string; selected: boolean }[];
  
  // Moderation
  moderation_flags?: string[];
  moderation_score?: number;
  override_requested?: boolean;
  
  // Analytics
  view_count?: number;
  copy_count?: number;
  reaction?: 'positive' | 'negative' | 'flag';
  
  // Formatting
  collapsed?: boolean;
  outline?: { title: string; level: number; anchor: string }[];
}

export interface Citation {
  id: string;
  text: string;
  source: string;
  url?: string;
  relevance_score: number;
  document_id?: string;
  page_number?: number;
}

export interface Attachment {
  id: string;
  name: string;
  type: 'image' | 'pdf' | 'text' | 'code' | 'audio' | 'other';
  size: number;
  url: string;
  status: 'uploading' | 'ready' | 'error';
  progress?: number;
  preview?: string;
  ocr_text?: string;
  analysis?: any;
}

export interface ToolInvocation {
  id: string;
  tool_name: string;
  status: 'idle' | 'running' | 'success' | 'error';
  input: any;
  output?: any;
  error?: string;
  execution_time_ms?: number;
  logs?: string[];
  collapsed: boolean;
}

export interface ConversationBranch {
  id: string;
  name: string;
  parent_message_id: string;
  created_at: number;
  message_count: number;
  active: boolean;
}

export interface StreamingState {
  active: boolean;
  message_id: string;
  chunks: string[];
  current_chunk: string;
  total_tokens: number;
  start_time: number;
  last_chunk_time: number;
}

interface ChatState {
  // Core data
  messages: Message[];
  current_conversation_id: string | null;
  streaming: StreamingState | null;
  
  // Branching
  branches: ConversationBranch[];
  current_branch_id: string | null;
  
  // UI state
  selected_messages: string[];
  editing_message_id: string | null;
  comparing_variants: boolean;
  diff_view_active: boolean;
  
  // Input state
  draft_message: string;
  draft_saved_at: number;
  input_disabled: boolean;
  input_error: string | null;
  
  // Display preferences
  compact_mode: boolean;
  show_timestamps: boolean;
  show_token_counts: boolean;
  show_model_labels: boolean;
  
  // Search & filtering
  search_query: string;
  search_results: string[];
  filter_pinned_only: boolean;
  
  // Performance
  virtualization_enabled: boolean;
  message_cache: Map<string, Message>;
}

interface ChatActions {
  // Message management
  addMessage: (message: Omit<Message, 'id' | 'timestamp'>) => string;
  updateMessage: (id: string, updates: Partial<Message>) => void;
  deleteMessage: (id: string) => void;
  clearMessages: () => void;
  
  // Streaming
  startStreaming: (message_id: string) => void;
  addStreamingChunk: (chunk: string) => void;
  completeStreaming: () => void;
  stopStreaming: () => void;
  
  // Editing & regeneration
  startEditingMessage: (id: string) => void;
  saveEditedMessage: (id: string, content: string) => void;
  cancelEditingMessage: () => void;
  regenerateMessage: (id: string) => Promise<string>;
  addVariant: (message_id: string, variant: string) => void;
  selectVariant: (message_id: string, variant_id: string) => void;
  
  // Branching
  createBranch: (parent_message_id: string, name?: string) => string;
  switchBranch: (branch_id: string) => void;
  deleteBranch: (branch_id: string) => void;
  mergeBranch: (source_branch_id: string, target_branch_id: string) => void;
  
  // Pinning
  pinMessage: (id: string) => void;
  unpinMessage: (id: string) => void;
  getPinnedMessages: () => Message[];
  
  // Citations
  addCitation: (message_id: string, citation: Citation) => void;
  removeCitation: (message_id: string, citation_id: string) => void;
  
  // Tool invocations
  addToolInvocation: (message_id: string, tool: ToolInvocation) => void;
  updateToolInvocation: (message_id: string, tool_id: string, updates: Partial<ToolInvocation>) => void;
  
  // Selection & actions
  selectMessage: (id: string) => void;
  deselectMessage: (id: string) => void;
  selectAllMessages: () => void;
  deselectAllMessages: () => void;
  deleteSelectedMessages: () => void;
  
  // Display & preferences
  toggleCompactMode: () => void;
  toggleTimestamps: () => void;
  toggleTokenCounts: () => void;
  toggleModelLabels: () => void;
  
  // Content manipulation
  collapseMessage: (id: string) => void;
  expandMessage: (id: string) => void;
  summarizeMessage: (id: string) => Promise<void>;
  transformTone: (id: string, tone: 'formal' | 'casual' | 'bullet_points') => Promise<void>;
  translateMessage: (id: string, target_language: string) => Promise<void>;
  
  // Search
  searchMessages: (query: string) => void;
  clearSearch: () => void;
  
  // Draft management
  saveDraft: (content: string) => void;
  clearDraft: () => void;
  
  // Input state
  setInputDisabled: (disabled: boolean) => void;
  setInputError: (error: string | null) => void;
  
  // Analytics actions
  incrementViewCount: (id: string) => void;
  incrementCopyCount: (id: string) => void;
  addReaction: (id: string, reaction: 'positive' | 'negative' | 'flag') => void;
  
  // Export
  exportConversation: (format: 'markdown' | 'pdf' | 'json') => Promise<string>;
  exportMessage: (id: string, format: 'markdown' | 'text') => string;
  
  // Moderation
  reportMessage: (id: string, reason: string) => Promise<void>;
  requestOverride: (id: string, justification: string) => Promise<void>;
}

type ChatStore = ChatState & ChatActions;

export const useChatStore = create<ChatStore>()(
  devtools(
    subscribeWithSelector(
      immer(
        persist(
          (set, get) => ({
            // Initial state
            messages: [],
            current_conversation_id: null,
            streaming: null,
            branches: [],
            current_branch_id: null,
            selected_messages: [],
            editing_message_id: null,
            comparing_variants: false,
            diff_view_active: false,
            draft_message: '',
            draft_saved_at: 0,
            input_disabled: false,
            input_error: null,
            compact_mode: false,
            show_timestamps: false,
            show_token_counts: false,
            show_model_labels: true,
            search_query: '',
            search_results: [],
            filter_pinned_only: false,
            virtualization_enabled: true,
            message_cache: new Map(),

            // Actions
            addMessage: (messageData) => {
              const id = uuidv4();
              const message: Message = {
                ...messageData,
                id,
                timestamp: Date.now(),
                pinned: false,
                branch_anchor: false,
                state: messageData.state || 'complete',
              };

              set((state) => {
                state.messages.push(message);
                state.message_cache.set(id, message);
              });

              return id;
            },

            updateMessage: (id, updates) => {
              set((state) => {
                const index = state.messages.findIndex(m => m.id === id);
                if (index !== -1) {
                  Object.assign(state.messages[index], updates);
                  state.message_cache.set(id, state.messages[index]);
                }
              });
            },

            deleteMessage: (id) => {
              set((state) => {
                state.messages = state.messages.filter(m => m.id !== id);
                state.message_cache.delete(id);
                state.selected_messages = state.selected_messages.filter(sid => sid !== id);
              });
            },

            clearMessages: () => {
              set((state) => {
                state.messages = [];
                state.message_cache.clear();
                state.selected_messages = [];
                state.editing_message_id = null;
              });
            },

            startStreaming: (message_id) => {
              set((state) => {
                state.streaming = {
                  active: true,
                  message_id,
                  chunks: [],
                  current_chunk: '',
                  total_tokens: 0,
                  start_time: Date.now(),
                  last_chunk_time: Date.now(),
                };
              });
            },

            addStreamingChunk: (chunk) => {
              set((state) => {
                if (state.streaming) {
                  state.streaming.chunks.push(chunk);
                  state.streaming.current_chunk = chunk;
                  state.streaming.total_tokens += chunk.split(' ').length;
                  state.streaming.last_chunk_time = Date.now();

                  // Update the streaming message content
                  const message = state.messages.find(m => m.id === state.streaming!.message_id);
                  if (message) {
                    message.content = state.streaming.chunks.join('');
                    message.state = 'streaming';
                  }
                }
              });
            },

            completeStreaming: () => {
              set((state) => {
                if (state.streaming) {
                  const message = state.messages.find(m => m.id === state.streaming!.message_id);
                  if (message) {
                    message.state = 'complete';
                    message.tokens = {
                      input: 0, // Will be updated from backend
                      output: state.streaming.total_tokens
                    };
                    message.latency_ms = Date.now() - state.streaming.start_time;
                  }
                  state.streaming = null;
                }
              });
            },

            stopStreaming: () => {
              set((state) => {
                if (state.streaming) {
                  const message = state.messages.find(m => m.id === state.streaming!.message_id);
                  if (message) {
                    message.state = 'complete';
                    message.content += ' [Stopped]';
                  }
                  state.streaming = null;
                }
              });
            },

            startEditingMessage: (id) => {
              set((state) => {
                state.editing_message_id = id;
              });
            },

            saveEditedMessage: (id, content) => {
              set((state) => {
                const message = state.messages.find(m => m.id === id);
                if (message) {
                  message.content = content;
                  message.editable = false;
                }
                state.editing_message_id = null;
              });
            },

            cancelEditingMessage: () => {
              set((state) => {
                state.editing_message_id = null;
              });
            },

            regenerateMessage: async (id) => {
              const state = get();
              const message = state.messages.find(m => m.id === id);
              if (!message) {
                return '';
              }

              // Create new variant
              const variant_id = uuidv4();
              const regeneration_id = uuidv4();
              
              set((draft) => {
                const msg = draft.messages.find(m => m.id === id);
                if (msg) {
                  if (!msg.content_variants) {
                    msg.content_variants = [
                      { id: 'original', content: msg.content, selected: false }
                    ];
                  }
                  msg.content_variants.push({
                    id: variant_id,
                    content: 'Regenerating...',
                    selected: true
                  });
                  msg.regeneration_id = regeneration_id;
                }
              });

              // TODO: Call API to regenerate
              // For now, simulate
              setTimeout(() => {
                set((draft) => {
                  const msg = draft.messages.find(m => m.id === id);
                  if (msg && msg.content_variants) {
                    const variant = msg.content_variants.find(v => v.id === variant_id);
                    if (variant) {
                      variant.content = 'This is a regenerated response with different content.';
                    }
                  }
                });
              }, 1000);

              return regeneration_id;
            },

            addVariant: (message_id, variant) => {
              set((state) => {
                const message = state.messages.find(m => m.id === message_id);
                if (message) {
                  if (!message.content_variants) {
                    message.content_variants = [];
                  }
                  message.content_variants.push({
                    id: uuidv4(),
                    content: variant,
                    selected: false
                  });
                }
              });
            },

            selectVariant: (message_id, variant_id) => {
              set((state) => {
                const message = state.messages.find(m => m.id === message_id);
                if (message && message.content_variants) {
                  message.content_variants.forEach(v => {
                    v.selected = v.id === variant_id;
                    if (v.selected) {
                      message.content = v.content;
                    }
                  });
                }
              });
            },

            createBranch: (parent_message_id, name) => {
              const branch_id = uuidv4();
              const branch: ConversationBranch = {
                id: branch_id,
                name: name || `Branch ${get().branches.length + 1}`,
                parent_message_id,
                created_at: Date.now(),
                message_count: 0,
                active: false,
              };

              set((state) => {
                state.branches.push(branch);
                const message = state.messages.find(m => m.id === parent_message_id);
                if (message) {
                  message.branch_anchor = true;
                  message.branch_id = branch_id;
                }
              });

              return branch_id;
            },

            switchBranch: (branch_id) => {
              set((state) => {
                state.branches.forEach(b => b.active = b.id === branch_id);
                state.current_branch_id = branch_id;
              });
            },

            deleteBranch: (branch_id) => {
              set((state) => {
                state.branches = state.branches.filter(b => b.id !== branch_id);
                if (state.current_branch_id === branch_id) {
                  state.current_branch_id = null;
                }
              });
            },

            mergeBranch: async (source_branch_id, target_branch_id) => {
              // TODO: Implement branch merging logic
            },

            pinMessage: (id) => {
              set((state) => {
                const message = state.messages.find(m => m.id === id);
                if (message) {
                  message.pinned = true;
                }
              });
            },

            unpinMessage: (id) => {
              set((state) => {
                const message = state.messages.find(m => m.id === id);
                if (message) {
                  message.pinned = false;
                }
              });
            },

            getPinnedMessages: () => {
              return get().messages.filter(m => m.pinned);
            },

            addCitation: (message_id, citation) => {
              set((state) => {
                const message = state.messages.find(m => m.id === message_id);
                if (message) {
                  if (!message.citations) {
                    message.citations = [];
                  }
                  message.citations.push(citation);
                }
              });
            },

            removeCitation: (message_id, citation_id) => {
              set((state) => {
                const message = state.messages.find(m => m.id === message_id);
                if (message && message.citations) {
                  message.citations = message.citations.filter(c => c.id !== citation_id);
                }
              });
            },

            addToolInvocation: (message_id, tool) => {
              set((state) => {
                const message = state.messages.find(m => m.id === message_id);
                if (message) {
                  if (!message.tool_invocations) {
                    message.tool_invocations = [];
                  }
                  message.tool_invocations.push(tool);
                }
              });
            },

            updateToolInvocation: (message_id, tool_id, updates) => {
              set((state) => {
                const message = state.messages.find(m => m.id === message_id);
                if (message && message.tool_invocations) {
                  const tool = message.tool_invocations.find(t => t.id === tool_id);
                  if (tool) {
                    Object.assign(tool, updates);
                  }
                }
              });
            },

            selectMessage: (id) => {
              set((state) => {
                if (!state.selected_messages.includes(id)) {
                  state.selected_messages.push(id);
                }
              });
            },

            deselectMessage: (id) => {
              set((state) => {
                state.selected_messages = state.selected_messages.filter(sid => sid !== id);
              });
            },

            selectAllMessages: () => {
              set((state) => {
                state.selected_messages = state.messages.map(m => m.id);
              });
            },

            deselectAllMessages: () => {
              set((state) => {
                state.selected_messages = [];
              });
            },

            deleteSelectedMessages: () => {
              const state = get();
              state.selected_messages.forEach(id => {
                state.deleteMessage(id);
              });
            },

            toggleCompactMode: () => {
              set((state) => {
                state.compact_mode = !state.compact_mode;
              });
            },

            toggleTimestamps: () => {
              set((state) => {
                state.show_timestamps = !state.show_timestamps;
              });
            },

            toggleTokenCounts: () => {
              set((state) => {
                state.show_token_counts = !state.show_token_counts;
              });
            },

            toggleModelLabels: () => {
              set((state) => {
                state.show_model_labels = !state.show_model_labels;
              });
            },

            collapseMessage: (id) => {
              set((state) => {
                const message = state.messages.find(m => m.id === id);
                if (message) {
                  message.collapsed = true;
                }
              });
            },

            expandMessage: (id) => {
              set((state) => {
                const message = state.messages.find(m => m.id === id);
                if (message) {
                  message.collapsed = false;
                }
              });
            },

            summarizeMessage: async (id) => {
              // TODO: Implement message summarization
            },

            transformTone: async (id, tone) => {
              // TODO: Implement tone transformation
            },

            translateMessage: async (id, target_language) => {
              // TODO: Implement translation
            },

            searchMessages: (query) => {
              set((state) => {
                state.search_query = query;
                if (query.trim()) {
                  state.search_results = state.messages
                    .filter(m => m.content.toLowerCase().includes(query.toLowerCase()))
                    .map(m => m.id);
                } else {
                  state.search_results = [];
                }
              });
            },

            clearSearch: () => {
              set((state) => {
                state.search_query = '';
                state.search_results = [];
              });
            },

            saveDraft: (content) => {
              set((state) => {
                state.draft_message = content;
                state.draft_saved_at = Date.now();
              });
            },

            clearDraft: () => {
              set((state) => {
                state.draft_message = '';
                state.draft_saved_at = 0;
              });
            },

            setInputDisabled: (disabled) => {
              set((state) => {
                state.input_disabled = disabled;
              });
            },

            setInputError: (error) => {
              set((state) => {
                state.input_error = error;
              });
            },

            incrementViewCount: (id) => {
              set((state) => {
                const message = state.messages.find(m => m.id === id);
                if (message) {
                  message.view_count = (message.view_count || 0) + 1;
                }
              });
            },

            incrementCopyCount: (id) => {
              set((state) => {
                const message = state.messages.find(m => m.id === id);
                if (message) {
                  message.copy_count = (message.copy_count || 0) + 1;
                }
              });
            },

            addReaction: (id, reaction) => {
              set((state) => {
                const message = state.messages.find(m => m.id === id);
                if (message) {
                  message.reaction = reaction;
                }
              });
            },

            exportConversation: async (format) => {
              // TODO: Implement conversation export
              return '';
            },

            exportMessage: (id, format) => {
              const message = get().messages.find(m => m.id === id);
              if (!message) {
                return '';
              }

              if (format === 'markdown') {
                return `## ${message.role}\n\n${message.content}`;
              }
              return message.content;
            },

            reportMessage: async (id, reason) => {
              // TODO: Implement message reporting
            },

            requestOverride: async (id, justification) => {
              // TODO: Implement override request
            },
          }),
          {
            name: 'chat-store',
            partialize: (state) => ({
              messages: state.messages,
              branches: state.branches,
              compact_mode: state.compact_mode,
              show_timestamps: state.show_timestamps,
              show_token_counts: state.show_token_counts,
              show_model_labels: state.show_model_labels,
            }),
          }
        )
      )
    ),
    { name: 'ChatStore' }
  )
);
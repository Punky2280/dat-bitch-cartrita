// chatStore.ts - Comprehensive chat state management with all features
import { create } from 'zustand';
import { devtools, subscribeWithSelector } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import { persist } from 'zustand/middleware';
import { v4 as uuidv4 } from 'uuid';
import { apiClient } from '../lib/api';

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

export interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  created_at: string;
  updated_at: string;
  archived: boolean;
  starred: boolean;
  pinned: boolean;
  deleted: boolean;
  model?: string;
  metadata?: Record<string, any>;
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
  message_cache: Record<string, Message>; // Changed from Map to object
}

interface ChatActions {
  // Conversation management
  conversations: Conversation[];
  createConversation: (title?: string) => Promise<Conversation>;
  deleteConversation: (id: string) => Promise<void>;
  archiveConversation: (id: string) => Promise<void>;
  duplicateConversation: (id: string) => Promise<Conversation>;
  shareConversation: (id: string) => Promise<void>;
  updateConversationTitle: (id: string, title: string) => Promise<void>;
  toggleStar: (id: string) => Promise<void>;
  togglePin: (id: string) => Promise<void>;
  exportConversation: (id: string, format?: string) => Promise<void>;
  
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
            conversations: [],
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
            message_cache: {}, // Changed from Map to object

            // Actions
            // Conversation management
            createConversation: async (title = 'New Conversation') => {
              const newConversation: Conversation = {
                id: uuidv4(),
                title,
                messages: [],
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
                archived: false,
                starred: false,
                pinned: false,
                deleted: false
              };

              set((state) => {
                state.conversations.push(newConversation);
                state.current_conversation_id = newConversation.id;
              });

              return newConversation;
            },

            deleteConversation: async (id: string) => {
              set((state) => {
                const index = state.conversations.findIndex(c => c.id === id);
                if (index !== -1) {
                  state.conversations[index].deleted = true;
                }
                if (state.current_conversation_id === id) {
                  state.current_conversation_id = null;
                }
              });
            },

            archiveConversation: async (id: string) => {
              set((state) => {
                const conversation = state.conversations.find(c => c.id === id);
                if (conversation) {
                  conversation.archived = !conversation.archived;
                  conversation.updated_at = new Date().toISOString();
                }
              });
            },

            duplicateConversation: async (id: string) => {
              const original = get().conversations.find(c => c.id === id);
              if (!original) throw new Error('Conversation not found');

              const duplicate: Conversation = {
                ...original,
                id: uuidv4(),
                title: `${original.title} (Copy)`,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
                messages: original.messages.map(msg => ({
                  ...msg,
                  id: uuidv4()
                }))
              };

              set((state) => {
                state.conversations.push(duplicate);
              });

              return duplicate;
            },

            shareConversation: async (id: string) => {
              // Implementation for sharing - could export or generate share link
              console.log('Sharing conversation:', id);
            },

            updateConversationTitle: async (id: string, title: string) => {
              set((state) => {
                const conversation = state.conversations.find(c => c.id === id);
                if (conversation) {
                  conversation.title = title;
                  conversation.updated_at = new Date().toISOString();
                }
              });
            },

            toggleStar: async (id: string) => {
              set((state) => {
                const conversation = state.conversations.find(c => c.id === id);
                if (conversation) {
                  conversation.starred = !conversation.starred;
                  conversation.updated_at = new Date().toISOString();
                }
              });
            },

            togglePin: async (id: string) => {
              set((state) => {
                const conversation = state.conversations.find(c => c.id === id);
                if (conversation) {
                  conversation.pinned = !conversation.pinned;
                  conversation.updated_at = new Date().toISOString();
                }
              });
            },

            exportConversation: async (id: string, format = 'json') => {
              const conversation = get().conversations.find(c => c.id === id);
              if (!conversation) throw new Error('Conversation not found');
              
              // Implementation for exporting conversation
              console.log('Exporting conversation:', id, 'as', format);
            },

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
                state.message_cache[id] = message;
              });

              return id;
            },

            updateMessage: (id, updates) => {
              set((state) => {
                const index = state.messages.findIndex(m => m.id === id);
                if (index !== -1) {
                  Object.assign(state.messages[index], updates);
                  state.message_cache[id] = state.messages[index];
                }
              });
            },

            deleteMessage: (id) => {
              set((state) => {
                state.messages = state.messages.filter(m => m.id !== id);
                delete state.message_cache[id];
                state.selected_messages = state.selected_messages.filter(sid => sid !== id);
              });
            },

            clearMessages: () => {
              set((state) => {
                state.messages = [];
                state.message_cache = {};
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
                  msg.state = 'streaming';
                }
              });

              try {
                // Find the conversation context to regenerate the response
                const messageIndex = state.messages.findIndex(m => m.id === id);
                const contextMessages = state.messages.slice(0, messageIndex);
                const lastUserMessage = contextMessages.reverse().find(m => m.role === 'user');
                
                if (lastUserMessage && state.current_conversation_id) {
                  // Send regeneration request to backend
                  const response = await apiClient.sendChatMessage(lastUserMessage.content, {
                    session_id: state.current_conversation_id,
                    agent_id: 'supervisor'
                  });
                  
                  set((draft) => {
                    const msg = draft.messages.find(m => m.id === id);
                    if (msg && msg.content_variants) {
                      const variant = msg.content_variants.find(v => v.id === variant_id);
                      if (variant) {
                        variant.content = response.content;
                        msg.content = response.content;
                        msg.state = 'complete';
                        msg.model_used = response.model;
                      }
                    }
                  });
                }
              } catch (error) {
                console.error('Failed to regenerate message:', error);
                set((draft) => {
                  const msg = draft.messages.find(m => m.id === id);
                  if (msg && msg.content_variants) {
                    const variant = msg.content_variants.find(v => v.id === variant_id);
                    if (variant) {
                      variant.content = 'Failed to regenerate response. Please try again.';
                      msg.state = 'error';
                    }
                  }
                });
              }

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
              const state = get();
              const sourceBranch = state.branches.find(b => b.id === source_branch_id);
              const targetBranch = state.branches.find(b => b.id === target_branch_id);
              
              if (!sourceBranch || !targetBranch) {
                throw new Error('Invalid branch IDs for merge operation');
              }

              try {
                // Find messages belonging to source branch
                const sourceMessages = state.messages.filter(m => m.branch_id === source_branch_id);
                const targetAnchorMessage = state.messages.find(m => m.id === targetBranch.parent_message_id);
                
                if (!targetAnchorMessage) {
                  throw new Error('Target branch anchor message not found');
                }

                // Merge strategy: append source branch messages after target anchor
                const targetIndex = state.messages.findIndex(m => m.id === targetBranch.parent_message_id);
                
                set((draft) => {
                  // Update source messages to belong to target branch
                  sourceMessages.forEach(msg => {
                    const existingMsg = draft.messages.find(m => m.id === msg.id);
                    if (existingMsg) {
                      existingMsg.branch_id = target_branch_id;
                    }
                  });
                  
                  // Remove source branch
                  draft.branches = draft.branches.filter(b => b.id !== source_branch_id);
                  
                  // Update target branch message count
                  const targetBranchRef = draft.branches.find(b => b.id === target_branch_id);
                  if (targetBranchRef) {
                    targetBranchRef.message_count += sourceMessages.length;
                  }
                });

                console.log(`Successfully merged branch ${source_branch_id} into ${target_branch_id}`);
              } catch (error) {
                console.error('Failed to merge branches:', error);
                throw error;
              }
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
              const state = get();
              const message = state.messages.find(m => m.id === id);
              if (!message) {
                throw new Error('Message not found');
              }

              try {
                // Use the summarization capability through the chat API
                const response = await apiClient.sendChatMessage(
                  `Please provide a concise summary of the following text in 2-3 sentences: ${message.content}`,
                  {
                    session_id: state.current_conversation_id || 'summarization_session',
                    agent_id: 'supervisor'
                  }
                );

                set((draft) => {
                  const msg = draft.messages.find(m => m.id === id);
                  if (msg) {
                    if (!msg.content_variants) {
                      msg.content_variants = [
                        { id: 'original', content: msg.content, selected: true }
                      ];
                    }
                    msg.content_variants.push({
                      id: 'summary',
                      content: response.content,
                      selected: false
                    });
                  }
                });

                return response.content;
              } catch (error) {
                console.error('Failed to summarize message:', error);
                throw error;
              }
            },

            transformTone: async (id, tone) => {
              const state = get();
              const message = state.messages.find(m => m.id === id);
              if (!message) {
                throw new Error('Message not found');
              }

              try {
                let prompt = '';
                switch (tone) {
                  case 'formal':
                    prompt = `Please rewrite the following text in a formal, professional tone: ${message.content}`;
                    break;
                  case 'casual':
                    prompt = `Please rewrite the following text in a casual, conversational tone: ${message.content}`;
                    break;
                  case 'bullet_points':
                    prompt = `Please rewrite the following text as clear, concise bullet points: ${message.content}`;
                    break;
                  default:
                    throw new Error('Invalid tone transformation type');
                }

                const response = await apiClient.sendChatMessage(prompt, {
                  session_id: state.current_conversation_id || 'tone_transformation_session',
                  agent_id: 'supervisor'
                });

                set((draft) => {
                  const msg = draft.messages.find(m => m.id === id);
                  if (msg) {
                    if (!msg.content_variants) {
                      msg.content_variants = [
                        { id: 'original', content: msg.content, selected: true }
                      ];
                    }
                    msg.content_variants.push({
                      id: `tone_${tone}`,
                      content: response.content,
                      selected: false
                    });
                  }
                });

                return response.content;
              } catch (error) {
                console.error('Failed to transform tone:', error);
                throw error;
              }
            },

            translateMessage: async (id, target_language) => {
              const state = get();
              const message = state.messages.find(m => m.id === id);
              if (!message) {
                throw new Error('Message not found');
              }

              try {
                const response = await apiClient.sendChatMessage(
                  `Please translate the following text to ${target_language}. Maintain the original meaning and context: ${message.content}`,
                  {
                    session_id: state.current_conversation_id || 'translation_session',
                    agent_id: 'supervisor'
                  }
                );

                set((draft) => {
                  const msg = draft.messages.find(m => m.id === id);
                  if (msg) {
                    if (!msg.content_variants) {
                      msg.content_variants = [
                        { id: 'original', content: msg.content, selected: true }
                      ];
                    }
                    msg.content_variants.push({
                      id: `translation_${target_language.toLowerCase().replace(' ', '_')}`,
                      content: response.content,
                      selected: false
                    });
                  }
                });

                return response.content;
              } catch (error) {
                console.error('Failed to translate message:', error);
                throw error;
              }
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
              const { messages, current_conversation_id, branches } = get();
              
              if (messages.length === 0) {
                return '';
              }

              try {
                switch (format) {
                  case 'markdown': {
                    let markdown = `# Conversation Export\n\n`;
                    markdown += `**Date:** ${new Date().toLocaleDateString()}\n`;
                    markdown += `**Messages:** ${messages.length}\n\n`;
                    
                    messages.forEach((msg, index) => {
                      const role = msg.role.charAt(0).toUpperCase() + msg.role.slice(1);
                      markdown += `## ${role} ${index + 1}\n\n`;
                      markdown += `${msg.content}\n\n`;
                      
                      if (msg.attachments && msg.attachments.length > 0) {
                        markdown += `**Attachments:** ${msg.attachments.map(a => a.name).join(', ')}\n\n`;
                      }
                      
                      if (msg.citations && msg.citations.length > 0) {
                        markdown += `**References:**\n`;
                        msg.citations.forEach((citation, i) => {
                          markdown += `${i + 1}. [${citation.text}](${citation.url || citation.source})\n`;
                        });
                        markdown += `\n`;
                      }
                      
                      markdown += `---\n\n`;
                    });
                    
                    return markdown;
                  }
                  
                  case 'json': {
                    const exportData = {
                      conversation_id: current_conversation_id,
                      export_date: new Date().toISOString(),
                      message_count: messages.length,
                      branches,
                      messages: messages.map(msg => ({
                        id: msg.id,
                        role: msg.role,
                        content: msg.content,
                        timestamp: msg.timestamp,
                        model_used: msg.model_used,
                        attachments: msg.attachments,
                        citations: msg.citations,
                        tool_invocations: msg.tool_invocations,
                        tokens: msg.tokens,
                        metadata: {
                          pinned: msg.pinned,
                          view_count: msg.view_count,
                          copy_count: msg.copy_count,
                          reaction: msg.reaction
                        }
                      }))
                    };
                    return JSON.stringify(exportData, null, 2);
                  }
                  
                  case 'pdf': {
                    // For PDF export, we'll return HTML that can be converted to PDF
                    let html = `
                      <html>
                        <head>
                          <title>Conversation Export</title>
                          <style>
                            body { font-family: Arial, sans-serif; margin: 40px; }
                            .message { margin: 20px 0; padding: 15px; border-left: 3px solid #007acc; }
                            .user { background: #f0f8ff; border-left-color: #007acc; }
                            .assistant { background: #f8f8f8; border-left-color: #28a745; }
                            .timestamp { color: #666; font-size: 12px; margin-top: 10px; }
                            .attachments { margin-top: 10px; color: #555; }
                            .citations { margin-top: 10px; font-size: 14px; }
                          </style>
                        </head>
                        <body>
                          <h1>Conversation Export</h1>
                          <p><strong>Date:</strong> ${new Date().toLocaleDateString()}</p>
                          <p><strong>Messages:</strong> ${messages.length}</p>
                    `;
                    
                    messages.forEach((msg, index) => {
                      html += `
                        <div class="message ${msg.role}">
                          <h3>${msg.role.charAt(0).toUpperCase() + msg.role.slice(1)} ${index + 1}</h3>
                          <p>${msg.content.replace(/\n/g, '<br>')}</p>
                          ${msg.attachments && msg.attachments.length > 0 ? 
                            `<div class="attachments">📎 ${msg.attachments.map(a => a.name).join(', ')}</div>` : ''}
                          ${msg.citations && msg.citations.length > 0 ? 
                            `<div class="citations">📚 References: ${msg.citations.map(c => c.text).join(', ')}</div>` : ''}
                          <div class="timestamp">${new Date(msg.timestamp).toLocaleString()}</div>
                        </div>
                      `;
                    });
                    
                    html += `</body></html>`;
                    return html;
                  }
                  
                  default:
                    throw new Error(`Unsupported export format: ${format}`);
                }
              } catch (error) {
                console.error('Failed to export conversation:', error);
                throw error;
              }
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
              const { messages, current_conversation_id } = get();
              const message = messages.find(m => m.id === id);
              
              if (!message) {
                throw new Error('Message not found');
              }

              try {
                // Submit report through the backend (this would typically go to a moderation system)
                const response = await apiClient.sendChatMessage(
                  `SYSTEM: Report message for moderation. Reason: ${reason}. Message ID: ${id}. Content preview: "${message.content.substring(0, 100)}..."`,
                  {
                    session_id: current_conversation_id || 'moderation_session',
                    agent_id: 'moderation_agent_v2'
                  }
                );

                // Update message to indicate it's been reported
                set((draft) => {
                  const msg = draft.messages.find(m => m.id === id);
                  if (msg) {
                    if (!msg.moderation_flags) {
                      msg.moderation_flags = [];
                    }
                    msg.moderation_flags.push(`reported:${reason}`);
                  }
                });

                console.log('Message reported successfully:', response);
                return response;
              } catch (error) {
                console.error('Failed to report message:', error);
                throw error;
              }
            },

            requestOverride: async (id, justification) => {
              const { messages, current_conversation_id } = get();
              const message = messages.find(m => m.id === id);
              
              if (!message) {
                throw new Error('Message not found');
              }

              try {
                // Submit override request through the backend
                const response = await apiClient.sendChatMessage(
                  `SYSTEM: Override request for moderated content. Message ID: ${id}. Justification: ${justification}. Original content: "${message.content.substring(0, 200)}..."`,
                  {
                    session_id: current_conversation_id || 'override_request_session',
                    agent_id: 'moderation_agent_v2'
                  }
                );

                // Update message to indicate override has been requested
                set((draft) => {
                  const msg = draft.messages.find(m => m.id === id);
                  if (msg) {
                    msg.override_requested = true;
                  }
                });

                console.log('Override request submitted successfully:', response);
                return response;
              } catch (error) {
                console.error('Failed to request override:', error);
                throw error;
              }
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
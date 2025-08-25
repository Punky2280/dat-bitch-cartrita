import { useState, useEffect, useCallback, useRef } from 'react';
import { apiClient } from '@/lib/api';
import { useWebSocket } from './useWebSocket';

interface Message {
  id: string;
  text: string;
  sender: 'user' | 'bot';
  timestamp: Date;
  conversationId?: string;
}

interface Conversation {
  id: string;
  title: string;
  messages: Message[];
}

interface UseChatOptions {
  conversationId?: string;
  enableRealtime?: boolean;
}

export const useChat = (options: UseChatOptions = {}) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(options.conversationId || null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messageIdCounter = useRef(0);

  // WebSocket connection for real-time features
  const { socket, isConnected } = useWebSocket({
    enabled: options.enableRealtime,
    namespace: '/realtime'
  });

  // Generate unique message ID
  const generateMessageId = useCallback(() => {
    return `msg_${Date.now()}_${++messageIdCounter.current}`;
  }, []);

  // Load conversation history
  const loadConversation = useCallback(async (conversationId: string) => {
    try {
      setIsLoading(true);
      const conversation = await apiClient.getConversation(conversationId);
      const messages = await apiClient.getMessages(conversationId);
      
      const formattedMessages: Message[] = messages.data.map((msg: any) => ({
        id: msg.id,
        text: msg.content,
        sender: msg.role === 'user' ? 'user' : 'bot',
        timestamp: new Date(msg.created_at),
        conversationId: conversationId
      }));

      setMessages(formattedMessages);
      setCurrentConversationId(conversationId);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to load conversation');
      console.error('Error loading conversation:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Create new conversation
  const createConversation = useCallback(async (title?: string) => {
    try {
      const conversation = await apiClient.createConversation(title);
      setCurrentConversationId(conversation.id);
      setMessages([]);
      setError(null);
      return conversation;
    } catch (err: any) {
      setError(err.message || 'Failed to create conversation');
      console.error('Error creating conversation:', err);
      return null;
    }
  }, []);

  // Send message with AI response
  const sendMessage = useCallback(async (text: string, attachments?: File[]) => {
    if (!text.trim()) return;

    // Create user message
    const userMessage: Message = {
      id: generateMessageId(),
      text: text.trim(),
      sender: 'user',
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);
    setError(null);

    try {
      // If no conversation exists, create one
      let conversationId = currentConversationId;
      if (!conversationId) {
        const newConversation = await createConversation();
        conversationId = newConversation?.id || null;
        if (!conversationId) {
          throw new Error('Failed to create conversation');
        }
      }

      // Send message to backend and get AI response
      const response = await apiClient.chatCompletion(text, {
        conversationId,
        model: 'gpt-4o',
        temperature: 0.7,
        maxTokens: 1000
      });

      // Add AI response
      const botMessage: Message = {
        id: response.id || generateMessageId(),
        text: response.content || response.text || 'I apologize, but I could not generate a response.',
        sender: 'bot',
        timestamp: new Date(response.created_at || Date.now()),
        conversationId: conversationId
      };

      setMessages(prev => [...prev, botMessage]);

      // Also save to backend for persistence
      if (conversationId) {
        try {
          await apiClient.sendMessage(conversationId, text, attachments);
        } catch (saveErr) {
          console.warn('Warning: Failed to save message to backend:', saveErr);
        }
      }

    } catch (err: any) {
      setError(err.message || 'Failed to send message');
      console.error('Error sending message:', err);
      
      // Add error message
      const errorMessage: Message = {
        id: generateMessageId(),
        text: 'Sorry, I encountered an error processing your message. Please try again.',
        sender: 'bot',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  }, [currentConversationId, generateMessageId, createConversation]);

  // Load conversations list
  const loadConversations = useCallback(async () => {
    try {
      const response = await apiClient.getConversations();
      setConversations(response.data || []);
    } catch (err: any) {
      console.error('Error loading conversations:', err);
    }
  }, []);

  // Clear current conversation
  const clearConversation = useCallback(() => {
    setMessages([]);
    setCurrentConversationId(null);
    setError(null);
  }, []);

  // Delete conversation
  const deleteConversation = useCallback(async (conversationId: string) => {
    try {
      await apiClient.deleteConversation(conversationId);
      if (currentConversationId === conversationId) {
        clearConversation();
      }
      await loadConversations();
    } catch (err: any) {
      setError(err.message || 'Failed to delete conversation');
      console.error('Error deleting conversation:', err);
    }
  }, [currentConversationId, clearConversation, loadConversations]);

  // WebSocket message handling
  useEffect(() => {
    if (socket && isConnected) {
      const handleNewMessage = (data: any) => {
        if (data.conversationId === currentConversationId) {
          const newMessage: Message = {
            id: data.id,
            text: data.content,
            sender: data.role === 'user' ? 'user' : 'bot',
            timestamp: new Date(data.timestamp),
            conversationId: data.conversationId
          };
          setMessages(prev => [...prev, newMessage]);
        }
      };

      socket.on('message:new', handleNewMessage);
      socket.on('conversation:updated', () => {
        loadConversations();
      });

      return () => {
        socket.off('message:new', handleNewMessage);
        socket.off('conversation:updated');
      };
    }
  }, [socket, isConnected, currentConversationId, loadConversations]);

  // Load initial data
  useEffect(() => {
    loadConversations();
    if (options.conversationId) {
      loadConversation(options.conversationId);
    }
  }, [options.conversationId, loadConversations, loadConversation]);

  return {
    // State
    messages,
    conversations,
    currentConversationId,
    isLoading,
    error,
    isConnected,

    // Actions
    sendMessage,
    loadConversation,
    createConversation,
    loadConversations,
    clearConversation,
    deleteConversation,

    // Utils
    setError
  };
};

export default useChat;
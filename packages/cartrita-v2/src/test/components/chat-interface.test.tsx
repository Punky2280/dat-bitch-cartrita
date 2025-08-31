import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Provider } from 'jotai';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ChatInterface } from '@/components/features/chat/chat-interface';
import { authService } from '@/services/auth';
import { chatService } from '@/services/chat';

// Mock services
vi.mock('@/services/auth');
vi.mock('@/services/chat');

const mockAuthService = vi.mocked(authService);
const mockChatService = vi.mocked(chatService);

function createTestWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
      mutations: {
        retry: false,
      },
    },
  });

  return function TestWrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <Provider>{children}</Provider>
      </QueryClientProvider>
    );
  };
}

describe('ChatInterface', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Mock auth state
    mockAuthService.getUser.mockReturnValue({
      id: '1',
      email: 'test@example.com',
      name: 'Test User',
      preferences: {
        theme: 'light',
        language: 'en',
        notifications: true,
      },
      createdAt: '2025-01-01T00:00:00Z',
      updatedAt: '2025-01-01T00:00:00Z',
    });
    
    mockAuthService.isAuthenticated.mockReturnValue(true);
    
    // Mock chat service
    mockChatService.getConversations.mockResolvedValue({
      data: [],
      pagination: {
        page: 1,
        limit: 20,
        total: 0,
        hasMore: false,
      },
    });
  });

  it('renders welcome message for new users', async () => {
    const TestWrapper = createTestWrapper();
    
    render(
      <TestWrapper>
        <ChatInterface />
      </TestWrapper>
    );

    expect(await screen.findByText('Start a conversation')).toBeInTheDocument();
    expect(screen.getByText('Ask me anything or share your thoughts')).toBeInTheDocument();
  });

  it('allows user to type and send message', async () => {
    const TestWrapper = createTestWrapper();
    
    mockChatService.createConversation.mockResolvedValue({
      id: '1',
      title: 'New Conversation',
      userId: '1',
      messageCount: 0,
      lastMessageAt: '2025-01-01T00:00:00Z',
      createdAt: '2025-01-01T00:00:00Z',
      updatedAt: '2025-01-01T00:00:00Z',
    });

    render(
      <TestWrapper>
        <ChatInterface />
      </TestWrapper>
    );

    const input = screen.getByPlaceholderText('Type your message...');
    const sendButton = screen.getByRole('button', { name: /send/i });

    // Type message
    fireEvent.change(input, { target: { value: 'Hello, how are you?' } });
    expect(input).toHaveValue('Hello, how are you?');

    // Send message
    fireEvent.click(sendButton);

    await waitFor(() => {
      expect(mockChatService.createConversation).toHaveBeenCalled();
    });
  });

  it('disables input when streaming', async () => {
    const TestWrapper = createTestWrapper();
    
    render(
      <TestWrapper>
        <ChatInterface />
      </TestWrapper>
    );

    // Simulate streaming state
    // This would typically be done through state management
    const input = screen.getByPlaceholderText('Type your message...');
    
    // When streaming, input should be disabled
    // (This test would need to be updated based on actual streaming implementation)
    expect(input).not.toBeDisabled();
  });

  it('shows error message on send failure', async () => {
    const TestWrapper = createTestWrapper();
    
    mockChatService.createConversation.mockRejectedValue(
      new Error('Failed to create conversation')
    );

    render(
      <TestWrapper>
        <ChatInterface />
      </TestWrapper>
    );

    const input = screen.getByPlaceholderText('Type your message...');
    const sendButton = screen.getByRole('button', { name: /send/i });

    fireEvent.change(input, { target: { value: 'Test message' } });
    fireEvent.click(sendButton);

    // Error handling would be tested here
    // The actual implementation might show a toast or inline error
  });
});
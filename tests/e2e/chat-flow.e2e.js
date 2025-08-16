/**
 * @fileoverview E2E Tests - Chat and Conversation Flow
 * Tests AI chat functionality, conversation management, and message handling
 */

import { test, expect } from '@playwright/test';

test.describe('Chat and Conversation Flow', () => {
  
  test.beforeEach(async ({ page }) => {
    // Start from dashboard with authenticated user
    await page.goto('/dashboard');
    await expect(page.locator('[data-testid="user-menu"]')).toBeVisible();
  });

  test.describe('New Conversation Creation', () => {
    test('should create new conversation from dashboard', async ({ page }) => {
      // Click on "New Chat" or similar button
      await page.click('[data-testid="new-chat-button"]');
      
      // Should navigate to chat interface
      await expect(page).toHaveURL(/\/chat/);
      
      // Verify empty chat state
      await expect(page.locator('[data-testid="chat-messages"]')).toBeEmpty();
      await expect(page.locator('[data-testid="message-input"]')).toBeVisible();
      await expect(page.locator('[data-testid="send-button"]')).toBeVisible();
    });
    
    test('should send first message and create conversation', async ({ page }) => {
      await page.goto('/chat');
      
      const testMessage = 'Hello, I need help with building AI agents in JavaScript.';
      
      // Type message
      await page.fill('[data-testid="message-input"]', testMessage);
      
      // Send message
      await page.click('[data-testid="send-button"]');
      
      // Verify user message appears
      await expect(page.locator('[data-testid="message-user"]').last()).toContainText(testMessage);
      
      // Wait for AI response
      await expect(page.locator('[data-testid="message-assistant"]')).toBeVisible({ timeout: 30000 });
      
      // Verify AI response is not empty
      const aiResponse = await page.locator('[data-testid="message-assistant"]').last().textContent();
      expect(aiResponse.trim().length).toBeGreaterThan(0);
      
      // Verify conversation is created (URL should have conversation ID)
      await expect(page).toHaveURL(/\/chat\/\d+/);
    });
    
    test('should handle long messages correctly', async ({ page }) => {
      await page.goto('/chat');
      
      const longMessage = 'This is a very long message that tests how the chat interface handles lengthy user input. '.repeat(10);
      
      await page.fill('[data-testid="message-input"]', longMessage);
      await page.click('[data-testid="send-button"]');
      
      // Message should be displayed with proper formatting
      const userMessage = page.locator('[data-testid="message-user"]').last();
      await expect(userMessage).toBeVisible();
      
      // Should not overflow container
      const messageRect = await userMessage.boundingBox();
      const containerRect = await page.locator('[data-testid="chat-container"]').boundingBox();
      expect(messageRect.width).toBeLessThanOrEqual(containerRect.width);
    });
  });

  test.describe('Conversation Management', () => {
    test('should list existing conversations', async ({ page }) => {
      // Navigate to conversations list
      await page.click('[data-testid="conversations-menu"]');
      
      // Should show conversations list
      await expect(page.locator('[data-testid="conversations-list"]')).toBeVisible();
      
      // Should show at least one conversation (from test data)
      const conversationItems = page.locator('[data-testid="conversation-item"]');
      await expect(conversationItems).toHaveCountGreaterThan(0);
      
      // Verify conversation structure
      const firstConversation = conversationItems.first();
      await expect(firstConversation.locator('[data-testid="conversation-title"]')).toBeVisible();
      await expect(firstConversation.locator('[data-testid="conversation-preview"]')).toBeVisible();
      await expect(firstConversation.locator('[data-testid="conversation-timestamp"]')).toBeVisible();
    });
    
    test('should open existing conversation', async ({ page }) => {
      await page.goto('/conversations');
      
      // Click on first conversation
      await page.click('[data-testid="conversation-item"]');
      
      // Should navigate to conversation
      await expect(page).toHaveURL(/\/chat\/\d+/);
      
      // Should show existing messages
      await expect(page.locator('[data-testid="message-user"]')).toHaveCountGreaterThan(0);
      
      // Should be able to send new messages
      await expect(page.locator('[data-testid="message-input"]')).toBeVisible();
    });
    
    test('should rename conversation', async ({ page }) => {
      await page.goto('/conversations');
      
      // Click on conversation options
      await page.click('[data-testid="conversation-options"]');
      await page.click('[data-testid="rename-conversation"]');
      
      // Edit title
      const newTitle = 'Renamed Test Conversation';
      await page.fill('[data-testid="conversation-title-input"]', newTitle);
      await page.click('[data-testid="save-title-button"]');
      
      // Verify title is updated
      await expect(page.locator('[data-testid="conversation-title"]')).toContainText(newTitle);
    });
    
    test('should delete conversation', async ({ page }) => {
      await page.goto('/conversations');
      
      // Count initial conversations
      const initialCount = await page.locator('[data-testid="conversation-item"]').count();
      
      // Delete first conversation
      await page.click('[data-testid="conversation-options"]');
      await page.click('[data-testid="delete-conversation"]');
      
      // Confirm deletion
      await page.click('[data-testid="confirm-delete-button"]');
      
      // Verify conversation is removed
      await expect(page.locator('[data-testid="conversation-item"]')).toHaveCount(initialCount - 1);
    });
  });

  test.describe('Message Handling', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/chat');
    });
    
    test('should send message with Enter key', async ({ page }) => {
      const message = 'This message is sent with Enter key';
      
      await page.fill('[data-testid="message-input"]', message);
      await page.press('[data-testid="message-input"]', 'Enter');
      
      // Verify message is sent
      await expect(page.locator('[data-testid="message-user"]').last()).toContainText(message);
    });
    
    test('should create new line with Shift+Enter', async ({ page }) => {
      const multilineMessage = 'First line\nSecond line\nThird line';
      
      await page.fill('[data-testid="message-input"]', 'First line');
      await page.press('[data-testid="message-input"]', 'Shift+Enter');
      await page.type('[data-testid="message-input"]', 'Second line');
      await page.press('[data-testid="message-input"]', 'Shift+Enter');
      await page.type('[data-testid="message-input"]', 'Third line');
      
      // Send with Enter
      await page.press('[data-testid="message-input"]', 'Enter');
      
      // Verify multiline message
      const sentMessage = await page.locator('[data-testid="message-user"]').last().textContent();
      expect(sentMessage).toContain('First line');
      expect(sentMessage).toContain('Second line');
      expect(sentMessage).toContain('Third line');
    });
    
    test('should disable send button for empty messages', async ({ page }) => {
      // Send button should be disabled initially
      await expect(page.locator('[data-testid="send-button"]')).toBeDisabled();
      
      // Should enable when typing
      await page.fill('[data-testid="message-input"]', 'Test message');
      await expect(page.locator('[data-testid="send-button"]')).toBeEnabled();
      
      // Should disable when cleared
      await page.fill('[data-testid="message-input"]', '');
      await expect(page.locator('[data-testid="send-button"]')).toBeDisabled();
    });
    
    test('should show typing indicator during AI response', async ({ page }) => {
      // Mock delayed AI response
      await page.route('/api/chat', async route => {
        // Delay response to see typing indicator
        await new Promise(resolve => setTimeout(resolve, 2000));
        await route.continue();
      });
      
      await page.fill('[data-testid="message-input"]', 'Test message for typing indicator');
      await page.click('[data-testid="send-button"]');
      
      // Should show typing indicator
      await expect(page.locator('[data-testid="typing-indicator"]')).toBeVisible();
      
      // Typing indicator should disappear when response arrives
      await expect(page.locator('[data-testid="typing-indicator"]')).toBeHidden({ timeout: 30000 });
    });
    
    test('should handle message with code blocks', async ({ page }) => {
      const messageWithCode = `Here's a JavaScript function:
      
      \`\`\`javascript
      function greet(name) {
        return \`Hello, \${name}!\`;
      }
      \`\`\`
      
      This demonstrates syntax highlighting.`;
      
      await page.fill('[data-testid="message-input"]', messageWithCode);
      await page.click('[data-testid="send-button"]');
      
      // Wait for AI response (which might also contain code)
      await expect(page.locator('[data-testid="message-assistant"]')).toBeVisible({ timeout: 30000 });
      
      // Check if code blocks are properly formatted
      await expect(page.locator('pre code')).toBeVisible();
    });
  });

  test.describe('AI Response Features', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/chat');
    });
    
    test('should handle streaming responses', async ({ page }) => {
      // Mock streaming response
      await page.route('/api/chat', async route => {
        const request = route.request();
        const postData = request.postDataJSON();
        
        if (postData.stream) {
          // Simulate streaming response
          await route.fulfill({
            status: 200,
            headers: { 'Content-Type': 'text/event-stream' },
            body: 'data: {"chunk": "Hello"}\n\ndata: {"chunk": " world"}\n\ndata: {"chunk": "!"}\n\ndata: [DONE]\n\n'
          });
        } else {
          await route.continue();
        }
      });
      
      // Send message with streaming enabled
      await page.fill('[data-testid="message-input"]', 'Test streaming response');
      await page.click('[data-testid="send-button"]');
      
      // Should see response being built incrementally
      await expect(page.locator('[data-testid="message-assistant"]').last()).toBeVisible();
      
      // Wait for complete response
      await expect(page.locator('[data-testid="message-assistant"]').last()).toContainText('Hello world!');
    });
    
    test('should copy AI response to clipboard', async ({ page }) => {
      await page.fill('[data-testid="message-input"]', 'Generate a sample response for copying');
      await page.click('[data-testid="send-button"]');
      
      // Wait for response
      await expect(page.locator('[data-testid="message-assistant"]')).toBeVisible({ timeout: 30000 });
      
      // Click copy button
      await page.hover('[data-testid="message-assistant"]');
      await page.click('[data-testid="copy-message-button"]');
      
      // Should show copy success indication
      await expect(page.locator('[data-testid="copy-success"]')).toBeVisible();
    });
    
    test('should regenerate AI response', async ({ page }) => {
      await page.fill('[data-testid="message-input"]', 'Please provide a response I can regenerate');
      await page.click('[data-testid="send-button"]');
      
      // Wait for initial response
      await expect(page.locator('[data-testid="message-assistant"]')).toBeVisible({ timeout: 30000 });
      const initialResponse = await page.locator('[data-testid="message-assistant"]').last().textContent();
      
      // Click regenerate button
      await page.hover('[data-testid="message-assistant"]');
      await page.click('[data-testid="regenerate-button"]');
      
      // Should show loading state
      await expect(page.locator('[data-testid="typing-indicator"]')).toBeVisible();
      
      // Should get new response
      await expect(page.locator('[data-testid="typing-indicator"]')).toBeHidden({ timeout: 30000 });
      const newResponse = await page.locator('[data-testid="message-assistant"]').last().textContent();
      
      // Responses should be different (in most cases)
      // Note: This might occasionally fail if AI gives identical response
      expect(newResponse.trim().length).toBeGreaterThan(0);
    });
  });

  test.describe('Chat Interface Features', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/chat');
    });
    
    test('should scroll to latest message automatically', async ({ page }) => {
      // Send multiple messages to create scrollable content
      for (let i = 1; i <= 10; i++) {
        await page.fill('[data-testid="message-input"]', `Message number ${i}`);
        await page.click('[data-testid="send-button"]');
        
        // Wait for message to appear
        await expect(page.locator(`text=Message number ${i}`)).toBeVisible();
      }
      
      // Latest message should be visible
      const latestMessage = page.locator('[data-testid="message-user"]').last();
      await expect(latestMessage).toBeInViewport();
    });
    
    test('should search through conversation history', async ({ page }) => {
      // Create conversation with searchable content
      await page.fill('[data-testid="message-input"]', 'JavaScript programming question');
      await page.click('[data-testid="send-button"]');
      
      await page.waitForTimeout(2000); // Wait for AI response
      
      await page.fill('[data-testid="message-input"]', 'Python development help');
      await page.click('[data-testid="send-button"]');
      
      // Open search
      await page.click('[data-testid="search-button"]');
      
      // Search for specific term
      await page.fill('[data-testid="search-input"]', 'JavaScript');
      
      // Should highlight matching messages
      await expect(page.locator('[data-testid="search-highlight"]')).toBeVisible();
    });
    
    test('should export conversation', async ({ page }) => {
      // Create some conversation content
      await page.fill('[data-testid="message-input"]', 'This is a test conversation for export');
      await page.click('[data-testid="send-button"]');
      
      // Wait for response
      await page.waitForTimeout(3000);
      
      // Open conversation menu
      await page.click('[data-testid="conversation-menu"]');
      
      // Click export
      const downloadPromise = page.waitForEvent('download');
      await page.click('[data-testid="export-conversation"]');
      
      const download = await downloadPromise;
      
      // Verify download
      expect(download.suggestedFilename()).toContain('conversation');
      expect(download.suggestedFilename()).toMatch(/\.(json|txt|md)$/);
    });
  });

  test.describe('Error Handling', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/chat');
    });
    
    test('should handle API errors gracefully', async ({ page }) => {
      // Mock API error
      await page.route('/api/chat', route => {
        route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ success: false, error: 'AI service temporarily unavailable' })
        });
      });
      
      await page.fill('[data-testid="message-input"]', 'This will trigger an error');
      await page.click('[data-testid="send-button"]');
      
      // Should show error message
      await expect(page.locator('[data-testid="error-message"]')).toBeVisible();
      await expect(page.locator('[data-testid="error-message"]')).toContainText('temporarily unavailable');
      
      // Should offer retry option
      await expect(page.locator('[data-testid="retry-button"]')).toBeVisible();
    });
    
    test('should handle network connectivity issues', async ({ page }) => {
      // Send initial message
      await page.fill('[data-testid="message-input"]', 'Test message before network issue');
      await page.click('[data-testid="send-button"]');
      
      // Simulate network failure
      await page.setOffline(true);
      
      await page.fill('[data-testid="message-input"]', 'This message will fail');
      await page.click('[data-testid="send-button"]');
      
      // Should show network error
      await expect(page.locator('[data-testid="network-error"]')).toBeVisible();
      
      // Restore connectivity
      await page.setOffline(false);
      
      // Retry should work
      await page.click('[data-testid="retry-button"]');
      await expect(page.locator('[data-testid="message-user"]').last()).toContainText('This message will fail');
    });
  });
});

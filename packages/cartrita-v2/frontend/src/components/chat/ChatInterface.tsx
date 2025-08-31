'use client';

import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bot, User, ArrowUp, ArrowDown, Copy, Trash2, Edit, RotateCcw } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/cjs/styles/prism';
import { 
  useMessages, 
  useCurrentConversation, 
  useUser,
  useIsLoading 
} from '@/store';
import { Message } from '@/types';
import { formatDate, copyToClipboard } from '@/lib/utils';
import { cn } from '@/lib/utils';
import ChatInput from './ChatInput';
import MessageAttachments from './MessageAttachments';
import TypingIndicator from './TypingIndicator';
import WelcomeScreen from './WelcomeScreen';

const ChatInterface: React.FC = () => {
  const messages = useMessages();
  const currentConversation = useCurrentConversation();
  const user = useUser();
  const isLoading = useIsLoading();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (autoScroll && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, autoScroll]);

  // Handle scroll to detect if user scrolled up
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    const isAtBottom = scrollHeight - scrollTop <= clientHeight + 100;
    setAutoScroll(isAtBottom);
  };

  if (!user) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <Bot className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
          <h2 className="text-xl font-semibold mb-2">Welcome to Cartrita</h2>
          <p className="text-muted-foreground">Please log in to start chatting</p>
        </div>
      </div>
    );
  }

  if (!currentConversation || messages.length === 0) {
    return <WelcomeScreen />;
  }

  return (
    <div className="h-full flex flex-col bg-gradient-to-b from-white to-gray-50/50 dark:from-gray-900 dark:to-gray-950/50">
      {/* Messages Area */}
      <div 
        className="flex-1 overflow-y-auto scrollbar-thin"
        onScroll={handleScroll}
      >
        <div className="max-w-4xl mx-auto px-4">
          <AnimatePresence initial={false}>
            {messages.map((message, index) => (
              <MessageBubble
                key={message.id}
                message={message}
                isLast={index === messages.length - 1}
              />
            ))}
          </AnimatePresence>
          {isLoading && <TypingIndicator />}
          <div ref={messagesEndRef} />
        </div>

        {/* Scroll to Bottom Button */}
        <AnimatePresence>
          {!autoScroll && (
            <motion.button
              initial={{ opacity: 0, scale: 0.8, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.8, y: 10 }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => {
                setAutoScroll(true);
                messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
              }}
              className="fixed bottom-28 right-6 w-12 h-12 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white rounded-full shadow-premium hover:shadow-emerald transition-all duration-200 flex items-center justify-center z-10 backdrop-blur-sm"
            >
              <ArrowDown className="w-5 h-5" />
            </motion.button>
          )}
        </AnimatePresence>
      </div>

      {/* Chat Input Container */}
      <div className="border-t border-gray-200 dark:border-gray-700 bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl">
        <div className="max-w-4xl mx-auto p-4">
          <ChatInput />
        </div>
      </div>
    </div>
  );
};

interface MessageBubbleProps {
  message: Message;
  isLast: boolean;
}

const MessageBubble: React.FC<MessageBubbleProps> = ({ message, isLast }) => {
  const [showActions, setShowActions] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    const success = await copyToClipboard(message.content);
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const isUser = message.role === 'user';
  const isTyping = message.isTyping;
  const isError = message.isError;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
      className={cn(
        "group relative py-6 border-b border-gray-100/50 dark:border-gray-800/50 last:border-b-0",
        isUser ? "chat-message-user" : "chat-message-assistant"
      )}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      <div className="chat-message-content flex space-x-4">
        {/* Avatar */}
        <div className="flex-shrink-0">
          {isUser ? (
            <motion.div 
              className="chat-avatar chat-avatar-user animate-slide-up"
              whileHover={{ scale: 1.1 }}
              transition={{ type: "spring", stiffness: 300 }}
            >
              <User className="w-4 h-4" />
            </motion.div>
          ) : (
            <motion.div 
              className="chat-avatar chat-avatar-assistant animate-slide-up"
              whileHover={{ scale: 1.1 }}
              transition={{ type: "spring", stiffness: 300 }}
            >
              <Bot className="w-4 h-4" />
            </motion.div>
          )}
        </div>

        {/* Message Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center space-x-3 mb-3">
            <span className="font-semibold text-sm text-gradient">
              {isUser ? 'You' : 'Cartrita'}
            </span>
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {formatDate(message.timestamp)}
            </span>
            {message.metadata?.model && (
              <span className="text-xs bg-gradient-to-r from-emerald-100 to-emerald-200 dark:from-emerald-900/30 dark:to-emerald-800/30 text-emerald-700 dark:text-emerald-300 px-2 py-1 rounded-full font-medium">
                {message.metadata.model}
              </span>
            )}
          </div>

          {/* Message Text */}
          {isTyping ? (
            <div className="flex items-center space-x-2">
              <TypingIndicator />
            </div>
          ) : isError ? (
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex items-center space-x-2 text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 p-3 rounded-xl border border-red-200 dark:border-red-800"
            >
              <span className="text-sm font-medium">{message.content}</span>
            </motion.div>
          ) : (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.1 }}
              className="prose prose-sm max-w-none dark:prose-invert prose-headings:text-gray-900 dark:prose-headings:text-gray-100 prose-p:text-gray-800 dark:prose-p:text-gray-200 prose-code:text-emerald-600 dark:prose-code:text-emerald-400"
            >
              <ReactMarkdown
                components={{
                  code({ inline, className, children, ...props }) {
                    const match = /language-(\w+)/.exec(className || '');
                    return !inline && match ? (
                      <div className="code-block-enhanced my-4">
                        <div className="code-header">
                          <span className="code-language">{match[1]}</span>
                          <button 
                            onClick={() => copyToClipboard(String(children))}
                            className="code-copy-button"
                          >
                            Copy
                          </button>
                        </div>
                        <SyntaxHighlighter
                          style={oneDark}
                          language={match[1]}
                          PreTag="div"
                          className="!m-0 !bg-transparent"
                          {...props}
                        >
                          {String(children).replace(/\n$/, '')}
                        </SyntaxHighlighter>
                      </div>
                    ) : (
                      <code className="bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 px-1.5 py-0.5 rounded-md text-sm font-mono" {...props}>
                        {children}
                      </code>
                    );
                  },
                  p: ({ children }) => (
                    <p className="mb-3 last:mb-0 leading-relaxed">{children}</p>
                  ),
                  ul: ({ children }) => (
                    <ul className="list-disc list-inside space-y-1 ml-4">{children}</ul>
                  ),
                  ol: ({ children }) => (
                    <ol className="list-decimal list-inside space-y-1 ml-4">{children}</ol>
                  ),
                }}
              >
                {message.content}
              </ReactMarkdown>
            </motion.div>
          )}

          {/* Attachments */}
          {message.attachments && message.attachments.length > 0 && (
            <MessageAttachments attachments={message.attachments} />
          )}

          {/* Tool Calls */}
          {message.toolCalls && message.toolCalls.length > 0 && (
            <div className="mt-3 space-y-2">
              {message.toolCalls.map((toolCall) => (
                <div
                  key={toolCall.id}
                  className="border border-gray-200 dark:border-gray-700 rounded-lg p-3 bg-accent/50"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-sm">{toolCall.name}</span>
                    <span className={cn(
                      "text-xs px-2 py-1 rounded",
                      toolCall.status === 'completed' && "bg-green-100 text-green-800",
                      toolCall.status === 'failed' && "bg-red-100 text-red-800",
                      toolCall.status === 'running' && "bg-yellow-100 text-yellow-800",
                      toolCall.status === 'pending' && "bg-gray-100 text-gray-800"
                    )}>
                      {toolCall.status}
                    </span>
                  </div>
                  
                  {toolCall.description && (
                    <p className="text-sm text-muted-foreground mb-2">
                      {toolCall.description}
                    </p>
                  )}
                  
                  {toolCall.result && (
                    <div className="bg-background rounded p-2 text-sm">
                      <pre className="whitespace-pre-wrap">
                        {JSON.stringify(toolCall.result, null, 2)}
                      </pre>
                    </div>
                  )}
                  
                  {toolCall.error && (
                    <div className="text-destructive text-sm">
                      Error: {toolCall.error}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Metadata */}
          {message.metadata && (
            <div className="mt-2 text-xs text-muted-foreground">
              {message.metadata.tokens && (
                <span className="mr-3">
                  {message.metadata.tokens.total} tokens
                </span>
              )}
              {message.metadata.executionTime && (
                <span className="mr-3">
                  {message.metadata.executionTime}ms
                </span>
              )}
              {message.metadata.confidence && (
                <span>
                  {Math.round(message.metadata.confidence * 100)}% confidence
                </span>
              )}
            </div>
          )}
        </div>

        {/* Message Actions */}
        <AnimatePresence>
          {showActions && !isTyping && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 5 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 5 }}
              transition={{ duration: 0.2 }}
              className="flex items-center space-x-1 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-xl p-1 shadow-lg border border-gray-200/50 dark:border-gray-700/50"
            >
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.95 }}
                onClick={handleCopy}
                className="p-2 rounded-lg hover:bg-emerald-50 dark:hover:bg-emerald-900/30 transition-colors group relative"
                title="Copy message"
              >
                <Copy className={cn(
                  "w-4 h-4 transition-colors",
                  copied ? "text-emerald-600 dark:text-emerald-400" : "text-gray-500 dark:text-gray-400 group-hover:text-emerald-600 dark:group-hover:text-emerald-400"
                )} />
                {copied && (
                  <div className="tooltip-premium show">Copied!</div>
                )}
              </motion.button>
              
              {!isUser && (
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.95 }}
                  className="p-2 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors group"
                  title="Regenerate response"
                >
                  <RotateCcw className="w-4 h-4 text-gray-500 dark:text-gray-400 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors" />
                </motion.button>
              )}
              
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.95 }}
                className="p-2 rounded-lg hover:bg-amber-50 dark:hover:bg-amber-900/30 transition-colors group"
                title="Edit message"
              >
                <Edit className="w-4 h-4 text-gray-500 dark:text-gray-400 group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors" />
              </motion.button>
              
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.95 }}
                className="p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors group"
                title="Delete message"
              >
                <Trash2 className="w-4 h-4 text-gray-500 dark:text-gray-400 group-hover:text-red-600 dark:group-hover:text-red-400 transition-colors" />
              </motion.button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
};

export default ChatInterface;
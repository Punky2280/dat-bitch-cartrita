import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Send, 
  Mic, 
  MicOff, 
  Paperclip, 
  Image, 
  Code, 
  Bot, 
  User, 
  RefreshCw, 
  Copy, 
  ThumbsUp, 
  ThumbsDown, 
  MoreHorizontal,
  Sparkles,
  Zap,
  Brain,
  MessageSquare
} from 'lucide-react';
import { useWebSocket, useWebSocketMessage } from '../context/WebSocketContext';
import { useThemeContext } from '../context/ThemeContext';
import { Button } from '../components/ui/button';
import { Textarea } from '../components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '../components/ui/avatar';
import { Card } from '../components/ui/card';
import { Badge } from '../components/ui/badge';

interface Message {
  id: string;
  content: string;
  role: 'user' | 'assistant';
  timestamp: Date;
  status?: 'sending' | 'sent' | 'error';
  attachments?: any[];
  metadata?: {
    model?: string;
    tokens?: number;
    processingTime?: number;
  };
}

export const ChatPage: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [currentModel, setCurrentModel] = useState('Cartrita-GPT');
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const { isConnected, connectionHealth } = useWebSocket();
  const sendMessage = useWebSocketMessage();
  const { theme, themeSettings } = useThemeContext();

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
    }
  }, [inputValue]);

  const handleSendMessage = async () => {
    if (!inputValue.trim() || !isConnected) return;

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      content: inputValue.trim(),
      role: 'user',
      timestamp: new Date(),
      status: 'sending'
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsTyping(true);

    try {
      const response = await sendMessage('user_message', {
        text: userMessage.content,
        model: currentModel,
        conversationId: 'main'
      }, {
        priority: 'high',
        timeout: 30000
      });

      setIsTyping(false);

      const assistantMessage: Message = {
        id: `assistant-${Date.now()}`,
        content: response.content || 'I apologize, but I encountered an error processing your request.',
        role: 'assistant',
        timestamp: new Date(),
        status: 'sent',
        metadata: {
          model: response.model,
          tokens: response.tokens,
          processingTime: response.processingTime
        }
      };

      setMessages(prev => 
        prev.map(msg => 
          msg.id === userMessage.id 
            ? { ...msg, status: 'sent' }
            : msg
        ).concat(assistantMessage)
      );

    } catch (error) {
      setIsTyping(false);
      setMessages(prev => 
        prev.map(msg => 
          msg.id === userMessage.id 
            ? { ...msg, status: 'error' }
            : msg
        )
      );
      console.error('Failed to send message:', error);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const toggleRecording = () => {
    setIsRecording(!isRecording);
    // TODO: Implement voice recording logic
  };

  const handleFileUpload = () => {
    fileInputRef.current?.click();
  };

  const copyMessage = (content: string) => {
    navigator.clipboard.writeText(content);
  };

  return (
    <div className="flex flex-col h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 text-white">
      {/* Header */}
      <motion.header 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between p-4 border-b border-slate-700/50 backdrop-blur-sm bg-slate-900/80"
      >
        <div className="flex items-center space-x-3">
          <div className="relative">
            <div className="w-10 h-10 bg-gradient-to-br from-cyan-400 to-blue-600 rounded-full flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            {isConnected && (
              <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-400 rounded-full border-2 border-slate-900"></div>
            )}
          </div>
          <div>
            <h1 className="text-xl font-bold bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">
              Cartrita AI
            </h1>
            <p className="text-xs text-slate-400">
              {isConnected ? 'Connected' : 'Reconnecting...'}
            </p>
          </div>
        </div>
        
        <div className="flex items-center space-x-2">
          <Badge variant="outline" className="border-cyan-500/30 text-cyan-400">
            {currentModel}
          </Badge>
          <Button
            variant="ghost"
            size="sm"
            className="text-slate-400 hover:text-white"
          >
            <MoreHorizontal className="w-4 h-4" />
          </Button>
        </div>
      </motion.header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        <AnimatePresence>
          {messages.map((message) => (
            <motion.div
              key={message.id}
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.3 }}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'} group`}
            >
              <div className={`flex items-start space-x-3 max-w-4xl ${message.role === 'user' ? 'flex-row-reverse space-x-reverse' : ''}`}>
                {/* Avatar */}
                <Avatar className="w-8 h-8 flex-shrink-0">
                  {message.role === 'user' ? (
                    <>
                      <AvatarFallback className="bg-gradient-to-br from-purple-500 to-pink-600 text-white">
                        <User className="w-4 h-4" />
                      </AvatarFallback>
                    </>
                  ) : (
                    <AvatarFallback className="bg-gradient-to-br from-cyan-500 to-blue-600 text-white">
                      <Bot className="w-4 h-4" />
                    </AvatarFallback>
                  )}
                </Avatar>

                {/* Message Content */}
                <div className={`relative ${message.role === 'user' ? 'text-right' : 'text-left'}`}>
                  <Card className={`
                    p-4 max-w-2xl backdrop-blur-sm border-0 
                    ${message.role === 'user' 
                      ? 'bg-gradient-to-br from-blue-600 to-blue-700 text-white ml-auto' 
                      : 'bg-slate-800/80 text-white'
                    }
                    ${message.status === 'sending' ? 'opacity-70' : ''}
                    ${message.status === 'error' ? 'border-red-500 bg-red-500/10' : ''}
                  `}>
                    <div className="prose prose-invert max-w-none">
                      {message.content.split('\n').map((line, index) => (
                        <p key={index} className="mb-2 last:mb-0">
                          {line}
                        </p>
                      ))}
                    </div>
                    
                    {message.metadata && (
                      <div className="mt-3 pt-2 border-t border-slate-700/50 text-xs text-slate-400 flex items-center space-x-4">
                        {message.metadata.model && (
                          <span>{message.metadata.model}</span>
                        )}
                        {message.metadata.tokens && (
                          <span>{message.metadata.tokens} tokens</span>
                        )}
                        {message.metadata.processingTime && (
                          <span>{message.metadata.processingTime}ms</span>
                        )}
                      </div>
                    )}
                  </Card>

                  {/* Message Actions */}
                  <div className={`
                    absolute top-2 opacity-0 group-hover:opacity-100 transition-opacity
                    ${message.role === 'user' ? '-left-12' : '-right-12'}
                  `}>
                    <div className="flex flex-col space-y-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-8 h-8 p-0 text-slate-400 hover:text-white"
                        onClick={() => copyMessage(message.content)}
                      >
                        <Copy className="w-3 h-3" />
                      </Button>
                      {message.role === 'assistant' && (
                        <>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="w-8 h-8 p-0 text-slate-400 hover:text-green-400"
                          >
                            <ThumbsUp className="w-3 h-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="w-8 h-8 p-0 text-slate-400 hover:text-red-400"
                          >
                            <ThumbsDown className="w-3 h-3" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Status Indicator */}
                  {message.status === 'sending' && (
                    <div className="flex items-center space-x-1 mt-2 text-xs text-slate-400">
                      <RefreshCw className="w-3 h-3 animate-spin" />
                      <span>Sending...</span>
                    </div>
                  )}
                  {message.status === 'error' && (
                    <div className="flex items-center space-x-1 mt-2 text-xs text-red-400">
                      <span>Failed to send</span>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {/* Typing Indicator */}
        {isTyping && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="flex items-start space-x-3"
          >
            <Avatar className="w-8 h-8">
              <AvatarFallback className="bg-gradient-to-br from-cyan-500 to-blue-600 text-white">
                <Bot className="w-4 h-4" />
              </AvatarFallback>
            </Avatar>
            <Card className="p-4 bg-slate-800/80 backdrop-blur-sm border-0">
              <div className="flex items-center space-x-2">
                <div className="flex space-x-1">
                  <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce"></div>
                  <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                  <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                </div>
                <span className="text-slate-400 text-sm">Cartrita is thinking...</span>
              </div>
            </Card>
          </motion.div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="p-4 border-t border-slate-700/50 backdrop-blur-sm bg-slate-900/80"
      >
        <div className="max-w-4xl mx-auto">
          <div className="relative">
            <Textarea
              ref={textareaRef}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Message Cartrita..."
              className="pr-24 min-h-[52px] max-h-[120px] resize-none bg-slate-800/50 border-slate-600/50 focus:border-cyan-500 text-white placeholder:text-slate-400"
              disabled={!isConnected}
            />
            
            {/* Input Actions */}
            <div className="absolute right-2 bottom-2 flex items-center space-x-2">
              <Button
                variant="ghost"
                size="sm"
                className="p-2 text-slate-400 hover:text-white"
                onClick={handleFileUpload}
              >
                <Paperclip className="w-4 h-4" />
              </Button>
              
              <Button
                variant="ghost"
                size="sm"
                className={`p-2 ${isRecording ? 'text-red-400' : 'text-slate-400 hover:text-white'}`}
                onClick={toggleRecording}
              >
                {isRecording ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              </Button>
              
              <Button
                className="bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white p-2"
                onClick={handleSendMessage}
                disabled={!inputValue.trim() || !isConnected}
              >
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </div>
          
          {/* Connection Status */}
          {!isConnected && (
            <div className="mt-2 text-center text-sm text-amber-400">
              Connection lost. Reconnecting...
            </div>
          )}
        </div>
      </motion.div>

      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => {
          // TODO: Handle file upload
          console.log('Files selected:', e.target.files);
        }}
      />
    </div>
  );
};
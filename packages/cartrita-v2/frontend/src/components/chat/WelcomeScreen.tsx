'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { 
  MessageSquare, 
  Zap, 
  Image, 
  FileText, 
  Code, 
  Database,
  Workflow,
  Mic,
  Globe,
  Bot
} from 'lucide-react';
import useAppStore, { useUser, useTools } from '@/store';

const WelcomeScreen: React.FC = () => {
  const user = useUser();
  const tools = useTools();
  const { createNewConversation } = useAppStore();

  const handleExampleClick = async (prompt: string) => {
    try {
      const conversationId = await createNewConversation();
      // Auto-send the example prompt
      // This would be handled by the chat input component
    } catch (error) {
      console.error('Failed to create conversation:', error);
    }
  };

  const examples = [
    {
      title: "Explain complex concepts",
      prompt: "Explain quantum computing in simple terms",
      icon: <MessageSquare className="w-5 h-5" />
    },
    {
      title: "Generate code",
      prompt: "Create a React component for a todo list",
      icon: <Code className="w-5 h-5" />
    },
    {
      title: "Analyze images",
      prompt: "What do you see in this image?",
      icon: <Image className="w-5 h-5" />
    },
    {
      title: "Search knowledge",
      prompt: "Find information about machine learning",
      icon: <Database className="w-5 h-5" />
    },
    {
      title: "Create workflows",
      prompt: "Help me automate my daily tasks",
      icon: <Workflow className="w-5 h-5" />
    },
    {
      title: "Voice interaction",
      prompt: "Start a voice conversation",
      icon: <Mic className="w-5 h-5" />
    }
  ];

  const capabilities = [
    {
      title: "Multi-modal AI",
      description: "Text, images, audio, and code understanding",
      icon: <Bot className="w-6 h-6 text-blue-500" />
    },
    {
      title: "Tool Integration",
      description: "Access to powerful tools and integrations",
      icon: <Zap className="w-6 h-6 text-yellow-500" />
    },
    {
      title: "Knowledge Search",
      description: "Search through your personal knowledge base",
      icon: <Database className="w-6 h-6 text-green-500" />
    },
    {
      title: "Workflow Automation",
      description: "Create and execute complex workflows",
      icon: <Workflow className="w-6 h-6 text-purple-500" />
    }
  ];

  return (
    <div className="h-full flex flex-col items-center justify-center p-8 max-w-4xl mx-auto">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="text-center mb-12"
      >
        {/* Logo and Title */}
        <motion.div
          initial={{ scale: 0.8 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.2, duration: 0.4 }}
          className="mb-6"
        >
          <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Bot className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            Welcome to Cartrita
          </h1>
        </motion.div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4, duration: 0.5 }}
          className="text-xl text-muted-foreground mb-2"
        >
          {user ? `Hello, ${user.name}!` : 'Hello there!'} I'm your AI assistant.
        </motion.p>
        
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6, duration: 0.5 }}
          className="text-muted-foreground"
        >
          I can help you with a wide range of tasks. Start a conversation below or try one of these examples.
        </motion.p>
      </motion.div>

      {/* Example Prompts */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.8, duration: 0.5 }}
        className="w-full max-w-2xl mb-12"
      >
        <h2 className="text-lg font-semibold mb-4 text-center">Try these examples</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {examples.map((example, index) => (
            <motion.button
              key={index}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.9 + index * 0.1, duration: 0.3 }}
              onClick={() => handleExampleClick(example.prompt)}
              className="p-4 text-left rounded-lg border border-gray-200 dark:border-gray-700 hover:border-emerald-500 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              <div className="flex items-center space-x-3">
                <div className="text-primary">
                  {example.icon}
                </div>
                <div>
                  <div className="font-medium text-sm">{example.title}</div>
                  <div className="text-muted-foreground text-xs mt-1">
                    "{example.prompt}"
                  </div>
                </div>
              </div>
            </motion.button>
          ))}
        </div>
      </motion.div>

      {/* Capabilities */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.2, duration: 0.5 }}
        className="w-full max-w-3xl"
      >
        <h2 className="text-lg font-semibold mb-6 text-center">What I can do</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {capabilities.map((capability, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 1.3 + index * 0.1, duration: 0.3 }}
              className="p-4 rounded-lg bg-accent/50 text-center"
            >
              <div className="flex justify-center mb-3">
                {capability.icon}
              </div>
              <h3 className="font-medium text-sm mb-2">{capability.title}</h3>
              <p className="text-muted-foreground text-xs">{capability.description}</p>
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* Available Tools */}
      {tools.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.6, duration: 0.5 }}
          className="w-full max-w-2xl mt-12"
        >
          <h2 className="text-lg font-semibold mb-4 text-center">Available Tools</h2>
          <div className="flex flex-wrap gap-2 justify-center">
            {tools.slice(0, 8).map((tool, index) => (
              <motion.div
                key={tool.id}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 1.7 + index * 0.05, duration: 0.2 }}
                className="px-3 py-1.5 bg-primary/10 text-primary rounded-full text-sm font-medium"
              >
                {tool.name}
              </motion.div>
            ))}
            {tools.length > 8 && (
              <div className="px-3 py-1.5 bg-muted text-muted-foreground rounded-full text-sm">
                +{tools.length - 8} more
              </div>
            )}
          </div>
        </motion.div>
      )}

      {/* Footer note */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 2, duration: 0.5 }}
        className="mt-12 text-center text-sm text-muted-foreground"
      >
        <p>Start typing below to begin our conversation</p>
      </motion.div>
    </div>
  );
};

export default WelcomeScreen;
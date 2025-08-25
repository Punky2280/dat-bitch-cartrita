/**
 * Landing Page - Cartrita V2
 * Welcome page with navigation to modern chat interface
 */
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { 
  SparklesIcon,
  ChatBubbleLeftRightIcon,
  ComputerDesktopIcon,
  CodeBracketIcon,
  AcademicCapIcon,
  PencilIcon,
  ArrowRightIcon
} from '@heroicons/react/24/outline';

export default function LandingPage() {
  const router = useRouter();

  // Auto-redirect to chat after a brief landing page view
  useEffect(() => {
    const timer = setTimeout(() => {
      router.push('/chat');
    }, 3000); // 3 seconds

    return () => clearTimeout(timer);
  }, [router]);

  const features = [
    {
      icon: ChatBubbleLeftRightIcon,
      title: 'Multi-Agent Chat',
      description: '6 specialized AI agents ready to help',
      color: 'text-blue-500'
    },
    {
      icon: ComputerDesktopIcon,
      title: 'Computer Use',
      description: 'AI that can control your desktop',
      color: 'text-red-500'
    },
    {
      icon: CodeBracketIcon,
      title: 'Code Assistant',
      description: 'Advanced programming support',
      color: 'text-indigo-500'
    },
    {
      icon: AcademicCapIcon,
      title: 'Research Agent',
      description: 'Web research and analysis',
      color: 'text-green-500'
    },
    {
      icon: PencilIcon,
      title: 'Writing Assistant',
      description: 'Creative and technical writing',
      color: 'text-purple-500'
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-blue-50 dark:from-gray-900 dark:via-gray-800 dark:to-blue-900 flex flex-col items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="text-center max-w-4xl mx-auto"
      >
        {/* Logo and Title */}
        <motion.div
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="mb-8"
        >
          <div className="inline-flex items-center justify-center w-20 h-20 bg-blue-600 text-white rounded-2xl mb-6">
            <SparklesIcon className="w-10 h-10" />
          </div>
          <h1 className="text-6xl font-bold text-gray-900 dark:text-white mb-4">
            Cartrita V2
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-300 mb-8">
            Advanced Multi-Agent AI System with MCP Dual Orchestration
          </p>
        </motion.div>

        {/* Features Grid */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12"
        >
          {features.map((feature, index) => (
            <motion.div
              key={feature.title}
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.5 + index * 0.1 }}
              className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg border border-gray-200 dark:border-gray-700"
            >
              <feature.icon className={`w-8 h-8 ${feature.color} mb-4`} />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                {feature.title}
              </h3>
              <p className="text-gray-600 dark:text-gray-300 text-sm">
                {feature.description}
              </p>
            </motion.div>
          ))}
        </motion.div>

        {/* Call to Action */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.8 }}
          className="space-y-4"
        >
          <button
            onClick={() => router.push('/chat')}
            className="inline-flex items-center gap-3 px-8 py-4 bg-blue-600 hover:bg-blue-700 text-white text-lg font-semibold rounded-xl transition-all transform hover:scale-105 shadow-lg"
          >
            Start Chatting
            <ArrowRightIcon className="w-5 h-5" />
          </button>
          
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Redirecting automatically in a few seconds...
          </p>
        </motion.div>

        {/* Status Indicators */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 1.0 }}
          className="mt-12 flex justify-center gap-8"
        >
          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            6 AI Agents Active
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            MCP System Online
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            OpenAI Connected
          </div>
        </motion.div>
      </motion.div>

      {/* Background Animation */}
      <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-32 w-80 h-80 bg-blue-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob"></div>
        <div className="absolute -bottom-40 -left-32 w-80 h-80 bg-purple-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-2000"></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-yellow-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-4000"></div>
      </div>
    </div>
  );
}

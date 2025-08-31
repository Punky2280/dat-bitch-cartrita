/**
 * About Page - Cartrita V2
 * Comprehensive information about the platform, features, and capabilities
 */
'use client';

import React from 'react';
import { motion } from 'framer-motion';
import {
  SparklesIcon,
  CpuChipIcon,
  UserGroupIcon,
  BoltIcon,
  EyeIcon,
  ChartBarIcon,
  ShieldCheckIcon,
  GlobeAltIcon,
  CodeBracketIcon,
  AcademicCapIcon,
  CommandLineIcon,
  CloudIcon,
  DocumentTextIcon,
  LightBulbIcon,
  RocketLaunchIcon,
  BeakerIcon,
  CogIcon,
  ArrowRightIcon,
} from '@heroicons/react/24/outline';
import AppLayout from '@/components/layout/AppLayout';
import Link from 'next/link';

interface Feature {
  name: string;
  description: string;
  icon: React.ComponentType<any>;
  color: string;
  bgColor: string;
  capabilities: string[];
}

interface TeamMember {
  name: string;
  role: string;
  description: string;
  avatar: string;
}

export default function AboutPage() {
  const features: Feature[] = [
    {
      name: 'Multi-Agent Architecture',
      description: 'Foundation with 8 specialized agent types and routing system',
      icon: UserGroupIcon,
      color: 'text-blue-600',
      bgColor: 'bg-blue-500',
      capabilities: ['Agent Routing', 'Basic Coordination', 'Response Management', 'Configuration System']
    },
    {
      name: 'Modern Web Interface',
      description: 'React-based frontend with chat interface and agent selection',
      icon: CpuChipIcon,
      color: 'text-purple-600',
      bgColor: 'bg-purple-500',
      capabilities: ['Chat Interface', 'Agent Selection', 'Real-time Updates', 'Responsive Design']
    },
    {
      name: 'Agent Management',
      description: 'Agent status monitoring and performance tracking dashboard',
      icon: EyeIcon,
      color: 'text-pink-600',
      bgColor: 'bg-pink-500',
      capabilities: ['Status Monitoring', 'Performance Metrics', 'Agent Details', 'System Health']
    },
    {
      name: 'Development Platform',
      description: 'Full development environment with backend API and database support',
      icon: ChartBarIcon,
      color: 'text-green-600',
      bgColor: 'bg-green-500',
      capabilities: ['REST API', 'Database Ready', 'Docker Support', 'Development Tools']
    },
    {
      name: 'Extensible Design',
      description: 'Modular architecture designed for easy integration and expansion',
      icon: ShieldCheckIcon,
      color: 'text-red-600',
      bgColor: 'bg-red-500',
      capabilities: ['Modular Design', 'Plugin Support', 'API Integration', 'Configuration Management']
    },
    {
      name: 'Future-Ready Foundation',
      description: 'Built to support advanced AI features as they are implemented',
      icon: CloudIcon,
      color: 'text-cyan-600',
      bgColor: 'bg-cyan-500',
      capabilities: ['Scalable Architecture', 'AI Integration Points', 'Upgrade Path', 'Modern Stack']
    }
  ];

  const statistics = [
    { label: 'AI Agents', value: '8', description: 'Agent types configured' },
    { label: 'Development', value: 'Active', description: 'In progress' },
    { label: 'Response Time', value: '~350ms', description: 'Basic response time' },
    { label: 'Architecture', value: 'Multi-Agent', description: 'Agent coordination' },
    { label: 'Status', value: 'Beta', description: 'Current phase' },
    { label: 'Platform', value: 'Web-based', description: 'Modern interface' },
  ];

  const timeline = [
    {
      date: 'Q1 2024',
      title: 'Project Inception',
      description: 'Initial conception and research phase for advanced AI orchestration'
    },
    {
      date: 'Q2 2024',
      title: 'Core Development',
      description: 'Development of multi-agent system and MCP integration'
    },
    {
      date: 'Q3 2024',
      title: 'Quantum Integration',
      description: 'Integration of quantum computing capabilities and advanced analytics'
    },
    {
      date: 'Q4 2024',
      title: 'Beta Release',
      description: 'Limited beta release with enterprise security features'
    },
    {
      date: 'Q1 2025',
      title: 'Production Launch',
      description: 'Full production release with comprehensive feature set'
    },
    {
      date: 'Q2 2025',
      title: 'Future Expansion',
      description: 'Planned expansion with advanced cognitive AI and metaverse integration'
    },
  ];

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto space-y-16">
        {/* Hero Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center"
        >
          <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl mb-8">
            <SparklesIcon className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-4xl md:text-6xl font-bold text-gray-900 dark:text-white mb-6">
            About Cartrita V2
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-300 max-w-4xl mx-auto leading-relaxed">
            Cartrita V2 is an AI orchestration platform currently in development. The foundation includes 
            a multi-agent architecture with 8 specialized agents, basic chat functionality, and a modern 
            web interface. Advanced AI capabilities are being progressively integrated.
          </p>
        </motion.div>

        {/* Statistics */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-8"
        >
          {statistics.map((stat, index) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 + index * 0.1 }}
              className="text-center"
            >
              <div className="text-3xl md:text-4xl font-bold text-blue-600 dark:text-blue-400 mb-2">
                {stat.value}
              </div>
              <div className="font-semibold text-gray-900 dark:text-white mb-1">
                {stat.label}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                {stat.description}
              </div>
            </motion.div>
          ))}
        </motion.div>

        {/* Mission Statement */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-gradient-to-br from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 rounded-2xl p-8 md:p-12"
        >
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-6">
              Our Mission
            </h2>
            <p className="text-lg text-gray-700 dark:text-gray-300 leading-relaxed mb-8">
              To create a comprehensive AI orchestration platform that enables intelligent collaboration 
              between specialized agents. Currently in active development, Cartrita V2 aims to provide 
              a foundation for multi-agent AI systems with proper agent coordination, task routing, 
              and extensible capabilities.
            </p>
            <div className="grid md:grid-cols-3 gap-6">
              <div className="text-center">
                <LightBulbIcon className="w-12 h-12 text-yellow-500 mx-auto mb-4" />
                <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Innovation</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Pushing the boundaries of what's possible with AI
                </p>
              </div>
              <div className="text-center">
                <ShieldCheckIcon className="w-12 h-12 text-green-500 mx-auto mb-4" />
                <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Security</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Enterprise-grade security and privacy protection
                </p>
              </div>
              <div className="text-center">
                <UserGroupIcon className="w-12 h-12 text-blue-500 mx-auto mb-4" />
                <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Accessibility</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Making advanced AI accessible to everyone
                </p>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Key Features */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
        >
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white text-center mb-12">
            Platform Features
          </h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <motion.div
                key={feature.name}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.7 + index * 0.1 }}
                className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700 hover:shadow-lg transition-all duration-300"
              >
                <div className="flex items-center mb-4">
                  <div className={`w-12 h-12 rounded-xl ${feature.bgColor} bg-opacity-10 flex items-center justify-center mr-4`}>
                    <feature.icon className={`w-6 h-6 ${feature.color}`} />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    {feature.name}
                  </h3>
                </div>
                <p className="text-gray-600 dark:text-gray-300 mb-4">
                  {feature.description}
                </p>
                <div className="flex flex-wrap gap-2">
                  {feature.capabilities.map((capability) => (
                    <span
                      key={capability}
                      className="px-3 py-1 text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-full"
                    >
                      {capability}
                    </span>
                  ))}
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Technology Stack */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8 }}
          className="bg-white dark:bg-gray-800 rounded-2xl p-8 md:p-12 shadow-sm border border-gray-200 dark:border-gray-700"
        >
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white text-center mb-12">
            Technology Stack
          </h2>
          <div className="grid md:grid-cols-4 gap-8">
            <div>
              <h4 className="font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
                <CodeBracketIcon className="w-5 h-5 mr-2 text-blue-500" />
                Frontend
              </h4>
              <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
                <li>• Next.js 15.5.0</li>
                <li>• React 19.1.0</li>
                <li>• TypeScript 5</li>
                <li>• Tailwind CSS 4</li>
                <li>• Framer Motion</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
                <CogIcon className="w-5 h-5 mr-2 text-green-500" />
                Backend
              </h4>
              <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
                <li>• Python FastAPI</li>
                <li>• Node.js Express</li>
                <li>• PostgreSQL</li>
                <li>• Redis</li>
                <li>• Docker</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
                <BeakerIcon className="w-5 h-5 mr-2 text-purple-500" />
                AI & ML
              </h4>
              <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
                <li>• OpenAI GPT-4</li>
                <li>• Claude 3.5 Sonnet</li>
                <li>• LangChain</li>
                <li>• Quantum Algorithms</li>
                <li>• Computer Vision</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
                <CloudIcon className="w-5 h-5 mr-2 text-cyan-500" />
                Infrastructure
              </h4>
              <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
                <li>• Kubernetes</li>
                <li>• AWS/Azure/GCP</li>
                <li>• Prometheus</li>
                <li>• Grafana</li>
                <li>• Nginx</li>
              </ul>
            </div>
          </div>
        </motion.div>

        {/* Development Timeline */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.0 }}
        >
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white text-center mb-12">
            Development Timeline
          </h2>
          <div className="relative">
            <div className="absolute left-1/2 transform -translate-x-px h-full w-0.5 bg-gray-200 dark:bg-gray-700"></div>
            <div className="space-y-8">
              {timeline.map((item, index) => (
                <motion.div
                  key={item.date}
                  initial={{ opacity: 0, x: index % 2 === 0 ? -50 : 50 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 1.1 + index * 0.2 }}
                  className={`relative flex items-center ${
                    index % 2 === 0 ? 'justify-start' : 'justify-end'
                  }`}
                >
                  <div className={`w-5/12 ${index % 2 === 0 ? 'pr-8 text-right' : 'pl-8 text-left'}`}>
                    <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
                      <div className="text-sm font-medium text-blue-600 dark:text-blue-400 mb-2">
                        {item.date}
                      </div>
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                        {item.title}
                      </h3>
                      <p className="text-gray-600 dark:text-gray-300">
                        {item.description}
                      </p>
                    </div>
                  </div>
                  <div className="absolute left-1/2 transform -translate-x-1/2 w-4 h-4 bg-blue-600 rounded-full border-4 border-white dark:border-gray-900"></div>
                </motion.div>
              ))}
            </div>
          </div>
        </motion.div>

        {/* Call to Action */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.2 }}
          className="text-center bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl p-8 md:p-12 text-white"
        >
          <RocketLaunchIcon className="w-16 h-16 mx-auto mb-6 opacity-90" />
          <h2 className="text-3xl font-bold mb-4">
            Ready to Experience the Future?
          </h2>
          <p className="text-lg mb-8 opacity-90">
            Join thousands of users leveraging the power of advanced AI orchestration
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/chat"
              className="inline-flex items-center px-6 py-3 bg-white text-blue-600 font-semibold rounded-lg hover:bg-gray-100 transition-colors"
            >
              Start Chatting
              <ArrowRightIcon className="w-5 h-5 ml-2" />
            </Link>
            <Link
              href="/manual"
              className="inline-flex items-center px-6 py-3 border border-white text-white font-semibold rounded-lg hover:bg-white hover:bg-opacity-10 transition-colors"
            >
              Read Documentation
              <DocumentTextIcon className="w-5 h-5 ml-2" />
            </Link>
          </div>
        </motion.div>
      </div>
    </AppLayout>
  );
}
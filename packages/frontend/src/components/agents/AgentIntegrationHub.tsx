import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Cpu, 
  Code, 
  BarChart3, 
  Palette, 
  Target, 
  Shield, 
  TrendingUp, 
  Search, 
  MessageCircle, 
  Eye, 
  User, 
  Zap, 
  CheckCircle, 
  AlertTriangle, 
  Settings 
} from 'lucide-react';
import { useApp } from '@/context/AppContext';

// Agent type definitions for the 15 sophisticated agents
interface SophisticatedAgent {
  id: string;
  name: string;
  type: string;
  description: string;
  icon: React.ComponentType<any>;
  status: 'active' | 'inactive' | 'busy' | 'error';
  capabilities: string[];
  personality: string;
  lastActivity: string;
  tasksCompleted: number;
  successRate: number;
  averageResponseTime: number;
  specialization: string;
  aiModel: string;
}

// The 15 sophisticated agents data
const SOPHISTICATED_AGENTS: SophisticatedAgent[] = [
  {
    id: 'cartrita_core',
    name: 'Cartrita Core',
    type: 'interface',
    description: 'Primary interface agent with Miami street-smart personality',
    icon: Cpu,
    status: 'active',
    capabilities: ['Natural Language Processing', 'Task Coordination', 'User Interface', 'Personality Management'],
    personality: 'Miami street-smart, confident, results-oriented',
    lastActivity: '2 minutes ago',
    tasksCompleted: 1247,
    successRate: 98.5,
    averageResponseTime: 1.2,
    specialization: 'Primary Interface & Coordination',
    aiModel: 'GPT-4o'
  },
  {
    id: 'code_maestro',
    name: 'Code Maestro',
    type: 'development',
    description: 'Advanced development expert for full-stack coding tasks',
    icon: Code,
    status: 'active',
    capabilities: ['Full-Stack Development', 'Code Analysis', 'Architecture Design', 'Quality Standards'],
    personality: 'Technical perfectionist with practical Miami efficiency',
    lastActivity: '5 minutes ago',
    tasksCompleted: 892,
    successRate: 97.2,
    averageResponseTime: 3.1,
    specialization: 'Development & Architecture',
    aiModel: 'GPT-4o'
  },
  {
    id: 'data_science_wizard',
    name: 'Data Science Wizard',
    type: 'analytics',
    description: 'Analytics and intelligence specialist for data-driven insights',
    icon: BarChart3,
    status: 'busy',
    capabilities: ['ML Analysis', 'Statistical Modeling', 'Data Visualization', 'Business Intelligence'],
    personality: 'Analytical genius with Miami hustle for actionable insights',
    lastActivity: 'Active now',
    tasksCompleted: 634,
    successRate: 96.8,
    averageResponseTime: 4.7,
    specialization: 'Data Science & ML',
    aiModel: 'GPT-4o'
  },
  {
    id: 'creative_director',
    name: 'Creative Director',
    type: 'design',
    description: 'Design and content excellence expert with brand consistency focus',
    icon: Palette,
    status: 'active',
    capabilities: ['Design Analysis', 'Brand Development', 'UX/UI Expertise', 'Content Strategy'],
    personality: 'Creative visionary with Miami style and premium aesthetics',
    lastActivity: '12 minutes ago',
    tasksCompleted: 445,
    successRate: 95.9,
    averageResponseTime: 2.8,
    specialization: 'Design & Creative Strategy',
    aiModel: 'GPT-4o'
  },
  {
    id: 'productivity_master',
    name: 'Productivity Master',
    type: 'management',
    description: 'Task and project management expert with efficiency optimization',
    icon: Target,
    status: 'active',
    capabilities: ['Project Management', 'Task Optimization', 'Team Coordination', 'Process Automation'],
    personality: 'Efficiency-obsessed with Miami urgency for results',
    lastActivity: '8 minutes ago',
    tasksCompleted: 756,
    successRate: 98.1,
    averageResponseTime: 1.9,
    specialization: 'Productivity & Management',
    aiModel: 'GPT-4o-mini'
  },
  {
    id: 'security_guardian',
    name: 'Security Guardian',
    type: 'security',
    description: 'Cybersecurity and privacy expert with threat detection capabilities',
    icon: Shield,
    status: 'active',
    capabilities: ['Threat Detection', 'Security Analysis', 'Privacy Protection', 'Compliance Management'],
    personality: 'Security-first mindset with Miami street awareness',
    lastActivity: '3 minutes ago',
    tasksCompleted: 523,
    successRate: 99.2,
    averageResponseTime: 2.1,
    specialization: 'Cybersecurity & Privacy',
    aiModel: 'GPT-4o'
  },
  {
    id: 'business_strategy',
    name: 'Business Strategy',
    type: 'strategy',
    description: 'Market intelligence and strategic planning expert',
    icon: TrendingUp,
    status: 'active',
    capabilities: ['Market Analysis', 'Strategic Planning', 'Competitive Intelligence', 'Financial Modeling'],
    personality: 'Strategic thinker with Miami business acumen',
    lastActivity: '15 minutes ago',
    tasksCompleted: 387,
    successRate: 97.6,
    averageResponseTime: 5.2,
    specialization: 'Business Strategy & Intelligence',
    aiModel: 'GPT-4o'
  },
  {
    id: 'research_intelligence',
    name: 'Research Intelligence',
    type: 'research',
    description: 'Information gathering and analysis expert with fact-checking abilities',
    icon: Search,
    status: 'active',
    capabilities: ['Information Gathering', 'Fact Checking', 'Research Analysis', 'Knowledge Synthesis'],
    personality: 'Detail-oriented researcher with Miami determination',
    lastActivity: '6 minutes ago',
    tasksCompleted: 678,
    successRate: 96.4,
    averageResponseTime: 3.8,
    specialization: 'Research & Intelligence',
    aiModel: 'GPT-4o-mini'
  },
  {
    id: 'communication_expert',
    name: 'Communication Expert',
    type: 'communication',
    description: 'Messaging and relationship management specialist',
    icon: MessageCircle,
    status: 'active',
    capabilities: ['Communication Strategy', 'Relationship Management', 'Content Creation', 'Engagement Optimization'],
    personality: 'Charismatic communicator with Miami charm',
    lastActivity: '4 minutes ago',
    tasksCompleted: 934,
    successRate: 97.8,
    averageResponseTime: 1.6,
    specialization: 'Communication & Engagement',
    aiModel: 'GPT-4o-mini'
  },
  {
    id: 'multimodal_fusion',
    name: 'Multimodal Fusion',
    type: 'multimodal',
    description: 'Vision, audio, text integration expert with cross-modal intelligence',
    icon: Eye,
    status: 'busy',
    capabilities: ['Computer Vision', 'Audio Processing', 'Cross-Modal Analysis', 'Media Integration'],
    personality: 'Tech-savvy integrator with Miami innovation spirit',
    lastActivity: 'Active now',
    tasksCompleted: 312,
    successRate: 94.7,
    averageResponseTime: 6.3,
    specialization: 'Multimodal AI Integration',
    aiModel: 'GPT-4o + Vision'
  },
  {
    id: 'personalization_expert',
    name: 'Personalization Expert',
    type: 'personalization',
    description: 'User experience personalization specialist with behavioral analysis',
    icon: User,
    status: 'active',
    capabilities: ['User Behavior Analysis', 'Personalization Engine', 'Experience Optimization', 'Preference Learning'],
    personality: 'User-focused optimizer with Miami hospitality',
    lastActivity: '9 minutes ago',
    tasksCompleted: 567,
    successRate: 98.3,
    averageResponseTime: 2.4,
    specialization: 'Personalization & UX',
    aiModel: 'GPT-4o-mini'
  },
  {
    id: 'integration_master',
    name: 'Integration Master',
    type: 'integration',
    description: 'System connectivity and API expert with 50+ platform integrations',
    icon: Zap,
    status: 'active',
    capabilities: ['API Integration', 'System Connectivity', 'Data Synchronization', 'Platform Management'],
    personality: 'Integration specialist with Miami networking prowess',
    lastActivity: '11 minutes ago',
    tasksCompleted: 823,
    successRate: 96.1,
    averageResponseTime: 2.7,
    specialization: 'Systems Integration',
    aiModel: 'GPT-4o-mini'
  },
  {
    id: 'quality_assurance',
    name: 'Quality Assurance',
    type: 'quality',
    description: 'Testing, validation, and reliability expert with automated quality checks',
    icon: CheckCircle,
    status: 'active',
    capabilities: ['Quality Testing', 'Validation Systems', 'Reliability Analysis', 'Performance Monitoring'],
    personality: 'Quality perfectionist with Miami standards',
    lastActivity: '7 minutes ago',
    tasksCompleted: 445,
    successRate: 99.1,
    averageResponseTime: 1.8,
    specialization: 'Quality & Testing',
    aiModel: 'GPT-4o-mini'
  },
  {
    id: 'emergency_response',
    name: 'Emergency Response',
    type: 'emergency',
    description: 'Crisis management and rapid response specialist',
    icon: AlertTriangle,
    status: 'active',
    capabilities: ['Crisis Management', 'Rapid Response', 'Incident Handling', 'Emergency Protocols'],
    personality: 'Cool under pressure with Miami crisis response',
    lastActivity: '45 minutes ago',
    tasksCompleted: 89,
    successRate: 99.7,
    averageResponseTime: 0.9,
    specialization: 'Emergency & Crisis Management',
    aiModel: 'GPT-4o'
  },
  {
    id: 'automation_architect',
    name: 'Automation Architect',
    type: 'automation',
    description: 'Workflow and process optimization expert with intelligent orchestration',
    icon: Settings,
    status: 'active',
    capabilities: ['Workflow Automation', 'Process Optimization', 'System Orchestration', 'Efficiency Engineering'],
    personality: 'Automation obsessed with Miami efficiency multiplication',
    lastActivity: '13 minutes ago',
    tasksCompleted: 678,
    successRate: 97.9,
    averageResponseTime: 2.3,
    specialization: 'Automation & Orchestration',
    aiModel: 'GPT-4o-mini'
  }
];

export const AgentIntegrationHub: React.FC = () => {
  const { state, actions } = useApp();
  const [selectedAgent, setSelectedAgent] = useState<SophisticatedAgent | null>(null);
  const [filterType, setFilterType] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Filter and search agents
  const filteredAgents = SOPHISTICATED_AGENTS.filter(agent => {
    const matchesType = filterType === 'all' || agent.type === filterType;
    const matchesSearch = searchQuery === '' || 
      agent.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      agent.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      agent.specialization.toLowerCase().includes(searchQuery.toLowerCase());
    
    return matchesType && matchesSearch;
  });

  // Get unique agent types for filter
  const agentTypes = ['all', ...Array.from(new Set(SOPHISTICATED_AGENTS.map(a => a.type)))];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-500';
      case 'busy': return 'bg-yellow-500';
      case 'inactive': return 'bg-gray-500';
      case 'error': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  const handleAgentSelect = (agent: SophisticatedAgent) => {
    setSelectedAgent(agent);
    actions.addActivity({
      type: 'agent',
      message: `Viewing ${agent.name} details`,
      timestamp: new Date().toISOString()
    });
  };

  const handleAgentChat = useCallback((agent: SophisticatedAgent) => {
    // Navigate to chat with specific agent
    actions.addActivity({
      type: 'chat',
      message: `Started chat with ${agent.name}`,
      timestamp: new Date().toISOString()
    });
    actions.showNotification('success', `Starting conversation with ${agent.name}`);
  }, [actions]);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Sophisticated Agent Hub</h1>
          <p className="text-slate-400">15 Advanced AI Agents with Miami Street-Smart Personality</p>
        </div>
        <div className="flex items-center space-x-4">
          <div className="bg-slate-800 rounded-lg p-3">
            <div className="text-sm text-slate-400">Active Agents</div>
            <div className="text-2xl font-bold text-green-400">
              {SOPHISTICATED_AGENTS.filter(a => a.status === 'active').length}
            </div>
          </div>
          <div className="bg-slate-800 rounded-lg p-3">
            <div className="text-sm text-slate-400">Total Tasks</div>
            <div className="text-2xl font-bold text-cyan-400">
              {SOPHISTICATED_AGENTS.reduce((sum, a) => sum + a.tasksCompleted, 0).toLocaleString()}
            </div>
          </div>
          <div className="bg-slate-800 rounded-lg p-3">
            <div className="text-sm text-slate-400">Avg Success</div>
            <div className="text-2xl font-bold text-blue-400">
              {(SOPHISTICATED_AGENTS.reduce((sum, a) => sum + a.successRate, 0) / SOPHISTICATED_AGENTS.length).toFixed(1)}%
            </div>
          </div>
        </div>
      </div>

      {/* Search and Filter */}
      <div className="flex items-center space-x-4">
        <div className="flex-1">
          <input
            type="text"
            placeholder="Search agents by name, description, or specialization..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white placeholder-slate-400 focus:border-cyan-500 focus:outline-none"
          />
        </div>
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white focus:border-cyan-500 focus:outline-none"
        >
          {agentTypes.map(type => (
            <option key={type} value={type}>
              {type === 'all' ? 'All Types' : type.charAt(0).toUpperCase() + type.slice(1)}
            </option>
          ))}
        </select>
      </div>

      {/* Agent Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        <AnimatePresence>
          {filteredAgents.map((agent) => {
            const Icon = agent.icon;
            return (
              <motion.div
                key={agent.id}
                layout
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                whileHover={{ scale: 1.02, y: -4 }}
                className="bg-slate-800 rounded-xl border border-slate-700 hover:border-cyan-500/50 transition-all cursor-pointer group overflow-hidden"
                onClick={() => handleAgentSelect(agent)}
              >
                <div className="p-6">
                  {/* Agent Header */}
                  <div className="flex items-start justify-between mb-4">
                    <div className={`p-3 rounded-lg ${getStatusColor(agent.status).replace('bg-', 'bg-').replace('-500', '-500/10')} border border-${getStatusColor(agent.status).replace('bg-', '').replace('-500', '-500/20')}`}>
                      <Icon className={`w-6 h-6 ${getStatusColor(agent.status).replace('bg-', 'text-')}`} />
                    </div>
                    <div className="flex items-center space-x-2">
                      <div className={`w-2 h-2 rounded-full ${getStatusColor(agent.status)}`}></div>
                      <span className="text-xs text-slate-400 capitalize">{agent.status}</span>
                    </div>
                  </div>

                  {/* Agent Info */}
                  <h3 className="text-lg font-semibold text-white mb-2 group-hover:text-cyan-400 transition-colors">
                    {agent.name}
                  </h3>
                  <p className="text-sm text-slate-400 mb-4 line-clamp-2">
                    {agent.description}
                  </p>

                  {/* Stats */}
                  <div className="space-y-2 mb-4">
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-400">Success Rate</span>
                      <span className="text-green-400 font-medium">{agent.successRate}%</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-400">Tasks Done</span>
                      <span className="text-cyan-400 font-medium">{agent.tasksCompleted.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-400">Response Time</span>
                      <span className="text-blue-400 font-medium">{agent.averageResponseTime}s</span>
                    </div>
                  </div>

                  {/* Specialization */}
                  <div className="mb-4">
                    <div className="bg-slate-700 rounded-lg px-3 py-1 text-xs text-slate-300">
                      {agent.specialization}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex space-x-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleAgentChat(agent);
                      }}
                      className="flex-1 bg-cyan-600 hover:bg-cyan-700 text-white text-sm px-3 py-2 rounded-lg transition-colors flex items-center justify-center space-x-1"
                    >
                      <MessageCircle className="w-4 h-4" />
                      <span>Chat</span>
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleAgentSelect(agent);
                      }}
                      className="bg-slate-700 hover:bg-slate-600 text-white text-sm px-3 py-2 rounded-lg transition-colors"
                    >
                      Details
                    </button>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {/* Agent Details Modal */}
      <AnimatePresence>
        {selectedAgent && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setSelectedAgent(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-slate-800 rounded-2xl border border-slate-700 max-w-2xl w-full max-h-[90vh] overflow-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-8">
                {/* Header */}
                <div className="flex items-start justify-between mb-6">
                  <div className="flex items-center space-x-4">
                    <div className={`p-4 rounded-xl ${getStatusColor(selectedAgent.status).replace('bg-', 'bg-').replace('-500', '-500/10')} border border-${getStatusColor(selectedAgent.status).replace('bg-', '').replace('-500', '-500/20')}`}>
                      <selectedAgent.icon className={`w-8 h-8 ${getStatusColor(selectedAgent.status).replace('bg-', 'text-')}`} />
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold text-white">{selectedAgent.name}</h2>
                      <p className="text-slate-400">{selectedAgent.type.charAt(0).toUpperCase() + selectedAgent.type.slice(1)} Agent</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className={`w-3 h-3 rounded-full ${getStatusColor(selectedAgent.status)}`}></div>
                    <span className="text-sm text-slate-400 capitalize">{selectedAgent.status}</span>
                  </div>
                </div>

                {/* Description */}
                <div className="mb-6">
                  <h3 className="text-lg font-semibold text-white mb-2">Description</h3>
                  <p className="text-slate-300">{selectedAgent.description}</p>
                </div>

                {/* Personality */}
                <div className="mb-6">
                  <h3 className="text-lg font-semibold text-white mb-2">Personality</h3>
                  <p className="text-slate-300 italic">"{selectedAgent.personality}"</p>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div className="bg-slate-700/50 rounded-lg p-4">
                    <div className="text-sm text-slate-400">Tasks Completed</div>
                    <div className="text-2xl font-bold text-cyan-400">{selectedAgent.tasksCompleted.toLocaleString()}</div>
                  </div>
                  <div className="bg-slate-700/50 rounded-lg p-4">
                    <div className="text-sm text-slate-400">Success Rate</div>
                    <div className="text-2xl font-bold text-green-400">{selectedAgent.successRate}%</div>
                  </div>
                  <div className="bg-slate-700/50 rounded-lg p-4">
                    <div className="text-sm text-slate-400">Avg Response</div>
                    <div className="text-2xl font-bold text-blue-400">{selectedAgent.averageResponseTime}s</div>
                  </div>
                  <div className="bg-slate-700/50 rounded-lg p-4">
                    <div className="text-sm text-slate-400">AI Model</div>
                    <div className="text-lg font-bold text-purple-400">{selectedAgent.aiModel}</div>
                  </div>
                </div>

                {/* Capabilities */}
                <div className="mb-6">
                  <h3 className="text-lg font-semibold text-white mb-3">Capabilities</h3>
                  <div className="grid grid-cols-2 gap-2">
                    {selectedAgent.capabilities.map((capability, index) => (
                      <div
                        key={index}
                        className="bg-slate-700 rounded-lg px-3 py-2 text-sm text-slate-300 flex items-center space-x-2"
                      >
                        <CheckCircle className="w-4 h-4 text-green-400" />
                        <span>{capability}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex space-x-4">
                  <button
                    onClick={() => {
                      handleAgentChat(selectedAgent);
                      setSelectedAgent(null);
                    }}
                    className="flex-1 bg-cyan-600 hover:bg-cyan-700 text-white px-6 py-3 rounded-lg transition-colors flex items-center justify-center space-x-2"
                  >
                    <MessageCircle className="w-5 h-5" />
                    <span>Start Chat</span>
                  </button>
                  <button
                    onClick={() => setSelectedAgent(null)}
                    className="bg-slate-700 hover:bg-slate-600 text-white px-6 py-3 rounded-lg transition-colors"
                  >
                    Close
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AgentIntegrationHub;
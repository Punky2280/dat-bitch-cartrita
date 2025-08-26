/**
 * Manual/Documentation Page - Cartrita V2
 * Complete user guide and documentation for the platform
 */
'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  DocumentTextIcon,
  ChevronRightIcon,
  ChevronDownIcon,
  BookOpenIcon,
  CommandLineIcon,
  CpuChipIcon,
  UserGroupIcon,
  ChatBubbleLeftRightIcon,
  CogIcon,
  ShieldCheckIcon,
  ChartBarIcon,
  CodeBracketIcon,
  PlayCircleIcon,
  QuestionMarkCircleIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon,
  ClipboardDocumentIcon,
  MagnifyingGlassIcon,
} from '@heroicons/react/24/outline';
import AppLayout from '@/components/layout/AppLayout';

interface Section {
  id: string;
  title: string;
  icon: React.ComponentType<any>;
  subsections: Subsection[];
}

interface Subsection {
  id: string;
  title: string;
  content: string;
  codeExample?: string;
  tips?: string[];
}

export default function ManualPage() {
  const [activeSection, setActiveSection] = useState('getting-started');
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedSections, setExpandedSections] = useState<string[]>(['getting-started']);

  const sections: Section[] = [
    {
      id: 'getting-started',
      title: 'Getting Started',
      icon: PlayCircleIcon,
      subsections: [
        {
          id: 'overview',
          title: 'Platform Overview',
          content: `Cartrita V2 is an advanced AI orchestration platform that combines multiple specialized AI agents with quantum computing integration, enterprise-grade security, and real-time analytics.

The platform features 15+ specialized agents including:
- Supervisor Agent: Master coordinator for multi-agent tasks
- Research Agent: Advanced information gathering and analysis
- Writer Agent: Professional content creation and editing
- Vision Agent: Computer vision and image analysis
- Code Writer Agent: Software development and programming
- Quantum Agent: Quantum computing and advanced mathematics
- Analytics Agent: Data analysis and business intelligence

Each agent is designed to excel in specific domains while collaborating seamlessly with others to provide comprehensive solutions.`,
          tips: [
            'Start with the Supervisor Agent for complex multi-step tasks',
            'Use specific agents for specialized work to get the best results',
            'Agents can work together automatically when needed'
          ]
        },
        {
          id: 'first-chat',
          title: 'Your First Chat',
          content: `Getting started with Cartrita V2 is simple:

1. Navigate to the Chat interface from the sidebar or dashboard
2. Select an appropriate agent from the dropdown menu
3. Type your message or question
4. Press Enter or click the send button
5. The agent will process your request and respond

The platform supports:
- Text conversations with all agents
- File uploads for analysis
- Voice input (coming soon)
- Multi-turn conversations with context retention`,
          codeExample: `// Example API usage
fetch('/api/chat', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    message: "Help me analyze this data",
    agent_id: "analytics_agent_v2",
    user_id: "user_123"
  })
});`,
          tips: [
            'Be specific in your requests for better results',
            'You can switch agents mid-conversation',
            'Use the clear chat button to start fresh conversations'
          ]
        },
        {
          id: 'navigation',
          title: 'Platform Navigation',
          content: `The Cartrita V2 interface is designed for efficiency and ease of use:

**Main Sidebar:**
- Dashboard: Overview of system status and quick actions
- AI Chat: Main conversation interface with all agents
- Agents: Detailed agent management and capabilities
- Analytics: Performance metrics and usage insights
- Workflows: Automated task orchestration
- Quantum: Quantum computing laboratory
- Vision Lab: Computer vision and image analysis tools
- Research Hub: Advanced research and knowledge tools
- API Console: Developer tools and API documentation
- Settings: Platform configuration and preferences

**Quick Access:**
- About, Manual, and License links are available in the footer
- Dark/light mode toggle in the top navigation
- System status indicators show real-time health
- Notification center for important updates`,
          tips: [
            'Use keyboard shortcuts for faster navigation',
            'The sidebar collapses on mobile for better space usage',
            'System status indicators show real-time platform health'
          ]
        }
      ]
    },
    {
      id: 'agents',
      title: 'AI Agents Guide',
      icon: UserGroupIcon,
      subsections: [
        {
          id: 'agent-types',
          title: 'Agent Specializations',
          content: `Each agent in Cartrita V2 is designed with specific capabilities and optimizations:

**Supervisor Agent (👥)**
- Multi-agent coordination and task orchestration
- Complex problem decomposition
- Strategic planning and execution
- Cross-domain knowledge synthesis
- Best for: Complex multi-step projects, coordination tasks

**Research Agent (🔍)**
- Web search and information gathering
- Data analysis and synthesis
- Market research and competitive analysis
- Academic research assistance
- Best for: Information gathering, research projects, analysis

**Writer Agent (✍️)**
- Content creation and copywriting
- Technical documentation
- Creative writing and storytelling
- Email and communication drafting
- Best for: All writing tasks, content creation, editing

**Vision Agent (👁️)**
- Image and video analysis
- OCR and text extraction
- Visual content creation
- Chart and diagram interpretation
- Best for: Image analysis, visual content, charts

**Computer Use Agent (🖥️)**
- Desktop automation and control
- System administration tasks
- File management and organization
- Application integration
- Best for: Automation, system tasks, workflows

**Code Writer Agent (💻)**
- Software development and programming
- Code review and optimization
- Architecture design
- Debugging and troubleshooting
- Best for: Programming, software development, technical tasks`,
          tips: [
            'Choose the most specialized agent for your specific task',
            'The Supervisor Agent can coordinate multiple agents automatically',
            'Each agent maintains conversation context across interactions'
          ]
        },
        {
          id: 'agent-selection',
          title: 'Choosing the Right Agent',
          content: `Selecting the appropriate agent is crucial for optimal results:

**For Content Creation:**
- Use Writer Agent for articles, blogs, marketing copy
- Use Code Writer Agent for technical documentation
- Use Vision Agent for visual content analysis

**For Analysis Tasks:**
- Use Research Agent for data gathering and market analysis
- Use Analytics Agent for business intelligence and reporting
- Use Vision Agent for image and chart analysis

**For Technical Work:**
- Use Code Writer Agent for programming and development
- Use Computer Use Agent for automation and system tasks
- Use Quantum Agent for advanced mathematical computations

**For Complex Projects:**
- Start with Supervisor Agent for project coordination
- Let it automatically engage other agents as needed
- Use for multi-step, cross-domain tasks

**Decision Matrix:**
- Simple, single-domain tasks: Use specific agent
- Multi-step tasks: Use Supervisor Agent
- Specialized knowledge: Use domain expert agent
- Automation needs: Use Computer Use Agent`,
          tips: [
            'When in doubt, start with the Supervisor Agent',
            'You can always switch agents during a conversation',
            'Each agent shows its specialization in the dropdown menu'
          ]
        },
        {
          id: 'agent-collaboration',
          title: 'Multi-Agent Collaboration',
          content: `Cartrita V2 agents are designed to work together seamlessly:

**Automatic Collaboration:**
When you use the Supervisor Agent, it can automatically:
- Analyze your request to identify required skills
- Engage appropriate specialist agents
- Coordinate their work and synthesize results
- Provide you with comprehensive solutions

**Manual Coordination:**
You can also manually coordinate agents by:
- Starting a task with one agent
- Switching to another agent for specialized work
- Using results from previous agents in new conversations
- Building complex workflows step by step

**Collaboration Patterns:**
- Research → Analysis → Writing: Complete content pipeline
- Vision → Code → Testing: Visual content to implementation
- Planning → Development → Documentation: Full project cycle
- Data → Analytics → Reporting: Business intelligence workflow

**Best Practices:**
- Provide context when switching between agents
- Use clear, specific instructions for each agent
- Review and validate outputs at each step
- Save important intermediate results`,
          tips: [
            'The Supervisor Agent handles collaboration automatically',
            'Keep context when switching between agents manually',
            'Use the chat history to track multi-agent conversations'
          ]
        }
      ]
    },
    {
      id: 'features',
      title: 'Platform Features',
      icon: CpuChipIcon,
      subsections: [
        {
          id: 'chat-features',
          title: 'Advanced Chat Features',
          content: `The chat interface includes numerous advanced features:

**Message Management:**
- Copy messages to clipboard
- Regenerate AI responses
- React to messages with emojis
- Export conversation history
- Search within conversations

**File Support:**
- Upload images for analysis
- Attach documents for processing
- Drag and drop file uploads
- Support for PDF, images, text files
- Real-time file processing updates

**Voice Features:**
- Voice input recording (beta)
- Text-to-speech for responses
- Multiple language support
- Noise cancellation

**Collaboration Tools:**
- Share conversations with team members
- Collaborative editing of prompts
- Real-time typing indicators
- Presence indicators for team chats

**Customization:**
- Dark/light theme switching
- Custom agent personas
- Adjustable response length
- Conversation templates`,
          tips: [
            'Use drag-and-drop for quick file uploads',
            'Voice input works best in quiet environments',
            'Save frequently used prompts as templates'
          ]
        },
        {
          id: 'quantum-features',
          title: 'Quantum Computing Integration',
          content: `Cartrita V2 includes cutting-edge quantum computing capabilities:

**Quantum Algorithms:**
- Quantum machine learning optimization
- Complex mathematical problem solving
- Cryptographic analysis and generation
- Optimization problem solving
- Quantum simulation capabilities

**Use Cases:**
- Portfolio optimization for finance
- Route optimization for logistics
- Drug discovery molecular simulation
- Cryptographic key generation
- Advanced pattern recognition

**Performance Benefits:**
- Exponential speedup for certain problems
- Enhanced machine learning training
- Superior optimization results
- Advanced cryptographic security
- Novel algorithm possibilities

**Access Methods:**
- Direct quantum agent interaction
- Quantum-enhanced analytics
- API access for developers
- Integration with classical algorithms
- Hybrid quantum-classical workflows

**Current Limitations:**
- Limited to specific problem types
- Requires quantum-compatible formulations
- May have longer initialization times
- Best for complex optimization problems`,
          codeExample: `// Quantum optimization example
const quantumResult = await fetch('/api/quantum/optimize', {
  method: 'POST',
  body: JSON.stringify({
    problem_type: 'portfolio_optimization',
    constraints: {...},
    objective: 'maximize_return'
  })
});`,
          tips: [
            'Quantum features work best for optimization problems',
            'Consider quantum options for complex mathematical tasks',
            'Hybrid approaches often provide the best results'
          ]
        },
        {
          id: 'analytics-features',
          title: 'Analytics and Reporting',
          content: `Comprehensive analytics provide insights into platform usage and performance:

**Usage Analytics:**
- Conversation volume and patterns
- Agent utilization statistics
- Response time metrics
- User engagement patterns
- Feature adoption rates

**Performance Metrics:**
- System uptime and reliability
- Response accuracy measurements
- Processing speed benchmarks
- Resource utilization tracking
- Error rate monitoring

**Business Intelligence:**
- Custom dashboard creation
- Automated report generation
- Data export capabilities
- Integration with BI tools
- Real-time monitoring

**Reporting Features:**
- Scheduled report delivery
- Custom metric definitions
- Historical trend analysis
- Comparative performance studies
- Predictive analytics

**Data Visualization:**
- Interactive charts and graphs
- Real-time data updates
- Multiple chart types
- Export to various formats
- Mobile-responsive displays`,
          tips: [
            'Set up automated reports for regular insights',
            'Use custom dashboards for specific metrics',
            'Export data for external analysis tools'
          ]
        }
      ]
    },
    {
      id: 'api',
      title: 'API Documentation',
      icon: CommandLineIcon,
      subsections: [
        {
          id: 'authentication',
          title: 'Authentication',
          content: `API access requires proper authentication:

**API Key Authentication:**
All API requests must include a valid API key in the header:
\`Authorization: Bearer YOUR_API_KEY\`

**Rate Limiting:**
- Free tier: 100 requests/hour
- Pro tier: 1000 requests/hour  
- Enterprise: Unlimited with fair use

**Security:**
- All requests must use HTTPS
- API keys should be kept secure
- Rotate keys regularly for security
- Use environment variables for key storage`,
          codeExample: `// Authentication example
const response = await fetch('https://api.cartrita.ai/v2/chat', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer YOUR_API_KEY',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    message: "Hello, world!",
    agent_id: "supervisor_cartrita_v2"
  })
});`,
          tips: [
            'Store API keys securely in environment variables',
            'Monitor your usage to avoid rate limits',
            'Use HTTPS for all API requests'
          ]
        },
        {
          id: 'endpoints',
          title: 'API Endpoints',
          content: `Available API endpoints for integration:

**Chat Endpoints:**
- POST /api/chat - Send message to agent
- GET /api/conversations - List conversations
- GET /api/conversations/{id} - Get specific conversation
- DELETE /api/conversations/{id} - Delete conversation

**Agent Endpoints:**
- GET /api/agents - List available agents
- GET /api/agents/{id} - Get agent details
- POST /api/agents/{id}/configure - Configure agent

**Analytics Endpoints:**
- GET /api/analytics/usage - Usage statistics
- GET /api/analytics/performance - Performance metrics
- POST /api/analytics/custom - Custom analytics query

**System Endpoints:**
- GET /api/health - System health status
- GET /api/version - API version information`,
          codeExample: `// Example API usage
// Send a message
const chatResponse = await fetch('/api/chat', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer YOUR_API_KEY',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    message: "Analyze this data for trends",
    agent_id: "analytics_agent_v2",
    user_id: "user_123",
    context: {
      conversation_id: "conv_456",
      metadata: {}
    }
  })
});

const result = await chatResponse.json();
console.log(result.content);`,
          tips: [
            'Always handle API errors gracefully',
            'Use appropriate HTTP methods for different operations',
            'Include relevant context for better responses'
          ]
        }
      ]
    },
    {
      id: 'security',
      title: 'Security & Privacy',
      icon: ShieldCheckIcon,
      subsections: [
        {
          id: 'data-protection',
          title: 'Data Protection',
          content: `Cartrita V2 implements comprehensive data protection measures:

**Encryption:**
- End-to-end encryption for all communications
- AES-256 encryption for data at rest
- TLS 1.3 for data in transit
- Zero-knowledge architecture options
- Client-side encryption capabilities

**Data Retention:**
- Configurable retention policies
- Automatic data expiration
- Secure data deletion
- Backup encryption and security
- Audit trail maintenance

**Privacy Controls:**
- Granular permission settings
- Data anonymization options
- Opt-out capabilities
- Data portability features
- Consent management

**Compliance:**
- GDPR compliance
- SOC 2 Type II certification
- ISO 27001 standards
- HIPAA compliance (Enterprise)
- Regular security audits`,
          tips: [
            'Review privacy settings regularly',
            'Use data retention policies to minimize exposure',
            'Enable two-factor authentication for added security'
          ]
        },
        {
          id: 'access-control',
          title: 'Access Control',
          content: `Advanced access control ensures secure platform usage:

**Authentication Methods:**
- Multi-factor authentication (MFA)
- Single sign-on (SSO) integration
- OAuth 2.0 / OpenID Connect
- SAML 2.0 support
- Biometric authentication

**Authorization:**
- Role-based access control (RBAC)
- Attribute-based access control (ABAC)
- Fine-grained permissions
- Dynamic access policies
- Principle of least privilege

**Session Management:**
- Secure session handling
- Automatic session expiration
- Session monitoring and alerts
- Concurrent session limits
- Device management

**Network Security:**
- IP whitelisting/blacklisting
- VPN integration
- Network isolation options
- DDoS protection
- Web application firewall (WAF)`,
          tips: [
            'Enable MFA for all admin accounts',
            'Regularly review and update access permissions',
            'Monitor session activity for unusual patterns'
          ]
        }
      ]
    },
    {
      id: 'troubleshooting',
      title: 'Troubleshooting',
      icon: ExclamationTriangleIcon,
      subsections: [
        {
          id: 'common-issues',
          title: 'Common Issues',
          content: `Solutions for frequently encountered problems:

**Chat Issues:**
- Agent not responding: Check internet connection, try refreshing
- Slow responses: Server may be under high load, try again later
- Error messages: Check browser console for details, contact support
- File upload failures: Check file size and format, ensure stable connection

**Authentication Issues:**
- Login failures: Verify credentials, check caps lock, reset password if needed
- Session expiration: Re-login, check session timeout settings
- API key errors: Verify key format, check expiration date, regenerate if needed

**Performance Issues:**
- Slow loading: Clear browser cache, check internet speed
- High memory usage: Close unnecessary tabs, restart browser
- Timeout errors: Increase timeout settings, try smaller requests

**Display Issues:**
- Layout problems: Try different browser, clear cache, disable extensions
- Dark mode issues: Check theme settings, browser compatibility
- Mobile display: Use supported mobile browsers, check responsive design`,
          tips: [
            'Clear browser cache if experiencing display issues',
            'Check system requirements for optimal performance',
            'Keep browser and platform updated to latest versions'
          ]
        },
        {
          id: 'error-codes',
          title: 'Error Codes Reference',
          content: `Complete reference for error codes and their meanings:

**4xx Client Errors:**
- 400 Bad Request: Invalid request format or parameters
- 401 Unauthorized: Authentication required or failed
- 403 Forbidden: Access denied for requested resource
- 404 Not Found: Requested resource does not exist
- 429 Too Many Requests: Rate limit exceeded

**5xx Server Errors:**
- 500 Internal Server Error: Unexpected server error
- 502 Bad Gateway: Gateway or proxy error
- 503 Service Unavailable: Server temporarily unavailable
- 504 Gateway Timeout: Request timeout from upstream server

**Custom Error Codes:**
- AI001: Agent initialization failed
- AI002: Model loading error
- AI003: Processing timeout
- AI004: Invalid agent configuration
- QC001: Quantum processor unavailable
- QC002: Quantum algorithm error
- SEC001: Security validation failed
- SEC002: Encryption error`,
          codeExample: `// Error handling example
try {
  const response = await fetch('/api/chat', {
    method: 'POST',
    body: JSON.stringify(data)
  });
  
  if (!response.ok) {
    const error = await response.json();
    console.error('Error:', error.code, error.message);
    
    // Handle specific errors
    switch(error.code) {
      case 'AI001':
        // Retry with different agent
        break;
      case '429':
        // Implement backoff strategy
        break;
      default:
        // Show generic error message
    }
  }
} catch (error) {
  console.error('Network error:', error);
}`,
          tips: [
            'Always implement proper error handling in API calls',
            'Log errors for debugging but don\'t expose sensitive information',
            'Provide user-friendly error messages'
          ]
        }
      ]
    }
  ];

  const toggleSection = (sectionId: string) => {
    setExpandedSections(prev => 
      prev.includes(sectionId) 
        ? prev.filter(id => id !== sectionId)
        : [...prev, sectionId]
    );
  };

  const filteredSections = sections.map(section => ({
    ...section,
    subsections: section.subsections.filter(subsection =>
      searchTerm === '' || 
      subsection.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      subsection.content.toLowerCase().includes(searchTerm.toLowerCase())
    )
  })).filter(section => section.subsections.length > 0);

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
  };

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col lg:flex-row gap-8">
          {/* Sidebar Navigation */}
          <div className="lg:w-80 flex-shrink-0">
            <div className="sticky top-6">
              {/* Header */}
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 mb-6">
                <div className="flex items-center mb-4">
                  <BookOpenIcon className="w-8 h-8 text-blue-600 mr-3" />
                  <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                      User Manual
                    </h1>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Complete documentation
                    </p>
                  </div>
                </div>
                
                {/* Search */}
                <div className="relative">
                  <MagnifyingGlassIcon className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Search documentation..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  />
                </div>
              </div>

              {/* Navigation */}
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
                <nav className="space-y-2">
                  {filteredSections.map((section) => (
                    <div key={section.id}>
                      <button
                        onClick={() => toggleSection(section.id)}
                        className="w-full flex items-center justify-between p-3 text-left hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg transition-colors"
                      >
                        <div className="flex items-center">
                          <section.icon className="w-5 h-5 text-gray-400 mr-3" />
                          <span className="font-medium text-gray-900 dark:text-white">
                            {section.title}
                          </span>
                        </div>
                        {expandedSections.includes(section.id) ? (
                          <ChevronDownIcon className="w-5 h-5 text-gray-400" />
                        ) : (
                          <ChevronRightIcon className="w-5 h-5 text-gray-400" />
                        )}
                      </button>
                      
                      <AnimatePresence>
                        {expandedSections.includes(section.id) && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="ml-8 mt-2 space-y-1"
                          >
                            {section.subsections.map((subsection) => (
                              <button
                                key={subsection.id}
                                onClick={() => setActiveSection(subsection.id)}
                                className={`block w-full text-left px-3 py-2 text-sm rounded-lg transition-colors ${
                                  activeSection === subsection.id
                                    ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
                                }`}
                              >
                                {subsection.title}
                              </button>
                            ))}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  ))}
                </nav>
              </div>
            </div>
          </div>

          {/* Main Content */}
          <div className="flex-1">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-8">
              {(() => {
                const activeSubsection = filteredSections
                  .flatMap(section => section.subsections)
                  .find(subsection => subsection.id === activeSection);
                
                if (!activeSubsection) {
                  return (
                    <div className="text-center py-12">
                      <QuestionMarkCircleIcon className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                      <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                        Section not found
                      </h3>
                      <p className="text-gray-600 dark:text-gray-400">
                        The requested documentation section could not be found.
                      </p>
                    </div>
                  );
                }

                return (
                  <motion.div
                    key={activeSubsection.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="prose prose-gray dark:prose-invert max-w-none"
                  >
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-6">
                      {activeSubsection.title}
                    </h1>
                    
                    <div className="whitespace-pre-line text-gray-700 dark:text-gray-300 leading-relaxed mb-8">
                      {activeSubsection.content}
                    </div>

                    {activeSubsection.codeExample && (
                      <div className="mb-8">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                          Code Example
                        </h3>
                        <div className="relative bg-gray-900 rounded-lg p-4">
                          <button
                            onClick={() => copyCode(activeSubsection.codeExample!)}
                            className="absolute top-2 right-2 p-2 text-gray-400 hover:text-white transition-colors"
                          >
                            <ClipboardDocumentIcon className="w-5 h-5" />
                          </button>
                          <pre className="text-sm text-gray-300 overflow-x-auto">
                            <code>{activeSubsection.codeExample}</code>
                          </pre>
                        </div>
                      </div>
                    )}

                    {activeSubsection.tips && activeSubsection.tips.length > 0 && (
                      <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-6">
                        <div className="flex items-center mb-3">
                          <InformationCircleIcon className="w-6 h-6 text-blue-600 dark:text-blue-400 mr-2" />
                          <h3 className="text-lg font-semibold text-blue-900 dark:text-blue-100">
                            Pro Tips
                          </h3>
                        </div>
                        <ul className="space-y-2">
                          {activeSubsection.tips.map((tip, index) => (
                            <li key={index} className="flex items-start">
                              <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 mr-3 flex-shrink-0"></div>
                              <span className="text-blue-800 dark:text-blue-200">{tip}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </motion.div>
                );
              })()}
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
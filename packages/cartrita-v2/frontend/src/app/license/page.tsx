/**
 * License Page - Cartrita V2
 * Complete licensing information and legal terms
 */
'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  DocumentTextIcon,
  ShieldCheckIcon,
  ScaleIcon,
  UserGroupIcon,
  BuildingOfficeIcon,
  CodeBracketIcon,
  GlobeAltIcon,
  InformationCircleIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
} from '@heroicons/react/24/outline';
import AppLayout from '@/components/layout/AppLayout';

interface LicenseSection {
  id: string;
  title: string;
  icon: React.ComponentType<any>;
  content: string;
  subsections?: { title: string; content: string }[];
}

export default function LicensePage() {
  const [activeTab, setActiveTab] = useState('overview');

  const licenseInfo = {
    version: 'v2.0',
    lastUpdated: '2024-01-15',
    effectiveDate: '2024-01-01',
    jurisdiction: 'United States',
    type: 'Proprietary Software License'
  };

  const tabs = [
    { id: 'overview', label: 'License Overview', icon: DocumentTextIcon },
    { id: 'terms', label: 'Terms & Conditions', icon: ScaleIcon },
    { id: 'usage', label: 'Usage Rights', icon: UserGroupIcon },
    { id: 'commercial', label: 'Commercial Use', icon: BuildingOfficeIcon },
    { id: 'technical', label: 'Technical Terms', icon: CodeBracketIcon },
    { id: 'support', label: 'Support & Updates', icon: ShieldCheckIcon },
  ];

  const sections: Record<string, LicenseSection[]> = {
    overview: [
      {
        id: 'license-overview',
        title: 'Cartrita V2 Software License Agreement',
        icon: DocumentTextIcon,
        content: `Welcome to Cartrita V2, an advanced AI orchestration platform. This License Agreement ("Agreement") governs your use of the Cartrita V2 software and services ("Software").

BY USING THIS SOFTWARE, YOU ACKNOWLEDGE THAT YOU HAVE READ, UNDERSTOOD, AND AGREE TO BE BOUND BY ALL TERMS AND CONDITIONS OF THIS AGREEMENT.

**Software Description:**
Cartrita V2 is a comprehensive AI platform featuring multiple specialized agents, quantum computing integration, and enterprise-grade capabilities for business and personal use.

**License Grant:**
Subject to the terms of this Agreement, we grant you a limited, non-exclusive, non-transferable license to use the Software in accordance with the usage tier you have selected.

**Key Terms:**
- This is a proprietary software license
- Usage is subject to tier-based limitations
- Commercial use requires appropriate licensing
- All intellectual property rights are reserved`,
        subsections: [
          {
            title: 'License Types Available',
            content: `
**Free Tier:**
- Limited to personal, non-commercial use
- 100 AI interactions per month
- Basic agent access
- Community support only
- Standard features and capabilities

**Professional Tier:**
- Commercial use permitted
- 10,000 AI interactions per month
- Full agent access including quantum capabilities
- Priority email support
- Advanced features and analytics
- API access with rate limiting

**Enterprise Tier:**
- Unlimited commercial use
- Unlimited AI interactions
- Dedicated infrastructure options
- 24/7 premium support
- Custom integrations and development
- Service level agreements (SLA)
- On-premises deployment options`
          },
          {
            title: 'Important License Information',
            content: `
**Effective Period:**
This license agreement is effective from ${licenseInfo.effectiveDate} and remains in effect until terminated according to the terms herein.

**Jurisdiction:**
This agreement is governed by the laws of ${licenseInfo.jurisdiction} without regard to conflict of law principles.

**Updates and Modifications:**
We reserve the right to modify this license agreement at any time. Users will be notified of significant changes via email and platform notifications.

**Contact Information:**
For licensing questions or enterprise inquiries, please contact our legal department at legal@cartrita.ai`
          }
        ]
      }
    ],
    terms: [
      {
        id: 'general-terms',
        title: 'General Terms and Conditions',
        icon: ScaleIcon,
        content: `These terms govern your access to and use of Cartrita V2 software and services.

**1. ACCEPTANCE OF TERMS**
By accessing or using our Software, you agree to be bound by these Terms. If you disagree with any part of these terms, you may not access the Software.

**2. USER ACCOUNTS**
- You must provide accurate, current, and complete information during registration
- You are responsible for safeguarding your account credentials
- You must notify us immediately of any unauthorized use of your account
- You may not share your account with others or use it for illegal activities

**3. PROHIBITED USES**
You may not use the Software to:
- Violate any applicable laws or regulations
- Infringe on intellectual property rights
- Transmit malicious code or harmful content
- Attempt to gain unauthorized access to our systems
- Use the service for competitive intelligence against us
- Generate content that is harmful, hateful, or discriminatory

**4. INTELLECTUAL PROPERTY**
- All content, features, and functionality are owned by us and protected by copyright, trademark, and other laws
- You may not reproduce, distribute, or create derivative works without permission
- User-generated content remains your property, but you grant us license to use it for service provision

**5. PRIVACY AND DATA PROTECTION**
- We collect and process data in accordance with our Privacy Policy
- We implement industry-standard security measures
- You retain ownership of your data and content
- We may anonymize data for analytics and service improvement`,
        subsections: [
          {
            title: 'Service Availability',
            content: `
**Uptime Commitment:**
- Free Tier: Best effort availability
- Professional Tier: 99.5% uptime SLA
- Enterprise Tier: 99.9% uptime SLA with compensation

**Maintenance and Updates:**
- Scheduled maintenance will be announced 48 hours in advance
- Emergency maintenance may be performed without notice
- Updates and new features are deployed regularly
- Backward compatibility is maintained whenever possible`
          },
          {
            title: 'Limitation of Liability',
            content: `
**Disclaimer of Warranties:**
The Software is provided "as is" without warranties of any kind, either express or implied.

**Limitation of Liability:**
In no event shall we be liable for any indirect, incidental, special, consequential, or punitive damages, including loss of profits, data, or use.

**Maximum Liability:**
Our total liability for any claims related to the Software shall not exceed the amount paid by you for the Software in the 12 months preceding the claim.`
          }
        ]
      }
    ],
    usage: [
      {
        id: 'usage-rights',
        title: 'Usage Rights and Restrictions',
        icon: UserGroupIcon,
        content: `Your rights to use Cartrita V2 depend on your license tier and compliance with these terms.

**PERMITTED USES:**

**Personal Use (All Tiers):**
- Individual productivity and learning
- Personal research and analysis
- Educational and academic purposes
- Creative and artistic projects
- Personal automation and assistance

**Professional Use (Pro & Enterprise Only):**
- Business communication and documentation
- Data analysis and business intelligence
- Client work and consulting services
- Marketing and content creation
- Process automation and optimization

**Commercial Use (Enterprise Only):**
- Integration into commercial products
- Resale or redistribution of AI-generated content
- Large-scale business operations
- Multi-user organizational deployments
- Custom enterprise integrations

**USAGE LIMITATIONS:**

**Rate Limits:**
- Free Tier: 100 interactions/month, 10 requests/hour
- Professional Tier: 10,000 interactions/month, 100 requests/hour
- Enterprise Tier: Unlimited with fair use policy

**Content Restrictions:**
- No generation of illegal or harmful content
- No impersonation or deceptive practices
- No copyright or trademark infringement
- Respect for privacy and confidentiality
- Compliance with applicable laws and regulations`,
        subsections: [
          {
            title: 'Fair Use Policy',
            content: `
**Reasonable Usage:**
Our fair use policy ensures equitable access for all users while preventing abuse.

**Guidelines:**
- Use the service for legitimate business or personal purposes
- Avoid excessive or abusive usage patterns
- Don't attempt to circumvent rate limits or technical restrictions
- Report bugs and issues through proper channels
- Respect other users and our service infrastructure

**Enforcement:**
Violations may result in temporary service restrictions, account suspension, or termination. We'll always attempt to resolve issues through communication first.`
          },
          {
            title: 'Data Rights and Ownership',
            content: `
**Your Content:**
- You retain ownership of all content you create using our Software
- You're responsible for ensuring you have rights to input data
- Generated content may incorporate your input data and prompts

**Our Rights:**
- We retain ownership of the Software and underlying technology
- We may use anonymized usage data to improve our services
- We maintain rights to our AI models and proprietary algorithms

**Confidentiality:**
- We don't share your personal data or conversations with third parties
- Enterprise customers may have additional confidentiality agreements
- Data processing follows applicable privacy laws and regulations`
          }
        ]
      }
    ],
    commercial: [
      {
        id: 'commercial-licensing',
        title: 'Commercial Use and Enterprise Licensing',
        icon: BuildingOfficeIcon,
        content: `Commercial use of Cartrita V2 requires appropriate licensing and compliance with additional terms.

**COMMERCIAL USE DEFINITION:**
Commercial use includes any activity intended to generate revenue, provide services for compensation, or support business operations.

**LICENSING REQUIREMENTS:**

**Professional Tier Commercial Rights:**
- Use in commercial environments
- Client work and consulting services
- Internal business operations
- Up to 10 team members
- Revenue generation from AI-assisted work

**Enterprise Tier Commercial Rights:**
- Unlimited commercial use
- Integration into commercial products
- Resale of AI-generated content
- White-label solutions (with agreement)
- Custom development and integrations
- Multi-tenant deployments

**ENTERPRISE FEATURES:**
- Dedicated infrastructure options
- Custom AI model training
- Advanced security and compliance
- Priority feature development
- Service level agreements
- 24/7 premium support
- On-premises deployment

**COMMERCIAL COMPLIANCE:**
- Proper attribution where required
- Compliance with industry regulations
- Data protection and privacy standards
- Intellectual property respect
- Quality assurance and testing`,
        subsections: [
          {
            title: 'Pricing and Billing',
            content: `
**Subscription Tiers:**
- Free: $0/month (personal use only)
- Professional: $99/month per user
- Enterprise: Custom pricing

**Payment Terms:**
- Monthly or annual billing cycles
- Automatic renewal unless cancelled
- Pro-rated adjustments for tier changes
- 30-day money-back guarantee
- Enterprise terms negotiated separately

**Volume Discounts:**
- 10+ users: 10% discount
- 50+ users: 20% discount
- 100+ users: 30% discount
- Custom enterprise pricing available`
          },
          {
            title: 'Service Level Agreements',
            content: `
**Professional SLA:**
- 99.5% uptime guarantee
- 24-hour response to critical issues
- Email support during business hours
- Monthly performance reports

**Enterprise SLA:**
- 99.9% uptime guarantee
- 1-hour response to critical issues
- 24/7 phone and email support
- Dedicated customer success manager
- Quarterly business reviews
- Custom SLA terms available`
          }
        ]
      }
    ],
    technical: [
      {
        id: 'technical-terms',
        title: 'Technical Terms and Integration',
        icon: CodeBracketIcon,
        content: `Technical specifications, API usage, and integration requirements for Cartrita V2.

**API ACCESS AND USAGE:**

**API Rate Limits:**
- Free Tier: 100 requests/day, 10 concurrent
- Professional: 10,000 requests/day, 50 concurrent  
- Enterprise: Unlimited with fair use, 500 concurrent

**API Key Management:**
- Secure key generation and rotation
- Scoped permissions and access control
- Usage monitoring and analytics
- Automatic key rotation options
- Audit logging for enterprise

**TECHNICAL REQUIREMENTS:**

**Supported Platforms:**
- Web browsers: Chrome 90+, Firefox 88+, Safari 14+, Edge 90+
- Mobile: iOS 14+, Android 8+ with modern browsers
- API access: Any platform supporting HTTPS/REST
- Webhooks: Secure HTTPS endpoints required

**Integration Standards:**
- RESTful API architecture
- JSON request/response format
- OAuth 2.0 / API key authentication
- Webhook support for real-time events
- SDKs available for popular languages

**SECURITY REQUIREMENTS:**
- HTTPS/TLS 1.3 for all communications
- API key secure storage requirements
- Rate limiting and abuse prevention
- Input validation and sanitization
- Regular security updates and patches`,
        subsections: [
          {
            title: 'Development Guidelines',
            content: `
**Best Practices:**
- Implement proper error handling for API calls
- Use exponential backoff for rate limit scenarios
- Cache responses when appropriate to reduce API calls
- Validate and sanitize all user inputs
- Follow security best practices for API key storage

**Code Examples:**
Our documentation includes comprehensive code examples for:
- Authentication and authorization
- Basic API interactions
- Advanced features and capabilities
- Error handling and edge cases
- Performance optimization techniques

**Testing and Development:**
- Sandbox environment available for testing
- Mock APIs for development and testing
- Comprehensive test suites and examples
- Performance benchmarking tools
- Integration testing guidelines`
          },
          {
            title: 'Data Processing and Storage',
            content: `
**Data Handling:**
- All data encrypted in transit and at rest
- Regional data storage options for compliance
- Automatic backup and disaster recovery
- Data retention policies and controls
- GDPR, CCPA, and other privacy law compliance

**Performance Specifications:**
- Average API response time: <200ms
- 99.9% API availability (Enterprise)
- Global CDN for optimal performance
- Auto-scaling infrastructure
- Real-time monitoring and alerting`
          }
        ]
      }
    ],
    support: [
      {
        id: 'support-updates',
        title: 'Support and Updates',
        icon: ShieldCheckIcon,
        content: `Comprehensive support options and software update policies for all Cartrita V2 users.

**SUPPORT TIERS:**

**Free Tier Support:**
- Community forums and documentation
- Email support (48-hour response time)
- Basic troubleshooting guides
- FAQ and knowledge base access
- Software updates and bug fixes

**Professional Tier Support:**
- Priority email support (4-hour response)
- Live chat during business hours
- Phone support for critical issues
- Advanced troubleshooting assistance
- Feature request consideration
- Monthly webinars and training

**Enterprise Tier Support:**
- 24/7 phone and email support
- Dedicated customer success manager
- 1-hour response for critical issues
- On-site support options
- Custom training and onboarding
- Direct access to engineering team
- Quarterly business reviews

**SOFTWARE UPDATES:**

**Automatic Updates:**
- Security patches applied automatically
- Minor feature updates deployed weekly
- Major version updates require opt-in
- Rollback capabilities for enterprise
- Advanced notice for breaking changes

**Update Channels:**
- Stable: Thoroughly tested updates (default)
- Beta: Early access to new features
- Alpha: Cutting-edge experimental features
- Enterprise: Custom update schedules`,
        subsections: [
          {
            title: 'Support Policies',
            content: `
**Response Time Commitments:**
- Critical issues: Enterprise 1hr, Professional 4hr, Free 48hr
- High priority: Enterprise 4hr, Professional 8hr, Free 72hr
- Medium priority: Enterprise 8hr, Professional 24hr, Free 5 days
- Low priority: Enterprise 24hr, Professional 48hr, Free 7 days

**Issue Escalation:**
Issues are automatically escalated if not resolved within:
- Critical: 2 hours
- High: 8 hours  
- Medium: 24 hours
- Low: 3 days

**Support Channels:**
- Email: support@cartrita.ai
- Phone: 1-800-CARTRITA (Enterprise)
- Live Chat: Available in application
- Community: forums.cartrita.ai
- Enterprise Portal: enterprise.cartrita.ai`
          },
          {
            title: 'Training and Resources',
            content: `
**Documentation:**
- Comprehensive user manual and API documentation
- Video tutorials and walkthrough guides
- Best practices and use case examples
- Regular updates and improvements
- Community-contributed content

**Training Options:**
- Self-paced online courses
- Live webinars and workshops  
- Custom enterprise training programs
- Certification programs (coming soon)
- Partner training and enablement

**Community Resources:**
- Active user community forums
- Regular AMAs with the development team
- User groups and meetups
- Open-source examples and templates
- Community showcase and case studies`
          }
        ]
      }
    ]
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-8 mb-8">
          <div className="flex items-center mb-6">
            <ScaleIcon className="w-10 h-10 text-blue-600 mr-4" />
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                License Agreement
              </h1>
              <p className="text-lg text-gray-600 dark:text-gray-400">
                Cartrita V2 Software License {licenseInfo.version}
              </p>
            </div>
          </div>

          {/* License Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
              <div className="flex items-center mb-2">
                <DocumentTextIcon className="w-5 h-5 text-gray-400 mr-2" />
                <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Version</span>
              </div>
              <p className="text-lg font-semibold text-gray-900 dark:text-white">
                {licenseInfo.version}
              </p>
            </div>
            <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
              <div className="flex items-center mb-2">
                <ClockIcon className="w-5 h-5 text-gray-400 mr-2" />
                <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Last Updated</span>
              </div>
              <p className="text-lg font-semibold text-gray-900 dark:text-white">
                {formatDate(licenseInfo.lastUpdated)}
              </p>
            </div>
            <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
              <div className="flex items-center mb-2">
                <CheckCircleIcon className="w-5 h-5 text-gray-400 mr-2" />
                <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Effective</span>
              </div>
              <p className="text-lg font-semibold text-gray-900 dark:text-white">
                {formatDate(licenseInfo.effectiveDate)}
              </p>
            </div>
            <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
              <div className="flex items-center mb-2">
                <GlobeAltIcon className="w-5 h-5 text-gray-400 mr-2" />
                <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Jurisdiction</span>
              </div>
              <p className="text-lg font-semibold text-gray-900 dark:text-white">
                {licenseInfo.jurisdiction}
              </p>
            </div>
          </div>

          {/* Important Notice */}
          <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
            <div className="flex items-center mb-2">
              <ExclamationTriangleIcon className="w-6 h-6 text-yellow-600 mr-2" />
              <h3 className="text-lg font-semibold text-yellow-800 dark:text-yellow-200">
                Important Legal Notice
              </h3>
            </div>
            <p className="text-yellow-800 dark:text-yellow-200">
              By using Cartrita V2, you acknowledge that you have read, understood, and agree to be bound by all terms and conditions of this License Agreement. If you do not agree to these terms, you may not use the software.
            </p>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 mb-8">
          <div className="flex overflow-x-auto">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center px-6 py-4 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                }`}
              >
                <tab.icon className="w-5 h-5 mr-2" />
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-8">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-8"
          >
            {sections[activeTab]?.map((section) => (
              <div key={section.id}>
                <div className="flex items-center mb-6">
                  <section.icon className="w-8 h-8 text-blue-600 mr-3" />
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                    {section.title}
                  </h2>
                </div>
                
                <div className="prose prose-gray dark:prose-invert max-w-none mb-8">
                  <div className="whitespace-pre-line text-gray-700 dark:text-gray-300 leading-relaxed">
                    {section.content}
                  </div>
                </div>

                {section.subsections?.map((subsection, index) => (
                  <div key={index} className="mb-8">
                    <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
                      {subsection.title}
                    </h3>
                    <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-6">
                      <div className="whitespace-pre-line text-gray-700 dark:text-gray-300 leading-relaxed">
                        {subsection.content}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </motion.div>
        </div>

        {/* Contact Information */}
        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-200 dark:border-blue-800 p-8 mt-8">
          <div className="flex items-center mb-4">
            <InformationCircleIcon className="w-8 h-8 text-blue-600 mr-3" />
            <h2 className="text-2xl font-bold text-blue-900 dark:text-blue-100">
              Legal Contact Information
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="text-lg font-semibold text-blue-900 dark:text-blue-100 mb-2">
                General Licensing Questions
              </h3>
              <p className="text-blue-800 dark:text-blue-200">
                Email: legal@cartrita.ai<br />
                Phone: 1-800-CARTRITA<br />
                Business Hours: Mon-Fri 9AM-6PM EST
              </p>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-blue-900 dark:text-blue-100 mb-2">
                Enterprise Licensing
              </h3>
              <p className="text-blue-800 dark:text-blue-200">
                Email: enterprise@cartrita.ai<br />
                Phone: 1-800-CARTRITA ext. 2<br />
                Available: 24/7 for enterprise customers
              </p>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
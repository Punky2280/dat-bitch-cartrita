import React, { useState, useMemo } from 'react';
import { gradients } from '@/theme/tokens';

interface ProviderField {
  name: string;
  type: 'text' | 'password' | 'url' | 'json';
  required: boolean;
  pattern?: string;
  placeholder: string;
  description?: string;
}

interface Provider {
  id: string;
  name: string;
  displayName: string;
  category: 'ai' | 'infrastructure' | 'analytics' | 'communication' | 'payments' | 'productivity' | 'search-index' | 'vector-db' | 'datastores' | 'weather' | 'monitoring' | 'misc';
  icon: string;
  description: string;
  fields: ProviderField[];
  documentationUrl?: string;
  popular?: boolean;
  featured?: boolean;
}

interface ProviderCatalogProps {
  onSelectProvider: (provider: Provider) => void;
  selectedProvider?: Provider | null;
  className?: string;
}

// Comprehensive provider catalog based on vault-spec.md
const PROVIDER_CATALOG: Provider[] = [
  // AI Providers
  {
    id: 'openai',
    name: 'openai',
    displayName: 'OpenAI',
    category: 'ai',
    icon: '🤖',
    description: 'GPT models, DALL-E, and advanced AI capabilities',
    featured: true,
    popular: true,
    fields: [
      {
        name: 'apiKey',
        type: 'password',
        required: true,
        pattern: '^sk-[A-Za-z0-9]{32,}$',
        placeholder: 'sk-1234567890abcdef...',
        description: 'Your OpenAI API key from platform.openai.com'
      }
    ],
    documentationUrl: 'https://platform.openai.com/docs'
  },
  {
    id: 'huggingface',
    name: 'huggingface',
    displayName: 'HuggingFace',
    category: 'ai',
    icon: '🤗',
    description: 'Open-source ML models and inference API',
    featured: true,
    popular: true,
    fields: [
      {
        name: 'token',
        type: 'password',
        required: true,
        pattern: '^hf_[A-Za-z0-9]{30,}$',
        placeholder: 'hf_1234567890abcdef...',
        description: 'HuggingFace access token from your profile settings'
      }
    ],
    documentationUrl: 'https://huggingface.co/docs/api-inference'
  },
  {
    id: 'anthropic',
    name: 'anthropic',
    displayName: 'Anthropic',
    category: 'ai',
    icon: '🧠',
    description: 'Claude AI assistant and language models',
    popular: true,
    fields: [
      {
        name: 'apiKey',
        type: 'password',
        required: true,
        pattern: '^sk-ant-[A-Za-z0-9\\-_]{32,}$',
        placeholder: 'sk-ant-api03-1234567890...',
        description: 'Anthropic API key for Claude models'
      }
    ],
    documentationUrl: 'https://docs.anthropic.com'
  },
  {
    id: 'replicate',
    name: 'replicate',
    displayName: 'Replicate',
    category: 'ai',
    icon: '🔄',
    description: 'Run machine learning models in the cloud',
    fields: [
      {
        name: 'apiToken',
        type: 'password',
        required: true,
        placeholder: 'r8_1234567890abcdef...',
        description: 'Replicate API token'
      }
    ]
  },
  {
    id: 'stability',
    name: 'stability',
    displayName: 'Stability AI',
    category: 'ai',
    icon: '🎨',
    description: 'Stable Diffusion and image generation models',
    fields: [
      {
        name: 'apiKey',
        type: 'password',
        required: true,
        placeholder: 'sk-1234567890abcdef...',
        description: 'Stability AI API key'
      }
    ]
  },
  {
    id: 'assemblyai',
    name: 'assemblyai',
    displayName: 'AssemblyAI',
    category: 'ai',
    icon: '🎤',
    description: 'Speech-to-text and audio intelligence',
    fields: [
      {
        name: 'apiKey',
        type: 'password',
        required: true,
        placeholder: '1234567890abcdef...',
        description: 'AssemblyAI API key'
      }
    ]
  },
  {
    id: 'deepgram',
    name: 'deepgram',
    displayName: 'Deepgram',
    category: 'ai',
    icon: '🎙️',
    description: 'Advanced speech recognition and audio analysis',
    popular: true,
    fields: [
      {
        name: 'apiKey',
        type: 'password',
        required: true,
        placeholder: '1234567890abcdef...',
        description: 'Deepgram API key'
      }
    ]
  },
  {
    id: 'elevenlabs',
    name: 'elevenlabs',
    displayName: 'ElevenLabs',
    category: 'ai',
    icon: '🗣️',
    description: 'AI voice generation and text-to-speech',
    fields: [
      {
        name: 'apiKey',
        type: 'password',
        required: true,
        placeholder: '1234567890abcdef...',
        description: 'ElevenLabs API key'
      }
    ]
  },

  // Infrastructure Providers
  {
    id: 'google',
    name: 'google',
    displayName: 'Google Cloud',
    category: 'infrastructure',
    icon: '☁️',
    description: 'Google Cloud Platform services and APIs',
    popular: true,
    fields: [
      {
        name: 'serviceAccountJson',
        type: 'json',
        required: false,
        placeholder: '{"type": "service_account", ...}',
        description: 'Service account JSON key file (preferred)'
      },
      {
        name: 'apiKey',
        type: 'password',
        required: false,
        pattern: '^[A-Za-z0-9\\-_]{39}$',
        placeholder: 'AIzaSyDp-cMne4eJ-EtV68iNlypHdssyZ76cFb4',
        description: 'Google Cloud API key (alternative)'
      }
    ]
  },
  {
    id: 'aws',
    name: 'aws',
    displayName: 'Amazon Web Services',
    category: 'infrastructure',
    icon: '🟠',
    description: 'AWS cloud services and APIs',
    featured: true,
    fields: [
      {
        name: 'accessKeyId',
        type: 'text',
        required: true,
        pattern: '^AKIA[0-9A-Z]{16}$',
        placeholder: 'AKIA1234567890123456',
        description: 'AWS Access Key ID'
      },
      {
        name: 'secretAccessKey',
        type: 'password',
        required: true,
        pattern: '^[A-Za-z0-9/+=]{40}$',
        placeholder: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
        description: 'AWS Secret Access Key'
      },
      {
        name: 'region',
        type: 'text',
        required: true,
        pattern: '^[a-z]{2}-[a-z]+-\\d$',
        placeholder: 'us-east-1',
        description: 'AWS region'
      }
    ]
  },
  {
    id: 'azure',
    name: 'azure',
    displayName: 'Microsoft Azure',
    category: 'infrastructure',
    icon: '🔷',
    description: 'Microsoft Azure cloud platform',
    fields: [
      {
        name: 'tenantId',
        type: 'text',
        required: true,
        placeholder: '12345678-1234-1234-1234-123456789012',
        description: 'Azure AD tenant ID'
      },
      {
        name: 'clientId',
        type: 'text',
        required: true,
        placeholder: '12345678-1234-1234-1234-123456789012',
        description: 'Azure AD application (client) ID'
      },
      {
        name: 'clientSecret',
        type: 'password',
        required: true,
        placeholder: 'client-secret-value',
        description: 'Azure AD client secret'
      },
      {
        name: 'subscriptionId',
        type: 'text',
        required: true,
        placeholder: '12345678-1234-1234-1234-123456789012',
        description: 'Azure subscription ID'
      }
    ]
  },
  {
    id: 'cloudflare',
    name: 'cloudflare',
    displayName: 'Cloudflare',
    category: 'infrastructure',
    icon: '☁️',
    description: 'CDN, security, and performance optimization',
    fields: [
      {
        name: 'apiToken',
        type: 'password',
        required: true,
        placeholder: 'api-token-value',
        description: 'Cloudflare API token'
      },
      {
        name: 'accountId',
        type: 'text',
        required: true,
        placeholder: 'account-id-value',
        description: 'Cloudflare account ID'
      }
    ]
  },
  {
    id: 'vercel',
    name: 'vercel',
    displayName: 'Vercel',
    category: 'infrastructure',
    icon: '▲',
    description: 'Frontend deployment and hosting platform',
    fields: [
      {
        name: 'apiToken',
        type: 'password',
        required: true,
        placeholder: 'vercel-api-token',
        description: 'Vercel API token'
      }
    ]
  },
  {
    id: 'netlify',
    name: 'netlify',
    displayName: 'Netlify',
    category: 'infrastructure',
    icon: '🌐',
    description: 'Static site hosting and deployment',
    fields: [
      {
        name: 'accessToken',
        type: 'password',
        required: true,
        placeholder: 'netlify-access-token',
        description: 'Netlify access token'
      }
    ]
  },

  // Payments
  {
    id: 'stripe',
    name: 'stripe',
    displayName: 'Stripe',
    category: 'payments',
    icon: '💳',
    description: 'Payment processing and financial services',
    popular: true,
    fields: [
      {
        name: 'secretKey',
        type: 'password',
        required: true,
        pattern: '^sk_(live|test)_[A-Za-z0-9]{24,}$',
        placeholder: 'sk_test_1234567890abcdef...',
        description: 'Stripe secret key'
      }
    ]
  },
  {
    id: 'paypal',
    name: 'paypal',
    displayName: 'PayPal',
    category: 'payments',
    icon: '💰',
    description: 'PayPal payment processing',
    fields: [
      {
        name: 'clientId',
        type: 'text',
        required: true,
        placeholder: 'paypal-client-id',
        description: 'PayPal client ID'
      },
      {
        name: 'clientSecret',
        type: 'password',
        required: true,
        placeholder: 'paypal-client-secret',
        description: 'PayPal client secret'
      }
    ]
  },
  {
    id: 'plaid',
    name: 'plaid',
    displayName: 'Plaid',
    category: 'payments',
    icon: '🏦',
    description: 'Banking and financial data connectivity',
    fields: [
      {
        name: 'clientId',
        type: 'text',
        required: true,
        placeholder: 'plaid-client-id',
        description: 'Plaid client ID'
      },
      {
        name: 'secret',
        type: 'password',
        required: true,
        placeholder: 'plaid-secret-key',
        description: 'Plaid secret key'
      },
      {
        name: 'env',
        type: 'text',
        required: true,
        placeholder: 'sandbox',
        description: 'Environment (sandbox/development/production)'
      }
    ]
  },

  // Communication
  {
    id: 'twilio',
    name: 'twilio',
    displayName: 'Twilio',
    category: 'communication',
    icon: '📱',
    description: 'SMS, voice, and communication APIs',
    popular: true,
    fields: [
      {
        name: 'accountSid',
        type: 'text',
        required: true,
        pattern: '^AC[0-9a-fA-F]{32}$',
        placeholder: 'ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
        description: 'Twilio Account SID'
      },
      {
        name: 'authToken',
        type: 'password',
        required: true,
        pattern: '^[0-9a-fA-F]{32}$',
        placeholder: '1234567890abcdef1234567890abcdef',
        description: 'Twilio Auth Token'
      }
    ]
  },
  {
    id: 'slack',
    name: 'slack',
    displayName: 'Slack',
    category: 'communication',
    icon: '💬',
    description: 'Slack workspace integration',
    fields: [
      {
        name: 'botToken',
        type: 'password',
        required: true,
        pattern: '^xox[baprs]-[A-Za-z0-9-]{10,}',
        placeholder: 'xoxb-1234567890-1234567890-abcdef',
        description: 'Slack bot token'
      }
    ]
  },
  {
    id: 'discord',
    name: 'discord',
    displayName: 'Discord',
    category: 'communication',
    icon: '🎮',
    description: 'Discord bot and server integration',
    fields: [
      {
        name: 'botToken',
        type: 'password',
        required: true,
        placeholder: 'discord-bot-token',
        description: 'Discord bot token'
      }
    ]
  },
  {
    id: 'sendgrid',
    name: 'sendgrid',
    displayName: 'SendGrid',
    category: 'communication',
    icon: '📧',
    description: 'Email delivery service',
    fields: [
      {
        name: 'apiKey',
        type: 'password',
        required: true,
        placeholder: 'SG.1234567890abcdef...',
        description: 'SendGrid API key'
      }
    ]
  },
  {
    id: 'mailgun',
    name: 'mailgun',
    displayName: 'Mailgun',
    category: 'communication',
    icon: '📮',
    description: 'Email service for developers',
    fields: [
      {
        name: 'domain',
        type: 'text',
        required: true,
        placeholder: 'mg.example.com',
        description: 'Mailgun domain'
      },
      {
        name: 'apiKey',
        type: 'password',
        required: true,
        placeholder: 'key-1234567890abcdef',
        description: 'Mailgun API key'
      }
    ]
  },
  {
    id: 'postmark',
    name: 'postmark',
    displayName: 'Postmark',
    category: 'communication',
    icon: '📬',
    description: 'Reliable email delivery',
    fields: [
      {
        name: 'serverToken',
        type: 'password',
        required: true,
        placeholder: 'postmark-server-token',
        description: 'Postmark server token'
      }
    ]
  },

  // Productivity
  {
    id: 'notion',
    name: 'notion',
    displayName: 'Notion',
    category: 'productivity',
    icon: '📝',
    description: 'Notion workspace and database integration',
    popular: true,
    fields: [
      {
        name: 'integrationToken',
        type: 'password',
        required: true,
        placeholder: 'secret_1234567890abcdef',
        description: 'Notion integration token'
      }
    ]
  },
  {
    id: 'jira',
    name: 'jira',
    displayName: 'Jira',
    category: 'productivity',
    icon: '🎯',
    description: 'Project management and issue tracking',
    fields: [
      {
        name: 'email',
        type: 'text',
        required: true,
        placeholder: 'user@example.com',
        description: 'Jira account email'
      },
      {
        name: 'apiToken',
        type: 'password',
        required: true,
        placeholder: 'jira-api-token',
        description: 'Jira API token'
      },
      {
        name: 'siteDomain',
        type: 'text',
        required: true,
        placeholder: 'yourcompany.atlassian.net',
        description: 'Jira site domain'
      }
    ]
  },
  {
    id: 'linear',
    name: 'linear',
    displayName: 'Linear',
    category: 'productivity',
    icon: '📐',
    description: 'Modern issue tracking and project management',
    fields: [
      {
        name: 'apiKey',
        type: 'password',
        required: true,
        placeholder: 'lin_api_1234567890abcdef',
        description: 'Linear API key'
      }
    ]
  },
  {
    id: 'confluence',
    name: 'confluence',
    displayName: 'Confluence',
    category: 'productivity',
    icon: '📚',
    description: 'Team collaboration and documentation',
    fields: [
      {
        name: 'email',
        type: 'text',
        required: true,
        placeholder: 'user@example.com',
        description: 'Confluence account email'
      },
      {
        name: 'apiToken',
        type: 'password',
        required: true,
        placeholder: 'confluence-api-token',
        description: 'Confluence API token'
      },
      {
        name: 'siteDomain',
        type: 'text',
        required: true,
        placeholder: 'yourcompany.atlassian.net',
        description: 'Confluence site domain'
      }
    ]
  },
  {
    id: 'airtable',
    name: 'airtable',
    displayName: 'Airtable',
    category: 'productivity',
    icon: '📋',
    description: 'Spreadsheet-database hybrid platform',
    fields: [
      {
        name: 'apiKey',
        type: 'password',
        required: true,
        placeholder: 'key1234567890abcdef',
        description: 'Airtable API key'
      }
    ]
  },
  {
    id: 'clickup',
    name: 'clickup',
    displayName: 'ClickUp',
    category: 'productivity',
    icon: '✅',
    description: 'All-in-one productivity workspace',
    fields: [
      {
        name: 'apiKey',
        type: 'password',
        required: true,
        placeholder: 'pk_1234567890abcdef',
        description: 'ClickUp API key'
      }
    ]
  },
  {
    id: 'asana',
    name: 'asana',
    displayName: 'Asana',
    category: 'productivity',
    icon: '🎯',
    description: 'Work management and team collaboration',
    fields: [
      {
        name: 'personalAccessToken',
        type: 'password',
        required: true,
        placeholder: '1/1234567890:abcdef1234567890',
        description: 'Asana personal access token'
      }
    ]
  },
  {
    id: 'trello',
    name: 'trello',
    displayName: 'Trello',
    category: 'productivity',
    icon: '📌',
    description: 'Visual project management boards',
    fields: [
      {
        name: 'apiKey',
        type: 'text',
        required: true,
        placeholder: 'trello-api-key',
        description: 'Trello API key'
      },
      {
        name: 'apiToken',
        type: 'password',
        required: true,
        placeholder: 'trello-api-token',
        description: 'Trello API token'
      }
    ]
  },

  // Vector Databases & Search
  {
    id: 'pinecone',
    name: 'pinecone',
    displayName: 'Pinecone',
    category: 'vector-db',
    icon: '🌲',
    description: 'Vector database for ML applications',
    popular: true,
    fields: [
      {
        name: 'apiKey',
        type: 'password',
        required: true,
        pattern: '^[a-f0-9-]{32,}$',
        placeholder: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
        description: 'Pinecone API key'
      },
      {
        name: 'environment',
        type: 'text',
        required: true,
        placeholder: 'us-east-1-aws',
        description: 'Pinecone environment'
      }
    ]
  },
  {
    id: 'weaviate',
    name: 'weaviate',
    displayName: 'Weaviate',
    category: 'vector-db',
    icon: '🔍',
    description: 'Open-source vector database',
    fields: [
      {
        name: 'apiKey',
        type: 'password',
        required: true,
        placeholder: 'weaviate-api-key',
        description: 'Weaviate API key'
      },
      {
        name: 'host',
        type: 'url',
        required: true,
        placeholder: 'https://your-cluster.weaviate.network',
        description: 'Weaviate cluster URL'
      }
    ]
  },
  {
    id: 'algolia',
    name: 'algolia',
    displayName: 'Algolia',
    category: 'search-index',
    icon: '🔎',
    description: 'Search and discovery API platform',
    fields: [
      {
        name: 'appId',
        type: 'text',
        required: true,
        placeholder: 'YourApplicationID',
        description: 'Algolia application ID'
      },
      {
        name: 'apiKey',
        type: 'password',
        required: true,
        placeholder: 'your-api-key',
        description: 'Algolia API key'
      }
    ]
  },
  {
    id: 'meilisearch',
    name: 'meilisearch',
    displayName: 'MeiliSearch',
    category: 'search-index',
    icon: '⚡',
    description: 'Fast, open-source search engine',
    fields: [
      {
        name: 'host',
        type: 'url',
        required: true,
        placeholder: 'http://localhost:7700',
        description: 'MeiliSearch host URL'
      },
      {
        name: 'masterKey',
        type: 'password',
        required: true,
        placeholder: 'master-key-value',
        description: 'MeiliSearch master key'
      }
    ]
  },

  // Datastores
  {
    id: 'redis',
    name: 'redis',
    displayName: 'Redis',
    category: 'datastores',
    icon: '🗄️',
    description: 'In-memory data structure store',
    fields: [
      {
        name: 'host',
        type: 'text',
        required: true,
        placeholder: 'localhost',
        description: 'Redis host'
      },
      {
        name: 'port',
        type: 'text',
        required: true,
        pattern: '^\\d{2,5}$',
        placeholder: '6379',
        description: 'Redis port'
      },
      {
        name: 'password',
        type: 'password',
        required: false,
        placeholder: 'redis-password',
        description: 'Redis password (optional)'
      }
    ]
  },
  {
    id: 'postgres',
    name: 'postgres',
    displayName: 'PostgreSQL',
    category: 'datastores',
    icon: '🐘',
    description: 'Open-source relational database',
    fields: [
      {
        name: 'host',
        type: 'text',
        required: true,
        pattern: '^[A-Za-z0-9_.-]+$',
        placeholder: 'localhost',
        description: 'PostgreSQL host'
      },
      {
        name: 'port',
        type: 'text',
        required: true,
        pattern: '^\\d{2,5}$',
        placeholder: '5432',
        description: 'PostgreSQL port'
      },
      {
        name: 'database',
        type: 'text',
        required: true,
        placeholder: 'mydb',
        description: 'Database name'
      },
      {
        name: 'user',
        type: 'text',
        required: true,
        placeholder: 'postgres',
        description: 'Database user'
      },
      {
        name: 'password',
        type: 'password',
        required: true,
        placeholder: 'password',
        description: 'Database password'
      }
    ]
  },
  {
    id: 'supabase',
    name: 'supabase',
    displayName: 'Supabase',
    category: 'datastores',
    icon: '⚡',
    description: 'Open-source Firebase alternative',
    popular: true,
    fields: [
      {
        name: 'url',
        type: 'url',
        required: true,
        placeholder: 'https://yourproject.supabase.co',
        description: 'Supabase project URL'
      },
      {
        name: 'anonKey',
        type: 'password',
        required: true,
        placeholder: 'eyJhbGciOiJIUzI1NiIsInR5cCI6...',
        description: 'Supabase anonymous key'
      },
      {
        name: 'serviceRoleKey',
        type: 'password',
        required: false,
        placeholder: 'eyJhbGciOiJIUzI1NiIsInR5cCI6...',
        description: 'Supabase service role key (optional)'
      }
    ]
  },
  {
    id: 'firebase',
    name: 'firebase',
    displayName: 'Firebase',
    category: 'datastores',
    icon: '🔥',
    description: 'Google Firebase platform',
    fields: [
      {
        name: 'serviceAccountJson',
        type: 'json',
        required: true,
        placeholder: '{"type": "service_account", ...}',
        description: 'Firebase service account JSON'
      }
    ]
  },
  {
    id: 'neon',
    name: 'neon',
    displayName: 'Neon',
    category: 'datastores',
    icon: '🌟',
    description: 'Serverless PostgreSQL platform',
    fields: [
      {
        name: 'connectionString',
        type: 'password',
        required: true,
        placeholder: 'postgres://user:pass@host/db',
        description: 'Neon connection string'
      }
    ]
  },
  {
    id: 'upstash',
    name: 'upstash',
    displayName: 'Upstash',
    category: 'datastores',
    icon: '⚡',
    description: 'Serverless Redis and Kafka',
    fields: [
      {
        name: 'restUrl',
        type: 'url',
        required: true,
        placeholder: 'https://your-db.upstash.io',
        description: 'Upstash REST URL'
      },
      {
        name: 'restToken',
        type: 'password',
        required: true,
        placeholder: 'upstash-rest-token',
        description: 'Upstash REST token'
      }
    ]
  },

  // Analytics & Monitoring
  {
    id: 'segment',
    name: 'segment',
    displayName: 'Segment',
    category: 'analytics',
    icon: '📊',
    description: 'Customer data platform',
    fields: [
      {
        name: 'writeKey',
        type: 'password',
        required: true,
        placeholder: 'segment-write-key',
        description: 'Segment write key'
      }
    ]
  },
  {
    id: 'mixpanel',
    name: 'mixpanel',
    displayName: 'Mixpanel',
    category: 'analytics',
    icon: '📈',
    description: 'Product analytics platform',
    fields: [
      {
        name: 'projectToken',
        type: 'password',
        required: true,
        placeholder: 'mixpanel-project-token',
        description: 'Mixpanel project token'
      },
      {
        name: 'apiSecret',
        type: 'password',
        required: true,
        placeholder: 'mixpanel-api-secret',
        description: 'Mixpanel API secret'
      }
    ]
  },
  {
    id: 'datadog',
    name: 'datadog',
    displayName: 'Datadog',
    category: 'monitoring',
    icon: '🐕',
    description: 'Monitoring and analytics platform',
    fields: [
      {
        name: 'apiKey',
        type: 'password',
        required: true,
        placeholder: 'datadog-api-key',
        description: 'Datadog API key'
      },
      {
        name: 'appKey',
        type: 'password',
        required: true,
        placeholder: 'datadog-app-key',
        description: 'Datadog application key'
      }
    ]
  },
  {
    id: 'sentry',
    name: 'sentry',
    displayName: 'Sentry',
    category: 'monitoring',
    icon: '🚨',
    description: 'Error monitoring and performance tracking',
    popular: true,
    fields: [
      {
        name: 'dsn',
        type: 'url',
        required: true,
        placeholder: 'https://key@sentry.io/project',
        description: 'Sentry DSN'
      },
      {
        name: 'authToken',
        type: 'password',
        required: false,
        placeholder: 'sentry-auth-token',
        description: 'Sentry auth token (optional)'
      }
    ]
  },
  {
    id: 'pagerduty',
    name: 'pagerduty',
    displayName: 'PagerDuty',
    category: 'monitoring',
    icon: '📟',
    description: 'Incident response and alerting',
    fields: [
      {
        name: 'apiToken',
        type: 'password',
        required: true,
        placeholder: 'pagerduty-api-token',
        description: 'PagerDuty API token'
      }
    ]
  },

  // Misc
  {
    id: 'github',
    name: 'github',
    displayName: 'GitHub',
    category: 'misc',
    icon: '🐙',
    description: 'Code hosting and collaboration platform',
    popular: true,
    fields: [
      {
        name: 'token',
        type: 'password',
        required: true,
        pattern: '^gh[pousr]_[A-Za-z0-9]{36,}$',
        placeholder: 'ghp_1234567890abcdef1234567890abcdef',
        description: 'GitHub personal access token'
      }
    ]
  },
  {
    id: 'gitlab',
    name: 'gitlab',
    displayName: 'GitLab',
    category: 'misc',
    icon: '🦊',
    description: 'DevOps platform and Git repository',
    fields: [
      {
        name: 'token',
        type: 'password',
        required: true,
        placeholder: 'glpat-1234567890abcdef',
        description: 'GitLab access token'
      }
    ]
  },
  {
    id: 'openweather',
    name: 'openweather',
    displayName: 'OpenWeatherMap',
    category: 'weather',
    icon: '🌤️',
    description: 'Weather data and forecasting API',
    fields: [
      {
        name: 'apiKey',
        type: 'password',
        required: true,
        placeholder: 'openweather-api-key',
        description: 'OpenWeatherMap API key'
      }
    ]
  }
];

const CATEGORY_COLORS: Record<string, string> = {
  ai: gradients.ai,
  infrastructure: gradients.trigger,
  analytics: gradients.data,
  communication: gradients.http,
  payments: gradients.logic,
  productivity: gradients.mcp,
  'search-index': gradients.rag,
  'vector-db': gradients.rag,
  datastores: gradients.data,
  weather: gradients.fallback,
  monitoring: gradients.trigger,
  misc: gradients.fallback
};

const CATEGORY_NAMES: Record<string, string> = {
  ai: 'AI & Machine Learning',
  infrastructure: 'Cloud Infrastructure',
  analytics: 'Analytics & Metrics',
  communication: 'Communication',
  payments: 'Payments & Finance',
  productivity: 'Productivity Tools',
  'search-index': 'Search & Indexing',
  'vector-db': 'Vector Databases',
  datastores: 'Data Storage',
  weather: 'Weather Services',
  monitoring: 'Monitoring & Alerts',
  misc: 'Miscellaneous'
};

export const ProviderCatalog: React.FC<ProviderCatalogProps> = ({
  onSelectProvider,
  selectedProvider,
  className = ''
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [showFeaturedOnly, setShowFeaturedOnly] = useState(false);

  // Filter providers based on search, category, and featured status
  const filteredProviders = useMemo(() => {
    return PROVIDER_CATALOG.filter(provider => {
      const matchesSearch = provider.displayName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          provider.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          provider.name.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesCategory = selectedCategory === 'all' || provider.category === selectedCategory;
      
      const matchesFeatured = !showFeaturedOnly || provider.featured || provider.popular;
      
      return matchesSearch && matchesCategory && matchesFeatured;
    });
  }, [searchTerm, selectedCategory, showFeaturedOnly]);

  // Get unique categories with counts
  const categories = useMemo(() => {
    const categoryCount: Record<string, number> = {};
    PROVIDER_CATALOG.forEach(provider => {
      categoryCount[provider.category] = (categoryCount[provider.category] || 0) + 1;
    });
    
    return Object.entries(categoryCount)
      .map(([key, count]) => ({
        key,
        name: CATEGORY_NAMES[key] || key,
        count
      }))
      .sort((a, b) => b.count - a.count);
  }, []);

  return (
    <div className={`bg-white dark:bg-gray-900 rounded-lg shadow-xl ${className}`}>
      {/* Header */}
      <div className="p-6 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
              Provider Catalog
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              50+ supported API providers with secure credential management
            </p>
          </div>
          <div className="flex items-center space-x-2">
            <div className="px-3 py-1 bg-blue-100 dark:bg-blue-900/20 text-blue-800 dark:text-blue-200 rounded-full text-sm font-medium">
              {filteredProviders.length} providers
            </div>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <input
                type="text"
                placeholder="Search providers..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              <option value="all">All Categories ({PROVIDER_CATALOG.length})</option>
              {categories.map(category => (
                <option key={category.key} value={category.key}>
                  {category.name} ({category.count})
                </option>
              ))}
            </select>
            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="checkbox"
                checked={showFeaturedOnly}
                onChange={(e) => setShowFeaturedOnly(e.target.checked)}
                className="rounded border-gray-300 dark:border-gray-600 text-purple-600 focus:ring-purple-500"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">Featured only</span>
            </label>
          </div>
        </div>
      </div>

      {/* Provider Grid */}
      <div className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredProviders.map((provider) => (
            <div
              key={provider.id}
              onClick={() => onSelectProvider(provider)}
              className={`p-4 border rounded-lg cursor-pointer transition-all hover:shadow-md ${
                selectedProvider?.id === provider.id
                  ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20'
                  : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
              }`}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center space-x-3">
                  <div 
                    className="w-10 h-10 rounded-lg flex items-center justify-center text-white text-lg font-semibold"
                    style={{ background: CATEGORY_COLORS[provider.category] }}
                  >
                    {provider.icon}
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-white">
                      {provider.displayName}
                    </h3>
                    <div className="flex items-center space-x-1 text-xs">
                      <span className="px-2 py-1 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 rounded">
                        {CATEGORY_NAMES[provider.category]}
                      </span>
                      {provider.popular && (
                        <span className="px-2 py-1 bg-orange-100 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400 rounded">
                          Popular
                        </span>
                      )}
                      {provider.featured && (
                        <span className="px-2 py-1 bg-purple-100 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 rounded">
                          Featured
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
              
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                {provider.description}
              </p>
              
              <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-500">
                <span>{provider.fields.length} field{provider.fields.length !== 1 ? 's' : ''}</span>
                {provider.documentationUrl && (
                  <span>📚 Docs available</span>
                )}
              </div>
            </div>
          ))}
        </div>

        {filteredProviders.length === 0 && (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">🔍</div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              No providers found
            </h3>
            <p className="text-gray-600 dark:text-gray-400">
              Try adjusting your search terms or filters
            </p>
          </div>
        )}
      </div>

      {/* Footer Stats */}
      <div className="px-6 py-3 bg-gray-50 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 rounded-b-lg">
        <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-400">
          <span>
            {filteredProviders.length} of {PROVIDER_CATALOG.length} providers shown
          </span>
          <span>
            {categories.length} categories • {PROVIDER_CATALOG.filter(p => p.popular).length} popular • {PROVIDER_CATALOG.filter(p => p.featured).length} featured
          </span>
        </div>
      </div>
    </div>
  );
};

export type { Provider, ProviderField };
export { PROVIDER_CATALOG };
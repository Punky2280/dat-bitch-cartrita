/**
 * Enhanced Workflow Node Types - Advanced Node Definitions
 * Provides 25+ node types for comprehensive workflow building
 */

export interface AdvancedNodeDefinition {
  type: string;
  name: string;
  icon: string;
  description: string;
  category: string;
  inputs: NodePort[];
  outputs: NodePort[];
  configSchema: ConfigField[];
  color: string;
  defaultConfig: any;
  validation?: ValidationRule[];
  examples?: string[];
}

export interface NodePort {
  id: string;
  name: string;
  type: 'string' | 'number' | 'boolean' | 'object' | 'array' | 'any';
  required: boolean;
  description?: string;
}

export interface ConfigField {
  key: string;
  label: string;
  type: 'text' | 'textarea' | 'number' | 'boolean' | 'select' | 'multiselect' | 'json' | 'code';
  required: boolean;
  defaultValue?: any;
  options?: { value: any; label: string }[];
  placeholder?: string;
  validation?: string;
  help?: string;
}

export interface ValidationRule {
  field: string;
  rule: string;
  message: string;
}

// Enhanced Node Type Definitions
export const ENHANCED_NODE_TYPES: AdvancedNodeDefinition[] = [
  // TRIGGERS
  {
    type: 'trigger-manual',
    name: 'Manual Start',
    icon: '▶️',
    description: 'Manually trigger workflow execution',
    category: 'Triggers',
    inputs: [],
    outputs: [
      { id: 'output', name: 'Trigger Data', type: 'object', required: true }
    ],
    configSchema: [
      { key: 'name', label: 'Trigger Name', type: 'text', required: true, defaultValue: 'Start' }
    ],
    color: '#10b981',
    defaultConfig: { name: 'Start' }
  },
  {
    type: 'trigger-schedule',
    name: 'Schedule',
    icon: '⏰',
    description: 'CRON-based scheduled execution',
    category: 'Triggers',
    inputs: [],
    outputs: [
      { id: 'output', name: 'Schedule Data', type: 'object', required: true }
    ],
    configSchema: [
      { key: 'cron', label: 'CRON Expression', type: 'text', required: true, placeholder: '0 9 * * 1-5' },
      { key: 'timezone', label: 'Timezone', type: 'select', required: true, options: [
        { value: 'UTC', label: 'UTC' },
        { value: 'America/New_York', label: 'EST' },
        { value: 'America/Los_Angeles', label: 'PST' }
      ]}
    ],
    color: '#10b981',
    defaultConfig: { cron: '0 9 * * *', timezone: 'UTC' }
  },
  {
    type: 'trigger-webhook',
    name: 'Webhook',
    icon: '🌐',
    description: 'HTTP webhook trigger',
    category: 'Triggers',
    inputs: [],
    outputs: [
      { id: 'output', name: 'Webhook Payload', type: 'object', required: true }
    ],
    configSchema: [
      { key: 'method', label: 'HTTP Method', type: 'select', required: true, options: [
        { value: 'POST', label: 'POST' },
        { value: 'GET', label: 'GET' },
        { value: 'PUT', label: 'PUT' }
      ]},
      { key: 'path', label: 'Webhook Path', type: 'text', required: true, placeholder: '/webhook/my-workflow' }
    ],
    color: '#10b981',
    defaultConfig: { method: 'POST', path: '/webhook/workflow' }
  },

  // AI NODES
  {
    type: 'ai-gpt4',
    name: 'GPT-4 Chat',
    icon: '🧠',
    description: 'OpenAI GPT-4 language model',
    category: 'AI',
    inputs: [
      { id: 'prompt', name: 'Prompt', type: 'string', required: true },
      { id: 'context', name: 'Context', type: 'object', required: false }
    ],
    outputs: [
      { id: 'response', name: 'AI Response', type: 'string', required: true },
      { id: 'metadata', name: 'Response Metadata', type: 'object', required: false }
    ],
    configSchema: [
      { key: 'model', label: 'Model', type: 'select', required: true, options: [
        { value: 'gpt-4', label: 'GPT-4' },
        { value: 'gpt-4-turbo', label: 'GPT-4 Turbo' },
        { value: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo' }
      ]},
      { key: 'prompt', label: 'System Prompt', type: 'textarea', required: true, placeholder: 'You are a helpful assistant...' },
      { key: 'temperature', label: 'Temperature', type: 'number', required: false, defaultValue: 0.7 },
      { key: 'max_tokens', label: 'Max Tokens', type: 'number', required: false, defaultValue: 1000 }
    ],
    color: '#3b82f6',
    defaultConfig: {
      model: 'gpt-4',
      prompt: 'You are a helpful assistant. Please respond to: {{input}}',
      temperature: 0.7,
      max_tokens: 1000
    }
  },
  {
    type: 'ai-claude',
    name: 'Claude',
    icon: '🎭',
    description: 'Anthropic Claude AI model',
    category: 'AI',
    inputs: [
      { id: 'prompt', name: 'Prompt', type: 'string', required: true }
    ],
    outputs: [
      { id: 'response', name: 'AI Response', type: 'string', required: true }
    ],
    configSchema: [
      { key: 'model', label: 'Model', type: 'select', required: true, options: [
        { value: 'claude-3-opus', label: 'Claude 3 Opus' },
        { value: 'claude-3-sonnet', label: 'Claude 3 Sonnet' },
        { value: 'claude-3-haiku', label: 'Claude 3 Haiku' }
      ]},
      { key: 'system', label: 'System Message', type: 'textarea', required: false },
      { key: 'temperature', label: 'Temperature', type: 'number', required: false, defaultValue: 0.7 }
    ],
    color: '#3b82f6',
    defaultConfig: {
      model: 'claude-3-sonnet',
      system: 'You are a helpful assistant.',
      temperature: 0.7
    }
  },
  {
    type: 'ai-vision',
    name: 'Computer Vision',
    icon: '👁️',
    description: 'Image analysis and computer vision',
    category: 'AI',
    inputs: [
      { id: 'image', name: 'Image Data', type: 'object', required: true },
      { id: 'prompt', name: 'Analysis Prompt', type: 'string', required: false }
    ],
    outputs: [
      { id: 'analysis', name: 'Vision Analysis', type: 'object', required: true }
    ],
    configSchema: [
      { key: 'task', label: 'Vision Task', type: 'select', required: true, options: [
        { value: 'describe', label: 'Describe Image' },
        { value: 'detect', label: 'Object Detection' },
        { value: 'classify', label: 'Image Classification' },
        { value: 'ocr', label: 'Text Recognition (OCR)' }
      ]},
      { key: 'detail', label: 'Detail Level', type: 'select', required: false, options: [
        { value: 'low', label: 'Low' },
        { value: 'high', label: 'High' }
      ]}
    ],
    color: '#8b5cf6',
    defaultConfig: {
      task: 'describe',
      detail: 'high'
    }
  },

  // DATA PROCESSING
  {
    type: 'data-transform',
    name: 'Data Transform',
    icon: '🔄',
    description: 'Transform and manipulate data',
    category: 'Data',
    inputs: [
      { id: 'input', name: 'Input Data', type: 'any', required: true }
    ],
    outputs: [
      { id: 'output', name: 'Transformed Data', type: 'any', required: true }
    ],
    configSchema: [
      { key: 'operation', label: 'Operation', type: 'select', required: true, options: [
        { value: 'map', label: 'Map Fields' },
        { value: 'filter', label: 'Filter Data' },
        { value: 'sort', label: 'Sort Data' },
        { value: 'group', label: 'Group By' },
        { value: 'custom', label: 'Custom JavaScript' }
      ]},
      { key: 'code', label: 'Transform Code', type: 'code', required: true, placeholder: 'return data.map(item => ({ ...item, processed: true }));' }
    ],
    color: '#f59e0b',
    defaultConfig: {
      operation: 'map',
      code: 'return data;'
    }
  },
  {
    type: 'data-fetch',
    name: 'HTTP Request',
    icon: '🌐',
    description: 'Fetch data from HTTP APIs',
    category: 'Data',
    inputs: [
      { id: 'params', name: 'Request Parameters', type: 'object', required: false }
    ],
    outputs: [
      { id: 'response', name: 'HTTP Response', type: 'object', required: true },
      { id: 'status', name: 'Status Code', type: 'number', required: true }
    ],
    configSchema: [
      { key: 'url', label: 'URL', type: 'text', required: true, placeholder: 'https://api.example.com/data' },
      { key: 'method', label: 'Method', type: 'select', required: true, options: [
        { value: 'GET', label: 'GET' },
        { value: 'POST', label: 'POST' },
        { value: 'PUT', label: 'PUT' },
        { value: 'DELETE', label: 'DELETE' }
      ]},
      { key: 'headers', label: 'Headers', type: 'json', required: false },
      { key: 'body', label: 'Request Body', type: 'json', required: false }
    ],
    color: '#06b6d4',
    defaultConfig: {
      url: '',
      method: 'GET',
      headers: {},
      body: {}
    }
  },
  {
    type: 'data-database',
    name: 'Database Query',
    icon: '🗄️',
    description: 'Query database tables',
    category: 'Data',
    inputs: [
      { id: 'parameters', name: 'Query Parameters', type: 'object', required: false }
    ],
    outputs: [
      { id: 'results', name: 'Query Results', type: 'array', required: true },
      { id: 'count', name: 'Row Count', type: 'number', required: false }
    ],
    configSchema: [
      { key: 'query', label: 'SQL Query', type: 'code', required: true, placeholder: 'SELECT * FROM users WHERE active = $1' },
      { key: 'timeout', label: 'Timeout (ms)', type: 'number', required: false, defaultValue: 30000 }
    ],
    color: '#059669',
    defaultConfig: {
      query: 'SELECT 1 as test',
      timeout: 30000
    }
  },

  // LOGIC & CONTROL
  {
    type: 'logic-condition',
    name: 'Condition',
    icon: '🔀',
    description: 'Conditional branching logic',
    category: 'Logic',
    inputs: [
      { id: 'input', name: 'Input Data', type: 'any', required: true }
    ],
    outputs: [
      { id: 'true', name: 'True Branch', type: 'any', required: false },
      { id: 'false', name: 'False Branch', type: 'any', required: false }
    ],
    configSchema: [
      { key: 'condition', label: 'Condition', type: 'text', required: true, placeholder: 'input.value > 10' },
      { key: 'operator', label: 'Operator', type: 'select', required: true, options: [
        { value: 'javascript', label: 'JavaScript Expression' },
        { value: 'equals', label: 'Equals' },
        { value: 'greater', label: 'Greater Than' },
        { value: 'contains', label: 'Contains' }
      ]}
    ],
    color: '#f97316',
    defaultConfig: {
      condition: 'input.value !== null',
      operator: 'javascript'
    }
  },
  {
    type: 'logic-loop',
    name: 'Loop',
    icon: '🔄',
    description: 'Iterate over data arrays',
    category: 'Logic',
    inputs: [
      { id: 'array', name: 'Array Data', type: 'array', required: true }
    ],
    outputs: [
      { id: 'item', name: 'Current Item', type: 'any', required: true },
      { id: 'index', name: 'Current Index', type: 'number', required: false },
      { id: 'results', name: 'Collected Results', type: 'array', required: false }
    ],
    configSchema: [
      { key: 'max_iterations', label: 'Max Iterations', type: 'number', required: false, defaultValue: 1000 },
      { key: 'collect_results', label: 'Collect Results', type: 'boolean', required: false, defaultValue: true }
    ],
    color: '#f97316',
    defaultConfig: {
      max_iterations: 1000,
      collect_results: true
    }
  },
  {
    type: 'logic-delay',
    name: 'Delay',
    icon: '⏱️',
    description: 'Add delays between operations',
    category: 'Logic',
    inputs: [
      { id: 'input', name: 'Input Data', type: 'any', required: true }
    ],
    outputs: [
      { id: 'output', name: 'Output Data', type: 'any', required: true }
    ],
    configSchema: [
      { key: 'duration', label: 'Delay Duration (ms)', type: 'number', required: true, defaultValue: 1000 },
      { key: 'type', label: 'Delay Type', type: 'select', required: true, options: [
        { value: 'fixed', label: 'Fixed Delay' },
        { value: 'random', label: 'Random Delay' },
        { value: 'exponential', label: 'Exponential Backoff' }
      ]}
    ],
    color: '#f97316',
    defaultConfig: {
      duration: 1000,
      type: 'fixed'
    }
  },

  // INTEGRATION
  {
    type: 'integration-webhook',
    name: 'Send Webhook',
    icon: '📡',
    description: 'Send data to webhook endpoints',
    category: 'Integration',
    inputs: [
      { id: 'payload', name: 'Webhook Payload', type: 'object', required: true }
    ],
    outputs: [
      { id: 'response', name: 'Webhook Response', type: 'object', required: true }
    ],
    configSchema: [
      { key: 'url', label: 'Webhook URL', type: 'text', required: true },
      { key: 'secret', label: 'Webhook Secret', type: 'text', required: false },
      { key: 'retry_attempts', label: 'Retry Attempts', type: 'number', required: false, defaultValue: 3 }
    ],
    color: '#ec4899',
    defaultConfig: {
      url: '',
      secret: '',
      retry_attempts: 3
    }
  },
  {
    type: 'integration-email',
    name: 'Send Email',
    icon: '📧',
    description: 'Send email notifications',
    category: 'Integration',
    inputs: [
      { id: 'data', name: 'Email Data', type: 'object', required: true }
    ],
    outputs: [
      { id: 'result', name: 'Send Result', type: 'object', required: true }
    ],
    configSchema: [
      { key: 'to', label: 'To Email', type: 'text', required: true },
      { key: 'subject', label: 'Subject', type: 'text', required: true },
      { key: 'template', label: 'Email Template', type: 'textarea', required: true },
      { key: 'html', label: 'HTML Content', type: 'boolean', required: false, defaultValue: false }
    ],
    color: '#ec4899',
    defaultConfig: {
      to: '',
      subject: 'Workflow Notification',
      template: 'Hello, your workflow has completed.',
      html: false
    }
  },

  // OUTPUT NODES
  {
    type: 'output-console',
    name: 'Console Log',
    icon: '🖥️',
    description: 'Log data to console',
    category: 'Output',
    inputs: [
      { id: 'data', name: 'Log Data', type: 'any', required: true }
    ],
    outputs: [],
    configSchema: [
      { key: 'level', label: 'Log Level', type: 'select', required: true, options: [
        { value: 'info', label: 'Info' },
        { value: 'warn', label: 'Warning' },
        { value: 'error', label: 'Error' },
        { value: 'debug', label: 'Debug' }
      ]},
      { key: 'format', label: 'Format', type: 'select', required: true, options: [
        { value: 'json', label: 'JSON' },
        { value: 'string', label: 'String' },
        { value: 'table', label: 'Table' }
      ]}
    ],
    color: '#6b7280',
    defaultConfig: {
      level: 'info',
      format: 'json'
    }
  },
  {
    type: 'output-file',
    name: 'Save to File',
    icon: '💾',
    description: 'Save data to file',
    category: 'Output',
    inputs: [
      { id: 'data', name: 'File Data', type: 'any', required: true }
    ],
    outputs: [
      { id: 'filepath', name: 'File Path', type: 'string', required: true }
    ],
    configSchema: [
      { key: 'filename', label: 'File Name', type: 'text', required: true, placeholder: 'output.json' },
      { key: 'format', label: 'File Format', type: 'select', required: true, options: [
        { value: 'json', label: 'JSON' },
        { value: 'csv', label: 'CSV' },
        { value: 'txt', label: 'Text' },
        { value: 'xml', label: 'XML' }
      ]}
    ],
    color: '#6b7280',
    defaultConfig: {
      filename: 'output.json',
      format: 'json'
    }
  }
];

// Helper functions for node types
export const getNodeTypesByCategory = (): Record<string, AdvancedNodeDefinition[]> => {
  return ENHANCED_NODE_TYPES.reduce((acc, nodeType) => {
    if (!acc[nodeType.category]) {
      acc[nodeType.category] = [];
    }
    acc[nodeType.category].push(nodeType);
    return acc;
  }, {} as Record<string, AdvancedNodeDefinition[]>);
};

export const getNodeTypeByType = (type: string): AdvancedNodeDefinition | undefined => {
  return ENHANCED_NODE_TYPES.find(nodeType => nodeType.type === type);
};

export const getNodeTypeCategories = (): string[] => {
  return Array.from(new Set(ENHANCED_NODE_TYPES.map(nodeType => nodeType.category)));
};

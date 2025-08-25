/**
 * Workflow Node Registry - Complete N8N-style Node System
 *
 * Provides comprehensive node definitions and capabilities similar to N8N
 * with full dynamic node registration, validation, and execution
 */

class WorkflowNodeRegistry {
  constructor() {
    this.nodes = new Map();
    this.categories = new Map();
    this.triggers = new Map();

    this.initializeAllNodes();
    console.log(
      '[WorkflowNodeRegistry] 🎯 Comprehensive node registry initialized'
    );
  }

  /**
   * Initialize all available nodes (N8N-style comprehensive coverage)
   */
  initializeAllNodes() {
    // TRIGGER NODES
    this.registerTriggerNodes();

    // AI & ML NODES
    this.registerAINodes();

    // DATA PROCESSING NODES
    this.registerDataNodes();

    // INTEGRATION NODES
    this.registerIntegrationNodes();

    // COMMUNICATION NODES
    this.registerCommunicationNodes();

    // FILE & STORAGE NODES
    this.registerFileNodes();

    // DATABASE NODES
    this.registerDatabaseNodes();

    // LOGIC & FLOW CONTROL NODES
    this.registerLogicNodes();

    // UTILITY NODES
    this.registerUtilityNodes();

    // CUSTOM CARTRITA NODES
    this.registerCartritaNodes();

    console.log(
      `[WorkflowNodeRegistry] ✅ Registered ${this.nodes.size} nodes across ${this.categories.size} categories`
    );
  }

  /**
   * Register trigger nodes
   */
  registerTriggerNodes() {
    const triggerCategory = 'Triggers';

    this.registerNode({
      type: 'manual-trigger',
      displayName: 'Manual Trigger',
      name: 'manualTrigger',
      group: ['trigger'],
      version: 1,
      description: 'Manually trigger workflow execution',
      category: triggerCategory,
      defaults: {
        name: 'Manual Trigger',
        color: '#00bb88',
      },
      inputs: [],
      outputs: ['main'],
      properties: [
        {
          displayName: 'This node will be triggered manually',
          name: 'notice',
          type: 'notice',
          default: '',
        },
      ],
    });

    this.registerNode({
      type: 'webhook-trigger',
      displayName: 'Webhook',
      name: 'webhook',
      group: ['trigger'],
      version: 1,
      description:
        'Receives data when HTTP requests are made to the webhook URL',
      category: triggerCategory,
      defaults: {
        name: 'Webhook',
        color: '#00bb88',
      },
      inputs: [],
      outputs: ['main'],
      webhooks: [
        {
          name: 'default',
          httpMethod: 'POST',
          responseMode: 'onReceived',
          path: 'webhook',
        },
      ],
      properties: [
        {
          displayName: 'HTTP Method',
          name: 'httpMethod',
          type: 'options',
          options: [
            { name: 'GET', value: 'GET' },
            { name: 'POST', value: 'POST' },
            { name: 'PUT', value: 'PUT' },
            { name: 'PATCH', value: 'PATCH' },
            { name: 'DELETE', value: 'DELETE' },
          ],
          default: 'POST',
        },
        {
          displayName: 'Path',
          name: 'path',
          type: 'string',
          default: 'webhook',
          description: 'The path to listen on',
        },
      ],
    });

    this.registerNode({
      type: 'schedule-trigger',
      displayName: 'Schedule Trigger',
      name: 'scheduleTrigger',
      group: ['trigger'],
      version: 1,
      description: 'Triggers the workflow on a schedule',
      category: triggerCategory,
      defaults: {
        name: 'Schedule Trigger',
        color: '#00bb88',
      },
      inputs: [],
      outputs: ['main'],
      properties: [
        {
          displayName: 'Trigger Interval',
          name: 'triggerInterval',
          type: 'options',
          options: [
            { name: 'Seconds', value: 'seconds' },
            { name: 'Minutes', value: 'minutes' },
            { name: 'Hours', value: 'hours' },
            { name: 'Days', value: 'days' },
            { name: 'Weeks', value: 'weeks' },
            { name: 'Custom Cron', value: 'custom' },
          ],
          default: 'hours',
        },
        {
          displayName: 'Interval Value',
          name: 'interval',
          type: 'number',
          default: 1,
          displayOptions: {
            hide: { triggerInterval: ['custom'] },
          },
        },
        {
          displayName: 'Cron Expression',
          name: 'cronExpression',
          type: 'string',
          default: '0 0 * * *',
          displayOptions: {
            show: { triggerInterval: ['custom'] },
          },
        },
      ],
    });
  }

  /**
   * Register AI and ML nodes
   */
  registerAINodes() {
    const aiCategory = 'AI & Machine Learning';

    this.registerNode({
      type: 'openai-gpt',
      displayName: 'OpenAI GPT',
      name: 'openaiGpt',
      group: ['ai'],
      version: 1,
      description: 'Interact with OpenAI GPT models',
      category: aiCategory,
      defaults: {
        name: 'OpenAI GPT',
        color: '#10a37f',
      },
      inputs: ['main'],
      outputs: ['main'],
      properties: [
        {
          displayName: 'Model',
          name: 'model',
          type: 'options',
          options: [
            { name: 'GPT-4o', value: 'gpt-4o' },
            { name: 'GPT-4', value: 'gpt-4' },
            { name: 'GPT-3.5 Turbo', value: 'gpt-3.5-turbo' },
          ],
          default: 'gpt-4o',
        },
        {
          displayName: 'Prompt',
          name: 'prompt',
          type: 'string',
          typeOptions: { rows: 4 },
          default: '',
          description: 'The prompt to send to GPT',
        },
        {
          displayName: 'Temperature',
          name: 'temperature',
          type: 'number',
          default: 0.7,
          typeOptions: { minValue: 0, maxValue: 2, numberPrecision: 1 },
        },
        {
          displayName: 'Max Tokens',
          name: 'maxTokens',
          type: 'number',
          default: 1000,
          typeOptions: { minValue: 1, maxValue: 4000 },
        },
      ],
    });

    this.registerNode({
      type: 'dall-e',
      displayName: 'DALL-E Image Generation',
      name: 'dallE',
      group: ['ai'],
      version: 1,
      description: 'Generate images using DALL-E',
      category: aiCategory,
      defaults: {
        name: 'DALL-E',
        color: '#10a37f',
      },
      inputs: ['main'],
      outputs: ['main'],
      properties: [
        {
          displayName: 'Prompt',
          name: 'prompt',
          type: 'string',
          typeOptions: { rows: 3 },
          default: '',
          description: 'Description of the image to generate',
        },
        {
          displayName: 'Model',
          name: 'model',
          type: 'options',
          options: [
            { name: 'DALL-E 3', value: 'dall-e-3' },
            { name: 'DALL-E 2', value: 'dall-e-2' },
          ],
          default: 'dall-e-3',
        },
        {
          displayName: 'Size',
          name: 'size',
          type: 'options',
          options: [
            { name: '256x256', value: '256x256' },
            { name: '512x512', value: '512x512' },
            { name: '1024x1024', value: '1024x1024' },
            { name: '1024x1792', value: '1024x1792' },
            { name: '1792x1024', value: '1792x1024' },
          ],
          default: '1024x1024',
        },
      ],
    });

    this.registerNode({
      type: 'whisper-transcription',
      displayName: 'Whisper Transcription',
      name: 'whisperTranscription',
      group: ['ai'],
      version: 1,
      description: 'Transcribe audio using OpenAI Whisper',
      category: aiCategory,
      defaults: {
        name: 'Whisper',
        color: '#10a37f',
      },
      inputs: ['main'],
      outputs: ['main'],
      properties: [
        {
          displayName: 'Audio File',
          name: 'audioFile',
          type: 'string',
          default: '',
          description: 'Path or URL to audio file',
        },
        {
          displayName: 'Language',
          name: 'language',
          type: 'string',
          default: '',
          description: 'Language code (optional)',
        },
      ],
    });
  }

  /**
   * Register data processing nodes
   */
  registerDataNodes() {
    const dataCategory = 'Data';

    this.registerNode({
      type: 'json-processor',
      displayName: 'JSON',
      name: 'json',
      group: ['data'],
      version: 1,
      description: 'Process JSON data',
      category: dataCategory,
      defaults: {
        name: 'JSON',
        color: '#7aa3eb',
      },
      inputs: ['main'],
      outputs: ['main'],
      properties: [
        {
          displayName: 'Operation',
          name: 'operation',
          type: 'options',
          options: [
            { name: 'Parse', value: 'parse' },
            { name: 'Stringify', value: 'stringify' },
            { name: 'Extract', value: 'extract' },
            { name: 'Transform', value: 'transform' },
          ],
          default: 'parse',
        },
        {
          displayName: 'JSON Path',
          name: 'jsonPath',
          type: 'string',
          default: '',
          displayOptions: {
            show: { operation: ['extract'] },
          },
        },
      ],
    });

    this.registerNode({
      type: 'data-transformation',
      displayName: 'Set',
      name: 'set',
      group: ['data'],
      version: 1,
      description: 'Set values on items and optionally remove other values',
      category: dataCategory,
      defaults: {
        name: 'Set',
        color: '#0000FF',
      },
      inputs: ['main'],
      outputs: ['main'],
      properties: [
        {
          displayName: 'Keep Only Set',
          name: 'keepOnlySet',
          type: 'boolean',
          default: false,
          description:
            'If only the values set on this node should be kept and all others removed',
        },
        {
          displayName: 'Values to Set',
          name: 'values',
          placeholder: 'Add Value',
          type: 'fixedCollection',
          typeOptions: {
            multipleValues: true,
            sortable: true,
          },
          description: 'The values to set',
          default: {},
          options: [
            {
              name: 'values',
              displayName: 'Values',
              values: [
                {
                  displayName: 'Name',
                  name: 'name',
                  type: 'string',
                  default: '',
                  description: 'Name of the property to write data to',
                },
                {
                  displayName: 'Type',
                  name: 'type',
                  type: 'options',
                  options: [
                    { name: 'String', value: 'string' },
                    { name: 'Number', value: 'number' },
                    { name: 'Boolean', value: 'boolean' },
                    { name: 'Array', value: 'array' },
                    { name: 'Object', value: 'object' },
                  ],
                  default: 'string',
                },
                {
                  displayName: 'Value',
                  name: 'value',
                  type: 'string',
                  default: '',
                },
              ],
            },
          ],
        },
      ],
    });

    this.registerNode({
      type: 'split-merge',
      displayName: 'Split In Batches',
      name: 'splitInBatches',
      group: ['data'],
      version: 1,
      description:
        'Split data into batches and process each batch individually',
      category: dataCategory,
      defaults: {
        name: 'Split In Batches',
        color: '#007755',
      },
      inputs: ['main'],
      outputs: ['main'],
      properties: [
        {
          displayName: 'Batch Size',
          name: 'batchSize',
          type: 'number',
          default: 10,
          description: 'Number of items to process in each batch',
        },
        {
          displayName: 'Options',
          name: 'options',
          type: 'collection',
          placeholder: 'Add Option',
          default: {},
          options: [
            {
              displayName: 'Reset',
              name: 'reset',
              type: 'boolean',
              default: false,
              description: 'Resets the batch size after it was processed',
            },
          ],
        },
      ],
    });
  }

  /**
   * Register integration nodes
   */
  registerIntegrationNodes() {
    const integrationCategory = 'Integration';

    this.registerNode({
      type: 'http-request',
      displayName: 'HTTP Request',
      name: 'httpRequest',
      group: ['integration'],
      version: 1,
      description: 'Makes HTTP requests and returns the response data',
      category: integrationCategory,
      defaults: {
        name: 'HTTP Request',
        color: '#0000FF',
      },
      inputs: ['main'],
      outputs: ['main'],
      properties: [
        {
          displayName: 'Request Method',
          name: 'method',
          type: 'options',
          options: [
            { name: 'DELETE', value: 'DELETE' },
            { name: 'GET', value: 'GET' },
            { name: 'HEAD', value: 'HEAD' },
            { name: 'PATCH', value: 'PATCH' },
            { name: 'POST', value: 'POST' },
            { name: 'PUT', value: 'PUT' },
          ],
          default: 'GET',
        },
        {
          displayName: 'URL',
          name: 'url',
          type: 'string',
          default: '',
          description: 'The URL to make the request to',
          required: true,
        },
        {
          displayName: 'Authentication',
          name: 'authentication',
          type: 'options',
          options: [
            { name: 'None', value: 'none' },
            { name: 'Basic Auth', value: 'basicAuth' },
            { name: 'Header Auth', value: 'headerAuth' },
            { name: 'OAuth1', value: 'oAuth1Api' },
            { name: 'OAuth2', value: 'oAuth2Api' },
          ],
          default: 'none',
        },
        {
          displayName: 'Send Query Parameters',
          name: 'sendQuery',
          type: 'boolean',
          default: false,
          description: 'Whether query parameters should be sent',
        },
        {
          displayName: 'Send Headers',
          name: 'sendHeaders',
          type: 'boolean',
          default: false,
          description: 'Whether headers should be sent',
        },
        {
          displayName: 'Send Body',
          name: 'sendBody',
          type: 'boolean',
          default: false,
          displayOptions: {
            show: {
              method: ['PATCH', 'POST', 'PUT'],
            },
          },
          description: 'Whether body should be sent',
        },
      ],
    });

    this.registerNode({
      type: 'ftp-node',
      displayName: 'FTP',
      name: 'ftp',
      group: ['integration'],
      version: 1,
      description: 'Transfers files via FTP or SFTP',
      category: integrationCategory,
      defaults: {
        name: 'FTP',
        color: '#303050',
      },
      inputs: ['main'],
      outputs: ['main'],
      properties: [
        {
          displayName: 'Protocol',
          name: 'protocol',
          type: 'options',
          options: [
            { name: 'FTP', value: 'ftp' },
            { name: 'SFTP', value: 'sftp' },
          ],
          default: 'ftp',
        },
        {
          displayName: 'Operation',
          name: 'operation',
          type: 'options',
          options: [
            { name: 'Delete', value: 'delete' },
            { name: 'Download', value: 'download' },
            { name: 'List', value: 'list' },
            { name: 'Rename', value: 'rename' },
            { name: 'Upload', value: 'upload' },
          ],
          default: 'download',
        },
      ],
    });
  }

  /**
   * Register communication nodes
   */
  registerCommunicationNodes() {
    const commCategory = 'Communication';

    this.registerNode({
      type: 'email-send',
      displayName: 'Send Email',
      name: 'emailSend',
      group: ['communication'],
      version: 1,
      description: 'Sends an email using SMTP',
      category: commCategory,
      defaults: {
        name: 'Send Email',
        color: '#00bb88',
      },
      inputs: ['main'],
      outputs: ['main'],
      properties: [
        {
          displayName: 'From Email',
          name: 'fromEmail',
          type: 'string',
          default: '',
          description: 'Email address of the sender',
        },
        {
          displayName: 'To Email',
          name: 'toEmail',
          type: 'string',
          default: '',
          description: 'Email addresses of recipients',
        },
        {
          displayName: 'Subject',
          name: 'subject',
          type: 'string',
          default: '',
          description: 'Subject line of the email',
        },
        {
          displayName: 'Message Type',
          name: 'messageType',
          type: 'options',
          options: [
            { name: 'Text', value: 'text' },
            { name: 'HTML', value: 'html' },
          ],
          default: 'html',
        },
        {
          displayName: 'Message',
          name: 'message',
          type: 'string',
          typeOptions: { rows: 5 },
          default: '',
          description: 'Message content',
        },
      ],
    });

    this.registerNode({
      type: 'slack-node',
      displayName: 'Slack',
      name: 'slack',
      group: ['communication'],
      version: 1,
      description: 'Consume Slack API',
      category: commCategory,
      defaults: {
        name: 'Slack',
        color: '#bb2244',
      },
      inputs: ['main'],
      outputs: ['main'],
      properties: [
        {
          displayName: 'Resource',
          name: 'resource',
          type: 'options',
          options: [
            { name: 'Channel', value: 'channel' },
            { name: 'Message', value: 'message' },
            { name: 'User', value: 'user' },
          ],
          default: 'message',
        },
        {
          displayName: 'Operation',
          name: 'operation',
          type: 'options',
          options: [
            { name: 'Post', value: 'post' },
            { name: 'Get', value: 'get' },
            { name: 'Update', value: 'update' },
            { name: 'Delete', value: 'delete' },
          ],
          default: 'post',
        },
      ],
    });
  }

  /**
   * Register file and storage nodes
   */
  registerFileNodes() {
    const fileCategory = 'Files & Storage';

    this.registerNode({
      type: 'read-write-file',
      displayName: 'Read/Write Files',
      name: 'readWriteFile',
      group: ['files'],
      version: 1,
      description: 'Reads and writes data from/to files',
      category: fileCategory,
      defaults: {
        name: 'Read/Write Files',
        color: '#44AA44',
      },
      inputs: ['main'],
      outputs: ['main'],
      properties: [
        {
          displayName: 'Operation',
          name: 'operation',
          type: 'options',
          options: [
            { name: 'Read from file', value: 'read' },
            { name: 'Write to file', value: 'write' },
          ],
          default: 'read',
        },
        {
          displayName: 'File Path',
          name: 'filePath',
          type: 'string',
          default: '',
          description: 'Path of the file to read/write',
        },
        {
          displayName: 'File Format',
          name: 'fileFormat',
          type: 'options',
          options: [
            { name: 'Auto Detect', value: 'autodetect' },
            { name: 'CSV', value: 'csv' },
            { name: 'JSON', value: 'json' },
            { name: 'Plain Text', value: 'text' },
            { name: 'XML', value: 'xml' },
          ],
          default: 'autodetect',
        },
      ],
    });

    this.registerNode({
      type: 'compress',
      displayName: 'Compression',
      name: 'compression',
      group: ['files'],
      version: 1,
      description: 'Compress or decompress files',
      category: fileCategory,
      defaults: {
        name: 'Compression',
        color: '#408000',
      },
      inputs: ['main'],
      outputs: ['main'],
      properties: [
        {
          displayName: 'Operation',
          name: 'operation',
          type: 'options',
          options: [
            { name: 'Compress', value: 'compress' },
            { name: 'Decompress', value: 'decompress' },
          ],
          default: 'compress',
        },
        {
          displayName: 'Format',
          name: 'format',
          type: 'options',
          options: [
            { name: 'ZIP', value: 'zip' },
            { name: 'GZIP', value: 'gzip' },
            { name: 'TAR', value: 'tar' },
          ],
          default: 'zip',
        },
      ],
    });
  }

  /**
   * Register database nodes
   */
  registerDatabaseNodes() {
    const dbCategory = 'Database';

    this.registerNode({
      type: 'postgres',
      displayName: 'Postgres',
      name: 'postgres',
      group: ['database'],
      version: 1,
      description: 'Get, add and update data in Postgres',
      category: dbCategory,
      defaults: {
        name: 'Postgres',
        color: '#014786',
      },
      inputs: ['main'],
      outputs: ['main'],
      properties: [
        {
          displayName: 'Operation',
          name: 'operation',
          type: 'options',
          options: [
            { name: 'Execute Query', value: 'executeQuery' },
            { name: 'Insert', value: 'insert' },
            { name: 'Update', value: 'update' },
            { name: 'Delete', value: 'delete' },
            { name: 'Select', value: 'select' },
          ],
          default: 'executeQuery',
        },
        {
          displayName: 'Query',
          name: 'query',
          type: 'string',
          typeOptions: { rows: 3 },
          default: '',
          description: 'SQL query to execute',
        },
      ],
    });

    this.registerNode({
      type: 'redis',
      displayName: 'Redis',
      name: 'redis',
      group: ['database'],
      version: 1,
      description: 'Get, send and update data in Redis',
      category: dbCategory,
      defaults: {
        name: 'Redis',
        color: '#725242',
      },
      inputs: ['main'],
      outputs: ['main'],
      properties: [
        {
          displayName: 'Operation',
          name: 'operation',
          type: 'options',
          options: [
            { name: 'Delete', value: 'delete' },
            { name: 'Get', value: 'get' },
            { name: 'Keys', value: 'keys' },
            { name: 'Set', value: 'set' },
            { name: 'Publish', value: 'publish' },
            { name: 'Push/Pop', value: 'pushPop' },
          ],
          default: 'get',
        },
      ],
    });
  }

  /**
   * Register logic and flow control nodes
   */
  registerLogicNodes() {
    const logicCategory = 'Logic';

    this.registerNode({
      type: 'if-condition',
      displayName: 'IF',
      name: 'if',
      group: ['logic'],
      version: 1,
      description: 'Route items based on logic conditions',
      category: logicCategory,
      defaults: {
        name: 'IF',
        color: '#408000',
      },
      inputs: ['main'],
      outputs: ['main', 'main'],
      outputNames: ['true', 'false'],
      properties: [
        {
          displayName: 'Conditions',
          name: 'conditions',
          placeholder: 'Add Condition',
          type: 'fixedCollection',
          typeOptions: {
            multipleValues: true,
          },
          default: {},
          options: [
            {
              name: 'conditions',
              displayName: 'Conditions',
              values: [
                {
                  displayName: 'Value 1',
                  name: 'value1',
                  type: 'string',
                  default: '',
                },
                {
                  displayName: 'Operation',
                  name: 'operation',
                  type: 'options',
                  options: [
                    { name: 'Equal', value: 'equal' },
                    { name: 'Not Equal', value: 'notEqual' },
                    { name: 'Larger', value: 'larger' },
                    { name: 'Smaller', value: 'smaller' },
                    { name: 'Contains', value: 'contains' },
                    { name: 'Starts With', value: 'startsWith' },
                    { name: 'Ends With', value: 'endsWith' },
                    { name: 'Regex', value: 'regex' },
                  ],
                  default: 'equal',
                },
                {
                  displayName: 'Value 2',
                  name: 'value2',
                  type: 'string',
                  default: '',
                },
              ],
            },
          ],
        },
        {
          displayName: 'Combine',
          name: 'combineOperation',
          type: 'options',
          options: [
            { name: 'ALL', value: 'all' },
            { name: 'ANY', value: 'any' },
          ],
          default: 'all',
          description: 'If multiple conditions are defined how to combine them',
        },
      ],
    });

    this.registerNode({
      type: 'switch',
      displayName: 'Switch',
      name: 'switch',
      group: ['logic'],
      version: 1,
      description: 'Route items based on rules to different outputs',
      category: logicCategory,
      defaults: {
        name: 'Switch',
        color: '#506000',
      },
      inputs: ['main'],
      outputs: ['main', 'main', 'main', 'main'],
      outputNames: ['0', '1', '2', '3'],
      properties: [
        {
          displayName: 'Mode',
          name: 'mode',
          type: 'options',
          options: [
            { name: 'Expression', value: 'expression' },
            { name: 'Rules', value: 'rules' },
          ],
          default: 'rules',
        },
        {
          displayName: 'Output',
          name: 'output',
          type: 'options',
          options: [
            { name: 'Single', value: 'single' },
            { name: 'Multiple', value: 'multiple' },
          ],
          default: 'single',
        },
      ],
    });

    this.registerNode({
      type: 'merge',
      displayName: 'Merge',
      name: 'merge',
      group: ['logic'],
      version: 2,
      description: 'Merges data from multiple streams',
      category: logicCategory,
      defaults: {
        name: 'Merge',
        color: '#00cc88',
      },
      inputs: ['main', 'main'],
      inputNames: ['Input 1', 'Input 2'],
      outputs: ['main'],
      properties: [
        {
          displayName: 'Mode',
          name: 'mode',
          type: 'options',
          options: [
            { name: 'Append', value: 'append' },
            { name: 'Pass-through', value: 'passThrough' },
            { name: 'Wait', value: 'wait' },
          ],
          default: 'append',
        },
        {
          displayName: 'Join',
          name: 'join',
          type: 'options',
          displayOptions: {
            show: { mode: ['wait'] },
          },
          options: [
            { name: 'Inner Join', value: 'inner' },
            { name: 'Left Join', value: 'left' },
            { name: 'Outer Join', value: 'outer' },
          ],
          default: 'inner',
        },
      ],
    });
  }

  /**
   * Register utility nodes
   */
  registerUtilityNodes() {
    const utilityCategory = 'Utilities';

    this.registerNode({
      type: 'function',
      displayName: 'Function',
      name: 'function',
      group: ['transform'],
      version: 1,
      description: 'Run custom JavaScript code',
      category: utilityCategory,
      defaults: {
        name: 'Function',
        color: '#FF6600',
      },
      inputs: ['main'],
      outputs: ['main'],
      properties: [
        {
          displayName: 'JavaScript Code',
          name: 'functionCode',
          type: 'string',
          typeOptions: {
            editor: 'code',
            editorLanguage: 'javascript',
            rows: 10,
          },
          default: `// Code here will run once per input item.
// More info and help: https://docs.n8n.io/nodes/n8n-nodes-base.function
// Tip: You can use luxon for dates and $jmespath for querying JSON structures

// Add a new field called 'myNewField' to the JSON of the item
$input.item.json.myNewField = 1;

// You can write logs to the browser console
console.log('Got item:', $input.item);

return $input.item;`,
        },
      ],
    });

    this.registerNode({
      type: 'wait',
      displayName: 'Wait',
      name: 'wait',
      group: ['logic'],
      version: 1,
      description: 'Wait before continuing with workflow execution',
      category: utilityCategory,
      defaults: {
        name: 'Wait',
        color: '#804050',
      },
      inputs: ['main'],
      outputs: ['main'],
      properties: [
        {
          displayName: 'Resume',
          name: 'resume',
          type: 'options',
          options: [
            { name: 'After Time Interval', value: 'timeInterval' },
            { name: 'At Specified Time', value: 'specificTime' },
            { name: 'On Webhook Call', value: 'webhook' },
          ],
          default: 'timeInterval',
        },
        {
          displayName: 'Wait Time',
          name: 'waitTime',
          type: 'number',
          displayOptions: {
            show: { resume: ['timeInterval'] },
          },
          typeOptions: {
            minValue: 0,
            maxValue: 3000,
          },
          default: 1,
          description: 'The time to wait (in seconds)',
        },
      ],
    });

    this.registerNode({
      type: 'no-op',
      displayName: 'No Operation',
      name: 'noOp',
      group: ['utility'],
      version: 1,
      description: 'No operation, passes input to output without changes',
      category: utilityCategory,
      defaults: {
        name: 'No Operation',
        color: '#b0b0b0',
      },
      inputs: ['main'],
      outputs: ['main'],
      properties: [],
    });
  }

  /**
   * Register custom Cartrita-specific nodes
   */
  registerCartritaNodes() {
    const cartritaCategory = 'Cartrita AI';

    this.registerNode({
      type: 'cartrita-writer',
      displayName: 'Cartrita Writer',
      name: 'cartritaWriter',
      group: ['cartrita'],
      version: 1,
      description: 'Use Cartrita Writer Agent for content creation',
      category: cartritaCategory,
      defaults: {
        name: 'Writer Agent',
        color: '#9b59b6',
      },
      inputs: ['main'],
      outputs: ['main'],
      properties: [
        {
          displayName: 'Writing Task',
          name: 'task',
          type: 'options',
          options: [
            { name: 'Article', value: 'article' },
            { name: 'Blog Post', value: 'blog' },
            { name: 'Email', value: 'email' },
            { name: 'Social Media', value: 'social' },
            { name: 'Creative Writing', value: 'creative' },
          ],
          default: 'article',
        },
        {
          displayName: 'Topic/Prompt',
          name: 'prompt',
          type: 'string',
          typeOptions: { rows: 3 },
          default: '',
          description: 'What should be written about',
        },
        {
          displayName: 'Tone',
          name: 'tone',
          type: 'options',
          options: [
            { name: 'Professional', value: 'professional' },
            { name: 'Casual', value: 'casual' },
            { name: 'Sassy', value: 'sassy' },
            { name: 'Academic', value: 'academic' },
            { name: 'Creative', value: 'creative' },
          ],
          default: 'sassy',
        },
      ],
    });

    this.registerNode({
      type: 'cartrita-coder',
      displayName: 'Cartrita Coder',
      name: 'cartritaCoder',
      group: ['cartrita'],
      version: 1,
      description: 'Use Cartrita Coder Agent for software development',
      category: cartritaCategory,
      defaults: {
        name: 'Coder Agent',
        color: '#3498db',
      },
      inputs: ['main'],
      outputs: ['main'],
      properties: [
        {
          displayName: 'Programming Language',
          name: 'language',
          type: 'options',
          options: [
            { name: 'JavaScript', value: 'javascript' },
            { name: 'Python', value: 'python' },
            { name: 'Java', value: 'java' },
            { name: 'C++', value: 'cpp' },
            { name: 'Go', value: 'go' },
            { name: 'Rust', value: 'rust' },
          ],
          default: 'javascript',
        },
        {
          displayName: 'Task',
          name: 'task',
          type: 'options',
          options: [
            { name: 'Generate Code', value: 'generate' },
            { name: 'Debug Code', value: 'debug' },
            { name: 'Refactor Code', value: 'refactor' },
            { name: 'Code Review', value: 'review' },
          ],
          default: 'generate',
        },
        {
          displayName: 'Requirements',
          name: 'requirements',
          type: 'string',
          typeOptions: { rows: 4 },
          default: '',
          description: 'Describe what needs to be coded',
        },
      ],
    });

    this.registerNode({
      type: 'cartrita-researcher',
      displayName: 'Cartrita Researcher',
      name: 'cartritaResearcher',
      group: ['cartrita'],
      version: 1,
      description: 'Use Cartrita Researcher Agent for information gathering',
      category: cartritaCategory,
      defaults: {
        name: 'Researcher Agent',
        color: '#e74c3c',
      },
      inputs: ['main'],
      outputs: ['main'],
      properties: [
        {
          displayName: 'Research Query',
          name: 'query',
          type: 'string',
          typeOptions: { rows: 3 },
          default: '',
          description: 'What to research',
        },
        {
          displayName: 'Sources',
          name: 'sources',
          type: 'multiOptions',
          options: [
            { name: 'Web Search', value: 'web' },
            { name: 'Wikipedia', value: 'wikipedia' },
            { name: 'Academic Papers', value: 'academic' },
            { name: 'Wolfram Alpha', value: 'wolfram' },
          ],
          default: ['web', 'wolfram'],
        },
        {
          displayName: 'Depth',
          name: 'depth',
          type: 'options',
          options: [
            { name: 'Quick Overview', value: 'quick' },
            { name: 'Detailed Analysis', value: 'detailed' },
            { name: 'Comprehensive Report', value: 'comprehensive' },
          ],
          default: 'detailed',
        },
      ],
    });

    this.registerNode({
      type: 'cartrita-analyst',
      displayName: 'Cartrita Analyst',
      name: 'cartritaAnalyst',
      group: ['cartrita'],
      version: 1,
      description: 'Use Cartrita Analyst Agent for data analysis',
      category: cartritaCategory,
      defaults: {
        name: 'Analyst Agent',
        color: '#f39c12',
      },
      inputs: ['main'],
      outputs: ['main'],
      properties: [
        {
          displayName: 'Analysis Type',
          name: 'analysisType',
          type: 'options',
          options: [
            { name: 'Statistical Analysis', value: 'statistical' },
            { name: 'Trend Analysis', value: 'trend' },
            { name: 'Comparative Analysis', value: 'comparative' },
            { name: 'Predictive Analysis', value: 'predictive' },
          ],
          default: 'statistical',
        },
        {
          displayName: 'Data Source',
          name: 'dataSource',
          type: 'string',
          default: '',
          description: 'Source of data to analyze',
        },
        {
          displayName: 'Generate Visualizations',
          name: 'visualizations',
          type: 'boolean',
          default: true,
          description: 'Create charts and graphs',
        },
      ],
    });

    this.registerNode({
      type: 'wolfram-alpha',
      displayName: 'Wolfram Alpha',
      name: 'wolframAlpha',
      group: ['cartrita'],
      version: 1,
      description: 'Query Wolfram Alpha computational knowledge engine',
      category: cartritaCategory,
      defaults: {
        name: 'Wolfram Alpha',
        color: '#ff6600',
      },
      inputs: ['main'],
      outputs: ['main'],
      properties: [
        {
          displayName: 'Query Type',
          name: 'queryType',
          type: 'options',
          options: [
            { name: 'Mathematical', value: 'math' },
            { name: 'Scientific', value: 'science' },
            { name: 'Historical', value: 'history' },
            { name: 'Geographic', value: 'geography' },
            { name: 'Statistical', value: 'statistics' },
            { name: 'Unit Conversion', value: 'conversion' },
            { name: 'General Query', value: 'general' },
          ],
          default: 'general',
        },
        {
          displayName: 'Query',
          name: 'query',
          type: 'string',
          typeOptions: { rows: 2 },
          default: '',
          description: 'Query to send to Wolfram Alpha',
        },
      ],
    });
  }

  /**
   * Register a single node
   */
  registerNode(nodeDefinition) {
    this.nodes.set(nodeDefinition.type, nodeDefinition);

    // Add to category
    if (!this.categories.has(nodeDefinition.category)) {
      this.categories.set(nodeDefinition.category, []);
    }
    this.categories.get(nodeDefinition.category).push(nodeDefinition.type);

    // Mark triggers separately
    if (nodeDefinition.group && nodeDefinition.group.includes('trigger')) {
      this.triggers.set(nodeDefinition.type, nodeDefinition);
    }
  }

  /**
   * Get node definition by type
   */
  getNode(nodeType) {
    return this.nodes.get(nodeType);
  }

  /**
   * Get all nodes
   */
  getAllNodes() {
    return Array.from(this.nodes.values());
  }

  /**
   * Get nodes by category
   */
  getNodesByCategory(category) {
    const nodeTypes = this.categories.get(category) || [];
    return nodeTypes.map(type => this.nodes.get(type));
  }

  /**
   * Get all categories
   */
  getCategories() {
    return Array.from(this.categories.keys());
  }

  /**
   * Get trigger nodes
   */
  getTriggerNodes() {
    return Array.from(this.triggers.values());
  }

  /**
   * Validate node configuration
   */
  validateNode(nodeType, nodeData) {
    const nodeDefinition = this.nodes.get(nodeType);
    if (!nodeDefinition) {
      return { valid: false, error: `Unknown node type: ${nodeType}` };
    }

    const errors = [];

    // Check required properties
    if (nodeDefinition.properties) {
      for (const property of nodeDefinition.properties) {
        if (
          property.required &&
          (!nodeData || nodeData[property.name] === undefined)
        ) {
          errors.push(`Missing required property: ${property.displayName}`);
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Get node execution requirements
   */
  getNodeExecutionInfo(nodeType) {
    const nodeDefinition = this.nodes.get(nodeType);
    if (!nodeDefinition) {
      return null;
    }

    return {
      type: nodeType,
      name: nodeDefinition.name,
      displayName: nodeDefinition.displayName,
      inputs: nodeDefinition.inputs || [],
      outputs: nodeDefinition.outputs || [],
      properties: nodeDefinition.properties || [],
      category: nodeDefinition.category,
      description: nodeDefinition.description,
    };
  }

  /**
   * Search nodes by name or description
   */
  searchNodes(query) {
    const results = [];
    const lowercaseQuery = query.toLowerCase();

    for (const node of this.nodes.values()) {
      if (
        node.displayName.toLowerCase().includes(lowercaseQuery) ||
        node.description.toLowerCase().includes(lowercaseQuery) ||
        node.name.toLowerCase().includes(lowercaseQuery)
      ) {
        results.push(node);
      }
    }

    return results;
  }
}

export default WorkflowNodeRegistry;

// packages/backend/src/agi/examples/agentUsageExamples.js

/**
 * Agent usage examples for intent classification
 */

const agentUsageExamples = {
  researcher: {
    capability: 'research',
    description: 'Research and information gathering',
    examples: [
      'What are the latest developments in AI?',
      'Find information about climate change',
      'Look up the current stock price of Apple',
      'Research the history of the internet',
      'What happened in the news today?',
    ],
  },

  writer: {
    capability: 'write',
    description: 'Content creation and writing',
    examples: [
      'Write a blog post about productivity',
      'Create an email template',
      'Draft a report on market trends',
      'Write a story about cats',
      'Create content for social media',
    ],
  },

  comedian: {
    capability: 'joke',
    description: 'Humor and entertainment',
    examples: [
      'Tell me a joke',
      'Make me laugh',
      'Say something funny',
      'Create a humorous story',
      'Write a funny poem',
    ],
  },

  codeWriter: {
    capability: 'coding',
    description: 'Programming and code-related tasks',
    examples: [
      'Write a Python function',
      'Debug this JavaScript code',
      'Create a REST API',
      'Explain this algorithm',
      'Write SQL queries',
    ],
  },

  scheduler: {
    capability: 'schedule',
    description: 'Calendar and scheduling tasks',
    examples: [
      'Schedule a meeting',
      'Check my calendar',
      'Add an appointment',
      'Find free time slots',
      'Set a reminder',
    ],
  },

  artist: {
    capability: 'art',
    description: 'Creative and artistic content',
    examples: [
      'Create art',
      'Design something',
      'Generate creative ideas',
      'Make something artistic',
      'Create visual content',
    ],
  },

  githubSearch: {
    capability: 'github_search',
    description: 'GitHub repository and code search',
    examples: [
      'Search GitHub for React components',
      'Find repositories about machine learning',
      'Look for JavaScript libraries',
      'Search for Python packages',
      'Find open source projects',
    ],
  },

  ethicalDilemma: {
    capability: 'ethical_dilemma',
    description: 'Ethical considerations and dilemmas',
    examples: [
      'Is this ethically correct?',
      'Help me think through this moral issue',
      'What are the ethical implications?',
      'Is this the right thing to do?',
      'Ethics of AI development',
    ],
  },
};

export default { agentUsageExamples };

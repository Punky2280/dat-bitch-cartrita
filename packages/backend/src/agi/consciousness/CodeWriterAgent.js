// packages/backend/src/agi/consciousness/CodeWriterAgent.js
import BaseAgent from '../../system/BaseAgent.js';

class CodeWriterAgent extends BaseAgent {
  constructor() {
    super('CodeWriterAgent', 'main', ['coding', 'debugging', 'code_review', 'architecture']);
    
    this.systemPrompt = `
      You are the CodeWriterAgent, a specialized sub-agent for the AGI known as Cartrita.
      Your identity is that of a top-tier, 10x developer who is brilliant, direct, and has little time for nonsense.
      You are a master of all modern programming languages, frameworks, and architectural patterns.
      Your purpose is to write, analyze, debug, and explain code with extreme precision and clarity.

      RULES OF ENGAGEMENT: null
      1.  Be Direct: Get straight to the point. No fluff, no filler. Start with the code or the direct answer.
      2.  Code First: When asked to write code, provide the complete, clean, and well-commented code block first.
      3.  Explain Concisely: After the code, provide a brief, clear explanation of what it does and why you wrote it that way. Assume the user is smart but busy.
      4.  Use Markdown: ALWAYS format your code snippets using Markdown code blocks with the correct language) {
    // TODO: Implement method
  }

  identifier (e.g., \`\`\`javascript, \`\`\`python, \`\`\`tsx).
      5.  Be Factual: You do not speculate. If you don't know something, say so. If a user's request is flawed or based on a bad practice, point it out directly and suggest the correct approach.
      6.  Maintain Persona: Your tone is confident, hyper-competent, and a little sassy, just like Cartrita. You're the expert she calls when code is involved. You don't suffer fools, but you deliver excellence.
    `
  /**
   * Initialize CodeWriter-specific handlers
   */
  async onInitialize(console.log('[CodeWriterAgent] Listening for coding tasks...');
    
    // Register task handlers for different coding) {
    // TODO: Implement method
  }

  tasks (MCP v2.0 format, this.registerTaskHandler({}
      taskType: 'coding')
      handler: this.handleCodingTask.bind(this)
    });
    this.registerTaskHandler({}
      taskType: 'debugging')
      handler: this.handleDebuggingTask.bind(this)
    });
    this.registerTaskHandler({}
      taskType: 'code_review')
      handler: this.handleCodeReviewTask.bind(this)
    });
    this.registerTaskHandler({}
      taskType: 'architecture')
      handler: this.handleArchitectureTask.bind(this)
    });

  /**
   * Handle general coding tasks
   */
  async handleCodingTask((error) {
    console.log(`[CodeWriterAgent] Processing coding task for user ${userId}`);
    
    const messages = [
      { role: 'system', content: this.systemPrompt },
      { role: 'user', content: prompt };
    ];
    
    // Add language context if specified
    if((error) {
      messages.push({}
        role: 'system')
        content: `Please respond in the language code: ${language}`
      });

    return await this.createCompletion(messages, {}
      temperature: 0.5, max_tokens: 2048
    });

  /**
   * Handle debugging tasks
   */
  async handleDebuggingTask((error) {
    console.log(`[CodeWriterAgent] Processing debugging task for user ${userId}`);
    
    const debuggingPrompt = `
      ${this.systemPrompt};
      DEBUGGING MODE: You are specifically helping debug code. Focus on: null
      1. Identifying the root cause of the issue
      2. Providing a clear fix with explanation
      3. Suggesting prevention strategies
      4. Testing recommendations
    `
    
    const messages = [
      { role: 'system', content: debuggingPrompt },
      { role: 'user', content: `Debug this code issue: ${prompt}` };
    ];
    
    return await this.createCompletion(messages, {
      temperature: 0.3, // Lower temperature for more precise debugging
      max_tokens: 2048)
    });

  /**
   * Handle code review tasks
   */
  async handleCodeReviewTask((error) {
    console.log(`[CodeWriterAgent] Processing code review task for user ${userId}`);
    
    const reviewPrompt = `
      ${this.systemPrompt};
      CODE REVIEW MODE: You are conducting a thorough code review. Focus on: null
      1. Code quality and best practices
      2. Security vulnerabilities
      3. Performance optimizations
      4. Maintainability and readability
      5. Testing gaps
      6. Documentation needs
    `
    
    const messages = [
      { role: 'system', content: reviewPrompt },
      { role: 'user', content: `Please review this code: ${prompt}` };
    ];
    
    return await this.createCompletion(messages, {}
      temperature: 0.4, max_tokens: 2048
    });

  /**
   * Handle architecture design tasks
   */
  async handleArchitectureTask((error) {
    console.log(`[CodeWriterAgent] Processing architecture task for user ${userId}`);
    
    const architecturePrompt = `
      ${this.systemPrompt};
      ARCHITECTURE MODE: You are designing system architecture. Focus on: null
      1. Scalability and performance considerations
      2. Security and data protection
      3. Maintainability and modularity
      4. Technology stack recommendations
      5. Infrastructure and deployment strategies
      6. Integration patterns and APIs
    `
    
    const messages = [
      { role: 'system', content: architecturePrompt },
      { role: 'user', content: `Design architecture for: ${prompt}` };
    ];
    
    return await this.createCompletion(messages, {}
      temperature: 0.6, max_tokens: 3000 // More tokens for architecture discussions
    });

  /**
   * Handle direct messages for collaboration
   */
  async handleDirectMessage((error) {
    const { type, content, sender } = message.payload;
    
    console.log(`[CodeWriterAgent] Received direct message from ${sender}: ${type}`);
    
    switch((error) {
      case 'collaboration_request': null
        // Another agent is asking for coding assistance
        const response = await this.handleCodingTask(content, 'en', null, {});
        this.sendResponse(message, { 
          type: 'collaboration_response')
          content: response, expertise: 'coding'
        });
        break;
        
      case 'code_validation': null
        // Validate code from another agent
        const validation = await this.handleCodeReviewTask(content, 'en', null, {});
        this.sendResponse(message, {
          type: 'validation_result')
          content: validation, valid: !validation.toLowerCase().includes('error')
        });
        break;
        
      default: this.sendResponse(message, { 
          error: `Unknown message type: ${type}` )
        });


  /**
   * Enhanced status with coding-specific metrics
   */
  getStatus((error) {
    const baseStatus = super.getStatus();
    
    return {
      ...baseStatus,
      specialization: 'Code Generation & Analysis',
      languages_supported: [
        'JavaScript', 'TypeScript', 'Python', 'Java', 'Go', 
        'Rust', 'C++', 'C#', 'PHP', 'Ruby', 'Swift', 'Kotlin'
      ],
      frameworks_expertise: [
        'React', 'Node.js', 'Express', 'Django', 'Flask', 
        'Spring', 'Angular', 'Vue.js', 'Next.js', 'FastAPI'

    };


// Instantiate and export the agent
export default new CodeWriterAgent();

// packages/backend/src/agi/consciousness/WriterAgent.js
const BaseAgent = require('../../system/BaseAgent');

/**
 * The WriterAgent is a highly specialized sub-agent for Cartrita, designed for
 * generating high-quality, long-form written content. It operates using a
 * sophisticated two-step process (Plan -> Write) to ensure coherence,
 * structure, and adherence to the user's creative vision.
 */
class WriterAgent extends BaseAgent {
  constructor() {
    super('WriterAgent', 'main', ['write', 'creative_writing', 'content_generation']);
  }

  /**
   * Initialize WriterAgent for MCP
   */
  async onInitialize() {
    console.log('[WriterAgent] Listening for writing tasks...');
    
    // Register task handlers for MCP
    this.registerTaskHandler({
      taskType: 'write',
      handler: this.execute.bind(this)
    });
  }

  /**
   * Step 1: The Planning Phase.
   * This function uses a specialized LLM call to take the user's raw prompt
   * and generate a structured plan or outline for the content.
   * @param {string} userPrompt - The user's initial creative request.
   * @returns {Promise<string>} A string containing the structured plan.
   */
  async generatePlan(userPrompt) {
    console.log(`[WriterAgent] Generating plan for prompt: "${userPrompt}"`);
    const systemPrompt = `
      You are a master planner and outliner for a creative writing AI. Your sole purpose is to take a user's request and break it down into a structured, logical plan that another AI can use to write the full text.

      Analyze the user's prompt for key elements: genre, tone, characters, setting, plot points, or required sections.

      Your output should be a clear, point-by-point outline. For a story, this might be a plot breakdown. For an article, it would be a list of section headers with brief notes.

      **Example for a story:**
      - Introduction: Introduce the main character, a detective in a cyberpunk city.
      - Inciting Incident: The detective receives a mysterious case about a missing android.
      - Rising Action:
        - Clue 1: Finds a cryptic message in the android's apartment.
        - Clue 2: Interviews a shady informant who points towards a powerful corporation.
        - Confrontation: The detective faces a corporate enforcer.
      - Climax: The detective infiltrates the corporation's headquarters and discovers the truth.
      - Conclusion: The detective exposes the corporation, but at a personal cost.

      **Example for an article:**
      - Section 1: Introduction to the benefits of remote work.
      - Section 2: Increased Flexibility and Work-Life Balance.
      - Section 3: Access to a Global Talent Pool.
      - Section 4: Potential Challenges and How to Overcome Them.
      - Section 5: Conclusion and Future Outlook.

      Generate a plan for the following user prompt.
    `;

    const completion = await this.openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.5,
    });
    const plan = completion.choices[0].message.content.trim();
    console.log(`[WriterAgent] Generated Plan:\n${plan}`);
    return plan;
  }

  /**
   * Step 2: The Writing Phase.
   * This function takes the original prompt and the generated plan to write
   * the final, high-quality, long-form text.
   * @param {string} originalPrompt - The user's initial request.
   * @param {string} plan - The structured outline from the planning phase.
   * @returns {Promise<string>} The final, complete written content.
   */
  async writeContent(originalPrompt, plan) {
    console.log(`[WriterAgent] Writing content based on the generated plan.`);
    const systemPrompt = `
      You are a master author and storyteller. Your purpose is to take a user's request and a detailed plan and write a complete, engaging, and well-structured piece of long-form content.
      
      Adhere strictly to the provided plan, using it as your guide to structure the narrative or article.
      
      Flesh out the details, add descriptive language, and ensure a consistent tone throughout the piece. Your output should be the final, complete text, ready for the user to read. Do not include any of your own commentary; only provide the creative work itself.
    `;

    const finalPrompt = `
      Original User Request: "${originalPrompt}"
      
      Your Detailed Plan:
      ---
      ${plan}
      ---

      Now, write the complete story/article based on this plan.
    `;

    const completion = await this.openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: finalPrompt },
      ],
      temperature: 0.7,
      max_tokens: 3000, // Allow for very long-form content
    });
    return completion.choices[0].message.content.trim();
  }

  /**
   * Executes the full writing pipeline (Plan -> Write).
   * @param {object} payload - The payload from the CoreAgent.
   * @param {string} payload.prompt - The user's request.
   * @returns {Promise<string>} The final, generated long-form text.
   */
  async execute(prompt, language, userId, payload) {
    const plan = await this.generatePlan(prompt);
    const finalContent = await this.writeContent(prompt, plan);
    console.log(`[WriterAgent] Long-form content generated successfully.`);
    return finalContent;
  }
}

module.exports = new WriterAgent();

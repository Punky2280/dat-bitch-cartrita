import {
  AIMessage,
  HumanMessage,
  SystemMessage,
} from '@langchain/core/messages';
import BaseAgent from '../../system/BaseAgent.js';

/**
 * @class TranslationAgent
 * @description A specialist agent for translating text between multiple languages.
 * It leverages the core LLM's multilingual capabilities to provide accurate translations.
 */
class TranslationAgent extends BaseAgent {
  /**
   * @param {ChatOpenAI} llm - The language model instance.
   * @param {AgentToolRegistry} toolRegistry - The tool registry instance.
   */
  constructor(llm, toolRegistry) {
    super(
      'translation',
      'sub',
      ['language_translation', 'language_detection', 'localization'],
      'A specialist agent for translating text between multiple languages.'
    );

    // LangGraph compatibility - injected by supervisor
    this.llm = llm;
    this.toolRegistry = toolRegistry;

    // Update config with allowed tools
    this.config.allowedTools = [];
  }

  /**
   * Overrides the base prompt to provide a precise set of instructions for
   * performing and formatting translations.
   * @param {object} privateState - The agent's private memory for this session.
   * @returns {string} The complete system prompt for the TranslationAgent.
   */
  buildSystemPrompt(privateState) {
    // The user's input will contain the text to be translated.
    return `You are a Translation Agent. Your sole purpose is to accurately translate text from a source language to a target language.

**Your Task:**
You will be given a user request that contains text to translate.
1.  **Identify:** Determine the source text and the target language from the request.
2.  **Translate:** Perform a high-quality translation of the source text into the target language.
3.  **Format:** Provide the translation clearly.

**YOUR FINAL OUTPUT MUST BE A SINGLE JSON OBJECT.**

**Example Input:**
"Translate 'hello world' into Spanish."

**Example JSON Output:**
{
  "final_answer": "Of course. 'Hello world' in Spanish is 'Hola, mundo'.",
  "translation_details": {
    "source_language": "English",
    "target_language": "Spanish",
    "source_text": "Hello world",
    "translated_text": "Hola, mundo"
  },
  "status": "complete",
  "delegate_to": "none"
}`;
  }
}

export default TranslationAgent;

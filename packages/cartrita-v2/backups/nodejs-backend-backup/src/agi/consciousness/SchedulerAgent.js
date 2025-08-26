import {
  AIMessage,
  HumanMessage,
  SystemMessage,
} from '@langchain/core/messages';
import BaseAgent from '../../system/BaseAgent.js';

/**
 * @class SchedulerAgent
 * @description An advanced scheduling agent with its own internal logic for
 * comprehensive calendar management, event coordination, and intelligent time planning.
 */
class SchedulerAgent extends BaseAgent {
  /**
   * @param {ChatOpenAI} llm - The language model instance.
   * @param {AgentToolRegistry} toolRegistry - The tool registry instance.
   */
  constructor(llm, toolRegistry) {
    super(
      'scheduler',
      'sub',
      [
        'scheduling',
        'calendar_management',
        'time_planning',
        'conflict_resolution',
      ],
      'A specialist agent for managing calendars, scheduling meetings, and handling time-related tasks.'
    );

    // LangGraph compatibility - injected by supervisor
    this.llm = llm;
    this.toolRegistry = toolRegistry;

    this.config.allowedTools = [
      'calendar_manager',
      'time_analyzer',
      'conflict_resolver',
      'time_zone_conversion',
      'date_calculation',
      'scheduling_optimization',
    ];

    this._initializeSchedulingEngine();
  }

  /**
   * Use the inherited BaseAgent invoke method for consistent behavior
   */
  async invoke(state) {
    console.log(`[SchedulerAgent] 🗓️ Engaging Scheduling workflow...`);

    // Use the parent's invoke method which handles the tool execution loop properly
    return await super.invoke(state);
  }

  /**
   * Build specialized system prompt for scheduling tasks.
   */
  buildSystemPrompt(privateState, state) {
    const userMessage = state.messages[state.messages.length - 1];
    return `You are the Scheduler, a calendar and time management specialist in the Cartrita AI system.
Your personality is organized, efficient, punctual, and sassy with that Miami street-smart scheduling expertise.

**CURRENT USER REQUEST:**
"${userMessage.content}"

**YOUR SCHEDULING MISSION:**
1. **Parse the Request:** What scheduling task does the user need - create events, check availability, manage calendar?
2. **Execute Calendar Operations:**
   - Use \`calendar_manager\` tool to create, update, delete, or view calendar events
   - Use \`time_analyzer\` tool to find optimal meeting times and analyze schedules
   - Use \`conflict_resolver\` tool to handle scheduling conflicts and overlaps
3. **Coordinate Time Management:** Handle complex scheduling scenarios with multiple participants
4. **Provide Clear Scheduling:** Give specific times, dates, and calendar confirmations

${this.config.allowedTools.join(', ')}

- Time zone conversions: Calculate exact times across different time zones and daylight savings
- Duration calculations: Compute precise meeting durations and availability windows
- Calendar mathematics: Calculate optimal scheduling patterns and recurring event intervals

**EXECUTION REQUIREMENTS:**
- ACTUALLY create, modify, or analyze calendar events using your tools - don't just suggest times
- Parse natural language time requests into specific dates and times
- Check for conflicts and availability using your scheduling tools
- Handle time zones, recurring events, and complex scheduling scenarios
- Provide calendar invites, reminders, and confirmations when relevant

**RESPONSE FORMAT:**
Provide a natural, conversational response that includes:
- "Alright, let me handle this scheduling for you..." (what calendar work you performed)
- Specific dates, times, and event details you scheduled or found
- Any conflicts resolved or availability windows identified
- Calendar confirmations, invites, or next steps
- Your efficient, organized personality throughout

**SCHEDULING GUIDELINES:**
- Convert natural language to specific dates/times (e.g., "tomorrow at 2pm" → actual datetime)
- Always check for conflicts before confirming new events
- Consider time zones for multi-location meetings
- Handle recurring events and series scheduling
- Provide alternative times when conflicts exist

**Remember:** You're the scheduling expert - actually manage calendar events, don't just talk about scheduling!

**Your Memory of This Task:** ${JSON.stringify(privateState, null, 2)}`;
  }

  /**
   * Uses an LLM to parse a natural language string into a structured scheduling command.
   * @param {string} text - The user's request.
   * @param {string} userId - The ID of the user making the request.
   * @returns {Promise<object>} A structured object with the intended action and details.
   * @private
   */
  async _parseRequestWithLLM(text, userId) {
    const prompt = `You are a scheduling assistant. Parse the user's request and extract details into a JSON object.
The possible actions are "create", "list", or "check_availability".
The dateTime MUST be a valid ISO 8601 date string. Infer based on the current date: ${new Date().toISOString()}.
The userId is "${userId}".

Request: "${text}"

Example 1: "book a meeting for tomorrow at 3pm"
Output:
{
  "action": "create",
  "details": { "title": "Meeting", "startTime": "...", "userId": "${userId}" }
}

Example 2: "what's on my schedule for this week?"
Output:
{
  "action": "list",
  "details": { "startDate": "...", "endDate": "...", "userId": "${userId}" }
}`;

    const response = await this.llm
      .bind({ response_format: { type: 'json_object' } })
      .invoke([new SystemMessage(prompt)]);
    return JSON.parse(response.content);
  }

  // --- YOUR ORIGINAL, POWERFUL SCHEDULING LOGIC ---

  _initializeSchedulingEngine() {
    this.scheduleItems = new Map();
    // In a real app, this data would be loaded from the database for the user.
    console.log('[SchedulerAgent] In-memory scheduling engine initialized');
  }

  _createScheduleItem(eventData) {
    const { title, startTime, endTime, userId } = eventData;
    if (!title || !startTime || !userId)
      throw new Error('Title, startTime, and userId are required.');

    const eventId = `event_${Date.now()}`;
    const parsedStartTime = new Date(startTime);
    const parsedEndTime = endTime
      ? new Date(endTime)
      : new Date(parsedStartTime.getTime() + 60 * 60 * 1000);

    const conflicts = this._checkForConflicts(
      parsedStartTime,
      parsedEndTime,
      userId
    );

    const scheduleItem = {
      id: eventId,
      title,
      startTime: parsedStartTime.toISOString(),
      endTime: parsedEndTime.toISOString(),
      userId,
      conflicts,
    };
    this.scheduleItems.set(eventId, scheduleItem);

    const message =
      conflicts.length > 0
        ? `Event "${title}" created, but there are ${conflicts.length} potential conflicts.`
        : `Event "${title}" has been successfully scheduled.`;

    return { message, ...scheduleItem };
  }

  _listScheduleItems({ userId, startDate, endDate }) {
    let items = Array.from(this.scheduleItems.values()).filter(
      item => item.userId === userId
    );
    if (startDate)
      items = items.filter(
        item => new Date(item.startTime) >= new Date(startDate)
      );
    if (endDate)
      items = items.filter(item => new Date(item.endTime) <= new Date(endDate));
    const message = `Found ${items.length} events on your schedule.`;
    return {
      message,
      schedule: items.sort(
        (a, b) => new Date(a.startTime) - new Date(b.startTime)
      ),
    };
  }

  _checkForConflicts(startTime, endTime, userId) {
    const conflicts = [];
    for (const event of this.scheduleItems.values()) {
      if (event.userId === userId) {
        const eventStart = new Date(event.startTime);
        const eventEnd = new Date(event.endTime);
        if (startTime < eventEnd && endTime > eventStart) {
          conflicts.push(event);
        }
      }
    }
    return conflicts;
  }
}

export default SchedulerAgent;

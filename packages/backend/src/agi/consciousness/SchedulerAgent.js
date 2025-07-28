// packages/backend/src/agi/consciousness/SchedulerAgent.js
const { google } = require('googleapis');
const { Pool } = require('pg');
const OpenAI = require('openai');
const MessageBus = require('../../system/MessageBus');
const EncryptionService = require('../../system/EncryptionService');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

class SchedulerAgent {
  constructor() {
    this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    this.listen();
  }

  listen() {
    console.log('[SchedulerAgent] Listening for schedule tasks...');
    MessageBus.on('task:request', async (task) => {
      if (task.type === 'schedule') {
        console.log(`[SchedulerAgent] Received schedule task: ${task.id}`);
        try {
          const result = await this.execute(task.payload);
          MessageBus.emit(`task:complete:${task.id}`, { text: result });
        } catch (error) {
          console.error('[SchedulerAgent] CRITICAL ERROR:', error);
          MessageBus.emit(`task:fail:${task.id}`, { error: error.message });
        }
      }
    });
  }

  async getGoogleAuth(userId) {
    console.log(`[SchedulerAgent] Fetching Google Calendar key for user ${userId}...`);
    const keyResult = await pool.query(
      'SELECT key_data FROM user_api_keys WHERE user_id = $1 AND service_name = $2',
      [userId, 'GoogleCalendar']
    );

    if (keyResult.rows.length === 0) {
      throw new Error("Google Calendar API key not found. Please add it in the settings page.");
    }

    const encryptedKey = keyResult.rows[0].key_data;
    const keyJson = EncryptionService.decrypt(encryptedKey);
    const credentials = JSON.parse(keyJson);
    console.log('[SchedulerAgent] Credentials decrypted successfully.');

    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: [
        'https://www.googleapis.com/auth/calendar',
        'https://www.googleapis.com/auth/calendar.readonly'
      ],
    });

    return auth.getClient();
  }

  async execute({ prompt, userId }) {
    if (!userId) throw new Error("User ID is missing from the task payload.");
    
    const auth = await this.getGoogleAuth(userId);
    const calendar = google.calendar({ version: 'v3', auth });

    console.log('[SchedulerAgent] Determining calendar intent from prompt...');
    const intent = await this.determineCalendarIntent(prompt);
    console.log('[SchedulerAgent] Intent determined:', JSON.stringify(intent, null, 2));

    // FIXED: Correctly handle the AI returning an error action
    if (intent.action === 'error') {
        return intent.message; // Access intent.message directly
    }

    switch (intent.action) {
      case 'list':
        return this.listEvents(calendar, intent.parameters);
      case 'create':
        return this.createEvent(calendar, intent.parameters);
      default:
        return "I'm not sure how to handle that calendar request. Try asking to 'list events for tomorrow' or 'create an event'.";
    }
  }

  async determineCalendarIntent(prompt) {
    const timeZone = 'America/New_York';
    const now = new Date();
    const userLocaleTime = now.toLocaleString('en-US', { timeZone });
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowDate = tomorrow.toISOString().split('T')[0];

    const systemPrompt = `
      You are a precise data extraction tool. Your only job is to parse a user's request into a structured JSON object for a calendar API.
      Respond ONLY with a valid JSON object. Do not add any commentary.

      **Actions & Parameters:**
      1.  **action: 'list'**: For when the user wants to see their events.
          - \`timeMin\` (string): The start of the date range in ISO 8601 format.
          - \`timeMax\` (string): The end of the date range in ISO 8601 format.
      2.  **action: 'create'**: For when the user wants to add a new event.
          - \`summary\` (string): The title of the event. THIS IS REQUIRED.
          - \`startDateTime\` (string): The start time of the event in ISO 8601 format. THIS IS REQUIRED.
          - \`durationMinutes\` (number): The length of the event in minutes. Default to 60 if not specified.
      3. **action: 'error'**: If you cannot determine the required parameters (e.g., a missing title for a create request).
          - \`message\` (string): A helpful message to the user explaining what is missing.

      **Context for Calculations:**
      - The user's current timezone is '${timeZone}'.
      - The current date and time for the user is: **${userLocaleTime}**.
      - Tomorrow's date is: **${tomorrowDate}**.
      - Use this as the absolute reference for all relative terms like 'today' or 'tomorrow'.

      **Time Parsing Rules:**
      - "9 am" or "9am" = "09:00:00"
      - "10 am" or "10am" = "10:00:00"
      - "tomorrow morning" refers to tomorrow's date
      - "from X to Y" or "X till Y" means calculate duration from start to end time
      - Always use 24-hour format in ISO strings

      **Example 1:**
      User Prompt: "Create an event for a 'Project Meeting' tomorrow at 10am for one hour."
      Your JSON Response:
      {
        "action": "create",
        "parameters": {
          "summary": "Project Meeting",
          "startDateTime": "${tomorrowDate}T10:00:00",
          "durationMinutes": 60
        }
      }

      **Example 2:**
      User Prompt: "lets create a google calendar event named project cartrita and is for 9 am till 10 am tomorrow morning."
      Your JSON Response:
      {
        "action": "create",
        "parameters": {
          "summary": "project cartrita",
          "startDateTime": "${tomorrowDate}T09:00:00",
          "durationMinutes": 60
        }
      }
      
      **Example 3:**
      User Prompt: "create an event"
      Your JSON Response:
      {
        "action": "error",
        "message": "I can do that. What should the event be called, and when should it be?"
      }
    `;
    const completion = await this.openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: prompt }],
      response_format: { type: "json_object" }
    });
    return JSON.parse(completion.choices[0].message.content);
  }

  async listEvents(calendar, { timeMin, timeMax }) {
    try {
      console.log(`[SchedulerAgent] Listing events from ${timeMin} to ${timeMax}`);
      
      const response = await calendar.events.list({
        calendarId: 'primary',
        timeMin: timeMin,
        timeMax: timeMax,
        maxResults: 10,
        singleEvents: true,
        orderBy: 'startTime',
      });

      const events = response.data.items;
      if (!events || events.length === 0) {
        return 'No events found for that time period.';
      }

      const eventList = events.map(event => {
        const start = event.start.dateTime || event.start.date;
        const startTime = new Date(start).toLocaleString('en-US', { 
          timeZone: 'America/New_York',
          weekday: 'short',
          month: 'short', 
          day: 'numeric',
          hour: 'numeric',
          minute: '2-digit'
        });
        return `• ${event.summary} at ${startTime}`;
      }).join('\n');

      return `Here are your upcoming events:\n\n${eventList}`;
    } catch (error) {
      console.error("Google Calendar API Error:", error);
      return `I couldn't retrieve your events. The calendar API returned an error: ${error.message}`;
    }
  }

  async createEvent(calendar, { summary, startDateTime, durationMinutes = 60 }) {
    try {
      console.log(`[SchedulerAgent] Attempting to create event: "${summary}" at ${startDateTime}`);
      const timeZone = 'America/New_York';
      const startDate = new Date(startDateTime);
      const endDate = new Date(startDate.getTime() + durationMinutes * 60000);

      const eventPayload = {
        summary,
        start: { dateTime: startDate.toISOString(), timeZone },
        end: { dateTime: endDate.toISOString(), timeZone },
      };
      
      console.log('[SchedulerAgent] Sending this payload to Google:', JSON.stringify(eventPayload, null, 2));

      const event = await calendar.events.insert({
        calendarId: 'primary',
        requestBody: eventPayload,
      });

      console.log('[SchedulerAgent] Received response from Google API:', event.data);

      if (event.data.id) {
        return `Success. I've created the event "${summary}" for you at ${startDate.toLocaleString('en-US', { timeZone })}.`;
      } else {
        throw new Error('The API did not confirm the event creation.');
      }
    } catch (error) {
      console.error("Google Calendar API Error:", error);
      return `I couldn't create the event. The calendar API returned an error: ${error.message}`;
    }
  }
}

module.exports = new SchedulerAgent();

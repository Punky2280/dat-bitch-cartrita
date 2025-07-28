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
          console.error('[SchedulerAgent] Error:', error.message);
          MessageBus.emit(`task:fail:${task.id}`, { error: error.message });
        }
      }
    });
  }

  async getGoogleAuth(userId) {
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

    const intent = await this.determineCalendarIntent(prompt);

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
    // FIXED: Pre-calculate date ranges to remove ambiguity for the AI.
    const timeZone = 'America/New_York';
    const now = new Date();
    
    const todayStart = new Date(now.toLocaleString('en-US', { timeZone }));
    todayStart.setHours(0, 0, 0, 0);

    const todayEnd = new Date(todayStart);
    todayEnd.setHours(23, 59, 59, 999);

    const tomorrowStart = new Date(todayStart);
    tomorrowStart.setDate(tomorrowStart.getDate() + 1);

    const tomorrowEnd = new Date(tomorrowStart);
    tomorrowEnd.setHours(23, 59, 59, 999);

    const systemPrompt = `
      You are a function calling expert. Your job is to analyze a user's prompt and determine which calendar function to call: 'list' or 'create'.
      Respond with a JSON object with two keys: "action" (string) and "parameters" (object).
      - For 'list', parameters should include 'timeMin' and 'timeMax' in ISO 8601 format.
      - For 'create', parameters must include 'summary' (string), and 'start' and 'end' objects. These objects must have a 'dateTime' (ISO 8601 string) and a 'timeZone' key.
      - The user's current timezone is '${timeZone}'.
      - Use the following precise date ranges if the user uses relative terms:
        - "today": Use timeMin: "${todayStart.toISOString()}" and timeMax: "${todayEnd.toISOString()}".
        - "tomorrow": Use timeMin: "${tomorrowStart.toISOString()}" and timeMax: "${tomorrowEnd.toISOString()}".
    `;
    const completion = await this.openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: prompt }],
      response_format: { type: "json_object" }
    });
    return JSON.parse(completion.choices[0].message.content);
  }

  async listEvents(calendar, { timeMin, timeMax }) {
    const res = await calendar.events.list({
      calendarId: 'primary',
      timeMin,
      timeMax,
      maxResults: 10,
      singleEvents: true,
      orderBy: 'startTime',
    });
    const events = res.data.items;
    if (!events || events.length === 0) {
      return 'No upcoming events found in that time range.';
    }
    const eventList = events.map(event => {
      const start = event.start.dateTime || event.start.date;
      return `- ${event.summary} (at ${new Date(start).toLocaleString()})`;
    }).join('\n');
    return `Here are your upcoming events:\n${eventList}`;
  }

  async createEvent(calendar, { summary, start, end }) {
    try {
      const event = await calendar.events.insert({
        calendarId: 'primary',
        requestBody: { summary, start, end },
      });
      if (event.data.id) {
        return `Success. I've created the event "${summary}" for you at ${new Date(start.dateTime).toLocaleString()}.`;
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

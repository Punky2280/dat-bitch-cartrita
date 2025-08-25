// Journal Service - Life OS Journal Management
// Handles CRUD operations, sentiment analysis, and task derivation for personal journal entries

import OpenTelemetryTracing from '../system/OpenTelemetryTracing.js';
import { Pool } from 'pg';

export default class JournalService {
  constructor(dbPool) {
    this.dbPool =
      dbPool ||
      new Pool({
        connectionString: process.env.DATABASE_URL,
        max: 20,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 2000,
      });

    // Initialize counters
    this.entryCounter = OpenTelemetryTracing.createCounter(
      'journal_entries_total',
      'Total number of journal entries created'
    );

    this.enrichmentCounter = OpenTelemetryTracing.createCounter(
      'journal_enrich_failures_total',
      'Total number of journal enrichment failures'
    );

    this.sentimentHistogram = OpenTelemetryTracing.createHistogram(
      'journal_sentiment_distribution',
      'Journal sentiment score distribution'
    );
  }

  // Initialize the journal service
  async initialize() {
    try {
      console.log(
        '[JournalService] 🚀 Initializing journal management service...'
      );

      // Test database connection
      await this.dbPool.query('SELECT 1');

      console.log(
        '[JournalService] ✅ Journal service initialized successfully'
      );
      return true;
    } catch (error) {
      console.error('[JournalService] ❌ Initialization failed:', error);
      return false;
    }
  }

  // Get journal entries for a user with optional filters
  async getEntries(userId, filters = {}) {
    return await OpenTelemetryTracing.traceOperation(
      'lifeos.journal.get_entries',
      {
        attributes: {
          'user.id': userId,
          'filter.has_date_range': !!(filters.startDate || filters.endDate),
          'filter.has_tags': !!filters.tags,
          'filter.has_mood': !!filters.mood,
        },
      },
      async span => {
        try {
          const {
            limit = 20,
            offset = 0,
            startDate,
            endDate,
            tags,
            mood,
          } = filters;

          let query = `
            SELECT id, title, content, mood_score, emotions, tags, weather, location,
                   sentiment_score, sentiment_analysis, word_count, created_at, updated_at
            FROM journal_entries 
            WHERE user_id = $1
          `;
          const params = [userId];
          let paramCount = 1;

          // Add filters
          if (startDate) {
            query += ` AND created_at >= $${++paramCount}`;
            params.push(startDate);
          }

          if (endDate) {
            query += ` AND created_at <= $${++paramCount}`;
            params.push(endDate);
          }

          if (tags && tags.length > 0) {
            query += ` AND tags && $${++paramCount}`;
            params.push(tags);
          }

          if (mood) {
            query += ` AND mood_score = $${++paramCount}`;
            params.push(mood);
          }

          query += ` ORDER BY created_at DESC LIMIT $${++paramCount} OFFSET $${++paramCount}`;
          params.push(limit, offset);

          const result = await this.dbPool.query(query, params);

          span.setAttributes({
            'entries.count': result.rows.length,
            'query.limit': limit,
            'query.offset': offset,
          });

          return {
            entries: result.rows,
            total: result.rowCount,
            limit,
            offset,
          };
        } catch (error) {
          console.error('[JournalService] Error fetching entries:', error);
          span.recordException(error);
          throw error;
        }
      }
    );
  }

  // Get a single journal entry
  async getEntry(entryId, userId) {
    return await OpenTelemetryTracing.traceOperation(
      'lifeos.journal.get_entry',
      {
        attributes: {
          'entry.id': entryId,
          'user.id': userId,
        },
      },
      async span => {
        try {
          const query = `
            SELECT * FROM journal_entries 
            WHERE id = $1 AND user_id = $2
          `;

          const result = await this.dbPool.query(query, [entryId, userId]);

          if (result.rows.length === 0) {
            throw new Error('Journal entry not found');
          }

          return result.rows[0];
        } catch (error) {
          console.error('[JournalService] Error fetching entry:', error);
          span.recordException(error);
          throw error;
        }
      }
    );
  }

  // Create a new journal entry
  async createEntry(userId, entryData) {
    return await OpenTelemetryTracing.traceOperation(
      'lifeos.journal.create',
      {
        attributes: {
          'user.id': userId,
          'entry.has_title': !!entryData.title,
          'entry.word_count': entryData.content
            ? entryData.content.split(' ').length
            : 0,
        },
      },
      async span => {
        try {
          const {
            title,
            content,
            mood_score,
            emotions = [],
            tags = [],
            weather,
            location,
            is_private = true,
          } = entryData;

          // Calculate word count
          const word_count = content ? content.split(/\s+/).length : 0;

          const query = `
            INSERT INTO journal_entries (
              user_id, title, content, mood_score, emotions, tags,
              weather, location, is_private, word_count, created_at, updated_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())
            RETURNING *
          `;

          const result = await this.dbPool.query(query, [
            userId,
            title,
            content,
            mood_score,
            emotions,
            tags,
            weather,
            location,
            is_private,
            word_count,
          ]);

          const newEntry = result.rows[0];

          // Update metrics
          this.entryCounter.add(1, {
            'user.id': userId,
            'entry.has_mood': !!mood_score,
          });

          // Schedule async enrichment
          this.scheduleEnrichment(newEntry.id);

          span.setAttributes({
            'entry.id': newEntry.id,
            'entry.word_count': word_count,
            'creation.success': true,
          });

          console.log(
            `[JournalService] ✅ Created entry: ${newEntry.id} for user ${userId}`
          );

          return newEntry;
        } catch (error) {
          console.error('[JournalService] Error creating entry:', error);
          span.recordException(error);
          throw error;
        }
      }
    );
  }

  // Update an existing journal entry
  async updateEntry(entryId, userId, updates) {
    return await OpenTelemetryTracing.traceOperation(
      'lifeos.journal.update',
      {
        attributes: {
          'entry.id': entryId,
          'user.id': userId,
        },
      },
      async span => {
        try {
          const {
            title,
            content,
            mood_score,
            emotions,
            tags,
            weather,
            location,
            is_private,
          } = updates;

          // Recalculate word count if content changed
          const word_count = content ? content.split(/\s+/).length : undefined;

          const query = `
            UPDATE journal_entries 
            SET title = COALESCE($1, title),
                content = COALESCE($2, content),
                mood_score = COALESCE($3, mood_score),
                emotions = COALESCE($4, emotions),
                tags = COALESCE($5, tags),
                weather = COALESCE($6, weather),
                location = COALESCE($7, location),
                is_private = COALESCE($8, is_private),
                word_count = COALESCE($9, word_count),
                updated_at = NOW()
            WHERE id = $10 AND user_id = $11
            RETURNING *
          `;

          const result = await this.dbPool.query(query, [
            title,
            content,
            mood_score,
            emotions,
            tags,
            weather,
            location,
            is_private,
            word_count,
            entryId,
            userId,
          ]);

          if (result.rows.length === 0) {
            throw new Error('Journal entry not found or access denied');
          }

          const updatedEntry = result.rows[0];

          // Re-schedule enrichment if content changed
          if (content) {
            this.scheduleEnrichment(updatedEntry.id);
          }

          span.setAttributes({
            'update.success': true,
          });

          return updatedEntry;
        } catch (error) {
          console.error('[JournalService] Error updating entry:', error);
          span.recordException(error);
          throw error;
        }
      }
    );
  }

  // Delete a journal entry
  async deleteEntry(entryId, userId) {
    return await OpenTelemetryTracing.traceOperation(
      'lifeos.journal.delete',
      {
        attributes: {
          'entry.id': entryId,
          'user.id': userId,
        },
      },
      async span => {
        try {
          const query = `
            DELETE FROM journal_entries 
            WHERE id = $1 AND user_id = $2
            RETURNING id
          `;

          const result = await this.dbPool.query(query, [entryId, userId]);

          if (result.rows.length === 0) {
            throw new Error('Journal entry not found or access denied');
          }

          span.setAttributes({
            'deletion.success': true,
          });

          return { deleted: true, id: entryId };
        } catch (error) {
          console.error('[JournalService] Error deleting entry:', error);
          span.recordException(error);
          throw error;
        }
      }
    );
  }

  // Derive tasks from journal entry
  async deriveTasksFromEntry(entryId, userId, constraints = {}) {
    return await OpenTelemetryTracing.traceOperation(
      'lifeos.journal.derive_tasks',
      {
        attributes: {
          'entry.id': entryId,
          'user.id': userId,
          'constraints.max_tasks': constraints.max_tasks || 5,
        },
      },
      async span => {
        try {
          // First, get the entry
          const entry = await this.getEntry(entryId, userId);

          const { max_tasks = 5, focus_domains = [] } = constraints;

          // Simple heuristic-based task derivation (can be enhanced with LLM later)
          const tasks = this.extractTasksFromContent(entry.content, {
            max_tasks,
            focus_domains,
            mood_score: entry.mood_score,
            sentiment_score: entry.sentiment_score,
          });

          span.setAttributes({
            'tasks.generated': tasks.length,
            'derivation.success': true,
          });

          return {
            source_entry: entryId,
            generated_at: new Date().toISOString(),
            tasks,
          };
        } catch (error) {
          console.error('[JournalService] Error deriving tasks:', error);
          span.recordException(error);
          throw error;
        }
      }
    );
  }

  // Extract tasks from content using heuristics
  extractTasksFromContent(content, options = {}) {
    const { max_tasks = 5, mood_score, sentiment_score } = options;
    const tasks = [];

    // Simple regex patterns to identify actionable items
    const actionPatterns = [
      /need to (.+)/gi,
      /should (.+)/gi,
      /must (.+)/gi,
      /have to (.+)/gi,
      /going to (.+)/gi,
      /plan to (.+)/gi,
      /remember to (.+)/gi,
    ];

    for (const pattern of actionPatterns) {
      const matches = content.matchAll(pattern);
      for (const match of matches) {
        if (tasks.length >= max_tasks) break;

        const taskText = match[1].trim();
        if (taskText.length > 10 && taskText.length < 100) {
          tasks.push({
            title: this.cleanTaskTitle(taskText),
            priority: this.determinePriority(
              taskText,
              mood_score,
              sentiment_score
            ),
            reason: `Extracted from journal reflection`,
          });
        }
      }
    }

    // If low sentiment, suggest self-care tasks
    if (sentiment_score < -0.3 && tasks.length < max_tasks) {
      tasks.push({
        title: 'Schedule 30 minutes of self-care time',
        priority: 'high',
        reason: 'Low mood detected in journal entry',
      });
    }

    return tasks.slice(0, max_tasks);
  }

  // Clean and format task titles
  cleanTaskTitle(text) {
    return text
      .replace(/[.!?]+$/, '') // Remove trailing punctuation
      .split(' ')
      .map((word, i) =>
        i === 0
          ? word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
          : word.toLowerCase()
      )
      .join(' ');
  }

  // Determine task priority based on content and mood
  determinePriority(taskText, moodScore, sentimentScore) {
    const urgentWords = [
      'urgent',
      'asap',
      'immediately',
      'deadline',
      'critical',
    ];
    const importantWords = [
      'important',
      'crucial',
      'vital',
      'key',
      'significant',
    ];

    const hasUrgent = urgentWords.some(word =>
      taskText.toLowerCase().includes(word)
    );
    const hasImportant = importantWords.some(word =>
      taskText.toLowerCase().includes(word)
    );

    if (hasUrgent || (moodScore && moodScore <= 3)) return 'high';
    if (hasImportant || (sentimentScore && sentimentScore < -0.1))
      return 'medium';
    return 'low';
  }

  // Schedule async enrichment (placeholder for future implementation)
  scheduleEnrichment(entryId) {
    // TODO: Implement async sentiment analysis and enrichment
    console.log(
      `[JournalService] 📋 Scheduled enrichment for entry: ${entryId}`
    );
  }

  // Get service health status
  getHealthStatus() {
    return {
      status: 'healthy',
      metrics: {
        entries_created: this.entryCounter._value || 0,
        enrichment_failures: this.enrichmentCounter._value || 0,
      },
    };
  }

  // Cleanup resources
  async cleanup() {
    if (this.dbPool) {
      await this.dbPool.end();
    }
  }
}

const MessageBus = require('../../system/MessageBus');
const { Pool } = require('pg');

class UserProfile {
  constructor() {
    this.profiles = new Map(); // userId -> profile data
    this.preferences = new Map(); // userId -> user preferences
    this.interactionPatterns = new Map(); // userId -> interaction analysis
    this.learningHistory = new Map(); // userId -> learning and growth tracking

    // Initialize database connection
    if (process.env.DATABASE_URL) {
      this.pool = new Pool({ connectionString: process.env.DATABASE_URL });
    } else {
      this.pool = null;
      console.warn(
        '[UserProfile] Database connection not available, using memory only.'
      );
    }

    // Listen for profile-related events
    MessageBus.on('user:message', this.analyzeInteraction.bind(this));
    MessageBus.on('user:preference-update', this.updatePreference.bind(this));
    MessageBus.on('user:learning-event', this.recordLearning.bind(this));
    MessageBus.on('profile:request', this.getProfile.bind(this));

    console.log(
      '[UserProfile] Advanced user profiling and learning system initialized.'
    );
  }

  async getProfile(requestData) {
    const { userId } = requestData;

    if (!this.profiles.has(userId)) {
      await this.initializeProfile(userId);
    }

    const profile = this.profiles.get(userId);
    const preferences = this.preferences.get(userId) || {};
    const patterns = this.interactionPatterns.get(userId) || {};
    const learning = this.learningHistory.get(userId) || {};

    return {
      profile: {
        ...profile,
        preferences,
        interactionPatterns: {
          communicationStyle: patterns.communicationStyle || 'adaptive',
          preferredTopics: patterns.preferredTopics || [],
          responseLength: patterns.responseLength || 'medium',
          formalityLevel: patterns.formalityLevel || 'balanced',
          helpfulnessScore: patterns.helpfulnessScore || 0.5,
        },
        learningProgress: {
          topicsExplored: learning.topicsExplored || [],
          skillsAcquired: learning.skillsAcquired || [],
          knowledgeGaps: learning.knowledgeGaps || [],
          learningStyle: learning.learningStyle || 'mixed',
        },
      },
    };
  }

  async initializeProfile(userId) {
    // Load from database if available
    if (this.pool) {
      try {
        const result = await this.pool.query(
          'SELECT * FROM user_profiles WHERE user_id = $1',
          [userId]
        );

        if (result.rows.length > 0) {
          const dbProfile = result.rows[0];
          this.profiles.set(userId, {
            userId,
            created: dbProfile.created_at,
            lastActive: dbProfile.last_active,
            totalInteractions: dbProfile.total_interactions || 0,
            profileData: dbProfile.profile_data || {},
          });
          return;
        }
      } catch (error) {
        console.warn('[UserProfile] Database load failed:', error.message);
      }
    }

    // Initialize new profile
    const newProfile = {
      userId,
      created: new Date().toISOString(),
      lastActive: new Date().toISOString(),
      totalInteractions: 0,
      profileData: {
        communicationPreferences: {},
        topicInterests: {},
        learningGoals: [],
        personalityTraits: {},
        contextualMemory: [],
      },
    };

    this.profiles.set(userId, newProfile);
    this.preferences.set(userId, {
      language: 'en',
      responseStyle: 'balanced',
      privacyLevel: 'standard',
      notifications: true,
    });
    this.interactionPatterns.set(userId, {
      messageCount: 0,
      avgMessageLength: 0,
      topicFrequency: {},
      timePatterns: {},
      emotionalTone: 'neutral',
    });
    this.learningHistory.set(userId, {
      sessionsCompleted: 0,
      topicsExplored: [],
      skillsAcquired: [],
      challengesAttempted: [],
      progressMarkers: [],
    });

    // Save to database
    await this.saveProfile(userId);
  }

  async analyzeInteraction(messageData) {
    const { userId, text, timestamp, metadata = {} } = messageData;

    if (!userId || !text) return;

    // Ensure profile exists
    if (!this.profiles.has(userId)) {
      await this.initializeProfile(userId);
    }

    // Update interaction patterns
    const patterns = this.interactionPatterns.get(userId);
    patterns.messageCount++;
    patterns.avgMessageLength =
      (patterns.avgMessageLength * (patterns.messageCount - 1) + text.length) /
      patterns.messageCount;

    // Analyze topics mentioned
    const topics = this.extractTopics(text);
    topics.forEach(topic => {
      patterns.topicFrequency[topic] =
        (patterns.topicFrequency[topic] || 0) + 1;
    });

    // Analyze time patterns
    const hour = new Date(timestamp).getHours();
    patterns.timePatterns[hour] = (patterns.timePatterns[hour] || 0) + 1;

    // Analyze emotional tone (simple sentiment analysis)
    patterns.emotionalTone = this.analyzeEmotionalTone(text);

    // Update profile
    const profile = this.profiles.get(userId);
    profile.lastActive = new Date().toISOString();
    profile.totalInteractions++;

    // Add to contextual memory (keep last 10 significant interactions)
    if (this.isSignificantInteraction(text, metadata)) {
      profile.profileData.contextualMemory.push({
        text: text.substring(0, 200),
        timestamp,
        topics,
        emotionalTone: patterns.emotionalTone,
        significance: this.calculateSignificance(text, metadata),
      });

      // Keep only most recent significant interactions
      if (profile.profileData.contextualMemory.length > 10) {
        profile.profileData.contextualMemory =
          profile.profileData.contextualMemory
            .sort((a, b) => b.significance - a.significance)
            .slice(0, 10);
      }
    }

    this.interactionPatterns.set(userId, patterns);
    this.profiles.set(userId, profile);

    // Periodic profile save (every 10 interactions)
    if (profile.totalInteractions % 10 === 0) {
      await this.saveProfile(userId);
    }
  }

  extractTopics(text) {
    // Simple topic extraction - could be enhanced with NLP
    const topicKeywords = {
      technology: [
        'tech',
        'computer',
        'software',
        'programming',
        'code',
        'ai',
        'algorithm',
      ],
      science: [
        'research',
        'study',
        'experiment',
        'theory',
        'data',
        'analysis',
      ],
      creativity: [
        'art',
        'design',
        'creative',
        'music',
        'write',
        'draw',
        'imagine',
      ],
      business: [
        'work',
        'job',
        'career',
        'money',
        'business',
        'marketing',
        'strategy',
      ],
      health: ['health', 'exercise', 'diet', 'wellness', 'medical', 'fitness'],
      relationships: [
        'friend',
        'family',
        'relationship',
        'social',
        'people',
        'communication',
      ],
      learning: [
        'learn',
        'study',
        'education',
        'knowledge',
        'skill',
        'practice',
        'understand',
      ],
      philosophy: [
        'meaning',
        'purpose',
        'ethics',
        'moral',
        'belief',
        'value',
        'principle',
      ],
    };

    const lowerText = text.toLowerCase();
    const detectedTopics = [];

    for (const [topic, keywords] of Object.entries(topicKeywords)) {
      if (keywords.some(keyword => lowerText.includes(keyword))) {
        detectedTopics.push(topic);
      }
    }

    return detectedTopics;
  }

  analyzeEmotionalTone(text) {
    const lowerText = text.toLowerCase();

    const emotionalIndicators = {
      positive: [
        'happy',
        'excited',
        'great',
        'awesome',
        'love',
        'enjoy',
        'wonderful',
        'amazing',
      ],
      negative: [
        'sad',
        'angry',
        'frustrated',
        'hate',
        'terrible',
        'awful',
        'worried',
        'stressed',
      ],
      curious: [
        'why',
        'how',
        'what',
        'when',
        'where',
        'curious',
        'wonder',
        'interested',
      ],
      confident: [
        'sure',
        'definitely',
        'certain',
        'confident',
        'absolutely',
        'convinced',
      ],
      uncertain: [
        'maybe',
        'perhaps',
        'might',
        'unsure',
        'confused',
        'doubt',
        'unclear',
      ],
    };

    let maxScore = 0;
    let dominantTone = 'neutral';

    for (const [tone, indicators] of Object.entries(emotionalIndicators)) {
      const score = indicators.reduce((count, indicator) => {
        return count + (lowerText.split(indicator).length - 1);
      }, 0);

      if (score > maxScore) {
        maxScore = score;
        dominantTone = tone;
      }
    }

    return dominantTone;
  }

  isSignificantInteraction(text, metadata) {
    // Determine if an interaction is significant enough to remember
    return (
      text.length > 50 || // Longer messages
      text.includes('?') || // Questions
      metadata.important || // Explicitly marked
      /\b(learn|understand|help|problem|solution|important)\b/i.test(text)
    ); // Key topics
  }

  calculateSignificance(text, metadata) {
    let significance = 0;

    // Length factor
    significance += Math.min(text.length / 100, 1);

    // Question factor
    if (text.includes('?')) significance += 0.5;

    // Metadata factors
    if (metadata.important) significance += 1;
    if (metadata.emotional) significance += 0.3;

    // Topic relevance
    const topics = this.extractTopics(text);
    significance += topics.length * 0.2;

    return Math.min(significance, 2); // Cap at 2
  }

  async updatePreference(preferenceData) {
    const { userId, key, value } = preferenceData;

    if (!this.preferences.has(userId)) {
      await this.initializeProfile(userId);
    }

    const prefs = this.preferences.get(userId);
    prefs[key] = value;
    prefs.lastUpdated = new Date().toISOString();

    this.preferences.set(userId, prefs);
    await this.saveProfile(userId);

    MessageBus.emit('profile:preference-updated', { userId, key, value });
  }

  async recordLearning(learningData) {
    const { userId, topic, skill, challenge, progress } = learningData;

    if (!this.learningHistory.has(userId)) {
      await this.initializeProfile(userId);
    }

    const learning = this.learningHistory.get(userId);

    if (topic && !learning.topicsExplored.includes(topic)) {
      learning.topicsExplored.push(topic);
    }

    if (skill && !learning.skillsAcquired.includes(skill)) {
      learning.skillsAcquired.push(skill);
    }

    if (challenge) {
      learning.challengesAttempted.push({
        challenge,
        timestamp: new Date().toISOString(),
        success: challenge.success || false,
      });
    }

    if (progress) {
      learning.progressMarkers.push({
        ...progress,
        timestamp: new Date().toISOString(),
      });
    }

    learning.lastUpdate = new Date().toISOString();
    this.learningHistory.set(userId, learning);

    MessageBus.emit('profile:learning-recorded', { userId, learningData });
  }

  async saveProfile(userId) {
    if (!this.pool) return;

    try {
      const profile = this.profiles.get(userId);
      const preferences = this.preferences.get(userId);
      const patterns = this.interactionPatterns.get(userId);
      const learning = this.learningHistory.get(userId);

      await this.pool.query(
        `
        INSERT INTO user_profiles (user_id, profile_data, preferences, interaction_patterns, learning_history, last_active, total_interactions)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (user_id) 
        DO UPDATE SET 
          profile_data = $2,
          preferences = $3,
          interaction_patterns = $4,
          learning_history = $5,
          last_active = $6,
          total_interactions = $7
      `,
        [
          userId,
          JSON.stringify(profile?.profileData || {}),
          JSON.stringify(preferences || {}),
          JSON.stringify(patterns || {}),
          JSON.stringify(learning || {}),
          profile?.lastActive || new Date().toISOString(),
          profile?.totalInteractions || 0,
        ]
      );
    } catch (error) {
      console.warn('[UserProfile] Database save failed:', error.message);
    }
  }

  getProfileSummary(userId) {
    const profile = this.profiles.get(userId);
    const patterns = this.interactionPatterns.get(userId);
    const learning = this.learningHistory.get(userId);

    if (!profile) return null;

    return {
      userId,
      active: true,
      totalInteractions: profile.totalInteractions,
      lastActive: profile.lastActive,
      communicationStyle: patterns?.emotionalTone || 'neutral',
      topTopics: Object.entries(patterns?.topicFrequency || {})
        .sort(([, a], [, b]) => b - a)
        .slice(0, 3)
        .map(([topic]) => topic),
      learningProgress: {
        topicsExplored: learning?.topicsExplored?.length || 0,
        skillsAcquired: learning?.skillsAcquired?.length || 0,
      },
    };
  }

  getSystemStats() {
    return {
      totalProfiles: this.profiles.size,
      activeProfiles: Array.from(this.profiles.values()).filter(
        p =>
          new Date(p.lastActive) >
          new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
      ).length,
      totalInteractions: Array.from(this.profiles.values()).reduce(
        (sum, p) => sum + p.totalInteractions,
        0
      ),
      memoryUsage: {
        profiles: this.profiles.size,
        preferences: this.preferences.size,
        patterns: this.interactionPatterns.size,
        learning: this.learningHistory.size,
      },
    };
  }
}

module.exports = new UserProfile();

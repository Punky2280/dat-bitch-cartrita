import BaseAgent from '../../system/BaseAgent.js';

class ConversationStore extends BaseAgent {
  constructor() {
    super('ConversationStore', 'main', [
      'conversation_storage',
      'message_retrieval',
      'context_management',
      'session_tracking',
      'conversation_analysis',
    ]);

    this.conversations = new Map();
    this.userSessions = new Map();
    this.conversationMetrics = new Map();
    this.initializeStorageFramework();
  }

  async onInitialize() {
    this.registerTaskHandler({
      taskType: 'store_conversation',
      handler: this.storeConversation.bind(this),
    });
    this.registerTaskHandler({
      taskType: 'retrieve_conversation',
      handler: this.retrieveConversation.bind(this),
    });
    this.registerTaskHandler({
      taskType: 'search_conversations',
      handler: this.searchConversations.bind(this),
    });
    this.registerTaskHandler({
      taskType: 'analyze_conversation',
      handler: this.analyzeConversation.bind(this),
    });

    console.log(
      '[ConversationStore] Conversation storage and retrieval system initialized'
    );
  }

  initializeStorageFramework() {
    // Initialize storage metrics
    this.conversationMetrics.set('total_conversations', 0);
    this.conversationMetrics.set('total_messages', 0);
    this.conversationMetrics.set('active_sessions', 0);
    this.conversationMetrics.set('storage_size', 0);
  }

  async storeConversation(payload, userId, language) {
    try {
      const {
        conversation_id,
        messages = [],
        metadata = {},
        session_info = {},
      } = payload;

      if (!conversation_id) {
        throw new Error('Conversation ID is required');
      }

      const storage = await this.performConversationStorage(
        conversation_id,
        messages,
        metadata,
        session_info,
        userId
      );

      return {
        storage_successful: true,
        conversation_id: conversation_id,
        messages_stored: storage.messagesStored,
        storage_size: storage.storageSize,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      console.error('[ConversationStore] Error storing conversation:', error);
      throw error;
    }
  }

  async performConversationStorage(
    conversationId,
    messages,
    metadata,
    sessionInfo,
    userId
  ) {
    // Create or update conversation record
    const conversation = {
      id: conversationId,
      user_id: userId,
      messages: messages,
      metadata: {
        ...metadata,
        created_at: metadata.created_at || new Date().toISOString(),
        updated_at: new Date().toISOString(),
        message_count: messages.length,
      },
      session_info: sessionInfo,
    };

    // Store conversation
    this.conversations.set(conversationId, conversation);

    // Update metrics
    this.conversationMetrics.set(
      'total_conversations',
      this.conversations.size
    );
    this.conversationMetrics.set(
      'total_messages',
      this.conversationMetrics.get('total_messages') + messages.length
    );

    // Update user session tracking
    this.updateUserSession(userId, conversationId, sessionInfo);

    return {
      messagesStored: messages.length,
      storageSize: JSON.stringify(conversation).length,
    };
  }

  updateUserSession(userId, conversationId, sessionInfo) {
    if (!this.userSessions.has(userId)) {
      this.userSessions.set(userId, {
        active_conversations: [],
        session_history: [],
        last_activity: new Date().toISOString(),
      });
    }

    const userSession = this.userSessions.get(userId);

    // Add to active conversations if not already present
    if (!userSession.active_conversations.includes(conversationId)) {
      userSession.active_conversations.push(conversationId);
    }

    // Update session history
    userSession.session_history.push({
      conversation_id: conversationId,
      timestamp: new Date().toISOString(),
      session_info: sessionInfo,
    });

    // Keep only recent session history
    if (userSession.session_history.length > 50) {
      userSession.session_history = userSession.session_history.slice(-25);
    }

    userSession.last_activity = new Date().toISOString();
  }

  async retrieveConversation(payload, userId, language) {
    try {
      const {
        conversation_id,
        include_metadata = true,
        message_limit = null,
        message_offset = 0,
      } = payload;

      if (!conversation_id) {
        throw new Error('Conversation ID is required');
      }

      const retrieval = await this.performConversationRetrieval(
        conversation_id,
        include_metadata,
        message_limit,
        message_offset,
        userId
      );

      return {
        retrieval_successful: true,
        conversation_id: conversation_id,
        conversation: retrieval.conversation,
        message_count: retrieval.messageCount,
        has_more_messages: retrieval.hasMoreMessages,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      console.error(
        '[ConversationStore] Error retrieving conversation:',
        error
      );
      throw error;
    }
  }

  async performConversationRetrieval(
    conversationId,
    includeMetadata,
    messageLimit,
    messageOffset,
    userId
  ) {
    const conversation = this.conversations.get(conversationId);

    if (!conversation) {
      throw new Error(`Conversation not found: ${conversationId}`);
    }

    // Check user access
    if (conversation.user_id !== userId) {
      throw new Error('Access denied to conversation');
    }

    let messages = conversation.messages;
    let hasMoreMessages = false;

    // Apply pagination if requested
    if (messageLimit) {
      const startIndex = messageOffset;
      const endIndex = startIndex + messageLimit;
      messages = conversation.messages.slice(startIndex, endIndex);
      hasMoreMessages = endIndex < conversation.messages.length;
    }

    const result = {
      conversation: {
        id: conversation.id,
        messages: messages,
        ...(includeMetadata && { metadata: conversation.metadata }),
        ...(includeMetadata && { session_info: conversation.session_info }),
      },
      messageCount: messages.length,
      hasMoreMessages: hasMoreMessages,
    };

    return result;
  }

  async searchConversations(payload, userId, language) {
    try {
      const {
        query,
        search_type = 'content',
        time_range = 'all',
        limit = 10,
        include_metadata = false,
      } = payload;

      const search = await this.performConversationSearch(
        query,
        search_type,
        time_range,
        limit,
        include_metadata,
        userId
      );

      return {
        search_completed: true,
        query: query,
        search_type: search_type,
        results: search.results,
        result_count: search.results.length,
        total_matches: search.totalMatches,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      console.error(
        '[ConversationStore] Error searching conversations:',
        error
      );
      throw error;
    }
  }

  async performConversationSearch(
    query,
    searchType,
    timeRange,
    limit,
    includeMetadata,
    userId
  ) {
    const userConversations = Array.from(this.conversations.values()).filter(
      conv => conv.user_id === userId
    );

    let results = [];

    // Apply time range filter
    const filteredConversations = this.filterByTimeRange(
      userConversations,
      timeRange
    );

    // Perform search based on type
    switch (searchType) {
      case 'content':
        results = this.searchByContent(filteredConversations, query);
        break;
      case 'metadata':
        results = this.searchByMetadata(filteredConversations, query);
        break;
      case 'date':
        results = this.searchByDate(filteredConversations, query);
        break;
      default:
        results = this.searchByContent(filteredConversations, query);
    }

    // Sort by relevance (simplified)
    results.sort((a, b) => b.relevance_score - a.relevance_score);

    // Apply limit
    const limitedResults = results.slice(0, limit);

    // Format results
    const formattedResults = limitedResults.map(result => ({
      conversation_id: result.conversation.id,
      relevance_score: result.relevance_score,
      matching_context: result.matching_context,
      ...(includeMetadata && { metadata: result.conversation.metadata }),
    }));

    return {
      results: formattedResults,
      totalMatches: results.length,
    };
  }

  searchByContent(conversations, query) {
    const results = [];
    const queryLower = query.toLowerCase();

    conversations.forEach(conversation => {
      const matches = conversation.messages.filter(
        message =>
          message.content && message.content.toLowerCase().includes(queryLower)
      );

      if (matches.length > 0) {
        const relevanceScore = matches.length / conversation.messages.length;
        results.push({
          conversation: conversation,
          relevance_score: relevanceScore,
          matching_context: matches
            .slice(0, 3)
            .map(m => m.content.substring(0, 100)),
        });
      }
    });

    return results;
  }

  searchByMetadata(conversations, query) {
    const results = [];
    const queryLower = query.toLowerCase();

    conversations.forEach(conversation => {
      const metadataStr = JSON.stringify(conversation.metadata).toLowerCase();
      if (metadataStr.includes(queryLower)) {
        results.push({
          conversation: conversation,
          relevance_score: 0.8,
          matching_context: ['Metadata match'],
        });
      }
    });

    return results;
  }

  searchByDate(conversations, dateQuery) {
    const results = [];
    const targetDate = new Date(dateQuery);

    conversations.forEach(conversation => {
      const createdDate = new Date(conversation.metadata.created_at);
      const daysDiff =
        Math.abs(targetDate - createdDate) / (1000 * 60 * 60 * 24);

      if (daysDiff <= 1) {
        // Within 1 day
        results.push({
          conversation: conversation,
          relevance_score: Math.max(0.1, 1 - daysDiff),
          matching_context: [`Date: ${conversation.metadata.created_at}`],
        });
      }
    });

    return results;
  }

  filterByTimeRange(conversations, timeRange) {
    if (timeRange === 'all') {
      return conversations;
    }

    const now = new Date();
    const cutoff = new Date(now.getTime() - this.parseTimeRange(timeRange));

    return conversations.filter(
      conversation => new Date(conversation.metadata.created_at) >= cutoff
    );
  }

  parseTimeRange(timeRange) {
    const units = { h: 3600000, d: 86400000, w: 604800000, m: 2592000000 };
    const match = timeRange.match(/(\d+)([hdwm])/);
    if (match) {
      return parseInt(match[1]) * (units[match[2]] || units.d);
    }
    return 86400000; // Default 24 hours
  }

  async analyzeConversation(payload, userId, language) {
    try {
      const {
        conversation_id,
        analysis_type = 'summary',
        include_sentiment = false,
        include_topics = false,
      } = payload;

      if (!conversation_id) {
        throw new Error('Conversation ID is required');
      }

      const analysis = await this.performConversationAnalysis(
        conversation_id,
        analysis_type,
        include_sentiment,
        include_topics,
        userId
      );

      return {
        analysis_completed: true,
        conversation_id: conversation_id,
        analysis_type: analysis_type,
        analysis: analysis.results,
        insights: analysis.insights,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      console.error('[ConversationStore] Error analyzing conversation:', error);
      throw error;
    }
  }

  async performConversationAnalysis(
    conversationId,
    analysisType,
    includeSentiment,
    includeTopics,
    userId
  ) {
    const conversation = this.conversations.get(conversationId);

    if (!conversation) {
      throw new Error(`Conversation not found: ${conversationId}`);
    }

    if (conversation.user_id !== userId) {
      throw new Error('Access denied to conversation');
    }

    const analysis = {
      results: {},
      insights: [],
    };

    // Basic conversation statistics
    analysis.results.basic_stats = {
      total_messages: conversation.messages.length,
      user_messages: conversation.messages.filter(m => m.role === 'user')
        .length,
      assistant_messages: conversation.messages.filter(
        m => m.role === 'assistant'
      ).length,
      conversation_duration: this.calculateConversationDuration(conversation),
      average_message_length: this.calculateAverageMessageLength(
        conversation.messages
      ),
    };

    // Sentiment analysis (simplified)
    if (includeSentiment) {
      analysis.results.sentiment = this.analyzeSentiment(conversation.messages);
    }

    // Topic extraction (simplified)
    if (includeTopics) {
      analysis.results.topics = this.extractTopics(conversation.messages);
    }

    // Generate insights
    analysis.insights = this.generateConversationInsights(analysis.results);

    return analysis;
  }

  calculateConversationDuration(conversation) {
    if (conversation.messages.length < 2) {
      return 0;
    }

    const firstMessage = conversation.messages[0];
    const lastMessage = conversation.messages[conversation.messages.length - 1];

    if (firstMessage.timestamp && lastMessage.timestamp) {
      return new Date(lastMessage.timestamp) - new Date(firstMessage.timestamp);
    }

    return 0;
  }

  calculateAverageMessageLength(messages) {
    if (messages.length === 0) return 0;

    const totalLength = messages.reduce(
      (sum, message) => sum + (message.content ? message.content.length : 0),
      0
    );

    return totalLength / messages.length;
  }

  analyzeSentiment(messages) {
    // Simplified sentiment analysis
    const sentiments = { positive: 0, neutral: 0, negative: 0 };

    messages.forEach(message => {
      if (!message.content) return;

      const content = message.content.toLowerCase();
      const positiveWords = [
        'good',
        'great',
        'excellent',
        'happy',
        'love',
        'awesome',
      ];
      const negativeWords = [
        'bad',
        'terrible',
        'sad',
        'hate',
        'awful',
        'horrible',
      ];

      const positiveCount = positiveWords.filter(word =>
        content.includes(word)
      ).length;
      const negativeCount = negativeWords.filter(word =>
        content.includes(word)
      ).length;

      if (positiveCount > negativeCount) {
        sentiments.positive++;
      } else if (negativeCount > positiveCount) {
        sentiments.negative++;
      } else {
        sentiments.neutral++;
      }
    });

    return sentiments;
  }

  extractTopics(messages) {
    // Simplified topic extraction
    const topics = new Map();

    messages.forEach(message => {
      if (!message.content) return;

      const words = message.content
        .toLowerCase()
        .split(/\W+/)
        .filter(word => word.length > 3);

      words.forEach(word => {
        topics.set(word, (topics.get(word) || 0) + 1);
      });
    });

    // Return top 10 topics
    return Array.from(topics.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([topic, count]) => ({ topic, count }));
  }

  generateConversationInsights(results) {
    const insights = [];

    if (results.basic_stats) {
      const stats = results.basic_stats;

      if (stats.total_messages > 20) {
        insights.push({
          type: 'engagement',
          insight: 'This was a highly engaged conversation with many exchanges',
          confidence: 0.8,
        });
      }

      if (stats.average_message_length > 200) {
        insights.push({
          type: 'detail',
          insight: 'Messages were detailed and comprehensive',
          confidence: 0.7,
        });
      }
    }

    if (results.sentiment) {
      const { positive, negative, neutral } = results.sentiment;
      const total = positive + negative + neutral;

      if (positive / total > 0.6) {
        insights.push({
          type: 'sentiment',
          insight: 'Overall conversation sentiment was positive',
          confidence: 0.6,
        });
      }
    }

    return insights;
  }

  getStorageStats() {
    return {
      total_conversations: this.conversations.size,
      total_messages: this.conversationMetrics.get('total_messages'),
      active_sessions: this.userSessions.size,
      storage_size_bytes: Array.from(this.conversations.values()).reduce(
        (size, conv) => size + JSON.stringify(conv).length,
        0
      ),
    };
  }
}

export default ConversationStore;

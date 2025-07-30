const BaseAgent = require('../../system/BaseAgent');

class PersonalizationAgent extends BaseAgent {
  constructor() {
    super('PersonalizationAgent', 'main', [
      'user_preference_learning',
      'content_adaptation',
      'interface_customization',
      'behavior_pattern_analysis',
      'recommendation_generation'
    ]);
    
    this.userProfiles = new Map();
    this.adaptationRules = new Map();
    this.learningModels = new Map();
  }

  async onInitialize() {
    this.registerTaskHandler('learn_preferences', this.learnPreferences.bind(this));
    this.registerTaskHandler('adapt_content', this.adaptContent.bind(this));
    this.registerTaskHandler('customize_interface', this.customizeInterface.bind(this));
    this.registerTaskHandler('analyze_behavior', this.analyzeBehavior.bind(this));
    this.registerTaskHandler('generate_recommendations', this.generateRecommendations.bind(this));
    this.registerTaskHandler('get_personalization', this.getPersonalization.bind(this));
    
    console.log('[PersonalizationAgent] Specialized handlers registered');
  }

  async learnPreferences(prompt, language, userId, payload) {
    try {
      const { interactions, preferences, feedback } = payload;
      
      if (!this.userProfiles.has(userId)) {
        this.userProfiles.set(userId, {
          preferences: {},
          behavior_patterns: {},
          interaction_history: [],
          learning_score: 0,
          last_updated: new Date()
        });
      }
      
      const profile = this.userProfiles.get(userId);
      
      // Update preferences from explicit feedback
      if (preferences) {
        Object.assign(profile.preferences, preferences);
      }
      
      // Learn from interactions
      if (interactions) {
        profile.interaction_history.push(...interactions);
        await this.analyzeInteractionPatterns(userId, interactions);
      }
      
      // Process feedback
      if (feedback) {
        await this.processFeedback(userId, feedback);
      }
      
      profile.last_updated = new Date();
      profile.learning_score += 1;
      
      return {
        status: 'preferences_learned',
        user_id: userId,
        profile_updated: true,
        learning_score: profile.learning_score,
        preferences_count: Object.keys(profile.preferences).length
      };
      
    } catch (error) {
      console.error('[PersonalizationAgent] Error learning preferences:', error);
      throw error;
    }
  }

  async adaptContent(prompt, language, userId, payload) {
    try {
      const { content, content_type, context } = payload;
      
      const profile = this.userProfiles.get(userId);
      if (!profile) {
        return {
          adapted_content: content,
          adaptations_applied: [],
          message: 'No user profile found, returning original content'
        };
      }
      
      const adaptations = [];
      let adaptedContent = content;
      
      // Apply language preferences
      if (profile.preferences.language && profile.preferences.language !== language) {
        adaptations.push('language_adjustment');
      }
      
      // Apply complexity preferences
      if (profile.preferences.content_complexity) {
        adaptedContent = await this.adjustContentComplexity(
          adaptedContent, 
          profile.preferences.content_complexity
        );
        adaptations.push('complexity_adjustment');
      }
      
      // Apply tone preferences
      if (profile.preferences.communication_tone) {
        adaptedContent = await this.adjustContentTone(
          adaptedContent,
          profile.preferences.communication_tone
        );
        adaptations.push('tone_adjustment');
      }
      
      // Apply length preferences
      if (profile.preferences.content_length) {
        adaptedContent = await this.adjustContentLength(
          adaptedContent,
          profile.preferences.content_length
        );
        adaptations.push('length_adjustment');
      }
      
      return {
        adapted_content: adaptedContent,
        adaptations_applied: adaptations,
        original_length: content.length,
        adapted_length: adaptedContent.length,
        user_profile_used: true
      };
      
    } catch (error) {
      console.error('[PersonalizationAgent] Error adapting content:', error);
      throw error;
    }
  }

  async customizeInterface(prompt, language, userId, payload) {
    try {
      const { interface_elements, context } = payload;
      
      const profile = this.userProfiles.get(userId);
      if (!profile) {
        return {
          customized_interface: interface_elements,
          customizations_applied: [],
          message: 'No user profile found, returning default interface'
        };
      }
      
      const customizations = [];
      let customizedInterface = { ...interface_elements };
      
      // Apply theme preferences
      if (profile.preferences.theme) {
        customizedInterface.theme = profile.preferences.theme;
        customizations.push('theme_applied');
      }
      
      // Apply layout preferences
      if (profile.preferences.layout) {
        customizedInterface.layout = profile.preferences.layout;
        customizations.push('layout_applied');
      }
      
      // Apply component visibility preferences
      if (profile.preferences.visible_components) {
        customizedInterface.components = this.filterComponents(
          customizedInterface.components,
          profile.preferences.visible_components
        );
        customizations.push('component_visibility_applied');
      }
      
      // Apply accessibility preferences
      if (profile.preferences.accessibility) {
        customizedInterface.accessibility = profile.preferences.accessibility;
        customizations.push('accessibility_applied');
      }
      
      return {
        customized_interface: customizedInterface,
        customizations_applied: customizations,
        user_preferences_count: Object.keys(profile.preferences).length
      };
      
    } catch (error) {
      console.error('[PersonalizationAgent] Error customizing interface:', error);
      throw error;
    }
  }

  async analyzeBehavior(prompt, language, userId, payload) {
    try {
      const { timeframe = '30d', analysis_type = 'comprehensive' } = payload;
      
      const profile = this.userProfiles.get(userId);
      if (!profile || !profile.interaction_history.length) {
        return {
          behavior_patterns: {},
          insights: [],
          message: 'Insufficient interaction data for analysis'
        };
      }
      
      const patterns = {
        usage_frequency: this.analyzeUsageFrequency(profile.interaction_history),
        preferred_features: this.analyzeFeaturePreferences(profile.interaction_history),
        interaction_times: this.analyzeInteractionTimes(profile.interaction_history),
        task_complexity: this.analyzeTaskComplexity(profile.interaction_history),
        error_patterns: this.analyzeErrorPatterns(profile.interaction_history)
      };
      
      const insights = this.generateBehaviorInsights(patterns);
      
      return {
        behavior_patterns: patterns,
        insights: insights,
        analysis_period: timeframe,
        total_interactions: profile.interaction_history.length,
        profile_completeness: this.calculateProfileCompleteness(profile)
      };
      
    } catch (error) {
      console.error('[PersonalizationAgent] Error analyzing behavior:', error);
      throw error;
    }
  }

  async generateRecommendations(prompt, language, userId, payload) {
    try {
      const { recommendation_type = 'general', context } = payload;
      
      const profile = this.userProfiles.get(userId);
      if (!profile) {
        return {
          recommendations: [],
          message: 'No user profile found for recommendations'
        };
      }
      
      const recommendations = [];
      
      switch (recommendation_type) {
        case 'features':
          recommendations.push(...this.generateFeatureRecommendations(profile));
          break;
        case 'content':
          recommendations.push(...this.generateContentRecommendations(profile));
          break;
        case 'workflow':
          recommendations.push(...this.generateWorkflowRecommendations(profile));
          break;
        case 'settings':
          recommendations.push(...this.generateSettingsRecommendations(profile));
          break;
        default:
          recommendations.push(...this.generateGeneralRecommendations(profile));
      }
      
      // Score and rank recommendations
      const rankedRecommendations = this.rankRecommendations(recommendations, profile);
      
      return {
        recommendations: rankedRecommendations,
        recommendation_type: recommendation_type,
        total_count: rankedRecommendations.length,
        user_profile_score: profile.learning_score
      };
      
    } catch (error) {
      console.error('[PersonalizationAgent] Error generating recommendations:', error);
      throw error;
    }
  }

  async getPersonalization(prompt, language, userId, payload) {
    try {
      const profile = this.userProfiles.get(userId);
      
      if (!profile) {
        return {
          personalization_available: false,
          message: 'No personalization data available for user'
        };
      }
      
      return {
        personalization_available: true,
        user_preferences: profile.preferences,
        behavior_summary: {
          total_interactions: profile.interaction_history.length,
          learning_score: profile.learning_score,
          last_updated: profile.last_updated,
          profile_completeness: this.calculateProfileCompleteness(profile)
        },
        available_customizations: [
          'content_adaptation',
          'interface_customization',
          'recommendation_generation',
          'behavior_prediction'
        ]
      };
      
    } catch (error) {
      console.error('[PersonalizationAgent] Error getting personalization:', error);
      throw error;
    }
  }

  async analyzeInteractionPatterns(userId, interactions) {
    const profile = this.userProfiles.get(userId);
    
    // Extract patterns from interactions
    const patterns = {
      feature_usage: {},
      error_frequency: 0,
      task_success_rate: 0,
      session_duration: 0
    };
    
    interactions.forEach(interaction => {
      // Count feature usage
      if (interaction.feature) {
        patterns.feature_usage[interaction.feature] = 
          (patterns.feature_usage[interaction.feature] || 0) + 1;
      }
      
      // Count errors
      if (interaction.error) {
        patterns.error_frequency++;
      }
      
      // Track success
      if (interaction.success) {
        patterns.task_success_rate++;
      }
    });
    
    patterns.task_success_rate = patterns.task_success_rate / interactions.length;
    
    // Update behavior patterns
    Object.assign(profile.behavior_patterns, patterns);
  }

  async processFeedback(userId, feedback) {
    const profile = this.userProfiles.get(userId);
    
    // Process different types of feedback
    if (feedback.rating) {
      profile.preferences.satisfaction_level = feedback.rating;
    }
    
    if (feedback.feature_preference) {
      Object.assign(profile.preferences, feedback.feature_preference);
    }
    
    if (feedback.content_feedback) {
      this.updateContentPreferences(profile, feedback.content_feedback);
    }
  }

  async adjustContentComplexity(content, targetComplexity) {
    const complexity_prompt = `Adjust the following content to ${targetComplexity} complexity level:

Content: ${content}

Make the language and concepts appropriate for ${targetComplexity} level understanding.`;

    return await this.createCompletion([
      { role: 'system', content: 'You are a content adaptation specialist.' },
      { role: 'user', content: complexity_prompt }
    ]);
  }

  async adjustContentTone(content, tone) {
    const tone_prompt = `Adjust the tone of the following content to be ${tone}:

Content: ${content}

Maintain the same information but adjust the communication style to be ${tone}.`;

    return await this.createCompletion([
      { role: 'system', content: 'You are a communication tone specialist.' },
      { role: 'user', content: tone_prompt }
    ]);
  }

  async adjustContentLength(content, lengthPreference) {
    if (lengthPreference === 'concise') {
      const concise_prompt = `Make the following content more concise while preserving key information:

Content: ${content}`;

      return await this.createCompletion([
        { role: 'system', content: 'You are a content summarization specialist.' },
        { role: 'user', content: concise_prompt }
      ]);
    } else if (lengthPreference === 'detailed') {
      const detailed_prompt = `Expand the following content with more detail and examples:

Content: ${content}`;

      return await this.createCompletion([
        { role: 'system', content: 'You are a content expansion specialist.' },
        { role: 'user', content: detailed_prompt }
      ]);
    }
    
    return content;
  }

  filterComponents(components, visibleComponents) {
    if (!Array.isArray(components) || !Array.isArray(visibleComponents)) {
      return components;
    }
    
    return components.filter(component => 
      visibleComponents.includes(component.id) || 
      visibleComponents.includes(component.type)
    );
  }

  analyzeUsageFrequency(interactions) {
    const now = new Date();
    const periods = {
      daily: interactions.filter(i => (now - new Date(i.timestamp)) < 24 * 60 * 60 * 1000).length,
      weekly: interactions.filter(i => (now - new Date(i.timestamp)) < 7 * 24 * 60 * 60 * 1000).length,
      monthly: interactions.filter(i => (now - new Date(i.timestamp)) < 30 * 24 * 60 * 60 * 1000).length
    };
    
    return periods;
  }

  analyzeFeaturePreferences(interactions) {
    const features = {};
    interactions.forEach(interaction => {
      if (interaction.feature) {
        features[interaction.feature] = (features[interaction.feature] || 0) + 1;
      }
    });
    
    // Sort by usage count
    return Object.entries(features)
      .sort(([,a], [,b]) => b - a)
      .reduce((obj, [key, value]) => ({ ...obj, [key]: value }), {});
  }

  analyzeInteractionTimes(interactions) {
    const times = interactions.map(i => new Date(i.timestamp).getHours());
    const hourCounts = {};
    
    times.forEach(hour => {
      hourCounts[hour] = (hourCounts[hour] || 0) + 1;
    });
    
    return hourCounts;
  }

  analyzeTaskComplexity(interactions) {
    const complexities = interactions
      .filter(i => i.complexity)
      .map(i => i.complexity);
    
    if (complexities.length === 0) return 'unknown';
    
    const avg = complexities.reduce((a, b) => a + b, 0) / complexities.length;
    return avg;
  }

  analyzeErrorPatterns(interactions) {
    const errors = interactions.filter(i => i.error);
    const errorTypes = {};
    
    errors.forEach(error => {
      const type = error.error_type || 'unknown';
      errorTypes[type] = (errorTypes[type] || 0) + 1;
    });
    
    return errorTypes;
  }

  generateBehaviorInsights(patterns) {
    const insights = [];
    
    // Usage frequency insights
    if (patterns.usage_frequency.daily > 10) {
      insights.push({
        type: 'usage',
        message: 'High daily engagement detected',
        recommendation: 'Consider power user features'
      });
    }
    
    // Feature preference insights
    const topFeatures = Object.keys(patterns.preferred_features).slice(0, 3);
    if (topFeatures.length > 0) {
      insights.push({
        type: 'features',
        message: `Primary features: ${topFeatures.join(', ')}`,
        recommendation: 'Optimize these feature workflows'
      });
    }
    
    // Time pattern insights
    const peakHours = Object.entries(patterns.interaction_times)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 2)
      .map(([hour]) => hour);
    
    if (peakHours.length > 0) {
      insights.push({
        type: 'timing',
        message: `Peak usage hours: ${peakHours.join(', ')}`,
        recommendation: 'Schedule maintenance outside peak hours'
      });
    }
    
    return insights;
  }

  generateFeatureRecommendations(profile) {
    const recommendations = [];
    const features = profile.behavior_patterns.feature_usage || {};
    
    // Recommend underused features
    const underusedFeatures = ['advanced_search', 'automation', 'collaboration'];
    underusedFeatures.forEach(feature => {
      if (!features[feature] || features[feature] < 2) {
        recommendations.push({
          type: 'feature',
          title: `Try ${feature}`,
          description: `Based on your usage patterns, ${feature} might be helpful`,
          priority: 'medium'
        });
      }
    });
    
    return recommendations;
  }

  generateContentRecommendations(profile) {
    const recommendations = [];
    
    if (profile.preferences.content_complexity === 'advanced') {
      recommendations.push({
        type: 'content',
        title: 'Advanced tutorials available',
        description: 'Explore advanced features and techniques',
        priority: 'high'
      });
    }
    
    return recommendations;
  }

  generateWorkflowRecommendations(profile) {
    const recommendations = [];
    
    if (profile.behavior_patterns.task_success_rate < 0.8) {
      recommendations.push({
        type: 'workflow',
        title: 'Workflow optimization suggested',
        description: 'Consider using templates to improve task success rate',
        priority: 'high'
      });
    }
    
    return recommendations;
  }

  generateSettingsRecommendations(profile) {
    const recommendations = [];
    
    if (!profile.preferences.theme) {
      recommendations.push({
        type: 'settings',
        title: 'Customize your theme',
        description: 'Choose a theme that matches your preferences',
        priority: 'low'
      });
    }
    
    return recommendations;
  }

  generateGeneralRecommendations(profile) {
    return [
      ...this.generateFeatureRecommendations(profile),
      ...this.generateContentRecommendations(profile),
      ...this.generateWorkflowRecommendations(profile),
      ...this.generateSettingsRecommendations(profile)
    ];
  }

  rankRecommendations(recommendations, profile) {
    const priorityWeights = { high: 3, medium: 2, low: 1 };
    
    return recommendations
      .map(rec => ({
        ...rec,
        score: priorityWeights[rec.priority] * (profile.learning_score / 10)
      }))
      .sort((a, b) => b.score - a.score);
  }

  calculateProfileCompleteness(profile) {
    const maxFields = 10;
    const filledFields = Object.keys(profile.preferences).length +
                        (profile.behavior_patterns ? Object.keys(profile.behavior_patterns).length : 0) +
                        (profile.interaction_history.length > 0 ? 1 : 0);
    
    return Math.min(100, (filledFields / maxFields) * 100);
  }

  updateContentPreferences(profile, feedback) {
    if (feedback.too_complex) {
      profile.preferences.content_complexity = 'simple';
    } else if (feedback.too_simple) {
      profile.preferences.content_complexity = 'advanced';
    }
    
    if (feedback.too_long) {
      profile.preferences.content_length = 'concise';
    } else if (feedback.too_short) {
      profile.preferences.content_length = 'detailed';
    }
    
    if (feedback.tone_preference) {
      profile.preferences.communication_tone = feedback.tone_preference;
    }
  }
}

module.exports = PersonalizationAgent;
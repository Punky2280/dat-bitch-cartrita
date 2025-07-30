const BaseAgent = require('../../system/BaseAgent');

class BiasDetectionAgent extends BaseAgent {
  constructor() {
    super('BiasDetectionAgent', 'main', [
      'algorithmic_bias_detection',
      'fairness_assessment',
      'bias_mitigation_suggestions',
      'demographic_parity_analysis',
      'equalized_odds_testing',
      'disparate_impact_measurement'
    ]);
    
    this.biasPatterns = new Map();
    this.fairnessMetrics = new Map();
    this.protectedAttributes = new Set(['age', 'gender', 'race', 'ethnicity', 'religion', 'disability', 'sexual_orientation']);
    this.initializeBiasDetectionRules();
  }

  async onInitialize() {
    this.registerTaskHandler('detect_bias', this.detectBias.bind(this));
    this.registerTaskHandler('assess_fairness', this.assessFairness.bind(this));
    this.registerTaskHandler('measure_demographic_parity', this.measureDemographicParity.bind(this));
    this.registerTaskHandler('test_equalized_odds', this.testEqualizedOdds.bind(this));
    this.registerTaskHandler('analyze_disparate_impact', this.analyzeDisparateImpact.bind(this));
    this.registerTaskHandler('suggest_bias_mitigation', this.suggestBiasMitigation.bind(this));
    this.registerTaskHandler('generate_fairness_report', this.generateFairnessReport.bind(this));
    
    console.log('[BiasDetectionAgent] Bias detection and fairness assessment handlers registered');
  }

  initializeBiasDetectionRules() {
    // Statistical bias detection rules
    this.biasPatterns.set('demographic_parity', {
      threshold: 0.8, // 80% rule
      description: 'Acceptance rates should not differ by more than 20% across groups',
      severity: 'high'
    });
    
    this.biasPatterns.set('equalized_odds', {
      threshold: 0.1,
      description: 'True positive and false positive rates should be similar across groups',
      severity: 'high'
    });
    
    this.biasPatterns.set('calibration', {
      threshold: 0.05,
      description: 'Predicted probabilities should match actual outcomes across groups',
      severity: 'medium'
    });
    
    this.biasPatterns.set('individual_fairness', {
      threshold: 0.1,
      description: 'Similar individuals should receive similar outcomes',
      severity: 'high'
    });
  }

  async detectBias(prompt, language, userId, payload) {
    try {
      const { data, predictions, protected_attributes, bias_types = ['all'] } = payload;
      
      if (!data || !predictions) {
        throw new Error('Data and predictions are required for bias detection');
      }
      
      const biasResults = {};
      const detectedBiases = [];
      
      // Detect different types of bias based on request
      if (bias_types.includes('all') || bias_types.includes('demographic_parity')) {
        const demographicBias = await this.detectDemographicParityBias(data, predictions, protected_attributes);
        biasResults.demographic_parity = demographicBias;
        if (demographicBias.bias_detected) {
          detectedBiases.push(demographicBias);
        }
      }
      
      if (bias_types.includes('all') || bias_types.includes('equalized_odds')) {
        const equalizedOddsBias = await this.detectEqualizedOddsBias(data, predictions, protected_attributes);
        biasResults.equalized_odds = equalizedOddsBias;
        if (equalizedOddsBias.bias_detected) {
          detectedBiases.push(equalizedOddsBias);
        }
      }
      
      if (bias_types.includes('all') || bias_types.includes('calibration')) {
        const calibrationBias = await this.detectCalibrationBias(data, predictions, protected_attributes);
        biasResults.calibration = calibrationBias;
        if (calibrationBias.bias_detected) {
          detectedBiases.push(calibrationBias);
        }
      }
      
      if (bias_types.includes('all') || bias_types.includes('representation')) {
        const representationBias = await this.detectRepresentationBias(data, protected_attributes);
        biasResults.representation = representationBias;
        if (representationBias.bias_detected) {
          detectedBiases.push(representationBias);
        }
      }
      
      // Calculate overall bias score
      const overallBiasScore = this.calculateOverallBiasScore(biasResults);
      
      return {
        bias_detected: detectedBiases.length > 0,
        bias_count: detectedBiases.length,
        overall_bias_score: overallBiasScore,
        bias_results: biasResults,
        detected_biases: detectedBiases,
        fairness_level: this.categorizeFairnessLevel(overallBiasScore),
        analysis_timestamp: new Date().toISOString()
      };
      
    } catch (error) {
      console.error('[BiasDetectionAgent] Error detecting bias:', error);
      throw error;
    }
  }

  async assessFairness(prompt, language, userId, payload) {
    try {
      const { algorithm_results, ground_truth, demographics, fairness_criteria = ['demographic_parity', 'equalized_odds'] } = payload;
      
      const fairnessAssessment = {
        criteria_evaluated: fairness_criteria,
        assessment_results: {},
        overall_fairness: 'unknown',
        recommendations: []
      };
      
      for (const criterion of fairness_criteria) {
        switch (criterion) {
          case 'demographic_parity':
            fairnessAssessment.assessment_results.demographic_parity = 
              await this.assessDemographicParity(algorithm_results, demographics);
            break;
            
          case 'equalized_odds':
            fairnessAssessment.assessment_results.equalized_odds = 
              await this.assessEqualizedOdds(algorithm_results, ground_truth, demographics);
            break;
            
          case 'equality_of_opportunity':
            fairnessAssessment.assessment_results.equality_of_opportunity = 
              await this.assessEqualityOfOpportunity(algorithm_results, ground_truth, demographics);
            break;
            
          case 'calibration':
            fairnessAssessment.assessment_results.calibration = 
              await this.assessCalibration(algorithm_results, ground_truth, demographics);
            break;
            
          case 'individual_fairness':
            fairnessAssessment.assessment_results.individual_fairness = 
              await this.assessIndividualFairness(algorithm_results, demographics);
            break;
        }
      }
      
      // Determine overall fairness
      fairnessAssessment.overall_fairness = this.determineOverallFairness(fairnessAssessment.assessment_results);
      
      // Generate recommendations
      fairnessAssessment.recommendations = this.generateFairnessRecommendations(fairnessAssessment.assessment_results);
      
      return fairnessAssessment;
      
    } catch (error) {
      console.error('[BiasDetectionAgent] Error assessing fairness:', error);
      throw error;
    }
  }

  async measureDemographicParity(prompt, language, userId, payload) {
    try {
      const { predictions, demographics, target_outcome = 'positive' } = payload;
      
      const groups = this.groupByDemographics(predictions, demographics);
      const parityMeasures = {};
      
      for (const [group, groupData] of Object.entries(groups)) {
        const positiveRate = this.calculatePositiveRate(groupData, target_outcome);
        parityMeasures[group] = {
          positive_rate: positiveRate,
          sample_size: groupData.length,
          outcome_counts: this.countOutcomes(groupData)
        };
      }
      
      // Calculate parity ratios
      const parityRatios = this.calculateParityRatios(parityMeasures);
      
      // Determine if demographic parity is achieved
      const achievesParity = this.checkDemographicParity(parityRatios);
      
      return {
        demographic_parity_achieved: achievesParity.achieved,
        parity_measures: parityMeasures,
        parity_ratios: parityRatios,
        violations: achievesParity.violations,
        parity_score: achievesParity.score,
        analysis_details: {
          total_groups: Object.keys(groups).length,
          measurement_standard: 'four_fifths_rule',
          threshold: 0.8
        }
      };
      
    } catch (error) {
      console.error('[BiasDetectionAgent] Error measuring demographic parity:', error);
      throw error;
    }
  }

  async testEqualizedOdds(prompt, language, userId, payload) {
    try {
      const { predictions, ground_truth, demographics } = payload;
      
      if (!ground_truth) {
        throw new Error('Ground truth labels are required for equalized odds testing');
      }
      
      const groups = this.groupByDemographics(predictions, demographics, ground_truth);
      const equalizedOddsResults = {};
      
      for (const [group, groupData] of Object.entries(groups)) {
        const tpr = this.calculateTruePositiveRate(groupData);
        const fpr = this.calculateFalsePositiveRate(groupData);
        const tnr = this.calculateTrueNegativeRate(groupData);
        const fnr = this.calculateFalseNegativeRate(groupData);
        
        equalizedOddsResults[group] = {
          true_positive_rate: tpr,
          false_positive_rate: fpr,
          true_negative_rate: tnr,
          false_negative_rate: fnr,
          sample_size: groupData.length
        };
      }
      
      // Calculate differences between groups
      const oddsDifferences = this.calculateOddsDifferences(equalizedOddsResults);
      
      // Determine if equalized odds is satisfied
      const satisfiesEqualizedOdds = this.checkEqualizedOdds(oddsDifferences);
      
      return {
        equalized_odds_satisfied: satisfiesEqualizedOdds.satisfied,
        odds_results: equalizedOddsResults,
        odds_differences: oddsDifferences,
        violations: satisfiesEqualizedOdds.violations,
        equalized_odds_score: satisfiesEqualizedOdds.score,
        threshold: this.biasPatterns.get('equalized_odds').threshold
      };
      
    } catch (error) {
      console.error('[BiasDetectionAgent] Error testing equalized odds:', error);
      throw error;
    }
  }

  async analyzeDisparateImpact(prompt, language, userId, payload) {
    try {
      const { outcomes, demographics, reference_group } = payload;
      
      const groups = this.groupByDemographics(outcomes, demographics);
      const impactAnalysis = {};
      
      // Calculate selection rates for each group
      for (const [group, groupData] of Object.entries(groups)) {
        const selectionRate = this.calculateSelectionRate(groupData);
        impactAnalysis[group] = {
          selection_rate: selectionRate,
          selected_count: groupData.filter(d => d.selected).length,
          total_count: groupData.length
        };
      }
      
      // Identify reference group (typically the majority group)
      const refGroup = reference_group || this.identifyReferenceGroup(impactAnalysis);
      const referenceRate = impactAnalysis[refGroup]?.selection_rate || 0;
      
      // Calculate disparate impact ratios
      const disparateImpactRatios = {};
      let hasDisparateImpact = false;
      
      for (const [group, analysis] of Object.entries(impactAnalysis)) {
        if (group !== refGroup) {
          const ratio = analysis.selection_rate / referenceRate;
          disparateImpactRatios[group] = {
            ratio: ratio,
            passes_four_fifths_rule: ratio >= 0.8,
            selection_rate: analysis.selection_rate,
            reference_rate: referenceRate
          };
          
          if (ratio < 0.8) {
            hasDisparateImpact = true;
          }
        }
      }
      
      return {
        disparate_impact_detected: hasDisparateImpact,
        reference_group: refGroup,
        impact_analysis: impactAnalysis,
        disparate_impact_ratios: disparateImpactRatios,
        four_fifths_rule_violations: Object.values(disparateImpactRatios)
          .filter(r => !r.passes_four_fifths_rule),
        overall_impact_score: this.calculateDisparateImpactScore(disparateImpactRatios)
      };
      
    } catch (error) {
      console.error('[BiasDetectionAgent] Error analyzing disparate impact:', error);
      throw error;
    }
  }

  async suggestBiasMitigation(prompt, language, userId, payload) {
    try {
      const { bias_results, algorithm_type, data_characteristics } = payload;
      
      const mitigationSuggestions = [];
      
      // Analyze bias results and suggest appropriate mitigation strategies
      if (bias_results.demographic_parity && bias_results.demographic_parity.bias_detected) {
        mitigationSuggestions.push(...this.suggestDemographicParityMitigation(bias_results.demographic_parity));
      }
      
      if (bias_results.equalized_odds && bias_results.equalized_odds.bias_detected) {
        mitigationSuggestions.push(...this.suggestEqualizedOddsMitigation(bias_results.equalized_odds));
      }
      
      if (bias_results.representation && bias_results.representation.bias_detected) {
        mitigationSuggestions.push(...this.suggestRepresentationMitigation(bias_results.representation));
      }
      
      // Add general mitigation strategies
      mitigationSuggestions.push(...this.suggestGeneralMitigationStrategies(algorithm_type, data_characteristics));
      
      // Prioritize suggestions based on impact and feasibility
      const prioritizedSuggestions = this.prioritizeMitigationSuggestions(mitigationSuggestions);
      
      return {
        mitigation_suggestions: prioritizedSuggestions,
        total_suggestions: prioritizedSuggestions.length,
        implementation_phases: this.groupSuggestionsByPhase(prioritizedSuggestions),
        estimated_effort: this.estimateImplementationEffort(prioritizedSuggestions)
      };
      
    } catch (error) {
      console.error('[BiasDetectionAgent] Error suggesting bias mitigation:', error);
      throw error;
    }
  }

  async generateFairnessReport(prompt, language, userId, payload) {
    try {
      const { algorithm_name, test_data, demographics, report_type = 'comprehensive' } = payload;
      
      const report = {
        algorithm_name: algorithm_name,
        report_type: report_type,
        generated_at: new Date().toISOString(),
        executive_summary: {},
        detailed_analysis: {},
        recommendations: []
      };
      
      // Perform comprehensive bias detection
      const biasDetection = await this.detectBias('', language, userId, {
        data: test_data,
        predictions: test_data,
        protected_attributes: demographics
      });
      
      // Perform fairness assessment
      const fairnessAssessment = await this.assessFairness('', language, userId, {
        algorithm_results: test_data,
        demographics: demographics
      });
      
      // Generate executive summary
      report.executive_summary = {
        overall_fairness_level: fairnessAssessment.overall_fairness,
        bias_detected: biasDetection.bias_detected,
        critical_issues: this.identifyCriticalIssues(biasDetection, fairnessAssessment),
        compliance_status: this.assessComplianceStatus(biasDetection, fairnessAssessment)
      };
      
      // Add detailed analysis
      report.detailed_analysis = {
        bias_detection_results: biasDetection,
        fairness_assessment_results: fairnessAssessment,
        statistical_tests: await this.performStatisticalTests(test_data, demographics),
        demographic_analysis: this.analyzeDemographicDistribution(demographics)
      };
      
      // Generate recommendations
      const mitigationSuggestions = await this.suggestBiasMitigation('', language, userId, {
        bias_results: biasDetection.bias_results,
        algorithm_type: 'classification'
      });
      
      report.recommendations = mitigationSuggestions.mitigation_suggestions;
      
      return report;
      
    } catch (error) {
      console.error('[BiasDetectionAgent] Error generating fairness report:', error);
      throw error;
    }
  }

  // Helper methods for bias detection
  async detectDemographicParityBias(data, predictions, protectedAttributes) {
    const groups = this.groupByProtectedAttributes(data, protectedAttributes);
    const groupRates = {};
    
    for (const [group, groupData] of Object.entries(groups)) {
      const positiveRate = groupData.filter(d => d.prediction === 'positive').length / groupData.length;
      groupRates[group] = positiveRate;
    }
    
    const rates = Object.values(groupRates);
    const minRate = Math.min(...rates);
    const maxRate = Math.max(...rates);
    const ratio = minRate / maxRate;
    
    return {
      bias_detected: ratio < 0.8,
      bias_type: 'demographic_parity',
      severity: ratio < 0.6 ? 'high' : ratio < 0.8 ? 'medium' : 'low',
      group_rates: groupRates,
      parity_ratio: ratio,
      threshold: 0.8
    };
  }

  async detectEqualizedOddsBias(data, predictions, protectedAttributes) {
    const groups = this.groupByProtectedAttributes(data, protectedAttributes);
    const groupMetrics = {};
    
    for (const [group, groupData] of Object.entries(groups)) {
      const tpr = this.calculateTruePositiveRate(groupData);
      const fpr = this.calculateFalsePositiveRate(groupData);
      groupMetrics[group] = { tpr, fpr };
    }
    
    const tprDiff = this.calculateMaxDifference(Object.values(groupMetrics).map(m => m.tpr));
    const fprDiff = this.calculateMaxDifference(Object.values(groupMetrics).map(m => m.fpr));
    
    const biasDetected = tprDiff > 0.1 || fprDiff > 0.1;
    
    return {
      bias_detected: biasDetected,
      bias_type: 'equalized_odds',
      severity: (tprDiff > 0.2 || fprDiff > 0.2) ? 'high' : 'medium',
      group_metrics: groupMetrics,
      tpr_difference: tprDiff,
      fpr_difference: fprDiff,
      threshold: 0.1
    };
  }

  async detectCalibrationBias(data, predictions, protectedAttributes) {
    const groups = this.groupByProtectedAttributes(data, protectedAttributes);
    const calibrationMetrics = {};
    
    for (const [group, groupData] of Object.entries(groups)) {
      const calibration = this.calculateCalibration(groupData);
      calibrationMetrics[group] = calibration;
    }
    
    const calibrationDiff = this.calculateMaxDifference(Object.values(calibrationMetrics));
    
    return {
      bias_detected: calibrationDiff > 0.05,
      bias_type: 'calibration',
      severity: calibrationDiff > 0.1 ? 'high' : 'medium',
      group_metrics: calibrationMetrics,
      calibration_difference: calibrationDiff,
      threshold: 0.05
    };
  }

  async detectRepresentationBias(data, protectedAttributes) {
    const groups = this.groupByProtectedAttributes(data, protectedAttributes);
    const groupSizes = Object.fromEntries(
      Object.entries(groups).map(([group, groupData]) => [group, groupData.length])
    );
    
    const totalSize = data.length;
    const expectedSize = totalSize / Object.keys(groups).length;
    const representationRatios = {};
    
    for (const [group, size] of Object.entries(groupSizes)) {
      representationRatios[group] = size / expectedSize;
    }
    
    const underrepresented = Object.entries(representationRatios)
      .filter(([group, ratio]) => ratio < 0.5)
      .map(([group]) => group);
    
    return {
      bias_detected: underrepresented.length > 0,
      bias_type: 'representation',
      severity: underrepresented.length > 1 ? 'high' : 'medium',
      group_sizes: groupSizes,
      representation_ratios: representationRatios,
      underrepresented_groups: underrepresented
    };
  }

  // Utility methods
  groupByDemographics(data, demographics, groundTruth = null) {
    const groups = {};
    
    data.forEach((item, index) => {
      const demographic = demographics[index];
      const key = JSON.stringify(demographic);
      
      if (!groups[key]) {
        groups[key] = [];
      }
      
      const dataPoint = { ...item };
      if (groundTruth) {
        dataPoint.ground_truth = groundTruth[index];
      }
      
      groups[key].push(dataPoint);
    });
    
    return groups;
  }

  groupByProtectedAttributes(data, protectedAttributes) {
    return this.groupByDemographics(data, protectedAttributes);
  }

  calculatePositiveRate(groupData, targetOutcome = 'positive') {
    const positiveCount = groupData.filter(d => d.outcome === targetOutcome || d.prediction === targetOutcome).length;
    return positiveCount / groupData.length;
  }

  calculateTruePositiveRate(groupData) {
    const truePositives = groupData.filter(d => d.prediction === 'positive' && d.ground_truth === 'positive').length;
    const actualPositives = groupData.filter(d => d.ground_truth === 'positive').length;
    return actualPositives > 0 ? truePositives / actualPositives : 0;
  }

  calculateFalsePositiveRate(groupData) {
    const falsePositives = groupData.filter(d => d.prediction === 'positive' && d.ground_truth === 'negative').length;
    const actualNegatives = groupData.filter(d => d.ground_truth === 'negative').length;
    return actualNegatives > 0 ? falsePositives / actualNegatives : 0;
  }

  calculateTrueNegativeRate(groupData) {
    const trueNegatives = groupData.filter(d => d.prediction === 'negative' && d.ground_truth === 'negative').length;
    const actualNegatives = groupData.filter(d => d.ground_truth === 'negative').length;
    return actualNegatives > 0 ? trueNegatives / actualNegatives : 0;
  }

  calculateFalseNegativeRate(groupData) {
    const falseNegatives = groupData.filter(d => d.prediction === 'negative' && d.ground_truth === 'positive').length;
    const actualPositives = groupData.filter(d => d.ground_truth === 'positive').length;
    return actualPositives > 0 ? falseNegatives / actualPositives : 0;
  }

  calculateSelectionRate(groupData) {
    const selectedCount = groupData.filter(d => d.selected === true || d.outcome === 'positive').length;
    return selectedCount / groupData.length;
  }

  calculateCalibration(groupData) {
    // Simplified calibration calculation
    const bins = this.binByPredictedProbability(groupData);
    let calibrationError = 0;
    
    for (const bin of bins) {
      const avgPrediction = bin.reduce((sum, d) => sum + d.probability, 0) / bin.length;
      const actualRate = bin.filter(d => d.ground_truth === 'positive').length / bin.length;
      calibrationError += Math.abs(avgPrediction - actualRate);
    }
    
    return calibrationError / bins.length;
  }

  calculateMaxDifference(values) {
    if (values.length < 2) return 0;
    return Math.max(...values) - Math.min(...values);
  }

  calculateOverallBiasScore(biasResults) {
    const scores = [];
    
    Object.values(biasResults).forEach(result => {
      if (result.bias_detected) {
        const severityScore = { low: 1, medium: 2, high: 3, critical: 4 };
        scores.push(severityScore[result.severity] || 2);
      }
    });
    
    if (scores.length === 0) return 0;
    return scores.reduce((sum, score) => sum + score, 0) / scores.length;
  }

  categorizeFairnessLevel(biasScore) {
    if (biasScore === 0) return 'excellent';
    if (biasScore < 1) return 'good';
    if (biasScore < 2) return 'fair';
    if (biasScore < 3) return 'poor';
    return 'very_poor';
  }

  // Placeholder methods for complex operations
  countOutcomes(groupData) {
    return { positive: 0, negative: 0 };
  }

  calculateParityRatios(parityMeasures) {
    return {};
  }

  checkDemographicParity(ratios) {
    return { achieved: true, violations: [], score: 100 };
  }

  calculateOddsDifferences(results) {
    return {};
  }

  checkEqualizedOdds(differences) {
    return { satisfied: true, violations: [], score: 100 };
  }

  identifyReferenceGroup(analysis) {
    return Object.keys(analysis)[0];
  }

  calculateDisparateImpactScore(ratios) {
    return 85;
  }

  suggestDemographicParityMitigation(biasResult) {
    return [{ strategy: 'Rebalance training data', priority: 'high', effort: 'medium' }];
  }

  suggestEqualizedOddsMitigation(biasResult) {
    return [{ strategy: 'Post-processing calibration', priority: 'high', effort: 'low' }];
  }

  suggestRepresentationMitigation(biasResult) {
    return [{ strategy: 'Data augmentation', priority: 'medium', effort: 'high' }];
  }

  suggestGeneralMitigationStrategies(algorithmType, dataCharacteristics) {
    return [{ strategy: 'Regular bias auditing', priority: 'low', effort: 'low' }];
  }

  prioritizeMitigationSuggestions(suggestions) {
    return suggestions.sort((a, b) => {
      const priorityOrder = { high: 3, medium: 2, low: 1 };
      return priorityOrder[b.priority] - priorityOrder[a.priority];
    });
  }

  groupSuggestionsByPhase(suggestions) {
    return {
      immediate: suggestions.filter(s => s.priority === 'high'),
      short_term: suggestions.filter(s => s.priority === 'medium'),
      long_term: suggestions.filter(s => s.priority === 'low')
    };
  }

  estimateImplementationEffort(suggestions) {
    const effortMap = { low: 1, medium: 2, high: 3 };
    const totalEffort = suggestions.reduce((sum, s) => sum + (effortMap[s.effort] || 2), 0);
    return { total_effort_points: totalEffort, estimated_weeks: Math.ceil(totalEffort / 2) };
  }

  binByPredictedProbability(groupData, numBins = 10) {
    // Simplified binning - in practice would use more sophisticated methods
    return [groupData]; // Return single bin for simplification
  }

  assessDemographicParity(results, demographics) { return { fair: true }; }
  assessEqualizedOdds(results, truth, demographics) { return { fair: true }; }
  assessEqualityOfOpportunity(results, truth, demographics) { return { fair: true }; }
  assessCalibration(results, truth, demographics) { return { fair: true }; }
  assessIndividualFairness(results, demographics) { return { fair: true }; }
  determineOverallFairness(assessmentResults) { return 'fair'; }
  generateFairnessRecommendations(assessmentResults) { return []; }
  identifyCriticalIssues(biasDetection, fairnessAssessment) { return []; }
  assessComplianceStatus(biasDetection, fairnessAssessment) { return 'compliant'; }
  performStatisticalTests(testData, demographics) { return { tests: [] }; }
  analyzeDemographicDistribution(demographics) { return { distribution: {} }; }
}

module.exports = BiasDetectionAgent;
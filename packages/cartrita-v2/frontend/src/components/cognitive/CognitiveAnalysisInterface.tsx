'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Brain, Zap, Target, TrendingUp, Heart, Users } from 'lucide-react';

interface CognitiveAnalysisResult {
  cognitiveType: string;
  insights: {
    primaryInsights: string[];
    secondaryObservations: string[];
    cognitiveLoad: string;
    processingEfficiency: number;
  };
  emotionalIntelligence: {
    detectedEmotions: string[];
    empathyScore: number;
    emotionalResilience: number;
  };
  cognitivePatterns: {
    reasoningPath: string[];
    decisionMatrix: any;
    learningAdaptations: string[];
  };
  predictiveAnalysis: {
    futureStates: string[];
    riskAssessment: string[];
    opportunityMapping: string[];
  };
  metaverseCompatibility: {
    spatialAwareness: number;
    virtualInteractionPotential: number;
    immersiveCapabilities: number;
  };
  processingMetadata: {
    model_used: string;
    processing_time: number;
    confidence: number;
    complexity_score: number;
  };
}

export default function CognitiveAnalysisInterface() {
  const [inputData, setInputData] = useState('');
  const [cognitiveType, setCognitiveType] = useState('');
  const [emotionalState, setEmotionalState] = useState('');
  const [contextMemory, setContextMemory] = useState('');
  const [analysisResult, setAnalysisResult] = useState<CognitiveAnalysisResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [sessionId] = useState(`cognitive_${Date.now()}`);

  const cognitiveTypes = [
    { value: 'emotional_analysis', label: 'Emotional Analysis' },
    { value: 'decision_making', label: 'Decision Making' },
    { value: 'pattern_recognition', label: 'Pattern Recognition' },
    { value: 'creative_thinking', label: 'Creative Thinking' },
    { value: 'problem_solving', label: 'Problem Solving' },
    { value: 'social_cognition', label: 'Social Cognition' }
  ];

  const emotionalStates = [
    { value: 'neutral', label: 'Neutral' },
    { value: 'excited', label: 'Excited' },
    { value: 'focused', label: 'Focused' },
    { value: 'stressed', label: 'Stressed' },
    { value: 'creative', label: 'Creative' },
    { value: 'analytical', label: 'Analytical' }
  ];

  const performCognitiveAnalysis = async () => {
    if (!inputData.trim() || !cognitiveType) return;

    setIsAnalyzing(true);
    try {
      const response = await fetch('/api/v2/cognitive/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          inputData,
          cognitiveType,
          contextMemory: contextMemory ? JSON.parse(contextMemory) : {},
          emotionalState,
          sessionId
        })
      });

      const result = await response.json();
      if (result.success) {
        setAnalysisResult(result.data);
      }
    } catch (error) {
      console.error('Cognitive analysis error:', error);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const getEmotionColor = (emotion: string) => {
    const colors: Record<string, string> = {
      joy: 'bg-yellow-500',
      sadness: 'bg-blue-500',
      anger: 'bg-red-500',
      fear: 'bg-purple-500',
      surprise: 'bg-orange-500',
      curiosity: 'bg-green-500',
      neutral: 'bg-gray-500'
    };
    return colors[emotion] || 'bg-gray-500';
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center space-x-2">
            <Brain className="w-6 h-6 text-blue-600" />
            <CardTitle>Cognitive Analysis Interface</CardTitle>
          </div>
          <CardDescription>
            Analyze cognitive patterns, emotional intelligence, and predictive insights
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">Cognitive Analysis Type</label>
              <Select value={cognitiveType} onValueChange={setCognitiveType}>
                <SelectTrigger>
                  <SelectValue placeholder="Select analysis type" />
                </SelectTrigger>
                <SelectContent>
                  {cognitiveTypes.map(type => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Current Emotional State</label>
              <Select value={emotionalState} onValueChange={setEmotionalState}>
                <SelectTrigger>
                  <SelectValue placeholder="Select emotional state" />
                </SelectTrigger>
                <SelectContent>
                  {emotionalStates.map(state => (
                    <SelectItem key={state.value} value={state.value}>
                      {state.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Input Data for Analysis</label>
            <Textarea
              value={inputData}
              onChange={(e) => setInputData(e.target.value)}
              placeholder="Enter text, data, or context for cognitive analysis..."
              className="min-h-[100px]"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Context Memory (JSON)</label>
            <Textarea
              value={contextMemory}
              onChange={(e) => setContextMemory(e.target.value)}
              placeholder='{"pastInteractions": [], "preferences": {}, "learningHistory": []}'
              className="min-h-[60px] font-mono text-sm"
            />
          </div>

          <Button 
            onClick={performCognitiveAnalysis}
            disabled={!inputData.trim() || !cognitiveType || isAnalyzing}
            className="w-full"
          >
            {isAnalyzing ? 'Analyzing...' : 'Perform Cognitive Analysis'}
          </Button>
        </CardContent>
      </Card>

      {analysisResult && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <div className="flex items-center space-x-2">
                <Zap className="w-5 h-5 text-purple-600" />
                <CardTitle className="text-lg">Cognitive Insights</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h4 className="font-medium text-sm mb-2">Primary Insights</h4>
                <div className="space-y-1">
                  {analysisResult.insights.primaryInsights.map((insight, index) => (
                    <Badge key={index} variant="secondary" className="block w-fit mb-1">
                      {insight}
                    </Badge>
                  ))}
                </div>
              </div>
              <div>
                <h4 className="font-medium text-sm mb-2">Processing Efficiency</h4>
                <Progress value={analysisResult.insights.processingEfficiency * 100} className="w-full" />
                <p className="text-xs text-gray-600 mt-1">
                  {Math.round(analysisResult.insights.processingEfficiency * 100)}% efficiency
                </p>
              </div>
              <div>
                <h4 className="font-medium text-sm mb-2">Cognitive Load</h4>
                <Badge variant={analysisResult.insights.cognitiveLoad === 'high' ? 'destructive' : 
                             analysisResult.insights.cognitiveLoad === 'medium' ? 'default' : 'secondary'}>
                  {analysisResult.insights.cognitiveLoad.toUpperCase()}
                </Badge>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center space-x-2">
                <Heart className="w-5 h-5 text-red-600" />
                <CardTitle className="text-lg">Emotional Intelligence</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h4 className="font-medium text-sm mb-2">Detected Emotions</h4>
                <div className="flex flex-wrap gap-2">
                  {analysisResult.emotionalIntelligence.detectedEmotions.map((emotion, index) => (
                    <Badge key={index} className={`${getEmotionColor(emotion)} text-white`}>
                      {emotion}
                    </Badge>
                  ))}
                </div>
              </div>
              <div>
                <h4 className="font-medium text-sm mb-2">Empathy Score</h4>
                <Progress value={analysisResult.emotionalIntelligence.empathyScore * 100} className="w-full" />
                <p className="text-xs text-gray-600 mt-1">
                  {Math.round(analysisResult.emotionalIntelligence.empathyScore * 100)}% empathy level
                </p>
              </div>
              <div>
                <h4 className="font-medium text-sm mb-2">Emotional Resilience</h4>
                <Progress value={analysisResult.emotionalIntelligence.emotionalResilience * 100} className="w-full" />
                <p className="text-xs text-gray-600 mt-1">
                  {Math.round(analysisResult.emotionalIntelligence.emotionalResilience * 100)}% resilience
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center space-x-2">
                <Target className="w-5 h-5 text-green-600" />
                <CardTitle className="text-lg">Cognitive Patterns</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h4 className="font-medium text-sm mb-2">Reasoning Patterns</h4>
                <div className="space-y-1">
                  {analysisResult.cognitivePatterns.reasoningPath.map((pattern, index) => (
                    <p key={index} className="text-xs text-gray-700 bg-gray-50 p-2 rounded">
                      {pattern}
                    </p>
                  ))}
                </div>
              </div>
              <div>
                <h4 className="font-medium text-sm mb-2">Learning Adaptations</h4>
                <div className="space-y-1">
                  {analysisResult.cognitivePatterns.learningAdaptations.map((adaptation, index) => (
                    <Badge key={index} variant="outline" className="block w-fit mb-1">
                      {adaptation}
                    </Badge>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center space-x-2">
                <TrendingUp className="w-5 h-5 text-blue-600" />
                <CardTitle className="text-lg">Predictive Analysis</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h4 className="font-medium text-sm mb-2">Future States</h4>
                <div className="space-y-1">
                  {analysisResult.predictiveAnalysis.futureStates.map((state, index) => (
                    <p key={index} className="text-xs text-blue-700 bg-blue-50 p-2 rounded">
                      {state}
                    </p>
                  ))}
                </div>
              </div>
              <div>
                <h4 className="font-medium text-sm mb-2">Risk Assessment</h4>
                <div className="space-y-1">
                  {analysisResult.predictiveAnalysis.riskAssessment.map((risk, index) => (
                    <p key={index} className="text-xs text-red-700 bg-red-50 p-2 rounded">
                      {risk}
                    </p>
                  ))}
                </div>
              </div>
              <div>
                <h4 className="font-medium text-sm mb-2">Opportunities</h4>
                <div className="space-y-1">
                  {analysisResult.predictiveAnalysis.opportunityMapping.map((opportunity, index) => (
                    <p key={index} className="text-xs text-green-700 bg-green-50 p-2 rounded">
                      {opportunity}
                    </p>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="lg:col-span-2">
            <CardHeader>
              <div className="flex items-center space-x-2">
                <Users className="w-5 h-5 text-purple-600" />
                <CardTitle className="text-lg">Metaverse Compatibility & Processing Metadata</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <h4 className="font-medium">Metaverse Integration</h4>
                <div className="space-y-3">
                  <div>
                    <label className="text-xs text-gray-600">Spatial Awareness</label>
                    <Progress value={analysisResult.metaverseCompatibility.spatialAwareness * 100} className="w-full" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-600">Virtual Interaction Potential</label>
                    <Progress value={analysisResult.metaverseCompatibility.virtualInteractionPotential * 100} className="w-full" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-600">Immersive Capabilities</label>
                    <Progress value={analysisResult.metaverseCompatibility.immersiveCapabilities * 100} className="w-full" />
                  </div>
                </div>
              </div>
              <div className="space-y-4">
                <h4 className="font-medium">Processing Information</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Model Used:</span>
                    <Badge variant="secondary">{analysisResult.processingMetadata.model_used}</Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Processing Time:</span>
                    <span>{analysisResult.processingMetadata.processing_time}ms</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Confidence:</span>
                    <span>{Math.round(analysisResult.processingMetadata.confidence * 100)}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Complexity Score:</span>
                    <span>{Math.round(analysisResult.processingMetadata.complexity_score * 100)}%</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
import CognitiveAnalysisInterface from '@/components/cognitive/CognitiveAnalysisInterface';

export default function CognitivePage() {
  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">
            Cognitive AI Analysis
          </h1>
          <p className="mt-2 text-gray-600">
            Advanced cognitive analysis with emotional intelligence and predictive insights
          </p>
        </div>
        
        <CognitiveAnalysisInterface />
      </div>
    </div>
  );
}
import React, { useState, useEffect, useMemo } from 'react';
import { 
  MagnifyingGlassIcon, 
  FunnelIcon, 
  ChevronDownIcon,
  StarIcon,
  CpuChipIcon,
  CloudIcon,
  CurrencyDollarIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon
} from '@heroicons/react/24/outline';
import { StarIcon as StarSolidIcon } from '@heroicons/react/24/solid';

interface ModelEntry {
  idx: number;
  repo_id: string;
  category: string;
  approx_params: string;
  primary_tasks: string[];
  serverless_candidate: boolean;
  requires_endpoint: boolean;
  notes: string;
  cost_tier?: string;
  quality_score?: number;
  context_length?: number;
}

interface ModelCatalogProps {
  onSelectModel: (model: ModelEntry) => void;
  selectedModel?: ModelEntry;
  className?: string;
}

const CATEGORY_COLORS = {
  general: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
  code: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
  math: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300',
  multilingual: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300',
  safety: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
  lightweight: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
  vision: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-300',
  audio: 'bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-300',
  embedding: 'bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-300'
};

const COST_TIER_COLORS = {
  economy: 'bg-green-100 text-green-700 dark:bg-green-800 dark:text-green-200',
  standard: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-800 dark:text-yellow-200',
  premium: 'bg-red-100 text-red-700 dark:bg-red-800 dark:text-red-200'
};

export const HuggingFaceModelCatalog: React.FC<ModelCatalogProps> = ({
  onSelectModel,
  selectedModel,
  className = ''
}) => {
  const [models, setModels] = useState<ModelEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedCostTier, setSelectedCostTier] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('quality');
  const [showFilters, setShowFilters] = useState(false);

  // Load model catalog
  useEffect(() => {
    const loadModels = async () => {
      try {
        const response = await fetch('/api/huggingface/capabilities');
        if (response.ok) {
          const data = await response.json();
          // For demo, we'll create sample data based on our enhanced catalog
          const sampleModels: ModelEntry[] = [
            {
              idx: 1,
              repo_id: "meta-llama/Meta-Llama-3-70B-Instruct",
              category: "general",
              approx_params: "70B",
              primary_tasks: ["chat", "reasoning", "analysis"],
              serverless_candidate: false,
              requires_endpoint: true,
              notes: "Large; often needs dedicated endpoint.",
              cost_tier: "premium",
              quality_score: 0.95,
              context_length: 8192
            },
            {
              idx: 2,
              repo_id: "meta-llama/Meta-Llama-3-8B-Instruct",
              category: "general",
              approx_params: "8B",
              primary_tasks: ["chat", "drafting", "analysis"],
              serverless_candidate: true,
              requires_endpoint: false,
              notes: "Good quality-size tradeoff.",
              cost_tier: "standard",
              quality_score: 0.85,
              context_length: 8192
            },
            {
              idx: 3,
              repo_id: "microsoft/DialoGPT-medium",
              category: "lightweight",
              approx_params: "345M",
              primary_tasks: ["chat", "conversation"],
              serverless_candidate: true,
              requires_endpoint: false,
              notes: "Fast response times.",
              cost_tier: "economy",
              quality_score: 0.65,
              context_length: 1024
            },
            {
              idx: 4,
              repo_id: "Qwen/Qwen2-7B-Instruct",
              category: "multilingual",
              approx_params: "7B",
              primary_tasks: ["multilingual", "chat", "reasoning"],
              serverless_candidate: true,
              requires_endpoint: false,
              notes: "Excellent multilingual support.",
              cost_tier: "standard",
              quality_score: 0.82,
              context_length: 32768
            },
            {
              idx: 5,
              repo_id: "microsoft/speecht5_tts",
              category: "audio",
              approx_params: "unknown",
              primary_tasks: ["text-to-speech", "voice-synthesis"],
              serverless_candidate: true,
              requires_endpoint: false,
              notes: "High-quality TTS model.",
              cost_tier: "standard",
              quality_score: 0.88,
              context_length: 512
            },
            {
              idx: 6,
              repo_id: "BAAI/bge-large-en-v1.5",
              category: "embedding",
              approx_params: "335M",
              primary_tasks: ["embedding", "similarity", "retrieval"],
              serverless_candidate: true,
              requires_endpoint: false,
              notes: "High-quality text embeddings.",
              cost_tier: "economy",
              quality_score: 0.90,
              context_length: 512
            }
          ];
          setModels(sampleModels);
        }
      } catch (error) {
        console.error('Failed to load models:', error);
      } finally {
        setLoading(false);
      }
    };

    loadModels();
  }, []);

  // Filter and sort models
  const filteredAndSortedModels = useMemo(() => {
    let filtered = models.filter(model => {
      const matchesSearch = model.repo_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          model.primary_tasks.some(task => task.toLowerCase().includes(searchTerm.toLowerCase()));
      const matchesCategory = selectedCategory === 'all' || model.category === selectedCategory;
      const matchesCostTier = selectedCostTier === 'all' || model.cost_tier === selectedCostTier;
      
      return matchesSearch && matchesCategory && matchesCostTier;
    });

    // Sort models
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'quality':
          return (b.quality_score || 0) - (a.quality_score || 0);
        case 'cost':
          const costOrder = { economy: 0, standard: 1, premium: 2 };
          return (costOrder[a.cost_tier as keyof typeof costOrder] || 1) - (costOrder[b.cost_tier as keyof typeof costOrder] || 1);
        case 'params':
          // Simple parameter size comparison
          const getParamSize = (params: string) => {
            const num = parseFloat(params);
            if (params.includes('B')) return num * 1000;
            if (params.includes('M')) return num;
            return 0;
          };
          return getParamSize(b.approx_params) - getParamSize(a.approx_params);
        case 'name':
          return a.repo_id.localeCompare(b.repo_id);
        default:
          return 0;
      }
    });

    return filtered;
  }, [models, searchTerm, selectedCategory, selectedCostTier, sortBy]);

  const categories = [...new Set(models.map(m => m.category))];
  const costTiers = [...new Set(models.map(m => m.cost_tier).filter(Boolean))];

  if (loading) {
    return (
      <div className={`p-6 ${className}`}>
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded mb-4"></div>
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-20 bg-gray-200 dark:bg-gray-700 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-white dark:bg-gray-800 rounded-lg shadow-lg ${className}`}>
      {/* Header */}
      <div className="p-6 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            HuggingFace Model Catalog
          </h2>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center space-x-2 px-3 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <FunnelIcon className="h-4 w-4" />
            <span>Filters</span>
          </button>
        </div>

        {/* Search */}
        <div className="relative">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search models, tasks..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Filters */}
        {showFilters && (
          <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Category
              </label>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Categories</option>
                {categories.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Cost Tier
              </label>
              <select
                value={selectedCostTier}
                onChange={(e) => setSelectedCostTier(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Tiers</option>
                {costTiers.map(tier => (
                  <option key={tier} value={tier}>{tier}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Sort By
              </label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="quality">Quality Score</option>
                <option value="cost">Cost (Low to High)</option>
                <option value="params">Parameter Size</option>
                <option value="name">Name</option>
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Model List */}
      <div className="p-6">
        <div className="space-y-4">
          {filteredAndSortedModels.map((model) => (
            <div
              key={model.repo_id}
              onClick={() => onSelectModel(model)}
              className={`p-4 border-2 rounded-lg cursor-pointer transition-all duration-200 hover:shadow-md ${
                selectedModel?.repo_id === model.repo_id
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                  : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-3 mb-2">
                    <h3 className="font-medium text-gray-900 dark:text-white">
                      {model.repo_id}
                    </h3>
                    
                    {/* Category Badge */}
                    <span className={`px-2 py-1 text-xs rounded-full ${CATEGORY_COLORS[model.category as keyof typeof CATEGORY_COLORS] || CATEGORY_COLORS.general}`}>
                      {model.category}
                    </span>

                    {/* Cost Tier Badge */}
                    {model.cost_tier && (
                      <span className={`px-2 py-1 text-xs rounded-full ${COST_TIER_COLORS[model.cost_tier as keyof typeof COST_TIER_COLORS]}`}>
                        <CurrencyDollarIcon className="h-3 w-3 inline mr-1" />
                        {model.cost_tier}
                      </span>
                    )}
                  </div>

                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                    {model.notes}
                  </p>

                  {/* Primary Tasks */}
                  <div className="flex flex-wrap gap-1 mb-3">
                    {model.primary_tasks.map((task) => (
                      <span
                        key={task}
                        className="px-2 py-1 text-xs bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded"
                      >
                        {task}
                      </span>
                    ))}
                  </div>

                  {/* Model Stats */}
                  <div className="flex items-center space-x-4 text-xs text-gray-500 dark:text-gray-400">
                    <div className="flex items-center space-x-1">
                      <CpuChipIcon className="h-4 w-4" />
                      <span>{model.approx_params}</span>
                    </div>

                    {model.quality_score && (
                      <div className="flex items-center space-x-1">
                        <StarIcon className="h-4 w-4" />
                        <span>{model.quality_score.toFixed(2)}</span>
                      </div>
                    )}

                    {model.context_length && (
                      <div className="flex items-center space-x-1">
                        <ClockIcon className="h-4 w-4" />
                        <span>{model.context_length.toLocaleString()} ctx</span>
                      </div>
                    )}

                    <div className="flex items-center space-x-1">
                      {model.serverless_candidate ? (
                        <>
                          <CloudIcon className="h-4 w-4 text-green-500" />
                          <span className="text-green-600 dark:text-green-400">Serverless</span>
                        </>
                      ) : (
                        <>
                          <ExclamationTriangleIcon className="h-4 w-4 text-orange-500" />
                          <span className="text-orange-600 dark:text-orange-400">Endpoint</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Selection Indicator */}
                {selectedModel?.repo_id === model.repo_id && (
                  <CheckCircleIcon className="h-6 w-6 text-blue-500 flex-shrink-0" />
                )}
              </div>
            </div>
          ))}
        </div>

        {filteredAndSortedModels.length === 0 && (
          <div className="text-center py-12">
            <MagnifyingGlassIcon className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">No models found</h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Try adjusting your search or filters.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
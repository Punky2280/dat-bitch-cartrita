import React, { useState, useRef, useCallback } from 'react';
import {
  DocumentIcon,
  DocumentTextIcon,
  TrashIcon,
  PlusIcon,
  MagnifyingGlassIcon,
  SparklesIcon,
  ClockIcon,
  InformationCircleIcon,
  XMarkIcon
} from '@heroicons/react/24/outline';
import { CheckCircleIcon } from '@heroicons/react/24/solid';

interface Document {
  id: string;
  name: string;
  content: string;
  size: number;
  type: 'text' | 'pdf' | 'json';
  uploadedAt: Date;
}

interface RAGResult {
  answer: string;
  confidence: number;
  context_used: Array<{
    document: any;
    score: number;
    relevance: number;
  }>;
  sources: Array<{
    id: number;
    content: string;
    score: number;
    relevance: number;
  }>;
  metadata: {
    query_expanded: boolean;
    total_candidates: number;
    reranked_count: number;
    models_used: {
      embeddingModel: string;
      rerankModel: string;
      generationModel: string;
    };
    pipeline_duration_ms: number;
  };
}

interface RAGPipelineInterfaceProps {
  token: string;
  className?: string;
}

export const RAGPipelineInterface: React.FC<RAGPipelineInterfaceProps> = ({
  token,
  className = ''
}) => {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [query, setQuery] = useState('');
  const [result, setResult] = useState<RAGResult | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [error, setError] = useState<string>('');

  // Advanced settings
  const [embeddingModel, setEmbeddingModel] = useState('BAAI/bge-large-en-v1.5');
  const [rerankModel, setRerankModel] = useState('BAAI/bge-reranker-large');
  const [generationModel, setGenerationModel] = useState('meta-llama/Meta-Llama-3-8B-Instruct');
  const [topKRetrieval, setTopKRetrieval] = useState(20);
  const [topKRerank, setTopKRerank] = useState(8);
  const [useMultiQuery, setUseMultiQuery] = useState(false);
  const [includeCitations, setIncludeCitations] = useState(true);
  const [budgetTier, setBudgetTier] = useState<'economy' | 'standard' | 'premium'>('standard');

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = useCallback(async (files: FileList) => {
    const newDocuments: Document[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      
      if (file.size > 10 * 1024 * 1024) { // 10MB limit
        setError(`File ${file.name} is too large (max 10MB)`);
        continue;
      }

      try {
        let content = '';
        let type: 'text' | 'pdf' | 'json' = 'text';

        if (file.type === 'application/json') {
          content = await file.text();
          type = 'json';
        } else if (file.type === 'application/pdf') {
          // For PDF, we'd need a PDF parser in a real implementation
          content = `[PDF Content] ${file.name} - This is a placeholder for PDF text extraction.`;
          type = 'pdf';
        } else {
          content = await file.text();
          type = 'text';
        }

        const doc: Document = {
          id: `doc_${Date.now()}_${i}`,
          name: file.name,
          content,
          size: file.size,
          type,
          uploadedAt: new Date()
        };

        newDocuments.push(doc);
      } catch (err) {
        console.error(`Error reading file ${file.name}:`, err);
        setError(`Failed to read file: ${file.name}`);
      }
    }

    setDocuments(prev => [...prev, ...newDocuments]);
    setError('');
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFileUpload(files);
    }
  }, [handleFileUpload]);

  const removeDocument = (id: string) => {
    setDocuments(prev => prev.filter(doc => doc.id !== id));
  };

  const executeRAGPipeline = async () => {
    if (!query.trim()) {
      setError('Please enter a query');
      return;
    }

    if (documents.length === 0) {
      setError('Please upload at least one document');
      return;
    }

    setIsProcessing(true);
    setError('');
    setResult(null);

    try {
      const documentStore = documents.map(doc => doc.content);

      const response = await fetch('/api/huggingface/rag', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          query,
          documentStore,
          embeddingModel,
          rerankModel,
          generationModel,
          topKRetrieval,
          topKRerank,
          useMultiQuery,
          includeCitations,
          budgetTier
        })
      });

      if (!response.ok) {
        throw new Error(`RAG pipeline failed: ${response.statusText}`);
      }

      const data = await response.json();
      setResult(data.result);
    } catch (err) {
      console.error('RAG pipeline error:', err);
      setError(err instanceof Error ? err.message : 'Failed to execute RAG pipeline');
    } finally {
      setIsProcessing(false);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return 'text-green-600 dark:text-green-400';
    if (confidence >= 0.6) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-red-600 dark:text-red-400';
  };

  return (
    <div className={`bg-white dark:bg-gray-800 rounded-lg shadow-lg ${className}`}>
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            <SparklesIcon className="h-6 w-6 text-purple-600" />
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              RAG Pipeline
            </h2>
          </div>
          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
          >
            Advanced Settings
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
          </div>
        )}

        {/* Document Upload */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Documents
          </label>
          
          {/* Upload Area */}
          <div
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-6 text-center hover:border-gray-400 dark:hover:border-gray-500 transition-colors"
          >
            <DocumentIcon className="mx-auto h-12 w-12 text-gray-400" />
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
              Drag and drop files here, or{' '}
              <button
                onClick={() => fileInputRef.current?.click()}
                className="text-blue-600 hover:text-blue-700 underline"
              >
                browse
              </button>
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
              Supports text files, PDFs, and JSON (max 10MB each)
            </p>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".txt,.pdf,.json,.md"
            onChange={(e) => e.target.files && handleFileUpload(e.target.files)}
            className="hidden"
          />

          {/* Document List */}
          {documents.length > 0 && (
            <div className="mt-4 space-y-2">
              {documents.map((doc) => (
                <div
                  key={doc.id}
                  className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg"
                >
                  <div className="flex items-center space-x-3">
                    <DocumentTextIcon className="h-5 w-5 text-gray-400" />
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                        {doc.name}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {formatFileSize(doc.size)} • {doc.type.toUpperCase()}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => removeDocument(doc.id)}
                    className="text-gray-400 hover:text-red-600 transition-colors"
                  >
                    <TrashIcon className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Advanced Settings */}
        {showAdvanced && (
          <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
            <h3 className="font-medium text-gray-900 dark:text-white mb-3">
              Pipeline Configuration
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Embedding Model
                </label>
                <select
                  value={embeddingModel}
                  onChange={(e) => setEmbeddingModel(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="BAAI/bge-large-en-v1.5">BGE Large EN v1.5</option>
                  <option value="sentence-transformers/all-MiniLM-L6-v2">MiniLM L6 v2</option>
                  <option value="intfloat/e5-large-v2">E5 Large v2</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Rerank Model
                </label>
                <select
                  value={rerankModel}
                  onChange={(e) => setRerankModel(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="BAAI/bge-reranker-large">BGE Reranker Large</option>
                  <option value="cross-encoder/ms-marco-MiniLM-L-6-v2">MiniLM Cross Encoder</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Generation Model
                </label>
                <select
                  value={generationModel}
                  onChange={(e) => setGenerationModel(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="meta-llama/Meta-Llama-3-8B-Instruct">Llama 3 8B</option>
                  <option value="meta-llama/Meta-Llama-3-70B-Instruct">Llama 3 70B</option>
                  <option value="mistralai/Mixtral-8x7B-Instruct-v0.1">Mixtral 8x7B</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Budget Tier
                </label>
                <select
                  value={budgetTier}
                  onChange={(e) => setBudgetTier(e.target.value as any)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="economy">Economy</option>
                  <option value="standard">Standard</option>
                  <option value="premium">Premium</option>
                </select>
              </div>

              <div className="flex items-center space-x-4 text-sm">
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={useMultiQuery}
                    onChange={(e) => setUseMultiQuery(e.target.checked)}
                    className="rounded border-gray-300"
                  />
                  <span className="text-gray-700 dark:text-gray-300">Multi Query</span>
                </label>
                
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={includeCitations}
                    onChange={(e) => setIncludeCitations(e.target.checked)}
                    className="rounded border-gray-300"
                  />
                  <span className="text-gray-700 dark:text-gray-300">Citations</span>
                </label>
              </div>
            </div>
          </div>
        )}

        {/* Query Input */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Query
          </label>
          <div className="flex space-x-3">
            <div className="flex-1 relative">
              <textarea
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Ask a question about your documents..."
                rows={3}
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
            </div>
            <button
              onClick={executeRAGPipeline}
              disabled={isProcessing || !query.trim() || documents.length === 0}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white rounded-lg transition-colors flex items-center space-x-2"
            >
              {isProcessing ? (
                <>
                  <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                  <span>Processing</span>
                </>
              ) : (
                <>
                  <MagnifyingGlassIcon className="h-4 w-4" />
                  <span>Search</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Results */}
        {result && (
          <div className="space-y-6">
            {/* Answer */}
            <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
              <div className="flex items-start justify-between mb-3">
                <h3 className="font-medium text-blue-900 dark:text-blue-100">Answer</h3>
                <div className="flex items-center space-x-2 text-sm">
                  <span className="text-gray-600 dark:text-gray-400">Confidence:</span>
                  <span className={`font-medium ${getConfidenceColor(result.confidence)}`}>
                    {Math.round(result.confidence * 100)}%
                  </span>
                </div>
              </div>
              <p className="text-blue-800 dark:text-blue-200 leading-relaxed">
                {result.answer}
              </p>
            </div>

            {/* Sources */}
            <div>
              <h3 className="font-medium text-gray-900 dark:text-white mb-3">Sources</h3>
              <div className="space-y-2">
                {result.sources.map((source) => (
                  <div
                    key={source.id}
                    className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        Source {source.id}
                      </span>
                      <div className="flex items-center space-x-2 text-xs text-gray-500">
                        <span>Score: {source.score.toFixed(3)}</span>
                        <span>Relevance: {source.relevance.toFixed(2)}</span>
                      </div>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {source.content.length > 200 
                        ? source.content.substring(0, 200) + '...'
                        : source.content
                      }
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Metadata */}
            <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <h3 className="font-medium text-gray-900 dark:text-white mb-3">Pipeline Metadata</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <span className="text-gray-600 dark:text-gray-400">Duration:</span>
                  <p className="font-medium text-gray-900 dark:text-white">
                    {result.metadata.pipeline_duration_ms}ms
                  </p>
                </div>
                <div>
                  <span className="text-gray-600 dark:text-gray-400">Candidates:</span>
                  <p className="font-medium text-gray-900 dark:text-white">
                    {result.metadata.total_candidates}
                  </p>
                </div>
                <div>
                  <span className="text-gray-600 dark:text-gray-400">Reranked:</span>
                  <p className="font-medium text-gray-900 dark:text-white">
                    {result.metadata.reranked_count}
                  </p>
                </div>
                <div>
                  <span className="text-gray-600 dark:text-gray-400">Query Expanded:</span>
                  <p className="font-medium text-gray-900 dark:text-white">
                    {result.metadata.query_expanded ? 'Yes' : 'No'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
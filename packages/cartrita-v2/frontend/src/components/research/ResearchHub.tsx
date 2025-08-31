/**
 * Research Hub Component
 * Advanced academic research interface with paper search and analysis
 */
'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  MagnifyingGlassIcon,
  DocumentTextIcon,
  BookOpenIcon,
  StarIcon,
  CalendarIcon,
  UserGroupIcon,
  LinkIcon,
  DownloadIcon,
  EyeIcon,
  ChartBarIcon,
  FilterIcon,
  AcademicCapIcon,
  ClockIcon,
  TagIcon,
} from '@heroicons/react/24/outline';
import { useResearchStore } from '@/stores';

interface ResearchPaper {
  id: string;
  title: string;
  authors: string[];
  abstract: string;
  publishedDate: Date;
  journal: string;
  citations: number;
  downloads: number;
  pdfUrl?: string;
  arxivId?: string;
  doi?: string;
  keywords: string[];
  category: string;
  impact: number;
}

interface SearchFilters {
  category: string;
  dateRange: string;
  sortBy: string;
  minCitations: number;
}

const RESEARCH_CATEGORIES = [
  'All Fields',
  'Artificial Intelligence',
  'Machine Learning',
  'Quantum Computing',
  'Computer Vision',
  'Natural Language Processing',
  'Robotics',
  'Cybersecurity',
  'Blockchain',
  'Data Science',
  'Bioinformatics',
  'Human-Computer Interaction'
];

const SAMPLE_PAPERS: ResearchPaper[] = [
  {
    id: '1',
    title: 'Attention Is All You Need: Transformer Architecture for Neural Machine Translation',
    authors: ['Vaswani, A.', 'Shazeer, N.', 'Parmar, N.', 'Uszkoreit, J.'],
    abstract: 'The dominant sequence transduction models are based on complex recurrent or convolutional neural networks that include an encoder and a decoder. The best performing models also connect the encoder and decoder through an attention mechanism. We propose a new simple network architecture, the Transformer, based solely on attention mechanisms, dispensing with recurrence and convolutions entirely.',
    publishedDate: new Date('2017-06-12'),
    journal: 'Advances in Neural Information Processing Systems',
    citations: 89247,
    downloads: 1245632,
    arxivId: '1706.03762',
    doi: '10.48550/arXiv.1706.03762',
    keywords: ['Transformers', 'Attention', 'Neural Networks', 'NLP'],
    category: 'Natural Language Processing',
    impact: 9.8
  },
  {
    id: '2',
    title: 'Quantum Supremacy Using a Programmable Superconducting Processor',
    authors: ['Arute, F.', 'Arya, K.', 'Babbush, R.', 'Bacon, D.'],
    abstract: 'The promise of quantum computers is that certain computational tasks might be executed exponentially faster on a quantum processor than on a classical processor. A fundamental challenge is to build a high-fidelity processor capable of running quantum algorithms in an exponentially large computational space.',
    publishedDate: new Date('2019-10-23'),
    journal: 'Nature',
    citations: 4567,
    downloads: 89234,
    doi: '10.1038/s41586-019-1666-5',
    keywords: ['Quantum Computing', 'Quantum Supremacy', 'Superconducting'],
    category: 'Quantum Computing',
    impact: 9.2
  },
  {
    id: '3',
    title: 'BERT: Pre-training of Deep Bidirectional Transformers for Language Understanding',
    authors: ['Devlin, J.', 'Chang, M.W.', 'Lee, K.', 'Toutanova, K.'],
    abstract: 'We introduce a new language representation model called BERT, which stands for Bidirectional Encoder Representations from Transformers. Unlike recent language representation models, BERT is designed to pre-train deep bidirectional representations from unlabeled text by jointly conditioning on both left and right context in all layers.',
    publishedDate: new Date('2018-10-11'),
    journal: 'NAACL-HLT',
    citations: 67834,
    downloads: 892345,
    arxivId: '1810.04805',
    doi: '10.48550/arXiv.1810.04805',
    keywords: ['BERT', 'Transformers', 'Language Models', 'Pre-training'],
    category: 'Natural Language Processing',
    impact: 9.6
  }
];

export default function ResearchHub() {
  const {
    papers,
    isLoading,
    searchResults,
    searchPapers,
    analyzePaper,
    savePaper
  } = useResearchStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<SearchFilters>({
    category: 'All Fields',
    dateRange: 'all',
    sortBy: 'relevance',
    minCitations: 0
  });
  const [selectedPaper, setSelectedPaper] = useState<ResearchPaper | null>(null);
  const [researchPapers, setResearchPapers] = useState<ResearchPaper[]>(SAMPLE_PAPERS);
  const [displayedPapers, setDisplayedPapers] = useState<ResearchPaper[]>(SAMPLE_PAPERS);

  // Filter and search papers
  useEffect(() => {
    let filtered = researchPapers;

    // Filter by category
    if (filters.category !== 'All Fields') {
      filtered = filtered.filter(paper => paper.category === filters.category);
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(paper => 
        paper.title.toLowerCase().includes(query) ||
        paper.abstract.toLowerCase().includes(query) ||
        paper.authors.some(author => author.toLowerCase().includes(query)) ||
        paper.keywords.some(keyword => keyword.toLowerCase().includes(query))
      );
    }

    // Filter by citations
    if (filters.minCitations > 0) {
      filtered = filtered.filter(paper => paper.citations >= filters.minCitations);
    }

    // Sort papers
    switch (filters.sortBy) {
      case 'citations':
        filtered.sort((a, b) => b.citations - a.citations);
        break;
      case 'date':
        filtered.sort((a, b) => b.publishedDate.getTime() - a.publishedDate.getTime());
        break;
      case 'impact':
        filtered.sort((a, b) => b.impact - a.impact);
        break;
      default:
        // Keep current order for relevance
        break;
    }

    setDisplayedPapers(filtered);
  }, [searchQuery, filters, researchPapers]);

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      return;
    }

    try {
      await searchPapers(searchQuery, filters);
      // In a real app, this would update the papers from the store
      // For now, we'll simulate with the existing sample data
    } catch (error) {
      console.error('Search failed:', error);
    }
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const formatNumber = (num: number) => {
    if (num >= 1000000) {
      return `${(num / 1000000).toFixed(1)}M`;
    }
    if (num >= 1000) {
      return `${(num / 1000).toFixed(1)}K`;
    }
    return num.toString();
  };

  const getImpactColor = (impact: number) => {
    if (impact >= 9) {
      return 'text-green-600 bg-green-100 dark:bg-green-900/20';
    }
    if (impact >= 7) {
      return 'text-yellow-600 bg-yellow-100 dark:bg-yellow-900/20';
    }
    if (impact >= 5) {
      return 'text-orange-600 bg-orange-100 dark:bg-orange-900/20';
    }
    return 'text-red-600 bg-red-100 dark:bg-red-900/20';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-900/20">
            <AcademicCapIcon className="w-6 h-6 text-purple-600" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
              Research Hub
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Discover, analyze, and organize academic research papers
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-400">
          <DocumentTextIcon className="w-4 h-4" />
          <span>{displayedPapers.length} papers found</span>
        </div>
      </div>

      {/* Search Bar */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="flex items-center space-x-4 mb-4">
          <div className="flex-1 relative">
            <MagnifyingGlassIcon className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search papers, authors, keywords..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
              className="w-full pl-10 pr-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 dark:bg-gray-700 dark:text-white"
            />
          </div>
          <button
            onClick={handleSearch}
            disabled={isLoading || !searchQuery.trim()}
            className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
          >
            {isLoading ? (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
            ) : (
              <MagnifyingGlassIcon className="w-4 h-4" />
            )}
            <span>Search</span>
          </button>
        </div>

        {/* Filters */}
        <div className="flex items-center space-x-4 text-sm">
          <FilterIcon className="w-4 h-4 text-gray-500" />
          
          <select
            value={filters.category}
            onChange={(e) => setFilters({...filters, category: e.target.value})}
            className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 dark:bg-gray-700 dark:text-white"
          >
            {RESEARCH_CATEGORIES.map(category => (
              <option key={category} value={category}>{category}</option>
            ))}
          </select>

          <select
            value={filters.dateRange}
            onChange={(e) => setFilters({...filters, dateRange: e.target.value})}
            className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 dark:bg-gray-700 dark:text-white"
          >
            <option value="all">All Time</option>
            <option value="year">Past Year</option>
            <option value="5years">Past 5 Years</option>
            <option value="10years">Past 10 Years</option>
          </select>

          <select
            value={filters.sortBy}
            onChange={(e) => setFilters({...filters, sortBy: e.target.value})}
            className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 dark:bg-gray-700 dark:text-white"
          >
            <option value="relevance">Relevance</option>
            <option value="citations">Citations</option>
            <option value="date">Publication Date</option>
            <option value="impact">Impact Score</option>
          </select>
        </div>
      </div>

      {/* Papers Grid */}
      <div className="space-y-4">
        {displayedPapers.map((paper, index) => (
          <motion.div
            key={paper.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700 hover:shadow-md transition-shadow cursor-pointer"
            onClick={() => setSelectedPaper(paper)}
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1 pr-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2 hover:text-purple-600 dark:hover:text-purple-400 transition-colors">
                  {paper.title}
                </h3>
                <div className="flex items-center space-x-4 text-sm text-gray-600 dark:text-gray-400 mb-3">
                  <div className="flex items-center space-x-1">
                    <UserGroupIcon className="w-4 h-4" />
                    <span>{paper.authors.slice(0, 3).join(', ')}{paper.authors.length > 3 && ' et al.'}</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <CalendarIcon className="w-4 h-4" />
                    <span>{formatDate(paper.publishedDate)}</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <BookOpenIcon className="w-4 h-4" />
                    <span>{paper.journal}</span>
                  </div>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-3">
                  {paper.abstract}
                </p>
              </div>

              <div className={`px-3 py-1 rounded-full text-xs font-medium ${getImpactColor(paper.impact)}`}>
                Impact: {paper.impact}
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-6 text-sm text-gray-500">
                <div className="flex items-center space-x-1">
                  <StarIcon className="w-4 h-4" />
                  <span>{formatNumber(paper.citations)} citations</span>
                </div>
                <div className="flex items-center space-x-1">
                  <DownloadIcon className="w-4 h-4" />
                  <span>{formatNumber(paper.downloads)} downloads</span>
                </div>
                {paper.arxivId && (
                  <div className="flex items-center space-x-1">
                    <LinkIcon className="w-4 h-4" />
                    <span>arXiv:{paper.arxivId}</span>
                  </div>
                )}
              </div>

              <div className="flex items-center space-x-2">
                {paper.keywords.slice(0, 3).map(keyword => (
                  <span
                    key={keyword}
                    className="px-2 py-1 bg-gray-100 dark:bg-gray-700 text-xs text-gray-600 dark:text-gray-400 rounded-full"
                  >
                    {keyword}
                  </span>
                ))}
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Paper Detail Modal */}
      {selectedPaper && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white dark:bg-gray-800 rounded-xl p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-start justify-between mb-6">
              <div className="flex-1 pr-4">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                  {selectedPaper.title}
                </h2>
                <div className="flex items-center space-x-4 text-sm text-gray-600 dark:text-gray-400">
                  <span>{selectedPaper.authors.join(', ')}</span>
                  <span>•</span>
                  <span>{formatDate(selectedPaper.publishedDate)}</span>
                  <span>•</span>
                  <span>{selectedPaper.journal}</span>
                </div>
              </div>
              <button
                onClick={() => setSelectedPaper(null)}
                className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 text-2xl"
              >
                ×
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-6">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                    Abstract
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400 leading-relaxed">
                    {selectedPaper.abstract}
                  </p>
                </div>

                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                    Keywords
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {selectedPaper.keywords.map(keyword => (
                      <span
                        key={keyword}
                        className="px-3 py-1 bg-purple-100 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 text-sm rounded-full"
                      >
                        <TagIcon className="w-3 h-3 inline mr-1" />
                        {keyword}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                  <h4 className="font-medium text-gray-900 dark:text-white mb-3">
                    Paper Metrics
                  </h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Citations:</span>
                      <span className="font-medium">{formatNumber(selectedPaper.citations)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Downloads:</span>
                      <span className="font-medium">{formatNumber(selectedPaper.downloads)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Impact Score:</span>
                      <span className="font-medium">{selectedPaper.impact}/10</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Category:</span>
                      <span className="font-medium">{selectedPaper.category}</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  {selectedPaper.pdfUrl && (
                    <button className="w-full px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center justify-center space-x-2">
                      <DocumentTextIcon className="w-4 h-4" />
                      <span>View PDF</span>
                    </button>
                  )}
                  
                  {selectedPaper.arxivId && (
                    <button className="w-full px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 flex items-center justify-center space-x-2">
                      <LinkIcon className="w-4 h-4" />
                      <span>arXiv Link</span>
                    </button>
                  )}

                  <button 
                    onClick={() => savePaper(selectedPaper.id)}
                    className="w-full px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 flex items-center justify-center space-x-2"
                  >
                    <BookOpenIcon className="w-4 h-4" />
                    <span>Save to Library</span>
                  </button>

                  <button 
                    onClick={() => analyzePaper(selectedPaper.id)}
                    className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center justify-center space-x-2"
                  >
                    <ChartBarIcon className="w-4 h-4" />
                    <span>AI Analysis</span>
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {displayedPapers.length === 0 && !isLoading && (
        <div className="text-center py-12">
          <DocumentTextIcon className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            No papers found
          </h3>
          <p className="text-gray-600 dark:text-gray-400">
            Try adjusting your search query or filters
          </p>
        </div>
      )}
    </div>
  );
}
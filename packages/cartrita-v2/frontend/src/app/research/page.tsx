/**
 * Research Hub Page - Cartrita V2
 * Academic research and document analysis interface
 */
'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AcademicCapIcon,
  DocumentTextIcon,
  MagnifyingGlassIcon,
  BookOpenIcon,
  PlusIcon,
  EyeIcon,
  DownloadIcon,
  HeartIcon,
  ShareIcon,
  TagIcon,
  CalendarIcon,
  UserIcon,
  ClipboardDocumentCheckIcon,
  ArrowTopRightOnSquareIcon,
  FolderIcon,
  ChartBarIcon,
  BeakerIcon,
  PencilIcon,
  TrashIcon,
  StarIcon,
} from '@heroicons/react/24/outline';
import { HeartIcon as HeartSolidIcon } from '@heroicons/react/24/solid';
import AppLayout from '@/components/layout/AppLayout';
import { useResearchStore } from '@/stores';

interface ResearchPaper {
  id: string;
  title: string;
  authors: string[];
  abstract: string;
  journal: string;
  publication_date: string;
  doi?: string;
  arxiv_id?: string;
  pdf_url?: string;
  citations: number;
  keywords: string[];
  category: string;
  status: 'new' | 'reading' | 'read' | 'cited';
  rating?: number;
  notes?: string;
  added_at: string;
  is_favorite: boolean;
}

interface ResearchProject {
  id: string;
  title: string;
  description: string;
  papers: string[];
  notes: string;
  created_at: string;
  updated_at: string;
  tags: string[];
  status: 'active' | 'completed' | 'archived';
}

interface SearchQuery {
  query: string;
  sources: string[];
  filters: {
    year_from?: number;
    year_to?: number;
    category?: string;
    journal?: string;
  };
}

const RESEARCH_CATEGORIES = [
  'Computer Science',
  'Mathematics',
  'Physics',
  'Biology',
  'Chemistry',
  'Medicine',
  'Psychology',
  'Economics',
  'Engineering',
  'Other'
];

const RESEARCH_SOURCES = [
  { id: 'arxiv', name: 'arXiv', description: 'Preprint repository' },
  { id: 'pubmed', name: 'PubMed', description: 'Medical literature' },
  { id: 'semantic_scholar', name: 'Semantic Scholar', description: 'AI-powered search' },
  { id: 'google_scholar', name: 'Google Scholar', description: 'Academic search' },
  { id: 'crossref', name: 'CrossRef', description: 'DOI resolver' }
];

export default function ResearchHubPage() {
  const {
    papers,
    projects,
    selectedPaper,
    selectedProject,
    isLoading,
    error,
    searchPapers,
    addPaper,
    updatePaper,
    deletePaper,
    createProject,
    updateProject,
    deleteProject,
    selectPaper,
    selectProject
  } = useResearchStore();

  const [activeTab, setActiveTab] = useState<'search' | 'library' | 'projects' | 'analysis'>('search');
  const [searchQuery, setSearchQuery] = useState<SearchQuery>({
    query: '',
    sources: ['semantic_scholar'],
    filters: {}
  });
  const [searchResults, setSearchResults] = useState<ResearchPaper[]>([]);
  const [showPaperModal, setShowPaperModal] = useState(false);
  const [showProjectModal, setShowProjectModal] = useState(false);
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('added_at');

  useEffect(() => {
    // Load user's research library on mount
  }, []);

  const handleSearch = async () => {
    if (!searchQuery.query.trim()) {
      return;
    }
    
    try {
      const results = await searchPapers(searchQuery);
      setSearchResults(results);
    } catch (error) {
      console.error('Search failed:', error);
    }
  };

  const handleAddPaper = (paper: ResearchPaper) => {
    addPaper(paper);
    setSearchResults(prev => prev.filter(p => p.id !== paper.id));
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'new':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300';
      case 'reading':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300';
      case 'read':
        return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300';
      case 'cited':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300';
    }
  };

  const renderRating = (rating: number) => {
    return (
      <div className="flex items-center">
        {[1, 2, 3, 4, 5].map((star) => (
          <StarIcon
            key={star}
            className={`w-4 h-4 ${
              star <= rating
                ? 'text-yellow-400 fill-current'
                : 'text-gray-300'
            }`}
          />
        ))}
      </div>
    );
  };

  const filteredPapers = papers.filter(paper => {
    const matchesCategory = filterCategory === 'all' || paper.category === filterCategory;
    const matchesStatus = filterStatus === 'all' || paper.status === filterStatus;
    return matchesCategory && matchesStatus;
  });

  const sortedPapers = [...filteredPapers].sort((a, b) => {
    switch (sortBy) {
      case 'title':
        return a.title.localeCompare(b.title);
      case 'publication_date':
        return new Date(b.publication_date).getTime() - new Date(a.publication_date).getTime();
      case 'citations':
        return b.citations - a.citations;
      case 'rating':
        return (b.rating || 0) - (a.rating || 0);
      default:
        return new Date(b.added_at).getTime() - new Date(a.added_at).getTime();
    }
  });

  const libraryStats = {
    total: papers.length,
    new: papers.filter(p => p.status === 'new').length,
    reading: papers.filter(p => p.status === 'reading').length,
    read: papers.filter(p => p.status === 'read').length,
    favorites: papers.filter(p => p.is_favorite).length
  };

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-8">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between mb-6">
            <div className="flex items-center mb-4 lg:mb-0">
              <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center mr-4">
                <AcademicCapIcon className="w-7 h-7 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                  Research Hub
                </h1>
                <p className="text-lg text-gray-600 dark:text-gray-400">
                  Discover, organize, and analyze academic research
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-4">
              <button
                onClick={() => setShowProjectModal(true)}
                className="flex items-center px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
              >
                <PlusIcon className="w-5 h-5 mr-2" />
                New Project
              </button>
            </div>
          </div>

          {/* Library Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
            <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
              <div className="text-2xl font-bold text-gray-900 dark:text-white">
                {libraryStats.total}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Total Papers</div>
            </div>
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
              <div className="text-2xl font-bold text-blue-700 dark:text-blue-400">
                {libraryStats.new}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">New</div>
            </div>
            <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-4">
              <div className="text-2xl font-bold text-yellow-700 dark:text-yellow-400">
                {libraryStats.reading}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Reading</div>
            </div>
            <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4">
              <div className="text-2xl font-bold text-green-700 dark:text-green-400">
                {libraryStats.read}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Read</div>
            </div>
            <div className="bg-pink-50 dark:bg-pink-900/20 rounded-lg p-4">
              <div className="text-2xl font-bold text-pink-700 dark:text-pink-400">
                {libraryStats.favorites}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Favorites</div>
            </div>
          </div>

          {/* Tab Navigation */}
          <div className="flex space-x-1 bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
            {[
              { id: 'search', name: 'Search', icon: MagnifyingGlassIcon },
              { id: 'library', name: 'My Library', icon: BookOpenIcon },
              { id: 'projects', name: 'Projects', icon: FolderIcon },
              { id: 'analysis', name: 'Analysis', icon: ChartBarIcon }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  activeTab === tab.id
                    ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                <tab.icon className="w-4 h-4 mr-2" />
                {tab.name}
              </button>
            ))}
          </div>
        </div>

        {/* Tab Content */}
        <AnimatePresence mode="wait">
          {/* Search Tab */}
          {activeTab === 'search' && (
            <motion.div
              key="search"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              {/* Search Form */}
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-6">
                  Search Academic Papers
                </h2>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Search Query
                    </label>
                    <div className="flex space-x-2">
                      <input
                        type="text"
                        value={searchQuery.query}
                        onChange={(e) => setSearchQuery({
                          ...searchQuery,
                          query: e.target.value
                        })}
                        placeholder="Enter keywords, authors, or topics..."
                        className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            handleSearch();
                          }
                        }}
                      />
                      <button
                        onClick={handleSearch}
                        disabled={isLoading || !searchQuery.query.trim()}
                        className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        {isLoading ? (
                          <div className="animate-spin w-5 h-5 border-2 border-white border-t-transparent rounded-full" />
                        ) : (
                          <MagnifyingGlassIcon className="w-5 h-5" />
                        )}
                      </button>
                    </div>
                  </div>
                  
                  {/* Search Sources */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Search Sources
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {RESEARCH_SOURCES.map(source => (
                        <button
                          key={source.id}
                          onClick={() => setSearchQuery({
                            ...searchQuery,
                            sources: searchQuery.sources.includes(source.id)
                              ? searchQuery.sources.filter(s => s !== source.id)
                              : [...searchQuery.sources, source.id]
                          })}
                          className={`px-3 py-1 text-sm rounded-full border transition-colors ${
                            searchQuery.sources.includes(source.id)
                              ? 'bg-indigo-100 border-indigo-300 text-indigo-800 dark:bg-indigo-900/30 dark:border-indigo-600 dark:text-indigo-300'
                              : 'bg-white border-gray-300 text-gray-700 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600'
                          }`}
                        >
                          {source.name}
                        </button>
                      ))}
                    </div>
                  </div>
                  
                  {/* Search Filters */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Year From
                      </label>
                      <input
                        type="number"
                        value={searchQuery.filters.year_from || ''}
                        onChange={(e) => setSearchQuery({
                          ...searchQuery,
                          filters: {
                            ...searchQuery.filters,
                            year_from: e.target.value ? parseInt(e.target.value) : undefined
                          }
                        })}
                        placeholder="2020"
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Year To
                      </label>
                      <input
                        type="number"
                        value={searchQuery.filters.year_to || ''}
                        onChange={(e) => setSearchQuery({
                          ...searchQuery,
                          filters: {
                            ...searchQuery.filters,
                            year_to: e.target.value ? parseInt(e.target.value) : undefined
                          }
                        })}
                        placeholder="2024"
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Category
                      </label>
                      <select
                        value={searchQuery.filters.category || ''}
                        onChange={(e) => setSearchQuery({
                          ...searchQuery,
                          filters: {
                            ...searchQuery.filters,
                            category: e.target.value || undefined
                          }
                        })}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                      >
                        <option value="">All Categories</option>
                        {RESEARCH_CATEGORIES.map(category => (
                          <option key={category} value={category}>
                            {category}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Journal
                      </label>
                      <input
                        type="text"
                        value={searchQuery.filters.journal || ''}
                        onChange={(e) => setSearchQuery({
                          ...searchQuery,
                          filters: {
                            ...searchQuery.filters,
                            journal: e.target.value || undefined
                          }
                        })}
                        placeholder="Nature, Science..."
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                      />
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Search Results */}
              {searchResults.length > 0 && (
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
                  <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                      Search Results ({searchResults.length})
                    </h3>
                  </div>
                  <div className="divide-y divide-gray-200 dark:divide-gray-700">
                    {searchResults.map((paper) => (
                      <div key={paper.id} className="p-6">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                              {paper.title}
                            </h4>
                            <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                              {paper.authors.join(', ')}
                            </p>
                            <p className="text-sm text-gray-700 dark:text-gray-300 mb-3 line-clamp-3">
                              {paper.abstract}
                            </p>
                            <div className="flex items-center space-x-4 text-sm text-gray-500">
                              <span>{paper.journal}</span>
                              <span>•</span>
                              <span>{new Date(paper.publication_date).getFullYear()}</span>
                              <span>•</span>
                              <span>{paper.citations} citations</span>
                            </div>
                          </div>
                          <div className="flex items-center space-x-2 ml-4">
                            <button
                              onClick={() => handleAddPaper(paper)}
                              className="px-3 py-1 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm transition-colors"
                            >
                              Add to Library
                            </button>
                            {paper.pdf_url && (
                              <button
                                onClick={() => window.open(paper.pdf_url, '_blank')}
                                className="p-2 text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
                              >
                                <ArrowTopRightOnSquareIcon className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {/* Library Tab */}
          {activeTab === 'library' && (
            <motion.div
              key="library"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              {/* Filters and Sorting */}
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                <div className="flex flex-col sm:flex-row gap-4">
                  <select
                    value={filterCategory}
                    onChange={(e) => setFilterCategory(e.target.value)}
                    className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="all">All Categories</option>
                    {RESEARCH_CATEGORIES.map(category => (
                      <option key={category} value={category}>
                        {category}
                      </option>
                    ))}
                  </select>
                  
                  <select
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                    className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="all">All Status</option>
                    <option value="new">New</option>
                    <option value="reading">Reading</option>
                    <option value="read">Read</option>
                    <option value="cited">Cited</option>
                  </select>
                  
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="added_at">Recently Added</option>
                    <option value="title">Title</option>
                    <option value="publication_date">Publication Date</option>
                    <option value="citations">Citations</option>
                    <option value="rating">Rating</option>
                  </select>
                </div>
              </div>

              {/* Papers List */}
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
                {sortedPapers.length > 0 ? (
                  <div className="divide-y divide-gray-200 dark:divide-gray-700">
                    {sortedPapers.map((paper) => (
                      <div key={paper.id} className="p-6">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center space-x-3 mb-2">
                              <h4 className="text-lg font-medium text-gray-900 dark:text-white">
                                {paper.title}
                              </h4>
                              <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(paper.status)}`}>
                                {paper.status}
                              </span>
                              {paper.is_favorite && (
                                <HeartSolidIcon className="w-4 h-4 text-red-500" />
                              )}
                            </div>
                            
                            <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                              {paper.authors.join(', ')}
                            </p>
                            
                            <div className="flex items-center space-x-4 text-sm text-gray-500 mb-3">
                              <span>{paper.journal}</span>
                              <span>•</span>
                              <span>{new Date(paper.publication_date).getFullYear()}</span>
                              <span>•</span>
                              <span>{paper.citations} citations</span>
                              {paper.rating && (
                                <>
                                  <span>•</span>
                                  {renderRating(paper.rating)}
                                </>
                              )}
                            </div>
                            
                            {paper.keywords.length > 0 && (
                              <div className="flex flex-wrap gap-2 mb-3">
                                {paper.keywords.slice(0, 5).map((keyword) => (
                                  <span
                                    key={keyword}
                                    className="px-2 py-1 text-xs bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-full"
                                  >
                                    {keyword}
                                  </span>
                                ))}
                                {paper.keywords.length > 5 && (
                                  <span className="text-xs text-gray-500">
                                    +{paper.keywords.length - 5} more
                                  </span>
                                )}
                              </div>
                            )}
                            
                            {paper.notes && (
                              <p className="text-sm text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-700 rounded-lg p-3 mt-3">
                                {paper.notes}
                              </p>
                            )}
                          </div>
                          
                          <div className="flex items-center space-x-2 ml-4">
                            <button
                              onClick={() => updatePaper(paper.id, { is_favorite: !paper.is_favorite })}
                              className={`p-2 rounded-lg transition-colors ${
                                paper.is_favorite
                                  ? 'text-red-500 hover:bg-red-100 dark:hover:bg-red-900/30'
                                  : 'text-gray-400 hover:text-red-500 hover:bg-gray-100 dark:hover:bg-gray-700'
                              }`}
                            >
                              {paper.is_favorite ? (
                                <HeartSolidIcon className="w-4 h-4" />
                              ) : (
                                <HeartIcon className="w-4 h-4" />
                              )}
                            </button>
                            
                            <button
                              onClick={() => {
                                selectPaper(paper.id);
                                setShowPaperModal(true);
                              }}
                              className="p-2 text-blue-600 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded-lg transition-colors"
                            >
                              <PencilIcon className="w-4 h-4" />
                            </button>
                            
                            <button
                              onClick={() => deletePaper(paper.id)}
                              className="p-2 text-red-600 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                            >
                              <TrashIcon className="w-4 h-4" />
                            </button>
                            
                            {paper.pdf_url && (
                              <button
                                onClick={() => window.open(paper.pdf_url, '_blank')}
                                className="p-2 text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100 rounded-lg transition-colors"
                              >
                                <ArrowTopRightOnSquareIcon className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <BookOpenIcon className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                      No papers in your library
                    </h3>
                    <p className="text-gray-600 dark:text-gray-400">
                      Start by searching for papers to add to your collection.
                    </p>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* Projects Tab */}
          {activeTab === 'projects' && (
            <motion.div
              key="projects"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6"
            >
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-6">
                Research Projects
              </h2>
              
              {projects.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {projects.map((project) => (
                    <div
                      key={project.id}
                      className="border border-gray-200 dark:border-gray-700 rounded-lg p-6 hover:shadow-md transition-shadow"
                    >
                      <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                        {project.title}
                      </h3>
                      <p className="text-gray-600 dark:text-gray-400 text-sm mb-4">
                        {project.description}
                      </p>
                      
                      <div className="flex items-center justify-between text-sm text-gray-500 mb-3">
                        <span>{project.papers.length} papers</span>
                        <span>{new Date(project.updated_at).toLocaleDateString()}</span>
                      </div>
                      
                      {project.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mb-4">
                          {project.tags.map((tag) => (
                            <span
                              key={tag}
                              className="px-2 py-1 text-xs bg-indigo-100 dark:bg-indigo-900/30 text-indigo-800 dark:text-indigo-300 rounded-full"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                      
                      <div className="flex items-center justify-between">
                        <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                          project.status === 'active'
                            ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                            : project.status === 'completed'
                            ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'
                            : 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300'
                        }`}>
                          {project.status}
                        </span>
                        
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => {
                              selectProject(project.id);
                              setShowProjectModal(true);
                            }}
                            className="p-1 text-blue-600 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded"
                          >
                            <PencilIcon className="w-4 h-4" />
                          </button>
                          
                          <button
                            onClick={() => deleteProject(project.id)}
                            className="p-1 text-red-600 hover:bg-red-100 dark:hover:bg-red-900/30 rounded"
                          >
                            <TrashIcon className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <FolderIcon className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                    No research projects yet
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400 mb-6">
                    Create projects to organize your research papers and notes.
                  </p>
                  <button
                    onClick={() => setShowProjectModal(true)}
                    className="px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                  >
                    Create Your First Project
                  </button>
                </div>
              )}
            </motion.div>
          )}

          {/* Analysis Tab */}
          {activeTab === 'analysis' && (
            <motion.div
              key="analysis"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6"
            >
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-6">
                Research Analytics
              </h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Category Distribution */}
                <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                    Papers by Category
                  </h3>
                  <div className="space-y-2">
                    {RESEARCH_CATEGORIES.map((category) => {
                      const count = papers.filter(p => p.category === category).length;
                      const percentage = papers.length > 0 ? (count / papers.length) * 100 : 0;
                      
                      return count > 0 ? (
                        <div key={category} className="flex items-center justify-between">
                          <span className="text-sm text-gray-700 dark:text-gray-300">
                            {category}
                          </span>
                          <div className="flex items-center space-x-2">
                            <div className="w-24 bg-gray-200 dark:bg-gray-600 rounded-full h-2">
                              <div
                                className="bg-indigo-600 h-2 rounded-full"
                                style={{ width: `${percentage}%` }}
                              />
                            </div>
                            <span className="text-sm text-gray-600 dark:text-gray-400 w-8">
                              {count}
                            </span>
                          </div>
                        </div>
                      ) : null;
                    })}
                  </div>
                </div>

                {/* Reading Progress */}
                <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                    Reading Progress
                  </h3>
                  <div className="space-y-3">
                    {[
                      { status: 'read', color: 'bg-green-500', count: libraryStats.read },
                      { status: 'reading', color: 'bg-yellow-500', count: libraryStats.reading },
                      { status: 'new', color: 'bg-blue-500', count: libraryStats.new }
                    ].map(({ status, color, count }) => (
                      <div key={status} className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <div className={`w-3 h-3 rounded-full ${color}`} />
                          <span className="text-sm text-gray-700 dark:text-gray-300 capitalize">
                            {status}
                          </span>
                        </div>
                        <span className="text-sm font-medium text-gray-900 dark:text-white">
                          {count}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Paper Modal */}
      <AnimatePresence>
        {showPaperModal && (
          <PaperModal
            paper={selectedPaper}
            onClose={() => setShowPaperModal(false)}
            onSave={(updates) => {
              if (selectedPaper) {
                updatePaper(selectedPaper.id, updates);
              }
              setShowPaperModal(false);
            }}
          />
        )}
      </AnimatePresence>

      {/* Project Modal */}
      <AnimatePresence>
        {showProjectModal && (
          <ProjectModal
            project={selectedProject}
            onClose={() => setShowProjectModal(false)}
            onSave={(projectData) => {
              if (selectedProject) {
                updateProject(selectedProject.id, projectData);
              } else {
                createProject(projectData);
              }
              setShowProjectModal(false);
            }}
          />
        )}
      </AnimatePresence>
    </AppLayout>
  );
}

// Paper Modal Component
interface PaperModalProps {
  paper: ResearchPaper | null;
  onClose: () => void;
  onSave: (updates: Partial<ResearchPaper>) => void;
}

function PaperModal({ paper, onClose, onSave }: PaperModalProps) {
  const [status, setStatus] = useState(paper?.status || 'new');
  const [rating, setRating] = useState(paper?.rating || 0);
  const [notes, setNotes] = useState(paper?.notes || '');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({ status, rating: rating || undefined, notes: notes || undefined });
  };

  if (!paper) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 max-w-2xl w-full max-h-[80vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            Edit Paper
          </h2>
          <h3 className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            {paper.title}
          </h3>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Reading Status
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as any)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="new">New</option>
                <option value="reading">Reading</option>
                <option value="read">Read</option>
                <option value="cited">Cited</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Rating
              </label>
              <div className="flex items-center space-x-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setRating(star)}
                    className={`w-8 h-8 ${
                      star <= rating
                        ? 'text-yellow-400'
                        : 'text-gray-300'
                    }`}
                  >
                    <StarIcon className="w-full h-full fill-current" />
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setRating(0)}
                  className="text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 ml-2"
                >
                  Clear
                </button>
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Notes
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="Add your thoughts, key insights, or questions about this paper..."
              />
            </div>
          </div>
          
          <div className="flex items-center justify-end space-x-4 mt-6">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
            >
              Save Changes
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
}

// Project Modal Component
interface ProjectModalProps {
  project: ResearchProject | null;
  onClose: () => void;
  onSave: (project: Partial<ResearchProject>) => void;
}

function ProjectModal({ project, onClose, onSave }: ProjectModalProps) {
  const [title, setTitle] = useState(project?.title || '');
  const [description, setDescription] = useState(project?.description || '');
  const [status, setStatus] = useState(project?.status || 'active');
  const [tags, setTags] = useState(project?.tags?.join(', ') || '');
  const [notes, setNotes] = useState(project?.notes || '');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      title,
      description,
      status,
      tags: tags.split(',').map(tag => tag.trim()).filter(tag => tag),
      notes
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 max-w-2xl w-full"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            {project ? 'Edit Project' : 'Create Project'}
          </h2>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Project Title
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="Enter project title"
                required
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Description
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="Describe your research project"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Status
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as any)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="active">Active</option>
                <option value="completed">Completed</option>
                <option value="archived">Archived</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Tags (comma-separated)
              </label>
              <input
                type="text"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="AI, machine learning, research"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Notes
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="Research notes, objectives, findings..."
              />
            </div>
          </div>
          
          <div className="flex items-center justify-end space-x-4 mt-6">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
            >
              {project ? 'Save Changes' : 'Create Project'}
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
}
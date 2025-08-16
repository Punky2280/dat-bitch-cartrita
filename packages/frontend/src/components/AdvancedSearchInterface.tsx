/**
 * Advanced Search Interface Component
 * 
 * Comprehensive search interface supporting:
 * - Unified search across multiple sources
 * - Advanced filtering and faceting
 * - Real-time search suggestions
 * - Search result analytics
 * - Multiple search modes (semantic, full-text, graph)
 * 
 * @author Robbie Allen - Lead Architect  
 * @date January 2025
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Box,
  TextField,
  Button,
  Chip,
  Typography,
  Paper,
  Grid,
  Tabs,
  Tab,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Slider,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Checkbox,
  FormControlLabel,
  FormGroup,
  Divider,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  CircularProgress,
  Alert,
  Tooltip,
  IconButton,
  Badge,
  LinearProgress,
  Card,
  CardContent,
  CardActions,
} from '@mui/material';
import {
  Search as SearchIcon,
  FilterList as FilterIcon,
  Clear as ClearIcon,
  ExpandMore as ExpandMoreIcon,
  Analytics as AnalyticsIcon,
  TuneIcon,
  AutoAwesome as SemanticIcon,
  TextFields as FullTextIcon,
  AccountTree as GraphIcon,
  Bookmark as BookmarkIcon,
  Share as ShareIcon,
  History as HistoryIcon,
  TrendingUp as TrendingIcon,
  Insights as InsightsIcon,
} from '@mui/icons-material';
import { useDebounce } from 'use-debounce';
import { format } from 'date-fns';
import { api } from '../utils/api';
import { useAuth } from '../contexts/AuthContext';
import { useNotification } from '../contexts/NotificationContext';

// Search mode configuration
const SEARCH_MODES = {
  unified: {
    label: 'Smart Search',
    description: 'AI-powered search combining semantic and full-text',
    icon: <SearchIcon />,
    types: ['semantic', 'fulltext', 'graph'],
    color: 'primary',
  },
  semantic: {
    label: 'Semantic',
    description: 'Understanding-based search using AI embeddings',
    icon: <SemanticIcon />,
    types: ['semantic'],
    color: 'secondary',
  },
  fulltext: {
    label: 'Full-Text',
    description: 'Traditional keyword-based search',
    icon: <FullTextIcon />,
    types: ['fulltext'],
    color: 'info',
  },
  graph: {
    label: 'Connected',
    description: 'Relationship-based search through knowledge graph',
    icon: <GraphIcon />,
    types: ['graph'],
    color: 'success',
  },
};

// Data sources configuration
const DATA_SOURCES = {
  knowledge: { label: 'Knowledge Base', color: 'primary' },
  conversations: { label: 'Conversations', color: 'secondary' },
  workflows: { label: 'Workflows', color: 'info' },
  documents: { label: 'Documents', color: 'success' },
};

function AdvancedSearchInterface() {
  const { user } = useAuth();
  const { showNotification } = useNotification();

  // Search state
  const [query, setQuery] = useState('');
  const [debouncedQuery] = useDebounce(query, 300);
  const [searchMode, setSearchMode] = useState('unified');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState(null);
  const [searchError, setSearchError] = useState(null);

  // Filter state
  const [selectedSources, setSelectedSources] = useState(['knowledge', 'conversations']);
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [dateRange, setDateRange] = useState({ from: '', to: '' });
  const [confidenceThreshold, setConfidenceThreshold] = useState(0.1);
  const [maxResults, setMaxResults] = useState(20);
  const [enableFacets, setEnableFacets] = useState(true);

  // UI state
  const [activeTab, setActiveTab] = useState(0);
  const [showFilters, setShowFilters] = useState(false);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [searchHistory, setSearchHistory] = useState([]);
  const [analytics, setAnalytics] = useState(null);

  // Load search history and analytics on mount
  useEffect(() => {
    loadSearchHistory();
    if (showAnalytics) {
      loadAnalytics();
    }
  }, [showAnalytics]);

  // Auto-suggest functionality
  useEffect(() => {
    if (debouncedQuery && debouncedQuery.length > 1) {
      loadSuggestions(debouncedQuery);
    } else {
      setSuggestions([]);
    }
  }, [debouncedQuery]);

  /**
   * Load search suggestions
   */
  const loadSuggestions = useCallback(async (searchQuery) => {
    try {
      const response = await api.get('/search/suggestions', {
        params: {
          q: searchQuery,
          limit: 8,
        },
      });

      if (response.data.success) {
        setSuggestions(response.data.suggestions);
      }
    } catch (error) {
      console.warn('Failed to load suggestions:', error);
    }
  }, []);

  /**
   * Load search history
   */
  const loadSearchHistory = useCallback(async () => {
    try {
      const response = await api.get('/search/analytics');
      
      if (response.data.success && response.data.userAnalytics) {
        setSearchHistory(response.data.userAnalytics.popularQueries || []);
      }
    } catch (error) {
      console.warn('Failed to load search history:', error);
    }
  }, []);

  /**
   * Load search analytics
   */
  const loadAnalytics = useCallback(async () => {
    try {
      const response = await api.get('/search/analytics');
      
      if (response.data.success) {
        setAnalytics(response.data);
      }
    } catch (error) {
      console.warn('Failed to load analytics:', error);
    }
  }, []);

  /**
   * Perform search
   */
  const performSearch = useCallback(async (searchQuery = query) => {
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    setSearchError(null);

    try {
      const searchOptions = {
        query: searchQuery,
        searchTypes: SEARCH_MODES[searchMode].types,
        sources: selectedSources,
        limit: maxResults,
        threshold: confidenceThreshold,
        filters: {
          categories: selectedCategories,
          dateRange: dateRange.from || dateRange.to ? dateRange : undefined,
        },
        facets: enableFacets ? ['categories', 'sources', 'types', 'tags'] : [],
        explain: true,
      };

      const response = await api.post('/search/unified', searchOptions);

      if (response.data.success) {
        setSearchResults(response.data);
        
        // Add to search history
        loadSearchHistory();
        
        showNotification(
          `Found ${response.data.results.length} results in ${response.data.analytics.searchTime}ms`,
          'success'
        );
      } else {
        setSearchError(response.data.error || 'Search failed');
      }
    } catch (error) {
      console.error('Search failed:', error);
      setSearchError(error.response?.data?.message || 'Search failed');
      showNotification('Search failed', 'error');
    } finally {
      setIsSearching(false);
    }
  }, [query, searchMode, selectedSources, selectedCategories, dateRange, confidenceThreshold, maxResults, enableFacets, showNotification]);

  /**
   * Handle search submission
   */
  const handleSearch = (e) => {
    e.preventDefault();
    performSearch();
  };

  /**
   * Handle suggestion click
   */
  const handleSuggestionClick = (suggestion) => {
    setQuery(suggestion.text);
    setSuggestions([]);
    performSearch(suggestion.text);
  };

  /**
   * Handle result click
   */
  const handleResultClick = (result, index) => {
    // Track click for analytics
    console.log('Result clicked:', result, 'at position:', index);
    
    // Navigate to result or show details
    // Implementation depends on result type
    if (result.type === 'knowledge_entry') {
      // Navigate to knowledge entry
    } else if (result.type === 'conversation_message') {
      // Navigate to conversation
    } else if (result.type === 'workflow') {
      // Navigate to workflow
    }
  };

  /**
   * Clear search
   */
  const clearSearch = () => {
    setQuery('');
    setSearchResults(null);
    setSearchError(null);
    setSuggestions([]);
  };

  /**
   * Reset filters
   */
  const resetFilters = () => {
    setSelectedSources(['knowledge', 'conversations']);
    setSelectedCategories([]);
    setDateRange({ from: '', to: '' });
    setConfidenceThreshold(0.1);
    setMaxResults(20);
  };

  /**
   * Render search result item
   */
  const renderSearchResult = (result, index) => (
    <Card
      key={`${result.source}_${result.id}`}
      sx={{ 
        mb: 2, 
        cursor: 'pointer',
        '&:hover': { 
          boxShadow: 4,
          transform: 'translateY(-2px)',
          transition: 'all 0.2s ease-in-out',
        },
      }}
      onClick={() => handleResultClick(result, index)}
    >
      <CardContent>
        <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={1}>
          <Typography variant="h6" component="h3" noWrap sx={{ flex: 1, mr: 2 }}>
            {result.title}
          </Typography>
          <Box display="flex" alignItems="center" gap={1}>
            <Chip
              label={DATA_SOURCES[result.source]?.label || result.source}
              color={DATA_SOURCES[result.source]?.color || 'default'}
              size="small"
            />
            <Chip
              label={`${Math.round((result.finalScore || result.score) * 100)}%`}
              variant="outlined"
              size="small"
            />
          </Box>
        </Box>
        
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {result.snippet || result.content?.substring(0, 200) + '...'}
        </Typography>
        
        <Box display="flex" alignItems="center" gap={2} flexWrap="wrap">
          {result.category && (
            <Chip
              label={result.category}
              variant="outlined"
              size="small"
            />
          )}
          
          {result.tags?.slice(0, 3).map((tag) => (
            <Chip
              key={tag}
              label={tag}
              variant="outlined"
              size="small"
              color="primary"
            />
          ))}
          
          {result.multiMatch && (
            <Chip
              label="Multi-match"
              color="success"
              size="small"
              icon={<TrendingIcon />}
            />
          )}
          
          <Typography variant="caption" color="text.secondary" sx={{ ml: 'auto' }}>
            {result.searchTypes?.join(', ')} search
            {result.similarity && ` • ${Math.round(result.similarity * 100)}% similar`}
            {result.relevance && ` • ${Math.round(result.relevance * 100)}% relevant`}
          </Typography>
        </Box>
      </CardContent>
      
      <CardActions sx={{ pt: 0 }}>
        <Button size="small" startIcon={<BookmarkIcon />}>
          Save
        </Button>
        <Button size="small" startIcon={<ShareIcon />}>
          Share
        </Button>
      </CardActions>
    </Card>
  );

  /**
   * Render search facets
   */
  const renderFacets = () => {
    if (!searchResults?.facets || !enableFacets) return null;

    return (
      <Paper sx={{ p: 2, mb: 2 }}>
        <Typography variant="h6" gutterBottom>
          Filter Results
        </Typography>
        
        {Object.entries(searchResults.facets).map(([facetType, facetValues]) => (
          <Accordion key={facetType} sx={{ mb: 1 }}>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography variant="subtitle2" sx={{ textTransform: 'capitalize' }}>
                {facetType} ({facetValues.length})
              </Typography>
            </AccordionSummary>
            <AccordionDetails>
              <FormGroup>
                {facetValues.slice(0, 10).map((facet) => (
                  <FormControlLabel
                    key={facet.name}
                    control={
                      <Checkbox
                        checked={
                          facetType === 'categories' 
                            ? selectedCategories.includes(facet.name)
                            : selectedSources.includes(facet.name)
                        }
                        onChange={(e) => {
                          if (facetType === 'categories') {
                            if (e.target.checked) {
                              setSelectedCategories([...selectedCategories, facet.name]);
                            } else {
                              setSelectedCategories(selectedCategories.filter(c => c !== facet.name));
                            }
                          } else if (facetType === 'sources') {
                            if (e.target.checked) {
                              setSelectedSources([...selectedSources, facet.name]);
                            } else {
                              setSelectedSources(selectedSources.filter(s => s !== facet.name));
                            }
                          }
                        }}
                      />
                    }
                    label={`${facet.name} (${facet.count})`}
                  />
                ))}
              </FormGroup>
            </AccordionDetails>
          </Accordion>
        ))}
      </Paper>
    );
  };

  /**
   * Render analytics panel
   */
  const renderAnalytics = () => {
    if (!showAnalytics || !analytics) return null;

    return (
      <Paper sx={{ p: 2, mb: 2 }}>
        <Typography variant="h6" gutterBottom>
          Search Analytics
        </Typography>
        
        <Grid container spacing={2}>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Typography color="textSecondary" gutterBottom>
                  Total Searches
                </Typography>
                <Typography variant="h4">
                  {analytics.userAnalytics?.totalSearches || 0}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Typography color="textSecondary" gutterBottom>
                  Avg Response Time
                </Typography>
                <Typography variant="h4">
                  {Math.round(analytics.userAnalytics?.avgResponseTime || 0)}ms
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Typography color="textSecondary" gutterBottom>
                  Avg Confidence
                </Typography>
                <Typography variant="h4">
                  {Math.round((analytics.userAnalytics?.avgConfidence || 0) * 100)}%
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Typography color="textSecondary" gutterBottom>
                  Unique Queries
                </Typography>
                <Typography variant="h4">
                  {analytics.userAnalytics?.uniqueQueries || 0}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </Paper>
    );
  };

  return (
    <Box sx={{ maxWidth: 1200, mx: 'auto', p: 3 }}>
      {/* Header */}
      <Box mb={3}>
        <Typography variant="h4" gutterBottom>
          Advanced Search
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Intelligent search across your knowledge base, conversations, and workflows
        </Typography>
      </Box>

      {/* Search Interface */}
      <Paper sx={{ p: 3, mb: 3 }}>
        {/* Search Mode Selection */}
        <Box mb={3}>
          <Tabs
            value={searchMode}
            onChange={(e, newValue) => setSearchMode(newValue)}
            variant="fullWidth"
          >
            {Object.entries(SEARCH_MODES).map(([key, mode]) => (
              <Tab
                key={key}
                value={key}
                label={
                  <Box display="flex" alignItems="center" gap={1}>
                    {mode.icon}
                    {mode.label}
                  </Box>
                }
              />
            ))}
          </Tabs>
          
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1, textAlign: 'center' }}>
            {SEARCH_MODES[searchMode].description}
          </Typography>
        </Box>

        {/* Main Search */}
        <Box component="form" onSubmit={handleSearch} mb={2}>
          <Box display="flex" gap={2} alignItems="center">
            <TextField
              fullWidth
              variant="outlined"
              placeholder="What are you looking for?"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              InputProps={{
                startAdornment: <SearchIcon sx={{ mr: 1, color: 'text.secondary' }} />,
                endAdornment: query && (
                  <IconButton onClick={clearSearch} size="small">
                    <ClearIcon />
                  </IconButton>
                ),
              }}
            />
            
            <Button
              type="submit"
              variant="contained"
              size="large"
              disabled={!query.trim() || isSearching}
              startIcon={isSearching ? <CircularProgress size={20} /> : <SearchIcon />}
              sx={{ minWidth: 120 }}
            >
              {isSearching ? 'Searching...' : 'Search'}
            </Button>
            
            <Tooltip title="Advanced Filters">
              <IconButton
                onClick={() => setShowFilters(!showFilters)}
                color={showFilters ? 'primary' : 'default'}
              >
                <Badge
                  badgeContent={
                    selectedCategories.length + 
                    (dateRange.from || dateRange.to ? 1 : 0) +
                    (confidenceThreshold !== 0.1 ? 1 : 0)
                  }
                  color="secondary"
                  variant="dot"
                >
                  <FilterIcon />
                </Badge>
              </IconButton>
            </Tooltip>
            
            <Tooltip title="Search Analytics">
              <IconButton
                onClick={() => setShowAnalytics(!showAnalytics)}
                color={showAnalytics ? 'primary' : 'default'}
              >
                <AnalyticsIcon />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>

        {/* Search Suggestions */}
        {suggestions.length > 0 && (
          <Paper sx={{ position: 'absolute', zIndex: 1000, width: '100%', maxHeight: 200, overflow: 'auto' }}>
            <List dense>
              {suggestions.map((suggestion, index) => (
                <ListItem
                  key={index}
                  button
                  onClick={() => handleSuggestionClick(suggestion)}
                >
                  <ListItemIcon>
                    <SearchIcon fontSize="small" />
                  </ListItemIcon>
                  <ListItemText primary={suggestion.text} secondary={suggestion.type} />
                </ListItem>
              ))}
            </List>
          </Paper>
        )}

        {/* Data Sources Selection */}
        <Box display="flex" gap={1} flexWrap="wrap">
          {Object.entries(DATA_SOURCES).map(([key, source]) => (
            <Chip
              key={key}
              label={source.label}
              color={selectedSources.includes(key) ? source.color : 'default'}
              variant={selectedSources.includes(key) ? 'filled' : 'outlined'}
              onClick={() => {
                if (selectedSources.includes(key)) {
                  setSelectedSources(selectedSources.filter(s => s !== key));
                } else {
                  setSelectedSources([...selectedSources, key]);
                }
              }}
            />
          ))}
        </Box>
      </Paper>

      {/* Advanced Filters */}
      {showFilters && (
        <Paper sx={{ p: 3, mb: 3 }}>
          <Typography variant="h6" gutterBottom>
            Advanced Filters
          </Typography>
          
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <Typography gutterBottom>Confidence Threshold: {confidenceThreshold}</Typography>
              <Slider
                value={confidenceThreshold}
                onChange={(e, newValue) => setConfidenceThreshold(newValue)}
                min={0}
                max={1}
                step={0.1}
                marks={[
                  { value: 0, label: '0%' },
                  { value: 0.5, label: '50%' },
                  { value: 1, label: '100%' },
                ]}
                valueLabelDisplay="auto"
                valueLabelFormat={(value) => `${Math.round(value * 100)}%`}
              />
            </Grid>
            
            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel>Max Results</InputLabel>
                <Select
                  value={maxResults}
                  onChange={(e) => setMaxResults(e.target.value)}
                  label="Max Results"
                >
                  <MenuItem value={10}>10 results</MenuItem>
                  <MenuItem value={20}>20 results</MenuItem>
                  <MenuItem value={50}>50 results</MenuItem>
                  <MenuItem value={100}>100 results</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Date From"
                type="date"
                value={dateRange.from}
                onChange={(e) => setDateRange({ ...dateRange, from: e.target.value })}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Date To"
                type="date"
                value={dateRange.to}
                onChange={(e) => setDateRange({ ...dateRange, to: e.target.value })}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={enableFacets}
                    onChange={(e) => setEnableFacets(e.target.checked)}
                  />
                }
                label="Enable result faceting and filtering"
              />
            </Grid>
          </Grid>
          
          <Box mt={2} display="flex" gap={2}>
            <Button onClick={resetFilters} variant="outlined">
              Reset Filters
            </Button>
            <Button onClick={() => performSearch()} variant="contained">
              Apply Filters
            </Button>
          </Box>
        </Paper>
      )}

      {/* Analytics Panel */}
      {renderAnalytics()}

      {/* Search Error */}
      {searchError && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {searchError}
        </Alert>
      )}

      {/* Search Results */}
      {searchResults && (
        <Box>
          <Grid container spacing={3}>
            {/* Results List */}
            <Grid item xs={12} md={enableFacets ? 8 : 12}>
              <Paper sx={{ p: 3 }}>
                <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
                  <Typography variant="h6">
                    Search Results ({searchResults.analytics.totalMatches})
                  </Typography>
                  
                  <Box display="flex" alignItems="center" gap={2}>
                    <Typography variant="body2" color="text.secondary">
                      {searchResults.analytics.searchTime}ms • {Math.round(searchResults.analytics.confidence * 100)}% confidence
                    </Typography>
                    
                    <Chip
                      label={SEARCH_MODES[searchMode].label}
                      color={SEARCH_MODES[searchMode].color}
                      size="small"
                    />
                  </Box>
                </Box>
                
                {searchResults.analytics.confidence < 0.3 && (
                  <Alert severity="info" sx={{ mb: 3 }}>
                    Low confidence results. Try refining your search terms or adjusting filters.
                  </Alert>
                )}
                
                <Box>
                  {searchResults.results.length > 0 ? (
                    searchResults.results.map((result, index) => renderSearchResult(result, index))
                  ) : (
                    <Box textAlign="center" py={6}>
                      <Typography variant="h6" color="text.secondary" gutterBottom>
                        No results found
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Try different keywords or adjust your search filters
                      </Typography>
                    </Box>
                  )}
                </Box>
              </Paper>
            </Grid>
            
            {/* Facets Sidebar */}
            {enableFacets && (
              <Grid item xs={12} md={4}>
                {renderFacets()}
                
                {/* Search History */}
                {searchHistory.length > 0 && (
                  <Paper sx={{ p: 2 }}>
                    <Typography variant="h6" gutterBottom>
                      Recent Searches
                    </Typography>
                    <List dense>
                      {searchHistory.slice(0, 5).map((item, index) => (
                        <ListItem
                          key={index}
                          button
                          onClick={() => {
                            setQuery(item.query);
                            performSearch(item.query);
                          }}
                        >
                          <ListItemIcon>
                            <HistoryIcon fontSize="small" />
                          </ListItemIcon>
                          <ListItemText 
                            primary={item.query}
                            secondary={`${item.count} times`}
                          />
                        </ListItem>
                      ))}
                    </List>
                  </Paper>
                )}
              </Grid>
            )}
          </Grid>
        </Box>
      )}

      {/* Search Progress */}
      {isSearching && (
        <Box sx={{ width: '100%', mt: 2 }}>
          <LinearProgress />
          <Typography variant="body2" color="text.secondary" align="center" sx={{ mt: 1 }}>
            Searching across {selectedSources.length} data sources using {SEARCH_MODES[searchMode].label}...
          </Typography>
        </Box>
      )}
    </Box>
  );
}

export default AdvancedSearchInterface;

import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Typography,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Grid,
  Chip,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  LinearProgress,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  IconButton,
  Tooltip,
  Switch,
  FormControlLabel,
  CircularProgress,
  Divider,
  Tab,
  Tabs,
  TabPanel
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  Add as AddIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  Refresh as RefreshIcon,
  Download as DownloadIcon,
  Visibility as VisibilityIcon,
  Warning as WarningIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Info as InfoIcon,
  Timeline as TimelineIcon,
  Merge as MergeIcon,
  Analytics as AnalyticsIcon
} from '@mui/icons-material';
import { Line, Bar, Doughnut, Scatter } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip as ChartTooltip,
  Legend,
  ArcElement,
} from 'chart.js';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  ChartTooltip,
  Legend,
  ArcElement
);

interface FusionSource {
  id: string;
  name: string;
  type: 'conversation' | 'workflow' | 'analytics' | 'external';
  description?: string;
  config: Record<string, any>;
  priority: number;
  reliability: number;
  active: boolean;
  lastAccessed?: string;
  createdAt: string;
  updatedAt: string;
  dataEntriesCount?: number;
  avgConfidence?: number;
  conflictsCount?: number;
}

interface FusionConflict {
  id: string;
  dataKey: string;
  source1Id: string;
  source2Id: string;
  source1Data: any;
  source2Data: any;
  source1Confidence: number;
  source2Confidence: number;
  conflictType: 'value_mismatch' | 'temporal_conflict' | 'confidence_dispute' | 'structural_difference';
  resolutionStatus: 'pending' | 'resolved' | 'ignored';
  resolutionMethod?: string;
  resolutionData?: any;
  createdAt: string;
  resolvedAt?: string;
}

interface AggregationOptions {
  strategy: 'weighted_average' | 'highest_confidence' | 'consensus' | 'temporal_priority';
  minConfidence: number;
  maxAge: number;
  includeMetadata: boolean;
}

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function CustomTabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`fusion-tabpanel-${index}`}
      aria-labelledby={`fusion-tab-${index}`}
      {...other}
    >
      {value === index && (
        <Box sx={{ p: 3 }}>
          {children}
        </Box>
      )}
    </div>
  );
}

const FusionAggregationEngine: React.FC = () => {
  const [activeTab, setActiveTab] = useState(0);
  const [sources, setSources] = useState<FusionSource[]>([]);
  const [conflicts, setConflicts] = useState<FusionConflict[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Source management state
  const [sourceDialog, setSourceDialog] = useState(false);
  const [editingSource, setEditingSource] = useState<FusionSource | null>(null);
  const [sourceForm, setSourceForm] = useState({
    name: '',
    type: 'conversation' as const,
    description: '',
    priority: 5,
    reliability: 0.8,
    config: '{}'
  });

  // Aggregation state
  const [aggregationQuery, setAggregationQuery] = useState('');
  const [selectedSourceIds, setSelectedSourceIds] = useState<string[]>([]);
  const [aggregationOptions, setAggregationOptions] = useState<AggregationOptions>({
    strategy: 'weighted_average',
    minConfidence: 0.3,
    maxAge: 86400000, // 24 hours
    includeMetadata: true
  });
  const [aggregationResult, setAggregationResult] = useState<any>(null);

  // Synthesis state
  const [synthesisDialog, setSynthesisDialog] = useState(false);
  const [synthesisTopic, setSynthesisTopic] = useState('');
  const [synthesisFormat, setSynthesisFormat] = useState('summary');
  const [synthesisResult, setSynthesisResult] = useState<any>(null);

  // Conflict resolution state
  const [conflictDialog, setConflictDialog] = useState(false);
  const [selectedConflict, setSelectedConflict] = useState<FusionConflict | null>(null);
  const [resolutionForm, setResolutionForm] = useState({
    resolution: 'accept_source1' as const,
    mergedData: '',
    reason: ''
  });

  // Analytics state
  const [analytics, setAnalytics] = useState<any>(null);
  const [analyticsPeriod, setAnalyticsPeriod] = useState('24h');

  const alertTimeoutRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    loadSources();
    loadConflicts();
    loadAnalytics();
  }, []);

  useEffect(() => {
    return () => {
      if (alertTimeoutRef.current) {
        clearTimeout(alertTimeoutRef.current);
      }
    };
  }, []);

  const showMessage = (message: string, type: 'success' | 'error') => {
    if (type === 'success') {
      setSuccess(message);
      setError(null);
    } else {
      setError(message);
      setSuccess(null);
    }

    if (alertTimeoutRef.current) {
      clearTimeout(alertTimeoutRef.current);
    }
    alertTimeoutRef.current = setTimeout(() => {
      setSuccess(null);
      setError(null);
    }, 5000);
  };

  const loadSources = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/fusion/sources');
      const data = await response.json();
      
      if (data.success) {
        setSources(data.data);
      } else {
        showMessage(data.error || 'Failed to load sources', 'error');
      }
    } catch (error) {
      showMessage('Failed to load sources', 'error');
    } finally {
      setLoading(false);
    }
  };

  const loadConflicts = async () => {
    try {
      const response = await fetch('/api/fusion/conflicts');
      const data = await response.json();
      
      if (data.success) {
        setConflicts(data.data);
      } else {
        showMessage(data.error || 'Failed to load conflicts', 'error');
      }
    } catch (error) {
      showMessage('Failed to load conflicts', 'error');
    }
  };

  const loadAnalytics = async () => {
    try {
      const response = await fetch(`/api/fusion/analytics?period=${analyticsPeriod}`);
      const data = await response.json();
      
      if (data.success) {
        setAnalytics(data.data);
      } else {
        showMessage(data.error || 'Failed to load analytics', 'error');
      }
    } catch (error) {
      showMessage('Failed to load analytics', 'error');
    }
  };

  const handleCreateSource = async () => {
    try {
      setLoading(true);
      let config;
      try {
        config = JSON.parse(sourceForm.config);
      } catch {
        showMessage('Invalid JSON configuration', 'error');
        return;
      }

      const method = editingSource ? 'PUT' : 'POST';
      const url = editingSource 
        ? `/api/fusion/sources/${editingSource.id}`
        : '/api/fusion/sources';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: sourceForm.name,
          type: sourceForm.type,
          description: sourceForm.description,
          priority: sourceForm.priority,
          reliability: sourceForm.reliability,
          config
        }),
      });

      const data = await response.json();
      
      if (data.success) {
        showMessage(
          editingSource ? 'Source updated successfully' : 'Source created successfully',
          'success'
        );
        setSourceDialog(false);
        setEditingSource(null);
        resetSourceForm();
        loadSources();
      } else {
        showMessage(data.error || 'Failed to save source', 'error');
      }
    } catch (error) {
      showMessage('Failed to save source', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleEditSource = (source: FusionSource) => {
    setEditingSource(source);
    setSourceForm({
      name: source.name,
      type: source.type,
      description: source.description || '',
      priority: source.priority,
      reliability: source.reliability,
      config: JSON.stringify(source.config, null, 2)
    });
    setSourceDialog(true);
  };

  const handleDeleteSource = async (sourceId: string) => {
    if (!confirm('Are you sure you want to delete this source?')) return;

    try {
      setLoading(true);
      const response = await fetch(`/api/fusion/sources/${sourceId}`, {
        method: 'DELETE',
      });

      const data = await response.json();
      
      if (data.success) {
        showMessage('Source deleted successfully', 'success');
        loadSources();
      } else {
        showMessage(data.error || 'Failed to delete source', 'error');
      }
    } catch (error) {
      showMessage('Failed to delete source', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handlePerformAggregation = async () => {
    if (!aggregationQuery.trim()) {
      showMessage('Please enter a query', 'error');
      return;
    }

    try {
      setLoading(true);
      const response = await fetch('/api/fusion/aggregate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: aggregationQuery,
          sourceIds: selectedSourceIds.length > 0 ? selectedSourceIds : undefined,
          options: aggregationOptions
        }),
      });

      const data = await response.json();
      
      if (data.success) {
        setAggregationResult(data.data);
        showMessage('Aggregation completed successfully', 'success');
      } else {
        showMessage(data.error || 'Failed to perform aggregation', 'error');
      }
    } catch (error) {
      showMessage('Failed to perform aggregation', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handlePerformSynthesis = async () => {
    if (!synthesisTopic.trim()) {
      showMessage('Please enter a synthesis topic', 'error');
      return;
    }

    try {
      setLoading(true);
      const response = await fetch('/api/fusion/synthesize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          topic: synthesisTopic,
          sources: sources.slice(0, 3).map(source => ({
            data: { example: 'data' },
            confidence: source.reliability,
            timestamp: new Date().toISOString(),
            sourceId: source.id
          })),
          outputFormat: synthesisFormat
        }),
      });

      const data = await response.json();
      
      if (data.success) {
        setSynthesisResult(data.data);
        showMessage('Synthesis completed successfully', 'success');
        setSynthesisDialog(false);
      } else {
        showMessage(data.error || 'Failed to perform synthesis', 'error');
      }
    } catch (error) {
      showMessage('Failed to perform synthesis', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleResolveConflict = async () => {
    if (!selectedConflict) return;

    try {
      setLoading(true);
      let mergedData = null;
      
      if (resolutionForm.resolution === 'manual_merge' && resolutionForm.mergedData) {
        try {
          mergedData = JSON.parse(resolutionForm.mergedData);
        } catch {
          showMessage('Invalid JSON for merged data', 'error');
          return;
        }
      }

      const response = await fetch(`/api/fusion/conflicts/${selectedConflict.id}/resolve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          resolution: resolutionForm.resolution,
          mergedData,
          reason: resolutionForm.reason
        }),
      });

      const data = await response.json();
      
      if (data.success) {
        showMessage('Conflict resolved successfully', 'success');
        setConflictDialog(false);
        setSelectedConflict(null);
        loadConflicts();
      } else {
        showMessage(data.error || 'Failed to resolve conflict', 'error');
      }
    } catch (error) {
      showMessage('Failed to resolve conflict', 'error');
    } finally {
      setLoading(false);
    }
  };

  const resetSourceForm = () => {
    setSourceForm({
      name: '',
      type: 'conversation',
      description: '',
      priority: 5,
      reliability: 0.8,
      config: '{}'
    });
  };

  const getSourceTypeColor = (type: string) => {
    const colors = {
      conversation: 'primary',
      workflow: 'secondary',
      analytics: 'info',
      external: 'warning'
    } as const;
    return colors[type as keyof typeof colors] || 'default';
  };

  const getConflictTypeIcon = (type: string) => {
    switch (type) {
      case 'value_mismatch': return <ErrorIcon color="error" />;
      case 'temporal_conflict': return <TimelineIcon color="warning" />;
      case 'confidence_dispute': return <WarningIcon color="warning" />;
      case 'structural_difference': return <MergeIcon color="info" />;
      default: return <InfoIcon />;
    }
  };

  const renderAnalyticsCharts = () => {
    if (!analytics) return null;

    const accuracyData = {
      labels: ['High Confidence', 'Medium Confidence', 'Low Confidence'],
      datasets: [{
        data: [analytics.highConfidenceCount || 0, analytics.mediumConfidenceCount || 0, analytics.lowConfidenceCount || 0],
        backgroundColor: ['#4caf50', '#ff9800', '#f44336'],
        hoverBackgroundColor: ['#66bb6a', '#ffb74d', '#ef5350']
      }]
    };

    const conflictTrendsData = {
      labels: analytics.conflictTrends?.map((t: any) => t.date) || [],
      datasets: [{
        label: 'Conflicts Detected',
        data: analytics.conflictTrends?.map((t: any) => t.conflicts) || [],
        borderColor: '#f44336',
        backgroundColor: 'rgba(244, 67, 54, 0.1)',
        tension: 0.4
      }, {
        label: 'Conflicts Resolved',
        data: analytics.conflictTrends?.map((t: any) => t.resolved) || [],
        borderColor: '#4caf50',
        backgroundColor: 'rgba(76, 175, 80, 0.1)',
        tension: 0.4
      }]
    };

    return (
      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Confidence Distribution
              </Typography>
              <Box height={300}>
                <Doughnut data={accuracyData} options={{ maintainAspectRatio: false }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Conflict Trends
              </Typography>
              <Box height={300}>
                <Line data={conflictTrendsData} options={{ maintainAspectRatio: false }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    );
  };

  return (
    <Box sx={{ width: '100%' }}>
      {/* Alert Messages */}
      {success && (
        <Alert severity="success" sx={{ mb: 2 }}>
          {success}
        </Alert>
      )}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {/* Header */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" gutterBottom>
          Fusion Aggregation Engine
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Intelligent multi-source data fusion with conflict resolution and synthesis
        </Typography>
      </Box>

      {/* Main Navigation Tabs */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs value={activeTab} onChange={(_, newValue) => setActiveTab(newValue)}>
          <Tab label="Data Sources" />
          <Tab label="Aggregation" />
          <Tab label="Synthesis" />
          <Tab label="Conflicts" />
          <Tab label="Analytics" />
        </Tabs>
      </Box>

      {/* Data Sources Tab */}
      <CustomTabPanel value={activeTab} index={0}>
        <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h5">Data Sources</Typography>
          <Box>
            <Button
              variant="outlined"
              startIcon={<RefreshIcon />}
              onClick={loadSources}
              sx={{ mr: 1 }}
              disabled={loading}
            >
              Refresh
            </Button>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => setSourceDialog(true)}
            >
              Add Source
            </Button>
          </Box>
        </Box>

        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Name</TableCell>
                <TableCell>Type</TableCell>
                <TableCell>Priority</TableCell>
                <TableCell>Reliability</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Data Entries</TableCell>
                <TableCell>Avg Confidence</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {sources.map((source) => (
                <TableRow key={source.id}>
                  <TableCell>
                    <Box>
                      <Typography variant="subtitle2">{source.name}</Typography>
                      {source.description && (
                        <Typography variant="caption" color="text.secondary">
                          {source.description}
                        </Typography>
                      )}
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={source.type}
                      color={getSourceTypeColor(source.type)}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>{source.priority}/10</TableCell>
                  <TableCell>{(source.reliability * 100).toFixed(1)}%</TableCell>
                  <TableCell>
                    <Chip
                      label={source.active ? 'Active' : 'Inactive'}
                      color={source.active ? 'success' : 'default'}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>{source.dataEntriesCount || 0}</TableCell>
                  <TableCell>
                    {source.avgConfidence ? (source.avgConfidence * 100).toFixed(1) + '%' : 'N/A'}
                  </TableCell>
                  <TableCell>
                    <IconButton onClick={() => handleEditSource(source)} size="small">
                      <EditIcon />
                    </IconButton>
                    <IconButton
                      onClick={() => handleDeleteSource(source.id)}
                      size="small"
                      color="error"
                    >
                      <DeleteIcon />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </CustomTabPanel>

      {/* Aggregation Tab */}
      <CustomTabPanel value={activeTab} index={1}>
        <Typography variant="h5" gutterBottom>Data Aggregation</Typography>
        
        <Grid container spacing={3}>
          <Grid item xs={12} md={8}>
            <Card>
              <CardContent>
                <TextField
                  fullWidth
                  label="Aggregation Query"
                  value={aggregationQuery}
                  onChange={(e) => setAggregationQuery(e.target.value)}
                  multiline
                  rows={3}
                  placeholder="Enter your query for data aggregation..."
                  sx={{ mb: 2 }}
                />
                
                <FormControl fullWidth sx={{ mb: 2 }}>
                  <InputLabel>Strategy</InputLabel>
                  <Select
                    value={aggregationOptions.strategy}
                    onChange={(e) => setAggregationOptions({
                      ...aggregationOptions,
                      strategy: e.target.value as any
                    })}
                  >
                    <MenuItem value="weighted_average">Weighted Average</MenuItem>
                    <MenuItem value="highest_confidence">Highest Confidence</MenuItem>
                    <MenuItem value="consensus">Consensus</MenuItem>
                    <MenuItem value="temporal_priority">Temporal Priority</MenuItem>
                  </Select>
                </FormControl>

                <Grid container spacing={2} sx={{ mb: 2 }}>
                  <Grid item xs={6}>
                    <TextField
                      fullWidth
                      label="Min Confidence"
                      type="number"
                      inputProps={{ min: 0, max: 1, step: 0.1 }}
                      value={aggregationOptions.minConfidence}
                      onChange={(e) => setAggregationOptions({
                        ...aggregationOptions,
                        minConfidence: parseFloat(e.target.value)
                      })}
                    />
                  </Grid>
                  <Grid item xs={6}>
                    <TextField
                      fullWidth
                      label="Max Age (hours)"
                      type="number"
                      value={aggregationOptions.maxAge / 3600000}
                      onChange={(e) => setAggregationOptions({
                        ...aggregationOptions,
                        maxAge: parseFloat(e.target.value) * 3600000
                      })}
                    />
                  </Grid>
                </Grid>

                <FormControlLabel
                  control={
                    <Switch
                      checked={aggregationOptions.includeMetadata}
                      onChange={(e) => setAggregationOptions({
                        ...aggregationOptions,
                        includeMetadata: e.target.checked
                      })}
                    />
                  }
                  label="Include Metadata"
                  sx={{ mb: 2 }}
                />

                <Button
                  fullWidth
                  variant="contained"
                  onClick={handlePerformAggregation}
                  disabled={loading}
                  size="large"
                >
                  {loading ? <CircularProgress size={24} /> : 'Perform Aggregation'}
                </Button>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={4}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>Source Selection</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Select specific sources (leave empty for all active sources)
                </Typography>
                {sources.filter(s => s.active).map((source) => (
                  <FormControlLabel
                    key={source.id}
                    control={
                      <Switch
                        checked={selectedSourceIds.includes(source.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedSourceIds([...selectedSourceIds, source.id]);
                          } else {
                            setSelectedSourceIds(selectedSourceIds.filter(id => id !== source.id));
                          }
                        }}
                      />
                    }
                    label={source.name}
                    sx={{ display: 'block' }}
                  />
                ))}
              </CardContent>
            </Card>
          </Grid>

          {/* Aggregation Results */}
          {aggregationResult && (
            <Grid item xs={12}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>Aggregation Results</Typography>
                  <Box sx={{ bgcolor: 'grey.50', p: 2, borderRadius: 1, overflow: 'auto' }}>
                    <pre style={{ margin: 0, fontSize: '0.875rem' }}>
                      {JSON.stringify(aggregationResult, null, 2)}
                    </pre>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          )}
        </Grid>
      </CustomTabPanel>

      {/* Synthesis Tab */}
      <CustomTabPanel value={activeTab} index={2}>
        <Typography variant="h5" gutterBottom>Information Synthesis</Typography>
        
        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <TextField
                  fullWidth
                  label="Synthesis Topic"
                  value={synthesisTopic}
                  onChange={(e) => setSynthesisTopic(e.target.value)}
                  placeholder="Enter the topic for information synthesis..."
                  sx={{ mb: 2 }}
                />
                
                <FormControl fullWidth sx={{ mb: 2 }}>
                  <InputLabel>Output Format</InputLabel>
                  <Select
                    value={synthesisFormat}
                    onChange={(e) => setSynthesisFormat(e.target.value)}
                  >
                    <MenuItem value="summary">Summary</MenuItem>
                    <MenuItem value="detailed">Detailed</MenuItem>
                    <MenuItem value="structured">Structured</MenuItem>
                    <MenuItem value="insights">Insights</MenuItem>
                  </Select>
                </FormControl>

                <Button
                  fullWidth
                  variant="contained"
                  onClick={handlePerformSynthesis}
                  disabled={loading}
                  size="large"
                >
                  {loading ? <CircularProgress size={24} /> : 'Generate Synthesis'}
                </Button>
              </CardContent>
            </Card>
          </Grid>

          {/* Synthesis Results */}
          {synthesisResult && (
            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>Synthesis Results</Typography>
                  <Box sx={{ bgcolor: 'grey.50', p: 2, borderRadius: 1, overflow: 'auto', maxHeight: 400 }}>
                    <pre style={{ margin: 0, fontSize: '0.875rem' }}>
                      {JSON.stringify(synthesisResult, null, 2)}
                    </pre>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          )}
        </Grid>
      </CustomTabPanel>

      {/* Conflicts Tab */}
      <CustomTabPanel value={activeTab} index={3}>
        <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h5">Data Conflicts</Typography>
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={loadConflicts}
            disabled={loading}
          >
            Refresh
          </Button>
        </Box>

        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Data Key</TableCell>
                <TableCell>Conflict Type</TableCell>
                <TableCell>Sources</TableCell>
                <TableCell>Confidence Gap</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Created</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {conflicts.map((conflict) => (
                <TableRow key={conflict.id}>
                  <TableCell>
                    <Typography variant="subtitle2">
                      {conflict.dataKey}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      {getConflictTypeIcon(conflict.conflictType)}
                      <Typography variant="body2">
                        {conflict.conflictType.replace('_', ' ')}
                      </Typography>
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">
                      Source 1: {conflict.source1Confidence * 100}%
                      <br />
                      Source 2: {conflict.source2Confidence * 100}%
                    </Typography>
                  </TableCell>
                  <TableCell>
                    {Math.abs(conflict.source1Confidence - conflict.source2Confidence) * 100}%
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={conflict.resolutionStatus}
                      color={
                        conflict.resolutionStatus === 'resolved' ? 'success' :
                        conflict.resolutionStatus === 'pending' ? 'warning' : 'default'
                      }
                      size="small"
                    />
                  </TableCell>
                  <TableCell>
                    {new Date(conflict.createdAt).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    {conflict.resolutionStatus === 'pending' && (
                      <Button
                        size="small"
                        onClick={() => {
                          setSelectedConflict(conflict);
                          setConflictDialog(true);
                        }}
                      >
                        Resolve
                      </Button>
                    )}
                    <IconButton size="small">
                      <VisibilityIcon />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </CustomTabPanel>

      {/* Analytics Tab */}
      <CustomTabPanel value={activeTab} index={4}>
        <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h5">Fusion Analytics</Typography>
          <Box>
            <FormControl sx={{ mr: 2, minWidth: 120 }}>
              <InputLabel>Period</InputLabel>
              <Select
                value={analyticsPeriod}
                onChange={(e) => {
                  setAnalyticsPeriod(e.target.value);
                  loadAnalytics();
                }}
              >
                <MenuItem value="1h">1 Hour</MenuItem>
                <MenuItem value="24h">24 Hours</MenuItem>
                <MenuItem value="7d">7 Days</MenuItem>
                <MenuItem value="30d">30 Days</MenuItem>
              </Select>
            </FormControl>
            <Button
              variant="outlined"
              startIcon={<RefreshIcon />}
              onClick={loadAnalytics}
              disabled={loading}
            >
              Refresh
            </Button>
          </Box>
        </Box>

        {renderAnalyticsCharts()}

        {analytics && (
          <Grid container spacing={3} sx={{ mt: 2 }}>
            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent>
                  <Typography variant="h6" color="primary">
                    {analytics.totalAggregations || 0}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Total Aggregations
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent>
                  <Typography variant="h6" color="warning.main">
                    {analytics.pendingConflicts || 0}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Pending Conflicts
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent>
                  <Typography variant="h6" color="success.main">
                    {analytics.avgConfidence ? (analytics.avgConfidence * 100).toFixed(1) + '%' : 'N/A'}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Avg Confidence
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent>
                  <Typography variant="h6" color="info.main">
                    {analytics.activeSources || 0}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Active Sources
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        )}
      </CustomTabPanel>

      {/* Source Creation/Edit Dialog */}
      <Dialog 
        open={sourceDialog} 
        onClose={() => {
          setSourceDialog(false);
          setEditingSource(null);
          resetSourceForm();
        }}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          {editingSource ? 'Edit Data Source' : 'Create Data Source'}
        </DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            label="Source Name"
            value={sourceForm.name}
            onChange={(e) => setSourceForm({ ...sourceForm, name: e.target.value })}
            sx={{ mb: 2, mt: 1 }}
            required
          />
          
          <FormControl fullWidth sx={{ mb: 2 }}>
            <InputLabel>Source Type</InputLabel>
            <Select
              value={sourceForm.type}
              onChange={(e) => setSourceForm({ ...sourceForm, type: e.target.value as any })}
              required
            >
              <MenuItem value="conversation">Conversation</MenuItem>
              <MenuItem value="workflow">Workflow</MenuItem>
              <MenuItem value="analytics">Analytics</MenuItem>
              <MenuItem value="external">External</MenuItem>
            </Select>
          </FormControl>

          <TextField
            fullWidth
            label="Description"
            value={sourceForm.description}
            onChange={(e) => setSourceForm({ ...sourceForm, description: e.target.value })}
            multiline
            rows={2}
            sx={{ mb: 2 }}
          />

          <Grid container spacing={2} sx={{ mb: 2 }}>
            <Grid item xs={6}>
              <TextField
                fullWidth
                label="Priority (1-10)"
                type="number"
                inputProps={{ min: 1, max: 10 }}
                value={sourceForm.priority}
                onChange={(e) => setSourceForm({ ...sourceForm, priority: parseInt(e.target.value) })}
                required
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                fullWidth
                label="Reliability (0-1)"
                type="number"
                inputProps={{ min: 0, max: 1, step: 0.1 }}
                value={sourceForm.reliability}
                onChange={(e) => setSourceForm({ ...sourceForm, reliability: parseFloat(e.target.value) })}
                required
              />
            </Grid>
          </Grid>

          <TextField
            fullWidth
            label="Configuration (JSON)"
            value={sourceForm.config}
            onChange={(e) => setSourceForm({ ...sourceForm, config: e.target.value })}
            multiline
            rows={4}
            placeholder='{"key": "value"}'
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setSourceDialog(false);
            setEditingSource(null);
            resetSourceForm();
          }}>
            Cancel
          </Button>
          <Button 
            onClick={handleCreateSource} 
            variant="contained"
            disabled={loading}
          >
            {loading ? <CircularProgress size={20} /> : editingSource ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Conflict Resolution Dialog */}
      <Dialog
        open={conflictDialog}
        onClose={() => {
          setConflictDialog(false);
          setSelectedConflict(null);
        }}
        maxWidth="lg"
        fullWidth
      >
        <DialogTitle>Resolve Data Conflict</DialogTitle>
        <DialogContent>
          {selectedConflict && (
            <>
              <Typography variant="h6" gutterBottom>
                Conflict Details: {selectedConflict.dataKey}
              </Typography>
              
              <Grid container spacing={3} sx={{ mb: 3 }}>
                <Grid item xs={6}>
                  <Card variant="outlined">
                    <CardContent>
                      <Typography variant="subtitle2" gutterBottom>
                        Source 1 (Confidence: {(selectedConflict.source1Confidence * 100).toFixed(1)}%)
                      </Typography>
                      <Box sx={{ bgcolor: 'grey.50', p: 2, borderRadius: 1, overflow: 'auto', maxHeight: 200 }}>
                        <pre style={{ margin: 0, fontSize: '0.75rem' }}>
                          {JSON.stringify(selectedConflict.source1Data, null, 2)}
                        </pre>
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={6}>
                  <Card variant="outlined">
                    <CardContent>
                      <Typography variant="subtitle2" gutterBottom>
                        Source 2 (Confidence: {(selectedConflict.source2Confidence * 100).toFixed(1)}%)
                      </Typography>
                      <Box sx={{ bgcolor: 'grey.50', p: 2, borderRadius: 1, overflow: 'auto', maxHeight: 200 }}>
                        <pre style={{ margin: 0, fontSize: '0.75rem' }}>
                          {JSON.stringify(selectedConflict.source2Data, null, 2)}
                        </pre>
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>

              <FormControl fullWidth sx={{ mb: 2 }}>
                <InputLabel>Resolution Method</InputLabel>
                <Select
                  value={resolutionForm.resolution}
                  onChange={(e) => setResolutionForm({ ...resolutionForm, resolution: e.target.value as any })}
                >
                  <MenuItem value="accept_source1">Accept Source 1</MenuItem>
                  <MenuItem value="accept_source2">Accept Source 2</MenuItem>
                  <MenuItem value="manual_merge">Manual Merge</MenuItem>
                  <MenuItem value="ignore">Ignore Conflict</MenuItem>
                </Select>
              </FormControl>

              {resolutionForm.resolution === 'manual_merge' && (
                <TextField
                  fullWidth
                  label="Merged Data (JSON)"
                  value={resolutionForm.mergedData}
                  onChange={(e) => setResolutionForm({ ...resolutionForm, mergedData: e.target.value })}
                  multiline
                  rows={4}
                  sx={{ mb: 2 }}
                />
              )}

              <TextField
                fullWidth
                label="Resolution Reason"
                value={resolutionForm.reason}
                onChange={(e) => setResolutionForm({ ...resolutionForm, reason: e.target.value })}
                multiline
                rows={2}
                placeholder="Explain why this resolution was chosen..."
              />
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setConflictDialog(false);
            setSelectedConflict(null);
          }}>
            Cancel
          </Button>
          <Button 
            onClick={handleResolveConflict} 
            variant="contained"
            disabled={loading}
          >
            {loading ? <CircularProgress size={20} /> : 'Resolve Conflict'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default FusionAggregationEngine;

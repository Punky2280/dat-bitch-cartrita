// WorkflowServiceIntegrationDashboard.jsx
// Component 6: Service Integration Hub - Frontend Dashboard
// Comprehensive interface for managing external service integrations

import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Grid,
  Tabs,
  Tab,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Switch,
  FormControlLabel,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Tooltip,
  Alert,
  LinearProgress,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Divider,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem as MenuItemComponent,
  Badge
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  PlayArrow as TestIcon,
  Settings as SettingsIcon,
  Api as ApiIcon,
  Storage as DatabaseIcon,
  Cloud as CloudIcon,
  Message as MessageIcon,
  Webhook as WebhookIcon,
  FileSystem as FileSystemIcon,
  Email as EmailIcon,
  ExpandMore as ExpandMoreIcon,
  CheckCircle as SuccessIcon,
  Error as ErrorIcon,
  Warning as WarningIcon,
  Info as InfoIcon,
  Timeline as TimelineIcon,
  Speed as SpeedIcon,
  Security as SecurityIcon,
  Refresh as RefreshIcon,
  MoreVert as MoreVertIcon,
  Visibility as ViewIcon,
  Download as ExportIcon,
  Upload as ImportIcon
} from '@mui/icons-material';
import { useSnackbar } from 'notistack';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as ChartTooltip,
  Legend,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area
} from 'recharts';

const integrationTypeIcons = {
  rest_api: <ApiIcon />,
  database: <DatabaseIcon />,
  cloud_service: <CloudIcon />,
  messaging: <MessageIcon />,
  webhook: <WebhookIcon />,
  file_system: <FileSystemIcon />,
  email: <EmailIcon />
};

const integrationTypeColors = {
  rest_api: '#2196F3',
  database: '#4CAF50',
  cloud_service: '#FF9800',
  messaging: '#9C27B0',
  webhook: '#F44336',
  file_system: '#795548',
  email: '#607D8B'
};

const statusColors = {
  active: '#4CAF50',
  inactive: '#9E9E9E',
  failed: '#F44336',
  testing: '#FF9800'
};

function TabPanel(props) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`integration-tabpanel-${index}`}
      aria-labelledby={`integration-tab-${index}`}
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

const WorkflowServiceIntegrationDashboard = () => {
  const { enqueueSnackbar } = useSnackbar();
  const [activeTab, setActiveTab] = useState(0);
  const [integrations, setIntegrations] = useState([]);
  const [executions, setExecutions] = useState([]);
  const [healthChecks, setHealthChecks] = useState([]);
  const [analytics, setAnalytics] = useState([]);
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingIntegration, setEditingIntegration] = useState(null);
  const [newIntegration, setNewIntegration] = useState({
    name: '',
    integration_type: 'rest_api',
    description: '',
    configuration: {},
    auth_config: {},
    rate_limit_config: {
      requests_per_minute: 60,
      burst_limit: 10
    },
    is_active: true
  });
  const [anchorEl, setAnchorEl] = useState(null);
  const [selectedIntegration, setSelectedIntegration] = useState(null);
  const [configurationDialogOpen, setConfigurationDialogOpen] = useState(false);
  const [testResults, setTestResults] = useState({});
  const [webhooks, setWebhooks] = useState([]);
  const [performanceMetrics, setPerformanceMetrics] = useState({});

  useEffect(() => {
    loadIntegrations();
    loadExecutions();
    loadHealthChecks();
    loadAnalytics();
    loadWebhooks();
    loadPerformanceMetrics();
  }, []);

  const loadIntegrations = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/workflows/integrations');
      const result = await response.json();
      if (result.success) {
        setIntegrations(result.data);
      } else {
        enqueueSnackbar('Failed to load integrations', { variant: 'error' });
      }
    } catch (error) {
      enqueueSnackbar('Error loading integrations', { variant: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const loadExecutions = async () => {
    try {
      const response = await fetch('/api/workflows/integration-executions');
      const result = await response.json();
      if (result.success) {
        setExecutions(result.data);
      }
    } catch (error) {
      console.error('Error loading executions:', error);
    }
  };

  const loadHealthChecks = async () => {
    try {
      const response = await fetch('/api/workflows/integration-health');
      const result = await response.json();
      if (result.success) {
        setHealthChecks(result.data);
      }
    } catch (error) {
      console.error('Error loading health checks:', error);
    }
  };

  const loadAnalytics = async () => {
    try {
      const response = await fetch('/api/workflows/integration-analytics');
      const result = await response.json();
      if (result.success) {
        setAnalytics(result.data);
      }
    } catch (error) {
      console.error('Error loading analytics:', error);
    }
  };

  const loadWebhooks = async () => {
    try {
      const response = await fetch('/api/workflows/integration-webhooks');
      const result = await response.json();
      if (result.success) {
        setWebhooks(result.data);
      }
    } catch (error) {
      console.error('Error loading webhooks:', error);
    }
  };

  const loadPerformanceMetrics = async () => {
    try {
      const response = await fetch('/api/workflows/integration-performance');
      const result = await response.json();
      if (result.success) {
        setPerformanceMetrics(result.data);
      }
    } catch (error) {
      console.error('Error loading performance metrics:', error);
    }
  };

  const handleCreateIntegration = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/workflows/integrations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newIntegration)
      });
      const result = await response.json();
      if (result.success) {
        enqueueSnackbar('Integration created successfully', { variant: 'success' });
        setDialogOpen(false);
        setNewIntegration({
          name: '',
          integration_type: 'rest_api',
          description: '',
          configuration: {},
          auth_config: {},
          rate_limit_config: {
            requests_per_minute: 60,
            burst_limit: 10
          },
          is_active: true
        });
        await loadIntegrations();
      } else {
        enqueueSnackbar(result.error || 'Failed to create integration', { variant: 'error' });
      }
    } catch (error) {
      enqueueSnackbar('Error creating integration', { variant: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateIntegration = async (integrationId, updates) => {
    try {
      setLoading(true);
      const response = await fetch(`/api/workflows/integrations/${integrationId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates)
      });
      const result = await response.json();
      if (result.success) {
        enqueueSnackbar('Integration updated successfully', { variant: 'success' });
        await loadIntegrations();
      } else {
        enqueueSnackbar(result.error || 'Failed to update integration', { variant: 'error' });
      }
    } catch (error) {
      enqueueSnackbar('Error updating integration', { variant: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteIntegration = async (integrationId) => {
    if (!window.confirm('Are you sure you want to delete this integration?')) {
      return;
    }

    try {
      setLoading(true);
      const response = await fetch(`/api/workflows/integrations/${integrationId}`, {
        method: 'DELETE'
      });
      const result = await response.json();
      if (result.success) {
        enqueueSnackbar('Integration deleted successfully', { variant: 'success' });
        await loadIntegrations();
      } else {
        enqueueSnackbar(result.error || 'Failed to delete integration', { variant: 'error' });
      }
    } catch (error) {
      enqueueSnackbar('Error deleting integration', { variant: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleTestIntegration = async (integrationId) => {
    try {
      setLoading(true);
      const response = await fetch(`/api/workflows/integrations/${integrationId}/test`, {
        method: 'POST'
      });
      const result = await response.json();
      if (result.success) {
        setTestResults(prev => ({ ...prev, [integrationId]: result.data }));
        enqueueSnackbar('Integration test completed', { variant: 'success' });
      } else {
        enqueueSnackbar(result.error || 'Integration test failed', { variant: 'error' });
      }
    } catch (error) {
      enqueueSnackbar('Error testing integration', { variant: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const getHealthScore = (integration) => {
    const executions = performanceMetrics[integration.id];
    if (!executions) return 100;
    
    const successRate = executions.successful_executions / Math.max(1, executions.total_executions) * 100;
    const responseTime = executions.avg_response_time_ms;
    
    let score = successRate;
    if (responseTime > 5000) score *= 0.7;
    else if (responseTime > 2000) score *= 0.9;
    
    return Math.round(score);
  };

  const getHealthScoreColor = (score) => {
    if (score >= 90) return '#4CAF50';
    if (score >= 70) return '#FF9800';
    return '#F44336';
  };

  const renderIntegrationsOverview = () => (
    <Grid container spacing={3}>
      {/* Summary Cards */}
      <Grid item xs={12}>
        <Grid container spacing={2}>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Box display="flex" alignItems="center" justifyContent="space-between">
                  <Box>
                    <Typography color="textSecondary" gutterBottom>
                      Total Integrations
                    </Typography>
                    <Typography variant="h4">
                      {integrations.length}
                    </Typography>
                  </Box>
                  <ApiIcon color="primary" sx={{ fontSize: 40 }} />
                </Box>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Box display="flex" alignItems="center" justifyContent="space-between">
                  <Box>
                    <Typography color="textSecondary" gutterBottom>
                      Active Integrations
                    </Typography>
                    <Typography variant="h4">
                      {integrations.filter(i => i.is_active).length}
                    </Typography>
                  </Box>
                  <SuccessIcon color="success" sx={{ fontSize: 40 }} />
                </Box>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Box display="flex" alignItems="center" justifyContent="space-between">
                  <Box>
                    <Typography color="textSecondary" gutterBottom>
                      Failed Integrations
                    </Typography>
                    <Typography variant="h4">
                      {integrations.filter(i => i.status === 'failed').length}
                    </Typography>
                  </Box>
                  <ErrorIcon color="error" sx={{ fontSize: 40 }} />
                </Box>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Box display="flex" alignItems="center" justifyContent="space-between">
                  <Box>
                    <Typography color="textSecondary" gutterBottom>
                      Executions Today
                    </Typography>
                    <Typography variant="h4">
                      {executions.filter(e => 
                        new Date(e.executed_at).toDateString() === new Date().toDateString()
                      ).length}
                    </Typography>
                  </Box>
                  <TimelineIcon color="info" sx={{ fontSize: 40 }} />
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </Grid>

      {/* Integration Types Distribution */}
      <Grid item xs={12} md={6}>
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Integration Types Distribution
            </Typography>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  dataKey="count"
                  data={Object.entries(
                    integrations.reduce((acc, integration) => {
                      acc[integration.integration_type] = (acc[integration.integration_type] || 0) + 1;
                      return acc;
                    }, {})
                  ).map(([type, count]) => ({ type, count }))}
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  label={({ type, count }) => `${type}: ${count}`}
                >
                  {Object.keys(integrationTypeColors).map((type, index) => (
                    <Cell key={`cell-${index}`} fill={integrationTypeColors[type]} />
                  ))}
                </Pie>
                <ChartTooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </Grid>

      {/* Performance Overview */}
      <Grid item xs={12} md={6}>
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Performance Overview (Last 7 Days)
            </Typography>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={analytics.slice(-7)}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="date" 
                  tickFormatter={(date) => new Date(date).toLocaleDateString()}
                />
                <YAxis />
                <ChartTooltip />
                <Legend />
                <Line 
                  type="monotone" 
                  dataKey="total_requests" 
                  stroke="#2196F3" 
                  strokeWidth={2}
                  name="Total Requests"
                />
                <Line 
                  type="monotone" 
                  dataKey="successful_requests" 
                  stroke="#4CAF50" 
                  strokeWidth={2}
                  name="Successful"
                />
                <Line 
                  type="monotone" 
                  dataKey="failed_requests" 
                  stroke="#F44336" 
                  strokeWidth={2}
                  name="Failed"
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </Grid>
    </Grid>
  );

  const renderIntegrationsList = () => (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="h6">
          Integrations Management
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setDialogOpen(true)}
        >
          Add Integration
        </Button>
      </Box>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Name</TableCell>
              <TableCell>Type</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Health Score</TableCell>
              <TableCell>Last Execution</TableCell>
              <TableCell>Success Rate</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {integrations.map((integration) => {
              const healthScore = getHealthScore(integration);
              const metrics = performanceMetrics[integration.id];
              const successRate = metrics ? 
                (metrics.successful_executions / Math.max(1, metrics.total_executions) * 100).toFixed(1) : 
                'N/A';

              return (
                <TableRow key={integration.id}>
                  <TableCell>
                    <Box display="flex" alignItems="center">
                      {integrationTypeIcons[integration.integration_type]}
                      <Box ml={1}>
                        <Typography variant="subtitle2">
                          {integration.name}
                        </Typography>
                        <Typography variant="caption" color="textSecondary">
                          {integration.description}
                        </Typography>
                      </Box>
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={integration.integration_type.replace('_', ' ').toUpperCase()}
                      color="primary"
                      variant="outlined"
                      size="small"
                    />
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={integration.status}
                      style={{ 
                        backgroundColor: statusColors[integration.status],
                        color: 'white'
                      }}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>
                    <Box display="flex" alignItems="center">
                      <LinearProgress
                        variant="determinate"
                        value={healthScore}
                        sx={{
                          width: 60,
                          mr: 1,
                          '& .MuiLinearProgress-bar': {
                            backgroundColor: getHealthScoreColor(healthScore)
                          }
                        }}
                      />
                      <Typography variant="caption">
                        {healthScore}%
                      </Typography>
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Typography variant="caption">
                      {metrics?.last_execution_at ? 
                        new Date(metrics.last_execution_at).toLocaleString() : 
                        'Never'
                      }
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="caption">
                      {successRate}%
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Box display="flex" gap={1}>
                      <Tooltip title="Test Integration">
                        <IconButton
                          size="small"
                          onClick={() => handleTestIntegration(integration.id)}
                          color="primary"
                        >
                          <TestIcon />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Edit Integration">
                        <IconButton
                          size="small"
                          onClick={() => {
                            setEditingIntegration(integration);
                            setNewIntegration(integration);
                            setDialogOpen(true);
                          }}
                          color="primary"
                        >
                          <EditIcon />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Delete Integration">
                        <IconButton
                          size="small"
                          onClick={() => handleDeleteIntegration(integration.id)}
                          color="error"
                        >
                          <DeleteIcon />
                        </IconButton>
                      </Tooltip>
                      <IconButton
                        size="small"
                        onClick={(e) => {
                          setAnchorEl(e.currentTarget);
                          setSelectedIntegration(integration);
                        }}
                      >
                        <MoreVertIcon />
                      </IconButton>
                    </Box>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );

  const renderExecutionHistory = () => (
    <Box>
      <Typography variant="h6" gutterBottom>
        Execution History
      </Typography>
      
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Integration</TableCell>
              <TableCell>Operation</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Duration</TableCell>
              <TableCell>Executed At</TableCell>
              <TableCell>Error</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {executions.slice(0, 100).map((execution) => (
              <TableRow key={execution.id}>
                <TableCell>
                  {integrations.find(i => i.id === execution.integration_id)?.name || 'Unknown'}
                </TableCell>
                <TableCell>{execution.operation_type}</TableCell>
                <TableCell>
                  <Chip
                    label={execution.status}
                    color={execution.status === 'success' ? 'success' : 'error'}
                    size="small"
                  />
                </TableCell>
                <TableCell>
                  {execution.duration_ms ? `${execution.duration_ms}ms` : 'N/A'}
                </TableCell>
                <TableCell>
                  {new Date(execution.executed_at).toLocaleString()}
                </TableCell>
                <TableCell>
                  {execution.error_message && (
                    <Tooltip title={execution.error_message}>
                      <ErrorIcon color="error" />
                    </Tooltip>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );

  const renderWebhooksTab = () => (
    <Box>
      <Typography variant="h6" gutterBottom>
        Webhook Management
      </Typography>
      
      <Grid container spacing={2}>
        {webhooks.map((webhook) => (
          <Grid item xs={12} md={6} key={webhook.id}>
            <Card>
              <CardContent>
                <Box display="flex" justifyContent="between" alignItems="start">
                  <Box>
                    <Typography variant="h6">
                      {webhook.webhook_path}
                    </Typography>
                    <Typography variant="body2" color="textSecondary">
                      Methods: {webhook.allowed_methods?.join(', ') || 'POST'}
                    </Typography>
                    <Typography variant="body2" color="textSecondary">
                      Triggers: {webhook.total_triggers || 0}
                    </Typography>
                    <Typography variant="body2" color="textSecondary">
                      Last Triggered: {webhook.last_triggered_at ? 
                        new Date(webhook.last_triggered_at).toLocaleString() : 
                        'Never'
                      }
                    </Typography>
                  </Box>
                  <Chip
                    label={webhook.is_active ? 'Active' : 'Inactive'}
                    color={webhook.is_active ? 'success' : 'default'}
                    size="small"
                  />
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Box>
  );

  const renderAnalyticsTab = () => (
    <Grid container spacing={3}>
      {/* Response Time Trends */}
      <Grid item xs={12}>
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Response Time Trends (Last 30 Days)
            </Typography>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={analytics.slice(-30)}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="date" 
                  tickFormatter={(date) => new Date(date).toLocaleDateString()}
                />
                <YAxis />
                <ChartTooltip 
                  labelFormatter={(date) => new Date(date).toLocaleDateString()}
                />
                <Legend />
                <Area
                  type="monotone"
                  dataKey="avg_response_time"
                  stroke="#2196F3"
                  fill="#2196F3"
                  fillOpacity={0.3}
                  name="Avg Response Time (ms)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </Grid>

      {/* Data Transfer Volume */}
      <Grid item xs={12} md={6}>
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Data Transfer Volume (Last 7 Days)
            </Typography>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={analytics.slice(-7)}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="date" 
                  tickFormatter={(date) => new Date(date).toLocaleDateString()}
                />
                <YAxis />
                <ChartTooltip 
                  labelFormatter={(date) => new Date(date).toLocaleDateString()}
                  formatter={(value, name) => [`${(value / 1024 / 1024).toFixed(2)} MB`, name]}
                />
                <Legend />
                <Bar
                  dataKey="total_request_bytes"
                  fill="#4CAF50"
                  name="Request Data"
                />
                <Bar
                  dataKey="total_response_bytes"
                  fill="#2196F3"
                  name="Response Data"
                />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </Grid>

      {/* Integration Type Performance */}
      <Grid item xs={12} md={6}>
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Performance by Integration Type
            </Typography>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart 
                data={Object.entries(
                  analytics.reduce((acc, day) => {
                    if (!acc[day.integration_type]) {
                      acc[day.integration_type] = {
                        type: day.integration_type,
                        requests: 0,
                        avg_response_time: 0,
                        count: 0
                      };
                    }
                    acc[day.integration_type].requests += day.total_requests || 0;
                    acc[day.integration_type].avg_response_time += day.avg_response_time || 0;
                    acc[day.integration_type].count++;
                    return acc;
                  }, {})
                ).map(([type, data]) => ({
                  type,
                  requests: data.requests,
                  avg_response_time: Math.round(data.avg_response_time / data.count)
                }))}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="type" />
                <YAxis />
                <ChartTooltip />
                <Legend />
                <Bar dataKey="requests" fill="#4CAF50" name="Total Requests" />
                <Bar dataKey="avg_response_time" fill="#FF9800" name="Avg Response Time (ms)" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </Grid>
    </Grid>
  );

  return (
    <Box p={3}>
      {loading && <LinearProgress sx={{ mb: 2 }} />}
      
      <Box mb={3}>
        <Typography variant="h4" gutterBottom>
          Service Integration Hub
        </Typography>
        <Typography variant="body1" color="textSecondary">
          Manage and monitor external service integrations for your workflows
        </Typography>
      </Box>

      <Tabs value={activeTab} onChange={(e, newValue) => setActiveTab(newValue)}>
        <Tab label="Overview" />
        <Tab label="Integrations" />
        <Tab label="Execution History" />
        <Tab label="Webhooks" />
        <Tab label="Analytics" />
      </Tabs>

      <TabPanel value={activeTab} index={0}>
        {renderIntegrationsOverview()}
      </TabPanel>

      <TabPanel value={activeTab} index={1}>
        {renderIntegrationsList()}
      </TabPanel>

      <TabPanel value={activeTab} index={2}>
        {renderExecutionHistory()}
      </TabPanel>

      <TabPanel value={activeTab} index={3}>
        {renderWebhooksTab()}
      </TabPanel>

      <TabPanel value={activeTab} index={4}>
        {renderAnalyticsTab()}
      </TabPanel>

      {/* Create/Edit Integration Dialog */}
      <Dialog 
        open={dialogOpen} 
        onClose={() => {
          setDialogOpen(false);
          setEditingIntegration(null);
          setNewIntegration({
            name: '',
            integration_type: 'rest_api',
            description: '',
            configuration: {},
            auth_config: {},
            rate_limit_config: {
              requests_per_minute: 60,
              burst_limit: 10
            },
            is_active: true
          });
        }}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          {editingIntegration ? 'Edit Integration' : 'Create New Integration'}
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Integration Name"
                fullWidth
                value={newIntegration.name}
                onChange={(e) => setNewIntegration(prev => ({ ...prev, name: e.target.value }))}
                required
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Integration Type</InputLabel>
                <Select
                  value={newIntegration.integration_type}
                  onChange={(e) => setNewIntegration(prev => ({ ...prev, integration_type: e.target.value }))}
                >
                  <MenuItem value="rest_api">REST API</MenuItem>
                  <MenuItem value="database">Database</MenuItem>
                  <MenuItem value="cloud_service">Cloud Service</MenuItem>
                  <MenuItem value="messaging">Messaging</MenuItem>
                  <MenuItem value="webhook">Webhook</MenuItem>
                  <MenuItem value="file_system">File System</MenuItem>
                  <MenuItem value="email">Email</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12}>
              <TextField
                label="Description"
                fullWidth
                multiline
                rows={3}
                value={newIntegration.description}
                onChange={(e) => setNewIntegration(prev => ({ ...prev, description: e.target.value }))}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Rate Limit (requests/minute)"
                type="number"
                fullWidth
                value={newIntegration.rate_limit_config.requests_per_minute}
                onChange={(e) => setNewIntegration(prev => ({
                  ...prev,
                  rate_limit_config: {
                    ...prev.rate_limit_config,
                    requests_per_minute: parseInt(e.target.value)
                  }
                }))}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Burst Limit"
                type="number"
                fullWidth
                value={newIntegration.rate_limit_config.burst_limit}
                onChange={(e) => setNewIntegration(prev => ({
                  ...prev,
                  rate_limit_config: {
                    ...prev.rate_limit_config,
                    burst_limit: parseInt(e.target.value)
                  }
                }))}
              />
            </Grid>
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={newIntegration.is_active}
                    onChange={(e) => setNewIntegration(prev => ({ ...prev, is_active: e.target.checked }))}
                  />
                }
                label="Active"
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>
            Cancel
          </Button>
          <Button 
            onClick={editingIntegration ? 
              () => handleUpdateIntegration(editingIntegration.id, newIntegration) : 
              handleCreateIntegration
            }
            variant="contained"
          >
            {editingIntegration ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Actions Menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={() => setAnchorEl(null)}
      >
        <MenuItemComponent onClick={() => {
          setConfigurationDialogOpen(true);
          setAnchorEl(null);
        }}>
          <ListItemIcon>
            <SettingsIcon />
          </ListItemIcon>
          <ListItemText>Configuration</ListItemText>
        </MenuItemComponent>
        <MenuItemComponent onClick={() => {
          if (selectedIntegration) {
            handleTestIntegration(selectedIntegration.id);
          }
          setAnchorEl(null);
        }}>
          <ListItemIcon>
            <TestIcon />
          </ListItemIcon>
          <ListItemText>Test Connection</ListItemText>
        </MenuItemComponent>
        <MenuItemComponent onClick={() => setAnchorEl(null)}>
          <ListItemIcon>
            <ViewIcon />
          </ListItemIcon>
          <ListItemText>View Details</ListItemText>
        </MenuItemComponent>
      </Menu>
    </Box>
  );
};

export default WorkflowServiceIntegrationDashboard;

/**
 * Workflow Execution Monitor Component
 * Real-time monitoring and management of workflow executions
 * Part of Task 25: Enterprise Workflow Automation System - Component 2
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
    Box,
    Card,
    CardContent,
    Typography,
    Button,
    Chip,
    LinearProgress,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Paper,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    IconButton,
    Tooltip,
    Grid,
    Alert,
    Tabs,
    Tab,
    List,
    ListItem,
    ListItemText,
    ListItemSecondaryAction,
    Accordion,
    AccordionSummary,
    AccordionDetails,
    Menu,
    MenuItem,
    FormControl,
    Select,
    InputLabel,
    TextField,
    Switch,
    FormControlLabel
} from '@mui/material';
import {
    PlayArrow as PlayIcon,
    Stop as StopIcon,
    Refresh as RefreshIcon,
    Visibility as ViewIcon,
    Delete as DeleteIcon,
    ExpandMore as ExpandMoreIcon,
    Timeline as TimelineIcon,
    Warning as WarningIcon,
    CheckCircle as CheckCircleIcon,
    Error as ErrorIcon,
    Pause as PauseIcon,
    Schedule as ScheduleIcon,
    MoreVert as MoreVertIcon,
    Download as DownloadIcon,
    FilterList as FilterIcon
} from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';

// Execution status color mapping
const statusColors = {
    pending: 'default',
    running: 'primary',
    completed: 'success',
    failed: 'error',
    cancelled: 'warning',
    paused: 'secondary'
};

// Execution status icons
const statusIcons = {
    pending: <ScheduleIcon />,
    running: <PlayIcon />,
    completed: <CheckCircleIcon />,
    failed: <ErrorIcon />,
    cancelled: <WarningIcon />,
    paused: <PauseIcon />
};

function TabPanel({ children, value, index, ...other }) {
    return (
        <div
            role="tabpanel"
            hidden={value !== index}
            id={`execution-tabpanel-${index}`}
            aria-labelledby={`execution-tab-${index}`}
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

const WorkflowExecutionMonitor = ({ workflowId }) => {
    const { user } = useAuth();
    const [activeTab, setActiveTab] = useState(0);
    const [executions, setExecutions] = useState([]);
    const [activeExecutions, setActiveExecutions] = useState([]);
    const [selectedExecution, setSelectedExecution] = useState(null);
    const [executionDetails, setExecutionDetails] = useState(null);
    const [executionLogs, setExecutionLogs] = useState([]);
    const [metrics, setMetrics] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [autoRefresh, setAutoRefresh] = useState(true);
    const [refreshInterval, setRefreshInterval] = useState(5000);
    const [detailsDialog, setDetailsDialog] = useState(false);
    const [cancelDialog, setCancelDialog] = useState(false);
    const [executionToCancel, setExecutionToCancel] = useState(null);
    const [anchorEl, setAnchorEl] = useState(null);
    const [selectedExecutionForMenu, setSelectedExecutionForMenu] = useState(null);

    // Filters and pagination
    const [filters, setFilters] = useState({
        status: '',
        dateRange: '7',
        limit: 20,
        offset: 0
    });

    // Load execution history
    const loadExecutions = useCallback(async () => {
        if (!workflowId) return;

        try {
            setLoading(true);
            const params = new URLSearchParams({
                limit: filters.limit,
                offset: filters.offset,
                ...(filters.status && { status: filters.status })
            });

            const response = await fetch(`/api/workflows/${workflowId}/executions?${params}`, {
                headers: {
                    'Authorization': `Bearer ${user.token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error('Failed to load executions');
            }

            const data = await response.json();
            setExecutions(data.executions || []);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, [workflowId, user.token, filters]);

    // Load active executions
    const loadActiveExecutions = useCallback(async () => {
        try {
            const response = await fetch('/api/workflows/executions/active', {
                headers: {
                    'Authorization': `Bearer ${user.token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error('Failed to load active executions');
            }

            const data = await response.json();
            const workflowActiveExecutions = data.executions.filter(
                exec => exec.workflowId === workflowId
            );
            setActiveExecutions(workflowActiveExecutions);
        } catch (err) {
            console.error('Error loading active executions:', err);
        }
    }, [workflowId, user.token]);

    // Load execution metrics
    const loadMetrics = useCallback(async () => {
        if (!workflowId) return;

        try {
            const response = await fetch(`/api/workflows/${workflowId}/metrics?days=${filters.dateRange}`, {
                headers: {
                    'Authorization': `Bearer ${user.token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error('Failed to load metrics');
            }

            const data = await response.json();
            setMetrics(data.metrics);
        } catch (err) {
            console.error('Error loading metrics:', err);
        }
    }, [workflowId, user.token, filters.dateRange]);

    // Execute workflow
    const executeWorkflow = async (inputData = {}, options = {}) => {
        try {
            setLoading(true);
            const response = await fetch(`/api/workflows/${workflowId}/execute`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${user.token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ inputData, options })
            });

            if (!response.ok) {
                throw new Error('Failed to execute workflow');
            }

            const data = await response.json();
            
            // Refresh data
            loadExecutions();
            loadActiveExecutions();
            
            return data;
        } catch (err) {
            setError(err.message);
            throw err;
        } finally {
            setLoading(false);
        }
    };

    // Cancel execution
    const cancelExecution = async (executionId, reason = 'Cancelled by user') => {
        try {
            const response = await fetch(`/api/workflows/executions/${executionId}/cancel`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${user.token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ reason })
            });

            if (!response.ok) {
                throw new Error('Failed to cancel execution');
            }

            // Refresh data
            loadActiveExecutions();
            loadExecutions();
            
            setCancelDialog(false);
            setExecutionToCancel(null);
        } catch (err) {
            setError(err.message);
        }
    };

    // Load execution details
    const loadExecutionDetails = async (executionId) => {
        try {
            const response = await fetch(`/api/workflows/executions/${executionId}/status`, {
                headers: {
                    'Authorization': `Bearer ${user.token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (response.ok) {
                const data = await response.json();
                setExecutionDetails(data);
            }
        } catch (err) {
            console.error('Error loading execution details:', err);
        }
    };

    // Load execution logs
    const loadExecutionLogs = async (executionId, options = {}) => {
        try {
            const params = new URLSearchParams({
                limit: options.limit || 100,
                offset: options.offset || 0,
                ...(options.level && { level: options.level }),
                ...(options.nodeId && { nodeId: options.nodeId })
            });

            const response = await fetch(`/api/workflows/executions/${executionId}/logs?${params}`, {
                headers: {
                    'Authorization': `Bearer ${user.token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (response.ok) {
                const data = await response.json();
                setExecutionLogs(data.logs || []);
            }
        } catch (err) {
            console.error('Error loading execution logs:', err);
        }
    };

    // Auto-refresh effect
    useEffect(() => {
        let interval;
        
        if (autoRefresh && activeExecutions.length > 0) {
            interval = setInterval(() => {
                loadActiveExecutions();
                if (selectedExecution && executionDetails) {
                    loadExecutionDetails(selectedExecution);
                }
            }, refreshInterval);
        }

        return () => {
            if (interval) {
                clearInterval(interval);
            }
        };
    }, [autoRefresh, refreshInterval, activeExecutions.length, selectedExecution, executionDetails, loadActiveExecutions]);

    // Initial load
    useEffect(() => {
        loadExecutions();
        loadActiveExecutions();
        loadMetrics();
    }, [loadExecutions, loadActiveExecutions, loadMetrics]);

    // Handle execution selection
    const handleExecutionSelect = (execution) => {
        setSelectedExecution(execution.id);
        loadExecutionDetails(execution.id);
        loadExecutionLogs(execution.id);
        setDetailsDialog(true);
    };

    // Handle menu actions
    const handleMenuClick = (event, execution) => {
        setAnchorEl(event.currentTarget);
        setSelectedExecutionForMenu(execution);
    };

    const handleMenuClose = () => {
        setAnchorEl(null);
        setSelectedExecutionForMenu(null);
    };

    // Format duration
    const formatDuration = (ms) => {
        if (!ms) return 'N/A';
        const seconds = Math.floor(ms / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);

        if (hours > 0) {
            return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
        } else if (minutes > 0) {
            return `${minutes}m ${seconds % 60}s`;
        } else {
            return `${seconds}s`;
        }
    };

    // Format timestamp
    const formatTimestamp = (timestamp) => {
        return new Date(timestamp).toLocaleString();
    };

    // Get log level color
    const getLogLevelColor = (level) => {
        switch (level) {
            case 'error': return 'error';
            case 'warn': return 'warning';
            case 'info': return 'info';
            case 'debug': return 'default';
            default: return 'default';
        }
    };

    return (
        <Box sx={{ width: '100%' }}>
            {error && (
                <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
                    {error}
                </Alert>
            )}

            <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
                <Tabs value={activeTab} onChange={(e, newValue) => setActiveTab(newValue)}>
                    <Tab label="Active Executions" />
                    <Tab label="Execution History" />
                    <Tab label="Metrics" />
                </Tabs>
            </Box>

            {/* Controls */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                    <Button
                        variant="contained"
                        startIcon={<PlayIcon />}
                        onClick={() => executeWorkflow()}
                        disabled={loading}
                    >
                        Execute Workflow
                    </Button>
                    <Button
                        variant="outlined"
                        startIcon={<RefreshIcon />}
                        onClick={() => {
                            loadExecutions();
                            loadActiveExecutions();
                            loadMetrics();
                        }}
                        disabled={loading}
                    >
                        Refresh
                    </Button>
                </Box>

                <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                    <FormControlLabel
                        control={
                            <Switch
                                checked={autoRefresh}
                                onChange={(e) => setAutoRefresh(e.target.checked)}
                            />
                        }
                        label="Auto-refresh"
                    />
                    <FormControl size="small" sx={{ minWidth: 120 }}>
                        <InputLabel>Interval</InputLabel>
                        <Select
                            value={refreshInterval}
                            label="Interval"
                            onChange={(e) => setRefreshInterval(e.target.value)}
                        >
                            <MenuItem value={1000}>1s</MenuItem>
                            <MenuItem value={5000}>5s</MenuItem>
                            <MenuItem value={10000}>10s</MenuItem>
                            <MenuItem value={30000}>30s</MenuItem>
                        </Select>
                    </FormControl>
                </Box>
            </Box>

            {/* Active Executions Tab */}
            <TabPanel value={activeTab} index={0}>
                {activeExecutions.length === 0 ? (
                    <Card>
                        <CardContent sx={{ textAlign: 'center', py: 4 }}>
                            <TimelineIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
                            <Typography variant="h6" color="text.secondary">
                                No active executions
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                                Execute the workflow to see real-time monitoring
                            </Typography>
                        </CardContent>
                    </Card>
                ) : (
                    <Grid container spacing={3}>
                        {activeExecutions.map((execution) => (
                            <Grid item xs={12} md={6} lg={4} key={execution.executionId}>
                                <Card sx={{ height: '100%' }}>
                                    <CardContent>
                                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                                            <Box>
                                                <Typography variant="h6" component="div">
                                                    Execution #{execution.executionId.slice(-8)}
                                                </Typography>
                                                <Typography variant="body2" color="text.secondary">
                                                    Started: {formatTimestamp(execution.startedAt)}
                                                </Typography>
                                            </Box>
                                            <Chip
                                                icon={statusIcons[execution.status]}
                                                label={execution.status.toUpperCase()}
                                                color={statusColors[execution.status]}
                                                size="small"
                                            />
                                        </Box>

                                        <LinearProgress
                                            variant="determinate"
                                            value={execution.progress || 0}
                                            sx={{ mb: 2 }}
                                        />

                                        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                                            Progress: {Math.round(execution.progress || 0)}%
                                        </Typography>

                                        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                                            Duration: {formatDuration(execution.duration)}
                                        </Typography>

                                        <Box sx={{ display: 'flex', gap: 1 }}>
                                            <Button
                                                size="small"
                                                startIcon={<ViewIcon />}
                                                onClick={() => handleExecutionSelect(execution)}
                                            >
                                                View Details
                                            </Button>
                                            <Button
                                                size="small"
                                                startIcon={<StopIcon />}
                                                color="error"
                                                onClick={() => {
                                                    setExecutionToCancel(execution.executionId);
                                                    setCancelDialog(true);
                                                }}
                                            >
                                                Cancel
                                            </Button>
                                        </Box>
                                    </CardContent>
                                </Card>
                            </Grid>
                        ))}
                    </Grid>
                )}
            </TabPanel>

            {/* Execution History Tab */}
            <TabPanel value={activeTab} index={1}>
                {/* Filters */}
                <Box sx={{ display: 'flex', gap: 2, mb: 2, alignItems: 'center' }}>
                    <FormControl size="small" sx={{ minWidth: 150 }}>
                        <InputLabel>Status</InputLabel>
                        <Select
                            value={filters.status}
                            label="Status"
                            onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                        >
                            <MenuItem value="">All</MenuItem>
                            <MenuItem value="completed">Completed</MenuItem>
                            <MenuItem value="failed">Failed</MenuItem>
                            <MenuItem value="cancelled">Cancelled</MenuItem>
                        </Select>
                    </FormControl>

                    <FormControl size="small" sx={{ minWidth: 150 }}>
                        <InputLabel>Date Range</InputLabel>
                        <Select
                            value={filters.dateRange}
                            label="Date Range"
                            onChange={(e) => setFilters({ ...filters, dateRange: e.target.value })}
                        >
                            <MenuItem value="1">Last 24 hours</MenuItem>
                            <MenuItem value="7">Last 7 days</MenuItem>
                            <MenuItem value="30">Last 30 days</MenuItem>
                            <MenuItem value="90">Last 90 days</MenuItem>
                        </Select>
                    </FormControl>
                </Box>

                <TableContainer component={Paper}>
                    <Table>
                        <TableHead>
                            <TableRow>
                                <TableCell>Execution ID</TableCell>
                                <TableCell>Status</TableCell>
                                <TableCell>Started</TableCell>
                                <TableCell>Duration</TableCell>
                                <TableCell>Actions</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {executions.map((execution) => (
                                <TableRow key={execution.id}>
                                    <TableCell>
                                        <Typography variant="body2" fontFamily="monospace">
                                            {execution.id.slice(-8)}
                                        </Typography>
                                    </TableCell>
                                    <TableCell>
                                        <Chip
                                            icon={statusIcons[execution.status]}
                                            label={execution.status.toUpperCase()}
                                            color={statusColors[execution.status]}
                                            size="small"
                                        />
                                    </TableCell>
                                    <TableCell>
                                        <Typography variant="body2">
                                            {formatTimestamp(execution.started_at)}
                                        </Typography>
                                    </TableCell>
                                    <TableCell>
                                        <Typography variant="body2">
                                            {formatDuration(execution.duration_ms)}
                                        </Typography>
                                    </TableCell>
                                    <TableCell>
                                        <IconButton
                                            size="small"
                                            onClick={(e) => handleMenuClick(e, execution)}
                                        >
                                            <MoreVertIcon />
                                        </IconButton>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </TableContainer>
            </TabPanel>

            {/* Metrics Tab */}
            <TabPanel value={activeTab} index={2}>
                {metrics && (
                    <Grid container spacing={3}>
                        {/* Summary Cards */}
                        <Grid item xs={12} md={3}>
                            <Card>
                                <CardContent sx={{ textAlign: 'center' }}>
                                    <Typography variant="h4" color="primary">
                                        {metrics.totalExecutions}
                                    </Typography>
                                    <Typography variant="body2" color="text.secondary">
                                        Total Executions
                                    </Typography>
                                </CardContent>
                            </Card>
                        </Grid>

                        <Grid item xs={12} md={3}>
                            <Card>
                                <CardContent sx={{ textAlign: 'center' }}>
                                    <Typography variant="h4" color="success.main">
                                        {metrics.successfulExecutions}
                                    </Typography>
                                    <Typography variant="body2" color="text.secondary">
                                        Successful
                                    </Typography>
                                </CardContent>
                            </Card>
                        </Grid>

                        <Grid item xs={12} md={3}>
                            <Card>
                                <CardContent sx={{ textAlign: 'center' }}>
                                    <Typography variant="h4" color="info.main">
                                        {metrics.successRate.toFixed(1)}%
                                    </Typography>
                                    <Typography variant="body2" color="text.secondary">
                                        Success Rate
                                    </Typography>
                                </CardContent>
                            </Card>
                        </Grid>

                        <Grid item xs={12} md={3}>
                            <Card>
                                <CardContent sx={{ textAlign: 'center' }}>
                                    <Typography variant="h4" color="warning.main">
                                        {formatDuration(
                                            metrics.statusBreakdown.find(s => s.status === 'completed')?.avgDuration || 0
                                        )}
                                    </Typography>
                                    <Typography variant="body2" color="text.secondary">
                                        Avg Duration
                                    </Typography>
                                </CardContent>
                            </Card>
                        </Grid>

                        {/* Status Breakdown */}
                        <Grid item xs={12}>
                            <Card>
                                <CardContent>
                                    <Typography variant="h6" sx={{ mb: 2 }}>
                                        Status Breakdown
                                    </Typography>
                                    <TableContainer>
                                        <Table size="small">
                                            <TableHead>
                                                <TableRow>
                                                    <TableCell>Status</TableCell>
                                                    <TableCell align="right">Count</TableCell>
                                                    <TableCell align="right">Avg Duration</TableCell>
                                                    <TableCell align="right">Min Duration</TableCell>
                                                    <TableCell align="right">Max Duration</TableCell>
                                                </TableRow>
                                            </TableHead>
                                            <TableBody>
                                                {metrics.statusBreakdown.map((status) => (
                                                    <TableRow key={status.status}>
                                                        <TableCell>
                                                            <Chip
                                                                label={status.status.toUpperCase()}
                                                                color={statusColors[status.status]}
                                                                size="small"
                                                            />
                                                        </TableCell>
                                                        <TableCell align="right">{status.count}</TableCell>
                                                        <TableCell align="right">
                                                            {formatDuration(status.avgDuration)}
                                                        </TableCell>
                                                        <TableCell align="right">
                                                            {formatDuration(status.minDuration)}
                                                        </TableCell>
                                                        <TableCell align="right">
                                                            {formatDuration(status.maxDuration)}
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </TableContainer>
                                </CardContent>
                            </Card>
                        </Grid>
                    </Grid>
                )}
            </TabPanel>

            {/* Execution Details Dialog */}
            <Dialog
                open={detailsDialog}
                onClose={() => setDetailsDialog(false)}
                maxWidth="lg"
                fullWidth
            >
                <DialogTitle>
                    Execution Details
                    {selectedExecution && ` - ${selectedExecution.slice(-8)}`}
                </DialogTitle>
                <DialogContent>
                    {executionDetails && (
                        <Box>
                            {/* Status and Progress */}
                            <Box sx={{ mb: 3 }}>
                                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                                    <Chip
                                        icon={statusIcons[executionDetails.status]}
                                        label={executionDetails.status.toUpperCase()}
                                        color={statusColors[executionDetails.status]}
                                    />
                                    <Typography variant="body2" color="text.secondary">
                                        Progress: {Math.round(executionDetails.progress || 0)}%
                                    </Typography>
                                </Box>
                                <LinearProgress
                                    variant="determinate"
                                    value={executionDetails.progress || 0}
                                    sx={{ mb: 2 }}
                                />
                            </Box>

                            {/* Metrics */}
                            <Grid container spacing={2} sx={{ mb: 3 }}>
                                <Grid item xs={6} md={3}>
                                    <Typography variant="body2" color="text.secondary">
                                        Duration
                                    </Typography>
                                    <Typography variant="body1">
                                        {formatDuration(executionDetails.duration)}
                                    </Typography>
                                </Grid>
                                <Grid item xs={6} md={3}>
                                    <Typography variant="body2" color="text.secondary">
                                        Nodes Executed
                                    </Typography>
                                    <Typography variant="body1">
                                        {executionDetails.metrics?.nodesExecuted || 0}
                                    </Typography>
                                </Grid>
                                <Grid item xs={6} md={3}>
                                    <Typography variant="body2" color="text.secondary">
                                        Nodes Failed
                                    </Typography>
                                    <Typography variant="body1">
                                        {executionDetails.metrics?.nodesFailed || 0}
                                    </Typography>
                                </Grid>
                                <Grid item xs={6} md={3}>
                                    <Typography variant="body2" color="text.secondary">
                                        Retries
                                    </Typography>
                                    <Typography variant="body1">
                                        {executionDetails.metrics?.retriesPerformed || 0}
                                    </Typography>
                                </Grid>
                            </Grid>

                            {/* Current Nodes */}
                            {executionDetails.currentNodes && executionDetails.currentNodes.length > 0 && (
                                <Accordion defaultExpanded>
                                    <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                                        <Typography variant="h6">
                                            Currently Executing Nodes ({executionDetails.currentNodes.length})
                                        </Typography>
                                    </AccordionSummary>
                                    <AccordionDetails>
                                        <List>
                                            {executionDetails.currentNodes.map((node) => (
                                                <ListItem key={node.nodeId}>
                                                    <ListItemText
                                                        primary={node.nodeId}
                                                        secondary={`Started: ${formatTimestamp(node.timestamp)}`}
                                                    />
                                                    <ListItemSecondaryAction>
                                                        <Chip
                                                            label={node.state.toUpperCase()}
                                                            color="primary"
                                                            size="small"
                                                        />
                                                    </ListItemSecondaryAction>
                                                </ListItem>
                                            ))}
                                        </List>
                                    </AccordionDetails>
                                </Accordion>
                            )}

                            {/* Execution Logs */}
                            <Accordion>
                                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                                    <Typography variant="h6">
                                        Recent Logs ({executionLogs.length})
                                    </Typography>
                                </AccordionSummary>
                                <AccordionDetails>
                                    <List sx={{ maxHeight: 400, overflow: 'auto' }}>
                                        {executionLogs.map((log) => (
                                            <ListItem key={log.id} divider>
                                                <ListItemText
                                                    primary={
                                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                            <Chip
                                                                label={log.level.toUpperCase()}
                                                                color={getLogLevelColor(log.level)}
                                                                size="small"
                                                            />
                                                            <Typography variant="body2">
                                                                {log.message}
                                                            </Typography>
                                                        </Box>
                                                    }
                                                    secondary={
                                                        <Box>
                                                            <Typography variant="caption" color="text.secondary">
                                                                {formatTimestamp(log.timestamp)}
                                                                {log.nodeId && ` • Node: ${log.nodeId}`}
                                                            </Typography>
                                                            {log.data && (
                                                                <Typography
                                                                    variant="caption"
                                                                    component="pre"
                                                                    sx={{ mt: 1, fontFamily: 'monospace', fontSize: '0.75rem' }}
                                                                >
                                                                    {JSON.stringify(log.data, null, 2)}
                                                                </Typography>
                                                            )}
                                                        </Box>
                                                    }
                                                />
                                            </ListItem>
                                        ))}
                                    </List>
                                </AccordionDetails>
                            </Accordion>
                        </Box>
                    )}
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setDetailsDialog(false)}>
                        Close
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Cancel Execution Dialog */}
            <Dialog
                open={cancelDialog}
                onClose={() => setCancelDialog(false)}
            >
                <DialogTitle>Cancel Execution</DialogTitle>
                <DialogContent>
                    <Typography>
                        Are you sure you want to cancel this execution? This action cannot be undone.
                    </Typography>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setCancelDialog(false)}>
                        No, Keep Running
                    </Button>
                    <Button
                        onClick={() => cancelExecution(executionToCancel)}
                        color="error"
                        variant="contained"
                    >
                        Yes, Cancel
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Action Menu */}
            <Menu
                anchorEl={anchorEl}
                open={Boolean(anchorEl)}
                onClose={handleMenuClose}
            >
                <MenuItem onClick={() => {
                    handleExecutionSelect(selectedExecutionForMenu);
                    handleMenuClose();
                }}>
                    <ViewIcon sx={{ mr: 1 }} />
                    View Details
                </MenuItem>
                <MenuItem onClick={() => {
                    // Download execution data
                    handleMenuClose();
                }}>
                    <DownloadIcon sx={{ mr: 1 }} />
                    Export Data
                </MenuItem>
            </Menu>
        </Box>
    );
};

export default WorkflowExecutionMonitor;

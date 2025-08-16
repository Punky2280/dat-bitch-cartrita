import React, { useState, useEffect, useCallback } from 'react';
import {
    Box,
    Grid,
    Card,
    CardContent,
    Typography,
    Button,
    IconButton,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Chip,
    Badge,
    Alert,
    CircularProgress,
    LinearProgress,
    Tab,
    Tabs,
    Paper,
    List,
    ListItem,
    ListItemText,
    ListItemIcon,
    Avatar,
    Divider,
    Tooltip,
    Accordion,
    AccordionSummary,
    AccordionDetails,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    Switch,
    FormControlLabel
} from '@mui/material';
import {
    Dashboard as DashboardIcon,
    PlayArrow as RunningIcon,
    CheckCircle as CompletedIcon,
    Error as ErrorIcon,
    Warning as WarningIcon,
    Pause as PausedIcon,
    Cancel as CancelledIcon,
    TrendingUp as TrendingUpIcon,
    TrendingDown as TrendingDownIcon,
    Memory as MemoryIcon,
    Speed as CpuIcon,
    Storage as DiskIcon,
    Queue as QueueIcon,
    Timer as TimerIcon,
    Notifications as AlertIcon,
    Refresh as RefreshIcon,
    Settings as SettingsIcon,
    FullscreenExit as FullscreenExitIcon,
    Fullscreen as FullscreenIcon,
    ExpandMore as ExpandMoreIcon,
    Close as CloseIcon,
    NotificationsActive as ActiveAlertIcon,
    Assessment as MetricsIcon,
    Timeline as TimelineIcon,
    PieChart as ChartIcon
} from '@mui/icons-material';
import {
    LineChart,
    Line,
    AreaChart,
    Area,
    BarChart,
    Bar,
    PieChart,
    Cell,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip as RechartsTooltip,
    Legend,
    ResponsiveContainer
} from 'recharts';
import { useSnackbar } from 'notistack';
import { api } from '../../services/api';

// Widget configuration
const WIDGET_CONFIGS = {
    execution_stats: {
        title: 'Execution Statistics',
        icon: <MetricsIcon />,
        minWidth: 3,
        minHeight: 2
    },
    performance_chart: {
        title: 'Performance Timeline',
        icon: <TimelineIcon />,
        minWidth: 6,
        minHeight: 4
    },
    error_analysis: {
        title: 'Error Analysis',
        icon: <ErrorIcon />,
        minWidth: 4,
        minHeight: 3
    },
    resource_usage: {
        title: 'Resource Usage',
        icon: <MemoryIcon />,
        minWidth: 4,
        minHeight: 3
    },
    active_workflows: {
        title: 'Active Workflows',
        icon: <RunningIcon />,
        minWidth: 6,
        minHeight: 4
    },
    alerts_panel: {
        title: 'Alerts',
        icon: <AlertIcon />,
        minWidth: 4,
        minHeight: 3
    }
};

// Status colors
const STATUS_COLORS = {
    completed: '#4caf50',
    failed: '#f44336',
    running: '#2196f3',
    paused: '#ff9800',
    cancelled: '#757575',
    queued: '#9c27b0'
};

const SEVERITY_COLORS = {
    critical: '#d32f2f',
    warning: '#ed6c02',
    info: '#0288d1'
};

function WorkflowMonitoringDashboard() {
    const [dashboardData, setDashboardData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [selectedTimeRange, setSelectedTimeRange] = useState('24h');
    const [autoRefresh, setAutoRefresh] = useState(true);
    const [refreshInterval, setRefreshInterval] = useState(30); // seconds
    const [widgetSettings, setWidgetSettings] = useState({});
    const [alertDialog, setAlertDialog] = useState({ open: false, alert: null });
    const [fullscreenWidget, setFullscreenWidget] = useState(null);
    const [selectedTab, setSelectedTab] = useState(0);

    const { enqueueSnackbar } = useSnackbar();

    // Load dashboard data
    const loadDashboardData = useCallback(async () => {
        try {
            const response = await api.get('/workflows/monitoring/dashboard', {
                params: { timeRange: selectedTimeRange }
            });

            if (response.data.success) {
                setDashboardData(response.data);
                
                // Show critical alerts as snackbars
                const criticalAlerts = response.data.alerts?.filter(alert => 
                    alert.severity === 'critical' && !alert.isAcknowledged
                );
                
                criticalAlerts?.forEach(alert => {
                    enqueueSnackbar(alert.title, { 
                        variant: 'error',
                        persist: true,
                        action: (key) => (
                            <Button 
                                color="inherit" 
                                onClick={() => handleViewAlert(alert)}
                            >
                                View
                            </Button>
                        )
                    });
                });
            }
        } catch (error) {
            console.error('Error loading dashboard data:', error);
            enqueueSnackbar('Failed to load dashboard data', { variant: 'error' });
        } finally {
            setLoading(false);
        }
    }, [selectedTimeRange, enqueueSnackbar]);

    // Auto-refresh effect
    useEffect(() => {
        loadDashboardData();
        
        let intervalId;
        if (autoRefresh) {
            intervalId = setInterval(loadDashboardData, refreshInterval * 1000);
        }
        
        return () => {
            if (intervalId) clearInterval(intervalId);
        };
    }, [loadDashboardData, autoRefresh, refreshInterval]);

    const handleViewAlert = (alert) => {
        setAlertDialog({ open: true, alert });
    };

    const handleAcknowledgeAlert = async (alertId) => {
        try {
            await api.post(`/workflows/monitoring/alerts/${alertId}/acknowledge`);
            enqueueSnackbar('Alert acknowledged', { variant: 'success' });
            loadDashboardData();
            setAlertDialog({ open: false, alert: null });
        } catch (error) {
            console.error('Error acknowledging alert:', error);
            enqueueSnackbar('Failed to acknowledge alert', { variant: 'error' });
        }
    };

    const handleResolveAlert = async (alertId, resolution) => {
        try {
            await api.post(`/workflows/monitoring/alerts/${alertId}/resolve`, {
                resolution
            });
            enqueueSnackbar('Alert resolved', { variant: 'success' });
            loadDashboardData();
            setAlertDialog({ open: false, alert: null });
        } catch (error) {
            console.error('Error resolving alert:', error);
            enqueueSnackbar('Failed to resolve alert', { variant: 'error' });
        }
    };

    const formatDuration = (seconds) => {
        if (!seconds) return '0s';
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = Math.floor(seconds % 60);
        
        if (hours > 0) return `${hours}h ${minutes}m`;
        if (minutes > 0) return `${minutes}m ${secs}s`;
        return `${secs}s`;
    };

    const formatMemory = (mb) => {
        if (!mb) return '0 MB';
        if (mb >= 1024) return `${(mb / 1024).toFixed(1)} GB`;
        return `${mb.toFixed(0)} MB`;
    };

    const getStatusIcon = (status) => {
        switch (status) {
            case 'completed': return <CompletedIcon sx={{ color: STATUS_COLORS.completed }} />;
            case 'failed': return <ErrorIcon sx={{ color: STATUS_COLORS.failed }} />;
            case 'running': return <RunningIcon sx={{ color: STATUS_COLORS.running }} />;
            case 'paused': return <PausedIcon sx={{ color: STATUS_COLORS.paused }} />;
            case 'cancelled': return <CancelledIcon sx={{ color: STATUS_COLORS.cancelled }} />;
            default: return <QueueIcon sx={{ color: STATUS_COLORS.queued }} />;
        }
    };

    const getTrendIcon = (trend) => {
        if (trend > 5) return <TrendingUpIcon color="success" />;
        if (trend < -5) return <TrendingDownIcon color="error" />;
        return null;
    };

    const renderExecutionStatsWidget = () => {
        const stats = dashboardData?.executionStats || {};
        
        return (
            <Card>
                <CardContent>
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                        <MetricsIcon sx={{ mr: 1 }} />
                        <Typography variant="h6">Execution Statistics</Typography>
                        <Box sx={{ ml: 'auto' }}>
                            <Chip 
                                label={selectedTimeRange}
                                size="small"
                                variant="outlined"
                            />
                        </Box>
                    </Box>
                    
                    <Grid container spacing={2}>
                        <Grid item xs={6} md={3}>
                            <Box textAlign="center">
                                <Typography variant="h4" color="primary">
                                    {stats.totalExecutions || 0}
                                </Typography>
                                <Typography variant="body2" color="text.secondary">
                                    Total Executions
                                </Typography>
                            </Box>
                        </Grid>
                        <Grid item xs={6} md={3}>
                            <Box textAlign="center">
                                <Typography variant="h4" color="success.main">
                                    {((stats.successRate || 0) * 100).toFixed(1)}%
                                </Typography>
                                <Typography variant="body2" color="text.secondary">
                                    Success Rate
                                </Typography>
                            </Box>
                        </Grid>
                        <Grid item xs={6} md={3}>
                            <Box textAlign="center">
                                <Typography variant="h4" color="error.main">
                                    {stats.failedExecutions || 0}
                                </Typography>
                                <Typography variant="body2" color="text.secondary">
                                    Failed
                                </Typography>
                            </Box>
                        </Grid>
                        <Grid item xs={6} md={3}>
                            <Box textAlign="center">
                                <Typography variant="h4">
                                    {formatDuration(stats.avgExecutionTime)}
                                </Typography>
                                <Typography variant="body2" color="text.secondary">
                                    Avg Duration
                                </Typography>
                            </Box>
                        </Grid>
                    </Grid>

                    <Box sx={{ mt: 2 }}>
                        <LinearProgress
                            variant="determinate"
                            value={(stats.successRate || 0) * 100}
                            sx={{ height: 8, borderRadius: 4 }}
                        />
                    </Box>
                </CardContent>
            </Card>
        );
    };

    const renderPerformanceChartWidget = () => {
        const metrics = dashboardData?.performanceMetrics?.timeSeries || [];
        
        return (
            <Card>
                <CardContent>
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                        <TimelineIcon sx={{ mr: 1 }} />
                        <Typography variant="h6">Performance Timeline</Typography>
                        <IconButton 
                            size="small" 
                            sx={{ ml: 'auto' }}
                            onClick={() => setFullscreenWidget('performance_chart')}
                        >
                            <FullscreenIcon />
                        </IconButton>
                    </Box>
                    
                    <Box sx={{ height: 300 }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={metrics}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis 
                                    dataKey="timestamp" 
                                    tickFormatter={(value) => new Date(value).toLocaleTimeString()}
                                />
                                <YAxis yAxisId="left" />
                                <YAxis yAxisId="right" orientation="right" />
                                <RechartsTooltip
                                    labelFormatter={(value) => new Date(value).toLocaleString()}
                                    formatter={(value, name) => [
                                        name === 'avgExecutionTime' ? formatDuration(value) : value,
                                        name === 'avgExecutionTime' ? 'Avg Duration' : 
                                        name === 'successRate' ? 'Success Rate' : name
                                    ]}
                                />
                                <Legend />
                                <Line 
                                    yAxisId="left"
                                    type="monotone" 
                                    dataKey="avgExecutionTime" 
                                    stroke="#8884d8" 
                                    name="Avg Duration"
                                />
                                <Line 
                                    yAxisId="right"
                                    type="monotone" 
                                    dataKey="successRate" 
                                    stroke="#82ca9d" 
                                    name="Success Rate"
                                />
                            </LineChart>
                        </ResponsiveContainer>
                    </Box>
                </CardContent>
            </Card>
        );
    };

    const renderResourceUsageWidget = () => {
        const resources = dashboardData?.resourceUtilization || {};
        const current = resources.currentSystemLoad || {};
        
        return (
            <Card>
                <CardContent>
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                        <MemoryIcon sx={{ mr: 1 }} />
                        <Typography variant="h6">Resource Usage</Typography>
                    </Box>
                    
                    <Grid container spacing={2}>
                        <Grid item xs={12} md={4}>
                            <Box textAlign="center">
                                <CircularProgress
                                    variant="determinate"
                                    value={(current.cpuUsage || 0) * 100}
                                    size={80}
                                    thickness={8}
                                    sx={{ mb: 1 }}
                                />
                                <Typography variant="body2">
                                    CPU: {((current.cpuUsage || 0) * 100).toFixed(1)}%
                                </Typography>
                            </Box>
                        </Grid>
                        <Grid item xs={12} md={4}>
                            <Box textAlign="center">
                                <CircularProgress
                                    variant="determinate"
                                    value={(current.memoryUsage || 0) * 100}
                                    size={80}
                                    thickness={8}
                                    sx={{ mb: 1 }}
                                    color="warning"
                                />
                                <Typography variant="body2">
                                    Memory: {((current.memoryUsage || 0) * 100).toFixed(1)}%
                                </Typography>
                            </Box>
                        </Grid>
                        <Grid item xs={12} md={4}>
                            <Box textAlign="center">
                                <CircularProgress
                                    variant="determinate"
                                    value={(current.diskUsage || 0) * 100}
                                    size={80}
                                    thickness={8}
                                    sx={{ mb: 1 }}
                                    color="success"
                                />
                                <Typography variant="body2">
                                    Disk: {((current.diskUsage || 0) * 100).toFixed(1)}%
                                </Typography>
                            </Box>
                        </Grid>
                    </Grid>
                    
                    <Divider sx={{ my: 2 }} />
                    
                    <Box>
                        <Typography variant="body2" color="text.secondary" gutterBottom>
                            System Load: {(current.loadAverage || 0).toFixed(2)}
                        </Typography>
                        <LinearProgress
                            variant="determinate"
                            value={Math.min(100, (current.loadAverage || 0) * 50)}
                            sx={{ height: 6, borderRadius: 3 }}
                        />
                    </Box>
                </CardContent>
            </Card>
        );
    };

    const renderActiveWorkflowsWidget = () => {
        const workflows = dashboardData?.recentExecutions?.slice(0, 10) || [];
        
        return (
            <Card>
                <CardContent>
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                        <RunningIcon sx={{ mr: 1 }} />
                        <Typography variant="h6">Recent Executions</Typography>
                        <Badge 
                            badgeContent={dashboardData?.realTimeMetrics?.activeExecutions || 0}
                            color="primary"
                            sx={{ ml: 'auto' }}
                        >
                            <RunningIcon />
                        </Badge>
                    </Box>
                    
                    <List dense>
                        {workflows.map((execution, index) => (
                            <ListItem key={execution.executionId} divider={index < workflows.length - 1}>
                                <ListItemIcon>
                                    {getStatusIcon(execution.status)}
                                </ListItemIcon>
                                <ListItemText
                                    primary={execution.workflowName}
                                    secondary={
                                        <Box>
                                            <Typography variant="caption" display="block">
                                                Duration: {formatDuration(execution.duration)}
                                            </Typography>
                                            <Typography variant="caption" color="text.secondary">
                                                {new Date(execution.startedAt).toLocaleString()}
                                            </Typography>
                                        </Box>
                                    }
                                />
                                <Box>
                                    <Chip
                                        label={execution.status}
                                        size="small"
                                        sx={{
                                            bgcolor: STATUS_COLORS[execution.status] || '#757575',
                                            color: 'white'
                                        }}
                                    />
                                    {execution.errorCount > 0 && (
                                        <Chip
                                            label={`${execution.errorCount} errors`}
                                            size="small"
                                            color="error"
                                            sx={{ ml: 0.5 }}
                                        />
                                    )}
                                </Box>
                            </ListItem>
                        ))}
                    </List>
                </CardContent>
            </Card>
        );
    };

    const renderAlertsWidget = () => {
        const alerts = dashboardData?.alerts || [];
        const unacknowledgedAlerts = alerts.filter(alert => !alert.isAcknowledged);
        
        return (
            <Card>
                <CardContent>
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                        <AlertIcon sx={{ mr: 1 }} />
                        <Typography variant="h6">Active Alerts</Typography>
                        <Badge 
                            badgeContent={unacknowledgedAlerts.length}
                            color="error"
                            sx={{ ml: 'auto' }}
                        >
                            <ActiveAlertIcon />
                        </Badge>
                    </Box>
                    
                    {alerts.length === 0 ? (
                        <Alert severity="success">
                            No active alerts
                        </Alert>
                    ) : (
                        <List dense>
                            {alerts.slice(0, 5).map((alert, index) => (
                                <ListItem 
                                    key={alert.id} 
                                    divider={index < Math.min(alerts.length, 5) - 1}
                                    button
                                    onClick={() => handleViewAlert(alert)}
                                >
                                    <ListItemIcon>
                                        <Avatar
                                            sx={{
                                                bgcolor: SEVERITY_COLORS[alert.severity] || '#757575',
                                                width: 32,
                                                height: 32
                                            }}
                                        >
                                            {alert.severity === 'critical' ? '!' : 
                                             alert.severity === 'warning' ? '⚠' : 'ℹ'}
                                        </Avatar>
                                    </ListItemIcon>
                                    <ListItemText
                                        primary={alert.title}
                                        secondary={
                                            <Box>
                                                <Typography variant="caption" display="block">
                                                    {alert.message}
                                                </Typography>
                                                <Typography variant="caption" color="text.secondary">
                                                    {new Date(alert.createdAt).toLocaleString()}
                                                </Typography>
                                            </Box>
                                        }
                                    />
                                    {!alert.isAcknowledged && (
                                        <Chip
                                            label="New"
                                            size="small"
                                            color="error"
                                            variant="outlined"
                                        />
                                    )}
                                </ListItem>
                            ))}
                        </List>
                    )}
                    
                    {alerts.length > 5 && (
                        <Button
                            fullWidth
                            variant="outlined"
                            size="small"
                            sx={{ mt: 1 }}
                        >
                            View All Alerts ({alerts.length})
                        </Button>
                    )}
                </CardContent>
            </Card>
        );
    };

    const renderErrorAnalysisWidget = () => {
        const errorData = dashboardData?.errorAnalysis || {};
        const errorTypes = errorData.errorTypes || [];
        
        const pieData = errorTypes.map((error, index) => ({
            name: error.type,
            value: error.count,
            fill: `hsl(${(index * 360) / errorTypes.length}, 70%, 50%)`
        }));
        
        return (
            <Card>
                <CardContent>
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                        <ErrorIcon sx={{ mr: 1 }} />
                        <Typography variant="h6">Error Analysis</Typography>
                        <Chip 
                            label={`${errorData.totalErrors || 0} errors`}
                            size="small"
                            color={errorData.totalErrors > 0 ? "error" : "success"}
                            sx={{ ml: 'auto' }}
                        />
                    </Box>
                    
                    {errorTypes.length > 0 ? (
                        <Box sx={{ height: 200 }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={pieData}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={40}
                                        outerRadius={80}
                                        dataKey="value"
                                        label={({name, value}) => `${name}: ${value}`}
                                    >
                                        {pieData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.fill} />
                                        ))}
                                    </Pie>
                                    <RechartsTooltip />
                                </PieChart>
                            </ResponsiveContainer>
                        </Box>
                    ) : (
                        <Alert severity="success">
                            No errors in selected time range
                        </Alert>
                    )}
                    
                    {errorData.mostCommonError && (
                        <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                            Most common: {errorData.mostCommonError}
                        </Typography>
                    )}
                </CardContent>
            </Card>
        );
    };

    if (loading) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
                <CircularProgress size={60} />
            </Box>
        );
    }

    return (
        <Box sx={{ p: 3 }}>
            {/* Header */}
            <Box sx={{ mb: 3, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                    <Typography variant="h4" component="h1" gutterBottom>
                        Workflow Monitoring Dashboard
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                        Real-time monitoring and analytics for workflow executions
                    </Typography>
                </Box>
                
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <FormControl size="small">
                        <InputLabel>Time Range</InputLabel>
                        <Select
                            value={selectedTimeRange}
                            label="Time Range"
                            onChange={(e) => setSelectedTimeRange(e.target.value)}
                        >
                            <MenuItem value="1h">Last Hour</MenuItem>
                            <MenuItem value="6h">Last 6 Hours</MenuItem>
                            <MenuItem value="24h">Last 24 Hours</MenuItem>
                            <MenuItem value="7d">Last 7 Days</MenuItem>
                            <MenuItem value="30d">Last 30 Days</MenuItem>
                        </Select>
                    </FormControl>
                    
                    <FormControlLabel
                        control={
                            <Switch
                                checked={autoRefresh}
                                onChange={(e) => setAutoRefresh(e.target.checked)}
                            />
                        }
                        label="Auto Refresh"
                    />
                    
                    <Button
                        startIcon={<RefreshIcon />}
                        onClick={loadDashboardData}
                        variant="outlined"
                    >
                        Refresh
                    </Button>
                </Box>
            </Box>

            {/* Real-time Metrics Banner */}
            <Paper sx={{ p: 2, mb: 3, bgcolor: 'primary.main', color: 'white' }}>
                <Grid container spacing={2}>
                    <Grid item xs={6} md={2}>
                        <Box textAlign="center">
                            <Typography variant="h5">
                                {dashboardData?.realTimeMetrics?.activeExecutions || 0}
                            </Typography>
                            <Typography variant="body2">Active</Typography>
                        </Box>
                    </Grid>
                    <Grid item xs={6} md={2}>
                        <Box textAlign="center">
                            <Typography variant="h5">
                                {dashboardData?.realTimeMetrics?.queuedWorkflows || 0}
                            </Typography>
                            <Typography variant="body2">Queued</Typography>
                        </Box>
                    </Grid>
                    <Grid item xs={6} md={2}>
                        <Box textAlign="center">
                            <Typography variant="h5">
                                {dashboardData?.realTimeMetrics?.completedToday || 0}
                            </Typography>
                            <Typography variant="body2">Completed Today</Typography>
                        </Box>
                    </Grid>
                    <Grid item xs={6} md={2}>
                        <Box textAlign="center">
                            <Typography variant="h5">
                                {dashboardData?.realTimeMetrics?.failedToday || 0}
                            </Typography>
                            <Typography variant="body2">Failed Today</Typography>
                        </Box>
                    </Grid>
                    <Grid item xs={12} md={4}>
                        <Box textAlign="center">
                            <Typography variant="h6">
                                System Load: {(dashboardData?.realTimeMetrics?.systemLoad || 0).toFixed(2)}
                            </Typography>
                            <Typography variant="body2">
                                Last updated: {dashboardData?.realTimeMetrics?.lastUpdated ? 
                                    new Date(dashboardData.realTimeMetrics.lastUpdated).toLocaleTimeString() : 
                                    'Unknown'
                                }
                            </Typography>
                        </Box>
                    </Grid>
                </Grid>
            </Paper>

            {/* Dashboard Widgets */}
            <Grid container spacing={3}>
                <Grid item xs={12} md={6}>
                    {renderExecutionStatsWidget()}
                </Grid>
                <Grid item xs={12} md={6}>
                    {renderResourceUsageWidget()}
                </Grid>
                <Grid item xs={12}>
                    {renderPerformanceChartWidget()}
                </Grid>
                <Grid item xs={12} md={8}>
                    {renderActiveWorkflowsWidget()}
                </Grid>
                <Grid item xs={12} md={4}>
                    {renderAlertsWidget()}
                </Grid>
                <Grid item xs={12} md={6}>
                    {renderErrorAnalysisWidget()}
                </Grid>
            </Grid>

            {/* Alert Detail Dialog */}
            <Dialog
                open={alertDialog.open}
                onClose={() => setAlertDialog({ open: false, alert: null })}
                maxWidth="md"
                fullWidth
            >
                <DialogTitle>
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        <Avatar
                            sx={{
                                bgcolor: SEVERITY_COLORS[alertDialog.alert?.severity] || '#757575',
                                mr: 2
                            }}
                        >
                            {alertDialog.alert?.severity === 'critical' ? '!' : 
                             alertDialog.alert?.severity === 'warning' ? '⚠' : 'ℹ'}
                        </Avatar>
                        <Box>
                            <Typography variant="h6">
                                {alertDialog.alert?.title}
                            </Typography>
                            <Chip 
                                label={alertDialog.alert?.severity}
                                size="small"
                                sx={{ 
                                    bgcolor: SEVERITY_COLORS[alertDialog.alert?.severity],
                                    color: 'white'
                                }}
                            />
                        </Box>
                        <IconButton 
                            sx={{ ml: 'auto' }}
                            onClick={() => setAlertDialog({ open: false, alert: null })}
                        >
                            <CloseIcon />
                        </IconButton>
                    </Box>
                </DialogTitle>
                <DialogContent>
                    <Typography variant="body1" paragraph>
                        {alertDialog.alert?.message}
                    </Typography>
                    
                    <Grid container spacing={2}>
                        <Grid item xs={6}>
                            <Typography variant="subtitle2">Created:</Typography>
                            <Typography variant="body2">
                                {alertDialog.alert?.createdAt ? 
                                    new Date(alertDialog.alert.createdAt).toLocaleString() : 
                                    'Unknown'
                                }
                            </Typography>
                        </Grid>
                        <Grid item xs={6}>
                            <Typography variant="subtitle2">Age:</Typography>
                            <Typography variant="body2">
                                {alertDialog.alert?.age ? 
                                    formatDuration(alertDialog.alert.age / 1000) : 
                                    'Unknown'
                                }
                            </Typography>
                        </Grid>
                    </Grid>
                    
                    {alertDialog.alert?.metadata && (
                        <Accordion sx={{ mt: 2 }}>
                            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                                <Typography variant="subtitle2">Technical Details</Typography>
                            </AccordionSummary>
                            <AccordionDetails>
                                <pre style={{ fontSize: '0.875rem', overflow: 'auto' }}>
                                    {JSON.stringify(alertDialog.alert.metadata, null, 2)}
                                </pre>
                            </AccordionDetails>
                        </Accordion>
                    )}
                </DialogContent>
                <DialogActions>
                    <Button 
                        onClick={() => setAlertDialog({ open: false, alert: null })}
                    >
                        Close
                    </Button>
                    {!alertDialog.alert?.isAcknowledged && (
                        <Button
                            onClick={() => handleAcknowledgeAlert(alertDialog.alert.id)}
                            color="warning"
                            variant="outlined"
                        >
                            Acknowledge
                        </Button>
                    )}
                    <Button
                        onClick={() => handleResolveAlert(alertDialog.alert?.id, 'Resolved via dashboard')}
                        color="success"
                        variant="contained"
                    >
                        Resolve
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
}

export default WorkflowMonitoringDashboard;

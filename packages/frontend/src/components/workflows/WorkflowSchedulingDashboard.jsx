// WorkflowSchedulingDashboard.jsx
// Component 5: Advanced Scheduling System - Frontend Dashboard
// Comprehensive scheduling management with cron, event, conditional, and batch scheduling

import React, { useState, useEffect, useCallback } from 'react';
import {
    Box,
    Typography,
    Paper,
    Grid,
    Card,
    CardContent,
    CardActions,
    Button,
    Chip,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    TextField,
    Select,
    MenuItem,
    FormControl,
    InputLabel,
    Switch,
    FormControlLabel,
    Tabs,
    Tab,
    Accordion,
    AccordionSummary,
    AccordionDetails,
    IconButton,
    Tooltip,
    Alert,
    LinearProgress,
    List,
    ListItem,
    ListItemText,
    ListItemSecondaryAction,
    Divider,
    Menu,
    Slider
} from '@mui/material';
import {
    Add as AddIcon,
    Edit as EditIcon,
    Delete as DeleteIcon,
    PlayArrow as PlayIcon,
    Pause as PauseIcon,
    Schedule as ScheduleIcon,
    Event as EventIcon,
    Psychology as ConditionalIcon,
    Batch as BatchIcon,
    CalendarToday as CalendarIcon,
    ExpandMore as ExpandMoreIcon,
    MoreVert as MoreVertIcon,
    Timeline as TimelineIcon,
    TrendingUp as TrendingUpIcon,
    Error as ErrorIcon,
    CheckCircle as SuccessIcon,
    AccessTime as QueueIcon,
    Priority as PriorityIcon
} from '@mui/icons-material';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar } from 'recharts';
import { useSnackbar } from 'notistack';

const SCHEDULE_TYPES = {
    cron: { label: 'Cron Expression', icon: ScheduleIcon, color: '#2196F3' },
    event: { label: 'Event Trigger', icon: EventIcon, color: '#FF9800' },
    conditional: { label: 'Conditional Logic', icon: ConditionalIcon, color: '#9C27B0' },
    batch: { label: 'Batch Processing', icon: BatchIcon, color: '#4CAF50' },
    calendar: { label: 'Calendar Integration', icon: CalendarIcon, color: '#F44336' }
};

const STATUS_COLORS = {
    queued: '#FFC107',
    running: '#2196F3',
    completed: '#4CAF50',
    failed: '#F44336',
    skipped: '#9E9E9E'
};

function TabPanel({ children, value, index, ...other }) {
    return (
        <div role="tabpanel" hidden={value !== index} {...other}>
            {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
        </div>
    );
}

function WorkflowSchedulingDashboard() {
    const { enqueueSnackbar } = useSnackbar();
    const [tabValue, setTabValue] = useState(0);
    const [schedules, setSchedules] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedSchedule, setSelectedSchedule] = useState(null);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [dialogType, setDialogType] = useState('create'); // create, edit, view
    const [queueData, setQueueData] = useState([]);
    const [performanceData, setPerformanceData] = useState([]);
    const [statisticsData, setStatisticsData] = useState({});
    const [anchorEl, setAnchorEl] = useState(null);

    // Form state for schedule creation/editing
    const [scheduleForm, setScheduleForm] = useState({
        workflowId: '',
        scheduleType: 'cron',
        name: '',
        description: '',
        isActive: true,
        priority: 5,
        configuration: {
            cronExpression: '0 9 * * *', // Default: daily at 9 AM
            timezone: 'UTC'
        }
    });

    // Load data on component mount
    useEffect(() => {
        loadSchedules();
        loadQueueData();
        loadPerformanceData();
        loadStatistics();
        
        // Set up real-time updates
        const interval = setInterval(() => {
            loadQueueData();
            loadStatistics();
        }, 10000); // Update every 10 seconds

        return () => clearInterval(interval);
    }, []);

    const loadSchedules = async () => {
        try {
            const response = await fetch('/api/workflows/schedules');
            const data = await response.json();
            
            if (data.success) {
                setSchedules(data.data);
            } else {
                enqueueSnackbar('Failed to load schedules', { variant: 'error' });
            }
        } catch (error) {
            console.error('Error loading schedules:', error);
            enqueueSnackbar('Error loading schedules', { variant: 'error' });
        } finally {
            setLoading(false);
        }
    };

    const loadQueueData = async () => {
        try {
            const response = await fetch('/api/workflows/scheduling/queue-status');
            const data = await response.json();
            
            if (data.success) {
                setQueueData(data.data);
            }
        } catch (error) {
            console.error('Error loading queue data:', error);
        }
    };

    const loadPerformanceData = async () => {
        try {
            const response = await fetch('/api/workflows/scheduling/performance-trends?days=7');
            const data = await response.json();
            
            if (data.success) {
                setPerformanceData(data.data);
            }
        } catch (error) {
            console.error('Error loading performance data:', error);
        }
    };

    const loadStatistics = async () => {
        try {
            const response = await fetch('/api/workflows/scheduling/statistics');
            const data = await response.json();
            
            if (data.success) {
                setStatisticsData(data.data);
            }
        } catch (error) {
            console.error('Error loading statistics:', error);
        }
    };

    const handleCreateSchedule = () => {
        setSelectedSchedule(null);
        setScheduleForm({
            workflowId: '',
            scheduleType: 'cron',
            name: '',
            description: '',
            isActive: true,
            priority: 5,
            configuration: {
                cronExpression: '0 9 * * *',
                timezone: 'UTC'
            }
        });
        setDialogType('create');
        setDialogOpen(true);
    };

    const handleEditSchedule = (schedule) => {
        setSelectedSchedule(schedule);
        setScheduleForm({
            workflowId: schedule.workflow_id,
            scheduleType: schedule.schedule_type,
            name: schedule.name,
            description: schedule.description || '',
            isActive: schedule.is_active,
            priority: schedule.priority,
            configuration: typeof schedule.configuration === 'string' 
                ? JSON.parse(schedule.configuration) 
                : schedule.configuration
        });
        setDialogType('edit');
        setDialogOpen(true);
    };

    const handleSaveSchedule = async () => {
        try {
            const url = dialogType === 'create' 
                ? '/api/workflows/schedules'
                : `/api/workflows/schedules/${selectedSchedule.id}`;
            
            const method = dialogType === 'create' ? 'POST' : 'PUT';
            
            const response = await fetch(url, {
                method,
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(scheduleForm)
            });
            
            const data = await response.json();
            
            if (data.success) {
                enqueueSnackbar(
                    `Schedule ${dialogType === 'create' ? 'created' : 'updated'} successfully`,
                    { variant: 'success' }
                );
                setDialogOpen(false);
                loadSchedules();
            } else {
                enqueueSnackbar(data.error || 'Failed to save schedule', { variant: 'error' });
            }
        } catch (error) {
            console.error('Error saving schedule:', error);
            enqueueSnackbar('Error saving schedule', { variant: 'error' });
        }
    };

    const handleDeleteSchedule = async (schedule) => {
        if (!window.confirm(`Are you sure you want to delete "${schedule.name}"?`)) {
            return;
        }

        try {
            const response = await fetch(`/api/workflows/schedules/${schedule.id}`, {
                method: 'DELETE'
            });
            
            const data = await response.json();
            
            if (data.success) {
                enqueueSnackbar('Schedule deleted successfully', { variant: 'success' });
                loadSchedules();
            } else {
                enqueueSnackbar(data.error || 'Failed to delete schedule', { variant: 'error' });
            }
        } catch (error) {
            console.error('Error deleting schedule:', error);
            enqueueSnackbar('Error deleting schedule', { variant: 'error' });
        }
    };

    const handleToggleSchedule = async (schedule) => {
        try {
            const response = await fetch(`/api/workflows/schedules/${schedule.id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    ...schedule,
                    isActive: !schedule.is_active
                })
            });
            
            const data = await response.json();
            
            if (data.success) {
                enqueueSnackbar(
                    `Schedule ${!schedule.is_active ? 'activated' : 'deactivated'}`,
                    { variant: 'success' }
                );
                loadSchedules();
            } else {
                enqueueSnackbar(data.error || 'Failed to toggle schedule', { variant: 'error' });
            }
        } catch (error) {
            console.error('Error toggling schedule:', error);
            enqueueSnackbar('Error toggling schedule', { variant: 'error' });
        }
    };

    const renderScheduleCard = (schedule) => {
        const TypeIcon = SCHEDULE_TYPES[schedule.schedule_type]?.icon || ScheduleIcon;
        const typeColor = SCHEDULE_TYPES[schedule.schedule_type]?.color || '#2196F3';
        
        return (
            <Card key={schedule.id} sx={{ mb: 2, position: 'relative' }}>
                <CardContent>
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                        <TypeIcon sx={{ color: typeColor, mr: 1 }} />
                        <Typography variant="h6" sx={{ flexGrow: 1 }}>
                            {schedule.name}
                        </Typography>
                        <Chip 
                            label={schedule.is_active ? 'Active' : 'Inactive'}
                            color={schedule.is_active ? 'success' : 'default'}
                            size="small"
                        />
                        <IconButton 
                            size="small" 
                            onClick={(e) => setAnchorEl({ element: e.currentTarget, schedule })}
                        >
                            <MoreVertIcon />
                        </IconButton>
                    </Box>
                    
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                        {schedule.description || 'No description provided'}
                    </Typography>
                    
                    <Grid container spacing={2}>
                        <Grid item xs={6}>
                            <Typography variant="caption" color="text.secondary">
                                Type
                            </Typography>
                            <Typography variant="body2">
                                {SCHEDULE_TYPES[schedule.schedule_type]?.label || schedule.schedule_type}
                            </Typography>
                        </Grid>
                        <Grid item xs={6}>
                            <Typography variant="caption" color="text.secondary">
                                Priority
                            </Typography>
                            <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                <PriorityIcon sx={{ fontSize: 16, mr: 0.5 }} />
                                <Typography variant="body2">{schedule.priority}/10</Typography>
                            </Box>
                        </Grid>
                        <Grid item xs={12}>
                            <Typography variant="caption" color="text.secondary">
                                Configuration
                            </Typography>
                            <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.875rem' }}>
                                {renderConfigurationSummary(schedule.schedule_type, schedule.configuration)}
                            </Typography>
                        </Grid>
                    </Grid>
                </CardContent>
                
                <CardActions>
                    <Button
                        size="small"
                        startIcon={schedule.is_active ? <PauseIcon /> : <PlayIcon />}
                        onClick={() => handleToggleSchedule(schedule)}
                        color={schedule.is_active ? 'warning' : 'primary'}
                    >
                        {schedule.is_active ? 'Deactivate' : 'Activate'}
                    </Button>
                    <Button
                        size="small"
                        startIcon={<EditIcon />}
                        onClick={() => handleEditSchedule(schedule)}
                    >
                        Edit
                    </Button>
                </CardActions>
            </Card>
        );
    };

    const renderConfigurationSummary = (type, config) => {
        const configuration = typeof config === 'string' ? JSON.parse(config) : config;
        
        switch (type) {
            case 'cron':
                return `${configuration.cronExpression} (${configuration.timezone || 'UTC'})`;
            case 'event':
                return `${configuration.eventType} from ${configuration.eventSource}`;
            case 'conditional':
                return `${configuration.conditions?.length || 0} condition(s)`;
            case 'batch':
                return `Batch size: ${configuration.batchSize || 10}, Source: ${configuration.dataSource}`;
            case 'calendar':
                return `${configuration.calendarProvider}: ${configuration.calendarId}`;
            default:
                return 'Custom configuration';
        }
    };

    const renderScheduleDialog = () => {
        return (
            <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="md" fullWidth>
                <DialogTitle>
                    {dialogType === 'create' ? 'Create New Schedule' : 'Edit Schedule'}
                </DialogTitle>
                <DialogContent>
                    <Grid container spacing={3} sx={{ mt: 1 }}>
                        <Grid item xs={12} sm={6}>
                            <TextField
                                fullWidth
                                label="Schedule Name"
                                value={scheduleForm.name}
                                onChange={(e) => setScheduleForm(prev => ({ ...prev, name: e.target.value }))}
                                required
                            />
                        </Grid>
                        <Grid item xs={12} sm={6}>
                            <FormControl fullWidth>
                                <InputLabel>Schedule Type</InputLabel>
                                <Select
                                    value={scheduleForm.scheduleType}
                                    label="Schedule Type"
                                    onChange={(e) => setScheduleForm(prev => ({ 
                                        ...prev, 
                                        scheduleType: e.target.value,
                                        configuration: getDefaultConfiguration(e.target.value)
                                    }))}
                                >
                                    {Object.entries(SCHEDULE_TYPES).map(([key, type]) => (
                                        <MenuItem key={key} value={key}>
                                            <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                                <type.icon sx={{ mr: 1, fontSize: 20 }} />
                                                {type.label}
                                            </Box>
                                        </MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                        </Grid>
                        <Grid item xs={12}>
                            <TextField
                                fullWidth
                                multiline
                                rows={3}
                                label="Description"
                                value={scheduleForm.description}
                                onChange={(e) => setScheduleForm(prev => ({ ...prev, description: e.target.value }))}
                            />
                        </Grid>
                        <Grid item xs={12} sm={6}>
                            <Typography gutterBottom>Priority (1-10)</Typography>
                            <Slider
                                value={scheduleForm.priority}
                                onChange={(e, value) => setScheduleForm(prev => ({ ...prev, priority: value }))}
                                min={1}
                                max={10}
                                marks
                                valueLabelDisplay="on"
                            />
                        </Grid>
                        <Grid item xs={12} sm={6}>
                            <FormControlLabel
                                control={
                                    <Switch
                                        checked={scheduleForm.isActive}
                                        onChange={(e) => setScheduleForm(prev => ({ ...prev, isActive: e.target.checked }))}
                                    />
                                }
                                label="Active"
                            />
                        </Grid>
                        <Grid item xs={12}>
                            <Divider sx={{ my: 2 }} />
                            <Typography variant="h6" gutterBottom>
                                Configuration
                            </Typography>
                            {renderConfigurationForm()}
                        </Grid>
                    </Grid>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
                    <Button onClick={handleSaveSchedule} variant="contained">
                        {dialogType === 'create' ? 'Create' : 'Update'}
                    </Button>
                </DialogActions>
            </Dialog>
        );
    };

    const getDefaultConfiguration = (type) => {
        switch (type) {
            case 'cron':
                return { cronExpression: '0 9 * * *', timezone: 'UTC' };
            case 'event':
                return { eventType: '', eventSource: '', conditions: {}, debounceMs: 0 };
            case 'conditional':
                return { checkInterval: 60000, conditions: [], maxDailyExecutions: 100 };
            case 'batch':
                return { batchSize: 10, processingInterval: 300000, dataSource: '', parallelProcessing: false };
            case 'calendar':
                return { calendarProvider: 'google', calendarId: '', triggerOffset: 0 };
            default:
                return {};
        }
    };

    const renderConfigurationForm = () => {
        switch (scheduleForm.scheduleType) {
            case 'cron':
                return (
                    <Grid container spacing={2}>
                        <Grid item xs={12} sm={8}>
                            <TextField
                                fullWidth
                                label="Cron Expression"
                                value={scheduleForm.configuration.cronExpression || ''}
                                onChange={(e) => setScheduleForm(prev => ({
                                    ...prev,
                                    configuration: { ...prev.configuration, cronExpression: e.target.value }
                                }))}
                                helperText="e.g., '0 9 * * *' for daily at 9 AM"
                            />
                        </Grid>
                        <Grid item xs={12} sm={4}>
                            <TextField
                                fullWidth
                                label="Timezone"
                                value={scheduleForm.configuration.timezone || 'UTC'}
                                onChange={(e) => setScheduleForm(prev => ({
                                    ...prev,
                                    configuration: { ...prev.configuration, timezone: e.target.value }
                                }))}
                            />
                        </Grid>
                    </Grid>
                );

            case 'event':
                return (
                    <Grid container spacing={2}>
                        <Grid item xs={12} sm={6}>
                            <TextField
                                fullWidth
                                label="Event Type"
                                value={scheduleForm.configuration.eventType || ''}
                                onChange={(e) => setScheduleForm(prev => ({
                                    ...prev,
                                    configuration: { ...prev.configuration, eventType: e.target.value }
                                }))}
                            />
                        </Grid>
                        <Grid item xs={12} sm={6}>
                            <TextField
                                fullWidth
                                label="Event Source"
                                value={scheduleForm.configuration.eventSource || ''}
                                onChange={(e) => setScheduleForm(prev => ({
                                    ...prev,
                                    configuration: { ...prev.configuration, eventSource: e.target.value }
                                }))}
                            />
                        </Grid>
                        <Grid item xs={12} sm={6}>
                            <TextField
                                fullWidth
                                type="number"
                                label="Debounce (ms)"
                                value={scheduleForm.configuration.debounceMs || 0}
                                onChange={(e) => setScheduleForm(prev => ({
                                    ...prev,
                                    configuration: { ...prev.configuration, debounceMs: parseInt(e.target.value) }
                                }))}
                            />
                        </Grid>
                        <Grid item xs={12} sm={6}>
                            <TextField
                                fullWidth
                                type="number"
                                label="Max Executions/Hour"
                                value={scheduleForm.configuration.maxExecutionsPerHour || 60}
                                onChange={(e) => setScheduleForm(prev => ({
                                    ...prev,
                                    configuration: { ...prev.configuration, maxExecutionsPerHour: parseInt(e.target.value) }
                                }))}
                            />
                        </Grid>
                    </Grid>
                );

            case 'conditional':
                return (
                    <Grid container spacing={2}>
                        <Grid item xs={12} sm={6}>
                            <TextField
                                fullWidth
                                type="number"
                                label="Check Interval (ms)"
                                value={scheduleForm.configuration.checkInterval || 60000}
                                onChange={(e) => setScheduleForm(prev => ({
                                    ...prev,
                                    configuration: { ...prev.configuration, checkInterval: parseInt(e.target.value) }
                                }))}
                            />
                        </Grid>
                        <Grid item xs={12} sm={6}>
                            <TextField
                                fullWidth
                                type="number"
                                label="Max Daily Executions"
                                value={scheduleForm.configuration.maxDailyExecutions || 100}
                                onChange={(e) => setScheduleForm(prev => ({
                                    ...prev,
                                    configuration: { ...prev.configuration, maxDailyExecutions: parseInt(e.target.value) }
                                }))}
                            />
                        </Grid>
                        <Grid item xs={12}>
                            <Alert severity="info">
                                Conditional rules can be configured after creating the schedule.
                            </Alert>
                        </Grid>
                    </Grid>
                );

            case 'batch':
                return (
                    <Grid container spacing={2}>
                        <Grid item xs={12} sm={6}>
                            <TextField
                                fullWidth
                                label="Data Source"
                                value={scheduleForm.configuration.dataSource || ''}
                                onChange={(e) => setScheduleForm(prev => ({
                                    ...prev,
                                    configuration: { ...prev.configuration, dataSource: e.target.value }
                                }))}
                            />
                        </Grid>
                        <Grid item xs={12} sm={6}>
                            <TextField
                                fullWidth
                                type="number"
                                label="Batch Size"
                                value={scheduleForm.configuration.batchSize || 10}
                                onChange={(e) => setScheduleForm(prev => ({
                                    ...prev,
                                    configuration: { ...prev.configuration, batchSize: parseInt(e.target.value) }
                                }))}
                            />
                        </Grid>
                        <Grid item xs={12} sm={6}>
                            <TextField
                                fullWidth
                                type="number"
                                label="Processing Interval (ms)"
                                value={scheduleForm.configuration.processingInterval || 300000}
                                onChange={(e) => setScheduleForm(prev => ({
                                    ...prev,
                                    configuration: { ...prev.configuration, processingInterval: parseInt(e.target.value) }
                                }))}
                            />
                        </Grid>
                        <Grid item xs={12} sm={6}>
                            <FormControlLabel
                                control={
                                    <Switch
                                        checked={scheduleForm.configuration.parallelProcessing || false}
                                        onChange={(e) => setScheduleForm(prev => ({
                                            ...prev,
                                            configuration: { ...prev.configuration, parallelProcessing: e.target.checked }
                                        }))}
                                    />
                                }
                                label="Parallel Processing"
                            />
                        </Grid>
                    </Grid>
                );

            case 'calendar':
                return (
                    <Grid container spacing={2}>
                        <Grid item xs={12} sm={6}>
                            <FormControl fullWidth>
                                <InputLabel>Calendar Provider</InputLabel>
                                <Select
                                    value={scheduleForm.configuration.calendarProvider || 'google'}
                                    label="Calendar Provider"
                                    onChange={(e) => setScheduleForm(prev => ({
                                        ...prev,
                                        configuration: { ...prev.configuration, calendarProvider: e.target.value }
                                    }))}
                                >
                                    <MenuItem value="google">Google Calendar</MenuItem>
                                    <MenuItem value="outlook">Microsoft Outlook</MenuItem>
                                    <MenuItem value="ical">iCal</MenuItem>
                                </Select>
                            </FormControl>
                        </Grid>
                        <Grid item xs={12} sm={6}>
                            <TextField
                                fullWidth
                                label="Calendar ID"
                                value={scheduleForm.configuration.calendarId || ''}
                                onChange={(e) => setScheduleForm(prev => ({
                                    ...prev,
                                    configuration: { ...prev.configuration, calendarId: e.target.value }
                                }))}
                            />
                        </Grid>
                    </Grid>
                );

            default:
                return (
                    <TextField
                        fullWidth
                        multiline
                        rows={4}
                        label="Configuration (JSON)"
                        value={JSON.stringify(scheduleForm.configuration, null, 2)}
                        onChange={(e) => {
                            try {
                                const config = JSON.parse(e.target.value);
                                setScheduleForm(prev => ({ ...prev, configuration: config }));
                            } catch (err) {
                                // Invalid JSON, don't update
                            }
                        }}
                    />
                );
        }
    };

    const renderStatisticsCards = () => (
        <Grid container spacing={3} sx={{ mb: 4 }}>
            <Grid item xs={12} sm={6} md={3}>
                <Card>
                    <CardContent>
                        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                            <ScheduleIcon color="primary" />
                            <Typography variant="h6" sx={{ ml: 1 }}>
                                Active Schedules
                            </Typography>
                        </Box>
                        <Typography variant="h4">
                            {statisticsData.totalActiveSchedules || 0}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                            {statisticsData.totalSchedules || 0} total schedules
                        </Typography>
                    </CardContent>
                </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
                <Card>
                    <CardContent>
                        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                            <QueueIcon color="warning" />
                            <Typography variant="h6" sx={{ ml: 1 }}>
                                Queue Length
                            </Typography>
                        </Box>
                        <Typography variant="h4">
                            {statisticsData.queueLength || 0}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                            pending executions
                        </Typography>
                    </CardContent>
                </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
                <Card>
                    <CardContent>
                        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                            <SuccessIcon color="success" />
                            <Typography variant="h6" sx={{ ml: 1 }}>
                                Success Rate
                            </Typography>
                        </Box>
                        <Typography variant="h4">
                            {statisticsData.successRate || 0}%
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                            last 24 hours
                        </Typography>
                    </CardContent>
                </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
                <Card>
                    <CardContent>
                        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                            <TrendingUpIcon color="info" />
                            <Typography variant="h6" sx={{ ml: 1 }}>
                                Avg Execution
                            </Typography>
                        </Box>
                        <Typography variant="h4">
                            {statisticsData.avgExecutionTime || 0}s
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                            execution time
                        </Typography>
                    </CardContent>
                </Card>
            </Grid>
        </Grid>
    );

    const renderPerformanceChart = () => (
        <Paper sx={{ p: 3, mb: 4 }}>
            <Typography variant="h6" gutterBottom>
                Schedule Performance Trends
            </Typography>
            <ResponsiveContainer width="100%" height={300}>
                <LineChart data={performanceData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <RechartsTooltip />
                    <Line type="monotone" dataKey="successful" stroke="#4CAF50" name="Successful" />
                    <Line type="monotone" dataKey="failed" stroke="#F44336" name="Failed" />
                    <Line type="monotone" dataKey="total" stroke="#2196F3" name="Total" />
                </LineChart>
            </ResponsiveContainer>
        </Paper>
    );

    const renderQueueStatus = () => (
        <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
                Queue Status
            </Typography>
            <List>
                {queueData.map((item, index) => (
                    <ListItem key={index}>
                        <ListItemText
                            primary={`Workflow: ${item.workflowName}`}
                            secondary={`Priority: ${item.priority} | Queued: ${new Date(item.scheduledFor).toLocaleString()}`}
                        />
                        <ListItemSecondaryAction>
                            <Chip
                                label={item.status}
                                size="small"
                                sx={{ backgroundColor: STATUS_COLORS[item.status] }}
                            />
                        </ListItemSecondaryAction>
                    </ListItem>
                ))}
                {queueData.length === 0 && (
                    <ListItem>
                        <ListItemText primary="No items in queue" />
                    </ListItem>
                )}
            </List>
        </Paper>
    );

    if (loading) {
        return (
            <Box sx={{ p: 3 }}>
                <Typography variant="h4" gutterBottom>Workflow Scheduling</Typography>
                <LinearProgress />
            </Box>
        );
    }

    return (
        <Box sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                <Typography variant="h4">Workflow Scheduling</Typography>
                <Button
                    variant="contained"
                    startIcon={<AddIcon />}
                    onClick={handleCreateSchedule}
                >
                    Create Schedule
                </Button>
            </Box>

            <Tabs value={tabValue} onChange={(e, v) => setTabValue(v)} sx={{ mb: 3 }}>
                <Tab label="Overview" />
                <Tab label="Schedules" />
                <Tab label="Queue" />
                <Tab label="Analytics" />
            </Tabs>

            <TabPanel value={tabValue} index={0}>
                {renderStatisticsCards()}
                {renderPerformanceChart()}
                <Grid container spacing={3}>
                    <Grid item xs={12} md={8}>
                        <Typography variant="h6" gutterBottom>
                            Recent Schedules
                        </Typography>
                        {schedules.slice(0, 3).map(renderScheduleCard)}
                    </Grid>
                    <Grid item xs={12} md={4}>
                        {renderQueueStatus()}
                    </Grid>
                </Grid>
            </TabPanel>

            <TabPanel value={tabValue} index={1}>
                <Grid container spacing={2}>
                    {schedules.map(renderScheduleCard)}
                    {schedules.length === 0 && (
                        <Grid item xs={12}>
                            <Alert severity="info">
                                No schedules configured. Create your first schedule to get started.
                            </Alert>
                        </Grid>
                    )}
                </Grid>
            </TabPanel>

            <TabPanel value={tabValue} index={2}>
                {renderQueueStatus()}
            </TabPanel>

            <TabPanel value={tabValue} index={3}>
                {renderStatisticsCards()}
                {renderPerformanceChart()}
            </TabPanel>

            {renderScheduleDialog()}

            <Menu
                anchorEl={anchorEl?.element}
                open={Boolean(anchorEl)}
                onClose={() => setAnchorEl(null)}
            >
                <MenuItem onClick={() => {
                    handleEditSchedule(anchorEl.schedule);
                    setAnchorEl(null);
                }}>
                    <EditIcon sx={{ mr: 1 }} /> Edit
                </MenuItem>
                <MenuItem onClick={() => {
                    handleToggleSchedule(anchorEl.schedule);
                    setAnchorEl(null);
                }}>
                    {anchorEl?.schedule?.is_active ? <PauseIcon sx={{ mr: 1 }} /> : <PlayIcon sx={{ mr: 1 }} />}
                    {anchorEl?.schedule?.is_active ? 'Deactivate' : 'Activate'}
                </MenuItem>
                <MenuItem onClick={() => {
                    handleDeleteSchedule(anchorEl.schedule);
                    setAnchorEl(null);
                }}>
                    <DeleteIcon sx={{ mr: 1 }} /> Delete
                </MenuItem>
            </Menu>
        </Box>
    );
}

export default WorkflowSchedulingDashboard;

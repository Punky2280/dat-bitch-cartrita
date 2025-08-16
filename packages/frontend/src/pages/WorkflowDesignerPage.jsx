/**
 * Workflow Designer Page
 * Main page component for visual workflow design
 * Part of Task 25: Enterprise Workflow Automation System - Component 1
 */

import React, { useState, useEffect } from 'react';
import {
    Box,
    Container,
    Typography,
    Button,
    Paper,
    Grid,
    Card,
    CardContent,
    CardActions,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    TextField,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    Chip,
    Avatar,
    List,
    ListItem,
    ListItemText,
    ListItemAvatar,
    ListItemSecondaryAction,
    IconButton,
    Tabs,
    Tab,
    Alert,
    CircularProgress,
    Tooltip,
    Menu,
    Breadcrumbs,
    Link
} from '@mui/material';
import {
    Add as AddIcon,
    Edit as EditIcon,
    Delete as DeleteIcon,
    PlayArrow as ExecuteIcon,
    FileCopy as CloneIcon,
    GetApp as ExportIcon,
    Publish as ImportIcon,
    Visibility as PreviewIcon,
    Share as ShareIcon,
    AccountTree as WorkflowIcon,
    Template as TemplateIcon,
    Dashboard as DashboardIcon,
    Settings as SettingsIcon,
    MoreVert as MoreIcon,
    Search as SearchIcon,
    FilterList as FilterIcon
} from '@mui/icons-material';
import { useNavigate, useParams } from 'react-router-dom';
import { useApi } from '../hooks/useApi';
import { useAuth } from '../context/AuthContext';
import WorkflowDesigner from '../components/WorkflowDesigner';

const WorkflowDesignerPage = () => {
    const { workflowId } = useParams();
    const navigate = useNavigate();
    const { user } = useAuth();
    const { request } = useApi();

    // State management
    const [workflows, setWorkflows] = useState([]);
    const [templates, setTemplates] = useState([]);
    const [currentWorkflow, setCurrentWorkflow] = useState(null);
    const [loading, setLoading] = useState(false);
    const [createDialogOpen, setCreateDialogOpen] = useState(false);
    const [importDialogOpen, setImportDialogOpen] = useState(false);
    const [shareDialogOpen, setShareDialogOpen] = useState(false);
    const [selectedWorkflow, setSelectedWorkflow] = useState(null);
    const [tabValue, setTabValue] = useState(workflowId ? 'designer' : 'workflows');
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [categoryFilter, setCategoryFilter] = useState('all');
    const [anchorEl, setAnchorEl] = useState(null);
    const [actionWorkflow, setActionWorkflow] = useState(null);

    // Form states
    const [newWorkflowName, setNewWorkflowName] = useState('');
    const [newWorkflowDescription, setNewWorkflowDescription] = useState('');
    const [newWorkflowCategory, setNewWorkflowCategory] = useState('general');
    const [importData, setImportData] = useState('');
    const [shareSettings, setShareSettings] = useState({
        editors: [],
        viewers: [],
        public: false
    });

    // Load data on component mount
    useEffect(() => {
        if (!workflowId) {
            loadWorkflows();
            loadTemplates();
        } else {
            loadWorkflow(workflowId);
        }
    }, [workflowId]);

    // Load workflows list
    const loadWorkflows = async () => {
        try {
            setLoading(true);
            const params = new URLSearchParams({
                page: 1,
                limit: 50,
                ...(statusFilter !== 'all' && { status: statusFilter }),
                ...(categoryFilter !== 'all' && { category: categoryFilter }),
                ...(searchQuery && { search: searchQuery })
            });

            const response = await request(`/api/workflows?${params}`);
            setWorkflows(response.workflows || []);
        } catch (error) {
            console.error('Failed to load workflows:', error);
        } finally {
            setLoading(false);
        }
    };

    // Load workflow templates
    const loadTemplates = async () => {
        try {
            const response = await request('/api/workflows/templates');
            setTemplates(response.templates || []);
        } catch (error) {
            console.error('Failed to load templates:', error);
        }
    };

    // Load specific workflow
    const loadWorkflow = async (id) => {
        try {
            setLoading(true);
            const response = await request(`/api/workflows/${id}`);
            setCurrentWorkflow(response.workflow);
        } catch (error) {
            console.error('Failed to load workflow:', error);
            navigate('/workflows');
        } finally {
            setLoading(false);
        }
    };

    // Create new workflow
    const createWorkflow = async (fromTemplate = null) => {
        try {
            setLoading(true);
            
            const workflowData = {
                name: newWorkflowName,
                description: newWorkflowDescription,
                category: newWorkflowCategory,
                ...(fromTemplate && {
                    nodes: fromTemplate.definition?.nodes || [],
                    connections: fromTemplate.definition?.connections || [],
                    variables: fromTemplate.definition?.variables || {}
                })
            };

            const response = await request('/api/workflows', 'POST', workflowData);
            
            if (response.success) {
                // Navigate to designer for the new workflow
                navigate(`/workflows/designer/${response.workflow.id}`);
            }
        } catch (error) {
            console.error('Failed to create workflow:', error);
        } finally {
            setLoading(false);
            setCreateDialogOpen(false);
            resetCreateForm();
        }
    };

    // Clone workflow
    const cloneWorkflow = async (workflow) => {
        try {
            setLoading(true);
            const response = await request(
                `/api/workflows/${workflow.id}/designer/clone`, 
                'POST', 
                { name: `${workflow.name} (Copy)` }
            );
            
            if (response.success) {
                loadWorkflows();
            }
        } catch (error) {
            console.error('Failed to clone workflow:', error);
        } finally {
            setLoading(false);
        }
    };

    // Delete workflow
    const deleteWorkflow = async (workflow) => {
        if (window.confirm(`Are you sure you want to delete "${workflow.name}"?`)) {
            try {
                setLoading(true);
                await request(`/api/workflows/${workflow.id}`, 'DELETE');
                loadWorkflows();
            } catch (error) {
                console.error('Failed to delete workflow:', error);
            } finally {
                setLoading(false);
            }
        }
    };

    // Execute workflow
    const executeWorkflow = async (workflow) => {
        try {
            setLoading(true);
            const response = await request(`/api/workflows/${workflow.id}/execute`, 'POST');
            
            if (response.success) {
                // Navigate to execution monitoring
                navigate(`/workflows/executions/${response.executionId}`);
            }
        } catch (error) {
            console.error('Failed to execute workflow:', error);
        } finally {
            setLoading(false);
        }
    };

    // Export workflow
    const exportWorkflow = async (workflow) => {
        try {
            const response = await request(`/api/workflows/${workflow.id}/designer/export`);
            
            // Download file
            const blob = new Blob([JSON.stringify(response, null, 2)], { 
                type: 'application/json' 
            });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${workflow.name}_workflow.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch (error) {
            console.error('Failed to export workflow:', error);
        }
    };

    // Import workflow
    const importWorkflow = async () => {
        try {
            setLoading(true);
            const workflowData = JSON.parse(importData);
            
            const response = await request('/api/workflows/designer/import', 'POST', {
                workflowData,
                name: workflowData.name || 'Imported Workflow'
            });
            
            if (response.success) {
                loadWorkflows();
                setImportDialogOpen(false);
                setImportData('');
            }
        } catch (error) {
            console.error('Failed to import workflow:', error);
            alert('Failed to import workflow. Please check the file format.');
        } finally {
            setLoading(false);
        }
    };

    // Update sharing settings
    const updateSharing = async () => {
        try {
            setLoading(true);
            await request(
                `/api/workflows/${selectedWorkflow.id}/designer/permissions`, 
                'PUT', 
                shareSettings
            );
            setShareDialogOpen(false);
            loadWorkflows();
        } catch (error) {
            console.error('Failed to update sharing settings:', error);
        } finally {
            setLoading(false);
        }
    };

    // Reset create form
    const resetCreateForm = () => {
        setNewWorkflowName('');
        setNewWorkflowDescription('');
        setNewWorkflowCategory('general');
    };

    // Handle menu actions
    const handleMenuClick = (event, workflow) => {
        setAnchorEl(event.currentTarget);
        setActionWorkflow(workflow);
    };

    const handleMenuClose = () => {
        setAnchorEl(null);
        setActionWorkflow(null);
    };

    // Filter workflows based on search and filters
    const filteredWorkflows = workflows.filter(workflow => {
        const matchesSearch = !searchQuery || 
            workflow.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            workflow.description?.toLowerCase().includes(searchQuery.toLowerCase());
        
        const matchesStatus = statusFilter === 'all' || workflow.status === statusFilter;
        const matchesCategory = categoryFilter === 'all' || 
            (workflow.metadata && JSON.parse(workflow.metadata).category === categoryFilter);
        
        return matchesSearch && matchesStatus && matchesCategory;
    });

    // Get status color
    const getStatusColor = (status) => {
        switch (status) {
            case 'active': return 'success';
            case 'draft': return 'warning';
            case 'inactive': return 'error';
            default: return 'default';
        }
    };

    // Get category icon
    const getCategoryIcon = (category) => {
        switch (category) {
            case 'data-processing': return <DashboardIcon />;
            case 'integration': return <SettingsIcon />;
            case 'notification': return <ShareIcon />;
            default: return <WorkflowIcon />;
        }
    };

    // If we're in designer mode, show the designer
    if (workflowId) {
        return (
            <Box sx={{ height: '100vh' }}>
                <WorkflowDesigner
                    workflowId={workflowId}
                    onSave={(workflow) => {
                        setCurrentWorkflow(workflow);
                    }}
                    onExecute={() => {
                        executeWorkflow(currentWorkflow);
                    }}
                />
            </Box>
        );
    }

    return (
        <Container maxWidth="xl" sx={{ py: 4 }}>
            {/* Header */}
            <Box sx={{ mb: 4 }}>
                <Breadcrumbs sx={{ mb: 2 }}>
                    <Link color="inherit" href="/dashboard">
                        Dashboard
                    </Link>
                    <Typography color="text.primary">Workflow Designer</Typography>
                </Breadcrumbs>
                
                <Box display="flex" justifyContent="space-between" alignItems="center">
                    <Box>
                        <Typography variant="h4" component="h1" gutterBottom>
                            Workflow Designer
                        </Typography>
                        <Typography variant="subtitle1" color="text.secondary">
                            Create, manage, and execute visual workflows
                        </Typography>
                    </Box>
                    
                    <Box display="flex" gap={1}>
                        <Button
                            variant="outlined"
                            startIcon={<ImportIcon />}
                            onClick={() => setImportDialogOpen(true)}
                        >
                            Import
                        </Button>
                        <Button
                            variant="contained"
                            startIcon={<AddIcon />}
                            onClick={() => setCreateDialogOpen(true)}
                        >
                            Create Workflow
                        </Button>
                    </Box>
                </Box>
            </Box>

            {/* Tabs */}
            <Paper sx={{ mb: 3 }}>
                <Tabs value={tabValue} onChange={(e, v) => setTabValue(v)}>
                    <Tab icon={<WorkflowIcon />} label="My Workflows" value="workflows" />
                    <Tab icon={<TemplateIcon />} label="Templates" value="templates" />
                </Tabs>
            </Paper>

            {/* Workflows Tab */}
            {tabValue === 'workflows' && (
                <Box>
                    {/* Search and Filters */}
                    <Paper sx={{ p: 2, mb: 3 }}>
                        <Grid container spacing={2} alignItems="center">
                            <Grid item xs={12} md={4}>
                                <TextField
                                    fullWidth
                                    placeholder="Search workflows..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    InputProps={{
                                        startAdornment: <SearchIcon sx={{ mr: 1, color: 'text.secondary' }} />
                                    }}
                                />
                            </Grid>
                            <Grid item xs={6} md={2}>
                                <FormControl fullWidth size="small">
                                    <InputLabel>Status</InputLabel>
                                    <Select
                                        value={statusFilter}
                                        onChange={(e) => setStatusFilter(e.target.value)}
                                        label="Status"
                                    >
                                        <MenuItem value="all">All</MenuItem>
                                        <MenuItem value="draft">Draft</MenuItem>
                                        <MenuItem value="active">Active</MenuItem>
                                        <MenuItem value="inactive">Inactive</MenuItem>
                                    </Select>
                                </FormControl>
                            </Grid>
                            <Grid item xs={6} md={2}>
                                <FormControl fullWidth size="small">
                                    <InputLabel>Category</InputLabel>
                                    <Select
                                        value={categoryFilter}
                                        onChange={(e) => setCategoryFilter(e.target.value)}
                                        label="Category"
                                    >
                                        <MenuItem value="all">All</MenuItem>
                                        <MenuItem value="data-processing">Data Processing</MenuItem>
                                        <MenuItem value="integration">Integration</MenuItem>
                                        <MenuItem value="notification">Notification</MenuItem>
                                        <MenuItem value="general">General</MenuItem>
                                    </Select>
                                </FormControl>
                            </Grid>
                            <Grid item xs={12} md={4}>
                                <Button
                                    startIcon={<FilterIcon />}
                                    onClick={loadWorkflows}
                                    disabled={loading}
                                >
                                    Apply Filters
                                </Button>
                            </Grid>
                        </Grid>
                    </Paper>

                    {/* Workflows Grid */}
                    {loading ? (
                        <Box display="flex" justifyContent="center" p={4}>
                            <CircularProgress />
                        </Box>
                    ) : (
                        <Grid container spacing={3}>
                            {filteredWorkflows.map((workflow) => (
                                <Grid item xs={12} sm={6} md={4} key={workflow.id}>
                                    <Card>
                                        <CardContent>
                                            <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={2}>
                                                <Typography variant="h6" component="h2" noWrap>
                                                    {workflow.name}
                                                </Typography>
                                                <IconButton
                                                    size="small"
                                                    onClick={(e) => handleMenuClick(e, workflow)}
                                                >
                                                    <MoreIcon />
                                                </IconButton>
                                            </Box>
                                            
                                            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                                                {workflow.description || 'No description'}
                                            </Typography>
                                            
                                            <Box display="flex" gap={1} mb={2}>
                                                <Chip 
                                                    size="small" 
                                                    label={workflow.status} 
                                                    color={getStatusColor(workflow.status)}
                                                />
                                                {workflow.metadata && JSON.parse(workflow.metadata).category && (
                                                    <Chip 
                                                        size="small" 
                                                        label={JSON.parse(workflow.metadata).category}
                                                        variant="outlined"
                                                    />
                                                )}
                                            </Box>
                                            
                                            <Typography variant="caption" color="text.secondary">
                                                Updated: {new Date(workflow.updated_at).toLocaleDateString()}
                                            </Typography>
                                        </CardContent>
                                        
                                        <CardActions>
                                            <Button
                                                size="small"
                                                startIcon={<EditIcon />}
                                                onClick={() => navigate(`/workflows/designer/${workflow.id}`)}
                                            >
                                                Design
                                            </Button>
                                            <Button
                                                size="small"
                                                startIcon={<ExecuteIcon />}
                                                onClick={() => executeWorkflow(workflow)}
                                                disabled={workflow.status !== 'active'}
                                            >
                                                Execute
                                            </Button>
                                        </CardActions>
                                    </Card>
                                </Grid>
                            ))}
                        </Grid>
                    )}

                    {filteredWorkflows.length === 0 && !loading && (
                        <Paper sx={{ p: 4, textAlign: 'center' }}>
                            <WorkflowIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
                            <Typography variant="h6" gutterBottom>
                                No workflows found
                            </Typography>
                            <Typography variant="body2" color="text.secondary" gutterBottom>
                                Create your first workflow to get started with automation
                            </Typography>
                            <Button
                                variant="contained"
                                startIcon={<AddIcon />}
                                onClick={() => setCreateDialogOpen(true)}
                                sx={{ mt: 2 }}
                            >
                                Create Workflow
                            </Button>
                        </Paper>
                    )}
                </Box>
            )}

            {/* Templates Tab */}
            {tabValue === 'templates' && (
                <Grid container spacing={3}>
                    {templates.map((template) => (
                        <Grid item xs={12} sm={6} md={4} key={template.id}>
                            <Card>
                                <CardContent>
                                    <Box display="flex" alignItems="center" mb={2}>
                                        <Avatar sx={{ mr: 2, bgcolor: 'primary.main' }}>
                                            {getCategoryIcon(template.category)}
                                        </Avatar>
                                        <Box>
                                            <Typography variant="h6">{template.name}</Typography>
                                            <Chip 
                                                size="small" 
                                                label={template.difficulty_level} 
                                                color={
                                                    template.difficulty_level === 'beginner' ? 'success' :
                                                    template.difficulty_level === 'intermediate' ? 'warning' : 'error'
                                                }
                                            />
                                        </Box>
                                    </Box>
                                    
                                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                                        {template.description}
                                    </Typography>
                                    
                                    <Box display="flex" flexWrap="wrap" gap={0.5} mb={2}>
                                        {template.tags.slice(0, 3).map((tag) => (
                                            <Chip key={tag} size="small" label={tag} variant="outlined" />
                                        ))}
                                    </Box>
                                    
                                    {template.estimated_time && (
                                        <Typography variant="caption" color="text.secondary">
                                            ~{template.estimated_time} minutes
                                        </Typography>
                                    )}
                                </CardContent>
                                
                                <CardActions>
                                    <Button
                                        size="small"
                                        onClick={() => {
                                            setNewWorkflowName(`${template.name} Workflow`);
                                            setNewWorkflowDescription(template.description);
                                            setNewWorkflowCategory(template.category);
                                            setCreateDialogOpen(true);
                                        }}
                                    >
                                        Use Template
                                    </Button>
                                    <Button size="small" startIcon={<PreviewIcon />}>
                                        Preview
                                    </Button>
                                </CardActions>
                            </Card>
                        </Grid>
                    ))}
                </Grid>
            )}

            {/* Action Menu */}
            <Menu
                anchorEl={anchorEl}
                open={Boolean(anchorEl)}
                onClose={handleMenuClose}
            >
                <MenuItem onClick={() => {
                    navigate(`/workflows/designer/${actionWorkflow.id}`);
                    handleMenuClose();
                }}>
                    <EditIcon sx={{ mr: 1 }} /> Edit
                </MenuItem>
                <MenuItem onClick={() => {
                    cloneWorkflow(actionWorkflow);
                    handleMenuClose();
                }}>
                    <CloneIcon sx={{ mr: 1 }} /> Clone
                </MenuItem>
                <MenuItem onClick={() => {
                    exportWorkflow(actionWorkflow);
                    handleMenuClose();
                }}>
                    <ExportIcon sx={{ mr: 1 }} /> Export
                </MenuItem>
                <MenuItem onClick={() => {
                    setSelectedWorkflow(actionWorkflow);
                    setShareDialogOpen(true);
                    handleMenuClose();
                }}>
                    <ShareIcon sx={{ mr: 1 }} /> Share
                </MenuItem>
                <MenuItem 
                    onClick={() => {
                        deleteWorkflow(actionWorkflow);
                        handleMenuClose();
                    }}
                    sx={{ color: 'error.main' }}
                >
                    <DeleteIcon sx={{ mr: 1 }} /> Delete
                </MenuItem>
            </Menu>

            {/* Create Workflow Dialog */}
            <Dialog open={createDialogOpen} onClose={() => setCreateDialogOpen(false)} maxWidth="sm" fullWidth>
                <DialogTitle>Create New Workflow</DialogTitle>
                <DialogContent>
                    <TextField
                        autoFocus
                        margin="dense"
                        label="Workflow Name"
                        fullWidth
                        variant="outlined"
                        value={newWorkflowName}
                        onChange={(e) => setNewWorkflowName(e.target.value)}
                        sx={{ mb: 2 }}
                    />
                    <TextField
                        margin="dense"
                        label="Description"
                        fullWidth
                        multiline
                        rows={3}
                        variant="outlined"
                        value={newWorkflowDescription}
                        onChange={(e) => setNewWorkflowDescription(e.target.value)}
                        sx={{ mb: 2 }}
                    />
                    <FormControl fullWidth>
                        <InputLabel>Category</InputLabel>
                        <Select
                            value={newWorkflowCategory}
                            onChange={(e) => setNewWorkflowCategory(e.target.value)}
                            label="Category"
                        >
                            <MenuItem value="general">General</MenuItem>
                            <MenuItem value="data-processing">Data Processing</MenuItem>
                            <MenuItem value="integration">Integration</MenuItem>
                            <MenuItem value="notification">Notification</MenuItem>
                        </Select>
                    </FormControl>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setCreateDialogOpen(false)}>Cancel</Button>
                    <Button 
                        onClick={() => createWorkflow()}
                        variant="contained"
                        disabled={!newWorkflowName.trim() || loading}
                    >
                        Create
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Import Workflow Dialog */}
            <Dialog open={importDialogOpen} onClose={() => setImportDialogOpen(false)} maxWidth="md" fullWidth>
                <DialogTitle>Import Workflow</DialogTitle>
                <DialogContent>
                    <Typography variant="body2" gutterBottom>
                        Paste the JSON content of an exported workflow:
                    </Typography>
                    <TextField
                        fullWidth
                        multiline
                        rows={10}
                        variant="outlined"
                        value={importData}
                        onChange={(e) => setImportData(e.target.value)}
                        placeholder="Paste workflow JSON here..."
                    />
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setImportDialogOpen(false)}>Cancel</Button>
                    <Button 
                        onClick={importWorkflow}
                        variant="contained"
                        disabled={!importData.trim() || loading}
                    >
                        Import
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Share Dialog */}
            <Dialog open={shareDialogOpen} onClose={() => setShareDialogOpen(false)} maxWidth="sm" fullWidth>
                <DialogTitle>Share Workflow</DialogTitle>
                <DialogContent>
                    <Typography variant="body2" gutterBottom>
                        Configure sharing permissions for "{selectedWorkflow?.name}"
                    </Typography>
                    {/* Add sharing configuration UI here */}
                    <Alert severity="info" sx={{ mt: 2 }}>
                        Sharing functionality will be enhanced in the next iteration.
                    </Alert>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setShareDialogOpen(false)}>Cancel</Button>
                    <Button onClick={updateSharing} variant="contained">
                        Save
                    </Button>
                </DialogActions>
            </Dialog>
        </Container>
    );
};

export default WorkflowDesignerPage;

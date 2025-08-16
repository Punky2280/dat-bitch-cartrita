import React, { useState, useEffect } from 'react';
import {
    Box,
    Card,
    CardContent,
    CardMedia,
    Typography,
    Grid,
    Chip,
    Button,
    TextField,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    Tab,
    Tabs,
    Rating,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    IconButton,
    Tooltip,
    Alert,
    Skeleton,
    Badge,
    Divider,
    Avatar,
    List,
    ListItem,
    ListItemText,
    ListItemAvatar,
    CircularProgress,
    Paper
} from '@mui/material';
import {
    Search as SearchIcon,
    FilterList as FilterIcon,
    Visibility as PreviewIcon,
    PlayArrow as CreateIcon,
    Star as StarIcon,
    StarBorder as StarBorderIcon,
    Download as DownloadIcon,
    Schedule as ScheduleIcon,
    Group as GroupIcon,
    TrendingUp as TrendingIcon,
    Category as CategoryIcon,
    Close as CloseIcon,
    AutoAwesome as FeaturedIcon,
    Code as CodeIcon,
    Settings as SettingsIcon,
    Assessment as MetricsIcon,
    ThumbUp as LikeIcon,
    History as RecentIcon,
    Lightbulb as SuggestionsIcon,
    Notifications as NotificationsIcon,
    Inventory as InventoryIcon,
    Article as ArticleIcon,
    AccountBalance as AccountBalanceIcon,
    People as PeopleIcon,
    Campaign as CampaignIcon,
    Support as SupportIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useSnackbar } from 'notistack';
import { api } from '../../services/api';

// Template category icons mapping
const CATEGORY_ICONS = {
    data_processing: <CodeIcon />,
    approval_workflows: <StarIcon />,
    notifications: <NotificationsIcon />,
    reporting: <MetricsIcon />,
    customer_onboarding: <GroupIcon />,
    inventory_management: <InventoryIcon />,
    lead_qualification: <TrendingIcon />,
    content_management: <ArticleIcon />,
    financial_processing: <AccountBalanceIcon />,
    hr_automation: <PeopleIcon />,
    marketing_automation: <CampaignIcon />,
    support_automation: <SupportIcon />
};

// Complexity level colors
const COMPLEXITY_COLORS = {
    beginner: '#4caf50',
    intermediate: '#ff9800', 
    advanced: '#f44336',
    expert: '#9c27b0'
};

function WorkflowTemplateLibrary({ onCreateFromTemplate, showCreateButton = true }) {
    const [templates, setTemplates] = useState([]);
    const [categories, setCategories] = useState([]);
    const [complexityLevels, setComplexityLevels] = useState([]);
    const [loading, setLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('');
    const [selectedComplexity, setSelectedComplexity] = useState('');
    const [currentTab, setCurrentTab] = useState(0); // 0: All, 1: Featured, 2: Recent, 3: My Templates
    const [previewDialog, setPreviewDialog] = useState({ open: false, template: null });
    const [createDialog, setCreateDialog] = useState({ open: false, template: null });
    const [ratingDialog, setRatingDialog] = useState({ open: false, template: null });
    const [templateStats, setTemplateStats] = useState({});
    const [pagination, setPagination] = useState({ limit: 20, offset: 0, total: 0 });
    const [sortBy, setSortBy] = useState('popularity');
    const [filters, setFilters] = useState({
        includeCustom: true,
        includePublic: true,
        minRating: 0
    });

    const navigate = useNavigate();
    const { enqueueSnackbar } = useSnackbar();

    // Load initial data
    useEffect(() => {
        loadTemplateCategories();
        loadTemplates();
    }, []);

    // Reload templates when filters change
    useEffect(() => {
        loadTemplates();
    }, [searchQuery, selectedCategory, selectedComplexity, currentTab, sortBy, filters]);

    const loadTemplateCategories = async () => {
        try {
            const response = await api.get('/workflows/templates/categories');
            if (response.data.success) {
                setCategories(response.data.categories);
                setComplexityLevels(response.data.complexityLevels);
            }
        } catch (error) {
            console.error('Error loading template categories:', error);
            enqueueSnackbar('Failed to load template categories', { variant: 'error' });
        }
    };

    const loadTemplates = async () => {
        setLoading(true);
        try {
            let endpoint = '/workflows/templates';
            let params = {
                limit: pagination.limit,
                offset: pagination.offset,
                search: searchQuery || undefined,
                category: selectedCategory || undefined,
                complexity: selectedComplexity || undefined,
                includeCustom: filters.includeCustom,
                includePublic: filters.includePublic
            };

            // Handle different tabs
            if (currentTab === 1) {
                endpoint = '/workflows/templates/featured';
                params = { limit: 12 };
            } else if (currentTab === 2) {
                // Recent templates - filter by created date
                params.sort = 'newest';
            } else if (currentTab === 3) {
                // My templates only
                params.includePublic = false;
            }

            const response = await api.get(endpoint, { params });
            
            if (response.data.success) {
                setTemplates(response.data.templates);
                setPagination(prev => ({
                    ...prev,
                    total: response.data.total || response.data.templates.length
                }));

                // Load stats for visible templates
                loadTemplateStats(response.data.templates);
            }
        } catch (error) {
            console.error('Error loading templates:', error);
            enqueueSnackbar('Failed to load templates', { variant: 'error' });
        } finally {
            setLoading(false);
        }
    };

    const loadTemplateStats = async (templateList) => {
        try {
            const statsPromises = templateList.slice(0, 10).map(async (template) => {
                try {
                    const response = await api.get(`/workflows/templates/${template.id}/stats`);
                    return {
                        id: template.id,
                        stats: response.data.success ? response.data.stats : {}
                    };
                } catch (error) {
                    return { id: template.id, stats: {} };
                }
            });

            const statsResults = await Promise.all(statsPromises);
            const statsMap = {};
            statsResults.forEach(result => {
                statsMap[result.id] = result.stats;
            });
            setTemplateStats(statsMap);
        } catch (error) {
            console.error('Error loading template stats:', error);
        }
    };

    const handleTemplatePreview = async (template) => {
        try {
            const response = await api.post(`/workflows/templates/${template.id}/preview`);
            if (response.data.success) {
                setPreviewDialog({
                    open: true,
                    template: {
                        ...template,
                        ...response.data.template
                    }
                });
            }
        } catch (error) {
            console.error('Error previewing template:', error);
            enqueueSnackbar('Failed to preview template', { variant: 'error' });
        }
    };

    const handleCreateFromTemplate = (template) => {
        setCreateDialog({ open: true, template });
    };

    const handleConfirmCreate = async () => {
        const { template } = createDialog;
        const formData = new FormData(document.getElementById('create-workflow-form'));
        
        try {
            const response = await api.post(`/workflows/templates/${template.id}/create`, {
                name: formData.get('name'),
                description: formData.get('description'),
                category: formData.get('category') || template.category,
                customizations: {},
                settings: {}
            });

            if (response.data.success) {
                enqueueSnackbar('Workflow created successfully!', { variant: 'success' });
                setCreateDialog({ open: false, template: null });
                
                if (onCreateFromTemplate) {
                    onCreateFromTemplate(response.data.workflow);
                } else {
                    navigate(`/workflows/${response.data.workflow.id}/edit`);
                }
            }
        } catch (error) {
            console.error('Error creating workflow from template:', error);
            enqueueSnackbar('Failed to create workflow', { variant: 'error' });
        }
    };

    const handleRateTemplate = async (templateId, rating, review) => {
        try {
            const response = await api.post(`/workflows/templates/${templateId}/rate`, {
                rating,
                review
            });

            if (response.data.success) {
                enqueueSnackbar('Rating submitted successfully!', { variant: 'success' });
                setRatingDialog({ open: false, template: null });
                loadTemplates(); // Refresh to show new rating
            }
        } catch (error) {
            console.error('Error rating template:', error);
            enqueueSnackbar('Failed to submit rating', { variant: 'error' });
        }
    };

    const getComplexityChipColor = (complexity) => {
        return COMPLEXITY_COLORS[complexity] || '#757575';
    };

    const formatDuration = (minutes) => {
        if (!minutes) return 'Unknown';
        if (minutes < 60) return `${minutes}m`;
        const hours = Math.floor(minutes / 60);
        const remainingMinutes = minutes % 60;
        return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
    };

    const renderTemplateCard = (template) => {
        const stats = templateStats[template.id] || {};
        
        return (
            <Card 
                key={template.id}
                sx={{ 
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    transition: 'transform 0.2s, box-shadow 0.2s',
                    '&:hover': {
                        transform: 'translateY(-2px)',
                        boxShadow: (theme) => theme.shadows[8]
                    }
                }}
            >
                <CardMedia
                    sx={{
                        height: 120,
                        background: `linear-gradient(135deg, ${getComplexityChipColor(template.complexity)}20, ${getComplexityChipColor(template.complexity)}40)`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        position: 'relative'
                    }}
                >
                    <Avatar sx={{ 
                        width: 56, 
                        height: 56, 
                        bgcolor: getComplexityChipColor(template.complexity),
                        fontSize: '24px'
                    }}>
                        {CATEGORY_ICONS[template.category] || <CategoryIcon />}
                    </Avatar>
                    
                    {template.isFeatured && (
                        <Tooltip title="Featured Template">
                            <FeaturedIcon 
                                sx={{
                                    position: 'absolute',
                                    top: 8,
                                    right: 8,
                                    color: '#ffd700'
                                }}
                            />
                        </Tooltip>
                    )}
                </CardMedia>

                <CardContent sx={{ flexGrow: 1, p: 2 }}>
                    <Typography variant="h6" component="h2" gutterBottom noWrap>
                        {template.name}
                    </Typography>
                    
                    <Typography 
                        variant="body2" 
                        color="text.secondary" 
                        sx={{ 
                            mb: 2,
                            height: '40px',
                            overflow: 'hidden',
                            display: '-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical'
                        }}
                    >
                        {template.description}
                    </Typography>

                    <Box sx={{ mb: 2 }}>
                        <Chip 
                            label={template.complexity}
                            size="small"
                            sx={{ 
                                bgcolor: getComplexityChipColor(template.complexity),
                                color: 'white',
                                mr: 1,
                                mb: 1
                            }}
                        />
                        {template.category && (
                            <Chip 
                                label={template.category.replace('_', ' ')}
                                size="small"
                                variant="outlined"
                                sx={{ mr: 1, mb: 1 }}
                            />
                        )}
                    </Box>

                    {template.tags && template.tags.length > 0 && (
                        <Box sx={{ mb: 2 }}>
                            {template.tags.slice(0, 3).map(tag => (
                                <Chip 
                                    key={tag}
                                    label={tag}
                                    size="small"
                                    variant="outlined"
                                    sx={{ mr: 0.5, mb: 0.5, fontSize: '0.7rem' }}
                                />
                            ))}
                            {template.tags.length > 3 && (
                                <Typography variant="caption" color="text.secondary">
                                    +{template.tags.length - 3} more
                                </Typography>
                            )}
                        </Box>
                    )}

                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                        <Rating 
                            value={parseFloat(template.rating) || 0}
                            precision={0.1}
                            size="small"
                            readOnly
                            sx={{ mr: 1 }}
                        />
                        <Typography variant="caption" color="text.secondary">
                            ({stats.reviewCount || 0} reviews)
                        </Typography>
                    </Box>

                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center' }}>
                            <GroupIcon sx={{ fontSize: 16, mr: 0.5, color: 'text.secondary' }} />
                            <Typography variant="caption" color="text.secondary">
                                {stats.usageCount || 0} uses
                            </Typography>
                        </Box>
                        <Box sx={{ display: 'flex', alignItems: 'center' }}>
                            <ScheduleIcon sx={{ fontSize: 16, mr: 0.5, color: 'text.secondary' }} />
                            <Typography variant="caption" color="text.secondary">
                                {formatDuration(template.estimatedDuration)}
                            </Typography>
                        </Box>
                    </Box>
                </CardContent>

                <Box sx={{ p: 2, pt: 0 }}>
                    <Grid container spacing={1}>
                        <Grid item xs={4}>
                            <Button
                                size="small"
                                startIcon={<PreviewIcon />}
                                onClick={() => handleTemplatePreview(template)}
                                fullWidth
                                variant="outlined"
                            >
                                Preview
                            </Button>
                        </Grid>
                        {showCreateButton && (
                            <Grid item xs={8}>
                                <Button
                                    size="small"
                                    startIcon={<CreateIcon />}
                                    onClick={() => handleCreateFromTemplate(template)}
                                    fullWidth
                                    variant="contained"
                                >
                                    Use Template
                                </Button>
                            </Grid>
                        )}
                        {!showCreateButton && (
                            <Grid item xs={4}>
                                <Button
                                    size="small"
                                    startIcon={<StarIcon />}
                                    onClick={() => setRatingDialog({ open: true, template })}
                                    fullWidth
                                    variant="outlined"
                                >
                                    Rate
                                </Button>
                            </Grid>
                        )}
                        {!showCreateButton && (
                            <Grid item xs={4}>
                                <Button
                                    size="small"
                                    startIcon={<DownloadIcon />}
                                    onClick={() => handleCreateFromTemplate(template)}
                                    fullWidth
                                    variant="contained"
                                >
                                    Use
                                </Button>
                            </Grid>
                        )}
                    </Grid>
                </Box>
            </Card>
        );
    };

    const renderSkeletonCards = () => (
        Array.from({ length: 6 }).map((_, index) => (
            <Card key={`skeleton-${index}`} sx={{ height: '100%' }}>
                <Skeleton variant="rectangular" height={120} />
                <CardContent>
                    <Skeleton variant="text" height={32} />
                    <Skeleton variant="text" height={20} sx={{ mb: 2 }} />
                    <Skeleton variant="text" height={20} sx={{ mb: 2 }} />
                    <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
                        <Skeleton variant="rectangular" width={60} height={24} />
                        <Skeleton variant="rectangular" width={80} height={24} />
                    </Box>
                    <Box sx={{ display: 'flex', gap: 1 }}>
                        <Skeleton variant="rectangular" height={32} sx={{ flex: 1 }} />
                        <Skeleton variant="rectangular" height={32} sx={{ flex: 2 }} />
                    </Box>
                </CardContent>
            </Card>
        ))
    );

    return (
        <Box sx={{ p: 3 }}>
            {/* Header */}
            <Box sx={{ mb: 3 }}>
                <Typography variant="h4" component="h1" gutterBottom>
                    Workflow Template Library
                </Typography>
                <Typography variant="body1" color="text.secondary">
                    Browse and use pre-built workflow templates to accelerate your automation projects
                </Typography>
            </Box>

            {/* Search and Filters */}
            <Paper sx={{ p: 2, mb: 3 }}>
                <Grid container spacing={2} alignItems="center">
                    <Grid item xs={12} md={4}>
                        <TextField
                            fullWidth
                            variant="outlined"
                            placeholder="Search templates..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            InputProps={{
                                startAdornment: <SearchIcon sx={{ color: 'text.secondary', mr: 1 }} />
                            }}
                        />
                    </Grid>
                    <Grid item xs={12} md={2}>
                        <FormControl fullWidth>
                            <InputLabel>Category</InputLabel>
                            <Select
                                value={selectedCategory}
                                label="Category"
                                onChange={(e) => setSelectedCategory(e.target.value)}
                            >
                                <MenuItem value="">All Categories</MenuItem>
                                {categories.map(category => (
                                    <MenuItem key={category.id} value={category.id}>
                                        {category.name}
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                    </Grid>
                    <Grid item xs={12} md={2}>
                        <FormControl fullWidth>
                            <InputLabel>Complexity</InputLabel>
                            <Select
                                value={selectedComplexity}
                                label="Complexity"
                                onChange={(e) => setSelectedComplexity(e.target.value)}
                            >
                                <MenuItem value="">All Levels</MenuItem>
                                {complexityLevels.map(level => (
                                    <MenuItem key={level} value={level}>
                                        {level.charAt(0).toUpperCase() + level.slice(1)}
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                    </Grid>
                    <Grid item xs={12} md={2}>
                        <FormControl fullWidth>
                            <InputLabel>Sort By</InputLabel>
                            <Select
                                value={sortBy}
                                label="Sort By"
                                onChange={(e) => setSortBy(e.target.value)}
                            >
                                <MenuItem value="popularity">Popularity</MenuItem>
                                <MenuItem value="newest">Newest</MenuItem>
                                <MenuItem value="rating">Rating</MenuItem>
                                <MenuItem value="usage">Most Used</MenuItem>
                            </Select>
                        </FormControl>
                    </Grid>
                    <Grid item xs={12} md={2}>
                        <Button
                            variant="outlined"
                            startIcon={<FilterIcon />}
                            onClick={() => {
                                setSearchQuery('');
                                setSelectedCategory('');
                                setSelectedComplexity('');
                                setSortBy('popularity');
                            }}
                            fullWidth
                        >
                            Clear Filters
                        </Button>
                    </Grid>
                </Grid>
            </Paper>

            {/* Tabs */}
            <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
                <Tabs value={currentTab} onChange={(e, newValue) => setCurrentTab(newValue)}>
                    <Tab label="All Templates" icon={<CategoryIcon />} iconPosition="start" />
                    <Tab label="Featured" icon={<FeaturedIcon />} iconPosition="start" />
                    <Tab label="Recent" icon={<RecentIcon />} iconPosition="start" />
                    <Tab label="My Templates" icon={<GroupIcon />} iconPosition="start" />
                </Tabs>
            </Box>

            {/* Templates Grid */}
            <Grid container spacing={3}>
                {loading ? (
                    renderSkeletonCards()
                ) : templates.length > 0 ? (
                    templates.map(template => (
                        <Grid item xs={12} sm={6} md={4} lg={3} key={template.id}>
                            {renderTemplateCard(template)}
                        </Grid>
                    ))
                ) : (
                    <Grid item xs={12}>
                        <Alert severity="info" sx={{ mt: 2 }}>
                            No templates found. Try adjusting your search criteria or browse different categories.
                        </Alert>
                    </Grid>
                )}
            </Grid>

            {/* Pagination */}
            {templates.length > 0 && pagination.total > pagination.limit && (
                <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
                    <Button
                        disabled={pagination.offset === 0}
                        onClick={() => setPagination(prev => ({ ...prev, offset: prev.offset - prev.limit }))}
                        sx={{ mr: 2 }}
                    >
                        Previous
                    </Button>
                    <Button
                        disabled={pagination.offset + pagination.limit >= pagination.total}
                        onClick={() => setPagination(prev => ({ ...prev, offset: prev.offset + prev.limit }))}
                    >
                        Next
                    </Button>
                </Box>
            )}

            {/* Template Preview Dialog */}
            <Dialog 
                open={previewDialog.open} 
                onClose={() => setPreviewDialog({ open: false, template: null })}
                maxWidth="md"
                fullWidth
            >
                <DialogTitle>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <Typography variant="h6">
                            Template Preview: {previewDialog.template?.name}
                        </Typography>
                        <IconButton onClick={() => setPreviewDialog({ open: false, template: null })}>
                            <CloseIcon />
                        </IconButton>
                    </Box>
                </DialogTitle>
                <DialogContent>
                    {previewDialog.template && (
                        <Box>
                            <Typography variant="body1" paragraph>
                                {previewDialog.template.description}
                            </Typography>
                            
                            <Grid container spacing={2} sx={{ mb: 3 }}>
                                <Grid item xs={6}>
                                    <Paper sx={{ p: 2 }}>
                                        <Typography variant="subtitle2" gutterBottom>
                                            Estimated Nodes
                                        </Typography>
                                        <Typography variant="h4" color="primary">
                                            {previewDialog.template.estimatedNodes || 0}
                                        </Typography>
                                    </Paper>
                                </Grid>
                                <Grid item xs={6}>
                                    <Paper sx={{ p: 2 }}>
                                        <Typography variant="subtitle2" gutterBottom>
                                            Estimated Duration
                                        </Typography>
                                        <Typography variant="h4" color="primary">
                                            {formatDuration(previewDialog.template.estimatedDuration)}
                                        </Typography>
                                    </Paper>
                                </Grid>
                            </Grid>

                            {previewDialog.template.prerequisites && previewDialog.template.prerequisites.length > 0 && (
                                <Box sx={{ mb: 3 }}>
                                    <Typography variant="subtitle2" gutterBottom>
                                        Prerequisites
                                    </Typography>
                                    <List dense>
                                        {previewDialog.template.prerequisites.map((prereq, index) => (
                                            <ListItem key={index}>
                                                <ListItemText primary={prereq} />
                                            </ListItem>
                                        ))}
                                    </List>
                                </Box>
                            )}

                            {previewDialog.template.tags && (
                                <Box sx={{ mb: 3 }}>
                                    <Typography variant="subtitle2" gutterBottom>
                                        Tags
                                    </Typography>
                                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                                        {previewDialog.template.tags.map(tag => (
                                            <Chip key={tag} label={tag} size="small" />
                                        ))}
                                    </Box>
                                </Box>
                            )}
                        </Box>
                    )}
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setPreviewDialog({ open: false, template: null })}>
                        Cancel
                    </Button>
                    <Button 
                        variant="contained"
                        onClick={() => {
                            setPreviewDialog({ open: false, template: null });
                            handleCreateFromTemplate(previewDialog.template);
                        }}
                    >
                        Use This Template
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Create Workflow Dialog */}
            <Dialog 
                open={createDialog.open} 
                onClose={() => setCreateDialog({ open: false, template: null })}
                maxWidth="sm"
                fullWidth
            >
                <DialogTitle>
                    Create Workflow from Template
                </DialogTitle>
                <DialogContent>
                    <Box component="form" id="create-workflow-form" sx={{ mt: 2 }}>
                        <TextField
                            fullWidth
                            name="name"
                            label="Workflow Name"
                            variant="outlined"
                            required
                            defaultValue={createDialog.template ? `${createDialog.template.name} - Copy` : ''}
                            sx={{ mb: 3 }}
                        />
                        
                        <TextField
                            fullWidth
                            name="description"
                            label="Description"
                            variant="outlined"
                            multiline
                            rows={3}
                            defaultValue={createDialog.template?.description || ''}
                            sx={{ mb: 3 }}
                        />

                        <FormControl fullWidth sx={{ mb: 3 }}>
                            <InputLabel>Category</InputLabel>
                            <Select
                                name="category"
                                label="Category"
                                defaultValue={createDialog.template?.category || ''}
                            >
                                {categories.map(category => (
                                    <MenuItem key={category.id} value={category.id}>
                                        {category.name}
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                    </Box>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setCreateDialog({ open: false, template: null })}>
                        Cancel
                    </Button>
                    <Button 
                        variant="contained"
                        onClick={handleConfirmCreate}
                    >
                        Create Workflow
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Rating Dialog */}
            <Dialog 
                open={ratingDialog.open} 
                onClose={() => setRatingDialog({ open: false, template: null })}
                maxWidth="sm"
                fullWidth
            >
                <DialogTitle>
                    Rate Template: {ratingDialog.template?.name}
                </DialogTitle>
                <DialogContent>
                    <Box sx={{ mt: 2 }}>
                        <Typography variant="subtitle2" gutterBottom>
                            How would you rate this template?
                        </Typography>
                        <Rating
                            size="large"
                            value={0}
                            onChange={(event, newValue) => {
                                if (newValue) {
                                    handleRateTemplate(ratingDialog.template.id, newValue, '');
                                }
                            }}
                        />
                    </Box>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setRatingDialog({ open: false, template: null })}>
                        Cancel
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
}

export default WorkflowTemplateLibrary;

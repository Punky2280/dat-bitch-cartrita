/**
 * Visual Workflow Designer Component
 * Drag-and-drop interface for creating and editing workflows
 * Part of Task 25: Enterprise Workflow Automation System - Component 1
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
    Box, 
    Paper, 
    Toolbar, 
    Typography, 
    Button, 
    IconButton, 
    Drawer, 
    List, 
    ListItem, 
    ListItemIcon, 
    ListItemText, 
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
    Alert,
    CircularProgress,
    Tooltip,
    Fab,
    Accordion,
    AccordionSummary,
    AccordionDetails,
    Card,
    CardContent,
    Badge
} from '@mui/material';
import {
    Add as AddIcon,
    Save as SaveIcon,
    PlayArrow as PlayIcon,
    Settings as SettingsIcon,
    Visibility as PreviewIcon,
    FileCopy as CloneIcon,
    Delete as DeleteIcon,
    ZoomIn as ZoomInIcon,
    ZoomOut as ZoomOutIcon,
    FitScreen as FitScreenIcon,
    Menu as MenuIcon,
    ExpandMore as ExpandMoreIcon,
    DragIndicator as DragIcon,
    AccountTree as FlowIcon,
    Storage as DataIcon,
    Build as ActionIcon,
    Psychology as AIIcon,
    Extension as UtilityIcon
} from '@mui/icons-material';
import { DndProvider, useDrag, useDrop } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import ReactFlow, {
    Background,
    Controls,
    MiniMap,
    useNodesState,
    useEdgesState,
    addEdge,
    Handle,
    Position,
    MarkerType
} from 'reactflow';
import 'reactflow/dist/style.css';
import { useApi } from '../hooks/useApi';

// Custom Node Types
const CustomNode = ({ data, selected }) => {
    const nodeTypeConfig = data.nodeTypeConfig || {};
    
    return (
        <Card 
            sx={{ 
                minWidth: 150,
                border: selected ? '2px solid #1976d2' : '1px solid #ccc',
                backgroundColor: data.color || '#ffffff',
                opacity: data.disabled ? 0.6 : 1
            }}
        >
            <CardContent sx={{ p: 1, '&:last-child': { pb: 1 } }}>
                <Box display="flex" alignItems="center" gap={1}>
                    <Box 
                        component="span"
                        sx={{ 
                            fontSize: '1.2em',
                            color: nodeTypeConfig.color || '#666'
                        }}
                    >
                        {data.icon || '●'}
                    </Box>
                    <Typography variant="body2" fontWeight="bold">
                        {data.label}
                    </Typography>
                </Box>
                {data.description && (
                    <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                        {data.description}
                    </Typography>
                )}
                {data.errors && data.errors.length > 0 && (
                    <Badge badgeContent={data.errors.length} color="error" sx={{ mt: 0.5 }}>
                        <Typography variant="caption" color="error">
                            Errors
                        </Typography>
                    </Badge>
                )}
            </CardContent>
            
            {/* Input Handles */}
            {nodeTypeConfig.inputs > 0 && (
                <Handle
                    type="target"
                    position={Position.Left}
                    style={{ left: -4, background: '#555' }}
                />
            )}
            
            {/* Output Handles */}
            {nodeTypeConfig.outputs > 0 && (
                <Handle
                    type="source"
                    position={Position.Right}
                    style={{ right: -4, background: '#555' }}
                />
            )}
            
            {/* Multiple Output Handles for Decision/Parallel nodes */}
            {nodeTypeConfig.outputs > 1 && (
                Array.from({ length: nodeTypeConfig.outputs }, (_, i) => (
                    <Handle
                        key={i}
                        type="source"
                        position={Position.Right}
                        id={`output-${i}`}
                        style={{ 
                            right: -4, 
                            top: `${30 + (i * 20)}%`,
                            background: '#555' 
                        }}
                    />
                ))
            )}
        </Card>
    );
};

// Draggable Node Palette Item
const PaletteNode = ({ nodeType, nodeConfig, onAddNode }) => {
    const [{ isDragging }, drag] = useDrag(() => ({
        type: 'palette-node',
        item: { nodeType, nodeConfig },
        collect: (monitor) => ({
            isDragging: monitor.isDragging()
        })
    }));

    const handleClick = () => {
        onAddNode(nodeType, nodeConfig);
    };

    return (
        <ListItem 
            ref={drag}
            button 
            onClick={handleClick}
            sx={{ 
                opacity: isDragging ? 0.5 : 1,
                cursor: 'grab',
                '&:hover': { backgroundColor: 'action.hover' }
            }}
        >
            <ListItemIcon sx={{ color: nodeConfig.color }}>
                {getNodeIcon(nodeConfig.icon)}
            </ListItemIcon>
            <ListItemText 
                primary={nodeConfig.name}
                secondary={nodeConfig.description}
                secondaryTypographyProps={{ variant: 'caption' }}
            />
        </ListItem>
    );
};

// Helper function to get node icons
const getNodeIcon = (iconName) => {
    const icons = {
        'play-circle': <PlayIcon />,
        'stop-circle': <DeleteIcon />,
        'git-branch': <AccountTree />,
        'share-alt': <FlowIcon />,
        'code-merge': <FlowIcon />,
        'exchange-alt': <DataIcon />,
        'filter': <DataIcon />,
        'layer-group': <DataIcon />,
        'globe': <ActionIcon />,
        'database': <Storage />,
        'envelope': <ActionIcon />,
        'broadcast-tower': <ActionIcon />,
        'robot': <AIIcon />,
        'heart': <AIIcon />,
        'clock': <UtilityIcon />,
        'file-text': <UtilityIcon />,
        'tag': <UtilityIcon />
    };
    return icons[iconName] || <FlowIcon />;
};

// Node Configuration Dialog
const NodeConfigDialog = ({ open, node, nodeTypes, onClose, onSave }) => {
    const [config, setConfig] = useState({});
    const [errors, setErrors] = useState({});

    useEffect(() => {
        if (node) {
            setConfig(node.data?.config || {});
        }
    }, [node]);

    const nodeTypeConfig = nodeTypes[node?.data?.nodeType?.toUpperCase()] || {};

    const handleConfigChange = (key, value) => {
        setConfig(prev => ({ ...prev, [key]: value }));
        
        // Clear error when user starts typing
        if (errors[key]) {
            setErrors(prev => ({ ...prev, [key]: null }));
        }
    };

    const validateConfig = () => {
        const newErrors = {};
        
        Object.entries(nodeTypeConfig.config || {}).forEach(([key, spec]) => {
            const value = config[key];
            
            if (spec.required && (!value || value === '')) {
                newErrors[key] = `${key} is required`;
            }
            
            if (value && spec.type === 'number' && isNaN(Number(value))) {
                newErrors[key] = `${key} must be a number`;
            }
            
            if (value && spec.min !== undefined && Number(value) < spec.min) {
                newErrors[key] = `${key} must be at least ${spec.min}`;
            }
            
            if (value && spec.max !== undefined && Number(value) > spec.max) {
                newErrors[key] = `${key} cannot exceed ${spec.max}`;
            }
        });
        
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSave = () => {
        if (validateConfig()) {
            onSave(node.id, config);
            onClose();
        }
    };

    const renderConfigField = (key, spec) => {
        const value = config[key] || spec.default || '';
        const hasError = !!errors[key];

        switch (spec.type) {
            case 'string':
            case 'expression':
            case 'sql':
                return (
                    <TextField
                        key={key}
                        fullWidth
                        label={key}
                        value={value}
                        onChange={(e) => handleConfigChange(key, e.target.value)}
                        error={hasError}
                        helperText={errors[key] || spec.description}
                        multiline={spec.type === 'sql' || spec.type === 'code'}
                        rows={spec.type === 'sql' || spec.type === 'code' ? 4 : 1}
                        margin="normal"
                        required={spec.required}
                    />
                );
            
            case 'number':
                return (
                    <TextField
                        key={key}
                        fullWidth
                        type="number"
                        label={key}
                        value={value}
                        onChange={(e) => handleConfigChange(key, Number(e.target.value))}
                        error={hasError}
                        helperText={errors[key] || spec.description}
                        margin="normal"
                        required={spec.required}
                        inputProps={{
                            min: spec.min,
                            max: spec.max
                        }}
                    />
                );
            
            case 'boolean':
                return (
                    <FormControl key={key} fullWidth margin="normal">
                        <InputLabel>{key}</InputLabel>
                        <Select
                            value={value || false}
                            onChange={(e) => handleConfigChange(key, e.target.value)}
                            error={hasError}
                        >
                            <MenuItem value={true}>True</MenuItem>
                            <MenuItem value={false}>False</MenuItem>
                        </Select>
                        {errors[key] && (
                            <Typography variant="caption" color="error">
                                {errors[key]}
                            </Typography>
                        )}
                    </FormControl>
                );
            
            case 'select':
                return (
                    <FormControl key={key} fullWidth margin="normal" error={hasError}>
                        <InputLabel>{key}</InputLabel>
                        <Select
                            value={value}
                            onChange={(e) => handleConfigChange(key, e.target.value)}
                            required={spec.required}
                        >
                            {spec.options.map(option => (
                                <MenuItem key={option} value={option}>
                                    {option}
                                </MenuItem>
                            ))}
                        </Select>
                        {errors[key] && (
                            <Typography variant="caption" color="error">
                                {errors[key]}
                            </Typography>
                        )}
                    </FormControl>
                );
            
            case 'text':
                return (
                    <TextField
                        key={key}
                        fullWidth
                        multiline
                        rows={4}
                        label={key}
                        value={value}
                        onChange={(e) => handleConfigChange(key, e.target.value)}
                        error={hasError}
                        helperText={errors[key] || spec.description}
                        margin="normal"
                        required={spec.required}
                    />
                );
            
            default:
                return (
                    <TextField
                        key={key}
                        fullWidth
                        label={key}
                        value={typeof value === 'object' ? JSON.stringify(value) : value}
                        onChange={(e) => {
                            try {
                                const parsedValue = JSON.parse(e.target.value);
                                handleConfigChange(key, parsedValue);
                            } catch {
                                handleConfigChange(key, e.target.value);
                            }
                        }}
                        error={hasError}
                        helperText={errors[key] || `${spec.type} field`}
                        margin="normal"
                        required={spec.required}
                    />
                );
        }
    };

    return (
        <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
            <DialogTitle>
                Configure {nodeTypeConfig.name || 'Node'}
            </DialogTitle>
            <DialogContent>
                {Object.entries(nodeTypeConfig.config || {}).map(([key, spec]) => 
                    renderConfigField(key, spec)
                )}
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose}>Cancel</Button>
                <Button onClick={handleSave} variant="contained">Save</Button>
            </DialogActions>
        </Dialog>
    );
};

// Main Workflow Designer Component
const WorkflowDesigner = ({ workflowId, onSave, onExecute }) => {
    // State management
    const [nodes, setNodes, onNodesChange] = useNodesState([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState([]);
    const [drawerOpen, setDrawerOpen] = useState(true);
    const [selectedNode, setSelectedNode] = useState(null);
    const [configDialogOpen, setConfigDialogOpen] = useState(false);
    const [previewDialogOpen, setPreviewDialogOpen] = useState(false);
    const [nodeTypes, setNodeTypes] = useState({});
    const [workflow, setWorkflow] = useState(null);
    const [validationResults, setValidationResults] = useState(null);
    const [preview, setPreview] = useState(null);
    const [loading, setLoading] = useState(false);
    
    // Refs
    const reactFlowWrapper = useRef(null);
    const reactFlowInstance = useRef(null);
    
    // API hooks
    const { request } = useApi();

    // Custom node types for ReactFlow
    const customNodeTypes = {
        custom: CustomNode
    };

    // Load node types and workflow data
    useEffect(() => {
        loadNodeTypes();
        if (workflowId) {
            loadWorkflow();
        }
    }, [workflowId]);

    const loadNodeTypes = async () => {
        try {
            const response = await request('/api/workflows/node-types');
            setNodeTypes(response.nodeTypes);
        } catch (error) {
            console.error('Failed to load node types:', error);
        }
    };

    const loadWorkflow = async () => {
        try {
            setLoading(true);
            const response = await request(`/api/workflows/${workflowId}`);
            setWorkflow(response.workflow);
            
            // Convert workflow definition to ReactFlow format
            if (response.workflow.definition) {
                const definition = typeof response.workflow.definition === 'string' 
                    ? JSON.parse(response.workflow.definition) 
                    : response.workflow.definition;
                
                const flowNodes = definition.nodes.map(node => ({
                    id: node.id,
                    type: 'custom',
                    position: node.position || { x: 0, y: 0 },
                    data: {
                        label: node.name || nodeTypes[node.type?.toUpperCase()]?.name || node.type,
                        nodeType: node.type,
                        nodeTypeConfig: nodeTypes[node.type?.toUpperCase()],
                        config: node.config,
                        color: nodeTypes[node.type?.toUpperCase()]?.color,
                        icon: nodeTypes[node.type?.toUpperCase()]?.icon,
                        description: nodeTypes[node.type?.toUpperCase()]?.description
                    }
                }));
                
                const flowEdges = definition.connections.map(conn => ({
                    id: `${conn.from}-${conn.to}`,
                    source: conn.from,
                    target: conn.to,
                    markerEnd: { type: MarkerType.ArrowClosed }
                }));
                
                setNodes(flowNodes);
                setEdges(flowEdges);
            }
        } catch (error) {
            console.error('Failed to load workflow:', error);
        } finally {
            setLoading(false);
        }
    };

    // Drop zone for adding nodes from palette
    const [{ isOver }, drop] = useDrop(() => ({
        accept: 'palette-node',
        drop: (item, monitor) => {
            const offset = monitor.getDropResult();
            if (offset) {
                addNodeToCanvas(item.nodeType, item.nodeConfig, offset);
            }
        },
        collect: (monitor) => ({
            isOver: monitor.isOver()
        })
    }));

    // Add node to canvas
    const addNodeToCanvas = useCallback((nodeType, nodeConfig, position) => {
        const newNode = {
            id: `node_${Date.now()}`,
            type: 'custom',
            position: position || { x: Math.random() * 400, y: Math.random() * 400 },
            data: {
                label: nodeConfig.name,
                nodeType: nodeType.toLowerCase(),
                nodeTypeConfig: nodeConfig,
                config: {},
                color: nodeConfig.color,
                icon: nodeConfig.icon,
                description: nodeConfig.description
            }
        };
        
        setNodes(nds => [...nds, newNode]);
    }, [setNodes]);

    // Handle edge connections
    const onConnect = useCallback((params) => {
        setEdges(eds => addEdge({
            ...params,
            markerEnd: { type: MarkerType.ArrowClosed }
        }, eds));
    }, [setEdges]);

    // Handle node selection
    const onNodeClick = useCallback((event, node) => {
        setSelectedNode(node);
    }, []);

    // Handle node double-click for configuration
    const onNodeDoubleClick = useCallback((event, node) => {
        setSelectedNode(node);
        setConfigDialogOpen(true);
    }, []);

    // Save node configuration
    const saveNodeConfig = useCallback((nodeId, config) => {
        setNodes(nds => nds.map(node => 
            node.id === nodeId 
                ? { ...node, data: { ...node.data, config } }
                : node
        ));
    }, [setNodes]);

    // Save workflow
    const saveWorkflow = async () => {
        try {
            setLoading(true);
            
            // Convert ReactFlow format to workflow definition
            const workflowDefinition = {
                nodes: nodes.map(node => ({
                    id: node.id,
                    type: node.data.nodeType,
                    name: node.data.label,
                    position: node.position,
                    config: node.data.config || {}
                })),
                connections: edges.map(edge => ({
                    from: edge.source,
                    to: edge.target
                })),
                variables: workflow?.variables || {}
            };

            const payload = {
                name: workflow?.name || 'Untitled Workflow',
                description: workflow?.description || '',
                ...workflowDefinition
            };

            const response = workflowId 
                ? await request(`/api/workflows/${workflowId}`, 'PUT', payload)
                : await request('/api/workflows', 'POST', payload);

            if (onSave) {
                onSave(response.workflow);
            }
        } catch (error) {
            console.error('Failed to save workflow:', error);
        } finally {
            setLoading(false);
        }
    };

    // Validate workflow
    const validateWorkflow = async () => {
        try {
            const workflowDefinition = {
                nodes: nodes.map(node => ({
                    id: node.id,
                    type: node.data.nodeType,
                    config: node.data.config || {}
                })),
                connections: edges.map(edge => ({
                    from: edge.source,
                    to: edge.target
                }))
            };

            const response = await request('/api/workflows/validate', 'POST', workflowDefinition);
            setValidationResults(response.validation);
            return response.validation;
        } catch (error) {
            console.error('Failed to validate workflow:', error);
            return null;
        }
    };

    // Generate preview
    const generatePreview = async () => {
        try {
            setLoading(true);
            
            // Save workflow first if it has changes
            await saveWorkflow();
            
            const response = await request(`/api/workflows/${workflowId}/preview`);
            setPreview(response.preview);
            setPreviewDialogOpen(true);
        } catch (error) {
            console.error('Failed to generate preview:', error);
        } finally {
            setLoading(false);
        }
    };

    // Group node types by category
    const groupedNodeTypes = Object.entries(nodeTypes).reduce((groups, [key, nodeType]) => {
        if (!groups[nodeType.category]) {
            groups[nodeType.category] = [];
        }
        groups[nodeType.category].push([key, nodeType]);
        return groups;
    }, {});

    // Category icons
    const categoryIcons = {
        control: <FlowIcon />,
        data: <DataIcon />,
        action: <ActionIcon />,
        ai: <AIIcon />,
        utility: <UtilityIcon />
    };

    // Category colors
    const categoryColors = {
        control: '#2196F3',
        data: '#FF9800',
        action: '#4CAF50',
        ai: '#E91E63',
        utility: '#9E9E9E'
    };

    return (
        <DndProvider backend={HTML5Backend}>
            <Box sx={{ height: '100vh', display: 'flex' }}>
                {/* Node Palette Drawer */}
                <Drawer
                    variant="persistent"
                    anchor="left"
                    open={drawerOpen}
                    sx={{
                        width: 300,
                        flexShrink: 0,
                        '& .MuiDrawer-paper': {
                            width: 300,
                            boxSizing: 'border-box'
                        }
                    }}
                >
                    <Toolbar>
                        <Typography variant="h6">Node Palette</Typography>
                        <IconButton 
                            onClick={() => setDrawerOpen(false)}
                            sx={{ ml: 'auto' }}
                        >
                            <MenuIcon />
                        </IconButton>
                    </Toolbar>
                    
                    <Box sx={{ overflow: 'auto' }}>
                        {Object.entries(groupedNodeTypes).map(([category, nodeTypeList]) => (
                            <Accordion key={category} defaultExpanded>
                                <AccordionSummary
                                    expandIcon={<ExpandMoreIcon />}
                                    sx={{ 
                                        backgroundColor: 'action.hover',
                                        color: categoryColors[category]
                                    }}
                                >
                                    <Box display="flex" alignItems="center" gap={1}>
                                        {categoryIcons[category]}
                                        <Typography variant="subtitle2">
                                            {category.toUpperCase()}
                                        </Typography>
                                    </Box>
                                </AccordionSummary>
                                <AccordionDetails sx={{ p: 0 }}>
                                    <List>
                                        {nodeTypeList.map(([key, nodeConfig]) => (
                                            <PaletteNode
                                                key={key}
                                                nodeType={key}
                                                nodeConfig={nodeConfig}
                                                onAddNode={addNodeToCanvas}
                                            />
                                        ))}
                                    </List>
                                </AccordionDetails>
                            </Accordion>
                        ))}
                    </Box>
                </Drawer>

                {/* Main Canvas */}
                <Box 
                    ref={drop}
                    sx={{ 
                        flexGrow: 1,
                        position: 'relative',
                        backgroundColor: isOver ? 'action.hover' : 'background.default'
                    }}
                >
                    {/* Toolbar */}
                    <Paper 
                        sx={{ 
                            position: 'absolute', 
                            top: 16, 
                            left: drawerOpen ? 16 : 316, 
                            right: 16, 
                            zIndex: 1000,
                            transition: 'left 0.3s'
                        }}
                    >
                        <Toolbar>
                            {!drawerOpen && (
                                <IconButton onClick={() => setDrawerOpen(true)}>
                                    <MenuIcon />
                                </IconButton>
                            )}
                            
                            <Typography variant="h6" sx={{ flexGrow: 1 }}>
                                {workflow?.name || 'Workflow Designer'}
                            </Typography>

                            <Button
                                startIcon={<SaveIcon />}
                                onClick={saveWorkflow}
                                disabled={loading}
                                sx={{ mr: 1 }}
                            >
                                Save
                            </Button>

                            <Button
                                startIcon={<PreviewIcon />}
                                onClick={generatePreview}
                                disabled={loading || !workflowId}
                                sx={{ mr: 1 }}
                            >
                                Preview
                            </Button>

                            <Button
                                startIcon={<PlayIcon />}
                                onClick={() => onExecute && onExecute()}
                                disabled={loading || !workflowId}
                                variant="contained"
                            >
                                Execute
                            </Button>
                        </Toolbar>
                    </Paper>

                    {/* ReactFlow Canvas */}
                    <Box 
                        ref={reactFlowWrapper}
                        sx={{ 
                            height: '100%', 
                            pt: 8,
                            pl: drawerOpen ? 0 : 2,
                            transition: 'padding-left 0.3s'
                        }}
                    >
                        {loading && (
                            <Box 
                                sx={{ 
                                    position: 'absolute', 
                                    top: '50%', 
                                    left: '50%', 
                                    transform: 'translate(-50%, -50%)',
                                    zIndex: 2000
                                }}
                            >
                                <CircularProgress />
                            </Box>
                        )}
                        
                        <ReactFlow
                            nodes={nodes}
                            edges={edges}
                            onNodesChange={onNodesChange}
                            onEdgesChange={onEdgesChange}
                            onConnect={onConnect}
                            onNodeClick={onNodeClick}
                            onNodeDoubleClick={onNodeDoubleClick}
                            nodeTypes={customNodeTypes}
                            onInit={(instance) => { reactFlowInstance.current = instance; }}
                            fitView
                        >
                            <Background />
                            <Controls />
                            <MiniMap 
                                nodeColor={(node) => node.data?.color || '#ccc'}
                                position="bottom-left"
                            />
                        </ReactFlow>
                    </Box>
                </Box>

                {/* Validation Results */}
                {validationResults && (
                    <Paper 
                        sx={{ 
                            position: 'absolute', 
                            bottom: 16, 
                            right: 16, 
                            p: 2, 
                            maxWidth: 400,
                            zIndex: 1000
                        }}
                    >
                        <Typography variant="h6" gutterBottom>
                            Validation Results
                        </Typography>
                        
                        {validationResults.valid ? (
                            <Alert severity="success">
                                Workflow is valid ({validationResults.nodeCount} nodes, {validationResults.connectionCount} connections)
                            </Alert>
                        ) : (
                            <Alert severity="error">
                                Validation failed:
                                <List dense>
                                    {validationResults.errors.map((error, index) => (
                                        <ListItem key={index}>
                                            <Typography variant="body2">• {error}</Typography>
                                        </ListItem>
                                    ))}
                                </List>
                            </Alert>
                        )}
                        
                        {validationResults.warnings && validationResults.warnings.length > 0 && (
                            <Alert severity="warning" sx={{ mt: 1 }}>
                                Warnings:
                                <List dense>
                                    {validationResults.warnings.map((warning, index) => (
                                        <ListItem key={index}>
                                            <Typography variant="body2">• {warning}</Typography>
                                        </ListItem>
                                    ))}
                                </List>
                            </Alert>
                        )}
                    </Paper>
                )}

                {/* Node Configuration Dialog */}
                <NodeConfigDialog
                    open={configDialogOpen}
                    node={selectedNode}
                    nodeTypes={nodeTypes}
                    onClose={() => setConfigDialogOpen(false)}
                    onSave={saveNodeConfig}
                />

                {/* Workflow Preview Dialog */}
                <Dialog 
                    open={previewDialogOpen} 
                    onClose={() => setPreviewDialogOpen(false)}
                    maxWidth="lg"
                    fullWidth
                >
                    <DialogTitle>Workflow Execution Preview</DialogTitle>
                    <DialogContent>
                        {preview && (
                            <Box>
                                <Typography variant="h6" gutterBottom>
                                    Execution Plan
                                </Typography>
                                <List>
                                    {preview.executionPlan.map((step, index) => (
                                        <ListItem key={index}>
                                            <ListItemText
                                                primary={`Step ${step.step}: ${step.nodeName}`}
                                                secondary={`Type: ${step.nodeType} | Duration: ${step.estimatedDuration}ms`}
                                            />
                                            {step.parallelGroup && (
                                                <Chip label="Parallel" size="small" />
                                            )}
                                        </ListItem>
                                    ))}
                                </List>
                                
                                <Typography variant="h6" gutterBottom sx={{ mt: 2 }}>
                                    Metrics
                                </Typography>
                                <Box display="flex" gap={2} flexWrap="wrap">
                                    <Chip label={`Duration: ${preview.estimatedDuration}ms`} />
                                    <Chip label={`Complexity: ${preview.complexity}`} />
                                    <Chip label={`CPU: ${preview.resourceUsage.cpu}%`} />
                                    <Chip label={`Memory: ${preview.resourceUsage.memory}MB`} />
                                    <Chip label={`Network: ${preview.resourceUsage.network}KB`} />
                                </Box>
                            </Box>
                        )}
                    </DialogContent>
                    <DialogActions>
                        <Button onClick={() => setPreviewDialogOpen(false)}>Close</Button>
                    </DialogActions>
                </Dialog>

                {/* Floating Action Button for Validation */}
                <Fab
                    color="primary"
                    sx={{ position: 'absolute', bottom: 16, right: 16 }}
                    onClick={validateWorkflow}
                >
                    <SettingsIcon />
                </Fab>
            </Box>
        </DndProvider>
    );
};

export default WorkflowDesigner;

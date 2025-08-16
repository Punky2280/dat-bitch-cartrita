import React from 'react';
import { Box, Typography, Breadcrumbs, Link } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import WorkflowTemplateLibrary from '../components/workflows/WorkflowTemplateLibrary';

function WorkflowTemplateLibraryPage() {
    const navigate = useNavigate();

    const handleCreateFromTemplate = (workflow) => {
        // Navigate to the new workflow editor
        navigate(`/workflows/${workflow.id}/edit`);
    };

    return (
        <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
            {/* Breadcrumbs */}
            <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
                <Breadcrumbs>
                    <Link 
                        color="inherit" 
                        onClick={() => navigate('/workflows')}
                        sx={{ cursor: 'pointer' }}
                    >
                        Workflows
                    </Link>
                    <Typography color="text.primary">Template Library</Typography>
                </Breadcrumbs>
            </Box>

            {/* Template Library */}
            <WorkflowTemplateLibrary 
                onCreateFromTemplate={handleCreateFromTemplate}
                showCreateButton={true}
            />
        </Box>
    );
}

export default WorkflowTemplateLibraryPage;

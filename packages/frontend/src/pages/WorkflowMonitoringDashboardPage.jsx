import React from 'react';
import { Box, Typography, Breadcrumbs, Link } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import WorkflowMonitoringDashboard from '../components/workflows/WorkflowMonitoringDashboard';

function WorkflowMonitoringDashboardPage() {
    const navigate = useNavigate();

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
                    <Typography color="text.primary">Monitoring Dashboard</Typography>
                </Breadcrumbs>
            </Box>

            {/* Monitoring Dashboard */}
            <WorkflowMonitoringDashboard />
        </Box>
    );
}

export default WorkflowMonitoringDashboardPage;

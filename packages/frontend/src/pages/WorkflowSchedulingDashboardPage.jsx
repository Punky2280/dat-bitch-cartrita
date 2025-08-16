// WorkflowSchedulingDashboardPage.jsx
// Component 5: Advanced Scheduling System - Page Wrapper
// Page component for the workflow scheduling dashboard

import React from 'react';
import { Box, Container } from '@mui/material';
import WorkflowSchedulingDashboard from '../components/workflows/WorkflowSchedulingDashboard';

function WorkflowSchedulingDashboardPage() {
    return (
        <Container maxWidth="xl" sx={{ py: 4 }}>
            <WorkflowSchedulingDashboard />
        </Container>
    );
}

export default WorkflowSchedulingDashboardPage;

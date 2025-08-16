// ServiceIntegrationHub.jsx
// Component 6: Service Integration Hub - Main Page Component
// Top-level page for managing external service integrations

import React from 'react';
import { Box, Container, Paper, Typography } from '@mui/material';
import WorkflowServiceIntegrationDashboard from '../components/workflows/WorkflowServiceIntegrationDashboard';

const ServiceIntegrationHub = () => {
  return (
    <Container maxWidth="xl">
      <Paper elevation={1}>
        <WorkflowServiceIntegrationDashboard />
      </Paper>
    </Container>
  );
};

export default ServiceIntegrationHub;

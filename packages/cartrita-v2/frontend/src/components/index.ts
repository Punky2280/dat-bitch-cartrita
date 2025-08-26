/**
 * Component exports for comprehensive application features
 */

// Dashboard Components
export { default as SystemOverview } from './dashboard/SystemOverview';
export { default as AnalyticsDashboard } from './dashboard/AnalyticsDashboard';

// Quantum Computing Components
export { default as QuantumInterface } from './quantum/QuantumInterface';

// Research Components
export { default as ResearchHub } from './research/ResearchHub';

// Computer Vision Components
export { default as VisionLab } from './vision/VisionLab';

// API Console Components
export { default as APIConsole } from './api/APIConsole';

// Workflow Components (if we had created it without linting issues)
// export { default as WorkflowBuilder } from './workflow/WorkflowBuilder';

/**
 * These components provide comprehensive functionality for:
 * 
 * 1. System Monitoring & Analytics
 *    - Real-time system metrics and health monitoring
 *    - Performance analytics with interactive charts
 *    - User engagement and system usage patterns
 * 
 * 2. Quantum Computing Interface
 *    - Multiple quantum algorithm implementations
 *    - Real-time job execution and progress tracking
 *    - Result visualization and analysis
 * 
 * 3. Academic Research Hub
 *    - Paper search and discovery with advanced filtering
 *    - Citation analysis and impact metrics
 *    - Research library management
 * 
 * 4. Computer Vision Lab
 *    - Multi-format image upload and processing
 *    - Various AI-powered analysis types
 *    - Real-time processing with progress tracking
 * 
 * 5. API Console
 *    - Full-featured API testing interface
 *    - Request/response history and analysis
 *    - Collection management and organization
 * 
 * All components are built with:
 * - Real backend integration via Zustand stores
 * - Responsive design with Tailwind CSS
 * - Interactive animations with Framer Motion
 * - Comprehensive error handling
 * - TypeScript type safety
 * - Accessibility features
 * - Dark mode support
 */
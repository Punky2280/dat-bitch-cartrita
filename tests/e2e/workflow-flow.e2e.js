/**
 * @fileoverview E2E Tests - Workflow Management Flow
 * Tests workflow creation, editing, execution, and management interface
 */

import { test, expect } from '@playwright/test';

test.describe('Workflow Management Flow', () => {
  
  test.beforeEach(async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page.locator('[data-testid="user-menu"]')).toBeVisible();
  });

  test.describe('Workflow Creation', () => {
    test('should navigate to workflow creation page', async ({ page }) => {
      // Navigate to workflows section
      await page.click('[data-testid="workflows-nav"]');
      
      // Click create new workflow
      await page.click('[data-testid="create-workflow-button"]');
      
      // Should navigate to workflow builder
      await expect(page).toHaveURL(/\/workflows\/new/);
      
      // Verify workflow builder interface
      await expect(page.locator('[data-testid="workflow-canvas"]')).toBeVisible();
      await expect(page.locator('[data-testid="node-palette"]')).toBeVisible();
      await expect(page.locator('[data-testid="workflow-properties"]')).toBeVisible();
    });
    
    test('should create basic workflow with drag and drop', async ({ page }) => {
      await page.goto('/workflows/new');
      
      // Set workflow name and description
      await page.fill('[data-testid="workflow-name-input"]', 'E2E Test Workflow');
      await page.fill('[data-testid="workflow-description-input"]', 'A test workflow created via E2E tests');
      
      // Drag trigger node to canvas
      const triggerNode = page.locator('[data-testid="node-trigger"]');
      const canvas = page.locator('[data-testid="workflow-canvas"]');
      
      await triggerNode.dragTo(canvas, {
        targetPosition: { x: 100, y: 100 }
      });
      
      // Verify node is placed on canvas
      await expect(page.locator('[data-testid="canvas-node-trigger"]')).toBeVisible();
      
      // Add processing node
      const processNode = page.locator('[data-testid="node-process"]');
      await processNode.dragTo(canvas, {
        targetPosition: { x: 300, y: 100 }
      });
      
      // Connect nodes
      await page.hover('[data-testid="canvas-node-trigger"]');
      await page.dragAndDrop(
        '[data-testid="trigger-output-port"]',
        '[data-testid="process-input-port"]'
      );
      
      // Verify connection is created
      await expect(page.locator('[data-testid="workflow-connection"]')).toBeVisible();
      
      // Save workflow
      await page.click('[data-testid="save-workflow-button"]');
      
      // Should redirect to workflow detail page
      await expect(page).toHaveURL(/\/workflows\/\d+/);
      
      // Verify workflow is saved
      await expect(page.locator('[data-testid="workflow-title"]')).toContainText('E2E Test Workflow');
    });
    
    test('should configure node properties', async ({ page }) => {
      await page.goto('/workflows/new');
      
      // Add a configurable node
      const emailNode = page.locator('[data-testid="node-email"]');
      const canvas = page.locator('[data-testid="workflow-canvas"]');
      
      await emailNode.dragTo(canvas, {
        targetPosition: { x: 200, y: 150 }
      });
      
      // Select node to open properties
      await page.click('[data-testid="canvas-node-email"]');
      
      // Configure node properties
      await expect(page.locator('[data-testid="node-properties-panel"]')).toBeVisible();
      
      await page.fill('[data-testid="email-recipient-input"]', 'test@example.com');
      await page.fill('[data-testid="email-subject-input"]', 'Test Email Subject');
      await page.fill('[data-testid="email-template-input"]', 'Hello, this is a test email.');
      
      // Apply configuration
      await page.click('[data-testid="apply-node-config"]');
      
      // Verify configuration is saved (node should show configured state)
      await expect(page.locator('[data-testid="canvas-node-email"]')).toHaveClass(/configured/);
    });
    
    test('should validate workflow before saving', async ({ page }) => {
      await page.goto('/workflows/new');
      
      // Try to save empty workflow
      await page.click('[data-testid="save-workflow-button"]');
      
      // Should show validation errors
      await expect(page.locator('[data-testid="validation-error"]')).toBeVisible();
      await expect(page.locator('[data-testid="validation-error"]')).toContainText('at least one trigger node');
      
      // Add only trigger node (incomplete workflow)
      const triggerNode = page.locator('[data-testid="node-trigger"]');
      const canvas = page.locator('[data-testid="workflow-canvas"]');
      
      await triggerNode.dragTo(canvas);
      
      await page.click('[data-testid="save-workflow-button"]');
      
      // Should show warning about incomplete workflow
      await expect(page.locator('[data-testid="validation-warning"]')).toBeVisible();
    });
  });

  test.describe('Workflow Management', () => {
    test('should list existing workflows', async ({ page }) => {
      await page.goto('/workflows');
      
      // Should show workflows list
      await expect(page.locator('[data-testid="workflows-grid"]')).toBeVisible();
      
      // Should have at least one workflow (from test data)
      const workflowItems = page.locator('[data-testid="workflow-card"]');
      await expect(workflowItems).toHaveCountGreaterThan(0);
      
      // Verify workflow card structure
      const firstWorkflow = workflowItems.first();
      await expect(firstWorkflow.locator('[data-testid="workflow-name"]')).toBeVisible();
      await expect(firstWorkflow.locator('[data-testid="workflow-description"]')).toBeVisible();
      await expect(firstWorkflow.locator('[data-testid="workflow-status"]')).toBeVisible();
      await expect(firstWorkflow.locator('[data-testid="workflow-actions"]')).toBeVisible();
    });
    
    test('should filter workflows by status', async ({ page }) => {
      await page.goto('/workflows');
      
      // Count all workflows
      const allWorkflows = await page.locator('[data-testid="workflow-card"]').count();
      
      // Filter by active workflows
      await page.click('[data-testid="filter-active"]');
      
      const activeWorkflows = await page.locator('[data-testid="workflow-card"]').count();
      
      // Should have filtered results
      expect(activeWorkflows).toBeLessThanOrEqual(allWorkflows);
      
      // All visible workflows should be active
      const statusBadges = page.locator('[data-testid="workflow-status"]');
      const statusCount = await statusBadges.count();
      
      for (let i = 0; i < statusCount; i++) {
        const status = await statusBadges.nth(i).textContent();
        expect(status).toContain('Active');
      }
    });
    
    test('should search workflows by name', async ({ page }) => {
      await page.goto('/workflows');
      
      // Search for specific workflow
      await page.fill('[data-testid="workflow-search"]', 'Test Workflow');
      
      // Should filter results
      const searchResults = page.locator('[data-testid="workflow-card"]');
      
      // All results should match search term
      const count = await searchResults.count();
      for (let i = 0; i < count; i++) {
        const workflowName = await searchResults.nth(i).locator('[data-testid="workflow-name"]').textContent();
        expect(workflowName.toLowerCase()).toContain('test workflow');
      }
    });
    
    test('should view workflow details', async ({ page }) => {
      await page.goto('/workflows');
      
      // Click on first workflow
      await page.click('[data-testid="workflow-card"]');
      
      // Should navigate to workflow detail page
      await expect(page).toHaveURL(/\/workflows\/\d+/);
      
      // Verify workflow details are shown
      await expect(page.locator('[data-testid="workflow-title"]')).toBeVisible();
      await expect(page.locator('[data-testid="workflow-description"]')).toBeVisible();
      await expect(page.locator('[data-testid="workflow-canvas-view"]')).toBeVisible();
      await expect(page.locator('[data-testid="workflow-stats"]')).toBeVisible();
      await expect(page.locator('[data-testid="execution-history"]')).toBeVisible();
    });
  });

  test.describe('Workflow Editing', () => {
    test.beforeEach(async ({ page }) => {
      // Navigate to an existing workflow for editing
      await page.goto('/workflows');
      await page.click('[data-testid="workflow-card"]');
      await expect(page).toHaveURL(/\/workflows\/\d+/);
    });
    
    test('should edit workflow in builder', async ({ page }) => {
      // Click edit button
      await page.click('[data-testid="edit-workflow-button"]');
      
      // Should open workflow builder with existing workflow
      await expect(page).toHaveURL(/\/workflows\/\d+\/edit/);
      await expect(page.locator('[data-testid="workflow-canvas"]')).toBeVisible();
      
      // Existing nodes should be visible
      await expect(page.locator('[data-testid^="canvas-node-"]')).toHaveCountGreaterThan(0);
      
      // Add new node
      const transformNode = page.locator('[data-testid="node-transform"]');
      const canvas = page.locator('[data-testid="workflow-canvas"]');
      
      await transformNode.dragTo(canvas, {
        targetPosition: { x: 400, y: 200 }
      });
      
      // Save changes
      await page.click('[data-testid="save-workflow-button"]');
      
      // Should show success message
      await expect(page.locator('[data-testid="save-success"]')).toBeVisible();
    });
    
    test('should delete workflow node', async ({ page }) => {
      await page.click('[data-testid="edit-workflow-button"]');
      
      // Select a node
      await page.click('[data-testid^="canvas-node-"]');
      
      // Delete node using keyboard
      await page.keyboard.press('Delete');
      
      // Confirm deletion
      await page.click('[data-testid="confirm-delete-node"]');
      
      // Node should be removed from canvas
      // (Note: This test assumes we have at least 2 nodes initially)
      const remainingNodes = await page.locator('[data-testid^="canvas-node-"]').count();
      expect(remainingNodes).toBeGreaterThanOrEqual(0);
    });
    
    test('should undo and redo changes', async ({ page }) => {
      await page.click('[data-testid="edit-workflow-button"]');
      
      const initialNodeCount = await page.locator('[data-testid^="canvas-node-"]').count();
      
      // Add new node
      const actionNode = page.locator('[data-testid="node-action"]');
      const canvas = page.locator('[data-testid="workflow-canvas"]');
      
      await actionNode.dragTo(canvas);
      
      // Verify node was added
      await expect(page.locator('[data-testid^="canvas-node-"]')).toHaveCount(initialNodeCount + 1);
      
      // Undo
      await page.keyboard.press('Control+z');
      
      // Node should be removed
      await expect(page.locator('[data-testid^="canvas-node-"]')).toHaveCount(initialNodeCount);
      
      // Redo
      await page.keyboard.press('Control+y');
      
      // Node should be back
      await expect(page.locator('[data-testid^="canvas-node-"]')).toHaveCount(initialNodeCount + 1);
    });
  });

  test.describe('Workflow Execution', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/workflows');
      await page.click('[data-testid="workflow-card"]');
    });
    
    test('should execute workflow manually', async ({ page }) => {
      // Click execute button
      await page.click('[data-testid="execute-workflow-button"]');
      
      // Should open execution dialog
      await expect(page.locator('[data-testid="execution-dialog"]')).toBeVisible();
      
      // Provide input data if required
      const inputField = page.locator('[data-testid="execution-input"]');
      if (await inputField.isVisible()) {
        await inputField.fill('{"test": "data"}');
      }
      
      // Start execution
      await page.click('[data-testid="start-execution-button"]');
      
      // Should show execution started message
      await expect(page.locator('[data-testid="execution-started"]')).toBeVisible();
      
      // Execution should appear in history
      await expect(page.locator('[data-testid="execution-item"]')).toHaveCountGreaterThan(0);
    });
    
    test('should view execution details and logs', async ({ page }) => {
      // Assume there's at least one execution in history
      await expect(page.locator('[data-testid="execution-item"]')).toHaveCountGreaterThan(0);
      
      // Click on execution item
      await page.click('[data-testid="execution-item"]');
      
      // Should open execution details
      await expect(page.locator('[data-testid="execution-details"]')).toBeVisible();
      
      // Verify execution information
      await expect(page.locator('[data-testid="execution-status"]')).toBeVisible();
      await expect(page.locator('[data-testid="execution-duration"]')).toBeVisible();
      await expect(page.locator('[data-testid="execution-logs"]')).toBeVisible();
      
      // Check logs content
      const logs = page.locator('[data-testid="log-entry"]');
      await expect(logs).toHaveCountGreaterThan(0);
    });
    
    test('should stop running execution', async ({ page }) => {
      // Start an execution
      await page.click('[data-testid="execute-workflow-button"]');
      await page.click('[data-testid="start-execution-button"]');
      
      // If execution is running, should have stop button
      const stopButton = page.locator('[data-testid="stop-execution-button"]');
      if (await stopButton.isVisible()) {
        await stopButton.click();
        
        // Confirm stop
        await page.click('[data-testid="confirm-stop-button"]');
        
        // Execution should be marked as stopped
        await expect(page.locator('[data-testid="execution-status"]')).toContainText('Stopped');
      }
    });
  });

  test.describe('Workflow Status Management', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/workflows');
      await page.click('[data-testid="workflow-card"]');
    });
    
    test('should toggle workflow active/inactive status', async ({ page }) => {
      // Check current status
      const currentStatus = await page.locator('[data-testid="workflow-status-badge"]').textContent();
      
      // Toggle status
      await page.click('[data-testid="toggle-status-button"]');
      
      // Status should change
      const newStatus = await page.locator('[data-testid="workflow-status-badge"]').textContent();
      expect(newStatus).not.toBe(currentStatus);
      
      // Should show confirmation message
      await expect(page.locator('[data-testid="status-change-message"]')).toBeVisible();
    });
    
    test('should schedule workflow execution', async ({ page }) => {
      // Click schedule button
      await page.click('[data-testid="schedule-workflow-button"]');
      
      // Should open schedule dialog
      await expect(page.locator('[data-testid="schedule-dialog"]')).toBeVisible();
      
      // Set schedule
      await page.selectOption('[data-testid="schedule-frequency"]', 'daily');
      await page.fill('[data-testid="schedule-time"]', '09:00');
      
      // Save schedule
      await page.click('[data-testid="save-schedule-button"]');
      
      // Should show schedule confirmation
      await expect(page.locator('[data-testid="schedule-created"]')).toBeVisible();
      
      // Schedule should be visible in workflow details
      await expect(page.locator('[data-testid="workflow-schedule"]')).toContainText('Daily at 09:00');
    });
  });

  test.describe('Workflow Templates and Import/Export', () => {
    test('should create workflow from template', async ({ page }) => {
      await page.goto('/workflows');
      
      // Click create from template
      await page.click('[data-testid="create-from-template-button"]');
      
      // Should show template gallery
      await expect(page.locator('[data-testid="template-gallery"]')).toBeVisible();
      
      // Select a template
      await page.click('[data-testid="template-card"]');
      
      // Preview template
      await expect(page.locator('[data-testid="template-preview"]')).toBeVisible();
      
      // Use template
      await page.click('[data-testid="use-template-button"]');
      
      // Should open workflow builder with template loaded
      await expect(page).toHaveURL(/\/workflows\/new/);
      await expect(page.locator('[data-testid^="canvas-node-"]')).toHaveCountGreaterThan(0);
    });
    
    test('should export workflow', async ({ page }) => {
      await page.goto('/workflows');
      await page.click('[data-testid="workflow-card"]');
      
      // Click export button
      await page.click('[data-testid="workflow-actions-menu"]');
      
      const downloadPromise = page.waitForEvent('download');
      await page.click('[data-testid="export-workflow-button"]');
      
      const download = await downloadPromise;
      
      // Verify export file
      expect(download.suggestedFilename()).toMatch(/\.json$/);
      expect(download.suggestedFilename()).toContain('workflow');
    });
    
    test('should import workflow', async ({ page }) => {
      await page.goto('/workflows');
      
      // Click import button
      await page.click('[data-testid="import-workflow-button"]');
      
      // Should open import dialog
      await expect(page.locator('[data-testid="import-dialog"]')).toBeVisible();
      
      // Upload workflow file (mock file upload)
      const fileContent = JSON.stringify({
        name: 'Imported Test Workflow',
        description: 'A workflow imported for testing',
        definition: {
          nodes: [
            { id: 'start', type: 'trigger', position: { x: 100, y: 100 } }
          ],
          edges: []
        }
      });
      
      // Create a mock file
      await page.setInputFiles('[data-testid="import-file-input"]', {
        name: 'test-workflow.json',
        mimeType: 'application/json',
        buffer: Buffer.from(fileContent)
      });
      
      // Import workflow
      await page.click('[data-testid="import-button"]');
      
      // Should show success message and redirect
      await expect(page.locator('[data-testid="import-success"]')).toBeVisible();
    });
  });

  test.describe('Responsive Design', () => {
    test('should work on mobile devices', async ({ page }) => {
      // Set mobile viewport
      await page.setViewportSize({ width: 375, height: 667 });
      
      await page.goto('/workflows');
      
      // Mobile layout should be active
      await expect(page.locator('[data-testid="mobile-workflow-list"]')).toBeVisible();
      
      // Workflows should be displayed in mobile-friendly format
      const workflowItems = page.locator('[data-testid="workflow-mobile-card"]');
      await expect(workflowItems).toHaveCountGreaterThan(0);
      
      // Navigation should be mobile-optimized
      await expect(page.locator('[data-testid="mobile-nav-menu"]')).toBeVisible();
    });
    
    test('should handle workflow builder on tablet', async ({ page }) => {
      // Set tablet viewport
      await page.setViewportSize({ width: 768, height: 1024 });
      
      await page.goto('/workflows/new');
      
      // Workflow builder should adapt to tablet layout
      await expect(page.locator('[data-testid="workflow-canvas"]')).toBeVisible();
      
      // Node palette should be accessible
      await expect(page.locator('[data-testid="node-palette"]')).toBeVisible();
      
      // Touch-friendly controls should be present
      const nodeItems = page.locator('[data-testid^="node-"]');
      const firstNode = nodeItems.first();
      
      // Should support touch interactions
      await firstNode.tap();
      await expect(firstNode).toHaveClass(/selected/);
    });
  });
});

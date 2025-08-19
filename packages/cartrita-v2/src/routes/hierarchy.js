// packages/backend/src/routes/hierarchy.js

import express from 'express';
import SupervisorRegistry from '../system/SupervisorRegistry.js';

const router = express.Router();

// Get hierarchical structure overview
router.get('/structure', (req, res) => {
  try {
    const hierarchyStatus = SupervisorRegistry.getHierarchyStatus();
    res.json({
      success: true,
      hierarchy: hierarchyStatus,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Get supervisors and their subordinates
router.get('/supervisors', (req, res) => {
  try {
    const supervisors = {};

    for (const [supervisorName, info] of SupervisorRegistry.supervisors) {
      supervisors[supervisorName] = {
        category: info.category,
        subordinates: info.subordinates,
        responsibilities: info.responsibilities,
        instance_registered:
          SupervisorRegistry.agentInstances.has(supervisorName),
      };
    }

    res.json({
      success: true,
      supervisors,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Get agent permissions and capabilities
router.get('/permissions', (req, res) => {
  try {
    const agentPermissions = {};

    for (const [agentName, instance] of SupervisorRegistry.agentInstances) {
      if (instance && instance.getStatus) {
        const status = instance.getStatus();
        agentPermissions[agentName] = {
          capabilities: status.capabilities || [],
          permissions: status.permissions || [],
          is_supervisor: instance.isSupervisor
            ? instance.isSupervisor()
            : false,
          supervisor: SupervisorRegistry.getSupervisor(agentName),
          status: status.isActive ? 'active' : 'inactive',
        };
      }
    }

    res.json({
      success: true,
      agent_permissions: agentPermissions,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Process a task through the hierarchical system
router.post('/process-task', async (req, res) => {
  try {
    const { task, sessionId } = req.body;

    if (!task) {
      return res.status(400).json({
        success: false,
        error: 'Task is required',
      });
    }

    const result = await SupervisorRegistry.processTask(task, sessionId);

    res.json({
      success: true,
      result,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Get agent hierarchy path (subordinate -> supervisor chain)
router.get('/agent/:agentName/hierarchy', (req, res) => {
  try {
    const { agentName } = req.params;
    const hierarchyPath = [];

    let currentAgent = agentName;
    while (currentAgent) {
      const supervisor = SupervisorRegistry.getSupervisor(currentAgent);
      hierarchyPath.push({
        agent: currentAgent,
        supervisor: supervisor,
        is_supervisor: SupervisorRegistry.supervisors.has(currentAgent),
      });
      currentAgent = supervisor;
    }

    res.json({
      success: true,
      agent: agentName,
      hierarchy_path: hierarchyPath,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

export default router;

export interface ExecutionLog {
  id?: string;
  level: 'info' | 'success' | 'warning' | 'error';
  message: string;
  timestamp: string;
  nodeId?: string;
  duration?: number;
  details?: string;
}

export interface WorkflowExecution {
  id: string;
  workflow_id: number;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  started_at: string;
  completed_at?: string;
  failed_at?: string;
  execution_logs: ExecutionLog[];
  result_data?: any;
  error_message?: string;
}

export interface NodeDefinition {
  type: string;
  name: string;
  icon: string;
  description: string;
  category: string;
  inputs?: NodeInput[];
  outputs?: NodeOutput[];
  config_schema?: any;
}

export interface NodeInput {
  name: string;
  type: string;
  required: boolean;
  description?: string;
}

export interface NodeOutput {
  name: string;
  type: string;
  description?: string;
}

export interface WorkflowTemplate {
  id: number;
  name: string;
  description: string;
  category: string;
  tags: string[];
  workflow_data: {
    nodes: any[];
    edges: any[];
  };
  preview_image?: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
}
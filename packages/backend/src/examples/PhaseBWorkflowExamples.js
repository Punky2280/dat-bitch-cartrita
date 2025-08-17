/**
 * 🚀 CARTRITA PHASE B WORKFLOW EXAMPLES
 * 
 * Example workflows demonstrating Phase B capabilities:
 * - Parallelism with dependency management
 * - Branching with conditional logic
 * - Loops with iteration controls
 * - Retries with exponential backoff
 * - Subworkflows with depth protection
 * - Expression evaluation and template interpolation
 */

export const exampleWorkflows = {
  // Simple parallel processing example
  parallelDataProcessing: {
    name: "Parallel Data Processing",
    description: "Process multiple data sources in parallel and merge results",
    definition: {
      nodes: [
        {
          id: "fetch_user_data",
          type: "http-request",
          config: {
            method: "GET",
            url: "https://jsonplaceholder.typicode.com/users/{{input.userId}}",
            headers: { "Accept": "application/json" }
          },
          connections: ["merge_data"]
        },
        {
          id: "fetch_user_posts",
          type: "http-request", 
          config: {
            method: "GET",
            url: "https://jsonplaceholder.typicode.com/users/{{input.userId}}/posts",
            headers: { "Accept": "application/json" }
          },
          connections: ["merge_data"]
        },
        {
          id: "merge_data",
          type: "data-transform",
          config: {
            transformation: {
              user: "{{fetch_user_data.data}}",
              posts: "{{fetch_user_posts.data}}",
              summary: {
                name: "{{fetch_user_data.data.name}}",
                postCount: "${fetch_user_posts.data.length}",
                hasWebsite: "${!!fetch_user_data.data.website}"
              }
            }
          },
          connections: []
        }
      ]
    }
  },

  // Branching with conditions example
  conditionalWorkflow: {
    name: "Conditional Processing",
    description: "Route data through different paths based on conditions",
    definition: {
      nodes: [
        {
          id: "analyze_data",
          type: "expression",
          config: {
            expression: "{ type: input.value > 100 ? 'large' : 'small', value: input.value }"
          },
          connections: ["route_data"]
        },
        {
          id: "route_data",
          type: "branch",
          config: {
            condition: "analyze_data.type === 'large'",
            trueBranch: {
              nodes: [
                {
                  id: "process_large_data",
                  type: "data-transform",
                  config: {
                    transformation: {
                      processedValue: "${input.value / 10}",
                      category: "large_item",
                      requiresApproval: true
                    }
                  }
                }
              ]
            },
            falseBranch: {
              nodes: [
                {
                  id: "process_small_data", 
                  type: "data-transform",
                  config: {
                    transformation: {
                      processedValue: "${input.value * 2}",
                      category: "small_item",
                      requiresApproval: false
                    }
                  }
                }
              ]
            }
          },
          connections: []
        }
      ]
    }
  }
};

// Example API responses showing Phase B execution
export const exampleAPIResponses = {
  workflowCreation: {
    url: "POST /api/v1/workflows",
    request: {
      name: "Parallel Data Processing",
      description: "Example of parallel processing",
      category: "data-processing",
      definition: exampleWorkflows.parallelDataProcessing.definition
    },
    response: {
      success: true,
      workflow: {
        id: 123,
        name: "Parallel Data Processing", 
        status: "active",
        created_at: "2024-01-01T10:00:00Z"
      },
      validation: {
        valid: true,
        errors: []
      }
    }
  },

  workflowExecution: {
    url: "POST /api/v1/workflows/123/execute",
    request: {
      inputData: { userId: 1 },
      dryRun: false,
      realTimeMonitoring: true
    },
    response: {
      success: true,
      executionId: "exec-uuid-123",
      result: {
        fetch_user_data: {
          status: 200,
          data: { id: 1, name: "John Doe", website: "john-doe.com" }
        },
        fetch_user_posts: {
          status: 200, 
          data: [
            { id: 1, title: "Post 1", body: "Content..." },
            { id: 2, title: "Post 2", body: "Content..." }
          ]
        },
        merge_data: {
          user: { id: 1, name: "John Doe", website: "john-doe.com" },
          posts: [
            { id: 1, title: "Post 1", body: "Content..." },
            { id: 2, title: "Post 2", body: "Content..." }
          ],
          summary: {
            name: "John Doe",
            postCount: 2,
            hasWebsite: true
          }
        }
      },
      isDryRun: false,
      executionTime: 1247,
      nodesExecuted: 3,
      logs: [
        { level: "info", message: "Workflow execution started", timestamp: "2024-01-01T10:00:00Z" },
        { level: "info", message: "Node fetch_user_data completed", timestamp: "2024-01-01T10:00:01Z" },
        { level: "info", message: "Node fetch_user_posts completed", timestamp: "2024-01-01T10:00:01Z" },
        { level: "info", message: "Node merge_data completed", timestamp: "2024-01-01T10:00:02Z" },
        { level: "success", message: "Workflow execution completed", timestamp: "2024-01-01T10:00:02Z" }
      ]
    }
  }
};

export default {
  exampleWorkflows,
  exampleAPIResponses
};
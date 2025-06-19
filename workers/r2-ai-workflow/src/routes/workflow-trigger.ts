import { OpenAPIHono, createRoute } from '@hono/zod-openapi';
import { WorkflowTriggerRequestSchema } from '../schemas/workflow-params';
import { ErrorResponseSchema } from '../schemas/common';
import { logger } from '../services/logger';
import { z } from 'zod';

const app = new OpenAPIHono<{ Bindings: Env }>();

const WorkflowTriggerResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  workflowId: z.string().optional(),
  workflowType: z.string().optional(),
  status: z.string().optional(),
});

const triggerWorkflowRoute = createRoute({
  method: 'post',
  path: '/workflow/trigger',
  tags: ['Workflow'],
  summary: 'Trigger a Cloudflare Workflow',
  description: `Starts a new Cloudflare Workflow instance. Only requires the initial parameters for each workflow type.

**Available Workflows:**

**\`upload-and-summarize\`** - Upload content to R2 and generate AI summary
- Required: \`key\`, \`content\`
- Optional: \`contentType\`, \`maxSummaryLength\`, \`language\`

**\`github-queue-fetchreadme-upload-summarize\`** - Fetch README from GitHub, upload to R2, summarize, and add to queue
- Required: \`githubUrl\`
- Optional: \`priority\`, \`maxSummaryLength\`, \`language\`

Each workflow handles its own internal steps automatically - you only need to provide the initial input parameters.`,
  request: {
    body: {
      content: {
        'application/json': {
          schema: WorkflowTriggerRequestSchema,
        },
      },
    },
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: WorkflowTriggerResponseSchema,
        },
      },
      description: 'Workflow triggered successfully',
    },
    400: {
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
      description: 'Invalid request data',
    },
    500: {
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
      description: 'Internal server error',
    },
  },
});

app.openapi(triggerWorkflowRoute, async (c) => {
  try {
    const body = c.req.valid('json');
    
    logger.info('Triggering workflow', { 
      workflowType: body.workflowType,
      params: body.params
    });

    // Determine which workflow to use based on type
    let workflowBinding;
    let params: any;

    switch (body.workflowType) {
      case 'upload-and-summarize':
        workflowBinding = c.env.UPLOAD_AND_SUMMARIZE_WORKFLOW;
        params = body.params;
        break;
      
      case 'github-queue-fetchreadme-upload-summarize':
        workflowBinding = c.env.GITHUB_QUEUE_FETCHREADME_UPLOAD_SUMMARIZE_WORKFLOW;
        params = body.params;
        break;
      
      default:
        return c.json({
          success: false as const,
          error: 'Invalid workflow type',
          details: `Supported workflow types: upload-and-summarize, github-queue-fetchreadme-upload-summarize`,
        }, 400);
    }

    if (!workflowBinding) {
      return c.json({
        success: false as const,
        error: `Workflow binding for ${body.workflowType} not configured`,
        details: `Please ensure the ${body.workflowType.toUpperCase().replace(/-/g, '_')}_WORKFLOW binding is configured in wrangler.toml`,
      }, 500);
    }

    // Create a new workflow instance
    const instance = await workflowBinding.create({ params });

    logger.info('Workflow instance created', { 
      workflowId: instance.id,
      workflowType: body.workflowType
    });

    return c.json({
      success: true,
      message: `${body.workflowType} workflow triggered successfully`,
      workflowId: instance.id,
      workflowType: body.workflowType,
      status: 'running',
    }, 200);
  } catch (error) {
    logger.error('Error triggering workflow', { error });
    
    return c.json({
      success: false as const,
      error: 'Failed to trigger workflow',
      details: error instanceof Error ? error.message : 'Unknown error',
    }, 500);
  }
});

const getWorkflowStatusRoute = createRoute({
  method: 'get',
  path: '/workflow/status/{workflowId}',
  tags: ['Workflow'],
  summary: 'Get workflow status',
  description: 'Get the current status of a running workflow instance',
  request: {
    params: z.object({
      workflowId: z.string(),
    }),
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({
            success: z.boolean(),
            workflowId: z.string(),
            status: z.any(),
          }),
        },
      },
      description: 'Workflow status retrieved successfully',
    },
    404: {
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
      description: 'Workflow not found',
    },
    500: {
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
      description: 'Internal server error',
    },
  },
});

app.openapi(getWorkflowStatusRoute, async (c) => {
  try {
    const { workflowId } = c.req.valid('param');
    
    // Try to get the workflow instance from available workflow bindings
    let instance;
    let foundWorkflow = false;
    
    const workflowBindings = [
      c.env.UPLOAD_AND_SUMMARIZE_WORKFLOW,
      c.env.GITHUB_QUEUE_FETCHREADME_UPLOAD_SUMMARIZE_WORKFLOW,
    ];
    
    for (const binding of workflowBindings) {
      if (binding) {
        try {
          instance = await binding.get(workflowId);
          foundWorkflow = true;
          break;
        } catch (error) {
          // Continue to next binding if this one doesn't have the workflow
          continue;
        }
      }
    }
    
    if (!foundWorkflow || !instance) {
      return c.json({
        success: false as const,
        error: 'Workflow not found',
      }, 404);
    }

    const status = await instance.status();

    return c.json({
      success: true,
      workflowId,
      status,
    }, 200);
  } catch (error) {
    logger.error('Error getting workflow status', { error });
    
    return c.json({
      success: false as const,
      error: 'Failed to get workflow status',
      details: error instanceof Error ? error.message : 'Unknown error',
    }, 500);
  }
});

export default app;

import { OpenAPIHono, createRoute } from '@hono/zod-openapi';
import { R2Service } from '../services/r2';
import { UploadFileSchema, UploadFileResponseSchema } from '../schemas/r2';
import { ErrorResponseSchema } from '../schemas/common';
import { logger } from '../services/logger';

const app = new OpenAPIHono<{ Bindings: Env }>();

const uploadFileRoute = createRoute({
  method: 'post',
  path: '/r2/upload',
  tags: ['R2 Storage'],
  summary: 'Upload file to R2 object storage',
  description: 'Uploads a file to Cloudflare R2 object storage with the specified key',
  request: {
    body: {
      content: {
        'application/json': {
          schema: UploadFileSchema,
        },
      },
    },
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: UploadFileResponseSchema,
        },
      },
      description: 'File uploaded successfully',
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

app.openapi(uploadFileRoute, async (c) => {
  try {
    const body = c.req.valid('json');
    const r2Service = new R2Service(c.env);
    
    logger.info('Processing R2 file upload request', { key: body.key });
    
    const result = await r2Service.uploadFile(body);
    
    if (result.success) {
      return c.json(result, 200);
    } else {
      return c.json({
        success: false as const,
        error: result.message,
      }, 500);
    }
  } catch (error) {
    logger.error('Error in R2 upload endpoint', { error });
    
    return c.json({
      success: false as const,
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error',
    }, 500);
  }
});

export default app;

import { OpenAPIHono, createRoute } from '@hono/zod-openapi';
import { AIService } from '../services/ai';
import { SummarizeContentSchema, SummarizeContentResponseSchema } from '../schemas/ai';
import { ErrorResponseSchema } from '../schemas/common';
import { logger } from '../services/logger';

const app = new OpenAPIHono<{ Bindings: Env }>();

const summarizeRoute = createRoute({
  method: 'post',
  path: '/ai/summarize',
  tags: ['AI'],
  summary: 'Summarize content using Workers AI',
  description: 'Uses Cloudflare Workers AI to generate a summary of the provided content',
  request: {
    body: {
      content: {
        'application/json': {
          schema: SummarizeContentSchema,
        },
      },
    },
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: SummarizeContentResponseSchema,
        },
      },
      description: 'Content summarized successfully',
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

app.openapi(summarizeRoute, async (c) => {
  try {
    const body = c.req.valid('json');
    const aiService = new AIService(c.env);
    
    logger.info('Processing AI summarization request', { 
      contentLength: body.content.length,
      maxLength: body.maxLength 
    });
    
    const result = await aiService.summarizeContent(body);
    
    if (result.success) {
      return c.json(result, 200);
    } else {
      return c.json({
        success: false as const,
        error: result.message,
      }, 500);
    }
  } catch (error) {
    logger.error('Error in AI summarize endpoint', { error });
    
    return c.json({
      success: false as const,
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error',
    }, 500);
  }
});

export default app;

import { OpenAPIHono } from '@hono/zod-openapi';
import { swaggerUI } from '@hono/swagger-ui';
import { logger } from './services/logger';
import { HealthResponseSchema } from './schemas/common';

// Import route modules
import githubRoutes from './routes/github';
import r2Routes from './routes/r2';
import aiRoutes from './routes/ai';
import workflowTriggerRoutes from './routes/workflow-trigger';

// Create the main app
const app = new OpenAPIHono<{ Bindings: Env }>();

// Add request logging middleware
app.use('*', async (c, next) => {
  const start = Date.now();
  const method = c.req.method;
  const url = c.req.url;
  
  logger.info('Incoming request', { method, url });
  
  await next();
  
  const duration = Date.now() - start;
  const status = c.res.status;
  
  logger.info('Request completed', { method, url, status, duration });
});

// Health check endpoint
app.get('/health', (c) => {
  const response = {
    status: 'ok' as const,
    timestamp: new Date().toISOString(),
    version: '1.0.0',
  };
  
  return c.json(response);
});

// Mount API routes under /api
app.route('/api', githubRoutes);
app.route('/api', r2Routes);
app.route('/api', aiRoutes);
app.route('/api', workflowTriggerRoutes);

// OpenAPI documentation
app.doc('/api/openapi.json', {
  openapi: '3.0.0',
  info: {
    version: '1.0.0',
    title: 'R2 AI Workflow API',
    description: 'A Cloudflare Workers API for managing GitHub repositories, R2 storage, and AI workflows',
  }
});

// Swagger UI
app.get('/docs', swaggerUI({ url: '/api/openapi.json' }));

// Root redirect to docs
app.get('/', (c) => {
  return c.redirect('/docs');
});

// 404 handler
app.notFound((c) => {
  logger.warn('Route not found', { path: c.req.path, method: c.req.method });
  
  return c.json({
    success: false as const,
    error: 'Route not found',
    details: `${c.req.method} ${c.req.path} is not a valid endpoint`,
  }, 404);
});

// Error handler
app.onError((err, c) => {
  logger.error('Unhandled error', { error: err, path: c.req.path, method: c.req.method });
  
  return c.json({
    success: false as const,
    error: 'Internal server error',
    details: err.message,
  }, 500);
});

// Import and export all workflows
export { UploadAndSummarizeW } from './workflows/UploadAndSummarizeW';

// GitHub-specific workflows
export { GitHubQueueFetchreadmeUploadSummarizeW } from './workflows/GitHubQueueFetchreadmeUploadSummarizeW';

// Export the default handler
export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    return app.fetch(request, env, ctx);
  },
};

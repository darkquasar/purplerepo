import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import { GitHubQueueService } from '../services/github-queue';
import { GitHubReadmeService } from '../services/github-readme';
import { AddGithubRepoSchema, GithubRepoResponseSchema } from '../schemas/github';
import { ErrorResponseSchema } from '../schemas/common';
import { logger } from '../services/logger';

const app = new OpenAPIHono<{ Bindings: Env }>();

const addRepoRoute = createRoute({
  method: 'post',
  path: '/queues/add-repo',
  tags: ['GitHub'],
  summary: 'Add GitHub repository to processing queue',
  description: 'Adds a GitHub repository URL to the Cloudflare queue for processing',
  request: {
    query: AddGithubRepoSchema,
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: GithubRepoResponseSchema,
        },
      },
      description: 'Repository successfully added to queue',
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

app.openapi(addRepoRoute, async (c) => {
  try {
    const query = c.req.valid('query');
    const githubService = new GitHubQueueService(c.env);
    
    logger.info('Processing GitHub repository addition request', { url: query.url });
    
    const result = await githubService.addRepository(query);
    
    if (result.success) {
      return c.json(result, 200);
    } else {
      return c.json({
        success: false as const,
        error: result.message,
      }, 500);
    }
  } catch (error) {
    logger.error('Error in GitHub add-repo endpoint', { error });
    
    return c.json({
      success: false as const,
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error',
    }, 500);
  }
});

// Schema for GitHub README fetch request
const GitHubReadmeFetchSchema = z.object({
  url: z.string().url().describe('GitHub repository URL'),
});

// Schema for successful README response
const GitHubReadmeResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    repo_url: z.string().describe('Repository URL'),
    download_url: z.string().describe('Download URL of the README file'),
    size: z.number().describe('Size of the README file in bytes'),
    content: z.string().describe('Content of the README file'),
    name: z.string().describe('Name of the README file'),
    sha: z.string().describe('SHA hash of the file'),
  }),
});

// Schema for README not found response
const GitHubReadmeNotFoundSchema = z.object({
  success: z.literal(true),
  data: z.object({
    repo_url: z.string().describe('Repository URL'),
    exists: z.literal(false),
    message: z.string().describe('Message explaining why README was not found'),
  }),
});

const fetchReadmeRoute = createRoute({
  method: 'get',
  path: '/github/fetch-readme',
  tags: ['GitHub'],
  summary: 'Fetch README from GitHub repository',
  description: 'Checks if a README.md file exists in the main branch of a GitHub repository and fetches its content if available',
  request: {
    query: GitHubReadmeFetchSchema,
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.union([GitHubReadmeResponseSchema, GitHubReadmeNotFoundSchema]),
        },
      },
      description: 'README fetch result (either found with content or not found)',
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

app.openapi(fetchReadmeRoute, async (c) => {
  try {
    const query = c.req.valid('query');
    const githubService = new GitHubReadmeService(c.env);
    
    logger.info('Processing GitHub README fetch request', { url: query.url });
    
    const result = await githubService.fetchReadme(query.url);
    
    return c.json(result, 200);
  } catch (error) {
    logger.error('Error in GitHub fetch-readme endpoint', { error });
    
    return c.json({
      success: false as const,
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error',
    }, 500);
  }
});

export default app;

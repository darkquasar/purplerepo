import { z } from 'zod';

export const AddGithubRepoSchema = z.object({
  url: z.string().url().describe('GitHub repository URL'),
  priority: z.enum(['low', 'medium', 'high']).default('medium').describe('Queue priority'),
  payload: z.record(z.any()).optional().describe('Optional payload data to include with the queue message'),
});

export type AddGithubRepoRequest = z.infer<typeof AddGithubRepoSchema>;

export const GithubRepoResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  queueId: z.string().optional(),
});

export type GithubRepoResponse = z.infer<typeof GithubRepoResponseSchema>;

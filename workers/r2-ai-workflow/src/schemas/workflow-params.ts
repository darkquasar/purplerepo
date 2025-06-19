import { z } from 'zod';

// Upload and Summarize Workflow - requires content to upload and summarize
export const UploadAndSummarizeParamsSchema = z.object({
  key: z.string().min(1, 'Key is required'),
  content: z.string().min(1, 'Content is required'),
  contentType: z.string().optional(),
  maxSummaryLength: z.number().min(10).max(1000).default(200).optional(),
  language: z.string().default('en').optional(),
}).describe('Parameters for upload-and-summarize workflow');

// GitHub Queue Fetch README Upload Summarize Workflow - only requires GitHub URL
export const GitHubQueueFetchreadmeUploadSummarizeParamsSchema = z.object({
  githubUrl: z.string().url('Must be a valid GitHub repository URL'),
  priority: z.enum(['low', 'medium', 'high']).default('medium').optional(),
  maxSummaryLength: z.number().min(10).max(1000).default(200).optional(),
  language: z.string().default('en').optional(),
}).describe('Parameters for github-queue-fetchreadme-upload-summarize workflow');

// Workflow trigger request schema
export const WorkflowTriggerRequestSchema = z.discriminatedUnion('workflowType', [
  z.object({
    workflowType: z.literal('upload-and-summarize'),
    params: UploadAndSummarizeParamsSchema,
  }),
  z.object({
    workflowType: z.literal('github-queue-fetchreadme-upload-summarize'),
    params: GitHubQueueFetchreadmeUploadSummarizeParamsSchema,
  }),
]).openapi({
  example: {
    workflowType: "github-queue-fetchreadme-upload-summarize",
    params: {
      githubUrl: "https://github.com/owner/repository",
      priority: "medium",
      maxSummaryLength: 200,
      language: "en"
    }
  }
});

export type WorkflowTriggerRequest = z.infer<typeof WorkflowTriggerRequestSchema>;
export type UploadAndSummarizeParams = z.infer<typeof UploadAndSummarizeParamsSchema>;
export type GitHubQueueFetchreadmeUploadSummarizeParams = z.infer<typeof GitHubQueueFetchreadmeUploadSummarizeParamsSchema>;

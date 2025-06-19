import { z } from 'zod';

// Define available workflow types
export const WorkflowTypeSchema = z.enum([
  'upload-and-summarize',
  // GitHub-specific workflows
  'github-upload-and-summarize',
  'github-upload-only',
  'github-summarize-only',
  'github-fetch-and-process'
], {
  description: 'Type of workflow to execute. GitHub workflows are specifically designed for processing GitHub README content.'
});

// Define component schemas
export const UploadToR2ComponentSchema = z.object({
  key: z.string().min(1, 'Key is required'),
  content: z.string().min(1, 'Content is required'),
  contentType: z.string().optional(),
}).describe('Upload file to R2 storage');

export const SummarizeContentComponentSchema = z.object({
  content: z.string().min(1, 'Content is required'),
  maxLength: z.number().min(10).max(1000).default(200),
  language: z.string().default('en'),
}).describe('Summarize content using AI');

export const AddToGithubQueueComponentSchema = z.object({
  url: z.string().url('Must be a valid GitHub URL'),
  priority: z.enum(['low', 'medium', 'high']).default('medium'),
}).describe('Add GitHub repository to processing queue');

export const GitHubFetchComponentSchema = z.object({
  githubUrl: z.string().url('Must be a valid GitHub repository URL'),
  action: z.enum(['upload', 'summarize', 'both']).default('both'),
  maxSummaryLength: z.number().min(10).max(1000).default(200).optional(),
  language: z.string().default('en').optional(),
}).describe('Fetch README from GitHub repository and process it');

// Define the main workflow request schema with nested components
export const WorkflowRequestSchema = z.object({
  workflowType: WorkflowTypeSchema,
  components: z.object({
    'upload-to-r2': UploadToR2ComponentSchema.optional(),
    'summarize-content': SummarizeContentComponentSchema.optional(),
    'add-to-github-queue': AddToGithubQueueComponentSchema.optional(),
    'github-fetch': GitHubFetchComponentSchema.optional(),
  }),
}).refine((data) => {
  // Validation based on workflow type to ensure required components are present
  const { workflowType, components } = data;
  
  if (workflowType === 'upload-and-summarize') {
    return components['upload-to-r2'] && components['summarize-content'];
  }
  // GitHub-specific workflows
  if (workflowType === 'github-upload-and-summarize') {
    return components['upload-to-r2'] && components['summarize-content'];
  }
  if (workflowType === 'github-upload-only') {
    return components['upload-to-r2'];
  }
  if (workflowType === 'github-summarize-only') {
    return components['summarize-content'];
  }
  if (workflowType === 'github-fetch-and-process') {
    return components['github-fetch'];
  }
  return true;
}, {
  message: 'Required components missing for selected workflow type',
});

export type WorkflowRequest = z.infer<typeof WorkflowRequestSchema>;

export const WorkflowResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  uploadResult: z.object({
    key: z.string(),
    url: z.string().optional(),
  }).optional(),
  summaryResult: z.object({
    summary: z.string(),
    originalLength: z.number(),
    summaryLength: z.number(),
  }).optional(),
});

export type WorkflowResponse = z.infer<typeof WorkflowResponseSchema>;

import { z } from 'zod';

export const SummarizeContentSchema = z.object({
  content: z.string().min(1).describe('Content to summarize'),
  maxLength: z.number().min(50).max(1000).default(200).describe('Maximum length of summary in words'),
  language: z.string().default('en').describe('Language for the summary'),
});

export type SummarizeContentRequest = z.infer<typeof SummarizeContentSchema>;

export const SummarizeContentResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  summary: z.string().optional(),
  originalLength: z.number().optional(),
  summaryLength: z.number().optional(),
});

export type SummarizeContentResponse = z.infer<typeof SummarizeContentResponseSchema>;

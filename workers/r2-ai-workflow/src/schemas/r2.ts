import { z } from 'zod';

export const UploadFileSchema = z.object({
  key: z.string().min(1).describe('File key/path in R2 storage'),
  content: z.string().describe('File content (base64 encoded for binary files)'),
  contentType: z.string().optional().describe('MIME type of the file'),
});

export type UploadFileRequest = z.infer<typeof UploadFileSchema>;

export const UploadFileResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  key: z.string().optional(),
  url: z.string().optional(),
  etag: z.string().optional(),
  size: z.number().optional(),
  bucketName: z.string().optional(),
});

export type UploadFileResponse = z.infer<typeof UploadFileResponseSchema>;

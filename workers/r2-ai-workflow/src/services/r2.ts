import { logger } from './logger';
import type { UploadFileRequest, UploadFileResponse } from '../schemas/r2';

export class R2Service {
  constructor(private env: Env) {}

  async uploadFile(request: UploadFileRequest, bucketType: 'main' | 'summary' = 'main'): Promise<UploadFileResponse> {
    try {
      logger.info('Uploading file to R2', { key: request.key, contentType: request.contentType, bucketType });

      // Select the appropriate bucket
      let bucket: R2Bucket;
      let bucketName: string;
      let urlPrefix: string;

      if (bucketType === 'summary') {
        if (!this.env.R2_BUCKET_SUMMARY) {
          throw new Error('R2 summary bucket binding not configured');
        }
        bucket = this.env.R2_BUCKET_SUMMARY;
        bucketName = 'R2_BUCKET_SUMMARY';
        urlPrefix = 'https://TBD'; // As requested in feedback
      } else {
        if (!this.env.R2_BUCKET) {
          throw new Error('R2 main bucket binding not configured');
        }
        bucket = this.env.R2_BUCKET;
        bucketName = 'R2_BUCKET';
        urlPrefix = 'https://TBD'; // Standardized as requested
      }

      // Convert content to appropriate format
      let content: string | ArrayBuffer | ReadableStream;
      
      if (request.contentType && request.contentType.startsWith('text/')) {
        // Text content
        content = request.content;
      } else {
        // Binary content - decode base64
        try {
          const binaryString = atob(request.content);
          const bytes = new Uint8Array(binaryString.length);
          for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }
          content = bytes.buffer;
        } catch (error) {
          // If base64 decode fails, treat as text
          content = request.content;
        }
      }

      // Upload to R2
      const result = await bucket.put(request.key, content, {
        httpMetadata: {
          contentType: request.contentType || 'application/octet-stream',
        },
      });

      logger.info('Successfully uploaded file to R2', { 
        key: request.key, 
        etag: result.etag,
        size: result.size,
        bucketType,
        bucketName
      });

      return {
        success: true,
        message: 'File uploaded successfully',
        key: request.key,
        url: `${urlPrefix}/${request.key}`,
        etag: result.etag,
        size: result.size,
        bucketName,
      };
    } catch (error) {
      logger.error('Failed to upload file to R2', { error, key: request.key, bucketType });
      
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  async getFile(key: string): Promise<ReadableStream | null> {
    try {
      if (!this.env.R2_BUCKET) {
        throw new Error('R2 bucket binding not configured');
      }

      const object = await this.env.R2_BUCKET.get(key);
      return object?.body || null;
    } catch (error) {
      logger.error('Failed to get file from R2', { error, key });
      return null;
    }
  }

  async deleteFile(key: string): Promise<boolean> {
    try {
      if (!this.env.R2_BUCKET) {
        throw new Error('R2 bucket binding not configured');
      }

      await this.env.R2_BUCKET.delete(key);
      logger.info('Successfully deleted file from R2', { key });
      return true;
    } catch (error) {
      logger.error('Failed to delete file from R2', { error, key });
      return false;
    }
  }
}

import {
  WorkflowEntrypoint,
  WorkflowEvent,
  WorkflowStep,
} from "cloudflare:workers";
import { logger } from '../services/logger';
import { R2Service } from '../services/r2';
import { AIService } from '../services/ai';

// User-defined params for upload and summarize workflow
type Params = {
  key: string;
  content: string;
  contentType?: string;
  maxSummaryLength?: number;
  language?: string;
};

export class UploadAndSummarizeW extends WorkflowEntrypoint<Env, Params> {
  async run(event: WorkflowEvent<Params>, step: WorkflowStep) {
    const { key, content, contentType, maxSummaryLength, language } = event.payload;
    
    logger.info('Starting upload and summarize workflow', { 
      instanceId: event.instanceId,
      key,
      contentLength: content.length 
    });

    // Step 1: Upload file to R2
    const uploadResult = await step.do("upload-to-r2", async () => {
      const r2Service = new R2Service(this.env);
      const result = await r2Service.uploadFile({
        key,
        content,
        contentType,
      });
      
      logger.info('Upload step completed', { success: result.success, key });
      return result;
    });

    if (!uploadResult.success) {
      throw new Error(`Upload failed: ${uploadResult.message}`);
    }

    // Step 2: Summarize content with AI
    const summaryResult = await step.do("summarize-content", async () => {
      const aiService = new AIService(this.env);
      const result = await aiService.summarizeContent({
        content,
        maxLength: maxSummaryLength || 200,
        language: language || 'en',
      });
      
      logger.info('Summarization step completed', { success: result.success });
      return result;
    });

    if (!summaryResult.success) {
      throw new Error(`Summarization failed: ${summaryResult.message}`);
    }

    // Step 3: Final processing
    const finalResult = await step.do("finalize-workflow", async () => {
      logger.info('Upload and summarize workflow completed successfully', {
        instanceId: event.instanceId,
        key: uploadResult.key,
        originalLength: summaryResult.originalLength,
        summaryLength: summaryResult.summaryLength,
      });

      return {
        success: true,
        uploadResult: {
          key: uploadResult.key!,
          url: uploadResult.url,
        },
        summaryResult: {
          summary: summaryResult.summary!,
          originalLength: summaryResult.originalLength!,
          summaryLength: summaryResult.summaryLength!,
        },
      };
    });

    return finalResult;
  }
}

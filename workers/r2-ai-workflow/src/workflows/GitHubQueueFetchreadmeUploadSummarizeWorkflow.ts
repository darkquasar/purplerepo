import {
  WorkflowEntrypoint,
  WorkflowEvent,
  WorkflowStep,
} from "cloudflare:workers";
import { logger } from '../services/logger';
import { GitHubQueueService } from '../services/github-queue';
import { GitHubReadmeService } from '../services/github-readme';
import { R2Service } from '../services/r2';
import { AIService } from '../services/ai';

type Params = {
  githubUrl: string;
  priority?: 'low' | 'medium' | 'high';
  maxSummaryLength?: number;
  language?: string;
};

export class GitHubQueueFetchreadmeUploadSummarizeW extends WorkflowEntrypoint<Env, Params> {
  async run(event: WorkflowEvent<Params>, step: WorkflowStep) {
    const { githubUrl, priority = 'medium', maxSummaryLength, language } = event.payload;
    
    logger.info('Starting GitHub fetch-readme-upload-summarize workflow', { 
      instanceId: event.instanceId,
      githubUrl,
      priority
    });

    // Step 1: Fetch README content from GitHub
    const fetchResult = await step.do("fetch-github-readme", async () => {
      const githubService = new GitHubReadmeService(this.env);
      const result = await githubService.fetchReadme(githubUrl);
      
      logger.info('GitHub README fetch completed', { 
        success: result.success, 
        exists: 'data' in result ? ('exists' in result.data ? result.data.exists : true) : false,
        url: githubUrl
      });
      
      return result;
    });

    // Check if README was found
    if (!fetchResult.success || ('exists' in fetchResult.data && !fetchResult.data.exists)) {
      const message = 'exists' in fetchResult.data ? fetchResult.data.message : 'Failed to fetch README';
      logger.info('No README found or fetch failed', { message });
      
      return {
        success: true,
        message: `No processing needed: ${message}`,
        fetchResult
      };
    }

    // Extract content and metadata
    const readmeData = fetchResult.data as {
      repo_url: string;
      download_url: string;
      size: number;
      content: string;
      name: string;
      sha: string;
    };

    const content = readmeData.content;
    const repoPath = readmeData.repo_url.replace('https://github.com/', '').replace('/', '_');

    // Extract owner and repo for summary filename
    const urlParts = readmeData.repo_url.replace('https://github.com/', '').split('/');
    const owner = urlParts[0];
    const repo = urlParts[1];
    const readmeKey = `${owner}_${repo}.md`;

    // Step 2: Upload README contents to R2 (main bucket)
    const uploadResult = await step.do("upload-readme-to-r2", async () => {
      const r2Service = new R2Service(this.env);
      const result = await r2Service.uploadFile({
        key: readmeKey,
        content,
        contentType: 'text/markdown',
      }, 'main');
      
      logger.info('README upload step completed', { success: result.success, key: readmeKey });
      return result;
    });

    if (!uploadResult.success) {
      throw new Error(`README upload failed: ${uploadResult.message}`);
    }

    // Step 3: Summarize the README content using AI service
    const summaryResult = await step.do("summarize-readme-content", async () => {
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

    // Step 4: Upload summary to R2 (summary bucket)
    const summaryUploadResult = await step.do("upload-summary-to-r2", async () => {
      const summaryKey = `${owner}_${repo}_summary.md`;
      const r2Service = new R2Service(this.env);
      const result = await r2Service.uploadFile({
        key: summaryKey,
        content: summaryResult.summary!,
        contentType: 'text/markdown',
      }, 'summary');
      
      logger.info('Summary upload step completed', { success: result.success, key: summaryKey });
      return result;
    });

    if (!summaryUploadResult.success) {
      throw new Error(`Summary upload failed: ${summaryUploadResult.message}`);
    }

    // Step 5: Add to queue with results (moved to last step)
    const queueResult = await step.do("add-to-github-queue", async () => {
      const queueService = new GitHubQueueService(this.env);
      
      const payload = {
        uploadResults: {
          key: uploadResult.key!,
          url: uploadResult.url,
          etag: uploadResult.etag,
          size: uploadResult.size,
          bucketName: uploadResult.bucketName,
        },
        summaryUploadResults: {
          key: summaryUploadResult.key!,
          url: summaryUploadResult.url,
          etag: summaryUploadResult.etag,
          size: summaryUploadResult.size,
          bucketName: summaryUploadResult.bucketName,
        },
        summaryResults: {
          originalLength: summaryResult.originalLength!,
          summaryLength: summaryResult.summaryLength!,
          // Note: not including actual summary content as requested
        },
      };

      const result = await queueService.addRepository({
        url: githubUrl,
        priority,
        payload
      });
      
      logger.info('GitHub URL added to queue with payload', { 
        success: result.success, 
        queueId: result.queueId,
        url: githubUrl,
        payload: JSON.stringify(payload)
      });
      
      return { ...result, payload };
    });

    if (!queueResult.success) {
      throw new Error(`Failed to add URL to queue: ${queueResult.message}`);
    }

    // Final result
    const finalResult = await step.do("finalize-workflow", async () => {
      logger.info('GitHub fetch-readme-upload-summarize workflow completed successfully', {
        instanceId: event.instanceId,
        githubUrl,
        queueId: queueResult.queueId,
        readmeSize: readmeData.size,
        uploadKey: uploadResult.key,
        summaryKey: summaryUploadResult.key,
        summaryLength: summaryResult.summaryLength,
      });

      return {
        success: true,
        githubUrl: readmeData.repo_url,
        readmeInfo: {
          name: readmeData.name,
          size: readmeData.size,
          sha: readmeData.sha,
          downloadUrl: readmeData.download_url,
        },
        uploadResult: {
          key: uploadResult.key!,
          url: uploadResult.url,
          bucketName: uploadResult.bucketName,
        },
        summaryResult: {
          summary: summaryResult.summary!,
          originalLength: summaryResult.originalLength!,
          summaryLength: summaryResult.summaryLength!,
        },
        summaryUploadResult: {
          key: summaryUploadResult.key!,
          url: summaryUploadResult.url,
          bucketName: summaryUploadResult.bucketName,
        },
        queueResult: {
          queueId: queueResult.queueId,
          message: queueResult.message,
          payload: queueResult.payload,
        },
      };
    });

    return finalResult;
  }
}

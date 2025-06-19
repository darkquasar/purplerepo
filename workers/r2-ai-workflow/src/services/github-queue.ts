import { logger } from './logger';
import type { AddGithubRepoRequest, GithubRepoResponse } from '../schemas/github';

export class GitHubQueueService {
  constructor(private env: Env) {}

  async addRepository(request: AddGithubRepoRequest): Promise<GithubRepoResponse> {
    try {
      logger.info('Adding GitHub repository to queue', { url: request.url, priority: request.priority });

      if (!this.env.GITHUB_QUEUE) {
        throw new Error('GitHub queue binding not configured');
      }

      // Create a unique queue ID
      const queueId = crypto.randomUUID();
      
      // Send message to Cloudflare Queue
      await this.env.GITHUB_QUEUE.send({
        id: queueId,
        url: request.url,
        priority: request.priority,
        timestamp: new Date().toISOString(),
        ...(request.payload && { payload: request.payload }),
      });

      logger.info('Successfully added repository to queue', { queueId, url: request.url });

      return {
        success: true,
        message: 'Repository successfully added to processing queue',
        queueId,
      };
    } catch (error) {
      logger.error('Failed to add repository to queue', { error, url: request.url });
      
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }
}

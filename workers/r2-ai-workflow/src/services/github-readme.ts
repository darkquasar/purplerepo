import { logger } from './logger';

export class GitHubReadmeService {
  private env: Env;

  constructor(env: Env) {
    this.env = env;
  }

  async fetchReadme(githubUrl: string): Promise<{
    success: true;
    data: {
      repo_url: string;
      download_url: string;
      size: number;
      content: string;
      name: string;
      sha: string;
    };
  } | {
    success: true;
    data: {
      repo_url: string;
      exists: false;
      message: string;
    };
  }> {
    try {
      // Clean GitHub URL by removing parameters
      const cleanUrl = this.cleanGitHubUrl(githubUrl);
      
      // Skip GitHub Gists
      if (cleanUrl.startsWith('https://gist.github.com')) {
        logger.info(`Skipping GitHub Gist: ${cleanUrl}`);
        return {
          success: true,
          data: {
            repo_url: cleanUrl,
            exists: false,
            message: 'GitHub Gists are not supported'
          }
        };
      }

      logger.info(`Fetching README for: ${cleanUrl}`);

      // Parse the GitHub URL to extract owner and repo
      const url = new URL(cleanUrl);
      const pathParts = url.pathname.split('/').filter(part => part.length > 0);
      
      if (pathParts.length < 2) {
        throw new Error('Invalid GitHub URL format');
      }
      
      const owner = pathParts[0];
      const repo = pathParts[1];
      
      // Get GitHub PAT from environment
      const githubToken = this.env?.GITHUB_PAT_PUBLIC;
      if (!githubToken) {
        throw new Error('GitHub PAT not found in environment variables');
      }

      // Check if README exists in main branch
      const readmeInfo = await this.checkReadmeExists(owner, repo, githubToken);
      
      if (!readmeInfo.exists) {
        logger.info(`No README found for repository: ${cleanUrl}`);
        return {
          success: true,
          data: {
            repo_url: cleanUrl,
            exists: false,
            message: readmeInfo.message || 'No README file found in this repository'
          }
        };
      }

      // Fetch README content
      const readmeContent = await this.fetchReadmeContent(owner, repo, readmeInfo.name!, githubToken);
      
      logger.info(`Successfully fetched README: ${readmeContent.name}`);
      
      return {
        success: true,
        data: {
          repo_url: cleanUrl,
          download_url: readmeContent.download_url,
          size: readmeContent.size,
          content: readmeContent.content,
          name: readmeContent.name,
          sha: readmeContent.sha
        }
      };

    } catch (error) {
      logger.error(`Failed to fetch README for ${githubUrl}`, { error });
      throw error;
    }
  }

  private async checkReadmeExists(owner: string, repo: string, githubToken: string): Promise<{
    exists: boolean;
    name?: string;
    message?: string;
  }> {
    try {
      logger.info(`Checking README for ${owner}/${repo}`);
      
      // Use GitHub API to get repository contents for main branch
      const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents?ref=main`;
      
      const response = await fetch(apiUrl, {
        headers: {
          'User-Agent': 'Cloudflare-Worker',
          'Accept': 'application/vnd.github.v3+json',
          'Authorization': `Bearer ${githubToken}`
        }
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        
        if (response.status === 404) {
          const errorData = this.parseGitHubError(errorText);
          
          if (errorData?.message?.includes('No commit found for the ref')) {
            return {
              exists: false,
              message: 'Repository does not have a main branch'
            };
          }
          
          if (errorData?.message?.includes('Not Found')) {
            return {
              exists: false,
              message: 'Repository not found or not accessible'
            };
          }
        }
        
        throw new Error(`GitHub API error: ${response.status} ${response.statusText} - ${errorText}`);
      }
      
      const contents = await response.json() as any[];
      logger.info(`Found ${contents.length} files in root directory`);
      
      // Find README file
      const readmeFile = contents.find(file => {
        if (file.type !== 'file') return false;
        
        const fileName = file.name.toLowerCase();
        
        // Match various README patterns
        return fileName === 'readme' ||
               fileName.startsWith('readme.') ||
               fileName === 'readme.md' ||
               fileName === 'readme.txt' ||
               fileName === 'readme.rst';
      });
      
      if (!readmeFile) {
        logger.info(`No README file found in main branch`);
        return {
          exists: false,
          message: 'No README file found in the main branch'
        };
      }
      
      logger.info(`Found README file: ${readmeFile.name}`);
      
      return {
        exists: true,
        name: readmeFile.name
      };
      
    } catch (error) {
      logger.error(`Error checking README existence`, { error });
      throw error;
    }
  }

  private async fetchReadmeContent(owner: string, repo: string, readmeName: string, githubToken: string): Promise<{
    name: string;
    sha: string;
    size: number;
    download_url: string;
    content: string;
  }> {
    try {
      logger.info(`Fetching content for ${owner}/${repo}/${readmeName}`);
      
      // Use GitHub API to get the file contents
      const fileApiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${readmeName}?ref=main`;
      
      const fileResponse = await fetch(fileApiUrl, {
        headers: {
          'User-Agent': 'Cloudflare-Worker',
          'Accept': 'application/vnd.github.v3+json',
          'Authorization': `Bearer ${githubToken}`
        }
      });
      
      if (!fileResponse.ok) {
        const errorText = await fileResponse.text();
        throw new Error(`Failed to fetch README content: ${fileResponse.status} ${fileResponse.statusText} - ${errorText}`);
      }
      
      const fileData = await fileResponse.json() as any;
      
      // Convert base64 content to text
      const content = atob(fileData.content.replace(/\s/g, ''));
      
      logger.info(`Successfully fetched README content: ${fileData.name} (${fileData.size} bytes)`);
      
      return {
        name: fileData.name,
        sha: fileData.sha,
        size: fileData.size,
        download_url: fileData.download_url,
        content: content
      };
      
    } catch (error) {
      logger.error(`Error fetching README content`, { error });
      throw error;
    }
  }

  private cleanGitHubUrl(url: string): string {
    try {
      const parsedUrl = new URL(url);
      // Remove query parameters like ?tab=readme-ov-file
      parsedUrl.search = '';
      return parsedUrl.toString();
    } catch (error) {
      // If URL parsing fails, return original URL
      return url;
    }
  }

  private parseGitHubError(errorText: string): { message?: string; status?: string } | null {
    try {
      return JSON.parse(errorText);
    } catch {
      return null;
    }
  }
}

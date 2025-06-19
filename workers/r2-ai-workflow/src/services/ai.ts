import { logger } from './logger';
import type { SummarizeContentRequest, SummarizeContentResponse } from '../schemas/ai';

export class AIService {
  constructor(private env: Env) {}

  async summarizeContent(request: SummarizeContentRequest): Promise<SummarizeContentResponse> {
    try {
      logger.info('Summarizing content with AI', { 
        contentLength: request.content.length,
        maxLength: request.maxLength,
        language: request.language 
      });

      if (!this.env.AI) {
        throw new Error('AI binding not configured');
      }

      // Count words in original content
      const originalWordCount = this.countWords(request.content);

      // Prepare the prompt for summarization
      const userPrompt = `Please summarize the following content in ${request.language} language. Keep the summary to approximately ${request.maxLength} words or less while preserving the key information and main points. Do not include any additional commentary or analysis. The summary should be given straight away, without any preamble or introductory phrases. Here is the content to summarize:\n

${request.content}`;

      const systemPrompt = `You are an AI assistant specialized in summarizing text content. Your task is to create concise summaries that capture the essence of the original text while adhering to the specified word limit. Do not include any additional commentary or analysis. Focus solely on the content provided by the user. Avoid using preamble or introductory phrases. Do not add any additional information at the beginning or end of the summary. Only provide the summary directly at the beginning of your response.`;

      // Construct the messages array
      const messages = [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ];

      // Call Workers AI for text generation
      const response = await this.env.AI.run('@cf/meta/llama-3.2-1b-instruct', {
        messages,
        max_tokens: Math.min(request.maxLength * 2, 1000), // Allow some buffer for tokens vs words
        temperature: 0.3, // Lower temperature for more focused summaries
      });

      if (!response || typeof response !== 'object' || !('response' in response)) {
        throw new Error('Invalid response from AI service');
      }

      const summary = (response as { response: string }).response;
      const summaryWordCount = this.countWords(summary);

      logger.info('Successfully generated summary', { 
        originalWords: originalWordCount,
        summaryWords: summaryWordCount,
        compressionRatio: originalWordCount / summaryWordCount
      });

      return {
        success: true,
        message: 'Content summarized successfully',
        summary,
        originalLength: originalWordCount,
        summaryLength: summaryWordCount,
      };
    } catch (error) {
      logger.error('Failed to summarize content', { error, contentLength: request.content.length });
      
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  private countWords(text: string): number {
    return text.trim().split(/\s+/).filter(word => word.length > 0).length;
  }

  async translateContent(content: string, targetLanguage: string, sourceLanguage?: string): Promise<string> {
    try {
      if (!this.env.AI) {
        throw new Error('AI binding not configured');
      }

      const response = await this.env.AI.run('@cf/meta/m2m100-1.2b', {
        text: content,
        target_lang: targetLanguage,
        source_lang: sourceLanguage,
      });

      if (!response || typeof response !== 'object' || !('translated_text' in response)) {
        throw new Error('Invalid response from translation service');
      }

      return (response as { translated_text: string }).translated_text;
    } catch (error) {
      logger.error('Failed to translate content', { error, targetLanguage, sourceLanguage });
      throw error;
    }
  }
}

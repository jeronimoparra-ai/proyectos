import { env } from '../../config/env';
import { createAppError } from '../../middleware/error.middleware';

export interface SearchResult {
  title: string;
  url: string;
  description: string;
  age?: string;
}

export interface SearchResponse {
  results: SearchResult[];
  query: string;
  totalResults: number;
}

interface BraveSearchResult {
  title: string;
  url: string;
  description: string;
  age?: string;
}

interface BraveSearchResponse {
  web?: {
    results: BraveSearchResult[];
  };
  query: {
    original: string;
  };
}

export class WebSearchService {
  async search(query: string, count: number = 5): Promise<SearchResponse> {
    if (!env.braveSearchApiKey) {
      throw createAppError('Brave Search API key not configured', 500, 'SEARCH_NOT_CONFIGURED');
    }

    const params = new URLSearchParams({
      q: query,
      count: String(count),
    });

    let response: Response;
    try {
      response = await fetch(
        `https://api.search.brave.com/res/v1/web/search?${params.toString()}`,
        {
          headers: {
            'Accept': 'application/json',
            'Accept-Encoding': 'gzip',
            'X-Subscription-Token': env.braveSearchApiKey,
          },
          signal: AbortSignal.timeout(10000),
        }
      );
    } catch (err: unknown) {
      if (err instanceof Error && (err.name === 'TimeoutError' || err.name === 'AbortError')) {
        throw createAppError('Search API timeout: the search service took too long to respond', 504, 'SEARCH_TIMEOUT');
      }
      throw err;
    }

    if (!response.ok) {
      const error = await response.text();
      throw createAppError(`Search API error: ${error}`, 500, 'SEARCH_FAILED');
    }

    const data = await response.json() as BraveSearchResponse;

    const results: SearchResult[] = (data.web?.results ?? []).map((r) => ({
      title: r.title,
      url: r.url,
      description: r.description,
      age: r.age,
    }));

    return {
      results,
      query: data.query.original,
      totalResults: results.length,
    };
  }

  async researchTopic(topic: string, context?: string): Promise<{
    sources: SearchResult[];
    summary: string;
  }> {
    const searchQuery = context
      ? `${topic} ${context} academic information`
      : `${topic} explained overview`;

    const searchResults = await this.search(searchQuery, 5);

    return {
      sources: searchResults.results,
      summary: `Found ${searchResults.totalResults} sources for "${topic}"`,
    };
  }
}

export const webSearchService = new WebSearchService();

interface HansardSearchResult {
  Ext_id: string;
  Title: string;
  Date: string;
  House: string;
  Snippet: string;
  Score?: number;
}

interface HansardSearchResponse {
  Items: HansardSearchResult[];
  Pagination?: {
    Count: number;
    TotalItems: number;
    Skip: number;
  };
}

/**
 * Search the Hansard API for relevant parliamentary debates
 * @param query - Search query string
 * @param options - Optional search parameters
 * @returns Promise with search results
 */
export async function searchHansard(
  query: string, 
  options: {
    maxResults?: number;
    startDate?: string;
    endDate?: string;
    house?: 'Commons' | 'Lords';
  } = {}
): Promise<HansardSearchResponse | null> {
  try {
    const params = new URLSearchParams({
      query: query,
      skip: '0',
      take: (options.maxResults || 5).toString(),
    });

    if (options.startDate) {
      params.append('startDate', options.startDate);
    }
    if (options.endDate) {
      params.append('endDate', options.endDate);
    }
    if (options.house) {
      params.append('house', options.house);
    }

    const response = await fetch(`/api/hansard/search?${params.toString()}`);
    
    if (!response.ok) {
      console.error('Hansard search failed:', response.status, response.statusText);
      return null;
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error searching Hansard:', error);
    return null;
  }
}

/**
 * Format Hansard search results into a readable context for AI
 * @param results - Hansard search results
 * @param query - Original search query
 * @returns Formatted context string
 */
export function formatHansardContextForAI(
  results: HansardSearchResponse | null, 
  query: string
): string {
  if (!results || !results.Items || results.Items.length === 0) {
    return `No relevant UK Parliamentary debates found for query: "${query}"`;
  }

  const context = [
    `Found ${results.Items.length} relevant UK Parliamentary debates for "${query}":`,
    '',
    ...results.Items.map((item, index) => [
      `${index + 1}. ${item.Title}`,
      `   Date: ${item.Date}`,
      `   House: ${item.House}`,
      `   Summary: ${item.Snippet}`,
      `   Debate ID: ${item.Ext_id}`,
      ''
    ].join('\n'))
  ].join('\n');

  return context;
}

/**
 * Search and format Hansard data for AI context
 * @param query - Search query
 * @param options - Search options
 * @returns Formatted context string ready for AI
 */
export async function getHansardContextForAI(
  query: string,
  options: {
    maxResults?: number;
    startDate?: string;
    endDate?: string;
    house?: 'Commons' | 'Lords';
  } = {}
): Promise<string> {
  const results = await searchHansard(query, options);
  return formatHansardContextForAI(results, query);
} 
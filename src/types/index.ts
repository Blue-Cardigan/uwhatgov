// Internal application types

/**
 * Represents a summarized version of a debate for display in lists.
 */
export interface InternalDebateSummary {
  id: string; // Use the DebateSectionExtId
  title: string;
  date: string; // YYYY-MM-DD format
  house: string;
  // Placeholder fields - These cannot be reliably obtained from the search endpoint
  // Will need fetching the full debate later or adjusting expectations.
  speakers?: number; 
  speeches?: number;
  startTime?: string; // ISO format or simple time string?
  endTime?: string; // ISO format or simple time string?
  match?: string; // Optional match snippet from search results
} 
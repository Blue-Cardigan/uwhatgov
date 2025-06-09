// src/types.ts

// Define the structure for the metadata fetched separately
export interface DebateMetadata {
    location?: string;
    contributionCount?: number;
    speakerCount?: number;
    partyRatios?: Record<string, number>; // Party abbreviation -> ratio (0 to 1)
    isLoading?: boolean; // Optional flag to indicate loading state for this item
    error?: string | null; // Optional flag to indicate error state
}

// Internal representation for debate summaries used in the ChatList
export interface InternalDebateSummary {
  id: string;
  title: string;
  date: string;
  house: string;
  match?: string; // Optional match snippet from search
  metadata?: DebateMetadata | null; // Optional detailed metadata
}

// API response for generating chat conversation names
export interface GenerateNameResponse {
  title: string;
  success: boolean;
  error?: string;
}

// API response for sending chat messages
export interface ChatMessageResponse {
  message: {
    id?: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: string;
    groundingMetadata?: any;
  };
  generatedTitle?: string | null;
  success: boolean;
  error?: string;
} 
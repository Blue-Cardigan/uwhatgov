import axios from 'axios';
import { DebateResponse, DebateContentItem } from './hansard/types'; // Adjust path if necessary

const HANSARD_API_BASE_URL = 'https://hansard-api.parliament.uk/debates';

// Function to strip HTML tags (simple version)
function stripHtml(html: string | null | undefined): string {
  if (!html) return '';
  return html.replace(/<[^>]*>/g, '');
}

// Define a simple structure for the returned segments
// Note: This structure is simpler than the original Hansard items
// It focuses on what the Gemini service might need based on previous usage.
// Adapt as needed if the API route requires more detail from the original item.
export interface HansardSegment {
    originalIndex: number; // Corresponds to OrderInSection in the original data
    speaker: string;
    text: string; // Cleaned text
    title?: string; // Optionally add title if needed downstream
    // Add other fields from DebateContentItem if required
    item?: DebateContentItem; // Keep the original item for full context if needed
}


/**
 * Fetches and parses a Hansard debate by its external ID from the official API.
 * Returns the full DebateResponse structure.
 *
 * @param {string} ext_id - The external identifier for the debate section.
 * @returns {Promise<DebateResponse>} A promise that resolves to the full DebateResponse object.
 * @throws {Error} If the API request fails, the debate is not found, or the response structure is invalid.
 */
export async function getHansardDebate(ext_id: string): Promise<DebateResponse> {
  const apiUrl = `${HANSARD_API_BASE_URL}/debate/${ext_id}.json`;
  console.log(`[Hansard Service] Fetching Hansard debate from: ${apiUrl}`);

  try {
    const response = await axios.get<DebateResponse>(apiUrl); // Add type parameter for response data

    // Check if the response contains the expected structure
    if (!response.data || !response.data.Items || !Array.isArray(response.data.Items) || !response.data.Overview) {
        // Attempt to extract an error message if the API provided one
        const apiErrorMessage = (response.data as any)?.error || 'Unknown API error'; // Use 'any' cautiously
        if (apiErrorMessage !== 'Unknown API error') {
             console.error(`[Hansard Service] Hansard API error for ext_id ${ext_id}: ${apiErrorMessage}`);
             throw new Error(`Hansard API error for ext_id ${ext_id}: ${apiErrorMessage}`);
        }
        console.warn("[Hansard Service] Unexpected Hansard API response structure (missing Items, Overview, or not an array):", response.data);
        throw new Error(`Unexpected response structure from Hansard API for ext_id ${ext_id}.`);
    }

    // Optional: Clean up text within the Items array if needed before returning
    // Example: Add a 'cleanedText' property
    response.data.Items.forEach((item: DebateContentItem) => {
        if (item.ItemType === 'Contribution' && item.Value) {
            (item as any).cleanedText = stripHtml(item.Value).replace(/\r\n/g, ' \n').trim();
        }
    });

    console.log(`[Hansard Service] Successfully fetched debate ${ext_id}. Overview: ${response.data.Overview.Title}`);
    return response.data; // Return the full, validated response object

  } catch (error: unknown) { // Use unknown for better type safety
    if (axios.isAxiosError(error)) {
      console.error(`[Hansard Service] Axios error fetching Hansard debate ${ext_id}: ${error.message}`);
      if (error.response) {
        console.error('[Hansard Service] Status:', error.response.status);
        console.error('[Hansard Service] Data:', error.response.data);
        if (error.response.status === 404) {
          throw new Error(`Debate with ext_id ${ext_id} not found (404).`);
        }
        // Include API response data in the error message if available and not 404
        const errorData = typeof error.response.data === 'object' ? JSON.stringify(error.response.data) : error.response.data;
        throw new Error(`Hansard API request failed for ext_id ${ext_id} with status ${error.response.status}. Data: ${errorData}`);
      } else if (error.request) {
        throw new Error(`No response received from Hansard API for ext_id ${ext_id}. Is the service reachable?`);
      } else {
        // Error setting up the request
        throw new Error(`Error setting up request to Hansard API: ${error.message}`);
      }
    } else if (error instanceof Error) {
      // Handle errors thrown explicitly within the try block (like structure errors)
      console.error(`[Hansard Service] Error processing Hansard debate ${ext_id}:`, error.message);
      throw error; // Re-throw known errors
    } else {
       // Handle unexpected non-Error throwables
       console.error(`[Hansard Service] An unexpected error occurred fetching debate ${ext_id}:`, error);
       throw new Error(`An unexpected error occurred while fetching Hansard debate ${ext_id}.`);
    }
  }
}

// Note: The previous version returned a simplified 'HansardSegment[]'.
// This version now returns the full 'DebateResponse'.
// The calling code (the API route) will need to process `response.Items` itself.
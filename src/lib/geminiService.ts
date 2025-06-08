import {
    GoogleGenerativeAI,
    HarmCategory,
    HarmBlockThreshold,
    GenerateContentStreamResult,
    SchemaType,
    ObjectSchema,
    ArraySchema,
    Schema
  } from '@google/generative-ai';
  
  // Interface for the chat message structure
  interface ChatMessage {
    speaker: string;
    text: string;
    originalIndex: number;
    originalSnippet: string;
  }
  
  const MODEL_NAME = "gemini-1.5-flash";
  const API_KEY = process.env.GOOGLE_API_KEY; // Ensure this is set in your Vercel env vars
  
  if (!API_KEY) {
    console.error("GOOGLE_API_KEY environment variable not set.");
    // Avoid throwing here in library code, let the caller handle startup failure
  }
  
  const genAI = API_KEY ? new GoogleGenerativeAI(API_KEY) : null;
  const model = genAI ? genAI.getGenerativeModel({ model: MODEL_NAME }) : null;
  
  // --- Schema for Individual Messages (Explicitly Typed) ---
  const chatMessageSchema: ObjectSchema = {
    type: SchemaType.OBJECT,
    properties: {
      speaker: {
        type: SchemaType.STRING,
        description: "The name of the person speaking, or 'System/Narrative'."
      },
      text: {
        type: SchemaType.STRING,
        description: "The rewritten speech/narrative in a casual chat style."
      },
      originalIndex: {
        type: SchemaType.INTEGER,
        description: "The index (OrderInSection) of the original Hansard item this message corresponds to."
      },
      originalSnippet: {
        type: SchemaType.STRING,
        description: "A short snippet (max 15 words) from the beginning of the original text."
      },
    },
    required: ["speaker", "text", "originalIndex", "originalSnippet"],
  };
  
  // --- Schema for the Top-Level Array (Explicitly Typed) ---
  const fullChatResponseSchema: ArraySchema = {
      type: SchemaType.ARRAY,
      items: chatMessageSchema, 
      description: "An array of chat message objects representing the rewritten debate."
  };
  
  // --- Configuration for Structured JSON Streaming ---
  const structuredStreamGenerationConfig = {
    temperature: 0.7,
    topK: 1,
    topP: 1,
    responseMimeType: "application/json",
    responseSchema: fullChatResponseSchema as Schema,
  };
  
  /**
   * Combines consecutive messages from the same speaker into a single message.
   * 
   * @param {ChatMessage[]} messages - Array of chat messages to process
   * @returns {ChatMessage[]} Array of combined messages
   */
  export function combineConsecutiveSpeakerMessages(messages: ChatMessage[]): ChatMessage[] {
    if (!messages || messages.length <= 1) return messages;
    
    const combinedMessages: ChatMessage[] = [];
    let currentMessage: ChatMessage | null = null;
    
    for (const message of messages) {
      // If this is the first message or speaker has changed
      if (!currentMessage || currentMessage.speaker !== message.speaker) {
        // Add the previous message group to our result if it exists
        if (currentMessage) {
          combinedMessages.push(currentMessage);
        }
        
        // Start a new message group
        currentMessage = {...message};
      } else {
        // Same speaker, combine the text
        currentMessage.text += "\n\n" + message.text;
        
        // Keep track of all included original indexes (optional)
        // We could track these in an array if needed, but for now
        // we'll use the earliest index as the reference point
        currentMessage.originalIndex = Math.min(currentMessage.originalIndex, message.originalIndex);
        
        // Keep original snippet from the first message
        // (we already have it from when we cloned the first message)
      }
    }
    
    // Don't forget to add the last message group
    if (currentMessage) {
      combinedMessages.push(currentMessage);
    }
    
    return combinedMessages;
  }
  
  /**
   * Takes debate transcript text and generates a structured JSON stream
   * of casual chat messages, including original index and snippet.
   * Consecutive messages from the same speaker are combined.
   *
   * @param {string} relevantDebateText - The text of the debate segments to process.
   * @param {string} debateTitle - The title of the debate.
   * @param {number} startIndex - The index of the first original segment included in relevantDebateText.
   * @returns {Promise<GenerateContentStreamResult | null>} A promise resolving to the stream result or null if setup fails.
   */
  export async function generateDebateStream(
      relevantDebateText: string,
      debateTitle: string,
      startIndex: number = 0 // Default to 0 if not restarting
  ): Promise<GenerateContentStreamResult | null> {
  
    if (!model) {
        console.error("Gemini model not initialized (API key missing?).");
        return null;
    }
    if (!relevantDebateText) {
      console.warn("Cannot generate chat stream for empty text.");
      return null;
    }
  
    // Prompt asking for an array, referencing original index
    const prompt = `
  You are an AI assistant transforming UK parliamentary debate transcripts into a casual, entertaining group chat format, outputting structured JSON.
  
  **Task:** Rewrite the following debate transcript segment(s) into a sequence of chat messages.
  *   Process the provided transcript text.
  *   For each contribution or significant narrative point, create a JSON object with "speaker", "text", "originalIndex", and "originalSnippet" fields.
  *   Use the actual speaker's name or "Speaker" if the speaker is not known.
  *   Rewrite the "text" concisely and informally for a chat context, using British English spelling. Include emojis with text-style language where appropriate.
  *   The following markdown formatting for the "text" field is available: *bold*, _italic_, ~strikethrough~, * bulletted list, 1. numbered list, > quote.
  *   The "originalIndex" MUST correspond to the original index of the Hansard item from the FULL debate transcript. The first item provided to you corresponds to original index ${startIndex}.
  *   The "originalSnippet" MUST be the first 15 words of the original text for that item.
  *   Maintain the original order of contributions.
  *   Output the result as a single JSON array containing these message objects.
  
  **Debate Title:** ${debateTitle || 'Untitled Debate'}
  
  **Relevant Debate Transcript Segment (Starts at Original Index ${startIndex}):**
  --- START SEGMENT ---
  ${relevantDebateText}
  --- END SEGMENT ---
  
  **Output JSON Array:** (Respond ONLY with a JSON array matching the required schema: [{speaker: "...", text: "...", originalIndex: <number>, originalSnippet: "..."}, ...])
  `;
  
    console.log(`[Gemini Service] Requesting stream for debate "${debateTitle}", starting index ${startIndex}`);
  
    try {
      const result = await model.generateContentStream({
          contents: [{ role: "user", parts: [{text: prompt}]}],
          generationConfig: structuredStreamGenerationConfig
      });
      console.log(`[Gemini Service] Stream initiated for debate "${debateTitle}".`);
      return result;
  
    } catch (error: any) {
      console.error(`[Gemini Service] Error initiating stream for debate "${debateTitle}":`, error);
      throw new Error(`Gemini API Error: ${error.message || 'Unknown error'}`);
    }
  }
  
  /**
   * Process a completed Gemini response and combine consecutive messages from the same speaker.
   * 
   * @param {any} response - The complete response from Gemini 
   * @returns {ChatMessage[]} The processed messages with combined consecutive speaker contributions
   */
  export function processDebateResponse(response: any): ChatMessage[] {
    try {
      // Parse the JSON string if it's a string
      let messages: ChatMessage[];
      if (typeof response === 'string') {
        messages = JSON.parse(response);
      } else if (Array.isArray(response)) {
        messages = response;
      } else {
        console.error("[Gemini Service] Invalid response format:", response);
        throw new Error("Invalid response format from Gemini API");
      }
      
      // Combine consecutive messages from the same speaker
      const combinedMessages = combineConsecutiveSpeakerMessages(messages);
      console.log(`[Gemini Service] Combined ${messages.length} messages into ${combinedMessages.length} messages`);
      
      return combinedMessages;
    } catch (error: any) {
      console.error("[Gemini Service] Error processing debate response:", error);
      throw new Error(`Error processing debate response: ${error.message || 'Unknown error'}`);
    }
  }
  
  // --- Configuration for Plain Text Generation (Summary) ---
  const textGenerationConfig = {
      temperature: 0.6, // Slightly lower temp for more focused summary
      topK: 1,
      topP: 1,
      maxOutputTokens: 1024, // Limit summary length
      responseMimeType: "text/plain", // Expecting plain text
  }; 
  
  // --- Safety Settings ---
  const safetySettings = [
      { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
      { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
      { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
      { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
  ];
  
  /**
   * Takes debate transcript text and generates a concise summary.
   *
   * @param {string} relevantDebateText - The text of the debate to summarize.
   * @param {string} debateTitle - The title of the debate.
   * @returns {Promise<string>} A promise resolving to the generated summary text.
   * @throws {Error} If the Gemini API call fails or returns an unexpected response.
   */
  export async function generateDebateSummary(
      relevantDebateText: string,
      debateTitle: string
  ): Promise<string> {
  
    if (!model) {
        console.error("Gemini model not initialized (API key missing?).");
        throw new Error("Gemini model not available.");
    }
    if (!relevantDebateText) {
      console.warn("Cannot generate summary for empty text.");
      return ""; // Return empty string for empty input
    }
  
    // Prompt for summarization
    const prompt = `
  You are an AI assistant tasked with summarising a parliamentary debate transcript.
  
  **Task:** Generate a concise, neutral summary (around 2-3 sentences) of the key points discussed in the following debate transcript.
  Focus on the main arguments or topics raised.
  Use British English spelling.
  
  **Debate Title:** ${debateTitle || 'Untitled Debate'}
  
  **Debate Transcript:**
  --- START TRANSCRIPT ---
  ${relevantDebateText}
  --- END TRANSCRIPT ---
  
  **Concise Summary (2-3 sentences):**
  `;
  
    console.log(`[Gemini Service] Requesting summary for debate "${debateTitle}"`);
  
    try {
      const result = await model.generateContent({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: textGenerationConfig,
          safetySettings: safetySettings
      });
  
      const response = result.response;
      const summaryText = response.text().trim();
  
      if (!summaryText) {
           console.warn(`[Gemini Service] Summary generation returned empty text for "${debateTitle}".`);
           return "Summary could not be generated.";
      }
  
      console.log(`[Gemini Service] Summary generated for debate "${debateTitle}".`);
      return summaryText;
  
    } catch (error: any) {
      console.error(`[Gemini Service] Error generating summary for debate "${debateTitle}":`, error);
  
       if (error.response && error.response.promptFeedback?.blockReason) {
           console.warn(`[Gemini Service] Summary generation blocked due to safety settings: ${error.response.promptFeedback.blockReason}`);
           return `Summary generation blocked due to safety settings (${error.response.promptFeedback.blockReason}).`;
       }
      throw new Error(`Gemini API Error during summary generation: ${error.message || 'Unknown error'}`);
    }
  }
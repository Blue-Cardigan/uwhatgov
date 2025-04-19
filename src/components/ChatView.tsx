'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { createClient } from '@supabase/supabase-js'; // Added Supabase client import

// Define types locally for the rewritten version
interface Speech {
  speaker: string;
  text: string;
  originalIndex?: number; // Add optional originalIndex
  originalSnippet?: string; // Add optional originalSnippet
  // key?: number; // Key is for React rendering, not part of the data structure
}
interface RewrittenDebate {
  id: string;
  title: string;
  speeches: Speech[]; // Speeches should be Speech[], not Speech & { key: number }[]
}

// Type for original raw Hansard response - corrected import
import { DebateResponse, DebateContentItem } from '@/lib/hansard/types';

// Initialize Supabase client (Move keys to environment variables)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("Supabase URL or Anon Key is missing. Make sure NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are set in your environment.");
  // Optionally throw an error or handle this case appropriately
}

const supabase = createClient(supabaseUrl!, supabaseAnonKey!);

interface ChatViewProps {
  debateId: string;
}

// Basic Message Bubble component (can be moved to its own file later)
const MessageBubble = ({ speech, onClick, isSelected }: { speech: Speech, onClick: () => void, isSelected: boolean }) => {
  const isOwnMessage = false; // Placeholder logic
  const baseClasses = "rounded-lg px-3 py-2 max-w-sm md:max-w-md lg:max-w-lg shadow-md cursor-pointer transition-colors duration-200 ease-in-out";
  const alignment = isOwnMessage ? 'justify-end' : 'justify-start';
  const colors = isOwnMessage
    ? (isSelected ? 'bg-[#007a65] text-white ring-2 ring-teal-300' : 'bg-[#005c4b] text-white hover:bg-[#007a65]')
    : (isSelected ? 'bg-[#2a3942] text-gray-100 ring-2 ring-teal-300' : 'bg-[#202c33] text-gray-200 hover:bg-[#2a3942]');

  return (
    <div className={`flex mb-3 ${alignment}`} onClick={onClick}>
      <div className={`${baseClasses} ${colors}`}>
        <p className="font-semibold text-sm mb-1 text-teal-300">{speech.speaker || 'Unknown Speaker'}</p>
        <p className="text-sm whitespace-pre-wrap">{speech.text}</p>
        {/* Optional: Show snippet subtly? */}
        {/* {speech.originalSnippet && <p className="text-xs text-gray-400 mt-1 opacity-75 truncate">"{speech.originalSnippet}"</p>} */}
      </div>
    </div>
  );
};

// Original Contribution Component (New - Basic Placeholder)
// This component will render the raw contribution from the Hansard API data
const OriginalContribution = ({ item }: { item: DebateContentItem }) => {
  // Helper function to safely render HTML or strip it
  const renderContent = (htmlContent: string | null | undefined) => {
    if (!htmlContent) return { __html: '' };
    // Basic sanitization (consider a more robust library like DOMPurify if needed)
    const cleanHtml = htmlContent.replace(/<script.*?>.*?<\/script>/gi, '');
    return { __html: cleanHtml };
  };

  return (
    <div className="mb-4 p-3 rounded bg-gray-800 border border-gray-700 shadow-sm">
      <p className="font-semibold text-sm mb-1 text-blue-300">{item.AttributedTo || 'System/Narrative'}</p>
      {/* Render the raw HTML content - USE WITH CAUTION */}
      <div className="text-sm text-gray-300 prose prose-sm prose-invert max-w-none"
           dangerouslySetInnerHTML={renderContent(item.Value)} />
      {/* Alternative: Display pre-formatted text if you strip HTML in the backend */}
      {/* <p className="text-sm text-gray-300 whitespace-pre-wrap">{item.Value_Cleaned}</p> */}
    </div>
  );
};

export default function ChatView({ debateId }: ChatViewProps) {
  // State for view mode and data
  const [viewMode, setViewMode] = useState<'rewritten' | 'original'>('rewritten');
  const [rewrittenDebate, setRewrittenDebate] = useState<RewrittenDebate | null>(null);
  const [originalDebate, setOriginalDebate] = useState<DebateResponse | null>(null);

  // State for loading and errors
  const [isLoadingRewritten, setIsLoadingRewritten] = useState(true);
  const [isLoadingOriginal, setIsLoadingOriginal] = useState(false); // Only true when fetching original
  const [isStreaming, setIsStreaming] = useState(false);
  const [errorRewritten, setErrorRewritten] = useState<string | null>(null);
  const [errorOriginal, setErrorOriginal] = useState<string | null>(null);

  // State for connection/retry
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [retryAttempt, setRetryAttempt] = useState(0);
  const MAX_RETRIES = 5; // Max number of reconnection attempts
  const INITIAL_RETRY_DELAY_MS = 1000; // Initial delay before first retry

  const chatEndRef = useRef<HTMLDivElement>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const persistAttemptedRef = useRef<boolean>(false); // Ref to track persistence attempt
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null); // Ref for retry timeout
  const speechesRef = useRef<Speech[]>([]); // Keep this ref
  const debateIdRef = useRef<string>(debateId);
  const jsonBufferRef = useRef<string>(''); // Buffer for incoming JSON chunks
  const [selectedOriginalIndex, setSelectedOriginalIndex] = useState<number | null>(null); // State to track selected bubble

  // Update debateIdRef whenever debateId prop changes
  useEffect(() => {
    debateIdRef.current = debateId;
  }, [debateId]);

  // Function to persist data (ensure it uses the latest state or ref)
  const persistToSupabase = useCallback(async () => {
    // Read required data from refs at the time of execution
    const currentDebateId = debateIdRef.current;
    const currentSpeeches = speechesRef.current; // These should now include originalIndex/Snippet
    const currentTitle = rewrittenDebate?.title || 'Untitled Debate'; // Get title from state if available

    if (!currentDebateId || !currentSpeeches || currentSpeeches.length === 0) {
        console.log("Skipping persistence: No ID or speeches data in refs to persist.");
        return;
    }
    console.log(`Attempting to persist ${currentSpeeches.length} speeches for debate ${currentDebateId} to Supabase...`);

    // Create the data object to persist - includes new fields if present in currentSpeeches
    const dataToPersist: RewrittenDebate = {
        id: currentDebateId,
        title: currentTitle, // Include the title
        speeches: currentSpeeches,
    };


    // Reset status before trying to upsert/insert
    const { error: updateStatusError } = await supabase
        .from('casual_debates_uwhatgov')
        .update({ status: 'processing' })
        .eq('id', currentDebateId);

    if (updateStatusError && updateStatusError.code !== 'PGRST116') { // Ignore if row doesn't exist yet
        console.error('Failed to update status to processing before upsert:', updateStatusError);
    }

    // Use upsert to either insert or update the record
    const { error: upsertError } = await supabase
        .from('casual_debates_uwhatgov')
        .upsert({
            id: currentDebateId,
            content: JSON.stringify(dataToPersist), // Persist the complete data structure WITH new fields
            status: 'success', // Mark as success on completion
            last_updated: new Date().toISOString(),
        });

    if (upsertError) {
        console.error(`Supabase upsert error for ${currentDebateId}:`, upsertError);
        // Optionally set an error state for the user?
        setErrorRewritten(`Failed to save the rewritten debate: ${upsertError.message}`); // Assuming setErrorRewritten is stable
        // Attempt to mark status as failed?
        await supabase.from('casual_debates_uwhatgov').update({ status: 'failed' }).eq('id', currentDebateId);
    } else {
        console.log(`Successfully persisted/updated debate ${currentDebateId} in Supabase with status 'success'.`);
    }
    // Dependencies: supabase client is stable, setErrorRewritten setter is stable. Refs don't go in dependencies.
    // rewrittenDebate state is only used to get the title, which is acceptable here as it's read *during* execution.
  }, [supabase, setErrorRewritten, rewrittenDebate?.title]); // Depend on supabase, setErrorRewritten, and title

  // Function to connect/reconnect EventSource
  const connectEventSource = useCallback((attempt: number) => {
    if (!debateId) return;

    // Close existing connection if any
    eventSourceRef.current?.close();
    if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
        retryTimeoutRef.current = null;
    }

    const streamUrl = `/api/hansard/debates/rewrite/stream/${debateId}`; // Removed base URL    console.log(`[Attempt ${attempt + 1}/${MAX_RETRIES + 1}] Connecting to EventSource: ${streamUrl}`);
    const es = new EventSource(streamUrl);
    eventSourceRef.current = es;

    es.onopen = () => {
      console.log(`[EventSource: ${debateId}] ===> ONOPEN event fired (Attempt ${attempt + 1})`);
      setIsReconnecting(false); // Clear reconnecting state on successful open
      setRetryAttempt(0); // Reset retry counter on success
    };

    es.onerror = (err) => {
      console.error(`[EventSource: ${debateId}] ===> ONERROR event fired (Attempt ${attempt + 1}):`, err);
      es.close(); // Close the failed connection
      eventSourceRef.current = null;

      if (attempt < MAX_RETRIES) {
        const retryDelay = INITIAL_RETRY_DELAY_MS * Math.pow(2, attempt); // Exponential backoff
        setRetryAttempt(attempt + 1);
        setIsReconnecting(true);
        console.log(`[EventSource: ${debateId}] Connection closed by error. Attempting reconnect ${attempt + 2}/${MAX_RETRIES + 1} after ${retryDelay}ms...`);
        retryTimeoutRef.current = setTimeout(() => {
            connectEventSource(attempt + 1);
        }, retryDelay);
      } else {
        console.error(`[EventSource: ${debateId}] Max retries (${MAX_RETRIES}) reached. Failed to connect to rewrite service.`);
        setErrorRewritten(`Connection failed after ${MAX_RETRIES + 1} attempts. Please try refreshing.`);
        setIsReconnecting(false);
        setIsStreaming(false); // Ensure streaming stops if retries fail
      }
    };

    es.onmessage = (event) => {
      // console.log(`[EventSource: ${debateId}] ===> ONMESSAGE received:`, event.data.substring(0, 100) + '...'); // Keep for debug if needed
      setIsReconnecting(false);
      let streamEvent; // Renamed from streamData for clarity

      try {
          // Parse the outer SSE data field, which contains a JSON string representing a StreamEvent
          streamEvent = JSON.parse(event.data);

          if (typeof streamEvent !== 'object' || streamEvent === null || !streamEvent.type) {
               console.warn(`[EventSource: ${debateId}] Received unexpected data format in SSE message (not a valid StreamEvent object):`, event.data);
               return;
          }

      } catch (parseError) {
        console.error(`[EventSource: ${debateId}] Failed to parse outer SSE data field as JSON:`, event.data, parseError);
        return;
      }

      // Handle structured StreamEvent types
      if (streamEvent.type === 'ping') {
          console.log(`[EventSource: ${debateId}] Received ping.`);
          // No state update needed for ping
      } else if (streamEvent.type === 'chunk') {
          if (typeof streamEvent.payload === 'string') {
              // console.log(`[EventSource: ${debateId}] Received chunk payload:`, streamEvent.payload.substring(0, 50) + '...'); // Debug log
              jsonBufferRef.current += streamEvent.payload;
              processJsonBuffer(); // Process buffer after adding new chunk
          } else {
               console.warn(`[EventSource: ${debateId}] Received chunk event with non-string payload:`, streamEvent.payload);
          }
      } else if (streamEvent.type === 'complete') {
          console.log(`[EventSource: ${debateId}] Received complete signal.`);
          processJsonBuffer(true); // Final buffer process
          jsonBufferRef.current = ''; // Clear buffer
          if (!persistAttemptedRef.current) {
              persistAttemptedRef.current = true;
              persistToSupabase();
          }
          setIsStreaming(false);
          es.close();
      } else if (streamEvent.type === 'error') {
          console.error(`[EventSource: ${debateId}] Received error object from stream:`, streamEvent.payload?.message);
          setErrorRewritten(streamEvent.payload?.message || 'Error object received from stream');
          setIsStreaming(false);
          es.close();
      } else {
           // This logs if the type is something other than ping, chunk, complete, or error
           console.log(`[EventSource: ${debateId}] Received unhandled structured data type:`, streamEvent.type, streamEvent);
      }
    };
  }, [debateId, MAX_RETRIES, INITIAL_RETRY_DELAY_MS, persistToSupabase, setErrorRewritten]); // Added setErrorRewritten

  // Helper function to parse the JSON buffer
  const processJsonBuffer = (isComplete = false) => {
      let buffer = jsonBufferRef.current;
      if (!buffer) return; // No buffer to process

      const parsedSpeeches: Speech[] = [];
      let processedChars = 0;
      let tempBuffer = buffer; // Work on a temporary copy for parsing attempts
      let startOffset = 0; // Track how much we trimmed initially

      // Trim leading whitespace, commas, and potentially the opening bracket of the array
      let trimmed = tempBuffer.trim();
      if (trimmed.startsWith('[')) {
          trimmed = trimmed.substring(1);
      }
      trimmed = trimmed.trimStart();
      if (trimmed.startsWith(',')) {
          trimmed = trimmed.substring(1);
      }
      trimmed = trimmed.trimStart();
      startOffset = tempBuffer.length - trimmed.length; // How many chars were trimmed?
      tempBuffer = trimmed;

      let openBrackets = 0;
      let objectStartIndex = -1;

      for (let i = 0; i < tempBuffer.length; i++) {
          const char = tempBuffer[i];
          if (char === '{') {
              if (openBrackets === 0) objectStartIndex = i;
              openBrackets++;
          } else if (char === '}') {
              if (openBrackets > 0) {
                  openBrackets--;
                  if (openBrackets === 0 && objectStartIndex !== -1) {
                      const objectString = tempBuffer.substring(objectStartIndex, i + 1);
                      try {
                          const parsedObject = JSON.parse(objectString);
                          // Updated Check: Verify required fields and check optional fields
                          if (parsedObject && typeof parsedObject.speaker === 'string' && typeof parsedObject.text === 'string') {
                              const newSpeech: Speech = {
                                  speaker: parsedObject.speaker,
                                  text: parsedObject.text,
                                  // Add optional fields if they exist and have the correct type
                                  originalIndex: typeof parsedObject.originalIndex === 'number' ? parsedObject.originalIndex : undefined,
                                  originalSnippet: typeof parsedObject.originalSnippet === 'string' ? parsedObject.originalSnippet : undefined,
                              };
                              parsedSpeeches.push(newSpeech); // Push the typed object
                              processedChars = startOffset + i + 1; // Mark object as processed
                              objectStartIndex = -1; // Reset for next object

                              // Consume trailing comma and whitespace
                              let lookAheadIndex = i + 1;
                              while (lookAheadIndex < tempBuffer.length && /\s/.test(tempBuffer[lookAheadIndex])) {
                                  lookAheadIndex++;
                              }
                              if (tempBuffer[lookAheadIndex] === ',') {
                                  processedChars = startOffset + lookAheadIndex + 1; // Update processed chars to include comma
                              }
                              // If no comma, processedChars remains at the end of the object brace '}'

                          } else {
                              console.warn(`[ProcessBuffer: ${debateId}] Parsed object lacks required string fields (speaker/text):`, parsedObject);
                              objectStartIndex = -1;
                          }
                      } catch (e) {
                           console.warn(`[ProcessBuffer: ${debateId}] Partial object parse failed, waiting for more data...`);
                           objectStartIndex = -1;
                           openBrackets = 0;
                           break;
                      }
                  }
              }
          }
      }

      if (processedChars > 0) {
           jsonBufferRef.current = jsonBufferRef.current.substring(processedChars);
      }

       const remainingTrimmed = jsonBufferRef.current.trim();
       if (isComplete && remainingTrimmed && remainingTrimmed !== ']') {
           console.error(`[ProcessBuffer: ${debateId}] Stream complete, but buffer has unexpected remaining content:`, jsonBufferRef.current);
       }

      if (parsedSpeeches.length > 0) {
          const currentSpeeches = speechesRef.current;
          const newSpeechesToAdd = parsedSpeeches.filter(newSpeech => {
              const last = currentSpeeches[currentSpeeches.length - 1];
              return !last || !(last.speaker === newSpeech.speaker && last.text === newSpeech.text);
          });

          if (newSpeechesToAdd.length > 0) {
              speechesRef.current = [...currentSpeeches, ...newSpeechesToAdd];
              setRewrittenDebate(prev => {
                   const base = prev ?? { id: debateIdRef.current, title: 'Loading... ', speeches: [] };
                   return {
                      ...base,
                      speeches: speechesRef.current
                   };
              });
          }
      }
  };

  // Fetch/Stream Rewritten Debate (Primary fetch on ID change)
  useEffect(() => {
    if (!debateId) return;

    // Reset state for new debate
    setViewMode('rewritten');
    setRewrittenDebate(null);
    setOriginalDebate(null);
    setErrorRewritten(null);
    setErrorOriginal(null);
    setIsLoadingRewritten(true);
    setIsLoadingOriginal(false);
    setIsStreaming(false);
    setIsReconnecting(false);
    setRetryAttempt(0);
    persistAttemptedRef.current = false;
    speechesRef.current = []; // Reset speeches ref
    jsonBufferRef.current = ''; // Reset JSON buffer
    setSelectedOriginalIndex(null); // Reset selection on new debate

    // Clear any pending timeouts/connections from previous debate
    if (retryTimeoutRef.current) clearTimeout(retryTimeoutRef.current);
    eventSourceRef.current?.close();

    const setupRewrittenDebate = async () => {
      setIsLoadingRewritten(true);
      setErrorRewritten(null);
      setRewrittenDebate(null);
      speechesRef.current = []; // Ensure ref is clear before setup

      let currentDebateData: RewrittenDebate = { id: debateId, title: 'Loading Rewrite...', speeches: [] };

      try {
        // 1. Check Supabase first
        console.log(`Checking Supabase for casual debate ${debateId}...`);
        const { data: supabaseDataArray, error: supabaseError } = await supabase
          .from('casual_debates_uwhatgov')
          .select('content, status')
          .eq('id', debateId)
          .limit(1);

        if (supabaseError && supabaseError.code !== 'PGRST116') {
             console.error(`Supabase query failed: ${supabaseError.message}`);
        }

        const supabaseData = supabaseDataArray && supabaseDataArray.length > 0 ? supabaseDataArray[0] : null;

        if (supabaseData && supabaseData.status === 'success' && supabaseData.content) {
          console.log(`Rewritten Debate ${debateId} loaded from Supabase.`);
          try {
            const parsedContent = JSON.parse(supabaseData.content);
            // Ensure loaded speeches conform to the updated Speech type
            const typedSpeeches = (parsedContent.speeches || []).map((s: any) => ({
                speaker: s.speaker || 'Unknown Speaker',
                text: s.text || '',
                originalIndex: typeof s.originalIndex === 'number' ? s.originalIndex : undefined,
                originalSnippet: typeof s.originalSnippet === 'string' ? s.originalSnippet : undefined,
            }));
            setRewrittenDebate({ ...parsedContent, speeches: typedSpeeches });
            speechesRef.current = typedSpeeches; // Initialize ref from cache
            setIsLoadingRewritten(false);
          } catch (parseError) {
             console.error("Failed to parse Supabase content:", parseError);
             setErrorRewritten("Failed to parse cached debate data.");
             setIsLoadingRewritten(false);
             // Maybe try streaming as fallback?
          }
        } else {
          console.log(`Rewritten Debate ${debateId} not cached or complete in Supabase, initiating stream from backend...`);
          setIsLoadingRewritten(false);
          setIsStreaming(true);
          // Initialize with basic structure
          setRewrittenDebate(currentDebateData);
          speechesRef.current = []; // Start with empty speeches for streaming

          // Initiate connection (Attempt 0)
          connectEventSource(0);
        }
      } catch (e: any) {
        console.error(`Failed to setup rewritten debate ${debateId}:`, e);
        setErrorRewritten(`Failed to load rewritten debate: ${e.message}`);
        setIsLoadingRewritten(false);
        setIsStreaming(false);
      }
    };

    setupRewrittenDebate();

    // Cleanup function
    return () => {
      if (retryTimeoutRef.current) {
          clearTimeout(retryTimeoutRef.current);
          console.log(`Cleared pending retry timeout for ${debateId} on cleanup`);
      }
      eventSourceRef.current?.close();
      console.log(`SSE connection closed for rewrite ${debateId} on cleanup`);
    };
  }, [debateId, connectEventSource, supabase]); // Added supabase dependency

  // Fetch Original Debate (Triggered by toggle OR bubble click)
  const fetchOriginalDebate = useCallback(async () => {
    // Skip if no ID, already loaded, or currently loading
    if (!debateId || originalDebate || isLoadingOriginal) return;

    console.log(`Fetching ORIGINAL debate ${debateId} directly from Hansard API`);
    setIsLoadingOriginal(true);
    setErrorOriginal(null);
    try {
      // Use the backend proxy route for fetching a specific debate
      const hansardApiUrl = `/api/hansard/debates/${debateId}`;
      console.log(`Fetching original debate via proxy: ${hansardApiUrl}`);
      const response = await fetch(hansardApiUrl);

      if (!response.ok) {
        let errorMsg = `Original fetch failed: ${response.status}`;
        try {
          const errorData = await response.json();
          errorMsg = errorData.error || errorData.message || errorMsg;
        } catch (e) { /* Ignore JSON parse error if body is not JSON */ }
        throw new Error(errorMsg);
      }
      const data: DebateResponse = await response.json();
      setOriginalDebate(data);
    } catch (e: any) {
      console.error(`Failed to fetch original debate ${debateId}:`, e);
      setErrorOriginal(`Failed to load original debate: ${e.message}`);
    } finally {
      setIsLoadingOriginal(false); // Ensure this is set even on error
    }
  }, [debateId, originalDebate, isLoadingOriginal]); // Add isLoadingOriginal dependency

  // Handle Clicking a Rewritten Bubble
  const handleBubbleClick = useCallback((index: number | undefined) => {
      if (typeof index === 'number') {
          console.log(`Bubble clicked, originalIndex: ${index}`);
          setSelectedOriginalIndex(index);
          // Fetch original debate if not already loaded/loading
          if (!originalDebate && !isLoadingOriginal) {
              fetchOriginalDebate();
          }
      } else {
           console.warn("Clicked bubble is missing originalIndex");
           setSelectedOriginalIndex(null); // Clear selection if index is missing
      }
  }, [originalDebate, isLoadingOriginal, fetchOriginalDebate]); // Add dependencies

  // Handle Toggle Click
  const handleToggle = (mode: 'rewritten' | 'original') => {
      if (mode === 'original' && !originalDebate && !isLoadingOriginal) {
          fetchOriginalDebate();
      }
      setViewMode(mode);
  };

  // Scroll to bottom logic (adjust behavior based on mode?)
  useEffect(() => {
    const timer = setTimeout(() => {
      chatEndRef.current?.scrollIntoView({ behavior: isStreaming ? 'smooth' : 'auto' });
    }, 100);
    return () => clearTimeout(timer);
    // Consider adding viewMode if scrolling should reset on toggle
  }, [rewrittenDebate?.speeches, originalDebate?.Items, isStreaming, viewMode]);

  // Find the selected original contribution item
  const selectedOriginalItem = (selectedOriginalIndex !== null && originalDebate?.Items)
      ? originalDebate.Items.find(item => item.OrderInSection === selectedOriginalIndex)
      : null;

  // Render Logic
  const renderContent = () => {
    if (viewMode === 'rewritten') {
      if (isLoadingRewritten) return <div className="p-4 text-center text-gray-400">Loading Rewritten Version...</div>;
      if (errorRewritten && !rewrittenDebate?.speeches?.length) return <div className="p-4 text-center text-red-400">Error: {errorRewritten}</div>;
      if (!rewrittenDebate) return <div className="p-4 text-center text-gray-400">Rewritten debate not available.</div>; // Should not happen ideally

      return (
        <>
          {rewrittenDebate.speeches?.map((speech: Speech, index: number) => (
            <MessageBubble
                key={`rewritten-${index}`}
                speech={speech}
                onClick={() => handleBubbleClick(speech.originalIndex)} // Pass handler
                isSelected={selectedOriginalIndex === speech.originalIndex} // Pass selection state
            />
          ))}
       {/* Status Indicator: Loading / Streaming / Reconnecting / Error */}
       <div className="p-2 text-center text-sm">
         {isLoadingRewritten && <p className="text-gray-400">Loading rewrite...</p>}
         {isStreaming && !isReconnecting && <p className="text-teal-400 animate-pulse">Streaming rewrite...</p>}
         {isReconnecting && <p className="text-yellow-400 animate-pulse">Connection interrupted. Attempting to reconnect (Attempt {retryAttempt + 1}/{MAX_RETRIES + 1})...</p>}
         {errorRewritten && !isReconnecting && <p className="text-red-500">Error: {errorRewritten}</p>}
       </div>          
       {!isStreaming && !isLoadingRewritten && rewrittenDebate.speeches?.length === 0 && (
            <p className="text-center text-gray-500">{errorRewritten ? 'Failed to load speeches.' : 'No rewritten speeches available.'}</p>
          )}
           {errorRewritten && rewrittenDebate.speeches?.length > 0 && <p className="text-center text-red-400 text-sm p-2">Error during stream: {errorRewritten}</p>}
        </>
      );
    } else { // viewMode === 'original'
      if (isLoadingOriginal) return <div className="p-4 text-center text-gray-400">Loading Original Version...</div>;
      if (errorOriginal) return <div className="p-4 text-center text-red-400">Error: {errorOriginal}</div>;
      if (!originalDebate) return <div className="p-4 text-center text-gray-400">Original debate not loaded. Click toggle again.</div>;

      return (
        <>
          {originalDebate.Items?.filter(item => item.ItemType === 'Contribution' && item.Value).map((item: DebateContentItem, index: number) => (
            <OriginalContribution key={`original-${index}`} item={item} />
          ))}
          {(!originalDebate.Items || originalDebate.Items.filter(item => item.ItemType === 'Contribution' && item.Value).length === 0) && (
             <p className="text-center text-gray-500">No contributions found in the original debate data.</p>
          )}
        </>
      );
    }
  };

  return (
    <div className="flex-grow flex flex-col h-full bg-gradient-to-b from-[#111b21] via-[#0c1317] to-[#111b21]">

       {/* Content Area */}
      <div className="flex-grow overflow-y-auto p-4 space-y-4">
        {renderContent()}
        {/* Element to scroll to */}
        <div ref={chatEndRef} />
      </div>

      {/* Selected Original Panel */}
      {viewMode === 'rewritten' && selectedOriginalItem && (
         <div className="p-4 border-t border-gray-700 bg-[#111b21] bg-opacity-95 sticky bottom-16 z-10 max-h-48 overflow-y-auto">
             <h3 className="text-sm font-semibold text-blue-300 mb-2">Original Contribution (Index: {selectedOriginalIndex})</h3>
             <OriginalContribution item={selectedOriginalItem} />
             {/* Add a close button? */}
             <button
                 onClick={() => setSelectedOriginalIndex(null)}
                 className="absolute top-2 right-2 text-gray-400 hover:text-white p-1 rounded-full bg-gray-700 hover:bg-gray-600 text-xs"
                 title="Close original view"
             >
                 ✕
             </button>
         </div>
      )}
      {viewMode === 'rewritten' && selectedOriginalIndex !== null && !selectedOriginalItem && isLoadingOriginal && (
           <div className="p-4 border-t border-gray-700 bg-[#111b21] bg-opacity-95 sticky bottom-16 z-10 text-center text-gray-400">
               Loading original text...
           </div>
      )}
       {viewMode === 'rewritten' && selectedOriginalIndex !== null && !selectedOriginalItem && !isLoadingOriginal && errorOriginal && (
            <div className="p-4 border-t border-gray-700 bg-[#111b21] bg-opacity-95 sticky bottom-16 z-10 text-center text-red-400">
                Error loading original: {errorOriginal}
            </div>
        )}

      {/* Footer with Toggle */}
       <div className="p-2 border-t border-gray-700 bg-[#202c33] flex justify-center items-center sticky bottom-0 z-20">
         <div className="flex items-center space-x-2 p-1 bg-[#111b21] rounded-lg">
            <button
              onClick={() => handleToggle('rewritten')}
              className={`px-4 py-1 rounded-md text-sm ${viewMode === 'rewritten' ? 'bg-teal-600 text-white' : 'bg-transparent text-gray-400 hover:bg-gray-700'}`}
            >
              Casual
            </button>
            <button
              onClick={() => handleToggle('original')}
               className={`px-4 py-1 rounded-md text-sm ${viewMode === 'original' ? 'bg-teal-600 text-white' : 'bg-transparent text-gray-400 hover:bg-gray-700'}`}
            >
              Original
            </button>
         </div>
       </div>

     </div>
  );
} 
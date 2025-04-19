'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { createClient } from '@supabase/supabase-js'; // Added Supabase client import

// Define types locally for the rewritten version
interface Speech {
  speaker: string;
  text: string;
  // Add other fields if your stream sends them
}
interface RewrittenDebate {
  id: string;
  title: string;
  speeches: Speech[];
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
const MessageBubble = ({ speech }: { speech: Speech }) => {
  // Basic differentiation - can be enhanced later (e.g., based on speaker role)
  const isOwnMessage = false; // Placeholder logic

  return (
    <div className={`flex mb-3 ${isOwnMessage ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`rounded-lg px-3 py-2 max-w-sm md:max-w-md lg:max-w-lg shadow-md ${isOwnMessage ? 'bg-[#005c4b] text-white' : 'bg-[#202c33] text-gray-200'}`}>
        <p className="font-semibold text-sm mb-1 text-teal-300">{speech.speaker || 'Unknown Speaker'}</p>
        <p className="text-sm whitespace-pre-wrap">{speech.text}</p>
        {/* Optionally add timestamp here */}
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

  const chatEndRef = useRef<HTMLDivElement>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const persistAttemptedRef = useRef<boolean>(false); // Ref to track persistence attempt

  // Fetch/Stream Rewritten Debate (Primary fetch on ID change)
  useEffect(() => {
    if (!debateId) return;

    // Reset all relevant states
    setViewMode('rewritten');
    setRewrittenDebate(null);
    setOriginalDebate(null); // Clear original too
    setErrorRewritten(null);
    setErrorOriginal(null);
    setIsLoadingRewritten(true);
    setIsLoadingOriginal(false);
    setIsStreaming(false);
    persistAttemptedRef.current = false; // Reset persistence flag for new debate ID
    eventSourceRef.current?.close();
    eventSourceRef.current = null;

    const setupRewrittenDebate = async () => {
      setIsLoadingRewritten(true);
      setErrorRewritten(null);
      setRewrittenDebate(null); // Clear previous data

      // Local variable to accumulate data within this effect run
      let currentDebateData: RewrittenDebate = { id: debateId, title: 'Loading Rewrite...', speeches: [] };

      try {
        // 1. Check Supabase first
        console.log(`Checking Supabase for casual debate ${debateId}...`);
        const { data: supabaseDataArray, error: supabaseError } = await supabase
          .from('casual_debates_uwhatgov')
          .select('content, status')
          .eq('id', debateId)
          .limit(1); // Fetch as an array, limit to 1 result

        if (supabaseError) { // Check for any Supabase error
          // Don't throw for empty result, but log other errors
          if (supabaseError.code !== 'PGRST116') { // PGRST116 is 'Row not found', which is okay here
             console.error(`Supabase query failed: ${supabaseError.message}`);
             // Decide if this should be a user-facing error or just logged
             // setErrorRewritten(`Failed to check cache: ${supabaseError.message}`);
          }
          // Proceed to streaming even if there was an error checking cache, unless it's critical
        }

        // Check if we got a result and it's completed
        const supabaseData = supabaseDataArray && supabaseDataArray.length > 0 ? supabaseDataArray[0] : null;

        if (supabaseData && supabaseData.status === 'success' && supabaseData.content) {
          // 2. Found completed debate in Supabase
          console.log(`Rewritten Debate ${debateId} loaded from Supabase.`);
          try {
             // Assuming content is stored as a JSON string matching RewrittenDebate
            const parsedContent = JSON.parse(supabaseData.content);
            setRewrittenDebate(parsedContent as RewrittenDebate);
            currentDebateData = parsedContent; // Initialize local var too if loaded from cache
            setIsLoadingRewritten(false);
          } catch (parseError) {
             console.error("Failed to parse Supabase content:", parseError);
             throw new Error("Failed to parse cached debate data.");
          }
        } else {
          // 3. Not found, status not 'completed', or no content -> Initiate stream from backend
          console.log(`Rewritten Debate ${debateId} not cached or complete in Supabase, initiating stream from backend...`);
          setIsLoadingRewritten(false); // Loading is done, now streaming
          setIsStreaming(true);
          // Provide a basic structure while streaming
          setRewrittenDebate(currentDebateData); // Initialize state with the basic structure

          // NOTE: This URL points to your backend rewrite/stream service.
          // Ensure the backend server path matches how routes are defined (e.g., under /debate/)
          // Construct the full URL including the backend server's origin
          const backendBaseUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3000'; // Use env var or default
          const streamUrl = `${backendBaseUrl}/debate/rewrite/stream/${debateId}`; 
          console.log(`Connecting to EventSource: ${streamUrl}`);
          const es = new EventSource(streamUrl);
          eventSourceRef.current = es;

          es.onopen = () => console.log(`SSE connection opened for rewrite ${debateId} at ${streamUrl}`);
          es.onerror = (err) => {
            console.error(`SSE error for rewrite ${debateId} at ${streamUrl}:`, err);
            setErrorRewritten('An error occurred connecting to the rewrite service.');
            setIsStreaming(false);
            es.close();
          };
          es.onmessage = (event) => {
            try {
              const streamData = JSON.parse(event.data);
              if (streamData.type === 'speech') {
                const newSpeech = streamData.payload as Speech;
                // Update local variable synchronously
                currentDebateData = {
                  ...currentDebateData,
                  speeches: [...currentDebateData.speeches, newSpeech]
                };
                // Update state asynchronously
                setRewrittenDebate(prev => prev ? { ...prev, speeches: [...(prev.speeches || []), newSpeech] } : null);
              } else if (streamData.type === 'title') { // Handle title updates if sent separately
                  const newTitle = streamData.payload as string;
                   // Update local variable synchronously
                   currentDebateData = { ...currentDebateData, title: newTitle };
                  // Update state asynchronously
                  setRewrittenDebate((prev: RewrittenDebate | null) => prev ? { ...prev, title: newTitle } : null);
              } else if (streamData.type === 'complete') {
                console.log(`Rewrite stream complete for ${debateId}.`);
                // Check if persistence has already been attempted for this effect run
                if (!persistAttemptedRef.current) {
                    persistAttemptedRef.current = true; // Set flag
                    // Persist the locally accumulated data
                    persistToSupabase(debateId, currentDebateData);
                 } else {
                     console.log(`Persistence already attempted for ${debateId}, skipping duplicate call.`);
                 }

                setIsStreaming(false);
                es.close();
              } else if (streamData.type === 'error') {
                  console.error('Received error message from stream:', streamData.payload?.message);
                  setErrorRewritten(streamData.payload?.message || 'Error message received from stream');
                  setIsStreaming(false); // Stop streaming on received error
                  es.close();
              } else {
                  console.log("Received unknown stream data:", streamData);
              }
            } catch (parseError) {
              console.error('Failed to parse stream data:', event.data, parseError);
              // Decide if this is critical - maybe set an error state?
              // setErrorRewritten("Received malformed data during rewrite.");
              // es.close(); // Close on persistent parse errors?
            }
          };
        }
      } catch (e: any) {
        console.error(`Failed to setup rewritten debate ${debateId}:`, e);
        setErrorRewritten(`Failed to load rewritten debate: ${e.message}`);
        setIsLoadingRewritten(false);
        setIsStreaming(false);
      }
    };

    setupRewrittenDebate();

    return () => {
      eventSourceRef.current?.close();
      console.log(`SSE connection closed for rewrite ${debateId} on cleanup`);
    };
  }, [debateId]);

  // Fetch Original Debate (Triggered by toggle)
  const fetchOriginalDebate = useCallback(async () => {
    if (!debateId || originalDebate) return; // Don't fetch if no ID or already loaded

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
      setIsLoadingOriginal(false);
    }
  }, [debateId, originalDebate]); // Dependencies

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

  // --- Add function to persist to Supabase ---
  const persistToSupabase = async (id: string, data: RewrittenDebate | null) => {
    if (!data || !data.speeches || data.speeches.length === 0) {
        console.warn(`Not persisting debate ${id} to backend due to missing or empty data.`);
        return;
    }
    console.log(`Attempting to persist completed rewrite for ${id} via backend...`);

    // Format data for the backend endpoint
    const contentToStore = JSON.stringify(data);
    const backendPersistUrl = `${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3000'}/debate/persist`;

    try {
      const response = await fetch(backendPersistUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: id,
          casual_text: contentToStore
        }),
      });

      if (!response.ok) {
        // Attempt to parse error details from the backend response
        let errorDetails = `Backend returned status ${response.status}`;
        if (response.status !== 409) { // Don't throw for conflict, just log it maybe?
             try {
                 const errorData = await response.json();
                 errorDetails = errorData.error || errorData.message || errorDetails; // Use backend error message if available
             } catch (e) {
                 // Ignore if response body is not JSON
             }
             throw new Error(`Failed to persist rewrite ${id} via backend: ${errorDetails}`);
        } else {
             console.warn(`Conflict detected when persisting ${id}. It likely already exists.`);
             // Optionally trigger a re-check here or update state if needed
             // await setupRewrittenDebate(); // Be careful with recursion
        }
      } else {
        const result = await response.json(); // Assuming backend returns JSON on success
        console.log(`Successfully persisted rewrite ${id} via backend:`, result.message);
         // *** Idea for second issue: After successful persistence, maybe re-run the check? ***
         // This might be too aggressive or cause loops if not handled carefully.
         // Consider if the backend should ideally return the persisted data,
         // or if a simple state update indicating completion is enough before the next natural check.
         // For now, just logging success. The next check should ideally find it.
      }


    } catch (error) {
      console.error(`Error calling backend persist endpoint for ${id}:`, error);
      // Optionally update UI to inform the user about the persistence failure
      // Reset flag if persist truly failed (not a 409)?
      // persistAttemptedRef.current = false; // Be careful here
    }
  };
  // --- End persist function ---

  // Render Logic
  const renderContent = () => {
    if (viewMode === 'rewritten') {
      if (isLoadingRewritten) return <div className="p-4 text-center text-gray-400">Loading Rewritten Version...</div>;
      if (errorRewritten && !rewrittenDebate?.speeches?.length) return <div className="p-4 text-center text-red-400">Error: {errorRewritten}</div>;
      if (!rewrittenDebate) return <div className="p-4 text-center text-gray-400">Rewritten debate not available.</div>; // Should not happen ideally

      return (
        <>
          {rewrittenDebate.speeches?.map((speech: Speech, index: number) => (
            <MessageBubble key={`rewritten-${index}`} speech={speech} />
          ))}
          {isStreaming && <div className="text-center text-gray-400 text-sm p-2">Receiving rewritten content...</div>}
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
    <div className="flex-grow flex flex-col h-full"> { /* Adjusted from ChatView root */}
       {/* Content Area */}
      <div className="flex-grow overflow-y-auto p-4 space-y-4 bg-opacity-80">
        {renderContent()}
        {/* Element to scroll to */}
        <div ref={chatEndRef} />
      </div>

      {/* Footer with Toggle - Example */}
       <div className="p-2 border-t border-gray-700 bg-[#202c33] flex justify-center items-center z-10">
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
'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { createClient } from '@supabase/supabase-js';

// Define types locally for the rewritten version
interface Speech {
  speaker: string;
  text: string;
  originalIndex?: number;
  originalSnippet?: string;
}
interface RewrittenDebate {
  id: string;
  title: string;
  speeches: Speech[];
}

// Type for original raw Hansard response
import { DebateResponse, DebateContentItem } from '@/lib/hansard/types';

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("Supabase URL or Anon Key is missing.");
}
const supabase = createClient(supabaseUrl!, supabaseAnonKey!);

interface ChatViewProps {
  debateId: string | null; // Allow null if no debate selected
  viewMode: 'rewritten' | 'original';
  originalDebateData: DebateResponse | null;
  isLoadingOriginal: boolean;
  errorOriginal: string | null;
  fetchOriginalDebate: () => void;
  selectedOriginalIndex: number | null; // Receive selected index from parent
  onBubbleClick: (index: number | undefined) => void; // Callback to parent on click
}

// MessageBubble component
interface MessageBubbleProps {
    speech: Speech;
    onClick: () => void;
    isSelected: boolean;
    originalDebate: DebateResponse | null;
}

const MessageBubble = ({ speech, onClick, isSelected, originalDebate }: MessageBubbleProps) => {
    const isOwnMessage = false;
    const memberId = (typeof speech.originalIndex === 'number' && originalDebate?.Items)
        ? originalDebate.Items.find(item => item.OrderInSection === speech.originalIndex)?.MemberId
        : null;
    const portraitUrl = memberId
        ? `https://members-api.parliament.uk/api/Members/${memberId}/Portrait?cropType=OneOne`
        : null;

    const baseClasses = "rounded-lg px-3 py-2 max-w-xs sm:max-w-sm md:max-w-md shadow-md cursor-pointer transition-colors duration-200 ease-in-out";
    const alignment = isOwnMessage ? 'justify-end' : 'justify-start';
    const colors = isOwnMessage
        ? (isSelected ? 'bg-[#007a65] text-white ring-2 ring-teal-300' : 'bg-[#005c4b] text-white hover:bg-[#007a65]')
        : (isSelected ? 'bg-[#2a3942] text-gray-100 ring-2 ring-teal-300' : 'bg-[#202c33] text-gray-200 hover:bg-[#2a3942]');

    return (
        <div className={`flex mb-3 gap-2 ${alignment}`} onClick={onClick}>
            {!isOwnMessage && (
                <div className="flex-shrink-0 w-8 h-8 mt-1">
                    {portraitUrl ? (
                        <img
                            src={portraitUrl}
                            alt={speech.speaker || 'Speaker'}
                            className="rounded-full w-full h-full object-cover bg-gray-600"
                        />
                    ) : (
                        <div className="rounded-full w-full h-full bg-gray-500 flex items-center justify-center text-white text-xs font-semibold">
                            {speech.speaker?.charAt(0) || '?'}
                        </div>
                    )}
                </div>
            )}
            <div className={`${baseClasses} ${colors}`}>
                <p className="font-semibold text-sm mb-1 text-teal-300">{speech.speaker || 'Unknown Speaker'}</p>
                <p className="text-sm whitespace-pre-wrap">{speech.text}</p>
            </div>
        </div>
    );
};

export default function ChatView({
    debateId,
    viewMode,
    originalDebateData,
    isLoadingOriginal,
    errorOriginal,
    fetchOriginalDebate,
    selectedOriginalIndex, // Destructure new prop
    onBubbleClick          // Destructure new prop
}: ChatViewProps) {
  const [rewrittenDebate, setRewrittenDebate] = useState<RewrittenDebate | null>(null);
  const [isLoadingRewritten, setIsLoadingRewritten] = useState(true);
  const [isStreaming, setIsStreaming] = useState(false);
  const [errorRewritten, setErrorRewritten] = useState<string | null>(null);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [retryAttempt, setRetryAttempt] = useState(0);
  const MAX_RETRIES = 5;
  const INITIAL_RETRY_DELAY_MS = 1000;

  const chatEndRef = useRef<HTMLDivElement>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const persistAttemptedRef = useRef<boolean>(false);
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const speechesRef = useRef<Speech[]>([]);
  const debateIdRef = useRef<string | null>(debateId);
  const jsonBufferRef = useRef<string>('');

  useEffect(() => {
    debateIdRef.current = debateId;
  }, [debateId]);

  const persistToSupabase = useCallback(async () => {
    const currentDebateId = debateIdRef.current;
    const currentSpeeches = speechesRef.current;

    if (!currentDebateId || !currentSpeeches || currentSpeeches.length === 0) {
        console.log("Skipping persistence: No ID or speeches data.");
        return;
    }
    console.log(`Persisting ${currentSpeeches.length} speeches for ${currentDebateId}...`);
    const dataToPersist: RewrittenDebate = {
        id: currentDebateId,
        title: rewrittenDebate?.title || 'Untitled Debate',
        speeches: currentSpeeches,
    };

    const { error: updateStatusError } = await supabase
        .from('casual_debates_uwhatgov')
        .update({ status: 'processing' })
        .eq('id', currentDebateId);

    if (updateStatusError && updateStatusError.code !== 'PGRST116') {
        console.error('Failed to update status to processing:', updateStatusError);
    }

    const { error: upsertError } = await supabase
        .from('casual_debates_uwhatgov')
        .upsert({
            id: currentDebateId,
            content: JSON.stringify(dataToPersist),
            status: 'success',
            last_updated_at: new Date().toISOString(),
        });

    if (upsertError) {
        console.error(`Supabase upsert error ${currentDebateId}:`, upsertError);
        setErrorRewritten(`Failed to save debate: ${upsertError.message}`);
        await supabase.from('casual_debates_uwhatgov').update({ status: 'failed' }).eq('id', currentDebateId);
    } else {
        console.log(`Persisted ${currentDebateId} successfully.`);
    }
  }, [supabase, setErrorRewritten]);

  const connectEventSource = useCallback((attempt: number) => {
    if (!debateId) return;
    eventSourceRef.current?.close();
    if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
        retryTimeoutRef.current = null;
    }
    const streamUrl = `/api/hansard/debates/rewrite/stream/${debateId}`;
    console.log(`[Attempt ${attempt + 1}] Connecting SSE: ${streamUrl}`);
    const es = new EventSource(streamUrl);
    eventSourceRef.current = es;
    es.onopen = () => {
      console.log(`[SSE ${debateId}] Open (Attempt ${attempt + 1})`);
      setIsReconnecting(false);
      setRetryAttempt(0);
    };
    es.onerror = (err) => {
      console.error(`[SSE ${debateId}] Error (Attempt ${attempt + 1}):`, err);
      es.close();
      eventSourceRef.current = null;
      if (attempt < MAX_RETRIES) {
        const retryDelay = INITIAL_RETRY_DELAY_MS * Math.pow(2, attempt);
        setRetryAttempt(attempt + 1);
        setIsReconnecting(true);
        console.log(`[SSE ${debateId}] Reconnecting ${attempt + 2} after ${retryDelay}ms...`);
        retryTimeoutRef.current = setTimeout(() => {
            connectEventSource(attempt + 1);
        }, retryDelay);
      } else {
        console.error(`[SSE ${debateId}] Max retries reached.`);
        setErrorRewritten(`Connection failed.`);
        setIsReconnecting(false);
        setIsStreaming(false);
      }
    };
    es.onmessage = (event) => {
      setIsReconnecting(false);
      let streamEvent;
      try {
          streamEvent = JSON.parse(event.data);
          if (typeof streamEvent !== 'object' || streamEvent === null || !streamEvent.type) {
               console.warn(`[SSE ${debateId}] Invalid event format:`, event.data);
               return;
          }
      } catch (parseError) {
        console.error(`[SSE ${debateId}] Parse error:`, event.data, parseError);
        return;
      }
      if (streamEvent.type === 'ping') {
          console.log(`[SSE ${debateId}] Ping`);
      } else if (streamEvent.type === 'chunk') {
          if (typeof streamEvent.payload === 'string') {
              jsonBufferRef.current += streamEvent.payload;
              processJsonBuffer();
          } else {
               console.warn(`[SSE ${debateId}] Non-string chunk payload:`, streamEvent.payload);
          }
      } else if (streamEvent.type === 'complete') {
          console.log(`[SSE ${debateId}] Complete`);
          processJsonBuffer(true);
          jsonBufferRef.current = '';
          if (!persistAttemptedRef.current) {
              persistAttemptedRef.current = true;
              persistToSupabase();
          }
          setIsStreaming(false);
          es.close();
      } else if (streamEvent.type === 'error') {
          console.error(`[SSE ${debateId}] Stream error:`, streamEvent.payload?.message);
          setErrorRewritten(streamEvent.payload?.message || 'Stream error');
          setIsStreaming(false);
          es.close();
      } else {
           console.log(`[SSE ${debateId}] Unhandled type:`, streamEvent.type);
      }
    };
  }, [debateId, MAX_RETRIES, INITIAL_RETRY_DELAY_MS, persistToSupabase, setErrorRewritten]);

  const processJsonBuffer = (isComplete = false) => {
      let buffer = jsonBufferRef.current;
      if (!buffer) return;
      const parsedSpeeches: Speech[] = [];
      let processedChars = 0;
      let tempBuffer = buffer;
      let startOffset = 0;
      let trimmed = tempBuffer.trim();
      if (trimmed.startsWith('[')) trimmed = trimmed.substring(1);
      trimmed = trimmed.trimStart();
      if (trimmed.startsWith(',')) trimmed = trimmed.substring(1);
      trimmed = trimmed.trimStart();
      startOffset = tempBuffer.length - trimmed.length;
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
                          if (parsedObject && typeof parsedObject.speaker === 'string' && typeof parsedObject.text === 'string') {
                              const newSpeech: Speech = {
                                  speaker: parsedObject.speaker,
                                  text: parsedObject.text,
                                  originalIndex: typeof parsedObject.originalIndex === 'number' ? parsedObject.originalIndex : undefined,
                                  originalSnippet: typeof parsedObject.originalSnippet === 'string' ? parsedObject.originalSnippet : undefined,
                              };
                              parsedSpeeches.push(newSpeech);
                              processedChars = startOffset + i + 1;
                              objectStartIndex = -1;
                              let lookAheadIndex = i + 1;
                              while (lookAheadIndex < tempBuffer.length && /\s/.test(tempBuffer[lookAheadIndex])) {
                                  lookAheadIndex++;
                              }
                              if (tempBuffer[lookAheadIndex] === ',') {
                                  processedChars = startOffset + lookAheadIndex + 1;
                              }
                          } else {
                              console.warn(`[Buffer ${debateId}] Invalid object:`, parsedObject);
                              objectStartIndex = -1;
                          }
                      } catch (e) {
                           console.warn(`[Buffer ${debateId}] Partial parse fail.`);
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
           console.error(`[Buffer ${debateId}] Unexpected remaining:`, jsonBufferRef.current);
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
                   // Ensure we have a valid ID before updating state that requires it
                   const currentDebateId = debateIdRef.current;
                   if (!currentDebateId) return prev; // Don't update if ID is somehow null

                   const base = prev ?? { id: currentDebateId, title: 'Loading... ', speeches: [] };
                   return {
                      ...base,
                      speeches: speechesRef.current
                   };
              });
          }
      }
  };

  useEffect(() => {
    if (!debateId) {
      setRewrittenDebate(null);
      setErrorRewritten(null);
      setIsLoadingRewritten(false);
      setIsStreaming(false);
      setIsReconnecting(false);
      eventSourceRef.current?.close();
      if (retryTimeoutRef.current) clearTimeout(retryTimeoutRef.current);
      speechesRef.current = [];
      jsonBufferRef.current = '';
      persistAttemptedRef.current = false;
      return;
    }

    setRewrittenDebate(null);
    setErrorRewritten(null);
    setIsLoadingRewritten(true);
    setIsStreaming(false);
    setIsReconnecting(false);
    setRetryAttempt(0);
    persistAttemptedRef.current = false;
    speechesRef.current = [];
    jsonBufferRef.current = '';

    if (retryTimeoutRef.current) clearTimeout(retryTimeoutRef.current);
    eventSourceRef.current?.close();

    const setupRewrittenDebate = async () => {
      setIsLoadingRewritten(true);
      setErrorRewritten(null);
      setRewrittenDebate(null);
      speechesRef.current = [];
      let currentDebateData: RewrittenDebate = { id: debateId, title: '', speeches: [] };

      try {
        console.log(`Checking Supabase for ${debateId}...`);
        const { data: supabaseDataArray, error: supabaseError } = await supabase
          .from('casual_debates_uwhatgov')
          .select('content, status')
          .eq('id', debateId)
          .limit(1);

        if (supabaseError && supabaseError.code !== 'PGRST116') {
             console.error(`Supabase query error: ${supabaseError.message}`);
        }

        const supabaseData = supabaseDataArray?.[0];

        if (supabaseData?.status === 'success' && supabaseData.content) {
          console.log(`${debateId} loaded from Supabase.`);
          try {
            const parsedContent = JSON.parse(supabaseData.content);
            const typedSpeeches = (parsedContent.speeches || []).map((s: any) => ({
                speaker: s.speaker || '?',
                text: s.text || '',
                originalIndex: typeof s.originalIndex === 'number' ? s.originalIndex : undefined,
                originalSnippet: typeof s.originalSnippet === 'string' ? s.originalSnippet : undefined,
            }));
            setRewrittenDebate({ ...parsedContent, speeches: typedSpeeches });
            speechesRef.current = typedSpeeches;
            setIsLoadingRewritten(false);
          } catch (parseError) {
             console.error("Failed parse Supabase content:", parseError);
             setErrorRewritten("Failed parse cache.");
             setIsLoadingRewritten(false);
          }
        } else {
          console.log(`${debateId} not cached/complete, streaming...`);
          setIsLoadingRewritten(false);
          setIsStreaming(true);
          setRewrittenDebate(currentDebateData); // Show title while loading
          speechesRef.current = [];
          connectEventSource(0);
        }
      } catch (e: any) {
        console.error(`Setup error ${debateId}:`, e);
        setErrorRewritten(`Load error: ${e.message}`);
        setIsLoadingRewritten(false);
        setIsStreaming(false);
      }
    };

    setupRewrittenDebate();

    return () => {
      if (retryTimeoutRef.current) {
          clearTimeout(retryTimeoutRef.current);
          console.log(`Cleared retry timeout for ${debateId} on cleanup`);
      }
      eventSourceRef.current?.close();
      console.log(`SSE closed for ${debateId} on cleanup`);
    };
  }, [debateId, connectEventSource, supabase]);

  const handleBubbleClickInternal = useCallback((index: number | undefined) => {
      console.log(`[ChatView] Bubble click index: ${index}. Calling parent.`);
      onBubbleClick(index); // Call the callback passed from parent
  }, [onBubbleClick]);

  useEffect(() => {
    const timer = setTimeout(() => {
      chatEndRef.current?.scrollIntoView({ behavior: isStreaming ? 'smooth' : 'auto' });
    }, 100);
    return () => clearTimeout(timer);
  }, [rewrittenDebate?.speeches, originalDebateData?.Items, isStreaming, viewMode]);

  const renderContent = () => {
      if (!debateId) {
          return <div className="p-4 text-center text-gray-400">Select a debate to view.</div>;
      }

    if (viewMode === 'rewritten') {
      if (isLoadingRewritten) return <div className="p-4 text-center text-gray-400">Loading Casual Version...</div>;
      if (errorRewritten && !rewrittenDebate?.speeches?.length) return <div className="p-4 text-center text-red-400">Error: {errorRewritten}</div>;
      if (!rewrittenDebate) return <div className="p-4 text-center text-gray-400">Casual debate not available.</div>;

      return (
        <>
          {rewrittenDebate.speeches?.map((speech: Speech, index: number) => (
            <MessageBubble
                key={`rewritten-${speech.originalIndex || index}`}
                speech={speech}
                onClick={() => handleBubbleClickInternal(speech.originalIndex)}
                isSelected={selectedOriginalIndex === speech.originalIndex}
                originalDebate={originalDebateData}
            />
          ))}
       <div className="p-2 text-center text-sm">
         {isStreaming && !isReconnecting && <p className="text-teal-400 animate-pulse">Streaming...</p>}
         {isReconnecting && <p className="text-yellow-400 animate-pulse">Reconnecting (Attempt {retryAttempt + 1}/{MAX_RETRIES + 1})...</p>}
         {errorRewritten && !isReconnecting && <p className="text-red-500">Error: {errorRewritten}</p>}
       </div>
       {!isStreaming && !isLoadingRewritten && rewrittenDebate.speeches?.length === 0 && (
            <p className="text-center text-gray-500">{errorRewritten ? 'Failed to load.' : 'No casual speeches.'}</p>
          )}
           {errorRewritten && rewrittenDebate.speeches?.length > 0 && <p className="text-center text-red-400 text-sm p-2">Stream Error: {errorRewritten}</p>}
        </>
      );
    } else { // viewMode === 'original'
      if (isLoadingOriginal) return <div className="p-4 text-center text-gray-400">Loading Original Version...</div>;
      if (errorOriginal) return <div className="p-4 text-center text-red-400">Error: {errorOriginal}</div>;
      if (!originalDebateData) return <div className="p-4 text-center text-gray-400">Original debate not available.</div>;

      // Render basic original content directly, as OriginalContribution component is now separate
      return (
        <>
          {originalDebateData.Items?.filter(item => item.ItemType === 'Contribution' && item.Value).map((item: DebateContentItem, index: number) => (
            <div key={`original-${item.ItemId || index}`} className="mb-2 p-3 rounded bg-gray-700 text-gray-300 shadow-sm">
                 <p className="font-semibold text-sm mb-1 text-blue-300">{item.AttributedTo || 'Speaker/Unlisted'}</p>
                 <div className="text-sm prose prose-sm prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: item.Value || '' }} />
            </div>
          ))}
          {(!originalDebateData.Items || originalDebateData.Items.filter(item => item.ItemType === 'Contribution' && item.Value).length === 0) && (
             <p className="text-center text-gray-500">No contributions found.</p>
          )}
        </>
      );
    }
  };

  return (
    <div className="flex flex-col bg-gradient-to-b from-[#111b21] via-[#0c1317] to-[#111b21] text-gray-200">
       <div className="flex-grow overflow-y-auto p-4 space-y-4">
        {renderContent()}
        <div ref={chatEndRef} />
      </div>
    </div>
  );
} 
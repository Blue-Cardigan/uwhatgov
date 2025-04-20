'use client';

import { useState, useEffect, useRef, useCallback, forwardRef, useImperativeHandle } from 'react';
import { createClient } from '@supabase/supabase-js';

// Define types locally for the rewritten version
export interface Speech {
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

// Import party color utility
import { getPartyColorClassFromName, parsePartyAbbreviation, getPartyColorClass } from '@/lib/partyColors';

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
  // Search related props
  searchQuery: string;
  highlightedIndex: number | null;
  onRewrittenDebateUpdate: (speeches: Speech[]) => void; // Callback for parent
}

// Define type for the response from our members API endpoint
interface MemberInfo {
  id: number;
  name: string;
  party: string;
  constituency: string;
  portraitUrl: string;
}

// Helper function to escape regex characters
function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Helper function to extract base speaker name (removing party/constituency/title)
function getBaseSpeakerName(speakerString: string): string {
    if (!speakerString) return 'Unknown Speaker';

    let name = speakerString.trim();
    const knownParties = ['Con', 'DUP', 'Lab', 'LD', 'PC', 'UUP', 'Ind', 'SNP', 'CB']; // Keep in sync

    const lastParenMatch = name.match(/\s*\(([^)]+)\)$/);

    if (lastParenMatch) {
        const lastContent = lastParenMatch[1].trim();
        const potentialParty = lastContent.split('/')[0].trim();
        const nameBeforeLastParen = name.substring(0, lastParenMatch.index).trim();
        const secondLastParenMatch = nameBeforeLastParen.match(/\s*\(([^)]+)\)$/);

        // Case 1: Last paren content IS a known party
        if (knownParties.includes(potentialParty)) {
            name = nameBeforeLastParen;
            // If there was another paren before it (constituency), remove that too
            if (secondLastParenMatch) {
                name = name.substring(0, secondLastParenMatch.index).trim();
            }
        } 
        // Case 2: Last paren content is NOT a party, but there IS a paren before it
        else if (secondLastParenMatch) {
            // Assume format Name (Constituency) (SomethingElse - maybe role in brackets?)
            // Base name is before the constituency
            name = nameBeforeLastParen.substring(0, secondLastParenMatch.index).trim();
        } 
        // Case 3: Last paren content is NOT a party, and NO paren before it
        else {
            // Assume format Title (Actual Name). Extract name from parens.
            name = lastContent;
        }
    } 
    // Case 4: No parentheses at all
    // name remains the original trimmed string

    return name || 'Unknown Speaker'; // Return the processed name or fallback
}

// Helper function to highlight search matches
const HighlightedText = ({ text, query }: { text: string; query: string }) => {
    if (!query || !text) {
      return <>{text}</>;
    }
    const regex = new RegExp(`(${escapeRegExp(query)})`, 'gi');
    const parts = text.split(regex);

    return (
      <>
        {parts.map((part, i) =>
          regex.test(part) ? (
            <mark key={i} className="bg-yellow-400 text-black rounded px-0.5">
              {part}
            </mark>
          ) : (
            part
          )
        )}
      </>
    );
};

// MessageBubble component
interface MessageBubbleProps {
    speech: Speech;
    onClick: () => void;
    isSelected: boolean;
    originalDebate: DebateResponse | null;
    searchQuery: string;
    isHighlighted: boolean;
    itemRef: (el: HTMLDivElement | null) => void; // Ref callback
    partyAbbreviation?: string | null;
}

const MessageBubble = ({ speech, onClick, isSelected, originalDebate, searchQuery, isHighlighted, itemRef, partyAbbreviation }: MessageBubbleProps) => {
    const isOwnMessage = false;
    const memberId = (typeof speech.originalIndex === 'number' && originalDebate?.Items)
        ? originalDebate.Items.find(item => item.OrderInSection === speech.originalIndex)?.MemberId
        : null;
    const portraitUrl = memberId
        ? `https://members-api.parliament.uk/api/Members/${memberId}/Portrait?cropType=OneOne`
        : null;

    // --- Infobox State ---
    const [isInfoboxVisible, setIsInfoboxVisible] = useState(false);
    const [memberInfo, setMemberInfo] = useState<MemberInfo | null>(null);
    const [isLoadingInfo, setIsLoadingInfo] = useState(false);
    const [errorInfo, setErrorInfo] = useState<string | null>(null);
    const fetchAbortControllerRef = useRef<AbortController | null>(null);
    const infoboxRef = useRef<HTMLDivElement>(null); // Ref for the infobox itself
    // --- --- ---

    const baseClasses = "rounded-lg px-3 py-2 max-w-xs sm:max-w-sm md:max-w-md shadow-md cursor-pointer transition-colors duration-200 ease-in-out relative";
    const alignment = isOwnMessage ? 'justify-end' : 'justify-start';
    const colors = isOwnMessage
        ? (isSelected ? 'bg-[#007a65] text-white ring-2 ring-teal-300' : 'bg-[#005c4b] text-white hover:bg-[#007a65]')
        : (isSelected ? 'bg-[#2a3942] text-gray-100 ring-2 ring-teal-300' : 'bg-[#202c33] text-gray-200 hover:bg-[#2a3942]');

    const highlightRing = isHighlighted ? 'ring-4 ring-yellow-500 ring-offset-2 ring-offset-[#0c1317]' : '';

    // --- Infobox Logic ---
    const fetchMemberInfo = useCallback(async () => {
        if (!memberId || memberInfo || isLoadingInfo) return; // Don't fetch if no ID, already loaded, or currently loading

        setIsLoadingInfo(true);
        setErrorInfo(null);
        fetchAbortControllerRef.current?.abort();
        const abortController = new AbortController();
        fetchAbortControllerRef.current = abortController;

        console.log(`[Infobox] Fetching info for member ${memberId}`);
        try {
            const response = await fetch(`/api/members/${memberId}`, {
                signal: abortController.signal,
            });
            if (!response.ok) {
                let errorMsg = `Failed: ${response.status}`;
                try { const errData = await response.json(); errorMsg = errData.error || errorMsg; } catch (e) {}
                throw new Error(errorMsg);
            }
            const data: MemberInfo = await response.json();
            if (!abortController.signal.aborted) {
                 setMemberInfo(data);
            }
        } catch (error: any) {
            if (error.name !== 'AbortError') {
                console.error(`[Infobox] Error fetching member ${memberId}:`, error);
                setErrorInfo(error.message || 'Failed to load details');
                 setIsInfoboxVisible(true); // Keep infobox open to show error
            }
        } finally {
            if (!abortController.signal.aborted) {
                 setIsLoadingInfo(false);
                 fetchAbortControllerRef.current = null;
            }
        }
    }, [memberId, memberInfo, isLoadingInfo]);

    const handleInfoboxToggle = useCallback((event: React.MouseEvent) => {
        event.stopPropagation(); // Prevent bubble click
        const shouldShow = !isInfoboxVisible;
        setIsInfoboxVisible(shouldShow);

        if (shouldShow && memberId && !memberInfo) { // Fetch only if showing and data not loaded
             fetchMemberInfo();
        }

        // Abort fetch if closing
        if (!shouldShow) {
            fetchAbortControllerRef.current?.abort();
        }
    }, [isInfoboxVisible, memberId, memberInfo, fetchMemberInfo]);

    // Effect to handle clicks outside the infobox to close it
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (infoboxRef.current && !infoboxRef.current.contains(event.target as Node)) {
                setIsInfoboxVisible(false);
                fetchAbortControllerRef.current?.abort(); // Abort fetch if clicking outside
            }
        };

        if (isInfoboxVisible) {
            document.addEventListener('mousedown', handleClickOutside);
        } else {
            document.removeEventListener('mousedown', handleClickOutside);
        }

        // Cleanup listener on component unmount or when infobox closes
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isInfoboxVisible]); // Re-run effect when isInfoboxVisible changes

    return (
        // Main bubble container - onClick here selects the speech
        <div ref={itemRef} className={`flex mb-3 gap-2 ${alignment} rounded-lg transition-all duration-150 ease-in-out`} onClick={onClick}>
            {!isOwnMessage && (
                 // Portrait container - onClick here toggles infobox
                 <div
                    className="flex-shrink-0 w-8 h-8 mt-1 relative cursor-pointer" // Added cursor-pointer
                    onClick={handleInfoboxToggle}
                 >
                    {portraitUrl ? (
                        <img
                            src={portraitUrl}
                            alt={speech.speaker || 'Speaker'}
                            className="rounded-full w-full h-full object-cover bg-gray-600 pointer-events-none" // Disable pointer events on img itself
                        />
                    ) : (
                        <div className="rounded-full w-full h-full bg-gray-500 flex items-center justify-center text-white text-xs font-semibold pointer-events-none"> {/* Disable pointer events */} 
                            {speech.speaker?.charAt(0) || '?'}
                        </div>
                    )}
                    {/* --- Infobox Rendering --- */}
                    {isInfoboxVisible && memberId && (
                        <div
                            ref={infoboxRef} // Add ref to the infobox itself
                            className="absolute bottom-full left-1/2 transform mb-2 w-64 z-50 p-3 bg-[#2a3942] border border-gray-600 rounded-lg shadow-lg text-sm text-gray-200 whitespace-normal" // Increased z-index to z-50
                            onClick={(e) => e.stopPropagation()} // Prevent clicks inside infobox from closing it
                        >
                             {isLoadingInfo && <p className="text-center text-gray-400 italic">Loading...</p>}
                             {errorInfo && <p className="text-center text-red-400">Error: {errorInfo}</p>}
                             {memberInfo && (
                                <div>
                                    <p className="font-semibold text-base mb-1">{memberInfo.name}</p>
                                    <p className="mb-1">{memberInfo.party}</p>
                                    <p className="text-xs text-gray-400">{memberInfo.constituency}</p>
                                </div>
                             )}
                             {!memberInfo && !isLoadingInfo && !errorInfo && <p className="text-center text-gray-400 italic">Details unavailable.</p>}
                         </div>
                    )}
                    {/* --- --- --- */}
                </div>
            )}
            {/* Bubble Content */}
            <div className={`${baseClasses} ${colors} ${highlightRing}`}>
                 {/* Speaker Name - onClick here toggles infobox */} 
                 <div
                    className="inline-block relative cursor-pointer" // Added cursor-pointer
                    onClick={handleInfoboxToggle}
                 >
                    <p className={`font-semibold text-sm mb-1 ${partyAbbreviation !== undefined ? getPartyColorClass(partyAbbreviation) : getPartyColorClassFromName(speech.speaker)} pointer-events-none`}>
                        <HighlightedText text={speech.speaker || 'Unknown Speaker'} query={searchQuery} />
                    </p>
                 </div>
                 {/* Speech Text - Clicking here still triggers the main bubble onClick */}
                <p className="text-sm whitespace-pre-wrap"><HighlightedText text={speech.text} query={searchQuery} /></p>
            </div>
        </div>
    );
};

const ChatView = forwardRef(({
    debateId,
    viewMode,
    originalDebateData,
    isLoadingOriginal,
    errorOriginal,
    fetchOriginalDebate,
    selectedOriginalIndex,
    onBubbleClick,
    searchQuery, // Destructure new prop
    highlightedIndex, // Destructure new prop
    onRewrittenDebateUpdate // Destructure new prop
}: ChatViewProps, ref): React.ReactNode => {
  const [rewrittenDebate, setRewrittenDebate] = useState<RewrittenDebate | null>(null);
  const [isLoadingRewritten, setIsLoadingRewritten] = useState(true);
  const [isStreaming, setIsStreaming] = useState(false);
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
  const itemRefs = useRef<Map<number, HTMLDivElement | null>>(new Map()); // Ref map for items
  const [speakerPartyMap, setSpeakerPartyMap] = useState<Map<string, string | null>>(new Map()); // Map base speaker name -> party abbreviation (or null)

  // Expose scrollToItem method to parent via ref
  useImperativeHandle(ref, () => ({
    scrollToItem: (index: number) => {
      const element = itemRefs.current.get(index);
      element?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }));

  // Effect to scroll to highlighted item (triggered from parent search navigation)
  useEffect(() => {
    if (highlightedIndex !== null) {
        const element = itemRefs.current.get(highlightedIndex);
        // Check if element exists before scrolling
        if (element) {
             console.log(`[ChatView] Scrolling to highlighted index: ${highlightedIndex}`);
             element.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
        } else {
            console.warn(`[ChatView] Ref for index ${highlightedIndex} not found for scrolling.`);
            // Optionally, scroll to top/bottom or show a message if ref not ready yet
        }
    }
  }, [highlightedIndex]); // Depend only on highlightedIndex

  // Helper to manage refs
  const setItemRef = (index: number) => (el: HTMLDivElement | null) => {
      if (el) {
          itemRefs.current.set(index, el);
      } else {
          itemRefs.current.delete(index);
      }
  };

  // Clear refs when debate changes or view mode switches
  useEffect(() => {
      itemRefs.current.clear();
  }, [debateId, viewMode]);

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
        await supabase.from('casual_debates_uwhatgov').update({ status: 'failed' }).eq('id', currentDebateId);
    } else {
        console.log(`Persisted ${currentDebateId} successfully.`);
    }
  }, [supabase]);

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
          setIsStreaming(false);
          es.close();
      } else {
           console.log(`[SSE ${debateId}] Unhandled type:`, streamEvent.type);
      }
    };
  }, [debateId, MAX_RETRIES, INITIAL_RETRY_DELAY_MS, persistToSupabase]);

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
              onRewrittenDebateUpdate(speechesRef.current); // Notify parent
          }
      }
  };

  useEffect(() => {
    if (!debateId) {
      setRewrittenDebate(null);
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
            onRewrittenDebateUpdate(speechesRef.current); // Notify parent of cached data
            setIsLoadingRewritten(false);
          } catch (parseError) {
             console.error("Failed parse Supabase content:", parseError);
             setIsLoadingRewritten(false);
          }
        } else {
          console.log(`${debateId} not cached/complete, streaming...`);
          setIsLoadingRewritten(false);
          setIsStreaming(true);
          setRewrittenDebate(currentDebateData); // Show title while loading
          speechesRef.current = [];
          onRewrittenDebateUpdate([]); // Notify parent of empty initial state
          connectEventSource(0);
        }
      } catch (e: any) {
        console.error(`Setup error ${debateId}:`, e);
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
      // Only auto-scroll to end if not searching/highlighting
      if (highlightedIndex === null) {
          chatEndRef.current?.scrollIntoView({ behavior: isStreaming ? 'smooth' : 'auto' });
      }
    }, 100);
    return () => clearTimeout(timer);
  }, [rewrittenDebate?.speeches, originalDebateData?.Items, isStreaming, viewMode, highlightedIndex]);

  // Effect to build the speaker-party map from rewritten speeches
  useEffect(() => {
    if (rewrittenDebate?.speeches) {
      const newMap = new Map<string, string | null>();
      const knownParties = ['Con', 'DUP', 'Lab', 'LD', 'PC', 'UUP', 'Ind', 'SNP', 'CB'];
      rewrittenDebate.speeches.forEach(speech => {
        const baseName = getBaseSpeakerName(speech.speaker);
        const potentialPartyAbbr = parsePartyAbbreviation(speech.speaker); // Use the existing parser
        let finalPartyAbbr: string | null = null;

        // Store the first party found/inferred for each speaker name
        if (baseName && baseName !== 'Unknown Speaker' && !newMap.has(baseName)) {
            // 1. Check if the parsed abbreviation is a known party
            if (potentialPartyAbbr && knownParties.includes(potentialPartyAbbr)) {
                finalPartyAbbr = potentialPartyAbbr;
            } else {
                // 2. If not a known party (or null), try inferring from title keywords
                const lowerSpeaker = speech.speaker.toLowerCase(); // Case-insensitive check
                if (lowerSpeaker.includes('shadow')) {
                    finalPartyAbbr = 'Con'; // Assume Shadow = Conservative
                    console.log(`[Party Inference] Found 'Shadow' for ${baseName}, setting party to Con`);
                } else if (lowerSpeaker.includes('minister for') || lowerSpeaker.includes('secretary of state')) {
                    finalPartyAbbr = 'Lab'; // Assume Minister/SoS = Labour (current gov)
                    console.log(`[Party Inference] Found Gov title for ${baseName}, setting party to Lab`);
                }
            }

            // Store the abbreviation (which might be null if none was found/inferred)
            newMap.set(baseName, finalPartyAbbr);
        }
      });

      // Check if the map content *needs* updating (ignore if only nulls were added/changed)
      let changed = newMap.size !== speakerPartyMap.size;
      if (!changed) {
        for (const [key, value] of newMap.entries()) {
            if (speakerPartyMap.get(key) !== value) {
                changed = true;
                break;
            }
        }
      }

      // Update state only if the map content has actually changed
      if (changed) {
        console.log('[ChatView] Updating Speaker-Party Map:', newMap);
        setSpeakerPartyMap(newMap);
      }
    }

    // Clear map when debate changes (or speeches become empty)
    if (!rewrittenDebate?.speeches || rewrittenDebate.speeches.length === 0) {
        if (speakerPartyMap.size > 0) {
             console.log('[ChatView] Clearing Speaker-Party Map due to empty/changed debate.');
             setSpeakerPartyMap(new Map());
        }
    }

  }, [rewrittenDebate?.speeches]); // Rerun only when speeches change

  const renderContent = () => {
      if (!debateId) {
          return <div className="p-4 text-center text-gray-400">Select a debate to view.</div>;
      }

    if (viewMode === 'rewritten') {
      if (isLoadingRewritten) return <div className="p-4 text-center text-gray-400">Loading Casual Version...</div>;
      if (!rewrittenDebate) return <div className="p-4 text-center text-gray-400">Casual debate not available.</div>;

      return (
        <>
          {rewrittenDebate.speeches?.map((speech: Speech, index: number) => {
            const itemIndex = speech.originalIndex ?? index; // Use originalIndex if available, fallback to sequential index
            const baseSpeakerName = getBaseSpeakerName(speech.speaker); // Get base name for map lookup
            const partyAbbreviation = speakerPartyMap.get(baseSpeakerName); // Get stored party abbreviation from map

            return (
                <MessageBubble
                    key={`rewritten-${itemIndex}-${index}`} // Improve key uniqueness
                    speech={speech}
                    onClick={() => handleBubbleClickInternal(speech.originalIndex)}
                    isSelected={selectedOriginalIndex === itemIndex}
                    originalDebate={originalDebateData}
                    searchQuery={searchQuery} // Pass search query
                    isHighlighted={highlightedIndex === itemIndex} // Check if this item is highlighted
                    itemRef={setItemRef(itemIndex)} // Pass ref callback with correct index
                    partyAbbreviation={partyAbbreviation} // Pass determined party abbreviation (might be undefined/null)
                />
            );
          })}
       <div className="p-2 text-center text-sm">
         {isStreaming && !isReconnecting && <p className="text-teal-400 animate-pulse">Streaming...</p>}
         {isReconnecting && <p className="text-yellow-400 animate-pulse">Reconnecting (Attempt {retryAttempt + 1}/{MAX_RETRIES + 1})...</p>}
       </div>
       {!isStreaming && !isLoadingRewritten && rewrittenDebate.speeches?.length === 0 && (
             <p className="text-center text-gray-500">{'No casual speeches found.'}</p>
           )}
        </>
      );
    } else { // viewMode === 'original'
      if (isLoadingOriginal) return <div className="p-4 text-center text-gray-400">Loading Original Version...</div>;
      if (errorOriginal) return <div className="p-4 text-center text-red-400">Error: {errorOriginal}</div>;
      if (!originalDebateData) return <div className="p-4 text-center text-gray-400">Original debate not available.</div>;

      // Render basic original content directly, as OriginalContribution component is now separate
      return (
        <>
          {originalDebateData.Items?.filter(item => item.ItemType === 'Contribution' && item.Value).map((item: DebateContentItem) => {
            const itemIndex = item.OrderInSection;
            const isHighlighted = highlightedIndex === itemIndex;
            const highlightRing = isHighlighted ? 'ring-4 ring-yellow-500 ring-offset-2 ring-offset-[#0c1317]' : '';

             // Highlight function for HTML string
             const highlightHtml = (html: string, query: string): string => {
                 if (!query || !html) return html;
                 // This is a basic approach and might break HTML structure if query matches tags.
                 // A more robust solution would parse the HTML or use a library.
                 // For simplicity, we replace text content occurrences.
                 const regex = new RegExp(`(${escapeRegExp(query)})`, 'gi');
                 // Avoid highlighting inside tags
                 const parts = html.split(/(<[^>]*>)/); // Split by tags
                 return parts.map(part => {
                     if (part.startsWith('<') && part.endsWith('>')) {
                         return part; // Keep tags as is
                     } else {
                         // Highlight text content
                         return part.replace(regex, `<mark class="bg-yellow-400 text-black rounded px-0.5">$1</mark>`);
                     }
                 }).join('');
             };

             const highlightedValue = highlightHtml(item.Value || '', searchQuery);

             return (
                <div
                    key={`original-${item.ItemId || itemIndex}`}
                    ref={setItemRef(itemIndex)} // Add ref
                    className={`mb-2 p-3 rounded bg-gray-700 text-gray-300 shadow-sm ${highlightRing} transition-all duration-150 ease-in-out`}
                >
                    <p className="font-semibold text-sm mb-1 text-blue-300">
                        <HighlightedText text={item.AttributedTo || 'Speaker/Unlisted'} query={searchQuery} />
                    </p>
                    <div className="text-sm prose prose-sm prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: highlightedValue }} />
                </div>
             );
         })}
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
});

ChatView.displayName = 'ChatView'; // Add display name for DevTools

export default ChatView; 
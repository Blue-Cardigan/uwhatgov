'use client';

import { useState, useEffect, useRef, useCallback, forwardRef, useImperativeHandle } from 'react';
import { createClient } from '@supabase/supabase-js';
import { MessageBubble, HighlightedText } from './MessageBubble';
import { DebateResponse, DebateContentItem } from '@/lib/hansard/types';
import { parsePartyAbbreviation } from '@/lib/partyColors';
import { TypingIndicator } from './TypingIndicator';

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

// Helper function to escape regex characters
function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("Supabase URL or Anon Key is missing.");
}
const supabase = createClient(supabaseUrl!, supabaseAnonKey!);

// localStorage key for party cache
const MEMBER_PARTY_CACHE_PREFIX = 'uwhatgov_member_party_';

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
  const SPEECH_DISPLAY_DELAY_MS = 750;

  const [typingSpeakerInfo, setTypingSpeakerInfo] = useState<{ speaker: string, party: string | null } | null>(null);

  const chatEndRef = useRef<HTMLDivElement>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const persistAttemptedRef = useRef<boolean>(false);
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const speechesRef = useRef<Speech[]>([]);
  const debateIdRef = useRef<string | null>(debateId);
  const jsonBufferRef = useRef<string>('');
  const itemRefs = useRef<Map<number, HTMLDivElement | null>>(new Map()); // Ref map for items
  const [speakerPartyMap, setSpeakerPartyMap] = useState<Map<string, string | null>>(new Map()); // Map base speaker name -> party abbreviation (or null)
  const currentlyFetchingParties = useRef<Set<number>>(new Set()); // Track ongoing party fetches

  // Refs for delayed display queue
  const pendingSpeechesQueueRef = useRef<Speech[]>([]);
  const isProcessingQueueRef = useRef<boolean>(false);
  const speechDisplayTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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
      setTypingSpeakerInfo(null);
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
          // Add parsed speeches to the pending queue instead of directly updating state
          pendingSpeechesQueueRef.current.push(...parsedSpeeches);
          // Start processing the queue if not already running
          if (!isProcessingQueueRef.current) {
              processPendingSpeeches();
          }
      }
  };

  // Function to process the queue of pending speeches with delay
  const processPendingSpeeches = useCallback(async () => {
      if (isProcessingQueueRef.current || pendingSpeechesQueueRef.current.length === 0) {
          // If already processing or queue is empty, check for completion
          if (!isProcessingQueueRef.current && pendingSpeechesQueueRef.current.length === 0 && !isStreaming && !persistAttemptedRef.current && debateIdRef.current && speechesRef.current.length > 0) {
              // If not processing, queue empty, streaming done, not persisted yet, and we have a debateId and speeches
              console.log(`[Queue ${debateIdRef.current}] Queue empty & stream complete. Persisting.`);
              persistAttemptedRef.current = true;
              await persistToSupabase(); // Ensure persistence happens after all speeches are shown
          }
          return;
      }

      isProcessingQueueRef.current = true;
      const speechToShow = pendingSpeechesQueueRef.current.shift();

      if (speechToShow) {
          const baseSpeakerName = getBaseSpeakerName(speechToShow.speaker);
          const partyAbbreviation = speakerPartyMap.get(baseSpeakerName) ?? null;
          setTypingSpeakerInfo({ speaker: baseSpeakerName, party: partyAbbreviation });

          // Clear previous timeout if exists
          if (speechDisplayTimeoutRef.current) {
              clearTimeout(speechDisplayTimeoutRef.current);
          }

          speechDisplayTimeoutRef.current = setTimeout(() => {
              setTypingSpeakerInfo(null); // Hide typing indicator

              // Add the speech to the actual displayed state
              speechesRef.current = [...speechesRef.current, speechToShow];
              setRewrittenDebate(prev => {
                  const currentDebateId = debateIdRef.current;
                  if (!currentDebateId) return prev;
                  const base = prev ?? { id: currentDebateId, title: 'Loading...', speeches: [] };
                  return {
                      ...base,
                      speeches: speechesRef.current
                  };
              });
              onRewrittenDebateUpdate(speechesRef.current); // Notify parent

              isProcessingQueueRef.current = false;
              speechDisplayTimeoutRef.current = null;
              processPendingSpeeches(); // Process next item in queue
          }, SPEECH_DISPLAY_DELAY_MS);
      } else {
          isProcessingQueueRef.current = false; // Should not happen if length check passed, but good practice
          setTypingSpeakerInfo(null);
          processPendingSpeeches(); // Check again (e.g., for persistence)
      }
  }, [persistToSupabase, onRewrittenDebateUpdate, speakerPartyMap, SPEECH_DISPLAY_DELAY_MS, isStreaming]);

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
      if (highlightedIndex === null && !typingSpeakerInfo) {
          chatEndRef.current?.scrollIntoView({ behavior: isStreaming ? 'smooth' : 'auto' });
      }
    }, 100);
    return () => clearTimeout(timer);
  }, [rewrittenDebate?.speeches, originalDebateData?.Items, isStreaming, viewMode, highlightedIndex, typingSpeakerInfo]);

  // Function to get party from cache or fetch it
  const getOrFetchParty = useCallback(async (memberId: number, baseName: string): Promise<string | null> => {
      // 1. Check localStorage
      const cacheKey = MEMBER_PARTY_CACHE_PREFIX + memberId;
      try {
          const cachedParty = localStorage.getItem(cacheKey);
          if (cachedParty) {
              // console.log(`[Party Cache] HIT localStorage for member ${memberId}: ${cachedParty}`);
              return cachedParty === 'null' ? null : cachedParty; // Handle explicitly stored null
          }
      } catch (e) {
          console.error(`[Party Cache] Error reading localStorage for member ${memberId}:`, e);
      }

      // 2. Check if already fetching
      if (currentlyFetchingParties.current.has(memberId)) {
          // console.log(`[Party Cache] Already fetching party for member ${memberId}`);
          return null; // Don't trigger another fetch
      }

      // 3. Fetch from API
      // console.log(`[Party Cache] MISS localStorage for member ${memberId} (${baseName}). Fetching...`);
      currentlyFetchingParties.current.add(memberId);
      let fetchedParty: string | null = null;
      try {
          const response = await fetch(`/api/members/${memberId}`);
          if (response.ok) {
              const memberInfo: { party?: string } = await response.json();
              fetchedParty = memberInfo.party || null;
              // console.log(`[Party Cache] Fetched party for member ${memberId}: ${fetchedParty}`);

              // 4. Store in localStorage
              try {
                  localStorage.setItem(cacheKey, fetchedParty === null ? 'null' : fetchedParty);
              } catch (e) {
                  console.error(`[Party Cache] Error writing localStorage for member ${memberId}:`, e);
              }

              // 5. Update state map immediately (will trigger re-render)
              setSpeakerPartyMap(prevMap => {
                  // Check if the component is still dealing with the same debate
                  if (debateIdRef.current !== debateId) return prevMap; // Stale update check

                  const currentParty = prevMap.get(baseName);
                  // Update only if the new party info is different from the existing one
                  if (currentParty !== fetchedParty) {
                      const newMap = new Map(prevMap);
                      newMap.set(baseName, fetchedParty);
                      // console.log(`[Party Cache] Updating map for ${baseName} to ${fetchedParty}`);
                      return newMap;
                  }
                  return prevMap; // No change needed
              });

          } else {
              console.warn(`[Party Cache] API fetch failed for member ${memberId}: ${response.status}. Caching null.`);
              // Cache null on failure to prevent repeated fetches for non-existent/erroring IDs
              try { localStorage.setItem(cacheKey, 'null'); } catch (e) { /* ignore */ }
          }
      } catch (error) {
          console.error(`[Party Cache] Network error fetching party for member ${memberId}:`, error);
          // Cache null on network error
          try { localStorage.setItem(cacheKey, 'null'); } catch (e) { /* ignore */ }
      } finally {
          currentlyFetchingParties.current.delete(memberId);
      }

      return fetchedParty;
  }, [setSpeakerPartyMap, debateId]); // Include debateId to check for stale updates inside setter

  // Effect to build/update the speaker-party map
  useEffect(() => {
    // Ensure both rewritten speeches and original data (for member IDs) are available
    if (!rewrittenDebate?.speeches || !originalDebateData?.Items) {
        if (speakerPartyMap.size > 0) {
             console.log('[ChatView] Clearing Speaker-Party Map due to missing data.');
             setSpeakerPartyMap(new Map());
        }
        return;
    }

    const buildMap = async () => {
        // Create a new map instance based on the current state for modification
        const tempMap = new Map<string, string | null>(speakerPartyMap);
        const knownParties = ['Con', 'DUP', 'Lab', 'LD', 'PC', 'UUP', 'Ind', 'SNP', 'CB'];
        let needsStateUpdate = false; // Track if the final state needs to be set

        for (const speech of rewrittenDebate.speeches) {
            const baseName = getBaseSpeakerName(speech.speaker);
            if (baseName === 'Unknown Speaker') continue;

            // Skip if we already have a definitive party (non-null) for this speaker in the temp map
            if (tempMap.has(baseName) && tempMap.get(baseName) !== null) {
                continue;
            }

            let currentSpeechParty: string | null = null;

            // --- Strategy --- (Refined Order)
            // 1. Try parsing from current speech string (most direct)
            // 2. Try localStorage via memberId (cached)
            // 3. Try fetching via memberId (if available & not cached) -> This will update state directly, but we capture result here too
            // 4. Try inferring from title keywords (fallback)

            // 1. Parse from current speech string
            const parsedPartyAbbr = parsePartyAbbreviation(speech.speaker);
            if (parsedPartyAbbr && knownParties.includes(parsedPartyAbbr)) {
                currentSpeechParty = parsedPartyAbbr;
            }

            // Find corresponding original item to get MemberId
            const originalItem = speech.originalIndex !== undefined
                ? originalDebateData.Items.find(item => item.OrderInSection === speech.originalIndex && item.ItemType === 'Contribution')
                : null;
            const memberId = originalItem?.MemberId;

            // 2. & 3. Try localStorage or fetch if memberId exists AND party not found yet
            if (memberId && currentSpeechParty === null) {
                const partyFromCacheOrFetch = await getOrFetchParty(memberId, baseName);
                // Use the result if it provided a party (it might return null if fetch failed or cache was explicitly null)
                if (partyFromCacheOrFetch !== null) {
                     currentSpeechParty = partyFromCacheOrFetch;
                }
                // Note: getOrFetchParty might have already updated the main state map if fetch was successful.
                // We still check its return value here for fallback logic within this loop iteration.
            }

            // 4. Infer from title keywords if party still not found
            if (currentSpeechParty === null) {
                const lowerSpeaker = speech.speaker.toLowerCase();
                if (lowerSpeaker.includes('shadow')) {
                    currentSpeechParty = 'Con';
                    // console.log(`[Party Inference] Found 'Shadow' for ${baseName}, setting party to Con`);
                } else if (lowerSpeaker.includes('minister for') || lowerSpeaker.includes('secretary of state')) {
                    currentSpeechParty = 'Lab';
                    console.log(`[Party Inference] Found Gov title for ${baseName}, setting party to Lab`);
                }
            }

            // Update the temporary map only if the value is different or new
            if (tempMap.get(baseName) !== currentSpeechParty) {
                 tempMap.set(baseName, currentSpeechParty);
                 needsStateUpdate = true; // Mark that an update happened in this iteration
            }
        } // End loop through speeches

        // Update state only if the map content has actually changed during the loop
        // This check complements the direct state update within getOrFetchParty
        // It ensures changes from parsing/inference also trigger a state update if needed.
        if (needsStateUpdate) {
             // Compare final tempMap with current state speakerPartyMap before setting
             let mapsAreEqual = tempMap.size === speakerPartyMap.size;
             if (mapsAreEqual) {
                 for (const [key, value] of tempMap) {
                     if (speakerPartyMap.get(key) !== value) {
                         mapsAreEqual = false;
                         break;
                     }
                 }
             }

             if (!mapsAreEqual) {
                 // console.log('[ChatView] Finalizing Speaker-Party Map update:', tempMap);
                 setSpeakerPartyMap(tempMap);
             }
        }
    };

    buildMap();

  }, [rewrittenDebate?.speeches, originalDebateData?.Items, speakerPartyMap, getOrFetchParty]); // Added dependencies

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
         {isReconnecting && <p className="text-yellow-400 animate-pulse">Reconnecting (Attempt {retryAttempt + 1}/{MAX_RETRIES + 1})...</p>}
       </div>
       {/* Show specific loading message only when streaming starts and no messages are present yet */} 
       {!isLoadingRewritten && isStreaming && rewrittenDebate.speeches?.length === 0 && (
             <p className="text-center text-gray-400 italic">You're the first... loading messages...</p>
           )}
        {/* Show "No speeches found" only if not loading, not streaming, and array is empty */} 
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
        <div className="h-8 px-4 pb-4 flex items-center">
          {typingSpeakerInfo && (
            <TypingIndicator
              speakerName={typingSpeakerInfo.speaker}
              partyAbbreviation={typingSpeakerInfo.party}
            />
          )}
        </div>
        <div ref={chatEndRef} />
      </div>
    </div>
  );
});

ChatView.displayName = 'ChatView'; // Add display name for DevTools

export default ChatView; 
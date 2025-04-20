'use client';

import { useState, useEffect, useRef, useCallback, forwardRef, useImperativeHandle } from 'react';
import type { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import { useAuth } from '@/contexts/AuthContext';
import { MessageBubble, HighlightedText } from './MessageBubble';
import { DebateResponse, DebateContentItem } from '@/lib/hansard/types';
import { parsePartyAbbreviation } from '@/lib/partyColors';
import { TypingIndicator } from './TypingIndicator';
import { escapeRegExp } from '@/utils/stringUtils';
import { getBaseSpeakerName } from '@/utils/chatUtils';
import type { Database } from '@/lib/database.types'; // Assuming database types are generated

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

// Type for aggregated reaction summary
export interface ReactionSummary {
  emoji: string;
  count: number;
  userReacted: boolean;
}

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

const ChatView = forwardRef(({
    debateId,
    viewMode,
    originalDebateData,
    isLoadingOriginal,
    errorOriginal,
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
  const [isNearBottom, setIsNearBottom] = useState(true); // State to track scroll position

  // --- Use Auth Context --- NEW
  const { user, loading: authLoading, supabase } = useAuth(); // Get user and supabase from context
  const currentUserId = user?.id ?? null; // Get user ID
  // --- ---

  // --- Reactions State ---
  const [reactionsMap, setReactionsMap] = useState<Map<number, ReactionSummary[]>>(new Map());
  const reactionChannelRef = useRef<RealtimeChannel | null>(null);
  // --- End Reactions State ---

  const chatEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null); // Ref for the scrollable container
  const eventSourceRef = useRef<EventSource | null>(null);
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
    },
    // Expose function to trigger stream regeneration
    triggerStream: () => {
        if (!debateIdRef.current) {
            console.warn('[ChatView triggerStream] No debate ID set.');
            return;
        }
        console.log(`[ChatView triggerStream] Triggering stream regeneration for ${debateIdRef.current}`);
        // Reset relevant state before starting new stream
        eventSourceRef.current?.close(); // Close existing connection if any
        if (retryTimeoutRef.current) clearTimeout(retryTimeoutRef.current); // Clear pending retries
        if (speechDisplayTimeoutRef.current) clearTimeout(speechDisplayTimeoutRef.current); // Clear pending speech display
        setRewrittenDebate(prev => prev ? { ...prev, speeches: [] } : null); // Clear speeches but keep title if already loaded
        speechesRef.current = [];
        jsonBufferRef.current = '';
        pendingSpeechesQueueRef.current = [];
        isProcessingQueueRef.current = false;
        setTypingSpeakerInfo(null);
        setIsReconnecting(false);
        setRetryAttempt(0);

        // Indicate loading/streaming state
        setIsLoadingRewritten(false); // Not technically loading from cache anymore
        setIsStreaming(true);

        // Connect the event source
        connectEventSource(0);
    }
  }));

  // Function to fetch and aggregate reactions - Updated to use imported supabase client
  const fetchAndAggregateReactions = useCallback(async (currentDebateId: string, fetchedUserId: string | null) => { // Renamed arg to avoid conflict
    if (!currentDebateId) {
        setReactionsMap(new Map());
        return;
    }
    console.log(`[Reactions] Fetching for debate: ${currentDebateId}`);

    type ReactionRow = Database['public']['Tables']['reactions_uwhatgov']['Row'];

    // Use the imported supabase client
    const { data, error } = await supabase
      .from('reactions_uwhatgov')
      .select('speech_original_index, emoji, user_id')
      .eq('debate_id', currentDebateId);

    if (error) {
      console.error("[Reactions] Error fetching reactions:", error);
      setReactionsMap(new Map());
      return;
    }

    // Aggregate in the client
    const newReactionsMap = new Map<number, ReactionSummary[]>();
    const intermediateMap = new Map<string, { count: number; userReacted: boolean }>();

    (data as ReactionRow[]).forEach(reaction => {
        if (reaction.speech_original_index === null || reaction.emoji === null) return;
        const key = `${reaction.speech_original_index}-${reaction.emoji}`;
        const current = intermediateMap.get(key) ?? { count: 0, userReacted: false };
        intermediateMap.set(key, {
            count: current.count + 1,
            // Use fetchedUserId from args here
            userReacted: current.userReacted || (fetchedUserId !== null && reaction.user_id === fetchedUserId)
        });
    });

    // Convert intermediate map to the final state structure
    intermediateMap.forEach((summary, key) => {
        const [indexStr, emoji] = key.split('-');
        const speechIndex = parseInt(indexStr, 10);

        if (!isNaN(speechIndex)) {
            const existingSummaries = newReactionsMap.get(speechIndex) ?? [];
            newReactionsMap.set(speechIndex, [
                ...existingSummaries,
                { emoji, count: summary.count, userReacted: summary.userReacted }
            ]);
        }
    });

    // Sort reactions within each index consistently (e.g., by emoji)
    newReactionsMap.forEach((summaries, index) => {
        newReactionsMap.set(index, summaries.sort((a, b) => a.emoji.localeCompare(b.emoji)));
    });

    // console.log('[Reactions] Aggregated map:', newReactionsMap);
    setReactionsMap(newReactionsMap);

  }, [supabase]); // Dependencies: supabase client is stable, no need to add

  // Effect for reactions fetching and real-time subscription - Updated dependencies
  useEffect(() => {
    if (!debateId || authLoading) { // Wait for auth loading to complete
        setReactionsMap(new Map());
        if (reactionChannelRef.current) {
            console.log('[Reactions] Unsubscribing from previous channel (no debate or auth loading).');
            supabase.removeChannel(reactionChannelRef.current);
            reactionChannelRef.current = null;
        }
        return;
    }

    // Fetch initial data using user ID from context
    fetchAndAggregateReactions(debateId, currentUserId);

    type ReactionPayload = RealtimePostgresChangesPayload<{ [key: string]: any }>;

    // Subscribe to changes
    const channel = supabase.channel(`reactions-for-debate-${debateId}`)
      .on<ReactionPayload>(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'reactions_uwhatgov', filter: `debate_id=eq.${debateId}` },
        (payload: ReactionPayload) => {
          console.log('[Reactions] Realtime event received:', payload);
          // Re-fetch using the current user ID from context
          fetchAndAggregateReactions(debateId, currentUserId);
        }
      )
      .subscribe((status: 'SUBSCRIBED' | 'TIMED_OUT' | 'CHANNEL_ERROR' | 'CLOSED', err?: Error) => {
          if (status === 'SUBSCRIBED') {
            console.log(`[Reactions] Subscribed to channel for debate ${debateId}`);
          } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            console.error(`[Reactions] Subscription error for debate ${debateId}:`, status, err);
          }
      });

    reactionChannelRef.current = channel;

    // Cleanup function
    return () => {
      if (reactionChannelRef.current) {
        console.log(`[Reactions] Unsubscribing from channel for debate ${debateId}`);
        supabase.removeChannel(reactionChannelRef.current);
        reactionChannelRef.current = null;
      }
    };
  }, [debateId, currentUserId, authLoading, fetchAndAggregateReactions]); // Depend on context user ID and auth loading state

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

  // Function to process the queue of pending speeches with delay
  const processPendingSpeeches = useCallback(async () => {
      if (isProcessingQueueRef.current || pendingSpeechesQueueRef.current.length === 0) {
          // If already processing or queue is empty, check for completion
          // Persistence is now handled by the backend API route
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
          processPendingSpeeches(); // Check again
      }
  // Removed persistToSupabase dependency
  }, [onRewrittenDebateUpdate, speakerPartyMap, SPEECH_DISPLAY_DELAY_MS]);

  const processJsonBuffer = useCallback((isComplete = false) => {
      const buffer = jsonBufferRef.current;
      if (!buffer) return;

      const parsedSpeeches: Speech[] = [];
      let processedChars = 0;
      let tempBuffer = buffer; // Work on a copy

      // --- Robust JSON parsing --- adapted from backend
      let lastIndex = 0;
      while (true) {
          const startIndex = tempBuffer.indexOf('{', lastIndex);
          if (startIndex === -1) break; // No more potential objects

          let openBraces = 0;
          let endIndex = -1;
          for (let i = startIndex; i < tempBuffer.length; i++) {
              if (tempBuffer[i] === '{') {
                  openBraces++;
              } else if (tempBuffer[i] === '}') {
                  openBraces--;
                  if (openBraces === 0) {
                      endIndex = i;
                      break;
                  }
              }
          }

          if (endIndex !== -1) {
              // Found a potential complete object
              const objectString = tempBuffer.substring(startIndex, endIndex + 1);
              try {
                  const parsedObject = JSON.parse(objectString);
                  // Basic validation
                  if (parsedObject && typeof parsedObject.speaker === 'string' && typeof parsedObject.text === 'string') {
                      const newSpeech: Speech = {
                          speaker: parsedObject.speaker,
                          text: parsedObject.text,
                          originalIndex: typeof parsedObject.originalIndex === 'number' ? parsedObject.originalIndex : undefined,
                          originalSnippet: typeof parsedObject.originalSnippet === 'string' ? parsedObject.originalSnippet : undefined,
                      };
                      parsedSpeeches.push(newSpeech);
                      processedChars = endIndex + 1; // Update processed characters based on the end of the valid object
                      lastIndex = 0; // Reset search from the beginning of the *remaining* buffer
                      tempBuffer = tempBuffer.substring(processedChars); // Update buffer for next iteration
                      processedChars = 0; // Reset processedChars for the new tempBuffer

                  } else if (parsedObject && !parsedObject.speaker && typeof parsedObject.text === 'string' && parsedObject.text.trim()) {
                      // *** Handle Case: Missing speaker but valid text ***
                      console.warn(`[Buffer ${debateIdRef.current}] Received object missing speaker, using default. Object:`, parsedObject);
                      const newSpeech: Speech = {
                          speaker: 'Unknown Speaker', // Use default speaker
                          text: parsedObject.text,
                          originalIndex: typeof parsedObject.originalIndex === 'number' ? parsedObject.originalIndex : undefined,
                          originalSnippet: typeof parsedObject.originalSnippet === 'string' ? parsedObject.originalSnippet : undefined,
                      };
                      parsedSpeeches.push(newSpeech);
                      processedChars = endIndex + 1;
                      lastIndex = 0;
                      tempBuffer = tempBuffer.substring(processedChars);
                      processedChars = 0;
                  } else {
                       console.warn(`[Buffer ${debateIdRef.current}] Invalid object format (other):`, parsedObject);
                      lastIndex = endIndex + 1;
                  }
              } catch (e: any) {
                  // Not valid JSON yet, could be incomplete. Advance past the starting brace.
                  console.warn(`[Buffer ${debateIdRef.current}] Partial JSON or parse error at index ${startIndex}: ${e.message}. String: ${objectString.substring(0, 50)}...`);
                  lastIndex = startIndex + 1;
              }
          } else {
              // No closing brace found for the starting brace at startIndex
              // The rest of the buffer is potentially an incomplete object, wait for more data
              break;
          }
      }
      // --- End Robust JSON parsing ---

      // Update the main buffer reference only after processing the temporary one
      if (lastIndex > 0) { // If we broke due to incomplete JSON
          // Keep the potentially incomplete part
          jsonBufferRef.current = buffer.substring(lastIndex);
      } else { // If we processed everything or the loop didn't run
          jsonBufferRef.current = tempBuffer; // Assign the remaining part of tempBuffer
      }


      const remainingTrimmed = jsonBufferRef.current.trim();
      if (isComplete && remainingTrimmed) {
          console.warn(`[Buffer ${debateIdRef.current}] Clearing remaining buffer content after completion:`, jsonBufferRef.current);
          // Optionally clear buffer here if completion means it should be empty
          jsonBufferRef.current = ''; // Explicitly clear buffer on completion
      }

      if (parsedSpeeches.length > 0) {
          // Add parsed speeches to the pending queue instead of directly updating state
          pendingSpeechesQueueRef.current.push(...parsedSpeeches);
          // Start processing the queue if not already running
          if (!isProcessingQueueRef.current) {
              processPendingSpeeches();
          }
      }
  }, [processPendingSpeeches]);

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
      if (eventSourceRef.current === es) {
         eventSourceRef.current = null;
      }
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
          if (eventSourceRef.current === es) {
              eventSourceRef.current = null;
          }
          es.close();
      } else if (streamEvent.type === 'error') {
          console.error(`[SSE ${debateId}] Stream error:`, streamEvent.payload?.message);
          setIsStreaming(false);
          if (eventSourceRef.current === es) {
              eventSourceRef.current = null;
          }
          es.close();
      } else {
           console.log(`[SSE ${debateId}] Unhandled type:`, streamEvent.type);
      }
    };
  }, [debateId, MAX_RETRIES, INITIAL_RETRY_DELAY_MS, processJsonBuffer]);

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
      return;
    }

    setRewrittenDebate(null);
    setIsLoadingRewritten(true);
    setIsStreaming(false);
    setIsReconnecting(false);
    setRetryAttempt(0);
    speechesRef.current = [];
    jsonBufferRef.current = '';

    if (retryTimeoutRef.current) clearTimeout(retryTimeoutRef.current);
    eventSourceRef.current?.close();

    // *** Prevent duplicate stream initiation ***
    if (eventSourceRef.current) {
       console.warn(`[ChatView setupRewrittenDebate] Stream already exists for ${debateId}. Aborting setup.`);
       return;
    }

    const setupRewrittenDebate = async () => {
      setIsLoadingRewritten(true);
      setRewrittenDebate(null);
      speechesRef.current = [];
      const currentDebateData: RewrittenDebate = { id: debateId, title: '', speeches: [] };

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
      const esToClose = eventSourceRef.current; // Capture ref before clearing
      eventSourceRef.current = null; // Clear ref
      if (esToClose) {
          esToClose.close();
          console.log(`SSE closed for ${debateId} on cleanup`);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debateId, onRewrittenDebateUpdate]); // Removed connectEventSource

  const handleBubbleClickInternal = useCallback((index: number | undefined) => {
      console.log(`[ChatView] Bubble click index: ${index}. Calling parent.`);
      onBubbleClick(index); // Call the callback passed from parent
  }, [onBubbleClick]);

  // Effect to automatically scroll down during streaming if near the bottom
  useEffect(() => {
    const timer = setTimeout(() => {
      // Only auto-scroll to end if streaming and user is near the bottom
      if (isStreaming && isNearBottom) {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }
    }, 100); // Small delay to allow render
    return () => clearTimeout(timer);
  }, [rewrittenDebate?.speeches, isStreaming, isNearBottom]); // Depend on speeches, streaming status, and scroll position

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
      } catch (_e) {
          console.error(`[Party Cache] Error reading localStorage for member ${memberId}:`, _e);
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
              } catch (_e) {
                  console.error(`[Party Cache] Error writing localStorage for member ${memberId}:`, _e);
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
              try { localStorage.setItem(cacheKey, 'null'); } catch (_e) { /* ignore */ }
          }
      } catch (error) {
          console.error(`[Party Cache] Network error fetching party for member ${memberId}:`, error);
          // Cache null on network error
          try { localStorage.setItem(cacheKey, 'null'); } catch (_e) { /* ignore */ }
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

  // Effect to handle scrolling and update isNearBottom state
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const SCROLL_THRESHOLD = 50; // Pixels from bottom to consider 'near'

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container;
      const nearBottom = scrollHeight - scrollTop - clientHeight < SCROLL_THRESHOLD;
      setIsNearBottom(nearBottom);
    };

    container.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll(); // Initial check

    return () => {
      container.removeEventListener('scroll', handleScroll);
    };
  }, []); // Run only once on mount

  const renderContent = () => {
      if (!debateId) {
          return <div className="p-4 text-center text-gray-400">Select a debate to view.</div>;
      }
      if (authLoading && !rewrittenDebate) { // Show loading indicator while auth is resolving initially
          return <div className="p-4 text-center text-gray-400">Loading User Info...</div>;
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
            // --- Get reactions for this speech --- NEW
            const currentReactions = speech.originalIndex !== undefined
                ? reactionsMap.get(speech.originalIndex) ?? []
                : [];
            // --- ---

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
                    // --- Pass reaction props --- NEW
                    debateId={debateId} // Pass the debate ID
                    reactions={currentReactions}
                    userId={currentUserId} // Use user ID from context
                    // --- ---
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
    <div className="flex flex-col h-full relative bg-gradient-to-b from-[#111b21] via-[#0c1317] to-[#111b21] text-gray-200">
      {/* Scrollable chat content area */}
      <div ref={scrollContainerRef} className="flex-grow overflow-y-auto p-4 space-y-4">
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

      {/* Jump to Bottom Button */}
      {!isNearBottom && (
        <button
          onClick={() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })}
          className="absolute bottom-6 right-6 z-10 p-2 bg-gray-700 rounded-full text-gray-300 hover:bg-gray-600 hover:text-white transition-opacity duration-200"
          title="Jump to bottom"
        >
          {/* Simple Down Arrow Icon */}
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
            <path fillRule="evenodd" d="M10 3a.75.75 0 01.75.75v10.19l3.72-3.72a.75.75 0 111.06 1.06l-5 5a.75.75 0 01-1.06 0l-5-5a.75.75 0 111.06-1.06l3.72 3.72V3.75A.75.75 0 0110 3z" clipRule="evenodd" />
          </svg>
        </button>
      )}
    </div>
  );
});

ChatView.displayName = 'ChatView'; // Add display name for DevTools

export default ChatView; 
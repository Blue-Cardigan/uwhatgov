'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Resizable } from 're-resizable'; // Import Resizable

// Import components
import ChatList from '@/components/ChatList';
import ChatView from '@/components/ChatView';
import OriginalContribution from '@/components/OriginalContribution'; // Import new component
import DebateMetadataIcon from '@/components/DebateMetadataIcon'; // Import the icon
import { AuthForm } from '@/components/AuthForm'; // Import AuthForm

// Import types
import { InternalDebateSummary, DebateMetadata } from '@/types';
import { DebateResponse } from '@/lib/hansard/types'; // Import necessary types
import { Speech } from '@/components/ChatView'; // Import Speech type

// Import context hook
import { useAuth } from '@/contexts/AuthContext'; // Import useAuth

// Define type for the ChatView ref methods
interface ChatViewHandle {
  scrollToItem: (index: number) => void;
  triggerStream: () => void;
}

// Icons for view toggle
const CasualIcon = () => <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 56 56" fill="currentColor" className="w-5 h-5"><path fillRule="evenodd" d="M 26.6875 12.6602 C 26.9687 12.6602 27.1094 12.4961 27.1797 12.2383 C 27.9062 8.3242 27.8594 8.2305 31.9375 7.4570 C 32.2187 7.4102 32.3828 7.2461 32.3828 6.9648 C 32.3828 6.6836 32.2187 6.5195 31.9375 6.4726 C 27.8828 5.6524 28.0000 5.5586 27.1797 1.6914 C 27.1094 1.4336 26.9687 1.2695 26.6875 1.2695 C 26.4062 1.2695 26.2656 1.4336 26.1953 1.6914 C 25.3750 5.5586 25.5156 5.6524 21.4375 6.4726 C 21.1797 6.5195 20.9922 6.6836 20.9922 6.9648 C 20.9922 7.2461 21.1797 7.4102 21.4375 7.4570 C 25.5156 8.2774 25.4687 8.3242 26.1953 12.2383 C 26.2656 12.4961 26.4062 12.6602 26.6875 12.6602 Z M 15.3438 28.7852 C 15.7891 28.7852 16.0938 28.5039 16.1406 28.0821 C 16.9844 21.8242 17.1953 21.8242 23.6641 20.5821 C 24.0860 20.5117 24.3906 20.2305 24.3906 19.7852 C 24.3906 19.3633 24.0860 19.0586 23.6641 18.9883 C 17.1953 18.0977 16.9609 17.8867 16.1406 11.5117 C 16.0938 11.0899 15.7891 10.7852 15.3438 10.7852 C 14.9219 10.7852 14.6172 11.0899 14.5703 11.5352 C 13.7969 17.8164 13.4687 17.7930 7.0469 18.9883 C 6.6250 19.0821 6.3203 19.3633 6.3203 19.7852 C 6.3203 20.2539 6.6250 20.5117 7.1406 20.5821 C 13.5156 21.6133 13.7969 21.7774 14.5703 28.0352 C 14.6172 28.5039 14.9219 28.7852 15.3438 28.7852 Z M 31.2344 54.7305 C 31.8438 54.7305 32.2891 54.2852 32.4062 53.6524 C 34.0703 40.8086 35.8750 38.8633 48.5781 37.4570 C 49.2344 37.3867 49.6797 36.8945 49.6797 36.2852 C 49.6797 35.6758 49.2344 35.2070 48.5781 35.1133 C 35.8750 33.7070 34.0703 31.7617 32.4062 18.9180 C 32.2891 18.2852 31.8438 17.8633 31.2344 17.8633 C 30.6250 17.8633 30.1797 18.2852 30.0860 18.9180 C 28.4219 31.7617 26.5938 33.7070 13.9140 35.1133 C 13.2344 35.2070 12.7891 35.6758 12.7891 36.2852 C 12.7891 36.8945 13.2344 37.3867 13.9140 37.4570 C 26.5703 39.1211 28.3281 40.8321 30.0860 53.6524 C 30.1797 54.2852 30.6250 54.7305 31.2344 54.7305 Z" clipRule="evenodd" /></svg>;
const OriginalIcon = () => <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5"><path fillRule="evenodd" d="M4.25 5.5a.75.75 0 0 0 0 1.5h11.5a.75.75 0 0 0 0-1.5H4.25Zm0 4a.75.75 0 0 0 0 1.5h11.5a.75.75 0 0 0 0-1.5H4.25Zm0 4a.75.75 0 0 0 0 1.5h7.5a.75.75 0 0 0 0-1.5h-7.5Z" clipRule="evenodd" /></svg>;

// localStorage Keys
const METADATA_CACHE_PREFIX = 'uwhatgov_metadata_';
const ORIGINAL_DEBATE_CACHE_PREFIX = 'uwhatgov_original_';

export default function Home() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const chatViewRef = useRef<ChatViewHandle>(null); // Ref for ChatView scrolling and triggering
  const { user, loading: authLoading, logout } = useAuth(); // Get auth state
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false); // State for Auth Modal

  // Caches stored in refs/state
  // Metadata cache uses state to trigger re-renders when items are added/updated for ChatList
  const [metadataCache, setMetadataCache] = useState<Record<string, DebateMetadata>>({});
  const originalDebateCache = useRef<Map<string, DebateResponse>>(new Map());

  // Chat List state
  const [selectedDebateId, setSelectedDebateId] = useState<string | null>(null);
  const [selectedDebateSummary, setSelectedDebateSummary] = useState<InternalDebateSummary | null>(null);

  // View Mode state
  const [viewMode, setViewMode] = useState<'rewritten' | 'original'>('rewritten');

  // Original Debate data state
  const [originalDebate, setOriginalDebate] = useState<DebateResponse | null>(null);
  const [isLoadingOriginal, setIsLoadingOriginal] = useState(false);
  const [errorOriginal, setErrorOriginal] = useState<string | null>(null);

  // Selected Debate Metadata state
  const [selectedDebateMetadata, setSelectedDebateMetadata] = useState<DebateMetadata | null>(null);
  const [isLoadingMetadata, setIsLoadingMetadata] = useState(false);
  const [errorMetadata, setErrorMetadata] = useState<string | null>(null);

  // Resizable Panel state
  const [selectedOriginalIndex, setSelectedOriginalIndex] = useState<number | null>(null); // Moved from ChatView
  const [originalPanelHeight, setOriginalPanelHeight] = useState(192); // Moved from ChatView, default height (12rem)

  // Search State
  const [isSearchOpen, setIsSearchOpen] = useState(false); // State for search input visibility
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<number[]>([]); // Stores indices (OrderInSection) of matches
  const [currentMatchIndex, setCurrentMatchIndex] = useState(-1); // Index within searchResults array
  // State for regeneration loading
  const [isRegenerating, setIsRegenerating] = useState(false);

  // Ref for the rewritten debate data used in search
  const rewrittenDebateRef = useRef<Speech[] | null>(null);

  // Summary State
  const [isSummaryOpen, setIsSummaryOpen] = useState(false);
  const [summaryText, setSummaryText] = useState<string | null>(null);
  const [isLoadingSummary, setIsLoadingSummary] = useState(false);
  const [errorSummary, setErrorSummary] = useState<string | null>(null);

  // Fetch Original Debate Data (incorporates memory & localStorage caching)
  const fetchOriginalDebate = useCallback(async (debateId: string | null) => {
      if (!debateId) return;

      // 1. Check memory cache first
      if (originalDebateCache.current.has(debateId)) {
          const cachedData = originalDebateCache.current.get(debateId)!;
          console.log(`[fetchOriginalDebate] Memory Cache HIT for original debate ${debateId}`);
          setOriginalDebate(cachedData);
          setIsLoadingOriginal(false);
          setErrorOriginal(null);
          return;
      }

      // 2. Check localStorage
      const localStorageKey = ORIGINAL_DEBATE_CACHE_PREFIX + debateId;
      try {
          const storedData = localStorage.getItem(localStorageKey);
          if (storedData) {
              const parsedData: DebateResponse = JSON.parse(storedData);
              console.log(`[fetchOriginalDebate] localStorage HIT for original debate ${debateId}`);
              originalDebateCache.current.set(debateId, parsedData); // Update memory cache
              setOriginalDebate(parsedData);
              setIsLoadingOriginal(false);
              setErrorOriginal(null);
              return;
          }
      } catch (error) {
          console.error(`[fetchOriginalDebate] Error reading/parsing localStorage for ${debateId}:`, error);
          // Optional: Clear the corrupted item
          // localStorage.removeItem(localStorageKey);
      }

      // Prevent concurrent fetches if already loading (simple check)
      if (isLoadingOriginal) {
        console.log(`[fetchOriginalDebate] Fetch already in progress for original debate, skipping.`);
        return;
      }

      // 3. Fetch from API
      console.log(`[fetchOriginalDebate] Cache MISS. Fetching ORIGINAL debate ${debateId} from API`);
      setIsLoadingOriginal(true);
      setErrorOriginal(null);
      setOriginalDebate(null); // Clear potentially stale data

      try {
        const hansardApiUrl = `/api/hansard/debates/${debateId}`;
        const response = await fetch(hansardApiUrl);
        if (!response.ok) {
          let errorMsg = `Original fetch failed: ${response.status}`;
          try { const errorData = await response.json(); errorMsg = errorData.error || errorData.message || errorMsg; } catch (_e) {}
          throw new Error(errorMsg);
        }
        const data: DebateResponse = await response.json();
        console.log(`[fetchOriginalDebate] Fetched data for ${debateId}, caching.`);

        // Store in localStorage
        try {
            localStorage.setItem(localStorageKey, JSON.stringify(data));
        } catch (error) {
            console.error(`[fetchOriginalDebate] Error writing to localStorage for ${debateId}:`, error);
        }

        originalDebateCache.current.set(debateId, data); // Store in memory cache
        setOriginalDebate(data); // Set state

      } catch (e: any) {
        console.error(`[fetchOriginalDebate] Failed fetch original ${debateId}:`, e);
        setErrorOriginal(`Failed load original: ${e.message}`);
        setOriginalDebate(null);
      } finally {
        setIsLoadingOriginal(false);
      }
    }, [isLoadingOriginal]);

  // Fetch Metadata for Selected Debate (incorporates memory & localStorage caching, updates state)
  const fetchSelectedDebateMetadata = useCallback(async (debateId: string) => {

      // 1. Check state cache first
      if (metadataCache[debateId]) {
          if (metadataCache[debateId].isLoading || metadataCache[debateId].error) {
             setMetadataCache(prev => ({ ...prev, [debateId]: { ...prev[debateId], isLoading: false, error: null } }));
          }
          return;
      }

      // 2. Check localStorage
      const localStorageKey = METADATA_CACHE_PREFIX + debateId;
      try {
          const storedData = localStorage.getItem(localStorageKey);
          if (storedData) {
              const parsedData: DebateMetadata = JSON.parse(storedData);
              console.log(`[fetchMetadata] localStorage HIT for metadata ${debateId}`);
              // Update state cache directly from localStorage
              setMetadataCache(prev => ({ ...prev, [debateId]: { ...parsedData, isLoading: false, error: null } }));
              return;
          }
      } catch (error) {
          console.error(`[fetchMetadata] Error reading/parsing localStorage for ${debateId}:`, error);
      }

      // Prevent concurrent fetches by checking loading state *within the specific item*
      // This allows multiple different items to load concurrently
      const currentItem = metadataCache[debateId] as DebateMetadata | undefined;
      if (currentItem && typeof currentItem.isLoading === 'boolean' && currentItem.isLoading) {
        console.log(`[fetchMetadata] Fetch already in progress for metadata ${debateId}, skipping.`);
        return;
      }

      // 3. Fetch from API
      console.log(`[fetchMetadata] Cache MISS. Fetching METADATA for debate ${debateId} from API`);
      // Set loading state for this specific item
      setMetadataCache(prev => ({ ...prev, [debateId]: { ...(prev[debateId] || {}), isLoading: true, error: null } }));

      try {
          const response = await fetch(`/api/hansard/debates/${debateId}/metadata`);
          if (!response.ok) {
              let errorMsg = `Metadata fetch failed: ${response.status}`;
              try { const errorData = await response.json(); errorMsg = errorData.error || errorMsg; } catch (_e) { }
              throw new Error(errorMsg);
          }
          const metadata: DebateMetadata = await response.json();
          console.log(`[fetchMetadata] Fetched data for ${debateId}, caching.`);

          // Store in localStorage
          try {
            localStorage.setItem(localStorageKey, JSON.stringify(metadata));
          } catch (error) {
            console.error(`[fetchMetadata] Error writing to localStorage for ${debateId}:`, error);
          }

          // Update state cache with fetched data, clear loading/error
          setMetadataCache(prev => ({ ...prev, [debateId]: { ...metadata, isLoading: false, error: null } }));

      } catch (e: any) {
          console.error(`[fetchMetadata] Failed fetch metadata ${debateId}:`, e);
          // Update state cache with error
          setMetadataCache(prev => ({ ...prev, [debateId]: { ...(prev[debateId] || {}), isLoading: false, error: e.message || 'Failed to load metadata' } }));
      }
  }, [metadataCache]);

  // Fetch Summary Data
  const fetchSummary = useCallback(async (debateId: string | null) => {
      if (!debateId) return;
      console.log(`[fetchSummary] Fetching summary for ${debateId}`);
      setIsLoadingSummary(true);
      setErrorSummary(null);
      setSummaryText(null); // Clear previous summary

      try {
          const response = await fetch(`/api/hansard/debates/summarize/${debateId}`);
          const data = await response.json();
          if (!response.ok) {
              throw new Error(data.error || `Failed to fetch summary: ${response.status}`);
          }
          setSummaryText(data.summary || 'No summary available.');
      } catch (e: any) {
          console.error(`[fetchSummary] Failed fetch summary ${debateId}:`, e);
          setErrorSummary(`Failed to load summary: ${e.message}`);
          setSummaryText(null);
      } finally {
          setIsLoadingSummary(false);
      }
  }, []); 

  // Callback for ChatList items becoming visible
  const handleChatItemVisible = useCallback((debateId: string) => {
      // console.log(`[handleChatItemVisible] Item visible: ${debateId}`);
      fetchSelectedDebateMetadata(debateId); // Trigger fetch/cache check
  }, [fetchSelectedDebateMetadata]);

  // Effect to sync selectedDebateId from URL, reset state, and fetch data
  useEffect(() => {
    const debateIdFromUrl = searchParams.get('debateId');

    if (debateIdFromUrl) {
        // Check if the ID from URL is different from the current state
        if (debateIdFromUrl !== selectedDebateId) {
             console.log(`[useEffect] Detected ID change: ${selectedDebateId} -> ${debateIdFromUrl}`);
             // Check caches *before* setting state
             let cachedMetadata: DebateMetadata | null = null;
             if (metadataCache[debateIdFromUrl]) {
                 cachedMetadata = metadataCache[debateIdFromUrl];
             } else {
                 try {
                     const storedData = localStorage.getItem(METADATA_CACHE_PREFIX + debateIdFromUrl);
                     if (storedData) cachedMetadata = JSON.parse(storedData);
                 } catch (e) { console.error("Error reading initial metadata from LS", e); }
             }

             const cachedOriginal = originalDebateCache.current.get(debateIdFromUrl);
             setSelectedDebateId(debateIdFromUrl);
 
             // Reset ALL other relevant states immediately
             setSelectedDebateSummary(null); // Will be updated by ChatList or fetched if needed
             setOriginalDebate(cachedOriginal || null); // Use cached data if available, otherwise null
             setIsLoadingOriginal(!cachedOriginal); // Set loading only if not cached
             setErrorOriginal(null);
             setSelectedOriginalIndex(null);
             setSelectedDebateMetadata(cachedMetadata || null);
             setIsLoadingMetadata(!cachedMetadata && !metadataCache[debateIdFromUrl]?.isLoading); // Set loading if not cached AND not already loading in state
             setErrorMetadata(null);
             setViewMode('rewritten');
             setSearchQuery('');
             setIsSearchOpen(false);
             setSummaryText(null); // Clear summary
             setIsLoadingSummary(false);
             setErrorSummary(null);
        }
        // Always fetch data if a valid ID is present in the URL
        // Fetch functions have internal checks to prevent redundant calls if data exists
        console.log(`[useEffect] Ensuring data for ID: ${debateIdFromUrl} (will use cache if available)`);
        fetchOriginalDebate(debateIdFromUrl);
        fetchSelectedDebateMetadata(debateIdFromUrl);
        fetchSummary(debateIdFromUrl); // Fetch summary when ID changes

    } else {
        // No debateId in URL, ensure everything is cleared
        if (selectedDebateId !== null) {
            console.log('[useEffect] Clearing selected debate state.');
            setSelectedDebateId(null);
            setSelectedDebateSummary(null);
            setOriginalDebate(null);
            setIsLoadingOriginal(false);
            setErrorOriginal(null);
            setSelectedOriginalIndex(null);
            setSelectedDebateMetadata(null);
            setIsLoadingMetadata(false);
            setErrorMetadata(null);
            setViewMode('rewritten');
            setSearchQuery('');
            setIsSearchOpen(false);
            setSummaryText(null); // Clear summary
            setIsLoadingSummary(false);
            setErrorSummary(null);
        }
    }
    // Dependencies: Run when URL changes or the selected ID state changes.
    // fetchOriginalDebate and fetchSelectedDebateMetadata are stable due to useCallback.
  }, [searchParams, selectedDebateId, fetchOriginalDebate, fetchSelectedDebateMetadata, fetchSummary, metadataCache]); // Added metadataCache

  // --- SEARCH LOGIC ---
  useEffect(() => {
    // Perform search whenever query, viewMode, or data changes
    if (searchQuery.trim() === '') {
      setSearchResults([]);
      setCurrentMatchIndex(-1);
      return;
    }

    const query = searchQuery.trim().toLowerCase();
    let results: number[] = [];

    if (viewMode === 'rewritten') {
        const speeches = rewrittenDebateRef.current; // Use ref for current speeches
        if (speeches) {
            results = speeches
                .map((speech, index) => ({ speech, originalIndex: speech.originalIndex ?? index })) // Use originalIndex if available, fallback to array index
                .filter(item => item.speech.text.toLowerCase().includes(query) || item.speech.speaker.toLowerCase().includes(query))
                .map(item => item.originalIndex); // Store the original index
        }
    } else { // viewMode === 'original'
      if (originalDebate?.Items) {
        results = originalDebate.Items
          .filter(item =>
            item.ItemType === 'Contribution' &&
            item.Value &&
            (item.Value.toLowerCase().includes(query) || (item.AttributedTo && item.AttributedTo.toLowerCase().includes(query)))
          )
          .map(item => item.OrderInSection); // Store OrderInSection
      }
    }

    console.log(`Search for "${query}" in ${viewMode} mode found ${results.length} results:`, results);
    setSearchResults(results);
    setCurrentMatchIndex(results.length > 0 ? 0 : -1);

  }, [searchQuery, viewMode, originalDebate, rewrittenDebateRef]); // Added rewrittenDebateRef dependency

  // Effect to scroll to the current match
  useEffect(() => {
      if (currentMatchIndex !== -1 && searchResults.length > 0) {
          const targetIndex = searchResults[currentMatchIndex];
          console.log(`Scrolling to search result index: ${targetIndex} (result ${currentMatchIndex + 1} of ${searchResults.length})`);
          chatViewRef.current?.scrollToItem(targetIndex);
      }
  }, [currentMatchIndex, searchResults]);


  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(event.target.value);
  };

  const goToNextMatch = () => {
    if (searchResults.length > 0) {
      setCurrentMatchIndex((prevIndex) => (prevIndex + 1) % searchResults.length);
    }
  };

  const goToPreviousMatch = () => {
    if (searchResults.length > 0) {
      setCurrentMatchIndex((prevIndex) => (prevIndex - 1 + searchResults.length) % searchResults.length);
    }
  };

  // Clear search when debate changes or view mode switches
  useEffect(() => {
      setSearchQuery('');
      setSearchResults([]);
      setCurrentMatchIndex(-1);
  }, [selectedDebateId, viewMode]);

  // --- END SEARCH LOGIC ---

  // Handle selecting a debate from the list - ONLY updates URL
  const handleSelectDebate = useCallback((debate: InternalDebateSummary) => {
    console.log(`[handleSelectDebate] Routing to debate: ${debate.id}`);
    // We only need to update the URL. The useEffect above will handle state changes.
    // Optionally update summary immediately for faster title update, but useEffect handles resets.
    // setSelectedDebateSummary(debate); // Keep or remove based on desired UX for title update speed
    router.push(`/?debateId=${debate.id}`, { scroll: false });
  }, [router]);

  // Handle clicking a bubble in ChatView (passed down as prop)
  const handleBubbleClick = useCallback((index: number | undefined) => {
    console.log(`[page.tsx] Bubble click received, index: ${index}`);
    if (typeof index === 'number') {
        setSelectedOriginalIndex(index);
        // Fetch original data if needed when bubble is clicked
        if (!originalDebate && !isLoadingOriginal && selectedDebateId) {
            fetchOriginalDebate(selectedDebateId);
        }
    } else {
        console.warn("[page.tsx] Clicked bubble is missing originalIndex");
        setSelectedOriginalIndex(null); // Close panel if index is invalid
    }
  }, [originalDebate, isLoadingOriginal, selectedDebateId, fetchOriginalDebate]);


  // Handler for toggling the view mode - Now switches between the two modes
  const handleToggleViewMode = useCallback(() => {
      const nextMode = viewMode === 'rewritten' ? 'original' : 'rewritten';
      if (nextMode === 'original' && selectedDebateId && !originalDebate && !isLoadingOriginal) {
          fetchOriginalDebate(selectedDebateId);
      }
      setViewMode(nextMode);
  }, [viewMode, selectedDebateId, originalDebate, isLoadingOriginal, fetchOriginalDebate]);

  // Handle Regenerate Button Click
  const handleRegenerate = useCallback(async () => {
      if (!selectedDebateId) return;

      // Optional: Confirmation dialog
      if (!window.confirm("Are you sure you want to regenerate this debate? This will replace the current casual version.")) {
          return;
      }

      console.log(`[handleRegenerate] Starting regeneration for ${selectedDebateId}`);
      setIsRegenerating(true);

      try {
          // 1. Call the delete API route
          const response = await fetch(`/api/hansard/debates/rewrite/delete/${selectedDebateId}`, {
              method: 'DELETE',
          });

          if (!response.ok) {
              // Try to get error message from response body
              let errorMsg = `Failed to delete existing entry: ${response.status}`;
              try { const errorData = await response.json(); errorMsg = errorData.error || errorMsg; } catch (_e) {}
              throw new Error(errorMsg);
          }

          console.log(`[handleRegenerate] Existing entry deleted (or didn't exist) for ${selectedDebateId}. Triggering stream.`);

          // 2. Trigger the stream reset in ChatView
          chatViewRef.current?.triggerStream();
          fetchSummary(selectedDebateId); // Also trigger summary fetch on regenerate

          // Optional: Display a success message or rely on ChatView's loading state

      } catch (error: any) {
          console.error(`[handleRegenerate] Error during regeneration for ${selectedDebateId}:`, error);
          // Display error to user (e.g., using a toast notification library)
          alert(`Regeneration failed: ${error.message}`); // Simple alert for now
      } finally {
          setIsRegenerating(false);
      }
  }, [selectedDebateId, chatViewRef, fetchSummary]); // Added fetchSummary dependency

  // Calculate the selected original item based on state here
  const selectedOriginalItem = (selectedOriginalIndex !== null && originalDebate?.Items)
      ? originalDebate.Items.find(item => item.OrderInSection === selectedOriginalIndex)
      : null;

  // Calculate the index of the currently highlighted search result
  const highlightedIndex = currentMatchIndex !== -1 ? searchResults[currentMatchIndex] : null;

  // Stable callback for ChatView to update the parent's ref with rewritten speeches
  const handleRewrittenDebateUpdate = useCallback((speeches: Speech[]) => {
    rewrittenDebateRef.current = speeches;
    // The search useEffect already depends on rewrittenDebateRef, so no need to trigger search here.
  }, []); // No dependencies needed, it only updates a ref

  return (
    <main className="flex h-screen w-screen bg-[#111b21] text-white overflow-hidden relative">
      {/* Auth Modal Overlay - Conditionally Rendered */}
      {isAuthModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
          <div className="relative bg-white p-4 rounded-lg shadow-xl max-w-md w-full">
            {/* Close Button for Modal */}
            <button 
              onClick={() => setIsAuthModalOpen(false)} 
              className="absolute top-2 right-2 text-gray-500 hover:text-gray-800 p-1 rounded-full bg-gray-200 hover:bg-gray-300 text-lg font-bold"
              aria-label="Close authentication form"
            >
              &times;
            </button>
            <AuthForm onSuccess={() => setIsAuthModalOpen(false)} />
          </div>
        </div>
      )}

      {/* Main Application UI - Always Rendered Now */}
      {/* Sidebar */}
      <div
        className={`
          ${selectedDebateId ? 'hidden md:flex' : 'flex'}
          w-full md:w-2/5 border-r border-gray-700 flex-col bg-[#111b21]
        `}
      >
        {/* Updated Sidebar Header */}
        <div className="p-4 border-b border-gray-700 flex justify-between items-center bg-[#202c33] min-h-[64px]"> {/* Added min-height */} 
          {authLoading ? (
            <span className="text-sm text-gray-400 italic">Loading...</span>
          ) : user ? (
            <>
              <span className="text-sm text-gray-300 truncate" title={user.email}>{user.email}</span>
              <button
                onClick={logout}
                className="text-sm text-indigo-400 hover:text-indigo-300 px-2 py-1 rounded hover:bg-gray-600 transition-colors"
              >
                Logout
              </button>
            </>
          ) : (
            <button
              onClick={() => setIsAuthModalOpen(true)}
              className="w-full text-center text-sm bg-indigo-600 text-white py-1.5 px-3 rounded-md hover:bg-indigo-700 transition-colors"
            >
              Sign In / Sign Up
            </button>
          )}
        </div>
        <ChatList
          onSelectDebate={handleSelectDebate}
          selectedDebateId={selectedDebateId}
          allMetadata={metadataCache}
          onItemVisible={handleChatItemVisible}
        />
      </div>

      {/* Main Chat View Area - Hidden on mobile if NO chat is selected */}
      <div
        className={`
          ${selectedDebateId ? 'flex' : 'hidden md:flex'}
          flex-grow flex-col bg-[#0b141a] overflow-hidden relative
        `}
        style={{backgroundImage: "url('/whatsapp-bg.png')", backgroundSize: 'contain', backgroundPosition: 'center'}}
      >
        {selectedDebateId ? (
          <>
            {/* Header */}
            <header className="p-3 flex items-center justify-between border-b border-gray-700 bg-[#202c33] flex-shrink-0 z-10 h-16">
               {/* Search Open State */}
               {isSearchOpen ? (
                 <div className="flex items-center w-full">
                   <button
                     onClick={() => { setIsSearchOpen(false); setSearchQuery(''); }}
                     className="p-1 text-gray-400 hover:text-white mr-2"
                     aria-label="Close search"
                   >
                     <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
                       <path fillRule="evenodd" d="M17 10a.75.75 0 0 1-.75.75H5.612l4.158 3.96a.75.75 0 1 1-1.04 1.08l-5.5-5.25a.75.75 0 0 1 0-1.08l5.5-5.25a.75.75 0 1 1 1.04 1.08L5.612 9.25H16.25A.75.75 0 0 1 17 10Z" clipRule="evenodd" />
                     </svg>
                   </button>
                   <input
                     type="text"
                     placeholder="Search debate..."
                     value={searchQuery}
                     onChange={handleSearchChange}
                     className="flex-grow bg-transparent text-sm text-gray-200 placeholder-gray-500 focus:outline-none px-2 py-1"
                     autoFocus // Focus the input when it opens
                     disabled={!selectedDebateId}
                   />
                   {searchQuery && (
                     <button onClick={() => setSearchQuery('')} className="ml-1 text-gray-500 hover:text-gray-300 text-xs p-0.5">&times;</button>
                   )}
                   {searchResults.length > 0 && (
                     <span className="text-xs text-gray-500 ml-2 whitespace-nowrap">
                       {currentMatchIndex + 1}/{searchResults.length}
                     </span>
                   )}
                   <button onClick={goToPreviousMatch} disabled={searchResults.length <= 1} className="ml-1 text-gray-400 hover:text-gray-200 disabled:opacity-50 disabled:cursor-not-allowed">
                     <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4"><path fillRule="evenodd" d="M14.77 12.79a.75.75 0 0 1-1.06 0L10 9.06l-3.71 3.73a.75.75 0 1 1-1.06-1.06l4.24-4.25a.75.75 0 0 1 1.06 0l4.24 4.25a.75.75 0 0 1 0 1.06Z" clipRule="evenodd" /></svg> {/* Up Arrow */}
                   </button>
                   <button onClick={goToNextMatch} disabled={searchResults.length <= 1} className="ml-0.5 text-gray-400 hover:text-gray-200 disabled:opacity-50 disabled:cursor-not-allowed">
                     <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4"><path fillRule="evenodd" d="M5.23 7.21a.75.75 0 0 1 1.06.02L10 11.168l3.71-3.938a.75.75 0 1 1 1.08 1.04l-4.25 4.5a.75.75 0 0 1-1.08 0l-4.25-4.5a.75.75 0 0 1 .02-1.06Z" clipRule="evenodd" /></svg> {/* Down Arrow */}
                   </button>
                 </div>
               ) : (
                 /* Default Header View */
                 <>
                   {/* Left Side */}
                   <div className="flex items-center gap-3 min-w-0 flex-1"> {/* Added flex-1 */}
                     {/* Back Button (Mobile Only) */}
                     <button
                        onClick={() => router.push('/', { scroll: false })} // Use router to clear query param and trigger state reset
                        className="md:hidden mr-1 p-1 text-gray-400 hover:text-white"
                        aria-label="Back to chat list"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
                          <path fillRule="evenodd" d="M17 10a.75.75 0 0 1-.75.75H5.612l4.158 3.96a.75.75 0 1 1-1.04 1.08l-5.5-5.25a.75.75 0 0 1 0-1.08l5.5-5.25a.75.75 0 1 1 1.04 1.08L5.612 9.25H16.25A.75.75 0 0 1 17 10Z" clipRule="evenodd" />
                        </svg>
                     </button>
                     {/* DebateMetadataIcon */}
                     <DebateMetadataIcon
                       metadata={{ // Construct the object needed by the icon
                         ...(selectedDebateMetadata || {}),
                         // Still use separate loading/error state for the selected item's header
                         isLoading: isLoadingMetadata,
                         error: errorMetadata
                       }}
                       size={40} // Standard avatar size
                     />
                     <div className="flex flex-col min-w-0"> {/* Added min-w-0 */}
                       <h2 className="text-md font-semibold text-gray-100 truncate" title={selectedDebateSummary?.title || originalDebate?.Overview?.Title || 'Loading...'}>
                         {selectedDebateSummary?.title || originalDebate?.Overview?.Title || 'Loading...'}
                       </h2>
                       <span className="text-xs text-gray-400">
                         {selectedDebateSummary?.house || originalDebate?.Overview?.House || '...'}
                       </span>
                     </div>
                   </div>

                   {/* Right Icons */}
                   <div className="flex items-center gap-1 md:gap-2 text-gray-400 flex-shrink-0">

                     {/* Search Icon */}
                     <button
                       onClick={() => setIsSearchOpen(true)}
                       className="p-2 rounded-full hover:bg-gray-700 text-gray-400 hover:text-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
                       title="Search debate"
                       disabled={!selectedDebateId || isRegenerating}
                     >
                         <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5"><path fillRule="evenodd" d="M9 3.5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11ZM2 9a7 7 0 1 1 12.452 4.391l3.328 3.329a.75.75 0 1 1-1.06 1.06l-3.329-3.328A7 7 0 0 1 2 9Z" clipRule="evenodd" /></svg>
                     </button>

                     {/* Regenerate Button (Only in rewritten view) */} 
                     {viewMode === 'rewritten' && (
                         <button
                             onClick={handleRegenerate}
                             className={`p-2 rounded-full hover:bg-gray-700 text-gray-400 hover:text-gray-200 disabled:opacity-50 disabled:cursor-not-allowed ${isRegenerating ? 'animate-spin' : ''}`}
                             title="Regenerate Casual Version"
                             disabled={!selectedDebateId || isRegenerating}
                         >
                             {/* Simple Refresh Icon */} 
                             <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                                 <path fillRule="evenodd" d="M20.944 12.979c-.489 4.509-4.306 8.021-8.944 8.021-2.698 0-5.112-1.194-6.763-3.075l1.245-1.633C7.787 17.969 9.695 19 11.836 19c3.837 0 7.028-2.82 7.603-6.5h-2.125l3.186-4.5 3.186 4.5h-2.742zM12 5c2.2 0 4.157.996 5.445 2.553l-1.31 1.548C14.98 7.725 13.556 7 12 7c-3.837 0-7.028 2.82-7.603 6.5h2.125l-3.186 4.5L.15 13.5h2.742C3.38 8.991 7.196 5 12 5z" clipRule="evenodd" />
                             </svg>
                          </button>
                     )}

                     {/* Summary Toggle Button */} 
                     <button
                         onClick={() => setIsSummaryOpen(prev => !prev)} // Toggle dropdown
                         className={`p-2 rounded-full hover:bg-gray-700 text-gray-400 hover:text-gray-200 disabled:opacity-50 disabled:cursor-not-allowed ${isSummaryOpen ? 'bg-gray-700 text-white' : ''}`}
                         title={isSummaryOpen ? "Hide Summary" : "Show Summary"}
                         disabled={!selectedDebateId || isRegenerating}
                     >
                         <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
                             <path fillRule="evenodd" d="M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Zm-7-4a1 1 0 1 1-2 0 1 1 0 0 1 2 0ZM9 9a.75.75 0 0 0 0 1.5h.253a.25.25 0 0 1 .244.304l-.459 2.066A.75.75 0 0 0 10 14.25a.75.75 0 0 0 .75-.75v-.654a.25.25 0 0 1 .244-.304l.459-2.066A.75.75 0 0 0 10.253 9H9Z" clipRule="evenodd" />
                         </svg>
                     </button>

                    {/* View Mode Toggle Button */}
                    <button
                       onClick={handleToggleViewMode}
                       className={`p-2 rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                         viewMode === 'rewritten'
                           ? 'bg-teal-600 text-white hover:bg-teal-700'
                           : 'text-gray-400 hover:text-gray-200 hover:bg-gray-700'
                       }`}
                       disabled={!selectedDebateId}
                       title={`Switch to ${viewMode === 'rewritten' ? 'Original' : 'Casual'} view`}
                     >
                       {viewMode === 'rewritten' ? <CasualIcon /> : <OriginalIcon />}
                       {/* Text removed for icon-only button */}
                     </button>

                   </div>
                 </>
               )}
            </header>

            {/* Summary Dropdown Panel - Positioned absolutely BELOW the header */}
            {isSummaryOpen && (
                <div className="absolute top-16 left-0 right-0 z-30 bg-[#111b21] border-b border-gray-700 shadow-lg p-4 text-sm max-h-48 overflow-y-auto">
                     {/* Close button for the dropdown */}
                     <button
                        onClick={() => setIsSummaryOpen(false)}
                        className="absolute top-1 right-1 text-gray-500 hover:text-white p-1 rounded-full bg-gray-800 hover:bg-gray-700 text-xs z-40"
                        title="Close summary"
                     >
                            ✕
                     </button>
                     {isLoadingSummary ? (
                         <span className="italic text-gray-400 animate-pulse">Generating summary...</span>
                     ) : errorSummary ? (
                         <span className="text-red-400 italic">Error: {errorSummary}</span>
                     ) : summaryText ? (
                         <p className="text-gray-300 pr-4">{summaryText}</p> 
                     ) : (
                         <span className="italic text-gray-500">No summary available or not generated yet.</span>
                     )}
                </div>
            )}

            {/* ChatView Wrapper (handles scrolling) */}
            {/* Added conditional padding top ONLY if summary dropdown is open */}
            <div className={`flex-1 overflow-y-auto ${isSummaryOpen ? 'pt-2' : ''}`}>
              <ChatView
                ref={chatViewRef} // Assign ref
                debateId={selectedDebateId}
                viewMode={viewMode}
                originalDebateData={originalDebate}
                isLoadingOriginal={isLoadingOriginal}
                errorOriginal={errorOriginal}
                fetchOriginalDebate={() => fetchOriginalDebate(selectedDebateId)} // Pass fetch function
                selectedOriginalIndex={selectedOriginalIndex} // Pass state down for panel
                onBubbleClick={handleBubbleClick} // Pass handler down
                searchQuery={searchQuery} // Pass search query
                highlightedIndex={highlightedIndex} // Pass highlighted item's index
                onRewrittenDebateUpdate={handleRewrittenDebateUpdate} // Pass stable callback
              />
            </div>


            {/* Resizable Panel (Positioned absolutely at the bottom) */}
            {viewMode === 'rewritten' && selectedOriginalIndex !== null && (
                <Resizable
                      size={{ width: '100%', height: originalPanelHeight }}
                      minHeight={100}
                      maxHeight={typeof window !== 'undefined' ? window.innerHeight * 0.7 : 500}
                      enable={{ top: true, right: false, bottom: false, left: false, topRight: false, bottomRight: false, bottomLeft: false, topLeft: false }}
                      onResizeStop={(e, direction, ref, d) => {
                          setOriginalPanelHeight(originalPanelHeight + d.height);
                      }}
                      className="absolute bottom-0 left-0 right-0 bg-[#111b21] border-t border-gray-700 z-20 overflow-hidden flex flex-col shadow-lg"
                      handleComponent={{ top: <div className="absolute top-0 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-10 h-2 bg-gray-600 hover:bg-gray-500 rounded cursor-ns-resize" /> }}
                    >
                    {/* Inner container for padding and scrolling */}
                    <div className="p-4 overflow-y-auto flex-grow">
                        {selectedOriginalItem ? (
                            <>
                                <h3 className="text-sm font-semibold text-blue-300 mb-2">Original Contribution (Index: {selectedOriginalIndex})</h3>
                                <OriginalContribution item={selectedOriginalItem} />
                            </>
                        ) : isLoadingOriginal ? (
                            <div className="text-center text-gray-400">Loading original text...</div>
                        ) : errorOriginal ? (
                                 <div className="text-center text-red-400">Error loading original: {errorOriginal}</div>
                            ) : (
                                 <div className="text-center text-gray-500">Original contribution not found or loading.</div>
                            )}
                    </div>
                     {/* Close Button */}
                     <button
                         onClick={() => setSelectedOriginalIndex(null)} // Close panel
                         className="absolute top-2 right-2 text-gray-400 hover:text-white p-1 rounded-full bg-gray-600 hover:bg-gray-500 text-xs z-30"
                         title="Close original view"
                     >
                         ✕
                     </button>
                   </Resizable>
            )}

            {/* Footer */}
            <footer className="p-3 border-t border-gray-700 bg-[#202c33] flex items-center gap-3 flex-shrink-0 z-10 h-16">
              {/* Simplified footer - Summary is now in the header dropdown */}
              <input type="text" placeholder="uwhatgov" className="flex-grow p-2 rounded-md bg-[#2a3942] text-gray-300 placeholder-gray-500 focus:outline-none" disabled />
            </footer>

          </>
        ) : (
          // Placeholder when no debate is selected
          <div className="flex flex-col items-center justify-center h-full text-gray-400">
             <div className="text-center bg-[#0b141a] bg-opacity-80 p-10 rounded-lg">
               <img src="/whatguv.svg" alt="UWhatGov Logo" className="w-100 h-100 text-gray-500 mx-auto opacity-50" />
               <h2 className="text-3xl mt-6 text-gray-300 font-light">UWhatGov</h2>
               <p className="mt-4 text-sm text-gray-500">View UK parliamentary debates<br/>formatted like your favourite chat app.</p>
               <div className="mt-8 border-t border-gray-600 pt-4 text-xs text-gray-600">Select a debate from the list to start viewing.</div>
             </div>
          </div>
        )}
      </div>
    </main>
  );
}

// Removed old JSX structure

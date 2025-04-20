'use client';

import { useState, useEffect, useCallback, useRef, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image'; // Import Next Image

// Import components
import ChatList from '@/components/ChatList';
import ChatView from '@/components/ChatView';
import DebateMetadataIcon from '@/components/DebateMetadataIcon'; // Import the icon
import { AuthForm } from '@/components/AuthForm'; // Import AuthForm
import DebateInitializer from '@/components/DebateInitializer'; // Import the new component
import SummaryViewer from '@/components/SummaryViewer'; // Import new component
import OriginalDebateViewer from '@/components/OriginalDebateViewer'; // Import new component
import SearchHeader from '@/components/SearchHeader'; // Import new component

// Import types
import { InternalDebateSummary, DebateMetadata } from '@/types';
import { DebateResponse } from '@/lib/hansard/types'; // Import necessary types
import { Speech } from '@/components/ChatView'; // Import Speech type

// Import context hook
import { useAuth } from '@/contexts/AuthContext'; // Import useAuth
import { useDebateSearch } from '@/hooks/useDebateSearch'; // Import new hook

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

  // Search State - Managed by useDebateSearch hook below
  // const [_isSearchOpen, _setIsSearchOpen] = useState(false); // State for search input visibility - REMOVED
  // const [_searchQuery, _setSearchQuery] = useState(''); // REMOVED
  // const [_searchResults, _setSearchResults] = useState<number[]>([]); // Stores indices (OrderInSection) of matches - REMOVED
  // const [_currentMatchIndex, _setCurrentMatchIndex] = useState(-1); // Index within searchResults array - REMOVED

  // State for regeneration loading
  const [isRegenerating, setIsRegenerating] = useState(false);

  // Ref for the rewritten debate data used in search
  const rewrittenDebateRef = useRef<Speech[] | null>(null);

  // Summary State
  const [isSummaryOpen, setIsSummaryOpen] = useState(false);
  const [summaryText, setSummaryText] = useState<string | null>(null);
  const [isLoadingSummary, setIsLoadingSummary] = useState(false);
  const [errorSummary, setErrorSummary] = useState<string | null>(null);

  // Use the custom hook for search state and logic
  const {
    isSearchOpen: searchIsOpen,
    setIsSearchOpen: setSearchIsOpen,
    searchQuery: currentSearchQuery,
    setSearchQuery: setCurrentSearchQuery,
    searchResults: currentSearchResults,
    currentMatchIndex: currentSearchMatchIndex,
    handleSearchChange: handleSearchInputChange,
    goToNextMatch: goToNextSearchMatch,
    goToPreviousMatch: goToPreviousSearchMatch,
    closeSearch: closeDebateSearch,
  } = useDebateSearch({
    viewMode,
    originalDebate,
    rewrittenDebateRef, // Pass the ref
    chatViewRef,        // Pass ChatView ref for scrolling
  });

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

  // Handle Debate Selection (triggered by ChatList or DebateInitializer)
  const handleDebateSelect = useCallback((debateId: string | null) => {
    console.log(`[handleDebateSelect] Selecting debate: ${debateId}`);
    if (!debateId) {
      setSelectedDebateId(null);
      setSelectedDebateSummary(null);
      setOriginalDebate(null);
      setSelectedDebateMetadata(null);
      setSummaryText(null);
      setIsSummaryOpen(false);
      setSelectedOriginalIndex(null);
      closeDebateSearch(); // Use the function from the hook
      router.push('/');
      return;
    }

    if (debateId === selectedDebateId) {
      console.log("[handleDebateSelect] Debate already selected, skipping.");
      return;
    }

    setSelectedDebateId(debateId);
    setViewMode('rewritten');
    setSelectedOriginalIndex(null);
    closeDebateSearch(); // Use the function from the hook
    setSelectedDebateSummary(null);
    setOriginalDebate(null);
    setSummaryText(null);
    setIsSummaryOpen(false);

    router.push(`/?debateId=${debateId}`);
    fetchSelectedDebateMetadata(debateId);
    fetchOriginalDebate(debateId);
    fetchSummary(debateId); // Fetch the summary for the newly selected debate

  }, [selectedDebateId, fetchSelectedDebateMetadata, fetchOriginalDebate, fetchSummary, router, closeDebateSearch]); // Added fetchSummary and closeDebateSearch dependency

  // Specific handler for selection coming *from* the ChatList component
  const handleSelectDebateFromList = useCallback((debateSummary: InternalDebateSummary) => {
    setSelectedDebateSummary(debateSummary);
    handleDebateSelect(debateSummary.id);
  }, [handleDebateSelect]);

  // Effect to update selectedDebateMetadata state when the cache changes for the selected ID
  useEffect(() => {
    if (selectedDebateId && metadataCache[selectedDebateId]) {
      const cachedMeta = metadataCache[selectedDebateId];
      // Check if it has actual data (e.g., speakerCount) and isn't just loading/error
      if (!cachedMeta.isLoading && !cachedMeta.error && typeof cachedMeta.speakerCount === 'number') {
          setSelectedDebateMetadata(cachedMeta);
          setIsLoadingMetadata(false);
          setErrorMetadata(null);
      } else {
          setIsLoadingMetadata(!!cachedMeta.isLoading);
          setErrorMetadata(cachedMeta.error || null);
          if (cachedMeta.isLoading || cachedMeta.error) {
              setSelectedDebateMetadata(null);
          }
      }
    } else if (selectedDebateId) {
        setIsLoadingMetadata(true);
        setErrorMetadata(null);
        setSelectedDebateMetadata(null);
        if (!metadataCache[selectedDebateId]?.isLoading) {
            fetchSelectedDebateMetadata(selectedDebateId);
        }
    } else {
        setIsLoadingMetadata(false);
        setErrorMetadata(null);
        setSelectedDebateMetadata(null);
    }
  }, [selectedDebateId, metadataCache, fetchSelectedDebateMetadata]);

  // Handle Stream Completion
  // ... existing code ...

  // Calculate the selected original item based on state here
  const selectedOriginalItem = (selectedOriginalIndex !== null && originalDebate?.Items)
      ? originalDebate.Items.find(item => item.OrderInSection === selectedOriginalIndex)
      : null;

  // Calculate the index of the currently highlighted search result
  const highlightedIndex = currentSearchMatchIndex !== -1 ? currentSearchResults[currentSearchMatchIndex] : null;

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
        <div className="flex-grow overflow-y-auto">
          {/* Wrap DebateInitializer in Suspense */}
          <Suspense fallback={<div className="p-4 text-center text-gray-500">Loading debate list...</div>}>
              <DebateInitializer onDebateSelect={handleDebateSelect} />
          </Suspense>
          <ChatList
            selectedDebateId={selectedDebateId}
            onSelectDebate={handleSelectDebateFromList}
            allMetadata={metadataCache}
            fetchMetadata={fetchSelectedDebateMetadata}
          />
        </div>
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
               {/* Render Search Header only if a debate is selected */}
               {selectedDebateId && searchIsOpen && (
                 <SearchHeader
                   searchQuery={currentSearchQuery}
                   searchResultsCount={currentSearchResults.length}
                   currentMatchIndex={currentSearchMatchIndex}
                   onSearchChange={handleSearchInputChange}
                   onCloseSearch={closeDebateSearch}
                   onClearQuery={() => setCurrentSearchQuery('')}
                   onGoToNextMatch={goToNextSearchMatch}
                   onGoToPreviousMatch={goToPreviousSearchMatch}
                 />
               )}

               {/* Default Header View */}
               {!searchIsOpen && (
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
                     {!searchIsOpen && selectedDebateId && (
                         <button
                             onClick={() => setSearchIsOpen(true)}
                             className="p-2 rounded-full hover:bg-gray-700 text-gray-400 hover:text-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
                             title="Search debate"
                             disabled={!selectedDebateId}
                         >
                             <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5"><path fillRule="evenodd" d="M9 3.5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11ZM2 9a7 7 0 1 1 12.452 4.391l3.328 3.329a.75.75 0 1 1-1.06 1.06l-3.329-3.328A7 7 0 0 1 2 9Z" clipRule="evenodd" /></svg>
                         </button>
                     )}

                     {/* Regenerate Button (Only in rewritten view) */} 
                     {viewMode === 'rewritten' && (
                         <button
                             onClick={() => {
                                 if (!window.confirm("Are you sure you want to regenerate this debate? This will replace the current casual version.")) return;
                                 console.log(`[handleRegenerate] Starting regeneration for ${selectedDebateId}`);
                                 setIsRegenerating(true);
                                 fetchOriginalDebate(selectedDebateId);
                             }}
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
                       onClick={() => {
                           const nextMode = viewMode === 'rewritten' ? 'original' : 'rewritten';
                           if (nextMode === 'original' && selectedDebateId && !originalDebate && !isLoadingOriginal) {
                               fetchOriginalDebate(selectedDebateId);
                           }
                           setViewMode(nextMode);
                       }}
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
            <SummaryViewer
              isOpen={isSummaryOpen}
              isLoading={isLoadingSummary}
              error={errorSummary}
              text={summaryText}
              onClose={() => setIsSummaryOpen(false)}
            />

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
                onBubbleClick={() => {}} // Pass handler down
                searchQuery={currentSearchQuery} // Pass search query
                highlightedIndex={highlightedIndex} // Pass highlighted item's index
                onRewrittenDebateUpdate={handleRewrittenDebateUpdate} // Pass stable callback
              />
            </div>

            {/* Resizable Panel (Positioned absolutely at the bottom) */}
            {selectedOriginalIndex !== null && (
                <OriginalDebateViewer
                  viewMode={viewMode}
                  selectedOriginalIndex={selectedOriginalIndex}
                  selectedOriginalItem={selectedOriginalItem}
                  isLoadingOriginal={isLoadingOriginal}
                  errorOriginal={errorOriginal}
                  originalPanelHeight={originalPanelHeight}
                  setOriginalPanelHeight={setOriginalPanelHeight}
                  onClose={() => setSelectedOriginalIndex(null)}
                />
            )}

            {/* Footer */}
            <footer className="p-3 border-t border-gray-700 bg-[#202c33] flex items-center gap-3 flex-shrink-0 z-10 h-16">
              {/* Simplified footer - Summary is now in the header dropdown */}
              <input type="text" placeholder="u what, gov?" className="flex-grow p-2 rounded-md bg-[#2a3942] text-gray-300 placeholder-gray-500 focus:outline-none" disabled />
            </footer>

          </>
        ) : (
          // Placeholder when no debate is selected
          <div className="flex flex-col items-center justify-center h-full text-gray-400">
             <div className="text-center bg-[#0b141a] bg-opacity-80 p-10 rounded-lg">
               <h2 className="text-3xl mt-6 text-gray-300 font-light">UWhatGov</h2>
               <p className="my-4 text-sm text-gray-500">View UK parliamentary debates<br/>formatted like your favourite chat app.</p>
               <Image 
                 src="/whatguv.svg" 
                 alt="UWhatGov Logo" 
                 width={200}
                 height={200}
                 className="text-gray-500 opacity-50 border-b border-gray-600 mx-auto"
               />
               <div className="pt-4 text-xs text-gray-600">Select a debate from the list to start viewing.</div>
             </div>
          </div>
        )}
      </div>
    </main>
  );
}

// Removed old JSX structure

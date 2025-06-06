'use client';

import { useState, useEffect, useCallback, useRef, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image'; // Import Next Image
import Link from 'next/link'; // Import Link

// Import components
import ChatList from '@/components/ChatList';
import ChatView from '@/components/ChatView';
import DebateMetadataIcon from '@/components/DebateMetadataIcon'; // Import the icon
import { AuthForm } from '@/components/AuthForm'; // Import AuthForm
import DebateInitializer from '@/components/DebateInitializer'; // Import the new component
import SummaryViewer from '@/components/SummaryViewer'; // Import new component
import OriginalDebateViewer from '@/components/OriginalDebateViewer'; // Import new component
import SearchHeader from '@/components/SearchHeader'; // Import new component
import CookieConsentBanner from '@/components/CookieConsentBanner'; // Import cookie banner

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
// Three dots icon
const OptionsIcon = () => <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5"><path d="M10 3a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3ZM10 8.5a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3ZM11.5 15.5a1.5 1.5 0 1 0-3 0 1.5 1.5 0 0 0 3 0Z" /></svg>;
// Regenerate/Refresh icon
const RefreshIcon = () => <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path fillRule="evenodd" d="M20.944 12.979c-.489 4.509-4.306 8.021-8.944 8.021-2.698 0-5.112-1.194-6.763-3.075l1.245-1.633C7.787 17.969 9.695 19 11.836 19c3.837 0 7.028-2.82 7.603-6.5h-2.125l3.186-4.5 3.186 4.5h-2.742zM12 5c2.2 0 4.157.996 5.445 2.553l-1.31 1.548C14.98 7.725 13.556 7 12 7c-3.837 0-7.028 2.82-7.603 6.5h2.125l-3.186 4.5L.15 13.5h2.742C3.38 8.991 7.196 5 12 5z" clipRule="evenodd" /></svg>;
// Chevron Down Icon
const ChevronDownIcon = () => <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4"><path fillRule="evenodd" d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" /></svg>;

// localStorage Keys
const METADATA_CACHE_PREFIX = 'uwhatgov_metadata_';
const ORIGINAL_DEBATE_CACHE_PREFIX = 'uwhatgov_original_';

export default function Home() {
  const router = useRouter();
  const chatViewRef = useRef<ChatViewHandle>(null); // Ref for ChatView scrolling and triggering
  const { user, loading: authLoading, logout, isProUser } = useAuth(); // Get auth state
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
  // State for regeneration loading
  const [isRegenerating, setIsRegenerating] = useState(false);

  // Ref for the rewritten debate data used in search
  const rewrittenDebateRef = useRef<Speech[] | null>(null);

  // Summary State
  const [isSummaryOpen, setIsSummaryOpen] = useState(false);
  const [summaryText, setSummaryText] = useState<string | null>(null);
  const [isLoadingSummary, setIsLoadingSummary] = useState(false);
  const [errorSummary, setErrorSummary] = useState<string | null>(null);

  // State for Header Options Dropdown
  const [isOptionsMenuOpen, setIsOptionsMenuOpen] = useState(false);
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

  // --- NEW: State for Mobile Sidebar Toggle ---
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  // ---

  // Function to handle regeneration request
  const handleRegenerate = useCallback(() => {
    if (!window.confirm("Are you sure you want to regenerate this debate? This will replace the current casual version.")) return;
    if (!selectedDebateId) {
        console.warn("[handleRegenerate] No debate selected, cannot regenerate.");
        return;
    }
    console.log(`[handleRegenerate] Starting regeneration for ${selectedDebateId}`);
    setIsRegenerating(true);
    setIsOptionsMenuOpen(false); // Close menu
    
    // Clear memory cache
    originalDebateCache.current.delete(selectedDebateId);
    console.log(`[handleRegenerate] Cleared memory cache for ${selectedDebateId}`);

    // Clear localStorage
    const localStorageKey = ORIGINAL_DEBATE_CACHE_PREFIX + selectedDebateId;
    try {
        localStorage.removeItem(localStorageKey);
        console.log(`[handleRegenerate] Cleared localStorage for ${selectedDebateId}`);
    } catch (error) {
        console.error(`[handleRegenerate] Error removing localStorage item ${localStorageKey}:`, error);
    }

    // Clear potentially stale rewritten data ref
    rewrittenDebateRef.current = null;

    // Reset original item view in case it was open
    setSelectedOriginalIndex(null);

    // Trigger the stream in ChatView
    chatViewRef.current?.triggerStream();
    console.log(`[handleRegenerate] Triggered stream for ${selectedDebateId}`);
    
    // Note: Need ChatView callback to reset isRegenerating on completion/failure.
  }, [selectedDebateId]);

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

  // Handle Logout
  const handleLogout = useCallback(() => {
    logout();
    setIsOptionsMenuOpen(false); // Close menu after logout
  }, [logout]);

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
      setIsOptionsMenuOpen(false); // Close options menu on new debate select
      setSelectedOriginalIndex(null);
      closeDebateSearch(); // Use the function from the hook
      router.push('/');

      // --- Close mobile sidebar on deselect ---
      setIsMobileSidebarOpen(false);
      // ---
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
    setIsOptionsMenuOpen(false); // Close options menu on new debate select

    // --- Close mobile sidebar on select ---
    setIsMobileSidebarOpen(false);
    // ---

    router.push(`/?debateId=${debateId}`);
    fetchSelectedDebateMetadata(debateId);
    fetchOriginalDebate(debateId);
    fetchSummary(debateId); // Fetch the summary for the newly selected debate

  }, [selectedDebateId, fetchSelectedDebateMetadata, fetchOriginalDebate, fetchSummary, router, closeDebateSearch]); // Added fetchSummary and closeDebateSearch dependency

  // Specific handler for selection coming *from* the ChatList component
  const handleSelectDebateFromList = useCallback((debateSummary: InternalDebateSummary) => {
    // --- NEW: Close sidebar if same debate is tapped on mobile ---
    if (debateSummary.id === selectedDebateId && isMobileSidebarOpen) {
      setIsMobileSidebarOpen(false);
      return;
    }
    // ---

    // Existing logic for selecting a *new* debate
    setSelectedDebateSummary(debateSummary);
    handleDebateSelect(debateSummary.id);
  }, [handleDebateSelect, selectedDebateId, isMobileSidebarOpen]); // Added dependencies

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
  // TODO: Add callback from ChatView to set isRegenerating = false
  // const handleStreamComplete = useCallback(() => {
  //   setIsRegenerating(false);
  //   console.log("[handleStreamComplete] Stream finished or failed, regeneration state reset.");
  // }, []);

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
    <main className="flex h-dvh w-screen bg-[#111b21] text-white overflow-hidden relative">
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
          ${isMobileSidebarOpen ? 'flex' : 'hidden'}
          md:flex
          w-full md:w-2/5 border-r border-gray-700 flex-col bg-[#111b21]
          absolute md:relative h-full z-20 // Absolute position for mobile overlay
        `}
      >
        {/* Sidebar Header - Render conditionally */}
        {(authLoading || !user) && (
          <div className="p-4 border-b border-gray-700 flex justify-between items-center bg-[#202c33] min-h-[64px]">
            {authLoading ? (
              <span className="text-sm text-gray-400 italic">Loading...</span>
            ) : (
              // We know !user is true here because of the outer condition
              <button
                onClick={() => setIsAuthModalOpen(true)}
                className="w-full text-center text-sm bg-indigo-600 text-white py-1.5 px-3 rounded-md hover:bg-indigo-700 transition-colors"
              >
                Sign In / Sign Up
              </button>
            )}
            {/* Right side content could go here if needed when loading/logged out */}
          </div>
        )}
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
          ${isMobileSidebarOpen ? 'hidden' : 'flex'} // Hide if mobile sidebar is open
          md:flex // Always flex on desktop+
          flex-grow flex-col bg-[#0b141a] overflow-hidden relative
        `}
        style={!selectedDebateId ? {
          backgroundImage: "url('/edited-pattern.svg')",
          backgroundSize: 'contain',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat' // Ensure it doesn't repeat by default
        } : {}}
      >
        {selectedDebateId ? (
          <>
            {/* Header - Added relative positioning for dropdown */}
            <header className="relative p-3 flex items-center justify-between border-b border-gray-700 bg-[#202c33] flex-shrink-0 z-10 h-16">
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
                   {/* Left Side - Made clickable for summary toggle */}
                   <div
                     className={`flex items-center gap-3 min-w-0 flex-1 cursor-pointer ${
                       !selectedDebateId || isRegenerating || !summaryText
                         ? 'opacity-70 pointer-events-none' // Add disabled appearance and prevent clicks
                         : ''
                     }`}
                     onClick={() => {
                       // Only toggle if not disabled
                       if (selectedDebateId && !isRegenerating && summaryText) {
                         setIsSummaryOpen(prev => !prev);
                       }
                     }}
                     title={isSummaryOpen ? "Hide Summary" : "Show Summary"}
                   >
                     {/* Back Button (Mobile Only) */}
                     <button
                       onClick={(e) => {
                         e.stopPropagation(); // Prevent header click
                         setIsMobileSidebarOpen(true);
                       }}
                       className="md:hidden mr-1 p-1 text-gray-400 hover:text-white"
                       aria-label="Open chat list"
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
                       <h2 className="text-md font-semibold text-gray-100 truncate flex items-center gap-1" title={selectedDebateSummary?.title || originalDebate?.Overview?.Title || 'Loading...'}>
                         {selectedDebateSummary?.title || originalDebate?.Overview?.Title || 'Loading...'}
                         {/* Summary Toggle Chevron Button (Moved) */}
                         <button
                           onClick={(e) => {
                             e.stopPropagation(); // Prevent wrapper div click from firing
                             setIsSummaryOpen(prev => !prev);
                           }}
                           className={`p-0.5 rounded-full hover:bg-gray-700 text-gray-400 hover:text-gray-200 disabled:opacity-50 disabled:cursor-not-allowed ${isSummaryOpen ? 'bg-gray-700 text-white rotate-180' : ''} transition-transform duration-200`}
                           title={isSummaryOpen ? "Hide Summary" : "Show Summary"}
                           disabled={!selectedDebateId || isRegenerating || !summaryText} // Disable if no summary text yet
                         >
                           <ChevronDownIcon />
                         </button>
                       </h2>
                       <span className="text-xs text-gray-400">
                         {selectedDebateSummary?.house || originalDebate?.Overview?.House || '...'}
                       </span>
                     </div>
                   </div>

                   {/* Right Icons */}
                   <div className="flex items-center gap-1 md:gap-2 text-gray-400 flex-shrink-0">

                     {/* View Mode Toggle */}
                     <div className="flex items-center border border-gray-600 rounded-full p-0.5 text-xs">
                       <button
                         onClick={() => setViewMode('rewritten')}
                         className={`px-2 py-1 rounded-full flex items-center gap-1 transition-colors ${
                           viewMode === 'rewritten'
                             ? 'bg-gray-700 text-white'
                             : 'text-gray-400 hover:text-gray-200'
                         }`}
                         title="Casual View"
                       >
                         <CasualIcon />
                         <span className="hidden sm:inline">Casual</span>
                       </button>
                       <button
                         onClick={() => setViewMode('original')}
                         className={`px-2 py-1 rounded-full flex items-center gap-1 transition-colors ${
                           viewMode === 'original'
                             ? 'bg-gray-700 text-white'
                             : 'text-gray-400 hover:text-gray-200'
                         } disabled:opacity-50 disabled:cursor-not-allowed`}
                         title="Original View"
                         disabled={!originalDebate || isLoadingOriginal || !!errorOriginal} // Disable if no original data or loading/error
                       >
                         <OriginalIcon />
                         <span className="hidden sm:inline">Original</span>
                       </button>
                     </div>

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

                     {/* Options Dropdown Button ('Three Dots') */}
                     <button
                       onClick={() => setIsOptionsMenuOpen(prev => !prev)}
                       className={`p-2 rounded-full hover:bg-gray-700 text-gray-400 hover:text-gray-200 disabled:opacity-50 disabled:cursor-not-allowed ${isOptionsMenuOpen ? 'bg-gray-700 text-white' : ''}`}
                       title="Options"
                       disabled={!selectedDebateId}
                     >
                       <OptionsIcon />
                     </button>

                   </div>

                   {/* Options Dropdown Menu */}
                   {isOptionsMenuOpen && (
                     <div className="absolute top-14 right-3 mt-1 w-48 bg-[#2a3942] rounded-md shadow-lg py-1 z-20">
                       {/* Regenerate Option (Conditional) */}
                       {viewMode === 'rewritten' && (
                           <button
                               onClick={handleRegenerate}
                               className={`w-full text-left px-4 py-2 text-sm text-gray-300 hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 ${isRegenerating ? 'cursor-wait' : ''}`}
                               disabled={!selectedDebateId || isRegenerating}
                           >
                               <RefreshIcon />
                               {isRegenerating ? 'Regenerating...' : 'Regenerate'}
                           </button>
                       )}

                       {/* User Info & Logout (Conditional) */}
                       {user && (
                         <>
                           <Link
                             href="/dashboard"
                             className="w-full text-left px-4 py-2 text-sm text-gray-300 hover:bg-gray-700 flex items-center gap-2"
                             onClick={() => setIsOptionsMenuOpen(false)} // Close menu on click
                           >
                             {/* Optional: Add an icon */}
                             <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4"><path fillRule="evenodd" d="M11.49 3.17a.75.75 0 0 1 1.02.07l3 3a.75.75 0 0 1 .07 1.02l-7 7a.75.75 0 0 1-1.09.02l-4-4a.75.75 0 0 1 1.06-1.06l3.47 3.47L11.49 3.17Z" clipRule="evenodd" /></svg>
                             Dashboard
                           </Link>
                           <div className="px-4 py-2 text-xs text-gray-500 border-t border-gray-600 mt-1 pt-2">
                             Signed in as:
                           </div>
                           <div className="px-4 py-1 text-sm text-gray-300 truncate" title={user.email}>
                             {user.email}
                           </div>
                           <button
                             onClick={handleLogout}
                             className="w-full text-left px-4 py-2 text-sm text-indigo-400 hover:bg-gray-700 hover:text-indigo-300"
                           >
                             Logout
                           </button>
                           {/* Billing Link */}
                           <Link
                             href="/billing"
                             onClick={() => setIsOptionsMenuOpen(false)}
                             className="w-full text-left px-4 py-2 text-sm text-indigo-400 hover:bg-gray-700 hover:text-indigo-300"
                           >
                             {isProUser ? 'Manage Subscription' : 'Upgrade to Pro'}
                           </Link>
                         </>
                       )}
                     </div>
                   )}
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
                onBubbleClick={(index) => {
                  console.log(`[page.tsx] Bubble clicked, setting index: ${index}`);
                  setSelectedOriginalIndex(index ?? null); // Set to null if index is undefined
                }} // Pass handler down
                searchQuery={currentSearchQuery} // Pass search query
                highlightedIndex={highlightedIndex} // Pass highlighted item's index
                onRewrittenDebateUpdate={handleRewrittenDebateUpdate} // Pass stable callback
                // Pass stream completion handler (if implemented in ChatView)
                // onStreamComplete={handleStreamComplete}
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
          <div className="flex flex-col items-center justify-center h-full text-gray-400 relative"> {/* Added relative positioning */}
             <div className="text-center bg-[#0b141a] bg-opacity-80 p-10 rounded-lg">
               <h2 className="text-3xl mt-6 text-gray-300 font-light">UWhatGov</h2>
               <p className="my-4 text-sm text-gray-500">View parliamentary debates<br/>formatted like your favourite chat app.</p>
               {/* --- NEW: Mobile Sidebar Toggle Button --- */}
               {!selectedDebateId && (
                 <button
                   onClick={() => setIsMobileSidebarOpen(true)}
                   className="md:hidden absolute top-4 left-4 p-2 text-gray-400 bg-[#202c33] rounded-md hover:bg-gray-700 hover:text-white transition-colors"
                   aria-label="Open sidebar"
                 >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
                    <path fillRule="evenodd" d="M17 10a.75.75 0 0 1-.75.75H5.612l4.158 3.96a.75.75 0 1 1-1.04 1.08l-5.5-5.25a.75.75 0 0 1 0-1.08l5.5-5.25a.75.75 0 1 1 1.04 1.08L5.612 9.25H16.25A.75.75 0 0 1 17 10Z" clipRule="evenodd" />
                  </svg>
                 </button>
               )}
               <Image
                 src="/whatguv.svg"
                 alt="UWhatGov Logo"
                 width={200}
                 height={200}
                 className="text-gray-500 opacity-50 border-b border-gray-600 mx-auto"
               />
               <div className="pt-4 text-xs text-gray-600">Select a debate from the list to start viewing.</div>
             </div>
             {/* Subtle Logout Button in Corner (only if user logged in) */}
             {!authLoading && user && (
                <div className="absolute bottom-4 right-4 flex flex-col items-end gap-2">
                  <button
                      onClick={handleLogout}
                      className="px-3 py-1 text-xs text-gray-500 bg-[#202c33] rounded hover:bg-gray-700 hover:text-gray-300 transition-colors"
                      title={`Sign out ${user.email}`}
                  >
                      Sign Out
                  </button>
                </div>
             )}
             {/* Dashboard Link in Corner (only if user logged in) */}
             {!authLoading && user && (
               <div className="absolute bottom-4 left-4 flex flex-col items-start gap-2">
                 <Link
                     href="/dashboard"
                     className="px-3 py-1 text-xs text-indigo-400 bg-[#202c33] rounded hover:bg-gray-700 hover:text-indigo-300 transition-colors"
                 >
                     Dashboard
                  </Link>
               </div>
             )}
          </div>
        )}
      </div>
      {/* Cookie Consent Banner - Renders outside the main content flow */}
      <CookieConsentBanner />
    </main>
  );
}

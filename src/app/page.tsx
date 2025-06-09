'use client';

import { useState, useCallback, useRef, Suspense, useMemo } from 'react';
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
import OriginalContribution from '@/components/OriginalContribution'; // Import updated component
import SearchHeader from '@/components/SearchHeader'; // Import new component
import CookieConsentBanner from '@/components/CookieConsentBanner'; // Import cookie banner
import IntegratedChat from '@/components/IntegratedChat'; // Import integrated chat

// Import types
import { InternalDebateSummary, DebateMetadata } from '@/types';
import { DebateResponse } from '@/lib/hansard/types'; // Import necessary types
import { Speech } from '@/components/ChatView'; // Import Speech type

// Import context hook
import { useAuth } from '@/contexts/AuthContext'; // Import useAuth
import { useDebateSearch } from '@/hooks/useDebateSearch'; // Import new hook
import { useDataCache } from '@/hooks/useDataCache';

// Define type for the ChatView ref methods
interface ChatViewHandle {
  scrollToItem: (index: number) => void;
  triggerStream: () => void;
}

const SendIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
    <path d="M3.105 2.288a.75.75 0 0 0-.826.95l1.414 4.926A1.5 1.5 0 0 0 5.135 9.25h6.115a.75.75 0 0 1 0 1.5H5.135a1.5 1.5 0 0 0-1.442 1.086l-1.414 4.926a.75.75 0 0 0 .826.95 28.896 28.896 0 0 0 15.293-7.155.75.75 0 0 0 0-1.114A28.896 28.896 0 0 0 3.105 2.288Z" />
  </svg>
);

const ChatIcon = () => (
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
  <path fillRule="evenodd" d="M10 2c-2.236 0-4.43.18-6.57.524C1.993 2.755 1 4.014 1 5.426v5.148c0 1.413.993 2.67 2.43 2.902.848.137 1.705.248 2.57.331v3.443a.75.75 0 0 0 1.28.53l3.58-3.579a.78.78 0 0 1 .527-.224 41.202 41.202 0 0 0 5.183-.5c1.437-.232 2.43-1.49 2.43-2.903V5.426c0-1.413-.993-2.67-2.43-2.902A41.289 41.289 0 0 0 10 2Zm0 7a1 1 0 1 0 0-2 1 1 0 0 0 0 2ZM8 8a1 1 0 1 1-2 0 1 1 0 0 1 2 0Zm5 1a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z" clipRule="evenodd" />
</svg>
);

// Icons for view toggle
const CasualIcon = () => <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 56 56" fill="currentColor" className="w-5 h-5"><path fillRule="evenodd" d="M 26.6875 12.6602 C 26.9687 12.6602 27.1094 12.4961 27.1797 12.2383 C 27.9062 8.3242 27.8594 8.2305 31.9375 7.4570 C 32.2187 7.4102 32.3828 7.2461 32.3828 6.9648 C 32.3828 6.6836 32.2187 6.5195 31.9375 6.4726 C 27.8828 5.6524 28.0000 5.5586 27.1797 1.6914 C 27.1094 1.4336 26.9687 1.2695 26.6875 1.2695 C 26.4062 1.2695 26.2656 1.4336 26.1953 1.6914 C 25.3750 5.5586 25.5156 5.6524 21.4375 6.4726 C 21.1797 6.5195 20.9922 6.6836 20.9922 6.9648 C 20.9922 7.2461 21.1797 7.4102 21.4375 7.4570 C 25.5156 8.2774 25.4687 8.3242 26.1953 12.2383 C 26.2656 12.4961 26.4062 12.6602 26.6875 12.6602 Z M 15.3438 28.7852 C 15.7891 28.7852 16.0938 28.5039 16.1406 28.0821 C 16.9844 21.8242 17.1953 21.8242 23.6641 20.5821 C 24.0860 20.5117 24.3906 20.2305 24.3906 19.7852 C 24.3906 19.3633 24.0860 19.0586 23.6641 18.9883 C 17.1953 18.0977 16.9609 17.8867 16.1406 11.5117 C 16.0938 11.0899 15.7891 10.7852 15.3438 10.7852 C 14.9219 10.7852 14.6172 11.0899 14.5703 11.5352 C 13.7969 17.8164 13.4687 17.7930 7.0469 18.9883 C 6.6250 19.0821 6.3203 19.3633 6.3203 19.7852 C 6.3203 20.2539 6.6250 20.5117 7.1406 20.5821 C 13.5156 21.6133 13.7969 21.7774 14.5703 28.0352 C 14.6172 28.5039 14.9219 28.7852 15.3438 28.7852 Z M 31.2344 54.7305 C 31.8438 54.7305 32.2891 54.2852 32.4062 53.6524 C 34.0703 40.8086 35.8750 38.8633 48.5781 37.4570 C 49.2344 37.3867 49.6797 36.8945 49.6797 36.2852 C 49.6797 35.6758 49.2344 35.2070 48.5781 35.1133 C 35.8750 33.7070 34.0703 31.7617 32.4062 18.9180 C 32.2891 18.2852 31.8438 17.8633 31.2344 17.8633 C 30.6250 17.8633 30.1797 18.2852 30.0860 18.9180 C 28.4219 31.7617 26.5938 33.7070 13.9140 35.1133 C 13.2344 35.2070 12.7891 35.6758 12.7891 36.2852 C 12.7891 36.8945 13.2344 37.3867 13.9140 37.4570 C 26.5703 39.1211 28.3281 40.8321 30.0860 53.6524 C 30.1797 54.2852 30.6250 54.7305 31.2344 54.7305 Z" clipRule="evenodd" /></svg>;
const OriginalIcon = () => <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5"><path fillRule="evenodd" d="M4.25 5.5a.75.75 0 0 0 0 1.5h11.5a.75.75 0 0 0 0-1.5H4.25Zm0 4a.75.75 0 0 0 0 1.5h11.5a.75.75 0 0 0 0-1.5H4.25Zm0 4a.75.75 0 0 0 0 1.5h7.5a.75.75 0 0 0 0-1.5h-7.5Z" clipRule="evenodd" /></svg>;
// Three dots icon
const OptionsIcon = () => <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5"><path d="M10 3a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3ZM10 8.5a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3ZM11.5 15.5a1.5 1.5 0 1 0-3 0 1.5 1.5 0 0 0 3 0Z" /></svg>;
// Regenerate/Refresh icon
const RefreshIcon = () => <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path fillRule="evenodd" d="M20.944 12.979c-.489 4.509-4.306 8.021-8.944 8.021-2.698 0-5.112-1.194-6.763-3.075l1.245-1.633C7.787 17.969 9.695 19 11.836 19c3.837 0 7.028-2.82 7.603-6.5h-2.125l3.186-4.5 3.186 4.5h-2.742zM12 5c2.2 0 4.157.996 5.445 2.553l-1.31 1.548C14.98 7.725 13.556 7 12 7c-3.837 0-7.028 2.82-7.603 6.5h2.125l-3.186 4.5L.15 13.5h2.742C3.38 8.991 7.196 5 12 5z" clipRule="evenodd" /></svg>;
// Chevron Down Icon
const ChevronDownIcon = () => <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4"><path fillRule="evenodd" d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" /></svg>;


export default function Home() {
  const router = useRouter();
  const chatViewRef = useRef<ChatViewHandle>(null); // Ref for ChatView scrolling and triggering
  const { user, loading: authLoading, logout, isProUser } = useAuth(); // Get auth state
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false); // State for Auth Modal

  // Initialize caching hooks
  const originalDebateCache = useDataCache<DebateResponse>({
    keyPrefix: 'uwhatgov_original_',
    memoryCache: true,
    localStorageCache: true,
  });

  const metadataCache = useDataCache<DebateMetadata>({
    keyPrefix: 'uwhatgov_metadata_',
    memoryCache: false, // Use state-based cache for metadata to trigger re-renders
    localStorageCache: true,
  });

  // Chat List state
  const [selectedDebateId, setSelectedDebateId] = useState<string | null>(null);
  const [selectedDebateSummary, setSelectedDebateSummary] = useState<InternalDebateSummary | null>(null);

  // View Mode state
  const [viewMode, setViewMode] = useState<'rewritten' | 'original'>('rewritten');

  // Resizable Panel state
  const [selectedOriginalIndex, setSelectedOriginalIndex] = useState<number | null>(null);
  const [originalPanelHeight, setOriginalPanelHeight] = useState(43);
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
    originalDebate: selectedDebateId ? originalDebateCache.getCachedData(selectedDebateId).data : null,
    rewrittenDebateRef,
    chatViewRef,
  });

  // State for Mobile Sidebar Toggle
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  
  // State for Chat Mode (integrated vs overlay)
  const [chatMode, setChatMode] = useState<'debate' | 'chat'>('debate');
  
  // Chat input state
  const [chatInput, setChatInput] = useState('');

  // Chat input handlers
  const handleChatInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setChatInput(e.target.value);
  };

  const handleChatInputSubmit = () => {
    if (!user) {
      setIsAuthModalOpen(true);
      return;
    }

    // Switch to chat mode (the IntegratedChat component will handle the initial message if needed)
    setChatMode('chat');
    
    // Clear the input after switching
    setChatInput('');
  };

  const handleChatInputKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleChatInputSubmit();
    }
  };

  // Get current debate data from caches only when selectedDebateId changes
  const originalDebateState = selectedDebateId ? originalDebateCache.getCachedData(selectedDebateId) : { data: null, isLoading: false, error: null };
  const metadataState = selectedDebateId ? metadataCache.getCachedData(selectedDebateId) : { data: null, isLoading: false, error: null };
  const originalDebate = originalDebateState.data;

  // Create API fetcher functions
  const fetchOriginalDebateFromAPI = useCallback(async (debateId: string): Promise<DebateResponse> => {
    const response = await fetch(`/api/hansard/debates/${debateId}`);
    if (!response.ok) {
      let errorMsg = `Original fetch failed: ${response.status}`;
      try { 
        const errorData = await response.json(); 
        errorMsg = errorData.error || errorData.message || errorMsg; 
      } catch (_e) {}
      throw new Error(errorMsg);
    }
    return response.json();
  }, []);

  const fetchMetadataFromAPI = useCallback(async (debateId: string): Promise<DebateMetadata> => {
    const response = await fetch(`/api/hansard/debates/${debateId}/metadata`);
    if (!response.ok) {
      let errorMsg = `Metadata fetch failed: ${response.status}`;
      try { 
        const errorData = await response.json(); 
        errorMsg = errorData.error || errorMsg; 
      } catch (_e) {}
      throw new Error(errorMsg);
    }
    return response.json();
  }, []);

  // Function to handle regeneration request
  const handleRegenerate = useCallback(() => {
    if (!window.confirm("Are you sure you want to regenerate this debate? This will replace the current casual version.")) return;
    if (!selectedDebateId) {
        console.warn("[handleRegenerate] No debate selected, cannot regenerate.");
        return;
    }
    console.log(`[handleRegenerate] Starting regeneration for ${selectedDebateId}`);
    setIsRegenerating(true);
    setIsOptionsMenuOpen(false);
    
    // Clear caches
    originalDebateCache.clearCache(selectedDebateId);
    
    // Clear potentially stale rewritten data ref
    rewrittenDebateRef.current = null;

    // Reset original item view in case it was open
    setSelectedOriginalIndex(null);

    // Trigger the stream in ChatView
    chatViewRef.current?.triggerStream();
    console.log(`[handleRegenerate] Triggered stream for ${selectedDebateId}`);
  }, [selectedDebateId, originalDebateCache]);

  // Fetch Summary Data
  const fetchSummary = useCallback(async (debateId: string | null) => {
      if (!debateId) return;
      console.log(`[fetchSummary] Fetching summary for ${debateId}`);
      setIsLoadingSummary(true);
      setErrorSummary(null);
      setSummaryText(null);

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
    setIsOptionsMenuOpen(false);
  }, [logout]);

  // Handle Debate Selection
  const handleDebateSelect = useCallback((debateId: string | null) => {
    console.log(`[handleDebateSelect] Selecting debate: ${debateId}`);
    if (!debateId) {
      setSelectedDebateId(null);
      setSelectedDebateSummary(null);
      setSummaryText(null);
      setIsSummaryOpen(false);
      setIsOptionsMenuOpen(false);
      setSelectedOriginalIndex(null);
      closeDebateSearch();
      router.push('/');
      setIsMobileSidebarOpen(false);
      return;
    }

    if (debateId === selectedDebateId) {
      console.log("[handleDebateSelect] Debate already selected, skipping.");
      return;
    }

      setSelectedDebateId(debateId);
  setViewMode('rewritten');
  setSelectedOriginalIndex(null);
  setOriginalPanelHeight(43);
  closeDebateSearch();
  setSelectedDebateSummary(null);
  setSummaryText(null);
  setIsSummaryOpen(false);
  setIsOptionsMenuOpen(false);
  setIsMobileSidebarOpen(false);
  setChatMode('debate');

    router.push(`/?debateId=${debateId}`);
    
    // Fetch data using cache hooks only if not already cached
    const currentMetadataState = metadataCache.getCachedData(debateId);
    const currentOriginalState = originalDebateCache.getCachedData(debateId);
    
    if (!currentMetadataState.data && !currentMetadataState.isLoading) {
      metadataCache.fetchData(debateId, fetchMetadataFromAPI);
    }
    
    if (!currentOriginalState.data && !currentOriginalState.isLoading) {
      originalDebateCache.fetchData(debateId, fetchOriginalDebateFromAPI);
    }
    
    fetchSummary(debateId);

  }, [selectedDebateId, metadataCache, originalDebateCache, fetchMetadataFromAPI, fetchOriginalDebateFromAPI, fetchSummary, router, closeDebateSearch]);

  // Handle selection from ChatList
  const handleSelectDebateFromList = useCallback((debateSummary: InternalDebateSummary) => {
    if (debateSummary.id === selectedDebateId && isMobileSidebarOpen) {
      setIsMobileSidebarOpen(false);
      return;
    }

    setSelectedDebateSummary(debateSummary);
    handleDebateSelect(debateSummary.id);
  }, [handleDebateSelect, selectedDebateId, isMobileSidebarOpen]);

  // Calculate the selected original item
  const selectedOriginalItem = (selectedOriginalIndex !== null && originalDebate?.Items)
      ? originalDebate.Items.find(item => item.OrderInSection === selectedOriginalIndex)
      : null;

  // Calculate the index of the currently highlighted search result
  const highlightedIndex = currentSearchMatchIndex !== -1 ? currentSearchResults[currentSearchMatchIndex] : null;

  // Stable callback for ChatView to update the parent's ref with rewritten speeches
  const handleRewrittenDebateUpdate = useCallback((speeches: Speech[]) => {
    rewrittenDebateRef.current = speeches;
  }, []);

  // Memoize metadata transformation to prevent profile pictures from disappearing
  const transformedMetadata = useMemo(() => {
    return Object.fromEntries(
      Object.entries(metadataCache.cache).map(([id, cacheState]) => [
        id, 
        cacheState.data ? { ...cacheState.data, isLoading: cacheState.isLoading, error: cacheState.error } : { isLoading: cacheState.isLoading, error: cacheState.error }
      ])
    );
  }, [metadataCache.cache]);

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
            allMetadata={transformedMetadata}
            fetchMetadata={(debateId: string) => metadataCache.fetchData(debateId, fetchMetadataFromAPI)}
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
                         ...(metadataState.data || {}),
                         // Still use separate loading/error state for the selected item's header
                         isLoading: metadataState.isLoading,
                         error: metadataState.error
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




                     {/* Search Icon (only in debate mode) */}
                     {!searchIsOpen && selectedDebateId && chatMode === 'debate' && (
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
                       {/* Regenerate Option (Conditional - only in debate mode) */}
                       {chatMode === 'debate' && viewMode === 'rewritten' && user && (
                           <button
                               onClick={handleRegenerate}
                               className={`w-full text-left px-4 py-2 text-sm text-gray-300 hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 ${isRegenerating ? 'cursor-wait' : ''}`}
                               disabled={!selectedDebateId || isRegenerating}
                           >
                               <RefreshIcon />
                               {isRegenerating ? 'Regenerating...' : 'Regenerate'}
                           </button>
                       )}

                       {/* View Mode Options (only in debate mode) */}
                       {chatMode === 'debate' && (
                         <>
                           {viewMode === 'original' && (
                             <button
                               onClick={() => {
                                 setViewMode('rewritten');
                                 setIsOptionsMenuOpen(false);
                               }}
                               className="w-full text-left px-4 py-2 text-sm text-gray-300 hover:bg-gray-700 flex items-center gap-2"
                             >
                               <CasualIcon />
                               Casual View
                             </button>
                           )}
                           {viewMode === 'rewritten' && (
                             <button
                               onClick={() => {
                                 setViewMode('original');
                                 setIsOptionsMenuOpen(false);
                               }}
                               className="w-full text-left px-4 py-2 text-sm text-gray-300 hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                               disabled={!originalDebate || originalDebateState.isLoading || !!originalDebateState.error}
                             >
                               <OriginalIcon />
                               Original View
                             </button>
                           )}
                         </>
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
                             <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4"><path fillRule="evenodd" d="M10,14 C10.5522847,14 11,14.4477153 11,15 L11,21 C11,21.5522847 10.5522847,22 10,22 L3,22 C2.44771525,22 2,21.5522847 2,21 L2,15 C2,14.4477153 2.44771525,14 3,14 L10,14 Z M21,9 C21.5522847,9 22,9.44771525 22,10 L22,21 C22,21.5522847 21.5522847,22 21,22 L14,22 C13.4477153,22 13,21.5522847 13,21 L13,10 C13,9.44771525 13.4477153,9 14,9 L21,9 Z M10,2 C10.5522847,2 11,2.44771525 11,3 L11,11 C11,11.5522847 10.5522847,12 10,12 L3,12 C2.44771525,12 2,11.5522847 2,11 L2,3 C2,2.44771525 2.44771525,2 3,2 L10,2 Z M21,2 C21.5522847,2 22,2.44771525 22,3 L22,6 C22,6.55228475 21.5522847,7 21,7 L14,7 C13.4477153,7 13,6.55228475 13,6 L13,3 C13,2.44771525 13.4477153,2 14,2 L21,2 Z" clipRule="evenodd" /></svg>
                             Dashboard
                           </Link>
                           <div className="px-4 py-2 text-xs text-gray-500 border-t border-gray-600 mt-1 pt-2">
                             Signed in as:
                           </div>
                           <div className="px-4 py-1 text-sm text-gray-300 truncate" title={user.email}>
                             {user.email}
                           </div>
                          {/* Billing Link */}
                          <Link
                             href="/billing"
                             onClick={() => setIsOptionsMenuOpen(false)}
                             className="flex w-full text-left px-4 py-2 text-sm text-indigo-400 hover:bg-gray-700 hover:text-indigo-300"
                           >
                             {isProUser ? 'Manage Subscription' : 'Upgrade to Pro'}
                           </Link>
                           <button
                             onClick={handleLogout}
                             className="w-full text-left px-4 py-2 text-sm text-indigo-400 hover:bg-gray-700 hover:text-indigo-300"
                           >
                             Logout
                           </button>

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
              title={selectedDebateSummary?.title || originalDebate?.Overview?.Title}
              onClose={() => setIsSummaryOpen(false)}
            />

            {/* Main Content Area */}
            <div className={`flex-1 overflow-hidden ${isSummaryOpen ? 'pt-2' : ''}`}>
              {chatMode === 'debate' ? (
                <div className="h-full overflow-y-auto">
                  <ChatView
                    ref={chatViewRef} // Assign ref
                    debateId={selectedDebateId}
                    viewMode={viewMode}
                    originalDebateData={originalDebate}
                    isLoadingOriginal={originalDebateState.isLoading}
                    errorOriginal={originalDebateState.error}
                    fetchOriginalDebate={() => originalDebateCache.fetchData(selectedDebateId, fetchOriginalDebateFromAPI)} // Pass fetch function
                    selectedOriginalIndex={selectedOriginalIndex} // Pass state down for panel
                    onBubbleClick={(index) => {
                      console.log(`[page.tsx] Bubble clicked, setting index: ${index}`);
                      setSelectedOriginalIndex(index ?? null); // Set to null if index is undefined
                      // Don't auto-expand the panel, let user decide via the tab
                    }} // Pass handler down
                    searchQuery={currentSearchQuery} // Pass search query
                    highlightedIndex={highlightedIndex} // Pass highlighted item's index
                    onRewrittenDebateUpdate={handleRewrittenDebateUpdate} // Pass stable callback
                    // Pass stream completion handler (if implemented in ChatView)
                    // onStreamComplete={handleStreamComplete}
                  />
                </div>
              ) : (
                <IntegratedChat
                  debateId={selectedDebateId}
                  debateTitle={selectedDebateSummary?.title || originalDebate?.Overview?.Title}
                  setChatMode={setChatMode}
                />
              )}
            </div>

            {/* Original Contribution - visible when an index is selected and in debate mode */}
            {chatMode === 'debate' && selectedOriginalIndex !== null && selectedOriginalItem && (
              <OriginalContribution
                key={`original-panel-${selectedOriginalIndex}`}
                item={selectedOriginalItem}
                selectedOriginalIndex={selectedOriginalIndex}
                onClose={() => {
                  setSelectedOriginalIndex(null);
                  setOriginalPanelHeight(43);
                }}
                originalPanelHeight={originalPanelHeight}
                setOriginalPanelHeight={setOriginalPanelHeight}
                isLoadingOriginal={originalDebateState.isLoading}
                errorOriginal={originalDebateState.error}
              />
            )}

            {/* Chat Input Area - Only show when debate is selected and in debate mode */}
            {selectedDebateId && chatMode === 'debate' && (
              <div className="border-t border-gray-700 bg-[#202c33] p-3 flex-shrink-0">
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={chatInput}
                    onChange={handleChatInputChange}
                    onKeyPress={handleChatInputKeyPress}
                    placeholder="You what, gov?"
                    className="flex-1 bg-[#2a3942] border border-gray-600 rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    disabled={!user && !authLoading}
                  />
                  <button
                    onClick={handleChatInputSubmit}
                    disabled={!user && !authLoading}
                    className={`p-2 rounded-lg text-white transition-colors flex-shrink-0 disabled:opacity-50 disabled:cursor-not-allowed ${
                      chatInput.trim() && user
                        ? 'bg-indigo-600 hover:bg-indigo-700'
                        : 'bg-gray-600 hover:bg-gray-700'
                    }`}
                    title={!user ? "Sign in to ask questions" : chatInput.trim() ? "Send message" : "Start chat"}
                  >
                    {chatInput.trim() && user ? (
                      // Send icon when user has typed something
                      <SendIcon />
                    ) : (
                      // Chat icon for switching to chat mode
                      <ChatIcon />
                    )}
                  </button>
                </div>
                {!user && !authLoading && (
                  <p className="text-xs text-gray-400 mt-2 text-center">
                    <button
                      onClick={() => setIsAuthModalOpen(true)}
                      className="text-indigo-400 hover:text-indigo-300 hover:underline"
                    >
                      Sign in
                    </button>
                    {' '}to ask questions about this debate
                  </p>
                )}
              </div>
            )}

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

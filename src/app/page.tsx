'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Resizable } from 're-resizable'; // Import Resizable

// Import components
import ChatList from '@/components/ChatList';
import ChatView from '@/components/ChatView';
import OriginalContribution from '@/components/OriginalContribution'; // Import new component
import DebateMetadataIcon from '@/components/DebateMetadataIcon'; // Import the icon

// Import types
import { InternalDebateSummary, DebateMetadata } from '@/types';
import { DebateResponse, DebateContentItem } from '@/lib/hansard/types'; // Import necessary types
import { Speech } from '@/components/ChatView'; // Import Speech type

// Icons for view toggle
const CasualIcon = () => <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5"><path fillRule="evenodd" d="M10 2a.75.75 0 0 1 .75.75v.212c.43-.09 1.126-.162 2.008-.162 2.441 0 4.567 1.06 5.871 2.631l.124.152.162.068a.75.75 0 0 1 .64.919l-1.582 6.01a6.012 6.012 0 0 1-5.108 4.394c-.64.13-1.43.203-2.316.203-.885 0-1.676-.073-2.316-.203a6.012 6.012 0 0 1-5.108-4.394l-1.582-6.01a.75.75 0 0 1 .64-.919l.162-.068.124-.152C2.676 3.86 4.8 2.8 7.242 2.8c.882 0 1.578.073 2.008.162V2.75A.75.75 0 0 1 10 2Z" clipRule="evenodd" /></svg>;
const OriginalIcon = () => <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5"><path fillRule="evenodd" d="M4.25 5.5a.75.75 0 0 0 0 1.5h11.5a.75.75 0 0 0 0-1.5H4.25Zm0 4a.75.75 0 0 0 0 1.5h11.5a.75.75 0 0 0 0-1.5H4.25Zm0 4a.75.75 0 0 0 0 1.5h7.5a.75.75 0 0 0 0-1.5h-7.5Z" clipRule="evenodd" /></svg>;

export default function Home() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const chatViewRef = useRef<{ scrollToItem: (index: number) => void }>(null); // Ref for ChatView scrolling

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

  // Ref for the rewritten debate data used in search
  const rewrittenDebateRef = useRef<Speech[] | null>(null);

  // Fetch Original Debate Data (Moved Up)
  const fetchOriginalDebate = useCallback(async (debateId: string | null) => { // Allow null ID
      if (!debateId || originalDebate || isLoadingOriginal) return;

      console.log(`[page.tsx] Fetching ORIGINAL debate ${debateId}`);
      setIsLoadingOriginal(true);
      setErrorOriginal(null);
      try {
        const hansardApiUrl = `/api/hansard/debates/${debateId}`;
        const response = await fetch(hansardApiUrl);
        if (!response.ok) {
          let errorMsg = `Original fetch failed: ${response.status}`;
          try { const errorData = await response.json(); errorMsg = errorData.error || errorData.message || errorMsg; } catch (e) {}
          throw new Error(errorMsg);
        }
        const data: DebateResponse = await response.json();
        setOriginalDebate(data);
      } catch (e: any) {
        console.error(`[page.tsx] Failed fetch original ${debateId}:`, e);
        setErrorOriginal(`Failed load original: ${e.message}`);
      } finally {
        setIsLoadingOriginal(false);
      }
    }, [originalDebate, isLoadingOriginal]);

  // Fetch Metadata for Selected Debate
  const fetchSelectedDebateMetadata = useCallback(async (debateId: string) => {
      console.log(`[page.tsx] Fetching METADATA for debate ${debateId}`);
      setIsLoadingMetadata(true);
      setErrorMetadata(null);
      setSelectedDebateMetadata(null); // Clear previous metadata
      try {
          const response = await fetch(`/api/hansard/debates/${debateId}/metadata`);
          if (!response.ok) {
              let errorMsg = `Metadata fetch failed: ${response.status}`;
              try { const errorData = await response.json(); errorMsg = errorData.error || errorMsg; } catch (e) { }
              throw new Error(errorMsg);
          }
          const metadata: DebateMetadata = await response.json(); // Assuming API returns DebateMetadata directly
          setSelectedDebateMetadata(metadata);
      } catch (e: any) {
          console.error(`[page.tsx] Failed fetch metadata ${debateId}:`, e);
          setErrorMetadata(e.message || 'Failed to load metadata');
      } finally {
          setIsLoadingMetadata(false);
      }
  }, []);

  // Effect to sync selectedDebateId from URL, reset state, and fetch data
  useEffect(() => {
    const debateIdFromUrl = searchParams.get('debateId');

    if (debateIdFromUrl) {
        // Check if the ID from URL is different from the current state
        if (debateIdFromUrl !== selectedDebateId) {
             console.log(`[useEffect] Detected ID change: ${selectedDebateId} -> ${debateIdFromUrl}`);
             // Set the new ID
             setSelectedDebateId(debateIdFromUrl);

             // Reset ALL other relevant states immediately
             setSelectedDebateSummary(null); // Will be updated by ChatList or fetched if needed
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
             // Don't fetch here, fetch below *after* state is potentially set
        }
        // Always fetch data if a valid ID is present in the URL
        // Fetch functions have internal checks to prevent redundant calls if data exists
        console.log(`[useEffect] Triggering fetches for ID: ${debateIdFromUrl}`);
        fetchOriginalDebate(debateIdFromUrl);
        fetchSelectedDebateMetadata(debateIdFromUrl);

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
        }
    }
    // Dependencies: Run when URL changes or the selected ID state changes.
    // fetchOriginalDebate and fetchSelectedDebateMetadata are stable due to useCallback.
  }, [searchParams, selectedDebateId, fetchOriginalDebate, fetchSelectedDebateMetadata]);

  // Fetch Original Debate Data
  const fetchOriginalDebateData = useCallback(async (debateId: string | null) => {
    if (!debateId || originalDebate || isLoadingOriginal) return;

    console.log(`[page.tsx] Fetching ORIGINAL debate ${debateId}`);
    setIsLoadingOriginal(true);
    setErrorOriginal(null);
    try {
      const hansardApiUrl = `/api/hansard/debates/${debateId}`;
      const response = await fetch(hansardApiUrl);
      if (!response.ok) {
        let errorMsg = `Original fetch failed: ${response.status}`;
        try { const errorData = await response.json(); errorMsg = errorData.error || errorData.message || errorMsg; } catch (e) {}
        throw new Error(errorMsg);
      }
      const data: DebateResponse = await response.json();
      setOriginalDebate(data);
    } catch (e: any) {
      console.error(`[page.tsx] Failed fetch original ${debateId}:`, e);
      setErrorOriginal(`Failed load original: ${e.message}`);
    } finally {
      setIsLoadingOriginal(false);
    }
  }, [originalDebate, isLoadingOriginal]);

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

  // Calculate the selected original item based on state here
  const selectedOriginalItem = (selectedOriginalIndex !== null && originalDebate?.Items)
      ? originalDebate.Items.find(item => item.OrderInSection === selectedOriginalIndex)
      : null;

  // Calculate the index of the currently highlighted search result
  const highlightedIndex = currentMatchIndex !== -1 ? searchResults[currentMatchIndex] : null;

  return (
    <main className="flex h-screen w-screen bg-[#111b21] text-white overflow-hidden relative">
      {/* Sidebar - Hidden on mobile if a chat is selected */}
      <div
        className={`
          ${selectedDebateId ? 'hidden md:flex' : 'flex'}
          w-full md:w-2/5 border-r border-gray-700 flex-col bg-[#111b21]
        `}
      >
        <ChatList
          onSelectDebate={handleSelectDebate}
          selectedDebateId={selectedDebateId}
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
                         ...selectedDebateMetadata,
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
                     {/* View Mode Toggle Button */}
                     <button
                       onClick={handleToggleViewMode}
                       className={`flex items-center gap-1 p-1 sm:p-2 rounded-md text-xs sm:text-sm transition-colors ${viewMode === 'rewritten' ? 'bg-teal-600 text-white hover:bg-teal-700' : 'bg-[#111b21] text-gray-400 hover:bg-gray-700 hover:text-gray-200'}`}
                       disabled={!selectedDebateId}
                       title={`Switch to ${viewMode === 'rewritten' ? 'Original' : 'Casual'} view`}
                     >
                       {viewMode === 'rewritten' ? <CasualIcon /> : <OriginalIcon />}
                       <span className="hidden sm:inline">
                           {viewMode === 'rewritten' ? 'Casual' : 'Original'}
                       </span>
                     </button>

                     {/* Search Icon */}
                     <button
                       onClick={() => setIsSearchOpen(true)}
                       className="p-2 rounded-full hover:bg-gray-700 text-gray-400 hover:text-gray-200"
                       title="Search debate"
                       disabled={!selectedDebateId}
                     >
                         <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5"><path fillRule="evenodd" d="M9 3.5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11ZM2 9a7 7 0 1 1 12.452 4.391l3.328 3.329a.75.75 0 1 1-1.06 1.06l-3.329-3.328A7 7 0 0 1 2 9Z" clipRule="evenodd" /></svg>
                     </button>

                     {/* More Options Icon
                     <button className="p-2 rounded-full hover:bg-gray-700 text-gray-400 hover:text-gray-200" title="More options">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5"><path d="M10 3.75a1.25 1.25 0 1 1 0 2.5 1.25 1.25 0 0 1 0-2.5ZM10 8.75a1.25 1.25 0 1 1 0 2.5 1.25 1.25 0 0 1 0-2.5ZM10 13.75a1.25 1.25 0 1 1 0 2.5 1.25 1.25 0 0 1 0-2.5Z" /></svg>
                     </button> */}
                   </div>
                 </>
               )}
            </header>

            {/* ChatView Wrapper (handles scrolling) */}
            <div className="flex-1 overflow-y-auto">
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
                onRewrittenDebateUpdate={(speeches) => { // Callback to get current rewritten speeches
                    rewrittenDebateRef.current = speeches;
                    // Optionally trigger search re-run if needed during streaming,
                    // but current useEffect handles data changes already.
                }}
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
            <footer className="p-3 border-t border-gray-700 bg-[#202c33] flex items-center gap-3 flex-shrink-0 z-10">
              <input type="text" placeholder="Type a message (read-only view)" className="flex-grow p-2 rounded-md bg-[#2a3942] text-gray-300 placeholder-gray-500 focus:outline-none" disabled />
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6 text-gray-400 cursor-pointer hover:text-gray-200"><path d="M8.25 4.5a3.75 3.75 0 1 1 7.5 0v8.25a3.75 3.75 0 1 1-7.5 0V4.5Z" /><path d="M6 10.5a.75.75 0 0 1 .75.75v1.5a5.25 5.25 0 1 0 10.5 0v-1.5a.75.75 0 0 1 1.5 0v1.5a6.751 6.751 0 0 1-6 6.709v2.041h3a.75.75 0 0 1 0 1.5h-7.5a.75.75 0 0 1 0-1.5h3v-2.041a6.751 6.751 0 0 1-6-6.709v-1.5A.75.75 0 0 1 6 10.5Z" /></svg>
            </footer>

          </>
        ) : (
          // Placeholder when no debate is selected - This div will be hidden on mobile by parent logic
          <div className="flex flex-col items-center justify-center h-full text-gray-400">
            <div className="text-center bg-[#0b141a] bg-opacity-80 p-10 rounded-lg">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-20 h-20 text-gray-500 mx-auto opacity-50"><path strokeLinecap="round" strokeLinejoin="round" d="M8.625 9.75a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H8.25m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H12m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0h-.375M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 15.75h-7.5"/></svg>
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

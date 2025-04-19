'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Resizable } from 're-resizable'; // Import Resizable

// Import components
import ChatList from '@/components/ChatList';
import ChatView from '@/components/ChatView';
import OriginalContribution from '@/components/OriginalContribution'; // Import new component

// Import types
import { InternalDebateSummary } from '@/types';
import { DebateResponse, DebateContentItem } from '@/lib/hansard/types'; // Import necessary types

export default function Home() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Chat List state
  const [selectedDebateId, setSelectedDebateId] = useState<string | null>(null);
  const [selectedDebateSummary, setSelectedDebateSummary] = useState<InternalDebateSummary | null>(null);

  // View Mode state
  const [viewMode, setViewMode] = useState<'rewritten' | 'original'>('rewritten');

  // Original Debate data state
  const [originalDebate, setOriginalDebate] = useState<DebateResponse | null>(null);
  const [isLoadingOriginal, setIsLoadingOriginal] = useState(false);
  const [errorOriginal, setErrorOriginal] = useState<string | null>(null);

  // Resizable Panel state
  const [selectedOriginalIndex, setSelectedOriginalIndex] = useState<number | null>(null); // Moved from ChatView
  const [originalPanelHeight, setOriginalPanelHeight] = useState(192); // Moved from ChatView, default height (12rem)


  // Effect to sync selectedDebateId from URL
  useEffect(() => {
    const debateIdFromUrl = searchParams.get('debateId');
    if (debateIdFromUrl && debateIdFromUrl !== selectedDebateId) {
      console.log(`Setting selectedDebateId from URL: ${debateIdFromUrl}`);
      setSelectedDebateId(debateIdFromUrl);
      // Reset summary and panel state if ID changes from URL
      setSelectedDebateSummary(null);
      setSelectedOriginalIndex(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  // Fetch Original Debate Data
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

  // Handle selecting a debate from the list
  const handleSelectDebate = useCallback((debate: InternalDebateSummary) => {
    console.log(`Debate selected: ${debate.id} - Title: ${debate.title}`);
    setSelectedDebateId(debate.id);
    setSelectedDebateSummary(debate);
    setOriginalDebate(null);
    setErrorOriginal(null);
    setIsLoadingOriginal(false);
    setSelectedOriginalIndex(null); // Close panel when changing debate
    setViewMode('rewritten'); // Reset view mode

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


  // Handler for toggling the view mode
  const handleToggle = useCallback((mode: 'rewritten' | 'original') => {
      if (mode === 'original' && selectedDebateId && !originalDebate && !isLoadingOriginal) {
          fetchOriginalDebate(selectedDebateId);
      }
      setViewMode(mode);
  }, [selectedDebateId, originalDebate, isLoadingOriginal, fetchOriginalDebate]);

  // Calculate the selected original item based on state here
  const selectedOriginalItem = (selectedOriginalIndex !== null && originalDebate?.Items)
      ? originalDebate.Items.find(item => item.OrderInSection === selectedOriginalIndex)
      : null;

  return (
    <main className="flex h-screen w-screen bg-[#111b21] text-white overflow-hidden relative">
      {/* Sidebar */}
      <div className="w-full md:w-1/3 lg:w-1/4 border-r border-gray-700 flex flex-col bg-[#111b21]">
        <ChatList
          onSelectDebate={handleSelectDebate}
          selectedDebateId={selectedDebateId}
        />
      </div>

      {/* Main Chat View Area (takes remaining space, relative positioning for overlay) */}
      <div className="flex-grow flex flex-col bg-[#0b141a] overflow-hidden relative" style={{backgroundImage: "url('/whatsapp-bg.png')", backgroundSize: 'contain', backgroundPosition: 'center'}}>
        {selectedDebateId ? (
          <>
            {/* Header */}
            <header className="p-3 flex items-center justify-between border-b border-gray-700 bg-[#202c33] flex-shrink-0 z-10">
               {/* Left Side */}
               <div className="flex items-center gap-3">
                 <div className="w-10 h-10 bg-gray-500 rounded-full"></div>
                 <div className="flex flex-col">
                   <h2 className="text-md font-semibold text-gray-100 truncate" title={selectedDebateSummary?.title || 'Loading...'}>
                     {selectedDebateSummary?.title || 'Loading...'}
                   </h2>
                   <span className="text-xs text-gray-400">
                     {selectedDebateSummary?.house || '...'}
                   </span>
                 </div>
               </div>
               {/* Center Toggle */}
               <div className="flex items-center space-x-1 p-1 bg-[#111b21] rounded-lg flex-shrink-0 mx-4">
                    <button onClick={() => handleToggle('rewritten')} className={`px-3 py-1 rounded-md text-xs sm:text-sm transition-colors ${viewMode === 'rewritten' ? 'bg-teal-600 text-white' : 'bg-transparent text-gray-400 hover:bg-gray-700 hover:text-gray-200'}`} disabled={!selectedDebateId}>Casual</button>
                    <button onClick={() => handleToggle('original')} className={`px-3 py-1 rounded-md text-xs sm:text-sm transition-colors ${viewMode === 'original' ? 'bg-teal-600 text-white' : 'bg-transparent text-gray-400 hover:bg-gray-700 hover:text-gray-200'}`} disabled={!selectedDebateId}>Original</button>
               </div>
               {/* Right Icons */}
               <div className="flex gap-4 text-gray-400 flex-shrink-0">
                 <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6 cursor-pointer hover:text-gray-200"><path fillRule="evenodd" d="M10.5 3.75a6.75 6.75 0 1 0 0 13.5 6.75 6.75 0 0 0 0-13.5ZM2.25 10.5a8.25 8.25 0 1 1 14.59 5.28l4.69 4.69a.75.75 0 1 1-1.06 1.06l-4.69-4.69A8.25 8.25 0 0 1 2.25 10.5Z" clipRule="evenodd" /></svg>
                 <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6 cursor-pointer hover:text-gray-200"><path fillRule="evenodd" d="M10.5 6a1.5 1.5 0 1 1 3 0 1.5 1.5 0 0 1-3 0Zm0 6a1.5 1.5 0 1 1 3 0 1.5 1.5 0 0 1-3 0Zm0 6a1.5 1.5 0 1 1 3 0 1.5 1.5 0 0 1-3 0Z" clipRule="evenodd" /></svg>
               </div>
            </header>

            {/* ChatView Wrapper (handles scrolling) */}
            <div className="flex-1 overflow-y-auto">
              <ChatView
                debateId={selectedDebateId}
                viewMode={viewMode}
                originalDebateData={originalDebate}
                isLoadingOriginal={isLoadingOriginal}
                errorOriginal={errorOriginal}
                fetchOriginalDebate={() => fetchOriginalDebate(selectedDebateId)} // Pass fetch function
                selectedOriginalIndex={selectedOriginalIndex} // Pass state down
                onBubbleClick={handleBubbleClick} // Pass handler down
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
          // Placeholder when no debate is selected
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

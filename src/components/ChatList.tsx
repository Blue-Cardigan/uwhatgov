'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { InternalDebateSummary, DebateMetadata } from '@/types';
// Import Hansard API types
import { SearchResult, DebateSummary } from '@/lib/hansard/types';
import DebateMetadataIcon from './DebateMetadataIcon'; // Import the new icon component
import { DebateMetadataResponse } from '@/app/api/hansard/debates/[debateId]/metadata/route'; // Import response type

interface ChatListProps {
  onSelectDebate: (debateSummary: InternalDebateSummary) => void;
  selectedDebateId: string | null;
}

export default function ChatList({ onSelectDebate, selectedDebateId }: ChatListProps) {
  const [debates, setDebates] = useState<InternalDebateSummary[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastSittingDate, setLastSittingDate] = useState<string | null>(null);
  const [oldestDateLoaded, setOldestDateLoaded] = useState<string | null>(null);
  const [canLoadMore, setCanLoadMore] = useState(true);
  const [metadataCache, setMetadataCache] = useState<Record<string, DebateMetadata>>({});
  const observedItemsRef = useRef<Map<string, IntersectionObserverEntry>>(new Map());
  const observerRef = useRef<IntersectionObserver | null>(null);
  const itemRefs = useRef<Map<string, HTMLDivElement | null>>(new Map());

  // Helper to format date string
  const formatDate = (isoDateString: string) => {
      try {
          return isoDateString.split('T')[0]; // Extract YYYY-MM-DD
      } catch {
          return isoDateString; // Fallback
      }
  };

  const fetchLastSittingDate = async () => {
    try {
      const response = await fetch('/api/hansard/last-sitting-date');
      const data = await response.json();
      setLastSittingDate(data.lastSittingDate);
    } catch (error) {
      console.error('Error fetching last sitting date:', error);
    }
  };

  // Fetch debates for a specific date and append results
  const fetchDebates = useCallback(async (date: string) => {
    if (!date) return;
    setIsLoading(true);
    setError(null);
    // Fetch debates for a single day
    const url = `/api/hansard/search?startDate=${date}&endDate=${date}`;
    console.log(`Fetching debates for date: ${date} from: ${url}`);
    try {
      const response = await fetch(url);
      if (!response.ok) {
        const errorText = await response.text(); // Get raw error text
        console.error('Hansard API Error Response:', errorText);
        throw new Error(`HTTP error! status: ${response.status} - ${errorText.substring(0, 100)}`);
      }
      const data: SearchResult = await response.json();

      // Map DebateSummary to InternalDebateSummary
      const mappedDebates: InternalDebateSummary[] = data.Debates.map((debate: DebateSummary) => ({
        id: debate.DebateSectionExtId,
        title: debate.Title || debate.DebateSection, // Use Title if available, fallback to DebateSection
        date: formatDate(debate.SittingDate),
        house: debate.House,
        // match: TBD - Need to see if search API provides snippets
      }));

      // Append new debates to the existing list
      setDebates(prevDebates => [...prevDebates, ...mappedDebates].sort((a, b) => b.date.localeCompare(a.date)));
      setOldestDateLoaded(date); // Update the oldest date successfully loaded

      // If we received fewer debates than expected (e.g., 0), assume we can't load more for now.
      // This is a basic check; a more robust API might indicate if more pages exist.
      if (mappedDebates.length === 0) {
         // Optional: Maybe show a message 'No debates for this day'?
         // For now, just disable loading more if a day has no debates
         // setCanLoadMore(false); // Re-evaluate this logic. Maybe allow skipping empty days.
      }

    } catch (e: any) {
      console.error(`Failed to fetch debates for ${date}:`, e);
      setError(`Failed to load debates for ${date}: ${e.message}`);
      setCanLoadMore(false); // Stop trying if there's an error
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Function to fetch metadata for a specific debate ID
  const fetchMetadata = useCallback(async (debateId: string) => {
    // Avoid fetching if already cached or currently loading
    if (metadataCache[debateId]?.isLoading || metadataCache[debateId]?.partyRatios) {
        // console.log(`[Metadata ${debateId}] Skipping fetch (loading or cached).`);
        return;
    }

    // Mark as loading
    setMetadataCache(prev => ({ ...prev, [debateId]: { ...(prev[debateId]), isLoading: true, error: null } }));
    console.log(`[Metadata ${debateId}] Fetching...`);

    try {
        const response = await fetch(`/api/hansard/debates/${debateId}/metadata`);
        if (!response.ok) {
            let errorMsg = `Metadata fetch failed: ${response.status}`;
            try { const errorData = await response.json(); errorMsg = errorData.error || errorMsg; } catch (e) { }
            throw new Error(errorMsg);
        }
        const metadata: DebateMetadataResponse = await response.json();
        setMetadataCache(prev => ({
            ...prev,
            [debateId]: { ...metadata, isLoading: false, error: null }
        }));
        console.log(`[Metadata ${debateId}] Success.`);
    } catch (e: any) {
        console.error(`[Metadata ${debateId}] Failed:`, e);
        setMetadataCache(prev => ({
            ...prev,
            [debateId]: { ...(prev[debateId]), isLoading: false, error: e.message || 'Failed to load' }
        }));
    }
  }, [metadataCache]); // Depend on metadataCache

  // Fetch last sitting date on mount
  useEffect(() => {
    fetchLastSittingDate();
  }, []);

  // Fetch initial debates when lastSittingDate is available
  useEffect(() => {
    if (lastSittingDate && !oldestDateLoaded) {
      fetchDebates(lastSittingDate);
    }
  }, [lastSittingDate, fetchDebates, oldestDateLoaded]);

  // --- Search Functionality (Clears existing debates) ---
  const handleSearch = (event: React.FormEvent) => {
    event.preventDefault();
    console.log('Searching for:', searchTerm);
    setDebates([]); // Clear existing debates on new search
    setOldestDateLoaded(null); // Reset oldest date on new search
    setCanLoadMore(false); // Disable loading more during search results view
    const searchUrl = `/api/hansard/search?query=${encodeURIComponent(searchTerm)}`;
    // Re-use fetchDebates structure but don't append, replace.
    // Or create a dedicated search fetch function?
    // For now, let's modify fetchDebates slightly or adapt the logic here.

    // Simplified search fetch (replaces, doesn't use pagination date)
    const searchFetch = async () => {
        setIsLoading(true);
        setError(null);
        console.log(`Fetching search results from: ${searchUrl}`);
        try {
            const response = await fetch(searchUrl);
            if (!response.ok) {
                const errorText = await response.text();
                console.error('Hansard API Search Error Response:', errorText);
                throw new Error(`HTTP error! status: ${response.status} - ${errorText.substring(0, 100)}`);
            }
            const data: SearchResult = await response.json();
            const mappedDebates: InternalDebateSummary[] = data.Debates.map((debate: DebateSummary) => ({
                id: debate.DebateSectionExtId,
                title: debate.Title || debate.DebateSection,
                date: formatDate(debate.SittingDate),
                house: debate.House,
            }));
            setDebates(mappedDebates);
            setMetadataCache({}); // Clear metadata on new search
        } catch (e: any) {
            console.error(`Failed to fetch search results from ${searchUrl}:`, e);
            setError(`Search failed: ${e.message}`);
            setMetadataCache({}); // Clear metadata on new search
        } finally {
            setIsLoading(false);
        }
    };
    searchFetch();
  };

  // --- Pagination --- Get previous day in YYYY-MM-DD format
  const getPreviousDay = (dateString: string): string => {
    const date = new Date(dateString);
    date.setDate(date.getDate() - 1);
    return date.toISOString().split('T')[0];
  };

  const handleLoadPreviousDay = () => {
    if (!oldestDateLoaded || isLoading) return;
    const previousDay = getPreviousDay(oldestDateLoaded);
    fetchDebates(previousDay);
  };

  // --- Infinite Scroll Logic ---
  const observerTarget = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        // Check if the target is intersecting and we are not loading, can load more, and not in search mode
        if (entries[0].isIntersecting && !isLoading && canLoadMore && !searchTerm) {
          console.log('Sentinel visible, loading previous day...');
          handleLoadPreviousDay();
        }
      },
      { threshold: 1.0 } // Trigger when the element is fully visible
    );

    const currentTarget = observerTarget.current;
    if (currentTarget) {
      observer.observe(currentTarget);
    }

    // Cleanup observer on component unmount or dependency change
    return () => {
      if (currentTarget) {
        observer.unobserve(currentTarget);
      }
    };
    // Re-run observer setup if loading state, ability to load more, or search term changes
    // Also depends on handleLoadPreviousDay potentially changing if its deps change
  }, [isLoading, canLoadMore, handleLoadPreviousDay, searchTerm]);

  // Use a single observer for all items
  useEffect(() => {
      observerRef.current = new IntersectionObserver((entries) => {
          entries.forEach(entry => {
              const debateId = (entry.target as HTMLElement).dataset.debateId;
              if (debateId) {
                  if (entry.isIntersecting) {
                      observedItemsRef.current.set(debateId, entry);
                      // Fetch metadata when item becomes visible
                      fetchMetadata(debateId);
                  } else {
                      observedItemsRef.current.delete(debateId);
                  }
              }
          });
      }, { rootMargin: '200px 0px', threshold: 0.01 }); // Fetch slightly before fully visible

      const currentObserver = observerRef.current;

      // Re-observe items when debates change
      itemRefs.current.forEach(el => {
          if (el) currentObserver.observe(el);
      });

      return () => {
          itemRefs.current.forEach(el => {
              if (el) currentObserver.unobserve(el);
          });
          currentObserver.disconnect();
          observerRef.current = null;
      };
  }, [debates, fetchMetadata]); // Re-run if debates or fetchMetadata changes

  // Function to set ref for each item
  const setItemRef = (debateId: string, element: HTMLDivElement | null) => {
      if (element) {
          itemRefs.current.set(debateId, element);
          // Observe new elements as they are added
          if (observerRef.current) {
              observerRef.current.observe(element);
          }
      } else {
          // Clean up ref and observer if element is removed
          if (observerRef.current) {
              const existingEl = itemRefs.current.get(debateId);
              if (existingEl) observerRef.current.unobserve(existingEl);
          }
          itemRefs.current.delete(debateId);
      }
  };

  return (
    <div className="flex flex-col h-full bg-[#111b21]">
      {/* Search Bar */}
      <div className="p-2 bg-[#202c33]">
        <form onSubmit={handleSearch} className="flex gap-2">
          <input
            type="text"
            placeholder="Search debates..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="flex-grow p-2 rounded-md bg-[#2a3942] text-gray-300 placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
          />
          {/* Consider adding a search icon button */}
        </form>
      </div>

      {/* Debate List */}
      <div className="flex-grow overflow-y-auto divide-y divide-gray-700">
        {/* Show initial loading indicator centrally */}
        {isLoading && debates.length === 0 && <p className="p-4 text-center text-gray-400">Loading...</p>}
        {error && <p className="p-4 text-center text-red-500">Error: {error}</p>}
        {!isLoading && !error && debates.length === 0 && (
          <p className="p-4 text-center text-gray-400">No debates found for the selected criteria.</p>
        )}
        {/* Debate Items */}
        {debates.map((debate) => {
          const isSelected = debate.id === selectedDebateId; // Check if this debate is selected
          return (
              <div
                ref={(el) => setItemRef(debate.id, el)}
                data-debate-id={debate.id}
                key={debate.id}
                onClick={() => onSelectDebate(debate)}
                className={`p-3 cursor-pointer transition-colors duration-150 flex items-center gap-3 ${isSelected ? 'bg-teal-800' : 'hover:bg-[#2a3942]'}`}
              >
                {/* Placeholder for Avatar/Icon */}
                <DebateMetadataIcon metadata={metadataCache[debate.id]} />
                <div className="flex-grow overflow-hidden">
                  <div className="flex justify-between items-center mb-1">
                    <h3 className="font-semibold text-gray-100 truncate" title={debate.title}>{debate.title}</h3>
                    <span className="text-xs text-gray-400 whitespace-nowrap ml-2">{debate.date}</span>
                  </div>
                  <div className="text-sm text-gray-400 truncate flex justify-between">
                     <span>{debate.house}</span>
                     <span className="flex items-center gap-2 text-xs whitespace-nowrap ml-2">
                        {metadataCache[debate.id]?.location && (
                           <span title="Location">{metadataCache[debate.id]?.location}</span>
                        )}
                        {typeof metadataCache[debate.id]?.contributionCount === 'number' && (
                           <span title="Contributions">({metadataCache[debate.id]?.contributionCount})</span>
                        )}
                     </span>
                  </div>
                  {/* Uncomment if you want to show the match snippet in the list */}
                  {/* {debate.match && (
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400 italic truncate">...{debate.match}...</p>
                  )} */}
                </div>
              </div>
          );
        })}

        {/* Loading More Indicator (at the bottom) */}
        {isLoading && debates.length > 0 && <p className="p-4 text-center text-gray-400">Loading more...</p>}

        {/* Load More Button */}
        {!isLoading && !error && canLoadMore && debates.length > 0 && (
          <div className="p-4 text-center">
            <button
              onClick={handleLoadPreviousDay}
              disabled={isLoading}
              className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-md disabled:opacity-50 transition-colors"
            >
              Load Previous Day's Debates
            </button>
          </div>
        )}

        {/* Sentinel Element for Intersection Observer */}
        {!isLoading && canLoadMore && !searchTerm && debates.length > 0 && (
           <div ref={observerTarget} style={{ height: '1px' }} />
        )}

      </div>
    </div>
  );
} 
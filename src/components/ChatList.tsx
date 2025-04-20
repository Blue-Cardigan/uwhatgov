'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { InternalDebateSummary, DebateMetadata } from '@/types';
// Import Hansard API types
import { SearchResult, DebateSummary } from '@/lib/hansard/types';
import DebateMetadataIcon from './DebateMetadataIcon'; // Import the new icon component
import { getTodayDateString, formatDate, getPreviousDay } from '@/utils/dateUtils'; // Import date utils

// localStorage Key for Daily Debates Cache
const DEBATES_CACHE_PREFIX = 'uwhatgov_debates_';

interface ChatListProps {
  onSelectDebate: (debateSummary: InternalDebateSummary) => void;
  selectedDebateId: string | null;
  allMetadata: Record<string, DebateMetadata>;
  fetchMetadata: (id: string) => void; // Renamed from onItemVisible for clarity
  onDeleteDebate: (id: string) => void; // Add the new prop
}

export default function ChatList({ onSelectDebate, selectedDebateId, allMetadata, fetchMetadata, onDeleteDebate }: ChatListProps) {
  const [debates, setDebates] = useState<InternalDebateSummary[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true); // Initially true until first load attempt
  const [error, setError] = useState<string | null>(null);
  const [lastSittingDate, setLastSittingDate] = useState<string | null>(null);
  const [oldestDateLoaded, setOldestDateLoaded] = useState<string | null>(null);
  const [canLoadMore, setCanLoadMore] = useState(true);
  const observedItemsRef = useRef<Map<string, IntersectionObserverEntry>>(new Map());
  const observerRef = useRef<IntersectionObserver | null>(null);
  const itemRefs = useRef<Map<string, HTMLDivElement | null>>(new Map());

  // --- Filter State ---
  const [startDateFilter, setStartDateFilter] = useState('');
  const [endDateFilter, setEndDateFilter] = useState('');
  const [houseFilter, setHouseFilter] = useState(''); // 'Commons', 'Lords', or '' for both
  const [isSearchActive, setIsSearchActive] = useState(false); // Track if search/filters are active
  const [showFilters, setShowFilters] = useState(false); // State to control filter dropdown visibility

  const fetchLastSittingDate = async () => {
    try {
      const response = await fetch('/api/hansard/last-sitting-date');
      const data = await response.json();
      setLastSittingDate(data.lastSittingDate);
    } catch (error) {
      console.error('Error fetching last sitting date:', error);
      // Don't set loading false here, let the debate fetch handle it
    }
  };

  // Fetch debates for a specific date, incorporating localStorage caching
  const fetchDebates = useCallback(async (date: string, isInitialLoad = false) => {
    if (!date) {
        if (isInitialLoad) setIsLoading(false); // Stop initial loading if no date
        return;
    }

    const cacheKey = DEBATES_CACHE_PREFIX + date;
    setIsLoading(true); // Set loading true for any fetch attempt (cache or API)
    setError(null);

    // 1. Check localStorage cache
    try {
        const cachedData = localStorage.getItem(cacheKey);
        if (cachedData) {
            console.log(`[ChatList] Cache HIT for debates on ${date}`);
            const parsedDebates: InternalDebateSummary[] = JSON.parse(cachedData);
            // Append cached debates, ensuring no duplicates and sort
            setDebates(prevDebates => {
                const existingIds = new Set(prevDebates.map(d => d.id));
                const newUniqueDebates = parsedDebates.filter(d => !existingIds.has(d.id));
                return [...prevDebates, ...newUniqueDebates].sort((a, b) => b.date.localeCompare(a.date));
            });
            setOldestDateLoaded(date);
            setIsLoading(false); // Loading finished (from cache)
            return; // Exit if cache hit
        }
    } catch (e) {
        console.error(`[ChatList] Error reading/parsing localStorage for ${cacheKey}:`, e);
        localStorage.removeItem(cacheKey); // Clear potentially corrupted item
    }

    // 2. Fetch from API if cache miss
    console.log(`[ChatList] Cache MISS. Fetching debates for date: ${date} from API`);
    const url = `/api/hansard/search?startDate=${date}&endDate=${date}`;
    try {
      const response = await fetch(url);
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[ChatList] Hansard API Error Response (${date}):`, errorText);
        throw new Error(`HTTP error! status: ${response.status} - ${errorText.substring(0, 100)}`);
      }
      const data: SearchResult = await response.json();

      const mappedDebates: InternalDebateSummary[] = data.Debates.map((debate: DebateSummary) => ({
        id: debate.DebateSectionExtId,
        title: debate.Title || debate.DebateSection,
        date: formatDate(debate.SittingDate),
        house: debate.House,
      }));

      // Store in localStorage on successful fetch
      try {
          localStorage.setItem(cacheKey, JSON.stringify(mappedDebates));
      } catch (e) {
          console.error(`[ChatList] Error writing to localStorage for ${cacheKey}:`, e);
          // Consider localStorage quota limits or other issues
      }

      // Append new debates, ensuring no duplicates and sort
      setDebates(prevDebates => {
          const existingIds = new Set(prevDebates.map(d => d.id));
          const newUniqueDebates = mappedDebates.filter(d => !existingIds.has(d.id));
          return [...prevDebates, ...newUniqueDebates].sort((a, b) => b.date.localeCompare(a.date));
      });
      setOldestDateLoaded(date);

      if (mappedDebates.length === 0) {
          // No debates found for this day, still potentially load more from previous days
          console.log(`[ChatList] No debates found for ${date}.`);
      }

    } catch (e: any) {
      console.error(`[ChatList] Failed to fetch debates for ${date}:`, e);
      setError(`Failed to load debates for ${date}: ${e.message}`);
      setCanLoadMore(false);
    } finally {
      setIsLoading(false); // Loading finished (API fetch attempt)
    }
  }, []); // Removed dependencies - fetchDebates now relies only on its args

  // Fetch last sitting date on mount
  useEffect(() => {
    fetchLastSittingDate();
  }, []);

  // Fetch initial debates - Tries cache first for lastSittingDate, then API
  useEffect(() => {
    // Only run if lastSittingDate is known, no debates loaded yet, and not searching
    if (lastSittingDate && debates.length === 0 && !isSearchActive) {
        console.log(`[ChatList] Attempting initial load for lastSittingDate: ${lastSittingDate}`);
        // Pass true for isInitialLoad to handle loading state correctly if date is missing
        fetchDebates(lastSittingDate, true);
    }
     // If lastSittingDate is null after fetch attempt, stop initial loading
    else if (!lastSittingDate && !isLoading && debates.length === 0) {
         console.log("[ChatList] No last sitting date found, stopping initial load.");
         setIsLoading(false);
    }
  }, [lastSittingDate, fetchDebates, isSearchActive, debates.length, isLoading]); // Add isLoading and debates.length

  // --- Search Functionality (Uses searchTerm and filters) ---
  // NOTE: Search bypasses the daily cache, fetching directly from the API based on criteria.
  // Caching search results is complex and not implemented here.
  const handleSearch = useCallback(async (event?: React.FormEvent) => {
    if (event) event.preventDefault();

    // Only search if there's a term or filters are applied
    if (!searchTerm && !startDateFilter && !endDateFilter && !houseFilter) {
        // Clearing search/filters: Reset to initial state and fetch latest
        setIsSearchActive(false);
        setDebates([]);
        setOldestDateLoaded(null);
        setCanLoadMore(true);
        setError(null);
        // Trigger fetch for the last sitting date (will use cache if available)
        if (lastSittingDate) {
            console.log("[ChatList] Clearing search, fetching latest debates...");
            fetchDebates(lastSittingDate, true); // Treat as an initial load
        } else {
            setIsLoading(false); // Ensure loading stops if no last date
        }
        return;
    }

    console.log('[ChatList] Searching with criteria:', { searchTerm, startDateFilter, endDateFilter, houseFilter });
    setIsSearchActive(true);
    setDebates([]);
    setOldestDateLoaded(null);
    setCanLoadMore(false); // Disable scroll-loading during search
    setIsLoading(true);
    setError(null);

    const params = new URLSearchParams();
    if (searchTerm) params.append('searchTerm', searchTerm);
    if (startDateFilter) params.append('startDate', startDateFilter);
    if (endDateFilter) params.append('endDate', endDateFilter);
    if (houseFilter) params.append('house', houseFilter);

    const searchUrl = `/api/hansard/search?${params.toString()}`;

    console.log(`[ChatList] Fetching search results from: ${searchUrl}`);
    try {
        const response = await fetch(searchUrl);
        if (!response.ok) {
            const errorText = await response.text();
            console.error('[ChatList] Hansard API Search Error Response:', errorText);
            throw new Error(`HTTP error! status: ${response.status} - ${errorText.substring(0, 100)}`);
        }
        const data: SearchResult = await response.json();
        const uniqueDebates = new Map<string, InternalDebateSummary>();

        if (data.Contributions) {
            data.Contributions.forEach(contribution => {
                if (contribution.DebateSectionExtId && !uniqueDebates.has(contribution.DebateSectionExtId)) {
                    uniqueDebates.set(contribution.DebateSectionExtId, {
                        id: contribution.DebateSectionExtId,
                        title: contribution.DebateSection || 'Contribution Section',
                        date: formatDate(contribution.SittingDate),
                        house: contribution.House,
                    });
                }
            });
        }

        if (data.Debates) {
             data.Debates.forEach(debate => {
                 if (debate.DebateSectionExtId) {
                     uniqueDebates.set(debate.DebateSectionExtId, {
                         id: debate.DebateSectionExtId,
                         title: debate.Title || debate.DebateSection,
                         date: formatDate(debate.SittingDate),
                         house: debate.House,
                     });
                 }
             });
        }

        const combinedDebates = Array.from(uniqueDebates.values())
                                     .sort((a, b) => b.date.localeCompare(a.date));

        setDebates(combinedDebates);
        // Search results are not paginated further in this implementation
    } catch (e: any) {
        console.error(`[ChatList] Failed to fetch search results from ${searchUrl}:`, e);
        setError(`Search failed: ${e.message}`);
    } finally {
        setIsLoading(false);
    }
  // Ensure fetchDebates is included if needed for resetting, but it's mainly used in the clear path now
  }, [searchTerm, startDateFilter, endDateFilter, houseFilter, lastSittingDate, fetchDebates]);

  // --- Pagination --- Get previous day in YYYY-MM-DD format
  const handleLoadPreviousDay = useCallback(() => {
    // Prevent loading if already loading, no older date known, or search is active
    if (isLoading || !oldestDateLoaded || isSearchActive) return;

    const previousDay = getPreviousDay(oldestDateLoaded);
    if (previousDay) {
        console.log(`[ChatList] Infinite scroll triggered, loading previous day: ${previousDay}`);
        fetchDebates(previousDay); // fetchDebates will now check cache first
    } else {
        console.warn("[ChatList] Could not determine previous day from:", oldestDateLoaded);
        setCanLoadMore(false); // Stop trying if date calculation fails
    }
  }, [oldestDateLoaded, isLoading, fetchDebates, isSearchActive]); // Added isSearchActive

  // --- Infinite Scroll Logic ---
  const observerTarget = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !isLoading && canLoadMore && !isSearchActive) {
          // console.log('[ChatList] Sentinel visible, loading previous day...');
          handleLoadPreviousDay();
        }
      },
      { threshold: 1.0 }
    );

    const currentTarget = observerTarget.current;
    if (currentTarget) {
      observer.observe(currentTarget);
    }

    return () => {
      if (currentTarget) {
        observer.unobserve(currentTarget);
      }
    };
  }, [isLoading, canLoadMore, handleLoadPreviousDay, isSearchActive]); // Depends on isSearchActive

  // --- Metadata Fetching via Intersection Observer (Unchanged) ---
  useEffect(() => {
      observerRef.current = new IntersectionObserver((entries) => {
          entries.forEach(entry => {
              const id = (entry.target as HTMLElement).dataset.debateId;
              if (id) {
                  if (entry.isIntersecting) {
                      observedItemsRef.current.set(id, entry);
                      if (!allMetadata[id]) {
                          fetchMetadata(id); // Prop function called here
                      }
                  } else {
                      observedItemsRef.current.delete(id);
                  }
              }
          });
      }, { root: null, rootMargin: '0px', threshold: 0.1 });

      const currentObserver = observerRef.current;
      itemRefs.current.forEach((element) => {
          if (element) {
              currentObserver.observe(element);
          }
      });

      return () => {
          currentObserver.disconnect();
          observedItemsRef.current.clear();
          // itemRefs.current.clear(); // Don't clear itemRefs here, setItemRef manages it
      };
  }, [debates, fetchMetadata, allMetadata]);

  // Debounce or throttle this if performance issues arise with many items
  const setItemRef = (debateId: string, element: HTMLDivElement | null) => {
    const currentObserver = observerRef.current; // Capture observer ref

    if (element) {
      // Add or update ref
      itemRefs.current.set(debateId, element);
      if (currentObserver) {
        currentObserver.observe(element); // Observe new/updated element
      }
    } else {
      // Element is being removed (e.g., unmounted)
      const oldElement = itemRefs.current.get(debateId);
      if (oldElement && currentObserver) {
        currentObserver.unobserve(oldElement); // Unobserve before deleting ref
      }
      itemRefs.current.delete(debateId); // Delete ref
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#111b21]">
      {/* Search Bar & Filters */}
      <div className="p-3 bg-[#202c33] border-b border-gray-700">
        <form onSubmit={handleSearch} className="flex flex-col gap-2">
          {/* Keyword Search & Filter Toggle Row */}
          <div className="flex gap-2 items-center">
            <input
              type="text"
              placeholder="Search debates (keywords)..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="flex-grow p-2 rounded-md bg-[#2a3942] text-gray-300 placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
            />
            <button
              type="button"
              onClick={() => setShowFilters(!showFilters)}
              className="px-3 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-md transition-colors text-sm"
              title={showFilters ? "Hide Filters" : "Show Filters"}
            >
              {showFilters ? (
                <svg fill="#FFFFFF" width="16px" height="16px" viewBox="0 0 24 24" id="filter-filled" data-name="Flat Color" xmlns="http://www.w3.org/2000/svg" className="icon flat-color"><path id="primary" d="M18,2H6A2,2,0,0,0,4,4V6.64a2,2,0,0,0,.46,1.28L9,13.36V21a1,1,0,0,0,.47.85A1,1,0,0,0,10,22a1,1,0,0,0,.45-.11l4-2A1,1,0,0,0,15,19V13.36l4.54-5.44A2,2,0,0,0,20,6.64V4A2,2,0,0,0,18,2Z" style={{fill: 'currentColor'}}></path></svg>
              ) : (
                <svg fill="none" width="16px" height="16px" viewBox="0 0 24 24" id="filter-outline" data-name="Line Color" xmlns="http://www.w3.org/2000/svg" className="icon line-color"><path id="primary" d="M5,4V6.64a1,1,0,0,0,.23.64l4.54,5.44a1,1,0,0,1,.23.64V21l4-2V13.36a1,1,0,0,1,.23-.64l4.54-5.44A1,1,0,0,0,19,6.64V4a1,1,0,0,0-1-1H6A1,1,0,0,0,5,4Z" style={{stroke: 'currentColor', strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: '2'}}></path></svg>
              )}
            </button>
          </div>

          {/* Collapsible Filters Section */}
          {showFilters && (
             <div className="flex flex-row flex-wrap gap-2 items-center border-t border-gray-600 pt-2 mt-2">
                 {/* House Filter */}
                 <select
                    value={houseFilter}
                    onChange={(e) => setHouseFilter(e.target.value)}
                    className="p-2 rounded-md bg-[#2a3942] text-gray-300 focus:outline-none focus:ring-1 focus:ring-teal-500 cursor-pointer w-auto flex-shrink-0"
                 >
                    <option value="">House</option>
                    <option value="Commons">Commons</option>
                    <option value="Lords">Lords</option>
                 </select>
                 {/* Date Filters */}
                 <div className="flex flex-row gap-2 items-center text-sm text-gray-400 w-auto">
                   <input
                     type="date"
                     aria-label="Start date filter"
                     value={startDateFilter}
                     onChange={(e) => setStartDateFilter(e.target.value)}
                     className="p-2 rounded-md bg-[#2a3942] text-gray-300 focus:outline-none focus:ring-1 focus:ring-teal-500 w-auto"
                     max={endDateFilter || getTodayDateString()} // Adjust max based on end date
                   />
                   <span className="hidden sm:inline">To:</span>
                   <input
                     type="date"
                     aria-label="End date filter"
                     value={endDateFilter}
                     onChange={(e) => setEndDateFilter(e.target.value)}
                     className="p-2 rounded-md bg-[#2a3942] text-gray-300 focus:outline-none focus:ring-1 focus:ring-teal-500 w-auto"
                     min={startDateFilter}
                     max={getTodayDateString()}
                   />
                 </div>
                 {/* Actions Row */}
                 <div className="flex gap-2 items-center w-auto sm:ml-auto flex-shrink-0">
                     <button
                        type="submit"
                        className="px-3 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-md disabled:opacity-50 transition-colors flex items-center justify-center flex-shrink-0"
                        disabled={isLoading} // Disable during any loading (search or pagination)
                        title="Apply Filters"
                     >
                       {isLoading && isSearchActive ? ( // Show spinner only for active search loading
                         <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                           <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                           <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                         </svg>
                       ) : (
                         <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-5 h-5">
                           <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
                         </svg>
                       )}
                     </button>
                      {/* Clear Filters Button */}
                      {(searchTerm || startDateFilter || endDateFilter || houseFilter) && (
                        <button
                            type="button"
                            onClick={() => {
                                setSearchTerm('');
                                setStartDateFilter('');
                                setEndDateFilter('');
                                setHouseFilter('');
                                // Trigger handleSearch to reset the view
                                handleSearch();
                            }}
                            className="px-3 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-md transition-colors text-sm flex items-center justify-center flex-shrink-0"
                            title="Clear search and filters"
                         >
                            <span className="hidden sm:inline">Clear</span>
                            <svg className="sm:hidden w-4 h-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                         </button>
                      )}
                 </div>
             </div>
          )}
        </form>
      </div>

      {/* Debate List */}
      <div className="flex-grow overflow-y-auto divide-y divide-gray-700">
        {/* Initial Loading Indicator */}
        {isLoading && debates.length === 0 && <p className="p-4 text-center text-gray-400">Loading...</p>}
        {/* Error Display */}
        {error && <p className="p-4 text-center text-red-500">Error: {error}</p>}
        {/* No Results Found */}
        {!isLoading && !error && debates.length === 0 && (
          <p className="p-4 text-center text-gray-400">
              {isSearchActive ? "No debates found for the selected criteria." : "No debates found."}
          </p>
        )}
        {/* Debate Items */}
        {debates.map((debate) => {
          const isSelected = debate.id === selectedDebateId;
          const metadata = allMetadata[debate.id];
          return (
              <div
                ref={(el) => setItemRef(debate.id, el)}
                data-debate-id={debate.id}
                key={debate.id} // Ensure key is stable and unique
                onClick={() => onSelectDebate(debate)}
                className={`p-3 cursor-pointer transition-colors duration-150 flex items-center gap-3 relative group ${isSelected ? 'bg-teal-800' : 'hover:bg-[#2a3942]'}`}
              >
                <DebateMetadataIcon metadata={metadata} />
                <div className="flex-grow overflow-hidden">
                  <div className="flex justify-between items-center mb-1">
                    <h3 className="font-semibold text-gray-100 truncate" title={debate.title}>{debate.title}</h3>
                    <span className="text-xs text-gray-400 whitespace-nowrap ml-2">{debate.date}</span>
                  </div>
                  <div className="text-sm text-gray-400 truncate flex justify-between">
                     <span>{debate.house}</span>
                     <span className="flex items-center gap-2 text-xs whitespace-nowrap ml-2">
                        {metadata?.location && <span title="Location">{metadata.location}</span>}
                        {typeof metadata?.speakerCount === 'number' && <span title="Speakers">({metadata.speakerCount} speakers)</span>}
                     </span>
                  </div>
                  {/* Match Snippet (optional) */}
                  {debate.match && (
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400 italic truncate">...{debate.match}...</p>
                  )}
                </div>
                {/* Delete Button */}
                <button
                    onClick={(e) => {
                        e.stopPropagation(); // Prevent triggering onSelectDebate
                        if (window.confirm(`Are you sure you want to delete the cached & rewritten version of "${debate.title}"? This cannot be undone.`)) {
                           onDeleteDebate(debate.id);
                        }
                    }}
                    className="absolute top-1 right-1 p-1 rounded-full bg-gray-700 bg-opacity-80 text-gray-400 hover:text-red-500 hover:bg-gray-600 opacity-0 group-hover:opacity-100 transition-opacity"
                    title="Delete Rewritten Version"
                    aria-label={`Delete rewritten version of ${debate.title}`}
                >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-4 h-4">
                        <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                    </svg>
                </button>
              </div>
          );
        })}

        {/* Loading More Indicator (at the bottom, shown during pagination loading) */}
        {isLoading && debates.length > 0 && <p className="p-4 text-center text-gray-400">Loading more...</p>}

        {/* Sentinel Element for Intersection Observer - Only visible when not searching/filtering and can load more */}
        {!isLoading && canLoadMore && !isSearchActive && debates.length > 0 && (
           <div ref={observerTarget} style={{ height: '1px', marginTop: '-1px' }} /> // Ensure it's targetable
        )}

      </div>
    </div>
  );
} 
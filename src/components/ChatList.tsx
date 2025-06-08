'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { InternalDebateSummary, DebateMetadata } from '@/types';
// Import Hansard API types
import { SearchResult, DebateSummary } from '@/lib/hansard/types';
import DebateMetadataIcon from './DebateMetadataIcon'; // Import the new icon component
import { getTodayDateString, formatDate, getPreviousDay, formatDateVerbose } from '@/utils/dateUtils'; // Import date utils

// localStorage Key for Daily Debates Cache
const DEBATES_CACHE_PREFIX = 'uwhatgov_debates_';

interface ChatListProps {
  onSelectDebate: (debateSummary: InternalDebateSummary) => void;
  selectedDebateId: string | null;
  allMetadata: Record<string, DebateMetadata>;
  fetchMetadata: (id: string) => void; // Renamed from onItemVisible for clarity
}

interface GroupedDebates {
    [date: string]: InternalDebateSummary[];
}

export default function ChatList({ onSelectDebate, selectedDebateId, allMetadata, fetchMetadata }: ChatListProps) {
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

  // Fetch debates for a specific date, incorporating localStorage caching and house filter
  const fetchDebates = useCallback(async (date: string, isInitialLoad = false) => {
    if (!date) {
        if (isInitialLoad) setIsLoading(false); // Stop initial loading if no date
        return;
    }

    const cacheKey = DEBATES_CACHE_PREFIX + (houseFilter || 'all') + '_' + date; // Include house in cache key
    setIsLoading(true); // Set loading true for any fetch attempt (cache or API)
    setError(null);

    // 1. Check localStorage cache
    try {
        const cachedData = localStorage.getItem(cacheKey);
        if (cachedData) {
            console.log(`[ChatList] Cache HIT for debates on ${date}, house: ${houseFilter || 'all'}`);
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
    console.log(`[ChatList] Cache MISS. Fetching debates list for date: ${date}, house: ${houseFilter || 'all'} from API using /search/debates`);
    // Use the new dedicated endpoint for fetching lists of debates
    let url = `/api/hansard/search/debates?startDate=${date}&endDate=${date}`;
    if (houseFilter) {
        url += `&house=${houseFilter}`; // Add house parameter if selected
    }
    // Add a 'take' parameter to fetch more results by default for daily view
    url += `&take=50`; // Fetch up to 50 debates per day

    try {
      const response = await fetch(url);
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[ChatList] Hansard API Error Response (search/debates - ${date}, ${houseFilter || 'all'}):`, errorText);
        throw new Error(`HTTP error! status: ${response.status} - ${errorText.substring(0, 100)}`);
      }
      // Adjust data structure based on /search/debates.json response
      const data: { Results: DebateSummary[], TotalResultCount: number } = await response.json();

      // Map from data.Results instead of data.Debates
      const mappedDebates: InternalDebateSummary[] = (data.Results || []).map((debate: DebateSummary) => ({
        id: debate.DebateSectionExtId,
        title: debate.Title || debate.DebateSection,
        date: formatDate(debate.SittingDate), // Keep internal date as YYYY-MM-DD for sorting/logic
        house: debate.House,
      }));

      // Store in localStorage on successful fetch (only if no house filter or if the debate matches the filter)
      // We always store the result for the specific key (which includes the house filter)
      try {
          localStorage.setItem(cacheKey, JSON.stringify(mappedDebates));
      } catch (e) {
          console.error(`[ChatList] Error writing to localStorage for ${cacheKey}:`, e);
      }

      // Append new debates, ensuring no duplicates and sort
      setDebates(prevDebates => {
          const existingIds = new Set(prevDebates.map(d => d.id));
          const newUniqueDebates = mappedDebates.filter(d => !existingIds.has(d.id));
          return [...prevDebates, ...newUniqueDebates].sort((a, b) => b.date.localeCompare(a.date));
      });
      setOldestDateLoaded(date);

      if (mappedDebates.length === 0) {
          console.log(`[ChatList] No debates found for ${date}, house: ${houseFilter || 'all'}.`);
          // Don't disable loading more here, let the infinite scroll logic handle it if the previous day call also returns nothing.
      }

    } catch (e: any) {
      console.error(`[ChatList] Failed to fetch debates for ${date}, house: ${houseFilter || 'all'}:`, e);
      setError(`Failed to load debates for ${date}: ${e.message}`);
      // Consider if we should stop loading more on error, maybe only for specific errors?
      // setCanLoadMore(false);
    } finally {
      setIsLoading(false); // Loading finished (API fetch attempt)
    }
  }, [houseFilter]); // Add houseFilter dependency

  // Fetch last sitting date on mount
  useEffect(() => {
    fetchLastSittingDate();
  }, []);

  // Fetch initial debates when lastSittingDate is known, or when filters change outside of search mode
  useEffect(() => {
    // Only run if lastSittingDate is known, not currently searching, and fetchDebates is available
    if (lastSittingDate && !isSearchActive && fetchDebates) {
        console.log(`[ChatList] Triggering initial/filter load. Date: ${lastSittingDate}, House: ${houseFilter || 'all'}`);
        // Clear existing debates and reset pagination before fetching
        setDebates([]);
        setOldestDateLoaded(null);
        setCanLoadMore(true);
        setError(null);
        // Fetch debates for the last known sitting date with current filters
        fetchDebates(lastSittingDate, true);
    } else if (!lastSittingDate && debates.length === 0) {
        // Handle case where last sitting date couldn't be fetched - only check this when no debates loaded
        console.log("[ChatList] No last sitting date found, stopping initial load.");
        setIsLoading(false);
    }
    // This effect now handles both the very first load and subsequent loads triggered by filter changes (when not in search mode)
  }, [lastSittingDate, houseFilter, fetchDebates, isSearchActive]); // Removed debates.length, isLoading


  // --- Search Functionality (Uses searchTerm and ALL filters) ---
  const handleSearch = useCallback(async (event?: React.FormEvent) => {
    if (event) event.preventDefault();

    // Determine if *any* search/filter criteria are active
    const filtersApplied = !!searchTerm || !!startDateFilter || !!endDateFilter || !!houseFilter;

    if (!filtersApplied) {
        // Clearing search/filters: Reset state and fetch latest (respecting houseFilter if still set)
        console.log("[ChatList] Clearing search/date filters. Resetting to daily view.");
        setIsSearchActive(false);
        // Reset state BUT keep houseFilter as is, useEffect will handle reload
        setSearchTerm('');
        setStartDateFilter('');
        setEndDateFilter('');
        // setDebates([]); // Let the useEffect handle this
        // setOldestDateLoaded(null); // Let the useEffect handle this
        // setCanLoadMore(true); // Let the useEffect handle this
        setError(null);
        // The useEffect dependent on [lastSittingDate, houseFilter...] handles the reload when filters are cleared.
        return;
    }

    console.log('[ChatList] Searching with criteria:', { searchTerm, startDateFilter, endDateFilter, houseFilter });
    setIsSearchActive(true); // ENTERING search mode
    setDebates([]); // Clear previous results (daily or search)
    setOldestDateLoaded(null); // Reset pagination for search results
    setCanLoadMore(false); // Disable scroll-loading during search
    setIsLoading(true);
    setError(null);

    const params = new URLSearchParams();
    if (searchTerm) params.append('searchTerm', searchTerm);
    if (startDateFilter) params.append('startDate', startDateFilter);
    // Only include endDate if it's set, otherwise API might default incorrectly
    if (endDateFilter) params.append('endDate', endDateFilter);
    // Always include house filter in search if set
    if (houseFilter) params.append('house', houseFilter);

    // Increase 'take' parameter for search? Hansard API defaults might be small.
    params.append('take', '100'); // Example: fetch more results for keyword search

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

        // Prioritize Contributions if searchTerm exists, as they might be more relevant
        if (searchTerm && data.Contributions) {
            data.Contributions.forEach(contribution => {
                if (contribution.DebateSectionExtId && !uniqueDebates.has(contribution.DebateSectionExtId)) {
                    uniqueDebates.set(contribution.DebateSectionExtId, {
                        id: contribution.DebateSectionExtId,
                        title: contribution.DebateSection || 'Contribution Section',
                        date: formatDate(contribution.SittingDate),
                        house: contribution.House,
                        // match: contribution.Text, // Optionally add match snippet if API provides it well
                    });
                }
            });
        }

        // Add Debates (will overwrite contributions if ID matches, which is likely fine)
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
                                     .sort((a, b) => b.date.localeCompare(a.date)); // Sort results by date

        setDebates(combinedDebates);
        if (combinedDebates.length === 0) {
             console.log("[ChatList] Search returned no results.");
        }
        // Search results are not paginated further in this implementation
    } catch (e: any) {
        console.error(`[ChatList] Failed to fetch search results from ${searchUrl}:`, e);
        setError(`Search failed: ${e.message}`);
    } finally {
        setIsLoading(false);
    }
  // Remove fetchDebates from here, search uses its own API call logic
  }, [searchTerm, startDateFilter, endDateFilter, houseFilter]);


  // --- Pagination --- Load previous day respecting current house filter
  const handleLoadPreviousDay = useCallback(() => {
    // Prevent loading if already loading, no older date known, or search is active
    if (isLoading || !oldestDateLoaded || isSearchActive) {
      console.log(`[ChatList] Skipping load previous day - isLoading: ${isLoading}, oldestDateLoaded: ${oldestDateLoaded}, isSearchActive: ${isSearchActive}`);
      return;
    }

    const previousDay = getPreviousDay(oldestDateLoaded);
    if (previousDay) {
        console.log(`[ChatList] Infinite scroll triggered, loading previous day: ${previousDay}, house: ${houseFilter || 'all'} (current oldest: ${oldestDateLoaded})`);
        // fetchDebates will use the houseFilter from state
        fetchDebates(previousDay);
    } else {
        console.warn("[ChatList] Could not determine previous day from:", oldestDateLoaded);
        setCanLoadMore(false); // Stop trying if date calculation fails
    }
  }, [oldestDateLoaded, isLoading, fetchDebates, isSearchActive, houseFilter]); // Added houseFilter dependency

  // --- Infinite Scroll Logic ---
  const observerTarget = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        // Only trigger load more if NOT loading, CAN load more, and NOT in search mode
        if (entries[0].isIntersecting && !isLoading && canLoadMore && !isSearchActive) {
          handleLoadPreviousDay();
        }
      },
      { threshold: 1.0 } // Trigger when sentinel is fully visible
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
    // Dependencies ensure observer reconnects/updates correctly when state changes
  }, [isLoading, canLoadMore, handleLoadPreviousDay, isSearchActive]);


  // --- Metadata Fetching via Intersection Observer ---
  useEffect(() => {
      const currentObservedItemsRef = observedItemsRef.current;

      const observer = new IntersectionObserver((entries) => {
          entries.forEach(entry => {
              const id = (entry.target as HTMLElement).dataset.debateId;
              if (id) {
                  if (entry.isIntersecting) {
                      currentObservedItemsRef.set(id, entry);
                      // Fetch metadata only if not already loaded/loading/error
                      // Check if we have meaningful metadata (not just loading/error state)
                      const metadata = allMetadata[id];
                      const hasValidMetadata = metadata?.speakerCount !== undefined || metadata?.contributionCount !== undefined;
                      const isCurrentlyLoading = metadata?.isLoading;
                      const hasError = metadata?.error;
                      
                      // Only fetch if we don't have valid metadata and aren't currently loading
                      if (!hasValidMetadata && !isCurrentlyLoading && !hasError) {
                         // console.log(`[ChatList Metadata IO] Item ${id} visible, fetching metadata.`);
                          fetchMetadata(id); // Prop function called here
                      }
                  } else {
                      currentObservedItemsRef.delete(id);
                  }
              }
          });
      }, { root: null, rootMargin: '200px 0px', threshold: 0.1 }); // Observe earlier with rootMargin

      observerRef.current = observer; // Store observer instance

      const elementsToObserve = Array.from(itemRefs.current.values()).filter(el => el !== null);
      elementsToObserve.forEach(element => {
          if (element) observer.observe(element);
      });


      return () => {
          // console.log("[ChatList Metadata IO] Cleaning up observer.");
          observer.disconnect();
          currentObservedItemsRef.clear();
          observerRef.current = null;
      };
  // Remove allMetadata from dependencies to prevent complete re-creation of observer when cache resets
  // The observer logic itself handles checking current metadata state
  }, [debates, fetchMetadata]);

  // Ref setting function (simplified, observer re-observes in useEffect)
  const setItemRef = (debateId: string, element: HTMLDivElement | null) => {
      if (element) {
          itemRefs.current.set(debateId, element);
      } else {
          itemRefs.current.delete(debateId);
      }
      // Re-attaching observer handled by the main useEffect [debates]
  };


  // --- Group Debates by Date ---
  const groupedDebates = useMemo(() => {
    return debates.reduce((acc: GroupedDebates, debate) => {
      const date = debate.date; // Use the YYYY-MM-DD date for grouping
      if (!acc[date]) {
        acc[date] = [];
      }
      acc[date].push(debate);
      return acc;
    }, {});
  }, [debates]);

  // Get sorted dates for rendering headers in order
  const sortedDates = useMemo(() => Object.keys(groupedDebates).sort((a, b) => b.localeCompare(a)), [groupedDebates]);

  // --- Helper to clear ALL filters and search term ---
  const clearAllFilters = () => {
      setSearchTerm('');
      setStartDateFilter('');
      setEndDateFilter('');
      setHouseFilter('');
      // handleSearch will be implicitly called by the state update leading to the
      // useEffect for filter changes, OR if we want explicit immediate trigger:
      // handleSearch(); // This will now enter the "clear" path correctly
      // Correction: The useEffect[lastSittingDate, houseFilter...] handles the reload when filters are cleared.
  };


  return (
    <div className="flex flex-col h-full bg-[#111b21]">
      {/* Search Bar & Filters */}
      <div className="p-3 bg-[#202c33] border-b border-gray-700">
        {/* Use form's onSubmit for applying search/filters */}
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
              className={`px-3 py-2 ${showFilters ? 'bg-teal-700' : 'bg-gray-600'} hover:bg-gray-700 text-white rounded-md transition-colors text-sm`}
              title={showFilters ? "Hide Filters" : "Show Filters"}
            >
              {/* SVG Icons remain the same */}
              {showFilters ? (
                <svg fill="#FFFFFF" width="16px" height="16px" viewBox="0 0 24 24" id="filter-filled" data-name="Flat Color" xmlns="http://www.w3.org/2000/svg" className="icon flat-color"><path id="primary" d="M18,2H6A2,2,0,0,0,4,4V6.64a2,2,0,0,0,.46,1.28L9,13.36V21a1,1,0,0,0,.47.85A1,1,0,0,0,10,22a1,1,0,0,0,.45-.11l4-2A1,1,0,0,0,15,19V13.36l4.54-5.44A2,2,0,0,0,20,6.64V4A2,2,0,0,0,18,2Z" style={{fill: 'currentColor'}}></path></svg>
              ) : (
                <svg fill="none" width="16px" height="16px" viewBox="0 0 24 24" id="filter-outline" data-name="Line Color" xmlns="http://www.w3.org/2000/svg" className="icon line-color"><path id="primary" d="M5,4V6.64a1,1,0,0,0,.23.64l4.54,5.44a1,1,0,0,1,.23.64V21l4-2V13.36a1,1,0,0,1,.23-.64l4.54-5.44A1,1,0,0,0,19,6.64V4a1,1,0,0,0-1-1H6A1,1,0,0,0,5,4Z" style={{stroke: 'currentColor', strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: '2'}}></path></svg>
              )}
            </button>
          </div>

          {/* Collapsible Filters Section */}
          {showFilters && (
             <div className="flex flex-col sm:flex-row flex-wrap gap-2 items-center border-t border-gray-600 pt-2 mt-2">
                 {/* House Filter */}
                 <select
                    value={houseFilter}
                    onChange={(e) => {
                        setHouseFilter(e.target.value);
                        // Changing filter directly resets view via useEffect, no need to call handleSearch here
                        // We only call handleSearch via form onSubmit or explicit clear button
                    }}
                    className="p-2 rounded-md bg-[#2a3942] text-gray-300 focus:outline-none focus:ring-1 focus:ring-teal-500 cursor-pointer w-full sm:w-auto flex-shrink-0"
                 >
                    <option value="">House</option> {/* Changed default text */}
                    <option value="Commons">Commons</option>
                    <option value="Lords">Lords</option>
                 </select>
                 {/* Date Filters */}
                 <div className="flex flex-row gap-2 items-center text-sm text-gray-400 w-full sm:w-auto">
                   <label htmlFor="startDateFilter" className="sr-only">Start Date</label>
                   <input
                     id="startDateFilter"
                     type="date"
                     aria-label="Start date filter"
                     value={startDateFilter}
                     onChange={(e) => setStartDateFilter(e.target.value)}
                     className="p-2 rounded-md bg-[#2a3942] text-gray-300 focus:outline-none focus:ring-1 focus:ring-teal-500 w-full sm:w-auto"
                     max={endDateFilter || getTodayDateString()} // Adjust max based on end date
                   />
                   <span className="hidden sm:inline text-gray-400">to</span>
                   <label htmlFor="endDateFilter" className="sr-only">End Date</label>
                   <input
                     id="endDateFilter"
                     type="date"
                     aria-label="End date filter"
                     value={endDateFilter}
                     onChange={(e) => setEndDateFilter(e.target.value)}
                     className="p-2 rounded-md bg-[#2a3942] text-gray-300 focus:outline-none focus:ring-1 focus:ring-teal-500 w-full sm:w-auto"
                     min={startDateFilter}
                     max={getTodayDateString()}
                   />
                 </div>
                 {/* Actions Row */}
                 <div className="flex gap-2 items-center w-full sm:w-auto sm:ml-auto flex-shrink-0">
                     <button
                        type="submit" // Submit the form, triggering handleSearch
                        className="px-3 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-md disabled:opacity-50 transition-colors flex items-center justify-center flex-grow sm:flex-grow-0"
                        disabled={isLoading} // Disable during any loading
                        title="Search with current filters"
                     >
                       {isLoading && isSearchActive ? ( // Show spinner only when actively searching
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
                      {/* Clear Filters Button - Now calls clearAllFilters */}
                      {(searchTerm || startDateFilter || endDateFilter || houseFilter) && (
                        <button
                            type="button"
                            onClick={clearAllFilters} // Use the helper function
                            className="px-3 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-md transition-colors text-sm flex items-center justify-center flex-shrink-0"
                            title="Clear search and filters"
                         >
                            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" stroke="currentColor" >
                              <path d="M8 8L16 16" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                              <path d="M16 8L8 16" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                            </svg>
                            {/* X Icon */}
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
      <div className="flex-grow overflow-y-auto"> {/* Removed divide-y */}
        {/* Initial Loading Indicator */}
        {isLoading && debates.length === 0 && <p className="p-4 text-center text-gray-400">Loading debates...</p>}
        {/* Error Display */}
        {error && <p className="p-4 text-center text-red-500">Error: {error}</p>}
        {/* No Results Found */}
        {!isLoading && !error && debates.length === 0 && (
          <p className="p-4 text-center text-gray-400">
              {isSearchActive ? "No debates found matching your search criteria." : "No debates found for the selected date and filters."}
          </p>
        )}
        {/* Grouped Debate Items */}
        {sortedDates.map((date) => (
            <div key={date} className="date-group">
                 {/* Date Header */}
                <div className="sticky top-0 z-10 px-3 py-1.5 bg-[#1f2c33] text-xs font-semibold text-teal-300 shadow backdrop-blur-sm bg-opacity-80"> {/* Adjusted background for sticky */}
                    {formatDateVerbose(date)}
                </div>
                {/* Debates for this date */}
                <div className="divide-y divide-gray-700"> {/* Apply divide-y within the group */}
                    {groupedDebates[date].map((debate) => {
                        const isSelected = debate.id === selectedDebateId;
                        const metadata = allMetadata[debate.id];
                        // Determine selected background color based on house
                        const selectedBgColor = isSelected
                          ? (debate.house === 'Lords' ? 'bg-red-800/[.75]' : 'bg-teal-800/[.75]') // Slightly less opaque selected
                          : 'hover:bg-[#2a3942]';
                        return (
                            <div
                                ref={(el) => setItemRef(debate.id, el)}
                                data-debate-id={debate.id}
                                key={debate.id} // Use debate.id as key
                                onClick={() => onSelectDebate(debate)}
                                className={`p-3 cursor-pointer transition-colors duration-150 flex items-center gap-3 relative group ${selectedBgColor}`} // Use dynamic selectedBgColor
                            >
                                <DebateMetadataIcon metadata={metadata} />
                                <div className="flex-grow overflow-hidden">
                                <div className="flex justify-between items-start mb-1">
                                    <h3 className="font-semibold text-gray-100 truncate mr-2" title={debate.title}>{debate.title}</h3>
                                    {/* Date removed */}
                                </div>
                                <div className="text-sm text-gray-400 truncate flex justify-between items-center">
                                    <span>{debate.house}</span>
                                    <span className="flex items-center gap-2 text-xs whitespace-nowrap ml-2 flex-shrink-0"> {/* Added flex-shrink-0 */}
                                        {metadata?.location && <span title="Location">{metadata.location}</span>}
                                        {typeof metadata?.speakerCount === 'number' && <span title="Speakers">({metadata.speakerCount} speakers)</span>}
                                    </span>
                                </div>
                                {/* Match Snippet (optional - consider adding if search provides it) */}
                                {debate.match && (
                                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400 italic truncate">...{debate.match}...</p>
                                )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        ))}


        {/* Loading More Indicator (at the bottom, shown during pagination loading) */}
        {isLoading && debates.length > 0 && !isSearchActive && <p className="p-4 text-center text-gray-400">Loading more...</p>}

        {/* Sentinel Element for Intersection Observer - Only present when not searching/filtering and can load more */}
        {!isLoading && canLoadMore && !isSearchActive && debates.length > 0 && (
           <div ref={observerTarget} style={{ height: '50px', marginTop: '-50px' }} /> // Sentinel slightly above bottom
        )}
        {/* Message indicating end of list */}
        {!isLoading && !canLoadMore && !isSearchActive && debates.length > 0 && (
            <p className="p-4 text-center text-xs text-gray-500">No more debates found for this period.</p>
        )}

      </div>
    </div>
  );
} 
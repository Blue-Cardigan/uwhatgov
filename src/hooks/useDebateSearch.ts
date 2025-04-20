import { useState, useEffect, useCallback } from 'react';
import { Speech } from '@/components/ChatView';
import { DebateResponse } from '@/lib/hansard/types';

interface UseDebateSearchProps {
  viewMode: 'rewritten' | 'original';
  originalDebate: DebateResponse | null;
  rewrittenDebateRef: React.RefObject<Speech[] | null>;
  chatViewRef: React.RefObject<{ scrollToItem: (index: number) => void } | null>;
}

export function useDebateSearch({
  viewMode,
  originalDebate,
  rewrittenDebateRef,
  chatViewRef,
}: UseDebateSearchProps) {
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<number[]>([]); // Stores indices (OrderInSection or originalIndex)
  const [currentMatchIndex, setCurrentMatchIndex] = useState(-1); // Index within searchResults array

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
      const speeches = rewrittenDebateRef.current;
      if (speeches) {
        results = speeches
          .map((speech, index) => ({
            speech,
            originalIndex: speech.originalIndex ?? index, // Use originalIndex if available
          }))
          .filter(
            (item) =>
              item.speech.text.toLowerCase().includes(query) ||
              item.speech.speaker.toLowerCase().includes(query)
          )
          .map((item) => item.originalIndex); // Store the original index
      }
    } else { // viewMode === 'original'
      if (originalDebate?.Items) {
        results = originalDebate.Items.filter(
          (item) =>
            item.ItemType === 'Contribution' &&
            item.Value &&
            (item.Value.toLowerCase().includes(query) ||
              (item.AttributedTo && item.AttributedTo.toLowerCase().includes(query)))
        ).map((item) => item.OrderInSection); // Store OrderInSection
      }
    }

    console.log(
      `Search for "${query}" in ${viewMode} mode found ${results.length} results:`, results
    );
    setSearchResults(results);
    setCurrentMatchIndex(results.length > 0 ? 0 : -1);
  }, [searchQuery, viewMode, originalDebate, rewrittenDebateRef]);

  // Effect to scroll to the current match
  useEffect(() => {
    if (
      currentMatchIndex !== -1 &&
      searchResults.length > 0 &&
      chatViewRef.current
    ) {
      const targetIndex = searchResults[currentMatchIndex];
      console.log(
        `Scrolling to search result index: ${targetIndex} (result ${currentMatchIndex + 1} of ${searchResults.length})`
      );
      chatViewRef.current?.scrollToItem(targetIndex);
    }
  }, [currentMatchIndex, searchResults, chatViewRef]);

  const handleSearchChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(event.target.value);
  }, []);

  const goToNextMatch = useCallback(() => {
    if (searchResults.length > 0) {
      setCurrentMatchIndex((prevIndex) => (prevIndex + 1) % searchResults.length);
    }
  }, [searchResults.length]);

  const goToPreviousMatch = useCallback(() => {
    if (searchResults.length > 0) {
      setCurrentMatchIndex(
        (prevIndex) => (prevIndex - 1 + searchResults.length) % searchResults.length
      );
    }
  }, [searchResults.length]);

  const closeSearch = useCallback(() => {
    setIsSearchOpen(false);
    setSearchQuery('');
    setSearchResults([]);
    setCurrentMatchIndex(-1);
  }, []);
  
  // Effect to clear search when view mode changes (but not when debate ID changes, let selection handle that)
  useEffect(() => {
      closeSearch();
  }, [viewMode, closeSearch]);

  return {
    isSearchOpen,
    setIsSearchOpen,
    searchQuery,
    setSearchQuery, // Expose setter for external clearing if needed
    searchResults,
    currentMatchIndex,
    handleSearchChange,
    goToNextMatch,
    goToPreviousMatch,
    closeSearch, // Expose close function
  };
} 
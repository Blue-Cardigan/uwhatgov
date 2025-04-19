'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link'; // Keep Link for navigation within the list items for now
import { InternalDebateSummary } from '@/types';
// Import Hansard API types
import { SearchResult, DebateSummary } from '@/lib/hansard/types';

interface ChatListProps {
  onSelectDebate: (debateSummary: InternalDebateSummary) => void;
}

export default function ChatList({ onSelectDebate }: ChatListProps) {
  const [debates, setDebates] = useState<InternalDebateSummary[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Helper to format date string
  const formatDate = (isoDateString: string) => {
      try {
          return isoDateString.split('T')[0]; // Extract YYYY-MM-DD
      } catch {
          return isoDateString; // Fallback
      }
  };

  // Updated fetchDebates function
  async function fetchDebates(url: string = '/api/hansard/search?startDate=2025-04-08') { // Use backend proxy route
    setIsLoading(true);
    setError(null);
    console.log(`Fetching debates from: ${url}`); // Log the URL being fetched
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

      setDebates(mappedDebates);
    } catch (e: any) {
      console.error(`Failed to fetch debates from ${url}:`, e);
      setError(`Failed to load debates: ${e.message}`);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    fetchDebates();
  }, []);

  const handleSearch = (event: React.FormEvent) => {
    event.preventDefault();
    console.log('Searching for:', searchTerm);
    // Use the backend proxy search endpoint
    const searchUrl = `/api/hansard/search?query=${encodeURIComponent(searchTerm)}`;
    fetchDebates(searchUrl);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Search Bar - Basic implementation */}
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
        {isLoading && <p className="p-4 text-center text-gray-400">Loading...</p>}
        {error && <p className="p-4 text-center text-red-500">Error: {error}</p>}
        {!isLoading && !error && debates.length === 0 && (
          <p className="p-4 text-center text-gray-400">No debates found.</p>
        )}
        {!isLoading && !error && debates.map((debate) => (
          <div
            key={debate.id}
            onClick={() => onSelectDebate(debate)}
            className="p-3 hover:bg-[#2a3942] cursor-pointer transition-colors duration-150 flex items-center gap-3"
          >
            {/* Placeholder for Avatar/Icon */}
            <div className="w-10 h-10 bg-gray-600 rounded-full flex-shrink-0"></div>
            <div className="flex-grow overflow-hidden">
              <div className="flex justify-between items-center mb-1">
                <h3 className="font-semibold text-gray-100 truncate" title={debate.title}>{debate.title}</h3>
                <span className="text-xs text-gray-400 whitespace-nowrap ml-2">{debate.date}</span>
              </div>
              <div className="text-sm text-gray-400 truncate flex justify-between">
                 <span>{debate.house}</span>
                 {debate.match && (
                   <span className="text-xs text-teal-400 italic ml-2">Match</span>
                 )}
              </div>
              {/* Uncomment if you want to show the match snippet in the list */}
              {/* {debate.match && (
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400 italic truncate">...{debate.match}...</p>
              )} */}
            </div>
          </div>
          // Keep Link for potential future use or direct navigation, but onClick handles selection for view update
          // <Link key={debate.id} href={`/debate/${debate.id}`} passHref> ... </Link> // Original Link wrapping
        ))}
      </div>
    </div>
  );
} 
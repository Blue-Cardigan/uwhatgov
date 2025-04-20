'use client';

import React from 'react';

interface SearchHeaderProps {
  searchQuery: string;
  searchResultsCount: number;
  currentMatchIndex: number;
  onSearchChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onCloseSearch: () => void;
  onClearQuery: () => void;
  onGoToPreviousMatch: () => void;
  onGoToNextMatch: () => void;
}

const SearchHeader: React.FC<SearchHeaderProps> = ({
  searchQuery,
  searchResultsCount,
  currentMatchIndex,
  onSearchChange,
  onCloseSearch,
  onClearQuery,
  onGoToPreviousMatch,
  onGoToNextMatch,
}) => {
  return (
    <div className="flex items-center w-full">
      <button
        onClick={onCloseSearch}
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
        onChange={onSearchChange}
        className="flex-grow bg-transparent text-sm text-gray-200 placeholder-gray-500 focus:outline-none px-2 py-1"
        autoFocus
      />
      {searchQuery && (
        <button onClick={onClearQuery} className="ml-1 text-gray-500 hover:text-gray-300 text-xs p-0.5">
          &times;
        </button>
      )}
      {searchResultsCount > 0 && (
        <span className="text-xs text-gray-500 ml-2 whitespace-nowrap">
          {currentMatchIndex + 1}/{searchResultsCount}
        </span>
      )}
      <button
        onClick={onGoToPreviousMatch}
        disabled={searchResultsCount <= 1}
        className="ml-1 text-gray-400 hover:text-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
        title="Previous match"
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
          <path fillRule="evenodd" d="M14.77 12.79a.75.75 0 0 1-1.06 0L10 9.06l-3.71 3.73a.75.75 0 1 1-1.06-1.06l4.24-4.25a.75.75 0 0 1 1.06 0l4.24 4.25a.75.75 0 0 1 0 1.06Z" clipRule="evenodd" />
        </svg> {/* Up Arrow */} 
      </button>
      <button
        onClick={onGoToNextMatch}
        disabled={searchResultsCount <= 1}
        className="ml-0.5 text-gray-400 hover:text-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
        title="Next match"
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
          <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 0 1 1.06.02L10 11.168l3.71-3.938a.75.75 0 1 1 1.08 1.04l-4.25 4.5a.75.75 0 0 1-1.08 0l-4.25-4.5a.75.75 0 0 1 .02-1.06Z" clipRule="evenodd" />
        </svg> {/* Down Arrow */} 
      </button>
    </div>
  );
};

export default SearchHeader; 
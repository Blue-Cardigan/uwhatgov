'use client';

import React from 'react';

interface SummaryViewerProps {
  isOpen: boolean;
  isLoading: boolean;
  error: string | null;
  text: string | null;
  onClose: () => void;
}

const SummaryViewer: React.FC<SummaryViewerProps> = ({ isOpen, isLoading, error, text, onClose }) => {
  if (!isOpen) {
    return null;
  }

  return (
    <div className="absolute top-16 left-0 right-0 z-30 bg-[#111b21] border-b border-gray-700 shadow-lg p-4 text-sm max-h-48 overflow-y-auto">
      {/* Close button for the dropdown */}
      <button
        onClick={onClose}
        className="absolute top-1 right-1 text-gray-500 hover:text-white p-1 rounded-full bg-gray-800 hover:bg-gray-700 text-xs z-40"
        title="Close summary"
      >
        ✕
      </button>
      {isLoading ? (
        <span className="italic text-gray-400 animate-pulse">Generating summary...</span>
      ) : error ? (
        <span className="text-red-400 italic">Error: {error}</span>
      ) : text ? (
        <p className="text-gray-300 pr-4">{text}</p>
      ) : (
        <span className="italic text-gray-500">No summary available or not generated yet.</span>
      )}
    </div>
  );
};

export default SummaryViewer; 
'use client';

import React from 'react';
import { Resizable } from 're-resizable';
import OriginalContribution from '@/components/OriginalContribution';
import { DebateContentItem } from '@/lib/hansard/types';

interface OriginalDebateViewerProps {
  viewMode: 'rewritten' | 'original';
  selectedOriginalIndex: number | null;
  selectedOriginalItem: DebateContentItem | null | undefined; // Allow undefined from find()
  isLoadingOriginal: boolean;
  errorOriginal: string | null;
  originalPanelHeight: number;
  setOriginalPanelHeight: (height: number) => void;
  onClose: () => void;
}

const OriginalDebateViewer: React.FC<OriginalDebateViewerProps> = ({
  viewMode,
  selectedOriginalIndex,
  selectedOriginalItem,
  isLoadingOriginal,
  errorOriginal,
  originalPanelHeight,
  setOriginalPanelHeight,
  onClose,
}) => {
  if (viewMode !== 'rewritten' || selectedOriginalIndex === null) {
    return null;
  }

  return (
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
        onClick={onClose}
        className="absolute top-2 right-2 text-gray-400 hover:text-white p-1 rounded-full bg-gray-600 hover:bg-gray-500 text-xs z-30"
        title="Close original view"
      >
        ✕
      </button>
    </Resizable>
  );
};

export default OriginalDebateViewer; 
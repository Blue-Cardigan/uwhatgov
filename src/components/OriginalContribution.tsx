'use client';

import React, { useEffect, useRef } from 'react';
import { Resizable } from 're-resizable';
import { DebateContentItem } from '@/lib/hansard/types';

interface OriginalContributionProps {
  item: DebateContentItem;
  selectedOriginalIndex: number;
  onClose: () => void;
  originalPanelHeight: number;
  setOriginalPanelHeight: (height: number) => void;
  isLoadingOriginal: boolean;
  errorOriginal: string | null;
}

const OriginalContribution: React.FC<OriginalContributionProps> = ({
  item,
  selectedOriginalIndex: _selectedOriginalIndex,
  onClose,
  originalPanelHeight,
  setOriginalPanelHeight,
  isLoadingOriginal,
  errorOriginal
}) => {
  const MIN_HEIGHT = 43;
  const EXPANDED_HEIGHT = 300;
  const resizableRef = useRef<any>(null);
  
  const isMinimized = originalPanelHeight === MIN_HEIGHT;
  
  const handleToggleExpand = () => {
    setOriginalPanelHeight(isMinimized ? EXPANDED_HEIGHT : MIN_HEIGHT);
  };
  
  // Force resizable to update its size when height changes externally
  useEffect(() => {
    if (resizableRef.current?.updateSize) {
      resizableRef.current.updateSize({ width: '100%', height: originalPanelHeight });
    }
  }, [originalPanelHeight]);
  
  // Helper function to safely render HTML
  const renderContent = (htmlContent: string | null | undefined) => {
    if (!htmlContent) return { __html: '' };
    const cleanHtml = htmlContent.replace(/<script.*?>.*?<\/script>/gi, '');
    return { __html: cleanHtml };
  };

  return (
    <div className="relative">
      {/* Close button */}
      <button
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onClose();
        }}
        className="absolute -top-1 right-0 z-30 w-12 h-12 bg-gradient-to-br from-[#1e2a32] to-[#162028] border-l border-b border-gray-500/30 text-gray-400 hover:text-red-300 hover:bg-gradient-to-br hover:from-red-600/25 hover:to-red-500/20 transition-all duration-300 flex items-center justify-center group backdrop-blur-sm"
        title="Close panel"
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 group-hover:scale-110 group-hover:rotate-90 transition-all duration-300">
          <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
        </svg>
      </button>

      <Resizable
        ref={resizableRef}
        size={{ width: '100%', height: originalPanelHeight }}
        minHeight={MIN_HEIGHT}
        maxHeight={typeof window !== 'undefined' ? window.innerHeight * 0.8 : 600}
        enable={{ top: true, right: false, bottom: false, left: false, topRight: false, bottomRight: false, bottomLeft: false, topLeft: false }}
        onResizeStop={(e, direction, ref, d) => {
          if (Math.abs(d.height) > 2) {
            const newHeight = Math.max(originalPanelHeight + d.height, MIN_HEIGHT);
            setOriginalPanelHeight(newHeight);
          }
        }}
        className="absolute bottom-0 left-0 right-0 bg-[#0f1419] border-t border-gray-600/50 z-20 shadow-2xl flex flex-col backdrop-blur-sm"
        handleComponent={{
          top: (
            <div 
              className="w-full bg-gradient-to-r from-[#1e2a32] via-[#1a252c] to-[#162028] border-b border-gray-500/30 cursor-ns-resize hover:from-[#243038] hover:via-[#2a3942] hover:to-[#1f2b34] transition-all duration-300 flex items-center shadow-md h-12 relative overflow-hidden"
              onMouseDown={(e) => e.preventDefault()}
            >
              {/* Drag handle area */}
              <div 
                className="flex items-center gap-4 px-5 flex-1 min-w-0 relative z-10 cursor-pointer" 
                style={{ paddingRight: '60px' }}
                onClick={handleToggleExpand}
              >
                {/* Drag indicator */}
                <div className="flex-shrink-0 text-gray-400 hover:text-blue-300 transition-all duration-300">
                  <svg width="18" height="18" viewBox="0 0 16 16" fill="currentColor" className="opacity-70 hover:opacity-100 transition-all duration-200 hover:scale-110">
                    <circle cx="3" cy="4" r="1.2"/>
                    <circle cx="8" cy="4" r="1.2"/>
                    <circle cx="13" cy="4" r="1.2"/>
                    <circle cx="3" cy="8" r="1.2"/>
                    <circle cx="8" cy="8" r="1.2"/>
                    <circle cx="13" cy="8" r="1.2"/>
                    <circle cx="3" cy="12" r="1.2"/>
                    <circle cx="8" cy="12" r="1.2"/>
                    <circle cx="13" cy="12" r="1.2"/>
                  </svg>
                </div>
                
                {/* Title with icon */}
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="w-6 h-6 bg-gradient-to-br from-blue-500/25 to-purple-500/20 rounded-lg flex items-center justify-center backdrop-blur-sm border border-blue-400/30 shadow-sm">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5 text-blue-300">
                      <path fillRule="evenodd" d="M4.5 2A1.5 1.5 0 0 0 3 3.5v13A1.5 1.5 0 0 0 4.5 18h11a1.5 1.5 0 0 0 1.5-1.5V7.621a1.5 1.5 0 0 0-.44-1.06l-4.12-4.122A1.5 1.5 0 0 0 11.378 2H4.5ZM8 8a.75.75 0 0 1 .75.75v1.5h1.5a.75.75 0 0 1 0 1.5h-1.5v1.5a.75.75 0 0 1-1.5 0v-1.5h-1.5a.75.75 0 0 1 0-1.5h1.5v-1.5A.75.75 0 0 1 8 8Z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-gray-200 truncate tracking-wide">
                      Original Parliamentary Text
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )
        }}
      >
        {/* Panel content */}
        <div className="flex-1 overflow-hidden bg-[#0f1419] flex flex-col">
          {originalPanelHeight > MIN_HEIGHT + 20 ? (
            <>
              {item ? (
                <>
                  {/* Speaker info */}
                  <div className="flex-shrink-0 px-6 pt-12 pb-2 bg-gradient-to-r from-[#1a2332] via-[#162030] to-[#1a2332] border-b border-gray-500/40 relative overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 via-transparent to-purple-500/5"></div>
                    
                    <div className="flex items-center gap-4 relative z-10">
                      <div className="w-10 h-10 bg-gradient-to-br from-blue-500/30 to-purple-500/20 rounded-xl flex items-center justify-center backdrop-blur-sm border border-blue-400/30 shadow-lg">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5 text-blue-300">
                          <path fillRule="evenodd" d="M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Zm-5.5-2.5a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0ZM10 12a5.99 5.99 0 0 0-4.793 2.39A6.483 6.483 0 0 0 10 16.5a6.483 6.483 0 0 0 4.793-2.11A5.99 5.99 0 0 0 10 12Z" clipRule="evenodd" />
                        </svg>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-lg text-blue-200 truncate tracking-wide">
                          {item.AttributedTo || 'Speaker/Unlisted'}
                        </p>
                      </div>
                    </div>
                  </div>
                  
                  {/* Content */}
                  <div className="flex-1 overflow-y-auto px-6 py-6 bg-gradient-to-b from-[#0f1419] to-[#0a0f14]">
                    <div className="prose prose-sm prose-invert max-w-none">
                      <div 
                        className="text-gray-100 leading-relaxed text-sm selection:bg-blue-500/30 selection:text-blue-100"
                        dangerouslySetInnerHTML={renderContent(item.Value)} 
                      />
                    </div>
                  </div>
                </>
              ) : isLoadingOriginal ? (
                <div className="flex-1 flex items-center justify-center py-12 bg-gradient-to-b from-[#0f1419] to-[#0a0f14]">
                  <div className="text-center">
                    <div className="inline-block animate-spin rounded-full h-8 w-8 border-3 border-gray-600 border-t-blue-400 mb-4 shadow-lg"></div>
                    <div className="text-gray-300 text-base font-medium">Loading original text...</div>
                    <div className="text-gray-500 text-sm mt-2">Retrieving parliamentary source</div>
                  </div>
                </div>
              ) : errorOriginal ? (
                <div className="flex-1 flex items-center justify-center py-8">
                  <div className="text-center max-w-md">
                    <div className="w-12 h-12 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-3">
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5 text-red-400">
                        <path fillRule="evenodd" d="M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0ZM8.28 7.22a.75.75 0 0 0-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 1 0 1.06 1.06L10 11.06l1.72 1.72a.75.75 0 1 0 1.06-1.06L11.06 10l1.72-1.72a.75.75 0 0 0-1.06-1.06L10 8.94 8.28 7.22Z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div className="text-red-400 font-medium text-sm mb-1">Failed to Load</div>
                    <div className="text-gray-400 text-xs">{errorOriginal}</div>
                  </div>
                </div>
              ) : (
                <div className="flex-1 flex items-center justify-center py-8">
                  <div className="text-center">
                    <div className="w-12 h-12 bg-gray-500/20 rounded-full flex items-center justify-center mx-auto mb-3">
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5 text-gray-500">
                        <path fillRule="evenodd" d="M4.5 2A1.5 1.5 0 0 0 3 3.5v13A1.5 1.5 0 0 0 4.5 18h11a1.5 1.5 0 0 0 1.5-1.5V7.621a1.5 1.5 0 0 0-.44-1.06l-4.12-4.122A1.5 1.5 0 0 0 11.378 2H4.5ZM8 8a.75.75 0 0 1 .75.75v1.5h1.5a.75.75 0 0 1 0 1.5h-1.5v1.5a.75.75 0 0 1-1.5 0v-1.5h-1.5a.75.75 0 0 1 0-1.5h1.5v-1.5A.75.75 0 0 1 8 8Z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div className="text-gray-500 text-sm">No content available</div>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-gray-500 text-xs">
                Tap or drag to expand
              </div>
            </div>
          )}
        </div>
      </Resizable>
    </div>
  );
};

export default OriginalContribution; 
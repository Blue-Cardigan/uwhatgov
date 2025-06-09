'use client';

interface GroundingChunk {
  web?: {
    uri: string;
    title: string;
  };
}

interface GroundingSupport {
  segment: {
    startIndex: number;
    endIndex: number;
    text: string;
  };
  groundingChunkIndices: number[];
  confidenceScores: number[];
}

interface GroundingMetadata {
  searchEntryPoint?: {
    renderedContent: string;
  };
  groundingChunks?: GroundingChunk[];
  groundingSupports?: GroundingSupport[];
  webSearchQueries?: string[];
}

interface GroundingDisplayProps {
  groundingMetadata: GroundingMetadata;
}

const SearchIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3">
    <path fillRule="evenodd" d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z" clipRule="evenodd" />
  </svg>
);

const LinkIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3">
    <path d="M12.232 4.232a2.5 2.5 0 013.536 3.536l-1.225 1.224a.75.75 0 001.061 1.061l1.224-1.224a4 4 0 00-5.656-5.656l-3 3a4 4 0 00.225 5.865.75.75 0 00.977-1.138 2.5 2.5 0 01-.142-3.667l3-3z" />
    <path d="M11.603 7.963a.75.75 0 00-.977 1.138 2.5 2.5 0 01.142 3.667l-3 3a2.5 2.5 0 01-3.536-3.536l1.225-1.224a.75.75 0 00-1.061-1.061l-1.224 1.224a4 4 0 105.656 5.656l3-3a4 4 0 00-.225-5.865z" />
  </svg>
);

export default function GroundingDisplay({ groundingMetadata }: GroundingDisplayProps) {
  const { searchEntryPoint, groundingChunks, groundingSupports, webSearchQueries } = groundingMetadata;

  if (!groundingMetadata || (!groundingChunks?.length && !webSearchQueries?.length)) {
    return null;
  }

  return (
    <div className="mt-2 p-2 bg-gray-800 rounded-lg border border-gray-600">
      <div className="flex items-center gap-1 mb-2">
        <SearchIcon />
        <span className="text-xs font-medium text-gray-300">Search Results</span>
      </div>

      {/* Search Queries */}
      {webSearchQueries && webSearchQueries.length > 0 && (
        <div className="mb-2">
          <div className="text-xs text-gray-400 mb-1">Searched for:</div>
          {webSearchQueries.map((query, index) => (
            <div key={index} className="text-xs text-blue-300 italic">
              "{query}"
            </div>
          ))}
        </div>
      )}

      {/* Grounding Sources */}
      {groundingChunks && groundingChunks.length > 0 && (
        <div className="space-y-1">
          <div className="text-xs text-gray-400 mb-1">Sources:</div>
          {groundingChunks.map((chunk, index) => {
            if (!chunk.web) return null;
            
            const handleLinkClick = (uri: string) => {
              // Open in new tab to avoid redirecting away from the app
              window.open(uri, '_blank', 'noopener,noreferrer');
            };

            return (
              <button
                key={index}
                onClick={() => handleLinkClick(chunk.web!.uri)}
                className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 underline hover:no-underline transition-colors w-full text-left group"
              >
                <LinkIcon />
                <span className="truncate">{chunk.web.title || 'Source'}</span>
                <span className="text-gray-500 text-xs ml-auto group-hover:text-gray-400">↗</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Grounding Supports (confidence info) */}
      {groundingSupports && groundingSupports.length > 0 && (
        <div className="mt-2 pt-2 border-t border-gray-700">
          <div className="text-xs text-gray-400 mb-1">
            Verified with {groundingSupports.length} source{groundingSupports.length > 1 ? 's' : ''}
          </div>
          <div className="flex flex-wrap gap-1">
            {groundingSupports.map((support, index) => {
              const avgConfidence = support.confidenceScores?.length > 0 
                ? support.confidenceScores.reduce((a, b) => a + b, 0) / support.confidenceScores.length 
                : 0;
              
              return (
                <div
                  key={index}
                  className="text-xs px-1 py-0.5 rounded bg-gray-700 text-gray-300"
                  title={`Confidence: ${(avgConfidence * 100).toFixed(0)}%`}
                >
                  {(avgConfidence * 100).toFixed(0)}%
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Search Entry Point (if available) */}
      {searchEntryPoint?.renderedContent && (
        <div className="mt-2 pt-2 border-t border-gray-700">
          <div className="text-xs text-gray-400 mb-1">Google Search Suggestions:</div>
          <div 
            className="text-xs text-gray-300 prose prose-xs prose-invert max-w-none"
            dangerouslySetInnerHTML={{ __html: searchEntryPoint.renderedContent }}
          />
        </div>
      )}
    </div>
  );
} 
'use client';

import { DebateContentItem } from '@/lib/hansard/types'; // Import necessary type

// Original Contribution Component
// This component will render the raw contribution from the Hansard API data
const OriginalContribution = ({ item }: { item: DebateContentItem }) => {
  // Helper function to safely render HTML or strip it
  const renderContent = (htmlContent: string | null | undefined) => {
    if (!htmlContent) return { __html: '' };
    // Basic sanitization (consider a more robust library like DOMPurify if needed)
    const cleanHtml = htmlContent.replace(/<script.*?>.*?<\/script>/gi, '');
    return { __html: cleanHtml };
  };

  return (
    // Removed h-full to allow natural height based on content
    <div className="overflow-y-auto p-3 rounded bg-gray-800 border border-gray-700 shadow-sm">
      <p className="font-semibold text-sm mb-1 text-blue-300">{item.AttributedTo || 'Speaker/Unlisted'}</p>
      {/* Render the raw HTML content - USE WITH CAUTION */}
      <div className="text-sm text-gray-300 prose prose-sm prose-invert max-w-none"
           dangerouslySetInnerHTML={renderContent(item.Value)} />
    </div>
  );
};

export default OriginalContribution; 
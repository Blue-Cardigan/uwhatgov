'use client';

import React from 'react';
import { getPartyColorClass } from '@/lib/partyColors';

interface TypingIndicatorProps {
  speakerName: string;
  partyAbbreviation: string | null;
}

export const TypingIndicator: React.FC<TypingIndicatorProps> = ({ speakerName, partyAbbreviation }) => {
  const textColor = getPartyColorClass(partyAbbreviation);

  return (
    <div className="flex items-center space-x-2 animate-pulse">
      <span className={`text-sm font-medium ${textColor || 'text-gray-400'}`}>{speakerName}</span>
      <span className="text-sm text-gray-500">is typing</span>
      <div className="flex space-x-1">
        <div className="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
        <div className="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
        <div className="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce"></div>
      </div>
    </div>
  );
}; 
'use client';

import { useEffect } from 'react';
import { useSearchParams } from 'next/navigation';

interface DebateInitializerProps {
  onDebateSelect: (debateId: string) => void;
}

export default function DebateInitializer({ onDebateSelect }: DebateInitializerProps) {
  const searchParams = useSearchParams();
  const debateId = searchParams.get('debateId');

  useEffect(() => {
    if (debateId) {
        console.log("[DebateInitializer] Initializing debate from URL param:", debateId);
        onDebateSelect(debateId);
    }
    // We only want this to run when debateId from the URL changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debateId]);

  // This component doesn't render anything itself
  return null;
} 
'use client';

import { useState, useCallback } from 'react';
import type { ReactionSummary } from './ChatView';

interface ReactionBarProps {
    debateId: string | null;
    speechOriginalIndex: number | undefined;
    reactions: ReactionSummary[]; // Aggregated reactions for this specific speech
    userId: string | null; // ID of the currently logged-in user
    availableEmojis?: string[]; // Optional: Override default emojis
}

const DEFAULT_EMOJIS = ['👍', '❤️', '😂', '🤔', '👎'];

export const ReactionBar = ({
    debateId,
    speechOriginalIndex,
    reactions,
    userId,
    availableEmojis = DEFAULT_EMOJIS,
}: ReactionBarProps) => {
    const [isLoading, setIsLoading] = useState<Record<string, boolean>>({}); // Track loading state per emoji

    const handleReactionClick = useCallback(async (emoji: string) => {
        if (!userId || !debateId || speechOriginalIndex === undefined) {
            console.warn('User not logged in, debateId missing, or speech index missing. Cannot react.');
            // Optionally show a login prompt or disable buttons
            return;
        }

        setIsLoading(prev => ({ ...prev, [emoji]: true }));

        try {
            const response = await fetch('/api/react', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ debate_id: debateId, speech_original_index: speechOriginalIndex, emoji }),
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || 'Failed to update reaction');
            }

            console.log(`Reaction ${result.action}: ${emoji}`);
            // The ChatView's real-time subscription should handle updating the UI
        } catch (error: any) {
            console.error('Error reacting:', error);
            // Optionally show an error message to the user
        } finally {
            setIsLoading(prev => ({ ...prev, [emoji]: false }));
        }
    }, [userId, debateId, speechOriginalIndex]);

    // Create a map for quick lookup of reaction summaries by emoji
    const reactionSummaryMap = new Map(reactions.map(r => [r.emoji, r]));

    return (
        <div className="flex space-x-1 mt-1">
            {availableEmojis.map(emoji => {
                const summary = reactionSummaryMap.get(emoji);
                const count = summary?.count ?? 0;
                const userReacted = summary?.userReacted ?? false;
                const buttonLoading = isLoading[emoji] ?? false;

                // Determine button style based on reaction state
                const baseStyle = "flex items-center px-1.5 py-0.5 rounded-full text-xs transition-colors duration-150 ease-in-out border";
                const reactedStyle = userReacted
                    ? "bg-teal-600/30 border-teal-500 text-teal-200 hover:bg-teal-600/50"
                    : "bg-gray-600/30 border-gray-500 text-gray-300 hover:bg-gray-600/50";
                const disabledStyle = !userId ? "opacity-50 cursor-not-allowed" : "";
                const loadingStyle = buttonLoading ? "opacity-70 animate-pulse" : "";

                return (
                    <button
                        key={emoji}
                        onClick={() => handleReactionClick(emoji)}
                        disabled={!userId || buttonLoading} // Disable if not logged in or loading
                        className={`${baseStyle} ${reactedStyle} ${disabledStyle} ${loadingStyle}`}
                        aria-label={`React with ${emoji}${count > 0 ? `, ${count} reactions` : ''}`}
                        title={!userId ? "Log in to react" : (userReacted ? `Remove ${emoji} reaction` : `React with ${emoji}`)}
                    >
                        <span className="mr-1">{emoji}</span>
                        {count > 0 && (
                            <span className="font-medium">{count}</span>
                        )}
                    </button>
                );
            })}
        </div>
    );
}; 
'use client';

import { useState, useCallback, useEffect, useMemo } from 'react';
import type { ReactionSummary } from './ChatView';

interface ReactionBarProps {
    debateId: string | null;
    speechOriginalIndex: number | undefined;
    reactions: ReactionSummary[]; // Aggregated reactions for this specific speech
    userId: string | null; // ID of the currently logged-in user
    availableEmojis?: string[]; // Optional: Override default emojis
}

const DEFAULT_EMOJIS = ['👍', '❤️', '😂', '🤔', '👎'];
const MAX_REACTIONS_PER_USER = 2; // Define the limit

export const ReactionBar = ({
    debateId,
    speechOriginalIndex,
    reactions: initialReactions, // Rename prop for clarity
    userId,
    availableEmojis = DEFAULT_EMOJIS,
}: ReactionBarProps) => {
    const [isLoading, setIsLoading] = useState<Record<string, boolean>>({});
    // --- Optimistic State ---
    const [optimisticReactions, setOptimisticReactions] = useState<ReactionSummary[]>(initialReactions);
    const [errorEmoji, setErrorEmoji] = useState<string | null>(null); // State to track errors per emoji

    // Keep optimistic state in sync with external prop changes
    useEffect(() => {
        setOptimisticReactions(initialReactions);
        // Clear any previous error state when external data updates
        setErrorEmoji(null);
    }, [initialReactions]);

    // Memoize the map derived from the optimistic state
    const reactionSummaryMap = useMemo(() => {
        return new Map(optimisticReactions.map(r => [r.emoji, r]));
    }, [optimisticReactions]);

    // Calculate current user's reaction count based on optimistic state
    const currentUserReactionCount = useMemo(() => {
        if (!userId) return 0;
        return optimisticReactions.reduce((count, reaction) => {
            return count + (reaction.userReacted ? 1 : 0);
        }, 0);
    }, [optimisticReactions, userId]);
    // --- --- ---

    const handleReactionClick = useCallback(async (emoji: string) => {
        if (!userId || !debateId || speechOriginalIndex === undefined) {
            console.warn('User not logged in, debateId missing, or speech index missing. Cannot react.');
            return;
        }

        const currentSummary = reactionSummaryMap.get(emoji);
        const currentlyReacted = currentSummary?.userReacted ?? false;

        // --- Reaction Limit Check ---
        if (!currentlyReacted && currentUserReactionCount >= MAX_REACTIONS_PER_USER) {
            console.log(`User ${userId} already has ${currentUserReactionCount} reactions. Limit reached.`);
            // Optionally show a brief message/feedback to the user
            alert(`You can only add up to ${MAX_REACTIONS_PER_USER} reactions.`);
            return;
        }
        // --- --- ---

        setIsLoading(prev => ({ ...prev, [emoji]: true }));
        setErrorEmoji(null); // Clear previous errors for this emoji

        // --- Optimistic Update ---
        const previousReactions = optimisticReactions; // Store previous state for potential revert
        setOptimisticReactions(prevReactions => {
            const newReactions = [...prevReactions]; // Clone array
            const reactionIndex = newReactions.findIndex(r => r.emoji === emoji);
            const newReactedState = !currentlyReacted;
            const countChange = newReactedState ? 1 : -1;

            if (reactionIndex > -1) {
                // Update existing summary
                const updatedReaction = { ...newReactions[reactionIndex] };
                updatedReaction.count = Math.max(0, updatedReaction.count + countChange); // Ensure count doesn't go below 0
                updatedReaction.userReacted = newReactedState;
                 // Only remove the reaction summary if the count is 0 AND the user is no longer reacting
                 if (updatedReaction.count === 0 && !updatedReaction.userReacted) {
                    newReactions.splice(reactionIndex, 1);
                } else {
                    newReactions[reactionIndex] = updatedReaction;
                }
            } else if (newReactedState) {
                // Add new summary if reacting for the first time
                newReactions.push({ emoji, count: 1, userReacted: true });
            }
            return newReactions;
        });
        // --- --- ---

        try {
            const response = await fetch('/api/react', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ debate_id: debateId, speech_original_index: speechOriginalIndex, emoji }),
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || 'Failed to update reaction');
            }

            console.log(`Reaction ${result.action}: ${emoji} - API Success`);
            // Successful API call, optimistic state is likely correct.
            // External update via props/useEffect will eventually align if needed.

        } catch (error: any) {
            console.error('Error reacting:', error);
            setErrorEmoji(emoji); // Indicate error for this emoji
            // --- Revert Optimistic Update ---
            setOptimisticReactions(previousReactions);
            // --- --- ---
            // Optionally show a more specific error message to the user
            alert(`Failed to ${currentlyReacted ? 'remove' : 'add'} reaction: ${error.message}`);
        } finally {
            setIsLoading(prev => ({ ...prev, [emoji]: false }));
        }
    }, [userId, debateId, speechOriginalIndex, reactionSummaryMap, optimisticReactions, currentUserReactionCount]); // Added dependencies

    // Create a map for quick lookup of reaction summaries by emoji - Now using memoized version
    // const reactionSummaryMap = new Map(reactions.map(r => [r.emoji, r])); // Removed, using useMemo above

    return (
        <div className="flex space-x-1 mt-1">
            {availableEmojis.map(emoji => {
                // Use the derived map from optimistic state
                const summary = reactionSummaryMap.get(emoji);
                const count = summary?.count ?? 0;
                const userReacted = summary?.userReacted ?? false;
                const buttonLoading = isLoading[emoji] ?? false;
                const hasError = errorEmoji === emoji;

                // --- Determine button disabled state based on limit ---
                const isAtLimit = currentUserReactionCount >= MAX_REACTIONS_PER_USER;
                const isDisabledByLimit = isAtLimit && !userReacted; // Disable adding new ones if at limit
                // --- --- ---

                // Determine button style based on reaction state
                const baseStyle = "flex items-center px-1.5 py-0.5 rounded-full text-xs transition-colors duration-150 ease-in-out border";
                const reactedStyle = userReacted
                    ? "bg-teal-600/30 border-teal-500 text-teal-200 hover:bg-teal-600/50"
                    : "bg-gray-600/30 border-gray-500 text-gray-300 hover:bg-gray-600/50";
                 // Adjust disabled style for limit
                const disabledStyle = (!userId || isDisabledByLimit) ? "opacity-50 cursor-not-allowed" : "";
                const loadingStyle = buttonLoading ? "opacity-70 animate-pulse" : "";
                 const errorStyle = hasError ? "border-red-500 ring-1 ring-red-500" : ""; // Style for error

                return (
                    <button
                        key={emoji}
                        onClick={() => handleReactionClick(emoji)}
                        // Disable if not logged in, loading, or adding new reaction when at limit
                        disabled={!userId || buttonLoading || isDisabledByLimit}
                        className={`${baseStyle} ${reactedStyle} ${disabledStyle} ${loadingStyle} ${errorStyle}`} // Added errorStyle
                        aria-label={`React with ${emoji}${count > 0 ? `, ${count} reactions` : ''}`}
                        title={
                             !userId ? "Log in to react"
                            : isDisabledByLimit ? `Cannot add more than ${MAX_REACTIONS_PER_USER} reactions`
                            : hasError ? "Error processing reaction"
                            : buttonLoading ? "Processing..."
                            : userReacted ? `Remove ${emoji} reaction`
                            : `React with ${emoji}`
                         } // Updated title logic
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
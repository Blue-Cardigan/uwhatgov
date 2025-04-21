'use client';

import { useMemo } from 'react';
import type { ReactionSummary } from './ChatView';

interface ReactionBarProps {
    speechOriginalIndex: number | undefined;
    reactions: ReactionSummary[];
    userId: string | null;
    onReactionClick: (emoji: string) => void;
    availableEmojis?: string[];
    onMouseEnter?: () => void;
    onMouseLeave?: () => void;
}

const DEFAULT_EMOJIS = ['👍', '❤️', '😂', '🤔', '👎'];
const MAX_REACTIONS_PER_USER = 2;

export const ReactionBar = ({
    speechOriginalIndex,
    reactions,
    userId,
    onReactionClick,
    availableEmojis = DEFAULT_EMOJIS,
    onMouseEnter,
    onMouseLeave,
}: ReactionBarProps) => {
    const reactionSummaryMap = useMemo(() => {
        return new Map(reactions.map(r => [r.emoji, r]));
    }, [reactions]);

    const currentUserReactionCount = useMemo(() => {
        if (!userId) return 0;
        return reactions.reduce((count, reaction) => {
            return count + (reaction.userReacted ? 1 : 0);
        }, 0);
    }, [reactions, userId]);

    return (
        <div
            className="flex space-x-1 mt-1"
            onMouseEnter={onMouseEnter}
            onMouseLeave={onMouseLeave}
        >
            {availableEmojis.map(emoji => {
                const summary = reactionSummaryMap.get(emoji);
                const count = summary?.count ?? 0;
                const userReacted = summary?.userReacted ?? false;
                const buttonLoading = false;
                const hasError = false;

                const isAtLimit = currentUserReactionCount >= MAX_REACTIONS_PER_USER;
                const isDisabledByLimit = isAtLimit && !userReacted;

                const baseStyle = "flex items-center px-1.5 py-0.5 rounded-full text-xs transition-colors duration-150 ease-in-out border";
                const reactedStyle = userReacted
                    ? "bg-teal-600/30 border-teal-500 text-teal-200 hover:bg-teal-600/50"
                    : count > 0
                        ? "bg-gray-600/30 border-gray-500 text-gray-300 hover:bg-gray-600/50"
                        : "bg-transparent border-gray-600 text-gray-400 hover:bg-gray-700/50 hover:border-gray-500";

                const disabledStyle = (!userId || isDisabledByLimit) ? "opacity-50 cursor-not-allowed" : "";
                const loadingStyle = buttonLoading ? "opacity-70 animate-pulse" : "";
                const errorStyle = hasError ? "border-red-500 ring-1 ring-red-500" : "";

                const showCount = count > 0;

                return (
                    <button
                        key={emoji}
                        onClick={() => onReactionClick(emoji)}
                        disabled={!userId || buttonLoading || isDisabledByLimit}
                        className={`${baseStyle} ${reactedStyle} ${disabledStyle} ${loadingStyle} ${errorStyle}`}
                        aria-label={`React with ${emoji}${count > 0 ? `, ${count} reactions` : ''}`}
                        title={
                            !userId ? "Log in to react"
                            : isDisabledByLimit ? `Cannot add more than ${MAX_REACTIONS_PER_USER} reactions`
                            : hasError ? "Error processing reaction"
                            : buttonLoading ? "Processing..."
                            : userReacted ? `Remove ${emoji} reaction`
                            : `React with ${emoji}`
                        }
                    >
                        <span className={`mr-1 ${!showCount ? 'ml-0.5' : ''}`}>{emoji}</span>
                        {showCount && (
                            <span className="font-medium">{count}</span>
                        )}
                    </button>
                );
            })}
        </div>
    );
}; 
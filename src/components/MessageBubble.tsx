import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image"; // Import next/image
import { DebateResponse } from "@/lib/hansard/types";
import { Speech, ReactionSummary } from "./ChatView";
import { getPartyColorClass } from "@/lib/partyColors";
import { ReactionBar } from './ReactionBar'; // Import ReactionBar
import Link from "next/link";

// MessageBubble component
interface MessageBubbleProps {
    speech: Speech;
    onClick: () => void;
    isSelected: boolean;
    originalDebate: DebateResponse | null;
    searchQuery: string;
    isHighlighted: boolean;
    itemRef: (el: HTMLDivElement | null) => void; // Ref callback
    partyAbbreviation?: string | null;
    // --- Reaction Props --- NEW
    debateId: string | null; // Can be null if no debate selected
    reactions: ReactionSummary[];
    userId: string | null;
    // --- End Reaction Props ---
}

// Define type for the response from our members API endpoint
interface MemberInfo {
    id: number;
    name: string;
    party: string;
    constituency: string;
    portraitUrl: string;
  }

// Helper function to escape regex characters
function escapeRegExp(string: string): string {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

// Helper function to highlight search matches
export const HighlightedText = ({ text, query }: { text: string; query: string }) => {
    if (!query || !text) {
      return <>{text}</>;
    }
    const regex = new RegExp(`(${escapeRegExp(query)})`, 'gi');
    const parts = text.split(regex);

    return (
      <>
        {parts.map((part, i) =>
          regex.test(part) ? (
            <mark key={i} className="bg-yellow-400 text-black rounded px-0.5">
              {part}
            </mark>
          ) : (
            part
          )
        )}
      </>
    );
};

export const MessageBubble = ({ speech, onClick, isSelected, originalDebate, searchQuery, isHighlighted, itemRef, partyAbbreviation, debateId, reactions, userId }: MessageBubbleProps) => {
    const isOwnMessage = false;
    const memberId = (typeof speech.originalIndex === 'number' && originalDebate?.Items)
        ? originalDebate.Items.find(item => item.OrderInSection === speech.originalIndex)?.MemberId
        : null;
    const portraitUrl = memberId
        ? `https://members-api.parliament.uk/api/Members/${memberId}/Portrait?cropType=OneOne`
        : null;

    // --- Infobox State ---
    const [isInfoboxVisible, setIsInfoboxVisible] = useState(false);
    const [memberInfo, setMemberInfo] = useState<MemberInfo | null>(null);
    const [isLoadingInfo, setIsLoadingInfo] = useState(false);
    const [errorInfo, setErrorInfo] = useState<string | null>(null);
    const fetchAbortControllerRef = useRef<AbortController | null>(null);
    const infoboxRef = useRef<HTMLDivElement>(null); // Ref for the infobox itself
    const bubbleRef = useRef<HTMLDivElement>(null); // Ref for the main bubble div
    const reactionContainerRef = useRef<HTMLDivElement>(null); // NEW: Ref for the reaction bar container
    // --- Popover State ---
    const [isSignUpPopoverVisible, setisSignUpPopoverVisible] = useState(false);
    // --- --- ---

    const baseClasses = "rounded-lg px-3 py-2 max-w-xs sm:max-w-sm md:max-w-md shadow-md cursor-pointer transition-colors duration-200 ease-in-out relative";
    const alignment = isOwnMessage ? 'justify-end' : 'justify-start';
    const colors = isOwnMessage
        ? (isSelected ? 'bg-[#007a65] text-white ring-2 ring-teal-300' : 'bg-[#005c4b] text-white hover:bg-[#007a65]')
        : (isSelected ? 'bg-[#2a3942] text-gray-100 ring-2 ring-teal-300' : 'bg-[#202c33] text-gray-200 hover:bg-[#2a3942]');

    const highlightRing = isHighlighted ? 'ring-4 ring-yellow-500 ring-offset-2 ring-offset-[#0c1317]' : '';

    // --- Infobox Logic ---
    const fetchMemberInfo = useCallback(async () => {
        if (!memberId || memberInfo || isLoadingInfo) return; // Don't fetch if no ID, already loaded, or currently loading

        setIsLoadingInfo(true);
        setErrorInfo(null);
        fetchAbortControllerRef.current?.abort();
        const abortController = new AbortController();
        fetchAbortControllerRef.current = abortController;

        console.log(`[Infobox] Fetching info for member ${memberId}`);
        try {
            const response = await fetch(`/api/members/${memberId}`, {
                signal: abortController.signal,
            });
            if (!response.ok) {
                let errorMsg = `Failed: ${response.status}`;
                try { const errData = await response.json(); errorMsg = errData.error || errorMsg; } catch (_e: any) {}
                throw new Error(errorMsg);
            }
            const data: MemberInfo = await response.json();
            if (!abortController.signal.aborted) {
                 setMemberInfo(data);
            }
        } catch (error: any) {
            if (error.name !== 'AbortError') {
                console.error(`[Infobox] Error fetching member ${memberId}:`, error);
                setErrorInfo(error.message || 'Failed to load details');
                 setIsInfoboxVisible(true); // Keep infobox open to show error
            }
        } finally {
            if (!abortController.signal.aborted) {
                 setIsLoadingInfo(false);
                 fetchAbortControllerRef.current = null;
            }
        }
    }, [memberId, memberInfo, isLoadingInfo]);

    const handleInfoboxToggle = useCallback((event: React.MouseEvent) => {
        event.stopPropagation(); // Prevent bubble click
        const shouldShow = !isInfoboxVisible;
        setIsInfoboxVisible(shouldShow);

        if (shouldShow && memberId && !memberInfo) { // Fetch only if showing and data not loaded
             fetchMemberInfo();
        }

        // Abort fetch if closing
        if (!shouldShow) {
            fetchAbortControllerRef.current?.abort();
        }
    }, [isInfoboxVisible, memberId, memberInfo, fetchMemberInfo]);

    // Effect to handle clicks outside the infobox to close it
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (infoboxRef.current && !infoboxRef.current.contains(event.target as Node)) {
                setIsInfoboxVisible(false);
                fetchAbortControllerRef.current?.abort(); // Abort fetch if clicking outside
            }
        };

        if (isInfoboxVisible) {
            document.addEventListener('mousedown', handleClickOutside);
        } else {
            document.removeEventListener('mousedown', handleClickOutside);
        }

        // Cleanup listener on component unmount or when infobox closes
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isInfoboxVisible]); // Re-run effect when isInfoboxVisible changes

    // --- Bubble Click Handler ---
    const handleBubbleClick = () => {
        // Always call onClick to select the message and show the original panel
        onClick();
    };
    // --- --- ---

    // --- Simple Reaction Display (for unauthenticated users) --- RE-ADDED
    const SimpleReactionDisplay = () => {
        // Filter reactions to only show those with count > 0
        const visibleReactions = reactions.filter(r => r.count > 0);
        if (visibleReactions.length === 0) return null; // Don't render if no reactions have counts > 0

        return (
            <div className={`flex w-full ${isOwnMessage ? 'justify-end' : 'justify-start pl-10 pr-0 sm:pl-10 sm:pr-0'} -mt-1`}>
                <div className="max-w-xs sm:max-w-sm md:max-w-md flex space-x-1 mt-1">
                    {visibleReactions.map(({ emoji, count }) => (
                        <div key={emoji} className="flex items-center px-1.5 py-0.5 rounded-full text-xs bg-gray-600/30 border border-gray-500 text-gray-300">
                            <span className="mr-1">{emoji}</span>
                            <span className="font-medium">{count}</span>
                        </div>
                    ))}
                </div>
            </div>
        );
    };
    // --- --- ---

    return (
        // Wrapper div containing portrait, bubble, and reaction bar/display
        <div ref={itemRef} className={`flex flex-col mb-3 ${isOwnMessage ? 'items-end' : 'items-start'} rounded-lg transition-all duration-150 ease-in-out`}>
            {/* Row for Portrait + Bubble Content */}
            <div className={`flex gap-2 w-full ${alignment}`}>
                {!isOwnMessage && (
                    // Portrait container - onClick here toggles infobox
                    <div
                        className="flex-shrink-0 w-8 h-8 mt-1 relative cursor-pointer self-start" // Align portrait to top
                        onClick={handleInfoboxToggle}
                    >
                        {portraitUrl ? (
                            <Image
                                src={portraitUrl}
                                alt={speech.speaker || 'Speaker'}
                                width={32}
                                height={32}
                                className="rounded-full w-full h-full object-cover bg-gray-600 pointer-events-none"
                            />
                        ) : (
                            <div className="rounded-full w-full h-full bg-gray-500 flex items-center justify-center text-white text-xs font-semibold pointer-events-none">
                                {speech.speaker?.charAt(0) || '?'}
                            </div>
                        )}
                        {/* --- Infobox Rendering --- */}
                        {isInfoboxVisible && memberId && (
                            <div
                                ref={infoboxRef}
                                className="absolute bottom-full left-0 transform translate-y-35 mb-2 w-64 z-50 p-3 bg-[#2a3942] border border-gray-600 rounded-lg shadow-lg text-sm text-gray-200 whitespace-normal"
                                onClick={(_e) => _e.stopPropagation()}
                            >
                                {isLoadingInfo && <p className="text-center text-gray-400 italic">Loading...</p>}
                                {errorInfo && <p className="text-center text-red-400">Error: {errorInfo}</p>}
                                {memberInfo && (
                                    <div>
                                        <p className="font-semibold text-base mb-1">{memberInfo.name}</p>
                                        <p className="mb-1">{memberInfo.party}</p>
                                        <p className="text-xs text-gray-400">{memberInfo.constituency}</p>
                                    </div>
                                )}
                                {!memberInfo && !isLoadingInfo && !errorInfo && <p className="text-center text-gray-400 italic">Details unavailable.</p>}
                            </div>
                        )}
                        {/* --- --- --- */}
                    </div>
                )}
                {/* Bubble Content - Main click target for selecting speech OR triggering popover */}
                <div ref={bubbleRef} className={`${baseClasses} ${colors} ${highlightRing}`} onClick={handleBubbleClick}>
                    {/* Speaker Name - onClick here toggles infobox */}
                    <div
                        className="inline-block relative cursor-pointer"
                        onClick={handleInfoboxToggle} // Still allow infobox toggle here
                    >
                        <p className={`font-semibold text-sm mb-1 ${getPartyColorClass(partyAbbreviation ?? null)} pointer-events-none`}>
                            <HighlightedText text={speech.speaker || 'Unknown Speaker'} query={searchQuery} />
                        </p>
                    </div>
                    {/* Speech Text */}
                    <p className="text-sm whitespace-pre-wrap"><HighlightedText text={speech.text} query={searchQuery} /></p>
                </div>
                 {/* Add placeholder for own message portrait if needed */} 
                 {isOwnMessage && <div className="w-8 flex-shrink-0"></div>} 
            </div>

            {/* --- Conditional Reaction Display --- */}
            {/* Logic: Authenticated users see ReactionBar if selected OR has reactions. */}
            {/* Unauthenticated users see disabled ReactionBar ONLY if selected, */}
            {/* otherwise see SimpleReactionDisplay if it has reactions */}
            {speech.originalIndex !== undefined && debateId && (
                <>
                    {userId ? (
                        // Authenticated User
                        (isSelected || reactions.length > 0) && (
                            <div className={`flex w-full ${isOwnMessage ? 'justify-end' : 'justify-start pl-10 pr-0 sm:pl-10 sm:pr-0'} -mt-1`}>
                                <div className="max-w-xs sm:max-w-sm md:max-w-md">
                                    <ReactionBar
                                        debateId={debateId}
                                        speechOriginalIndex={speech.originalIndex}
                                        reactions={reactions}
                                        userId={userId}
                                    />
                                </div>
                            </div>
                        )
                    ) : (
                        // Unauthenticated User
                        isSelected ? (
                            // Show disabled ReactionBar when selected
                            <div
                                ref={reactionContainerRef} // Attach the new ref here
                                className={`flex w-full ${isOwnMessage ? 'justify-end' : 'justify-start pl-10 pr-0 sm:pl-10 sm:pr-0'} -mt-1 relative`}
                            >
                                <div className="max-w-xs sm:max-w-sm md:max-w-md">
                                    <ReactionBar
                                        debateId={debateId}
                                        speechOriginalIndex={speech.originalIndex}
                                        reactions={reactions}
                                        userId={null} // Pass null to disable
                                        onMouseEnter={() => setisSignUpPopoverVisible(true)}
                                        onMouseLeave={() => setisSignUpPopoverVisible(false)}
                                    />
                                </div>
                                {isSignUpPopoverVisible && (
                                    <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 w-max p-2 bg-[#2a3942] text-gray-200 text-xs border border-gray-600 rounded-md shadow-lg z-50">
                                        Sign Up&nbsp;to react to this message.
                                    </div>
                                )}
                            </div>
                        ) : (
                            // Show SimpleReactionDisplay when not selected but has reactions
                            reactions.length > 0 && <SimpleReactionDisplay />
                        )
                    )}
                </>
            )}
            {/* --- --- --- */}
        </div>
    );
};
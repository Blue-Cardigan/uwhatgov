import { useCallback, useEffect, useRef } from "react";
import { useState } from "react";
import { DebateResponse } from "@/lib/hansard/types";
import { Speech } from "./ChatView";
import { getPartyColorClass } from "@/lib/partyColors";

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

export const MessageBubble = ({ speech, onClick, isSelected, originalDebate, searchQuery, isHighlighted, itemRef, partyAbbreviation }: MessageBubbleProps) => {
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
                try { const errData = await response.json(); errorMsg = errData.error || errorMsg; } catch (e) {}
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

    return (
        // Main bubble container - onClick here selects the speech
        <div ref={itemRef} className={`flex mb-3 gap-2 ${alignment} rounded-lg transition-all duration-150 ease-in-out`} onClick={onClick}>
            {!isOwnMessage && (
                 // Portrait container - onClick here toggles infobox
                 <div
                    className="flex-shrink-0 w-8 h-8 mt-1 relative cursor-pointer" // Added cursor-pointer
                    onClick={handleInfoboxToggle}
                 >
                    {portraitUrl ? (
                        <img
                            src={portraitUrl}
                            alt={speech.speaker || 'Speaker'}
                            className="rounded-full w-full h-full object-cover bg-gray-600 pointer-events-none" // Disable pointer events on img itself
                        />
                    ) : (
                        <div className="rounded-full w-full h-full bg-gray-500 flex items-center justify-center text-white text-xs font-semibold pointer-events-none"> {/* Disable pointer events */} 
                            {speech.speaker?.charAt(0) || '?'}
                        </div>
                    )}
                    {/* --- Infobox Rendering --- */}
                    {isInfoboxVisible && memberId && (
                        <div
                            ref={infoboxRef} // Add ref to the infobox itself
                            className="absolute bottom-full left-0 transform translate-y-35 mb-2 w-64 z-50 p-3 bg-[#2a3942] border border-gray-600 rounded-lg shadow-lg text-sm text-gray-200 whitespace-normal" // Increased z-index
                            onClick={(e) => e.stopPropagation()} // Prevent clicks inside infobox from closing it
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
            {/* Bubble Content */}
            <div className={`${baseClasses} ${colors} ${highlightRing}`}>
                 {/* Speaker Name - onClick here toggles infobox */} 
                 <div
                    className="inline-block relative cursor-pointer" // Added cursor-pointer
                    onClick={handleInfoboxToggle}
                 >
                    <p className={`font-semibold text-sm mb-1 ${getPartyColorClass(partyAbbreviation ?? null)} pointer-events-none`}>
                        <HighlightedText text={speech.speaker || 'Unknown Speaker'} query={searchQuery} />
                    </p>
                 </div>
                 {/* Speech Text - Clicking here still triggers the main bubble onClick */}
                <p className="text-sm whitespace-pre-wrap"><HighlightedText text={speech.text} query={searchQuery} /></p>
            </div>
        </div>
    );
};
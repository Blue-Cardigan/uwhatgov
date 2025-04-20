'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';

interface SignInPromptPopoverProps {
    isVisible: boolean;
    onClose: () => void;
    targetRef: React.RefObject<HTMLDivElement | null>; // Accept potentially null ref
}

export const SignInPromptPopover = ({ isVisible, onClose, targetRef }: SignInPromptPopoverProps) => {
    const popoverRef = useRef<HTMLDivElement>(null);

    // Close popover if clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
                onClose();
            }
        };

        if (isVisible) {
            document.addEventListener('mousedown', handleClickOutside);
        } else {
            document.removeEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isVisible, onClose]);

    // Basic positioning - adjust as needed
    const getPopoverStyle = (): React.CSSProperties => {
        // Check if targetRef or its current value is null
        if (!targetRef?.current || !popoverRef.current) {
            return { position: 'absolute', visibility: 'hidden' };
        }
        // Position below the target element for simplicity
        const targetRect = targetRef.current.getBoundingClientRect();
         // Calculate position relative to the nearest positioned ancestor (should be the chat container)
        const parentRect = (targetRef.current.offsetParent as HTMLElement)?.getBoundingClientRect() ?? { top: 0, left: 0 };

        return {
            position: 'absolute',
            top: `${targetRect.bottom - parentRect.top + 8}px`, // Below the bubble + 8px margin
            left: `${targetRect.left - parentRect.left}px`, // Align left edge
            zIndex: 50, // Ensure it's above other elements
            visibility: isVisible ? 'visible' : 'hidden',
        };
    };

    if (!isVisible) {
        return null;
    }

    return (
        <div
            ref={popoverRef}
            style={getPopoverStyle()}
            className="w-64 bg-[#2a3942] border border-gray-600 rounded-lg shadow-xl p-4 text-sm text-gray-200"
            onClick={(e) => e.stopPropagation()} // Prevent clicks inside from closing it via the outside listener
        >
            <p className="mb-3 text-center">Sign in or sign up to react to messages.</p>
            <div className="flex justify-around">
                {/* Update hrefs to your actual auth pages */}
                <Link href="/login" legacyBehavior>
                    <a className="px-4 py-1 bg-teal-600 hover:bg-teal-700 rounded text-white text-xs font-medium transition-colors">
                        Sign In
                    </a>
                </Link>
                <Link href="/signup" legacyBehavior>
                    <a className="px-4 py-1 bg-blue-600 hover:bg-blue-700 rounded text-white text-xs font-medium transition-colors">
                        Sign Up
                    </a>
                </Link>
            </div>
            <button
                onClick={onClose}
                className="absolute top-1 right-1 text-gray-400 hover:text-gray-200"
                aria-label="Close"
            >
                &times;
            </button>
        </div>
    );
}; 
'use client';

import { useState, useEffect } from 'react';

const LOCAL_STORAGE_KEY = 'uwhatgov_cookie_consent';

const CookieConsentBanner: React.FC = () => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Check if consent has already been given/denied
    try {
      const consentStatus = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (!consentStatus) {
        setIsVisible(true);
      }
    } catch (error) {
        // localStorage might be unavailable (e.g., private browsing, SSR)
        console.warn('Could not access localStorage for cookie consent check:', error);
        // Decide fallback behavior - perhaps show banner if unsure?
        setIsVisible(true);
    }
  }, []);

  const handleConsent = (consentType: 'accepted' | 'rejected') => {
    try {
        localStorage.setItem(LOCAL_STORAGE_KEY, consentType);
        setIsVisible(false);
        console.log(`Cookie consent: ${consentType}`);
        // Here you would potentially initialize analytics or other scripts if 'accepted'
        // Or ensure non-essential cookies/scripts are blocked if 'rejected'
    } catch (error) {
        console.error('Could not save cookie consent choice to localStorage:', error);
        // Hide banner anyway to avoid blocking UI, but log error
        setIsVisible(false);
    }
  };

  if (!isVisible) {
    return null;
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-[#202c33] text-gray-300 p-4 shadow-lg z-50 flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-gray-700">
      <p className="text-sm flex-grow">
        We use cookies to enhance your experience. By clicking "Accept All", you agree to our use of cookies. You can manage your preferences by clicking "Reject Non-Essential".
        {/* Optional: Add link to privacy policy */}
        {/* <a href="/privacy-policy" className="underline ml-1 hover:text-white">Learn more</a> */}
      </p>
      <div className="flex gap-3 flex-shrink-0">
        <button
          onClick={() => handleConsent('rejected')}
          className="px-4 py-1.5 bg-gray-600 hover:bg-gray-700 text-white text-sm rounded-md transition-colors"
        >
          Reject Non-Essential
        </button>
        <button
          onClick={() => handleConsent('accepted')}
          className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm rounded-md transition-colors"
        >
          Accept All
        </button>
      </div>
    </div>
  );
};

export default CookieConsentBanner; 
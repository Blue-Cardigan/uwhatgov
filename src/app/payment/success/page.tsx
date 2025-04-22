'use client';

import Link from 'next/link';
import { Suspense, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';

// Success Icon Component
const SuccessIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-16 h-16 text-green-400 mb-4 mx-auto">
    <path fillRule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12Zm13.36-1.814a.75.75 0 1 0-1.06-1.06l-3.103 3.103-1.531-1.531a.75.75 0 0 0-1.06 1.061l2.06 2.06a.75.75 0 0 0 1.06 0l3.634-3.633Z" clipRule="evenodd" />
  </svg>
);

// Extracted client component that uses useSearchParams
const PaymentSuccessContent = () => {
  const searchParams = useSearchParams();
  const session_id = searchParams?.get('session_id');

  useEffect(() => {
    if (session_id) {
      console.log('Checkout Session ID:', session_id);
      // Optional: Verify session status with your backend
      // fetch('/api/stripe/verify-session', { method: 'POST', body: JSON.stringify({ session_id }) })
      //  .then(res => res.json())
      //  .then(data => console.log('Verification result:', data));
    }
  }, [session_id]);

  return (
    <div className="bg-[#202c33] rounded-lg shadow-lg p-8 max-w-sm w-full">
      <SuccessIcon />
      <h1 className="text-2xl font-bold text-green-400 mb-2">Payment Successful!</h1>
      <p className="text-base mb-6 text-gray-300">Thank you for subscribing to the Pro plan.</p>
      {session_id && (
        <p className="text-xs text-gray-400 mb-4">Session ID: <span className="font-mono">{session_id}</span></p>
      )}
      {/* Consistent link style */}
      <Link href="/dashboard" className="text-indigo-400 hover:text-indigo-300 hover:underline text-sm">
        Go back to Dashboard
      </Link>
    </div>
  );
};

// Loading Fallback Component
const LoadingFallback = () => (
  <div className="bg-[#202c33] rounded-lg shadow-lg p-8 max-w-sm w-full text-center">
    <p className="text-gray-300">Loading payment details...</p>
  </div>
);

// Main page component - No longer needs 'use client' directly
const PaymentSuccessPage = () => {
  return (
    // Use the darker chat background, center content
    <div className="container mx-auto p-8 text-center bg-[#0b141a] text-gray-200 min-h-screen flex flex-col justify-center items-center">
      {/* Wrap the client component in Suspense */}
      <Suspense fallback={<LoadingFallback />}>
        <PaymentSuccessContent />
      </Suspense>
    </div>
  );
};

export default PaymentSuccessPage; 
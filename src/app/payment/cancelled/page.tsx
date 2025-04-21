'use client';

import Link from 'next/link';

// Cancelled Icon Component
const CancelledIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-16 h-16 text-red-400 mb-4 mx-auto">
    <path fillRule="evenodd" d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25Zm-1.72 6.97a.75.75 0 1 0-1.06 1.06L10.94 12l-1.72 1.72a.75.75 0 1 0 1.06 1.06L12 13.06l1.72 1.72a.75.75 0 1 0 1.06-1.06L13.06 12l1.72-1.72a.75.75 0 1 0-1.06-1.06L12 10.94l-1.72-1.72Z" clipRule="evenodd" />
  </svg>
);

// Basic cancellation page
const PaymentCancelledPage = () => {
  return (
    // Use the darker chat background, center content
    <div className="container mx-auto p-8 text-center bg-[#0b141a] text-gray-200 min-h-screen flex flex-col justify-center items-center">
      <div className="bg-[#202c33] rounded-lg shadow-lg p-8 max-w-sm w-full">
        <CancelledIcon />
        <h1 className="text-2xl font-bold text-red-400 mb-2">Payment Cancelled</h1>
        <p className="text-base mb-6 text-gray-300">Your checkout session was cancelled.<br/>You have not been charged.</p>
        {/* Consistent link styles */}
        <div className="flex justify-center space-x-4">
          <Link href="/billing" className="text-indigo-400 hover:text-indigo-300 hover:underline text-sm">
            Return to Billing
          </Link>
          <Link href="/dashboard" className="text-indigo-400 hover:text-indigo-300 hover:underline text-sm">
            Go to Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
};

export default PaymentCancelledPage; 
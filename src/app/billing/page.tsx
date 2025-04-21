'use client';

import { useState } from 'react';
import { loadStripe, Stripe } from '@stripe/stripe-js';
import Link from 'next/link';

// Icon Component (Checkmark)
const CheckIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5 text-green-400">
    <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z" clipRule="evenodd" />
  </svg>
);

// Load Stripe outside of the component render to avoid recreating the object on every render
let stripePromise: Promise<Stripe | null>;
const getStripe = () => {
  if (!stripePromise) {
    const publicKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
    if (!publicKey) {
      console.error('Stripe public key is not set in environment variables.');
      return null;
    }
    stripePromise = loadStripe(publicKey);
  }
  return stripePromise;
};

const BillingPage = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubscribe = async () => {
    setIsLoading(true);
    setError(null);

    try {
      // 1. Call your backend to create the checkout session
      const response = await fetch('/api/stripe/create-checkout-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        // Optionally pass user info if needed, though the backend should get it from the session
        // body: JSON.stringify({}),
      });

      if (!response.ok) {
        const { error: apiError } = await response.json();
        throw new Error(apiError || 'Failed to create checkout session');
      }

      const { sessionId } = await response.json();
      if (!sessionId) {
        throw new Error('No session ID returned from backend');
      }

      // 2. Redirect to Stripe Checkout
      const stripe = await getStripe();
      if (!stripe) {
        throw new Error('Stripe.js failed to load.');
      }

      const { error: stripeError } = await stripe.redirectToCheckout({ sessionId });

      // If `redirectToCheckout` fails due to a browser or network error,
      // display the localized error message to your customer.
      if (stripeError) {
        console.error('Stripe redirect error:', stripeError);
        setError(stripeError.message || 'An unexpected error occurred during redirect.');
      }

    } catch (err) {
      console.error('Subscription error:', err);
      const message = err instanceof Error ? err.message : 'An unexpected error occurred.';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    // Use the darker chat background
    <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-[#0b141a] text-gray-200">
      <div className="w-full max-w-md">
        {/* Consistent back link style */}
        <div className="mb-6 text-left">
          <Link href="/dashboard" className="text-indigo-400 hover:text-indigo-300 hover:underline text-sm">
            &larr; Back to Dashboard
          </Link>
        </div>

        {/* Centered content card */}
        <div className="bg-[#202c33] rounded-lg shadow-lg p-6 md:p-8 w-full">
          <h1 className="text-3xl font-bold mb-6 text-center text-gray-100">Upgrade to Pro</h1>

          <div className="text-center mb-6">
            <p className="text-2xl font-semibold text-gray-100">£7.50 <span className="text-base font-normal text-gray-400">/ month</span></p>
            <p className="text-xs text-gray-500 mt-1">Unlock premium features</p>
          </div>

          {/* Feature list with icons */}
          <ul className="space-y-3 mb-8">
            <li className="flex items-start">
              <CheckIcon />
              <span className="ml-2 text-gray-300">More detailed insights & analysis</span>
            </li>
            <li className="flex items-start">
              <CheckIcon />
              <span className="ml-2 text-gray-300">Faster processing times</span>
            </li>
            <li className="flex items-start">
              <CheckIcon />
              <span className="ml-2 text-gray-300">Priority support queue</span>
            </li>
             <li className="flex items-start">
              <CheckIcon />
              <span className="ml-2 text-gray-300">Access to future Pro features</span>
            </li>
            {/* Add other features similarly */}
          </ul>

          <button
            onClick={handleSubscribe}
            disabled={isLoading}
            className={`w-full px-4 py-2.5 text-white font-semibold rounded-md transition-colors duration-200 ${
              isLoading
                ? 'bg-gray-600 cursor-not-allowed'
                : 'bg-indigo-600 hover:bg-indigo-700'
            }`}
          >
            {isLoading ? 'Processing...' : 'Subscribe Now'}
          </button>

          {error && (
            <p className="text-red-400 text-center mt-4 text-sm">Error: {error}</p>
          )}
        </div>

         {/* Optional: Add manage subscription link later */}
         {/* <div className="mt-6 text-center text-gray-500 text-sm">
             <p>Already subscribed?</p>
             <button className="text-indigo-400 hover:underline">Manage your subscription</button>
         </div> */}
      </div>
    </div>
  );
};

export default BillingPage; 
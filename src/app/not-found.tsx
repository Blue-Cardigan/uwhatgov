'use client';

import Image from 'next/image';
import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="flex h-screen w-screen bg-[#0b141a] text-white overflow-hidden">
      {/* Use a wrapper div for the background and apply transform */}
      <div
        className="flex flex-grow flex-col items-center justify-center h-full text-gray-400 transform rotate-180"
        style={{
          backgroundImage: "url('/edited-pattern.svg')",
          backgroundSize: 'contain',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
        }}
      >
        {/* Inner content needs to be rotated back */}
        <div className="text-center bg-[#0b141a] bg-opacity-80 p-10 rounded-lg transform rotate-180">
          <h2 className="text-3xl mt-6 text-gray-300 font-light">404 - Page Not Found</h2>
          <p className="my-4 text-sm text-gray-500">Oops! Looks like this page doesn't exist.</p>
          <Image
            src="/whatguv-crazy.svg"
            alt="UWhatGov Logo - Confused"
            width={200}
            height={200}
            className="text-gray-500 opacity-50 border-b border-gray-600 mx-auto"
          />
          <div className="pt-4 text-xs text-gray-600">
            <Link href="/" className="text-indigo-400 hover:text-indigo-300">
              Go back home?
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
} 
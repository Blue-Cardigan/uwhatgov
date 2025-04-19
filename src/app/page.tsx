'use client';

import { useState } from 'react';
// Removed Link import as it will be handled within ChatList
// Removed InternalDebateSummary import for now, will be moved to ChatList
// Removed local DebateSummary interface and formatDateTime function - already removed

// Import new components
import ChatList from '@/components/ChatList'; // Import the actual component
import ChatView from '@/components/ChatView'; // Import the actual ChatView component

// Import types needed for fetching debate title (optional but good for header)
import { InternalDebateSummary } from '@/types';

export default function Home() {
  // State related to selected chat/debate will be needed here
  const [selectedDebateId, setSelectedDebateId] = useState<string | null>(null);
  // Optional: Store selected debate title for the header
  const [selectedDebateTitle, setSelectedDebateTitle] = useState<string | null>(null);
  const [selectedDebateHouse, setSelectedDebateHouse] = useState<string | null>(null);

  // Existing state and fetch logic will be moved to ChatList component
  // const [debates, setDebates] = useState<InternalDebateSummary[]>([]);
  // const [searchTerm, setSearchTerm] = useState('');
  // const [isLoading, setIsLoading] = useState(true);
  // const [error, setError] = useState<string | null>(null);
  // async function fetchDebates...
  // useEffect(() => { fetchDebates(); }, []);
  // const handleSearch = ...

  // Update handler to store title (requires ChatList to pass more data or fetch here)
  // For simplicity, let's assume ChatList can pass the summary object
  const handleSelectDebate = (debateSummary: InternalDebateSummary) => {
    console.log("Selected Debate:", debateSummary.id, debateSummary.title);
    setSelectedDebateId(debateSummary.id);
    setSelectedDebateTitle(debateSummary.title);
    setSelectedDebateHouse(debateSummary.house); // Store house as well
    // Alternatively, fetch title/details here based on ID
  };

  return (
    // Main container mimicking WhatsApp layout
    <main className="flex h-screen w-screen bg-[#111b21] text-white overflow-hidden">
      {/* Sidebar */}
      <div className="w-full md:w-1/3 lg:w-1/4 border-r border-gray-700 flex flex-col bg-[#111b21]">
        {/* Header/Search is now part of ChatList */}
        {/* <header className="p-4 border-b border-gray-700 bg-[#202c33]">
          <h1 className="text-xl font-semibold text-center">Debates</h1>
        </header> */}
        {/* Use ChatList component */}
        <ChatList onSelectDebate={handleSelectDebate} />
      </div>

      {/* Main Chat View */}
      <div className="flex-grow flex flex-col bg-[#0b141a]" style={{backgroundImage: "url('/whatsapp-bg.png')", backgroundSize: 'contain', backgroundPosition: 'center'}}>
        {selectedDebateId ? (
          <>
            {/* Header for the selected chat/debate */}
            <header className="p-3 border-b border-gray-700 bg-[#202c33] flex items-center gap-3 z-10">
               {/* Placeholder Avatar */}
               <div className="w-10 h-10 bg-gray-600 rounded-full flex-shrink-0"></div>
               <div className="flex-grow">
                  <h2 className="font-semibold text-md text-gray-100">{selectedDebateTitle || `Debate ${selectedDebateId}`}</h2>
                  {/* Optionally show house or other info */}
                  <p className="text-xs text-gray-400">{selectedDebateHouse || 'House details unavailable'}</p>
               </div>
               {/* Placeholder Icons (Search, More options) */}
               <div className="flex gap-4 text-gray-400">
                 {/* Search Icon Placeholder */}
                 <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6 cursor-pointer hover:text-gray-200">
                   <path fillRule="evenodd" d="M10.5 3.75a6.75 6.75 0 1 0 0 13.5 6.75 6.75 0 0 0 0-13.5ZM2.25 10.5a8.25 8.25 0 1 1 14.59 5.28l4.69 4.69a.75.75 0 1 1-1.06 1.06l-4.69-4.69A8.25 8.25 0 0 1 2.25 10.5Z" clipRule="evenodd" />
                 </svg>
                 {/* More Options Icon Placeholder */}
                 <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6 cursor-pointer hover:text-gray-200">
                   <path fillRule="evenodd" d="M10.5 6a1.5 1.5 0 1 1 3 0 1.5 1.5 0 0 1-3 0Zm0 6a1.5 1.5 0 1 1 3 0 1.5 1.5 0 0 1-3 0Zm0 6a1.5 1.5 0 1 1 3 0 1.5 1.5 0 0 1-3 0Z" clipRule="evenodd" />
                 </svg>
               </div>
            </header>
            {/* Use ChatView component */}
            <ChatView debateId={selectedDebateId} />
            {/* Footer (Chat Input Area) */}
            <footer className="p-3 border-t border-gray-700 bg-[#202c33] flex items-center gap-3 z-10">
              {/* Placeholder Icons (Emoji, Attach) */}
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6 text-gray-400 cursor-pointer hover:text-gray-200">
                <path fillRule="evenodd" d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25Zm-2.625 6c-.54 0-.828.419-.936.634a1.96 1.96 0 0 0-.189.866c0 .298.059.605.189.866.108.215.395.634.936.634.54 0 .828-.419.936-.634.13-.26.189-.568.189-.866 0-.298-.059-.605-.189-.866-.108-.215-.395-.634-.936-.634Zm5.25 0c-.54 0-.828.419-.936.634.13-.26.189-.568.189-.866 0-.298-.059-.605-.189-.866-.108-.215-.395-.634-.936-.634.54 0 .828.419.936.634.13.26.189.568.189.866 0 .298-.059.605-.189.866-.108.215-.395.634-.936.634Zm-5.25 6.75c-1.119 0-2.13.3-2.995.817a.75.75 0 0 0 1.06 1.06c.69-.46 1.52-.727 2.435-.727.915 0 1.745.267 2.435.727a.75.75 0 0 0 1.06-1.06c-.865-.517-1.876-.817-2.995-.817Z" clipRule="evenodd" />
              </svg>
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6 text-gray-400 cursor-pointer hover:text-gray-200 transform -rotate-45">
                <path fillRule="evenodd" d="M18.97 3.659a2.25 2.25 0 0 0-3.182 0l-10.94 10.94a2.25 2.25 0 1 0 3.182 3.182L18.97 6.841a2.25 2.25 0 0 0 0-3.182ZM12 15.75a.75.75 0 0 1 .75.75v2.25h2.25a.75.75 0 0 1 0 1.5h-2.25v2.25a.75.75 0 0 1-1.5 0v-2.25h-2.25a.75.75 0 0 1 0-1.5h2.25v-2.25a.75.75 0 0 1 .75-.75Z" clipRule="evenodd" />
              </svg>

              {/* Input Field */}
              <input
                type="text"
                placeholder="Type a message (read-only view)"
                className="flex-grow p-2 rounded-md bg-[#2a3942] text-gray-300 placeholder-gray-500 focus:outline-none"
                disabled // Keep it disabled as we are just viewing debates
              />
              {/* Placeholder Icon (Mic) */}
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6 text-gray-400 cursor-pointer hover:text-gray-200">
                <path d="M8.25 4.5a3.75 3.75 0 1 1 7.5 0v8.25a3.75 3.75 0 1 1-7.5 0V4.5Z" />
                <path d="M6 10.5a.75.75 0 0 1 .75.75v1.5a5.25 5.25 0 1 0 10.5 0v-1.5a.75.75 0 0 1 1.5 0v1.5a6.751 6.751 0 0 1-6 6.709v2.041h3a.75.75 0 0 1 0 1.5h-7.5a.75.75 0 0 1 0-1.5h3v-2.041a6.751 6.751 0 0 1-6-6.709v-1.5A.75.75 0 0 1 6 10.5Z" />
              </svg>
            </footer>
           </>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-gray-400" style={{backgroundImage: "url('/whatsapp-bg.png')", backgroundSize: 'contain', backgroundPosition: 'center'}}>
            {/* Background is applied here too */} 
            <div className="text-center bg-[#0b141a] bg-opacity-80 p-10 rounded-lg">
              {/* Placeholder Image/Icon */}
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-20 h-20 text-gray-500 mx-auto opacity-50">
                 <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 9.75a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H8.25m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H12m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0h-.375M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                 <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 15.75h-7.5"/>
              </svg>

              <h2 className="text-3xl mt-6 text-gray-300 font-light">UWhatGov</h2>
              <p className="mt-4 text-sm text-gray-500">View UK parliamentary debates<br/>formatted like your favourite chat app.</p>
              <div className="mt-8 border-t border-gray-600 pt-4 text-xs text-gray-600">
                Select a debate from the list to start viewing.
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

// Removed old JSX structure

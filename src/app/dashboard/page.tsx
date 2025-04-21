'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import type { Database } from '@/lib/database.types'; // Import Database type
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'; // Import Recharts components

// Updated UserReaction type
type UserReaction = Database['public']['Tables']['reactions_uwhatgov']['Row'] & {
  debate_title?: string;
  speaker?: string; // Added from API
  text?: string;    // Added from API
};

// User-specific stats
interface ReactionStats {
  [emoji: string]: number;
}

// Type for MP reaction counts (matches backend)
interface MPReactionStat {
  speakerName: string;
  memberId?: number;
  displayAs?: string;
  party?: string | null;
  reactionCount: number;
  // Potential Pro fields (example)
  reactionsByEmoji?: { [emoji: string]: number };
}

// Type for global trends point (matches backend)
interface GlobalTrendPoint {
  date: string;
  [emoji: string]: number | string; // date + emoji counts
}

// --- Pro Feature Type: Renamed to RankedDebate ---
// Represents a debate ranked by popularity (total reactions)
interface RankedDebate {
    debateId: string;
    title: string;       // Debate title
    summary?: string;    // Add optional summary field
    reactionCount: number;
    reactionsByEmoji: { [emoji: string]: number };
    link: string;        // Link to the debate page
}

// Updated DashboardData type (matches backend)
interface DashboardData {
  userReactions: UserReaction[];
  userStats: ReactionStats;
  userTotalReactions: number;
  userReactionTrend: GlobalTrendPoint[]; // Updated type

  mostReactedMPs: MPReactionStat[];
  globalReactionTrends: GlobalTrendPoint[];
  emojiColors: { [emoji: string]: string };

  // --- Pro Features Data (Matches updated API) ---
  isProUser?: boolean; // Flag from backend
  availableEmojis?: string[]; // List of all possible emojis for filtering
  // Renamed fields to reflect debate focus
  popularDebatesDaily?: RankedDebate[];
  popularDebatesWeekly?: RankedDebate[];
  popularDebatesMonthly?: RankedDebate[]; // Added monthly
  // Speaker rankings remain the same
  popularSpeakersWeekly?: MPReactionStat[];
  popularSpeakersDaily?: MPReactionStat[];
  popularSpeakersMonthly?: MPReactionStat[]; // Added monthly
}

// Define type for trend view mode
type TrendViewMode = 'user' | 'global';
// Define type for Pro feature timeframes
type ProTimeframe = 'daily' | 'weekly' | 'monthly'; // Added monthly
// Define type for Pro feature filtering mode
type ProFilterMode = 'debate' | 'speaker'; // Renamed 'summary' to 'debate'

// --- CSV Export Helper ---
const exportToCSV = (
    data: RankedDebate[] | MPReactionStat[],
    filterMode: ProFilterMode,
    timeframe: ProTimeframe,
    availableEmojis: string[] = [] // Emojis to include as columns
) => {
    if (!data || data.length === 0) {
        alert('No data available to export.');
        return;
    }

    const now = new Date().toISOString().split('T')[0]; // Get current date for filename
    const filename = `uwhatgov_pro_export_${filterMode}_${timeframe}_${now}.csv`;

    let csvContent = "";
    let headers: string[] = [];

    // Define base headers and sort emojis
    const sortedEmojis = [...availableEmojis].sort();

    if (filterMode === 'debate' && data.length > 0 && 'title' in data[0]) { // Changed from 'summary'
        const debates = data as RankedDebate[]; // Changed from RankedSummary
        headers = ['Rank', 'Debate Title', 'Total Reactions', ...sortedEmojis, 'Summary', 'Debate Link']; // Updated headers: Added Summary
        csvContent += headers.join(',') + '\n';

        debates.forEach((item, index) => {
            const emojiCounts = sortedEmojis.map(emoji => item.reactionsByEmoji?.[emoji] || 0);
            // Escape commas and quotes in text fields
            const escapedTitle = `"${item.title.replace(/"/g, '""')}"`; // Standard CSV quote escaping
            const escapedSummary = item.summary ? `"${item.summary.replace(/"/g, '""')}"` : '' // Escape summary

            // Construct the array with explicit string conversion to satisfy linter
            const rowData = [
                (index + 1).toString(), // Convert number to string
                escapedTitle,           // Already a string
                item.reactionCount.toString(), // Convert number to string
                ...emojiCounts.map(count => count.toString()), // Convert numbers in spread array to strings
                escapedSummary, // Add escaped summary
                item.link || ''         // Already a string or empty string
            ];
            csvContent += rowData.join(',') + '\n'; // Join the array of strings
        });

    } else if (filterMode === 'speaker' && data.length > 0 && 'speakerName' in data[0]) {
        const speakers = data as MPReactionStat[];
        headers = ['Rank', 'Speaker', 'Party', 'Total Reactions', ...sortedEmojis];
        csvContent += headers.join(',') + '\n';

        speakers.forEach((item, index) => {
             const emojiCounts = sortedEmojis.map(emoji => item.reactionsByEmoji?.[emoji] || 0);
             const escapedSpeaker = `"${(item.displayAs || item.speakerName).replace(/"/g, '""')}"`;
             const escapedParty = `"${(item.party || 'N/A').replace(/"/g, '""')}"`;

             const row = [
                 index + 1,
                 escapedSpeaker,
                 escapedParty,
                 item.reactionCount,
                 ...emojiCounts.map(count => count.toString())
             ].join(',');
             csvContent += row + '\n';
        });
    } else {
         alert('Cannot determine data type for export.');
         return;
    }

    // Create Blob and trigger download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    if (link.download !== undefined) { // Feature detection
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', filename);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    } else {
        alert('CSV export is not supported in your browser.');
    }
};

export default function DashboardPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [trendViewMode, setTrendViewMode] = useState<TrendViewMode>('user'); // State for trend toggle

  // --- Pro Feature State ---
  const [isProUser, setIsProUser] = useState(true); // TODO: Get this from API/Auth
  const [proTimeframe, setProTimeframe] = useState<ProTimeframe>('weekly');
  const [proFilterMode, setProFilterMode] = useState<ProFilterMode>('debate'); // Default to 'debate'
  const [proEmojiFilter, setProEmojiFilter] = useState<string | null>(null); // null for all, or specific emoji
  const [showOnlyReacted, setShowOnlyReacted] = useState(true); // Filter for >0 reactions

  useEffect(() => {
    // Redirect if not logged in after auth check
    if (!authLoading && !user) {
      router.push('/'); // Redirect to home or a login page
      return;
    }

    // Fetch data only if logged in
    if (user) {
      const fetchData = async () => {
        setIsLoading(true);
        setError(null);
        try {

          const response = await fetch('/api/dashboard');
          if (!response.ok) {
             const errorData = await response.json().catch(() => ({})); // Try to parse error
             throw new Error(errorData.error || `Failed to fetch dashboard data: ${response.status}`);
          }
          const data: DashboardData = await response.json();
          setDashboardData(data);
          // Set isProUser based on data.isProUser if provided by API, default to false
          setIsProUser(data.isProUser ?? false);

        } catch (err: any) {
          setError(err.message || 'An error occurred');
        } finally {
          setIsLoading(false);
        }
      };

      fetchData();
    }
  }, [user, authLoading, router]);

  // Determine which trend data and emojis to display based on mode
  const trendDataToShow = trendViewMode === 'user' ? dashboardData?.userReactionTrend : dashboardData?.globalReactionTrends;
  const emojisInCurrentTrend = trendDataToShow && trendDataToShow.length > 0
    ? Object.keys(trendDataToShow[0]).filter(key => key !== 'date')
    : [];

  // --- Filter Logic for Pro Features ---
  const getFilteredProData = () => {
    if (!dashboardData) return { debates: [], speakers: [] }; // Changed from summaries

    // Select data based on timeframe
    let debates: RankedDebate[] = [];
    let speakers: MPReactionStat[] = [];

    if (proTimeframe === 'daily') {
      debates = dashboardData.popularDebatesDaily || [];
      speakers = dashboardData.popularSpeakersDaily || [];
    } else if (proTimeframe === 'weekly') {
      debates = dashboardData.popularDebatesWeekly || [];
      speakers = dashboardData.popularSpeakersWeekly || [];
    } else { // monthly
      debates = dashboardData.popularDebatesMonthly || [];
      speakers = dashboardData.popularSpeakersMonthly || [];
    }

    // Apply reaction count filter (>0)
    if (showOnlyReacted) {
      debates = debates.filter(d => d.reactionCount > 0); // Changed from s
      speakers = speakers.filter(mp => mp.reactionCount > 0);
    }

    // Apply specific emoji filter
    if (proEmojiFilter) {
      debates = debates.filter(d => d.reactionsByEmoji && d.reactionsByEmoji[proEmojiFilter] > 0); // Changed from s
      speakers = speakers.filter(mp => mp.reactionsByEmoji && mp.reactionsByEmoji[proEmojiFilter] > 0);
    }

    return { debates, speakers }; // Changed from summaries
  };

  const { debates: filteredDebates, speakers: filteredSpeakers } = getFilteredProData(); // Changed from summaries
  // --- End Filter Logic ---

  if (authLoading || isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-[#111b21] text-white">
        Loading Dashboard...
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-[#111b21] text-red-400">
        <p>Error loading dashboard: {error}</p>
        <Link href="/" className="mt-4 text-indigo-400 hover:text-indigo-300">
          Go back home
        </Link>
      </div>
    );
  }

  if (!user || !dashboardData) {
    // Should have been redirected or showing loading/error
    return null;
  }

  // Helper function for button styles (reusable)
  const getButtonClass = (isActive: boolean) => {
    return `px-3 py-1 rounded-md text-xs sm:text-sm font-medium transition-colors ${isActive
        ? 'bg-indigo-600 text-white'
        : 'bg-[#2a3942] text-gray-300 hover:bg-[#32434e]'
      }`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#111b21] via-[#0c1317] to-[#111b21] text-gray-200 p-4 sm:p-8">
      <header className="mb-10 flex flex-col sm:flex-row justify-between items-start sm:items-center">
        <h1 className="text-3xl font-semibold text-white mb-2 sm:mb-0">Dashboard</h1>
        {/* Pro Badge - Conditionally render if actually Pro */}
        {isProUser && (
          <span className="order-first sm:order-none mb-2 sm:mb-0 sm:ml-4 inline-block bg-yellow-500 text-yellow-900 text-xs font-bold px-2 py-0.5 rounded-full">
            PRO
          </span>
        )}
        <Link href="/" className="text-sm text-indigo-400 hover:text-indigo-300 ml-auto">
          &larr; Back to Debates
        </Link>
      </header>

      {/* Grid Layout for Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-10">

        {/* User Stats Column */}
        <div className="space-y-8">
          {/* Your Activity Section (Existing) */}
          <section className="p-4 sm:p-6 bg-[#202c33] rounded-lg shadow-md">
            <h2 className="text-lg sm:text-xl font-semibold mb-4 text-gray-100 border-b border-gray-700 pb-2">Your Activity</h2>
            <div className="mb-4">
              <p className="text-base sm:text-lg text-gray-300">Total Reactions: <span className="font-bold text-white">{dashboardData.userTotalReactions}</span></p>
            </div>
            {Object.keys(dashboardData.userStats).length > 0 ? (
              <ul className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
                {Object.entries(dashboardData.userStats).map(([emoji, count]) => (
                  <li key={emoji} className="bg-[#2a3942] p-2 sm:p-3 rounded text-center shadow">
                    <span className="text-xl sm:text-2xl mr-1 sm:mr-2">{emoji}</span>
                    <span className="text-base sm:text-lg font-medium text-gray-300">{count}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-gray-400 text-sm sm:text-base">No reaction stats available yet.</p>
            )}
          </section>

          {/* Your Recent Reactions Section (Existing) */}
          <section className="p-4 sm:p-6 bg-[#202c33] rounded-lg shadow-md">
            <h2 className="text-lg sm:text-xl font-semibold mb-4 text-gray-100 border-b border-gray-700 pb-2">Your Recent Reactions</h2>
            {dashboardData.userReactions.length > 0 ? (
              <div className="space-y-3 sm:space-y-4 max-h-96 overflow-y-auto pr-2 styled-scrollbar"> {/* Scrollable List */}
                {dashboardData.userReactions.map((reaction) => (
                  <div key={reaction.id} className="bg-[#2a3942] p-3 sm:p-4 rounded shadow flex justify-between items-start">
                    <div>
                       <p className="text-sm sm:text-base">
                        Reacted with <span className="inline-block bg-gray-700 px-1.5 py-0.5 rounded text-sm mx-1">{reaction.emoji}</span>
                        to <span className="font-medium">{reaction.speaker || 'Unknown Speaker'}</span> in "{reaction.debate_title || 'Unknown Debate'}"
                      </p>
                      {reaction.text && (
                         <p className="text-xs text-gray-400 mt-1 italic">
                           "{reaction.text}"
                         </p>
                      )}
                      <p className="text-xs text-gray-500 mt-1">
                        ({new Date(reaction.created_at).toLocaleString()})
                      </p>
                    </div>
                     {/* Optional: Link to debate/speech if available */}
                     {/* <Link href={`/debate/${reaction.debate_id}#speech-${reaction.speech_original_index}`}>...</Link> */}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-400 text-sm sm:text-base">You haven't reacted to any speeches yet.</p>
            )}
          </section>
        </div>

        {/* Global Stats & Trends Column */}
        <div className="space-y-8">
          {/* Most Reacted-To Speakers Section (Existing) */}
          <section className="p-4 sm:p-6 bg-[#202c33] rounded-lg shadow-md">
            <h2 className="text-lg sm:text-xl font-semibold mb-4 text-gray-100 border-b border-gray-700 pb-2">Most Reacted-To Speakers (All Time)</h2>
            {dashboardData.mostReactedMPs && dashboardData.mostReactedMPs.length > 0 ? (
              <ol className="list-decimal list-inside space-y-2 max-h-96 overflow-y-auto pr-2 styled-scrollbar"> {/* Scrollable List */}
                {dashboardData.mostReactedMPs.slice(0, 10).map((mp, index) => ( // Limit to top 10 for this view
                  <li key={mp.speakerName + index} className="text-sm sm:text-base text-gray-300">
                    <span className="font-semibold text-white">{mp.displayAs || mp.speakerName}</span>
                    {mp.party && <span className="text-xs ml-1 sm:ml-2 px-1.5 py-0.5 rounded bg-gray-600">{mp.party}</span>}
                    <span className="ml-1 sm:ml-2 text-gray-400">({mp.reactionCount} reactions)</span>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-gray-400 text-sm sm:text-base">No speaker reaction data available.</p>
            )}
          </section>

           {/* Combined Reaction Trends Section (Existing) */}
          <section className="p-4 sm:p-6 bg-[#202c33] rounded-lg shadow-md">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 border-b border-gray-700 pb-2 gap-2 sm:gap-0">
              <h2 className="text-lg sm:text-xl font-semibold text-gray-100">Reaction Trends</h2>
              <div className="flex space-x-2">
                 <button onClick={() => setTrendViewMode('user')} className={getButtonClass(trendViewMode === 'user')}>Your Trends</button>
                 <button onClick={() => setTrendViewMode('global')} className={getButtonClass(trendViewMode === 'global')}>Global Trends</button>
              </div>
            </div>
            {trendDataToShow && trendDataToShow.length > 0 && emojisInCurrentTrend.length > 0 ? (
              <div style={{ width: '100%', height: 300 }}> {/* Adjusted height */}
                <ResponsiveContainer>
                  <LineChart
                    data={trendDataToShow}
                    margin={{ top: 5, right: 5, left: -20, bottom: 5 }} // Adjusted margins
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis dataKey="date" stroke="#9ca3af" fontSize={10} tickFormatter={(tick) => tick.slice(5)} />{/* Show MM-DD */}
                    <YAxis stroke="#9ca3af" allowDecimals={false} fontSize={10} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#2a3942', border: 'none', borderRadius: '4px' }}
                      labelStyle={{ color: '#e5e7eb', fontSize: '12px', marginBottom: '4px' }}
                      itemStyle={{ color: '#e5e7eb', fontSize: '12px' }}
                      formatter={(value: number, name: string) => [`${value} ${name}`, null]} // Format tooltip
                      labelFormatter={(label) => `Date: ${label}`} // Format label
                    />
                    <Legend wrapperStyle={{ fontSize: '12px' }} />
                    {emojisInCurrentTrend.map((emoji) => (
                      <Line
                        key={emoji}
                        type="monotone"
                        dataKey={emoji}
                        stroke={dashboardData.emojiColors[emoji] || '#8884d8'} // Use provided color or fallback
                        strokeWidth={2}
                        name={emoji}
                        dot={false}
                        activeDot={{ r: 5 }}
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="text-gray-400 text-sm sm:text-base">No {trendViewMode} trend data available yet.</p>
            )}
          </section>
        </div>
      </div>

      {/* --- Pro Features Section --- */}
      {isProUser && (
        <section className="mt-12 p-4 sm:p-6 bg-[#2a3942] rounded-lg shadow-xl border border-yellow-500/30">
           <h2 className="text-xl sm:text-2xl font-semibold mb-6 text-yellow-400 border-b border-yellow-500/50 pb-2 flex items-center gap-2">
             <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-6 h-6">
               <path fillRule="evenodd" d="M10.868 2.884c-.321-.772-1.415-.772-1.736 0l-1.83 4.401-4.753.381c-.833.067-1.171 1.107-.536 1.651l3.62 3.102-1.106 4.637c-.194.813.691 1.456 1.405 1.02L10 15.591l4.069 2.485c.713.436 1.598-.207 1.404-1.02l-1.106-4.637 3.62-3.102c.635-.544.297-1.584-.536-1.65l-4.752-.382-1.831-4.401Z" clipRule="evenodd" />
             </svg>
             Pro Insights: Popularity Rankings
           </h2>

           {/* Filter Controls */}
           <div className="mb-6 flex flex-wrap gap-4 items-center bg-[#202c33] p-3 rounded-md">
              {/* Timeframe Toggle */}
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-gray-300">Timeframe:</span>
                <button onClick={() => setProTimeframe('daily')} className={getButtonClass(proTimeframe === 'daily')}>Daily</button>
                <button onClick={() => setProTimeframe('weekly')} className={getButtonClass(proTimeframe === 'weekly')}>Weekly</button>
                <button onClick={() => setProTimeframe('monthly')} className={getButtonClass(proTimeframe === 'monthly')}>Monthly</button> {/* Added Monthly Button */}
              </div>

              {/* Content Type Toggle */}
              <div className="flex items-center gap-2">
                 <span className="text-sm font-medium text-gray-300">View:</span>
                 <button onClick={() => setProFilterMode('debate')} className={getButtonClass(proFilterMode === 'debate')}>Debates</button> {/* Changed from Summaries */}
                 <button onClick={() => setProFilterMode('speaker')} className={getButtonClass(proFilterMode === 'speaker')}>Speakers</button>
              </div>

             {/* Emoji Filter Dropdown/Buttons */}
             <div className="flex items-center gap-2">
                <label htmlFor="emojiFilter" className="text-sm font-medium text-gray-300">Filter by Reaction:</label>
                <select
                  id="emojiFilter"
                  value={proEmojiFilter ?? 'all'}
                  onChange={(e) => setProEmojiFilter(e.target.value === 'all' ? null : e.target.value)}
                  className="bg-[#2a3942] border border-gray-600 text-gray-200 text-sm rounded-md focus:ring-indigo-500 focus:border-indigo-500 p-1.5"
                >
                  <option value="all">All Reactions</option>
                  {dashboardData.availableEmojis?.map(emoji => (
                    <option key={emoji} value={emoji}>{emoji}</option>
                  ))}
                </select>
             </div>

             {/* Toggle for >0 Reactions */}
             <div className="flex items-center">
               <input
                 type="checkbox"
                 id="showOnlyReacted"
                 checked={showOnlyReacted}
                 onChange={(e) => setShowOnlyReacted(e.target.checked)}
                 className="w-4 h-4 text-indigo-600 bg-gray-700 border-gray-600 rounded focus:ring-indigo-500 focus:ring-offset-gray-800 focus:ring-2"
               />
               <label htmlFor="showOnlyReacted" className="ml-2 text-sm font-medium text-gray-300">Show only items with reactions {proEmojiFilter ? `(${proEmojiFilter})` : ''}</label>
             </div>

             {/* Export Button */}
             <div className="ml-auto">
                 <button
                   onClick={() => exportToCSV(
                       proFilterMode === 'debate' ? filteredDebates : filteredSpeakers, // Changed from summary
                       proFilterMode,
                       proTimeframe,
                       dashboardData?.availableEmojis
                   )}
                   className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-xs sm:text-sm font-medium rounded-md transition-colors flex items-center gap-1.5"
                   title={`Export current view (${proFilterMode} - ${proTimeframe}) to CSV`}
                  >
                    <svg viewBox="0 0 15 15" xmlns="http://www.w3.org/2000/svg">
                    <path d="M13.5 3.5H14V3.29289L13.8536 3.14645L13.5 3.5ZM10.5 0.5L10.8536 0.146447L10.7071 0H10.5V0.5ZM6.5 6.5V6H6V6.5H6.5ZM6.5 8.5H6V9H6.5V8.5ZM8.5 8.5H9V8H8.5V8.5ZM8.5 10.5V11H9V10.5H8.5ZM10.5 9.5H10V9.70711L10.1464 9.85355L10.5 9.5ZM11.5 10.5L11.1464 10.8536L11.5 11.2071L11.8536 10.8536L11.5 10.5ZM12.5 9.5L12.8536 9.85355L13 9.70711V9.5H12.5ZM2.5 6.5V6H2V6.5H2.5ZM2.5 10.5H2V11H2.5V10.5ZM2 5V1.5H1V5H2ZM13 3.5V5H14V3.5H13ZM2.5 1H10.5V0H2.5V1ZM10.1464 0.853553L13.1464 3.85355L13.8536 3.14645L10.8536 0.146447L10.1464 0.853553ZM2 1.5C2 1.22386 2.22386 1 2.5 1V0C1.67157 0 1 0.671573 1 1.5H2ZM1 12V13.5H2V12H1ZM2.5 15H12.5V14H2.5V15ZM14 13.5V12H13V13.5H14ZM12.5 15C13.3284 15 14 14.3284 14 13.5H13C13 13.7761 12.7761 14 12.5 14V15ZM1 13.5C1 14.3284 1.67157 15 2.5 15V14C2.22386 14 2 13.7761 2 13.5H1ZM9 6H6.5V7H9V6ZM6 6.5V8.5H7V6.5H6ZM6.5 9H8.5V8H6.5V9ZM8 8.5V10.5H9V8.5H8ZM8.5 10H6V11H8.5V10ZM10 6V9.5H11V6H10ZM10.1464 9.85355L11.1464 10.8536L11.8536 10.1464L10.8536 9.14645L10.1464 9.85355ZM11.8536 10.8536L12.8536 9.85355L12.1464 9.14645L11.1464 10.1464L11.8536 10.8536ZM13 9.5V6H12V9.5H13ZM5 6H2.5V7H5V6ZM2 6.5V10.5H3V6.5H2ZM2.5 11H5V10H2.5V11Z" fill="#ffffff"/>
                    </svg>
                    Export CSV
                 </button>
             </div>
           </div>


           {/* Display Area */}
           <div className="grid grid-cols-1 gap-6"> {/* Could be grid-cols-2 later */}
             {proFilterMode === 'debate' && ( // Changed from 'summary'
               <div>
                 <h3 className="text-lg font-semibold text-gray-100 mb-3">
                   Popular Debates ({proTimeframe}) {proEmojiFilter ? ` reacting with ${proEmojiFilter}` : ''}
                 </h3>
                 {filteredDebates.length > 0 ? ( // Changed from filteredSummaries
                   <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2 styled-scrollbar">
                     {filteredDebates.map((debate, index) => ( // Changed from summary
                       <div key={debate.debateId} className="bg-[#202c33] p-3 rounded-md shadow">
                         <p className="text-sm font-medium text-white mb-1">
                           {index + 1}. {debate.title}
                           <span className="text-xs ml-2 text-gray-400">({debate.reactionCount} total reactions)</span>
                         </p>
                         {/* Display Summary if available */}
                         {debate.summary && (
                           <p className="text-xs text-gray-300 italic mb-1">"{debate.summary}"</p>
                         )}
                         {debate.link && <Link href={debate.link} className="text-xs text-indigo-400 hover:underline mt-1 inline-block">View Debate &rarr;</Link>}
                       </div>
                     ))}
                   </div>
                 ) : (
                   <p className="text-gray-400 text-sm">No debates match the current filters.</p>
                 )}
               </div>
             )}

             {proFilterMode === 'speaker' && (
               <div>
                 <h3 className="text-lg font-semibold text-gray-100 mb-3">
                   Popular Speakers ({proTimeframe}) {proEmojiFilter ? ` reacting with ${proEmojiFilter}` : ''}
                  </h3>
                 {filteredSpeakers.length > 0 ? (
                    <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2 styled-scrollbar">
                     {filteredSpeakers.map((speaker, index) => (
                       <div key={speaker.speakerName + index} className="bg-[#202c33] p-3 rounded-md shadow">
                          <p className="text-sm font-medium text-white mb-1">
                            {index + 1}. {speaker.displayAs || speaker.speakerName}
                            {speaker.party && <span className="text-xs ml-1.5 px-1 py-0.5 rounded bg-gray-600">{speaker.party}</span>}
                            <span className="text-xs ml-2 text-gray-400">({speaker.reactionCount} total reactions)</span>
                          </p>
                          {/* Show breakdown by emoji */}
                         <div className="flex flex-wrap gap-x-2 gap-y-1">
                             {speaker.reactionsByEmoji && Object.entries(speaker.reactionsByEmoji)
                               .filter(([, count]) => count > 0)
                               .sort(([, countA], [, countB]) => countB - countA)
                               .map(([emoji, count]) => (
                                  <span key={emoji} className={`text-xs px-1.5 py-0.5 rounded ${proEmojiFilter === emoji ? 'bg-indigo-500 text-white font-bold' : 'bg-gray-600 text-gray-200'}`}>
                                     {emoji} {count}
                                 </span>
                             ))}
                         </div>
                           {/* Optional: Link to speaker profile page if available */}
                       </div>
                     ))}
                    </div>
                 ) : (
                   <p className="text-gray-400 text-sm">No speakers match the current filters.</p>
                 )}
               </div>
             )}
           </div>
        </section>
      )}
      {/* --- End Pro Features Section --- */}


      {/* Add some padding at the bottom */}
      <div className="pb-16"></div>

      {/* TODO: Add CSS for styled-scrollbar if needed */}
       <style jsx>{`
        .styled-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .styled-scrollbar::-webkit-scrollbar-track {
          background: #2a3942; // bg-[#2a3942]
          border-radius: 3px;
        }
        .styled-scrollbar::-webkit-scrollbar-thumb {
          background-color: #4b5563; // gray-600
          border-radius: 3px;
          border: 1px solid #2a3942; // bg-[#2a3942]
        }
        .styled-scrollbar::-webkit-scrollbar-thumb:hover {
          background-color: #6b7280; // gray-500
        }
        /* For Firefox */
        .styled-scrollbar {
          scrollbar-width: thin;
          scrollbar-color: #4b5563 #2a3942;
        }
      `}</style>

    </div>
  );
} 
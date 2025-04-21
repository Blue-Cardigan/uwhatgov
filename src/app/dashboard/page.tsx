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
}

// Type for global trends point (matches backend)
interface GlobalTrendPoint {
  date: string;
  [emoji: string]: number | string; // date + emoji counts
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
}

// Define type for trend view mode
type TrendViewMode = 'user' | 'global';

export default function DashboardPage() {
  const { user, loading: authLoading, supabase } = useAuth();
  const router = useRouter();
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [trendViewMode, setTrendViewMode] = useState<TrendViewMode>('user'); // State for toggle

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
          // TODO: Implement the API call
          // const response = await fetch('/api/dashboard');
          // if (!response.ok) {
          //   throw new Error('Failed to fetch dashboard data');
          // }
          // const data: DashboardData = await response.json();
          // setDashboardData(data);

          // --- Placeholder Data ---
          console.log("TODO: Implement API call for dashboard data");
          await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate fetch
          setDashboardData({
              userReactions: [
                  {id: 1, user_id: user.id, debate_id: 'debate1', speech_original_index: 5, emoji: '👍', created_at: new Date().toISOString(), debate_title: 'Sample Debate 1', speaker: 'John Doe', text: 'This is a sample speech'},
                  {id: 2, user_id: user.id, debate_id: 'debate2', speech_original_index: 12, emoji: '😂', created_at: new Date().toISOString(), debate_title: 'Another Sample Debate', speaker: 'Jane Smith', text: 'This is another sample speech'},
              ],
              userStats: { '👍': 5, '😂': 3, '🤔': 2 },
              userTotalReactions: 8,
              userReactionTrend: [
                  { date: '2024-03-01', '👍': 2, '😂': 1 },
                  { date: '2024-03-02', '👍': 3, '😂': 2 },
                  { date: '2024-03-03', '👍': 1, '😂': 1 },
                  { date: '2024-03-04', '👍': 2, '😂': 1 },
                  { date: '2024-03-05', '👍': 3, '😂': 2 },
                  { date: '2024-03-06', '👍': 1, '😂': 1 },
              ],
              mostReactedMPs: [
                  { speakerName: 'John Doe', reactionCount: 5 },
                  { speakerName: 'Jane Smith', reactionCount: 3 },
              ],
              globalReactionTrends: [
                  { date: '2024-03-01', '👍': 2, '😂': 1 },
                  { date: '2024-03-02', '👍': 3, '😂': 2 },
                  { date: '2024-03-03', '👍': 1, '😂': 1 },
                  { date: '2024-03-04', '👍': 2, '😂': 1 },
                  { date: '2024-03-05', '👍': 3, '😂': 2 },
                  { date: '2024-03-06', '👍': 1, '😂': 1 },
              ],
              emojiColors: { '👍': '#818cf8', '😂': '#818cf8' },
          });
          // --- End Placeholder ---
          const response = await fetch('/api/dashboard');
          if (!response.ok) {
             const errorData = await response.json().catch(() => ({})); // Try to parse error
             throw new Error(errorData.error || `Failed to fetch dashboard data: ${response.status}`);
          }
          const data: DashboardData = await response.json();
          setDashboardData(data);

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
  // Get emojis relevant to the current view (user's or global)
  const emojisInCurrentTrend = trendDataToShow && trendDataToShow.length > 0
    ? Object.keys(trendDataToShow[0]).filter(key => key !== 'date')
    : [];

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

  // Helper function for button styles
  const getButtonClass = (mode: TrendViewMode) => {
    return `px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${trendViewMode === mode
        ? 'bg-indigo-600 text-white'
        : 'bg-[#2a3942] text-gray-300 hover:bg-[#32434e]'
      }`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#111b21] via-[#0c1317] to-[#111b21] text-gray-200 p-4 sm:p-8">
      <header className="mb-10 flex justify-between items-center">
        <h1 className="text-3xl font-semibold text-white">Dashboard</h1>
        <Link href="/" className="text-sm text-indigo-400 hover:text-indigo-300">
          &larr; Back to Debates
        </Link>
      </header>

      {/* Grid Layout for Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-10">

        {/* User Stats Column */}
        <div className="space-y-8">
          <section className="p-6 bg-[#202c33] rounded-lg shadow-md">
            <h2 className="text-xl font-semibold mb-4 text-gray-100 border-b border-gray-700 pb-2">Your Activity</h2>
            <div className="mb-4">
              <p className="text-lg text-gray-300">Total Reactions: <span className="font-bold text-white">{dashboardData.userTotalReactions}</span></p>
            </div>
            {Object.keys(dashboardData.userStats).length > 0 ? (
              <ul className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {Object.entries(dashboardData.userStats).map(([emoji, count]) => (
                  <li key={emoji} className="bg-[#2a3942] p-3 rounded text-center shadow">
                    <span className="text-2xl mr-2">{emoji}</span>
                    <span className="text-lg font-medium text-gray-300">{count}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-gray-400">No reaction stats available yet.</p>
            )}
          </section>

          <section className="p-6 bg-[#202c33] rounded-lg shadow-md">
            <h2 className="text-xl font-semibold mb-4 text-gray-100 border-b border-gray-700 pb-2">Your Recent Reactions</h2>
            {dashboardData.userReactions.length > 0 ? (
              <div className="space-y-4 max-h-96 overflow-y-auto pr-2"> {/* Scrollable List */}
                {dashboardData.userReactions.map((reaction) => (
                  <div key={reaction.id} className="bg-[#2a3942] p-4 rounded shadow flex justify-between items-start">
                    <div>
                      <p className="text-base"> {/* Slightly smaller text */}
                        Reacted with <span className="inline-block bg-gray-700 px-1.5 py-0.5 rounded text-sm mx-1">{reaction.emoji}</span>
                        on "{reaction.debate_title}" {/* Title is guaranteed */}
                      </p>
                      {reaction.speaker && (
                        <p className="text-xs text-gray-400 mt-1"> {/* Smaller text */}
                          <span className="font-semibold">{reaction.speaker}:</span>
                          <span className="italic">"{reaction.text || 'Speech text not available'}"</span>
                        </p>
                      )}
                      <p className="text-xs text-gray-500 mt-1">
                        ({new Date(reaction.created_at).toLocaleString()})
                      </p>
                    </div>
                    {/* Optional Link */}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-400">You haven't reacted to any speeches yet.</p>
            )}
          </section>
        </div>

        {/* Global Stats Column */}
        <div className="space-y-8">
          <section className="p-6 bg-[#202c33] rounded-lg shadow-md">
            <h2 className="text-xl font-semibold mb-4 text-gray-100 border-b border-gray-700 pb-2">Most Reacted-To Speakers</h2>
            {dashboardData.mostReactedMPs && dashboardData.mostReactedMPs.length > 0 ? (
              <ol className="list-decimal list-inside space-y-2 max-h-96 overflow-y-auto pr-2"> {/* Scrollable List */}
                {dashboardData.mostReactedMPs.map((mp, index) => (
                  <li key={mp.speakerName + index} className="text-sm text-gray-300"> {/* Smaller text */}
                    <span className="font-semibold text-white">{mp.displayAs || mp.speakerName}</span>
                    {mp.party && <span className="text-xs ml-2 px-1.5 py-0.5 rounded bg-gray-600">{mp.party}</span>}
                    <span className="ml-2 text-gray-400">({mp.reactionCount} reactions)</span>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-gray-400">No speaker reaction data available.</p>
            )}
          </section>

           {/* Combined Reaction Trends Section */}
          <section className="p-6 bg-[#202c33] rounded-lg shadow-md">
            <div className="flex justify-between items-center mb-4 border-b border-gray-700 pb-2">
              <h2 className="text-xl font-semibold text-gray-100">Reaction Trends</h2>
              <div className="flex space-x-2">
                <button onClick={() => setTrendViewMode('user')} className={getButtonClass('user')}>Your Trends</button>
                <button onClick={() => setTrendViewMode('global')} className={getButtonClass('global')}>Global Trends</button>
              </div>
            </div>
            {trendDataToShow && trendDataToShow.length > 0 && emojisInCurrentTrend.length > 0 ? (
              <div style={{ width: '100%', height: 350 }}> {/* Increased height */}
                <ResponsiveContainer>
                  <LineChart
                    data={trendDataToShow}
                    margin={{ top: 5, right: 10, left: -10, bottom: 5 }} // Adjusted margins
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis dataKey="date" stroke="#9ca3af" fontSize={10} />
                    <YAxis stroke="#9ca3af" allowDecimals={false} fontSize={10} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#2a3942', border: 'none' }}
                      labelStyle={{ color: '#e5e7eb' }}
                      itemStyle={{ color: '#e5e7eb' }}
                    />
                    <Legend />
                    {/* Dynamically render lines based on view mode */}
                    {emojisInCurrentTrend.map((emoji) => (
                      <Line
                        key={emoji}
                        type="monotone"
                        dataKey={emoji}
                        stroke={dashboardData.emojiColors[emoji] || '#8884d8'} // Use provided color or fallback
                        strokeWidth={2}
                        name={emoji}
                        dot={false}
                        activeDot={{ r: 6 }}
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="text-gray-400">No {trendViewMode} trend data available yet.</p>
            )}
          </section>
        </div>
      </div>

    </div>
  );
} 
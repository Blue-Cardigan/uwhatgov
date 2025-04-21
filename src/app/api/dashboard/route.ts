import { NextResponse } from 'next/server';
import type { Database } from '@/lib/database.types'; // Adjust path as needed
import { createClient } from '@/lib/supabase/server'; // Import the server client utility

// Define the structure expected within the 'content' JSON field
// Based on the example SQL INSERT provided
interface SpeechContent {
  originalIndex: number;
  speaker: string;
  text: string;
  originalSnippet?: string; // Optional based on example
}

interface DebateContent {
  title: string;
  speeches: SpeechContent[];
}

// User-specific Reaction type
type UserReaction = Database['public']['Tables']['reactions_uwhatgov']['Row'] & {
  debate_title: string; // Make non-optional, provide fallback
  speaker?: string;
  text?: string;
};

// User-specific Stats type
interface ReactionStats {
  [emoji: string]: number;
}

// Type for MP reaction counts
interface MPReactionStat {
  speakerName: string;
  memberId?: number; // Optional: If mapping is successful
  displayAs?: string; // Optional: If mapping is successful
  party?: string | null; // Allow null for party
  reactionCount: number;
}

// Type for global trends (date + counts per emoji)
interface GlobalTrendPoint {
  date: string;
  [emoji: string]: number | string; // date + emoji counts
}

// Updated DashboardData type for API response
interface DashboardData {
  // User-specific data (can potentially be moved later)
  userReactions: UserReaction[]; // Renamed for clarity
  userStats: ReactionStats; // Renamed for clarity
  userTotalReactions: number; // Renamed for clarity
  userReactionTrend: GlobalTrendPoint[]; // Changed type to match global

  // Global data
  mostReactedMPs: MPReactionStat[];
  globalReactionTrends: GlobalTrendPoint[];
  emojiColors: { [emoji: string]: string }; // To help frontend rendering
}

// Helper to generate colors for trend lines
const generateColor = (index: number): string => {
  const colors = ['#8884d8', '#82ca9d', '#ffc658', '#ff7300', '#00C49F', '#FFBB28', '#FF8042', '#a4de6c', '#d0ed57', '#ffc0cb'];
  return colors[index % colors.length];
};

// Define the base Row type for reactions explicitly
type ReactionRow = Database['public']['Tables']['reactions_uwhatgov']['Row'];
// Define the base Row type for members
type MemberRow = Database['public']['Tables']['members']['Row'];

export async function GET() {
  const supabase = createClient();

  try {
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();

    if (sessionError) {
      console.error('Dashboard API: Session Error:', sessionError.message);
      return NextResponse.json({ error: 'Failed to get session' }, { status: 500 });
    }

    if (!session) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const userId = session.user.id;

    // === Fetch Data ===

    // 1. Fetch ALL Reactions (Consider adding date range filter later for performance)
    const { data: allReactionsData, error: allReactionsError } = await supabase
      .from('reactions_uwhatgov')
      .select('id, user_id, debate_id, speech_original_index, emoji, created_at')
      // .gte('created_at', 'YYYY-MM-DD') // Example: Filter by date if needed
      .order('created_at', { ascending: false });

    if (allReactionsError) {
      console.error('Error fetching all reactions:', allReactionsError);
      throw new Error('Failed to fetch all reactions');
    }
    const allReactions: ReactionRow[] = allReactionsData || [];

    // Separate user's reactions for the user-specific part
    const userBaseReactions = allReactions.filter(r => r.user_id === userId).slice(0, 100); // Limit user reactions shown
    const userTotalReactionsCount = userBaseReactions.length;

    // 2. Fetch Debate Content for ALL relevant debates
    const debateContentMap = new Map<string, DebateContent>();
    const allDebateIds = [...new Set(allReactions.map(r => r.debate_id))];

    if (allDebateIds.length > 0) {
        // Fetch in chunks if necessary, though Supabase handles large IN clauses reasonably well
        const { data: debatesData, error: debatesError } = await supabase
            .from('casual_debates_uwhatgov')
            .select('id, content')
            .in('id', allDebateIds);

        if (debatesError) {
            console.error('Error fetching debate content:', debatesError);
            // Handle error - perhaps proceed with partial data?
        } else {
            type DebateContentRow = Pick<Database['public']['Tables']['casual_debates_uwhatgov']['Row'], 'id' | 'content'>;
            debatesData?.forEach((d: DebateContentRow) => {
                if (d.id && d.content) {
                    try {
                        const parsedContent = JSON.parse(d.content) as DebateContent;
                        if (parsedContent && typeof parsedContent.title === 'string' && Array.isArray(parsedContent.speeches)) {
                           debateContentMap.set(d.id, parsedContent);
                        } else {
                            // console.warn(`Parsed content for debate ${d.id} has unexpected structure.`);
                        }
                    } catch (_parseError) {
                        // console.error(`Error parsing content JSON for debate ${d.id}:`, parseError);
                        debateContentMap.set(d.id, { title: 'Content Error', speeches: [] });
                    }
                }
            });
        }
    }

    // 3. Fetch Member Data (Names for mapping) - Fetch potentially relevant members
    // This is inefficient; a better approach might involve a function or optimized query
    // For now, fetch members who might appear as speakers
    const { data: membersData, error: membersError } = await supabase
        .from('members')
        .select('member_id, display_as, party')
        .in('house', ['Commons', 'Lords']); // Fetch MPs and Lords

    if (membersError) {
        console.error('Error fetching members:', membersError);
        // Proceed without member details if this fails
    }
    const membersMap = new Map<string, Pick<MemberRow, 'member_id' | 'party'>>();
    membersData?.forEach(m => {
        if (m.display_as) {
            membersMap.set(m.display_as.toLowerCase(), { member_id: m.member_id, party: m.party });
        }
    });

    // === Process Data ===

    // --- User Specific Data Processing ---
    const userReactionsWithDetails: UserReaction[] = userBaseReactions.map(r => {
        const debateContent = debateContentMap.get(r.debate_id);
        const speech = debateContent?.speeches.find(s => s.originalIndex === r.speech_original_index);
        return {
            ...r,
            debate_title: debateContent?.title || `Debate ID: ${r.debate_id}`, // Provide fallback title
            speaker: speech?.speaker,
            text: speech?.text,
        };
    });

    const userStats: ReactionStats = userReactionsWithDetails.reduce((acc, reaction) => {
        acc[reaction.emoji] = (acc[reaction.emoji] || 0) + 1;
        return acc;
    }, {} as ReactionStats);

    // Calculate User Trend (per emoji per day)
    const userTrendMap = new Map<string, { [emoji: string]: number }>();
    const userUniqueEmojis = new Set<string>(); // Track emojis used by the user
    userReactionsWithDetails.forEach(reaction => {
        const date = reaction.created_at.split('T')[0];
        const emoji = reaction.emoji;
        userUniqueEmojis.add(emoji);

        if (!userTrendMap.has(date)) {
            userTrendMap.set(date, {});
        }
        const dailyCounts = userTrendMap.get(date)!;
        dailyCounts[emoji] = (dailyCounts[emoji] || 0) + 1;
    });

    // Prepare User Reaction Trend Data (sorted by date)
    const userSortedDates = Array.from(userTrendMap.keys()).sort();
    const userReactionTrend: GlobalTrendPoint[] = userSortedDates.map(date => {
        const counts = userTrendMap.get(date)!;
        const trendPoint: GlobalTrendPoint = { date };
        // Ensure all emojis *used by the user* are present for consistency
        userUniqueEmojis.forEach(emoji => {
            trendPoint[emoji] = counts[emoji] || 0;
        });
        return trendPoint;
    });

    // --- Global Data Processing ---
    const speakerReactionCounts: { [speakerName: string]: number } = {};
    const globalTrendMap = new Map<string, { [emoji: string]: number }>();
    const uniqueEmojis = new Set<string>();

    allReactions.forEach(reaction => {
        const debateContent = debateContentMap.get(reaction.debate_id);
        const speech = debateContent?.speeches.find(s => s.originalIndex === reaction.speech_original_index);
        const speakerName = speech?.speaker;

        if (speakerName) {
            speakerReactionCounts[speakerName] = (speakerReactionCounts[speakerName] || 0) + 1;
        }

        // Global Trends
        const date = reaction.created_at.split('T')[0];
        const emoji = reaction.emoji;
        uniqueEmojis.add(emoji);

        if (!globalTrendMap.has(date)) {
            globalTrendMap.set(date, {});
        }
        const dailyCounts = globalTrendMap.get(date)!;
        dailyCounts[emoji] = (dailyCounts[emoji] || 0) + 1;
    });

    // Prepare Most Reacted MPs
    const sortedSpeakers = Object.entries(speakerReactionCounts)
        .sort(([, countA], [, countB]) => countB - countA)
        .slice(0, 15); // Limit to top 15

    const mostReactedMPs: MPReactionStat[] = sortedSpeakers.map(([name, count]) => {
        const memberInfo = membersMap.get(name.toLowerCase());
        return {
            speakerName: name,
            reactionCount: count,
            memberId: memberInfo?.member_id,
            displayAs: name, // Use original name as fallback
            party: memberInfo?.party, // Directly assign (null is now allowed)
        };
    });

    // Prepare Global Reaction Trends
    const sortedDates = Array.from(globalTrendMap.keys()).sort();
    const globalReactionTrends: GlobalTrendPoint[] = sortedDates.map(date => {
        const counts = globalTrendMap.get(date)!;
        const trendPoint: GlobalTrendPoint = { date };
        uniqueEmojis.forEach(emoji => {
            trendPoint[emoji] = counts[emoji] || 0; // Ensure all emojis are present for the date
        });
        return trendPoint;
    });

    // Assign colors to emojis
    const emojiColors: { [emoji: string]: string } = {};
    Array.from(uniqueEmojis).forEach((emoji, index) => {
        emojiColors[emoji] = generateColor(index);
    });

    // === Response ===
    const responseData: DashboardData = {
      userReactions: userReactionsWithDetails,
      userStats: userStats,
      userTotalReactions: userTotalReactionsCount,
      userReactionTrend: userReactionTrend,
      mostReactedMPs: mostReactedMPs,
      globalReactionTrends: globalReactionTrends,
      emojiColors: emojiColors,
    };

    return NextResponse.json(responseData);

  } catch (error: any) {
    console.error('Dashboard API Error:', error.message, error.stack);
    return NextResponse.json({ error: error.message || 'An internal server error occurred' }, { status: 500 });
  }
} 
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
  // --- Pro Feature ---
  reactionsByEmoji?: { [emoji: string]: number };
}

// Type for global trends (date + counts per emoji)
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

  // --- Pro Features Data ---
  isProUser: boolean; // Actual flag based on subscription
  availableEmojis: string[]; // All emojis seen in reactions
  // Renamed fields to reflect debate focus
  popularDebatesDaily: RankedDebate[];
  popularDebatesWeekly: RankedDebate[];
  popularDebatesMonthly: RankedDebate[]; // Added monthly
  // Speaker rankings remain the same
  popularSpeakersWeekly: MPReactionStat[];
  popularSpeakersDaily: MPReactionStat[];
  popularSpeakersMonthly: MPReactionStat[]; // Added monthly
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
// Define the base Row type for subscriptions
type SubscriptionRow = Database['public']['Tables']['subscriptions']['Row'];

// Helper function to get start date for 'daily', 'weekly', and 'monthly'
const getStartDate = (period: 'daily' | 'weekly' | 'monthly'): Date => {
    const now = new Date();
    now.setHours(0, 0, 0, 0); // Set to start of today

    if (period === 'weekly') {
        const dayOfWeek = now.getDay(); // 0 (Sun) - 6 (Sat)
        const diff = now.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1); // Adjust to Monday
        now.setDate(diff);
    } else if (period === 'monthly') {
        now.setDate(1); // Set to the first day of the current month
    }
    // For 'daily', we just use the start of today (already set)
    return now;
};

export async function GET() {
  const supabase = createClient();

  try {
    // Securely get the authenticated user
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError) {
      console.error('Dashboard API: Auth User Error:', userError.message);
      // Return 401 for auth errors, 500 for others potentially?
      return NextResponse.json({ error: 'Authentication failed' }, { status: 401 });
    }

    if (!user) {
      // This case should ideally be caught by the userError block, but double-checking
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const userId = user.id;

    // === Fetch Data ===

    // 1. Fetch User Subscription Status (to determine if Pro)
    let isProUser = true;
    // try {
    //     const { data: subscriptionData, error: subscriptionError } = await supabase
    //         .from('subscriptions')
    //         .select('status, current_period_end')
    //         .eq('user_id', userId)
    //         .in('status', ['active', 'trialing']) // Active or trialing counts as "pro"
    //         .order('created_at', { ascending: false })
    //         .limit(1)
    //         .single(); // Expect only one relevant subscription

    //     if (subscriptionError && subscriptionError.code !== 'PGRST116') { // Ignore 'No rows found' error
    //         console.error('Error fetching subscription:', subscriptionError);
    //         // Decide if this should block the request or just default to non-pro
    //     }

    //     if (subscriptionData) {
    //         // Check if the subscription is active/trialing and hasn't passed its end date
    //         const now = new Date();
    //         const endDate = subscriptionData.current_period_end ? new Date(subscriptionData.current_period_end) : null;
    //         if (endDate && endDate > now) {
    //             isProUser = true;
    //         } else if (!endDate) { // Handle cases where end date might be null for perpetual trials/active states?
    //              isProUser = true; // Assuming null end date means active indefinitely for now
    //         }
    //     }
    // } catch (subError) {
    //     console.error("Error processing subscription data:", subError);
    // }

    // 2. Fetch ALL Reactions (Consider adding date range filter later for performance)
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
    // Recalculate count based on filtered list
    const userTotalReactionsCount = allReactions.filter(r => r.user_id === userId).length;

    // 3. Fetch Debate Content for ALL relevant debates
    const debateContentMap = new Map<string, DebateContent>();
    const allDebateIds = [...new Set(allReactions.map(r => r.debate_id))];

    // Define debatesData type here to make it available later
    type FetchedDebateData = { id: string; content: string | null; summary: string | null; };
    let debatesData: FetchedDebateData[] | null = null;

    // Fetch Debate Content (assign to the declared variable)
    if (allDebateIds.length > 0) {
        const { data: fetchedData, error: debatesError } = await supabase
            .from('casual_debates_uwhatgov')
            .select('id, content, summary')
            .in('id', allDebateIds);

        if (debatesError) {
            console.error('Error fetching debate content:', debatesError);
        } else {
            debatesData = fetchedData; // Assign fetched data
            // Populate the content map (moved parsing here)
            debatesData?.forEach(d => {
                if (d.id && d.content) {
                    try {
                        const parsedContent = JSON.parse(d.content) as DebateContent;
                        if (parsedContent && typeof parsedContent.title === 'string' && Array.isArray(parsedContent.speeches)) {
                            debateContentMap.set(d.id, parsedContent);
                        } else {
                            // console.warn(`Parsed content for debate ${d.id} has unexpected structure.`);
                            debateContentMap.set(d.id, { title: 'Content Error', speeches: [] });
                        }
                    } catch (_parseError) {
                        // console.error(`Error parsing content JSON for debate ${d.id}:`, parseError);
                        debateContentMap.set(d.id, { title: 'Content Error', speeches: [] });
                    }
                }
            });
        }
    }

    // 4. Fetch Member Data (Names for mapping) - Fetch potentially relevant members
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

    // --- Global & Pro Data Processing ---

    const speakerReactionCounts: { [speakerName: string]: { total: number, emojis: { [emoji: string]: number } } } = {};
    const speechReactionCounts: { [speechId: string]: { total: number, emojis: { [emoji: string]: number }, details: { debateId: string, speechIndex: number } } } = {};
    const globalTrendMap = new Map<string, { [emoji: string]: number }>();
    const uniqueEmojis = new Set<string>();

    // --- Pro Feature: Date Filters ---
    const dailyStartDate = getStartDate('daily');
    const weeklyStartDate = getStartDate('weekly');
    const monthlyStartDate = getStartDate('monthly'); // Added monthly start date

    const dailySpeakerCounts: { [speakerName: string]: { total: number, emojis: { [emoji: string]: number } } } = {};
    const weeklySpeakerCounts: { [speakerName: string]: { total: number, emojis: { [emoji: string]: number } } } = {};
    const monthlySpeakerCounts: { [speakerName: string]: { total: number, emojis: { [emoji: string]: number } } } = {}; // Added monthly

    // New: Aggregate reactions per debate ID for different timeframes
    const dailyDebateCounts: { [debateId: string]: { total: number, emojis: { [emoji: string]: number } } } = {};
    const weeklyDebateCounts: { [debateId: string]: { total: number, emojis: { [emoji: string]: number } } } = {};
    const monthlyDebateCounts: { [debateId: string]: { total: number, emojis: { [emoji: string]: number } } } = {}; // Added monthly

    allReactions.forEach(reaction => {
        const debateContent = debateContentMap.get(reaction.debate_id);
        const speech = debateContent?.speeches.find(s => s.originalIndex === reaction.speech_original_index);
        const speakerName = speech?.speaker;
        const speechId = `${reaction.debate_id}-${reaction.speech_original_index}`; // Still useful for potential future features?
        const debateId = reaction.debate_id; // Get the debate ID
        const reactionDate = new Date(reaction.created_at);
        const emoji = reaction.emoji; // Moved emoji definition up

        // --- All Time Speaker Counts (for overall mostReactedMPs) ---
        if (speakerName) {
            if (!speakerReactionCounts[speakerName]) speakerReactionCounts[speakerName] = { total: 0, emojis: {} };
            speakerReactionCounts[speakerName].total += 1;
            speakerReactionCounts[speakerName].emojis[emoji] = (speakerReactionCounts[speakerName].emojis[emoji] || 0) + 1;
        }

        // --- All Time Speech Counts (could be used later, less direct need now) ---
        if (debateContent && speech) {
             if (!speechReactionCounts[speechId]) speechReactionCounts[speechId] = { total: 0, emojis: {}, details: { debateId: reaction.debate_id, speechIndex: reaction.speech_original_index } };
             speechReactionCounts[speechId].total += 1;
             speechReactionCounts[speechId].emojis[emoji] = (speechReactionCounts[speechId].emojis[emoji] || 0) + 1;
        }

        // --- Global Trends & Available Emojis ---
        const date = reaction.created_at.split('T')[0];
        // const emoji = reaction.emoji; // Already defined above
        uniqueEmojis.add(emoji);

        if (!globalTrendMap.has(date)) {
            globalTrendMap.set(date, {});
        }
        const dailyCounts = globalTrendMap.get(date)!;
        dailyCounts[emoji] = (dailyCounts[emoji] || 0) + 1;


        // --- Pro Feature: Daily/Weekly/Monthly Counts ---
        // Daily Counts
        if (reactionDate >= dailyStartDate) {
            if (speakerName) { // Aggregate Speaker Counts
                if (!dailySpeakerCounts[speakerName]) dailySpeakerCounts[speakerName] = { total: 0, emojis: {} };
                dailySpeakerCounts[speakerName].total += 1;
                dailySpeakerCounts[speakerName].emojis[emoji] = (dailySpeakerCounts[speakerName].emojis[emoji] || 0) + 1;
            }
            // Aggregate Debate Counts
            if (!dailyDebateCounts[debateId]) dailyDebateCounts[debateId] = { total: 0, emojis: {} };
            dailyDebateCounts[debateId].total += 1;
            dailyDebateCounts[debateId].emojis[emoji] = (dailyDebateCounts[debateId].emojis[emoji] || 0) + 1;
        }
        // Weekly Counts
        if (reactionDate >= weeklyStartDate) {
             if (speakerName) { // Aggregate Speaker Counts
                if (!weeklySpeakerCounts[speakerName]) weeklySpeakerCounts[speakerName] = { total: 0, emojis: {} };
                weeklySpeakerCounts[speakerName].total += 1;
                weeklySpeakerCounts[speakerName].emojis[emoji] = (weeklySpeakerCounts[speakerName].emojis[emoji] || 0) + 1;
            }
            // Aggregate Debate Counts
             if (!weeklyDebateCounts[debateId]) weeklyDebateCounts[debateId] = { total: 0, emojis: {} };
             weeklyDebateCounts[debateId].total += 1;
             weeklyDebateCounts[debateId].emojis[emoji] = (weeklyDebateCounts[debateId].emojis[emoji] || 0) + 1;
        }
        // Monthly Counts
         if (reactionDate >= monthlyStartDate) {
            if (speakerName) { // Aggregate Speaker Counts
                if (!monthlySpeakerCounts[speakerName]) monthlySpeakerCounts[speakerName] = { total: 0, emojis: {} };
                monthlySpeakerCounts[speakerName].total += 1;
                monthlySpeakerCounts[speakerName].emojis[emoji] = (monthlySpeakerCounts[speakerName].emojis[emoji] || 0) + 1;
            }
            // Aggregate Debate Counts
            if (!monthlyDebateCounts[debateId]) monthlyDebateCounts[debateId] = { total: 0, emojis: {} };
            monthlyDebateCounts[debateId].total += 1;
            monthlyDebateCounts[debateId].emojis[emoji] = (monthlyDebateCounts[debateId].emojis[emoji] || 0) + 1;
        }
    });

    // --- Prepare Most Reacted MPs (All Time) ---
    const sortedSpeakers = Object.entries(speakerReactionCounts)
        .sort(([, countA], [, countB]) => countB.total - countA.total)
        .slice(0, 15); // Limit to top 15

    const mostReactedMPs: MPReactionStat[] = sortedSpeakers.map(([name, counts]) => {
        const memberInfo = membersMap.get(name.toLowerCase());
        return {
            speakerName: name,
            reactionCount: counts.total,
            reactionsByEmoji: counts.emojis, // Add emoji breakdown
            memberId: memberInfo?.member_id,
            displayAs: name, // Use original name as fallback
            party: memberInfo?.party, // Directly assign (null is now allowed)
        };
    });

    // --- Prepare Pro Features Data ---
    const processProData = (
        speakerCounts: { [speakerName: string]: { total: number, emojis: { [emoji: string]: number } } },
        debateCounts: { [debateId: string]: { total: number, emojis: { [emoji: string]: number } } }, // Changed from speechCounts
        fetchedDebatesData: FetchedDebateData[] | null // Use the declared type
    ): { speakers: MPReactionStat[], debates: RankedDebate[] } => { // Changed return type field name

        const sortedProSpeakers = Object.entries(speakerCounts)
            .sort(([, countA], [, countB]) => countB.total - countA.total)
            .slice(0, 20); // Limit Pro results slightly more?

        const popularSpeakers: MPReactionStat[] = sortedProSpeakers.map(([name, counts]) => {
             const memberInfo = membersMap.get(name.toLowerCase());
             return {
                 speakerName: name,
                 reactionCount: counts.total,
                 reactionsByEmoji: counts.emojis,
                 memberId: memberInfo?.member_id,
                 displayAs: name,
                 party: memberInfo?.party,
             };
        });

        // Process Ranked Debates
        const sortedProDebates = Object.entries(debateCounts) // Changed from speechCounts
            .sort(([, countA], [, countB]) => countB.total - countA.total)
            .slice(0, 20); // Limit Pro results

        const popularDebates: RankedDebate[] = sortedProDebates.map(([debateId, counts]) => { // Changed variable name and iteration logic
            const debateContent = debateContentMap.get(debateId);
            // Find the original debate data that includes the summary
            const originalDebateData = fetchedDebatesData?.find(d => d.id === debateId); // Use passed data

            return {
                debateId: debateId,
                title: debateContent?.title || `Debate ID: ${debateId}`, // Get debate title
                summary: originalDebateData?.summary || undefined, // Add the summary, fallback to undefined
                reactionCount: counts.total,
                reactionsByEmoji: counts.emojis,
                link: `/?debateId=${debateId}`, // Link to the debate page
            };
        });

        return { speakers: popularSpeakers, debates: popularDebates }; // Changed field name
    };

    // Generate daily, weekly, and monthly pro data
    const { speakers: popularSpeakersDaily, debates: popularDebatesDaily } = processProData(dailySpeakerCounts, dailyDebateCounts, debatesData);
    const { speakers: popularSpeakersWeekly, debates: popularDebatesWeekly } = processProData(weeklySpeakerCounts, weeklyDebateCounts, debatesData);
    const { speakers: popularSpeakersMonthly, debates: popularDebatesMonthly } = processProData(monthlySpeakerCounts, monthlyDebateCounts, debatesData); // Added monthly

    // --- Prepare Global Reaction Trends (Existing) ---
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
      mostReactedMPs: mostReactedMPs, // All-time stats remain
      globalReactionTrends: globalReactionTrends,
      emojiColors: emojiColors,
      // --- Pro Data ---
      isProUser: isProUser,
      availableEmojis: Array.from(uniqueEmojis).sort(),
      // Update response fields
      popularDebatesDaily: popularDebatesDaily,
      popularDebatesWeekly: popularDebatesWeekly,
      popularDebatesMonthly: popularDebatesMonthly, // Added monthly
      popularSpeakersDaily: popularSpeakersDaily,
      popularSpeakersWeekly: popularSpeakersWeekly,
      popularSpeakersMonthly: popularSpeakersMonthly, // Added monthly
    };

    return NextResponse.json(responseData);

  } catch (error: any) {
    console.error('Dashboard API Error:', error.message, error.stack);
    return NextResponse.json({ error: error.message || 'An internal server error occurred' }, { status: 500 });
  }
} 
import { NextResponse } from 'next/server';
import type { Database } from '@/lib/database.types'; // Adjust path as needed
import { createClient } from '@/lib/supabase/server'; // Import the server client utility

// Define the structure expected within the 'content' JSON field
// Includes title and speeches array
interface DebateContent {
  title: string;
  speeches: SpeechContent[];
}

// Define structure for individual speeches within content
interface SpeechContent {
  originalIndex: number;
  speaker: string;
  text: string;
  originalSnippet?: string; // Optional based on example
}

// Type for fetched debate metadata (used before full parsing)
type FetchedDebateData = {
  id: string;
  content: string | null; // Keep content string for later parsing if needed
  summary: string | null;
};

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
    reactionCount: number; // Total reactions within the period
    reactionsByEmoji: { [emoji: string]: number }; // Aggregate emoji counts for the period
    link: string;        // Link to the debate page
    // --- New field for detailed speech reactions ---
    reactionsBySpeech?: {
        [speechIndex: number]: {
            text: string;
            totalReactions: number;
            emojis: { [emoji: string]: number };
        }
    };
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
// type SubscriptionRow = Database['public']['Tables']['subscriptions']['Row'];

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

// Helper function to safely parse JSON and extract title/speeches
const parseDebateContent = (contentString: string | null, debateId: string): { title: string; speeches: SpeechContent[] } => {
    if (!contentString) {
        // console.warn(`No content string provided for debate ${debateId}`);
        return { title: `Debate ID: ${debateId}`, speeches: [] };
    }
    try {
        const parsed = JSON.parse(contentString) as Partial<DebateContent>;
        const title = typeof parsed.title === 'string' ? parsed.title : `Content Error: ${debateId}`;
        const speeches = Array.isArray(parsed.speeches) ? parsed.speeches : [];
        // Basic validation for speeches structure could be added here if needed
        return { title, speeches };
    } catch (e) {
        // console.error(`Error parsing content JSON for debate ${debateId}:`, e);
        return { title: `Content Error: ${debateId}`, speeches: [] };
    }
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
    let isProUser = false; // Default to false
    try {
        const { data: subscriptionData, error: subscriptionError } = await supabase
            .from('subscriptions')
            .select('status, current_period_end')
            .eq('user_id', userId)
            .in('status', ['active', 'trialing']) // Active or trialing counts as "pro"
            .order('current_period_end', { ascending: false, nullsFirst: false }) // Get the latest relevant one
            .limit(1)
            .maybeSingle(); // Handles 0 or 1 result gracefully

        // Log potential errors, but don't throw if it's just 'No rows found' (PGRST116)
        // or 'Range not satisfiable' (also indicates no rows found often)
        if (subscriptionError && subscriptionError.code !== 'PGRST116') {
            console.error('Dashboard API: Error fetching subscription:', subscriptionError);
            // Fallback: User remains non-pro. Consider if specific errors should block.
        } else if (subscriptionData) {
            // Check if the subscription is active/trialing and hasn't passed its end date
            const now = new Date();
            // Ensure current_period_end is treated as a string before creating a Date
            const endDateStr = subscriptionData.current_period_end;
            const endDate = endDateStr ? new Date(endDateStr) : null;

            // If endDate exists, it must be in the future. If it doesn't exist (e.g. lifetime?), consider it active.
            if (!endDate || endDate > now) {
                isProUser = true;
                console.log(`Dashboard API: User ${userId} identified as Pro. Status: ${subscriptionData.status}, End Date: ${endDateStr}`);
            } else {
                 console.log(`Dashboard API: User ${userId} subscription found but expired. Status: ${subscriptionData.status}, End Date: ${endDateStr}`);
            }
        } else {
             console.log(`Dashboard API: No active/trialing subscription found for user ${userId}.`);
        }
    } catch (subError) {
        console.error("Dashboard API: Unexpected error processing subscription data:", subError);
        // Fallback: User remains non-pro on unexpected errors.
    }

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

    // 3. Fetch *ALL* Debate Metadata (ID, Content, Summary)
    const { data: allDebatesMetadata, error: debatesError } = await supabase
        .from('casual_debates_uwhatgov')
        .select('id, content, summary'); // Fetch necessary fields

    if (debatesError) {
        console.error('Error fetching all debate metadata:', debatesError);
        // Decide how to handle: return error or proceed with empty/partial data?
        // Returning error for now, as debates are crucial for Pro features.
        return NextResponse.json({ error: 'Failed to fetch debate metadata' }, { status: 500 });
    }
    const allFetchedDebates: FetchedDebateData[] = allDebatesMetadata || [];

    // 4. Create Map for Quick Lookup of Debate Content/Summary by ID
    const debateMetadataMap = new Map<string, FetchedDebateData>();
    allFetchedDebates.forEach(d => {
        debateMetadataMap.set(d.id, d);
    });

    // 5. Fetch Member Data (Remains the same)
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
    // Now requires parsing content from the map
    const userReactionsWithDetails: UserReaction[] = userBaseReactions.map(r => {
        const debateMeta = debateMetadataMap.get(r.debate_id);
        const { title, speeches } = parseDebateContent(debateMeta?.content ?? null, r.debate_id); // Use helper
        const speech = speeches.find(s => s.originalIndex === r.speech_original_index);

        return {
            ...r,
            debate_title: title, // Use parsed title
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
    const globalTrendMap = new Map<string, { [emoji: string]: number }>();
    const uniqueEmojis = new Set<string>();

    // --- Pro Feature: Date Filters ---
    const dailyStartDate = getStartDate('daily');
    const weeklyStartDate = getStartDate('weekly');
    const monthlyStartDate = getStartDate('monthly');

    const dailySpeakerCounts: { [speakerName: string]: { total: number, emojis: { [emoji: string]: number } } } = {};
    const weeklySpeakerCounts: { [speakerName: string]: { total: number, emojis: { [emoji: string]: number } } } = {};
    const monthlySpeakerCounts: { [speakerName: string]: { total: number, emojis: { [emoji: string]: number } } } = {};

    // Aggregate reactions per debate ID for different timeframes
    // Updated structure to include reactions by speech
    type DebateCountsForPeriod = {
        [debateId: string]: {
            total: number;
            emojis: { [emoji: string]: number };
            speeches: {
                [index: number]: {
                    text: string;
                    totalReactions: number;
                    emojis: { [emoji: string]: number };
                }
            }
        }
    };

    const dailyDebateCounts: DebateCountsForPeriod = {};
    const weeklyDebateCounts: DebateCountsForPeriod = {};
    const monthlyDebateCounts: DebateCountsForPeriod = {};

    // --- Process ALL Reactions ---
    // Populate speaker counts, global trends, and timed debate/speaker counts
    allReactions.forEach(reaction => {
        const debateMeta = debateMetadataMap.get(reaction.debate_id);
        // Parse content *only if needed* to find the speaker
        let speakerName: string | undefined = undefined;
        let speech: SpeechContent | undefined = undefined;

        if (debateMeta?.content) {
            // Minimal parsing just to find the relevant speech/speaker?
            // For now, full parse via helper is simpler, accept performance hit.
            const { speeches: allSpeechesInDebate } = parseDebateContent(debateMeta.content, reaction.debate_id);
            speech = allSpeechesInDebate.find(s => s.originalIndex === reaction.speech_original_index);
            speakerName = speech?.speaker;
        } else {
            // console.warn(`No debate content found for reaction on debate ${reaction.debate_id}`);
        }

        const debateId = reaction.debate_id;
        const reactionDate = new Date(reaction.created_at);
        const emoji = reaction.emoji;

        // --- All Time Speaker Counts (for overall mostReactedMPs) ---
        if (speakerName) {
            if (!speakerReactionCounts[speakerName]) speakerReactionCounts[speakerName] = { total: 0, emojis: {} };
            speakerReactionCounts[speakerName].total += 1;
            speakerReactionCounts[speakerName].emojis[emoji] = (speakerReactionCounts[speakerName].emojis[emoji] || 0) + 1;
        }

        // --- Global Trends & Available Emojis ---
        const date = reaction.created_at.split('T')[0];
        uniqueEmojis.add(emoji);
        if (!globalTrendMap.has(date)) {
            globalTrendMap.set(date, {});
        }
        const dailyGlobalCounts = globalTrendMap.get(date)!;
        dailyGlobalCounts[emoji] = (dailyGlobalCounts[emoji] || 0) + 1;

        // --- Pro Feature: Daily/Weekly/Monthly Counts --- (Aggregating reactions)
        // Daily Counts
        if (reactionDate >= dailyStartDate) {
            if (speakerName) { // Aggregate Speaker Counts
                if (!dailySpeakerCounts[speakerName]) dailySpeakerCounts[speakerName] = { total: 0, emojis: {} };
                dailySpeakerCounts[speakerName].total += 1;
                dailySpeakerCounts[speakerName].emojis[emoji] = (dailySpeakerCounts[speakerName].emojis[emoji] || 0) + 1;
            }
            // Aggregate Debate Counts
            if (!dailyDebateCounts[debateId]) dailyDebateCounts[debateId] = { total: 0, emojis: {}, speeches: {} };
            dailyDebateCounts[debateId].total += 1;
            dailyDebateCounts[debateId].emojis[emoji] = (dailyDebateCounts[debateId].emojis[emoji] || 0) + 1;

            // Aggregate Speech Reactions - Moved INSIDE the if block
            if (speech) {
                const speechIndex = speech.originalIndex;
                if (!dailyDebateCounts[debateId].speeches[speechIndex]) {
                    dailyDebateCounts[debateId].speeches[speechIndex] = { text: speech.text, totalReactions: 0, emojis: {} };
                }
                dailyDebateCounts[debateId].speeches[speechIndex].totalReactions += 1;
                dailyDebateCounts[debateId].speeches[speechIndex].emojis[emoji] = (dailyDebateCounts[debateId].speeches[speechIndex].emojis[emoji] || 0) + 1;
            }
        }
        // Weekly Counts
        if (reactionDate >= weeklyStartDate) {
             if (speakerName) { // Aggregate Speaker Counts
                if (!weeklySpeakerCounts[speakerName]) weeklySpeakerCounts[speakerName] = { total: 0, emojis: {} };
                weeklySpeakerCounts[speakerName].total += 1;
                weeklySpeakerCounts[speakerName].emojis[emoji] = (weeklySpeakerCounts[speakerName].emojis[emoji] || 0) + 1;
            }
             // Aggregate Debate Counts
             if (!weeklyDebateCounts[debateId]) weeklyDebateCounts[debateId] = { total: 0, emojis: {}, speeches: {} };
             weeklyDebateCounts[debateId].total += 1;
             weeklyDebateCounts[debateId].emojis[emoji] = (weeklyDebateCounts[debateId].emojis[emoji] || 0) + 1;

             // Aggregate Speech Reactions - Moved INSIDE the if block
            if (speech) {
                const speechIndex = speech.originalIndex;
                if (!weeklyDebateCounts[debateId].speeches[speechIndex]) {
                    weeklyDebateCounts[debateId].speeches[speechIndex] = { text: speech.text, totalReactions: 0, emojis: {} };
                }
                weeklyDebateCounts[debateId].speeches[speechIndex].totalReactions += 1;
                weeklyDebateCounts[debateId].speeches[speechIndex].emojis[emoji] = (weeklyDebateCounts[debateId].speeches[speechIndex].emojis[emoji] || 0) + 1;
            }
        }
        // Monthly Counts
         if (reactionDate >= monthlyStartDate) {
            if (speakerName) { // Aggregate Speaker Counts
                if (!monthlySpeakerCounts[speakerName]) monthlySpeakerCounts[speakerName] = { total: 0, emojis: {} };
                monthlySpeakerCounts[speakerName].total += 1;
                monthlySpeakerCounts[speakerName].emojis[emoji] = (monthlySpeakerCounts[speakerName].emojis[emoji] || 0) + 1;
            }
            // Aggregate Debate Counts
            if (!monthlyDebateCounts[debateId]) monthlyDebateCounts[debateId] = { total: 0, emojis: {}, speeches: {} };
            monthlyDebateCounts[debateId].total += 1;
            monthlyDebateCounts[debateId].emojis[emoji] = (monthlyDebateCounts[debateId].emojis[emoji] || 0) + 1;

             // Aggregate Speech Reactions - Moved INSIDE the if block
            if (speech) {
                const speechIndex = speech.originalIndex;
                if (!monthlyDebateCounts[debateId].speeches[speechIndex]) {
                    monthlyDebateCounts[debateId].speeches[speechIndex] = { text: speech.text, totalReactions: 0, emojis: {} };
                }
                monthlyDebateCounts[debateId].speeches[speechIndex].totalReactions += 1;
                monthlyDebateCounts[debateId].speeches[speechIndex].emojis[emoji] = (monthlyDebateCounts[debateId].speeches[speechIndex].emojis[emoji] || 0) + 1;
            }
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
    // This function now needs the full list of debates and the parsed title/summary map
    const processProData = (
        debateCountsForPeriod: DebateCountsForPeriod,
        speakerCountsForPeriod: { [speakerName: string]: { total: number, emojis: { [emoji: string]: number } } },
        allDebatesList: FetchedDebateData[], // Pass the full list fetched earlier
        membersInfoMap: Map<string, Pick<MemberRow, 'member_id' | 'party'>>,
        // No longer need debateContentMap here, use allDebatesList
    ): { speakers: MPReactionStat[], debates: RankedDebate[] } => {

        // 1. Process Debates: Iterate over ALL debates, add counts, then sort
        const allDebatesWithCounts: RankedDebate[] = allDebatesList.map(debate => {
            const counts = debateCountsForPeriod[debate.id];
            // Use the already fetched summary; parse title from content string
            const { title } = parseDebateContent(debate.content, debate.id);

            return {
                debateId: debate.id,
                title: title, // Use parsed title
                summary: debate.summary || undefined,
                reactionCount: counts?.total || 0, // Default to 0 if no reactions in period
                reactionsByEmoji: counts?.emojis || {}, // Default to empty object
                reactionsBySpeech: counts?.speeches, // Include the detailed speech reactions (or undefined if no counts)
                link: `/?debateId=${debate.id}`,
            };
        });

        // Sort the complete list by reaction count
        const popularDebates = allDebatesWithCounts.sort((a, b) => b.reactionCount - a.reactionCount);

        // 2. Process Speakers (Existing logic is okay)
        const sortedProSpeakers = Object.entries(speakerCountsForPeriod)
            .sort(([, countA], [, countB]) => countB.total - countA.total)
            .slice(0, 50); // Keep a reasonable limit

        const popularSpeakers: MPReactionStat[] = sortedProSpeakers.map(([name, counts]) => {
             const memberInfo = membersInfoMap.get(name.toLowerCase());
             return {
                 speakerName: name,
                 reactionCount: counts.total,
                 reactionsByEmoji: counts.emojis,
                 memberId: memberInfo?.member_id,
                 displayAs: name,
                 party: memberInfo?.party,
             };
        });

        return { speakers: popularSpeakers, debates: popularDebates };
    };

    // Generate daily, weekly, and monthly pro data using ALL debates
    const { speakers: popularSpeakersDaily, debates: popularDebatesDaily } = processProData(dailyDebateCounts, dailySpeakerCounts, allFetchedDebates, membersMap);
    const { speakers: popularSpeakersWeekly, debates: popularDebatesWeekly } = processProData(weeklyDebateCounts, weeklySpeakerCounts, allFetchedDebates, membersMap);
    const { speakers: popularSpeakersMonthly, debates: popularDebatesMonthly } = processProData(monthlyDebateCounts, monthlySpeakerCounts, allFetchedDebates, membersMap);

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
      mostReactedMPs: mostReactedMPs,
      globalReactionTrends: globalReactionTrends,
      emojiColors: emojiColors,
      // --- Pro Data ---
      isProUser: isProUser,
      availableEmojis: Array.from(uniqueEmojis).sort(),
      // Update response fields with potentially larger lists (including 0-reaction debates)
      popularDebatesDaily: popularDebatesDaily,
      popularDebatesWeekly: popularDebatesWeekly,
      popularDebatesMonthly: popularDebatesMonthly,
      popularSpeakersDaily: popularSpeakersDaily,
      popularSpeakersWeekly: popularSpeakersWeekly,
      popularSpeakersMonthly: popularSpeakersMonthly,
    };

    return NextResponse.json(responseData);

  } catch (_e) {
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
} 
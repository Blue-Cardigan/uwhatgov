import { NextRequest, NextResponse } from 'next/server';
import { getHansardDebate } from '@/lib/hansardService';
import { generateDebateSummary } from '@/lib/geminiService';
import { createClient } from '@/lib/supabase/client'; // Corrected import
import { DebateContentItem } from '@/lib/hansard/types';

// export const runtime = 'edge'; // Remove edge runtime
export const dynamic = 'force-dynamic';
export const maxDuration = 45; // Allow slightly longer for summary generation

const supabase = createClient(); // Initialize client

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ debateId: string }> } // Updated type for Next.js 15
) {
    const { debateId } = await params; // Await params before accessing debateId

    if (!debateId) {
        return NextResponse.json({ error: 'Missing debateId parameter' }, { status: 400 });
    }

    console.log(`[API Summarize /${debateId}] Received request.`);

    try {
        // --- Check Supabase for existing summary --- 
        console.log(`[API Summarize /${debateId}] Checking cache for summary.`);
        const { data: cachedData, error: cacheError } = await supabase
            .from('casual_debates_uwhatgov')
            .select('summary')
            .eq('id', debateId)
            .maybeSingle();

        if (cacheError) {
            console.error(`[API Summarize /${debateId}] Error checking Supabase cache:`, cacheError);
            // Don't fail the request, just log the error and proceed to generate
        }

        if (cachedData?.summary) {
            console.log(`[API Summarize /${debateId}] Found cached summary.`);
            return NextResponse.json({ summary: cachedData.summary }, { status: 200 });
        }

        console.log(`[API Summarize /${debateId}] No cached summary found, proceeding to generate.`);

        // --- Fetch original debate content --- 
        const originalDebateResponse = await getHansardDebate(debateId);
        console.log(`[API Summarize /${debateId}] Fetched original debate: ${originalDebateResponse.Overview.Title}`);

        // --- Prepare text for Gemini summary --- 
        const debateTitle = originalDebateResponse.Overview.Title || 'Untitled Debate';
        // Combine relevant contributions into a single text block
        const relevantContributionsText = originalDebateResponse.Items
            .filter((item: DebateContentItem) => item.ItemType === 'Contribution' && item.Value)
            .map((item: DebateContentItem) => {
                const speaker = item.AttributedTo || 'Unknown Speaker';
                // Strip HTML for the prompt
                const text = (item.Value || '').replace(/<[^>]*>/g, '').trim();
                return `Speaker: ${speaker}\nText: ${text}\n---`; // Simple format for context
            })
            .join('\n\n');

        if (!relevantContributionsText) {
             console.warn(`[API Summarize /${debateId}] No relevant contributions found to summarize.`);
             return NextResponse.json({ summary: 'No content found to summarize.' }, { status: 200 });
        }

        // 2. Generate summary using Gemini service
        const summary = await generateDebateSummary(relevantContributionsText, debateTitle);
        console.log(`[API Summarize /${debateId}] Summary generated.`);

        // --- Save summary to Supabase --- 
        try {
            console.log(`[API Summarize /${debateId}] Saving summary to cache.`);
            const { error: upsertError } = await supabase
                .from('casual_debates_uwhatgov')
                .upsert(
                    {
                        id: debateId,
                        summary: summary,
                        // Optionally update status or last_updated_at if needed
                        status: 'success', // Assume success if summary was generated
                        last_updated_at: new Date().toISOString(),
                    },
                    { onConflict: 'id' } // Update existing row if ID matches
                );

            if (upsertError) {
                console.error(`[API Summarize /${debateId}] Error saving summary to Supabase:`, upsertError);
                // Log error but still return the summary to the client
            }
        } catch (dbError) {
             console.error(`[API Summarize /${debateId}] Exception during Supabase upsert:`, dbError);
        }

        // 3. Return the summary
        return NextResponse.json({ summary: summary }, { status: 200 });

    } catch (error: any) {
        console.error(`[API Summarize /${debateId}] Failed to generate summary:`, error);
        // Distinguish between fetching error and Gemini error if needed
        const errorMessage = error.message.includes('Gemini API Error')
            ? `Failed to generate summary: ${error.message}`
            : `Failed to fetch debate data for summary: ${error.message}`;
            
        return NextResponse.json({ error: errorMessage }, { status: 500 });
    }
} 
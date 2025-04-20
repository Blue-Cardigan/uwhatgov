import { NextRequest, NextResponse } from 'next/server';
import { getHansardDebate } from '@/lib/hansardService';
import { parsePartyAbbreviation } from '@/lib/partyColors';
import { DebateContentItem } from '@/lib/hansard/types';

export const dynamic = 'force-dynamic'; // Ensure dynamic execution per request
export const runtime = 'edge'; // Use edge runtime if dependencies allow

// Helper function to parse HRSTag into a friendly name
function parseHrsTag(hrsTag: string | null): string {
    if (!hrsTag) return 'Unknown Type';

    switch (hrsTag) {
        case 'NewDebate': return 'Debate';
        case 'hs_2DebBill': return 'Bill Debate';
        case 'hs_2cDebatedMotion': return 'Debated Motion';
        case 'hs_3cOppositionDay': return 'Opposition Day';
        case 'hs_2BusinessWODebate': return 'Business Without Debate';
        case 'hs_2cGenericHdg':
        case 'hs_3cMainHdg': return 'Generic Topic';
        case 'hs_8Petition': return 'Petition';
        case 'hs_2cBillTitle': return 'Bill Reading';
        case 'BigBoldHdg': return 'Bold Header';
        default:
            console.warn(`[API Metadata] Unmapped HRSTag: ${hrsTag}`);
            // Attempt to make a generic name from the tag
            return hrsTag
                .replace(/^hs_\d+[a-z]?/, '') // Remove prefix like hs_2c
                .replace(/([A-Z])/g, ' $1') // Add space before capital letters
                .replace(' Hdg', '')
                .trim() || 'Unknown Type';
    }
}

export interface DebateMetadataResponse {
    location: string;
    contributionCount: number;
    speakerCount: number;
    partyRatios: Record<string, number>; // Party abbreviation -> count
}

// Helper function to calculate speaker count and party ratios
function calculateSpeakerMetadata(items: DebateContentItem[]): { speakerCount: number; partyRatios: Record<string, number> } {
    const contributions = items.filter((item: DebateContentItem) => item.ItemType === 'Contribution' && item.AttributedTo);

    const speakersByName: Record<string, { party: string | null }> = {}; // Fallback tracking by name
    const partyCounts: Record<string, number> = {};                     // Counts speakers per party
    const uniqueMemberIds = new Set<number>();                            // Preferred tracking by ID

    contributions.forEach((item: DebateContentItem) => {
        const speakerName = item.AttributedTo;
        const memberId = item.MemberId;
        let isNewSpeaker = false;

        // Prefer tracking unique speakers by MemberId
        if (memberId !== null) {
            if (!uniqueMemberIds.has(memberId)) {
                uniqueMemberIds.add(memberId);
                isNewSpeaker = true;
            }
        } else if (speakerName && !speakersByName[speakerName]) {
             // Fallback to tracking by name if MemberId is null
            speakersByName[speakerName] = { party: null }; // Party will be parsed below if isNewSpeaker
            isNewSpeaker = true;
        }

        // If it's a newly identified unique speaker, count their party
        if (isNewSpeaker && speakerName) {
            const party = parsePartyAbbreviation(speakerName);
            const partyKey = party || 'Unknown';
            partyCounts[partyKey] = (partyCounts[partyKey] || 0) + 1;
             // Store party in fallback tracker too, though not strictly needed for count if ID exists
             if(speakersByName[speakerName]) speakersByName[speakerName].party = party;
        }
    });

    // Final speaker count based on preferred method
    const speakerCount = uniqueMemberIds.size > 0 ? uniqueMemberIds.size : Object.keys(speakersByName).length;

    // Calculate ratios based on speaker counts per party
    const totalSpeakersForRatio = Object.values(partyCounts).reduce((sum, count) => sum + count, 0);
    const partyRatios: Record<string, number> = {};
    if (totalSpeakersForRatio > 0) {
        for (const [party, count] of Object.entries(partyCounts)) {
            partyRatios[party] = count / totalSpeakersForRatio; // Store ratio (0 to 1)
        }
    }

    return { speakerCount, partyRatios };
}

export async function GET(
    request: NextRequest,
    { params }: { params: { id: string } } // Use id instead of debateId
) {
    const debateId = params.id; // Use params.id

    if (!debateId) {
        return NextResponse.json({ error: 'Missing debate ID parameter' }, { status: 400 });
    }

    console.log(`[API Metadata /${debateId}] Received request.`);

    try {
        const debateData = await getHansardDebate(debateId);

        const location = parseHrsTag(debateData.Overview.HRSTag);
        const contributions = debateData.Items.filter((item: DebateContentItem) => item.ItemType === 'Contribution');
        const contributionCount = contributions.length;
        // Calculate speaker count and ratios using the helper
        const { speakerCount, partyRatios } = calculateSpeakerMetadata(debateData.Items);

        const metadata: DebateMetadataResponse = {
            location,
            contributionCount,
            speakerCount,
            partyRatios
        };

        return NextResponse.json(metadata);

    } catch (error: any) {
        console.error(`[API Metadata /${debateId}] Failed to fetch or process debate metadata:`, error);
        let status = 500;
        if (error.message.includes('404')) status = 404;
        return NextResponse.json({ error: `Failed to get debate metadata: ${error.message}` }, { status });
    }
} 
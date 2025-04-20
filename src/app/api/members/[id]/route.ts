import { NextRequest, NextResponse } from 'next/server';

// Base URL for the Parliament Members API
const MEMBERS_API_BASE = 'https://members-api.parliament.uk/api/Members';

// Simple in-memory cache (replace with Redis/etc. for production)
const memberCache = new Map<number, { data: any; timestamp: number }>();
const CACHE_DURATION_MS = 60 * 60 * 1000; // 1 hour

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const memberId = parseInt(params.id, 10);

  if (isNaN(memberId)) {
    return NextResponse.json({ error: 'Invalid member ID' }, { status: 400 });
  }

  // Check cache
  const cached = memberCache.get(memberId);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION_MS) {
    console.log(`[Cache] HIT for member ${memberId}`);
    return NextResponse.json(cached.data);
  } else if (cached) {
      console.log(`[Cache] STALE for member ${memberId}`);
      memberCache.delete(memberId); // Remove stale entry
  } else {
      console.log(`[Cache] MISS for member ${memberId}`);
  }

  const memberUrl = `${MEMBERS_API_BASE}/${memberId}`;
  console.log(`Fetching member details from: ${memberUrl}`);

  try {
    const apiResponse = await fetch(memberUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
      // Consider cache revalidation strategy if needed
      next: { revalidate: 3600 } // Revalidate cached API response every hour
    });

    if (!apiResponse.ok) {
      // Handle 404 specifically - member might not exist or API changed
      if (apiResponse.status === 404) {
         console.warn(`Members API returned 404 for ID: ${memberId}`);
         return NextResponse.json({ error: 'Member not found' }, { status: 404 });
      }
      const errorText = await apiResponse.text();
      console.error(`Members API Error (${apiResponse.status}) for ID ${memberId}: ${errorText.substring(0, 200)}`);
      return NextResponse.json(
        { error: `Members API Error: ${apiResponse.statusText}` },
        { status: apiResponse.status }
      );
    }

    const data = await apiResponse.json();

    // --- Extract relevant info ---
    // Adjust based on the actual structure of the Members API response
    const memberInfo = {
        id: data.value?.id,
        name: data.value?.nameDisplayAs || 'Unknown Name',
        party: data.value?.latestParty?.name || 'Unknown Party',
        constituency: data.value?.latestHouseMembership?.membershipFrom || 'Unknown Constituency',
        thumbnailUrl: data.value?.thumbnailUrl, // Often null, use Portrait instead
        portraitUrl: `${MEMBERS_API_BASE}/${memberId}/Portrait?cropType=OneOne`, // Use the portrait URL we already know
        // Add more fields if needed and available
    };
    // --- ---

    // Store in cache
    memberCache.set(memberId, { data: memberInfo, timestamp: Date.now() });

    // Return the extracted info
    const response = NextResponse.json(memberInfo);
    // Add CORS headers if needed, though internal API routes might not require it
    response.headers.set('Access-Control-Allow-Origin', '*');
    response.headers.set('Access-Control-Allow-Methods', 'GET');
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type');

    return response;

  } catch (error: any) {
    console.error(`Error fetching member ${memberId}:`, error);
    return NextResponse.json(
      { error: 'Internal Server Error fetching member details', details: error.message },
      { status: 500 }
    );
  }
} 
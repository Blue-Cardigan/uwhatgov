import { NextRequest, NextResponse } from 'next/server';

// Base URL for the Hansard API
const HANSARD_API_BASE = 'https://hansard-api.parliament.uk';

// Define the expected context type (keep for reference)
// interface RouteContext {
//   params: { id: string };
// }

export async function GET(
  request: NextRequest,
  { params }: { params: any } // Destructure directly, use any for params type
) {
  const debateId = params.id as string; // Assert type here if needed

  if (!debateId) {
      return NextResponse.json({ error: 'Debate ID is required' }, { status: 400 });
  }

  const hansardUrl = `${HANSARD_API_BASE}/debates/debate/${debateId}.json`;

  console.log(`Proxying specific debate request to: ${hansardUrl}`);

  try {
    const apiResponse = await fetch(hansardUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
      cache: 'no-store' // Or adjust caching as needed
    });

    if (!apiResponse.ok) {
      const errorText = await apiResponse.text();
      console.error(`Hansard API Error (${apiResponse.status}) for debate ${debateId}: ${errorText}`);
      return NextResponse.json(
        { error: `Hansard API Error: ${apiResponse.statusText}`, details: errorText },
        { status: apiResponse.status }
      );
    }

    const data = await apiResponse.json();

    // Return the successful response from Hansard API
    const response = NextResponse.json(data);
    response.headers.set('Access-Control-Allow-Origin', '*');
    response.headers.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type');

    return response;

  } catch (error: any) {
    console.error(`Error proxying Hansard debate request for ${debateId}:`, error);
    return NextResponse.json(
      { error: 'Internal Server Error while contacting Hansard API', details: error.message },
      { status: 500 }
    );
  }
} 
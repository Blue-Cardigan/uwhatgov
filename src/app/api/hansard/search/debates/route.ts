import { NextRequest, NextResponse } from 'next/server';

// Base URL for the Hansard API
const HANSARD_API_BASE = 'https://hansard-api.parliament.uk';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  // Forward all query parameters (startDate, endDate, house, take, etc.) to the Hansard API search/debates endpoint
  const hansardUrl = `${HANSARD_API_BASE}/search/debates.json?${searchParams.toString()}`;

  console.log(`Proxying search/debates request to: ${hansardUrl}`);

  try {
    const apiResponse = await fetch(hansardUrl, {
        method: 'GET',
        headers: {
            'Accept': 'application/json',
        },
        // Disable caching if needed, or set revalidation strategy
        cache: 'no-store' // Example: Force fresh data for potentially changing daily lists
    });

    if (!apiResponse.ok) {
      const errorText = await apiResponse.text();
      console.error(`Hansard API Error (search/debates - ${apiResponse.status}): ${errorText}`);
      return NextResponse.json(
        { error: `Hansard API Error (search/debates): ${apiResponse.statusText}`, details: errorText },
        { status: apiResponse.status }
      );
    }

    const data = await apiResponse.json();

    // Return the successful response from Hansard API
    const response = NextResponse.json(data);
    // Basic CORS headers - adjust origin for production
    response.headers.set('Access-Control-Allow-Origin', '*');
    response.headers.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type');

    return response;

  } catch (error: any) {
    console.error('Error proxying Hansard search/debates request:', error);
    return NextResponse.json(
      { error: 'Internal Server Error while contacting Hansard API (search/debates)', details: error.message },
      { status: 500 }
    );
  }
} 
import { NextRequest, NextResponse } from 'next/server';

// Base URL for the Hansard API
const HANSARD_API_BASE = 'https://hansard-api.parliament.uk';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  // Forward all query parameters (startDate, query, etc.) to the Hansard API
  const hansardUrl = `${HANSARD_API_BASE}/search.json?${searchParams.toString()}`;

  console.log(`Proxying search request to: ${hansardUrl}`);

  try {
    const apiResponse = await fetch(hansardUrl, {
        method: 'GET',
        headers: {
            // Add any necessary headers for the Hansard API if required
            'Accept': 'application/json',
        },
        // Disable caching if needed, or set revalidation strategy
        cache: 'no-store' // Example: Force fresh data
    });

    if (!apiResponse.ok) {
      const errorText = await apiResponse.text();
      console.error(`Hansard API Error (${apiResponse.status}): ${errorText}`);
      return NextResponse.json(
        { error: `Hansard API Error: ${apiResponse.statusText}`, details: errorText },
        { status: apiResponse.status }
      );
    }

    const data = await apiResponse.json();

    // Return the successful response from Hansard API
    // Set CORS headers to allow requests from your frontend origin
    const response = NextResponse.json(data);
    // Adjust origin as needed for production
    response.headers.set('Access-Control-Allow-Origin', '*'); // Or specify your domain
    response.headers.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type');

    return response;

  } catch (error: any) {
    console.error('Error proxying Hansard search request:', error);
    return NextResponse.json(
      { error: 'Internal Server Error while contacting Hansard API', details: error.message },
      { status: 500 }
    );
  }
} 
import { NextResponse } from 'next/server';

const HANSARD_BASE_URL = 'https://hansard-api.parliament.uk';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const house = searchParams.get('house') || 'Commons'; // Default to Commons

  const apiUrl = `${HANSARD_BASE_URL}/overview/lastsittingdate.json?house=${house}`;
  console.log(`Fetching last sitting date from: ${apiUrl}`);

  try {
    const response = await fetch(apiUrl, {
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Hansard API Error (${apiUrl}): ${response.status} - ${errorText}`);
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    // The API returns the date directly as a string in the body
    const lastSittingDate = await response.text();

    // Return just the date part YYYY-MM-DD
    return NextResponse.json({ lastSittingDate: lastSittingDate.split('T')[0] });

  } catch (error: any) {
    console.error(`Failed to fetch last sitting date: ${error.message}`);
    return NextResponse.json({ error: `Failed to fetch last sitting date: ${error.message}` }, { status: 500 });
  }
}
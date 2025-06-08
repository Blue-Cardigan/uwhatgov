import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const baseUrl = process.env.BASE_URL || requestUrl.origin;

  if (code) {
    const supabase = createClient();
    
    try {
      await supabase.auth.exchangeCodeForSession(code);
    } catch (error) {
      console.error('Error exchanging code for session:', error);
      // Redirect to home with error parameter
      return NextResponse.redirect(`${baseUrl}/?auth_error=true`);
    }
  }

  // Redirect to the BASE_URL after successful authentication
  return NextResponse.redirect(baseUrl);
} 
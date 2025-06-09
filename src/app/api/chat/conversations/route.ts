import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { ensureDebateRecord } from '@/lib/debateInitService';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

// GET - List conversations for a debate
export async function GET(request: NextRequest) {
  const supabase = createClient();
  
  // Check authentication
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const url = new URL(request.url);
  const debateId = url.searchParams.get('debateId');

  if (!debateId) {
    return NextResponse.json({ error: 'debateId parameter required' }, { status: 400 });
  }

  try {
    const { data: conversations, error } = await supabase
      .from('chat_conversations_uwhatgov')
      .select('*')
      .eq('user_id', user.id)
      .eq('debate_id', debateId)
      .order('updated_at', { ascending: false });

    if (error) {
      throw error;
    }

    return NextResponse.json({ conversations });
  } catch (error: any) {
    console.error('Error fetching conversations:', error);
    return NextResponse.json({ error: 'Failed to fetch conversations' }, { status: 500 });
  }
}

// POST - Create new conversation
export async function POST(request: NextRequest) {
  const supabase = createClient();
  
  // Check authentication
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  try {
    const { debateId, title } = await request.json();

    if (!debateId || !title) {
      return NextResponse.json({ error: 'debateId and title are required' }, { status: 400 });
    }

    // Ensure debate record exists before creating conversation
    await ensureDebateRecord(debateId);

    const { data: conversation, error } = await supabase
      .from('chat_conversations_uwhatgov')
      .insert({
        user_id: user.id,
        debate_id: debateId,
        title: title
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    return NextResponse.json({ conversation });
  } catch (error: any) {
    console.error('Error creating conversation:', error);
    return NextResponse.json({ error: 'Failed to create conversation' }, { status: 500 });
  }
} 
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

// GET - Fetch messages for a conversation
export async function GET(
  request: NextRequest,
  context: any
) {
  const supabase = createClient();
  
  // Check authentication
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const params = await context.params;
  const conversationId = params.conversationId;

  if (!conversationId) {
    return NextResponse.json({ error: 'Conversation ID is required' }, { status: 400 });
  }

  try {
    // Verify conversation belongs to user
    const { data: conversation, error: convError } = await supabase
      .from('chat_conversations_uwhatgov')
      .select('*')
      .eq('id', conversationId)
      .eq('user_id', user.id)
      .single();

    if (convError || !conversation) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
    }

    // Fetch messages for the conversation
    const { data: messages, error } = await supabase
      .from('chat_messages_uwhatgov')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });

    if (error) {
      throw error;
    }

    // Transform messages to include timestamp field
    const transformedMessages = (messages || []).map(msg => ({
      ...msg,
      timestamp: msg.created_at
    }));

    return NextResponse.json({ messages: transformedMessages });
  } catch (error: any) {
    console.error('Error fetching messages:', error);
    return NextResponse.json({ error: 'Failed to fetch messages' }, { status: 500 });
  }
} 
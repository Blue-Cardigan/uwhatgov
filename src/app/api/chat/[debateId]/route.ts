import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { getHansardDebate } from '@/lib/hansardService';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY!);

interface ChatMessage {
  id?: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  groundingMetadata?: any;
}

export async function POST(
  request: NextRequest,
  context: any
) {
  const supabase = createClient();
  
  // Check authentication - require user for chat feature
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const params = await context.params;
  const debateId = params.debateId;

  if (!debateId) {
    return NextResponse.json({ error: 'Missing debateId parameter' }, { status: 400 });
  }

  try {
    const body = await request.json();
    const { message, conversationId } = body;

    if (!message || typeof message !== 'string') {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    if (!conversationId || typeof conversationId !== 'string') {
      return NextResponse.json({ error: 'Conversation ID is required' }, { status: 400 });
    }

    // Verify conversation belongs to user
    const { data: conversation, error: convError } = await supabase
      .from('chat_conversations_uwhatgov')
      .select('*')
      .eq('id', conversationId)
      .eq('user_id', user.id)
      .eq('debate_id', debateId)
      .single();

    if (convError || !conversation) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
    }

    // Get conversation history from database
    const { data: chatHistory, error: historyError } = await supabase
      .from('chat_messages_uwhatgov')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });

    if (historyError) {
      console.error('Error fetching chat history:', historyError);
      return NextResponse.json({ error: 'Failed to fetch chat history' }, { status: 500 });
    }

    // Get the original debate data for context
    let originalDebate;
    try {
      originalDebate = await getHansardDebate(debateId);
    } catch (error: any) {
      console.error(`[Chat API] Failed to fetch debate ${debateId}:`, error);
      return NextResponse.json({ error: 'Failed to fetch debate data' }, { status: 500 });
    }

    // Prepare debate context for the AI
    const debateTitle = originalDebate.Overview.Title || 'Parliamentary Debate';
    const debateDate = originalDebate.Overview.Date || 'Unknown date';
    const debateHouse = originalDebate.Overview.House || 'Unknown house';
    
    // Extract key contributions for context
    const contributions = originalDebate.Items
      .filter(item => item.ItemType === 'Contribution' && item.Value)
      .slice(0, 10) // Limit context to first 10 contributions to stay within token limits
      .map(item => ({
        speaker: item.AttributedTo || 'Speaker',
        text: (item.Value || '').replace(/<[^>]*>/g, '').trim().substring(0, 500) // Limit text length
      }));

    const debateContext = `
Debate Title: ${debateTitle}
Date: ${debateDate}
House: ${debateHouse}

Key Contributions:
${contributions.map(c => `${c.speaker}: ${c.text}`).join('\n\n')}
`;

    // Build conversation history for the model
    const conversationHistory = (chatHistory || []).map((msg: any) => ({
      role: msg.role === 'user' ? 'user' : 'model',
      parts: [{ text: msg.content }]
    }));

    // Add the current user message
    conversationHistory.push({
      role: 'user',
      parts: [{ text: `Context: ${debateContext}


Answer this question based on the provided UK Parliamentary debate.

Use web search when needed to find relevant details. Focus on being factual and cite sources when possible.

Question: ${message}` }]
    });

    // Use Gemini 1.5 Flash (compatible with current package version)
    const model = genAI.getGenerativeModel({ 
      model: "gemini-2.0-flash"
    });

    const result = await model.generateContent({
      contents: conversationHistory,
    });

    const response = await result.response;
    const responseText = response.text();

    // No grounding metadata available without tools
    const groundingMetadata = null;

    // Store user message in database
    const { error: userMsgError } = await supabase
      .from('chat_messages_uwhatgov')
      .insert({
        conversation_id: conversationId,
        role: 'user',
        content: message
      });

    if (userMsgError) {
      console.error('Error storing user message:', userMsgError);
    }

    // Store assistant message in database
    const { data: assistantMessageRecord, error: assistantMsgError } = await supabase
      .from('chat_messages_uwhatgov')
      .insert({
        conversation_id: conversationId,
        role: 'assistant',
        content: responseText
      })
      .select()
      .single();

    if (assistantMsgError) {
      console.error('Error storing assistant message:', assistantMsgError);
    }

    // Update conversation timestamp
    await supabase
      .from('chat_conversations_uwhatgov')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', conversationId);

    const assistantMessage: ChatMessage = {
      id: assistantMessageRecord?.id,
      role: 'assistant',
      content: responseText,
      timestamp: new Date().toISOString(),
      groundingMetadata: groundingMetadata
    };

    return NextResponse.json({
      message: assistantMessage,
      success: true
    });

  } catch (error: any) {
    console.error(`[Chat API] Error for debate ${debateId}:`, error);
    return NextResponse.json({ 
      error: `Failed to process chat message: ${error.message}` 
    }, { status: 500 });
  }
} 
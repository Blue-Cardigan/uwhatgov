import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { GenerateNameResponse } from '@/types';

export const runtime = 'edge';

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY!);

export async function POST(
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

    // Fetch the first few messages (user + assistant) to generate name from
    const { data: messages, error: messagesError } = await supabase
      .from('chat_messages_uwhatgov')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })
      .limit(4); // Get first 2 exchanges (user + assistant, user + assistant)

    if (messagesError) {
      throw messagesError;
    }

    if (!messages || messages.length < 2) {
      return NextResponse.json({ error: 'Not enough messages to generate name' }, { status: 400 });
    }

    // Check if there's at least one assistant response
    const hasAssistantResponse = messages.some(msg => msg.role === 'assistant');
    if (!hasAssistantResponse) {
      return NextResponse.json({ error: 'No assistant response found' }, { status: 400 });
    }

    // Prepare context for name generation
    const conversationContext = messages
      .map(msg => `${msg.role}: ${msg.content}`)
      .join('\n\n');

    // Generate concise name using Gemini
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
    
    const prompt = `Based on the user's first message, generate a concise, descriptive title (maximum 6 words) that captures the main topic or question being discussed. The title should be specific enough to distinguish this conversation from others about parliamentary debates.

Conversation:
${conversationContext}

Generate only the title, no additional text or punctuation. Examples of good titles:
- "NHS Funding Question"
- "Brexit Vote Analysis"
- "Housing Policy Discussion"
- "MP Voting Record Query"`;

    const result = await model.generateContent(prompt);
    console.log(prompt);
    console.log(result.response.text());
    const generatedName = result.response.text().trim();

    // Update the conversation title
    const { error: updateError } = await supabase
      .from('chat_conversations_uwhatgov')
      .update({ title: generatedName })
      .eq('id', conversationId);

    if (updateError) {
      throw updateError;
    }

    return NextResponse.json<GenerateNameResponse>({ 
      title: generatedName,
      success: true 
    });

  } catch (error: any) {
    console.error('Error generating conversation name:', error);
    return NextResponse.json<GenerateNameResponse>({ 
      title: '',
      success: false,
      error: 'Failed to generate conversation name' 
    }, { status: 500 });
  }
} 
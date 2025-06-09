import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';
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

// Hansard API function definitions
const hansardFunctions = [
  {
    name: "search_hansard",
    description: "Search UK Parliament Hansard records for debates, contributions, written statements, and more. Use this for general parliamentary searches and member-specific searches.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        searchTerm: {
          type: SchemaType.STRING,
          description: "The term to search for. Can use advanced search directives like 'spokenby:name', 'debate:topic', 'words:text'. Optional when using memberId."
        },
        house: {
          type: SchemaType.STRING,
          description: "Parliamentary house to search (Commons or Lords)"
        },
        startDate: {
          type: SchemaType.STRING,
          description: "Start date for search (yyyy-mm-dd)"
        },
        endDate: {
          type: SchemaType.STRING,
          description: "End date for search (yyyy-mm-dd)"
        },
        memberId: {
          type: SchemaType.INTEGER,
          description: "Search for contributions by a specific member ID. Can be used alone or with searchTerm."
        },
        debateType: {
          type: SchemaType.STRING,
          description: "Type of debate to search"
        },
        take: {
          type: SchemaType.INTEGER,
          description: "Number of results to return (default 10, max 20)"
        }
      },
      required: []
    }
  }
];

// Function to execute Hansard API calls
async function executeHansardFunction(name: string, args: any) {
  const baseUrl = 'https://hansard-api.parliament.uk/search';
  
  try {
    let url: string;
    let response: Response;

    switch (name) {
      case 'search_hansard':
        {
          const params = new URLSearchParams();
          if (args.searchTerm) params.set('queryParameters.searchTerm', args.searchTerm);
          if (args.house) params.set('queryParameters.house', args.house);
          if (args.startDate) params.set('queryParameters.startDate', args.startDate);
          if (args.endDate) params.set('queryParameters.endDate', args.endDate);
          if (args.memberId) params.set('queryParameters.memberId', args.memberId.toString());
          if (args.debateType) params.set('queryParameters.debateType', args.debateType);
          if (args.take) params.set('queryParameters.take', Math.min(args.take, 20).toString());
          else params.set('queryParameters.take', '10');
          
          url = `${baseUrl}.json?${params.toString()}`;
          response = await fetch(url);
        }
        break;

        break;

      default:
        throw new Error(`Unknown function: ${name}`);
    }

    if (!response.ok) {
      throw new Error(`Hansard API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    
    // Format the response based on the API structure we discovered
    const formattedData = {
      totalMembers: data.TotalMembers,
      totalContributions: data.TotalContributions,
      totalWrittenStatements: data.TotalWrittenStatements,
      totalWrittenAnswers: data.TotalWrittenAnswers,
      totalCorrections: data.TotalCorrections,
      totalPetitions: data.TotalPetitions,
      totalDebates: data.TotalDebates,
      totalCommittees: data.TotalCommittees,
      totalDivisions: data.TotalDivisions,
      searchTerms: data.SearchTerms,
      members: data.Members || [],
      contributions: data.Contributions || [],
      debates: data.Debates || [],
      committees: data.Committees || [],
      divisions: data.Divisions || []
    };

    return {
      success: true,
      data: formattedData,
      url: url.replace(/queryParameters\./g, ''), // Clean up URL for display
      apiResponse: data // Include raw response for debugging if needed
    };

  } catch (error: any) {
    console.error(`[Hansard Function] Error in ${name}:`, error);
    return {
      success: false,
      error: error.message,
      data: null
    };
  }
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

    // Extract member information for context
    const memberMap = new Map();
    originalDebate.Items
      .filter(item => item.ItemType === 'Contribution' && item.MemberId && item.AttributedTo)
      .forEach(item => {
        if (!memberMap.has(item.MemberId)) {
          memberMap.set(item.MemberId, item.AttributedTo);
        }
      });

    const membersList = Array.from(memberMap.entries())
      .map(([id, name]) => `${name} (ID: ${id})`)
      .join(', ');

    const debateContext = `
Debate Title: ${debateTitle}
Date: ${debateDate}
House: ${debateHouse}

Key Contributions:
${contributions.map(c => `${c.speaker}: ${c.text}`).join('\n\n')}

Members in this debate: ${membersList}
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

######
You are an AI assistant helping users understand UK Parliamentary debates. You have access to the current debate context and can search the UK Parliament Hansard API for additional parliamentary information.

Available tools:
search_hansard: General search across all parliamentary records (can also search by member ID alone or combined with search terms)

When users ask about:
- Other debates or broader parliamentary topics → use search_hansard
- What a specific MP has said → use search_hansard with their member ID
- General questions about the current debate → use the provided context

Member IDs are provided in the context above. Use these when searching for specific members.

For EVERY query, you MUST use British English spelling in your responses.

Question: ${message}` }]
    });

    // Use Gemini 2.0 Flash with function calling
    const model = genAI.getGenerativeModel({ 
      model: "gemini-2.0-flash",
      tools: [{ functionDeclarations: hansardFunctions }] as any
    });

    const result = await model.generateContent({
      contents: conversationHistory
    });

    const response = await result.response;
    
    // Handle function calls
    const functionCalls = response.functionCalls();
    let responseText = '';
    
    if (functionCalls && functionCalls.length > 0) {
      // Execute function calls
      const functionResults = await Promise.all(
        functionCalls.map(async (functionCall) => {
          const { name, args } = functionCall;
          console.log(`[Chat API] Executing function: ${name}`, args);
          const result = await executeHansardFunction(name, args);
          return {
            functionResponse: {
              name,
              response: result
            }
          };
        })
      );

      // Continue conversation with function results
      const followUpConversation = [
        ...conversationHistory,
        {
          role: 'model',
          parts: functionCalls.map(fc => ({ functionCall: fc }))
        },
        {
          role: 'function',
          parts: functionResults
        }
      ];

      const followUpResult = await model.generateContent({
        contents: followUpConversation
      });

      responseText = followUpResult.response.text();
    } else {
      responseText = response.text();
    }

    // Extract grounding metadata from the response
    let groundingMetadata = null;
    if (response.candidates && response.candidates[0]?.groundingMetadata) {
      const metadata = response.candidates[0].groundingMetadata;
      groundingMetadata = {
        searchEntryPoint: metadata.searchEntryPoint,
        groundingChunks: metadata.groundingChunks || [],
        groundingSupports: metadata.groundingSupports || [],
        webSearchQueries: metadata.webSearchQueries || []
      };
    }

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

    // Check if this is the first assistant response and generate name if so
    const messageCount = (chatHistory || []).length + 2; // +2 for current user + assistant messages
    let generatedTitle = null;
    
    if (messageCount === 2) {
      // This is the first assistant response, trigger name generation
      try {
        const nameResponse = await fetch(`${request.nextUrl.origin}/api/chat/conversations/${conversationId}/generate-name`, {
          method: 'POST',
          headers: {
            'Authorization': request.headers.get('Authorization') || '',
            'Cookie': request.headers.get('Cookie') || ''
          }
        });
        
        if (nameResponse.ok) {
          const nameData = await nameResponse.json();
          generatedTitle = nameData.title;
        }
      } catch (error) {
        console.error('Failed to generate conversation name:', error);
        // Don't fail the main request if name generation fails
      }
    }

    const assistantMessage: ChatMessage = {
      id: assistantMessageRecord?.id,
      role: 'assistant',
      content: responseText,
      timestamp: new Date().toISOString(),
      groundingMetadata: groundingMetadata
    };

    return NextResponse.json({
      message: assistantMessage,
      generatedTitle,
      success: true
    });

  } catch (error: any) {
    console.error(`[Chat API] Error for debate ${debateId}:`, error);
    return NextResponse.json({ 
      error: `Failed to process chat message: ${error.message}` 
    }, { status: 500 });
  }
} 
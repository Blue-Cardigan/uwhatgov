import { NextRequest, NextResponse } from 'next/server';
import { getHansardDebate } from '@/lib/hansardService';
import { generateDebateStream } from '@/lib/geminiService';
import { GenerateContentStreamResult, EnhancedGenerateContentResponse } from '@google/generative-ai';
import { DebateContentItem } from '@/lib/hansard/types'; // Assuming types are here

// Define the expected structure for the event stream data
interface StreamEvent {
    type: 'chunk' | 'complete' | 'error' | 'ping';
    payload?: any; // Use 'any' for flexibility or define specific payload types
}

// Export Edge runtime for Vercel
export const runtime = 'edge';
export const dynamic = 'force-dynamic'; // Ensure dynamic execution per request
export const maxDuration = 60; // Set max duration for Vercel Edge Functions (adjust as needed)

// Keep-alive interval (e.g., 25 seconds)
const PING_INTERVAL_MS = 25 * 1000;

export async function GET(
    request: NextRequest,
    { params }: { params: { debateId: string } }
) {
    const { debateId } = params;

    if (!debateId) {
        return NextResponse.json({ error: 'Missing debateId parameter' }, { status: 400 });
    }

    console.log(`[API Route /stream/${debateId}] Received request.`);

    let originalDebateResponse;
    try {
        originalDebateResponse = await getHansardDebate(debateId);
        console.log(`[API Route /stream/${debateId}] Fetched original debate: ${originalDebateResponse.Overview.Title}`);
    } catch (error: any) {
        console.error(`[API Route /stream/${debateId}] Failed to fetch original debate:`, error);
        // Use a standard error format
        return NextResponse.json({ error: `Failed to fetch original debate: ${error.message}` }, { status: 500 });
    }

    // --- Prepare data for Gemini ---
    const debateTitle = originalDebateResponse.Overview.Title || 'Untitled Debate';
    // Filter and format only relevant contributions
    const relevantContributions = originalDebateResponse.Items
        .filter((item: DebateContentItem) => item.ItemType === 'Contribution' && item.Value)
        .map((item: DebateContentItem, index: number) => {
             // Use OrderInSection if available and unique, otherwise use array index as fallback
            const originalIndex = typeof item.OrderInSection === 'number' ? item.OrderInSection : index;
            const speaker = item.AttributedTo || 'Unknown Speaker';
            // Ensure text exists, strip HTML simply for prompt (Gemini needs clean text)
            const text = (item.Value || '').replace(/<[^>]*>/g, '').trim();
            const snippet = text.split(' ').slice(0, 15).join(' ') + (text.split(' ').length > 15 ? '...' : '');

            // Format for the prompt, clearly indicating speaker and index
             return `Original Index: ${originalIndex}\nSpeaker: ${speaker}\nSnippet: ${snippet}\nText: ${text}\n---\n`;
        });

    if (relevantContributions.length === 0) {
        console.warn(`[API Route /stream/${debateId}] No relevant contributions found to send to Gemini.`);
        // Return an empty stream or a specific message? Let's send a complete message.
        const readable = new ReadableStream({
            start(controller) {
                const completeEvent: StreamEvent = { type: 'complete' };
                controller.enqueue(`data: ${JSON.stringify(completeEvent)}\n\n`);
                controller.close();
            }
        });
        return new Response(readable, {
            headers: {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive',
            },
        });
    }

    const combinedText = relevantContributions.join('\n');
    // Assume the first item's index is the start index (or default to 0)
    const startIndex = originalDebateResponse.Items.find(item => item.ItemType === 'Contribution')?.OrderInSection ?? 0;

    let geminiStreamResult: GenerateContentStreamResult | null;
    try {
        geminiStreamResult = await generateDebateStream(combinedText, debateTitle, startIndex);
        if (!geminiStreamResult || !geminiStreamResult.stream) {
            throw new Error('Gemini service returned null or no stream.');
        }
        console.log(`[API Route /stream/${debateId}] Initiated Gemini stream.`);
    } catch (error: any) {
        console.error(`[API Route /stream/${debateId}] Failed to initiate Gemini stream:`, error);
        return NextResponse.json({ error: `Failed to start rewrite stream: ${error.message}` }, { status: 500 });
    }

    // --- Transform Gemini stream to SSE ---
    let pingIntervalId: NodeJS.Timeout | null = null;
    const transformStream = new TransformStream({
        start(controller) {
            console.log(`[API Route /stream/${debateId}] SSE Transformer started.`);
            // Start sending pings
            pingIntervalId = setInterval(() => {
                 const pingEvent: StreamEvent = { type: 'ping' };
                 // Escape newline characters in the JSON string for SSE data field
                 const formattedData = JSON.stringify(pingEvent).replace(/\n/g, '\\n');
                 controller.enqueue(`data: ${formattedData}\n\n`);
                 console.log(`[API Route /stream/${debateId}] Sent ping.`);
            }, PING_INTERVAL_MS);
        },
        // The transform method receives chunks written to the writable side
        async transform(chunk: EnhancedGenerateContentResponse, controller) {
             try {
                // Extract text from the Gemini response chunk
                 const chunkString = chunk.text();
                const streamEvent: StreamEvent = { type: 'chunk', payload: chunkString };
                // Escape newline characters in the JSON string for SSE data field
                const formattedData = JSON.stringify(streamEvent).replace(/\n/g, '\\n');
                controller.enqueue(`data: ${formattedData}\n\n`);
             } catch (error: any) {
                console.error(`[API Route /stream/${debateId}] Error processing Gemini chunk:`, error);
                // Send an error event downstream if a chunk fails processing
                 const errorEvent: StreamEvent = { type: 'error', payload: { message: `Error processing stream chunk: ${error.message}` } };
                 // Escape newline characters in the JSON string for SSE data field
                 const formattedData = JSON.stringify(errorEvent).replace(/\n/g, '\\n');
                 controller.enqueue(`data: ${formattedData}\n\n`);
             }
        },
        // Flush is called when the writable side is closed
        flush(controller) {
            if (pingIntervalId) {
                clearInterval(pingIntervalId);
                pingIntervalId = null;
            }
            const completeEvent: StreamEvent = { type: 'complete' };
            // Escape newline characters in the JSON string for SSE data field
            const formattedData = JSON.stringify(completeEvent).replace(/\n/g, '\\n');
            controller.enqueue(`data: ${formattedData}\n\n`);
            console.log(`[API Route /stream/${debateId}] SSE Transformer flushed (Gemini stream ended).`);
            // No need to call controller.terminate() here; closing the writer does this.
        }
    });


    // Function to pipe the AsyncGenerator to the WritableStream
    const pipeGeneratorToStream = async () => {
        const writer = transformStream.writable.getWriter();
        try {
            // Iterate through the Gemini stream (AsyncGenerator)
            for await (const chunk of geminiStreamResult!.stream) {
                // Write each chunk directly to the transformer's writable side
                // The transformer's `transform` method will process it
                await writer.write(chunk);
            }
            // Close the writer once the generator is finished
            await writer.close();
            console.log(`[API Route /stream/${debateId}] Gemini stream finished, writer closed.`);
        } catch (err: any) {
            console.error(`[API Route /stream/${debateId}] Error reading/writing Gemini stream:`, err);
            // Abort the writer on error
            await writer.abort(err).catch(abortErr => { // Catch potential error during abort
                 console.error(`[API Route /stream/${debateId}] Error aborting writer:`, abortErr);
            });
            console.log(`[API Route /stream/${debateId}] Writer aborted due to error.`);
        } finally {
             // Clean up interval regardless of success or failure
            if (pingIntervalId) {
                clearInterval(pingIntervalId);
                pingIntervalId = null;
                 console.log(`[API Route /stream/${debateId}] Ping interval cleared in finally block.`);
            }
             // Note: writer.releaseLock() is usually not needed after close/abort
        }
    };

    // Start the piping process in the background. DO NOT await this.
    pipeGeneratorToStream();

    // Return the readable side of the transform stream to the client immediately
    return new Response(transformStream.readable, {
        headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache, no-transform', // Ensure no caching/transform
            'Connection': 'keep-alive',
            'X-Accel-Buffering': 'no', // Nginx: prevent buffering
        },
    });
}
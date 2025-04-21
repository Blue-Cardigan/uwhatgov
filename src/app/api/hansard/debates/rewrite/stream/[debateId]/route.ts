import { NextRequest, NextResponse } from 'next/server';
import { getHansardDebate } from '@/lib/hansardService';
import { generateDebateStream } from '@/lib/geminiService';
import { GenerateContentStreamResult } from '@google/generative-ai';
import { DebateContentItem } from '@/lib/hansard/types'; // Assuming types are here
// Use the server client from @supabase/ssr
import { createClient } from '@/lib/supabase/server';

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

// Define Speech type based on ChatView usage
interface Speech {
  speaker: string;
  text: string;
  originalIndex?: number;
  originalSnippet?: string;
}

export async function GET(
    request: NextRequest,
    context: any // Use 'any' as in the metadata route
) {
    // Create the server client inside the handler
    const supabase = createClient();
    
    // Check auth using the server client
    const { data: { user } } = await supabase.auth.getUser();

    // Access params *after* await
    const { params } = context; // Destructure params from context
    const debateId = params.debateId;

    if (!user) {
        // Use debateId *after* checking for user, otherwise it might be undefined if accessed before await
        console.log(`[API Stream /${debateId ?? 'unknown'}] Unauthorized access attempt.`);
        return NextResponse.json({ type: 'error', payload: 'Unauthorized' }, { status: 401 });
    }
    console.log(`[API Stream /${debateId}] Authorized request for user ${user.id}.`);

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

    // --- Combine Consecutive Contributions by the Same Speaker ---
    interface CombinedInputItem {
        speaker: string;
        text: string;
        originalIndex: number;
        originalSnippet: string; // Snippet from the first item in the sequence
    }

    const filteredItems = originalDebateResponse.Items
        .filter((item: DebateContentItem) => item.ItemType === 'Contribution' && item.Value)
        // Add sorting by OrderInSection to ensure correct sequence for combining
        .sort((a, b) => (a.OrderInSection ?? Infinity) - (b.OrderInSection ?? Infinity));

    const combinedInputItems: CombinedInputItem[] = [];
    let currentCombinedItem: CombinedInputItem | null = null;

    for (const item of filteredItems) {
        const speaker = item.AttributedTo || 'Speaker'; // Default to 'Speaker'
        const text = (item.Value || '').replace(/<[^>]*>/g, '').trim(); // Strip HTML and trim
        // Use OrderInSection primarily, but need a fallback if missing/null - however, filteredItems are sorted by it
        const originalIndex = item.OrderInSection ?? -1; // Use -1 or similar to indicate issue if null, though sort helps

        if (!text || originalIndex === -1) {
             console.warn(`[API Route /stream/${debateId}] Skipping item due to missing text or OrderInSection:`, { itemId: item.ItemId, speaker: speaker });
             continue; // Skip items without text or a valid index after processing
        }

        if (currentCombinedItem && currentCombinedItem.speaker === speaker) {
            // Same speaker, append text
            currentCombinedItem.text += " " + text; // Add separator
            // Keep originalIndex and originalSnippet from the *first* item of the sequence
        } else {
            // Different speaker or first item
            if (currentCombinedItem) {
                combinedInputItems.push(currentCombinedItem); // Push the completed previous item
            }
            // Start a new combined item
            const snippet = text.split(' ').slice(0, 15).join(' ') + (text.split(' ').length > 15 ? '...' : '');
            currentCombinedItem = {
                speaker: speaker,
                text: text,
                originalIndex: originalIndex,
                originalSnippet: snippet
            };
        }
    }
    // Push the last accumulated item
    if (currentCombinedItem) {
        combinedInputItems.push(currentCombinedItem);
    }

    // --- Format Combined Data for Prompt ---
    const combinedText = combinedInputItems.map(item =>
        `Original Index: ${item.originalIndex}
Speaker: ${item.speaker}
Snippet: ${item.originalSnippet}
Text: ${item.text}
---
`
    ).join('\n');

    // Calculate start index based on the *first* item in the *original filtered* list
    // This ensures the prompt accurately reflects the starting point before combining
    const startIndex = filteredItems.length > 0 ? (filteredItems[0].OrderInSection ?? 0) : 0;

    // Check if any processable content remains after combining
    if (combinedInputItems.length === 0) {
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

    let geminiStreamResult: GenerateContentStreamResult | null;
    try {
        // Update status to 'processing' before starting stream
        const { error: statusUpdateError } = await supabase
            .from('casual_debates_uwhatgov')
            .update({ status: 'success', last_updated_at: new Date().toISOString() })
            .eq('id', debateId);
         if (statusUpdateError && statusUpdateError.code !== 'PGRST116') { // Ignore error if row doesn't exist yet
             console.warn(`[API Route /stream/${debateId}] Failed to update status to success (might be new debate):`, statusUpdateError.message);
         } else if (!statusUpdateError) {
             console.log(`[API Route /stream/${debateId}] Updated status to success.`);
         }

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
    let buffer = ''; // Buffer to hold incomplete JSON strings
    let hasSentValidSpeech = false; // Track if any valid speech was sent - Now used to determine if upsert happens

    // State for combining narrative messages
    let lastSpeaker: string | null = null;
    let bufferedNarrativePayload: Speech | null = null;

    // Define helper function in a scope accessible by both transform and flush
    const sendBufferedNarrative = (controller: TransformStreamDefaultController<string>) => {
        if (bufferedNarrativePayload) {
            console.log(`[API Route /stream/${debateId}] Sending/Flushing combined narrative message (Index: ${bufferedNarrativePayload.originalIndex}).`);
            bufferedNarrativePayload.text = bufferedNarrativePayload.text.trim();
            if (bufferedNarrativePayload.text) {
                const eventPayloadString = JSON.stringify(bufferedNarrativePayload);
                const streamEvent: StreamEvent = { type: 'chunk', payload: eventPayloadString };
                const formattedData = JSON.stringify(streamEvent).replace(/\n/g, '\n');
                controller.enqueue(`data: ${formattedData}\n\n`);
            } else {
                 console.warn(`[API Route /stream/${debateId}] Skipping empty combined narrative message.`);
            }
            bufferedNarrativePayload = null;
        }
    };

    // The TransformStream now expects validated Speech objects, not raw chunks
    const transformStream = new TransformStream<Speech, string>({
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
        // Now receives a pre-validated Speech object
        async transform(speech: Speech, controller) {
            // Logic is now much simpler: Handle narrative buffering or send regular speech
            try {
                 if (speech.speaker === 'Speaker') {
                    console.log(`[API Route /stream/${debateId} Transform] Buffering narrative message (Index: ${speech.originalIndex}).`);
                     if (lastSpeaker === 'Speaker' && bufferedNarrativePayload) {
                         bufferedNarrativePayload.text += ` ${speech.text.trim()}`; // Combine text
                     } else {
                         sendBufferedNarrative(controller); // Send previous narrative if any
                         bufferedNarrativePayload = { ...speech }; // Buffer the new one (text is already trimmed in pipeGeneratorToStream)
                     }
                     lastSpeaker = 'Speaker';
                 } else {
                     // Regular speaker
                     sendBufferedNarrative(controller); // Send any pending narrative first
                     console.log(`[API Route /stream/${debateId} Transform] Sending chunk for speaker: ${speech.speaker} (Index: ${speech.originalIndex}).`);
                     const speechJsonString = JSON.stringify(speech);
                     const streamEvent: StreamEvent = { type: 'chunk', payload: speechJsonString };
                     const formattedData = JSON.stringify(streamEvent).replace(/\n/g, '\n');
                     controller.enqueue(`data: ${formattedData}\n\n`);
                     lastSpeaker = speech.speaker;
                     // hasSentValidSpeech is managed solely in pipeGeneratorToStream now
                 }
            } catch (error: any) {
                console.error(`[API Route /stream/${debateId} Transform] Error processing speech object:`, speech, error);
                // Optionally send an error event downstream
                const errorEvent: StreamEvent = { type: 'error', payload: { message: `Error processing speech object: ${error.message}` } };
                const formattedErrorData = JSON.stringify(errorEvent).replace(/\n/g, '\n');
                controller.enqueue(`data: ${formattedErrorData}\n\n`);
            }
        },
        // Flush is called when the writable side is closed
        flush(controller) {
            // Send any remaining buffered narrative message before finishing
            sendBufferedNarrative(controller); // Use the shared helper

            if (pingIntervalId) {
                clearInterval(pingIntervalId);
                pingIntervalId = null;
            }

            // Process any remaining data in the buffer when the stream ends
            const finalPayload = buffer.trim();
            if (finalPayload) {
                console.warn(`[API Route /stream/${debateId}] Discarding non-empty buffer content during flush: "${finalPayload.substring(0, 200)}..."`);
                // Do not attempt to send this potentially incomplete data
            }
             buffer = ''; // Clear buffer

             lastSpeaker = null; // Reset speaker tracking
             bufferedNarrativePayload = null; // Ensure buffer is clear

            // Finally, send the complete event
            if (hasSentValidSpeech) {
                 const completeEvent: StreamEvent = { type: 'complete' };
                 const formattedCompleteData = JSON.stringify(completeEvent).replace(/\n/g, '\n');
                 controller.enqueue(`data: ${formattedCompleteData}\n\n`);
                 console.log(`[API Route /stream/${debateId}] SSE Transformer flushed with completion event.`);
            } else {
                 console.warn(`[API Route /stream/${debateId}] No valid speeches found/generated. Sending error instead of complete.`);
                 const errorEvent: StreamEvent = { type: 'error', payload: { message: 'No valid content generated or found.' } }; // Slightly more general message
                 const formattedErrorData = JSON.stringify(errorEvent).replace(/\n/g, '\n');
                 controller.enqueue(`data: ${formattedErrorData}\n\n`);
                 console.log(`[API Route /stream/${debateId}] SSE Transformer flushed with error (no valid content).`);
            }
        }
    });

    // Function to pipe the AsyncGenerator to the WritableStream
    const pipeGeneratorToStream = async () => {
        const writer = transformStream.writable.getWriter();
        const accumulatedSpeeches: Speech[] = []; // Accumulate speeches here
        let streamError: Error | null = null;

        // Buffer for raw text from Gemini stream
        let geminiBuffer = '';

        try {
            // Iterate through the Gemini stream (AsyncGenerator)
            for await (const chunk of geminiStreamResult!.stream) {
                // Process chunk to extract potential speeches BEFORE writing to the transformer
                let chunkText = '';
                 try {
                    chunkText = chunk.text();
                 } catch (textError: any) {
                     console.warn(`[API Route /stream/${debateId}] Error getting text from chunk: ${textError.message}. Skipping chunk.`);
                     continue; // Skip this chunk
                 }

                geminiBuffer += chunkText; // Add raw text to buffer for parsing logic

                // --- Centralized Parsing & Validation Logic --- 
                 let lastIndex = 0;
                 while (true) {
                     const startIndex = geminiBuffer.indexOf('{', lastIndex);
                     if (startIndex === -1) break;

                     let openBraces = 0;
                     let endIndex = -1;
                     for (let i = startIndex; i < geminiBuffer.length; i++) {
                         if (geminiBuffer[i] === '{') openBraces++;
                         else if (geminiBuffer[i] === '}') {
                             openBraces--;
                             if (openBraces === 0) {
                                 endIndex = i;
                                 break;
                             }
                         }
                     }

                     if (endIndex !== -1) {
                         const potentialJson = geminiBuffer.substring(startIndex, endIndex + 1);
                         try {
                             const parsedSpeech: Speech = JSON.parse(potentialJson);

                             // Centralized Validation
                             if (parsedSpeech && typeof parsedSpeech.speaker === 'string' && parsedSpeech.speaker.trim() && typeof parsedSpeech.text === 'string' && parsedSpeech.text.trim()) {
                                 // Trim text before accumulation/sending
                                 parsedSpeech.text = parsedSpeech.text.trim();

                                 // Handle narrative combining for accumulation
                                 if (parsedSpeech.speaker === 'Speaker') {
                                     const lastAccumulated = accumulatedSpeeches[accumulatedSpeeches.length - 1];
                                     if (lastAccumulated && lastAccumulated.speaker === 'Speaker') {
                                         lastAccumulated.text += ` ${parsedSpeech.text.trim()}`; // Combine text
                                     } else {
                                         accumulatedSpeeches.push({ ...parsedSpeech }); // Add new narrative (already trimmed)
                                     }
                                 } else {
                                     accumulatedSpeeches.push(parsedSpeech); // Add regular speech
                                 }
                                 hasSentValidSpeech = true; // Mark that we have valid data
                                 // Write the *validated object* to the TransformStream writer
                                 await writer.write(parsedSpeech);

                             } else {
                                 console.warn(`[API Route /stream/${debateId} Accumulate] Skipping invalid speech object: ${potentialJson.substring(0,100)}...`);
                             }
                             // Remove processed part from buffer
                             geminiBuffer = geminiBuffer.substring(endIndex + 1);
                             lastIndex = 0;
                         } catch (_parseError) {
                             // Incomplete JSON, wait for more data
                             lastIndex = startIndex + 1;
                         }
                     } else {
                         // No closing brace found, break loop and wait for more chunks
                         break;
                     }
                 }
             }
             // Close the writer once the generator is finished
             await writer.close();
             console.log(`[API Route /stream/${debateId}] Gemini stream finished, writer closed.`);
        } catch (err: any) {
            console.error(`[API Route /stream/${debateId}] Error reading/writing Gemini stream:`, err);
            streamError = err; // Store error
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

            // --- Persist to Supabase ---
            if (streamError) {
                // Handle failure
                console.error(`[API Route /stream/${debateId}] Stream failed. Updating status to 'failed'. Error: ${streamError.message}`);
                const { error: updateError } = await supabase
                    .from('casual_debates_uwhatgov')
                    .update({
                        status: 'failed',
                        error_message: streamError.message,
                        last_updated_at: new Date().toISOString()
                    })
                    .eq('id', debateId);
                if (updateError) {
                    console.error(`[API Route /stream/${debateId}] Failed to update status to 'failed' in Supabase:`, updateError);
                }
            } else if (hasSentValidSpeech && accumulatedSpeeches.length > 0) {
                // Handle success
                console.log(`[API Route /stream/${debateId}] Stream completed successfully with ${accumulatedSpeeches.length} speeches. Persisting to Supabase...`);
                const finalContent = {
                    title: debateTitle, // Use the title fetched earlier
                    speeches: accumulatedSpeeches
                };
                const contentString = JSON.stringify(finalContent);

                const { error: upsertError } = await supabase
                    .from('casual_debates_uwhatgov')
                    .upsert({
                        id: debateId,
                        content: contentString,
                        status: 'success', // Mark as success
                        last_updated_at: new Date().toISOString(), // Explicitly set timestamp
                        error_message: null // Clear any previous error message
                    }, { onConflict: 'id' });

                if (upsertError) {
                    console.error(`[API Route /stream/${debateId}] Supabase upsert error:`, upsertError);
                    // Optionally update status to 'failed' again if upsert fails
                    await supabase.from('casual_debates_uwhatgov').update({ status: 'failed', error_message: `Upsert failed: ${upsertError.message}`, last_updated_at: new Date().toISOString() }).eq('id', debateId);
                } else {
                    console.log(`[API Route /stream/${debateId}] Persisted ${debateId} successfully.`);
                }
            } else {
                // Handle case where stream finished but produced no valid speeches
                console.warn(`[API Route /stream/${debateId}] Stream completed but no valid speeches were generated/accumulated. Updating status to 'failed'.`);
                 const { error: updateError } = await supabase
                    .from('casual_debates_uwhatgov')
                    .update({
                        status: 'failed',
                        error_message: 'Stream completed successfully but generated no valid content.',
                        last_updated_at: new Date().toISOString()
                    })
                    .eq('id', debateId);
                 if (updateError && updateError.code !== 'PGRST116'){ // Ignore if row doesn't exist
                     console.error(`[API Route /stream/${debateId}] Failed to update status to 'failed' (no content) in Supabase:`, updateError);
                 }
            }
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
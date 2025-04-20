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
    let buffer = ''; // Buffer to hold incomplete JSON strings
    let hasSentValidSpeech = false; // Track if any valid speech was sent

    // State for combining narrative messages
    let lastSpeaker: string | null = null;
    let bufferedNarrativePayload: { speaker: string; text: string; originalIndex: number; originalSnippet: string } | null = null;

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
            // Helper function to enqueue the buffered narrative message
            const sendBufferedNarrative = () => {
                if (bufferedNarrativePayload) {
                    console.log(`[API Route /stream/${debateId}] Sending combined narrative message (Index: ${bufferedNarrativePayload.originalIndex}).`);
                    // Ensure text is trimmed before sending
                    bufferedNarrativePayload.text = bufferedNarrativePayload.text.trim();
                    if (bufferedNarrativePayload.text) { // Only send if there's actual text
                        const streamEvent: StreamEvent = { type: 'chunk', payload: JSON.stringify(bufferedNarrativePayload) };
                        const formattedData = JSON.stringify(streamEvent).replace(/\n/g, '\\n');
                        controller.enqueue(`data: ${formattedData}\n\n`);
                        hasSentValidSpeech = true; // Mark valid speech sent
                    } else {
                         console.warn(`[API Route /stream/${debateId}] Skipping empty combined narrative message.`);
                    }
                    bufferedNarrativePayload = null; // Clear buffer after sending
                }
            };

            // Helper function to enqueue a regular non-narrative message
            const sendRegularChunk = (payload: string) => {
                 const streamEvent: StreamEvent = { type: 'chunk', payload: payload };
                 const formattedData = JSON.stringify(streamEvent).replace(/\n/g, '\\n');
                 controller.enqueue(`data: ${formattedData}\n\n`);
            };
             try {
                 // Append new chunk text to the buffer
                 buffer += chunk.text();

                 // Attempt to find and process complete JSON objects in the buffer
                 let lastIndex = 0;
                 while (true) {
                     const startIndex = buffer.indexOf('{', lastIndex);
                     if (startIndex === -1) break; // No more potential objects

                     let openBraces = 0;
                     let endIndex = -1;
                     for (let i = startIndex; i < buffer.length; i++) {
                         if (buffer[i] === '{') {
                             openBraces++;
                         } else if (buffer[i] === '}') {
                             openBraces--;
                             if (openBraces === 0) {
                                 endIndex = i;
                                 break;
                             }
                         }
                     }

                     if (endIndex !== -1) {
                         // Found a potential complete object
                         const potentialJson = buffer.substring(startIndex, endIndex + 1);
                         try {
                             // Verify it's valid JSON (don't need the parsed object)
                             JSON.parse(potentialJson);

                             // Send the verified JSON object as a chunk
                             const parsedSpeech = JSON.parse(potentialJson);
                             if (parsedSpeech && typeof parsedSpeech.text === 'string' && parsedSpeech.text.trim()) {
                                 if (parsedSpeech.speaker === 'System/Narrative') {
                                    console.log(`[API Route /stream/${debateId}] Buffering narrative message (Index: ${parsedSpeech.originalIndex}).`);
                                     if (lastSpeaker === 'System/Narrative' && bufferedNarrativePayload) {
                                         // Append text to existing buffered narrative
                                         bufferedNarrativePayload.text += ` ${parsedSpeech.text.trim()}`; // Add space between concatenated texts
                                     } else {
                                         // Send any previously buffered narrative first
                                         sendBufferedNarrative();
                                         // Start buffering this new narrative message
                                         bufferedNarrativePayload = parsedSpeech;
                                     }
                                     lastSpeaker = 'System/Narrative';
                                 } else {
                                     // Speaker is not System/Narrative
                                     // Send any buffered narrative first
                                     sendBufferedNarrative();
                                     // Send the current speaker's chunk
                                     console.log(`[API Route /stream/${debateId}] Sending chunk for speaker: ${parsedSpeech.speaker} (Index: ${parsedSpeech.originalIndex}).`);
                                     sendRegularChunk(potentialJson); // Send original JSON string
                                     lastSpeaker = parsedSpeech.speaker;
                                     hasSentValidSpeech = true; // Mark valid speech sent
                                 }
                             } else {
                                 console.warn(`[API Route /stream/${debateId}] Skipping empty or invalid speech object: ${potentialJson.substring(0,100)}...`);
                             }

                             // Remove the processed object from the buffer
                             buffer = buffer.substring(endIndex + 1);
                             lastIndex = 0; // Reset search from the beginning of the modified buffer
                         } catch (parseError) {
                             // It wasn't valid JSON, maybe braces were mismatched or inside strings.
                             // Advance lastIndex to search past the start brace we found.
                             console.warn(`[API Route /stream/${debateId}] Partial match is not valid JSON yet: ${potentialJson.substring(0,100)}...`);
                             lastIndex = startIndex + 1;
                         }
                     } else {
                         // No closing brace found for the starting brace at startIndex
                         // The rest of the buffer is potentially an incomplete object
                         break;
                     }
                 }

             } catch (error: any) {
                console.error(`[API Route /stream/${debateId}] Error processing Gemini chunk:`, error);
                // Send a generic error event downstream if chunk processing fails
                 const errorEvent: StreamEvent = { type: 'error', payload: { message: `Error processing stream chunk: ${error.message}` } };
                 // Escape newline characters in the JSON string for SSE data field
                 const formattedData = JSON.stringify(errorEvent).replace(/\n/g, '\\n');
                 controller.enqueue(`data: ${formattedData}\n\n`);
                 // Clear buffer on significant error? Maybe not, depends on desired recovery.
                 // buffer = '';
             }
        },
        // Flush is called when the writable side is closed
        flush(controller) {
            // Send any remaining buffered narrative message before finishing
            if (bufferedNarrativePayload) {
                console.log(`[API Route /stream/${debateId}] Flushing final buffered narrative message (Index: ${bufferedNarrativePayload.originalIndex}).`);
                // Ensure text is trimmed before sending
                bufferedNarrativePayload.text = bufferedNarrativePayload.text.trim();
                if (bufferedNarrativePayload.text) { // Only send if there's actual text
                     const streamEvent: StreamEvent = { type: 'chunk', payload: JSON.stringify(bufferedNarrativePayload) };
                     const formattedData = JSON.stringify(streamEvent).replace(/\n/g, '\\n');
                     controller.enqueue(`data: ${formattedData}\n\n`);
                     hasSentValidSpeech = true; // Mark valid speech sent
                }
            }
            if (pingIntervalId) {
                clearInterval(pingIntervalId);
                pingIntervalId = null;
            }

            // Process any remaining data in the buffer when the stream ends
            let finalPayload = buffer.trim();
            if (finalPayload) {
                console.log(`[API Route /stream/${debateId}] Flushing remaining buffer content: "${finalPayload.substring(0, 200)}..."`);
                 try {
                    // Try parsing the remaining buffer as is
                    JSON.parse(finalPayload);
                    // If it parses, send it directly
                 } catch (parseError: any) {
                      // Parsing failed - potentially incomplete JSON
                      console.warn(`[API Route /stream/${debateId}] Remaining buffer is not valid JSON: "${finalPayload.substring(0,100)}...". Attempting completion.`);
                      // Attempt to complete it if it looks like an unclosed object
                      if (finalPayload.startsWith('{') && !finalPayload.endsWith('}')) {
                           console.log(`[API Route /stream/${debateId}] Appending '}' to incomplete JSON.`);
                           finalPayload += '}';
                           // Optional: Verify again after appending '}'
                           try {
                               JSON.parse(finalPayload);
                               console.log(`[API Route /stream/${debateId}] Completion successful.`);
                           } catch (completionParseError) {
                               console.error(`[API Route /stream/${debateId}] Failed to parse after completing with '}':`, completionParseError);
                               // Decide what to do: send the attempted completion, send an error, or send nothing?
                               // Let's send the attempted completion for the client to handle.
                           }
                      } else {
                          // Doesn't look like a simple unclosed object, send error maybe?
                          // Or just send the fragment as is. Let's send as is for now.
                          console.warn(`[API Route /stream/${debateId}] Remaining buffer doesn't appear to be simple incomplete JSON. Sending as is.`);
                      }
                 }
                 // Send the final (potentially completed) buffer content as a chunk
                  const streamEvent: StreamEvent = { type: 'chunk', payload: finalPayload };
                  const formattedData = JSON.stringify(streamEvent).replace(/\n/g, '\\n');
                  controller.enqueue(`data: ${formattedData}\n\n`);
            }
             buffer = ''; // Clear buffer

             lastSpeaker = null; // Reset speaker tracking
             bufferedNarrativePayload = null; // Ensure buffer is clear

            // Finally, send the complete event
            if (hasSentValidSpeech) {
                 const completeEvent: StreamEvent = { type: 'complete' };
                 // Escape newline characters in the JSON string for SSE data field
                 const formattedCompleteData = JSON.stringify(completeEvent).replace(/\n/g, '\\n');
                 controller.enqueue(`data: ${formattedCompleteData}\n\n`);
                 console.log(`[API Route /stream/${debateId}] SSE Transformer flushed with completion (Gemini stream ended).`);
            } else {
                 console.warn(`[API Route /stream/${debateId}] No valid speeches found/generated. Sending error instead of complete.`);
                 const errorEvent: StreamEvent = { type: 'error', payload: { message: 'No valid content generated or found.' } }; // Slightly more general message
                 const formattedErrorData = JSON.stringify(errorEvent).replace(/\n/g, '\\n');
                 controller.enqueue(`data: ${formattedErrorData}\n\n`);
                 console.log(`[API Route /stream/${debateId}] SSE Transformer flushed with error (no valid content).`);
            }
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
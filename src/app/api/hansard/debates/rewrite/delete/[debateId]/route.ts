import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Ensure these are set in your Vercel environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
// Use the Service Role Key for backend operations that need to bypass RLS (like direct deletion)
// Ensure this is NEVER exposed client-side.
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error("Supabase URL or Service Role Key environment variable not set for delete route.");
    // Return a generic error during build/startup time if needed,
    // but the check inside the handler is more crucial for runtime.
}

export const runtime = 'edge'; // Edge runtime is preferred for lower latency
export const dynamic = 'force-dynamic';

export async function DELETE(
    request: NextRequest,
    { params }: { params: { debateId: string } }
) {
    const { debateId } = params;

    // Initialize client *inside* the handler to ensure env vars are available
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
        console.error("Supabase URL or Service Role Key missing inside DELETE handler.");
        return NextResponse.json({ error: 'Server configuration error (keys missing).' }, { status: 500 });
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Redundant check, but good practice if initialization could fail silently
    if (!supabaseAdmin) { 
        console.error(`[API Delete /${debateId}] Supabase admin client failed to initialize inside handler.`);
        return NextResponse.json({ error: 'Server configuration error.' }, { status: 500 });
    }

    if (!debateId) {
        return NextResponse.json({ error: 'Missing debateId parameter' }, { status: 400 });
    }

    console.log(`[API Delete /${debateId}] Received request to delete rewritten debate.`);

    try {
        const { error } = await supabaseAdmin
            .from('casual_debates_uwhatgov') // Your table name
            .delete()
            .eq('id', debateId);

        if (error) {
            // Handle specific errors if needed, e.g., not found (PGRST116 might indicate this)
            if (error.code === 'PGRST116') {
                 console.log(`[API Delete /${debateId}] Debate not found in Supabase (PGRST116). Proceeding as success.`);
                 // If the item doesn't exist, it's effectively 'deleted' for the purpose of regeneration.
                 return NextResponse.json({ message: `Debate ${debateId} not found, considered deleted.` }, { status: 200 });
            }
            console.error(`[API Delete /${debateId}] Supabase delete error:`, error);
            throw new Error(error.message);
        }

        console.log(`[API Delete /${debateId}] Successfully deleted entry from Supabase.`);
        return NextResponse.json({ message: `Successfully deleted rewritten debate ${debateId}` }, { status: 200 });

    } catch (error: any) {
        console.error(`[API Delete /${debateId}] Failed to delete debate:`, error);
        return NextResponse.json({ error: `Failed to delete debate: ${error.message || 'Unknown error'}` }, { status: 500 });
    }
} 
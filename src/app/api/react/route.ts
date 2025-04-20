import { createClient } from '@/lib/supabase/server'; // Use the shared server client again
// Removed import: import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import type { Database } from '@/lib/database.types';

interface ReactRequestBody {
	debate_id: string;
	speech_original_index: number;
	emoji: string;
}

export const POST = async (request: NextRequest) => {
	// Use the shared server client utility, which now correctly handles cookies for Route Handlers/Server Components
	const supabase = createClient();

	// Check authentication
	const { data: { session } } = await supabase.auth.getSession();
	if (!session?.user) {
		return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
	}
	const user_id = session.user.id;

	// Parse request body
	let requestBody: ReactRequestBody;
	try {
		requestBody = await request.json();
	} catch (e) {
		return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
	}

	const { debate_id, speech_original_index, emoji } = requestBody;

	// Validate input
	if (!debate_id || typeof debate_id !== 'string') {
		return NextResponse.json({ error: 'Missing or invalid debate_id' }, { status: 400 });
	}
	if (typeof speech_original_index !== 'number' || !Number.isInteger(speech_original_index) || speech_original_index < 0) {
		return NextResponse.json({ error: 'Missing or invalid speech_original_index' }, { status: 400 });
	}
	if (!emoji || typeof emoji !== 'string' || emoji.length === 0) {
		return NextResponse.json({ error: 'Missing or invalid emoji' }, { status: 400 });
	}

	try {
		// Check if the reaction already exists
		const { data: existingReaction, error: selectError } = await supabase
			.from('reactions_uwhatgov')
			.select('id')
			.eq('user_id', user_id)
			.eq('debate_id', debate_id)
			.eq('speech_original_index', speech_original_index)
			.eq('emoji', emoji)
			.maybeSingle();

		if (selectError) {
			console.error('Error checking for existing reaction:', selectError);
			throw new Error('Database error checking reaction');
		}

		if (existingReaction) {
			// Reaction exists, so delete it (toggle off)
			const { error: deleteError } = await supabase
				.from('reactions_uwhatgov')
				.delete()
				.match({ user_id, debate_id, speech_original_index, emoji });

			if (deleteError) {
				console.error('Error deleting reaction:', deleteError);
				throw new Error('Failed to remove reaction');
			}

			return NextResponse.json({ success: true, action: 'removed' });
		} else {
			// Reaction doesn't exist, so insert it (toggle on)
			const { error: insertError } = await supabase
				.from('reactions_uwhatgov')
				.insert([{ user_id, debate_id, speech_original_index, emoji }]);

			if (insertError) {
				// Handle potential race condition if reaction was added between check and insert
				if (insertError.code === '23505') { // Unique violation
					console.warn('Race condition detected: Reaction already exists, likely added concurrently.');
					// Consider deleting it again or just returning success 'added' (as it exists now)
					// For simplicity, we'll return 'added' assuming the intent was met.
					return NextResponse.json({ success: true, action: 'added' });
				}
				console.error('Error inserting reaction:', insertError);
				throw new Error('Failed to add reaction');
			}

			return NextResponse.json({ success: true, action: 'added' });
		}
	} catch (error: any) {
		return NextResponse.json({ error: error.message || 'An internal server error occurred' }, { status: 500 });
	}
}; 
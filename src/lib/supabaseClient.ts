import { createClient } from '@supabase/supabase-js';

// Ensure these environment variables are set!
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl) {
  console.error("Error: NEXT_PUBLIC_SUPABASE_URL environment variable not set.");
}

if (!supabaseAnonKey) {
  console.error("Error: NEXT_PUBLIC_SUPABASE_ANON_KEY environment variable not set.");
}

// Create a single supabase client for interacting with your database
export const supabase = createClient(supabaseUrl!, supabaseAnonKey!); // Use non-null assertion as errors are logged above 
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'
// Removed unused import: import type { ReadonlyRequestCookies } from 'next/dist/server/web/spec-extension/adapters/request-cookies';
import { Database } from '../database.types' // Assuming database.types.ts is in src/lib

// Correct pattern for createClient with @supabase/ssr and next/headers
export function createClient() {
  // Call cookies() within methods because it might be async

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        // Use getAll and setAll as per Supabase SSR docs
        async getAll() { // Make method async
          const cookieStore = await cookies() // Await here
          return cookieStore.getAll()
        },
        async setAll(cookiesToSet) { // Make method async
          try {
            const cookieStore = await cookies() // Await here
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch (error) {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
            // Log error for debugging? Might be noisy.
             console.warn(`[Supabase Server Client] setAll failed in Server Component context: ${error}`)
          }
        },
        // We can optionally keep get/set/remove if needed elsewhere, 
        // but createServerClient primarily uses getAll/setAll.
        // Let's remove them for clarity and to match the standard example.
        /*
        async get(name: string) {
          // No longer needed directly for createServerClient
          return cookieStore.get(name)?.value
        },
        async set(name: string, value: string, options: CookieOptions) {
          try {
             // No longer needed directly for createServerClient
            cookieStore.set(name, value, options)
          } catch (error) {
            console.warn(`Failed to set cookie "${name}" from Server Component or similar context. Error: ${error}`)
          }
        },
        async remove(name: string, options: CookieOptions) {
          try {
            // No longer needed directly for createServerClient
            cookieStore.set(name, '', { ...options, maxAge: 0 })
          } catch (error) {
             console.warn(`Failed to remove cookie "${name}" from Server Component or similar context. Error: ${error}`)
          }
        },
        */
      },
    }
  )
}

// The previous implementation using individual get/set/remove methods was replaced
// with the standard getAll/setAll pattern recommended by Supabase SSR docs,
// adapted to handle potential async nature of cookies() in Next.js 15. 
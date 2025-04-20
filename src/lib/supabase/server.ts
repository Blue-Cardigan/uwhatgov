import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'
// Removed unused import: import type { ReadonlyRequestCookies } from 'next/dist/server/web/spec-extension/adapters/request-cookies';
import { Database } from '../database.types' // Assuming database.types.ts is in src/lib

// Correct pattern for createClient with @supabase/ssr and next/headers
export function createClient() {
  // No need to call cookies() here

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        // Define methods that call cookies() internally
        async get(name: string) {
          const cookieStore = await cookies() // Call within the method
          return cookieStore.get(name)?.value
        },
        async set(name: string, value: string, options: CookieOptions) {
          try {
            const cookieStore = await cookies() // Call within the method
            cookieStore.set(name, value, options)
          } catch (error) {
            // The `set` method was called from a context where cookies cannot be set,
            // such as a Server Component. This can often be ignored if middleware
            // handles auth updates and cookie refreshing.
            console.warn(`Failed to set cookie "${name}" from Server Component or similar context. Error: ${error}`)
          }
        },
        async remove(name: string, options: CookieOptions) {
          try {
            const cookieStore = await cookies() // Call within the method
            // Setting an empty value with expiration in the past is standard for removal
            cookieStore.set(name, '', { ...options, maxAge: 0 })
          } catch (error) {
            // The `delete/remove` method was called from a context where cookies cannot be set,
            // such as a Server Component. This can often be ignored if middleware
            // handles auth updates and cookie refreshing.
            console.warn(`Failed to remove cookie "${name}" from Server Component or similar context. Error: ${error}`)
          }
        },
      },
    }
  )
}

// The following methods using getAll/setAll were removed as they caused issues
// and the standard get/set/remove pattern is preferred by createServerClient. 
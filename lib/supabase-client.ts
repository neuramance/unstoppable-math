import { createBrowserClient } from '@supabase/ssr'
import { z } from 'zod'
import type { Database } from './database.types'

const Env = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
})

function create() {
  const parsed = Env.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  })
  if (!parsed.success) {
    throw new Error('sync unavailable: NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY not set, so the app runs local-only')
  }
  return createBrowserClient<Database>(
    parsed.data.NEXT_PUBLIC_SUPABASE_URL,
    parsed.data.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  )
}

let cached: ReturnType<typeof create> | undefined

export function supabase() {
  return (cached ??= create())
}

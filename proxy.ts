import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request })
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  if (url === undefined || key === undefined) return response
  const client = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookies) {
        for (const { name, value } of cookies) request.cookies.set(name, value)
        response = NextResponse.next({ request })
        for (const { name, value, options } of cookies) response.cookies.set(name, value, options)
      },
    },
  })
  await client.auth.getClaims()
  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|lessons/|audio/|videos/|intro/).*)'],
}

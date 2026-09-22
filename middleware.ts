import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  const response = NextResponse.next()

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options)
          })
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  const path = request.nextUrl.pathname

  // Not logged in — redirect to login
  if (!user && path.startsWith('/dashboard')) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // Logged in — protect admin route from non-admin users
  if (user && path.startsWith('/dashboard/admin')) {
    if (user.email !== 'admin@elkanemi.school') {
      return NextResponse.redirect(new URL('/dashboard/teacher', request.url))
    }
  }

  // Logged in — prevent admin from hitting teacher dashboard
  if (user && path.startsWith('/dashboard/teacher')) {
    if (user.email === 'admin@elkanemi.school') {
      return NextResponse.redirect(new URL('/dashboard/admin', request.url))
    }
  }

  // Already logged in — redirect away from login page
  if (user && path === '/login') {
    if (user.email === 'admin@elkanemi.school') {
      return NextResponse.redirect(new URL('/dashboard/admin', request.url))
    }
    return NextResponse.redirect(new URL('/dashboard/teacher', request.url))
  }

  return response
}

export const config = {
  matcher: ['/dashboard/:path*', '/login'],
}
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const session = request.cookies.get('__session')?.value
  if (!session) {
    return NextResponse.redirect(new URL('/', request.url))
  }
  return NextResponse.next()
}

export const config = {
  matcher: ['/dashboard/:path*', '/((?!api|_next|favicon.ico|logo.webp|logo-esquina-wordmark.png|logo-esquina.png|logo-pulse.svg|$).*)'],
}

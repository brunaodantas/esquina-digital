import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { DIGITAL_ESQUINA_HOST, PULSE_HOST, isLocalHost } from '@/lib/domains'

// Separação por domínio: cada área só existe no seu próprio domínio de produção.
// Um link não pode "vazar" de um domínio pro outro — digital-esquina tem dados
// internos/sigilosos da agência, pulse-esquina tem dados de clientes específicos.
// Em localhost (dev) as duas áreas ficam liberadas pra facilitar teste local.

const PUBLIC_FILES = new Set([
  '/favicon.ico',
  '/logo.webp',
  '/logo-esquina-wordmark.png',
  '/logo-esquina.png',
  '/logo-pulse.svg',
])

function isClientSlugPath(pathname: string): boolean {
  if (pathname === '/') return false
  if (pathname.startsWith('/dashboard')) return false
  if (pathname.startsWith('/api')) return false
  if (pathname.startsWith('/_next')) return false
  if (PUBLIC_FILES.has(pathname)) return false
  return true
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const host = request.headers.get('host') ?? ''
  const isLocal = isLocalHost(host)

  if (isClientSlugPath(pathname) && !isLocal && host !== PULSE_HOST) {
    return new NextResponse('Not found', { status: 404 })
  }

  if (pathname.startsWith('/dashboard') && !isLocal && host !== DIGITAL_ESQUINA_HOST) {
    return new NextResponse('Not found', { status: 404 })
  }

  if (pathname.startsWith('/dashboard') || isClientSlugPath(pathname)) {
    const session = request.cookies.get('__session')?.value
    if (!session) {
      const loginUrl = new URL('/', request.url)
      loginUrl.searchParams.set('redirect', pathname)
      return NextResponse.redirect(loginUrl)
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/dashboard/:path*', '/((?!api|_next|favicon.ico|logo.webp|logo-esquina-wordmark.png|logo-esquina.png|logo-pulse.svg|$).*)'],
}

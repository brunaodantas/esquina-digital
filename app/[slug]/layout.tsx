'use client'

import { useEffect, useState } from 'react'
import { onAuthStateChanged, signOut, User } from 'firebase/auth'
import { doc, getDoc } from 'firebase/firestore'
import { auth, db } from '@/lib/firebase'
import { useRouter, usePathname, useParams } from 'next/navigation'
import Link from 'next/link'
import { getCliente } from '@/clientes'

const ABA_LABEL: Record<string, string> = {
  midia: 'Mídia',
  noticias: 'Notícias',
  clipagem: 'Clipagem',
}

export default function ClienteLayout({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const pathname = usePathname()
  const params = useParams<{ slug: string }>()
  const slug = params?.slug ?? ''
  const cliente = getCliente(slug)

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) { router.push('/'); return }
      const snap = await getDoc(doc(db, 'users', u.uid))
      if (!snap.exists() || snap.data().status !== 'aprovado') {
        router.push('/'); return
      }
      setUser(u)
      setLoading(false)
    })
    return () => unsub()
  }, [router])

  async function handleLogout() {
    document.cookie = '__session=; path=/; max-age=0'
    await signOut(auth)
    router.push('/')
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: '#0d0d0d' }}>
        <div style={{ width: 32, height: 32, border: '3px solid #333', borderTop: '3px solid #1A3CFF', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      </div>
    )
  }

  if (!cliente) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: '#0d0d0d', color: '#999', fontSize: 14 }}>
        Cliente &quot;{slug}&quot; não encontrado.
      </div>
    )
  }

  const initials = user?.displayName?.split(' ').map(n => n[0]).slice(0, 2).join('') ?? 'U'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <div style={{
        display: 'flex', justifyContent: 'center', alignItems: 'center',
        padding: '5px 0', flexShrink: 0, background: '#010066',
      }}>
        <img src="/logo-esquina-wordmark.png" alt="Esquina" style={{ height: 22, width: 'auto', filter: 'brightness(0) invert(1)' }} />
      </div>

      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '0 20px', height: 52, flexShrink: 0,
        background: '#0d0d0d',
        borderBottom: '1px solid #2a2a2a',
      }}>
        <img src="/logo-pulse.svg" alt="Pulse" style={{ height: 26, width: 'auto', marginRight: 6 }} />
        <span style={{ fontSize: 13, color: '#666', marginRight: 4 }}>·</span>
        <span style={{ fontSize: 13, fontWeight: 700, color: '#fff', marginRight: 8 }}>{cliente.nome}</span>
        {cliente.abas.map(aba => {
          const href = aba === 'midia' ? `/${slug}` : `/${slug}/${aba}`
          const active = pathname === href
          return (
            <Link key={aba} href={href} style={{ height: 32, padding: '0 16px', borderRadius: 7, fontSize: 13, fontWeight: 600, textDecoration: 'none', transition: 'all 0.15s', background: active ? '#1A3CFF' : '#252525', color: active ? '#fff' : '#999', outline: !active ? '1px solid #333' : 'none', display: 'flex', alignItems: 'center' }}>
              {ABA_LABEL[aba]}
            </Link>
          )
        })}

        <div style={{ flex: 1 }} />

        <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#1A3CFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: '#fff' }}>{initials}</div>
        <span style={{ fontSize: 13, color: '#888' }}>{user?.displayName?.split(' ')[0]}</span>
        <button onClick={handleLogout} style={{ height: 30, padding: '0 12px', borderRadius: 6, fontSize: 12, background: 'transparent', border: '1px solid #333', color: '#666', cursor: 'pointer' }}>Sair</button>
      </div>

      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {children}
      </div>
    </div>
  )
}

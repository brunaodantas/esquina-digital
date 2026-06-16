'use client'

import { useEffect, useState } from 'react'
import { onAuthStateChanged, signOut, User } from 'firebase/auth'
import { doc, getDoc } from 'firebase/firestore'
import { auth, db } from '@/lib/firebase'
import { useRouter } from 'next/navigation'
import EntregasPage from './entregas/page'
import GoogleAdsPage from './google-ads/page'
import MetaAdsPage from './meta-ads/page'

type Tab = 'meta' | 'entregas' | 'google-ads'
type Theme = 'dark' | 'light'

export default function Dashboard() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<Tab>('meta')
  const [theme, setTheme] = useState<Theme>('dark')
  const router = useRouter()

  useEffect(() => {
    const saved = localStorage.getItem('esquina-theme') as Theme | null
    if (saved) setTheme(saved)
  }, [])

  function toggleTheme() {
    setTheme(t => {
      const next = t === 'dark' ? 'light' : 'dark'
      localStorage.setItem('esquina-theme', next)
      return next
    })
  }

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
    await signOut(auth)
    router.push('/')
  }

  const initials = user?.displayName?.split(' ').map(n => n[0]).slice(0, 2).join('') ?? 'U'

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: '#0d0d0d' }}>
        <div style={{ width: 32, height: 32, border: '3px solid #333', borderTop: '3px solid #1A3CFF', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>

      {/* Header sempre visível */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '0 20px', height: 52, flexShrink: 0,
        background: '#0d0d0d',
        borderBottom: '1px solid #2a2a2a',
      }}>
        {/* Tabs de navegação */}
        <button
          onClick={() => setActiveTab('meta')}
          style={{
            height: 32, padding: '0 16px', borderRadius: 7, fontSize: 13, fontWeight: 600,
            cursor: 'pointer', border: 'none', transition: 'all 0.15s',
            background: activeTab === 'meta' ? '#1A3CFF' : '#252525',
            color: activeTab === 'meta' ? '#fff' : '#999',
            outline: activeTab !== 'meta' ? '1px solid #333' : 'none',
          }}
        >
          Meta Ads
        </button>

        <button
          onClick={() => setActiveTab('entregas')}
          style={{
            height: 32, padding: '0 16px', borderRadius: 7, fontSize: 13, fontWeight: 600,
            cursor: 'pointer', border: 'none', transition: 'all 0.15s',
            background: activeTab === 'entregas' ? '#1A3CFF' : '#252525',
            color: activeTab === 'entregas' ? '#fff' : '#999',
            outline: activeTab !== 'entregas' ? '1px solid #333' : 'none',
          }}
        >
          Entregas
        </button>

        <button
          onClick={() => setActiveTab('google-ads')}
          style={{
            height: 32, padding: '0 16px', borderRadius: 7, fontSize: 13, fontWeight: 600,
            cursor: 'pointer', border: 'none', transition: 'all 0.15s',
            background: activeTab === 'google-ads' ? '#1A3CFF' : '#252525',
            color: activeTab === 'google-ads' ? '#fff' : '#999',
            outline: activeTab !== 'google-ads' ? '1px solid #333' : 'none',
          }}
        >
          Google Ads
        </button>

        <div style={{ flex: 1 }} />

        {/* Toggle tema */}
        <button
          onClick={toggleTheme}
          title={theme === 'dark' ? 'Modo claro' : 'Modo escuro'}
          style={{
            width: 32, height: 32, borderRadius: 7, fontSize: 15,
            background: '#252525', border: '1px solid #333', color: '#999',
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          {theme === 'dark' ? '☀' : '☽'}
        </button>

        {/* Avatar */}
        <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#1A3CFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: '#fff' }}>
          {initials}
        </div>

        <span style={{ fontSize: 13, color: '#888' }}>{user?.displayName?.split(' ')[0]}</span>

        <button
          onClick={handleLogout}
          style={{ height: 30, padding: '0 12px', borderRadius: 6, fontSize: 12, background: 'transparent', border: '1px solid #333', color: '#666', cursor: 'pointer' }}
        >
          Sair
        </button>
      </div>

      {/* Conteúdo */}
      <div style={{ flex: 1, overflow: 'hidden', display: activeTab === 'meta' ? 'flex' : 'none', flexDirection: 'column' }}>
        <MetaAdsPage theme={theme} />
      </div>

      <div style={{ flex: 1, overflow: 'hidden', display: activeTab === 'entregas' ? 'flex' : 'none', flexDirection: 'column' }}>
        <EntregasPage theme={theme} />
      </div>

      <div style={{ flex: 1, overflow: 'hidden', display: activeTab === 'google-ads' ? 'flex' : 'none', flexDirection: 'column' }}>
        <GoogleAdsPage theme={theme} />
      </div>

    </div>
  )
}

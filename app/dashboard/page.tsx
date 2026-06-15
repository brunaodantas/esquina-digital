'use client'

import { useEffect, useState } from 'react'
import { onAuthStateChanged, signOut, User } from 'firebase/auth'
import { doc, getDoc } from 'firebase/firestore'
import { auth, db } from '@/lib/firebase'
import { useRouter } from 'next/navigation'
import EntregasPage from './entregas/page'

type Tab = 'meta' | 'entregas'
type Theme = 'dark' | 'light'

const T = {
  dark: {
    page: '#111111', header: '#1a1a1a', border: '#333',
    text: '#ccc', navInactive: '#aaa', navInactiveBg: '#2a2a2a', navInactiveBorder: '#333',
    navActiveBg: '#1A3CFF', navActiveBorder: '#1A3CFF', navActiveText: '#fff',
    logoutBorder: '#333', logoutText: '#888',
    spinnerTrack: '#2a2a2a', themeBtn: '#2a2a2a', themeBtnText: '#aaa',
  },
  light: {
    page: '#f0f2f5', header: '#ffffff', border: '#e0e0e0',
    text: '#555', navInactive: '#555', navInactiveBg: '#f0f0f0', navInactiveBorder: '#e0e0e0',
    navActiveBg: '#1A3CFF', navActiveBorder: '#1A3CFF', navActiveText: '#fff',
    logoutBorder: '#e0e0e0', logoutText: '#888',
    spinnerTrack: '#e0e0e0', themeBtn: '#f0f0f0', themeBtnText: '#555',
  },
}

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

  const c = T[theme]
  const initials = user?.displayName?.split(' ').map(n => n[0]).slice(0, 2).join('') ?? 'U'

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: c.page }}>
        <div style={{ width: 32, height: 32, border: `3px solid ${c.spinnerTrack}`, borderTop: '3px solid #1A3CFF', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: c.page }}>
      <header style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 24px', borderBottom: `1px solid ${c.border}`, background: c.header, flexShrink: 0 }}>
        <nav style={{ display: 'flex', gap: 4 }}>
          {(['meta', 'entregas'] as Tab[]).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                background: activeTab === tab ? c.navActiveBg : c.navInactiveBg,
                border: `1px solid ${activeTab === tab ? c.navActiveBorder : c.navInactiveBorder}`,
                color: activeTab === tab ? c.navActiveText : c.navInactive,
                padding: '6px 16px', borderRadius: 6,
                cursor: 'pointer', fontSize: 13, fontWeight: 600, transition: 'all 0.15s',
              }}
            >
              {tab === 'meta' ? 'Meta Ads' : 'Entregas'}
            </button>
          ))}
        </nav>

        <div style={{ flex: 1 }} />

        <button
          onClick={toggleTheme}
          title={theme === 'dark' ? 'Modo claro' : 'Modo escuro'}
          style={{
            background: c.themeBtn, border: `1px solid ${c.border}`,
            color: c.themeBtnText, width: 30, height: 30, borderRadius: 6,
            cursor: 'pointer', fontSize: 15, display: 'flex',
            alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}
        >
          {theme === 'dark' ? '☀' : '☽'}
        </button>

        <div style={{ width: 30, height: 30, borderRadius: '50%', background: '#1A3CFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 600, color: '#fff' }}>
          {initials}
        </div>
        <span style={{ fontSize: 13, color: c.text }}>{user?.displayName?.split(' ')[0]}</span>
        <button onClick={handleLogout} style={{ background: 'transparent', border: `1px solid ${c.logoutBorder}`, color: c.logoutText, padding: '5px 12px', borderRadius: 6, cursor: 'pointer', fontSize: 13 }}>
          Sair
        </button>
      </header>

      <div style={{ flex: 1, flexDirection: 'column', overflow: 'hidden', display: activeTab === 'meta' ? 'flex' : 'none' }}>
        <iframe src="https://dashboard-meta-esquina-ebon.vercel.app/" style={{ flex: 1, border: 'none', width: '100%', height: '100%' }} title="Dashboard Meta Esquina" />
      </div>

      <div style={{ flex: 1, flexDirection: 'column', overflow: 'hidden', display: activeTab === 'entregas' ? 'flex' : 'none' }}>
        <EntregasPage theme={theme} />
      </div>
    </div>
  )
}

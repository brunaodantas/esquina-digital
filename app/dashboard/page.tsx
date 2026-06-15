'use client'

import { useEffect, useState } from 'react'
import { onAuthStateChanged, signOut, User } from 'firebase/auth'
import { doc, getDoc } from 'firebase/firestore'
import { auth, db } from '@/lib/firebase'
import { useRouter } from 'next/navigation'
import EntregasPage from './entregas/page'

type Tab = 'meta' | 'entregas'
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

  const btnBase: React.CSSProperties = {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    padding: '7px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600,
    cursor: 'pointer', border: '1px solid #3a3a3a', transition: 'all 0.15s',
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: '#111' }}>
        <div style={{ width: 32, height: 32, border: '3px solid #2a2a2a', borderTop: '3px solid #1A3CFF', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#111', position: 'relative' }}>

      {/* Barra de navegação fixa no topo */}
      <div style={{
        position: 'absolute', top: 12, left: 16, right: 16, zIndex: 9999,
        display: 'flex', alignItems: 'center', gap: 8, pointerEvents: 'none',
      }}>
        {/* Tabs */}
        <div style={{ display: 'flex', gap: 6, pointerEvents: 'auto' }}>
          {(['meta', 'entregas'] as Tab[]).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                ...btnBase,
                background: activeTab === tab ? '#1A3CFF' : '#1e1e1e',
                border: `1px solid ${activeTab === tab ? '#1A3CFF' : '#3a3a3a'}`,
                color: activeTab === tab ? '#fff' : '#bbb',
                boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
              }}
            >
              {tab === 'meta' ? '📊 Meta Ads' : '📦 Entregas'}
            </button>
          ))}
        </div>

        <div style={{ flex: 1 }} />

        {/* Controles do lado direito */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, pointerEvents: 'auto' }}>
          <button
            onClick={toggleTheme}
            title={theme === 'dark' ? 'Modo claro' : 'Modo escuro'}
            style={{
              ...btnBase,
              background: '#1e1e1e',
              color: '#bbb',
              padding: '7px 10px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
            }}
          >
            {theme === 'dark' ? '☀' : '☽'}
          </button>

          <div style={{
            ...btnBase,
            background: '#1e1e1e',
            color: '#bbb',
            gap: 8,
            boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
          }}>
            <div style={{ width: 22, height: 22, borderRadius: '50%', background: '#1A3CFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
              {initials}
            </div>
            <span style={{ fontSize: 12 }}>{user?.displayName?.split(' ')[0]}</span>
            <button
              onClick={handleLogout}
              style={{ background: 'transparent', border: 'none', color: '#666', cursor: 'pointer', fontSize: 12, padding: 0 }}
            >
              sair
            </button>
          </div>
        </div>
      </div>

      {/* Conteúdo */}
      <div style={{ flex: 1, overflow: 'hidden', display: activeTab === 'meta' ? 'block' : 'none', position: 'relative' }}>
        <iframe
          src="https://dashboard-meta-esquina-ebon.vercel.app/"
          style={{ width: '100%', height: '100%', border: 'none' }}
          title="Dashboard Meta Esquina"
        />
      </div>

      <div style={{ flex: 1, overflow: 'hidden', display: activeTab === 'entregas' ? 'flex' : 'none', flexDirection: 'column' }}>
        <EntregasPage theme={theme} />
      </div>

    </div>
  )
}

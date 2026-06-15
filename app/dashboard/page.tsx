'use client'

import { useEffect, useState } from 'react'
import { onAuthStateChanged, signOut, User } from 'firebase/auth'
import { doc, getDoc } from 'firebase/firestore'
import { auth, db } from '@/lib/firebase'
import { useRouter } from 'next/navigation'
import EntregasPage from './entregas/page'

type Tab = 'meta' | 'entregas'

export default function Dashboard() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<Tab>('meta')
  const router = useRouter()

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
      <div style={styles.center}>
        <div style={styles.spinner} />
      </div>
    )
  }

  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <nav style={styles.nav}>
          <button
            onClick={() => setActiveTab('meta')}
            style={{ ...styles.navBtn, ...(activeTab === 'meta' ? styles.navBtnActive : {}) }}
          >
            Meta Ads
          </button>
          <button
            onClick={() => setActiveTab('entregas')}
            style={{ ...styles.navBtn, ...(activeTab === 'entregas' ? styles.navBtnActive : {}) }}
          >
            Entregas
          </button>
        </nav>
        <div style={styles.spacer} />
        <div style={styles.avatar}>{initials}</div>
        <span style={styles.name}>{user?.displayName?.split(' ')[0]}</span>
        <button onClick={handleLogout} style={styles.logoutBtn}>Sair</button>
      </header>

      <div style={{ ...styles.content, display: activeTab === 'meta' ? 'flex' : 'none' }}>
        <iframe
          src="https://dashboard-meta-esquina-ebon.vercel.app/"
          style={styles.iframe}
          title="Dashboard Meta Esquina"
        />
      </div>

      <div style={{ ...styles.content, display: activeTab === 'entregas' ? 'flex' : 'none' }}>
        <EntregasPage />
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  center: {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    minHeight: '100vh', background: '#111111',
  },
  spinner: {
    width: 32, height: 32,
    border: '3px solid #2a2a2a', borderTop: '3px solid #1A3CFF',
    borderRadius: '50%', animation: 'spin 0.8s linear infinite',
  },
  page: {
    display: 'flex', flexDirection: 'column',
    height: '100vh', background: '#111111',
  },
  header: {
    display: 'flex', alignItems: 'center', gap: 10,
    padding: '10px 24px', borderBottom: '1px solid #2a2a2a',
    background: '#1a1a1a', flexShrink: 0,
  },
  nav: { display: 'flex', gap: 4 },
  navBtn: {
    background: 'transparent', border: '1px solid transparent',
    color: '#666', padding: '5px 14px', borderRadius: 6,
    cursor: 'pointer', fontSize: 13, fontWeight: 500,
    transition: 'all 0.15s',
  },
  navBtnActive: {
    background: '#1A3CFF22', border: '1px solid #1A3CFF55',
    color: '#fff',
  },
  spacer: { flex: 1 },
  avatar: {
    width: 30, height: 30, borderRadius: '50%',
    background: '#1A3CFF', display: 'flex',
    alignItems: 'center', justifyContent: 'center',
    fontSize: 12, fontWeight: 600, color: '#fff',
  },
  name: { fontSize: 13, color: '#ccc' },
  logoutBtn: {
    background: 'transparent', border: '1px solid #2a2a2a',
    color: '#888', padding: '5px 12px', borderRadius: 6,
    cursor: 'pointer', fontSize: 13,
  },
  content: {
    flex: 1, flexDirection: 'column', overflow: 'hidden',
  },
  iframe: {
    flex: 1, border: 'none', width: '100%', height: '100%',
  },
}

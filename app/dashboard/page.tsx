'use client'

import { useEffect, useState } from 'react'
import { onAuthStateChanged, signOut, User } from 'firebase/auth'
import { doc, getDoc } from 'firebase/firestore'
import { auth, db } from '@/lib/firebase'
import { useRouter } from 'next/navigation'

export default function Dashboard() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
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
        <div style={styles.spacer} />
        <div style={styles.avatar}>{initials}</div>
        <span style={styles.name}>{user?.displayName?.split(' ')[0]}</span>
        <button onClick={handleLogout} style={styles.logoutBtn}>Sair</button>
      </header>
      <iframe
        src="https://dashboard-meta-esquina-ebon.vercel.app/"
        style={styles.iframe}
        title="Dashboard Meta Esquina"
      />
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
  iframe: {
    flex: 1, border: 'none', width: '100%',
  },
}

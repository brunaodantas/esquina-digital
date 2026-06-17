'use client'

import { useEffect, useState } from 'react'
import { signInWithRedirect, getRedirectResult, onAuthStateChanged, User } from 'firebase/auth'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { auth, db, googleProvider } from '@/lib/firebase'
import { useRouter } from 'next/navigation'

type Screen = 'loading' | 'login' | 'checking' | 'pending'

export default function Home() {
  const [screen, setScreen] = useState<Screen>('loading')
  const [progress, setProgress] = useState(0)
  const [user, setUser] = useState<User | null>(null)
  const [error, setError] = useState('')
  const router = useRouter()

  useEffect(() => {
    // Splash screen progress bar
    const interval = setInterval(() => {
      setProgress(p => {
        if (p >= 100) {
          clearInterval(interval)
          return 100
        }
        return p + 2
      })
    }, 30)
    const timer = setTimeout(() => {
      clearInterval(interval)
      setProgress(100)
      checkAuthState()
    }, 1600)
    return () => { clearInterval(interval); clearTimeout(timer) }
  }, [])

  function checkAuthState() {
    getRedirectResult(auth)
      .then(async (result) => {
        if (result?.user) {
          await checkUserStatus(result.user)
          return
        }
        const unsub = onAuthStateChanged(auth, async (u) => {
          unsub()
          if (u) {
            await checkUserStatus(u)
          } else {
            setScreen('login')
          }
        })
      })
      .catch(() => {
        setError('Não foi possível fazer login. Tente novamente.')
        setScreen('login')
      })
  }

  async function checkUserStatus(u: User) {
    setScreen('checking')
    const ref = doc(db, 'users', u.uid)
    const snap = await getDoc(ref)
    if (snap.exists() && snap.data().status === 'aprovado') {
      document.cookie = '__session=1; path=/; max-age=86400; SameSite=Strict'
      router.push('/dashboard')
    } else if (snap.exists() && snap.data().status === 'pendente') {
      setUser(u)
      setScreen('pending')
    } else {
      await setDoc(ref, {
        uid: u.uid,
        email: u.email,
        name: u.displayName,
        photo: u.photoURL,
        status: 'pendente',
        createdAt: new Date().toISOString(),
      })
      await fetch('/api/notify-admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: u.email, name: u.displayName }),
      })
      setUser(u)
      setScreen('pending')
    }
  }

  async function handleLogin() {
    setError('')
    try {
      await signInWithRedirect(auth, googleProvider)
    } catch {
      setError('Não foi possível fazer login. Tente novamente.')
    }
  }

  if (screen === 'loading') {
    return (
      <div style={styles.center}>
        <div style={styles.card}>
          <img src="/logo.webp" alt="Esquina" style={{ height: 48, width: 'auto' }} />
          <div style={styles.progressBar}>
            <div style={{ ...styles.progressFill, width: `${progress}%` }} />
          </div>
        </div>
      </div>
    )
  }

  if (screen === 'checking') {
    return (
      <div style={styles.center}>
        <div style={styles.card}>
          <div style={styles.spinner} />
          <p style={styles.muted}>Verificando acesso...</p>
        </div>
      </div>
    )
  }

  if (screen === 'pending') {
    return (
      <div style={styles.center}>
        <div style={styles.card}>
          <img src="/logo.webp" alt="Esquina" style={{ height: 40, width: 'auto' }} />
          <h2 style={styles.title}>Aguardando aprovação</h2>
          <p style={styles.muted}>
            Olá, {user?.displayName?.split(' ')[0]}. Seu acesso foi solicitado e está em análise.<br />
            Você receberá acesso em breve.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div style={styles.center}>
      <div style={styles.card}>
        <img src="/logo.webp" alt="Esquina" style={{ height: 48, width: 'auto' }} />
        <h1 style={styles.title}>Esquina Digital</h1>
        <p style={styles.muted}>Faça login para continuar</p>
        {error && <p style={styles.error}>{error}</p>}
        <button onClick={handleLogin} style={styles.googleBtn}>
          <svg width="18" height="18" viewBox="0 0 18 18" style={{ marginRight: 10 }}>
            <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"/>
            <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z"/>
            <path fill="#FBBC05" d="M3.964 10.707c-.18-.54-.282-1.117-.282-1.707s.102-1.167.282-1.707V4.961H.957C.347 6.175 0 7.55 0 9s.348 2.825.957 4.039l3.007-2.332z"/>
            <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.961L3.964 7.293C4.672 5.163 6.656 3.58 9 3.58z"/>
          </svg>
          Entrar com Google
        </button>
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  center: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100vh',
    background: '#111111',
  },
  card: {
    background: '#1a1a1a',
    border: '1px solid #2a2a2a',
    borderRadius: 16,
    padding: '48px 40px',
    width: '100%',
    maxWidth: 380,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 16,
  },
  logo: {
    width: 56,
    height: 56,
    borderRadius: 14,
    background: '#1A3CFF',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 24,
    fontWeight: 700,
    color: '#fff',
  },
  brand: {
    fontSize: 18,
    fontWeight: 600,
    color: '#ffffff',
  },
  title: {
    fontSize: 20,
    fontWeight: 600,
    color: '#ffffff',
    textAlign: 'center',
  },
  muted: {
    fontSize: 14,
    color: '#888888',
    textAlign: 'center',
    lineHeight: 1.6,
  },
  progressBar: {
    width: '100%',
    height: 3,
    background: '#2a2a2a',
    borderRadius: 2,
    overflow: 'hidden',
    marginTop: 8,
  },
  progressFill: {
    height: '100%',
    background: '#1A3CFF',
    borderRadius: 2,
    transition: 'width 0.03s linear',
  },
  googleBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    padding: '12px 20px',
    background: '#ffffff',
    color: '#111111',
    border: 'none',
    borderRadius: 8,
    fontSize: 15,
    fontWeight: 500,
    cursor: 'pointer',
    marginTop: 8,
  },
  spinner: {
    width: 32,
    height: 32,
    border: '3px solid #2a2a2a',
    borderTop: '3px solid #1A3CFF',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  },
  iconPending: {
    fontSize: 40,
  },
  error: {
    color: '#ff4444',
    fontSize: 13,
    textAlign: 'center',
  },
}

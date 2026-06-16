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
type PresetWA = 'mes-atual' | 'mes-passado' | 'ultimos-7' | 'ultimos-14' | 'ultimos-30' | 'personalizado'

// ─── Helpers do relatório ───────────────────────────────────────────────────────
function fmtD(d: Date) { return d.toISOString().slice(0, 10) }

function getPeriodoWA(preset: PresetWA, custom: { start: string; end: string }): { start: string; end: string; label: string } {
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0)
  if (preset === 'mes-atual') {
    const label = new Date(hoje.getFullYear(), hoje.getMonth(), 1)
      .toLocaleString('pt-BR', { month: 'long', year: 'numeric' })
    return { start: fmtD(new Date(hoje.getFullYear(), hoje.getMonth(), 1)), end: fmtD(new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0)), label }
  }
  if (preset === 'mes-passado') {
    const s = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1)
    const label = s.toLocaleString('pt-BR', { month: 'long', year: 'numeric' })
    return { start: fmtD(s), end: fmtD(new Date(hoje.getFullYear(), hoje.getMonth(), 0)), label }
  }
  if (preset === 'ultimos-7') { const s = new Date(hoje); s.setDate(s.getDate() - 6); return { start: fmtD(s), end: fmtD(hoje), label: 'Últimos 7 dias' } }
  if (preset === 'ultimos-14') { const s = new Date(hoje); s.setDate(s.getDate() - 13); return { start: fmtD(s), end: fmtD(hoje), label: 'Últimos 14 dias' } }
  if (preset === 'ultimos-30') { const s = new Date(hoje); s.setDate(s.getDate() - 29); return { start: fmtD(s), end: fmtD(hoje), label: 'Últimos 30 dias' } }
  if (preset === 'personalizado' && custom.start && custom.end) {
    const [, sm, sd] = custom.start.split('-').map(Number)
    const [, em, ed] = custom.end.split('-').map(Number)
    return { start: custom.start, end: custom.end, label: `${String(sd).padStart(2,'0')}/${String(sm).padStart(2,'0')} a ${String(ed).padStart(2,'0')}/${String(em).padStart(2,'0')}` }
  }
  return { start: fmtD(new Date(hoje.getFullYear(), hoje.getMonth(), 1)), end: fmtD(hoje), label: 'Período selecionado' }
}

function fmtBRLw(v: number) { return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) }
function fmtNumw(v: number) {
  if (v >= 1_000_000) return (v / 1_000_000).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + 'M'
  if (v >= 1_000) return (v / 1_000).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + 'K'
  return v.toLocaleString('pt-BR')
}
function fmtPctw(v: number) { return v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '%' }

// ─── Modal Relatório WhatsApp ───────────────────────────────────────────────────
function RelatorioModal({ onClose }: { onClose: () => void }) {
  const [redes, setRedes] = useState({ meta: true, google: true })
  const [preset, setPreset] = useState<PresetWA>('mes-atual')
  const [custom, setCustom] = useState({ start: '', end: '' })
  const [incluirValores, setIncluirValores] = useState(true)
  const [loading, setLoading] = useState(false)
  const [mensagem, setMensagem] = useState('')
  const [copiado, setCopiado] = useState(false)
  const [erro, setErro] = useState('')

  const periodo = getPeriodoWA(preset, custom)
  const podeGerar = (redes.meta || redes.google) && (preset !== 'personalizado' || (!!custom.start && !!custom.end))

  async function gerarRelatorio() {
    setLoading(true); setMensagem(''); setErro('')

    let metaDados: any[] = []
    let googleDados: any[] = []
    const fetches: Promise<void>[] = []

    if (redes.meta) {
      fetches.push(
        fetch(`/api/meta-ads?start=${periodo.start}&end=${periodo.end}`)
          .then(r => r.json())
          .then(res => { if (!res.error) metaDados = res.data ?? [] })
          .catch(() => { setErro('Erro ao buscar dados do Meta Ads.') })
      )
    }
    if (redes.google) {
      fetches.push(
        fetch(`/api/google-ads?start=${periodo.start}&end=${periodo.end}`)
          .then(r => r.json())
          .then(res => { if (!res.error) googleDados = res.data ?? [] })
          .catch(() => { setErro(e => e || 'Erro ao buscar dados do Google Ads.') })
      )
    }

    await Promise.all(fetches)

    const linhas: string[] = []
    linhas.push('📊 *Relatório de Performance*')
    linhas.push(`📅 _${periodo.label}_`)
    linhas.push('')

    if (redes.meta) {
      if (!metaDados.length) {
        linhas.push('*Meta Ads*')
        linhas.push('_Nenhum dado encontrado para o período._')
        linhas.push('')
      } else {
        const spend = metaDados.reduce((s: number, a: any) => s + (a.spend ?? 0), 0)
        const impressions = metaDados.reduce((s: number, a: any) => s + (a.impressions ?? 0), 0)
        const reach = metaDados.reduce((s: number, a: any) => s + (a.reach ?? 0), 0)
        const clicks = metaDados.reduce((s: number, a: any) => s + (a.clicks ?? 0), 0)
        const thruplays = metaDados.reduce((s: number, a: any) => s + (a.thruplays ?? 0), 0)
        const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0
        const cpm = spend > 0 && impressions > 0 ? (spend / impressions) * 1000 : 0
        const cpc = clicks > 0 ? spend / clicks : 0
        const freq = reach > 0 ? impressions / reach : 0

        linhas.push('*Meta Ads*')
        if (incluirValores) linhas.push(`💰 Investimento: ${fmtBRLw(spend)}`)
        linhas.push(`👁 Impressões: ${fmtNumw(impressions)}`)
        linhas.push(`🎯 Alcance: ${fmtNumw(reach)}`)
        linhas.push(`🖱 Cliques: ${fmtNumw(clicks)}`)
        linhas.push(`📈 CTR: ${fmtPctw(ctr)}`)
        if (incluirValores) linhas.push(`📊 CPM: ${fmtBRLw(cpm)}`)
        if (incluirValores) linhas.push(`💵 CPC: ${fmtBRLw(cpc)}`)
        if (freq > 0) linhas.push(`🔁 Frequência: ${freq.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}`)
        if (thruplays > 0) linhas.push(`▶️ ThruPlays: ${fmtNumw(thruplays)}`)
        linhas.push('')
      }
    }

    if (redes.google) {
      if (!googleDados.length) {
        linhas.push('*Google Ads*')
        linhas.push('_Nenhum dado encontrado para o período._')
        linhas.push('')
      } else {
        const custo = googleDados.reduce((s: number, a: any) => s + (a.custo ?? 0), 0)
        const cliques = googleDados.reduce((s: number, a: any) => s + (a.cliques ?? 0), 0)
        const impressoes = googleDados.reduce((s: number, a: any) => s + (a.impressoes ?? 0), 0)
        const conversoes = googleDados.reduce((s: number, a: any) => s + (a.conversoes ?? 0), 0)
        const ctr = impressoes > 0 ? (cliques / impressoes) * 100 : 0
        const cpc = cliques > 0 ? custo / cliques : 0
        const custoConv = conversoes > 0 ? custo / conversoes : 0

        linhas.push('*Google Ads*')
        if (incluirValores) linhas.push(`💰 Investimento: ${fmtBRLw(custo)}`)
        linhas.push(`🖱 Cliques: ${fmtNumw(cliques)}`)
        linhas.push(`👁 Impressões: ${fmtNumw(impressoes)}`)
        linhas.push(`📈 CTR: ${fmtPctw(ctr)}`)
        if (incluirValores) linhas.push(`💵 CPC: ${fmtBRLw(cpc)}`)
        if (conversoes > 0) linhas.push(`✅ Conversões: ${fmtNumw(conversoes)}`)
        if (incluirValores && custoConv > 0) linhas.push(`🎯 Custo/Conv.: ${fmtBRLw(custoConv)}`)
        linhas.push('')
      }
    }

    const now = new Date()
    linhas.push(`_Gerado em ${now.toLocaleDateString('pt-BR')}_`)
    setMensagem(linhas.join('\n'))
    setLoading(false)
  }

  function copiar() {
    navigator.clipboard.writeText(mensagem)
    setCopiado(true)
    setTimeout(() => setCopiado(false), 2000)
  }

  function abrirWhatsApp() {
    window.open(`https://wa.me/?text=${encodeURIComponent(mensagem)}`, '_blank')
  }

  return (
    <div
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.78)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
    >
      <div style={{ background: '#161616', border: '1px solid #2a2a2a', borderRadius: 14, padding: 28, width: '100%', maxWidth: 500, maxHeight: '90vh', overflowY: 'auto' }}>

        {/* Cabeçalho */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#e8e8e8' }}>Relatório via WhatsApp</div>
            <div style={{ fontSize: 12, color: '#555', marginTop: 3 }}>Gera mensagem formatada para envio direto</div>
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: '#555', cursor: 'pointer', fontSize: 22, lineHeight: 1, padding: 0, marginTop: -2 }}>×</button>
        </div>

        {/* Redes */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#555', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10 }}>Redes</div>
          <div style={{ display: 'flex', gap: 8 }}>
            {(['meta', 'google'] as const).map(r => {
              const ativo = redes[r]
              return (
                <button key={r} onClick={() => setRedes(p => ({ ...p, [r]: !p[r] }))}
                  style={{ flex: 1, padding: '9px 0', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', border: `1px solid ${ativo ? '#1A3CFF' : '#2a2a2a'}`, background: ativo ? '#1A3CFF18' : 'transparent', color: ativo ? '#7ba3ff' : '#555', transition: 'all 0.15s' }}>
                  {r === 'meta' ? 'Meta Ads' : 'Google Ads'}
                </button>
              )
            })}
          </div>
        </div>

        {/* Período */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#555', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10 }}>Período</div>
          <select value={preset} onChange={e => setPreset(e.target.value as PresetWA)}
            style={{ width: '100%', background: '#1a1a1a', border: '1px solid #2a2a2a', color: '#e8e8e8', borderRadius: 8, padding: '9px 12px', fontSize: 13, outline: 'none', cursor: 'pointer' }}>
            <option value="mes-atual">Este mês</option>
            <option value="mes-passado">Mês passado</option>
            <option value="ultimos-7">Últimos 7 dias</option>
            <option value="ultimos-14">Últimos 14 dias</option>
            <option value="ultimos-30">Últimos 30 dias</option>
            <option value="personalizado">Personalizado</option>
          </select>
          {preset === 'personalizado' && (
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <input type="date" value={custom.start} onChange={e => setCustom(p => ({ ...p, start: e.target.value }))}
                style={{ flex: 1, background: '#1a1a1a', border: '1px solid #2a2a2a', color: '#e8e8e8', borderRadius: 8, padding: '7px 10px', fontSize: 13, outline: 'none' }} />
              <input type="date" value={custom.end} onChange={e => setCustom(p => ({ ...p, end: e.target.value }))}
                style={{ flex: 1, background: '#1a1a1a', border: '1px solid #2a2a2a', color: '#e8e8e8', borderRadius: 8, padding: '7px 10px', fontSize: 13, outline: 'none' }} />
            </div>
          )}
        </div>

        {/* Toggle incluir valores */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#555', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10 }}>Opções</div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', userSelect: 'none' }}>
            <div onClick={() => setIncluirValores(v => !v)}
              style={{ width: 40, height: 22, borderRadius: 11, background: incluirValores ? '#1A3CFF' : '#333', position: 'relative', transition: 'background 0.2s', flexShrink: 0, cursor: 'pointer' }}>
              <div style={{ position: 'absolute', top: 3, left: incluirValores ? 20 : 3, width: 16, height: 16, borderRadius: '50%', background: '#fff', transition: 'left 0.2s' }} />
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#e8e8e8' }}>Incluir valores financeiros</div>
              <div style={{ fontSize: 11, color: '#555', marginTop: 2 }}>Investimento, CPM, CPC, Custo/Conv.</div>
            </div>
          </label>
        </div>

        {/* Botão gerar */}
        <button
          onClick={gerarRelatorio}
          disabled={loading || !podeGerar}
          style={{ width: '100%', padding: '11px 0', borderRadius: 9, fontSize: 14, fontWeight: 700, cursor: loading || !podeGerar ? 'not-allowed' : 'pointer', border: 'none', background: loading || !podeGerar ? '#252525' : '#1A3CFF', color: loading || !podeGerar ? '#555' : '#fff', transition: 'all 0.15s', marginBottom: mensagem ? 20 : 0 }}>
          {loading ? 'Buscando dados...' : 'Gerar Relatório'}
        </button>

        {/* Erro */}
        {erro && <div style={{ fontSize: 12, color: '#f87171', marginTop: 10 }}>{erro}</div>}

        {/* Preview */}
        {mensagem && !loading && (
          <>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#555', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 }}>Pré-visualização</div>
            <textarea
              readOnly
              value={mensagem}
              rows={14}
              style={{ width: '100%', background: '#0d0d0d', border: '1px solid #2a2a2a', color: '#c8c8c8', borderRadius: 8, padding: '12px 14px', fontSize: 12, fontFamily: 'monospace', resize: 'vertical', outline: 'none', boxSizing: 'border-box', lineHeight: 1.75 }}
            />
            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              <button onClick={copiar}
                style={{ flex: 1, padding: '10px 0', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', border: `1px solid ${copiado ? '#22c55e' : '#2a2a2a'}`, background: copiado ? '#22c55e18' : 'transparent', color: copiado ? '#4ade80' : '#888', transition: 'all 0.2s' }}>
                {copiado ? '✓ Copiado!' : 'Copiar texto'}
              </button>
              <button onClick={abrirWhatsApp}
                style={{ flex: 1, padding: '10px 0', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', border: 'none', background: '#25D366', color: '#fff' }}>
                Abrir no WhatsApp
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ─── Dashboard ──────────────────────────────────────────────────────────────────
export default function Dashboard() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<Tab>('meta')
  const [theme, setTheme] = useState<Theme>('dark')
  const [showRelatorio, setShowRelatorio] = useState(false)
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

        {/* Botão Relatório WA */}
        <button
          onClick={() => setShowRelatorio(true)}
          title="Gerar relatório para WhatsApp"
          style={{
            height: 32, padding: '0 14px', borderRadius: 7, fontSize: 13, fontWeight: 600,
            cursor: 'pointer', border: '1px solid #2a4a2a', transition: 'all 0.15s',
            background: '#1a2e1a', color: '#4ade80',
            display: 'flex', alignItems: 'center', gap: 6,
          }}
        >
          <span style={{ fontSize: 14 }}>✉</span> Relatório WA
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

      {/* Modal Relatório WA */}
      {showRelatorio && <RelatorioModal onClose={() => setShowRelatorio(false)} />}

    </div>
  )
}

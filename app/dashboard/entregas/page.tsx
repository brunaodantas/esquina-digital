'use client'

import { useEffect, useState } from 'react'

interface Campanha {
  nome: string
  canal: string
  metrica: string
  meta: number
  entregue: number
  pct: number
  bateu: boolean
  diasRestantes: number
  investimento: number
  status: 'ativa' | 'futura'
}

interface ClienteData {
  cliente: string
  grupo: 'agencia' | 'govba' | 'politica'
  campanhas: Campanha[]
}

function fmt(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace('.', ',') + 'M'
  if (n >= 1_000) return (n / 1_000).toFixed(0) + 'k'
  return n.toLocaleString('pt-BR')
}

function fmtBrl(n: number): string {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function statusBadge(c: Campanha) {
  if (c.bateu || c.pct >= 100) return { label: 'BATEU', color: '#22c55e', bg: '#14532d33' }
  if (c.status === 'futura') return { label: 'FUTURA', color: '#60a5fa', bg: '#1e3a5f33' }
  if (c.pct < 80 && c.diasRestantes <= 7) return { label: 'EM RISCO', color: '#f87171', bg: '#7f1d1d33' }
  return { label: 'EM ANDAMENTO', color: '#facc15', bg: '#78350f33' }
}

function ProgressBar({ pct, bateu }: { pct: number; bateu: boolean }) {
  const w = Math.min(100, pct)
  const color = bateu ? '#22c55e' : pct < 60 ? '#f87171' : pct < 80 ? '#facc15' : '#60a5fa'
  return (
    <div style={{ background: '#2a2a2a', borderRadius: 4, height: 6, marginTop: 8 }}>
      <div style={{ width: `${w}%`, height: '100%', background: color, borderRadius: 4, transition: 'width 0.6s ease' }} />
    </div>
  )
}

function CampanhaCard({ c }: { c: Campanha }) {
  const badge = statusBadge(c)
  return (
    <div style={s.campCard}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
        <div>
          <div style={s.campNome}>{c.nome}</div>
          <div style={s.campSub}>{[c.canal, c.metrica].filter(Boolean).join(' · ')}</div>
        </div>
        <span style={{ ...s.badge, color: badge.color, background: badge.bg }}>{badge.label}</span>
      </div>

      <ProgressBar pct={c.pct} bateu={c.bateu} />

      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, gap: 8 }}>
        <div style={s.stat}>
          <span style={s.statLabel}>Meta</span>
          <span style={s.statVal}>{fmt(c.meta)}</span>
        </div>
        <div style={s.stat}>
          <span style={s.statLabel}>Entregue</span>
          <span style={s.statVal}>{fmt(c.entregue)}</span>
        </div>
        <div style={s.stat}>
          <span style={s.statLabel}>%</span>
          <span style={{ ...s.statVal, color: c.bateu ? '#22c55e' : c.pct < 60 ? '#f87171' : '#ccc' }}>
            {c.pct.toFixed(1).replace('.', ',')}%
          </span>
        </div>
        <div style={s.stat}>
          <span style={s.statLabel}>Dias</span>
          <span style={{ ...s.statVal, color: c.diasRestantes <= 3 ? '#f87171' : '#ccc' }}>
            {c.status === 'futura' ? '—' : c.diasRestantes}
          </span>
        </div>
        {c.investimento > 0 && (
          <div style={s.stat}>
            <span style={s.statLabel}>Investimento</span>
            <span style={s.statVal}>{fmtBrl(c.investimento)}</span>
          </div>
        )}
      </div>
    </div>
  )
}

function ClienteBlock({ data }: { data: ClienteData }) {
  const [open, setOpen] = useState(true)
  const emRisco = data.campanhas.some(c => !c.bateu && c.pct < 80 && c.diasRestantes <= 7 && c.status === 'ativa')

  return (
    <div style={{ ...s.clienteBlock, borderColor: emRisco ? '#7f1d1d' : '#2a2a2a' }}>
      <button onClick={() => setOpen(o => !o)} style={s.clienteHeader}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {emRisco && <span style={s.riskDot} title="Em risco" />}
          <span style={s.clienteNome}>{data.cliente}</span>
          <span style={s.clienteCount}>{data.campanhas.length} campanha{data.campanhas.length !== 1 ? 's' : ''}</span>
        </div>
        <span style={{ color: '#555', fontSize: 12 }}>{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div style={{ padding: '0 16px 16px' }}>
          {data.campanhas.map((c, i) => <CampanhaCard key={i} c={c} />)}
        </div>
      )}
    </div>
  )
}

export default function EntregasPage() {
  const [data, setData] = useState<ClienteData[] | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [filtro, setFiltro] = useState<'todos' | 'risco' | 'agencia' | 'govba' | 'politica'>('todos')

  useEffect(() => {
    fetch('/api/entregas')
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false) })
      .catch(() => { setError('Erro ao carregar dados.'); setLoading(false) })

    // Auto-refresh a cada 2h nos horários XX:01 (00:01, 02:01, 04:01 ...)
    const scheduleNext = (): ReturnType<typeof setTimeout> => {
      const now = new Date()
      const nextEvenHour = (Math.floor(now.getHours() / 2) * 2 + 2) % 24
      const next = new Date(now)
      next.setHours(nextEvenHour, 1, 0, 0)
      if (next <= now) next.setDate(next.getDate() + 1)
      return setTimeout(() => {
        fetch('/api/entregas').then(r => r.json()).then(setData).catch(() => {})
        timer = scheduleNext()
      }, next.getTime() - now.getTime())
    }
    let timer = scheduleNext()
    return () => clearTimeout(timer)
  }, [])

  if (loading) return <div style={s.center}><div style={s.spinner} /></div>
  if (error) return <div style={s.center}><span style={{ color: '#888' }}>{error}</span></div>
  if (!data?.length) return <div style={s.center}><span style={{ color: '#888' }}>Nenhuma campanha ativa no momento.</span></div>

  const emRisco = data.flatMap(d => d.campanhas.filter(c => !c.bateu && c.pct < 80 && c.diasRestantes <= 7 && c.status === 'ativa'))
    .map(c => c.nome)

  const filtrado = data.filter(d => {
    if (filtro === 'risco') return d.campanhas.some(c => !c.bateu && c.pct < 80 && c.diasRestantes <= 7)
    if (filtro !== 'todos') return d.grupo === filtro
    return true
  })

  const grupos: { key: typeof filtro; label: string }[] = [
    { key: 'todos', label: 'Todos' },
    { key: 'risco', label: `Em risco (${emRisco.length})` },
    { key: 'agencia', label: 'Agência' },
    { key: 'govba', label: 'GOV-BA' },
    { key: 'politica', label: 'Política' },
  ]

  return (
    <div style={s.page}>
      {emRisco.length > 0 && (
        <div style={s.alertBox}>
          <span style={s.alertIcon}>⚠</span>
          <div>
            <div style={s.alertTitle}>Campanhas em risco de não bater a meta</div>
            <div style={s.alertList}>{emRisco.join(' · ')}</div>
          </div>
        </div>
      )}

      <div style={s.filtros}>
        {grupos.map(g => (
          <button
            key={g.key}
            onClick={() => setFiltro(g.key)}
            style={{ ...s.filtroBtn, ...(filtro === g.key ? s.filtroBtnActive : {}) }}
          >
            {g.label}
          </button>
        ))}
      </div>

      <div style={s.lista}>
        {filtrado.map((d, i) => <ClienteBlock key={i} data={d} />)}
        {!filtrado.length && (
              <div style={s.center}><span style={{ color: '#555' }}>Nenhum resultado para este filtro.</span></div>
        )}
      </div>
    </div>
  )
}

const s: Record<string, React.CSSProperties> = {
  page: { padding: '20px 24px 40px', overflowY: 'auto', height: '100%', boxSizing: 'border-box' },
  center: { display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', minHeight: 200 },
  spinner: { width: 28, height: 28, border: '3px solid #2a2a2a', borderTop: '3px solid #1A3CFF', borderRadius: '50%', animation: 'spin 0.8s linear infinite' },
  alertBox: { display: 'flex', gap: 12, background: '#2d1010', border: '1px solid #7f1d1d', borderRadius: 8, padding: '12px 16px', marginBottom: 20, alignItems: 'flex-start' },
  alertIcon: { fontSize: 18, color: '#f87171', flexShrink: 0, marginTop: 1 },
  alertTitle: { fontSize: 13, fontWeight: 600, color: '#f87171', marginBottom: 4 },
  alertList: { fontSize: 12, color: '#fca5a5', lineHeight: 1.6 },
  filtros: { display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' },
  filtroBtn: { padding: '6px 14px', borderRadius: 20, border: '1px solid #2a2a2a', background: 'transparent', color: '#888', fontSize: 12, cursor: 'pointer', transition: 'all 0.15s' },
  filtroBtnActive: { background: '#1A3CFF', borderColor: '#1A3CFF', color: '#fff' },
  lista: { display: 'flex', flexDirection: 'column', gap: 12 },
  clienteBlock: { border: '1px solid #2a2a2a', borderRadius: 10, overflow: 'hidden', background: '#1a1a1a' },
  clienteHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', padding: '14px 16px', background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left' },
  clienteNome: { fontSize: 14, fontWeight: 600, color: '#fff' },
  clienteCount: { fontSize: 11, color: '#555', marginLeft: 4 },
  riskDot: { width: 8, height: 8, borderRadius: '50%', background: '#f87171', flexShrink: 0 },
  campCard: { background: '#111', border: '1px solid #222', borderRadius: 8, padding: 12, marginBottom: 8 },
  campNome: { fontSize: 13, fontWeight: 500, color: '#ddd' },
  campSub: { fontSize: 11, color: '#555', marginTop: 2 },
  badge: { fontSize: 10, fontWeight: 600, padding: '3px 8px', borderRadius: 4, whiteSpace: 'nowrap', flexShrink: 0 },
  stat: { display: 'flex', flexDirection: 'column', gap: 2 },
  statLabel: { fontSize: 10, color: '#555' },
  statVal: { fontSize: 13, fontWeight: 500, color: '#ccc' },
}

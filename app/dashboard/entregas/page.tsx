'use client'

import { useEffect, useState } from 'react'

type Theme = 'dark' | 'light'

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

const C = {
  dark: {
    page: '#111111', card: '#1a1a1a', cardInner: '#111',
    border: '#2a2a2a', borderInner: '#222',
    textPrimary: '#fff', textSecondary: '#ddd', textMuted: '#555',
    alertBg: '#2d1010', alertBorder: '#7f1d1d',
    barTrack: '#2a2a2a', spinner: '#2a2a2a',
    filtroBtn: '#2a2a2a', filtroBtnText: '#888',
    emptyText: '#555', chevron: '#555',
  },
  light: {
    page: '#f0f2f5', card: '#ffffff', cardInner: '#f8f8f8',
    border: '#e8e8e8', borderInner: '#eeeeee',
    textPrimary: '#111', textSecondary: '#333', textMuted: '#999',
    alertBg: '#fff5f5', alertBorder: '#fca5a5',
    barTrack: '#e8e8e8', spinner: '#e0e0e0',
    filtroBtn: '#e8e8e8', filtroBtnText: '#666',
    emptyText: '#aaa', chevron: '#bbb',
  },
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
  if (c.bateu || c.pct >= 100) return { label: 'BATEU', color: '#16a34a', bg: '#dcfce7' }
  if (c.status === 'futura') return { label: 'FUTURA', color: '#2563eb', bg: '#dbeafe' }
  if (c.pct < 80 && c.diasRestantes <= 7) return { label: 'EM RISCO', color: '#dc2626', bg: '#fee2e2' }
  return { label: 'EM ANDAMENTO', color: '#d97706', bg: '#fef3c7' }
}

function ProgressBar({ pct, bateu, track }: { pct: number; bateu: boolean; track: string }) {
  const w = Math.min(100, pct)
  const color = bateu ? '#22c55e' : pct < 60 ? '#f87171' : pct < 80 ? '#facc15' : '#60a5fa'
  return (
    <div style={{ background: track, borderRadius: 4, height: 6, marginTop: 8 }}>
      <div style={{ width: `${w}%`, height: '100%', background: color, borderRadius: 4, transition: 'width 0.6s ease' }} />
    </div>
  )
}

function CampanhaCard({ c, t }: { c: Campanha; t: typeof C['dark'] }) {
  const badge = statusBadge(c)
  return (
    <div style={{ background: t.cardInner, border: `1px solid ${t.borderInner}`, borderRadius: 8, padding: 12, marginBottom: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 500, color: t.textSecondary }}>{c.nome}</div>
          <div style={{ fontSize: 11, color: t.textMuted, marginTop: 2 }}>{[c.canal, c.metrica].filter(Boolean).join(' · ')}</div>
        </div>
        <span style={{ fontSize: 10, fontWeight: 600, padding: '3px 8px', borderRadius: 4, whiteSpace: 'nowrap', flexShrink: 0, color: badge.color, background: badge.bg }}>
          {badge.label}
        </span>
      </div>

      <ProgressBar pct={c.pct} bateu={c.bateu} track={t.barTrack} />

      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, gap: 8 }}>
        {[
          { label: 'Meta', val: fmt(c.meta), color: t.textSecondary },
          { label: 'Entregue', val: fmt(c.entregue), color: t.textSecondary },
          { label: '%', val: `${c.pct.toFixed(1).replace('.', ',')}%`, color: c.bateu ? '#16a34a' : c.pct < 60 ? '#dc2626' : t.textSecondary },
          { label: 'Dias', val: c.status === 'futura' ? '—' : String(c.diasRestantes), color: c.diasRestantes <= 3 && c.status !== 'futura' ? '#dc2626' : t.textSecondary },
          ...(c.investimento > 0 ? [{ label: 'Investimento', val: fmtBrl(c.investimento), color: t.textSecondary }] : []),
        ].map((s, i) => (
          <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span style={{ fontSize: 10, color: t.textMuted }}>{s.label}</span>
            <span style={{ fontSize: 13, fontWeight: 500, color: s.color }}>{s.val}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function ClienteBlock({ data, t }: { data: ClienteData; t: typeof C['dark'] }) {
  const [open, setOpen] = useState(true)
  const emRisco = data.campanhas.some(c => !c.bateu && c.pct < 80 && c.diasRestantes <= 7 && c.status === 'ativa')

  return (
    <div style={{ border: `1px solid ${emRisco ? '#fca5a5' : t.border}`, borderRadius: 10, overflow: 'hidden', background: t.card }}>
      <button onClick={() => setOpen(o => !o)} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', padding: '14px 16px', background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {emRisco && <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#f87171', flexShrink: 0, display: 'inline-block' }} title="Em risco" />}
          <span style={{ fontSize: 14, fontWeight: 600, color: t.textPrimary }}>{data.cliente}</span>
          <span style={{ fontSize: 11, color: t.textMuted, marginLeft: 4 }}>{data.campanhas.length} campanha{data.campanhas.length !== 1 ? 's' : ''}</span>
        </div>
        <span style={{ color: t.chevron, fontSize: 12 }}>{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div style={{ padding: '0 16px 16px' }}>
          {data.campanhas.map((c, i) => <CampanhaCard key={i} c={c} t={t} />)}
        </div>
      )}
    </div>
  )
}

export default function EntregasPage({ theme = 'dark' }: { theme?: Theme }) {
  const [data, setData] = useState<ClienteData[] | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [filtro, setFiltro] = useState<'todos' | 'risco' | 'agencia' | 'govba' | 'politica'>('todos')

  const t = C[theme]

  useEffect(() => {
    fetch('/api/entregas')
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false) })
      .catch(() => { setError('Erro ao carregar dados.'); setLoading(false) })

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

  const center = { display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', minHeight: 200 }

  if (loading) return (
    <div style={{ ...center, background: t.page }}>
      <div style={{ width: 28, height: 28, border: `3px solid ${t.spinner}`, borderTop: '3px solid #1A3CFF', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
    </div>
  )
  if (error) return <div style={{ ...center, background: t.page }}><span style={{ color: t.textMuted }}>{error}</span></div>
  if (!data?.length) return <div style={{ ...center, background: t.page }}><span style={{ color: t.textMuted }}>Nenhuma campanha ativa no momento.</span></div>

  const emRisco = data.flatMap(d => d.campanhas.filter(c => !c.bateu && c.pct < 80 && c.diasRestantes <= 7 && c.status === 'ativa')).map(c => c.nome)

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
    <div style={{ padding: '20px 24px 40px', overflowY: 'auto', height: '100%', boxSizing: 'border-box', background: t.page }}>
      {emRisco.length > 0 && (
        <div style={{ display: 'flex', gap: 12, background: t.alertBg, border: `1px solid ${t.alertBorder}`, borderRadius: 8, padding: '12px 16px', marginBottom: 20, alignItems: 'flex-start' }}>
          <span style={{ fontSize: 18, color: '#dc2626', flexShrink: 0, marginTop: 1 }}>⚠</span>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#dc2626', marginBottom: 4 }}>Campanhas em risco de não bater a meta</div>
            <div style={{ fontSize: 12, color: '#f87171', lineHeight: 1.6 }}>{emRisco.join(' · ')}</div>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        {grupos.map(g => (
          <button
            key={g.key}
            onClick={() => setFiltro(g.key)}
            style={{
              padding: '6px 14px', borderRadius: 20, fontSize: 12, cursor: 'pointer', transition: 'all 0.15s',
              background: filtro === g.key ? '#1A3CFF' : t.filtroBtn,
              border: `1px solid ${filtro === g.key ? '#1A3CFF' : t.border}`,
              color: filtro === g.key ? '#fff' : t.filtroBtnText,
            }}
          >
            {g.label}
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {filtrado.map((d, i) => <ClienteBlock key={i} data={d} t={t} />)}
        {!filtrado.length && (
          <div style={center}><span style={{ color: t.emptyText }}>Nenhum resultado para este filtro.</span></div>
        )}
      </div>
    </div>
  )
}

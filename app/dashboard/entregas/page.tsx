'use client'

import { useEffect, useRef, useState } from 'react'

type Theme = 'dark' | 'light'
type Preset = 'personalizado' | 'mes-atual' | 'mes-passado' | 'ultimos-7' | 'ultimos-14' | 'ultimos-30' | 'ytd-2026'

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
  status: 'ativa' | 'encerrada' | 'futura'
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
    dropBg: '#1e1e1e', dropBorder: '#2a2a2a',
    dropText: '#bbb', dropActive: '#ffffff',
    dropHover: '#ffffff12',
    inputBg: '#111', inputBorder: '#333', inputText: '#ccc',
    selectBg: '#1e1e1e', selectBorder: '#333', selectText: '#ccc',
  },
  light: {
    page: '#f0f2f5', card: '#ffffff', cardInner: '#f8f8f8',
    border: '#e8e8e8', borderInner: '#eeeeee',
    textPrimary: '#111', textSecondary: '#333', textMuted: '#999',
    alertBg: '#fff5f5', alertBorder: '#fca5a5',
    barTrack: '#e8e8e8', spinner: '#e0e0e0',
    filtroBtn: '#e8e8e8', filtroBtnText: '#666',
    emptyText: '#aaa', chevron: '#bbb',
    dropBg: '#ffffff', dropBorder: '#e0e0e0',
    dropText: '#555', dropActive: '#111',
    dropHover: '#00000008',
    inputBg: '#f8f8f8', inputBorder: '#e0e0e0', inputText: '#333',
    selectBg: '#f8f8f8', selectBorder: '#e0e0e0', selectText: '#333',
  },
}

const PRESETS: { key: Preset; label: string }[] = [
  { key: 'personalizado', label: 'Personalizado' },
  { key: 'mes-atual', label: 'Este mês' },
  { key: 'mes-passado', label: 'Mês passado' },
  { key: 'ultimos-7', label: 'Últimos 7 dias' },
  { key: 'ultimos-14', label: 'Últimos 14 dias' },
  { key: 'ultimos-30', label: 'Últimos 30 dias' },
  { key: 'ytd-2026', label: '2026 (YTD)' },
]

function fmtDate(d: Date) {
  return d.toISOString().slice(0, 10)
}

function getPeriodo(preset: Preset, custom?: { start: string; end: string }): { start: string; end: string; label: string } {
  const hoje = new Date()
  hoje.setHours(0, 0, 0, 0)

  if (preset === 'personalizado' && custom?.start && custom?.end) {
    const [sy, sm, sd] = custom.start.split('-')
    const [, em, ed] = custom.end.split('-')
    const label = sm === em ? `${sd}/${sm} – ${ed}/${em}/${sy}` : `${sd}/${sm} – ${ed}/${em}/${sy}`
    return { start: custom.start, end: custom.end, label }
  }
  if (preset === 'mes-atual') {
    return { start: fmtDate(new Date(hoje.getFullYear(), hoje.getMonth(), 1)), end: fmtDate(new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0)), label: 'Este mês' }
  }
  if (preset === 'mes-passado') {
    return { start: fmtDate(new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1)), end: fmtDate(new Date(hoje.getFullYear(), hoje.getMonth(), 0)), label: 'Mês passado' }
  }
  if (preset === 'ultimos-7') {
    const s = new Date(hoje); s.setDate(s.getDate() - 6)
    return { start: fmtDate(s), end: fmtDate(hoje), label: 'Últimos 7 dias' }
  }
  if (preset === 'ultimos-14') {
    const s = new Date(hoje); s.setDate(s.getDate() - 13)
    return { start: fmtDate(s), end: fmtDate(hoje), label: 'Últimos 14 dias' }
  }
  if (preset === 'ultimos-30') {
    const s = new Date(hoje); s.setDate(s.getDate() - 29)
    return { start: fmtDate(s), end: fmtDate(hoje), label: 'Últimos 30 dias' }
  }
  if (preset === 'ytd-2026') {
    return { start: '2026-01-01', end: fmtDate(hoje), label: '2026 (YTD)' }
  }
  return { start: fmtDate(new Date(hoje.getFullYear(), hoje.getMonth(), 1)), end: fmtDate(new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0)), label: 'Este mês' }
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
  if (c.status === 'encerrada') return { label: 'ENCERRADA', color: '#6b7280', bg: '#f3f4f6' }
  if (c.status === 'futura') return { label: 'FUTURA', color: '#2563eb', bg: '#dbeafe' }
  if (c.pct < 80 && c.diasRestantes <= 7) return { label: 'EM RISCO', color: '#dc2626', bg: '#fee2e2' }
  return { label: 'EM ANDAMENTO', color: '#d97706', bg: '#fef3c7' }
}

function ProgressBar({ pct, bateu, status, track }: { pct: number; bateu: boolean; status: string; track: string }) {
  const w = Math.min(100, pct)
  const color = bateu ? '#22c55e' : status === 'encerrada' ? '#9ca3af' : pct < 60 ? '#f87171' : pct < 80 ? '#facc15' : '#60a5fa'
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
      <ProgressBar pct={c.pct} bateu={c.bateu} status={c.status} track={t.barTrack} />
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, gap: 8, flexWrap: 'wrap' }}>
        {[
          { label: 'Meta', val: fmt(c.meta), color: t.textSecondary },
          { label: 'Entregue', val: fmt(c.entregue), color: t.textSecondary },
          { label: '%', val: `${c.pct.toFixed(1).replace('.', ',')}%`, color: c.bateu ? '#16a34a' : c.pct < 60 ? '#dc2626' : t.textSecondary },
          { label: 'Dias rest.', val: c.status !== 'ativa' ? '—' : String(c.diasRestantes), color: c.diasRestantes <= 3 && c.status === 'ativa' ? '#dc2626' : t.textSecondary },
          ...(c.investimento > 0 ? [{ label: 'Invest.', val: fmtBrl(c.investimento), color: t.textSecondary }] : []),
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
          {emRisco && <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#f87171', flexShrink: 0, display: 'inline-block' }} />}
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

function PeriodoDropdown({
  preset, custom, t,
  onApply,
}: {
  preset: Preset
  custom: { start: string; end: string }
  t: typeof C['dark']
  onApply: (preset: Preset, custom: { start: string; end: string }) => void
}) {
  const [aberto, setAberto] = useState(false)
  const [tempPreset, setTempPreset] = useState<Preset>(preset)
  const [tempCustom, setTempCustom] = useState(custom)
  const label = getPeriodo(preset, custom).label

  function aplicar() {
    if (tempPreset === 'personalizado' && (!tempCustom.start || !tempCustom.end)) return
    onApply(tempPreset, tempCustom)
    setAberto(false)
  }

  function abrir() {
    setTempPreset(preset)
    setTempCustom(custom)
    setAberto(true)
  }

  const inputStyle: React.CSSProperties = {
    background: t.inputBg, border: `1px solid ${t.inputBorder}`, color: t.inputText,
    borderRadius: 6, padding: '6px 10px', fontSize: 13, width: '100%',
    outline: 'none', colorScheme: 'dark',
  }

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <button
        onClick={aberto ? () => setAberto(false) : abrir}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          padding: '6px 14px', borderRadius: 8, fontSize: 13, fontWeight: 500,
          background: t.filtroBtn, border: `1px solid ${t.border}`, color: t.textSecondary,
          cursor: 'pointer',
        }}
      >
        📅 {label} <span style={{ fontSize: 10, color: t.textMuted }}>▼</span>
      </button>

      {aberto && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 998 }} onClick={() => setAberto(false)} />
          <div style={{
            position: 'absolute', top: 'calc(100% + 8px)', left: 0, zIndex: 999,
            background: t.dropBg, border: `1px solid ${t.dropBorder}`,
            borderRadius: 12, padding: 16, minWidth: 380,
            boxShadow: '0 8px 32px rgba(0,0,0,0.35)',
          }}>
            <div style={{ display: 'flex', gap: 20 }}>
              {/* Presets */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 160 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: t.textMuted, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 }}>PERÍODOS</div>
                {PRESETS.map(p => (
                  <div
                    key={p.key}
                    onClick={() => setTempPreset(p.key)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: '7px 10px', borderRadius: 7, cursor: 'pointer',
                      background: tempPreset === p.key ? '#1A3CFF1A' : 'transparent',
                      transition: 'background 0.1s',
                    }}
                  >
                    <div style={{
                      width: 12, height: 12, borderRadius: '50%', flexShrink: 0,
                      border: `2px solid ${tempPreset === p.key ? '#1A3CFF' : t.textMuted}`,
                      background: tempPreset === p.key ? '#1A3CFF' : 'transparent',
                    }} />
                    <span style={{ fontSize: 13, color: tempPreset === p.key ? t.dropActive : t.dropText }}>
                      {p.label}
                    </span>
                  </div>
                ))}
              </div>

              {/* Custom date inputs */}
              {tempPreset === 'personalizado' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12, flex: 1, paddingTop: 28 }}>
                  <div>
                    <div style={{ fontSize: 11, color: t.textMuted, marginBottom: 5 }}>Data inicial</div>
                    <input
                      type="date"
                      value={tempCustom.start}
                      onChange={e => setTempCustom(c => ({ ...c, start: e.target.value }))}
                      style={inputStyle}
                    />
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: t.textMuted, marginBottom: 5 }}>Data final</div>
                    <input
                      type="date"
                      value={tempCustom.end}
                      onChange={e => setTempCustom(c => ({ ...c, end: e.target.value }))}
                      style={inputStyle}
                    />
                  </div>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16, paddingTop: 12, borderTop: `1px solid ${t.dropBorder}` }}>
              <button
                onClick={() => setAberto(false)}
                style={{ padding: '6px 16px', borderRadius: 7, fontSize: 13, background: 'transparent', border: `1px solid ${t.border}`, color: t.textMuted, cursor: 'pointer' }}
              >
                Cancelar
              </button>
              <button
                onClick={aplicar}
                style={{ padding: '6px 16px', borderRadius: 7, fontSize: 13, background: '#1A3CFF', border: 'none', color: '#fff', cursor: 'pointer', fontWeight: 600 }}
              >
                Aplicar
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

const GRUPOS: { key: 'todos' | 'risco' | 'agencia' | 'govba' | 'politica'; baseLabel: string }[] = [
  { key: 'todos', baseLabel: 'Todos' },
  { key: 'risco', baseLabel: 'Em risco' },
  { key: 'agencia', baseLabel: 'Agência' },
  { key: 'govba', baseLabel: 'GOV-BA' },
  { key: 'politica', baseLabel: 'Política' },
]

export default function EntregasPage({ theme = 'dark' }: { theme?: Theme }) {
  const [data, setData] = useState<ClienteData[] | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [filtroGrupo, setFiltroGrupo] = useState<'todos' | 'risco' | 'agencia' | 'govba' | 'politica'>('todos')
  const [filtroCliente, setFiltroCliente] = useState('')
  const [preset, setPreset] = useState<Preset>('mes-atual')
  const [custom, setCustom] = useState({ start: '', end: '' })

  const t = C[theme]
  const periodoRef = useRef(getPeriodo('mes-atual'))

  function fetchData(p: { start: string; end: string }) {
    setLoading(true)
    setError('')
    fetch(`/api/entregas?start=${p.start}&end=${p.end}`)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false) })
      .catch(() => { setError('Erro ao carregar dados.'); setLoading(false) })
  }

  function aplicarPeriodo(newPreset: Preset, newCustom: { start: string; end: string }) {
    const p = getPeriodo(newPreset, newCustom)
    periodoRef.current = p
    setPreset(newPreset)
    setCustom(newCustom)
    setFiltroCliente('')
    fetchData(p)
  }

  useEffect(() => {
    const p = getPeriodo('mes-atual')
    periodoRef.current = p
    fetchData(p)

    const scheduleNext = (): ReturnType<typeof setTimeout> => {
      const now = new Date()
      const nextEvenHour = (Math.floor(now.getHours() / 2) * 2 + 2) % 24
      const next = new Date(now)
      next.setHours(nextEvenHour, 1, 0, 0)
      if (next <= now) next.setDate(next.getDate() + 1)
      return setTimeout(() => {
        const cur = periodoRef.current
        fetch(`/api/entregas?start=${cur.start}&end=${cur.end}`)
          .then(r => r.json()).then(setData).catch(() => {})
        timer = scheduleNext()
      }, next.getTime() - now.getTime())
    }
    let timer = scheduleNext()
    return () => clearTimeout(timer)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const center: React.CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', minHeight: 200 }

  // Clientes únicos para o seletor
  const clientes = [...new Set((data ?? []).map(d => d.cliente))].sort()

  // Dados filtrados
  const filtrado = (data ?? [])
    .filter(d => !filtroCliente || d.cliente === filtroCliente)
    .filter(d => {
      if (filtroGrupo === 'risco') return d.campanhas.some(c => !c.bateu && c.pct < 80 && c.diasRestantes <= 7 && c.status === 'ativa')
      if (filtroGrupo !== 'todos') return d.grupo === filtroGrupo
      return true
    })

  const emRisco = filtrado.flatMap(d => d.campanhas.filter(c => !c.bateu && c.pct < 80 && c.diasRestantes <= 7 && c.status === 'ativa')).map(c => c.nome)

  const btnGrupo = (key: typeof filtroGrupo, label: string) => (
    <button
      key={key}
      onClick={() => setFiltroGrupo(key)}
      style={{
        padding: '6px 14px', borderRadius: 20, fontSize: 12, cursor: 'pointer', transition: 'all 0.15s',
        background: filtroGrupo === key ? '#1A3CFF' : t.filtroBtn,
        border: `1px solid ${filtroGrupo === key ? '#1A3CFF' : t.border}`,
        color: filtroGrupo === key ? '#fff' : t.filtroBtnText,
      }}
    >
      {label}
    </button>
  )

  return (
    <div style={{ padding: '20px 24px 40px', overflowY: 'auto', height: '100%', boxSizing: 'border-box', background: t.page }}>

      {/* Linha 1: Período + Cliente */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <PeriodoDropdown preset={preset} custom={custom} t={t} onApply={aplicarPeriodo} />

        {/* Seletor de cliente */}
        <select
          value={filtroCliente}
          onChange={e => setFiltroCliente(e.target.value)}
          style={{
            background: t.selectBg, border: `1px solid ${t.selectBorder}`, color: t.selectText,
            borderRadius: 8, padding: '6px 12px', fontSize: 13, cursor: 'pointer', outline: 'none',
          }}
        >
          <option value="">Todos os clientes</option>
          {clientes.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {/* Linha 2: Filtros de grupo */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        {GRUPOS.map(g => {
          const label = g.key === 'risco' ? `Em risco (${emRisco.length})` : g.baseLabel
          return btnGrupo(g.key, label)
        })}
      </div>

      {/* Alerta */}
      {!loading && emRisco.length > 0 && (
        <div style={{ display: 'flex', gap: 12, background: t.alertBg, border: `1px solid ${t.alertBorder}`, borderRadius: 8, padding: '12px 16px', marginBottom: 20, alignItems: 'flex-start' }}>
          <span style={{ fontSize: 18, color: '#dc2626', flexShrink: 0, marginTop: 1 }}>⚠</span>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#dc2626', marginBottom: 4 }}>Campanhas em risco de não bater a meta</div>
            <div style={{ fontSize: 12, color: '#f87171', lineHeight: 1.6 }}>{emRisco.join(' · ')}</div>
          </div>
        </div>
      )}

      {/* Conteúdo */}
      {loading ? (
        <div style={center}>
          <div style={{ width: 28, height: 28, border: `3px solid ${t.spinner}`, borderTop: '3px solid #1A3CFF', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        </div>
      ) : error ? (
        <div style={center}><span style={{ color: t.textMuted }}>{error}</span></div>
      ) : !filtrado.length ? (
        <div style={center}><span style={{ color: t.emptyText }}>Nenhuma campanha no período selecionado.</span></div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {filtrado.map((d, i) => <ClienteBlock key={i} data={d} t={t} />)}
        </div>
      )}
    </div>
  )
}

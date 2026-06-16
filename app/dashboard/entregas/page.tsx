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
  diasPercorridos: number
  totalDias: number
  status: 'ativa' | 'encerrada' | 'futura'
  inicioStr: string
  terminoStr: string
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
    const [ey, em, ed] = custom.end.split('-')
    const label = sm === em && sy === ey ? `${sd}/${sm} – ${ed}/${em}/${sy}` : `${sd}/${sm}/${sy} – ${ed}/${em}/${ey}`
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

function fmtExact(n: number): string {
  return n.toLocaleString('pt-BR')
}

function statusBadge(c: Campanha) {
  if (c.bateu || c.pct >= 100) return { label: 'BATEU', color: '#16a34a', bg: '#dcfce7' }
  if (c.status === 'encerrada') return { label: 'ENCERRADA', color: '#6b7280', bg: '#f3f4f6' }
  if (c.status === 'futura') return { label: 'FUTURA', color: '#2563eb', bg: '#dbeafe' }
  if (c.pct < 80 && c.diasRestantes <= 7) return { label: 'EM RISCO', color: '#dc2626', bg: '#fee2e2' }
  return { label: 'EM ANDAMENTO', color: '#d97706', bg: '#fef3c7' }
}

function deliveryColor(pct: number, bateu: boolean, status: string): string {
  if (bateu || pct >= 100) return '#22c55e'
  if (status === 'encerrada') return '#9ca3af'
  if (pct <= 35) return '#f87171'
  if (pct <= 60) return '#facc15'
  if (pct <= 70) return '#fb923c'
  return '#22c55e'
}

function ProgressBar({ pct, bateu, status, track }: { pct: number; bateu: boolean; status: string; track: string }) {
  const w = Math.min(100, pct)
  const color = deliveryColor(pct, bateu, status)
  return (
    <div style={{ background: track, borderRadius: 4, height: 8 }}>
      <div style={{ width: `${w}%`, height: '100%', background: color, borderRadius: 4, transition: 'width 0.6s ease' }} />
    </div>
  )
}

function BarsWithTooltip({ c, t }: { c: Campanha; t: typeof C['dark'] }) {
  const [tip, setTip] = useState<{ x: number; y: number } | null>(null)

  const hoje = new Date()
  const dateLabel = hoje.toLocaleDateString('pt-BR', {
    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
  })

  const entregaColor = deliveryColor(c.pct, c.bateu, c.status)
  const tempoColor = c.status === 'encerrada' ? '#6b7280' : '#3b82f6'
  const tempoPct = c.status === 'futura' ? 0 : Math.min(100, Math.round((c.diasPercorridos / c.totalDias) * 100))

  return (
    <div
      onMouseMove={e => {
        const offX = e.clientX > window.innerWidth - 230 ? -214 : 14
        setTip({ x: e.clientX + offX, y: e.clientY })
      }}
      onMouseLeave={() => setTip(null)}
    >
      {/* Barra de entrega */}
      <div style={{ marginTop: 10 }}>
        <div style={{ fontSize: 9, fontWeight: 700, color: t.textMuted, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 3 }}>Entrega</div>
        <ProgressBar pct={c.pct} bateu={c.bateu} status={c.status} track={t.barTrack} />
      </div>

      {/* Barra de dias percorridos */}
      {c.status !== 'futura' && (
        <div style={{ marginTop: 6 }}>
          <div style={{ fontSize: 9, fontWeight: 700, color: t.textMuted, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 3 }}>Dias Percorridos</div>
          <div style={{ background: t.barTrack, borderRadius: 4, height: 6 }}>
            <div style={{ width: `${tempoPct}%`, height: '100%', background: tempoColor, borderRadius: 4, transition: 'width 0.6s ease' }} />
          </div>
          <div style={{ fontSize: 9, color: '#6b7280', marginTop: 3, textAlign: 'right' }}>
            {tempoPct}% do período · {c.diasPercorridos}/{c.totalDias} dias
          </div>
        </div>
      )}

      {/* Tooltip flutuante estilo Google Ads */}
      {tip && (
        <div style={{
          position: 'fixed',
          left: tip.x,
          top: tip.y,
          transform: 'translateY(-50%)',
          zIndex: 9999,
          pointerEvents: 'none',
          background: '#fff',
          border: '1px solid #dadce0',
          borderRadius: 8,
          boxShadow: '0 4px 18px rgba(0,0,0,0.14)',
          padding: '10px 14px',
          minWidth: 196,
          fontFamily: 'inherit',
        }}>
          {/* Título: data atual */}
          <div style={{ fontSize: 11, color: '#777', marginBottom: 7, fontWeight: 500, whiteSpace: 'nowrap' }}>
            {dateLabel}
          </div>
          <div style={{ height: 1, background: '#eee', marginBottom: 7 }} />

          {/* Linha: Entrega */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: c.status !== 'futura' ? 5 : 0 }}>
            <div style={{ width: 12, height: 3, borderRadius: 2, background: entregaColor, flexShrink: 0 }} />
            <span style={{ fontSize: 12, color: '#555', flex: 1, whiteSpace: 'nowrap' }}>
              {(c.metrica || 'Entrega').replace(/\[.*?\]/g, '').trim()}
            </span>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#111', marginLeft: 16, whiteSpace: 'nowrap' }}>
              {fmtExact(c.entregue)}
            </span>
          </div>

          {/* Linha: Dias percorridos */}
          {c.status !== 'futura' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 12, height: 3, borderRadius: 2, background: tempoColor, flexShrink: 0 }} />
              <span style={{ fontSize: 12, color: '#555', flex: 1, whiteSpace: 'nowrap' }}>Dias percorridos</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: '#111', marginLeft: 16, whiteSpace: 'nowrap' }}>
                {c.diasPercorridos} de {c.totalDias}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function normData(s: string) {
  return s ? s.replace(/\./g, '/') : ''
}

function NumWithTooltip({ abbrev, exact, color }: { abbrev: string; exact: string; color: string }) {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null)
  const [copied, setCopied] = useState(false)
  const canCopy = abbrev !== '—'

  return (
    <>
      <span
        onMouseEnter={e => {
          if (!canCopy) return
          const r = (e.currentTarget as HTMLElement).getBoundingClientRect()
          setPos({ x: r.left + r.width / 2, y: r.top })
        }}
        onMouseLeave={() => { setPos(null); setCopied(false) }}
        onClick={() => {
          if (!canCopy) return
          navigator.clipboard.writeText(exact)
          setCopied(true)
          setTimeout(() => setCopied(false), 1200)
        }}
        style={{
          fontSize: 13, fontWeight: 600, color,
          cursor: canCopy ? 'copy' : 'default',
          userSelect: 'none',
          display: 'inline-block',
        }}
      >
        {abbrev}
      </span>
      {pos && (
        <span style={{
          position: 'fixed',
          left: pos.x, top: pos.y - 8,
          transform: 'translate(-50%, -100%)',
          background: '#0d0d0d', border: '1px solid #444',
          color: copied ? '#4ade80' : '#e8e8e8', fontSize: 11, fontWeight: 500,
          padding: '5px 11px', borderRadius: 7, whiteSpace: 'nowrap',
          zIndex: 9999, pointerEvents: 'none',
          boxShadow: '0 8px 24px rgba(0,0,0,0.65)',
          letterSpacing: 0.2,
        }}>
          {copied ? '✓ Copiado!' : exact}
        </span>
      )}
    </>
  )
}

function CampanhaCard({ c, t, dimmed }: { c: Campanha; t: typeof C['dark']; dimmed?: boolean }) {
  const badge = statusBadge(c)
  const periodoTag = c.inicioStr && c.terminoStr
    ? `📅 ${normData(c.inicioStr)} → ${normData(c.terminoStr)}` : ''
  const canalTag = [c.canal, c.metrica].filter(Boolean).join(' · ')

  const metaAbrev = c.meta > 0 ? fmt(c.meta) : '—'
  const metaExact = c.meta > 0 ? fmtExact(c.meta) : '—'
  const entAbrev = fmt(c.entregue)
  const entExact = fmtExact(c.entregue)

  const cols = 4

  return (
    <div style={{
      background: t.cardInner, border: `1px solid ${t.borderInner}`,
      borderRadius: 8, padding: '12px 14px', marginBottom: 8,
      opacity: dimmed ? 0.5 : 1,
    }}>
      {/* Linha 1: nome + badge de status */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: t.textPrimary, lineHeight: 1.3 }}>{c.nome}</span>
        <span style={{
          fontSize: 10, fontWeight: 700, padding: '3px 9px', borderRadius: 5,
          whiteSpace: 'nowrap', flexShrink: 0, letterSpacing: 0.3,
          color: badge.color, background: badge.bg,
        }}>
          {badge.label}
        </span>
      </div>

      {/* Linha 2: tag de período */}
      {periodoTag && (
        <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
          <span style={{
            fontSize: 11, padding: '3px 10px', borderRadius: 20,
            background: '#1A3CFF18', color: '#7ba3ff',
            border: '1px solid #1A3CFF33', whiteSpace: 'nowrap',
          }}>
            {periodoTag}
          </span>
        </div>
      )}

      {/* Barras de progresso: entrega + tempo com tooltip */}
      <BarsWithTooltip c={c} t={t} />

      {/* Métricas inferiores */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${cols}, 1fr)`,
        gap: '10px 12px',
        marginTop: 10, paddingTop: 10,
        borderTop: `1px solid ${t.borderInner}`,
      }}>
        {/* Meta */}
        <div>
          <div style={{ fontSize: 9, fontWeight: 700, color: t.textMuted, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 4 }}>Meta</div>
          <NumWithTooltip abbrev={metaAbrev} exact={metaExact} color={t.textSecondary} />
        </div>

        {/* Entregue — cor reflete o progresso da entrega */}
        <div>
          <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: 0.8, marginBottom: 4, textTransform: 'uppercase', color: c.entregue === 0 && c.status === 'ativa' ? t.textMuted : deliveryColor(c.pct, c.bateu, c.status) }}>Entregue</div>
          <NumWithTooltip
            abbrev={entAbrev} exact={entExact}
            color={c.entregue === 0 && c.status === 'ativa' ? t.textMuted : deliveryColor(c.pct, c.bateu, c.status)}
          />
        </div>

        {/* Progresso */}
        <div>
          <div style={{ fontSize: 9, fontWeight: 700, color: t.textMuted, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 4 }}>Progresso</div>
          <span style={{
            fontSize: 13, fontWeight: 600,
            color: c.bateu ? '#16a34a' : (c.pct < 60 && c.meta > 0) ? '#dc2626' : t.textSecondary,
          }}>
            {c.meta > 0 ? `${c.pct.toFixed(1).replace('.', ',')}%` : '—'}
          </span>
        </div>

        {/* Dias restantes */}
        <div>
          <div style={{ fontSize: 9, fontWeight: 700, color: t.textMuted, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 4 }}>Dias rest.</div>
          <span style={{
            fontSize: 13, fontWeight: 600,
            color: c.diasRestantes <= 3 && c.status === 'ativa' ? '#dc2626' : t.textSecondary,
          }}>
            {c.status !== 'ativa' ? '—' : String(c.diasRestantes)}
          </span>
        </div>

      </div>
    </div>
  )
}

const STATUS_ORDER: Record<string, number> = { ativa: 0, futura: 1, encerrada: 2 }

function ClienteBlock({ data, t }: { data: ClienteData; t: typeof C['dark'] }) {
  const [open, setOpen] = useState(true)

  const ativas = data.campanhas
    .filter(c => c.status !== 'encerrada')
    .sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status])
  const encerradas = data.campanhas.filter(c => c.status === 'encerrada')

  if (ativas.length === 0 && encerradas.length === 0) return null

  const emRisco = ativas.some(c => !c.bateu && c.pct < 80 && c.diasRestantes <= 7 && c.status === 'ativa')
  const totalVisiveis = ativas.length + encerradas.length

  return (
    <div style={{ border: `1px solid ${emRisco ? '#fca5a5' : t.border}`, borderRadius: 10, overflow: 'hidden', background: t.card }}>
      <button onClick={() => setOpen(o => !o)} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', padding: '14px 16px', background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {emRisco && <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#f87171', flexShrink: 0, display: 'inline-block' }} />}
          <span style={{ fontSize: 14, fontWeight: 600, color: t.textPrimary }}>{data.cliente}</span>
          <span style={{ fontSize: 11, color: t.textMuted, marginLeft: 4 }}>{totalVisiveis} campanha{totalVisiveis !== 1 ? 's' : ''}</span>
        </div>
        <span style={{ color: t.chevron, fontSize: 12 }}>{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div style={{ padding: '0 16px 16px' }}>
          {ativas.map((c, i) => <CampanhaCard key={i} c={c} t={t} />)}
          {encerradas.length > 0 && ativas.length > 0 && (
            <div style={{ fontSize: 10, fontWeight: 600, color: t.textMuted, letterSpacing: 1, textTransform: 'uppercase', margin: '12px 0 8px', paddingTop: 8, borderTop: `1px solid ${t.border}` }}>
              ENCERRADAS
            </div>
          )}
          {encerradas.map((c, i) => <CampanhaCard key={`enc-${i}`} c={c} t={t} dimmed />)}
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

              {/* Datas personalizadas */}
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

export default function EntregasPage({ theme = 'dark' }: { theme?: Theme }) {
  const [data, setData] = useState<ClienteData[] | null>(null)
  const [sheets, setSheets] = useState<string[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [filtroCliente, setFiltroCliente] = useState('')
  const [preset, setPreset] = useState<Preset>('mes-atual')
  const [custom, setCustom] = useState({ start: '', end: '' })
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [cooldown, setCooldown] = useState(false)

  const t = C[theme]
  const periodoRef = useRef(getPeriodo('mes-atual'))
  const cooldownRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  function parseResponse(res: unknown) {
    if (res && typeof res === 'object' && !Array.isArray(res)) {
      const r = res as { sheets?: string[]; data?: ClienteData[] }
      return { data: r.data ?? [], sheets: r.sheets ?? [] }
    }
    // fallback: resposta antiga era array direto
    return { data: Array.isArray(res) ? res : [], sheets: [] }
  }

  function fetchData(p: { start: string; end: string }) {
    setLoading(true)
    setError('')
    fetch(`/api/entregas?start=${p.start}&end=${p.end}`)
      .then(r => r.json())
      .then(res => {
        const parsed = parseResponse(res)
        setData(parsed.data)
        if (parsed.sheets.length > 0) setSheets(parsed.sheets)
        setLastUpdated(new Date())
        setLoading(false)
      })
      .catch(() => { setError('Erro ao carregar dados.'); setLoading(false) })
  }

  function handleManualRefresh() {
    if (cooldown || loading) return
    setCooldown(true)
    fetchData(periodoRef.current)
    if (cooldownRef.current) clearTimeout(cooldownRef.current)
    cooldownRef.current = setTimeout(() => setCooldown(false), 30000)
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
          .then(r => r.json())
          .then(res => {
            const parsed = parseResponse(res)
            setData(parsed.data)
            if (parsed.sheets.length > 0) setSheets(parsed.sheets)
            setLastUpdated(new Date())
          })
          .catch(() => {})
        timer = scheduleNext()
      }, next.getTime() - now.getTime())
    }
    let timer = scheduleNext()
    return () => { clearTimeout(timer); if (cooldownRef.current) clearTimeout(cooldownRef.current) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const center: React.CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', minHeight: 200 }

  // Dados filtrados pelo cliente selecionado
  const filtrado = (data ?? []).filter(d => !filtroCliente || d.cliente === filtroCliente)

  // Alertas de risco: só campanhas ativas (encerradas excluídas)
  const emRisco = filtrado
    .flatMap(d => d.campanhas.filter(c => c.status === 'ativa' && !c.bateu && c.pct < 80 && c.diasRestantes <= 7))
    .map(c => c.nome)

  return (
    <div style={{ padding: '20px 24px 40px', overflowY: 'auto', height: '100%', boxSizing: 'border-box', background: t.page }}>

      {/* Controles: período + cliente */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        <PeriodoDropdown preset={preset} custom={custom} t={t} onApply={aplicarPeriodo} />

        <select
          value={filtroCliente}
          onChange={e => setFiltroCliente(e.target.value)}
          style={{
            background: t.selectBg, border: `1px solid ${t.selectBorder}`, color: t.selectText,
            borderRadius: 8, padding: '6px 12px', fontSize: 13, cursor: 'pointer', outline: 'none',
            height: 34,
          }}
        >
          <option value="">Todos os clientes</option>
          {sheets.map(c => <option key={c} value={c}>{c}</option>)}
        </select>

        <button
          onClick={handleManualRefresh}
          disabled={cooldown || loading}
          title={cooldown ? 'Aguarde 30s para atualizar novamente' : 'Atualizar dados'}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 12px', borderRadius: 8, fontSize: 12, fontWeight: 500, cursor: cooldown || loading ? 'not-allowed' : 'pointer', border: `1px solid ${t.border}`, background: t.filtroBtn, color: cooldown || loading ? t.textMuted : t.filtroBtnText, transition: 'all 0.15s', flexShrink: 0 }}
        >
          <span style={{ display: 'inline-block', animation: loading ? 'spin 0.8s linear infinite' : 'none' }}>↻</span>
          {lastUpdated ? `${String(lastUpdated.getHours()).padStart(2,'0')}:${String(lastUpdated.getMinutes()).padStart(2,'0')}` : 'Atualizar'}
        </button>

        {loading && (
          <div style={{ width: 18, height: 18, border: `2px solid ${t.spinner}`, borderTop: '2px solid #1A3CFF', borderRadius: '50%', animation: 'spin 0.8s linear infinite', flexShrink: 0 }} />
        )}
      </div>

      {/* Alerta de campanhas em risco */}
      {!loading && emRisco.length > 0 && (
        <div style={{ display: 'flex', gap: 12, background: t.alertBg, border: `1px solid ${t.alertBorder}`, borderRadius: 8, padding: '12px 16px', marginBottom: 20, alignItems: 'flex-start' }}>
          <span style={{ fontSize: 18, color: '#dc2626', flexShrink: 0, marginTop: 1 }}>⚠</span>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#dc2626', marginBottom: 4 }}>Campanhas em risco de não bater a meta</div>
            <div style={{ fontSize: 12, color: '#f87171', lineHeight: 1.6 }}>{emRisco.join(' · ')}</div>
          </div>
        </div>
      )}

      {/* Conteúdo principal */}
      {loading && !data ? (
        <div style={center}>
          <div style={{ width: 28, height: 28, border: `3px solid ${t.spinner}`, borderTop: '3px solid #1A3CFF', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        </div>
      ) : error ? (
        <div style={center}><span style={{ color: t.textMuted }}>{error}</span></div>
      ) : !filtrado.length ? (
        <div style={center}>
          <span style={{ color: t.emptyText }}>
            {filtroCliente
              ? `Nenhuma campanha de ${filtroCliente} no período selecionado.`
              : 'Nenhuma campanha no período selecionado.'}
          </span>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {filtrado.map((d, i) => <ClienteBlock key={i} data={d} t={t} />)}
        </div>
      )}
    </div>
  )
}

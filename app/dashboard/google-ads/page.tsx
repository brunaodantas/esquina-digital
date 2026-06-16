'use client'

import { useEffect, useRef, useState } from 'react'
import type { AccountData, CampaignData, AdGroupData, AdData, DailyPoint } from '@/app/api/google-ads/route'

type Theme = 'dark' | 'light'
type Preset = 'personalizado' | 'mes-atual' | 'mes-passado' | 'ultimos-7' | 'ultimos-14' | 'ultimos-30' | 'ytd-2026'
type TipoTab = 'todas' | 'pesquisa' | 'display' | 'pmax' | 'video' | 'demand-gen' | 'outros'
type StatusTab = 'todas' | 'ativo' | 'pausado'
type Nivel = 'campanhas' | 'grupos' | 'anuncios'

const C = {
  dark: {
    page: '#111111', card: '#1a1a1a', border: '#2a2a2a', borderInner: '#222',
    textPrimary: '#fff', textSecondary: '#ddd', textMuted: '#555',
    barTrack: '#2a2a2a', spinner: '#2a2a2a',
    filtroBtn: '#2a2a2a', emptyText: '#555', chevron: '#555',
    dropBg: '#1e1e1e', dropBorder: '#2a2a2a', dropText: '#bbb', dropActive: '#ffffff', dropHover: '#ffffff12',
    inputBg: '#111', inputBorder: '#333', inputText: '#ccc',
    selectBg: '#1e1e1e', selectBorder: '#333', selectText: '#ccc',
    kpiBg: '#161616', kpiBorder: '#222',
    tableBorder: '#1e1e1e', tableHover: '#ffffff06',
    chipBg: '#222', nivelBg: '#0d0d0d', nivelBorder: '#222',
  },
  light: {
    page: '#f0f2f5', card: '#ffffff', border: '#e8e8e8', borderInner: '#eeeeee',
    textPrimary: '#111', textSecondary: '#333', textMuted: '#999',
    barTrack: '#e8e8e8', spinner: '#e0e0e0',
    filtroBtn: '#e8e8e8', emptyText: '#aaa', chevron: '#bbb',
    dropBg: '#ffffff', dropBorder: '#e0e0e0', dropText: '#555', dropActive: '#111', dropHover: '#00000008',
    inputBg: '#f8f8f8', inputBorder: '#e0e0e0', inputText: '#333',
    selectBg: '#f8f8f8', selectBorder: '#e0e0e0', selectText: '#333',
    kpiBg: '#ffffff', kpiBorder: '#e8e8e8',
    tableBorder: '#f0f0f0', tableHover: '#00000004',
    chipBg: '#e8e8e8', nivelBg: '#f8f8f8', nivelBorder: '#e0e0e0',
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

const TIPO_TABS: { key: TipoTab; label: string }[] = [
  { key: 'todas', label: 'Todas' }, { key: 'pesquisa', label: 'Pesquisa' },
  { key: 'display', label: 'Display' }, { key: 'pmax', label: 'Perf. Max' },
  { key: 'video', label: 'Vídeo' }, { key: 'demand-gen', label: 'Demand Gen' },
  { key: 'outros', label: 'Outros' },
]

const NIVEL_TABS: { key: Nivel; label: string }[] = [
  { key: 'campanhas', label: 'Campanhas' },
  { key: 'grupos', label: 'Grupos de Anúncios' },
  { key: 'anuncios', label: 'Anúncios' },
]

function fmtDate(d: Date) { return d.toISOString().slice(0, 10) }

function getPeriodo(preset: Preset, custom?: { start: string; end: string }): { start: string; end: string; label: string } {
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0)
  if (preset === 'personalizado' && custom?.start && custom?.end) {
    const [sy, sm, sd] = custom.start.split('-'); const [ey, em, ed] = custom.end.split('-')
    const label = sm === em && sy === ey ? `${sd}/${sm} – ${ed}/${em}/${sy}` : `${sd}/${sm}/${sy} – ${ed}/${em}/${ey}`
    return { start: custom.start, end: custom.end, label }
  }
  if (preset === 'mes-atual') return { start: fmtDate(new Date(hoje.getFullYear(), hoje.getMonth(), 1)), end: fmtDate(new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0)), label: 'Este mês' }
  if (preset === 'mes-passado') return { start: fmtDate(new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1)), end: fmtDate(new Date(hoje.getFullYear(), hoje.getMonth(), 0)), label: 'Mês passado' }
  if (preset === 'ultimos-7') { const s = new Date(hoje); s.setDate(s.getDate() - 6); return { start: fmtDate(s), end: fmtDate(hoje), label: 'Últimos 7 dias' } }
  if (preset === 'ultimos-14') { const s = new Date(hoje); s.setDate(s.getDate() - 13); return { start: fmtDate(s), end: fmtDate(hoje), label: 'Últimos 14 dias' } }
  if (preset === 'ultimos-30') { const s = new Date(hoje); s.setDate(s.getDate() - 29); return { start: fmtDate(s), end: fmtDate(hoje), label: 'Últimos 30 dias' } }
  if (preset === 'ytd-2026') return { start: '2026-01-01', end: fmtDate(hoje), label: '2026 (YTD)' }
  return { start: fmtDate(new Date(hoje.getFullYear(), hoje.getMonth(), 1)), end: fmtDate(new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0)), label: 'Este mês' }
}

function fmtNum(n: number) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace('.', ',') + 'M'
  if (n >= 1_000) return (n / 1_000).toFixed(1).replace('.', ',') + 'k'
  return n.toLocaleString('pt-BR')
}
function fmtNumFull(n: number) { return n.toLocaleString('pt-BR') }
function fmtBRL(n: number) { return 'R$ ' + n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }
function fmtPct(n: number) { return n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '%' }

function CopiavelNum({ compact, full = compact }: { compact: string; full?: string }) {
  const [tip, setTip] = useState<'hover' | 'copied' | null>(null)
  return (
    <span
      style={{ position: 'relative', cursor: 'copy', userSelect: 'none' }}
      onMouseEnter={() => setTip('hover')}
      onMouseLeave={() => setTip(null)}
      onClick={() => {
        navigator.clipboard.writeText(full)
        setTip('copied')
        setTimeout(() => setTip(null), 1200)
      }}
    >
      {compact}
      {tip && (
        <span style={{
          position: 'absolute', bottom: 'calc(100% + 6px)', right: '50%',
          transform: 'translateX(50%)', background: '#0f172a',
          border: '1px solid #334155', borderRadius: 5, padding: '3px 8px',
          fontSize: 11, whiteSpace: 'nowrap', zIndex: 200, pointerEvents: 'none',
          color: tip === 'copied' ? '#4ade80' : '#e2e8f0', fontWeight: 400, lineHeight: '1.5',
        }}>
          {tip === 'copied' ? '✓ Copiado!' : full}
        </span>
      )}
    </span>
  )
}
function fmtDateLabel(iso: string) { const [, m, d] = iso.split('-'); return `${d}/${m}` }

// ─── Period Dropdown ──────────────────────────────────────────────────────────
function PeriodoDropdown({ preset, custom, t, onApply }: {
  preset: Preset; custom: { start: string; end: string }; t: typeof C['dark']
  onApply: (p: Preset, c: { start: string; end: string }) => void
}) {
  const [aberto, setAberto] = useState(false)
  const [tp, setTp] = useState<Preset>(preset)
  const [tc, setTc] = useState(custom)
  const label = getPeriodo(preset, custom).label

  function aplicar() {
    if (tp === 'personalizado' && (!tc.start || !tc.end)) return
    onApply(tp, tc); setAberto(false)
  }
  function abrir() { setTp(preset); setTc(custom); setAberto(true) }

  const inputStyle: React.CSSProperties = {
    background: t.inputBg, border: `1px solid ${t.inputBorder}`, color: t.inputText,
    borderRadius: 6, padding: '6px 10px', fontSize: 13, width: '100%', outline: 'none', colorScheme: 'dark',
  }
  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <button onClick={aberto ? () => setAberto(false) : abrir} style={{
        display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 14px', borderRadius: 8,
        fontSize: 13, fontWeight: 500, background: t.filtroBtn, border: `1px solid ${t.border}`, color: t.textSecondary, cursor: 'pointer',
      }}>📅 {label} <span style={{ fontSize: 10, color: t.textMuted }}>▼</span></button>
      {aberto && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 998 }} onClick={() => setAberto(false)} />
          <div style={{ position: 'absolute', top: 'calc(100% + 8px)', left: 0, zIndex: 999, background: t.dropBg, border: `1px solid ${t.dropBorder}`, borderRadius: 12, padding: 16, minWidth: 380, boxShadow: '0 8px 32px rgba(0,0,0,0.35)' }}>
            <div style={{ display: 'flex', gap: 20 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 160 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: t.textMuted, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 }}>PERÍODOS</div>
                {PRESETS.map(p => (
                  <div key={p.key} onClick={() => setTp(p.key)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 10px', borderRadius: 7, cursor: 'pointer', background: tp === p.key ? '#1A3CFF1A' : 'transparent' }}>
                    <div style={{ width: 12, height: 12, borderRadius: '50%', flexShrink: 0, border: `2px solid ${tp === p.key ? '#1A3CFF' : t.textMuted}`, background: tp === p.key ? '#1A3CFF' : 'transparent' }} />
                    <span style={{ fontSize: 13, color: tp === p.key ? t.dropActive : t.dropText }}>{p.label}</span>
                  </div>
                ))}
              </div>
              {tp === 'personalizado' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12, flex: 1, paddingTop: 28 }}>
                  <div><div style={{ fontSize: 11, color: t.textMuted, marginBottom: 5 }}>Data inicial</div><input type="date" value={tc.start} onChange={e => setTc(c => ({ ...c, start: e.target.value }))} style={inputStyle} /></div>
                  <div><div style={{ fontSize: 11, color: t.textMuted, marginBottom: 5 }}>Data final</div><input type="date" value={tc.end} onChange={e => setTc(c => ({ ...c, end: e.target.value }))} style={inputStyle} /></div>
                </div>
              )}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16, paddingTop: 12, borderTop: `1px solid ${t.dropBorder}` }}>
              <button onClick={() => setAberto(false)} style={{ padding: '6px 16px', borderRadius: 7, fontSize: 13, background: 'transparent', border: `1px solid ${t.border}`, color: t.textMuted, cursor: 'pointer' }}>Cancelar</button>
              <button onClick={aplicar} style={{ padding: '6px 16px', borderRadius: 7, fontSize: 13, background: '#1A3CFF', border: 'none', color: '#fff', cursor: 'pointer', fontWeight: 600 }}>Aplicar</button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// ─── KPI Tile ─────────────────────────────────────────────────────────────────
function KpiTile({ label, value, t, delta }: { label: string; value: string; t: typeof C['dark']; delta?: number | null }) {
  return (
    <div style={{ background: t.kpiBg, border: `1px solid ${t.kpiBorder}`, borderRadius: 10, padding: '14px 16px' }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: t.textMuted, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 700, color: t.textPrimary, lineHeight: 1.2 }}><CopiavelNum compact={value} /></div>
      {delta != null && (
        <div style={{ fontSize: 11, fontWeight: 700, color: delta >= 0 ? '#22c55e' : '#f87171', marginTop: 4 }}>
          {delta > 0 ? '+' : ''}{delta.toFixed(1).replace('.', ',')}%
        </div>
      )}
    </div>
  )
}

// ─── Trend Chart (multi-select) ───────────────────────────────────────────────
type BarMetric = 'custo' | 'cliques' | 'impressoes'
type LineMetric = 'cpcMedio' | 'ctr' | 'cliques' | 'impressoes'

const BAR_OPTIONS: { key: BarMetric; label: string; color: string }[] = [
  { key: 'custo',      label: 'Investimento', color: '#1A3CFF' },
  { key: 'cliques',    label: 'Cliques',      color: '#22c55e' },
  { key: 'impressoes', label: 'Impressões',   color: '#c77dff' },
]
const LINE_OPTIONS: { key: LineMetric; label: string; color: string }[] = [
  { key: 'cpcMedio',   label: 'CPC Médio',   color: '#f59e0b' },
  { key: 'ctr',        label: 'CTR',         color: '#56cfe1' },
  { key: 'cliques',    label: 'Cliques',     color: '#22c55e' },
  { key: 'impressoes', label: 'Impressões',  color: '#c77dff' },
]

function formatBarVal(v: number, metric: BarMetric): string {
  if (metric === 'custo') return `R$${v >= 1000 ? (v / 1000).toFixed(0) + 'k' : v.toFixed(0)}`
  if (v >= 1_000_000) return (v / 1_000_000).toFixed(1) + 'M'
  if (v >= 1_000) return (v / 1_000).toFixed(0) + 'k'
  return String(Math.round(v))
}
function formatLineVal(v: number, metric: LineMetric): string {
  if (metric === 'cpcMedio') return `R$${v.toFixed(2)}`
  if (metric === 'ctr') return `${v.toFixed(2)}%`
  if (v >= 1_000_000) return (v / 1_000_000).toFixed(1) + 'M'
  if (v >= 1_000) return (v / 1_000).toFixed(0) + 'k'
  return String(Math.round(v))
}

function TrendChart({ serie, theme }: { serie: DailyPoint[]; theme: Theme }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const chartRef = useRef<any>(null)
  const [barMetrics, setBarMetrics] = useState<BarMetric[]>(['custo'])
  const [lineMetrics, setLineMetrics] = useState<LineMetric[]>(['cpcMedio'])
  const t = C[theme]

  function toggleBar(key: BarMetric) {
    setBarMetrics(prev => prev.includes(key)
      ? (prev.length > 1 ? prev.filter(k => k !== key) : prev)
      : [...prev, key])
  }
  function toggleLine(key: LineMetric) {
    setLineMetrics(prev => prev.includes(key)
      ? (prev.length > 1 ? prev.filter(k => k !== key) : prev)
      : [...prev, key])
  }

  const barLabels = barMetrics.map(k => BAR_OPTIONS.find(o => o.key === k)!.label)
  const lineLabels = lineMetrics.map(k => LINE_OPTIONS.find(o => o.key === k)!.label)
  const title = `TENDÊNCIA — ${barLabels.join(' E ').toUpperCase()} VS ${lineLabels.join(' E ').toUpperCase()}`
  const primaryBar = BAR_OPTIONS.find(o => o.key === barMetrics[0])!
  const primaryLine = LINE_OPTIONS.find(o => o.key === lineMetrics[0])!

  useEffect(() => {
    if (!canvasRef.current || serie.length === 0) return
    const run = async () => {
      const { Chart, registerables } = await import('chart.js')
      Chart.register(...registerables)
      chartRef.current?.destroy()
      const labels = serie.map(p => fmtDateLabel(p.date))
      const allBarData = barMetrics.map(k => serie.map(p => p[k] as number))

      const barDatasets = barMetrics.map((k, i) => {
        const opt = BAR_OPTIONS.find(o => o.key === k)!
        return { type: 'bar' as const, label: opt.label, data: allBarData[i], backgroundColor: opt.color + '99', borderColor: opt.color, borderWidth: 1, borderRadius: 3, yAxisID: `yBar${i}` }
      })
      const lineDatasets = lineMetrics.map(k => {
        const opt = LINE_OPTIONS.find(o => o.key === k)!
        return { type: 'line' as const, label: opt.label, data: serie.map(p => p[k] as number), borderColor: opt.color, backgroundColor: opt.color + '22', borderWidth: 2, pointRadius: serie.length > 30 ? 0 : 3, pointBackgroundColor: opt.color, tension: 0.3, yAxisID: 'yLine' }
      })

      const barScales: Record<string, any> = {}
      barMetrics.forEach((k, i) => {
        const opt = BAR_OPTIONS.find(o => o.key === k)!
        const maxVal = Math.max(...allBarData[i], 1)
        barScales[`yBar${i}`] = {
          type: 'linear', position: 'left', display: i === 0,
          max: maxVal * 1.15,
          grid: { color: i === 0 ? t.borderInner : 'transparent' },
          ticks: { color: opt.color, font: { size: 10 }, callback: (v: any) => formatBarVal(Number(v), k) },
        }
      })

      chartRef.current = new Chart(canvasRef.current!, {
        data: { labels, datasets: [...barDatasets, ...lineDatasets] },
        options: {
          responsive: true, maintainAspectRatio: false,
          interaction: { mode: 'index', intersect: false },
          plugins: {
            legend: { labels: { color: t.textMuted, font: { size: 11 }, boxWidth: 12, padding: 16 } },
            tooltip: {
              backgroundColor: t.dropBg, titleColor: t.textPrimary, bodyColor: t.textSecondary,
              borderColor: t.border, borderWidth: 1,
              callbacks: {
                label: (ctx: any) => {
                  const ds = ctx.dataset
                  const isBar = ds.type === 'bar'
                  const key = [...barMetrics, ...lineMetrics][ctx.datasetIndex]
                  if (isBar) return `  ${ds.label}: ${formatBarVal(ctx.raw, key as BarMetric)}`
                  return `  ${ds.label}: ${formatLineVal(ctx.raw, key as LineMetric)}`
                },
              },
            },
          },
          scales: {
            x: { ticks: { color: t.textMuted, font: { size: 10 }, maxTicksLimit: serie.length > 30 ? 8 : 15 }, grid: { color: t.borderInner } },
            ...barScales,
            yLine: { type: 'linear' as const, position: 'right' as const, ticks: { color: primaryLine.color, font: { size: 10 }, callback: (v: any) => formatLineVal(Number(v), lineMetrics[0]) }, grid: { drawOnChartArea: false } },
          },
        },
      })
    }
    run()
    return () => { chartRef.current?.destroy(); chartRef.current = null }
  }, [serie, theme, barMetrics.join(), lineMetrics.join()]) // eslint-disable-line react-hooks/exhaustive-deps

  const btnStyle = (active: boolean, color: string): React.CSSProperties => ({
    padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600,
    cursor: 'pointer', border: `1px solid ${active ? color : t.border}`,
    background: active ? color + '22' : 'transparent',
    color: active ? color : t.textMuted, transition: 'all 0.15s',
  })

  return (
    <div style={{ background: t.card, border: `1px solid ${t.border}`, borderRadius: 12, padding: '16px 20px', marginBottom: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 10, fontWeight: 700, color: t.textMuted, textTransform: 'uppercase', letterSpacing: 1 }}>{title}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ fontSize: 10, color: t.textMuted, marginRight: 4 }}>Barras:</span>
          {BAR_OPTIONS.map(o => (
            <button key={o.key} onClick={() => toggleBar(o.key)} style={btnStyle(barMetrics.includes(o.key), o.color)}>{o.label}</button>
          ))}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ fontSize: 10, color: t.textMuted, marginRight: 4 }}>Linha:</span>
          {LINE_OPTIONS.map(o => (
            <button key={o.key} onClick={() => toggleLine(o.key)} style={btnStyle(lineMetrics.includes(o.key), o.color)}>{o.label}</button>
          ))}
        </div>
      </div>
      <div style={{ height: 260 }}><canvas ref={canvasRef} /></div>
    </div>
  )
}

// ─── Account Card ─────────────────────────────────────────────────────────────
function AccountCard({ acc, totalCusto, t }: { acc: AccountData; totalCusto: number; t: typeof C['dark'] }) {
  const [open, setOpen] = useState(true)
  const sharePct = totalCusto > 0 ? (acc.custo / totalCusto) * 100 : 0
  return (
    <div style={{ border: `1px solid ${t.border}`, borderRadius: 10, overflow: 'hidden', background: t.card }}>
      <button onClick={() => setOpen(o => !o)} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', padding: '14px 16px', background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: t.textPrimary }}>{acc.nome}</span>
          <span style={{ fontSize: 11, padding: '2px 9px', borderRadius: 20, background: '#1A3CFF18', color: '#7ba3ff', border: '1px solid #1A3CFF33' }}>{fmtBRL(acc.custo)}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {sharePct > 0 && <span style={{ fontSize: 11, color: t.textMuted }}>{fmtPct(sharePct)} do total</span>}
          <span style={{ color: t.chevron, fontSize: 12 }}>{open ? '▲' : '▼'}</span>
        </div>
      </button>
      {sharePct > 0 && <div style={{ height: 2, background: t.barTrack, margin: '0 16px' }}><div style={{ width: `${Math.min(100, sharePct)}%`, height: '100%', background: '#1A3CFF', borderRadius: 2 }} /></div>}
      {open && (
        <div style={{ padding: '12px 16px 16px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px 16px' }}>
            {[
              { label: 'Cliques', v: fmtNum(acc.cliques) },
              { label: 'Impressões', v: fmtNum(acc.impressoes) },
              { label: 'CTR', v: fmtPct(acc.ctr) },
              { label: 'CPC Médio', v: acc.cpcMedio > 0 ? fmtBRL(acc.cpcMedio) : '—' },
              { label: 'Custo', v: fmtBRL(acc.custo), h: '#60a5fa' },
              { label: 'Conversões', v: acc.conversoes > 0 ? fmtNum(acc.conversoes) : '—', h: acc.conversoes > 0 ? '#4ade80' : undefined },
              { label: 'Custo/Conv.', v: acc.custoConversao > 0 ? fmtBRL(acc.custoConversao) : '—' },
            ].map(m => (
              <div key={m.label}>
                <div style={{ fontSize: 9, fontWeight: 700, color: t.textMuted, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 4 }}>{m.label}</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: m.h ?? t.textPrimary }}>{m.v}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Data Table (3 níveis) ────────────────────────────────────────────────────
function DataTable({ campanhas, grupos, anuncios, totalCusto, t, multiNivel }: {
  campanhas: CampaignData[]; grupos: AdGroupData[]; anuncios: AdData[]
  totalCusto: number; t: typeof C['dark']; multiNivel: boolean
}) {
  const [nivel, setNivel] = useState<Nivel>('campanhas')
  const [tipoTab, setTipoTab] = useState<TipoTab>('todas')
  const [statusTab, setStatusTab] = useState<StatusTab>('todas')
  const [busca, setBusca] = useState('')
  const [sortCol, setSortCol] = useState<string | null>(null)
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  useEffect(() => { setTipoTab('todas'); setStatusTab('todas'); setBusca(''); setSortCol(null) }, [nivel])

  function toggleSort(col: string) {
    if (sortCol === col) { setSortDir(d => d === 'asc' ? 'desc' : 'asc') }
    else { setSortCol(col); setSortDir('desc') }
  }

  function sortRows<T extends Record<string, any>>(rows: T[]): T[] {
    if (!sortCol) return rows
    return [...rows].sort((a, b) => {
      const av = Number(a[sortCol] ?? 0), bv = Number(b[sortCol] ?? 0)
      return sortDir === 'asc' ? av - bv : bv - av
    })
  }

  const chip = (active: boolean): React.CSSProperties => ({
    padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600,
    cursor: 'pointer', border: 'none', transition: 'all 0.15s',
    background: active ? '#1A3CFF' : t.chipBg, color: active ? '#fff' : t.textMuted,
  })

  const filtCamp = campanhas.filter(c => {
    if (statusTab === 'ativo' && c.status !== 'ativo') return false
    if (statusTab === 'pausado' && c.status !== 'pausado') return false
    if (tipoTab === 'pesquisa' && c.tipoRaw !== 'SEARCH') return false
    if (tipoTab === 'display' && c.tipoRaw !== 'DISPLAY') return false
    if (tipoTab === 'pmax' && !['MULTI_CHANNEL', 'PERFORMANCE_MAX'].includes(c.tipoRaw)) return false
    if (tipoTab === 'video' && c.tipoRaw !== 'VIDEO') return false
    if (tipoTab === 'demand-gen' && c.tipoRaw !== 'DEMAND_GEN') return false
    if (tipoTab === 'outros' && ['SEARCH', 'DISPLAY', 'MULTI_CHANNEL', 'PERFORMANCE_MAX', 'VIDEO', 'DEMAND_GEN'].includes(c.tipoRaw)) return false
    if (busca && !c.nome.toLowerCase().includes(busca.toLowerCase())) return false
    return true
  })

  const filtGrupos = grupos.filter(g => {
    if (statusTab === 'ativo' && g.status !== 'ativo') return false
    if (statusTab === 'pausado' && g.status !== 'pausado') return false
    if (busca && !g.nome.toLowerCase().includes(busca.toLowerCase()) && !g.campanhaNome.toLowerCase().includes(busca.toLowerCase())) return false
    return true
  })

  const filtAnuncios = anuncios.filter(a => {
    if (statusTab === 'ativo' && a.status !== 'ativo') return false
    if (statusTab === 'pausado' && a.status !== 'pausado') return false
    if (busca && !a.nome.toLowerCase().includes(busca.toLowerCase()) && !a.campanhaNome.toLowerCase().includes(busca.toLowerCase())) return false
    return true
  })

  const sortedCamp = sortRows(filtCamp)
  const sortedGrupos = sortRows(filtGrupos)
  const sortedAnuncios = sortRows(filtAnuncios)

  function exportCSV() {
    const metricKeys = ['custo','cliques','impressoes','ctr','cpcMedio','cpm','cpv','conversoes','custoConversao']
    let headers: string[]; let rows: (string | number)[][]
    if (nivel === 'campanhas') {
      headers = ['Campanha','Tipo','Status','Custo','Cliques','Impressões','CTR%','CPC Méd.','CPM','CPV','Conv.','Custo/Conv.']
      rows = sortedCamp.map(c => [c.nome, c.tipo, c.status, c.custo, c.cliques, c.impressoes, c.ctr.toFixed(4), c.cpcMedio.toFixed(2), c.cpm.toFixed(2), c.cpv.toFixed(2), c.conversoes, c.custoConversao.toFixed(2)])
    } else if (nivel === 'grupos') {
      headers = ['Grupo','Campanha','Status','Custo','Cliques','Impressões','CTR%','CPC Méd.','CPM','CPV','Conv.','Custo/Conv.']
      rows = sortedGrupos.map(g => [g.nome, g.campanhaNome, g.status, g.custo, g.cliques, g.impressoes, g.ctr.toFixed(4), g.cpcMedio.toFixed(2), g.cpm.toFixed(2), g.cpv.toFixed(2), g.conversoes, g.custoConversao.toFixed(2)])
    } else {
      headers = ['Anúncio','Grupo','Campanha','Status','Custo','Cliques','Impressões','CTR%','CPC Méd.','CPM','CPV','Conv.','Custo/Conv.']
      rows = sortedAnuncios.map(a => [a.nome, a.grupoNome, a.campanhaNome, a.status, a.custo, a.cliques, a.impressoes, a.ctr.toFixed(4), a.cpcMedio.toFixed(2), a.cpm.toFixed(2), a.cpv.toFixed(2), a.conversoes, a.custoConversao.toFixed(2)])
    }
    const csv = [headers, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob); const a = document.createElement('a')
    a.href = url; a.download = `google-ads-${nivel}.csv`; a.click(); URL.revokeObjectURL(url)
  }

  const thS: React.CSSProperties = {
    padding: '9px 12px', fontSize: 10, fontWeight: 700, color: t.textMuted,
    textTransform: 'uppercase', letterSpacing: 0.8, textAlign: 'left',
    borderBottom: `1px solid ${t.tableBorder}`, whiteSpace: 'nowrap',
  }
  const tdS: React.CSSProperties = {
    padding: '10px 12px', fontSize: 13, color: t.textSecondary,
    borderBottom: `1px solid ${t.tableBorder}`, verticalAlign: 'middle',
  }
  const statusBadge = (s: string) => (
    <span style={{ fontSize: 10, padding: '1px 7px', borderRadius: 20, fontWeight: 600, background: s === 'ativo' ? '#00cc6618' : '#66666618', color: s === 'ativo' ? '#4ade80' : '#888', border: `1px solid ${s === 'ativo' ? '#00cc6630' : '#66666630'}` }}>
      {s === 'ativo' ? 'Ativa' : 'Pausada'}
    </span>
  )

  const metricCols = (item: { custo: number; cliques: number; impressoes: number; ctr: number; cpcMedio: number; cpm: number; cpv: number; conversoes: number; custoConversao: number }, share: number) => (
    <>
      <td style={{ ...tdS, textAlign: 'right', color: '#60a5fa', fontWeight: 600 }}><CopiavelNum compact={fmtBRL(item.custo)} /></td>
      <td style={{ ...tdS, textAlign: 'right' }}><CopiavelNum compact={fmtNum(item.cliques)} full={fmtNumFull(item.cliques)} /></td>
      <td style={{ ...tdS, textAlign: 'right' }}><CopiavelNum compact={fmtNum(item.impressoes)} full={fmtNumFull(item.impressoes)} /></td>
      <td style={{ ...tdS, textAlign: 'right' }}><CopiavelNum compact={fmtPct(item.ctr)} /></td>
      <td style={{ ...tdS, textAlign: 'right' }}>{item.cpcMedio > 0 ? <CopiavelNum compact={fmtBRL(item.cpcMedio)} /> : '—'}</td>
      <td style={{ ...tdS, textAlign: 'right' }}>{item.cpm > 0 ? <CopiavelNum compact={fmtBRL(item.cpm)} /> : '—'}</td>
      <td style={{ ...tdS, textAlign: 'right' }}>{item.cpv > 0 ? <CopiavelNum compact={fmtBRL(item.cpv)} /> : '—'}</td>
      <td style={{ ...tdS, textAlign: 'right', color: item.conversoes > 0 ? '#4ade80' : t.textMuted }}>{item.conversoes > 0 ? <CopiavelNum compact={fmtNum(item.conversoes)} full={fmtNumFull(item.conversoes)} /> : '—'}</td>
      <td style={{ ...tdS, textAlign: 'right' }}>{item.custoConversao > 0 ? <CopiavelNum compact={fmtBRL(item.custoConversao)} /> : '—'}</td>
    </>
  )

  const METRIC_SORT_COLS: { col: string; label: string }[] = [
    { col: 'custo', label: 'INVEST.' },
    { col: 'cliques', label: 'CLIQUES' },
    { col: 'impressoes', label: 'IMPRESSÕES' },
    { col: 'ctr', label: 'CTR' },
    { col: 'cpcMedio', label: 'CPC MÉD.' },
    { col: 'cpm', label: 'CPM' },
    { col: 'cpv', label: 'CPV' },
    { col: 'conversoes', label: 'CONV.' },
    { col: 'custoConversao', label: 'CUSTO/CONV.' },
  ]

  const metricHeaders = (
    <>
      {METRIC_SORT_COLS.map(({ col, label }) => (
        <th key={col} onClick={() => toggleSort(col)} style={{ ...thS, textAlign: 'right', cursor: 'pointer', userSelect: 'none', color: sortCol === col ? t.textSecondary : t.textMuted }}>
          {label}{sortCol === col ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ''}
        </th>
      ))}
    </>
  )

  const emptyRow = (cols: number) => (
    <tr><td colSpan={cols} style={{ ...tdS, textAlign: 'center', color: t.emptyText, padding: 28 }}>Nenhum item encontrado</td></tr>
  )

  return (
    <div style={{ background: t.card, border: `1px solid ${t.border}`, borderRadius: 12 }}>
      {/* Nível tabs */}
      {multiNivel && (
        <div style={{ display: 'flex', borderBottom: `1px solid ${t.nivelBorder}`, background: t.nivelBg, borderRadius: '12px 12px 0 0' }}>
          {NIVEL_TABS.map(tab => (
            <button key={tab.key} onClick={() => setNivel(tab.key)} style={{
              padding: '12px 20px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
              border: 'none', background: 'transparent', transition: 'all 0.15s',
              color: nivel === tab.key ? '#1A3CFF' : t.textMuted,
              borderBottom: nivel === tab.key ? '2px solid #1A3CFF' : '2px solid transparent',
            }}>{tab.label}</button>
          ))}
        </div>
      )}

      {/* Filters */}
      <div style={{ padding: '14px 16px', borderBottom: `1px solid ${t.border}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          {/* Tipo tabs (only for campaigns) */}
          {nivel === 'campanhas' && (
            <div style={{ display: 'flex', gap: 4, flex: 1, flexWrap: 'wrap' }}>
              {TIPO_TABS.map(tab => (
                <button key={tab.key} onClick={() => setTipoTab(tab.key)} style={chip(tipoTab === tab.key)}>{tab.label}</button>
              ))}
            </div>
          )}
          {nivel !== 'campanhas' && <div style={{ flex: 1 }} />}

          {/* Status */}
          <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: t.textMuted, textTransform: 'uppercase', letterSpacing: 0.8, marginRight: 4 }}>STATUS</span>
            {(['todas', 'ativo', 'pausado'] as StatusTab[]).map(s => (
              <button key={s} onClick={() => setStatusTab(s)} style={chip(statusTab === s)}>
                {s === 'todas' ? 'Todas' : s === 'ativo' ? 'Ativas' : 'Pausadas'}
              </button>
            ))}
          </div>

          <input
            placeholder="Filtrar por nome..."
            value={busca}
            onChange={e => setBusca(e.target.value)}
            style={{ background: t.inputBg, border: `1px solid ${t.inputBorder}`, color: t.inputText, borderRadius: 8, padding: '5px 12px', fontSize: 13, outline: 'none', width: 180 }}
          />
          <button onClick={exportCSV} title="Exportar CSV" style={{ background: 'transparent', border: `1px solid ${t.border}`, color: t.textMuted, borderRadius: 8, padding: '5px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
            ↓ CSV
          </button>
        </div>
      </div>

      {/* Table */}
      <div style={{ overflowX: 'auto' }}>
        {nivel === 'campanhas' && (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr><th style={{ ...thS, minWidth: 220 }}>CAMPANHA</th>{metricHeaders}</tr>
            </thead>
            <tbody>
              {sortedCamp.length === 0 ? emptyRow(10) : sortedCamp.map(c => {
                const share = totalCusto > 0 ? (c.custo / totalCusto) * 100 : 0
                return (
                  <tr key={c.id} onMouseEnter={e => (e.currentTarget.style.background = t.tableHover)} onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                    <td style={tdS}>
                      <div style={{ fontWeight: 600, color: t.textPrimary }}>{c.nome.replace(/\[.*?\]/g, '').trim()}</div>
                      <div style={{ display: 'flex', gap: 6, marginTop: 3 }}>
                        <span style={{ fontSize: 10, padding: '1px 7px', borderRadius: 20, fontWeight: 600, background: '#1A3CFF18', color: '#7ba3ff', border: '1px solid #1A3CFF2a' }}>{c.tipo}</span>
                        {statusBadge(c.status)}
                      </div>
                      {share > 0 && <div style={{ marginTop: 5, height: 2, background: t.barTrack, borderRadius: 2 }}><div style={{ width: `${Math.min(100, share)}%`, height: '100%', background: '#1A3CFF', borderRadius: 2 }} /></div>}
                    </td>
                    {metricCols(c, share)}
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}

        {nivel === 'grupos' && (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ ...thS, minWidth: 200 }}>GRUPO DE ANÚNCIOS</th>
                <th style={{ ...thS, minWidth: 160 }}>CAMPANHA</th>
                {metricHeaders}
              </tr>
            </thead>
            <tbody>
              {sortedGrupos.length === 0 ? emptyRow(11) : sortedGrupos.map(g => (
                <tr key={g.id} onMouseEnter={e => (e.currentTarget.style.background = t.tableHover)} onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                  <td style={tdS}>
                    <div style={{ fontWeight: 600, color: t.textPrimary }}>{g.nome}</div>
                    <div style={{ marginTop: 3 }}>{statusBadge(g.status)}</div>
                  </td>
                  <td style={{ ...tdS, color: t.textMuted, fontSize: 12 }}>{g.campanhaNome}</td>
                  {metricCols(g, 0)}
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {nivel === 'anuncios' && (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ ...thS, minWidth: 200 }}>ANÚNCIO</th>
                <th style={{ ...thS, minWidth: 140 }}>GRUPO</th>
                <th style={{ ...thS, minWidth: 140 }}>CAMPANHA</th>
                {metricHeaders}
              </tr>
            </thead>
            <tbody>
              {sortedAnuncios.length === 0 ? emptyRow(12) : sortedAnuncios.map(a => (
                <tr key={a.id} onMouseEnter={e => (e.currentTarget.style.background = t.tableHover)} onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                  <td style={tdS}>
                    <div style={{ fontWeight: 600, color: t.textPrimary }}>{a.nome}</div>
                    <div style={{ marginTop: 3 }}>{statusBadge(a.status)}</div>
                  </td>
                  <td style={{ ...tdS, color: t.textMuted, fontSize: 12 }}>{a.grupoNome}</td>
                  <td style={{ ...tdS, color: t.textMuted, fontSize: 12 }}>{a.campanhaNome}</td>
                  {metricCols(a, 0)}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function GoogleAdsPage({ theme = 'dark' }: { theme?: Theme }) {
  const [data, setData] = useState<AccountData[] | null>(null)
  const [nomes, setNomes] = useState<string[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [filtroCliente, setFiltroCliente] = useState('')
  const [preset, setPreset] = useState<Preset>('mes-atual')
  const [custom, setCustom] = useState({ start: '', end: '' })
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [cooldown, setCooldown] = useState(false)
  const [comparar, setComparar] = useState(false)
  const [prevData, setPrevData] = useState<AccountData[] | null>(null)
  const [loadingPrev, setLoadingPrev] = useState(false)

  const t = C[theme]
  const periodoRef = useRef(getPeriodo('mes-atual'))
  const cooldownRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  function getPrevPeriodo(p: { start: string; end: string }) {
    const s = new Date(p.start + 'T00:00:00'), e = new Date(p.end + 'T00:00:00')
    const days = Math.round((e.getTime() - s.getTime()) / 86400000)
    const prevEnd = new Date(s.getTime() - 86400000)
    const prevStart = new Date(prevEnd.getTime() - days * 86400000)
    return { start: fmtDate(prevStart), end: fmtDate(prevEnd) }
  }

  function toggleComparar() {
    if (comparar) { setComparar(false); setPrevData(null); return }
    const prev = getPrevPeriodo(periodoRef.current)
    setLoadingPrev(true); setComparar(true)
    fetch(`/api/google-ads?start=${prev.start}&end=${prev.end}`)
      .then(r => r.json())
      .then(res => { if (!res.error) setPrevData(res.data ?? []); setLoadingPrev(false) })
      .catch(() => setLoadingPrev(false))
  }

  function fetchData(p: { start: string; end: string }) {
    setLoading(true); setError('')
    fetch(`/api/google-ads?start=${p.start}&end=${p.end}`)
      .then(r => r.json())
      .then(res => {
        if (res.error) { setError(res.error); setLoading(false); return }
        setData(res.data ?? [])
        if ((res.nomes ?? []).length > 0) setNomes(res.nomes)
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
    periodoRef.current = p; setPreset(newPreset); setCustom(newCustom); setFiltroCliente('')
    setComparar(false); setPrevData(null)
    fetchData(p)
  }

  useEffect(() => {
    const p = getPeriodo('mes-atual')
    periodoRef.current = p
    fetchData(p)
    const scheduleNext = (): ReturnType<typeof setTimeout> => {
      const now = new Date()
      const nextEvenHour = (Math.floor(now.getHours() / 2) * 2 + 2) % 24
      const next = new Date(now); next.setHours(nextEvenHour, 1, 0, 0)
      if (next <= now) next.setDate(next.getDate() + 1)
      return setTimeout(() => {
        const cur = periodoRef.current
        fetch(`/api/google-ads?start=${cur.start}&end=${cur.end}`).then(r => r.json()).then(res => {
          if (!res.error) { setData(res.data ?? []); if ((res.nomes ?? []).length > 0) setNomes(res.nomes); setLastUpdated(new Date()) }
        }).catch(() => {})
        timer = scheduleNext()
      }, next.getTime() - now.getTime())
    }
    let timer = scheduleNext()
    return () => { clearTimeout(timer); if (cooldownRef.current) clearTimeout(cooldownRef.current) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const center: React.CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', minHeight: 200 }
  const filtrado = (data ?? []).filter(d => !filtroCliente || d.nome === filtroCliente)
  const totalCliques = filtrado.reduce((s, a) => s + a.cliques, 0)
  const totalImpressoes = filtrado.reduce((s, a) => s + a.impressoes, 0)
  const totalCusto = filtrado.reduce((s, a) => s + a.custo, 0)
  const totalConversoes = filtrado.reduce((s, a) => s + a.conversoes, 0)
  const ctrMedio = totalImpressoes > 0 ? (totalCliques / totalImpressoes) * 100 : 0
  const cpcMedio = totalCliques > 0 ? totalCusto / totalCliques : 0
  const custoConversao = totalConversoes > 0 ? totalCusto / totalConversoes : 0

  const prevFiltrado = comparar && prevData ? prevData.filter(d => !filtroCliente || d.nome === filtroCliente) : []
  const pDelta = (curr: number, prev: number): number | null =>
    comparar && prevData && prev > 0 ? ((curr - prev) / prev) * 100 : null
  const prevCliques = prevFiltrado.reduce((s, a) => s + a.cliques, 0)
  const prevImpressoes = prevFiltrado.reduce((s, a) => s + a.impressoes, 0)
  const prevCusto = prevFiltrado.reduce((s, a) => s + a.custo, 0)
  const prevConversoes = prevFiltrado.reduce((s, a) => s + a.conversoes, 0)
  const prevCtr = prevImpressoes > 0 ? (prevCliques / prevImpressoes) * 100 : 0
  const prevCpc = prevCliques > 0 ? prevCusto / prevCliques : 0
  const prevCustoConv = prevConversoes > 0 ? prevCusto / prevConversoes : 0
  const selectedAccount = filtroCliente ? filtrado[0] : null

  const mergedSerie: DailyPoint[] = (() => {
    if (selectedAccount) return selectedAccount.serie ?? []
    const dateMap = new Map<string, { custo: number; cliques: number; impressoes: number }>()
    for (const acc of filtrado) {
      for (const pt of acc.serie) {
        const ex = dateMap.get(pt.date) ?? { custo: 0, cliques: 0, impressoes: 0 }
        dateMap.set(pt.date, { custo: ex.custo + pt.custo, cliques: ex.cliques + pt.cliques, impressoes: ex.impressoes + pt.impressoes })
      }
    }
    return Array.from(dateMap.entries()).sort(([a], [b]) => a.localeCompare(b))
      .map(([date, d]) => ({
        date, custo: d.custo, cliques: d.cliques, impressoes: d.impressoes,
        ctr: d.impressoes > 0 ? (d.cliques / d.impressoes) * 100 : 0,
        cpcMedio: d.cliques > 0 ? d.custo / d.cliques : 0,
        cpm: d.impressoes > 0 ? (d.custo / d.impressoes) * 1000 : 0,
      }))
  })()

  const allCampanhas = selectedAccount ? selectedAccount.campanhas : filtrado.flatMap(a => a.campanhas).sort((a, b) => b.custo - a.custo)
  const allGrupos = selectedAccount ? selectedAccount.grupos : filtrado.flatMap(a => a.grupos).sort((a, b) => b.custo - a.custo)
  const allAnuncios = selectedAccount ? selectedAccount.anuncios : filtrado.flatMap(a => a.anuncios).sort((a, b) => b.custo - a.custo)

  return (
    <div style={{ padding: '20px 24px 40px', overflowY: 'auto', height: '100%', boxSizing: 'border-box', background: t.page }}>

      {/* Controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        <PeriodoDropdown preset={preset} custom={custom} t={t} onApply={aplicarPeriodo} />
        <select value={filtroCliente} onChange={e => setFiltroCliente(e.target.value)} style={{ background: t.selectBg, border: `1px solid ${t.selectBorder}`, color: t.selectText, borderRadius: 8, padding: '6px 12px', fontSize: 13, cursor: 'pointer', outline: 'none', height: 34 }}>
          <option value="">Todas as contas</option>
          {nomes.map(n => <option key={n} value={n}>{n}</option>)}
        </select>
        <button
          onClick={handleManualRefresh}
          disabled={cooldown || loading}
          title={cooldown ? 'Aguarde 30s para atualizar novamente' : 'Atualizar dados'}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 12px', borderRadius: 8, fontSize: 12, fontWeight: 500, cursor: cooldown || loading ? 'not-allowed' : 'pointer', border: `1px solid ${t.border}`, background: t.filtroBtn, color: cooldown || loading ? t.textMuted : t.textSecondary, transition: 'all 0.15s', flexShrink: 0 }}
        >
          <span style={{ display: 'inline-block', animation: loading ? 'spin 0.8s linear infinite' : 'none' }}>↻</span>
          {lastUpdated ? `${String(lastUpdated.getHours()).padStart(2,'0')}:${String(lastUpdated.getMinutes()).padStart(2,'0')}` : 'Atualizar'}
        </button>
        <button onClick={toggleComparar} title="Comparar com o período anterior de mesma duração"
          style={{ padding: '5px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: `1px solid ${comparar ? '#1A3CFF' : t.border}`, background: comparar ? '#1A3CFF22' : t.filtroBtn, color: comparar ? '#7ba3ff' : t.textMuted, transition: 'all 0.15s', flexShrink: 0 }}>
          ⇄ {loadingPrev ? '...' : comparar ? 'Comparando' : 'Comparar'}
        </button>
        {loading && <div style={{ width: 18, height: 18, border: `2px solid ${t.spinner}`, borderTop: '2px solid #1A3CFF', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />}
      </div>

      {loading && !data ? (
        <div style={center}><div style={{ width: 28, height: 28, border: `3px solid ${t.spinner}`, borderTop: '3px solid #1A3CFF', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} /></div>
      ) : error ? (
        <div style={{ ...center, flexDirection: 'column', gap: 8 }}>
          <span style={{ fontSize: 15, color: '#f87171' }}>Erro ao carregar dados</span>
          <span style={{ fontSize: 13, color: t.textMuted, maxWidth: 480, textAlign: 'center' }}>{error}</span>
        </div>
      ) : !filtrado.length ? (
        <div style={center}><span style={{ color: t.emptyText }}>Nenhuma conta com dados no período selecionado.</span></div>
      ) : (
        <>
          {/* KPI tiles */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10, marginBottom: 20 }}>
            <KpiTile label="Cliques" value={fmtNum(totalCliques)} t={t} delta={pDelta(totalCliques, prevCliques)} />
            <KpiTile label="Impressões" value={fmtNum(totalImpressoes)} t={t} delta={pDelta(totalImpressoes, prevImpressoes)} />
            <KpiTile label="CTR Médio" value={fmtPct(ctrMedio)} t={t} delta={pDelta(ctrMedio, prevCtr)} />
            <KpiTile label="CPC Médio" value={cpcMedio > 0 ? fmtBRL(cpcMedio) : '—'} t={t} delta={pDelta(cpcMedio, prevCpc)} />
            <KpiTile label="Investimento" value={fmtBRL(totalCusto)} t={t} delta={pDelta(totalCusto, prevCusto)} />
            <KpiTile label="Conversões" value={totalConversoes > 0 ? fmtNum(totalConversoes) : '—'} t={t} delta={pDelta(totalConversoes, prevConversoes)} />
            <KpiTile label="Custo/Conv." value={custoConversao > 0 ? fmtBRL(custoConversao) : '—'} t={t} delta={pDelta(custoConversao, prevCustoConv)} />
          </div>

          {/* Trend chart */}
          {mergedSerie.length > 1 && <TrendChart serie={mergedSerie} theme={theme} />}

          {/* Account cards (todas as contas) */}
          {!filtroCliente && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24 }}>
              {filtrado.map(acc => <AccountCard key={acc.id} acc={acc} totalCusto={totalCusto} t={t} />)}
            </div>
          )}
          {/* Data table — always with level navigation */}
          <DataTable campanhas={allCampanhas} grupos={allGrupos} anuncios={allAnuncios} totalCusto={totalCusto} t={t} multiNivel={true} />
        </>
      )}
    </div>
  )
}

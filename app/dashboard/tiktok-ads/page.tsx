'use client'

import { useEffect, useRef, useState } from 'react'
import type { TikTokAccountData, TikTokCampaignData, TikTokAdSetData, TikTokAdData, TikTokAudienceItem } from '@/app/api/tiktok-ads/route'

type NivelTK = 'campanhas' | 'conjuntos' | 'anuncios'
const NIVEL_TABS_TK: { key: NivelTK; label: string }[] = [
  { key: 'campanhas', label: 'Campanhas' },
  { key: 'conjuntos', label: 'Conjuntos de Anúncios' },
  { key: 'anuncios', label: 'Anúncios' },
]

type Theme = 'dark' | 'light'
type Preset = 'personalizado' | 'mes-atual' | 'mes-passado' | 'ultimos-7' | 'ultimos-14' | 'ultimos-30' | 'ytd-2026'

const TK = '#00994D'

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
    chipBg: '#252525', chipText: '#888',
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
    chipBg: '#e8e8e8', chipText: '#888',
  },
}

const TILE_COLORS = ['#4dabf7', '#c77dff', '#56cfe1', '#74c69d', '#ffd166', '#ff9f1c', '#f72585', '#4cc9f0']

const PRESETS: { key: Preset; label: string }[] = [
  { key: 'personalizado', label: 'Personalizado' },
  { key: 'mes-atual', label: 'Este mês' },
  { key: 'mes-passado', label: 'Mês passado' },
  { key: 'ultimos-7', label: 'Últimos 7 dias' },
  { key: 'ultimos-14', label: 'Últimos 14 dias' },
  { key: 'ultimos-30', label: 'Últimos 30 dias' },
  { key: 'ytd-2026', label: '2026 (YTD)' },
]

function fmtDate(d: Date) { const p = (n: number) => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}` }

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

function getPrevPeriodo(p: { start: string; end: string }) {
  const s = new Date(p.start + 'T00:00:00'), e = new Date(p.end + 'T00:00:00')
  const days = Math.round((e.getTime() - s.getTime()) / 86400000)
  const prevEnd = new Date(s.getTime() - 86400000)
  const prevStart = new Date(prevEnd.getTime() - days * 86400000)
  return { start: fmtDate(prevStart), end: fmtDate(prevEnd) }
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
    <span style={{ position: 'relative', cursor: 'copy', userSelect: 'none' }}
      onMouseEnter={() => setTip('hover')} onMouseLeave={() => setTip(null)}
      onClick={() => { navigator.clipboard.writeText(full.replace(/^R\$\s*/, '')); setTip('copied'); setTimeout(() => setTip(null), 1200) }}>
      {compact}
      {tip && (
        <span style={{ position: 'absolute', bottom: 'calc(100% + 6px)', right: '50%', transform: 'translateX(50%)', background: '#0f172a', border: '1px solid #334155', borderRadius: 5, padding: '3px 8px', fontSize: 11, whiteSpace: 'nowrap', zIndex: 200, pointerEvents: 'none', color: tip === 'copied' ? '#4ade80' : '#e2e8f0', fontWeight: 400 }}>
          {tip === 'copied' ? '✓ Copiado!' : full}
        </span>
      )}
    </span>
  )
}

// Cor do selo de status conforme o rótulo (verde=ok, amarelo=atenção, vermelho=problema)
function statusCor(label: string): { fg: string; bg: string; bd: string } {
  const l = label.toLowerCase()
  if (/(reprovad|rejeitad|com problema|recusad)/.test(l)) return { fg: '#f87171', bg: '#ef444418', bd: '#ef444430' }
  if (/(análise|analise|limitad|pausad|pendente|revis|não iniciad|nao iniciad)/.test(l)) return { fg: '#f59e0b', bg: '#f59e0b18', bd: '#f59e0b30' }
  return { fg: '#4ade80', bg: '#00cc6618', bd: '#00cc6630' }
}

// Selo de status do anúncio; mostra o motivo no hover quando houver.
function StatusPill({ label, motivo }: { label: string; motivo?: string }) {
  const [hover, setHover] = useState(false)
  if (!label || !label.trim()) return <span style={{ color: '#888', fontSize: 12 }}>—</span>
  const c = statusCor(label)
  const temMotivo = !!(motivo && motivo.trim())
  return (
    <span
      style={{ position: 'relative', display: 'inline-block', cursor: temMotivo ? 'help' : 'default' }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 20, fontWeight: 600, background: c.bg, color: c.fg, border: `1px solid ${c.bd}`, whiteSpace: 'nowrap' }}>
        {label}{temMotivo ? ' ⓘ' : ''}
      </span>
      {hover && temMotivo && (
        <span style={{
          position: 'absolute', bottom: 'calc(100% + 6px)', left: 0,
          background: '#0f172a', border: '1px solid #334155', borderRadius: 5, padding: '5px 9px',
          fontSize: 11, maxWidth: 280, whiteSpace: 'normal', zIndex: 200, pointerEvents: 'none',
          color: '#e2e8f0', fontWeight: 400, lineHeight: '1.5', boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
        }}>
          {motivo}
        </span>
      )}
    </span>
  )
}

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
      <button onClick={aberto ? () => setAberto(false) : abrir} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 14px', borderRadius: 8, fontSize: 13, fontWeight: 500, background: t.filtroBtn, border: `1px solid ${t.border}`, color: t.textSecondary, cursor: 'pointer' }}>
        📅 {label} <span style={{ fontSize: 10, color: t.textMuted }}>▼</span>
      </button>
      {aberto && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 998 }} onClick={() => setAberto(false)} />
          <div style={{ position: 'absolute', top: 'calc(100% + 8px)', left: 0, zIndex: 999, background: t.dropBg, border: `1px solid ${t.dropBorder}`, borderRadius: 12, padding: 16, minWidth: 380, boxShadow: '0 8px 32px rgba(0,0,0,0.35)' }}>
            <div style={{ display: 'flex', gap: 20 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 160 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: t.textMuted, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 }}>PERÍODOS</div>
                {PRESETS.map(p => (
                  <div key={p.key} onClick={() => setTp(p.key)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 10px', borderRadius: 7, cursor: 'pointer', background: tp === p.key ? TK + '1A' : 'transparent' }}>
                    <div style={{ width: 12, height: 12, borderRadius: '50%', flexShrink: 0, border: `2px solid ${tp === p.key ? TK : t.textMuted}`, background: tp === p.key ? TK : 'transparent' }} />
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
              <button onClick={aplicar} style={{ padding: '6px 16px', borderRadius: 7, fontSize: 13, background: TK, border: 'none', color: '#fff', cursor: 'pointer', fontWeight: 600 }}>Aplicar</button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// ─── Trend Chart ──────────────────────────────────────────────────────────────
type TKBarMetric = 'spend' | 'impressions' | 'clicks'
type TKLineMetric = 'cpm' | 'ctr' | 'cpc'

const TK_BAR_OPTIONS: { key: TKBarMetric; label: string; color: string }[] = [
  { key: 'spend', label: 'Investimento', color: TK },
  { key: 'impressions', label: 'Impressões', color: '#c77dff' },
  { key: 'clicks', label: 'Cliques', color: '#74c69d' },
]
const TK_LINE_OPTIONS: { key: TKLineMetric; label: string; color: string }[] = [
  { key: 'cpm', label: 'CPM', color: '#ff9f1c' },
  { key: 'ctr', label: 'CTR', color: '#56cfe1' },
  { key: 'cpc', label: 'CPC', color: '#ffd166' },
]

function fmtTKBarVal(v: number, metric: TKBarMetric): string {
  if (metric === 'spend') return `R$${v >= 1000 ? (v / 1000).toFixed(0) + 'k' : v.toFixed(0)}`
  if (v >= 1_000_000) return (v / 1_000_000).toFixed(1) + 'M'
  if (v >= 1_000) return (v / 1_000).toFixed(0) + 'k'
  return String(Math.round(v))
}
function fmtTKLineVal(v: number, metric: TKLineMetric): string {
  if (metric === 'ctr') return `${v.toFixed(2)}%`
  return `R$${v.toFixed(2)}`
}

function TrendChart({ serie, theme }: { serie: TikTokAccountData['serie']; theme: Theme }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const chartRef = useRef<any>(null)
  const [barMetrics, setBarMetrics] = useState<TKBarMetric[]>(['spend'])
  const [lineMetrics, setLineMetrics] = useState<TKLineMetric[]>(['cpm'])
  const t = C[theme]

  function toggleBar(key: TKBarMetric) {
    setBarMetrics(prev => prev.includes(key) ? (prev.length > 1 ? prev.filter(k => k !== key) : prev) : [...prev, key])
  }
  function toggleLine(key: TKLineMetric) {
    setLineMetrics(prev => prev.includes(key) ? (prev.length > 1 ? prev.filter(k => k !== key) : prev) : [...prev, key])
  }

  const barLabels = barMetrics.map(k => TK_BAR_OPTIONS.find(o => o.key === k)!.label)
  const lineLabels = lineMetrics.map(k => TK_LINE_OPTIONS.find(o => o.key === k)!.label)
  const title = `TENDÊNCIA — ${barLabels.join(' E ').toUpperCase()} VS ${lineLabels.join(' E ').toUpperCase()}`
  const primaryLine = TK_LINE_OPTIONS.find(o => o.key === lineMetrics[0])!

  const btnStyle = (active: boolean, color: string): React.CSSProperties => ({
    padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600,
    cursor: 'pointer', border: `1px solid ${active ? color : t.border}`,
    background: active ? color + '22' : 'transparent',
    color: active ? color : t.textMuted, transition: 'all 0.15s',
  })

  useEffect(() => {
    if (!canvasRef.current || serie.length === 0) return
    const run = async () => {
      const { Chart, registerables } = await import('chart.js')
      Chart.register(...registerables)
      chartRef.current?.destroy()
      const labels = serie.map(p => { const [, m, d] = p.date.split('-'); return `${d}/${m}` })
      const allBarData = barMetrics.map(k => serie.map(p => (p[k] as number) ?? 0))
      const barDatasets = barMetrics.map((k, i) => {
        const opt = TK_BAR_OPTIONS.find(o => o.key === k)!
        return { type: 'bar' as const, label: opt.label, data: allBarData[i], backgroundColor: opt.color + '99', borderColor: opt.color, borderWidth: 1, borderRadius: 3, yAxisID: `yBar${i}` }
      })
      const lineDatasets = lineMetrics.map(k => {
        const opt = TK_LINE_OPTIONS.find(o => o.key === k)!
        return { type: 'line' as const, label: opt.label, data: serie.map(p => (p[k] as number) ?? 0), borderColor: opt.color, backgroundColor: opt.color + '22', borderWidth: 2, pointRadius: serie.length > 30 ? 0 : 3, pointBackgroundColor: opt.color, tension: 0.3, yAxisID: 'yLine' }
      })
      const barScales: Record<string, any> = {}
      barMetrics.forEach((k, i) => {
        const opt = TK_BAR_OPTIONS.find(o => o.key === k)!
        const maxVal = Math.max(...allBarData[i], 1)
        barScales[`yBar${i}`] = { type: 'linear', position: 'left', display: i === 0, max: maxVal * 1.15, grid: { color: i === 0 ? t.borderInner : 'transparent' }, ticks: { color: opt.color, font: { size: 10 }, callback: (v: any) => fmtTKBarVal(Number(v), k) } }
      })
      chartRef.current = new Chart(canvasRef.current!, {
        data: { labels, datasets: [...barDatasets, ...lineDatasets] },
        options: {
          responsive: true, maintainAspectRatio: false,
          interaction: { mode: 'index', intersect: false },
          plugins: {
            legend: { labels: { color: t.textMuted, font: { size: 11 }, boxWidth: 12, padding: 16 } },
            tooltip: {
              backgroundColor: t.dropBg, titleColor: t.textPrimary, bodyColor: t.textSecondary, borderColor: t.border, borderWidth: 1,
              callbacks: {
                label: (ctx: any) => {
                  const isBar = ctx.dataset.type === 'bar'
                  const key = isBar ? barMetrics[ctx.datasetIndex] : lineMetrics[ctx.datasetIndex - barMetrics.length]
                  if (isBar) return `  ${ctx.dataset.label}: ${fmtTKBarVal(ctx.raw, key as TKBarMetric)}`
                  return `  ${ctx.dataset.label}: ${fmtTKLineVal(ctx.raw, key as TKLineMetric)}`
                },
              },
            },
          },
          scales: {
            x: { ticks: { color: t.textMuted, font: { size: 10 }, maxTicksLimit: serie.length > 30 ? 8 : 15 }, grid: { color: t.borderInner } },
            ...barScales,
            yLine: { type: 'linear' as const, position: 'right' as const, ticks: { color: primaryLine.color, font: { size: 10 }, callback: (v: any) => fmtTKLineVal(Number(v), lineMetrics[0]) }, grid: { drawOnChartArea: false } },
          },
        },
      })
    }
    run()
    return () => { chartRef.current?.destroy(); chartRef.current = null }
  }, [serie, theme, barMetrics.join(), lineMetrics.join()]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div style={{ background: t.card, border: `1px solid ${t.border}`, borderRadius: 12, padding: '16px 20px', marginBottom: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 10, fontWeight: 700, color: t.textMuted, textTransform: 'uppercase', letterSpacing: 1 }}>{title}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 10, color: t.textMuted, marginRight: 4 }}>Barras:</span>
          {TK_BAR_OPTIONS.map(o => <button key={o.key} onClick={() => toggleBar(o.key)} style={btnStyle(barMetrics.includes(o.key), o.color)}>{o.label}</button>)}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 10, color: t.textMuted, marginRight: 4 }}>Linha:</span>
          {TK_LINE_OPTIONS.map(o => <button key={o.key} onClick={() => toggleLine(o.key)} style={btnStyle(lineMetrics.includes(o.key), o.color)}>{o.label}</button>)}
        </div>
      </div>
      <div style={{ height: 260 }}><canvas ref={canvasRef} /></div>
    </div>
  )
}

// ─── KPI Tile ─────────────────────────────────────────────────────────────────
function KpiTile({ label, value, note, color, t, delta }: { label: string; value: string; note?: string; color: string; t: typeof C['dark']; delta?: number | null }) {
  return (
    <div style={{ background: t.kpiBg, border: `1px solid ${t.kpiBorder}`, borderRadius: 10, padding: '14px 16px', borderTop: `3px solid ${color}` }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: t.textMuted, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 700, color: t.textPrimary, lineHeight: 1.2 }}><CopiavelNum compact={value} /></div>
      {note && <div style={{ fontSize: 10, color: t.textMuted, marginTop: 4 }}>{note}</div>}
      {delta != null && (
        <div style={{ fontSize: 11, fontWeight: 700, color: delta >= 0 ? '#22c55e' : '#f87171', marginTop: 4 }}>
          {delta > 0 ? '+' : ''}{delta.toFixed(1).replace('.', ',')}%
        </div>
      )}
    </div>
  )
}

// ─── Account Card ─────────────────────────────────────────────────────────────
function AccountCard({ acc, totalSpend, t }: { acc: TikTokAccountData; totalSpend: number; t: typeof C['dark'] }) {
  const [open, setOpen] = useState(true)
  const sharePct = totalSpend > 0 ? (acc.spend / totalSpend) * 100 : 0
  return (
    <div style={{ border: `1px solid ${t.border}`, borderRadius: 10, overflow: 'hidden', background: t.card }}>
      <button onClick={() => setOpen(o => !o)} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', padding: '14px 16px', background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: t.textPrimary }}>{acc.nome}</span>
          <span style={{ fontSize: 11, padding: '2px 9px', borderRadius: 20, background: TK + '18', color: TK, border: `1px solid ${TK}33` }}>{fmtBRL(acc.spend)}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {sharePct > 0 && <span style={{ fontSize: 11, color: t.textMuted }}>{fmtPct(sharePct)} do total</span>}
          <span style={{ color: t.chevron, fontSize: 12 }}>{open ? '▲' : '▼'}</span>
        </div>
      </button>
      {sharePct > 0 && <div style={{ height: 2, background: t.barTrack, margin: '0 16px' }}><div style={{ width: `${Math.min(100, sharePct)}%`, height: '100%', background: TK, borderRadius: 2 }} /></div>}
      {open && (
        <div style={{ padding: '12px 16px 16px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', gap: '8px 16px' }}>
            {[
              { label: 'Invest.', v: fmtBRL(acc.spend), h: '#60a5fa' },
              { label: 'Impressões', v: fmtNum(acc.impressions) },
              { label: 'Alcance', v: fmtNum(acc.reach) },
              { label: 'Cliques', v: fmtNum(acc.clicks) },
              { label: 'CTR', v: fmtPct(acc.ctr) },
              { label: 'CPM', v: fmtBRL(acc.cpm) },
              { label: 'CPC', v: fmtBRL(acc.cpc) },
              { label: 'Frequência', v: acc.frequency.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) },
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

// ─── Audiência Section ─────────────────────────────────────────────────────────
const AUD_METRICAS_TK = [
  { key: 'impressions', label: 'Impressões', money: false },
  { key: 'clicks', label: 'Cliques', money: false },
  { key: 'spend', label: 'Investimento', money: true },
] as const
type AudMetricaTK = typeof AUD_METRICAS_TK[number]['key']

function AudienciaSection({ filtrado, t }: { filtrado: TikTokAccountData[]; t: typeof C['dark'] }) {
  const [metrica, setMetrica] = useState<AudMetricaTK>('impressions')
  const info = AUD_METRICAS_TK.find(m => m.key === metrica)!
  const barColors = ['#4dabf7', '#c77dff', '#56cfe1', '#74c69d', '#ffd166', '#ff9f1c']
  const fmtVal = (v: number) => info.money ? fmtBRL(v) : fmtNum(v)

  function aggregate(key: 'genero' | 'idade' | 'plataforma') {
    const map = new Map<string, { impressions: number; clicks: number; spend: number }>()
    for (const acc of filtrado) {
      for (const item of acc.audiencia?.[key] ?? []) {
        const ex = map.get(item.label) ?? { impressions: 0, clicks: 0, spend: 0 }
        map.set(item.label, { impressions: ex.impressions + item.impressions, clicks: ex.clicks + item.clicks, spend: ex.spend + item.spend })
      }
    }
    const items = Array.from(map.entries()).map(([label, v]) => ({ label, ...v, pct: 0 }))
    const total = items.reduce((s, i) => s + (i[metrica] as number), 0)
    items.forEach(i => { i.pct = total > 0 ? Math.round(((i[metrica] as number) / total) * 1000) / 10 : 0 })
    return items.sort((a, b) => (b[metrica] as number) - (a[metrica] as number))
  }

  const genero = aggregate('genero')
  const idade = aggregate('idade')
  const plataforma = aggregate('plataforma')
  if (!genero.length && !idade.length && !plataforma.length) return null

  const chip = (active: boolean): React.CSSProperties => ({
    padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, cursor: 'pointer',
    border: `1px solid ${active ? TK : t.border}`, background: active ? TK + '22' : 'transparent',
    color: active ? TK : t.textMuted, transition: 'all 0.15s',
  })

  function BreakdownGroup({ title, items }: { title: string; items: ReturnType<typeof aggregate> }) {
    if (!items.length) return null
    return (
      <div>
        <div style={{ fontSize: 11, fontWeight: 700, color: t.textMuted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>{title}</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {items.map((item, i) => (
            <div key={item.label}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontSize: 12, color: t.textSecondary }}>{item.label}</span>
                <span style={{ fontSize: 12, color: t.textMuted }}>{fmtVal(item[metrica] as number)} · {item.pct.toFixed(1).replace('.', ',')}%</span>
              </div>
              <div style={{ height: 8, background: t.barTrack, borderRadius: 999, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${item.pct}%`, background: barColors[i % barColors.length], borderRadius: 999, transition: 'width 0.4s ease' }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  function exportCSV() {
    const rows: (string | number)[][] = [['Seção', 'Categoria', 'Impressões', 'Cliques', 'Investimento', 'Percentual %']]
    const add = (sec: string, items: ReturnType<typeof aggregate>) => items.forEach(i => rows.push([sec, i.label, i.impressions, i.clicks, i.spend.toFixed(2), i.pct.toFixed(1)]))
    add('Gênero', genero); add('Faixa Etária', idade); add('Plataforma', plataforma)
    const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = 'tiktok-ads-audiencia.csv'
    document.body.appendChild(a); a.click(); document.body.removeChild(a)
    setTimeout(() => URL.revokeObjectURL(url), 100)
  }

  return (
    <div style={{ border: `1px solid ${t.border}`, borderRadius: 10, padding: '16px 20px', background: t.card, marginBottom: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 12, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: t.textMuted, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Audiência</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 10, color: t.textMuted, marginRight: 2 }}>Ver por:</span>
          {AUD_METRICAS_TK.map(m => (
            <button key={m.key} onClick={() => setMetrica(m.key)} style={chip(metrica === m.key)}>{m.label}</button>
          ))}
          <button onClick={exportCSV} title="Exportar audiência em CSV" style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px', borderRadius: 8, fontSize: 12, fontWeight: 500, cursor: 'pointer', border: `1px solid ${t.border}`, background: t.chipBg, color: t.textMuted, whiteSpace: 'nowrap', marginLeft: 6 }}>↓ CSV</button>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 28 }}>
        <BreakdownGroup title="Gênero" items={genero} />
        <BreakdownGroup title="Faixa Etária" items={idade} />
        <BreakdownGroup title="Plataforma" items={plataforma} />
      </div>
    </div>
  )
}

// ─── Data Table (3 níveis: Campanhas / Conjuntos / Anúncios) ──────────────────
function DataTable({ campanhas, grupos, anuncios, totalSpend, t }: {
  campanhas: TikTokCampaignData[]; grupos: TikTokAdSetData[]; anuncios: TikTokAdData[]; totalSpend: number; t: typeof C['dark']
}) {
  const [nivel, setNivel] = useState<NivelTK>('campanhas')
  const [busca, setBusca] = useState('')
  const [sortCol, setSortCol] = useState<string | null>(null)
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  useEffect(() => { setBusca(''); setSortCol(null) }, [nivel])

  function toggleSort(col: string) {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortCol(col); setSortDir('desc') }
  }
  function sortRows<T extends Record<string, any>>(rows: T[]): T[] {
    if (!sortCol) return rows
    return [...rows].sort((a, b) => {
      const av = Number(a[sortCol] ?? 0), bv = Number(b[sortCol] ?? 0)
      return sortDir === 'asc' ? av - bv : bv - av
    })
  }

  const q = busca.toLowerCase()
  const filtCamp = campanhas.filter(c => !q || c.nome.toLowerCase().includes(q))
  const filtGrupos = grupos.filter(g => !q || g.nome.toLowerCase().includes(q) || g.campanha.toLowerCase().includes(q))
  const filtAnuncios = anuncios.filter(a => !q || a.nome.toLowerCase().includes(q) || a.adset.toLowerCase().includes(q) || a.campanha.toLowerCase().includes(q))
  const sortedCamp = sortRows(filtCamp)
  const sortedGrupos = sortRows(filtGrupos)
  const sortedAnuncios = sortRows(filtAnuncios)

  function exportCSV() {
    let headers: string[]; let rows: (string | number)[][]
    if (nivel === 'campanhas') {
      headers = ['Campanha', 'Investimento', 'Impressões', 'Alcance', 'Cliques', 'Visualizações', 'CTR%', 'CPM', 'CPC', 'CPV']
      rows = sortedCamp.map(c => [c.nome, c.spend, c.impressions, c.reach, c.clicks, c.videoViews, c.ctr.toFixed(4), c.cpm.toFixed(2), c.cpc.toFixed(2), c.cpv.toFixed(4)])
    } else if (nivel === 'conjuntos') {
      headers = ['Conjunto', 'Campanha', 'Investimento', 'Impressões', 'Alcance', 'Cliques', 'Visualizações', 'CTR%', 'CPM', 'CPC', 'CPV']
      rows = sortedGrupos.map(g => [g.nome, g.campanha, g.spend, g.impressions, g.reach, g.clicks, g.videoViews, g.ctr.toFixed(4), g.cpm.toFixed(2), g.cpc.toFixed(2), g.cpv.toFixed(4)])
    } else {
      headers = ['Anúncio', 'Conjunto', 'Campanha', 'Investimento', 'Impressões', 'Alcance', 'Cliques', 'Visualizações', 'CTR%', 'CPM', 'CPC', 'CPV']
      rows = sortedAnuncios.map(a => [a.nome, a.adset, a.campanha, a.spend, a.impressions, a.reach, a.clicks, a.videoViews, a.ctr.toFixed(4), a.cpm.toFixed(2), a.cpc.toFixed(2), a.cpv.toFixed(4)])
    }
    const csv = [headers, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = `tiktok-${nivel}.csv`
    document.body.appendChild(a); a.click(); document.body.removeChild(a)
    setTimeout(() => URL.revokeObjectURL(url), 100)
  }

  const thS: React.CSSProperties = { padding: '9px 12px', fontSize: 10, fontWeight: 700, color: t.textMuted, textTransform: 'uppercase', letterSpacing: 0.8, textAlign: 'left', borderBottom: `1px solid ${t.tableBorder}`, whiteSpace: 'nowrap' }
  const tdS: React.CSSProperties = { padding: '10px 12px', fontSize: 13, color: t.textSecondary, borderBottom: `1px solid ${t.tableBorder}`, verticalAlign: 'middle' }

  const metricHeaders = (
    <>
      {(['spend', 'impressions', 'reach', 'clicks', 'videoViews', 'ctr', 'cpm', 'cpc', 'cpv'] as const).map((col, i) => {
        const labels = ['INVEST.', 'IMPR.', 'ALCANCE', 'CLIQUES', 'VISUALIZAÇÕES', 'CTR', 'CPM', 'CPC', 'CPV']
        return <th key={col} onClick={() => toggleSort(col)} style={{ ...thS, textAlign: 'right', cursor: 'pointer', userSelect: 'none', color: sortCol === col ? t.textSecondary : t.textMuted }}>{labels[i]}{sortCol === col ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ''}</th>
      })}
    </>
  )
  const metricCells = (item: { spend: number; impressions: number; reach: number; clicks: number; videoViews: number; ctr: number; cpm: number; cpc: number; cpv: number }) => (
    <>
      <td style={{ ...tdS, textAlign: 'right', color: '#60a5fa', fontWeight: 600 }}><CopiavelNum compact={fmtBRL(item.spend)} /></td>
      <td style={{ ...tdS, textAlign: 'right' }}><CopiavelNum compact={fmtNum(item.impressions)} full={fmtNumFull(item.impressions)} /></td>
      <td style={{ ...tdS, textAlign: 'right' }}>{item.reach > 0 ? <CopiavelNum compact={fmtNum(item.reach)} full={fmtNumFull(item.reach)} /> : '—'}</td>
      <td style={{ ...tdS, textAlign: 'right' }}><CopiavelNum compact={fmtNum(item.clicks)} full={fmtNumFull(item.clicks)} /></td>
      <td style={{ ...tdS, textAlign: 'right' }}>{item.videoViews > 0 ? <CopiavelNum compact={fmtNum(item.videoViews)} full={fmtNumFull(item.videoViews)} /> : '—'}</td>
      <td style={{ ...tdS, textAlign: 'right' }}><CopiavelNum compact={fmtPct(item.ctr)} /></td>
      <td style={{ ...tdS, textAlign: 'right' }}><CopiavelNum compact={fmtBRL(item.cpm)} /></td>
      <td style={{ ...tdS, textAlign: 'right' }}>{item.cpc > 0 ? <CopiavelNum compact={fmtBRL(item.cpc)} /> : '—'}</td>
      <td style={{ ...tdS, textAlign: 'right' }}>{item.cpv > 0 ? <CopiavelNum compact={fmtBRL(item.cpv)} /> : '—'}</td>
    </>
  )

  return (
    <div style={{ background: t.card, border: `1px solid ${t.border}`, borderRadius: 12 }}>
      {/* Level tabs */}
      <div style={{ display: 'flex', gap: 0, borderBottom: `1px solid ${t.border}`, padding: '0 16px', overflowX: 'auto' }}>
        {NIVEL_TABS_TK.map(tab => (
          <button key={tab.key} onClick={() => setNivel(tab.key)} style={{
            padding: '12px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer', border: 'none', background: 'transparent', whiteSpace: 'nowrap',
            color: nivel === tab.key ? TK : t.textMuted,
            borderBottom: nivel === tab.key ? `2px solid ${TK}` : '2px solid transparent', marginBottom: -1, transition: 'all 0.15s',
          }}>{tab.label}</button>
        ))}
      </div>

      {/* Search + export */}
      <div style={{ padding: '10px 16px', borderBottom: `1px solid ${t.tableBorder}`, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <div style={{ flex: 1 }} />
        <input placeholder="Filtrar por nome..." value={busca} onChange={e => setBusca(e.target.value)} style={{ background: t.inputBg, border: `1px solid ${t.inputBorder}`, color: t.inputText, borderRadius: 8, padding: '5px 12px', fontSize: 13, outline: 'none', width: 'clamp(120px, 30vw, 200px)' }} />
        <button onClick={exportCSV} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px', borderRadius: 8, fontSize: 12, fontWeight: 500, cursor: 'pointer', border: `1px solid ${t.border}`, background: t.chipBg, color: t.textMuted }}>↓ CSV</button>
      </div>

      <div style={{ overflowX: 'auto' }}>
        {nivel === 'campanhas' && (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr><th style={{ ...thS, minWidth: 240 }}>CAMPANHA</th>{metricHeaders}</tr></thead>
            <tbody>
              {sortedCamp.length === 0 ? (
                <tr><td colSpan={10} style={{ ...tdS, textAlign: 'center', color: t.textMuted, padding: 28 }}>Nenhuma campanha encontrada</td></tr>
              ) : sortedCamp.map(c => {
                const share = totalSpend > 0 ? (c.spend / totalSpend) * 100 : 0
                return (
                  <tr key={c.id} onMouseEnter={e => (e.currentTarget.style.background = t.tableHover)} onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                    <td style={tdS}>
                      <div style={{ fontWeight: 600, color: t.textPrimary, marginBottom: 3 }}>{c.nome}</div>
                      {share > 0 && <div style={{ height: 2, background: t.barTrack, borderRadius: 2 }}><div style={{ width: `${Math.min(100, share)}%`, height: '100%', background: TK, borderRadius: 2 }} /></div>}
                    </td>
                    {metricCells(c)}
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}

        {nivel === 'conjuntos' && (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr><th style={{ ...thS, minWidth: 200 }}>CONJUNTO DE ANÚNCIOS</th><th style={{ ...thS, minWidth: 160 }}>CAMPANHA</th>{metricHeaders}</tr></thead>
            <tbody>
              {sortedGrupos.length === 0 ? (
                <tr><td colSpan={11} style={{ ...tdS, textAlign: 'center', color: t.textMuted, padding: 28 }}>Nenhum conjunto encontrado</td></tr>
              ) : sortedGrupos.map(g => {
                const share = totalSpend > 0 ? (g.spend / totalSpend) * 100 : 0
                return (
                  <tr key={g.id} onMouseEnter={e => (e.currentTarget.style.background = t.tableHover)} onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                    <td style={tdS}>
                      <div style={{ fontWeight: 600, color: t.textPrimary, marginBottom: 3 }}>{g.nome}</div>
                      {share > 0 && <div style={{ height: 2, background: t.barTrack, borderRadius: 2 }}><div style={{ width: `${Math.min(100, share)}%`, height: '100%', background: TK, borderRadius: 2 }} /></div>}
                    </td>
                    <td style={{ ...tdS, fontSize: 11, color: t.textMuted }}>{g.campanha}</td>
                    {metricCells(g)}
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}

        {nivel === 'anuncios' && (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr><th style={{ ...thS, minWidth: 200 }}>ANÚNCIO</th><th style={{ ...thS, minWidth: 120 }}>STATUS</th><th style={{ ...thS, minWidth: 160 }}>CONJUNTO</th><th style={{ ...thS, minWidth: 160 }}>CAMPANHA</th>{metricHeaders}</tr></thead>
            <tbody>
              {sortedAnuncios.length === 0 ? (
                <tr><td colSpan={13} style={{ ...tdS, textAlign: 'center', color: t.textMuted, padding: 28 }}>Nenhum anúncio encontrado</td></tr>
              ) : sortedAnuncios.map(a => {
                const share = totalSpend > 0 ? (a.spend / totalSpend) * 100 : 0
                return (
                  <tr key={a.id} onMouseEnter={e => (e.currentTarget.style.background = t.tableHover)} onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                    <td style={tdS}>
                      <div style={{ fontWeight: 600, color: t.textPrimary, marginBottom: 3 }}>{a.nome}</div>
                      {share > 0 && <div style={{ height: 2, background: t.barTrack, borderRadius: 2 }}><div style={{ width: `${Math.min(100, share)}%`, height: '100%', background: TK, borderRadius: 2 }} /></div>}
                    </td>
                    <td style={tdS}><StatusPill label={a.statusRevisao} motivo={a.statusMotivo} /></td>
                    <td style={{ ...tdS, fontSize: 11, color: t.textMuted }}>{a.adset}</td>
                    <td style={{ ...tdS, fontSize: 11, color: t.textMuted }}>{a.campanha}</td>
                    {metricCells(a)}
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function TikTokAdsPage({ theme = 'dark', visible = true }: { theme?: Theme; visible?: boolean }) {
  const [data, setData] = useState<TikTokAccountData[] | null>(null)
  const [nomes, setNomes] = useState<string[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [filtroCliente, setFiltroCliente] = useState('')
  const [preset, setPreset] = useState<Preset>('mes-atual')
  const [custom, setCustom] = useState({ start: '', end: '' })
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [cooldown, setCooldown] = useState(false)
  const [comparar, setComparar] = useState(false)
  const [prevData, setPrevData] = useState<TikTokAccountData[] | null>(null)
  const [loadingPrev, setLoadingPrev] = useState(false)

  const t = C[theme]
  const periodoRef = useRef(getPeriodo('mes-atual'))
  const cooldownRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  function fetchData(p: { start: string; end: string }, fresh = false) {
    setLoading(true); setError('')
    fetch(`/api/tiktok-ads?start=${p.start}&end=${p.end}${fresh ? '&fresh=1' : ''}`)
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
    fetchData(periodoRef.current, true)
    if (cooldownRef.current) clearTimeout(cooldownRef.current)
    cooldownRef.current = setTimeout(() => setCooldown(false), 30000)
  }

  function toggleComparar() {
    if (comparar) { setComparar(false); setPrevData(null); return }
    const prev = getPrevPeriodo(periodoRef.current)
    setLoadingPrev(true); setComparar(true)
    fetch(`/api/tiktok-ads?start=${prev.start}&end=${prev.end}`)
      .then(r => r.json())
      .then(res => { if (!res.error) setPrevData(res.data ?? []); setLoadingPrev(false) })
      .catch(() => setLoadingPrev(false))
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
        fetch(`/api/tiktok-ads?start=${cur.start}&end=${cur.end}`).then(r => r.json()).then(res => {
          if (!res.error) { setData(res.data ?? []); if ((res.nomes ?? []).length > 0) setNomes(res.nomes); setLastUpdated(new Date()) }
        }).catch(() => {})
        timer = scheduleNext()
      }, next.getTime() - now.getTime())
    }
    let timer = scheduleNext()
    return () => { clearTimeout(timer); if (cooldownRef.current) clearTimeout(cooldownRef.current) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Re-fetch quando a aba se torna visível: sempre se data estiver vazia, ou se tiver > 5 min
  useEffect(() => {
    if (!visible) return
    const isEmpty = !data || data.length === 0
    const stale = !lastUpdated || (Date.now() - lastUpdated.getTime() > 5 * 60 * 1000)
    if ((isEmpty || stale) && !loading) fetchData(periodoRef.current)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible])

  const center: React.CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', minHeight: 200 }
  const filtrado = (data ?? []).filter(d => !filtroCliente || d.nome === filtroCliente)
  const selectedAccount = filtroCliente ? filtrado[0] : null

  const totalSpend = filtrado.reduce((s, a) => s + a.spend, 0)
  const totalImpressions = filtrado.reduce((s, a) => s + a.impressions, 0)
  const totalClicks = filtrado.reduce((s, a) => s + a.clicks, 0)
  const ctrMedio = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0
  const cpmMedio = totalSpend > 0 && totalImpressions > 0 ? (totalSpend / totalImpressions) * 1000 : 0
  const cpcMedio = totalClicks > 0 ? totalSpend / totalClicks : 0
  const freqMedio = selectedAccount ? selectedAccount.frequency : filtrado.length > 0 ? filtrado.reduce((s, a) => s + a.frequency, 0) / filtrado.length : 0

  const prevFiltrado = comparar && prevData ? prevData.filter(d => !filtroCliente || d.nome === filtroCliente) : []
  const pDelta = (curr: number, prev: number): number | null => comparar && prevData && prev > 0 ? ((curr - prev) / prev) * 100 : null
  const prevSpend = prevFiltrado.reduce((s, a) => s + a.spend, 0)
  const prevImpr = prevFiltrado.reduce((s, a) => s + a.impressions, 0)
  const prevClicks = prevFiltrado.reduce((s, a) => s + a.clicks, 0)
  const prevCtr = prevImpr > 0 ? (prevClicks / prevImpr) * 100 : 0
  const prevCpm = prevSpend > 0 && prevImpr > 0 ? (prevSpend / prevImpr) * 1000 : 0
  const prevCpc = prevClicks > 0 ? prevSpend / prevClicks : 0

  const allCampanhas = selectedAccount ? selectedAccount.campanhas : filtrado.flatMap(a => a.campanhas).sort((a, b) => b.spend - a.spend)
  const allGrupos = selectedAccount ? (selectedAccount.grupos ?? []) : filtrado.flatMap(a => a.grupos ?? []).sort((a, b) => b.spend - a.spend)
  const allAnuncios = selectedAccount ? (selectedAccount.anuncios ?? []) : filtrado.flatMap(a => a.anuncios ?? []).sort((a, b) => b.spend - a.spend)

  const mergedSerie = (() => {
    if (selectedAccount) return selectedAccount.serie ?? []
    const dateMap = new Map<string, { spend: number; impressions: number; clicks: number }>()
    for (const acc of filtrado) {
      for (const pt of (acc.serie ?? [])) {
        const ex = dateMap.get(pt.date) ?? { spend: 0, impressions: 0, clicks: 0 }
        dateMap.set(pt.date, { spend: ex.spend + pt.spend, impressions: ex.impressions + pt.impressions, clicks: ex.clicks + pt.clicks })
      }
    }
    return Array.from(dateMap.entries()).sort(([a], [b]) => a.localeCompare(b)).map(([date, d]) => ({
      date, ...d,
      ctr: d.impressions > 0 ? (d.clicks / d.impressions) * 100 : 0,
      cpc: d.clicks > 0 ? d.spend / d.clicks : 0,
      cpm: d.impressions > 0 ? (d.spend / d.impressions) * 1000 : 0,
    }))
  })()

  return (
    <div style={{ padding: 'clamp(12px, 4vw, 24px) clamp(12px, 4vw, 24px) 40px', overflowY: 'auto', height: '100%', boxSizing: 'border-box', background: t.page }}>

      {/* Controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        <PeriodoDropdown preset={preset} custom={custom} t={t} onApply={aplicarPeriodo} />
        <select value={filtroCliente} onChange={e => setFiltroCliente(e.target.value)} style={{ background: t.selectBg, border: `1px solid ${t.selectBorder}`, color: t.selectText, borderRadius: 8, padding: '6px 12px', fontSize: 13, cursor: 'pointer', outline: 'none', height: 34 }}>
          <option value="">Todas as contas</option>
          {nomes.filter(n => (data ?? []).some(d => d.nome === n)).map(n => <option key={n} value={n}>{n}</option>)}
        </select>
        <button onClick={handleManualRefresh} disabled={cooldown || loading} title={cooldown ? 'Aguarde 30s' : 'Atualizar dados'} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 12px', borderRadius: 8, fontSize: 12, fontWeight: 500, cursor: cooldown || loading ? 'not-allowed' : 'pointer', border: `1px solid ${t.border}`, background: t.filtroBtn, color: cooldown || loading ? t.textMuted : t.textSecondary, transition: 'all 0.15s', flexShrink: 0 }}>
          <span style={{ display: 'inline-block', animation: loading ? 'spin 0.8s linear infinite' : 'none' }}>↻</span>
          {lastUpdated ? `${String(lastUpdated.getHours()).padStart(2, '0')}:${String(lastUpdated.getMinutes()).padStart(2, '0')}` : 'Atualizar'}
        </button>
        {loading && <div style={{ width: 18, height: 18, border: `2px solid ${t.spinner}`, borderTop: `2px solid ${TK}`, borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />}
        <button onClick={toggleComparar} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 12px', borderRadius: 8, fontSize: 12, fontWeight: 500, cursor: 'pointer', border: `1px solid ${comparar ? TK + '55' : t.border}`, background: comparar ? TK + '18' : t.filtroBtn, color: comparar ? TK : t.textSecondary, transition: 'all 0.15s', flexShrink: 0 }}>
          ⇄ {loadingPrev ? '...' : comparar ? 'Comparando' : 'Comparar'}
        </button>
      </div>

      {loading && !data ? (
        <div style={center}><div style={{ width: 28, height: 28, border: `3px solid ${t.spinner}`, borderTop: `3px solid ${TK}`, borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} /></div>
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
            <KpiTile label="Investimento" value={fmtBRL(totalSpend)} color={TILE_COLORS[0]} t={t} delta={pDelta(totalSpend, prevSpend)} />
            <KpiTile label="Impressões" value={fmtNum(totalImpressions)} color={TILE_COLORS[1]} t={t} delta={pDelta(totalImpressions, prevImpr)} />
            <KpiTile label="Alcance" value={selectedAccount ? fmtNum(selectedAccount.reach) : '—'} note={!selectedAccount ? 'Selecione uma conta' : undefined} color={TILE_COLORS[2]} t={t} />
            <KpiTile label="Cliques" value={fmtNum(totalClicks)} color={TILE_COLORS[3]} t={t} delta={pDelta(totalClicks, prevClicks)} />
            <KpiTile label="CTR Médio" value={fmtPct(ctrMedio)} color={TILE_COLORS[4]} t={t} delta={pDelta(ctrMedio, prevCtr)} />
            <KpiTile label="CPM Médio" value={fmtBRL(cpmMedio)} color={TILE_COLORS[5]} t={t} delta={pDelta(cpmMedio, prevCpm)} />
            <KpiTile label="CPC Médio" value={cpcMedio > 0 ? fmtBRL(cpcMedio) : '—'} color={TILE_COLORS[6]} t={t} delta={pDelta(cpcMedio, prevCpc)} />
            <KpiTile label="Frequência" value={freqMedio > 0 ? freqMedio.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—'} note={!selectedAccount && filtrado.length > 1 ? 'média entre contas' : undefined} color={TILE_COLORS[7]} t={t} />
          </div>

          {/* Trend chart */}
          {mergedSerie.length > 1 && <TrendChart serie={mergedSerie} theme={theme} />}

          {/* Account cards */}
          {!filtroCliente && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24 }}>
              {filtrado.map(acc => <AccountCard key={acc.id} acc={acc} totalSpend={totalSpend} t={t} />)}
            </div>
          )}

          {/* Audiência */}
          <AudienciaSection filtrado={filtrado} t={t} />

          {/* Data table — 3 níveis */}
          <DataTable campanhas={allCampanhas} grupos={allGrupos} anuncios={allAnuncios} totalSpend={totalSpend} t={t} />
        </>
      )}
    </div>
  )
}

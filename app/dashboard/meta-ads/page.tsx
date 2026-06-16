'use client'

import { useEffect, useRef, useState } from 'react'
import type { MetaAccountData, MetaCampaignData, MetaAdSetData, MetaAdData, MetaDailyPoint } from '@/app/api/meta-ads/route'

type Theme = 'dark' | 'light'
type Preset = 'personalizado' | 'mes-atual' | 'mes-passado' | 'ultimos-7' | 'ultimos-14' | 'ultimos-30' | 'ytd-2026'
type StatusTab = 'todas' | 'ativo' | 'pausado'
type NivelMeta = 'campanhas' | 'conjuntos' | 'anuncios'
type ObjetivoTab = 'todos' | 'reconhecimento' | 'engajamento' | 'trafego'

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
    nivelBg: '#141414',
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
    nivelBg: '#f8f9fa',
  },
}

// Colors for KPI tiles (matching old dashboard gradient palette)
const TILE_COLORS = [
  '#4dabf7', // Investimento — blue
  '#c77dff', // Impressões — purple
  '#56cfe1', // Alcance — teal
  '#74c69d', // Cliques — green
  '#ffd166', // CTR — yellow
  '#ff9f1c', // CPM — orange
  '#f72585', // CPC — pink
  '#4cc9f0', // Frequência — cyan
  '#f59e0b', // Thruplays — amber
  '#a855f7', // CPV — violet
]

const PRESETS: { key: Preset; label: string }[] = [
  { key: 'personalizado', label: 'Personalizado' },
  { key: 'mes-atual', label: 'Este mês' },
  { key: 'mes-passado', label: 'Mês passado' },
  { key: 'ultimos-7', label: 'Últimos 7 dias' },
  { key: 'ultimos-14', label: 'Últimos 14 dias' },
  { key: 'ultimos-30', label: 'Últimos 30 dias' },
  { key: 'ytd-2026', label: '2026 (YTD)' },
]

const NIVEL_TABS: { key: NivelMeta; label: string }[] = [
  { key: 'campanhas', label: 'Campanhas' },
  { key: 'conjuntos', label: 'Conjuntos de Anúncios' },
  { key: 'anuncios', label: 'Anúncios' },
]

const OBJETIVO_TABS: { key: ObjetivoTab; label: string }[] = [
  { key: 'todos', label: 'Todos' },
  { key: 'reconhecimento', label: 'Reconhecimento/Alcance' },
  { key: 'engajamento', label: 'Engajamento/Vídeo' },
  { key: 'trafego', label: 'Tráfego/Conversão' },
]

function classifyObjetivo(nome: string): ObjetivoTab {
  const n = nome.toUpperCase()
  if (n.includes('RECONHEC') || n.includes('ALCANCE') || n.includes('AWARENESS') || n.includes('BRAND') || n.includes('[CPM]')) return 'reconhecimento'
  if (n.includes('ENGAJAMENTO') || n.includes('ENGAJ') || n.includes('VIDEO') || n.includes('VÍDEO') || n.includes('VIEWS') || n.includes('BUMPER') || n.includes('IN-STREAM') || n.includes('YOUTUBE') || n.includes('[CPV]')) return 'engajamento'
  if (n.includes('TRÁFEGO') || n.includes('TRAFEGO') || n.includes('CONVERS') || n.includes('LEAD') || n.includes('CLICK') || n.includes('CLIQUE') || n.includes('[CPA]') || n.includes('[CPC]')) return 'trafego'
  return 'reconhecimento'
}

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
function fmtBRL(n: number) { return 'R$ ' + n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }
function fmtPct(n: number) { return n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '%' }

// ─── Period Dropdown ───────────────────────────────────────────────────────────
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

// ─── Trend Chart (multi-select) ───────────────────────────────────────────────
type MetaBarMetric = 'spend' | 'impressions' | 'clicks' | 'reach' | 'thruplays'
type MetaLineMetric = 'cpm' | 'ctr' | 'cpv' | 'cpc' | 'frequency'

const META_BAR_OPTIONS: { key: MetaBarMetric; label: string; color: string }[] = [
  { key: 'spend',      label: 'Investimento', color: '#1A3CFF' },
  { key: 'impressions',label: 'Impressões',   color: '#c77dff' },
  { key: 'clicks',     label: 'Cliques',      color: '#22c55e' },
  { key: 'reach',      label: 'Alcance',      color: '#56cfe1' },
  { key: 'thruplays',  label: 'Thruplays',    color: '#f59e0b' },
]
const META_LINE_OPTIONS: { key: MetaLineMetric; label: string; color: string }[] = [
  { key: 'cpm',       label: 'CPM',       color: '#ff9f1c' },
  { key: 'ctr',       label: 'CTR',       color: '#56cfe1' },
  { key: 'cpv',       label: 'CPV',       color: '#a855f7' },
  { key: 'cpc',       label: 'CPC',       color: '#74c69d' },
  { key: 'frequency', label: 'Frequência',color: '#ffd166' },
]

function fmtMetaBarVal(v: number, metric: MetaBarMetric): string {
  if (metric === 'spend') return `R$${v >= 1000 ? (v / 1000).toFixed(0) + 'k' : v.toFixed(0)}`
  if (v >= 1_000_000) return (v / 1_000_000).toFixed(1) + 'M'
  if (v >= 1_000) return (v / 1_000).toFixed(0) + 'k'
  return String(Math.round(v))
}
function fmtMetaLineVal(v: number, metric: MetaLineMetric): string {
  if (metric === 'ctr') return `${v.toFixed(2)}%`
  if (metric === 'frequency') return v.toFixed(2)
  return `R$${v.toFixed(2)}`
}

function TrendChart({ serie, theme }: { serie: MetaDailyPoint[]; theme: Theme }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const chartRef = useRef<any>(null)
  const [barMetrics, setBarMetrics] = useState<MetaBarMetric[]>(['spend'])
  const [lineMetrics, setLineMetrics] = useState<MetaLineMetric[]>(['cpm'])
  const t = C[theme]

  function toggleBar(key: MetaBarMetric) {
    setBarMetrics(prev => prev.includes(key)
      ? (prev.length > 1 ? prev.filter(k => k !== key) : prev)
      : [...prev, key])
  }
  function toggleLine(key: MetaLineMetric) {
    setLineMetrics(prev => prev.includes(key)
      ? (prev.length > 1 ? prev.filter(k => k !== key) : prev)
      : [...prev, key])
  }

  const barLabels = barMetrics.map(k => META_BAR_OPTIONS.find(o => o.key === k)!.label)
  const lineLabels = lineMetrics.map(k => META_LINE_OPTIONS.find(o => o.key === k)!.label)
  const title = `TENDÊNCIA — ${barLabels.join(' E ').toUpperCase()} VS ${lineLabels.join(' E ').toUpperCase()}`
  const primaryBar = META_BAR_OPTIONS.find(o => o.key === barMetrics[0])!
  const primaryLine = META_LINE_OPTIONS.find(o => o.key === lineMetrics[0])!

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
        const opt = META_BAR_OPTIONS.find(o => o.key === k)!
        return { type: 'bar' as const, label: opt.label, data: allBarData[i], backgroundColor: opt.color + '99', borderColor: opt.color, borderWidth: 1, borderRadius: 3, yAxisID: `yBar${i}` }
      })
      const lineDatasets = lineMetrics.map(k => {
        const opt = META_LINE_OPTIONS.find(o => o.key === k)!
        return { type: 'line' as const, label: opt.label, data: serie.map(p => (p[k] as number) ?? 0), borderColor: opt.color, backgroundColor: opt.color + '22', borderWidth: 2, pointRadius: serie.length > 30 ? 0 : 3, pointBackgroundColor: opt.color, tension: 0.3, yAxisID: 'yLine' }
      })

      // Eixo independente por barra — evita que métricas com escalas diferentes se ofusquem
      const barScales: Record<string, any> = {}
      barMetrics.forEach((k, i) => {
        const opt = META_BAR_OPTIONS.find(o => o.key === k)!
        const maxVal = Math.max(...allBarData[i], 1)
        barScales[`yBar${i}`] = {
          type: 'linear', position: 'left', display: i === 0,
          max: maxVal * 1.15,
          grid: { color: i === 0 ? t.borderInner : 'transparent' },
          ticks: { color: opt.color, font: { size: 10 }, callback: (v: any) => fmtMetaBarVal(Number(v), k) },
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
                  const isBar = ctx.dataset.type === 'bar'
                  const key = isBar ? barMetrics[ctx.datasetIndex] : lineMetrics[ctx.datasetIndex - barMetrics.length]
                  if (isBar) return `  ${ctx.dataset.label}: ${fmtMetaBarVal(ctx.raw, key as MetaBarMetric)}`
                  return `  ${ctx.dataset.label}: ${fmtMetaLineVal(ctx.raw, key as MetaLineMetric)}`
                },
              },
            },
          },
          scales: {
            x: { ticks: { color: t.textMuted, font: { size: 10 }, maxTicksLimit: serie.length > 30 ? 8 : 15 }, grid: { color: t.borderInner } },
            ...barScales,
            yLine: { type: 'linear' as const, position: 'right' as const, ticks: { color: primaryLine.color, font: { size: 10 }, callback: (v: any) => fmtMetaLineVal(Number(v), lineMetrics[0]) }, grid: { drawOnChartArea: false } },
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
          {META_BAR_OPTIONS.map(o => (
            <button key={o.key} onClick={() => toggleBar(o.key)} style={btnStyle(barMetrics.includes(o.key), o.color)}>{o.label}</button>
          ))}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 10, color: t.textMuted, marginRight: 4 }}>Linha:</span>
          {META_LINE_OPTIONS.map(o => (
            <button key={o.key} onClick={() => toggleLine(o.key)} style={btnStyle(lineMetrics.includes(o.key), o.color)}>{o.label}</button>
          ))}
        </div>
      </div>
      <div style={{ height: 260 }}><canvas ref={canvasRef} /></div>
    </div>
  )
}

// ─── KPI Tile ─────────────────────────────────────────────────────────────────
function KpiTile({ label, value, note, color, t }: { label: string; value: string; note?: string; color: string; t: typeof C['dark'] }) {
  return (
    <div style={{ background: t.kpiBg, border: `1px solid ${t.kpiBorder}`, borderRadius: 10, padding: '14px 16px', borderTop: `3px solid ${color}` }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: t.textMuted, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 700, color: t.textPrimary, lineHeight: 1.2 }}>{value}</div>
      {note && <div style={{ fontSize: 10, color: t.textMuted, marginTop: 4 }}>{note}</div>}
    </div>
  )
}

// ─── Account Card ─────────────────────────────────────────────────────────────
function AccountCard({ acc, totalSpend, t }: { acc: MetaAccountData; totalSpend: number; t: typeof C['dark'] }) {
  const [open, setOpen] = useState(true)
  const sharePct = totalSpend > 0 ? (acc.spend / totalSpend) * 100 : 0
  return (
    <div style={{ border: `1px solid ${t.border}`, borderRadius: 10, overflow: 'hidden', background: t.card }}>
      <button onClick={() => setOpen(o => !o)} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', padding: '14px 16px', background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: t.textPrimary }}>{acc.nome}</span>
          <span style={{ fontSize: 11, padding: '2px 9px', borderRadius: 20, background: '#1A3CFF18', color: '#7ba3ff', border: '1px solid #1A3CFF33' }}>{fmtBRL(acc.spend)}</span>
          {acc.moeda !== 'BRL' && <span style={{ fontSize: 10, padding: '1px 7px', borderRadius: 20, background: '#f59e0b18', color: '#f59e0b', border: '1px solid #f59e0b33' }}>{acc.moeda}</span>}
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

// ─── Meta Data Table ───────────────────────────────────────────────────────────
function MetaDataTable({ campanhas, adsets, ads, totalSpend, t }: {
  campanhas: MetaCampaignData[]
  adsets: MetaAdSetData[]
  ads: MetaAdData[]
  totalSpend: number
  t: typeof C['dark']
}) {
  const [nivel, setNivel] = useState<NivelMeta>('campanhas')
  const [objetivoTab, setObjetivoTab] = useState<ObjetivoTab>('todos')
  const [statusTab, setStatusTab] = useState<StatusTab>('todas')
  const [busca, setBusca] = useState('')

  const filteredCampanhas = campanhas.filter(c => {
    if (statusTab !== 'todas' && c.status !== statusTab) return false
    if (objetivoTab !== 'todos' && classifyObjetivo(c.nome) !== objetivoTab) return false
    if (busca && !c.nome.toLowerCase().includes(busca.toLowerCase())) return false
    return true
  })

  const filteredAdsets = adsets.filter(c => {
    if (statusTab !== 'todas' && c.status !== statusTab) return false
    if (busca && !c.nome.toLowerCase().includes(busca.toLowerCase()) && !c.campanha.toLowerCase().includes(busca.toLowerCase())) return false
    return true
  })

  const filteredAds = ads.filter(c => {
    if (statusTab !== 'todas' && c.status !== statusTab) return false
    if (busca && !c.nome.toLowerCase().includes(busca.toLowerCase()) && !c.campanha.toLowerCase().includes(busca.toLowerCase())) return false
    return true
  })

  const chip = (active: boolean, small?: boolean): React.CSSProperties => ({
    padding: small ? '3px 10px' : '4px 12px', borderRadius: 20,
    fontSize: small ? 11 : 12, fontWeight: 600,
    cursor: 'pointer', border: 'none', transition: 'all 0.15s',
    background: active ? '#1A3CFF' : t.chipBg, color: active ? '#fff' : t.chipText,
  })

  const thS: React.CSSProperties = {
    padding: '9px 12px', fontSize: 10, fontWeight: 700, color: t.textMuted,
    textTransform: 'uppercase', letterSpacing: 0.8, textAlign: 'left',
    borderBottom: `1px solid ${t.tableBorder}`, whiteSpace: 'nowrap',
  }
  const tdS: React.CSSProperties = {
    padding: '10px 12px', fontSize: 13, color: t.textSecondary,
    borderBottom: `1px solid ${t.tableBorder}`, verticalAlign: 'middle',
  }

  return (
    <div style={{ background: t.card, border: `1px solid ${t.border}`, borderRadius: 12 }}>
      {/* Level tabs — Campanhas / Conjuntos / Anúncios */}
      <div style={{ display: 'flex', gap: 0, borderBottom: `1px solid ${t.border}`, padding: '0 16px' }}>
        {NIVEL_TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => { setNivel(tab.key); setBusca('') }}
            style={{
              padding: '12px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
              border: 'none', background: 'transparent',
              color: nivel === tab.key ? '#4dabf7' : t.textMuted,
              borderBottom: nivel === tab.key ? '2px solid #4dabf7' : '2px solid transparent',
              marginBottom: -1, transition: 'all 0.15s',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Objetivo filter — only for Campanhas */}
      {nivel === 'campanhas' && (
        <div style={{ padding: '10px 16px 8px', borderBottom: `1px solid ${t.tableBorder}`, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: t.textMuted, textTransform: 'uppercase', letterSpacing: 0.8, marginRight: 4 }}>OBJETIVO</span>
          {OBJETIVO_TABS.map(o => (
            <button key={o.key} onClick={() => setObjetivoTab(o.key)} style={chip(objetivoTab === o.key, true)}>{o.label}</button>
          ))}
        </div>
      )}

      {/* Status + search */}
      <div style={{ padding: '10px 16px', borderBottom: `1px solid ${t.tableBorder}`, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: t.textMuted, textTransform: 'uppercase', letterSpacing: 0.8, marginRight: 4 }}>STATUS</span>
          {(['todas', 'ativo', 'pausado'] as StatusTab[]).map(s => (
            <button key={s} onClick={() => setStatusTab(s)} style={chip(statusTab === s, true)}>
              {s === 'todas' ? 'Todas' : s === 'ativo' ? 'Ativas' : 'Pausadas'}
            </button>
          ))}
        </div>
        <div style={{ flex: 1 }} />
        <input
          placeholder="Filtrar por nome..."
          value={busca}
          onChange={e => setBusca(e.target.value)}
          style={{ background: t.inputBg, border: `1px solid ${t.inputBorder}`, color: t.inputText, borderRadius: 8, padding: '5px 12px', fontSize: 13, outline: 'none', width: 200 }}
        />
      </div>

      {/* Table */}
      <div style={{ overflowX: 'auto' }}>
        {nivel === 'campanhas' && (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ ...thS, minWidth: 240 }}>CAMPANHA</th>
                <th style={{ ...thS, textAlign: 'right' }}>INVEST.</th>
                <th style={{ ...thS, textAlign: 'right' }}>IMPR.</th>
                <th style={{ ...thS, textAlign: 'right' }}>ALCANCE</th>
                <th style={{ ...thS, textAlign: 'right' }}>CLIQUES</th>
                <th style={{ ...thS, textAlign: 'right' }}>CTR</th>
                <th style={{ ...thS, textAlign: 'right' }}>CPM</th>
                <th style={{ ...thS, textAlign: 'right' }}>CPC</th>
                <th style={{ ...thS, textAlign: 'right' }}>THRUPLAYS</th>
                <th style={{ ...thS, textAlign: 'right' }}>FREQ.</th>
              </tr>
            </thead>
            <tbody>
              {filteredCampanhas.length === 0 ? (
                <tr><td colSpan={10} style={{ ...tdS, textAlign: 'center', color: t.textMuted, padding: 28 }}>Nenhuma campanha encontrada</td></tr>
              ) : filteredCampanhas.map(c => {
                const share = totalSpend > 0 ? (c.spend / totalSpend) * 100 : 0
                const obj = classifyObjetivo(c.nome)
                const objColor = obj === 'reconhecimento' ? '#56cfe1' : obj === 'engajamento' ? '#f59e0b' : '#74c69d'
                return (
                  <tr key={c.id} onMouseEnter={e => (e.currentTarget.style.background = t.tableHover)} onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                    <td style={tdS}>
                      <div style={{ fontWeight: 600, color: t.textPrimary, marginBottom: 3 }}>{c.nome}</div>
                      <div style={{ display: 'flex', gap: 4, marginBottom: share > 0 ? 5 : 0 }}>
                        <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 4, background: objColor + '22', color: objColor, fontWeight: 600 }}>
                          {obj === 'reconhecimento' ? 'Reconhecimento' : obj === 'engajamento' ? 'Engajamento' : 'Tráfego'}
                        </span>
                        <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 4, background: c.status === 'ativo' ? '#22c55e22' : '#f59e0b22', color: c.status === 'ativo' ? '#22c55e' : '#f59e0b', fontWeight: 600 }}>
                          {c.status === 'ativo' ? 'Ativa' : 'Pausada'}
                        </span>
                      </div>
                      {share > 0 && <div style={{ height: 2, background: t.barTrack, borderRadius: 2 }}><div style={{ width: `${Math.min(100, share)}%`, height: '100%', background: '#1A3CFF', borderRadius: 2 }} /></div>}
                    </td>
                    <td style={{ ...tdS, textAlign: 'right', color: '#60a5fa', fontWeight: 600 }}>{fmtBRL(c.spend)}</td>
                    <td style={{ ...tdS, textAlign: 'right' }}>{fmtNum(c.impressions)}</td>
                    <td style={{ ...tdS, textAlign: 'right' }}>{c.reach > 0 ? fmtNum(c.reach) : '—'}</td>
                    <td style={{ ...tdS, textAlign: 'right' }}>{fmtNum(c.clicks)}</td>
                    <td style={{ ...tdS, textAlign: 'right' }}>{fmtPct(c.ctr)}</td>
                    <td style={{ ...tdS, textAlign: 'right' }}>{fmtBRL(c.cpm)}</td>
                    <td style={{ ...tdS, textAlign: 'right' }}>{c.cpc > 0 ? fmtBRL(c.cpc) : '—'}</td>
                    <td style={{ ...tdS, textAlign: 'right' }}>{c.thruplays > 0 ? fmtNum(c.thruplays) : '—'}</td>
                    <td style={{ ...tdS, textAlign: 'right' }}>{c.frequency > 0 ? c.frequency.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}

        {nivel === 'conjuntos' && (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ ...thS, minWidth: 200 }}>CONJUNTO DE ANÚNCIOS</th>
                <th style={{ ...thS, minWidth: 160 }}>CAMPANHA</th>
                <th style={{ ...thS, textAlign: 'right' }}>INVEST.</th>
                <th style={{ ...thS, textAlign: 'right' }}>IMPR.</th>
                <th style={{ ...thS, textAlign: 'right' }}>ALCANCE</th>
                <th style={{ ...thS, textAlign: 'right' }}>CLIQUES</th>
                <th style={{ ...thS, textAlign: 'right' }}>CTR</th>
                <th style={{ ...thS, textAlign: 'right' }}>CPM</th>
                <th style={{ ...thS, textAlign: 'right' }}>CPC</th>
                <th style={{ ...thS, textAlign: 'right' }}>THRUPLAYS</th>
                <th style={{ ...thS, textAlign: 'right' }}>FREQ.</th>
              </tr>
            </thead>
            <tbody>
              {filteredAdsets.length === 0 ? (
                <tr><td colSpan={11} style={{ ...tdS, textAlign: 'center', color: t.textMuted, padding: 28 }}>Nenhum conjunto encontrado</td></tr>
              ) : filteredAdsets.map(c => {
                const share = totalSpend > 0 ? (c.spend / totalSpend) * 100 : 0
                return (
                  <tr key={c.id} onMouseEnter={e => (e.currentTarget.style.background = t.tableHover)} onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                    <td style={tdS}>
                      <div style={{ fontWeight: 600, color: t.textPrimary, marginBottom: 3 }}>{c.nome}</div>
                      <div style={{ marginBottom: share > 0 ? 5 : 0 }}>
                        <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 4, background: c.status === 'ativo' ? '#22c55e22' : '#f59e0b22', color: c.status === 'ativo' ? '#22c55e' : '#f59e0b', fontWeight: 600 }}>
                          {c.status === 'ativo' ? 'Ativo' : 'Pausado'}
                        </span>
                      </div>
                      {share > 0 && <div style={{ height: 2, background: t.barTrack, borderRadius: 2 }}><div style={{ width: `${Math.min(100, share)}%`, height: '100%', background: '#1A3CFF', borderRadius: 2 }} /></div>}
                    </td>
                    <td style={{ ...tdS, fontSize: 11, color: t.textMuted }}>{c.campanha}</td>
                    <td style={{ ...tdS, textAlign: 'right', color: '#60a5fa', fontWeight: 600 }}>{fmtBRL(c.spend)}</td>
                    <td style={{ ...tdS, textAlign: 'right' }}>{fmtNum(c.impressions)}</td>
                    <td style={{ ...tdS, textAlign: 'right' }}>{c.reach > 0 ? fmtNum(c.reach) : '—'}</td>
                    <td style={{ ...tdS, textAlign: 'right' }}>{fmtNum(c.clicks)}</td>
                    <td style={{ ...tdS, textAlign: 'right' }}>{fmtPct(c.ctr)}</td>
                    <td style={{ ...tdS, textAlign: 'right' }}>{fmtBRL(c.cpm)}</td>
                    <td style={{ ...tdS, textAlign: 'right' }}>{c.cpc > 0 ? fmtBRL(c.cpc) : '—'}</td>
                    <td style={{ ...tdS, textAlign: 'right' }}>{c.thruplays > 0 ? fmtNum(c.thruplays) : '—'}</td>
                    <td style={{ ...tdS, textAlign: 'right' }}>{c.frequency > 0 ? c.frequency.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}

        {nivel === 'anuncios' && (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ ...thS, minWidth: 200 }}>ANÚNCIO</th>
                <th style={{ ...thS, minWidth: 160 }}>CONJUNTO</th>
                <th style={{ ...thS, textAlign: 'right' }}>INVEST.</th>
                <th style={{ ...thS, textAlign: 'right' }}>IMPR.</th>
                <th style={{ ...thS, textAlign: 'right' }}>CLIQUES</th>
                <th style={{ ...thS, textAlign: 'right' }}>CTR</th>
                <th style={{ ...thS, textAlign: 'right' }}>CPM</th>
                <th style={{ ...thS, textAlign: 'right' }}>CPC</th>
              </tr>
            </thead>
            <tbody>
              {filteredAds.length === 0 ? (
                <tr><td colSpan={8} style={{ ...tdS, textAlign: 'center', color: t.textMuted, padding: 28 }}>Nenhum anúncio encontrado</td></tr>
              ) : filteredAds.map(c => {
                const share = totalSpend > 0 ? (c.spend / totalSpend) * 100 : 0
                return (
                  <tr key={c.id} onMouseEnter={e => (e.currentTarget.style.background = t.tableHover)} onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                    <td style={tdS}>
                      <div style={{ fontWeight: 600, color: t.textPrimary, marginBottom: 3 }}>{c.nome}</div>
                      <div style={{ marginBottom: share > 0 ? 5 : 0 }}>
                        <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 4, background: c.status === 'ativo' ? '#22c55e22' : '#f59e0b22', color: c.status === 'ativo' ? '#22c55e' : '#f59e0b', fontWeight: 600 }}>
                          {c.status === 'ativo' ? 'Ativo' : 'Pausado'}
                        </span>
                      </div>
                      {share > 0 && <div style={{ height: 2, background: t.barTrack, borderRadius: 2 }}><div style={{ width: `${Math.min(100, share)}%`, height: '100%', background: '#1A3CFF', borderRadius: 2 }} /></div>}
                    </td>
                    <td style={{ ...tdS, fontSize: 11, color: t.textMuted }}>{c.adset}</td>
                    <td style={{ ...tdS, textAlign: 'right', color: '#60a5fa', fontWeight: 600 }}>{fmtBRL(c.spend)}</td>
                    <td style={{ ...tdS, textAlign: 'right' }}>{fmtNum(c.impressions)}</td>
                    <td style={{ ...tdS, textAlign: 'right' }}>{fmtNum(c.clicks)}</td>
                    <td style={{ ...tdS, textAlign: 'right' }}>{fmtPct(c.ctr)}</td>
                    <td style={{ ...tdS, textAlign: 'right' }}>{fmtBRL(c.cpm)}</td>
                    <td style={{ ...tdS, textAlign: 'right' }}>{c.cpc > 0 ? fmtBRL(c.cpc) : '—'}</td>
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

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function MetaAdsPage({ theme = 'dark' }: { theme?: Theme }) {
  const [data, setData] = useState<MetaAccountData[] | null>(null)
  const [nomes, setNomes] = useState<string[]>([])
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

  function fetchData(p: { start: string; end: string }) {
    setLoading(true); setError('')
    fetch(`/api/meta-ads?start=${p.start}&end=${p.end}`)
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
    periodoRef.current = p; setPreset(newPreset); setCustom(newCustom); setFiltroCliente(''); fetchData(p)
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
        fetch(`/api/meta-ads?start=${cur.start}&end=${cur.end}`).then(r => r.json()).then(res => {
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
  const selectedAccount = filtroCliente ? filtrado[0] : null

  const totalSpend = filtrado.reduce((s, a) => s + a.spend, 0)
  const totalImpressions = filtrado.reduce((s, a) => s + a.impressions, 0)
  const totalClicks = filtrado.reduce((s, a) => s + a.clicks, 0)
  const totalThruplays = filtrado.reduce((s, a) => s + a.thruplays, 0)
  const ctrMedio = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0
  const cpmMedio = totalSpend > 0 && totalImpressions > 0 ? (totalSpend / totalImpressions) * 1000 : 0
  const cpcMedio = totalClicks > 0 ? totalSpend / totalClicks : 0
  const freqMedio = selectedAccount
    ? selectedAccount.frequency
    : filtrado.length > 0 ? filtrado.reduce((s, a) => s + a.frequency, 0) / filtrado.length : 0

  const allCampanhas = selectedAccount
    ? selectedAccount.campanhas
    : filtrado.flatMap(a => a.campanhas).sort((a, b) => b.spend - a.spend)

  const allAdsets = selectedAccount
    ? selectedAccount.adsets
    : filtrado.flatMap(a => a.adsets).sort((a, b) => b.spend - a.spend)

  const allAds = selectedAccount
    ? selectedAccount.ads
    : filtrado.flatMap(a => a.ads).sort((a, b) => b.spend - a.spend)

  const mergedSerie: MetaDailyPoint[] = (() => {
    if (selectedAccount) return selectedAccount.serie ?? []
    const dateMap = new Map<string, { spend: number; impressions: number; reach: number; clicks: number; cpm: number; frequency: number; thruplays: number; count: number }>()
    for (const acc of filtrado) {
      for (const pt of (acc.serie ?? [])) {
        const ex = dateMap.get(pt.date) ?? { spend: 0, impressions: 0, reach: 0, clicks: 0, cpm: 0, frequency: 0, thruplays: 0, count: 0 }
        dateMap.set(pt.date, { spend: ex.spend + pt.spend, impressions: ex.impressions + pt.impressions, reach: ex.reach + pt.reach, clicks: ex.clicks + pt.clicks, cpm: ex.cpm + pt.cpm, frequency: ex.frequency + pt.frequency, thruplays: ex.thruplays + pt.thruplays, count: ex.count + 1 })
      }
    }
    return Array.from(dateMap.entries()).sort(([a], [b]) => a.localeCompare(b))
      .map(([date, d]) => {
        const ctr = d.impressions > 0 ? (d.clicks / d.impressions) * 100 : 0
        const cpc = d.clicks > 0 ? d.spend / d.clicks : 0
        const cpv = d.thruplays > 0 ? d.spend / d.thruplays : 0
        return { date, spend: d.spend, impressions: d.impressions, reach: d.reach, clicks: d.clicks, cpm: d.count > 0 ? d.cpm / d.count : 0, ctr, cpc, frequency: d.count > 0 ? d.frequency / d.count : 0, thruplays: d.thruplays, cpv }
      })
  })()

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
          {/* KPI tiles with colored top borders */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10, marginBottom: 20 }}>
            <KpiTile label="Investimento" value={fmtBRL(totalSpend)} color={TILE_COLORS[0]} t={t} />
            <KpiTile label="Impressões" value={fmtNum(totalImpressions)} color={TILE_COLORS[1]} t={t} />
            <KpiTile
              label="Alcance"
              value={selectedAccount ? fmtNum(selectedAccount.reach) : '—'}
              note={!selectedAccount ? 'Selecione uma conta' : undefined}
              color={TILE_COLORS[2]}
              t={t}
            />
            <KpiTile label="Cliques" value={fmtNum(totalClicks)} color={TILE_COLORS[3]} t={t} />
            <KpiTile label="CTR Médio" value={fmtPct(ctrMedio)} color={TILE_COLORS[4]} t={t} />
            <KpiTile label="CPM Médio" value={fmtBRL(cpmMedio)} color={TILE_COLORS[5]} t={t} />
            <KpiTile label="CPC Médio" value={cpcMedio > 0 ? fmtBRL(cpcMedio) : '—'} color={TILE_COLORS[6]} t={t} />
            <KpiTile
              label="Frequência"
              value={freqMedio > 0 ? freqMedio.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—'}
              note={!selectedAccount && filtrado.length > 1 ? 'média entre contas' : undefined}
              color={TILE_COLORS[7]}
              t={t}
            />
            <KpiTile
              label="Thruplays"
              value={totalThruplays > 0 ? fmtNum(totalThruplays) : '—'}
              color={TILE_COLORS[8]}
              t={t}
            />
            <KpiTile
              label="CPV"
              value={totalThruplays > 0 ? fmtBRL(totalSpend / totalThruplays) : '—'}
              note="Custo por Thruplay"
              color={TILE_COLORS[9]}
              t={t}
            />
          </div>

          {/* Trend chart */}
          {mergedSerie.length > 1 && <TrendChart serie={mergedSerie} theme={theme} />}

          {/* Account cards when all accounts */}
          {!filtroCliente && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24 }}>
              {filtrado.map(acc => <AccountCard key={acc.id} acc={acc} totalSpend={totalSpend} t={t} />)}
            </div>
          )}

          {/* Data table with Campanhas / Conjuntos / Anúncios */}
          <MetaDataTable
            campanhas={allCampanhas}
            adsets={allAdsets}
            ads={allAds}
            totalSpend={totalSpend}
            t={t}
          />
        </>
      )}
    </div>
  )
}

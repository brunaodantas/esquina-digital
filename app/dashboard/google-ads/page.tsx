'use client'

import { useEffect, useRef, useState } from 'react'
import type { AccountData, CampaignData, DailyPoint } from '@/app/api/google-ads/route'

type Theme = 'dark' | 'light'
type Preset = 'personalizado' | 'mes-atual' | 'mes-passado' | 'ultimos-7' | 'ultimos-14' | 'ultimos-30' | 'ytd-2026'
type TipoTab = 'todas' | 'pesquisa' | 'display' | 'pmax' | 'video' | 'outros'
type StatusTab = 'todas' | 'ativo' | 'pausado'

const C = {
  dark: {
    page: '#111111', card: '#1a1a1a', cardInner: '#111',
    border: '#2a2a2a', borderInner: '#222',
    textPrimary: '#fff', textSecondary: '#ddd', textMuted: '#555',
    barTrack: '#2a2a2a', spinner: '#2a2a2a',
    filtroBtn: '#2a2a2a', filtroBtnText: '#888',
    emptyText: '#555', chevron: '#555',
    dropBg: '#1e1e1e', dropBorder: '#2a2a2a',
    dropText: '#bbb', dropActive: '#ffffff',
    dropHover: '#ffffff12',
    inputBg: '#111', inputBorder: '#333', inputText: '#ccc',
    selectBg: '#1e1e1e', selectBorder: '#333', selectText: '#ccc',
    kpiBg: '#161616', kpiBorder: '#222',
    tabActive: '#1A3CFF1A', tableBorder: '#1e1e1e',
    tableHover: '#ffffff06',
    chipBg: '#222', chipActive: '#1A3CFF',
  },
  light: {
    page: '#f0f2f5', card: '#ffffff', cardInner: '#f8f8f8',
    border: '#e8e8e8', borderInner: '#eeeeee',
    textPrimary: '#111', textSecondary: '#333', textMuted: '#999',
    barTrack: '#e8e8e8', spinner: '#e0e0e0',
    filtroBtn: '#e8e8e8', filtroBtnText: '#666',
    emptyText: '#aaa', chevron: '#bbb',
    dropBg: '#ffffff', dropBorder: '#e0e0e0',
    dropText: '#555', dropActive: '#111',
    dropHover: '#00000008',
    inputBg: '#f8f8f8', inputBorder: '#e0e0e0', inputText: '#333',
    selectBg: '#f8f8f8', selectBorder: '#e0e0e0', selectText: '#333',
    kpiBg: '#ffffff', kpiBorder: '#e8e8e8',
    tabActive: '#1A3CFF12', tableBorder: '#f0f0f0',
    tableHover: '#00000004',
    chipBg: '#e8e8e8', chipActive: '#1A3CFF',
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
  { key: 'todas', label: 'Todas' },
  { key: 'pesquisa', label: 'Pesquisa' },
  { key: 'display', label: 'Display' },
  { key: 'pmax', label: 'Perf. Max' },
  { key: 'video', label: 'Vídeo' },
  { key: 'outros', label: 'Outros' },
]

function fmtDate(d: Date) { return d.toISOString().slice(0, 10) }

function getPeriodo(preset: Preset, custom?: { start: string; end: string }): { start: string; end: string; label: string } {
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0)
  if (preset === 'personalizado' && custom?.start && custom?.end) {
    const [sy, sm, sd] = custom.start.split('-')
    const [ey, em, ed] = custom.end.split('-')
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

function fmtNum(n: number): string {
  if (n === 0) return '0'
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace('.', ',') + 'M'
  if (n >= 1_000) return (n / 1_000).toFixed(1).replace('.', ',') + 'k'
  return n.toLocaleString('pt-BR')
}
function fmtBRL(n: number): string {
  return 'R$ ' + n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
function fmtPct(n: number): string {
  return n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '%'
}
function fmtDateLabel(iso: string): string {
  const [, m, d] = iso.split('-')
  return `${d}/${m}`
}

// ─── Period Dropdown ──────────────────────────────────────────────────────────
function PeriodoDropdown({ preset, custom, t, onApply }: {
  preset: Preset; custom: { start: string; end: string }; t: typeof C['dark']
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
  function abrir() { setTempPreset(preset); setTempCustom(custom); setAberto(true) }

  const inputStyle: React.CSSProperties = {
    background: t.inputBg, border: `1px solid ${t.inputBorder}`, color: t.inputText,
    borderRadius: 6, padding: '6px 10px', fontSize: 13, width: '100%', outline: 'none', colorScheme: 'dark',
  }

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <button onClick={aberto ? () => setAberto(false) : abrir} style={{
        display: 'inline-flex', alignItems: 'center', gap: 8,
        padding: '6px 14px', borderRadius: 8, fontSize: 13, fontWeight: 500,
        background: t.filtroBtn, border: `1px solid ${t.border}`, color: t.textSecondary, cursor: 'pointer',
      }}>
        📅 {label} <span style={{ fontSize: 10, color: t.textMuted }}>▼</span>
      </button>
      {aberto && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 998 }} onClick={() => setAberto(false)} />
          <div style={{
            position: 'absolute', top: 'calc(100% + 8px)', left: 0, zIndex: 999,
            background: t.dropBg, border: `1px solid ${t.dropBorder}`,
            borderRadius: 12, padding: 16, minWidth: 380, boxShadow: '0 8px 32px rgba(0,0,0,0.35)',
          }}>
            <div style={{ display: 'flex', gap: 20 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 160 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: t.textMuted, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 }}>PERÍODOS</div>
                {PRESETS.map(p => (
                  <div key={p.key} onClick={() => setTempPreset(p.key)} style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '7px 10px', borderRadius: 7, cursor: 'pointer',
                    background: tempPreset === p.key ? '#1A3CFF1A' : 'transparent',
                  }}>
                    <div style={{
                      width: 12, height: 12, borderRadius: '50%', flexShrink: 0,
                      border: `2px solid ${tempPreset === p.key ? '#1A3CFF' : t.textMuted}`,
                      background: tempPreset === p.key ? '#1A3CFF' : 'transparent',
                    }} />
                    <span style={{ fontSize: 13, color: tempPreset === p.key ? t.dropActive : t.dropText }}>{p.label}</span>
                  </div>
                ))}
              </div>
              {tempPreset === 'personalizado' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12, flex: 1, paddingTop: 28 }}>
                  <div>
                    <div style={{ fontSize: 11, color: t.textMuted, marginBottom: 5 }}>Data inicial</div>
                    <input type="date" value={tempCustom.start} onChange={e => setTempCustom(c => ({ ...c, start: e.target.value }))} style={inputStyle} />
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: t.textMuted, marginBottom: 5 }}>Data final</div>
                    <input type="date" value={tempCustom.end} onChange={e => setTempCustom(c => ({ ...c, end: e.target.value }))} style={inputStyle} />
                  </div>
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
function KpiTile({ label, value, t }: { label: string; value: string; t: typeof C['dark'] }) {
  return (
    <div style={{ background: t.kpiBg, border: `1px solid ${t.kpiBorder}`, borderRadius: 10, padding: '14px 16px' }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: t.textMuted, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 700, color: t.textPrimary, lineHeight: 1.2 }}>{value}</div>
    </div>
  )
}

// ─── Trend Chart (Chart.js) ────────────────────────────────────────────────────
function TrendChart({ serie, theme }: { serie: DailyPoint[]; theme: Theme }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const chartRef = useRef<any>(null)
  const t = C[theme]

  useEffect(() => {
    if (!canvasRef.current || serie.length === 0) return

    const run = async () => {
      const { Chart, registerables } = await import('chart.js')
      Chart.register(...registerables)

      if (chartRef.current) {
        chartRef.current.destroy()
        chartRef.current = null
      }

      const labels = serie.map(p => fmtDateLabel(p.date))
      const custoData = serie.map(p => p.custo)
      const cpcData = serie.map(p => p.cpcMedio)
      const maxCusto = Math.max(...custoData, 1)

      chartRef.current = new Chart(canvasRef.current!, {
        data: {
          labels,
          datasets: [
            {
              type: 'bar' as const,
              label: 'Investimento',
              data: custoData,
              backgroundColor: '#1A3CFF99',
              borderColor: '#1A3CFF',
              borderWidth: 1,
              borderRadius: 3,
              yAxisID: 'y',
            },
            {
              type: 'line' as const,
              label: 'CPC Médio',
              data: cpcData,
              borderColor: '#f59e0b',
              backgroundColor: '#f59e0b33',
              borderWidth: 2,
              pointRadius: serie.length > 30 ? 0 : 3,
              pointBackgroundColor: '#f59e0b',
              tension: 0.3,
              yAxisID: 'y2',
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          interaction: { mode: 'index', intersect: false },
          plugins: {
            legend: {
              labels: { color: t.textMuted, font: { size: 11 }, boxWidth: 12, padding: 16 },
            },
            tooltip: {
              backgroundColor: t.dropBg,
              titleColor: t.textPrimary,
              bodyColor: t.textSecondary,
              borderColor: t.border,
              borderWidth: 1,
              callbacks: {
                label: (ctx: any) => {
                  if (ctx.datasetIndex === 0) return `  Investimento: ${fmtBRL(ctx.raw)}`
                  return `  CPC Médio: ${fmtBRL(ctx.raw)}`
                },
              },
            },
          },
          scales: {
            x: {
              ticks: {
                color: t.textMuted, font: { size: 10 },
                maxTicksLimit: serie.length > 30 ? 8 : 15,
              },
              grid: { color: t.borderInner },
            },
            y: {
              type: 'linear' as const,
              position: 'left' as const,
              ticks: {
                color: t.textMuted, font: { size: 10 },
                callback: (v: any) => `R$${Number(v) >= 1000 ? (Number(v) / 1000).toFixed(0) + 'k' : Number(v).toFixed(0)}`,
              },
              grid: { color: t.borderInner },
              max: maxCusto * 1.15,
            },
            y2: {
              type: 'linear' as const,
              position: 'right' as const,
              ticks: {
                color: '#f59e0b', font: { size: 10 },
                callback: (v: any) => `R$${Number(v).toFixed(2)}`,
              },
              grid: { drawOnChartArea: false },
            },
          },
        },
      })
    }

    run()
    return () => {
      chartRef.current?.destroy()
      chartRef.current = null
    }
  }, [serie, theme]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div style={{ background: C[theme].card, border: `1px solid ${C[theme].border}`, borderRadius: 12, padding: '16px 20px' }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: C[theme].textMuted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 14 }}>
        TENDÊNCIA — INVESTIMENTO VS CPC MÉDIO
      </div>
      <div style={{ height: 260, position: 'relative' }}>
        {serie.length === 0
          ? <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: C[theme].textMuted, fontSize: 13 }}>Sem dados de série temporal</div>
          : <canvas ref={canvasRef} />
        }
      </div>
    </div>
  )
}

// ─── Campaign Table ────────────────────────────────────────────────────────────
function CampaignTable({ campanhas, totalCusto, t }: { campanhas: CampaignData[]; totalCusto: number; t: typeof C['dark'] }) {
  const [tipoTab, setTipoTab] = useState<TipoTab>('todas')
  const [statusTab, setStatusTab] = useState<StatusTab>('todas')
  const [busca, setBusca] = useState('')

  const filtradas = campanhas.filter(c => {
    if (statusTab === 'ativo' && c.status !== 'ativo') return false
    if (statusTab === 'pausado' && c.status !== 'pausado') return false
    if (tipoTab === 'pesquisa' && c.tipoRaw !== 'SEARCH') return false
    if (tipoTab === 'display' && c.tipoRaw !== 'DISPLAY') return false
    if (tipoTab === 'pmax' && !['MULTI_CHANNEL', 'PERFORMANCE_MAX'].includes(c.tipoRaw)) return false
    if (tipoTab === 'video' && c.tipoRaw !== 'VIDEO') return false
    if (tipoTab === 'outros' && ['SEARCH', 'DISPLAY', 'MULTI_CHANNEL', 'PERFORMANCE_MAX', 'VIDEO'].includes(c.tipoRaw)) return false
    if (busca && !c.nome.toLowerCase().includes(busca.toLowerCase())) return false
    return true
  })

  const chipStyle = (active: boolean): React.CSSProperties => ({
    padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600,
    cursor: 'pointer', border: 'none', transition: 'all 0.15s',
    background: active ? '#1A3CFF' : t.chipBg,
    color: active ? '#fff' : t.textMuted,
  })

  const thStyle: React.CSSProperties = {
    padding: '9px 12px', fontSize: 10, fontWeight: 700, color: t.textMuted,
    textTransform: 'uppercase', letterSpacing: 0.8, textAlign: 'left',
    borderBottom: `1px solid ${t.tableBorder}`, whiteSpace: 'nowrap',
  }
  const tdStyle: React.CSSProperties = {
    padding: '10px 12px', fontSize: 13, color: t.textSecondary,
    borderBottom: `1px solid ${t.tableBorder}`, verticalAlign: 'middle',
  }

  return (
    <div style={{ background: t.card, border: `1px solid ${t.border}`, borderRadius: 12 }}>
      {/* Header */}
      <div style={{ padding: '14px 16px', borderBottom: `1px solid ${t.border}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          {/* Tipo tabs */}
          <div style={{ display: 'flex', gap: 4, flex: 1, flexWrap: 'wrap' }}>
            {TIPO_TABS.map(tab => (
              <button key={tab.key} onClick={() => setTipoTab(tab.key)} style={chipStyle(tipoTab === tab.key)}>
                {tab.label}
              </button>
            ))}
          </div>

          {/* Status */}
          <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: t.textMuted, textTransform: 'uppercase', letterSpacing: 0.8, marginRight: 4 }}>STATUS</span>
            {(['todas', 'ativo', 'pausado'] as StatusTab[]).map(s => (
              <button key={s} onClick={() => setStatusTab(s)} style={chipStyle(statusTab === s)}>
                {s === 'todas' ? 'Todas' : s === 'ativo' ? 'Ativas' : 'Pausadas'}
              </button>
            ))}
          </div>

          {/* Search */}
          <input
            placeholder="Filtrar por nome..."
            value={busca}
            onChange={e => setBusca(e.target.value)}
            style={{
              background: t.inputBg, border: `1px solid ${t.inputBorder}`, color: t.inputText,
              borderRadius: 8, padding: '5px 12px', fontSize: 13, outline: 'none', width: 180,
            }}
          />
        </div>
      </div>

      {/* Table */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ ...thStyle, minWidth: 220 }}>CAMPANHA</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>INVEST.</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>CLIQUES</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>IMPRESSÕES</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>CTR</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>CPC MÉD.</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>CONV.</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>CUSTO/CONV.</th>
            </tr>
          </thead>
          <tbody>
            {filtradas.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ ...tdStyle, textAlign: 'center', color: t.emptyText, padding: 28 }}>
                  Nenhuma campanha encontrada
                </td>
              </tr>
            ) : filtradas.map(c => {
              const share = totalCusto > 0 ? (c.custo / totalCusto) * 100 : 0
              return (
                <tr key={c.id} style={{ transition: 'background 0.1s' }}
                  onMouseEnter={e => (e.currentTarget.style.background = t.tableHover)}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  <td style={tdStyle}>
                    <div style={{ fontWeight: 600, color: t.textPrimary, fontSize: 13 }}>{c.nome}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3 }}>
                      <span style={{
                        fontSize: 10, padding: '1px 7px', borderRadius: 20, fontWeight: 600,
                        background: '#1A3CFF18', color: '#7ba3ff', border: '1px solid #1A3CFF2a',
                      }}>{c.tipo}</span>
                      <span style={{
                        fontSize: 10, padding: '1px 7px', borderRadius: 20, fontWeight: 600,
                        background: c.status === 'ativo' ? '#00cc6618' : '#66666618',
                        color: c.status === 'ativo' ? '#4ade80' : '#888',
                        border: `1px solid ${c.status === 'ativo' ? '#00cc6630' : '#66666630'}`,
                      }}>{c.status === 'ativo' ? 'Ativa' : 'Pausada'}</span>
                    </div>
                    {share > 0 && (
                      <div style={{ marginTop: 5, height: 2, background: t.barTrack, borderRadius: 2 }}>
                        <div style={{ width: `${Math.min(100, share)}%`, height: '100%', background: '#1A3CFF', borderRadius: 2 }} />
                      </div>
                    )}
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'right', color: '#60a5fa', fontWeight: 600 }}>{fmtBRL(c.custo)}</td>
                  <td style={{ ...tdStyle, textAlign: 'right' }}>{fmtNum(c.cliques)}</td>
                  <td style={{ ...tdStyle, textAlign: 'right' }}>{fmtNum(c.impressoes)}</td>
                  <td style={{ ...tdStyle, textAlign: 'right' }}>{fmtPct(c.ctr)}</td>
                  <td style={{ ...tdStyle, textAlign: 'right' }}>{c.cpcMedio > 0 ? fmtBRL(c.cpcMedio) : '—'}</td>
                  <td style={{ ...tdStyle, textAlign: 'right', color: c.conversoes > 0 ? '#4ade80' : t.textMuted }}>
                    {c.conversoes > 0 ? fmtNum(c.conversoes) : '—'}
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'right' }}>
                    {c.custoConversao > 0 ? fmtBRL(c.custoConversao) : '—'}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── Account Card (all-accounts view) ─────────────────────────────────────────
function AccountCard({ acc, totalCusto, t }: { acc: AccountData; totalCusto: number; t: typeof C['dark'] }) {
  const [open, setOpen] = useState(true)
  const sharePct = totalCusto > 0 ? (acc.custo / totalCusto) * 100 : 0
  return (
    <div style={{ border: `1px solid ${t.border}`, borderRadius: 10, overflow: 'hidden', background: t.card }}>
      <button onClick={() => setOpen(o => !o)} style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        width: '100%', padding: '14px 16px', background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: t.textPrimary }}>{acc.nome}</span>
          <span style={{ fontSize: 11, padding: '2px 9px', borderRadius: 20, background: '#1A3CFF18', color: '#7ba3ff', border: '1px solid #1A3CFF33' }}>
            {fmtBRL(acc.custo)}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {sharePct > 0 && <span style={{ fontSize: 11, color: t.textMuted }}>{fmtPct(sharePct)} do total</span>}
          <span style={{ color: t.chevron, fontSize: 12 }}>{open ? '▲' : '▼'}</span>
        </div>
      </button>
      {sharePct > 0 && (
        <div style={{ height: 2, background: t.barTrack, margin: '0 16px' }}>
          <div style={{ width: `${Math.min(100, sharePct)}%`, height: '100%', background: '#1A3CFF', borderRadius: 2 }} />
        </div>
      )}
      {open && (
        <div style={{ padding: '12px 16px 16px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px 16px' }}>
            {[
              { label: 'Cliques', value: fmtNum(acc.cliques) },
              { label: 'Impressões', value: fmtNum(acc.impressoes) },
              { label: 'CTR', value: fmtPct(acc.ctr) },
              { label: 'CPC Médio', value: acc.cpcMedio > 0 ? fmtBRL(acc.cpcMedio) : '—' },
              { label: 'Custo', value: fmtBRL(acc.custo), highlight: '#60a5fa' },
              { label: 'Conversões', value: acc.conversoes > 0 ? fmtNum(acc.conversoes) : '—', highlight: acc.conversoes > 0 ? '#4ade80' : undefined },
              { label: 'Custo/Conv.', value: acc.custoConversao > 0 ? fmtBRL(acc.custoConversao) : '—' },
            ].map(m => (
              <div key={m.label}>
                <div style={{ fontSize: 9, fontWeight: 700, color: t.textMuted, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 4 }}>{m.label}</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: m.highlight ?? t.textPrimary }}>{m.value}</div>
              </div>
            ))}
          </div>
        </div>
      )}
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

  const t = C[theme]
  const periodoRef = useRef(getPeriodo('mes-atual'))

  function fetchData(p: { start: string; end: string }) {
    setLoading(true)
    setError('')
    fetch(`/api/google-ads?start=${p.start}&end=${p.end}`)
      .then(r => r.json())
      .then(res => {
        if (res.error) { setError(res.error); setLoading(false); return }
        setData(res.data ?? [])
        if ((res.nomes ?? []).length > 0) setNomes(res.nomes)
        setLoading(false)
      })
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
        fetch(`/api/google-ads?start=${cur.start}&end=${cur.end}`)
          .then(r => r.json())
          .then(res => {
            if (!res.error) {
              setData(res.data ?? [])
              if ((res.nomes ?? []).length > 0) setNomes(res.nomes)
            }
          })
          .catch(() => {})
        timer = scheduleNext()
      }, next.getTime() - now.getTime())
    }
    let timer = scheduleNext()
    return () => clearTimeout(timer)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const center: React.CSSProperties = {
    display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', minHeight: 200,
  }

  const filtrado = (data ?? []).filter(d => !filtroCliente || d.nome === filtroCliente)
  const totalCliques = filtrado.reduce((s, a) => s + a.cliques, 0)
  const totalImpressoes = filtrado.reduce((s, a) => s + a.impressoes, 0)
  const totalCusto = filtrado.reduce((s, a) => s + a.custo, 0)
  const totalConversoes = filtrado.reduce((s, a) => s + a.conversoes, 0)
  const ctrMedio = totalImpressoes > 0 ? (totalCliques / totalImpressoes) * 100 : 0
  const cpcMedio = totalCliques > 0 ? totalCusto / totalCliques : 0
  const custoConversao = totalConversoes > 0 ? totalCusto / totalConversoes : 0

  const selectedAccount = filtroCliente ? filtrado[0] : null

  // Merge daily series across all filtered accounts (when all selected)
  const mergedSerie: DailyPoint[] = (() => {
    if (selectedAccount) return selectedAccount.serie
    const dateMap = new Map<string, { custo: number; cliques: number }>()
    for (const acc of filtrado) {
      for (const pt of acc.serie) {
        const ex = dateMap.get(pt.date) ?? { custo: 0, cliques: 0 }
        const clq = pt.cpcMedio > 0 ? pt.custo / pt.cpcMedio : 0
        dateMap.set(pt.date, { custo: ex.custo + pt.custo, cliques: ex.cliques + clq })
      }
    }
    return Array.from(dateMap.entries()).sort(([a], [b]) => a.localeCompare(b))
      .map(([date, d]) => ({ date, custo: d.custo, cpcMedio: d.cliques > 0 ? d.custo / d.cliques : 0 }))
  })()

  const allCampanhas: CampaignData[] = selectedAccount
    ? selectedAccount.campanhas
    : filtrado.flatMap(a => a.campanhas).sort((a, b) => b.custo - a.custo)

  return (
    <div style={{ padding: '20px 24px 40px', overflowY: 'auto', height: '100%', boxSizing: 'border-box', background: t.page }}>

      {/* Controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        <PeriodoDropdown preset={preset} custom={custom} t={t} onApply={aplicarPeriodo} />
        <select
          value={filtroCliente}
          onChange={e => setFiltroCliente(e.target.value)}
          style={{
            background: t.selectBg, border: `1px solid ${t.selectBorder}`, color: t.selectText,
            borderRadius: 8, padding: '6px 12px', fontSize: 13, cursor: 'pointer', outline: 'none', height: 34,
          }}
        >
          <option value="">Todas as contas</option>
          {nomes.map(n => <option key={n} value={n}>{n}</option>)}
        </select>
        {loading && (
          <div style={{ width: 18, height: 18, border: `2px solid ${t.spinner}`, borderTop: '2px solid #1A3CFF', borderRadius: '50%', animation: 'spin 0.8s linear infinite', flexShrink: 0 }} />
        )}
      </div>

      {/* States */}
      {loading && !data ? (
        <div style={center}>
          <div style={{ width: 28, height: 28, border: `3px solid ${t.spinner}`, borderTop: '3px solid #1A3CFF', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        </div>
      ) : error ? (
        <div style={{ ...center, flexDirection: 'column', gap: 8 }}>
          <span style={{ fontSize: 15, color: '#f87171' }}>Erro ao carregar dados</span>
          <span style={{ fontSize: 13, color: t.textMuted, maxWidth: 480, textAlign: 'center' }}>{error}</span>
        </div>
      ) : !filtrado.length ? (
        <div style={center}>
          <span style={{ color: t.emptyText }}>Nenhuma conta com dados no período selecionado.</span>
        </div>
      ) : (
        <>
          {/* KPI tiles */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10, marginBottom: 20 }}>
            <KpiTile label="Cliques" value={fmtNum(totalCliques)} t={t} />
            <KpiTile label="Impressões" value={fmtNum(totalImpressoes)} t={t} />
            <KpiTile label="CTR Médio" value={fmtPct(ctrMedio)} t={t} />
            <KpiTile label="CPC Médio" value={cpcMedio > 0 ? fmtBRL(cpcMedio) : '—'} t={t} />
            <KpiTile label="Investimento" value={fmtBRL(totalCusto)} t={t} />
            <KpiTile label="Conversões" value={totalConversoes > 0 ? fmtNum(totalConversoes) : '—'} t={t} />
            <KpiTile label="Custo/Conv." value={custoConversao > 0 ? fmtBRL(custoConversao) : '—'} t={t} />
          </div>

          {/* Trend Chart */}
          {mergedSerie.length > 1 && (
            <div style={{ marginBottom: 20 }}>
              <TrendChart serie={mergedSerie} theme={theme} />
            </div>
          )}

          {/* Account cards OR campaign table */}
          {!filtroCliente ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {filtrado.map(acc => (
                <AccountCard key={acc.id} acc={acc} totalCusto={totalCusto} t={t} />
              ))}
            </div>
          ) : (
            <CampaignTable campanhas={allCampanhas} totalCusto={totalCusto} t={t} />
          )}

          {/* When "all accounts" but user might want table too — show after cards */}
          {!filtroCliente && allCampanhas.length > 0 && (
            <div style={{ marginTop: 24 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: t.textMuted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>
                TODAS AS CAMPANHAS
              </div>
              <CampaignTable campanhas={allCampanhas} totalCusto={totalCusto} t={t} />
            </div>
          )}
        </>
      )}
    </div>
  )
}

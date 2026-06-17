'use client'

import { useEffect, useRef, useState } from 'react'
import type { TikTokAccountData, TikTokCampaignData } from '@/app/api/tiktok-ads/route'

type Theme = 'dark' | 'light'
type Preset = 'personalizado' | 'mes-atual' | 'mes-passado' | 'ultimos-7' | 'ultimos-14' | 'ultimos-30' | 'ytd-2026'

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

const TK = '#00994D'

function fmtDate(d: Date) { return d.toISOString().slice(0, 10) }

function getPeriodo(preset: Preset, custom?: { start: string; end: string }) {
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0)
  if (preset === 'personalizado' && custom?.start && custom?.end) {
    const [, sm, sd] = custom.start.split('-'); const [, em, ed] = custom.end.split('-')
    return { start: custom.start, end: custom.end, label: `${sd}/${sm} – ${ed}/${em}` }
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

function PeriodoDropdown({ preset, custom, setPreset, setCustom, theme }: {
  preset: Preset; custom: { start: string; end: string }
  setPreset: (p: Preset) => void; setCustom: (c: { start: string; end: string }) => void; theme: Theme
}) {
  const [open, setOpen] = useState(false)
  const [tmp, setTmp] = useState(custom)
  const cl = C[theme]
  const label = getPeriodo(preset, custom).label

  return (
    <div style={{ position: 'relative' }}>
      <button onClick={() => setOpen(o => !o)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '0 12px', height: 32, borderRadius: 7, border: `1px solid ${cl.border}`, background: cl.card, color: cl.textPrimary, fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
        {label}
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={cl.chevron} strokeWidth="2.5"><polyline points="6 9 12 15 18 9"/></svg>
      </button>
      {open && (
        <div style={{ position: 'absolute', top: '100%', left: 0, marginTop: 4, background: cl.dropBg, border: `1px solid ${cl.dropBorder}`, borderRadius: 10, padding: 8, zIndex: 50, minWidth: 200, boxShadow: '0 8px 24px rgba(0,0,0,0.3)' }}>
          {PRESETS.filter(p => p.key !== 'personalizado').map(p => (
            <button key={p.key} onClick={() => { setPreset(p.key); setOpen(false) }} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '7px 10px', borderRadius: 6, border: 'none', background: preset === p.key ? TK + '22' : 'transparent', color: preset === p.key ? TK : cl.dropText, fontSize: 13, cursor: 'pointer' }}>{p.label}</button>
          ))}
          <div style={{ borderTop: `1px solid ${cl.dropBorder}`, margin: '6px 0', paddingTop: 6 }}>
            <div style={{ fontSize: 11, color: cl.textMuted, padding: '2px 10px 6px' }}>Personalizado</div>
            <div style={{ display: 'flex', gap: 6, padding: '0 6px' }}>
              <input type="date" value={tmp.start} onChange={e => setTmp(t => ({ ...t, start: e.target.value }))} style={{ flex: 1, padding: '4px 6px', borderRadius: 5, border: `1px solid ${cl.inputBorder}`, background: cl.inputBg, color: cl.inputText, fontSize: 12 }} />
              <input type="date" value={tmp.end} onChange={e => setTmp(t => ({ ...t, end: e.target.value }))} style={{ flex: 1, padding: '4px 6px', borderRadius: 5, border: `1px solid ${cl.inputBorder}`, background: cl.inputBg, color: cl.inputText, fontSize: 12 }} />
            </div>
            <button onClick={() => { setPreset('personalizado'); setCustom(tmp); setOpen(false) }} style={{ width: 'calc(100% - 12px)', margin: '8px 6px 2px', padding: '6px 0', borderRadius: 5, border: 'none', background: TK, color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Aplicar</button>
          </div>
        </div>
      )}
    </div>
  )
}

function KpiTile({ label, value, sub, color }: { label: string; value: string; sub?: string; color: string }) {
  return (
    <div style={{ flex: '1 1 0', minWidth: 140, padding: '14px 16px', borderRadius: 10, background: color + '12', border: `1px solid ${color}30` }}>
      <div style={{ fontSize: 11, color, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color: '#fff', lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: '#888', marginTop: 4 }}>{sub}</div>}
    </div>
  )
}

function KpiTileLight({ label, value, sub, color }: { label: string; value: string; sub?: string; color: string }) {
  return (
    <div style={{ flex: '1 1 0', minWidth: 140, padding: '14px 16px', borderRadius: 10, background: color + '10', border: `1px solid ${color}25` }}>
      <div style={{ fontSize: 11, color, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color: '#111', lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: '#aaa', marginTop: 4 }}>{sub}</div>}
    </div>
  )
}

function ShareBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.max(2, (value / max) * 100) : 0
  return (
    <div style={{ height: 4, borderRadius: 2, background: '#2a2a2a', overflow: 'hidden', marginTop: 4 }}>
      <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 2 }} />
    </div>
  )
}

export default function TikTokAdsPage({ theme = 'dark' }: { theme?: Theme }) {
  const cl = C[theme]
  const [data, setData] = useState<TikTokAccountData[]>([])
  const [nomes, setNomes] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [preset, setPreset] = useState<Preset>('mes-atual')
  const [custom, setCustom] = useState({ start: '', end: '' })
  const [filtroNome, setFiltroNome] = useState('todas')
  const periodoRef = useRef(getPeriodo(preset, custom))

  useEffect(() => {
    const p = getPeriodo(preset, custom)
    periodoRef.current = p
    fetchData(p.start, p.end)
  }, [preset, custom])

  async function fetchData(start: string, end: string) {
    setLoading(true); setError('')
    try {
      const res = await fetch(`/api/tiktok-ads?start=${start}&end=${end}`)
      const json = await res.json()
      if (json.error) { setError(json.error); setLoading(false); return }
      setData(json.data ?? [])
      if ((json.nomes ?? []).length > 0) setNomes(json.nomes)
    } catch {
      setError('Erro ao carregar dados do TikTok Ads.')
    }
    setLoading(false)
  }

  const filtered = filtroNome === 'todas' ? data : data.filter(a => a.nome === filtroNome)

  const totals = filtered.reduce((acc, a) => ({
    spend: acc.spend + a.spend,
    impressions: acc.impressions + a.impressions,
    clicks: acc.clicks + a.clicks,
    reach: acc.reach + a.reach,
  }), { spend: 0, impressions: 0, clicks: 0, reach: 0 })

  const avgCtr = totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : 0
  const avgCpm = totals.impressions > 0 ? (totals.spend / totals.impressions) * 1000 : 0
  const avgCpc = totals.clicks > 0 ? totals.spend / totals.clicks : 0
  const avgFreq = filtered.reduce((s, a) => s + a.frequency, 0) / (filtered.length || 1)
  const maxSpend = Math.max(...filtered.map(a => a.spend), 1)

  const Tile = theme === 'dark' ? KpiTile : KpiTileLight

  return (
    <div style={{ flex: 1, overflow: 'auto', background: cl.page, display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ padding: '20px 24px 16px', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', borderBottom: `1px solid ${cl.border}`, background: cl.card }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 200 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: TK }} />
          <span style={{ fontSize: 16, fontWeight: 700, color: cl.textPrimary }}>TikTok Ads</span>
          {loading && <span style={{ fontSize: 12, color: cl.textMuted }}>Carregando...</span>}
        </div>
        <PeriodoDropdown preset={preset} custom={custom} setPreset={setPreset} setCustom={setCustom} theme={theme} />
        <select value={filtroNome} onChange={e => setFiltroNome(e.target.value)} style={{ height: 32, padding: '0 10px', borderRadius: 7, border: `1px solid ${cl.selectBorder}`, background: cl.selectBg, color: cl.selectText, fontSize: 13, cursor: 'pointer' }}>
          <option value="todas">Todas as contas</option>
          {nomes.map(n => <option key={n} value={n}>{n}</option>)}
        </select>
        <button onClick={() => fetchData(periodoRef.current.start, periodoRef.current.end)} style={{ height: 32, padding: '0 14px', borderRadius: 7, border: `1px solid ${cl.border}`, background: 'transparent', color: cl.textMuted, fontSize: 12, cursor: 'pointer' }}>↻ Atualizar</button>
      </div>

      {error && (
        <div style={{ margin: '16px 24px', padding: '12px 16px', borderRadius: 8, background: '#ff444420', border: '1px solid #ff444440', color: '#ff6666', fontSize: 13 }}>
          {error}
        </div>
      )}

      {!loading && filtered.length === 0 && !error && (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: cl.emptyText, fontSize: 14 }}>
          Nenhum dado encontrado para o período selecionado.
        </div>
      )}

      {!loading && filtered.length > 0 && (
        <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* KPI tiles */}
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <Tile label="Investimento" value={fmtBRL(totals.spend)} color={TILE_COLORS[0]} />
            <Tile label="Impressões" value={fmtNum(totals.impressions)} color={TILE_COLORS[1]} />
            <Tile label="Alcance" value={fmtNum(totals.reach)} color={TILE_COLORS[2]} />
            <Tile label="Cliques" value={fmtNum(totals.clicks)} color={TILE_COLORS[3]} />
            <Tile label="CTR" value={fmtPct(avgCtr)} color={TILE_COLORS[4]} />
            <Tile label="CPM" value={fmtBRL(avgCpm)} color={TILE_COLORS[5]} />
            <Tile label="CPC" value={fmtBRL(avgCpc)} color={TILE_COLORS[6]} />
            <Tile label="Freq. Média" value={avgFreq.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} color={TILE_COLORS[7]} />
          </div>

          {/* Account cards */}
          {filtered.map((acc) => (
            <div key={acc.id} style={{ background: cl.card, border: `1px solid ${cl.border}`, borderRadius: 12, overflow: 'hidden' }}>
              {/* Card header */}
              <div style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: `1px solid ${cl.borderInner}` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 28, height: 28, borderRadius: 7, background: TK + '22', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill={TK}><path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.31 6.31 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V9.13a8.16 8.16 0 004.77 1.52V7.21a4.85 4.85 0 01-1-.52z"/></svg>
                  </div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: cl.textPrimary }}>{acc.nome}</div>
                    <div style={{ fontSize: 11, color: cl.textMuted }}>ID {acc.id}</div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 16, fontSize: 13 }}>
                  <span style={{ color: cl.textMuted }}>Investimento: <span style={{ color: cl.textPrimary, fontWeight: 600 }}>{fmtBRL(acc.spend)}</span></span>
                  <span style={{ color: cl.textMuted }}>Impressões: <span style={{ color: cl.textPrimary, fontWeight: 600 }}>{fmtNum(acc.impressions)}</span></span>
                  <span style={{ color: cl.textMuted }}>CTR: <span style={{ color: cl.textPrimary, fontWeight: 600 }}>{fmtPct(acc.ctr)}</span></span>
                </div>
              </div>

              {/* Metrics grid */}
              <div style={{ padding: '12px 18px', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, borderBottom: acc.campanhas.length > 0 ? `1px solid ${cl.borderInner}` : 'none' }}>
                {[
                  { label: 'Investimento', val: fmtBRL(acc.spend) },
                  { label: 'Impressões', val: fmtNum(acc.impressions) },
                  { label: 'Alcance', val: fmtNum(acc.reach) },
                  { label: 'Cliques', val: fmtNum(acc.clicks) },
                  { label: 'CTR', val: fmtPct(acc.ctr) },
                  { label: 'CPM', val: fmtBRL(acc.cpm) },
                  { label: 'CPC', val: fmtBRL(acc.cpc) },
                  { label: 'Frequência', val: acc.frequency.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) },
                ].map(({ label, val }) => (
                  <div key={label} style={{ padding: '10px 12px', borderRadius: 8, background: cl.kpiBg, border: `1px solid ${cl.kpiBorder}` }}>
                    <div style={{ fontSize: 10, color: cl.textMuted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>{label}</div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: cl.textPrimary }}>{val}</div>
                  </div>
                ))}
              </div>

              {/* Campaign breakdown */}
              {acc.campanhas.length > 0 && (
                <div style={{ padding: '12px 18px' }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: cl.textMuted, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>Campanhas</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {acc.campanhas.map((camp) => (
                      <div key={camp.id} style={{ display: 'grid', gridTemplateColumns: '1fr auto auto auto auto', gap: 12, alignItems: 'center', padding: '8px 12px', borderRadius: 8, background: cl.kpiBg, border: `1px solid ${cl.kpiBorder}` }}>
                        <div>
                          <div style={{ fontSize: 12, fontWeight: 500, color: cl.textPrimary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 300 }}>{camp.nome}</div>
                          <ShareBar value={camp.spend} max={acc.campanhas[0].spend} color={TK} />
                        </div>
                        <div style={{ textAlign: 'right', minWidth: 90 }}>
                          <div style={{ fontSize: 10, color: cl.textMuted }}>Investimento</div>
                          <div style={{ fontSize: 13, fontWeight: 600, color: cl.textPrimary }}>{fmtBRL(camp.spend)}</div>
                        </div>
                        <div style={{ textAlign: 'right', minWidth: 70 }}>
                          <div style={{ fontSize: 10, color: cl.textMuted }}>Impressões</div>
                          <div style={{ fontSize: 13, fontWeight: 600, color: cl.textPrimary }}>{fmtNum(camp.impressions)}</div>
                        </div>
                        <div style={{ textAlign: 'right', minWidth: 60 }}>
                          <div style={{ fontSize: 10, color: cl.textMuted }}>CTR</div>
                          <div style={{ fontSize: 13, fontWeight: 600, color: cl.textPrimary }}>{fmtPct(camp.ctr)}</div>
                        </div>
                        <div style={{ textAlign: 'right', minWidth: 80 }}>
                          <div style={{ fontSize: 10, color: cl.textMuted }}>CPC</div>
                          <div style={{ fontSize: 13, fontWeight: 600, color: cl.textPrimary }}>{fmtBRL(camp.cpc)}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

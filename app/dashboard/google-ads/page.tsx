'use client'

import { useEffect, useRef, useState } from 'react'
import type { AccountData } from '@/app/api/google-ads/route'

type Theme = 'dark' | 'light'
type Preset = 'personalizado' | 'mes-atual' | 'mes-passado' | 'ultimos-7' | 'ultimos-14' | 'ultimos-30' | 'ytd-2026'

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

function PeriodoDropdown({
  preset, custom, t, onApply,
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
              <button onClick={() => setAberto(false)} style={{ padding: '6px 16px', borderRadius: 7, fontSize: 13, background: 'transparent', border: `1px solid ${t.border}`, color: t.textMuted, cursor: 'pointer' }}>
                Cancelar
              </button>
              <button onClick={aplicar} style={{ padding: '6px 16px', borderRadius: 7, fontSize: 13, background: '#1A3CFF', border: 'none', color: '#fff', cursor: 'pointer', fontWeight: 600 }}>
                Aplicar
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function KpiTile({ label, value, sub, t }: { label: string; value: string; sub?: string; t: typeof C['dark'] }) {
  return (
    <div style={{ background: t.kpiBg, border: `1px solid ${t.kpiBorder}`, borderRadius: 10, padding: '14px 16px' }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: t.textMuted, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 700, color: t.textPrimary, lineHeight: 1.2 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: t.textMuted, marginTop: 4 }}>{sub}</div>}
    </div>
  )
}

function MetricRow({ label, value, t }: { label: string; value: string; t: typeof C['dark'] }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 0', borderBottom: `1px solid ${t.borderInner}` }}>
      <span style={{ fontSize: 12, color: t.textMuted }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: 600, color: t.textSecondary }}>{value}</span>
    </div>
  )
}

function AccountCard({ acc, totalCusto, t }: { acc: AccountData; totalCusto: number; t: typeof C['dark'] }) {
  const [open, setOpen] = useState(true)
  const sharePct = totalCusto > 0 ? (acc.custo / totalCusto) * 100 : 0

  return (
    <div style={{ border: `1px solid ${t.border}`, borderRadius: 10, overflow: 'hidden', background: t.card }}>
      {/* Header */}
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          width: '100%', padding: '14px 16px', background: 'transparent',
          border: 'none', cursor: 'pointer', textAlign: 'left',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: t.textPrimary }}>{acc.nome}</span>
          <span style={{
            fontSize: 11, padding: '2px 9px', borderRadius: 20,
            background: '#1A3CFF18', color: '#7ba3ff', border: '1px solid #1A3CFF33',
          }}>
            {fmtBRL(acc.custo)}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {sharePct > 0 && (
            <span style={{ fontSize: 11, color: t.textMuted }}>{fmtPct(sharePct)} do total</span>
          )}
          <span style={{ color: t.chevron, fontSize: 12 }}>{open ? '▲' : '▼'}</span>
        </div>
      </button>

      {/* Cost share bar */}
      {sharePct > 0 && (
        <div style={{ height: 2, background: t.barTrack, margin: '0 16px' }}>
          <div style={{ width: `${Math.min(100, sharePct)}%`, height: '100%', background: '#1A3CFF', borderRadius: 2 }} />
        </div>
      )}

      {/* Metrics */}
      {open && (
        <div style={{ padding: '12px 16px 16px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px 16px' }}>
            <div>
              <div style={{ fontSize: 9, fontWeight: 700, color: t.textMuted, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 4 }}>Cliques</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: t.textPrimary }}>{fmtNum(acc.cliques)}</div>
            </div>
            <div>
              <div style={{ fontSize: 9, fontWeight: 700, color: t.textMuted, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 4 }}>Impressões</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: t.textPrimary }}>{fmtNum(acc.impressoes)}</div>
            </div>
            <div>
              <div style={{ fontSize: 9, fontWeight: 700, color: t.textMuted, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 4 }}>CTR</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: t.textPrimary }}>{fmtPct(acc.ctr)}</div>
            </div>
            <div>
              <div style={{ fontSize: 9, fontWeight: 700, color: t.textMuted, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 4 }}>CPC Médio</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: t.textPrimary }}>{acc.cpcMedio > 0 ? fmtBRL(acc.cpcMedio) : '—'}</div>
            </div>
            <div>
              <div style={{ fontSize: 9, fontWeight: 700, color: t.textMuted, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 4 }}>Custo</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#60a5fa' }}>{fmtBRL(acc.custo)}</div>
            </div>
            <div>
              <div style={{ fontSize: 9, fontWeight: 700, color: t.textMuted, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 4 }}>Conversões</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: acc.conversoes > 0 ? '#4ade80' : t.textMuted }}>
                {acc.conversoes > 0 ? fmtNum(acc.conversoes) : '—'}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 9, fontWeight: 700, color: t.textMuted, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 4 }}>Custo/Conv.</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: t.textPrimary }}>
                {acc.custoConversao > 0 ? fmtBRL(acc.custoConversao) : '—'}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const center: React.CSSProperties = {
    display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', minHeight: 200,
  }

  const filtrado = (data ?? []).filter(d => !filtroCliente || d.nome === filtroCliente)

  // Summary totals
  const totalCliques = filtrado.reduce((s, a) => s + a.cliques, 0)
  const totalImpressoes = filtrado.reduce((s, a) => s + a.impressoes, 0)
  const totalCusto = filtrado.reduce((s, a) => s + a.custo, 0)
  const totalConversoes = filtrado.reduce((s, a) => s + a.conversoes, 0)
  const ctrMedio = totalImpressoes > 0 ? (totalCliques / totalImpressoes) * 100 : 0
  const cpcMedio = totalCliques > 0 ? totalCusto / totalCliques : 0
  const custoConversao = totalConversoes > 0 ? totalCusto / totalConversoes : 0

  return (
    <div style={{ padding: '20px 24px 40px', overflowY: 'auto', height: '100%', boxSizing: 'border-box', background: t.page }}>

      {/* Controles */}
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

      {/* Conteúdo */}
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
          {/* KPI summary */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10, marginBottom: 20 }}>
            <KpiTile label="Cliques" value={fmtNum(totalCliques)} t={t} />
            <KpiTile label="Impressões" value={fmtNum(totalImpressoes)} t={t} />
            <KpiTile label="CTR Médio" value={fmtPct(ctrMedio)} t={t} />
            <KpiTile label="CPC Médio" value={cpcMedio > 0 ? fmtBRL(cpcMedio) : '—'} t={t} />
            <KpiTile label="Investimento" value={fmtBRL(totalCusto)} t={t} />
            <KpiTile label="Conversões" value={totalConversoes > 0 ? fmtNum(totalConversoes) : '—'} t={t} />
            <KpiTile
              label="Custo/Conv."
              value={custoConversao > 0 ? fmtBRL(custoConversao) : '—'}
              t={t}
            />
          </div>

          {/* Account cards */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {filtrado.map(acc => (
              <AccountCard key={acc.id} acc={acc} totalCusto={totalCusto} t={t} />
            ))}
          </div>
        </>
      )}
    </div>
  )
}

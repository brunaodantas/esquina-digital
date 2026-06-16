'use client'

import { useEffect, useState } from 'react'
import { onAuthStateChanged, signOut, User } from 'firebase/auth'
import { doc, getDoc } from 'firebase/firestore'
import { auth, db } from '@/lib/firebase'
import { useRouter } from 'next/navigation'
import EntregasPage from './entregas/page'
import GoogleAdsPage from './google-ads/page'
import MetaAdsPage from './meta-ads/page'

type Tab = 'meta' | 'entregas' | 'google-ads'
type Theme = 'dark' | 'light'
type PresetWA = 'mes-atual' | 'mes-passado' | 'ultimos-7' | 'ultimos-14' | 'ultimos-30' | 'personalizado'

// ─── Helpers ───────────────────────────────────────────────────────────────────
function fmtD(d: Date) { return d.toISOString().slice(0, 10) }

function getPeriodoWA(preset: PresetWA, custom: { start: string; end: string }): { start: string; end: string; label: string; labelCurto: string } {
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0)
  function ddmm(iso: string) {
    const [, m, d] = iso.split('-')
    return `${d}/${m}`
  }
  if (preset === 'mes-atual') {
    const s = fmtD(new Date(hoje.getFullYear(), hoje.getMonth(), 1))
    const e = fmtD(new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0))
    const mes = new Date(hoje.getFullYear(), hoje.getMonth(), 1)
      .toLocaleString('pt-BR', { month: 'long' })
    const mesCapit = mes.charAt(0).toUpperCase() + mes.slice(1)
    return { start: s, end: e, label: `${mesCapit} ${hoje.getFullYear()} (${ddmm(s)}–${ddmm(e)})`, labelCurto: mesCapit }
  }
  if (preset === 'mes-passado') {
    const s = fmtD(new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1))
    const e = fmtD(new Date(hoje.getFullYear(), hoje.getMonth(), 0))
    const mes = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1)
      .toLocaleString('pt-BR', { month: 'long' })
    const mesCapit = mes.charAt(0).toUpperCase() + mes.slice(1)
    return { start: s, end: e, label: `${mesCapit} ${hoje.getFullYear()} (${ddmm(s)}–${ddmm(e)})`, labelCurto: mesCapit }
  }
  if (preset === 'ultimos-7') {
    const s = new Date(hoje); s.setDate(s.getDate() - 6)
    const sf = fmtD(s), ef = fmtD(hoje)
    return { start: sf, end: ef, label: `Últimos 7 dias (${ddmm(sf)}–${ddmm(ef)})`, labelCurto: 'Últimos 7 dias' }
  }
  if (preset === 'ultimos-14') {
    const s = new Date(hoje); s.setDate(s.getDate() - 13)
    const sf = fmtD(s), ef = fmtD(hoje)
    return { start: sf, end: ef, label: `Últimos 14 dias (${ddmm(sf)}–${ddmm(ef)})`, labelCurto: 'Últimos 14 dias' }
  }
  if (preset === 'ultimos-30') {
    const s = new Date(hoje); s.setDate(s.getDate() - 29)
    const sf = fmtD(s), ef = fmtD(hoje)
    return { start: sf, end: ef, label: `Últimos 30 dias (${ddmm(sf)}–${ddmm(ef)})`, labelCurto: 'Últimos 30 dias' }
  }
  if (preset === 'personalizado' && custom.start && custom.end) {
    return { start: custom.start, end: custom.end, label: `${ddmm(custom.start)}–${ddmm(custom.end)}`, labelCurto: `${ddmm(custom.start)}–${ddmm(custom.end)}` }
  }
  const s = fmtD(new Date(hoje.getFullYear(), hoje.getMonth(), 1))
  return { start: s, end: fmtD(hoje), label: 'Período selecionado', labelCurto: 'Período selecionado' }
}

// Formata número no estilo do exemplo: 151,2 mil / 7,5M / 2 mil
function fmtN(v: number): string {
  if (v >= 1_000_000) return (v / 1_000_000).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + 'M'
  if (v >= 10_000) return (v / 1_000).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + ' mil'
  if (v >= 1_000) return (v / 1_000).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 1 }) + ' mil'
  return v.toLocaleString('pt-BR')
}
function fmtBRLn(v: number) { return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) }
function fmtPctn(v: number) { return v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '%' }
function fmtF(v: number) { return v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }

function comentarioMeta(impressions: number, clicks: number, reach: number, ctr: number, freq: number, spend: number, thruplays: number, incluirValores: boolean): string {
  const linhas: string[] = []
  if (ctr >= 1.5) linhas.push(`CTR de ${fmtPctn(ctr)} acima da média para campanhas de alcance.`)
  else if (ctr >= 0.7) linhas.push(`CTR de ${fmtPctn(ctr)} dentro da média para campanhas de alcance.`)
  else linhas.push(`CTR de ${fmtPctn(ctr)} abaixo da média — vale revisar criativos e segmentação.`)
  if (freq < 1.3) linhas.push(`Frequência de ${fmtF(freq)} indica baixa saturação da audiência.`)
  else if (freq <= 2.5) linhas.push(`Frequência de ${fmtF(freq)} está no nível ideal, sem sinais de saturação.`)
  else linhas.push(`Frequência de ${fmtF(freq)} está elevada — atenção à possível saturação de audiência.`)
  return linhas.join('\n')
}

function comentarioGoogle(cliques: number, impressoes: number, ctr: number, cpc: number, conversoes: number, custoConv: number, incluirValores: boolean): string {
  const linhas: string[] = []
  if (ctr >= 5) linhas.push(`CTR de ${fmtPctn(ctr)} acima da média para busca paga.`)
  else if (ctr >= 2) linhas.push(`CTR de ${fmtPctn(ctr)} dentro da média para busca paga.`)
  else linhas.push(`CTR de ${fmtPctn(ctr)} abaixo da média — revise termos de busca e extensões de anúncio.`)
  if (conversoes > 0) {
    const convTxt = incluirValores && custoConv > 0
      ? `${fmtN(conversoes)} conversões registradas com custo médio de ${fmtBRLn(custoConv)}.`
      : `${fmtN(conversoes)} conversões registradas no período.`
    linhas.push(convTxt)
  } else if (incluirValores && cpc > 0) {
    linhas.push(`CPC médio de ${fmtBRLn(cpc)} no período.`)
  } else {
    linhas.push(`Nenhuma conversão registrada no período.`)
  }
  return linhas.join('\n')
}

// ─── Modal ─────────────────────────────────────────────────────────────────────
function RelatorioModal({ onClose }: { onClose: () => void }) {
  const [cliente, setCliente] = useState('')
  const [redes, setRedes] = useState({ meta: true, google: false })
  const [preset, setPreset] = useState<PresetWA>('mes-atual')
  const [custom, setCustom] = useState({ start: '', end: '' })
  const [incluirValores, setIncluirValores] = useState(false)
  const [loading, setLoading] = useState(false)
  const [mensagem, setMensagem] = useState('')
  const [copiado, setCopiado] = useState(false)
  const [erro, setErro] = useState('')

  const periodo = getPeriodoWA(preset, custom)
  const podeGerar = (redes.meta || redes.google) && (preset !== 'personalizado' || (!!custom.start && !!custom.end))

  async function gerarRelatorio() {
    setLoading(true); setMensagem(''); setErro('')

    let metaDados: any[] = []
    let googleDados: any[] = []
    const fetches: Promise<void>[] = []

    if (redes.meta) {
      fetches.push(
        fetch(`/api/meta-ads?start=${periodo.start}&end=${periodo.end}`)
          .then(r => r.json())
          .then(res => { if (!res.error) metaDados = res.data ?? [] })
          .catch(() => setErro('Erro ao buscar dados do Meta Ads.'))
      )
    }
    if (redes.google) {
      fetches.push(
        fetch(`/api/google-ads?start=${periodo.start}&end=${periodo.end}`)
          .then(r => r.json())
          .then(res => { if (!res.error) googleDados = res.data ?? [] })
          .catch(() => setErro(e => e || 'Erro ao buscar dados do Google Ads.'))
      )
    }

    await Promise.all(fetches)

    // ── Totais Meta ──
    const metaSpend = metaDados.reduce((s: number, a: any) => s + (a.spend ?? 0), 0)
    const metaImpr = metaDados.reduce((s: number, a: any) => s + (a.impressions ?? 0), 0)
    const metaReach = metaDados.reduce((s: number, a: any) => s + (a.reach ?? 0), 0)
    const metaClicks = metaDados.reduce((s: number, a: any) => s + (a.clicks ?? 0), 0)
    const metaThru = metaDados.reduce((s: number, a: any) => s + (a.thruplays ?? 0), 0)
    const metaCtr = metaImpr > 0 ? (metaClicks / metaImpr) * 100 : 0
    const metaCpm = metaSpend > 0 && metaImpr > 0 ? (metaSpend / metaImpr) * 1000 : 0
    const metaCpc = metaClicks > 0 ? metaSpend / metaClicks : 0
    const metaFreq = metaReach > 0 ? metaImpr / metaReach : 0

    // ── Totais Google ──
    const gCusto = googleDados.reduce((s: number, a: any) => s + (a.custo ?? 0), 0)
    const gCliques = googleDados.reduce((s: number, a: any) => s + (a.cliques ?? 0), 0)
    const gImpr = googleDados.reduce((s: number, a: any) => s + (a.impressoes ?? 0), 0)
    const gConv = googleDados.reduce((s: number, a: any) => s + (a.conversoes ?? 0), 0)
    const gCtr = gImpr > 0 ? (gCliques / gImpr) * 100 : 0
    const gCpc = gCliques > 0 ? gCusto / gCliques : 0
    const gCustoConv = gConv > 0 ? gCusto / gConv : 0

    // ── Top 3 criativos Meta (por impressões) ──
    const allMetaAds: any[] = metaDados.flatMap((a: any) => a.ads ?? [])
    allMetaAds.sort((a: any, b: any) => (b.impressions ?? 0) - (a.impressions ?? 0))
    const top3Meta = allMetaAds.slice(0, 3)

    // ── Top 3 criativos Google (por cliques) ──
    const allGoogleAds: any[] = googleDados.flatMap((a: any) => a.anuncios ?? [])
    allGoogleAds.sort((a: any, b: any) => (b.cliques ?? 0) - (a.cliques ?? 0))
    const top3Google = allGoogleAds.slice(0, 3)

    // ── Plataformas para título ──
    const plataformas = [redes.meta && 'Meta Ads', redes.google && 'Google Ads'].filter(Boolean).join(' + ')
    const cabecalho = cliente.trim()
      ? `${cliente.trim().toUpperCase()} - ${plataformas} - ${periodo.label}`
      : `${plataformas} - ${periodo.label}`

    const L: string[] = []
    L.push(cabecalho)
    L.push('')

    // ── Visão Geral (consolidado) ──
    const totalImpr = metaImpr + gImpr
    const totalCliques = metaClicks + gCliques
    const totalInvest = metaSpend + gCusto
    L.push('* Visão Geral')
    L.push(`Impressões: ${fmtN(totalImpr)}`)
    if (redes.meta && metaReach > 0) L.push(`Alcance: ${fmtN(metaReach)}`)
    L.push(`Cliques: ${fmtN(totalCliques)}`)
    if (redes.meta && metaFreq > 0) L.push(`Frequência: ${fmtF(metaFreq)}`)
    if (incluirValores && totalInvest > 0) L.push(`Investimento: ${fmtBRLn(totalInvest)}`)
    L.push('')

    // ── Meta Ads ──
    if (redes.meta) {
      if (!metaDados.length) {
        L.push('📊 Desempenho Meta Ads')
        L.push('Nenhum dado encontrado para o período.')
        L.push('')
      } else {
        L.push('📊 Desempenho Meta Ads')
        L.push(`Impressões: ${fmtN(metaImpr)}`)
        if (metaReach > 0) L.push(`Alcance: ${fmtN(metaReach)}`)
        L.push(`Cliques: ${fmtN(metaClicks)}`)
        L.push(`CTR: ${fmtPctn(metaCtr)}`)
        if (metaFreq > 0) L.push(`Frequência: ${fmtF(metaFreq)}`)
        if (metaThru > 0) L.push(`ThruPlays: ${fmtN(metaThru)}`)
        if (incluirValores) {
          L.push(`Investimento: ${fmtBRLn(metaSpend)}`)
          if (metaCpm > 0) L.push(`CPM: ${fmtBRLn(metaCpm)}`)
          if (metaCpc > 0) L.push(`CPC: ${fmtBRLn(metaCpc)}`)
        }
        L.push('')

        if (top3Meta.length > 0) {
          L.push('🎨 Top 3 Criativos')
          top3Meta.forEach((ad: any) => {
            const nome = (ad.nome ?? 'Sem nome').replace(/\[.*?\]/g, '').trim()
            const partes = [`Impressões: ${fmtN(ad.impressions ?? 0)}`]
            if ((ad.reach ?? 0) > 0) partes.push(`Alcance: ${fmtN(ad.reach ?? 0)}`)
            partes.push(`Cliques: ${fmtN(ad.clicks ?? 0)}`)
            L.push(nome)
            L.push(partes.join(' | '))
          })
          L.push('')
        }

        L.push(comentarioMeta(metaImpr, metaClicks, metaReach, metaCtr, metaFreq, metaSpend, metaThru, incluirValores))
        L.push('')
      }
    }

    // ── Google Ads ──
    if (redes.google) {
      if (!googleDados.length) {
        L.push('📈 Desempenho Google Ads')
        L.push('Nenhum dado encontrado para o período.')
        L.push('')
      } else {
        L.push('📈 Desempenho Google Ads')
        L.push(`Impressões: ${fmtN(gImpr)}`)
        L.push(`Cliques: ${fmtN(gCliques)}`)
        L.push(`CTR: ${fmtPctn(gCtr)}`)
        if (gConv > 0) L.push(`Conversões: ${fmtN(gConv)}`)
        if (incluirValores) {
          L.push(`Investimento: ${fmtBRLn(gCusto)}`)
          if (gCpc > 0) L.push(`CPC: ${fmtBRLn(gCpc)}`)
          if (gCustoConv > 0) L.push(`Custo/Conv.: ${fmtBRLn(gCustoConv)}`)
        }
        L.push('')

        if (top3Google.length > 0) {
          L.push('🎨 Top 3 Criativos')
          top3Google.forEach((ad: any) => {
            const nome = (ad.nome ?? 'Sem nome').replace(/\[.*?\]/g, '').trim()
            L.push(nome)
            L.push(`Impressões: ${fmtN(ad.impressoes ?? 0)} | Cliques: ${fmtN(ad.cliques ?? 0)}`)
          })
          L.push('')
        }

        L.push(comentarioGoogle(gCliques, gImpr, gCtr, gCpc, gConv, gCustoConv, incluirValores))
        L.push('')
      }
    }

    // ── Desempenho Geral ──
    L.push('Desempenho Geral')
    const partes: string[] = []
    if (redes.meta && metaDados.length) partes.push(`Meta Ads com ${fmtN(metaImpr)} impressões e ${fmtN(metaClicks)} cliques`)
    if (redes.google && googleDados.length) partes.push(`Google Ads com ${fmtN(gCliques)} cliques e CTR de ${fmtPctn(gCtr)}`)
    if (partes.length > 0) L.push(partes.join('; ') + '.')
    if (incluirValores && (metaSpend + gCusto) > 0) {
      L.push(`Investimento total no período: ${fmtBRLn(metaSpend + gCusto)}.`)
    } else if (!incluirValores && redes.meta && metaDados.length && redes.google && googleDados.length) {
      L.push(`CTR consolidado: Meta ${fmtPctn(metaCtr)} · Google ${fmtPctn(gCtr)}.`)
    }

    setMensagem(L.join('\n'))
    setLoading(false)
  }

  function copiar() {
    navigator.clipboard.writeText(mensagem)
    setCopiado(true)
    setTimeout(() => setCopiado(false), 2000)
  }

  function abrirWhatsApp() {
    window.open(`https://wa.me/?text=${encodeURIComponent(mensagem)}`, '_blank')
  }

  return (
    <div
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.78)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
    >
      <div style={{ background: '#161616', border: '1px solid #2a2a2a', borderRadius: 14, padding: 28, width: '100%', maxWidth: 520, maxHeight: '90vh', overflowY: 'auto' }}>

        {/* Cabeçalho */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#e8e8e8' }}>Relatório via WhatsApp</div>
            <div style={{ fontSize: 12, color: '#555', marginTop: 3 }}>Gera mensagem formatada para envio direto</div>
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: '#555', cursor: 'pointer', fontSize: 22, lineHeight: 1, padding: 0, marginTop: -2 }}>×</button>
        </div>

        {/* Cliente */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#555', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 }}>Cliente (opcional)</div>
          <input
            placeholder="Ex: TAINÁ REIS"
            value={cliente}
            onChange={e => setCliente(e.target.value)}
            style={{ width: '100%', background: '#1a1a1a', border: '1px solid #2a2a2a', color: '#e8e8e8', borderRadius: 8, padding: '9px 12px', fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
          />
        </div>

        {/* Redes */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#555', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 }}>Redes</div>
          <div style={{ display: 'flex', gap: 8 }}>
            {(['meta', 'google'] as const).map(r => {
              const ativo = redes[r]
              return (
                <button key={r} onClick={() => setRedes(p => ({ ...p, [r]: !p[r] }))}
                  style={{ flex: 1, padding: '9px 0', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', border: `1px solid ${ativo ? '#1A3CFF' : '#2a2a2a'}`, background: ativo ? '#1A3CFF18' : 'transparent', color: ativo ? '#7ba3ff' : '#555', transition: 'all 0.15s' }}>
                  {r === 'meta' ? 'Meta Ads' : 'Google Ads'}
                </button>
              )
            })}
          </div>
        </div>

        {/* Período */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#555', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 }}>Período</div>
          <select value={preset} onChange={e => setPreset(e.target.value as PresetWA)}
            style={{ width: '100%', background: '#1a1a1a', border: '1px solid #2a2a2a', color: '#e8e8e8', borderRadius: 8, padding: '9px 12px', fontSize: 13, outline: 'none', cursor: 'pointer' }}>
            <option value="mes-atual">Este mês</option>
            <option value="mes-passado">Mês passado</option>
            <option value="ultimos-7">Últimos 7 dias</option>
            <option value="ultimos-14">Últimos 14 dias</option>
            <option value="ultimos-30">Últimos 30 dias</option>
            <option value="personalizado">Personalizado</option>
          </select>
          {preset === 'personalizado' && (
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <input type="date" value={custom.start} onChange={e => setCustom(p => ({ ...p, start: e.target.value }))}
                style={{ flex: 1, background: '#1a1a1a', border: '1px solid #2a2a2a', color: '#e8e8e8', borderRadius: 8, padding: '7px 10px', fontSize: 13, outline: 'none' }} />
              <input type="date" value={custom.end} onChange={e => setCustom(p => ({ ...p, end: e.target.value }))}
                style={{ flex: 1, background: '#1a1a1a', border: '1px solid #2a2a2a', color: '#e8e8e8', borderRadius: 8, padding: '7px 10px', fontSize: 13, outline: 'none' }} />
            </div>
          )}
        </div>

        {/* Toggle incluir valores */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#555', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 }}>Opções</div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', userSelect: 'none' }}>
            <div onClick={() => setIncluirValores(v => !v)}
              style={{ width: 40, height: 22, borderRadius: 11, background: incluirValores ? '#1A3CFF' : '#333', position: 'relative', transition: 'background 0.2s', flexShrink: 0, cursor: 'pointer' }}>
              <div style={{ position: 'absolute', top: 3, left: incluirValores ? 20 : 3, width: 16, height: 16, borderRadius: '50%', background: '#fff', transition: 'left 0.2s' }} />
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#e8e8e8' }}>Incluir valores financeiros</div>
              <div style={{ fontSize: 11, color: '#555', marginTop: 2 }}>Investimento, CPM, CPC, Custo/Conv.</div>
            </div>
          </label>
        </div>

        {/* Botão gerar */}
        <button
          onClick={gerarRelatorio}
          disabled={loading || !podeGerar}
          style={{ width: '100%', padding: '11px 0', borderRadius: 9, fontSize: 14, fontWeight: 700, cursor: loading || !podeGerar ? 'not-allowed' : 'pointer', border: 'none', background: loading || !podeGerar ? '#252525' : '#1A3CFF', color: loading || !podeGerar ? '#555' : '#fff', transition: 'all 0.15s', marginBottom: mensagem ? 20 : 0 }}>
          {loading ? 'Buscando dados...' : 'Gerar Relatório'}
        </button>

        {erro && <div style={{ fontSize: 12, color: '#f87171', marginTop: 10 }}>{erro}</div>}

        {/* Preview */}
        {mensagem && !loading && (
          <>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#555', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 }}>Pré-visualização</div>
            <textarea
              readOnly
              value={mensagem}
              rows={16}
              style={{ width: '100%', background: '#0d0d0d', border: '1px solid #2a2a2a', color: '#c8c8c8', borderRadius: 8, padding: '12px 14px', fontSize: 12, fontFamily: 'monospace', resize: 'vertical', outline: 'none', boxSizing: 'border-box', lineHeight: 1.75 }}
            />
            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              <button onClick={copiar}
                style={{ flex: 1, padding: '10px 0', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', border: `1px solid ${copiado ? '#22c55e' : '#2a2a2a'}`, background: copiado ? '#22c55e18' : 'transparent', color: copiado ? '#4ade80' : '#888', transition: 'all 0.2s' }}>
                {copiado ? '✓ Copiado!' : 'Copiar texto'}
              </button>
              <button onClick={abrirWhatsApp}
                style={{ flex: 1, padding: '10px 0', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', border: 'none', background: '#25D366', color: '#fff' }}>
                Abrir no WhatsApp
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ─── Dashboard ──────────────────────────────────────────────────────────────────
export default function Dashboard() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<Tab>('meta')
  const [theme, setTheme] = useState<Theme>('dark')
  const [showRelatorio, setShowRelatorio] = useState(false)
  const router = useRouter()

  useEffect(() => {
    const saved = localStorage.getItem('esquina-theme') as Theme | null
    if (saved) setTheme(saved)
  }, [])

  function toggleTheme() {
    setTheme(t => {
      const next = t === 'dark' ? 'light' : 'dark'
      localStorage.setItem('esquina-theme', next)
      return next
    })
  }

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) { router.push('/'); return }
      const snap = await getDoc(doc(db, 'users', u.uid))
      if (!snap.exists() || snap.data().status !== 'aprovado') {
        router.push('/'); return
      }
      setUser(u)
      setLoading(false)
    })
    return () => unsub()
  }, [router])

  async function handleLogout() {
    await signOut(auth)
    router.push('/')
  }

  const initials = user?.displayName?.split(' ').map(n => n[0]).slice(0, 2).join('') ?? 'U'

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: '#0d0d0d' }}>
        <div style={{ width: 32, height: 32, border: '3px solid #333', borderTop: '3px solid #1A3CFF', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>

      {/* Header sempre visível */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '0 20px', height: 52, flexShrink: 0,
        background: '#0d0d0d',
        borderBottom: '1px solid #2a2a2a',
      }}>
        <button onClick={() => setActiveTab('meta')} style={{ height: 32, padding: '0 16px', borderRadius: 7, fontSize: 13, fontWeight: 600, cursor: 'pointer', border: 'none', transition: 'all 0.15s', background: activeTab === 'meta' ? '#1A3CFF' : '#252525', color: activeTab === 'meta' ? '#fff' : '#999', outline: activeTab !== 'meta' ? '1px solid #333' : 'none' }}>Meta Ads</button>
        <button onClick={() => setActiveTab('entregas')} style={{ height: 32, padding: '0 16px', borderRadius: 7, fontSize: 13, fontWeight: 600, cursor: 'pointer', border: 'none', transition: 'all 0.15s', background: activeTab === 'entregas' ? '#1A3CFF' : '#252525', color: activeTab === 'entregas' ? '#fff' : '#999', outline: activeTab !== 'entregas' ? '1px solid #333' : 'none' }}>Entregas</button>
        <button onClick={() => setActiveTab('google-ads')} style={{ height: 32, padding: '0 16px', borderRadius: 7, fontSize: 13, fontWeight: 600, cursor: 'pointer', border: 'none', transition: 'all 0.15s', background: activeTab === 'google-ads' ? '#1A3CFF' : '#252525', color: activeTab === 'google-ads' ? '#fff' : '#999', outline: activeTab !== 'google-ads' ? '1px solid #333' : 'none' }}>Google Ads</button>
        <button onClick={() => setShowRelatorio(true)} title="Gerar relatório para WhatsApp" style={{ height: 32, padding: '0 14px', borderRadius: 7, fontSize: 13, fontWeight: 600, cursor: 'pointer', border: '1px solid #2a4a2a', transition: 'all 0.15s', background: '#1a2e1a', color: '#4ade80', display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 14 }}>✉</span> Relatório WA
        </button>

        <div style={{ flex: 1 }} />

        <button onClick={toggleTheme} title={theme === 'dark' ? 'Modo claro' : 'Modo escuro'} style={{ width: 32, height: 32, borderRadius: 7, fontSize: 15, background: '#252525', border: '1px solid #333', color: '#999', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {theme === 'dark' ? '☀' : '☽'}
        </button>
        <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#1A3CFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: '#fff' }}>{initials}</div>
        <span style={{ fontSize: 13, color: '#888' }}>{user?.displayName?.split(' ')[0]}</span>
        <button onClick={handleLogout} style={{ height: 30, padding: '0 12px', borderRadius: 6, fontSize: 12, background: 'transparent', border: '1px solid #333', color: '#666', cursor: 'pointer' }}>Sair</button>
      </div>

      {/* Conteúdo */}
      <div style={{ flex: 1, overflow: 'hidden', display: activeTab === 'meta' ? 'flex' : 'none', flexDirection: 'column' }}>
        <MetaAdsPage theme={theme} />
      </div>
      <div style={{ flex: 1, overflow: 'hidden', display: activeTab === 'entregas' ? 'flex' : 'none', flexDirection: 'column' }}>
        <EntregasPage theme={theme} />
      </div>
      <div style={{ flex: 1, overflow: 'hidden', display: activeTab === 'google-ads' ? 'flex' : 'none', flexDirection: 'column' }}>
        <GoogleAdsPage theme={theme} />
      </div>

      {showRelatorio && <RelatorioModal onClose={() => setShowRelatorio(false)} />}
    </div>
  )
}

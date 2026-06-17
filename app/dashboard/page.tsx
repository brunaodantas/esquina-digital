'use client'

import { useEffect, useState } from 'react'
import { onAuthStateChanged, signOut, User } from 'firebase/auth'
import { doc, getDoc } from 'firebase/firestore'
import { auth, db } from '@/lib/firebase'
import { useRouter } from 'next/navigation'
import EntregasPage from './entregas/page'
import GoogleAdsPage from './google-ads/page'
import MetaAdsPage from './meta-ads/page'
import TikTokAdsPage from './tiktok-ads/page'

type Tab = 'meta' | 'entregas' | 'google-ads' | 'tiktok'
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

// ─── Relatório Semanal ─────────────────────────────────────────────────────────

interface RelSemanalParams {
  cliente: string
  periodoStart: string
  periodoEnd: string
  metaDados: any[]
  googleDados: any[]
  secoes: { display: boolean; youtube: boolean; metaTD: boolean; metaVP: boolean; tiktok: boolean; diagnostico: boolean; conclusao: boolean }
  seguidoresSemana: number
  seguidoresMes: number
  visitasPerfil: number
  tiktokImpressoes: number
  tiktokCliques: number
  chartJsText: string
  logoB64: string
}

function buildRelatorioHTML(p: RelSemanalParams): string {
  const { cliente, periodoStart, periodoEnd, metaDados, googleDados, secoes, seguidoresSemana, seguidoresMes, visitasPerfil, tiktokImpressoes, tiktokCliques, chartJsText, logoB64 } = p

  const [, ms, ds] = periodoStart.split('-')
  const [, me, de] = periodoEnd.split('-')
  const periodoLabel = `${ds}/${ms} a ${de}/${me}`

  function fmtK(n: number): string {
    if (n >= 1_000_000) return '+' + (n / 1_000_000).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + 'M'
    if (n >= 1_000) return '+' + (n / 1_000).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + 'K'
    return '+' + n.toLocaleString('pt-BR')
  }
  function fmtF2(n: number): string { return n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }
  function fmtPct2(n: number): string { return fmtF2(n) + '%' }
  function cleanName(n: string) { return n.replace(/\[.*?\]/g, '').trim().slice(0, 32) }

  // ── Google: split Display vs YouTube ──
  const dispCamps: any[] = googleDados.flatMap(a => (a.campanhas ?? []).filter((c: any) => c.tipoRaw === 'DISPLAY'))
  const ytCamps: any[] = googleDados.flatMap(a => (a.campanhas ?? []).filter((c: any) => c.tipoRaw === 'VIDEO'))
  const dispCampIds = new Set(dispCamps.map(c => c.id))
  const ytCampIds = new Set(ytCamps.map(c => c.id))
  const dispGroups: any[] = googleDados.flatMap(a => (a.grupos ?? []).filter((g: any) => dispCampIds.has(g.campanhaId)))

  const dispImpr = dispCamps.reduce((s, c) => s + c.impressoes, 0)
  const dispCliques = dispCamps.reduce((s, c) => s + c.cliques, 0)
  const dispCtr = dispImpr > 0 ? (dispCliques / dispImpr) * 100 : 0

  const ytImpr = ytCamps.reduce((s, c) => s + c.impressoes, 0)
  const ytViews = ytCamps.reduce((s, c) => s + c.videoViews, 0)
  const ytCliques = ytCamps.reduce((s, c) => s + c.cliques, 0)
  const ytConv = ytCamps.reduce((s, c) => s + c.conversoes, 0)

  // ── Meta: split TD vs VP ──
  const isVP = (nome: string) => /\bvp\b|visita|perfil/i.test(nome)
  const metaCamps: any[] = metaDados.flatMap(a => a.campanhas ?? [])
  const tdCamps = metaCamps.filter(c => !isVP(c.nome))
  const vpCamps = metaCamps.filter(c => isVP(c.nome))

  const tdImpr = tdCamps.reduce((s, c) => s + c.impressions, 0)
  const tdReach = tdCamps.reduce((s, c) => s + c.reach, 0)
  const tdCliques = tdCamps.reduce((s, c) => s + c.clicks, 0)

  const vpImpr = vpCamps.reduce((s, c) => s + c.impressions, 0)
  const vpReach = vpCamps.reduce((s, c) => s + c.reach, 0)

  const hasVPData = vpCamps.length > 0
  const finalTDCamps = hasVPData ? tdCamps : metaCamps
  const finalTDImpr = hasVPData ? tdImpr : metaCamps.reduce((s, c) => s + c.impressions, 0)
  const finalTDReach = hasVPData ? tdReach : metaCamps.reduce((s, c) => s + c.reach, 0)
  const finalTDCliques = hasVPData ? tdCliques : metaCamps.reduce((s, c) => s + c.clicks, 0)
  const finalTDFreq = finalTDReach > 0 ? finalTDImpr / finalTDReach : 0
  const vpFreq = vpReach > 0 ? vpImpr / vpReach : 0

  const tiktokCtr = tiktokImpressoes > 0 && tiktokCliques > 0 ? (tiktokCliques / tiktokImpressoes) * 100 : 0

  const totalImpr = dispImpr + ytImpr + finalTDImpr + vpImpr + tiktokImpressoes
  const inscritosYT = ytConv

  // ── Audience: Meta (account-level) ──
  const audG = new Map<string, number>()
  const audI = new Map<string, number>()
  const audD = new Map<string, number>()
  for (const acc of metaDados) {
    for (const i of acc.audiencia?.genero ?? []) audG.set(i.label, (audG.get(i.label) ?? 0) + i.impressions)
    for (const i of acc.audiencia?.idade ?? []) audI.set(i.label, (audI.get(i.label) ?? 0) + i.impressions)
    for (const i of acc.audiencia?.dispositivos ?? []) audD.set(i.label, (audD.get(i.label) ?? 0) + i.impressions)
  }
  function toItems(map: Map<string, number>, limit: number) {
    const total = [...map.values()].reduce((s, v) => s + v, 0)
    return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit)
      .map(([l, v]) => ({ l, pct: total > 0 ? Math.round(v / total * 100) : 0 }))
  }
  const genItems = toItems(audG, 2)
  const ageItems = toItems(audI, 4)
  const devItems = toItems(audD, 3)

  // ── Audience: Google cities ──
  const cidMap = new Map<string, number>()
  for (const acc of googleDados) for (const c of acc.cidades ?? []) cidMap.set(c.nome, (cidMap.get(c.nome) ?? 0) + c.cliques)
  const topCidades = [...cidMap.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5)

  // ── Top items for charts ──
  const topDisp = [...dispGroups].sort((a, b) => b.cliques - a.cliques).slice(0, 5)
  const topYT = [...ytCamps].sort((a, b) => b.videoViews - a.videoViews).slice(0, 5)
  const topTD = [...finalTDCamps].sort((a, b) => b.impressions - a.impressions).slice(0, 5)
  const topVP = [...vpCamps].sort((a, b) => b.impressions - a.impressions).slice(0, 5)

  // ── HTML helpers ──
  function kpiCard(label: string, value: string, sub?: string): string {
    return `<div class="kpi-card"><div class="kpi-label">${label}</div><div class="kpi-value">${value}</div>${sub ? `<div class="kpi-sub">${sub}</div>` : ''}</div>`
  }

  function miniBar(label: string, pct: number, color: string): string {
    return `<div class="aud-row"><span class="aud-name">${label}</span><div class="aud-bar"><div class="aud-fill" style="width:${pct}%;background:${color}"></div></div><span class="aud-pct">${pct}%</span></div>`
  }

  function metaAudHtml(color: string): string {
    if (!genItems.length && !ageItems.length) return '<p class="aud-empty">Sem dados de audiência disponíveis</p>'
    let h = ''
    if (genItems.length) h += `<div class="aud-sec"><div class="aud-sec-title">Gênero</div>${genItems.map(i => miniBar(i.l, i.pct, color)).join('')}</div>`
    if (ageItems.length) h += `<div class="aud-sec"><div class="aud-sec-title">Faixa Etária</div>${ageItems.map(i => miniBar(i.l, i.pct, color + 'aa')).join('')}</div>`
    if (devItems.length) h += `<div class="aud-sec"><div class="aud-sec-title">Dispositivos</div>${devItems.map(i => miniBar(i.l, i.pct, color + '66')).join('')}</div>`
    return h
  }

  function googleAudHtml(color: string): string {
    if (!topCidades.length) return '<p class="aud-empty">Sem dados de localização disponíveis</p>'
    const max = topCidades[0][1] || 1
    let h = `<div class="aud-sec"><div class="aud-sec-title">Top Cidades por Cliques</div>`
    topCidades.forEach(([nome, cliques]) => {
      h += `<div class="aud-row"><span class="aud-name" style="max-width:110px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${nome}</span><div class="aud-bar"><div class="aud-fill" style="width:${Math.round(cliques / max * 100)}%;background:${color}"></div></div><span class="aud-pct">${fmtK(cliques)}</span></div>`
    })
    h += '</div>'
    return h
  }

  // ── Analysis texts ──
  function analysisMeta(impr: number, reach: number, clicks: number, freq: number): string {
    const ctr = impr > 0 ? (clicks / impr) * 100 : 0
    const freqNote = freq < 1.3 ? 'baixa saturação, com espaço para ampliar alcance' : freq <= 2.5 ? 'frequência adequada, sem sinais de saturação' : 'frequência acima de 2,5x — considerar ampliar segmentação'
    return `Alcançou ${fmtK(reach)} usuários únicos com frequência média de ${fmtF2(freq)}x (${freqNote}). CTR de ${fmtPct2(ctr)} indica ${ctr >= 0.8 ? 'boa receptividade dos criativos' : 'oportunidade de otimização de criativos e segmentação'}.`
  }

  function analysisDisplay(): string {
    return `Google Display entregou ${fmtK(dispImpr)} impressões com ${fmtK(dispCliques)} cliques e CTR de ${fmtPct2(dispCtr)}. ${dispCtr >= 0.4 ? 'Índice de cliques dentro da faixa esperada para campanhas de display programático.' : 'CTR abaixo da média — recomendado revisar criativos e segmentações de público.'}`
  }

  function analysisYoutube(): string {
    const vtr = ytImpr > 0 ? (ytViews / ytImpr) * 100 : 0
    return `YouTube registrou ${fmtK(ytViews)} visualizações em ${fmtK(ytImpr)} impressões (VTR de ${fmtPct2(vtr)})${inscritosYT > 0 ? `, gerando ${fmtK(inscritosYT)} novos inscritos` : ''}. ${vtr >= 25 ? 'Taxa de visualização acima da média, indicando boa adequação do conteúdo ao público.' : 'VTR dentro da faixa esperada para formatos in-stream.'}`
  }

  function analysisVP(): string {
    return `${visitasPerfil > 0 ? `Gerou ${fmtK(visitasPerfil)} visitas ao perfil` : `Entregou ${fmtK(vpImpr)} impressões`} com alcance de ${fmtK(vpReach)} usuários únicos. Frequência de ${fmtF2(vpFreq)}x indica ${vpFreq <= 2.5 ? 'boa distribuição de exposição sem saturação' : 'frequência elevada — avaliar rotação de criativos'}.`
  }

  function analysisTiktok(): string {
    return `TikTok registrou ${fmtK(tiktokImpressoes)} impressões e ${fmtK(tiktokCliques)} cliques com CTR de ${fmtPct2(tiktokCtr)}. ${tiktokCtr >= 1.0 ? 'CTR acima da média para a plataforma, indicando boa performance dos criativos.' : 'CTR dentro da faixa esperada para campanhas de awareness no TikTok.'}`
  }

  // ── Chart configs ──
  function barChartJson(labels: string[], data: number[], color: string): string {
    return JSON.stringify({
      type: 'bar',
      data: { labels, datasets: [{ data, backgroundColor: color, borderRadius: 4 }] },
      options: {
        indexAxis: 'y', responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false }, tooltip: { backgroundColor: '#fff', titleColor: '#111', bodyColor: '#333', borderColor: '#e0e0e0', borderWidth: 1 } },
        scales: { x: { grid: { color: 'rgba(0,0,0,0.05)' }, ticks: { color: '#888', font: { size: 10 } } }, y: { grid: { display: false }, ticks: { color: '#555', font: { size: 10 } } } }
      }
    })
  }

  const chartScripts: string[] = []
  if (dispImpr > 0 && topDisp.length > 0) chartScripts.push(`new Chart(document.getElementById('ch-display'),${barChartJson(topDisp.map(g => cleanName(g.nome)), topDisp.map(g => g.cliques), '#1A3CFF')});`)
  if (ytImpr > 0 && topYT.length > 0) chartScripts.push(`new Chart(document.getElementById('ch-youtube'),${barChartJson(topYT.map(c => cleanName(c.nome)), topYT.map(c => c.videoViews), '#FF4444')});`)
  if (finalTDImpr > 0 && topTD.length > 0) chartScripts.push(`new Chart(document.getElementById('ch-meta-td'),${barChartJson(topTD.map(c => cleanName(c.nome)), topTD.map(c => c.impressions), '#7B2FBE')});`)
  if (hasVPData && topVP.length > 0) chartScripts.push(`new Chart(document.getElementById('ch-meta-vp'),${barChartJson(topVP.map(c => cleanName(c.nome)), topVP.map(c => c.impressions), '#C44A00')});`)
  if (tiktokImpressoes > 0) chartScripts.push(`new Chart(document.getElementById('ch-tiktok'),${JSON.stringify({ type: 'bar', data: { labels: ['Impressões', 'Cliques'], datasets: [{ data: [tiktokImpressoes, tiktokCliques], backgroundColor: ['#00994D', '#00994D66'], borderRadius: 4 }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { grid: { display: false }, ticks: { color: '#888', font: { size: 10 } } }, y: { grid: { color: 'rgba(0,0,0,0.05)' }, ticks: { color: '#555', font: { size: 10 } } } } } })});`)

  // ── Full section template ──
  function fullSection(id: string, color: string, badge: string, title: string, subtitle: string, kpis: string, chartId: string, chartLabel: string, audHtml: string, analysis: string): string {
    return `
<section id="${id}" class="plat-section">
  <div class="slide-inner">
    <div class="sec-head">
      <div class="plat-badge" style="background:${color}18;color:${color}">${badge}</div>
      <h2 class="sec-title">${title}</h2>
      <p class="sec-sub">${subtitle}</p>
    </div>
    <div class="kpi-grid">${kpis}</div>
    <div class="main-grid">
      <div class="chart-col">
        <div class="col-head">${chartLabel}</div>
        <div class="chart-wrap"><canvas id="${chartId}"></canvas></div>
      </div>
      <div class="aud-col">
        <div class="col-head">Perfil de Audiência</div>
        ${audHtml}
      </div>
    </div>
    <div class="analysis" style="border-left-color:${color}"><strong>Análise —</strong> ${analysis}</div>
  </div>
</section>`
  }

  // ── Diagnóstico bullets ──
  const diagItems: string[] = []
  if (dispImpr > 0) diagItems.push(`Google Display entregou <strong>${fmtK(dispImpr)}</strong> impressões com CTR de <strong>${fmtPct2(dispCtr)}</strong> no período.`)
  if (ytViews > 0) diagItems.push(`YouTube registrou <strong>${fmtK(ytViews)}</strong> visualizações${inscritosYT > 0 ? ` e <strong>${fmtK(inscritosYT)}</strong> novos inscritos` : ''}.`)
  if (finalTDImpr > 0) diagItems.push(`Meta Temas Diversos alcançou <strong>${fmtK(finalTDReach)}</strong> usuários únicos com frequência de <strong>${fmtF2(finalTDFreq)}x</strong>.`)
  if (vpImpr > 0) diagItems.push(`Meta Visitas ao Perfil gerou <strong>${fmtK(vpImpr)}</strong> impressões${visitasPerfil > 0 ? ` e <strong>${fmtK(visitasPerfil)}</strong> visitas ao perfil` : ''}.`)
  if (tiktokImpressoes > 0) diagItems.push(`TikTok registrou <strong>${fmtK(tiktokImpressoes)}</strong> impressões com CTR de <strong>${fmtPct2(tiktokCtr)}</strong>.`)
  if (seguidoresSemana > 0) diagItems.push(`Instagram cresceu <strong>${fmtK(seguidoresSemana)}</strong> seguidores na semana${seguidoresMes > 0 ? `, acumulando <strong>${fmtK(seguidoresMes)}</strong> novos no mês` : ''}.`)
  if (!diagItems.length) diagItems.push(`Campanha ativa no período de ${periodoLabel}.`)

  const conclItems = [
    'Manter frequência de publicação e testes A/B de criativos nas campanhas ativas.',
    'Monitorar CTR e ajustar segmentações de audiência para o próximo período.',
    'Avaliar desempenho por grupo de anúncio e reforçar os mais eficientes.',
    'Consolidar aprendizados de alcance e engajamento para a próxima semana.',
  ]

  const safeChartJs = chartJsText.replace(/<\/script>/g, '<\\/script>')

  const showDisplay = secoes.display
  const showYoutube = secoes.youtube
  const showTD = secoes.metaTD
  const showVP = secoes.metaVP
  const showTiktok = secoes.tiktok

  // ── Chips plataformas ativas no hero ──
  const activeChips: string[] = []
  if (showDisplay) activeChips.push(`<span class="hero-chip" style="border-color:#1A3CFF60;color:#6688ff">Google Display</span>`)
  if (showYoutube) activeChips.push(`<span class="hero-chip" style="border-color:#FF444460;color:#ff7777">YouTube</span>`)
  if (showTD) activeChips.push(`<span class="hero-chip" style="border-color:#7B2FBE60;color:#a86fe0">Meta Ads</span>`)
  if (showVP) activeChips.push(`<span class="hero-chip" style="border-color:#C44A0060;color:#e07040">Visitas ao Perfil</span>`)
  if (showTiktok) activeChips.push(`<span class="hero-chip" style="border-color:#00994D60;color:#33cc77">TikTok</span>`)

  const platformasLabel = [
    showDisplay ? 'Display' : '',
    showYoutube ? 'YouTube' : '',
    (showTD || showVP) ? 'Meta' : '',
    showTiktok ? 'TikTok' : '',
  ].filter(Boolean).join(' · ')

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<title>Boletim Semanal — ${cliente} — ${periodoLabel}</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#111;-webkit-print-color-adjust:exact;print-color-adjust:exact}

/* ── Every section fills exactly one page ── */
section{height:100vh;overflow:hidden;display:flex;flex-direction:column;background:#fff}

/* ── HERO ── */
#hero{background:linear-gradient(140deg,#060620 0%,#0d1a6e 50%,#1A3CFF 100%)}
#hero .slide-inner{padding:44px 52px;display:flex;flex-direction:column;flex:1}
.hero-top{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:auto}
.hero-badge{background:rgba(255,255,255,0.14);border:1px solid rgba(255,255,255,0.28);border-radius:20px;padding:5px 15px;font-size:11px;font-weight:600;letter-spacing:1px;text-transform:uppercase;color:rgba(255,255,255,0.88)}
.hero-period{font-size:12px;color:rgba(255,255,255,0.55);margin-top:6px}
.hero-body{margin-bottom:auto}
.hero-title{font-size:2.6rem;font-weight:800;color:#fff;margin-bottom:8px;line-height:1.1}
.hero-sub{font-size:1rem;color:rgba(255,255,255,0.6);margin-bottom:18px}
.hero-chips{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:32px}
.hero-chip{border:1px solid;border-radius:20px;padding:6px 18px;font-size:13px;font-weight:600}
.hero-info{display:flex;gap:32px;margin-top:auto;border-top:1px solid rgba(255,255,255,0.12);padding-top:14px}
.hero-info-item{display:flex;flex-direction:column;gap:3px}
.hero-info-label{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;color:rgba(255,255,255,0.45)}
.hero-info-value{font-size:13px;font-weight:600;color:rgba(255,255,255,0.85)}
#hero .kpi-grid{margin-top:0}
#hero .kpi-card{background:rgba(255,255,255,0.1);border:1px solid rgba(255,255,255,0.18);border-radius:12px;padding:16px 18px}
#hero .kpi-label{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;color:rgba(255,255,255,0.55);margin-bottom:6px}
#hero .kpi-value{font-size:1.8rem;font-weight:800;color:#fff;line-height:1}
#hero .kpi-sub{font-size:10px;color:rgba(255,255,255,0.45);margin-top:4px}

/* ── KPI grid ── */
.kpi-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}
.kpi-card{background:#fff;border-radius:10px;padding:14px 16px;border:1px solid rgba(0,0,0,0.08)}
.kpi-label{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;color:#999;margin-bottom:5px}
.kpi-value{font-size:1.6rem;font-weight:800;color:#111;line-height:1}
.kpi-sub{font-size:10px;color:#bbb;margin-top:3px}

/* ── Platform sections ── */
.plat-section .slide-inner{padding:24px 36px;display:flex;flex-direction:column;flex:1;gap:0}
.sec-head{margin-bottom:10px}
.plat-badge{display:inline-block;border-radius:16px;padding:3px 12px;font-size:10px;font-weight:700;letter-spacing:0.8px;text-transform:uppercase;margin-bottom:6px}
.sec-title{font-size:1.5rem;font-weight:800;margin-bottom:2px;line-height:1.1}
.sec-sub{font-size:11px;color:#999}
.kpi-row{margin:10px 0}

/* ── Main grid: chart + audience ── */
.main-grid{display:flex;gap:14px;flex:1;min-height:0;margin:10px 0}
.chart-col{flex:3;display:flex;flex-direction:column;min-height:0}
.aud-col{flex:2;display:flex;flex-direction:column;min-height:0;overflow:hidden}
.col-head{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;color:#aaa;margin-bottom:8px;flex-shrink:0}
.chart-wrap{flex:1;position:relative;overflow:hidden;background:#fafafa;border:1px solid rgba(0,0,0,0.06);border-radius:8px;padding:8px}
canvas{width:100%!important;height:100%!important;display:block}

/* ── Audience bars ── */
.aud-sec{margin-bottom:12px}
.aud-sec-title{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.7px;color:#bbb;margin-bottom:6px}
.aud-row{display:flex;align-items:center;gap:6px;margin-bottom:5px}
.aud-name{font-size:10px;color:#555;width:82px;flex-shrink:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.aud-bar{flex:1;height:5px;background:#f0f0f0;border-radius:3px;overflow:hidden}
.aud-fill{height:100%;border-radius:3px;transition:width 0.3s}
.aud-pct{font-size:10px;color:#999;width:30px;text-align:right;flex-shrink:0}
.aud-empty{font-size:11px;color:#ccc;font-style:italic;margin-top:8px}

/* ── Analysis box ── */
.analysis{border-left:3px solid #ccc;border-radius:0 6px 6px 0;padding:9px 13px;background:#f9f9fb;font-size:11px;line-height:1.65;color:#444;flex-shrink:0}

/* ── Diagnóstico ── */
#diag .slide-inner{padding:28px 40px;display:flex;flex-direction:column;flex:1}
.diag-cols{display:flex;gap:28px;flex:1;margin-top:14px}
.diag-left,.diag-right{flex:1;display:flex;flex-direction:column}
.diag-list{list-style:none}
.diag-list li{display:flex;align-items:flex-start;gap:10px;padding:9px 0;border-bottom:1px solid #f0f0f0;font-size:0.85rem;line-height:1.55}
.diag-list li::before{content:'✓';color:#00994D;font-weight:800;flex-shrink:0;margin-top:1px}
.concl-list{display:flex;flex-direction:column;gap:8px}
.concl-item{background:#f8f8f8;border-radius:8px;padding:11px 14px;border-left:3px solid #1A3CFF;font-size:0.82rem;line-height:1.5;color:#333}

/* ── Footer strip (inside last section) ── */
.footer-strip{border-top:2px solid #1A3CFF;display:flex;align-items:center;justify-content:center;gap:14px;padding:14px 40px;margin-top:auto}
.footer-strip img{height:28px;opacity:0.8}
.footer-strip p{font-size:10px;color:#aaa}

/* ── Print ── */
@media print{
  *{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}
  @page{size:A4 landscape;margin:10mm}
  section{height:190mm!important;overflow:hidden!important;page-break-after:always;break-after:page}
  #hero{background:linear-gradient(140deg,#060620 0%,#0d1a6e 50%,#1A3CFF 100%)!important}
  #diag{page-break-after:auto!important;break-after:auto!important}
  #hero .slide-inner{padding:28px 36px!important}
  .plat-section .slide-inner{padding:16px 24px!important}
  #diag .slide-inner{padding:20px 28px!important}
  .hero-title{font-size:1.8rem!important}
  .hero-chips{margin-bottom:18px!important}
  .kpi-grid{gap:8px!important}
  .kpi-card{padding:9px 11px!important}
  .kpi-value{font-size:1.25rem!important}
  .kpi-sub{font-size:9px!important}
  #hero .kpi-value{font-size:1.5rem!important}
  .kpi-row{margin:8px 0!important}
  .sec-title{font-size:1.2rem!important}
  .main-grid{margin:8px 0!important;gap:10px!important}
  .analysis{padding:7px 10px!important;font-size:10px!important}
  .aud-row{margin-bottom:4px!important}
  .aud-sec{margin-bottom:8px!important}
  .diag-list li{padding:6px 0!important;font-size:0.78rem!important}
  .concl-item{padding:8px 11px!important;font-size:0.76rem!important}
  .footer-strip{padding:10px 28px!important}
}
</style>
</head>
<body>

<!-- HERO -->
<section id="hero">
  <div class="slide-inner">
    <div class="hero-top">
      <div class="hero-badge">Boletim Semanal</div>
      <div class="hero-period">${periodoLabel}</div>
    </div>
    <div class="hero-body">
      <h1 class="hero-title">${cliente}</h1>
      <p class="hero-sub">Campanha Temas Diversos · Resumo de Performance</p>
        <div class="hero-chips">${activeChips.join('')}</div>
    </div>
    <div class="kpi-grid">
      ${kpiCard('Impressões Totais', fmtK(totalImpr), 'Todas as plataformas')}
      ${kpiCard(inscritosYT > 0 ? 'Novos Inscritos YT' : 'Visualizações YouTube', fmtK(inscritosYT > 0 ? inscritosYT : ytViews), 'No período')}
      ${kpiCard('Visitas ao Perfil', visitasPerfil > 0 ? fmtK(visitasPerfil) : '—', 'Instagram')}
      ${kpiCard('Novos Seguidores', seguidoresSemana > 0 ? fmtK(seguidoresSemana) : '—', seguidoresMes > 0 ? `+${fmtK(seguidoresMes).replace('+', '')} no mês` : 'Instagram')}
    </div>
    <div class="hero-info">
      <div class="hero-info-item"><span class="hero-info-label">Período</span><span class="hero-info-value">${periodoLabel}</span></div>
      <div class="hero-info-item"><span class="hero-info-label">Plataformas</span><span class="hero-info-value">${platformasLabel}</span></div>
      <div class="hero-info-item"><span class="hero-info-label">Agência</span><span class="hero-info-value">Esquina</span></div>
    </div>
  </div>
</section>

${showDisplay ? fullSection('display', '#1A3CFF', 'Google Display', 'Google Display', `Impressões, cliques e CTR · ${periodoLabel}`,
  kpiCard('Impressões', fmtK(dispImpr), 'Total') + kpiCard('Cliques', fmtK(dispCliques), 'Total') + kpiCard('CTR', fmtPct2(dispCtr), 'Taxa de clique') + kpiCard('Grupos Ativos', String(topDisp.length), 'Com entrega'),
  'ch-display', 'Grupos de Anúncio por Cliques', googleAudHtml('#1A3CFF'), analysisDisplay()) : ''}

${showYoutube ? fullSection('youtube', '#FF4444', 'YouTube', 'YouTube', `Visualizações, cliques e inscritos · ${periodoLabel}`,
  kpiCard('Impressões', fmtK(ytImpr), 'Total') + kpiCard('Visualizações', fmtK(ytViews), 'Total') + kpiCard('Cliques', fmtK(ytCliques), 'Total') + kpiCard(ytConv > 0 ? 'Novos Inscritos' : 'Campanhas', ytConv > 0 ? fmtK(ytConv) : String(ytCamps.length), ytConv > 0 ? 'Conversões' : 'Ativas'),
  'ch-youtube', 'Campanhas por Visualizações', googleAudHtml('#FF4444'), analysisYoutube()) : ''}

${showTD ? fullSection('meta-td', '#7B2FBE', 'Meta — Temas Diversos', 'Meta Temas Diversos', `Impressões, alcance e frequência · ${periodoLabel}`,
  kpiCard('Impressões', fmtK(finalTDImpr), 'Total') + kpiCard('Alcance', fmtK(finalTDReach), 'Únicos') + kpiCard('Engajamentos', fmtK(finalTDCliques), 'Cliques') + kpiCard('Frequência', fmtF2(finalTDFreq) + 'x', 'Média'),
  'ch-meta-td', 'Campanhas por Impressões', metaAudHtml('#7B2FBE'), analysisMeta(finalTDImpr, finalTDReach, finalTDCliques, finalTDFreq)) : ''}

${showVP ? fullSection('meta-vp', '#C44A00', 'Meta — Visitas ao Perfil', 'Meta Visitas ao Perfil', `Impressões, alcance e visitas · ${periodoLabel}`,
  kpiCard('Impressões', fmtK(vpImpr), 'Total') + kpiCard('Alcance', fmtK(vpReach), 'Únicos') + kpiCard('Visitas ao Perfil', visitasPerfil > 0 ? fmtK(visitasPerfil) : '—', 'Instagram') + kpiCard('Frequência', fmtF2(vpFreq) + 'x', 'Média'),
  'ch-meta-vp', 'Campanhas por Impressões', metaAudHtml('#C44A00'), analysisVP()) : ''}

${showTiktok ? fullSection('tiktok', '#00994D', 'TikTok', 'TikTok', `Impressões, cliques e CTR · ${periodoLabel}`,
  kpiCard('Impressões', fmtK(tiktokImpressoes), 'Total') + kpiCard('Cliques', fmtK(tiktokCliques), 'Destino') + kpiCard('CTR', fmtPct2(tiktokCtr), 'Taxa de clique') + kpiCard('—', '—', ''),
  'ch-tiktok', 'Impressões vs Cliques', '<p class="aud-empty">Dados demográficos via TikTok Ads Manager</p>', analysisTiktok()) : ''}

${secoes.diagnostico || secoes.conclusao ? `
<section id="diag">
  <div class="slide-inner">
    <div class="sec-head">
      <div class="plat-badge" style="background:#1A3CFF10;color:#1A3CFF">Diagnóstico & Conclusão</div>
      <h2 class="sec-title">Destaques e Próximos Passos</h2>
      <p class="sec-sub">${periodoLabel}</p>
    </div>
    <div class="diag-cols">
      ${secoes.diagnostico ? `
      <div class="diag-left">
        <div class="col-head">Destaques do Período</div>
        <ul class="diag-list">
          ${diagItems.map(item => `<li><span>${item}</span></li>`).join('\n          ')}
        </ul>
      </div>` : ''}
      ${secoes.conclusao ? `
      <div class="diag-right">
        <div class="col-head">Recomendações Operacionais</div>
        <div class="concl-list">
          ${conclItems.map((item, i) => `<div class="concl-item"><strong>${i + 1}.</strong> ${item}</div>`).join('\n          ')}
        </div>
      </div>` : ''}
    </div>
    <div class="footer-strip">
      ${logoB64 ? `<img src="${logoB64}" alt="Esquina">` : ''}
      <p>Boletim Semanal · ${cliente} · ${periodoLabel}</p>
    </div>
  </div>
</section>` : `
<div style="border-top:2px solid #1A3CFF;display:flex;align-items:center;justify-content:center;gap:14px;padding:20px 40px">
  ${logoB64 ? `<img src="${logoB64}" alt="Esquina" style="height:24px;opacity:0.8">` : ''}
  <p style="font-size:10px;color:#aaa">Boletim Semanal · ${cliente} · ${periodoLabel}</p>
</div>`}

<script>${safeChartJs}</script>
<script>
Chart.defaults.animation = false;
Chart.defaults.color = '#888';
Chart.defaults.borderColor = 'rgba(0,0,0,0.05)';
${chartScripts.join('\n')}

window.addEventListener('beforeprint', function() {
  document.querySelectorAll('.chart-wrap canvas').forEach(function(canvas) {
    var chart = Chart.getChart(canvas);
    if (!chart) return;
    var wrap = canvas.closest('.chart-wrap');
    var h = wrap ? wrap.clientHeight : 220;
    if (h < 80) h = 180;
    var w = wrap ? wrap.clientWidth - 16 : 500;
    canvas.width = w; canvas.height = h;
    chart.resize(w, h); chart.draw();
  });
});
</script>
</body>
</html>`
}

function RelatorioSemanalModal({ onClose }: { onClose: () => void }) {
  const [clienteInput, setClienteInput2] = useState('')
  const [clienteSelecionado, setClienteSelecionado2] = useState<string | null>(null)
  const [todosNomes2, setTodosNomes2] = useState<string[]>([])
  const [showSugestoes2, setShowSugestoes2] = useState(false)
  const [loadingNomes2, setLoadingNomes2] = useState(true)
  const [secoes, setSecoes] = useState({ display: true, youtube: true, metaTD: true, metaVP: true, tiktok: false, diagnostico: true, conclusao: true })
  const [periodoStart, setPeriodoStart] = useState('')
  const [periodoEnd, setPeriodoEnd] = useState('')
  const [seguidoresSemana, setSeguidoresSemana] = useState('')
  const [seguidoresMes, setSeguidoresMes] = useState('')
  const [visitasPerfil, setVisitasPerfil] = useState('')
  const [tiktokImpressoes, setTiktokImpressoes] = useState('')
  const [tiktokCliques, setTiktokCliques] = useState('')
  const [gerando, setGerando] = useState(false)
  const [erro, setErro] = useState('')

  const podeGerar = !!clienteSelecionado && !!periodoStart && !!periodoEnd

  useEffect(() => {
    // Default: last 7 days
    const hoje = new Date(); hoje.setHours(0, 0, 0, 0)
    const start = new Date(hoje); start.setDate(start.getDate() - 6)
    setPeriodoStart(start.toISOString().slice(0, 10))
    setPeriodoEnd(hoje.toISOString().slice(0, 10))
  }, [])

  useEffect(() => {
    const hoje = new Date(); hoje.setHours(0, 0, 0, 0)
    const start = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-01`
    const end = hoje.toISOString().slice(0, 10)
    Promise.all([
      fetch(`/api/meta-ads?start=${start}&end=${end}`).then(r => r.json()).catch(() => ({})),
      fetch(`/api/google-ads?start=${start}&end=${end}`).then(r => r.json()).catch(() => ({})),
    ]).then(([meta, google]) => {
      const merged = [...new Set([...(meta.data ?? []).map((a: any) => a.nome), ...(google.data ?? []).map((a: any) => a.nome)])].sort()
      setTodosNomes2(merged as string[])
      setLoadingNomes2(false)
    })
  }, [])

  const sugestoes2 = clienteInput.trim() ? todosNomes2.filter(n => n.toLowerCase().includes(clienteInput.toLowerCase())) : todosNomes2

  function toggleSecao(k: keyof typeof secoes) { setSecoes(p => ({ ...p, [k]: !p[k] })) }

  async function gerar() {
    if (!clienteSelecionado || !periodoStart || !periodoEnd) return
    setGerando(true); setErro('')
    try {
      const [metaRes, googleRes, chartJsText, logoData] = await Promise.all([
        fetch(`/api/meta-ads?start=${periodoStart}&end=${periodoEnd}`).then(r => r.json()).catch(() => ({ data: [] })),
        fetch(`/api/google-ads?start=${periodoStart}&end=${periodoEnd}`).then(r => r.json()).catch(() => ({ data: [] })),
        fetch('https://cdn.jsdelivr.net/npm/chart.js@4.4.7/dist/chart.umd.min.js').then(r => r.text()).catch(() => ''),
        fetch('/logo-esquina.png').then(r => r.arrayBuffer()).then(buf => {
          let binary = ''
          new Uint8Array(buf).forEach(b => { binary += String.fromCharCode(b) })
          return `data:image/png;base64,${btoa(binary)}`
        }).catch(() => ''),
      ])

      const metaDados = (metaRes.data ?? []).filter((a: any) => a.nome === clienteSelecionado)
      const googleDados = (googleRes.data ?? []).filter((a: any) => a.nome === clienteSelecionado)

      const html = buildRelatorioHTML({
        cliente: clienteSelecionado,
        periodoStart, periodoEnd,
        metaDados, googleDados, secoes,
        seguidoresSemana: Number(seguidoresSemana) || 0,
        seguidoresMes: Number(seguidoresMes) || 0,
        visitasPerfil: Number(visitasPerfil) || 0,
        tiktokImpressoes: Number(tiktokImpressoes) || 0,
        tiktokCliques: Number(tiktokCliques) || 0,
        chartJsText,
        logoB64: logoData,
      })

      const newWin = window.open('', '_blank')
      if (!newWin) { setErro('Popup bloqueado pelo navegador. Permita popups neste site e tente novamente.'); setGerando(false); return }
      newWin.document.write(html)
      newWin.document.close()
      setTimeout(() => { try { newWin.print() } catch {} }, 1500)
      onClose()
    } catch (e) {
      console.error(e)
      setErro('Erro ao gerar o relatório. Verifique a conexão e tente novamente.')
    } finally {
      setGerando(false)
    }
  }

  const inputStyle = { width: '100%', background: '#1a1a1a', border: '1px solid #2a2a2a', color: '#e8e8e8', borderRadius: 8, padding: '9px 12px', fontSize: 13, outline: 'none', boxSizing: 'border-box' as const }
  const labelStyle = { fontSize: 11, fontWeight: 700 as const, color: '#555', textTransform: 'uppercase' as const, letterSpacing: 0.8, marginBottom: 8, display: 'block' }

  const SECOES_LABELS: Array<[keyof typeof secoes, string]> = [
    ['display', 'Google Display'],
    ['youtube', 'YouTube'],
    ['metaTD', 'Meta Temas Diversos'],
    ['metaVP', 'Meta Visitas ao Perfil'],
    ['tiktok', 'TikTok'],
    ['diagnostico', 'Diagnóstico'],
    ['conclusao', 'Conclusão'],
  ]

  return (
    <div onClick={e => { if (e.target === e.currentTarget) onClose() }}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.82)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ background: '#161616', border: '1px solid #2a2a2a', borderRadius: 14, padding: 28, width: '100%', maxWidth: 560, maxHeight: '92vh', overflowY: 'auto' }}>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 22 }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#e8e8e8' }}>Relatório Semanal</div>
            <div style={{ fontSize: 12, color: '#555', marginTop: 3 }}>Gera slides HTML com print automático (A4 paisagem)</div>
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: '#555', cursor: 'pointer', fontSize: 22, lineHeight: 1, padding: 0, marginTop: -2 }}>×</button>
        </div>

        {/* Cliente */}
        <div style={{ marginBottom: 16, position: 'relative' }}>
          <span style={labelStyle}>Cliente <span style={{ color: '#f87171' }}>*</span></span>
          <input
            placeholder={loadingNomes2 ? 'Carregando...' : 'Buscar cliente...'}
            value={clienteInput}
            disabled={loadingNomes2}
            autoComplete="off"
            onChange={e => { setClienteInput2(e.target.value); setClienteSelecionado2(null); setShowSugestoes2(true) }}
            onFocus={() => setShowSugestoes2(true)}
            onBlur={() => setTimeout(() => setShowSugestoes2(false), 150)}
            style={{ ...inputStyle, background: clienteSelecionado ? '#0f2e1a' : '#1a1a1a', border: `1px solid ${clienteSelecionado ? '#22c55e55' : '#2a2a2a'}` }}
          />
          {clienteSelecionado && <div style={{ fontSize: 11, color: '#4ade80', marginTop: 4 }}>✓ {clienteSelecionado}</div>}
          {showSugestoes2 && sugestoes2.length > 0 && !clienteSelecionado && (
            <div style={{ position: 'absolute', top: 'calc(100% - 4px)', left: 0, right: 0, background: '#1e1e1e', border: '1px solid #2a2a2a', borderRadius: 8, zIndex: 100, maxHeight: 180, overflowY: 'auto', marginTop: 4, boxShadow: '0 8px 24px rgba(0,0,0,0.5)' }}>
              {sugestoes2.map(nome => (
                <div key={nome} onMouseDown={() => { setClienteSelecionado2(nome); setClienteInput2(nome); setShowSugestoes2(false) }}
                  style={{ padding: '8px 12px', fontSize: 13, color: '#ddd', cursor: 'pointer', borderBottom: '1px solid #222' }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#2a2a2a')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                  {nome}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Período */}
        <div style={{ marginBottom: 16 }}>
          <span style={labelStyle}>Período <span style={{ color: '#f87171' }}>*</span></span>
          <div style={{ display: 'flex', gap: 8 }}>
            <input type="date" value={periodoStart} onChange={e => setPeriodoStart(e.target.value)} style={{ ...inputStyle, flex: 1 }} />
            <input type="date" value={periodoEnd} onChange={e => setPeriodoEnd(e.target.value)} style={{ ...inputStyle, flex: 1 }} />
          </div>
        </div>

        {/* Seções */}
        <div style={{ marginBottom: 16 }}>
          <span style={labelStyle}>Seções</span>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
            {SECOES_LABELS.map(([key, label]) => (
              <label key={key} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', background: secoes[key] ? '#1a2a1a' : '#1a1a1a', border: `1px solid ${secoes[key] ? '#2a4a2a' : '#2a2a2a'}`, borderRadius: 7, padding: '7px 10px', transition: 'all 0.15s' }}>
                <input type="checkbox" checked={secoes[key]} onChange={() => toggleSecao(key)} style={{ accentColor: '#22c55e', width: 14, height: 14 }} />
                <span style={{ fontSize: 12, color: secoes[key] ? '#86efac' : '#666', fontWeight: 500 }}>{label}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Dados manuais */}
        <div style={{ marginBottom: 20 }}>
          <span style={labelStyle}>Dados manuais</span>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {[
              ['Seguidores novos (semana)', seguidoresSemana, setSeguidoresSemana],
              ['Seguidores novos (mês)', seguidoresMes, setSeguidoresMes],
              ['Visitas ao perfil', visitasPerfil, setVisitasPerfil],
              ['TikTok – Impressões', tiktokImpressoes, setTiktokImpressoes],
              ['TikTok – Cliques', tiktokCliques, setTiktokCliques],
            ].map(([label, val, setter]) => (
              <div key={label as string}>
                <div style={{ fontSize: 10, color: '#555', marginBottom: 4 }}>{label as string}</div>
                <input
                  type="number" placeholder="0"
                  value={val as string}
                  onChange={e => (setter as React.Dispatch<React.SetStateAction<string>>)(e.target.value)}
                  style={{ ...inputStyle, padding: '7px 10px', fontSize: 12 }}
                />
              </div>
            ))}
          </div>
        </div>

        {erro && <div style={{ fontSize: 12, color: '#f87171', marginBottom: 12 }}>{erro}</div>}

        <button onClick={gerar} disabled={gerando || !podeGerar}
          style={{ width: '100%', padding: '11px 0', borderRadius: 9, fontSize: 14, fontWeight: 700, cursor: gerando || !podeGerar ? 'not-allowed' : 'pointer', border: 'none', background: gerando || !podeGerar ? '#252525' : '#1A3CFF', color: gerando || !podeGerar ? '#555' : '#fff', transition: 'all 0.15s' }}>
          {gerando ? 'Buscando dados e gerando...' : 'Gerar Relatório (PDF)'}
        </button>
        <div style={{ fontSize: 11, color: '#555', marginTop: 8, textAlign: 'center' }}>Abre em nova aba → aciona impressão automática → salvar como PDF</div>
      </div>
    </div>
  )
}

// ─── Modal ─────────────────────────────────────────────────────────────────────
function RelatorioModal({ onClose }: { onClose: () => void }) {
  const [clienteInput, setClienteInput] = useState('')
  const [clienteSelecionado, setClienteSelecionado] = useState<string | null>(null)
  const [todosNomes, setTodosNomes] = useState<string[]>([])
  const [showSugestoes, setShowSugestoes] = useState(false)
  const [loadingNomes, setLoadingNomes] = useState(true)
  const [redes, setRedes] = useState({ meta: true, google: false, tiktok: false })
  const [preset, setPreset] = useState<PresetWA>('mes-atual')
  const [custom, setCustom] = useState({ start: '', end: '' })
  const [incluirValores, setIncluirValores] = useState(false)
  const [loading, setLoading] = useState(false)
  const [mensagem, setMensagem] = useState('')
  const [copiado, setCopiado] = useState(false)
  const [erro, setErro] = useState('')

  const periodo = getPeriodoWA(preset, custom)
  const podeGerar = !!clienteSelecionado && (redes.meta || redes.google || redes.tiktok) && (preset !== 'personalizado' || (!!custom.start && !!custom.end))

  // Carrega nomes dos dois APIs ao abrir o modal (usa cache de 30min do servidor)
  useEffect(() => {
    const hoje = new Date(); hoje.setHours(0, 0, 0, 0)
    const start = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-01`
    const end = hoje.toISOString().slice(0, 10)
    Promise.all([
      fetch(`/api/meta-ads?start=${start}&end=${end}`).then(r => r.json()).catch(() => ({})),
      fetch(`/api/google-ads?start=${start}&end=${end}`).then(r => r.json()).catch(() => ({})),
      fetch(`/api/tiktok-ads?start=${start}&end=${end}`).then(r => r.json()).catch(() => ({})),
    ]).then(([meta, google, tiktok]) => {
      const metaNomes: string[] = (meta.data ?? []).map((a: any) => a.nome)
      const googleNomes: string[] = (google.data ?? []).map((a: any) => a.nome)
      const tiktokNomes: string[] = (tiktok.data ?? []).map((a: any) => a.nome)
      const merged = [...new Set([...metaNomes, ...googleNomes, ...tiktokNomes])].sort()
      setTodosNomes(merged)
      setLoadingNomes(false)
    })
  }, [])

  const sugestoes = clienteInput.trim()
    ? todosNomes.filter(n => n.toLowerCase().includes(clienteInput.toLowerCase()))
    : todosNomes

  async function gerarRelatorio() {
    if (!clienteSelecionado) return
    setLoading(true); setMensagem(''); setErro('')

    let metaDados: any[] = []
    let googleDados: any[] = []
    let tiktokDados: any[] = []
    const fetches: Promise<void>[] = []

    if (redes.meta) {
      fetches.push(
        fetch(`/api/meta-ads?start=${periodo.start}&end=${periodo.end}`)
          .then(r => r.json())
          .then(res => { if (!res.error) metaDados = (res.data ?? []).filter((a: any) => a.nome === clienteSelecionado) })
          .catch(() => setErro('Erro ao buscar dados do Meta Ads.'))
      )
    }
    if (redes.google) {
      fetches.push(
        fetch(`/api/google-ads?start=${periodo.start}&end=${periodo.end}`)
          .then(r => r.json())
          .then(res => { if (!res.error) googleDados = (res.data ?? []).filter((a: any) => a.nome === clienteSelecionado) })
          .catch(() => setErro(prev => prev || 'Erro ao buscar dados do Google Ads.'))
      )
    }
    if (redes.tiktok) {
      fetches.push(
        fetch(`/api/tiktok-ads?start=${periodo.start}&end=${periodo.end}`)
          .then(r => r.json())
          .then(res => { if (!res.error) tiktokDados = (res.data ?? []).filter((a: any) => a.nome === clienteSelecionado) })
          .catch(() => setErro(prev => prev || 'Erro ao buscar dados do TikTok.'))
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

    // Audiência Meta: agrega por breakdown entre as contas filtradas
    const audGenero = new Map<string, number>()
    const audIdade = new Map<string, number>()
    const audDisp = new Map<string, number>()
    for (const acc of metaDados) {
      for (const item of acc.audiencia?.genero ?? []) audGenero.set(item.label, (audGenero.get(item.label) ?? 0) + item.impressions)
      for (const item of acc.audiencia?.idade ?? []) audIdade.set(item.label, (audIdade.get(item.label) ?? 0) + item.impressions)
      for (const item of acc.audiencia?.dispositivos ?? []) audDisp.set(item.label, (audDisp.get(item.label) ?? 0) + item.impressions)
    }
    function fmtBreakdown(map: Map<string, number>): string[] {
      const total = Array.from(map.values()).reduce((s, v) => s + v, 0)
      return Array.from(map.entries())
        .sort((a, b) => b[1] - a[1])
        .map(([label, v]) => `${label}: ${total > 0 ? Math.round((v / total) * 100) : 0}%`)
    }

    // ── Totais Google ──
    const gCusto = googleDados.reduce((s: number, a: any) => s + (a.custo ?? 0), 0)
    const gCliques = googleDados.reduce((s: number, a: any) => s + (a.cliques ?? 0), 0)
    const gImpr = googleDados.reduce((s: number, a: any) => s + (a.impressoes ?? 0), 0)
    const gConv = googleDados.reduce((s: number, a: any) => s + (a.conversoes ?? 0), 0)
    const gCtr = gImpr > 0 ? (gCliques / gImpr) * 100 : 0
    const gCpc = gCliques > 0 ? gCusto / gCliques : 0
    const gCustoConv = gConv > 0 ? gCusto / gConv : 0

    // Cidades Google: agrega cliques por cidade entre as contas filtradas
    const cidadesMap = new Map<string, number>()
    for (const acc of googleDados) {
      for (const c of acc.cidades ?? []) cidadesMap.set(c.nome, (cidadesMap.get(c.nome) ?? 0) + c.cliques)
    }
    const topCidades = Array.from(cidadesMap.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5)

    // ── Top 3 criativos Meta (por impressões) ──
    const allMetaAds: any[] = metaDados.flatMap((a: any) => a.ads ?? [])
    allMetaAds.sort((a: any, b: any) => (b.impressions ?? 0) - (a.impressions ?? 0))
    const top3Meta = allMetaAds.slice(0, 3)

    // ── Top 3 criativos Google (por cliques) ──
    const allGoogleAds: any[] = googleDados.flatMap((a: any) => a.anuncios ?? [])
    allGoogleAds.sort((a: any, b: any) => (b.cliques ?? 0) - (a.cliques ?? 0))
    const top3Google = allGoogleAds.slice(0, 3)

    // ── Totais TikTok ──
    const tkSpend = tiktokDados.reduce((s: number, a: any) => s + (a.spend ?? 0), 0)
    const tkImpr = tiktokDados.reduce((s: number, a: any) => s + (a.impressions ?? 0), 0)
    const tkCliques = tiktokDados.reduce((s: number, a: any) => s + (a.clicks ?? 0), 0)
    const tkCtr = tkImpr > 0 ? (tkCliques / tkImpr) * 100 : 0
    const tkCpm = tkSpend > 0 && tkImpr > 0 ? (tkSpend / tkImpr) * 1000 : 0
    const tkCpc = tkCliques > 0 ? tkSpend / tkCliques : 0

    const plataformas = [redes.meta && 'Meta Ads', redes.google && 'Google Ads', redes.tiktok && 'TikTok'].filter(Boolean).join(' + ')
    const cabecalho = `${clienteSelecionado.toUpperCase()} - ${plataformas} - ${periodo.label}`

    const L: string[] = []
    L.push(cabecalho)
    L.push('')

    // ── Visão Geral (consolidado Meta + Google + TikTok) ──
    const totalImpr = metaImpr + gImpr + tkImpr
    const totalCliques = metaClicks + gCliques + tkCliques
    const totalInvest = metaSpend + gCusto + tkSpend
    const redesSel = [redes.meta && 'Meta', redes.google && 'Google', redes.tiktok && 'TikTok'].filter(Boolean) as string[]
    const labelVG = redesSel.length > 1 ? `* Visão Geral (${redesSel.join(' + ')})` : '* Visão Geral'
    L.push(labelVG)
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
        L.push(`Cliques: ${fmtN(metaClicks)}`)
        L.push(`CTR: ${fmtPctn(metaCtr)}`)
        if (metaThru > 0) L.push(`ThruPlays: ${fmtN(metaThru)}`)
        if (incluirValores) {
          L.push(`Investimento: ${fmtBRLn(metaSpend)}`)
          if (metaCpm > 0) L.push(`CPM: ${fmtBRLn(metaCpm)}`)
          if (metaCpc > 0) L.push(`CPC: ${fmtBRLn(metaCpc)}`)
        }
        L.push('')

        // Audiência Meta — alcance, frequência, gênero, idade, dispositivos
        L.push('👥 Audiência')
        if (metaReach > 0) L.push(`Alcance: ${fmtN(metaReach)}`)
        if (metaFreq > 0) L.push(`Frequência: ${fmtF(metaFreq)}`)
        const generoLines = fmtBreakdown(audGenero)
        const idadeLines = fmtBreakdown(audIdade)
        const dispLines = fmtBreakdown(audDisp)
        if (generoLines.length) { L.push(''); L.push('Gênero'); generoLines.forEach(l => L.push(l)) }
        if (idadeLines.length) { L.push(''); L.push('Faixa etária'); idadeLines.forEach(l => L.push(l)) }
        if (dispLines.length) { L.push(''); L.push('Dispositivos'); dispLines.forEach(l => L.push(l)) }
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

        // Audiência Google — exposição + cidades
        L.push('👥 Audiência')
        L.push(`Exposição: ${fmtN(gImpr)} impressões`)
        if (gConv > 0 && gCliques > 0) L.push(`Taxa de conversão: ${fmtPctn((gConv / gCliques) * 100)}`)
        if (topCidades.length > 0) {
          L.push('')
          L.push('Top cidades')
          topCidades.forEach(([nome, cliques]) => L.push(`${nome}: ${fmtN(cliques)} cliques`))
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

    // ── TikTok ──
    if (redes.tiktok) {
      if (!tiktokDados.length) {
        L.push('📱 Desempenho TikTok')
        L.push('Nenhum dado encontrado para o período.')
        L.push('')
      } else {
        L.push('📱 Desempenho TikTok')
        L.push(`Impressões: ${fmtN(tkImpr)}`)
        L.push(`Cliques: ${fmtN(tkCliques)}`)
        L.push(`CTR: ${fmtPctn(tkCtr)}`)
        if (incluirValores) {
          L.push(`Investimento: ${fmtBRLn(tkSpend)}`)
          if (tkCpm > 0) L.push(`CPM: ${fmtBRLn(tkCpm)}`)
          if (tkCpc > 0) L.push(`CPC: ${fmtBRLn(tkCpc)}`)
        }
        L.push('')
      }
    }

    // ── Desempenho Geral ──
    L.push('Desempenho Geral')
    const partes: string[] = []
    if (redes.meta && metaDados.length) partes.push(`Meta Ads com ${fmtN(metaImpr)} impressões e ${fmtN(metaClicks)} cliques`)
    if (redes.google && googleDados.length) partes.push(`Google Ads com ${fmtN(gCliques)} cliques e CTR de ${fmtPctn(gCtr)}`)
    if (redes.tiktok && tiktokDados.length) partes.push(`TikTok com ${fmtN(tkImpr)} impressões e CTR de ${fmtPctn(tkCtr)}`)
    if (partes.length > 0) L.push(partes.join('; ') + '.')
    if (incluirValores && totalInvest > 0) {
      L.push(`Investimento total no período: ${fmtBRLn(totalInvest)}.`)
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

        {/* Cliente — autocomplete obrigatório */}
        <div style={{ marginBottom: 16, position: 'relative' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#555', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 }}>
            Cliente <span style={{ color: '#f87171' }}>*</span>
          </div>
          <input
            placeholder={loadingNomes ? 'Carregando clientes...' : 'Buscar cliente...'}
            value={clienteInput}
            disabled={loadingNomes}
            autoComplete="off"
            onChange={e => { setClienteInput(e.target.value); setClienteSelecionado(null); setShowSugestoes(true) }}
            onFocus={() => setShowSugestoes(true)}
            onBlur={() => setTimeout(() => setShowSugestoes(false), 150)}
            style={{ width: '100%', background: clienteSelecionado ? '#0f2e1a' : '#1a1a1a', border: `1px solid ${clienteSelecionado ? '#22c55e55' : '#2a2a2a'}`, color: '#e8e8e8', borderRadius: 8, padding: '9px 12px', fontSize: 13, outline: 'none', boxSizing: 'border-box', transition: 'all 0.15s' }}
          />
          {clienteSelecionado && (
            <div style={{ fontSize: 11, color: '#4ade80', marginTop: 5 }}>✓ {clienteSelecionado}</div>
          )}
          {!clienteSelecionado && !loadingNomes && (
            <div style={{ fontSize: 11, color: '#555', marginTop: 5 }}>Selecione um cliente para filtrar os dados corretamente</div>
          )}
          {showSugestoes && sugestoes.length > 0 && !clienteSelecionado && (
            <div style={{ position: 'absolute', top: 'calc(100% - 8px)', left: 0, right: 0, background: '#1e1e1e', border: '1px solid #2a2a2a', borderRadius: 8, zIndex: 100, maxHeight: 200, overflowY: 'auto', marginTop: 4, boxShadow: '0 8px 24px rgba(0,0,0,0.5)' }}>
              {sugestoes.map(nome => (
                <div
                  key={nome}
                  onMouseDown={() => { setClienteSelecionado(nome); setClienteInput(nome); setShowSugestoes(false) }}
                  style={{ padding: '9px 12px', fontSize: 13, color: '#ddd', cursor: 'pointer', borderBottom: '1px solid #222', transition: 'background 0.1s' }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#2a2a2a')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  {nome}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Redes */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#555', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 }}>Redes</div>
          <div style={{ display: 'flex', gap: 8 }}>
            {(['meta', 'google', 'tiktok'] as const).map(r => {
              const ativo = redes[r]
              const cor = r === 'tiktok' ? '#00994D' : '#1A3CFF'
              const corText = r === 'tiktok' ? '#00cc66' : '#7ba3ff'
              const label = r === 'meta' ? 'Meta Ads' : r === 'google' ? 'Google Ads' : 'TikTok'
              return (
                <button key={r} onClick={() => setRedes(p => ({ ...p, [r]: !p[r] }))}
                  style={{ flex: 1, padding: '9px 0', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', border: `1px solid ${ativo ? cor : '#2a2a2a'}`, background: ativo ? `${cor}18` : 'transparent', color: ativo ? corText : '#555', transition: 'all 0.15s' }}>
                  {label}
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
  const [showRelatorioSemanal, setShowRelatorioSemanal] = useState(false)
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
    document.cookie = '__session=; path=/; max-age=0'
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
        <button onClick={() => setActiveTab('tiktok')} style={{ height: 32, padding: '0 16px', borderRadius: 7, fontSize: 13, fontWeight: 600, cursor: 'pointer', border: 'none', transition: 'all 0.15s', background: activeTab === 'tiktok' ? '#00994D' : '#252525', color: activeTab === 'tiktok' ? '#fff' : '#999', outline: activeTab !== 'tiktok' ? '1px solid #333' : 'none' }}>TikTok</button>
        <button onClick={() => setShowRelatorio(true)} title="Gerar relatório para WhatsApp" style={{ height: 32, padding: '0 14px', borderRadius: 7, fontSize: 13, fontWeight: 600, cursor: 'pointer', border: '1px solid #2a4a2a', transition: 'all 0.15s', background: '#1a2e1a', color: '#4ade80', display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 14 }}>✉</span> Relatório WA
        </button>
        <button onClick={() => setShowRelatorioSemanal(true)} title="Gerar boletim semanal PDF" style={{ height: 32, padding: '0 14px', borderRadius: 7, fontSize: 13, fontWeight: 600, cursor: 'pointer', border: '1px solid #2a3a4a', transition: 'all 0.15s', background: '#1a2030', color: '#7ba3ff', display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 14 }}>📄</span> Boletim PDF
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
      <div style={{ flex: 1, overflow: 'hidden', display: activeTab === 'tiktok' ? 'flex' : 'none', flexDirection: 'column' }}>
        <TikTokAdsPage theme={theme} visible={activeTab === 'tiktok'} />
      </div>

      {showRelatorio && <RelatorioModal onClose={() => setShowRelatorio(false)} />}
      {showRelatorioSemanal && <RelatorioSemanalModal onClose={() => setShowRelatorioSemanal(false)} />}
    </div>
  )
}

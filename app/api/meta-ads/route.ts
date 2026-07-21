import { NextRequest, NextResponse } from 'next/server'
import { readCache, writeCache } from '@/lib/cache'

const TOKEN = process.env.META_ACCESS_TOKEN ?? ''
// Token de um usuário de sistema diferente (ex.: contas de cliente compartilhadas com
// outro negócio, como o Kalil/PDT compartilhado só com o "Esquina API" da Algoritmica).
const TOKEN2 = process.env.META_ACCESS_TOKEN_2 ?? ''
const API = 'https://graph.facebook.com/v21.0'

interface MetaAccountRef { id: string; nome: string; moeda: string }

// Nomes "bonitos" opcionais por ID — vencem o nome da API quando preenchidos.
// No Meta o `name` da conta já costuma ser bom; preencher só quando vier nome interno feio.
const NAME_OVERRIDES: Record<string, string> = {
  '930277249802740': 'Algoritmica Backup 01', // API devolve "ALGORITMICA_BACKUP01"
}

// Contas que NÃO devem aparecer no painel mesmo tendo gasto (deny-list opcional).
const DENY_IDS = new Set<string>()

// Executa tarefas com limite de concorrência (evita estourar rate limit ao listar muitas contas)
async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T, i: number) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length)
  let next = 0
  async function worker() {
    while (next < items.length) {
      const i = next++
      results[i] = await fn(items[i], i)
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => worker()))
  return results
}

// Descobre todas as contas de anúncio acessíveis por um token (segue paginação)
async function discoverAccounts(token: string): Promise<MetaAccountRef[]> {
  const out: MetaAccountRef[] = []
  let url: string | null = `${API}/me/adaccounts?fields=account_id,name,currency&limit=200&access_token=${encodeURIComponent(token)}`
  let guard = 0
  while (url && guard < 25) {
    guard++
    const res = await fetch(url, { next: { revalidate: 0 } })
    const json: any = await res.json()
    if (json.error) throw new Error(`Meta /me/adaccounts: ${json.error.message}`)
    for (const a of json.data ?? []) {
      const id = String(a.account_id ?? '').replace(/^act_/, '')
      if (!id || DENY_IDS.has(id)) continue
      out.push({ id, nome: (NAME_OVERRIDES[id] ?? a.name ?? `Conta ${id}`).trim(), moeda: a.currency ?? 'BRL' })
    }
    url = json.paging?.next ?? null
  }
  return out
}

// Descobre contas em todos os tokens configurados; primeira ocorrência de cada conta vence.
async function discoverAllAccounts(): Promise<{ accounts: MetaAccountRef[]; tokenFor: Map<string, string> }> {
  const tokenFor = new Map<string, string>()
  const accounts: MetaAccountRef[] = []
  for (const token of [TOKEN, TOKEN2].filter(Boolean)) {
    // Um token inválido não pode derrubar as contas do(s) outro(s) token(s).
    const found = await discoverAccounts(token).catch(e => {
      console.error('Meta discoverAccounts falhou para um dos tokens:', e)
      return []
    })
    for (const acc of found) {
      if (tokenFor.has(acc.id)) continue
      tokenFor.set(acc.id, token)
      accounts.push(acc)
    }
  }
  return { accounts, tokenFor }
}

function parseThruplays(actions: any[]): number {
  if (!Array.isArray(actions)) return 0
  const v = actions.find((a: any) => a.action_type === 'video_view')
  return v ? parseInt(v.value ?? '0', 10) : 0
}

// effective_status do anúncio → rótulo PT-BR para a coluna de status
function metaStatusLabel(s: string): string {
  switch (s) {
    case 'ACTIVE': return 'Ativo'
    case 'PAUSED': case 'CAMPAIGN_PAUSED': case 'ADSET_PAUSED': return 'Pausado'
    case 'PENDING_REVIEW': case 'IN_PROCESS': return 'Em análise'
    case 'DISAPPROVED': return 'Reprovado'
    case 'WITH_ISSUES': return 'Com problemas'
    case 'PREAPPROVED': return 'Pré-aprovado'
    case 'PENDING_BILLING_INFO': return 'Pendente faturamento'
    case 'ARCHIVED': case 'DELETED': return 'Arquivado'
    default: return 'Ativo'
  }
}

// ad_review_feedback vem como objeto aninhado (global / placement_specific) com textos
// legíveis do motivo da reprovação. Achata todos os textos num só string.
function extractReviewFeedback(fb: any): string {
  if (!fb || typeof fb !== 'object') return ''
  const msgs: string[] = []
  const collect = (obj: any) => {
    if (!obj || typeof obj !== 'object') return
    for (const v of Object.values(obj)) {
      if (typeof v === 'string') msgs.push(v.trim())
      else if (v && typeof v === 'object') collect(v)
    }
  }
  collect(fb)
  return Array.from(new Set(msgs.filter(Boolean))).join(' · ')
}

// Busca effective_status + orçamento de campanhas/conjuntos (o /insights não traz nenhum dos dois).
// Retorna Map<id, { status, orcamento, orcamentoTipo }>. Falha não quebra a tabela.
// daily_budget/lifetime_budget vêm em centavos (menor unidade da moeda).
interface EntityMeta { status: string; orcamento: number; orcamentoTipo: 'diario' | 'total' | ''; objective?: string }
async function fetchEntityMeta(accountId: string, edge: 'campaigns' | 'adsets', token: string): Promise<Map<string, EntityMeta>> {
  const map = new Map<string, EntityMeta>()
  const fields = edge === 'campaigns' ? 'id,effective_status,daily_budget,lifetime_budget,objective' : 'id,effective_status,daily_budget,lifetime_budget'
  let url: string | null = `${API}/act_${accountId}/${edge}?fields=${fields}&limit=500&access_token=${encodeURIComponent(token)}`
  let guard = 0
  while (url && guard < 20) {
    guard++
    const res = await fetch(url, { next: { revalidate: 0 } })
    const json: any = await res.json()
    if (json.error) break
    for (const a of json.data ?? []) {
      const id = String(a.id ?? '')
      if (!id) continue
      const daily = parseInt(a.daily_budget ?? '0', 10)
      const life = parseInt(a.lifetime_budget ?? '0', 10)
      const orcamento = daily > 0 ? daily / 100 : life > 0 ? life / 100 : 0
      const orcamentoTipo: 'diario' | 'total' | '' = daily > 0 ? 'diario' : life > 0 ? 'total' : ''
      map.set(id, { status: a.effective_status ?? 'ACTIVE', orcamento, orcamentoTipo, objective: a.objective ?? '' })
    }
    url = json.paging?.next ?? null
  }
  return map
}

// Busca status de revisão dos anúncios (o endpoint /insights não traz isso).
// Retorna Map<ad_id, { effective_status, motivo }>. Falha não quebra a tabela.
async function fetchAdStatuses(accountId: string, token: string): Promise<Map<string, { effective_status: string; motivo: string }>> {
  const map = new Map<string, { effective_status: string; motivo: string }>()
  let url: string | null = `${API}/act_${accountId}/ads?fields=id,effective_status,ad_review_feedback&limit=500&access_token=${encodeURIComponent(token)}`
  let guard = 0
  while (url && guard < 20) {
    guard++
    const res = await fetch(url, { next: { revalidate: 0 } })
    const json: any = await res.json()
    if (json.error) break
    for (const a of json.data ?? []) {
      const id = String(a.id ?? '')
      if (!id) continue
      map.set(id, { effective_status: a.effective_status ?? 'ACTIVE', motivo: extractReviewFeedback(a.ad_review_feedback) })
    }
    url = json.paging?.next ?? null
  }
  return map
}

export interface MetaDailyPoint {
  date: string
  spend: number
  impressions: number
  reach: number
  clicks: number
  cpm: number
  ctr: number
  cpc: number
  frequency: number
  thruplays: number
  cpv: number
}

export interface MetaCampaignData {
  id: string
  nome: string
  status: string
  statusRevisao: string
  objective: string
  orcamento: number
  orcamentoTipo: 'diario' | 'total' | ''
  spend: number
  impressions: number
  reach: number
  clicks: number
  ctr: number
  cpm: number
  cpc: number
  frequency: number
  thruplays: number
  engajamento: number
  cpe: number
  cpv: number
  taxaVisualizacao: number
}

export interface MetaAdSetData {
  id: string
  nome: string
  campanha: string
  status: string
  statusRevisao: string
  orcamento: number
  orcamentoTipo: 'diario' | 'total' | ''
  spend: number
  impressions: number
  reach: number
  clicks: number
  ctr: number
  cpm: number
  cpc: number
  frequency: number
  thruplays: number
  engajamento: number
  cpe: number
  cpv: number
  taxaVisualizacao: number
}

export interface MetaAdData {
  id: string
  nome: string
  adset: string
  campanha: string
  status: string
  statusRevisao: string
  statusMotivo: string
  spend: number
  impressions: number
  reach: number
  clicks: number
  ctr: number
  cpm: number
  cpc: number
}

export interface MetaBreakdownItem {
  label: string
  impressions: number
  reach: number
  clicks: number
  thruplays: number
  spend: number
  pct: number
}

export interface MetaAudiencia {
  genero: MetaBreakdownItem[]
  idade: MetaBreakdownItem[]
  dispositivos: MetaBreakdownItem[]
}

export interface MetaAccountData {
  id: string
  nome: string
  moeda: string
  spend: number
  impressions: number
  reach: number
  clicks: number
  ctr: number
  cpm: number
  cpc: number
  frequency: number
  thruplays: number
  campanhas: MetaCampaignData[]
  adsets: MetaAdSetData[]
  ads: MetaAdData[]
  serie: MetaDailyPoint[]
  audiencia: MetaAudiencia
}

let _cache: { key: string; ts: number; data: MetaAccountData[]; nomes: string[] } | null = null
const CACHE_TTL = 30 * 60 * 1000

export async function GET(req: NextRequest) {
  if (!TOKEN && !TOKEN2) {
    return NextResponse.json(
      { error: 'Variável META_ACCESS_TOKEN não configurada.' },
      { status: 500 }
    )
  }

  const { searchParams } = new URL(req.url)
  const hoje = new Date()
  hoje.setHours(0, 0, 0, 0)

  const start =
    searchParams.get('start') ??
    `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-01`
  const end = searchParams.get('end') ?? hoje.toISOString().slice(0, 10)

  const fresh = searchParams.get('fresh') === '1'
  const chave = `meta|v7|${start}|${end}`

  const cacheKey = `metav9|${start}|${end}`
  if (!fresh && _cache?.key === cacheKey && Date.now() - _cache.ts < CACHE_TTL) {
    return NextResponse.json({ nomes: _cache.nomes, data: _cache.data })
  }
  if (!fresh) {
    const cacheado = await readCache(chave, 3_600_000)
    if (cacheado) return NextResponse.json(cacheado)
  }

  const timeRange = JSON.stringify({ since: start, until: end })

  const COMMON_METRICS = 'spend,impressions,reach,clicks,ctr,cpm,cpc,frequency,video_thruplay_watched_actions,inline_post_engagement'

  // access_token é acrescentado por conta (cada conta pode vir de um token diferente)
  const accountParamsBase = { fields: COMMON_METRICS, level: 'account', time_range: timeRange }
  const campaignParamsBase = { fields: `campaign_id,campaign_name,${COMMON_METRICS}`, level: 'campaign', time_range: timeRange, limit: '200' }
  const adsetParamsBase = { fields: `adset_id,adset_name,campaign_name,${COMMON_METRICS}`, level: 'adset', time_range: timeRange, limit: '500' }
  const adParamsBase = { fields: 'ad_id,ad_name,adset_name,campaign_name,spend,impressions,reach,clicks,ctr,cpm,cpc', level: 'ad', time_range: timeRange, limit: '500' }
  const dailyParamsBase = { fields: 'spend,impressions,reach,clicks,cpm,frequency,video_thruplay_watched_actions', level: 'account', time_range: timeRange, time_increment: '1' }

  const BREAKDOWN_FIELDS = 'impressions,reach,clicks,spend,video_thruplay_watched_actions'
  const generoParamsBase = { fields: BREAKDOWN_FIELDS, breakdowns: 'gender', time_range: timeRange }
  const idadeParamsBase = { fields: BREAKDOWN_FIELDS, breakdowns: 'age', time_range: timeRange }
  const dispositivoParamsBase = { fields: BREAKDOWN_FIELDS, breakdowns: 'device_platform', time_range: timeRange }

  const GENERO_LABEL: Record<string, string> = { male: 'Masculino', female: 'Feminino', unknown: 'Desconhecido' }
  const DEVICE_LABEL: Record<string, string> = { mobile: 'Mobile', desktop: 'Desktop', connected_tv: 'Smart TV', unknown: 'Outros' }

  function mapBreakdown(data: any[], key: string, labelMap?: Record<string, string>): MetaBreakdownItem[] {
    const items: MetaBreakdownItem[] = (data ?? []).map((d: any) => ({
      label: labelMap ? (labelMap[d[key]] ?? d[key]) : d[key],
      impressions: parseInt(d.impressions || '0', 10),
      reach: parseInt(d.reach || '0', 10),
      clicks: parseInt(d.clicks || '0', 10),
      thruplays: parseThruplays(d.video_thruplay_watched_actions),
      spend: parseFloat(d.spend || '0'),
      pct: 0,
    }))
    const totalImpr = items.reduce((s, i) => s + i.impressions, 0)
    items.forEach(i => { i.pct = totalImpr > 0 ? Math.round((i.impressions / totalImpr) * 1000) / 10 : 0 })
    return items.sort((a, b) => b.impressions - a.impressions)
  }

  // Descobre as contas acessíveis pelos tokens configurados (lista dinâmica, não mais hardcoded)
  let discovered: MetaAccountRef[]
  let tokenFor: Map<string, string>
  try {
    const r = await discoverAllAccounts()
    discovered = r.accounts
    tokenFor = r.tokenFor
  } catch (e: any) {
    console.error('Meta discover error:', e)
    return NextResponse.json({ error: e.message ?? 'Erro ao listar contas Meta' }, { status: 500 })
  }

  // Fase A (leve): mantém só contas com gasto > 0 no período — some inativa/encerrada
  const active = (await mapLimit(discovered, 8, async (acc): Promise<MetaAccountRef | null> => {
    try {
      const token = tokenFor.get(acc.id) ?? TOKEN
      const params = new URLSearchParams({ fields: 'spend', level: 'account', time_range: timeRange, access_token: token })
      const r = await fetch(`${API}/act_${acc.id}/insights?${params}`, { next: { revalidate: 0 } })
      const j = await r.json()
      if (j.error) return null
      return parseFloat(j.data?.[0]?.spend ?? '0') > 0 ? acc : null
    } catch { return null }
  })).filter((a): a is MetaAccountRef => a !== null)

  // Fase B (pesada): detalhe completo só das contas ativas
  const results = (
    await Promise.all(
      active.map(async (acc) => {
        try {
          const token = tokenFor.get(acc.id) ?? TOKEN
          const accountParams = new URLSearchParams({ ...accountParamsBase, access_token: token })
          const campaignParams = new URLSearchParams({ ...campaignParamsBase, access_token: token })
          const adsetParams = new URLSearchParams({ ...adsetParamsBase, access_token: token })
          const adParams = new URLSearchParams({ ...adParamsBase, access_token: token })
          const dailyParams = new URLSearchParams({ ...dailyParamsBase, access_token: token })
          const generoParams = new URLSearchParams({ ...generoParamsBase, access_token: token })
          const idadeParams = new URLSearchParams({ ...idadeParamsBase, access_token: token })
          const dispositivoParams = new URLSearchParams({ ...dispositivoParamsBase, access_token: token })

          // status de revisão roda em paralelo (endpoints /ads /campaigns /adsets, não /insights)
          const adStatusPromise = fetchAdStatuses(acc.id, token).catch(() => new Map<string, { effective_status: string; motivo: string }>())
          const campStatusPromise = fetchEntityMeta(acc.id, 'campaigns', token).catch(() => new Map<string, EntityMeta>())
          const adsetStatusPromise = fetchEntityMeta(acc.id, 'adsets', token).catch(() => new Map<string, EntityMeta>())
          const [accRes, campRes, adsetRes, adRes, dailyRes, generoRes, idadeRes, dispositivoRes] = await Promise.all([
            fetch(`${API}/act_${acc.id}/insights?${accountParams}`, { next: { revalidate: 0 } }),
            fetch(`${API}/act_${acc.id}/insights?${campaignParams}`, { next: { revalidate: 0 } }),
            fetch(`${API}/act_${acc.id}/insights?${adsetParams}`, { next: { revalidate: 0 } }),
            fetch(`${API}/act_${acc.id}/insights?${adParams}`, { next: { revalidate: 0 } }),
            fetch(`${API}/act_${acc.id}/insights?${dailyParams}`, { next: { revalidate: 0 } }),
            fetch(`${API}/act_${acc.id}/insights?${generoParams}`, { next: { revalidate: 0 } }),
            fetch(`${API}/act_${acc.id}/insights?${idadeParams}`, { next: { revalidate: 0 } }),
            fetch(`${API}/act_${acc.id}/insights?${dispositivoParams}`, { next: { revalidate: 0 } }),
          ])

          const [accData, campData, adsetData, adData, dailyData, generoData, idadeData, dispositivoData] = await Promise.all([
            accRes.json(), campRes.json(), adsetRes.json(), adRes.json(), dailyRes.json(),
            generoRes.json(), idadeRes.json(), dispositivoRes.json(),
          ])

          if (accData.error) {
            console.warn(`Meta [${acc.nome}] account: ${accData.error.message}`)
            return null
          }
          if (campData.error) console.warn(`Meta [${acc.nome}] campaigns: ${campData.error.message}`)
          if (adsetData.error) console.warn(`Meta [${acc.nome}] adsets: ${adsetData.error.message}`)
          if (adData.error) console.warn(`Meta [${acc.nome}] ads: ${adData.error.message}`)

          const row = accData.data?.[0]
          if (!row || !parseFloat(row.spend || '0')) return null

          function mapStatus(s: string): string {
            if (s === 'ACTIVE') return 'ativo'
            if (s === 'PAUSED' || s === 'CAMPAIGN_PAUSED' || s === 'ADSET_PAUSED') return 'pausado'
            return 'ativo'
          }

          const campStatusMap = await campStatusPromise
          const adsetStatusMap = await adsetStatusPromise

          const campanhas: MetaCampaignData[] = (campData.data ?? [])
            .filter((c: any) => parseFloat(c.spend || '0') > 0)
            .map((c: any): MetaCampaignData => ({
              id: c.campaign_id ?? '',
              nome: c.campaign_name ?? '',
              status: mapStatus(campStatusMap.get(String(c.campaign_id ?? ''))?.status ?? 'ACTIVE'),
              statusRevisao: metaStatusLabel(campStatusMap.get(String(c.campaign_id ?? ''))?.status ?? 'ACTIVE'),
              objective: campStatusMap.get(String(c.campaign_id ?? ''))?.objective ?? '',
              orcamento: campStatusMap.get(String(c.campaign_id ?? ''))?.orcamento ?? 0,
              orcamentoTipo: campStatusMap.get(String(c.campaign_id ?? ''))?.orcamentoTipo ?? '',
              spend: parseFloat(c.spend || '0'),
              impressions: parseInt(c.impressions || '0', 10),
              reach: parseInt(c.reach || '0', 10),
              clicks: parseInt(c.clicks || '0', 10),
              ctr: parseFloat(c.ctr || '0'),
              cpm: parseFloat(c.cpm || '0'),
              cpc: parseFloat(c.cpc || '0'),
              frequency: parseFloat(c.frequency || '0'),
              thruplays: parseThruplays(c.video_thruplay_watched_actions),
              engajamento: parseInt(c.inline_post_engagement || '0', 10),
              cpe: (() => { const e = parseInt(c.inline_post_engagement || '0', 10); return e > 0 ? parseFloat(c.spend || '0') / e : 0 })(),
              cpv: (() => { const tp = parseThruplays(c.video_thruplay_watched_actions); return tp > 0 ? parseFloat(c.spend || '0') / tp : 0 })(),
              taxaVisualizacao: (() => { const tp = parseThruplays(c.video_thruplay_watched_actions); const imp = parseInt(c.impressions || '0', 10); return imp > 0 ? (tp / imp) * 100 : 0 })(),
            }))
            .sort((a: MetaCampaignData, b: MetaCampaignData) => b.spend - a.spend)

          const adsets: MetaAdSetData[] = (adsetData.data ?? [])
            .filter((c: any) => parseFloat(c.spend || '0') > 0)
            .map((c: any): MetaAdSetData => ({
              id: c.adset_id ?? '',
              nome: c.adset_name ?? '',
              campanha: c.campaign_name ?? '',
              status: mapStatus(adsetStatusMap.get(String(c.adset_id ?? ''))?.status ?? 'ACTIVE'),
              statusRevisao: metaStatusLabel(adsetStatusMap.get(String(c.adset_id ?? ''))?.status ?? 'ACTIVE'),
              orcamento: adsetStatusMap.get(String(c.adset_id ?? ''))?.orcamento ?? 0,
              orcamentoTipo: adsetStatusMap.get(String(c.adset_id ?? ''))?.orcamentoTipo ?? '',
              spend: parseFloat(c.spend || '0'),
              impressions: parseInt(c.impressions || '0', 10),
              reach: parseInt(c.reach || '0', 10),
              clicks: parseInt(c.clicks || '0', 10),
              ctr: parseFloat(c.ctr || '0'),
              cpm: parseFloat(c.cpm || '0'),
              cpc: parseFloat(c.cpc || '0'),
              frequency: parseFloat(c.frequency || '0'),
              thruplays: parseThruplays(c.video_thruplay_watched_actions),
              engajamento: parseInt(c.inline_post_engagement || '0', 10),
              cpe: (() => { const e = parseInt(c.inline_post_engagement || '0', 10); return e > 0 ? parseFloat(c.spend || '0') / e : 0 })(),
              cpv: (() => { const tp = parseThruplays(c.video_thruplay_watched_actions); return tp > 0 ? parseFloat(c.spend || '0') / tp : 0 })(),
              taxaVisualizacao: (() => { const tp = parseThruplays(c.video_thruplay_watched_actions); const imp = parseInt(c.impressions || '0', 10); return imp > 0 ? (tp / imp) * 100 : 0 })(),
            }))
            .sort((a: MetaAdSetData, b: MetaAdSetData) => b.spend - a.spend)

          const adStatusMap = await adStatusPromise

          const ads: MetaAdData[] = (adData.data ?? [])
            .filter((c: any) => parseFloat(c.spend || '0') > 0)
            .map((c: any): MetaAdData => {
              const st = adStatusMap.get(String(c.ad_id ?? ''))
              const eff = st?.effective_status ?? 'ACTIVE'
              return {
                id: c.ad_id ?? '',
                nome: c.ad_name ?? '',
                adset: c.adset_name ?? '',
                campanha: c.campaign_name ?? '',
                status: mapStatus(eff),
                statusRevisao: metaStatusLabel(eff),
                statusMotivo: st?.motivo ?? '',
                spend: parseFloat(c.spend || '0'),
                impressions: parseInt(c.impressions || '0', 10),
                reach: parseInt(c.reach || '0', 10),
                clicks: parseInt(c.clicks || '0', 10),
                ctr: parseFloat(c.ctr || '0'),
                cpm: parseFloat(c.cpm || '0'),
                cpc: parseFloat(c.cpc || '0'),
              }
            })
            .sort((a: MetaAdData, b: MetaAdData) => b.spend - a.spend)

          const serie: MetaDailyPoint[] = (dailyData.data ?? [])
            .filter((d: any) => d.date_start)
            .map((d: any): MetaDailyPoint => {
              const spend = parseFloat(d.spend || '0')
              const impressions = parseInt(d.impressions || '0', 10)
              const reach = parseInt(d.reach || '0', 10)
              const clicks = parseInt(d.clicks || '0', 10)
              const thruplays = parseThruplays(d.video_thruplay_watched_actions)
              return {
                date: d.date_start,
                spend,
                impressions,
                reach,
                clicks,
                cpm: parseFloat(d.cpm || '0'),
                ctr: impressions > 0 ? (clicks / impressions) * 100 : 0,
                cpc: clicks > 0 ? spend / clicks : 0,
                frequency: parseFloat(d.frequency || '0'),
                thruplays,
                cpv: thruplays > 0 ? spend / thruplays : 0,
              }
            })
            .sort((a: MetaDailyPoint, b: MetaDailyPoint) => a.date.localeCompare(b.date))

          return {
            id: acc.id,
            nome: acc.nome,
            moeda: acc.moeda,
            spend: parseFloat(row.spend || '0'),
            impressions: parseInt(row.impressions || '0', 10),
            reach: parseInt(row.reach || '0', 10),
            clicks: parseInt(row.clicks || '0', 10),
            ctr: parseFloat(row.ctr || '0'),
            cpm: parseFloat(row.cpm || '0'),
            cpc: parseFloat(row.cpc || '0'),
            frequency: parseFloat(row.frequency || '0'),
            thruplays: parseThruplays(row.video_thruplay_watched_actions),
            campanhas,
            adsets,
            ads,
            serie,
            audiencia: {
              genero: mapBreakdown(generoData.data ?? [], 'gender', GENERO_LABEL),
              idade: mapBreakdown(idadeData.data ?? [], 'age'),
              dispositivos: mapBreakdown(dispositivoData.data ?? [], 'device_platform', DEVICE_LABEL),
            },
          } as MetaAccountData
        } catch (e) {
          console.error(`Skipping ${acc.nome}:`, e)
          return null
        }
      })
    )
  ).filter((a): a is MetaAccountData => a !== null)

  results.sort((a, b) => b.spend - a.spend)
  const nomes = results.map(a => a.nome).sort()

  _cache = { key: cacheKey, ts: Date.now(), data: results, nomes }
  const out = { nomes, data: results }
  await writeCache(chave, out)
  return NextResponse.json(out)
}

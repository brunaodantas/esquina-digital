import { NextRequest, NextResponse } from 'next/server'
import { readCache, writeCache } from '@/lib/cache'

const BASE = 'https://business-api.tiktok.com/open_api/v1.3'
const TOKEN = process.env.TIKTOK_ACCESS_TOKEN ?? ''

const ADVERTISER_IDS = [
  '7322194824105590786',
  '7621648190602952722',
  '7621988608429506567',
  '7621989577078784018',
  '7621991089315774471',
  '7621991605880406024',
  '7621993104521920530',
  '7646886376989982741',
]

// Fallback com nomes reais das contas — usado quando /advertiser/info/ não retorna nomes (escopo do token)
const ADVERTISER_NAMES_FALLBACK: Record<string, string> = {
  '7322194824105590786': 'Esquina',
  '7621648190602952722': 'Biodiesel',
  '7621988608429506567': 'Hortolândia',
  '7621989577078784018': 'Governo da Bahia',
  '7621991089315774471': 'PMC Campinas',
  '7621991605880406024': 'Abradee',
  '7621993104521920530': 'Biodiesel 2',
  '7646886376989982741': 'ANFAVEA',
}

export interface TikTokAudienceItem {
  label: string
  impressions: number
  clicks: number
  spend: number
}

export interface TikTokAudienceData {
  genero: TikTokAudienceItem[]
  idade: TikTokAudienceItem[]
  plataforma: TikTokAudienceItem[]
}

export interface TikTokAccountData {
  id: string
  nome: string
  spend: number
  impressions: number
  clicks: number
  reach: number
  frequency: number
  ctr: number
  cpc: number
  cpm: number
  serie: { date: string; spend: number; impressions: number; clicks: number; ctr: number; cpc: number; cpm: number }[]
  campanhas: TikTokCampaignData[]
  grupos: TikTokAdSetData[]
  anuncios: TikTokAdData[]
  audiencia: TikTokAudienceData
}

export interface TikTokCampaignData {
  id: string
  nome: string
  spend: number
  impressions: number
  reach: number
  clicks: number
  videoViews: number
  ctr: number
  cpc: number
  cpm: number
  cpv: number
}

export interface TikTokAdSetData {
  id: string
  nome: string
  campanha: string
  spend: number
  impressions: number
  reach: number
  clicks: number
  videoViews: number
  ctr: number
  cpc: number
  cpm: number
  cpv: number
}

export interface TikTokAdData {
  id: string
  nome: string
  adset: string
  campanha: string
  statusRevisao: string
  statusMotivo: string
  spend: number
  impressions: number
  reach: number
  clicks: number
  videoViews: number
  ctr: number
  cpc: number
  cpm: number
  cpv: number
}

let _cache: { key: string; ts: number; data: TikTokAccountData[]; nomes: string[] } | null = null
const CACHE_TTL = 30 * 60 * 1000
const CACHE_V = 'v12'

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

// Códigos de rate limit / throttle do TikTok que valem retry
const THROTTLE_CODES = new Set([40100, 40016, 50002, 51000])

async function tiktokGet(path: string, params: Record<string, string>, retries = 3): Promise<any> {
  const url = new URL(`${BASE}${path}`)
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v))
  for (let attempt = 0; attempt <= retries; attempt++) {
    const res = await fetch(url.toString(), { headers: { 'Access-Token': TOKEN } })
    if (res.status === 429 || res.status >= 500) {
      if (attempt < retries) { await sleep(400 * (attempt + 1) + Math.floor(attempt * 150)); continue }
      throw new Error(`TikTok ${path}: HTTP ${res.status}`)
    }
    if (!res.ok) throw new Error(`TikTok ${path}: HTTP ${res.status}`)
    const json = await res.json()
    // Throttle reportado no corpo com HTTP 200
    if (THROTTLE_CODES.has(json?.code) && attempt < retries) {
      await sleep(400 * (attempt + 1)); continue
    }
    return json
  }
}

// Executa tarefas com limite de concorrência (evita estourar o QPS do TikTok)
async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T, i: number) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length)
  let next = 0
  async function worker() {
    while (next < items.length) {
      const i = next++
      results[i] = await fn(items[i], i)
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker))
  return results
}

// secondary_status / operation_status do anúncio TikTok → rótulo PT-BR
function tiktokStatusLabel(operation: string, secondary: string): string {
  const s = (secondary || '').toUpperCase()
  if (s) {
    if (s === 'AD_STATUS_DELIVERY_OK') return 'Veiculando'
    if (s === 'AD_STATUS_NOT_START') return 'Não iniciado'
    if (s === 'AD_STATUS_DELETE') return 'Excluído'
    if (s.includes('DENY') || s.includes('REJECT') || s.includes('NOT_APPROVE')) return 'Reprovado'
    if (s.includes('AUDIT') || s.includes('REVIEW')) return 'Em análise'
    if (s.includes('DISABLE') || s.includes('SUSPEND')) return 'Pausado'
    if (s.includes('BUDGET') || s.includes('BALANCE') || s.includes('NOT_DELIVERY')) return 'Veiculação limitada'
  }
  if ((operation || '').toUpperCase() === 'DISABLE') return 'Pausado'
  return 'Ativo'
}

// Busca status de revisão dos anúncios via /ad/get/ (o /report/ não traz status).
// Retorna Map<ad_id, { operation, secondary, motivo }>. Falha não quebra a tabela.
async function fetchTikTokAdStatuses(advertiserId: string): Promise<Map<string, { operation: string; secondary: string; motivo: string }>> {
  const map = new Map<string, { operation: string; secondary: string; motivo: string }>()
  let page = 1
  let guard = 0
  while (guard < 20) {
    guard++
    const res = await tiktokGet('/ad/get/', {
      advertiser_id: advertiserId,
      fields: JSON.stringify(['ad_id', 'operation_status', 'secondary_status']),
      page: String(page),
      page_size: '100',
    })
    if (res?.code !== 0) break
    for (const a of res?.data?.list ?? []) {
      const id = String(a.ad_id ?? '')
      if (!id) continue
      map.set(id, {
        operation: String(a.operation_status ?? ''),
        secondary: String(a.secondary_status ?? ''),
        motivo: '',
      })
    }
    const info = res?.data?.page_info
    if (!info || page >= Number(info.total_page ?? 1)) break
    page++
  }
  return map
}

async function getAdvertiserNames(ids: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>()
  // Pré-popula com nomes do fallback hardcoded
  for (const id of ids) {
    map.set(id, ADVERTISER_NAMES_FALLBACK[id] ?? `ID ${id}`)
  }
  // Tenta enriquecer com nomes da API (pode falhar por escopo do token)
  try {
    const data = await tiktokGet('/advertiser/info/', {
      advertiser_ids: JSON.stringify(ids),
      fields: JSON.stringify(['advertiser_id', 'advertiser_name']),
    })
    for (const item of data?.data?.list ?? []) {
      const id = String(item.advertiser_id)
      const name = item.advertiser_name
      if (name && name !== id) map.set(id, name)
    }
  } catch (_) {}
  return map
}

// Dimensões confirmadas via probe na API (escopo de reporting):
//   gender → MALE/FEMALE/NONE · age → AGE_18_24…AGE_55_100/NONE · platform → ANDROID/IPHONE/IPAD/WAP
//   platform_type, device_*, os_* → NÃO suportados (40002)
const GENDER_LABELS: Record<string, string> = { MALE: 'Masculino', FEMALE: 'Feminino', NONE: 'Não identificado', UNKNOWN: 'Não identificado' }
const AGE_LABELS: Record<string, string> = {
  AGE_13_17: '13-17', AGE_18_24: '18-24', AGE_25_34: '25-34', AGE_35_44: '35-44',
  AGE_45_54: '45-54', AGE_55_100: '55+', NONE: 'Não identificado',
}
const PLATFORM_LABELS: Record<string, string> = { ANDROID: 'Android', IPHONE: 'iPhone', IPAD: 'iPad', WAP: 'Web', PC: 'PC/Web', UNKNOWN: 'Outros' }

function parseAudItems(res: PromiseSettledResult<any>, dimKey: string, labelMap?: Record<string, string>): TikTokAudienceItem[] {
  if (res.status !== 'fulfilled') return []
  return (res.value?.data?.list ?? []).map((item: any) => {
    const raw = String(item.dimensions?.[dimKey] ?? '')
    return {
      label: labelMap?.[raw] ?? raw,
      impressions: Number(item.metrics?.impressions ?? 0),
      clicks: Number(item.metrics?.clicks ?? 0),
      spend: Number(item.metrics?.spend ?? 0),
    }
  }).filter((i: TikTokAudienceItem) => i.impressions > 0)
    .sort((a: TikTokAudienceItem, b: TikTokAudienceItem) => b.impressions - a.impressions)
}

async function getAccountMetrics(advertiserId: string, start: string, end: string) {
  const baseParams = { advertiser_id: advertiserId, report_type: 'BASIC', start_date: start, end_date: end }

  // *_name vêm como MÉTRICA (confirmado via probe); como dimensão dão 40002.
  // reach e video_play_actions (= visualizações) funcionam em campanha/grupo/anúncio (probe).
  const campMetrics = JSON.stringify(['campaign_name', 'spend', 'impressions', 'reach', 'clicks', 'video_play_actions', 'ctr', 'cpc', 'cpm'])
  const adgroupMetrics = JSON.stringify(['adgroup_name', 'campaign_name', 'spend', 'impressions', 'reach', 'clicks', 'video_play_actions', 'ctr', 'cpc', 'cpm'])
  const adMetrics = JSON.stringify(['ad_name', 'adgroup_name', 'campaign_name', 'spend', 'impressions', 'reach', 'clicks', 'video_play_actions', 'ctr', 'cpc', 'cpm'])
  const audBase = { advertiser_id: advertiserId, report_type: 'AUDIENCE', data_level: 'AUCTION_ADVERTISER', start_date: start, end_date: end, metrics: JSON.stringify(['spend', 'impressions', 'clicks']), page_size: '50' }
  const [accountRes, dailyRes, campRes, genderRes, ageRes, platformRes, adgroupRes, adRes] = await Promise.allSettled([
    tiktokGet('/report/integrated/get/', {
      ...baseParams, data_level: 'AUCTION_ADVERTISER',
      dimensions: JSON.stringify(['advertiser_id']),
      metrics: JSON.stringify(['spend', 'impressions', 'clicks', 'reach', 'frequency', 'ctr', 'cpc', 'cpm']),
      page_size: '1',
    }),
    tiktokGet('/report/integrated/get/', {
      ...baseParams, data_level: 'AUCTION_ADVERTISER',
      dimensions: JSON.stringify(['advertiser_id', 'stat_time_day']),
      metrics: JSON.stringify(['spend', 'impressions', 'clicks']),
      page_size: '100',
    }),
    tiktokGet('/report/integrated/get/', {
      ...baseParams, data_level: 'AUCTION_CAMPAIGN',
      dimensions: JSON.stringify(['campaign_id']),
      metrics: campMetrics,
      page_size: '100',
    }),
    tiktokGet('/report/integrated/get/', { ...audBase, dimensions: JSON.stringify(['gender']) }),
    tiktokGet('/report/integrated/get/', { ...audBase, dimensions: JSON.stringify(['age']) }),
    tiktokGet('/report/integrated/get/', { ...audBase, dimensions: JSON.stringify(['platform']) }),
    tiktokGet('/report/integrated/get/', {
      ...baseParams, data_level: 'AUCTION_ADGROUP',
      dimensions: JSON.stringify(['adgroup_id']),
      metrics: adgroupMetrics,
      page_size: '200',
    }),
    tiktokGet('/report/integrated/get/', {
      ...baseParams, data_level: 'AUCTION_AD',
      dimensions: JSON.stringify(['ad_id']),
      metrics: adMetrics,
      page_size: '200',
    }),
  ])

  const account = { spend: 0, impressions: 0, clicks: 0, reach: 0, frequency: 0, ctr: 0, cpc: 0, cpm: 0 }
  if (accountRes.status === 'fulfilled') {
    const row = accountRes.value?.data?.list?.[0]?.metrics ?? {}
    account.spend = Number(row.spend ?? 0)
    account.impressions = Number(row.impressions ?? 0)
    account.clicks = Number(row.clicks ?? 0)
    account.reach = Number(row.reach ?? 0)
    account.frequency = Number(row.frequency ?? 0)
    account.ctr = Number(row.ctr ?? 0)
    account.cpc = Number(row.cpc ?? 0)
    account.cpm = Number(row.cpm ?? 0)
  }

  const serie: TikTokAccountData['serie'] = []
  if (dailyRes.status === 'fulfilled') {
    for (const item of dailyRes.value?.data?.list ?? []) {
      const date = item.dimensions?.stat_time_day?.slice(0, 10) ?? ''
      if (!date) continue
      const spend = Number(item.metrics?.spend ?? 0)
      const impressions = Number(item.metrics?.impressions ?? 0)
      const clicks = Number(item.metrics?.clicks ?? 0)
      serie.push({ date, spend, impressions, clicks, ctr: impressions > 0 ? (clicks / impressions) * 100 : 0, cpc: clicks > 0 ? spend / clicks : 0, cpm: impressions > 0 ? (spend / impressions) * 1000 : 0 })
    }
    serie.sort((a, b) => a.date.localeCompare(b.date))
  }

  // campaign_name vem em metrics.campaign_name (confirmado via probe)
  const campListRaw: any[] = campRes.status === 'fulfilled' && campRes.value?.code === 0
    ? campRes.value?.data?.list ?? []
    : []
  if (campRes.status === 'fulfilled' && campRes.value?.code !== 0) {
    console.error(`TikTok campanha ${advertiserId}: code=${campRes.value?.code} msg=${campRes.value?.message}`)
  }

  const campanhas: TikTokCampaignData[] = []
  for (const item of campListRaw) {
    const m = item.metrics ?? {}
    const campId = String(item.dimensions?.campaign_id ?? '')
    const spend = Number(m.spend ?? 0)
    if (spend === 0) continue
    const campName = String(m.campaign_name ?? '').trim() || campId
    const views = Number(m.video_play_actions ?? 0)
    campanhas.push({
      id: campId,
      nome: campName,
      spend, impressions: Number(m.impressions ?? 0), reach: Number(m.reach ?? 0), clicks: Number(m.clicks ?? 0),
      videoViews: views,
      ctr: Number(m.ctr ?? 0), cpc: Number(m.cpc ?? 0), cpm: Number(m.cpm ?? 0),
      cpv: views > 0 ? spend / views : 0,
    })
  }
  campanhas.sort((a, b) => b.spend - a.spend)

  // Grupos de anúncios (adgroup_name + campaign_name como métricas)
  const grupos: TikTokAdSetData[] = []
  const grupoListRaw: any[] = adgroupRes.status === 'fulfilled' && adgroupRes.value?.code === 0 ? adgroupRes.value?.data?.list ?? [] : []
  if (adgroupRes.status === 'fulfilled' && adgroupRes.value?.code !== 0) console.error(`TikTok adgroup ${advertiserId}: code=${adgroupRes.value?.code} msg=${adgroupRes.value?.message}`)
  for (const item of grupoListRaw) {
    const m = item.metrics ?? {}
    const gid = String(item.dimensions?.adgroup_id ?? '')
    const spend = Number(m.spend ?? 0)
    if (spend === 0) continue
    const gviews = Number(m.video_play_actions ?? 0)
    grupos.push({
      id: gid,
      nome: String(m.adgroup_name ?? '').trim() || gid,
      campanha: String(m.campaign_name ?? '').trim(),
      spend, impressions: Number(m.impressions ?? 0), reach: Number(m.reach ?? 0), clicks: Number(m.clicks ?? 0),
      videoViews: gviews,
      ctr: Number(m.ctr ?? 0), cpc: Number(m.cpc ?? 0), cpm: Number(m.cpm ?? 0),
      cpv: gviews > 0 ? spend / gviews : 0,
    })
  }
  grupos.sort((a, b) => b.spend - a.spend)

  // Anúncios / criativos (ad_name + adgroup_name + campaign_name como métricas)
  const anuncios: TikTokAdData[] = []
  const adListRaw: any[] = adRes.status === 'fulfilled' && adRes.value?.code === 0 ? adRes.value?.data?.list ?? [] : []
  if (adRes.status === 'fulfilled' && adRes.value?.code !== 0) console.error(`TikTok ad ${advertiserId}: code=${adRes.value?.code} msg=${adRes.value?.message}`)
  for (const item of adListRaw) {
    const m = item.metrics ?? {}
    const aid = String(item.dimensions?.ad_id ?? '')
    const spend = Number(m.spend ?? 0)
    if (spend === 0) continue
    const aviews = Number(m.video_play_actions ?? 0)
    anuncios.push({
      id: aid,
      nome: String(m.ad_name ?? '').trim() || aid,
      adset: String(m.adgroup_name ?? '').trim(),
      campanha: String(m.campaign_name ?? '').trim(),
      statusRevisao: '', statusMotivo: '', // preenchido por fetchTikTokAdStatuses (requer escopo Ads Management no token)
      spend, impressions: Number(m.impressions ?? 0), reach: Number(m.reach ?? 0), clicks: Number(m.clicks ?? 0),
      videoViews: aviews,
      ctr: Number(m.ctr ?? 0), cpc: Number(m.cpc ?? 0), cpm: Number(m.cpm ?? 0),
      cpv: aviews > 0 ? spend / aviews : 0,
    })
  }
  anuncios.sort((a, b) => b.spend - a.spend)

  // Status de revisão dos anúncios (endpoint /ad/get/, separado do relatório). Best-effort.
  if (anuncios.length > 0) {
    try {
      const statusMap = await fetchTikTokAdStatuses(advertiserId)
      for (const a of anuncios) {
        const st = statusMap.get(a.id)
        if (st) {
          a.statusRevisao = tiktokStatusLabel(st.operation, st.secondary)
          a.statusMotivo = st.motivo
        }
      }
    } catch (e) {
      console.error(`TikTok ad status ${advertiserId}:`, e)
    }
  }

  const audiencia: TikTokAudienceData = {
    genero: parseAudItems(genderRes, 'gender', GENDER_LABELS),
    idade: parseAudItems(ageRes, 'age', AGE_LABELS),
    plataforma: parseAudItems(platformRes, 'platform', PLATFORM_LABELS),
  }

  // Fallback 1: conta retornou 0 mas campanhas têm dados — soma das campanhas
  if (account.spend === 0 && campanhas.length > 0) {
    account.spend = campanhas.reduce((s, c) => s + c.spend, 0)
    account.impressions = campanhas.reduce((s, c) => s + c.impressions, 0)
    account.clicks = campanhas.reduce((s, c) => s + c.clicks, 0)
    account.ctr = account.impressions > 0 ? (account.clicks / account.impressions) * 100 : 0
    account.cpm = account.impressions > 0 ? (account.spend / account.impressions) * 1000 : 0
    account.cpc = account.clicks > 0 ? account.spend / account.clicks : 0
  }

  // Fallback 2: conta e campanhas retornaram 0 mas série diária tem dados (inconsistência da API)
  if (account.spend === 0 && campanhas.length === 0 && serie.length > 0) {
    account.spend = serie.reduce((s, d) => s + d.spend, 0)
    account.impressions = serie.reduce((s, d) => s + d.impressions, 0)
    account.clicks = serie.reduce((s, d) => s + d.clicks, 0)
    account.ctr = account.impressions > 0 ? (account.clicks / account.impressions) * 100 : 0
    account.cpm = account.impressions > 0 ? (account.spend / account.impressions) * 1000 : 0
    account.cpc = account.clicks > 0 ? account.spend / account.clicks : 0
  }

  return { account, serie, campanhas, grupos, anuncios, audiencia }
}

export async function GET(req: NextRequest) {
  if (!TOKEN) return NextResponse.json({ error: 'TIKTOK_ACCESS_TOKEN não configurado.' }, { status: 500 })

  const { searchParams } = new URL(req.url)
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0)
  const start = searchParams.get('start') ?? `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-01`
  const end = searchParams.get('end') ?? hoje.toISOString().slice(0, 10)

  const fresh = searchParams.get('fresh') === '1'
  const chave = `tiktok|v2|${start}|${end}`

  const cacheKey = `${CACHE_V}|${start}|${end}`
  const allNomesStatic = ADVERTISER_IDS.map(id => ADVERTISER_NAMES_FALLBACK[id] ?? `ID ${id}`)
  if (!fresh && _cache?.key === cacheKey && Date.now() - _cache.ts < CACHE_TTL) {
    return NextResponse.json({ nomes: allNomesStatic, data: _cache.data })
  }
  if (!fresh) {
    const cacheado = await readCache(chave, 3_600_000)
    if (cacheado) return NextResponse.json(cacheado)
  }

  try {
    const nomeMap = await getAdvertiserNames(ADVERTISER_IDS)

    // Concorrência limitada (2 contas por vez): cada conta faz 8 chamadas; 8×8=64 simultâneas
    // estouravam o QPS do TikTok e derrubavam contas aleatoriamente. 2×8=16 fica dentro do limite.
    const results = (await mapLimit(ADVERTISER_IDS, 2, async (id) => {
      try {
        const { account, serie, campanhas, grupos, anuncios, audiencia } = await getAccountMetrics(id, start, end)
        // Fallback 2 já reconstruiu account.spend da série; spend 0 + sem campanhas = conta sem atividade real
        if (account.spend === 0 && campanhas.length === 0) return null
        // nome sempre vem do fallback para consistência com o dropdown
        return { id, nome: ADVERTISER_NAMES_FALLBACK[id] ?? nomeMap.get(id) ?? `ID ${id}`, ...account, serie, campanhas, grupos, anuncios, audiencia } as TikTokAccountData
      } catch (e) {
        console.error(`TikTok skip ${id}:`, e)
        return null
      }
    })).filter((a): a is TikTokAccountData => a !== null)

    results.sort((a, b) => b.spend - a.spend)
    // nomes inclui todas as contas do fallback, mesmo sem gasto no período
    const allNomes = ADVERTISER_IDS.map(id => nomeMap.get(id) ?? `ID ${id}`)
    _cache = { key: cacheKey, ts: Date.now(), data: results, nomes: allNomes }
    const out = { nomes: allNomesStatic, data: results }
    await writeCache(chave, out)
    return NextResponse.json(out)
  } catch (err: any) {
    console.error('TikTok Ads API error:', err)
    return NextResponse.json({ error: err.message ?? 'Erro interno' }, { status: 500 })
  }
}

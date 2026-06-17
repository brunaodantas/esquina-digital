import { NextRequest, NextResponse } from 'next/server'

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
  '7646886376989982741': 'Conta TK',
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
  audiencia: TikTokAudienceData
}

export interface TikTokCampaignData {
  id: string
  nome: string
  spend: number
  impressions: number
  clicks: number
  ctr: number
  cpc: number
  cpm: number
}

let _cache: { key: string; ts: number; data: TikTokAccountData[]; nomes: string[] } | null = null
const CACHE_TTL = 30 * 60 * 1000

async function tiktokGet(path: string, params: Record<string, string>): Promise<any> {
  const url = new URL(`${BASE}${path}`)
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v))
  const res = await fetch(url.toString(), { headers: { 'Access-Token': TOKEN } })
  if (!res.ok) throw new Error(`TikTok ${path}: HTTP ${res.status}`)
  return res.json()
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

const GENDER_LABELS: Record<string, string> = { MALE: 'Masculino', FEMALE: 'Feminino', UNKNOWN: 'Desconhecido' }
const PLATFORM_LABELS: Record<string, string> = { ANDROID: 'Android', IOS: 'iOS', PC: 'PC/Web', UNKNOWN: 'Outros' }

async function getAudienceData(advertiserId: string, start: string, end: string): Promise<TikTokAudienceData> {
  const base = { advertiser_id: advertiserId, report_type: 'AUDIENCE', data_level: 'AUCTION_ADVERTISER', start_date: start, end_date: end, metrics: JSON.stringify(['spend', 'impressions', 'clicks']), page_size: '50' }

  const [genderRes, ageRes, platformRes] = await Promise.allSettled([
    tiktokGet('/report/integrated/get/', { ...base, dimensions: JSON.stringify(['gender']) }),
    tiktokGet('/report/integrated/get/', { ...base, dimensions: JSON.stringify(['age']) }),
    tiktokGet('/report/integrated/get/', { ...base, dimensions: JSON.stringify(['platform_type']) }),
  ])

  function parseItems(res: PromiseSettledResult<any>, dimKey: string, labelMap?: Record<string, string>): TikTokAudienceItem[] {
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

  return {
    genero: parseItems(genderRes, 'gender', GENDER_LABELS),
    idade: parseItems(ageRes, 'age'),
    plataforma: parseItems(platformRes, 'platform_type', PLATFORM_LABELS),
  }
}

async function getAccountMetrics(advertiserId: string, start: string, end: string) {
  const baseParams = { advertiser_id: advertiserId, report_type: 'BASIC', start_date: start, end_date: end }

  const [accountRes, dailyRes, campRes, audRes] = await Promise.allSettled([
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
      metrics: JSON.stringify(['spend', 'impressions', 'clicks', 'ctr', 'cpc', 'cpm', 'campaign_name']),
      page_size: '50',
    }),
    getAudienceData(advertiserId, start, end),
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

  const campanhas: TikTokCampaignData[] = []
  if (campRes.status === 'fulfilled') {
    for (const item of campRes.value?.data?.list ?? []) {
      const m = item.metrics ?? {}
      const spend = Number(m.spend ?? 0)
      if (spend === 0) continue
      campanhas.push({
        id: String(item.dimensions?.campaign_id ?? ''),
        nome: String(m.campaign_name ?? `ID ${item.dimensions?.campaign_id ?? ''}`),
        spend, impressions: Number(m.impressions ?? 0), clicks: Number(m.clicks ?? 0),
        ctr: Number(m.ctr ?? 0), cpc: Number(m.cpc ?? 0), cpm: Number(m.cpm ?? 0),
      })
    }
    campanhas.sort((a, b) => b.spend - a.spend)
  }

  const audiencia: TikTokAudienceData = audRes.status === 'fulfilled' ? audRes.value : { genero: [], idade: [], plataforma: [] }

  return { account, serie, campanhas, audiencia }
}

export async function GET(req: NextRequest) {
  if (!TOKEN) return NextResponse.json({ error: 'TIKTOK_ACCESS_TOKEN não configurado.' }, { status: 500 })

  const { searchParams } = new URL(req.url)
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0)
  const start = searchParams.get('start') ?? `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-01`
  const end = searchParams.get('end') ?? hoje.toISOString().slice(0, 10)

  const cacheKey = `${start}|${end}`
  const allNomesStatic = ADVERTISER_IDS.map(id => ADVERTISER_NAMES_FALLBACK[id] ?? `ID ${id}`)
  if (_cache?.key === cacheKey && Date.now() - _cache.ts < CACHE_TTL) {
    return NextResponse.json({ nomes: allNomesStatic, data: _cache.data })
  }

  try {
    const nomeMap = await getAdvertiserNames(ADVERTISER_IDS)

    const results = (await Promise.all(
      ADVERTISER_IDS.map(async (id) => {
        try {
          const { account, serie, campanhas, audiencia } = await getAccountMetrics(id, start, end)
          if (account.spend === 0 && campanhas.length === 0) return null
          return { id, nome: nomeMap.get(id) ?? `ID ${id}`, ...account, serie, campanhas, audiencia } as TikTokAccountData
        } catch (e) {
          console.error(`TikTok skip ${id}:`, e)
          return null
        }
      })
    )).filter((a): a is TikTokAccountData => a !== null)

    results.sort((a, b) => b.spend - a.spend)
    // nomes inclui todas as contas do fallback, mesmo sem gasto no período
    const allNomes = ADVERTISER_IDS.map(id => nomeMap.get(id) ?? `ID ${id}`)
    _cache = { key: cacheKey, ts: Date.now(), data: results, nomes: allNomes }
    return NextResponse.json({ nomes: allNomesStatic, data: results })
  } catch (err: any) {
    console.error('TikTok Ads API error:', err)
    return NextResponse.json({ error: err.message ?? 'Erro interno' }, { status: 500 })
  }
}

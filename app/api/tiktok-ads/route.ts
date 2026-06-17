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
  serie: { date: string; spend: number; impressions: number; clicks: number }[]
  campanhas: TikTokCampaignData[]
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
  const res = await fetch(url.toString(), {
    headers: { 'Access-Token': TOKEN },
  })
  if (!res.ok) throw new Error(`TikTok ${path}: HTTP ${res.status}`)
  return res.json()
}

async function getAdvertiserNames(ids: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>()
  try {
    const data = await tiktokGet('/advertiser/info/', {
      advertiser_ids: JSON.stringify(ids),
      fields: JSON.stringify(['advertiser_id', 'advertiser_name']),
    })
    for (const item of data?.data?.list ?? []) {
      map.set(String(item.advertiser_id), item.advertiser_name ?? `ID ${item.advertiser_id}`)
    }
  } catch (_) {}
  return map
}

async function getAccountMetrics(
  advertiserId: string,
  start: string,
  end: string
): Promise<{ account: { spend: number; impressions: number; clicks: number; reach: number; frequency: number; ctr: number; cpc: number; cpm: number }; serie: TikTokAccountData['serie']; campanhas: TikTokCampaignData[] }> {
  const baseParams = {
    advertiser_id: advertiserId,
    report_type: 'BASIC',
    start_date: start,
    end_date: end,
  }

  const [accountRes, dailyRes, campRes] = await Promise.allSettled([
    // Account-level aggregate
    tiktokGet('/report/integrated/get/', {
      ...baseParams,
      data_level: 'AUCTION_ADVERTISER',
      dimensions: JSON.stringify(['advertiser_id']),
      metrics: JSON.stringify(['spend', 'impressions', 'clicks', 'reach', 'frequency', 'ctr', 'cpc', 'cpm']),
      page_size: '1',
    }),
    // Daily series
    tiktokGet('/report/integrated/get/', {
      ...baseParams,
      data_level: 'AUCTION_ADVERTISER',
      dimensions: JSON.stringify(['advertiser_id', 'stat_time_day']),
      metrics: JSON.stringify(['spend', 'impressions', 'clicks']),
      page_size: '100',
    }),
    // Campaign breakdown
    tiktokGet('/report/integrated/get/', {
      ...baseParams,
      data_level: 'AUCTION_CAMPAIGN',
      dimensions: JSON.stringify(['campaign_id']),
      metrics: JSON.stringify(['spend', 'impressions', 'clicks', 'ctr', 'cpc', 'cpm', 'campaign_name']),
      page_size: '50',
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
      serie.push({
        date,
        spend: Number(item.metrics?.spend ?? 0),
        impressions: Number(item.metrics?.impressions ?? 0),
        clicks: Number(item.metrics?.clicks ?? 0),
      })
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
        spend,
        impressions: Number(m.impressions ?? 0),
        clicks: Number(m.clicks ?? 0),
        ctr: Number(m.ctr ?? 0),
        cpc: Number(m.cpc ?? 0),
        cpm: Number(m.cpm ?? 0),
      })
    }
    campanhas.sort((a, b) => b.spend - a.spend)
  }

  return { account, serie, campanhas }
}

export async function GET(req: NextRequest) {
  if (!TOKEN) {
    return NextResponse.json({ error: 'TIKTOK_ACCESS_TOKEN não configurado.' }, { status: 500 })
  }

  const { searchParams } = new URL(req.url)
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0)
  const start = searchParams.get('start') ?? `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-01`
  const end = searchParams.get('end') ?? hoje.toISOString().slice(0, 10)

  const cacheKey = `${start}|${end}`
  if (_cache?.key === cacheKey && Date.now() - _cache.ts < CACHE_TTL) {
    return NextResponse.json({ nomes: _cache.nomes, data: _cache.data })
  }

  try {
    const nomeMap = await getAdvertiserNames(ADVERTISER_IDS)

    const results = (
      await Promise.all(
        ADVERTISER_IDS.map(async (id) => {
          try {
            const { account, serie, campanhas } = await getAccountMetrics(id, start, end)
            if (account.spend === 0 && campanhas.length === 0) return null
            return {
              id,
              nome: nomeMap.get(id) ?? `ID ${id}`,
              ...account,
              serie,
              campanhas,
            } as TikTokAccountData
          } catch (e) {
            console.error(`TikTok skip ${id}:`, e)
            return null
          }
        })
      )
    ).filter((a): a is TikTokAccountData => a !== null)

    results.sort((a, b) => b.spend - a.spend)
    const nomes = results.map((a) => a.nome)
    _cache = { key: cacheKey, ts: Date.now(), data: results, nomes }
    return NextResponse.json({ nomes, data: results })
  } catch (err: any) {
    console.error('TikTok Ads API error:', err)
    return NextResponse.json({ error: err.message ?? 'Erro interno' }, { status: 500 })
  }
}

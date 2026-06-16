import { NextRequest, NextResponse } from 'next/server'

const ADS_VERSION = 'v24'
const BASE = `https://googleads.googleapis.com/${ADS_VERSION}`

const DEV_TOKEN = process.env.GOOGLE_ADS_DEVELOPER_TOKEN ?? ''
const CLIENT_ID = process.env.GOOGLE_ADS_CLIENT_ID ?? ''
const CLIENT_SECRET = process.env.GOOGLE_ADS_CLIENT_SECRET ?? ''
const REFRESH_TOKEN = process.env.GOOGLE_ADS_REFRESH_TOKEN ?? ''
const MCC_ID = (process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID ?? '').replace(/-/g, '')

let _token = ''
let _tokenExpiry = 0

async function getToken(): Promise<string> {
  if (_token && Date.now() < _tokenExpiry) return _token
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      refresh_token: REFRESH_TOKEN,
      grant_type: 'refresh_token',
    }),
  })
  const d = await res.json()
  if (!res.ok) throw new Error(`OAuth: ${d.error_description ?? d.error}`)
  _token = d.access_token as string
  _tokenExpiry = Date.now() + ((d.expires_in as number) - 120) * 1000
  return _token
}

async function gaql(customerId: string, query: string, token: string): Promise<any[]> {
  const id = customerId.replace(/-/g, '')
  const res = await fetch(`${BASE}/customers/${id}/googleAds:search`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'developer-token': DEV_TOKEN,
      'login-customer-id': MCC_ID,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query }),
  })
  if (!res.ok) {
    const txt = await res.text()
    throw new Error(`GAQL[${id}]: ${txt.slice(0, 300)}`)
  }
  const d = await res.json()
  return d.results ?? []
}

const TIPO_MAP: Record<string, string> = {
  SEARCH: 'Pesquisa',
  DISPLAY: 'Display',
  MULTI_CHANNEL: 'Perf. Max',
  PERFORMANCE_MAX: 'Perf. Max',
  VIDEO: 'Vídeo',
  SHOPPING: 'Shopping',
  DISCOVERY: 'Discovery',
  DEMAND_GEN: 'Demand Gen',
  SMART: 'Smart',
}

export interface CampaignData {
  id: string
  nome: string
  tipo: string
  tipoRaw: string
  status: 'ativo' | 'pausado'
  cliques: number
  impressoes: number
  custo: number
  ctr: number
  cpcMedio: number
  conversoes: number
  custoConversao: number
}

export interface DailyPoint {
  date: string
  custo: number
  cpcMedio: number
}

export interface AccountData {
  id: string
  nome: string
  cliques: number
  impressoes: number
  ctr: number
  cpcMedio: number
  custo: number
  conversoes: number
  custoConversao: number
  campanhas: CampaignData[]
  serie: DailyPoint[]
}

let _cache: { key: string; ts: number; data: AccountData[]; nomes: string[] } | null = null
const CACHE_TTL = 30 * 60 * 1000

export async function GET(req: NextRequest) {
  if (!DEV_TOKEN || !CLIENT_ID || !CLIENT_SECRET || !REFRESH_TOKEN || !MCC_ID) {
    return NextResponse.json(
      { error: 'Variáveis de ambiente do Google Ads não configuradas.' },
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

  const cacheKey = `${start}|${end}`
  if (_cache?.key === cacheKey && Date.now() - _cache.ts < CACHE_TTL) {
    return NextResponse.json({ nomes: _cache.nomes, data: _cache.data })
  }

  try {
    const token = await getToken()

    const accountRows = await gaql(
      MCC_ID,
      `SELECT
         customer_client.id,
         customer_client.descriptive_name
       FROM customer_client
       WHERE customer_client.manager = false
         AND customer_client.status = 'ENABLED'`,
      token
    )

    const accounts = accountRows
      .map((r: any) => ({
        id: String(r.customerClient?.id ?? ''),
        nome: (r.customerClient?.descriptiveName ?? '').trim(),
      }))
      .filter((a: any) => a.id && a.nome)

    const results = (
      await Promise.all(
        accounts.map(async (acc: { id: string; nome: string }) => {
          try {
            const [campRows, dailyRows] = await Promise.all([
              gaql(
                acc.id,
                `SELECT
                   campaign.id,
                   campaign.name,
                   campaign.advertising_channel_type,
                   campaign.status,
                   metrics.clicks,
                   metrics.impressions,
                   metrics.cost_micros,
                   metrics.conversions
                 FROM campaign
                 WHERE segments.date BETWEEN '${start}' AND '${end}'
                   AND campaign.status != 'REMOVED'`,
                token
              ),
              gaql(
                acc.id,
                `SELECT
                   segments.date,
                   metrics.cost_micros,
                   metrics.clicks
                 FROM campaign
                 WHERE segments.date BETWEEN '${start}' AND '${end}'
                   AND campaign.status != 'REMOVED'
                 ORDER BY segments.date`,
                token
              ),
            ])

            // Build campaign map (accumulate if multiple rows per campaign)
            const campMap = new Map<string, CampaignData>()
            let cliques = 0, impressoes = 0, custoMicros = 0, conversoes = 0

            for (const row of campRows) {
              const m = row.metrics ?? {}
              const c = row.campaign ?? {}
              const campId = String(c.id ?? '')

              const campCliques = Number(m.clicks ?? 0)
              const campImpressoes = Number(m.impressions ?? 0)
              const campCustoMicros = Number(m.costMicros ?? 0)
              const campConversoes = Number(m.conversions ?? 0)

              cliques += campCliques
              impressoes += campImpressoes
              custoMicros += campCustoMicros
              conversoes += campConversoes

              const existing = campMap.get(campId)
              const campCusto = campCustoMicros / 1_000_000
              if (!existing) {
                const tipoRaw = (c.advertisingChannelType ?? 'UNKNOWN') as string
                campMap.set(campId, {
                  id: campId,
                  nome: (c.name ?? '').trim(),
                  tipo: TIPO_MAP[tipoRaw] ?? tipoRaw,
                  tipoRaw,
                  status: c.status === 'PAUSED' ? 'pausado' : 'ativo',
                  cliques: campCliques,
                  impressoes: campImpressoes,
                  custo: campCusto,
                  ctr: campImpressoes > 0 ? (campCliques / campImpressoes) * 100 : 0,
                  cpcMedio: campCliques > 0 ? campCusto / campCliques : 0,
                  conversoes: campConversoes,
                  custoConversao: campConversoes > 0 ? campCusto / campConversoes : 0,
                })
              } else {
                existing.cliques += campCliques
                existing.impressoes += campImpressoes
                existing.custo += campCusto
                existing.conversoes += campConversoes
                existing.ctr = existing.impressoes > 0 ? (existing.cliques / existing.impressoes) * 100 : 0
                existing.cpcMedio = existing.cliques > 0 ? existing.custo / existing.cliques : 0
                existing.custoConversao = existing.conversoes > 0 ? existing.custo / existing.conversoes : 0
              }
            }

            // Build daily time series (aggregate all campaigns per date)
            const dailyMap = new Map<string, { custo: number; cliques: number }>()
            for (const row of dailyRows) {
              const date = row.segments?.date ?? ''
              if (!date) continue
              const cost = Number(row.metrics?.costMicros ?? 0) / 1_000_000
              const cl = Number(row.metrics?.clicks ?? 0)
              const ex = dailyMap.get(date) ?? { custo: 0, cliques: 0 }
              dailyMap.set(date, { custo: ex.custo + cost, cliques: ex.cliques + cl })
            }
            const serie: DailyPoint[] = Array.from(dailyMap.entries())
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([date, d]) => ({
                date,
                custo: d.custo,
                cpcMedio: d.cliques > 0 ? d.custo / d.cliques : 0,
              }))

            const campanhas = Array.from(campMap.values())
              .filter(c => c.custo > 0)
              .sort((a, b) => b.custo - a.custo)

            if (custoMicros === 0) return null

            const custo = custoMicros / 1_000_000
            const ctr = impressoes > 0 ? (cliques / impressoes) * 100 : 0
            const cpcMedio = cliques > 0 ? custo / cliques : 0
            const custoConversao = conversoes > 0 ? custo / conversoes : 0

            return {
              id: acc.id,
              nome: acc.nome,
              cliques,
              impressoes,
              ctr,
              cpcMedio,
              custo,
              conversoes,
              custoConversao,
              campanhas,
              serie,
            } as AccountData
          } catch (e) {
            console.error(`Skipping ${acc.id} (${acc.nome}):`, e)
            return null
          }
        })
      )
    ).filter((a): a is AccountData => a !== null)

    results.sort((a, b) => b.custo - a.custo)
    const nomes = results.map(a => a.nome).sort()

    _cache = { key: cacheKey, ts: Date.now(), data: results, nomes }
    return NextResponse.json({ nomes, data: results })
  } catch (err: any) {
    console.error('Google Ads API error:', err)
    return NextResponse.json({ error: err.message ?? 'Erro interno' }, { status: 500 })
  }
}

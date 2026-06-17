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
  videoViews: number
  custo: number
  ctr: number
  cpcMedio: number
  cpm: number
  cpv: number
  conversoes: number
  custoConversao: number
}

export interface AdGroupData {
  id: string
  nome: string
  status: 'ativo' | 'pausado'
  campanhaId: string
  campanhaNome: string
  cliques: number
  impressoes: number
  videoViews: number
  custo: number
  ctr: number
  cpcMedio: number
  cpm: number
  cpv: number
  conversoes: number
  custoConversao: number
}

export interface AdData {
  id: string
  nome: string
  status: 'ativo' | 'pausado'
  grupoId: string
  grupoNome: string
  campanhaId: string
  campanhaNome: string
  cliques: number
  impressoes: number
  videoViews: number
  custo: number
  ctr: number
  cpcMedio: number
  cpm: number
  cpv: number
  conversoes: number
  custoConversao: number
}

export interface DailyPoint {
  date: string
  custo: number
  cliques: number
  impressoes: number
  ctr: number
  cpcMedio: number
  cpm: number
}

export interface GeoCidadeData {
  nome: string
  criterionId: string
  cliques: number
  impressoes: number
  custo: number
}

export interface AccountData {
  id: string
  nome: string
  cliques: number
  impressoes: number
  videoViews: number
  ctr: number
  cpcMedio: number
  cpm: number
  cpv: number
  custo: number
  conversoes: number
  custoConversao: number
  campanhas: CampaignData[]
  grupos: AdGroupData[]
  anuncios: AdData[]
  serie: DailyPoint[]
  cidades: GeoCidadeData[]
}

let _cache: { key: string; ts: number; data: AccountData[]; nomes: string[] } | null = null
const CACHE_TTL = 30 * 60 * 1000

function buildMetrics(cliques: number, impressoes: number, custo: number, conversoes: number) {
  return {
    ctr: impressoes > 0 ? (cliques / impressoes) * 100 : 0,
    cpcMedio: cliques > 0 ? custo / cliques : 0,
    cpm: impressoes > 0 ? (custo / impressoes) * 1000 : 0,
    cpv: 0,
    custoConversao: conversoes > 0 ? custo / conversoes : 0,
  }
}

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
      .map((r: any) => ({ id: String(r.customerClient?.id ?? ''), nome: (r.customerClient?.descriptiveName ?? '').trim() }))
      .filter((a: any) => a.id && a.nome)

    const results = (
      await Promise.all(
        accounts.map(async (acc: { id: string; nome: string }) => {
          try {
            const [campRows, agRows, adRows, dailyRows, geoRows] = await Promise.all([
              gaql(acc.id,
                `SELECT campaign.id, campaign.name, campaign.advertising_channel_type, campaign.status,
                   metrics.clicks, metrics.impressions, metrics.cost_micros, metrics.conversions, metrics.video_views
                 FROM campaign
                 WHERE segments.date BETWEEN '${start}' AND '${end}'
                   AND campaign.status != 'REMOVED'`,
                token),
              gaql(acc.id,
                `SELECT ad_group.id, ad_group.name, ad_group.status,
                   campaign.id, campaign.name,
                   metrics.clicks, metrics.impressions, metrics.cost_micros, metrics.conversions
                 FROM ad_group
                 WHERE segments.date BETWEEN '${start}' AND '${end}'
                   AND ad_group.status != 'REMOVED'
                   AND campaign.status != 'REMOVED'`,
                token),
              gaql(acc.id,
                `SELECT ad_group_ad.ad.id, ad_group_ad.ad.name, ad_group_ad.status,
                   ad_group.id, ad_group.name,
                   campaign.id, campaign.name,
                   metrics.clicks, metrics.impressions, metrics.cost_micros, metrics.conversions
                 FROM ad_group_ad
                 WHERE segments.date BETWEEN '${start}' AND '${end}'
                   AND ad_group_ad.status != 'REMOVED'
                   AND campaign.status != 'REMOVED'
                 LIMIT 200`,
                token),
              gaql(acc.id,
                `SELECT segments.date, metrics.cost_micros, metrics.clicks, metrics.impressions
                 FROM campaign
                 WHERE segments.date BETWEEN '${start}' AND '${end}'
                   AND campaign.status != 'REMOVED'
                 ORDER BY segments.date`,
                token),
              gaql(acc.id,
                `SELECT geographic_view.resource_name, geographic_view.country_criterion_id,
                   geographic_view.location_type, metrics.clicks, metrics.impressions, metrics.cost_micros
                 FROM geographic_view
                 WHERE segments.date BETWEEN '${start}' AND '${end}'
                   AND metrics.clicks > 0
                   AND geographic_view.location_type = 'CITY'
                 ORDER BY metrics.clicks DESC
                 LIMIT 20`,
                token).catch(() => []),
            ])

            // ── Campaigns ──────────────────────────────────────────────
            const campMap = new Map<string, CampaignData>()
            let cliques = 0, impressoes = 0, custoMicros = 0, conversoes = 0

            for (const row of campRows) {
              const m = row.metrics ?? {}
              const c = row.campaign ?? {}
              const cid = String(c.id ?? '')
              const cl = Number(m.clicks ?? 0)
              const imp = Number(m.impressions ?? 0)
              const cm = Number(m.costMicros ?? 0)
              const conv = Number(m.conversions ?? 0)
              cliques += cl; impressoes += imp; custoMicros += cm; conversoes += conv

              const ex = campMap.get(cid)
              const custo = cm / 1_000_000
              const vv = Number(m.videoViews ?? 0)
              if (!ex) {
                const tipoRaw = (c.advertisingChannelType ?? 'UNKNOWN') as string
                campMap.set(cid, {
                  id: cid, nome: (c.name ?? '').trim(),
                  tipo: TIPO_MAP[tipoRaw] ?? tipoRaw, tipoRaw,
                  status: c.status === 'PAUSED' ? 'pausado' : 'ativo',
                  cliques: cl, impressoes: imp, videoViews: vv, custo, conversoes: conv,
                  ...buildMetrics(cl, imp, custo, conv),
                })
              } else {
                ex.cliques += cl; ex.impressoes += imp; ex.videoViews += vv; ex.custo += custo; ex.conversoes += conv
                Object.assign(ex, buildMetrics(ex.cliques, ex.impressoes, ex.custo, ex.conversoes))
              }
            }

            // ── Ad Groups ──────────────────────────────────────────────
            const agMap = new Map<string, AdGroupData>()
            for (const row of agRows) {
              const m = row.metrics ?? {}
              const ag = row.adGroup ?? {}
              const camp = row.campaign ?? {}
              const agid = String(ag.id ?? '')
              const cl = Number(m.clicks ?? 0)
              const imp = Number(m.impressions ?? 0)
              const custo = Number(m.costMicros ?? 0) / 1_000_000
              const conv = Number(m.conversions ?? 0)
              const ex = agMap.get(agid)
              if (!ex) {
                agMap.set(agid, {
                  id: agid, nome: (ag.name ?? '').trim(),
                  status: ag.status === 'PAUSED' ? 'pausado' : 'ativo',
                  campanhaId: String(camp.id ?? ''), campanhaNome: (camp.name ?? '').trim(),
                  cliques: cl, impressoes: imp, videoViews: 0, custo, conversoes: conv,
                  ...buildMetrics(cl, imp, custo, conv),
                })
              } else {
                ex.cliques += cl; ex.impressoes += imp; ex.custo += custo; ex.conversoes += conv
                Object.assign(ex, buildMetrics(ex.cliques, ex.impressoes, ex.custo, ex.conversoes))
              }
            }

            // ── Ads ────────────────────────────────────────────────────
            const adMap = new Map<string, AdData>()
            for (const row of adRows) {
              const m = row.metrics ?? {}
              const ada = row.adGroupAd ?? {}
              const ag = row.adGroup ?? {}
              const camp = row.campaign ?? {}
              const adid = String(ada.ad?.id ?? '')
              if (!adid) continue
              const cl = Number(m.clicks ?? 0)
              const imp = Number(m.impressions ?? 0)
              const custo = Number(m.costMicros ?? 0) / 1_000_000
              const conv = Number(m.conversions ?? 0)
              const ex = adMap.get(adid)
              const rawName = (ada.ad?.name ?? '').trim()
              if (!ex) {
                adMap.set(adid, {
                  id: adid, nome: rawName || `ID ${adid}`,
                  status: ada.status === 'PAUSED' ? 'pausado' : 'ativo',
                  grupoId: String(ag.id ?? ''), grupoNome: (ag.name ?? '').trim(),
                  campanhaId: String(camp.id ?? ''), campanhaNome: (camp.name ?? '').trim(),
                  cliques: cl, impressoes: imp, videoViews: 0, custo, conversoes: conv,
                  ...buildMetrics(cl, imp, custo, conv),
                })
              } else {
                ex.cliques += cl; ex.impressoes += imp; ex.custo += custo; ex.conversoes += conv
                Object.assign(ex, buildMetrics(ex.cliques, ex.impressoes, ex.custo, ex.conversoes))
              }
            }

            // ── Daily series ───────────────────────────────────────────
            const dailyMap = new Map<string, { custo: number; cliques: number; impressoes: number }>()
            for (const row of dailyRows) {
              const date = row.segments?.date ?? ''; if (!date) continue
              const cost = Number(row.metrics?.costMicros ?? 0) / 1_000_000
              const cl = Number(row.metrics?.clicks ?? 0)
              const imp = Number(row.metrics?.impressions ?? 0)
              const ex = dailyMap.get(date) ?? { custo: 0, cliques: 0, impressoes: 0 }
              dailyMap.set(date, { custo: ex.custo + cost, cliques: ex.cliques + cl, impressoes: ex.impressoes + imp })
            }
            const serie: DailyPoint[] = Array.from(dailyMap.entries())
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([date, d]) => ({
                date, custo: d.custo, cliques: d.cliques, impressoes: d.impressoes,
                ctr: d.impressoes > 0 ? (d.cliques / d.impressoes) * 100 : 0,
                cpcMedio: d.cliques > 0 ? d.custo / d.cliques : 0,
                cpm: d.impressoes > 0 ? (d.custo / d.impressoes) * 1000 : 0,
              }))

            if (custoMicros === 0) return null

            // ── Cidades ────────────────────────────────────────────────
            const cidadesRaw: { criterionId: string; cliques: number; impressoes: number; custo: number }[] = []
            for (const row of geoRows) {
              const res = row.geographicView?.resourceName ?? ''
              const criterionId = res.split('~')[1] ?? row.geographicView?.countrycriterionId ?? ''
              if (!criterionId) continue
              cidadesRaw.push({
                criterionId,
                cliques: Number(row.metrics?.clicks ?? 0),
                impressoes: Number(row.metrics?.impressions ?? 0),
                custo: Number(row.metrics?.costMicros ?? 0) / 1_000_000,
              })
            }

            let cidades: GeoCidadeData[] = []
            if (cidadesRaw.length > 0) {
              try {
                const ids = [...new Set(cidadesRaw.map(c => c.criterionId))].slice(0, 20)
                const idList = ids.map(id => `'geoTargetConstants/${id}'`).join(',')
                const nameRows = await gaql(acc.id,
                  `SELECT geo_target_constant.id, geo_target_constant.name
                   FROM geo_target_constant
                   WHERE geo_target_constant.resource_name IN (${idList})`,
                  token
                ).catch(() => [])
                const nameMap = new Map<string, string>()
                for (const nr of nameRows) {
                  const id = String(nr.geoTargetConstant?.id ?? '')
                  const name = (nr.geoTargetConstant?.name ?? '').trim()
                  if (id && name) nameMap.set(id, name)
                }
                cidades = cidadesRaw.map(c => ({
                  nome: nameMap.get(c.criterionId) ?? `ID ${c.criterionId}`,
                  criterionId: c.criterionId,
                  cliques: c.cliques,
                  impressoes: c.impressoes,
                  custo: c.custo,
                })).filter(c => c.cliques > 0)
              } catch (_) {
                cidades = []
              }
            }

            const custo = custoMicros / 1_000_000
            return {
              id: acc.id, nome: acc.nome, cliques, impressoes, videoViews: 0, custo, conversoes,
              ...buildMetrics(cliques, impressoes, custo, conversoes),
              campanhas: Array.from(campMap.values()).filter(c => c.custo > 0).sort((a, b) => b.custo - a.custo),
              grupos: Array.from(agMap.values()).filter(g => g.custo > 0).sort((a, b) => b.custo - a.custo),
              anuncios: Array.from(adMap.values()).filter(a => a.custo > 0).sort((a, b) => b.custo - a.custo),
              serie,
              cidades,
            } as AccountData
          } catch (e) {
            console.error(`Skipping ${acc.id} (${acc.nome}):`, e)
            return null
          }
        })
      )
    ).filter((a): a is AccountData => a !== null)

    results.sort((a, b) => b.custo - a.custo)
    // Retorna TODOS os nomes do MCC (não só os com gasto) para o dropdown dinâmico
    const nomes = accounts.map((a: { id: string; nome: string }) => a.nome).sort()
    _cache = { key: cacheKey, ts: Date.now(), data: results, nomes }
    return NextResponse.json({ nomes, data: results })
  } catch (err: any) {
    console.error('Google Ads API error:', err)
    return NextResponse.json({ error: err.message ?? 'Erro interno' }, { status: 500 })
  }
}

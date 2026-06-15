import { NextRequest, NextResponse } from 'next/server'

const ADS_VERSION = 'v19'
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
            const rows = await gaql(
              acc.id,
              `SELECT
                 metrics.clicks,
                 metrics.impressions,
                 metrics.cost_micros,
                 metrics.conversions
               FROM campaign
               WHERE segments.date BETWEEN '${start}' AND '${end}'
                 AND campaign.status != 'REMOVED'`,
              token
            )

            let cliques = 0, impressoes = 0, custoMicros = 0, conversoes = 0
            for (const row of rows) {
              const m = row.metrics ?? {}
              cliques += Number(m.clicks ?? 0)
              impressoes += Number(m.impressions ?? 0)
              custoMicros += Number(m.costMicros ?? 0)
              conversoes += Number(m.conversions ?? 0)
            }

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

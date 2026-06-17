import { NextRequest, NextResponse } from 'next/server'

const TOKEN = process.env.META_ACCESS_TOKEN ?? ''
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

// Descobre todas as contas de anúncio acessíveis pelo token (segue paginação)
async function discoverAccounts(): Promise<MetaAccountRef[]> {
  const out: MetaAccountRef[] = []
  let url: string | null = `${API}/me/adaccounts?fields=account_id,name,currency&limit=200&access_token=${encodeURIComponent(TOKEN)}`
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

function parseThruplays(actions: any[]): number {
  if (!Array.isArray(actions)) return 0
  const v = actions.find((a: any) => a.action_type === 'video_view')
  return v ? parseInt(v.value ?? '0', 10) : 0
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
  spend: number
  impressions: number
  reach: number
  clicks: number
  ctr: number
  cpm: number
  cpc: number
  frequency: number
  thruplays: number
}

export interface MetaAdSetData {
  id: string
  nome: string
  campanha: string
  status: string
  spend: number
  impressions: number
  reach: number
  clicks: number
  ctr: number
  cpm: number
  cpc: number
  frequency: number
  thruplays: number
}

export interface MetaAdData {
  id: string
  nome: string
  adset: string
  campanha: string
  status: string
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
  if (!TOKEN) {
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

  const cacheKey = `metav2|${start}|${end}`
  if (_cache?.key === cacheKey && Date.now() - _cache.ts < CACHE_TTL) {
    return NextResponse.json({ nomes: _cache.nomes, data: _cache.data })
  }

  const timeRange = JSON.stringify({ since: start, until: end })
  const COMMON_METRICS = 'spend,impressions,reach,clicks,ctr,cpm,cpc,frequency,video_thruplay_watched_actions'

  const accountParams = new URLSearchParams({
    fields: COMMON_METRICS,
    level: 'account',
    time_range: timeRange,
    access_token: TOKEN,
  })

  const campaignParams = new URLSearchParams({
    fields: `campaign_id,campaign_name,${COMMON_METRICS}`,
    level: 'campaign',
    time_range: timeRange,
    access_token: TOKEN,
    limit: '200',
  })

  const adsetParams = new URLSearchParams({
    fields: `adset_id,adset_name,campaign_name,${COMMON_METRICS}`,
    level: 'adset',
    time_range: timeRange,
    access_token: TOKEN,
    limit: '500',
  })

  const adParams = new URLSearchParams({
    fields: 'ad_id,ad_name,adset_name,campaign_name,spend,impressions,reach,clicks,ctr,cpm,cpc',
    level: 'ad',
    time_range: timeRange,
    access_token: TOKEN,
    limit: '500',
  })

  const dailyParams = new URLSearchParams({
    fields: 'spend,impressions,reach,clicks,cpm,frequency,video_thruplay_watched_actions',
    level: 'account',
    time_range: timeRange,
    time_increment: '1',
    access_token: TOKEN,
  })

  const BREAKDOWN_FIELDS = 'impressions,reach,clicks,spend'
  const generoParams = new URLSearchParams({ fields: BREAKDOWN_FIELDS, breakdowns: 'gender', time_range: timeRange, access_token: TOKEN })
  const idadeParams = new URLSearchParams({ fields: BREAKDOWN_FIELDS, breakdowns: 'age', time_range: timeRange, access_token: TOKEN })
  const dispositivoParams = new URLSearchParams({ fields: BREAKDOWN_FIELDS, breakdowns: 'device_platform', time_range: timeRange, access_token: TOKEN })

  const GENERO_LABEL: Record<string, string> = { male: 'Masculino', female: 'Feminino', unknown: 'Desconhecido' }
  const DEVICE_LABEL: Record<string, string> = { mobile: 'Mobile', desktop: 'Desktop', connected_tv: 'Smart TV', unknown: 'Outros' }

  function mapBreakdown(data: any[], key: string, labelMap?: Record<string, string>): MetaBreakdownItem[] {
    const items: MetaBreakdownItem[] = (data ?? []).map((d: any) => ({
      label: labelMap ? (labelMap[d[key]] ?? d[key]) : d[key],
      impressions: parseInt(d.impressions || '0', 10),
      reach: parseInt(d.reach || '0', 10),
      clicks: parseInt(d.clicks || '0', 10),
      spend: parseFloat(d.spend || '0'),
      pct: 0,
    }))
    const totalImpr = items.reduce((s, i) => s + i.impressions, 0)
    items.forEach(i => { i.pct = totalImpr > 0 ? Math.round((i.impressions / totalImpr) * 1000) / 10 : 0 })
    return items.sort((a, b) => b.impressions - a.impressions)
  }

  // Descobre as contas acessíveis pelo token (lista dinâmica, não mais hardcoded)
  let discovered: MetaAccountRef[]
  try {
    discovered = await discoverAccounts()
  } catch (e: any) {
    console.error('Meta discover error:', e)
    return NextResponse.json({ error: e.message ?? 'Erro ao listar contas Meta' }, { status: 500 })
  }

  // Fase A (leve): mantém só contas com gasto > 0 no período — some inativa/encerrada
  const active = (await mapLimit(discovered, 8, async (acc): Promise<MetaAccountRef | null> => {
    try {
      const params = new URLSearchParams({ fields: 'spend', level: 'account', time_range: timeRange, access_token: TOKEN })
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

          const campanhas: MetaCampaignData[] = (campData.data ?? [])
            .filter((c: any) => parseFloat(c.spend || '0') > 0)
            .map((c: any): MetaCampaignData => ({
              id: c.campaign_id ?? '',
              nome: c.campaign_name ?? '',
              status: mapStatus(c.effective_status ?? 'ACTIVE'),
              spend: parseFloat(c.spend || '0'),
              impressions: parseInt(c.impressions || '0', 10),
              reach: parseInt(c.reach || '0', 10),
              clicks: parseInt(c.clicks || '0', 10),
              ctr: parseFloat(c.ctr || '0'),
              cpm: parseFloat(c.cpm || '0'),
              cpc: parseFloat(c.cpc || '0'),
              frequency: parseFloat(c.frequency || '0'),
              thruplays: parseThruplays(c.video_thruplay_watched_actions),
            }))
            .sort((a: MetaCampaignData, b: MetaCampaignData) => b.spend - a.spend)

          const adsets: MetaAdSetData[] = (adsetData.data ?? [])
            .filter((c: any) => parseFloat(c.spend || '0') > 0)
            .map((c: any): MetaAdSetData => ({
              id: c.adset_id ?? '',
              nome: c.adset_name ?? '',
              campanha: c.campaign_name ?? '',
              status: mapStatus(c.effective_status ?? 'ACTIVE'),
              spend: parseFloat(c.spend || '0'),
              impressions: parseInt(c.impressions || '0', 10),
              reach: parseInt(c.reach || '0', 10),
              clicks: parseInt(c.clicks || '0', 10),
              ctr: parseFloat(c.ctr || '0'),
              cpm: parseFloat(c.cpm || '0'),
              cpc: parseFloat(c.cpc || '0'),
              frequency: parseFloat(c.frequency || '0'),
              thruplays: parseThruplays(c.video_thruplay_watched_actions),
            }))
            .sort((a: MetaAdSetData, b: MetaAdSetData) => b.spend - a.spend)

          const ads: MetaAdData[] = (adData.data ?? [])
            .filter((c: any) => parseFloat(c.spend || '0') > 0)
            .map((c: any): MetaAdData => ({
              id: c.ad_id ?? '',
              nome: c.ad_name ?? '',
              adset: c.adset_name ?? '',
              campanha: c.campaign_name ?? '',
              status: mapStatus(c.effective_status ?? 'ACTIVE'),
              spend: parseFloat(c.spend || '0'),
              impressions: parseInt(c.impressions || '0', 10),
              reach: parseInt(c.reach || '0', 10),
              clicks: parseInt(c.clicks || '0', 10),
              ctr: parseFloat(c.ctr || '0'),
              cpm: parseFloat(c.cpm || '0'),
              cpc: parseFloat(c.cpc || '0'),
            }))
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
  return NextResponse.json({ nomes, data: results })
}

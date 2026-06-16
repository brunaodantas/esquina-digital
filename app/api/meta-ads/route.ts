import { NextRequest, NextResponse } from 'next/server'

const TOKEN = process.env.META_ACCESS_TOKEN ?? ''
const API = 'https://graph.facebook.com/v21.0'

const ACCOUNTS = [
  { id: '291661868263049',  nome: 'OAB BAHIA',                    moeda: 'BRL' },
  { id: '382136322438021',  nome: 'BEQUANT',                      moeda: 'EUR' },
  { id: '485257655640935',  nome: 'PMC – Prefeitura de Campinas', moeda: 'BRL' },
  { id: '252035889832913',  nome: 'AMERICANA',                    moeda: 'BRL' },
  { id: '753596575663139',  nome: 'Villa Global Education',       moeda: 'BRL' },
  { id: '709760707406781',  nome: 'HORTOLÂNDIA, SP',              moeda: 'BRL' },
  { id: '388253280554246',  nome: 'Esquina Geral',                moeda: 'BRL' },
  { id: '1172242000851832', nome: 'Tatiana Roque Anúncios',       moeda: 'BRL' },
  { id: '927384352383311',  nome: 'Celina 2025 CARTÃO',           moeda: 'BRL' },
  { id: '490753189954978',  nome: 'MOISES SELERGES',              moeda: 'BRL' },
  { id: '600732035857906',  nome: 'HUGO MOTTA',                   moeda: 'BRL' },
  { id: '1523897018922271', nome: 'TAINÁ REIS',                   moeda: 'BRL' },
  { id: '930277249802740',  nome: 'ALGORITMICA',                  moeda: 'BRL' },
  { id: '1286014213483430', nome: 'GUSTAVO MARTINELLI',           moeda: 'BRL' },
  { id: '609964923020870',  nome: 'ANFAVEA',                      moeda: 'BRL' },
  { id: '309413169114545',  nome: 'Governo da Bahia',             moeda: 'BRL' },
  { id: '1237116627914018', nome: 'Pref. de Bragança Paulista',   moeda: 'BRL' },
  { id: '558577529595507',  nome: 'DARIO JORGE GIOLO SAADI',      moeda: 'BRL' },
  { id: '467072400573584',  nome: 'SENAI CIMATEC',                moeda: 'BRL' },
]

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

  const cacheKey = `${start}|${end}`
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

  const results = (
    await Promise.all(
      ACCOUNTS.map(async (acc) => {
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

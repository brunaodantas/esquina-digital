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

  const params = new URLSearchParams({
    fields: 'spend,impressions,reach,clicks,ctr,cpm,cpc,frequency',
    level: 'account',
    time_range: JSON.stringify({ since: start, until: end }),
    access_token: TOKEN,
  })

  const results = (
    await Promise.all(
      ACCOUNTS.map(async (acc) => {
        try {
          const res = await fetch(`${API}/act_${acc.id}/insights?${params}`, {
            next: { revalidate: 0 },
          })
          const d = await res.json()
          if (d.error) {
            console.warn(`Meta [${acc.nome}]: ${d.error.message}`)
            return null
          }
          const row = d.data?.[0]
          if (!row || !parseFloat(row.spend || '0')) return null

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

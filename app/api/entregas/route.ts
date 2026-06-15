import { NextRequest, NextResponse } from 'next/server'

const SHEET_ID = process.env.SHEETS_ID!
const API_KEY = process.env.SHEETS_API_KEY!

const ABAS: { nome: string; cliente: string; grupo: 'agencia' | 'govba' | 'politica' }[] = [
  { nome: 'LUM1NO', cliente: 'Lum1no', grupo: 'agencia' },
  { nome: 'VILLA', cliente: 'Villa Global', grupo: 'agencia' },
  { nome: 'Embasa', cliente: 'Embasa', grupo: 'agencia' },
  { nome: 'UNIFACS', cliente: 'UNIFACS', grupo: 'agencia' },
  { nome: 'PROVAX', cliente: 'Provax', grupo: 'agencia' },
  { nome: 'Ministérios', cliente: 'Ministérios', grupo: 'agencia' },
  { nome: 'BIODIESEL', cliente: 'Biodiesel', grupo: 'agencia' },
  { nome: 'Prefeitura Americana', cliente: 'Pref. Americana', grupo: 'agencia' },
  { nome: 'Prefeitura Hortolandia', cliente: 'Pref. Hortolândia', grupo: 'agencia' },
  { nome: 'Prefeitura Campinas', cliente: 'Pref. Campinas', grupo: 'agencia' },
  { nome: 'CIMATEC - Graduação PRESENCIAL e EAD', cliente: 'CIMATEC Graduação', grupo: 'agencia' },
  { nome: 'CIMATEC Pós-Graduação 2025', cliente: 'CIMATEC Pós', grupo: 'agencia' },
  { nome: 'MPBA', cliente: 'MPBA', grupo: 'agencia' },
  { nome: 'Governo Bahia', cliente: 'Governo da Bahia', grupo: 'govba' },
  { nome: 'Morya - Governo Bahia', cliente: 'Governo da Bahia', grupo: 'govba' },
  { nome: 'TEMPO - Governo Bahia', cliente: 'Governo da Bahia', grupo: 'govba' },
  { nome: 'Entregas GOV - BA', cliente: 'Governo da Bahia', grupo: 'govba' },
  { nome: 'Dário Saadi', cliente: 'Dário Saadi', grupo: 'politica' },
  { nome: 'Hugo Motta', cliente: 'Hugo Motta', grupo: 'politica' },
  { nome: 'Celina Leão', cliente: 'Celina Leão', grupo: 'politica' },
  { nome: 'Bragança Paulista', cliente: 'Bragança Paulista', grupo: 'politica' },
]

interface Campanha {
  nome: string
  canal: string
  metrica: string
  meta: number
  entregue: number
  pct: number
  bateu: boolean
  diasRestantes: number
  investimento: number
  status: 'ativa' | 'encerrada' | 'futura'
}

interface ClienteData {
  cliente: string
  grupo: 'agencia' | 'govba' | 'politica'
  campanhas: Campanha[]
}

function parseDate(ddmm: string): Date | null {
  if (!ddmm || typeof ddmm !== 'string') return null
  const clean = ddmm.trim().replace(/[^0-9.]/g, '')
  const parts = clean.split('.')
  if (parts.length < 2) return null
  const day = parseInt(parts[0])
  const month = parseInt(parts[1]) - 1
  if (isNaN(day) || isNaN(month)) return null
  return new Date(2026, month, day)
}

function parseNum(val: string): number {
  if (!val) return 0
  const clean = val.toString().replace(/[^0-9,.-]/g, '').replace(',', '.')
  return parseFloat(clean) || 0
}

function diffDays(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / 86400000)
}

async function fetchAba(nome: string): Promise<string[][]> {
  const encoded = encodeURIComponent(nome)
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${encoded}!A:Q?key=${API_KEY}`
  const res = await fetch(url, { next: { revalidate: 1800 } })
  if (!res.ok) return []
  const json = await res.json()
  return json.values ?? []
}

function findHeaderRow(rows: string[][]): number {
  for (let i = 0; i < Math.min(rows.length, 10); i++) {
    const row = rows[i].map(c => c?.toString().toUpperCase() ?? '')
    if (row.some(c => c.includes('CAMPANHA') || c.includes('META') || c.includes('INÍCIO') || c.includes('INICIO'))) {
      return i
    }
  }
  return 0
}

function findCol(header: string[], keywords: string[]): number {
  for (const kw of keywords) {
    const idx = header.findIndex(h => h.toUpperCase().includes(kw.toUpperCase()))
    if (idx !== -1) return idx
  }
  return -1
}

function parseRows(rows: string[][], periodoStart: Date, periodoFim: Date, hoje: Date): Campanha[] {
  if (!rows.length) return []

  const headerIdx = findHeaderRow(rows)
  const header = rows[headerIdx]?.map(c => c?.toString() ?? '') ?? []

  const iCampanha = findCol(header, ['CAMPANHA'])
  const iCanal = findCol(header, ['CANAL', 'Canal'])
  const iInicio = findCol(header, ['INICIO', 'INÍCIO', 'início', 'inicio'])
  const iTermino = findCol(header, ['TÉRMINO', 'TERMINO', 'término', 'termino'])
  const iMetrica = findCol(header, ['MÉTRICA', 'METRICA', 'COMPRA'])
  const iMeta = findCol(header, ['Meta', 'META'])
  const iEntregue = findCol(header, ['entregamos', 'ENTREGAMOS', 'Entregamos'])
  const iBateu = findCol(header, ['BATEU', 'bateu'])
  const iInvestimento = findCol(header, ['INVESTIMENTO', 'investimento'])

  const campanhas: Campanha[] = []

  for (let i = headerIdx + 1; i < rows.length; i++) {
    const row = rows[i]
    if (!row || !row.length) continue

    const nome = iCampanha >= 0 ? (row[iCampanha] ?? '').trim() : ''
    if (!nome) continue

    const inicio = iInicio >= 0 ? parseDate(row[iInicio]) : null
    const termino = iTermino >= 0 ? parseDate(row[iTermino]) : null

    if (!inicio || !termino) continue

    // Campanha ativa no período: sobrepõe com [periodoStart, periodoFim]
    if (inicio > periodoFim || termino < periodoStart) continue

    const status: 'ativa' | 'encerrada' | 'futura' =
      hoje > termino ? 'encerrada' : hoje < inicio ? 'futura' : 'ativa'

    const meta = iMeta >= 0 ? parseNum(row[iMeta]) : 0
    const entregue = iEntregue >= 0 ? parseNum(row[iEntregue]) : 0
    const pct = meta > 0 ? Math.round((entregue / meta) * 1000) / 10 : 0
    const bateu = iBateu >= 0 ? (row[iBateu] ?? '').toString().toUpperCase().includes('BATEU') : pct >= 100
    const diasRestantes = Math.max(0, diffDays(hoje, termino))
    const investimento = iInvestimento >= 0 ? parseNum(row[iInvestimento]) : 0

    campanhas.push({ nome, canal: iCanal >= 0 ? (row[iCanal] ?? '').trim() : '', metrica: iMetrica >= 0 ? (row[iMetrica] ?? '').trim() : '', meta, entregue, pct, bateu, diasRestantes, investimento, status })
  }

  return campanhas
}

export async function GET(req: NextRequest) {
  if (!SHEET_ID || !API_KEY) {
    return NextResponse.json({ error: 'Variáveis de ambiente não configuradas' }, { status: 500 })
  }

  const { searchParams } = new URL(req.url)
  const hoje = new Date()
  hoje.setHours(0, 0, 0, 0)

  // Período: default = mês atual
  const startParam = searchParams.get('start')
  const endParam = searchParams.get('end')

  const periodoStart = startParam ? new Date(startParam + 'T00:00:00') : new Date(hoje.getFullYear(), hoje.getMonth(), 1)
  const periodoFim = endParam ? new Date(endParam + 'T23:59:59') : new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0)

  const clienteMap = new Map<string, ClienteData>()

  await Promise.all(
    ABAS.map(async (aba) => {
      const rows = await fetchAba(aba.nome)
      const campanhas = parseRows(rows, periodoStart, periodoFim, hoje)
      if (!campanhas.length) return

      const existing = clienteMap.get(aba.cliente)
      if (existing) {
        existing.campanhas.push(...campanhas)
      } else {
        clienteMap.set(aba.cliente, { cliente: aba.cliente, grupo: aba.grupo, campanhas })
      }
    })
  )

  const result = Array.from(clienteMap.values()).filter(c => c.campanhas.length > 0)

  result.sort((a, b) => {
    const risco = (c: ClienteData) => c.campanhas.some(x => !x.bateu && x.pct < 80 && x.diasRestantes <= 7 && x.status === 'ativa') ? 0 : 1
    return risco(a) - risco(b)
  })

  return NextResponse.json(result)
}

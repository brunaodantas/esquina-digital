import { NextRequest, NextResponse } from 'next/server'

const SHEET_ID = process.env.SHEETS_ID!
const API_KEY = process.env.SHEETS_API_KEY!

// Abas que não são clientes — ignoradas na descoberta dinâmica
const SKIP_SHEETS = new Set([
  'Resumo', 'Config', 'Capa', 'CAPA', 'Dashboard', 'Dados',
  'Sheet1', 'Folha1', 'Template', 'Modelo', 'MODELO',
  'Índice', 'Indice', 'INDICE', 'Home', 'Legenda', 'LEGENDA',
  'Verba', 'META', 'Controle',
])

// Grupo de cada aba conhecida
const GRUPO_MAP: Record<string, 'agencia' | 'govba' | 'politica'> = {
  'Governo Bahia': 'govba',
  'Morya - Governo Bahia': 'govba',
  'TEMPO - Governo Bahia': 'govba',
  'Entregas GOV - BA': 'govba',
  'Dário Saadi': 'politica',
  'Hugo Motta': 'politica',
  'Celina Leão': 'politica',
  'Bragança Paulista': 'politica',
}

// Nome de exibição para abas em caixa alta
const NOME_MAP: Record<string, string> = {
  'LUM1NO': 'Lum1no',
  'VILLA': 'Villa Global',
  'BIODIESEL': 'Biodiesel',
  'PROVAX': 'Provax',
  'MPBA': 'MPBA',
}

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
  inicioStr: string
  terminoStr: string
}

interface ClienteData {
  cliente: string
  grupo: 'agencia' | 'govba' | 'politica'
  campanhas: Campanha[]
}

function parseDate(ddmm: string): Date | null {
  if (!ddmm || typeof ddmm !== 'string') return null
  const str = ddmm.trim()
  const match = str.match(/^(\d{1,2})[\/.](\d{1,2})$/)
  if (!match) return null
  const day = parseInt(match[1])
  const month = parseInt(match[2]) - 1
  if (isNaN(day) || isNaN(month) || day < 1 || day > 31 || month < 0 || month > 11) return null
  return new Date(2026, month, day)
}

function parseNum(val: string): number {
  if (!val) return 0
  const s = val.toString().trim().replace(/[R$\s]/g, '')
  if (s.includes(',')) {
    // Vírgula = decimal (BR): "1.234,56" → 1234.56
    return parseFloat(s.replace(/\./g, '').replace(',', '.')) || 0
  }
  if (/\.\d{3}$/.test(s)) {
    // Ponto com exatamente 3 dígitos = milhar: "224.513" → 224513
    return parseFloat(s.replace(/\./g, '')) || 0
  }
  return parseFloat(s) || 0
}

function diffDays(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / 86400000)
}

// Lê todas as abas da planilha via Sheets metadata API
async function fetchSheetList(): Promise<string[]> {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}?key=${API_KEY}&fields=sheets.properties.title`
  const res = await fetch(url, { next: { revalidate: 3600 } })
  if (!res.ok) return []
  const json = await res.json()
  return (json.sheets ?? [])
    .map((s: { properties: { title: string } }) => s.properties.title as string)
    .filter((title: string) => title && !SKIP_SHEETS.has(title))
}

async function fetchAba(nome: string): Promise<string[][]> {
  const encoded = encodeURIComponent(nome)
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${encoded}!A:Z?key=${API_KEY}`
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
    const investimento = iInvestimento >= 0 ? parseNum(row[iInvestimento]) : 0

    // Ocultar campanhas sem veiculação real
    if (entregue === 0 && investimento === 0) continue

    // Ocultar linhas com mapeamento de coluna errado (ex: REGIONAIS GOV-BA)
    // entregue=1 com meta grande é sinal de coluna errada
    if (entregue === 1 && meta > 1000) continue

    const pct = meta > 0 ? Math.round((entregue / meta) * 1000) / 10 : 0
    const bateu = iBateu >= 0 ? (row[iBateu] ?? '').toString().toUpperCase().includes('BATEU') : pct >= 100
    const diasRestantes = Math.max(0, diffDays(hoje, termino))

    campanhas.push({
      nome,
      canal: iCanal >= 0 ? (row[iCanal] ?? '').trim() : '',
      metrica: iMetrica >= 0 ? (row[iMetrica] ?? '').trim() : '',
      meta, entregue, pct, bateu, diasRestantes, investimento, status,
      inicioStr: iInicio >= 0 ? (row[iInicio] ?? '').trim() : '',
      terminoStr: iTermino >= 0 ? (row[iTermino] ?? '').trim() : '',
    })
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

  const startParam = searchParams.get('start')
  const endParam = searchParams.get('end')

  const periodoStart = startParam
    ? new Date(startParam + 'T00:00:00')
    : new Date(hoje.getFullYear(), hoje.getMonth(), 1)
  const periodoFim = endParam
    ? new Date(endParam + 'T23:59:59')
    : new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0)

  // Descobre todas as abas dinamicamente
  const sheetNames = await fetchSheetList()

  const abas = sheetNames.map(nome => ({
    nome,
    cliente: NOME_MAP[nome] ?? nome,
    grupo: (GRUPO_MAP[nome] ?? 'agencia') as 'agencia' | 'govba' | 'politica',
  }))

  // sheets é calculado DEPOIS de montar clienteMap — só clientes com dados reais aparecem
  // (abas vazias como "Página 4" somem naturalmente)

  // Carrega campanhas de todas as abas em paralelo
  const clienteMap = new Map<string, ClienteData>()

  await Promise.all(
    abas.map(async (aba) => {
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

  const data = Array.from(clienteMap.values()).filter(c => c.campanhas.length > 0)

  data.sort((a, b) => {
    const risco = (c: ClienteData) =>
      c.campanhas.some(x => !x.bateu && x.pct < 80 && x.diasRestantes <= 7 && x.status === 'ativa') ? 0 : 1
    return risco(a) - risco(b)
  })

  // Apenas clientes com campanhas reais no período (abas vazias excluídas automaticamente)
  const sheets = data.map(d => d.cliente).sort()

  return NextResponse.json({ sheets, data })
}

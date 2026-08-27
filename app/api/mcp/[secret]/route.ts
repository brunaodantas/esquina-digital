import { NextRequest, NextResponse } from 'next/server'

// Endpoint MCP remoto da Esquina: expõe Google Ads e TikTok Ads como conector,
// para funcionar no celular e no Cowork, não só na máquina do Bruno.
// A proteção é o segredo no caminho da URL, conferido contra MCP_SECRET.
export const maxDuration = 60

const ADS_VERSION = 'v24'
const DEV_TOKEN = process.env.GOOGLE_ADS_DEVELOPER_TOKEN ?? ''
const CLIENT_ID = process.env.GOOGLE_ADS_CLIENT_ID ?? ''
const CLIENT_SECRET = process.env.GOOGLE_ADS_CLIENT_SECRET ?? ''
const REFRESH_TOKEN = process.env.GOOGLE_ADS_REFRESH_TOKEN ?? ''
const MCC_ID = (process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID ?? '').replace(/-/g, '')
const MCP_SECRET = process.env.MCP_SECRET ?? ''

const TIKTOK_BASE =
  process.env.TIKTOK_ADS_API ?? 'https://digital-esquina.vercel.app/api/tiktok-ads'

// ---------------------------------------------------------------- Google Ads

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

async function adsFetch(path: string, body: unknown): Promise<any> {
  const token = await getToken()
  const res = await fetch(`https://googleads.googleapis.com/${ADS_VERSION}/${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'developer-token': DEV_TOKEN,
      'login-customer-id': MCC_ID,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })
  const txt = await res.text()
  if (!res.ok) throw new Error(`Google Ads: ${txt.slice(0, 600)}`)
  return txt ? JSON.parse(txt) : {}
}

const clean = (id: string) => String(id).replace(/-/g, '')

async function gaql(customerId: string, query: string): Promise<any[]> {
  const d = await adsFetch(`customers/${clean(customerId)}/googleAds:search`, { query })
  return d.results ?? []
}

async function listAccounts() {
  const rows = await gaql(
    MCC_ID,
    `SELECT customer_client.id, customer_client.descriptive_name,
            customer_client.currency_code
     FROM customer_client
     WHERE customer_client.manager = false AND customer_client.status = 'ENABLED'`,
  )
  return rows.map((r) => ({
    id: String(r.customerClient?.id ?? ''),
    name: r.customerClient?.descriptiveName ?? '',
    currency: r.customerClient?.currencyCode ?? '',
  }))
}

async function getCampaigns(customerId: string, dateRange: string) {
  const where = dateRange.includes(',')
    ? (() => {
        const [s, e] = dateRange.split(',')
        return `WHERE segments.date BETWEEN '${s.trim()}' AND '${e.trim()}'`
      })()
    : `WHERE segments.date DURING ${dateRange}`

  const rows = await gaql(
    customerId,
    `SELECT campaign.id, campaign.name, campaign.status, metrics.impressions,
            metrics.unique_users, metrics.clicks, metrics.cost_micros, metrics.ctr,
            metrics.average_cpc, metrics.average_cpm, metrics.video_trueview_views
     FROM campaign ${where} ORDER BY metrics.impressions DESC`,
  )
  return rows.map((r) => {
    const c = r.campaign ?? {}
    const m = r.metrics ?? {}
    return {
      id: String(c.id ?? ''),
      name: c.name ?? '',
      status: c.status ?? '',
      impressions: Number(m.impressions ?? 0),
      reach: Number(m.uniqueUsers ?? 0),
      clicks: Number(m.clicks ?? 0),
      cost: Math.round(Number(m.costMicros ?? 0)) / 1_000_000,
      ctr: Math.round(Number(m.ctr ?? 0) * 10000) / 100,
      cpc: Math.round(Number(m.averageCpc ?? 0)) / 1_000_000,
      cpm: Math.round(Number(m.averageCpm ?? 0)) / 1_000_000,
      video_views: Number(m.videoTrueviewViews ?? 0),
    }
  })
}

async function mutateCampaign(
  customerId: string,
  fields: Record<string, unknown>,
  mask: string,
  campaignId: string,
) {
  const cid = clean(customerId)
  const d = await adsFetch(`customers/${cid}/campaigns:mutate`, {
    operations: [
      {
        update: { resourceName: `customers/${cid}/campaigns/${campaignId}`, ...fields },
        updateMask: mask,
      },
    ],
  })
  return { ok: true, alterado: d.results?.[0]?.resourceName ?? '', ...fields }
}

async function setCampaignBudget(customerId: string, campaignId: string, dailyBudget: number) {
  const cid = clean(customerId)
  const rows = await gaql(
    cid,
    `SELECT campaign.campaign_budget, campaign_budget.amount_micros
     FROM campaign WHERE campaign.id = ${campaignId}`,
  )
  if (!rows.length) throw new Error(`Campanha ${campaignId} não encontrada`)
  const budgetResource = rows[0].campaign?.campaignBudget as string
  const anterior = Number(rows[0].campaignBudget?.amountMicros ?? 0) / 1_000_000

  const d = await adsFetch(`customers/${cid}/campaignBudgets:mutate`, {
    operations: [
      {
        update: {
          resourceName: budgetResource,
          amountMicros: String(Math.round(dailyBudget * 1_000_000)),
        },
        updateMask: 'amount_micros',
      },
    ],
  })
  return {
    ok: true,
    alterado: d.results?.[0]?.resourceName ?? '',
    orcamento_anterior: anterior,
    orcamento_novo: dailyBudget,
  }
}

// -------------------------------------------------------------------- TikTok

const TIKTOK_ACCOUNTS = [
  { nome: 'PMC Campinas', advertiser_id: '7621991089315774471' },
  { nome: 'Hortolândia', advertiser_id: '7621988608429506567' },
  { nome: 'ANFAVEA', advertiser_id: '7646886376989982741' },
  { nome: 'ANFAVEA (backup)', advertiser_id: '7657170346474373128' },
  { nome: 'Governo da Bahia', advertiser_id: '7621989577078784018' },
  { nome: 'Abradee', advertiser_id: '7621991605880406024' },
  { nome: 'Biodiesel', advertiser_id: '7621648190602952722' },
  { nome: 'Biodiesel 2', advertiser_id: '7621993104521920530' },
  { nome: 'Esquina Comunicação Digital', advertiser_id: '7322194824105590786' },
]

async function tiktokAccount(advertiserId: string | undefined, start: string, end: string) {
  const url = new URL(TIKTOK_BASE)
  url.searchParams.set('start', start)
  url.searchParams.set('end', end)
  if (advertiserId) url.searchParams.set('advertiser_id', advertiserId)
  const res = await fetch(url.toString())
  if (!res.ok) throw new Error(`Falha ao buscar dados do TikTok (HTTP ${res.status})`)
  const json = await res.json()
  const list: any[] = json.data ?? []
  // O endpoint devolve todas as contas e ignora o advertiser_id, por isso o
  // filtro acontece aqui em vez de confiar em data[0].
  const conta = advertiserId ? list.find((c) => String(c.id) === String(advertiserId)) : list[0]
  if (!conta) {
    throw new Error(
      advertiserId
        ? `advertiser_id ${advertiserId} não veio no retorno do dashboard nesse período. Contas retornadas: ${list
            .map((c) => `${c.nome} (${c.id})`)
            .join(', ')}`
        : 'Nenhuma conta retornada para esse período.',
    )
  }
  return conta
}

// ----------------------------------------------------------------- MCP tools

const TOOLS = [
  {
    name: 'gads_list_accounts',
    description: 'Lista as contas do Google Ads acessíveis pela MCC da Esquina, com id, nome e moeda.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'gads_get_campaigns',
    description:
      'Performance das campanhas de uma conta do Google Ads: impressões, alcance, cliques, custo, CTR, CPC, CPM e visualizações de vídeo.',
    inputSchema: {
      type: 'object',
      properties: {
        customer_id: { type: 'string', description: 'ID da conta, ex: 3488191619' },
        date_range: {
          type: 'string',
          description:
            "LAST_7_DAYS, LAST_14_DAYS, LAST_30_DAYS, THIS_MONTH, LAST_MONTH ou 'AAAA-MM-DD,AAAA-MM-DD'. Padrão LAST_30_DAYS.",
        },
      },
      required: ['customer_id'],
    },
  },
  {
    name: 'gads_gaql_query',
    description: 'Executa uma query GAQL livre no Google Ads e devolve as linhas em JSON.',
    inputSchema: {
      type: 'object',
      properties: {
        customer_id: { type: 'string' },
        query: { type: 'string', description: 'Query GAQL completa' },
      },
      required: ['customer_id', 'query'],
    },
  },
  {
    name: 'gads_pause_campaign',
    description:
      'Pausa uma campanha do Google Ads. Campanhas de vídeo desta conta recusam pausa por API.',
    inputSchema: {
      type: 'object',
      properties: { customer_id: { type: 'string' }, campaign_id: { type: 'string' } },
      required: ['customer_id', 'campaign_id'],
    },
  },
  {
    name: 'gads_enable_campaign',
    description: 'Reativa uma campanha do Google Ads. Exige confirmar=true.',
    inputSchema: {
      type: 'object',
      properties: {
        customer_id: { type: 'string' },
        campaign_id: { type: 'string' },
        confirmar: {
          type: 'boolean',
          description: 'Precisa ser true, confirmado pelo Bruno antes da chamada.',
        },
      },
      required: ['customer_id', 'campaign_id'],
    },
  },
  {
    name: 'gads_set_campaign_budget',
    description:
      'Altera o orçamento diário de uma campanha do Google Ads. daily_budget em reais, não em micros. Exige confirmar=true.',
    inputSchema: {
      type: 'object',
      properties: {
        customer_id: { type: 'string' },
        campaign_id: { type: 'string' },
        daily_budget: { type: 'number' },
        confirmar: { type: 'boolean' },
      },
      required: ['customer_id', 'campaign_id', 'daily_budget'],
    },
  },
  {
    name: 'gads_set_campaign_end_date',
    description:
      'Muda a data de término de uma campanha do Google Ads. Formato AAAA-MM-DD, não aceita data passada.',
    inputSchema: {
      type: 'object',
      properties: {
        customer_id: { type: 'string' },
        campaign_id: { type: 'string' },
        end_date: { type: 'string' },
      },
      required: ['customer_id', 'campaign_id', 'end_date'],
    },
  },
  {
    name: 'tiktok_list_accounts',
    description:
      'Lista as contas de TikTok Ads conectadas no dashboard interno da Esquina, com nome e advertiser_id.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'tiktok_get_summary',
    description:
      'Resumo da conta de TikTok no período: gasto, impressões, cliques, alcance, frequência, CTR, CPC, CPM.',
    inputSchema: {
      type: 'object',
      properties: {
        advertiser_id: { type: 'string' },
        start: { type: 'string', description: 'Data inicial AAAA-MM-DD' },
        end: { type: 'string', description: 'Data final AAAA-MM-DD' },
      },
      required: ['start', 'end'],
    },
  },
  {
    name: 'tiktok_get_campaigns',
    description:
      'Campanhas da conta de TikTok no período, com gasto, impressões, alcance, cliques, visualizações de vídeo e CTR/CPC/CPM/CPV.',
    inputSchema: {
      type: 'object',
      properties: {
        advertiser_id: { type: 'string' },
        start: { type: 'string' },
        end: { type: 'string' },
      },
      required: ['start', 'end'],
    },
  },
  {
    name: 'tiktok_get_adgroups',
    description: 'Grupos de anúncios da conta de TikTok no período, com as mesmas métricas por grupo.',
    inputSchema: {
      type: 'object',
      properties: {
        advertiser_id: { type: 'string' },
        start: { type: 'string' },
        end: { type: 'string' },
      },
      required: ['start', 'end'],
    },
  },
  {
    name: 'tiktok_get_ads',
    description: 'Anúncios da conta de TikTok no período, com as mesmas métricas por anúncio.',
    inputSchema: {
      type: 'object',
      properties: {
        advertiser_id: { type: 'string' },
        start: { type: 'string' },
        end: { type: 'string' },
      },
      required: ['start', 'end'],
    },
  },
]

async function callTool(name: string, args: Record<string, any>): Promise<unknown> {
  switch (name) {
    case 'gads_list_accounts':
      return listAccounts()

    case 'gads_get_campaigns':
      return getCampaigns(args.customer_id, args.date_range ?? 'LAST_30_DAYS')

    case 'gads_gaql_query':
      return gaql(args.customer_id, args.query)

    case 'gads_pause_campaign':
      return mutateCampaign(args.customer_id, { status: 'PAUSED' }, 'status', args.campaign_id)

    case 'gads_enable_campaign':
      if (!args.confirmar) {
        return {
          error:
            'Reativar campanha exige confirmação explícita do Bruno. Pergunte antes e chame de novo com confirmar=true.',
        }
      }
      return mutateCampaign(args.customer_id, { status: 'ENABLED' }, 'status', args.campaign_id)

    case 'gads_set_campaign_budget':
      if (!args.confirmar) {
        return {
          error:
            'Alterar orçamento exige confirmação explícita do Bruno. Mostre o valor atual, o novo valor e chame de novo com confirmar=true.',
        }
      }
      return setCampaignBudget(args.customer_id, args.campaign_id, Number(args.daily_budget))

    case 'gads_set_campaign_end_date':
      return mutateCampaign(args.customer_id, { endDate: args.end_date }, 'end_date', args.campaign_id)

    case 'tiktok_list_accounts':
      return { accounts: TIKTOK_ACCOUNTS }

    case 'tiktok_get_summary': {
      const conta = await tiktokAccount(args.advertiser_id, args.start, args.end)
      const { serie, campanhas, grupos, anuncios, audiencia, ...summary } = conta
      return summary
    }

    case 'tiktok_get_campaigns': {
      const conta = await tiktokAccount(args.advertiser_id, args.start, args.end)
      return {
        conta: conta.nome,
        periodo: { start: args.start, end: args.end },
        campanhas: conta.campanhas ?? [],
      }
    }

    case 'tiktok_get_adgroups': {
      const conta = await tiktokAccount(args.advertiser_id, args.start, args.end)
      return {
        conta: conta.nome,
        periodo: { start: args.start, end: args.end },
        grupos: conta.grupos ?? [],
      }
    }

    case 'tiktok_get_ads': {
      const conta = await tiktokAccount(args.advertiser_id, args.start, args.end)
      return {
        conta: conta.nome,
        periodo: { start: args.start, end: args.end },
        anuncios: conta.anuncios ?? [],
      }
    }

    default:
      throw new Error(`Ferramenta desconhecida: ${name}`)
  }
}

// ------------------------------------------------------------ JSON-RPC / MCP

function rpc(id: unknown, result: unknown) {
  return NextResponse.json({ jsonrpc: '2.0', id, result })
}

function rpcError(id: unknown, code: number, message: string) {
  return NextResponse.json({ jsonrpc: '2.0', id, error: { code, message } })
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ secret: string }> }) {
  const { secret } = await ctx.params
  if (!MCP_SECRET || secret !== MCP_SECRET) {
    return NextResponse.json({ error: 'não autorizado' }, { status: 404 })
  }

  let body: any
  try {
    body = await req.json()
  } catch {
    return rpcError(null, -32700, 'JSON inválido')
  }

  const { id, method, params } = body ?? {}

  // Notificação não espera resposta.
  if (id === undefined || id === null) return new NextResponse(null, { status: 202 })

  try {
    switch (method) {
      case 'initialize':
        return rpc(id, {
          protocolVersion: params?.protocolVersion ?? '2025-06-18',
          capabilities: { tools: {} },
          serverInfo: { name: 'esquina-ads', version: '1.0.0' },
        })

      case 'ping':
        return rpc(id, {})

      case 'tools/list':
        return rpc(id, { tools: TOOLS })

      case 'tools/call': {
        const toolName = params?.name as string
        const args = (params?.arguments ?? {}) as Record<string, any>
        try {
          const out = await callTool(toolName, args)
          return rpc(id, { content: [{ type: 'text', text: JSON.stringify(out, null, 2) }] })
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err)
          return rpc(id, { content: [{ type: 'text', text: `Erro: ${msg}` }], isError: true })
        }
      }

      default:
        return rpcError(id, -32601, `Método não suportado: ${method}`)
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return rpcError(id, -32603, msg)
  }
}

export async function GET(_req: NextRequest, ctx: { params: Promise<{ secret: string }> }) {
  const { secret } = await ctx.params
  if (!MCP_SECRET || secret !== MCP_SECRET) {
    return NextResponse.json({ error: 'não autorizado' }, { status: 404 })
  }
  // Sem canal SSE: este servidor responde tudo no POST.
  return new NextResponse(null, { status: 405 })
}

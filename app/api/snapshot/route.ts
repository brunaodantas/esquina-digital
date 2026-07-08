import { NextRequest, NextResponse } from 'next/server'
import { getSupabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// Grava um snapshot do mês corrente: 1 linha por (dia, plataforma, conta).
// Reusa as rotas que já existem (/api/meta-ads etc.) — não reimplementa coleta.
// Protegido por secret: header "Authorization: Bearer <CRON_SECRET>" (Vercel Cron)
// ou ?key=<SNAPSHOT_SECRET> (teste manual). /api/* não passa pelo middleware de auth.

type Snapshot = { dia: string; plataforma: string; conta_id: string; conta_nome: string; metricas: any; campanhas: any }

// Como extrair id/nome de cada plataforma (o resto vira "metricas")
const PLATAFORMAS: { rota: string; nome: string; id: (a: any) => string; nomeConta: (a: any) => string }[] = [
  { rota: 'meta-ads',   nome: 'meta',     id: a => String(a.id ?? ''),     nomeConta: a => a.nome ?? '' },
  { rota: 'google-ads', nome: 'google',   id: a => String(a.id ?? ''),     nomeConta: a => a.nome ?? '' },
  { rota: 'tiktok-ads', nome: 'tiktok',   id: a => String(a.id ?? ''),     nomeConta: a => a.nome ?? '' },
  { rota: 'entregas',   nome: 'entregas', id: a => String(a.cliente ?? ''), nomeConta: a => a.cliente ?? '' },
]

export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const auth = req.headers.get('authorization')
  const key = url.searchParams.get('key')
  const ok =
    (!!process.env.CRON_SECRET && auth === `Bearer ${process.env.CRON_SECRET}`) ||
    (!!process.env.SNAPSHOT_SECRET && key === process.env.SNAPSHOT_SECRET)
  if (!ok) return NextResponse.json({ error: 'não autorizado' }, { status: 401 })

  const origin = url.origin
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0)
  const dia = hoje.toISOString().slice(0, 10)
  const start = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-01`
  const end = dia

  // Busca as 4 plataformas em paralelo
  const respostas = await Promise.allSettled(
    PLATAFORMAS.map(p =>
      fetch(`${origin}/api/${p.rota}?start=${start}&end=${end}`, { cache: 'no-store' })
        .then(r => r.json())
        .then(j => ({ p, data: Array.isArray(j?.data) ? j.data : [] }))
    )
  )

  const linhas: Snapshot[] = []
  const resumo: Record<string, number> = {}
  for (const res of respostas) {
    if (res.status !== 'fulfilled') continue
    const { p, data } = res.value
    resumo[p.nome] = data.length
    for (const conta of data) {
      const id = p.id(conta)
      if (!id) continue
      // metricas = conta sem os arrays pesados; campanhas guardadas à parte
      const { campanhas, grupos, anuncios, serie, ...metricas } = conta
      linhas.push({
        dia, plataforma: p.nome, conta_id: id, conta_nome: p.nomeConta(conta),
        metricas, campanhas: campanhas ?? [],
      })
    }
  }

  if (linhas.length === 0) {
    return NextResponse.json({ ok: true, dia, gravadas: 0, resumo, aviso: 'nenhum dado retornado pelas rotas' })
  }

  try {
    const supabase = getSupabase()
    const { error } = await supabase
      .from('metric_snapshots')
      .upsert(linhas, { onConflict: 'dia,plataforma,conta_id' })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'erro Supabase' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, dia, gravadas: linhas.length, resumo })
}

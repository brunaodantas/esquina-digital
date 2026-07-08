import { NextRequest, NextResponse } from 'next/server'
import { getSupabase } from '@/lib/supabase'
import { CLIENTES } from '@/clientes'
import { KeywordRule } from '@/clientes/types'
import { fetchGoogleNewsRss } from '@/lib/news/rss'
import { isRelevant } from '@/lib/news/relevance'
import { normalizeUrl } from '@/lib/news/dedup'
import { DIGITAL_ESQUINA_HOST, isLocalHost } from '@/lib/domains'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// Ingestão diária de notícias/clipagem por cliente via Google News RSS.
// Protegido por secret: header "Authorization: Bearer <CRON_SECRET>" (Vercel Cron)
// ou ?key=<INGEST_SECRET> (teste manual). /api/* não passa pelo middleware de auth.
//
// Roda só a partir do projeto digital-esquina (mesma regra do /api/snapshot):
// o mesmo vercel.json existe nos dois projetos Vercel (mesmo repo), então sem
// essa checagem a ingestão rodaria em dobro — uma vez por domínio.

type Categoria = 'noticias' | 'clipagem'

async function ingestCategoria(clientSlug: string, categoria: Categoria, rule: KeywordRule) {
  const supabase = getSupabase()
  let gravadas = 0
  let vistas = 0

  for (const keyword of rule.include) {
    let items
    try {
      items = await fetchGoogleNewsRss(keyword)
    } catch (e) {
      console.error(`news-ingest: falha no RSS para "${keyword}":`, e)
      continue
    }

    for (const item of items) {
      vistas++
      const { relevant, matchedKeyword } = isRelevant(item, rule)
      if (!relevant || !item.link) continue

      const sourceUrl = normalizeUrl(item.link)
      const publishedAt = item.pubDate ? new Date(item.pubDate) : null

      const { error } = await supabase
        .from('client_news')
        .upsert(
          {
            client_slug: clientSlug,
            category: categoria,
            headline: item.title,
            summary: item.description,
            source: item.source,
            source_url: sourceUrl,
            published_at: publishedAt && !isNaN(publishedAt.getTime()) ? publishedAt.toISOString() : null,
            matched_keyword: matchedKeyword,
          },
          { onConflict: 'source_url', ignoreDuplicates: true }
        )
      if (!error) gravadas++
    }
  }

  return { vistas, gravadas }
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const auth = req.headers.get('authorization')
  const key = url.searchParams.get('key')
  const ok =
    (!!process.env.CRON_SECRET && auth === `Bearer ${process.env.CRON_SECRET}`) ||
    (!!process.env.INGEST_SECRET && key === process.env.INGEST_SECRET)
  if (!ok) return NextResponse.json({ error: 'não autorizado' }, { status: 401 })

  const host = req.headers.get('host') ?? ''
  if (host !== DIGITAL_ESQUINA_HOST && !isLocalHost(host)) {
    return NextResponse.json({ ok: true, skipped: 'cron só roda a partir de digital-esquina.vercel.app' })
  }

  try {
    getSupabase()
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? 'Supabase não configurado.' }, { status: 500 })
  }

  const resumo: Record<string, { noticias: any; clipagem: any }> = {}

  for (const cliente of Object.values(CLIENTES)) {
    const noticias = cliente.abas.includes('noticias')
      ? await ingestCategoria(cliente.slug, 'noticias', cliente.noticias)
      : null
    const clipagem = cliente.abas.includes('clipagem')
      ? await ingestCategoria(cliente.slug, 'clipagem', cliente.clipagem)
      : null
    resumo[cliente.slug] = { noticias, clipagem }
  }

  return NextResponse.json({ ok: true, resumo })
}

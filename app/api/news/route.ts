import { NextRequest, NextResponse } from 'next/server'
import { getSupabase } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const cliente = searchParams.get('cliente')
  const categoria = searchParams.get('categoria')

  if (!cliente || !categoria) {
    return NextResponse.json({ error: 'cliente e categoria são obrigatórios' }, { status: 400 })
  }

  try {
    const supabase = getSupabase()
    const { data, error } = await supabase
      .from('client_news')
      .select('id, headline, summary, source, source_url, published_at, matched_keyword')
      .eq('client_slug', cliente)
      .eq('category', categoria)
      .order('published_at', { ascending: false })
      .limit(100)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ data: data ?? [] })
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? 'Erro ao consultar notícias.' }, { status: 500 })
  }
}

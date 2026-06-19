import { getSupabase } from '@/lib/supabase'

// Cache compartilhado em Supabase (tabela api_cache). Tudo tolerante a falha:
// se o Supabase estiver fora, readCache devolve null e writeCache não faz nada —
// a rota segue buscando ao vivo, exatamente como antes.

export async function readCache(chave: string, maxAgeMs: number): Promise<any | null> {
  try {
    const supabase = getSupabase()
    const { data, error } = await supabase
      .from('api_cache')
      .select('payload, atualizado_em')
      .eq('chave', chave)
      .maybeSingle()
    if (error || !data) return null
    const idade = Date.now() - new Date(data.atualizado_em).getTime()
    if (idade > maxAgeMs) return null
    return data.payload
  } catch {
    return null
  }
}

export async function writeCache(chave: string, payload: any): Promise<void> {
  try {
    const supabase = getSupabase()
    await supabase
      .from('api_cache')
      .upsert({ chave, payload, atualizado_em: new Date().toISOString() }, { onConflict: 'chave' })
  } catch {
    // silencioso: cache é best-effort, nunca derruba a rota
  }
}

import { createClient, SupabaseClient } from '@supabase/supabase-js'

// Cliente Supabase server-side (usa a chave secreta — NUNCA importar isto em componente client).
// Acesso total ao banco (ignora RLS), só roda em rotas /api e jobs.
let _client: SupabaseClient | null = null

export function getSupabase(): SupabaseClient {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_KEY
  if (!url || !key) throw new Error('SUPABASE_URL / SUPABASE_SERVICE_KEY não configurados.')
  if (!_client) {
    _client = createClient(url, key, { auth: { persistSession: false } })
  }
  return _client
}

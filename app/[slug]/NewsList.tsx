'use client'

import { useEffect, useState } from 'react'

interface NewsItem {
  id: number
  headline: string
  summary: string | null
  source: string | null
  source_url: string
  published_at: string | null
  matched_keyword: string | null
}

function fmtData(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export default function NewsList({ slug, categoria }: { slug: string; categoria: 'noticias' | 'clipagem' }) {
  const [items, setItems] = useState<NewsItem[] | null>(null)
  const [error, setError] = useState('')
  const [busca, setBusca] = useState('')

  useEffect(() => {
    setItems(null); setError('')
    fetch(`/api/news?cliente=${slug}&categoria=${categoria}`)
      .then(r => r.json())
      .then(res => { if (res.error) setError(res.error); else setItems(res.data ?? []) })
      .catch(() => setError('Erro ao carregar notícias.'))
  }, [slug, categoria])

  const filtrados = (items ?? []).filter(i => {
    if (!busca) return true
    const alvo = `${i.headline} ${i.summary ?? ''}`.toLowerCase()
    return alvo.includes(busca.toLowerCase())
  })

  return (
    <div style={{ flex: 1, overflow: 'auto', padding: 20, background: '#0d0d0d' }}>
      <input
        placeholder="Buscar..."
        value={busca}
        onChange={e => setBusca(e.target.value)}
        style={{ width: '100%', maxWidth: 360, height: 34, padding: '0 12px', borderRadius: 7, border: '1px solid #333', background: '#1a1a1a', color: '#fff', fontSize: 13, marginBottom: 16 }}
      />

      {error && <div style={{ color: '#f87171', fontSize: 13 }}>{error}</div>}
      {!error && items === null && <div style={{ color: '#999', fontSize: 13 }}>Carregando...</div>}
      {!error && items !== null && filtrados.length === 0 && (
        <div style={{ color: '#999', fontSize: 13 }}>Nenhuma notícia encontrada ainda.</div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
        {filtrados.map(item => (
          <a
            key={item.id}
            href={item.source_url}
            target="_blank"
            rel="noopener noreferrer"
            style={{ display: 'block', padding: 14, borderRadius: 10, background: '#1a1a1a', border: '1px solid #2a2a2a', textDecoration: 'none', color: 'inherit' }}
          >
            <div style={{ fontSize: 11, color: '#7ba3ff', marginBottom: 6 }}>{fmtData(item.published_at)}</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#fff', marginBottom: 6, lineHeight: 1.3 }}>{item.headline}</div>
            {item.summary && <div style={{ fontSize: 12.5, color: '#aaa', lineHeight: 1.4, marginBottom: 8 }}>{item.summary}</div>}
            <div style={{ fontSize: 11, color: '#666' }}>{item.source}</div>
          </a>
        ))}
      </div>
    </div>
  )
}

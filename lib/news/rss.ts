import { XMLParser } from 'fast-xml-parser'

export interface RssItem {
  title: string
  link: string
  pubDate: string
  source: string
  description: string
}

// Busca o RSS de busca do Google News para uma keyword, em pt-BR/Brasil.
export async function fetchGoogleNewsRss(query: string): Promise<RssItem[]> {
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=pt-BR&gl=BR&ceid=BR:pt-419`
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, cache: 'no-store' })
  if (!res.ok) return []
  const xml = await res.text()

  const parser = new XMLParser({ ignoreAttributes: false })
  const json = parser.parse(xml)
  const items = json?.rss?.channel?.item ?? []
  const arr = Array.isArray(items) ? items : items ? [items] : []

  return arr.map((it: any): RssItem => ({
    title: String(it.title ?? ''),
    link: String(it.link ?? ''),
    pubDate: String(it.pubDate ?? ''),
    source: String(it.source?.['#text'] ?? it.source ?? ''),
    description: String(it.description ?? ''),
  }))
}

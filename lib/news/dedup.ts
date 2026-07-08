// Normaliza a URL da notícia para comparação/dedup: remove parâmetros de tracking
// (utm_*, etc.) e a barra final, para que a mesma notícia com querystrings
// diferentes não seja gravada duas vezes.
export function normalizeUrl(url: string): string {
  try {
    const u = new URL(url)
    const paramsToDrop: string[] = []
    u.searchParams.forEach((_, key) => {
      if (/^utm_|^ref$|^oc$/i.test(key)) paramsToDrop.push(key)
    })
    paramsToDrop.forEach(key => u.searchParams.delete(key))
    u.hash = ''
    let s = u.toString()
    if (s.endsWith('/')) s = s.slice(0, -1)
    return s
  } catch {
    return url.trim()
  }
}

import { KeywordRule } from '@/clientes/types'

function normalize(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
}

// Match de frase inteira com fronteira de palavra — nunca substring solta.
// É essa fronteira que evita o bug do SIGNAL, em que "lum1no" (substring)
// casou por acaso com conteúdo sobre "lúmen"/LED.
function hasPhrase(haystack: string, phrase: string): boolean {
  const h = normalize(haystack)
  const p = normalize(phrase).trim()
  if (!p) return false
  const escaped = p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const re = new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`, 'i')
  return re.test(h)
}

export interface RelevanceResult {
  relevant: boolean
  matchedKeyword?: string
}

export function isRelevant(item: { title: string; description: string }, rule: KeywordRule): RelevanceResult {
  const text = `${item.title} ${item.description}`

  // EXCLUDE tem prioridade absoluta.
  if (rule.exclude.some(term => hasPhrase(text, term))) return { relevant: false }

  const matched = rule.include.find(term => hasPhrase(text, term))
  if (!matched) return { relevant: false }

  if (rule.requireContext && rule.requireContext.length > 0) {
    const hasContext = rule.requireContext.some(term => hasPhrase(text, term))
    if (!hasContext) return { relevant: false }
  }

  return { relevant: true, matchedKeyword: matched }
}

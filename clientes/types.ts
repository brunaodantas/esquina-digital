export interface KeywordRule {
  /** Frases-âncora obrigatórias — cada uma deve ser específica o bastante para não precisar de contexto. */
  include: string[]
  /** Ao menos um destes termos deve co-ocorrer com o include para o item ser considerado relevante. */
  requireContext?: string[]
  /** Se qualquer termo aparecer, o item é descartado mesmo que o include bata. */
  exclude: string[]
}

export interface ClienteConfig {
  slug: string
  nome: string
  abas: Array<'midia' | 'noticias' | 'clipagem'>
  /** IDs de conta Meta Ads do cliente (sem prefixo "act_"). */
  metaAccountIds: string[]
  noticias: KeywordRule
  clipagem: KeywordRule
}

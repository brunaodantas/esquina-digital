import { ClienteConfig } from './types'

export const clienteCelina: ClienteConfig = {
  slug: 'celina',
  nome: 'Celina Leão',
  abas: ['midia', 'noticias', 'clipagem'],
  // Conta "Celina 2025 CARTÃO". Podem ser adicionadas outras contas depois.
  metaAccountIds: ['927384352383311'],

  noticias: {
    include: ['Celina Leão', 'governadora Celina', 'Celina Leão GDF', 'Celina Leão governo'],
    requireContext: ['governadora', 'Distrito Federal', 'DF', 'GDF', 'Brasília'],
    exclude: [],
  },

  clipagem: {
    include: [
      // cenário eleitoral DF
      'eleições 2026 Distrito Federal',
      'eleições DF 2026',
      'governo do Distrito Federal',
      'GDF',
      'pesquisa eleitoral DF governador',
      // adversários / pré-candidatos ao GDF 2026
      'José Roberto Arruda',
      'Leandro Grass',
      'Ricardo Cappelli',
      'Paula Belmonte',
      'Kiko Caputo',
      'Izalci Lucas',
    ],
    requireContext: [],
    exclude: [],
  },
}

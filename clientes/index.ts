import { clienteCelina } from './celina'
import { ClienteConfig } from './types'

export const CLIENTES: Record<string, ClienteConfig> = {
  celina: clienteCelina,
}

export function getCliente(slug: string): ClienteConfig | undefined {
  return CLIENTES[slug]
}

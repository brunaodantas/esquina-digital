'use client'

import { useParams } from 'next/navigation'
import MetaAdsPage from '@/app/dashboard/meta-ads/page'
import { getCliente } from '@/clientes'

export default function ClienteMidiaPage() {
  const params = useParams<{ slug: string }>()
  const cliente = getCliente(params?.slug ?? '')
  if (!cliente) return null
  return <MetaAdsPage theme="dark" contaIds={cliente.metaAccountIds} />
}

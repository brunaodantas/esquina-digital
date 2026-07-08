'use client'

import { useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { getCliente } from '@/clientes'

export default function ClienteIndexPage() {
  const router = useRouter()
  const params = useParams<{ slug: string }>()
  const slug = params?.slug ?? ''
  const cliente = getCliente(slug)

  useEffect(() => {
    if (cliente && cliente.abas.length > 0) {
      router.replace(`/${slug}/${cliente.abas[0]}`)
    }
  }, [cliente, router, slug])

  return null
}

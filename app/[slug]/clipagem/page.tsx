'use client'

import { useParams } from 'next/navigation'
import NewsList from '../NewsList'

export default function ClienteClipagemPage() {
  const params = useParams<{ slug: string }>()
  return <NewsList slug={params?.slug ?? ''} categoria="clipagem" />
}

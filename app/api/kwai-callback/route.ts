import { NextRequest, NextResponse } from 'next/server'

const REDIRECT_URI = 'https://digital-esquina.vercel.app/api/kwai-callback'

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code')
  const error = request.nextUrl.searchParams.get('error')

  if (error) {
    return new NextResponse(`<h2>Erro: ${error}</h2>`, { headers: { 'Content-Type': 'text/html' } })
  }
  if (!code) {
    return new NextResponse('<h2>Nenhum código recebido.</h2>', { headers: { 'Content-Type': 'text/html' } })
  }

  const clientId = process.env.KWAI_CLIENT_ID ?? ''
  const clientSecret = process.env.KWAI_CLIENT_SECRET ?? ''

  // Troca o código de autorização por um access_token (GET, conforme docs do Kwai Marketing API)
  const params = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: REDIRECT_URI,
  })

  const res = await fetch(`https://business.kwai.com/oauth/token?${params.toString()}`)
  const data = await res.json()

  const html = `<!DOCTYPE html><html><body style="font-family:monospace;padding:32px">
<h2>Kwai OAuth — Token Gerado</h2>
<pre style="background:#f0f0f0;padding:16px;border-radius:8px">${JSON.stringify(data, null, 2)}</pre>
<p>Copie o <strong>access_token</strong> (e o <strong>refresh_token</strong>, se houver) e adicione como env vars na Vercel
(ex.: <code>KWAI_ACCESS_TOKEN</code> / <code>KWAI_REFRESH_TOKEN</code>).</p>
</body></html>`

  return new NextResponse(html, { headers: { 'Content-Type': 'text/html' } })
}

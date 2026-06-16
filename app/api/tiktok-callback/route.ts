import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code')
  const error = request.nextUrl.searchParams.get('error')

  if (error) {
    return new NextResponse(`<h2>Erro: ${error}</h2>`, { headers: { 'Content-Type': 'text/html' } })
  }

  if (!code) {
    return new NextResponse('<h2>Nenhum código recebido.</h2>', { headers: { 'Content-Type': 'text/html' } })
  }

  // Exchange code for access token
  const res = await fetch('https://business-api.tiktok.com/open_api/v1.3/oauth2/access_token/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      app_id: '7651479305595125777',
      secret: process.env.TIKTOK_APP_SECRET,
      auth_code: code,
    }),
  })
  const data = await res.json()

  const html = `<!DOCTYPE html><html><body style="font-family:monospace;padding:32px">
<h2>TikTok OAuth — Token Gerado</h2>
<pre style="background:#f0f0f0;padding:16px;border-radius:8px">${JSON.stringify(data, null, 2)}</pre>
<p>Copie o <strong>access_token</strong> e adicione como env var <code>TIKTOK_ACCESS_TOKEN</code> na Vercel.</p>
</body></html>`

  return new NextResponse(html, { headers: { 'Content-Type': 'text/html' } })
}

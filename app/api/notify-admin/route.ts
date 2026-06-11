import { Resend } from 'resend'
import { NextRequest, NextResponse } from 'next/server'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(req: NextRequest) {
  const { email, name } = await req.json()

  try {
    await resend.emails.send({
      from: 'Esquina Digital <onboarding@resend.dev>',
      to: 'bruno@esquina.online',
      subject: 'Novo usuário aguardando aprovação',
      html: `
        <p>Um novo usuário solicitou acesso ao Esquina Digital:</p>
        <ul>
          <li><strong>Nome:</strong> ${name}</li>
          <li><strong>E-mail:</strong> ${email}</li>
        </ul>
        <p>Acesse o <a href="https://console.firebase.google.com/project/esquina-digital-110626/firestore">Firestore</a> para aprovar.</p>
      `,
    })
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('Resend error:', err)
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}

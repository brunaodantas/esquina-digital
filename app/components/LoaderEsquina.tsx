'use client'

import { useEffect, useRef } from 'react'

// Loader animado — mesma identidade visual do esquina.online (nós neurais em
// canvas de fundo, logo com preenchimento animado esquerda→direita, contador
// percentual e frases de etapa). Porta quase 1:1 o main.js do site público,
// só trocando o gatilho de término (lá é window.load; aqui é a checagem de
// autenticação, via onDone).
const PHRASES = [
  'Começamos aqui',
  'Aguarde enquanto conectamos os pontos',
  'Mapeando as possibilidades',
  'Agora é só virar na primeira Esquina',
]
const PHRASE_AT = [0, 700, 1500, 2200]
const MIN_DURATION = 2800
const LOGO_ASPECT = 1293 / 327

export default function LoaderEsquina({ onDone }: { onDone: () => void }) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const cardRef = useRef<HTMLDivElement>(null)
  const bgCanvasRef = useRef<HTMLCanvasElement>(null)
  const logoCanvasRef = useRef<HTMLCanvasElement>(null)
  const pctRef = useRef<HTMLSpanElement>(null)
  const phraseRef = useRef<HTMLParagraphElement>(null)
  const doneRef = useRef(false)

  useEffect(() => {
    const wrap = wrapRef.current
    const bgCanvas = bgCanvasRef.current
    const logoCanvas = logoCanvasRef.current
    const pctEl = pctRef.current
    const phraseEl = phraseRef.current
    if (!wrap || !logoCanvas) return

    // Respeita prefers-reduced-motion: pula direto pro fim (logo cheia, 100%,
    // última frase), sem canvas animando — mesma regra já aplicada no CSS dos
    // relatórios (feedback_relatorios_css_padrao).
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduceMotion) {
      if (phraseEl) phraseEl.textContent = PHRASES[PHRASES.length - 1]
      if (pctEl) pctEl.textContent = '100'
      const lCtx0 = logoCanvas.getContext('2d')
      const img = new Image()
      img.onload = () => {
        const availW = Math.min(window.innerWidth * .80, 372)
        const w = Math.round(Math.max(200, Math.min(availW, 372)))
        const h = Math.round(w / LOGO_ASPECT)
        logoCanvas.width = w; logoCanvas.height = h
        logoCanvas.style.width = w + 'px'; logoCanvas.style.height = h + 'px'
        lCtx0?.drawImage(img, 0, 0, w, h)
      }
      img.src = '/logo.webp'
      const t = setTimeout(onDone, 400)
      return () => clearTimeout(t)
    }

    let rafId = 0
    let progress = 0
    let dismissed = false
    const START_TIME = performance.now()
    const easeOut = (t: number) => 1 - Math.pow(1 - t, 3)
    const lerp = (a: number, b: number, t: number) => a + (b - a) * t

    function calcProgress(now: number) {
      const elapsed = now - START_TIME
      const timeFrac = Math.min(elapsed / MIN_DURATION, 1)
      const timeProg = easeOut(timeFrac)
      progress = Math.min(1, Math.max(progress, lerp(progress, timeProg, 0.035)))
    }

    let currentPhrase = -1
    let phraseTransitioning = false
    function showPhrase(idx: number) {
      if (idx === currentPhrase || phraseTransitioning || !phraseEl) return
      phraseTransitioning = true
      phraseEl.classList.remove('phrase-in')
      phraseEl.classList.add('phrase-out')
      setTimeout(() => {
        phraseEl.textContent = PHRASES[idx]
        phraseEl.classList.remove('phrase-out')
        void phraseEl.offsetWidth
        phraseEl.classList.add('phrase-in')
        currentPhrase = idx
        phraseTransitioning = false
      }, 460)
    }
    function updatePhrase(now: number) {
      const elapsed = now - START_TIME
      let idx = 0
      for (let i = PHRASE_AT.length - 1; i >= 0; i--) {
        if (elapsed >= PHRASE_AT[i]) { idx = i; break }
      }
      showPhrase(idx)
    }
    if (phraseEl) {
      phraseEl.textContent = PHRASES[0]
      phraseEl.classList.add('phrase-in')
      currentPhrase = 0
    }

    // ── Nós neurais (fundo) ──
    const bgCtx = bgCanvas ? bgCanvas.getContext('2d') : null
    let bgW = 0, bgH = 0, bgDpr = 1
    const N_COUNT = 52
    const nodes = Array.from({ length: N_COUNT }, () => {
      const speed = 0.00018 + Math.random() * 0.00022
      const angle = Math.random() * Math.PI * 2
      return {
        x: Math.random(), y: Math.random(),
        vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
        r: 1.5 + Math.random() * 2.0, a: 0.18 + Math.random() * 0.22,
        connThresh: 0.02 + Math.random() * 0.90,
      }
    })
    const edgeState = new Map<number, number>()
    let EDGE_PX = 180

    function resizeBg() {
      if (!bgCanvas || !bgCtx) return
      bgDpr = window.devicePixelRatio || 1
      bgW = window.innerWidth; bgH = window.innerHeight
      bgCanvas.width = bgW * bgDpr; bgCanvas.height = bgH * bgDpr
      bgCanvas.style.width = bgW + 'px'; bgCanvas.style.height = bgH + 'px'
      bgCtx.setTransform(bgDpr, 0, 0, bgDpr, 0, 0)
      EDGE_PX = Math.min(bgW, bgH) * 0.24
    }
    resizeBg()
    window.addEventListener('resize', resizeBg)

    function drawBg() {
      if (!bgCtx) return
      bgCtx.clearRect(0, 0, bgW, bgH)
      const grd = bgCtx.createRadialGradient(bgW / 2, bgH / 2, 0, bgW / 2, bgH / 2, Math.max(bgW, bgH) * .6)
      grd.addColorStop(0, 'rgba(139,92,246,.09)')
      grd.addColorStop(.45, 'rgba(139,92,246,.03)')
      grd.addColorStop(1, 'rgba(0,0,0,0)')
      bgCtx.fillStyle = grd
      bgCtx.fillRect(0, 0, bgW, bgH)

      nodes.forEach(n => {
        n.x += n.vx; n.y += n.vy
        if (n.x < 0) { n.x = 0; n.vx = Math.abs(n.vx) * (0.9 + Math.random() * .2) }
        if (n.x > 1) { n.x = 1; n.vx = -Math.abs(n.vx) * (0.9 + Math.random() * .2) }
        if (n.y < 0) { n.y = 0; n.vy = Math.abs(n.vy) * (0.9 + Math.random() * .2) }
        if (n.y > 1) { n.y = 1; n.vy = -Math.abs(n.vy) * (0.9 + Math.random() * .2) }
      })

      for (let i = 0; i < N_COUNT; i++) {
        for (let j = i + 1; j < N_COUNT; j++) {
          const ni = nodes[i], nj = nodes[j]
          const dx = (ni.x - nj.x) * bgW
          const dy = (ni.y - nj.y) * bgH
          const dist = Math.sqrt(dx * dx + dy * dy)
          const thresh = (ni.connThresh + nj.connThresh) * 0.5
          const active = dist < EDGE_PX && progress > thresh
          const key = i * 1000 + j
          let dp = edgeState.get(key) || 0
          dp = lerp(dp, active ? 1 : 0, active ? 0.038 : 0.022)
          if (dp < 0.005) { edgeState.delete(key); continue }
          edgeState.set(key, dp)

          const proximity = 1 - dist / EDGE_PX
          const alpha = dp * proximity * 0.16
          const ax = ni.x * bgW, ay = ni.y * bgH
          const bx = nj.x * bgW, by = nj.y * bgH
          const ex = ax + (bx - ax) * dp
          const ey = ay + (by - ay) * dp

          const grad = bgCtx.createLinearGradient(ax, ay, ex, ey)
          grad.addColorStop(0, `rgba(200,185,255,${alpha * .5})`)
          grad.addColorStop(1, `rgba(139,92,246,${alpha})`)

          bgCtx.save()
          if (dp < 0.95) { bgCtx.shadowColor = 'rgba(167,139,250,.28)'; bgCtx.shadowBlur = 4 }
          bgCtx.strokeStyle = grad
          bgCtx.lineWidth = 0.55 + proximity * 0.25
          bgCtx.lineCap = 'round'
          bgCtx.beginPath()
          bgCtx.moveTo(ax, ay)
          bgCtx.lineTo(ex, ey)
          bgCtx.stroke()
          bgCtx.restore()
        }
      }

      nodes.forEach(n => {
        const nx = n.x * bgW, ny = n.y * bgH
        bgCtx.save()
        bgCtx.beginPath()
        bgCtx.arc(nx, ny, n.r + 4, 0, Math.PI * 2)
        bgCtx.fillStyle = `rgba(139,92,246,${n.a * 0.20})`
        bgCtx.fill()
        bgCtx.restore()

        bgCtx.save()
        bgCtx.shadowColor = 'rgba(180,160,255,.45)'
        bgCtx.shadowBlur = 6
        bgCtx.fillStyle = `rgba(215,205,255,${n.a})`
        bgCtx.beginPath()
        bgCtx.arc(nx, ny, n.r, 0, Math.PI * 2)
        bgCtx.fill()
        bgCtx.restore()
      })
    }

    // ── Logo com preenchimento animado ──
    const lCtx = logoCanvas.getContext('2d')!
    const logoImg = new Image()
    let logoLoaded = false
    let lW = 0, lH = 0, lDpr = 1
    let maskCanvas: HTMLCanvasElement | null = null

    function resizeLogo() {
      lDpr = window.devicePixelRatio || 1
      const cardEl = cardRef.current
      let availW: number
      if (cardEl && cardEl.clientWidth > 0) availW = cardEl.clientWidth - 128
      else availW = Math.min(window.innerWidth * .80, 372)
      lW = Math.round(Math.max(200, Math.min(availW, 372)))
      lH = Math.round(lW / LOGO_ASPECT)
      logoCanvas!.width = lW * lDpr
      logoCanvas!.height = lH * lDpr
      logoCanvas!.style.width = lW + 'px'
      logoCanvas!.style.height = lH + 'px'
      lCtx.setTransform(lDpr, 0, 0, lDpr, 0, 0)
      if (maskCanvas && logoLoaded) buildMask()
    }
    resizeLogo()
    window.addEventListener('resize', resizeLogo)

    function buildMask() {
      maskCanvas = document.createElement('canvas')
      maskCanvas.width = lW * lDpr
      maskCanvas.height = lH * lDpr
      const mCtx = maskCanvas.getContext('2d')!
      mCtx.setTransform(lDpr, 0, 0, lDpr, 0, 0)
      mCtx.drawImage(logoImg, 0, 0, lW, lH)
    }

    logoImg.src = '/logo.webp'
    logoImg.onload = () => { logoLoaded = true; buildMask() }

    function drawLogo(p: number) {
      lCtx.clearRect(0, 0, lW, lH)
      if (!logoLoaded || !maskCanvas) return

      lCtx.save()
      lCtx.globalAlpha = 0.07
      lCtx.drawImage(logoImg, 0, 0, lW, lH)
      lCtx.restore()

      const fillX = lW * p
      if (fillX > 0) {
        const tmp = document.createElement('canvas')
        tmp.width = lW * lDpr; tmp.height = lH * lDpr
        const tCtx = tmp.getContext('2d')!
        tCtx.setTransform(lDpr, 0, 0, lDpr, 0, 0)
        tCtx.drawImage(maskCanvas, 0, 0, lW, lH)
        tCtx.globalCompositeOperation = 'source-in'
        tCtx.fillStyle = '#ffffff'
        tCtx.fillRect(0, 0, fillX, lH)

        lCtx.save()
        lCtx.shadowColor = 'rgba(255,255,255,.18)'
        lCtx.shadowBlur = 16
        lCtx.drawImage(tmp, 0, 0, lW, lH)
        lCtx.restore()
      }

      if (p > 0.01 && p < 0.995) {
        const sTmp = document.createElement('canvas')
        sTmp.width = lW * lDpr; sTmp.height = lH * lDpr
        const sCtx = sTmp.getContext('2d')!
        sCtx.setTransform(lDpr, 0, 0, lDpr, 0, 0)
        sCtx.drawImage(maskCanvas, 0, 0, lW, lH)
        sCtx.globalCompositeOperation = 'source-in'
        const shimW = lW * 0.048
        const shimX = fillX - shimW * .5
        const shimG = sCtx.createLinearGradient(shimX, 0, shimX + shimW, 0)
        shimG.addColorStop(0, 'rgba(255,255,255,0)')
        shimG.addColorStop(0.5, 'rgba(255,255,255,.9)')
        shimG.addColorStop(1, 'rgba(255,255,255,0)')
        sCtx.fillStyle = shimG
        sCtx.fillRect(Math.max(0, shimX - shimW * .5), 0, shimW * 2, lH)
        lCtx.save()
        lCtx.shadowColor = 'rgba(255,255,255,.5)'
        lCtx.shadowBlur = 10
        lCtx.drawImage(sTmp, 0, 0, lW, lH)
        lCtx.restore()
      }
    }

    function updatePct(p: number) {
      if (pctEl) pctEl.textContent = String(Math.round(p * 100))
    }

    function frame(now: number) {
      if (dismissed) return
      calcProgress(now)
      drawBg()
      drawLogo(progress)
      updatePct(progress)
      updatePhrase(now)

      // >= 0.999, não >= 1: o lerp assintótico rumo a 1 nunca bate exatamente
      // no valor exato em tempo hábil (aproxima mas não alcança) — travava a
      // tela em "100%" por vários segundos antes de finalmente destravar.
      if (progress >= 0.999) {
        drawLogo(1); updatePct(1)
        dismissed = true
        setTimeout(finish, 520)
        return
      }
      rafId = requestAnimationFrame(frame)
    }

    function finish() {
      if (doneRef.current) return
      doneRef.current = true
      if (wrapRef.current) wrapRef.current.classList.add('loader-hidden')
      setTimeout(onDone, 480)
    }

    rafId = requestAnimationFrame(frame)

    // Segurança: nunca deixa o usuário preso na tela de entrada, aconteça o
    // que acontecer com a animação (mesma rede de proteção do esquina.online).
    const safety = setTimeout(() => { if (!dismissed) { dismissed = true; finish() } }, 7000)

    return () => {
      cancelAnimationFrame(rafId)
      clearTimeout(safety)
      window.removeEventListener('resize', resizeBg)
      window.removeEventListener('resize', resizeLogo)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div ref={wrapRef} className="loader-wrap" aria-hidden="true">
      <canvas ref={bgCanvasRef} className="loader-bg-canvas" />
      <div ref={cardRef} className="loader-card">
        <div className="loader-logo-stage">
          <canvas ref={logoCanvasRef} className="loader-logo-canvas" />
        </div>
        <div className="loader-pct-wrap">
          <span className="loader-pct" ref={pctRef}>0</span><span className="loader-pct-sym">%</span>
        </div>
        <p className="loader-phrase" ref={phraseRef}>Começamos aqui</p>
      </div>

      <style jsx>{`
        .loader-wrap {
          position: fixed;
          inset: 0;
          z-index: 999999;
          background: #08080f;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: opacity 1s cubic-bezier(.4,0,.2,1), visibility 1s;
        }
        .loader-wrap.loader-hidden {
          opacity: 0;
          visibility: hidden;
          pointer-events: none;
        }
        .loader-bg-canvas {
          position: absolute;
          inset: 0;
          width: 100% !important;
          height: 100% !important;
          display: block;
          pointer-events: none;
          z-index: 0;
        }
        .loader-card {
          position: relative;
          z-index: 2;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          text-align: center;
          gap: 28px;
          padding: 56px 64px 52px;
          width: min(500px, 90vw);
          background: rgba(14,12,30,.55);
          backdrop-filter: blur(40px) saturate(160%);
          -webkit-backdrop-filter: blur(40px) saturate(160%);
          border: 1px solid rgba(139,92,246,.18);
          border-radius: 32px;
          box-shadow:
            0 0 0 1px rgba(255,255,255,.06) inset,
            0 32px 80px rgba(0,0,0,.7),
            0 0 120px rgba(139,92,246,.12);
          opacity: 0;
          animation: ldCardIn .75s .08s cubic-bezier(.22,1,.36,1) forwards;
        }
        .loader-card::before {
          content: '';
          position: absolute;
          top: 0; left: 15%; right: 15%;
          height: 1px;
          background: linear-gradient(90deg,
            transparent 0%, rgba(167,139,250,.35) 30%, rgba(255,255,255,.25) 50%,
            rgba(167,139,250,.35) 70%, transparent 100%);
          border-radius: 99px;
          pointer-events: none;
        }
        .loader-card::after {
          content: '';
          position: absolute;
          inset: -80px;
          background: radial-gradient(ellipse at 50% 55%,
            rgba(139,92,246,.22) 0%, rgba(139,92,246,.06) 45%, transparent 70%);
          border-radius: 50%;
          z-index: -1;
          pointer-events: none;
        }
        @keyframes ldCardIn {
          from { opacity: 0; transform: translateY(20px) scale(.97); }
          to   { opacity: 1; transform: translateY(0)    scale(1);   }
        }
        .loader-logo-stage { width: 100%; display: flex; align-items: center; justify-content: center; }
        .loader-logo-canvas { display: block; max-width: 100%; height: auto; margin: 0 auto; }
        .loader-pct-wrap {
          display: flex; align-items: baseline; justify-content: center; gap: 4px; width: 100%;
          opacity: 0; animation: ldFadeUp .6s .45s cubic-bezier(.22,1,.36,1) forwards;
        }
        .loader-pct {
          font-family: 'Sora', sans-serif;
          font-size: clamp(3rem, 7vw, 4.5rem);
          font-weight: 800;
          letter-spacing: -.06em;
          line-height: 1;
          font-variant-numeric: tabular-nums;
          color: #ffffff;
          text-align: center;
        }
        .loader-pct-sym {
          font-family: 'Sora', sans-serif;
          font-size: clamp(1.2rem, 2.5vw, 1.75rem);
          font-weight: 700;
          color: rgba(167,139,250,.7);
          line-height: 1;
        }
        .loader-phrase {
          font-family: 'DM Sans', sans-serif;
          font-size: clamp(.58rem, 1.5vw, .72rem);
          font-weight: 500;
          letter-spacing: .06em;
          text-transform: uppercase;
          color: rgba(190,170,255,.8);
          text-align: center;
          line-height: 1.4;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          width: 100%;
          transition: opacity .55s cubic-bezier(.4,0,.2,1), transform .55s cubic-bezier(.4,0,.2,1);
        }
        .loader-phrase.phrase-out { opacity: 0; transform: translateY(-6px); }
        .loader-phrase.phrase-in { opacity: 1; transform: translateY(0); }
        @keyframes ldFadeUp {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0);    }
        }
        @media (max-width: 480px) {
          .loader-card { padding: 44px 28px 40px; gap: 24px; border-radius: 24px; width: min(400px, 94vw); }
          .loader-pct { font-size: clamp(2.6rem, 14vw, 3.4rem); }
        }
        @media (prefers-reduced-motion: reduce) {
          .loader-card { animation: none; opacity: 1; transform: none; }
          .loader-pct-wrap { animation: none; opacity: 1; }
          .loader-phrase { transition: none; }
        }
      `}</style>
    </div>
  )
}

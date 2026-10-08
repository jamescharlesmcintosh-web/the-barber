import { useEffect, useRef } from 'react'
import { state, usePhase } from '../lib/store'
import { path, rebuildPath } from '../lib/experience'

type Fleck = { i: number; nx: number; ny: number; d: number; w: number; h: number; a: number; r: number }

export default function HairLayer() {
  const phase = usePhase()
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const cv = ref.current
    if (!cv) return
    const ctx = cv.getContext('2d', { alpha: true })
    if (!ctx) return

    const img = new Image()
    let imgReady = false
    img.onload = () => {
      imgReady = true
      dirty = true
    }
    img.src = '/assets/hair.png'

    let flecks: Fleck[] = []
    let dirty = true
    let lastT = -1
    let lastPhase = ''
    let lastDraw = 0

    const buildFlecks = () => {
      flecks = []
      const s = path.samples
      for (let i = 0; i < s.length; i += 5) {
        if ((i * 7919) % 11 > 4) continue
        const sm = s[i]
        const nx = -sm.ty
        const ny = sm.tx
        const side = (i % 3) - 1 // -1 | 0 | 1
        const d = path.hw * (0.12 + (((i * 2654435761) % 1000) / 1000) * 0.55) * (side >= 0 ? 1 : -1)
        flecks.push({
          i,
          nx: nx * d,
          ny: ny * d,
          d,
          w: 1.4 + ((i * 40503) % 100) / 100 * 3.4,
          h: 1 + ((i * 1237) % 100) / 100 * 1.6,
          a: 0.5 + (((i * 31) % 100) / 100) * 0.5,
          r: ((i * 977) % 360) * (Math.PI / 180),
        })
      }
    }
    buildFlecks()

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      const w = window.innerWidth
      const h = window.innerHeight
      cv.width = Math.round(w * dpr)
      cv.height = Math.round(h * dpr)
      cv.style.width = w + 'px'
      cv.style.height = h + 'px'
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      rebuildPath()
      buildFlecks()
      dirty = true
    }
    resize()
    window.addEventListener('resize', resize)

    const draw = () => {
      const vw = state.vw
      const vh = state.vh
      const now = performance.now()
      lastDraw = now
      ctx.setTransform(Math.min(window.devicePixelRatio || 1, 2), 0, 0, Math.min(window.devicePixelRatio || 1, 2), 0, 0)
      ctx.clearRect(0, 0, vw, vh)

      // --- hair surface -------------------------------------------------
      if (imgReady) {
        const sc = Math.max(vw / img.width, vh / img.height) * 1.08
        const w = img.width * sc
        const h = img.height * sc
        ctx.imageSmoothingQuality = 'high'
        ctx.drawImage(img, (vw - w) / 2, (vh - h) / 2, w, h)
      } else {
        ctx.fillStyle = '#070605'
        ctx.fillRect(0, 0, vw, vh)
      }

      // --- studio lighting on the fibre surface -------------------------
      ctx.globalCompositeOperation = 'source-atop'
      ctx.fillStyle = 'rgba(6,5,5,0.44)'
      ctx.fillRect(0, 0, vw, vh)

      const key = ctx.createRadialGradient(vw * 0.3, vh * 0.16, 0, vw * 0.3, vh * 0.16, Math.max(vw, vh) * 0.95)
      key.addColorStop(0, 'rgba(255,246,232,0.16)')
      key.addColorStop(0.45, 'rgba(214,224,238,0.05)')
      key.addColorStop(1, 'rgba(0,0,0,0)')
      ctx.fillStyle = key
      ctx.fillRect(0, 0, vw, vh)

      const vig = ctx.createRadialGradient(vw * 0.5, vh * 0.5, Math.min(vw, vh) * 0.28, vw * 0.5, vh * 0.5, Math.max(vw, vh) * 0.78)
      vig.addColorStop(0, 'rgba(0,0,0,0)')
      vig.addColorStop(1, 'rgba(0,0,0,0.72)')
      ctx.fillStyle = vig
      ctx.fillRect(0, 0, vw, vh)

      // --- the pass: cut the swath -------------------------------------
      const N = path.samples.length
      const k = Math.min(N - 1, Math.max(0, Math.round(state.T * (N - 1))))
      if (k > 2) {
        const L = path.left
        const R = path.right
        const build = () => {
          ctx.beginPath()
          ctx.moveTo(L[0].x, L[0].y)
          for (let i = 1; i <= k; i++) ctx.lineTo(L[i].x, L[i].y)
          for (let i = k; i >= 0; i--) ctx.lineTo(R[i].x, R[i].y)
          ctx.closePath()
        }

        ctx.save()
        ctx.globalCompositeOperation = 'destination-out'
        ctx.filter = 'blur(1.4px)'
        build()
        ctx.fill()
        ctx.restore()

        // contact shadow under the cut edge
        ctx.save()
        ctx.strokeStyle = 'rgba(0,0,0,0.42)'
        ctx.lineWidth = 15
        ctx.filter = 'blur(5px)'
        build()
        ctx.stroke()
        ctx.restore()

        // warm edge — the fresh line
        ctx.save()
        ctx.strokeStyle = 'rgba(240,201,142,0.34)'
        ctx.lineWidth = 1.25
        build()
        ctx.stroke()
        ctx.restore()

        // clipped fibre debris in the freshly cleared zone
        const lo = Math.max(0, k - 320)
        ctx.save()
        for (const f of flecks) {
          if (f.i < lo || f.i > k) continue
          const sm = path.samples[f.i]
          ctx.save()
          ctx.translate(sm.x + f.nx, sm.y + f.ny)
          ctx.rotate(f.r)
          ctx.fillStyle = `rgba(46,39,32,${f.a})`
          ctx.fillRect(-f.w / 2, -f.h / 2, f.w, f.h)
          ctx.restore()
        }
        ctx.restore()
      }

      // --- authored guide while waiting for the drag --------------------
      if (state.guide > 0.01 && k < N - 3) {
        ctx.save()
        ctx.strokeStyle = `rgba(233,179,113,${0.6 * state.guide})`
        ctx.lineWidth = 1.6
        ctx.setLineDash([7, 11])
        ctx.lineDashOffset = -((performance.now() / 1000) * 26) % 18
        ctx.beginPath()
        const start = Math.min(k + 4, N - 1)
        ctx.moveTo(path.samples[start].x, path.samples[start].y)
        for (let i = start + 6; i < N; i += 6) ctx.lineTo(path.samples[i].x, path.samples[i].y)
        ctx.stroke()
        ctx.restore()
      }

      ctx.globalCompositeOperation = 'source-over'
    }

    let raf = 0
    const loop = () => {
      const t = state.T
      const p = state.phase
      const animate = p === 'await' && performance.now() - lastDraw > 33
      if (dirty || t !== lastT || p !== lastPhase || animate) {
        dirty = false
        lastT = t
        lastPhase = p
        draw()
      }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', resize)
    }
  }, [])

  const on =
    phase === 'hairIn' ||
    phase === 'pass1' ||
    phase === 'await' ||
    phase === 'pass2' ||
    phase === 'auto'

  return <canvas ref={ref} className={'hair' + (on ? ' on' : '')} aria-hidden />
}

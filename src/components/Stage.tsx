import { useEffect, useRef } from 'react'
import HairLayer from './HairLayer'
import { state, setPhase, usePhase } from '../lib/store'
import { advance } from '../lib/path'
import { path, finishPass, autoComplete, isPassPhase } from '../lib/experience'

export default function Stage() {
  const phase = usePhase()
  const stageRef = useRef<HTMLDivElement>(null)

  // THE PRECISION PASS — constrained drag along the authored path
  useEffect(() => {
    const el = stageRef.current
    if (!el) return
    let down = false
    let lx = 0
    let ly = 0

    const onDown = (e: PointerEvent) => {
      if (state.phase === 'await') {
        setPhase('pass2')
        window.dispatchEvent(new Event('barber:pass2'))
      }
      if (state.phase !== 'pass2') return
      down = true
      lx = e.clientX
      ly = e.clientY
      el.setPointerCapture?.(e.pointerId)
    }
    const onMove = (e: PointerEvent) => {
      if (!down || state.phase !== 'pass2') return
      const dx = e.clientX - lx
      const dy = e.clientY - ly
      lx = e.clientX
      ly = e.clientY
      state.T = advance(path, state.T, dx, dy)
      if (state.T >= 1) finishPass()
    }
    const onUp = () => {
      down = false
    }

    el.addEventListener('pointerdown', onDown)
    el.addEventListener('pointermove', onMove)
    el.addEventListener('pointerup', onUp)
    el.addEventListener('pointercancel', onUp)
    return () => {
      el.removeEventListener('pointerdown', onDown)
      el.removeEventListener('pointermove', onMove)
      el.removeEventListener('pointerup', onUp)
      el.removeEventListener('pointercancel', onUp)
    }
  }, [])

  // Fallback: scrolling (or giving up) finishes the pass for the visitor.
  useEffect(() => {
    const onWheel = () => {
      if (isPassPhase()) autoComplete()
    }
    const onKey = (e: KeyboardEvent) => {
      if (!isPassPhase()) return
      if ([' ', 'ArrowDown', 'PageDown', 'Enter', 'Escape'].includes(e.key)) autoComplete()
    }
    window.addEventListener('wheel', onWheel, { passive: true })
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('wheel', onWheel)
      window.removeEventListener('keydown', onKey)
    }
  }, [])

  const hint =
    typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches
      ? 'SWIPE TO CLEAR THE PASS'
      : 'DRAG TO CLEAR THE PASS'

  const showHint = phase === 'await'
  const showScroll = phase === 'done'
  const curtainOff = phase !== 'boot' && phase !== 'black' && phase !== 'macro'
  const passing = phase === 'await' || phase === 'pass2'

  return (
    <section className={'stage' + (passing ? ' passing' : '')} id="top" ref={stageRef}>
      <div className="stage-content">
        <div className="hero">
          <div className="hero-left">
            <div className="eyebrow mono">
              <span>01</span>
              <i />
              <span>IDENTITY</span>
            </div>
            <h1 className="hero-title">
              <span className="t-the chrome-text">THE</span>
              <span className="t-name chrome-text">BARBER</span>
            </h1>
            <div className="hero-sub">
              <span className="mono label">SPECIALTY</span>
              <span className="serif">Skin fades, tapers &amp; beard line-ups</span>
            </div>
          </div>
          <figure className="hero-figure">
            <figcaption className="mono fig-cap">
              <span className="amber">01</span>
              <span>PRECISION HARDWARE</span>
            </figcaption>
            <img src="/assets/hero-volt.png" alt="Chrome clipper on marble" decoding="async" />
          </figure>
        </div>
        <div className="hero-foot mono">
          <span>PRECISION BARBERING</span>
          <span className={showScroll ? 'foot-right on' : 'foot-right'}>SCROLL</span>
        </div>
      </div>

      <div className={'curtain' + (curtainOff ? ' off' : '')} />
      <HairLayer />

      <div className={'pass-ui' + (showHint ? ' on' : '')}>
        <button className="pass-chip mono" onClick={() => autoComplete()} type="button">
          <i className="chip-line" />
          {hint}
        </button>
      </div>
    </section>
  )
}

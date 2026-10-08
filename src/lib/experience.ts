import gsap from 'gsap'
import { setPhase, state } from './store'
import { buildPath, type PathInfo } from './path'

export let path: PathInfo = buildPath(state.vw, state.vh)

export function rebuildPath() {
  state.vw = window.innerWidth
  state.vh = window.innerHeight
  path = buildPath(state.vw, state.vh)
}

/** Camera direction during the macro intro: hard cuts + a slow push-in on each shot. */
export const camCtl = {
  shot: -1,
  dolly: 0,
}

export const SHOTS: {
  part: string
  offset: [number, number, number]
  tilt: number
  roll: number
}[] = [
  { part: 'Tooth 11', offset: [0.8, -0.62, 1.6], tilt: -0.26, roll: -0.5 },
  { part: 'Taper Lever', offset: [-1.3, 0.34, 1.4], tilt: -0.14, roll: -0.22 },
  { part: 'Main Chrome Body', offset: [1.25, 0.98, 1.5], tilt: -0.32, roll: -0.72 },
]

let fallbackTimer = 0
let lenisStop: (() => void) | null = null
let lenisStart: (() => void) | null = null
let started = false

export function registerLenis(stop: () => void, start: () => void) {
  lenisStop = stop
  lenisStart = start
  if (!document.documentElement.classList.contains('is-locked')) start()
}

function lockScroll() {
  document.documentElement.classList.add('is-locked')
  lenisStop?.()
}

export function unlockScroll() {
  document.documentElement.classList.remove('is-locked')
  lenisStart?.()
}

export function isPassPhase() {
  return state.phase === 'await' || state.phase === 'pass2'
}

/** Fallback per brief: scrolling (or waiting) finishes the pass for the user. */
export function autoComplete() {
  if (state.phase === 'done' || state.phase === 'auto') return
  if (state.phase !== 'await' && state.phase !== 'pass2') return
  window.clearTimeout(fallbackTimer)
  gsap.killTweensOf(state)
  setPhase('auto')
  gsap.to(state, {
    T: 1,
    duration: 1.35,
    ease: 'power2.inOut',
    onUpdate: () => {
      state.guide = Math.max(0, state.guide - 0.08)
    },
    onComplete: () => {
      state.guide = 0
      setPhase('done')
      unlockScroll()
    },
  })
}

/** The visitor cleared the path themselves — wrap the last stretch quickly. */
export function finishPass() {
  if (state.phase === 'done' || state.phase === 'auto') return
  window.clearTimeout(fallbackTimer)
  gsap.killTweensOf(state)
  setPhase('auto')
  gsap.to(state, {
    T: 1,
    duration: 0.5,
    ease: 'power2.out',
    onUpdate: () => {
      state.guide = Math.max(0, state.guide - 0.12)
    },
    onComplete: () => {
      state.guide = 0
      setPhase('done')
      unlockScroll()
    },
  })
}

function armFallback() {
  window.clearTimeout(fallbackTimer)
  fallbackTimer = window.setTimeout(() => autoComplete(), 7000)
}

function beginPass1() {
  setPhase('pass1')
  gsap.to(state, {
    T: path.t1,
    duration: 1.5,
    ease: 'power2.inOut',
    onComplete: () => {
      setPhase('await')
      gsap.to(state, { guide: 1, duration: 0.6, ease: 'power2.out' })
      armFallback()
    },
  })
}

export function startExperience() {
  if (started) return
  started = true
  state.startT = performance.now()
  lockScroll()

  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  state.reduced = reduce

  const tl = gsap.timeline({ delay: reduce ? 0.1 : 0.4 })
  tl.call(() => setPhase('black'))
  tl.call(
    () => {
      camCtl.shot = 0
      camCtl.dolly = 0
      setPhase('macro')
      gsap.to(camCtl, { dolly: 1, duration: 0.75, ease: 'power2.out' })
    },
    undefined,
    reduce ? 0.1 : 0.45,
  )
  tl.call(
    () => {
      camCtl.shot = 1
      camCtl.dolly = 0
      gsap.to(camCtl, { dolly: 1, duration: 0.75, ease: 'power2.out' })
    },
    undefined,
    reduce ? 0.3 : 1.0,
  )
  tl.call(
    () => {
      camCtl.shot = 2
      camCtl.dolly = 0
      gsap.to(camCtl, { dolly: 1, duration: 0.75, ease: 'power2.out' })
    },
    undefined,
    reduce ? 0.5 : 1.55,
  )
  tl.call(() => setPhase('hairIn'), undefined, reduce ? 0.7 : 2.1)
  tl.call(beginPass1, undefined, reduce ? 0.85 : 2.5)
}

/** QA / test hook. */
if (typeof window !== 'undefined') {
  ;(window as unknown as Record<string, unknown>).__barber = {
    state,
    get path() {
      return path
    },
    autoComplete,
    finishPass,
    startExperience,
  }
  // Scroll stays locked until the pass is cleared.
  lockScroll()
}

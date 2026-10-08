import { useEffect, useState } from 'react'

export type Phase = 'boot' | 'black' | 'macro' | 'hairIn' | 'pass1' | 'await' | 'pass2' | 'auto' | 'done'

export const state = {
  phase: 'boot' as Phase,
  T: 0, // 0..1 progress along the authored pass path (arc-length normalised)
  guide: 0, // guide-line visibility 0..1
  vw: typeof window !== 'undefined' ? window.innerWidth : 1440,
  vh: typeof window !== 'undefined' ? window.innerHeight : 900,
  reduced: false,
  startT: 0, // performance.now() when the experience began (QA timing)
}

const listeners = new Set<() => void>()

export function setPhase(p: Phase) {
  if (state.phase === p) return
  state.phase = p
  listeners.forEach((l) => l())
}

export function onPhase(cb: () => void) {
  listeners.add(cb)
  return () => {
    listeners.delete(cb)
  }
}

export function usePhase(): Phase {
  const [p, setP] = useState(state.phase)
  useEffect(() => onPhase(() => setP(state.phase)), [])
  return p
}

import { useEffect } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import Lenis from 'lenis'
import 'lenis/dist/lenis.css'
import Nav from './components/Nav'
import Stage from './components/Stage'
import Cuts from './sections/Cuts'
import Studio from './sections/Studio'
import Booking from './sections/Booking'
import ClipperScene from './three/ClipperScene'
import { registerLenis, startExperience } from './lib/experience'

gsap.registerPlugin(ScrollTrigger)

export default function App() {
  useEffect(() => {
    const lenis = new Lenis({ duration: 1.15, smoothWheel: true, touchMultiplier: 1.3 })
    lenis.on('scroll', ScrollTrigger.update)
    const raf = (time: number) => lenis.raf(time * 1000)
    gsap.ticker.add(raf)
    gsap.ticker.lagSmoothing(0)
    registerLenis(
      () => lenis.stop(),
      () => lenis.start(),
    )
    ;(window as unknown as Record<string, unknown>).__lenis = lenis

    // smooth anchor links
    const onClick = (e: MouseEvent) => {
      const a = (e.target as HTMLElement | null)?.closest?.('a[href^="#"]') as HTMLAnchorElement | null
      if (!a) return
      const id = a.getAttribute('href')
      if (!id || id === '#') return
      const el = document.querySelector(id)
      if (!el) return
      e.preventDefault()
      lenis.scrollTo(el as HTMLElement, { duration: 1.5 })
    }
    document.addEventListener('click', onClick)

    // safety: the experience always starts even if the model stalls
    const t = window.setTimeout(() => startExperience(), 5200)

    return () => {
      window.clearTimeout(t)
      document.removeEventListener('click', onClick)
      gsap.ticker.remove(raf)
      lenis.destroy()
    }
  }, [])

  return (
    <>
      <Nav />
      <Stage />
      <Cuts />
      <Studio />
      <Booking />
      <ClipperScene />
      <div className="grain" aria-hidden />
    </>
  )
}

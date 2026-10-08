import { useEffect, useRef } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

gsap.registerPlugin(ScrollTrigger)

export default function Booking() {
  const root = useRef<HTMLElement>(null)

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.fromTo(
        '.book-edge',
        { scaleX: 0 },
        {
          scaleX: 1,
          duration: 1.4,
          ease: 'power3.inOut',
          transformOrigin: 'left center',
          scrollTrigger: { trigger: '.book-edge', start: 'top 78%' },
        },
      )
      gsap.fromTo(
        '.book-cta',
        { clipPath: 'inset(0 100% 0 0)' },
        {
          clipPath: 'inset(0 0% 0 0)',
          duration: 1.25,
          ease: 'power3.inOut',
          scrollTrigger: { trigger: '.book-inner', start: 'top 70%' },
        },
      )
    }, root)
    return () => ctx.revert()
  }, [])

  return (
    <section className="booking" id="book" ref={root}>
      <div className="book-edge" />
      <div className="book-inner">
        <div className="eyebrow mono">
          <span>04</span>
          <i />
          <span>BOOKING</span>
        </div>
        <a className="book-cta chrome-text" href="mailto:book@thebarber.example">
          BOOK
        </a>
        <div className="mono book-note">BY APPOINTMENT — REPLY WITH A DAY &amp; A LENGTH</div>
      </div>

      <footer className="foot">
        <span className="mono">THE BARBER</span>
        <span className="mono foot-mid">PRECISION BARBERING</span>
        <span className="mono">© 2026</span>
      </footer>
    </section>
  )
}

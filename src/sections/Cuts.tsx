import { useEffect, useRef } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

gsap.registerPlugin(ScrollTrigger)

const ITEMS = [
  {
    i: '01',
    name: 'SKIN FADE',
    note: 'ZERO GUARD, BLENDED OUT',
    img: '/assets/work-andis.avif',
    pos: '50% 46%',
  },
  {
    i: '02',
    name: 'TAPER',
    note: 'GRADIENT HELD AT THE EDGE',
    img: '/assets/work-suprent.avif',
    pos: '50% 50%',
  },
  {
    i: '03',
    name: 'BEARD LINE-UP',
    note: 'CRISP PERIMETER, HOT TOWEL',
    img: '/assets/work-salon.webp',
    pos: '50% 48%',
  },
  {
    i: '04',
    name: 'SCISSOR WORK',
    note: 'TEXTURE OVER LENGTH',
    img: '/assets/hero-volt.png',
    pos: '54% 42%',
  },
]

export default function Cuts() {
  const root = useRef<HTMLElement>(null)

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.utils.toArray<HTMLElement>('.wipe').forEach((el) => {
        gsap.fromTo(
          el,
          { clipPath: 'inset(0 100% 0 0)' },
          {
            clipPath: 'inset(0 0% 0 0)',
            duration: 1.15,
            ease: 'power3.inOut',
            scrollTrigger: { trigger: el, start: 'top 82%' },
          },
        )
      })
      gsap.utils.toArray<HTMLElement>('.rise').forEach((el) => {
        gsap.fromTo(
          el,
          { y: 34, opacity: 0 },
          {
            y: 0,
            opacity: 1,
            duration: 0.9,
            ease: 'power3.out',
            scrollTrigger: { trigger: el, start: 'top 88%' },
          },
        )
      })
      gsap.utils.toArray<HTMLElement>('.plate img').forEach((img) => {
        gsap.fromTo(
          img,
          { yPercent: -5 },
          {
            yPercent: 5,
            ease: 'none',
            scrollTrigger: { trigger: img, start: 'top bottom', end: 'bottom top', scrub: true },
          },
        )
      })
    }, root)
    return () => ctx.revert()
  }, [])

  return (
    <section className="sec cuts" id="work" ref={root}>
      <header className="sec-head">
        <div className="eyebrow mono rise">
          <span>02</span>
          <i />
          <span>SELECTED WORK</span>
        </div>
        <h2 className="sec-title rise">
          THE <em className="serif">cuts</em>
        </h2>
      </header>

      <div className="cut-list">
        {ITEMS.map((it, idx) => (
          <article className={'cut' + (idx % 2 ? ' alt' : '')} key={it.i}>
            <div className="cut-text">
              <span className="cut-num mono">{it.i}</span>
              <h3 className="cut-name wipe">{it.name}</h3>
              <p className="cut-note mono rise">{it.note}</p>
            </div>
            <div className="cut-plate plate wipe">
              <img src={it.img} alt={it.name} style={{ objectPosition: it.pos }} loading="lazy" decoding="async" />
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}

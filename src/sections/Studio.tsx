import { useEffect, useRef } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

gsap.registerPlugin(ScrollTrigger)

const SERVICES = ['SKIN FADE', 'TAPER CUT', 'BEARD LINE-UP', 'SCISSOR CUT']

export default function Studio() {
  const root = useRef<HTMLElement>(null)

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.utils.toArray<HTMLElement>('.rise').forEach((el) => {
        gsap.fromTo(
          el,
          { y: 30, opacity: 0 },
          {
            y: 0,
            opacity: 1,
            duration: 0.9,
            ease: 'power3.out',
            scrollTrigger: { trigger: el, start: 'top 88%' },
          },
        )
      })
      gsap.fromTo(
        '.svc-line',
        { scaleX: 0 },
        {
          scaleX: 1,
          duration: 1,
          stagger: 0.08,
          ease: 'power2.out',
          transformOrigin: 'left center',
          scrollTrigger: { trigger: '.services', start: 'top 80%' },
        },
      )
      ScrollTrigger.refresh()
    }, root)
    return () => ctx.revert()
  }, [])

  return (
    <section className="sec studio" id="studio" ref={root}>
      <header className="sec-head">
        <div className="eyebrow mono rise">
          <span>03</span>
          <i />
          <span>THE STUDIO</span>
        </div>
        <h2 className="sec-title rise">
          ONE <em className="serif">chair</em>
        </h2>
      </header>

      <div className="studio-grid">
        <div className="studio-left">
          <ul className="services">
            {SERVICES.map((s, i) => (
              <li className="svc-row" key={s}>
                <span className="mono svc-num">0{i + 1}</span>
                <span className="svc-name">{s}</span>
                <span className="svc-line" />
              </li>
            ))}
          </ul>
          <p className="studio-line serif rise">Steel, steam, and a slow hand.</p>
        </div>

        <div className="studio-right">
          <div id="plinth" className="plinth">
            <span className="plinth-ring" />
          </div>
          <div className="mono plinth-cap rise">
            <span className="amber">FIG. 02</span>
            <span>THE INSTRUMENT</span>
          </div>
        </div>
      </div>
    </section>
  )
}

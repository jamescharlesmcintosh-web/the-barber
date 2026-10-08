import { usePhase } from '../lib/store'

export default function Nav() {
  const phase = usePhase()
  const on = phase === 'done'
  return (
    <header className={'nav' + (on ? ' on' : '')}>
      <a href="#top" className="mono nav-mark">
        THE BARBER
      </a>
      <nav className="mono nav-links">
        <a href="#cuts">WORK</a>
        <a href="#studio">STUDIO</a>
        <a href="#book" className="nav-book">
          BOOK
        </a>
      </nav>
    </header>
  )
}

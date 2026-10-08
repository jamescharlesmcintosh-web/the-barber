import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const OUT = path.join(ROOT, 'shots')
fs.rmSync(OUT, { recursive: true, force: true })
fs.mkdirSync(OUT, { recursive: true })

const URL = 'http://127.0.0.1:5310/'
const errors = []

async function waitServer() {
  for (let i = 0; i < 90; i++) {
    try {
      const res = await fetch(URL)
      if (res.ok) return
    } catch {
      /* retry */
    }
    await new Promise((r) => setTimeout(r, 400))
  }
  throw new Error('dev server never came up')
}

const server = spawn('cmd', ['/c', 'npm', 'run', 'dev'], {
  cwd: ROOT,
  stdio: ['ignore', 'pipe', 'pipe'],
  env: { ...process.env },
})
server.stdout.on('data', (d) => process.stdout.write('[vite] ' + d))
server.stderr.on('data', (d) => process.stdout.write('[vite:err] ' + d))

let browser
try {
  await waitServer()
  browser = await chromium.launch({ channel: 'chrome', headless: true })
  await run('desktop', { width: 1440, height: 900 }, 1, 'd')
  await run(
    'mobile',
    { width: 390, height: 844 },
    2,
    'm',
    { hasTouch: true, isMobile: true },
  )
} catch (e) {
  errors.push('FATAL ' + (e && e.message))
} finally {
  if (browser) await browser.close()
  server.kill()
}

if (errors.length) {
  console.log('\n=== PAGE ERRORS ===')
  for (const e of errors) console.log(' -', e)
} else {
  console.log('\nNo page errors.')
}
console.log('shots:', fs.readdirSync(OUT).join(', '))

async function run(label, viewport, dpr, prefix, extra = {}) {
  const ctx = await browser.newContext({
    viewport,
    deviceScaleFactor: dpr,
    ...extra,
  })
  const page = await ctx.newPage()
  page.on('pageerror', (e) => errors.push(`[${label}] pageerror: ${e.message}`))
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(`[${label}] console: ${m.text()}`)
  })
  page.on('requestfailed', (r) => {
    if (r.url().includes('/assets/')) errors.push(`[${label}] requestfailed: ${r.url()}`)
  })

  const shot = async (name) => {
    await page.screenshot({ path: path.join(OUT, `${prefix}-${name}.png`) })
    console.log(`shot ${prefix}-${name}`)
  }

  await page.goto(URL, { waitUntil: 'domcontentloaded' })

  // preflight: we must be talking to THIS project's server, with its assets
  const glb = await page
    .evaluate(() => fetch('/assets/clipper.glb', { method: 'HEAD' }).then((r) => r.status).catch(() => 0))
  if (glb !== 200) throw new Error(`asset preflight failed: /assets/clipper.glb -> ${glb}`)

  await page.waitForFunction(() => !!(window.__barber && window.__barber.state), null, { timeout: 20000 })
  const t0 = await page
    .waitForFunction(() => (window.__barber && window.__barber.state.startT) || null, null, { timeout: 20000 })
    .then((h) => h.jsonValue())
  if (!t0) throw new Error('experience never started (startT not set)')

  const at = async (ms, name) => {
    await page.waitForFunction((arg) => performance.now() - arg.t0 >= arg.ms, { t0, ms }, { timeout: 20000 })
    await shot(name)
  }

  await at(560, '01-macro-teeth')
  await at(1110, '02-macro-lever')
  await at(1660, '03-macro-body')
  await at(2380, '04-hair-surface')
  await at(3350, '05-pass01-cut')
  await page.waitForFunction(() => window.__barber.state.phase === 'await', null, { timeout: 30000 })
  await page.waitForTimeout(650)
  await shot('06-await-hint')

  // trace the authored path with a drag
  const pts = await page.evaluate(() => {
    const s = window.__barber.path.samples
    const out = []
    for (let i = 0; i < s.length; i += 16) out.push([s[i].x, s[i].y])
    out.push([s[s.length - 1].x, s[s.length - 1].y])
    const w = window.innerWidth - 2
    const h = window.innerHeight - 2
    return out.map(([x, y]) => [Math.max(1, Math.min(w, x)), Math.max(1, Math.min(h, y))])
  })
  await page.mouse.move(pts[0][0], pts[0][1])
  await page.mouse.down()
  let mid = false
  for (let i = 0; i < pts.length; i++) {
    await page.mouse.move(pts[i][0], pts[i][1], { steps: 4 })
    if (!mid && i > pts.length * 0.45) {
      mid = true
      await shot('07-dragging')
    }
  }
  await page.mouse.up()

  await page.waitForFunction(() => window.__barber.state.phase === 'done', null, { timeout: 30000 })
  await page.waitForTimeout(900)
  await shot('08-pass-done')

  // sections
  const gotoSel = async (sel, offset = 0) => {
    await page.evaluate(
      ({ sel, offset }) => {
        const el = document.querySelector(sel)
        const y = el.getBoundingClientRect().top + window.scrollY + offset
        window.__lenis.scrollTo(y, { immediate: true })
      },
      { sel, offset },
    )
    await page.waitForTimeout(1500)
  }

  await gotoSel('#cuts')
  await shot('09-cuts')
  await gotoSel('#cuts', 760)
  await shot('10-cuts-items')
  await gotoSel('#studio')
  await shot('11-studio')
  await gotoSel('#studio', 700)
  await shot('12-studio-lower')
  await gotoSel('#book')
  await shot('13-booking')

  await ctx.close()
}

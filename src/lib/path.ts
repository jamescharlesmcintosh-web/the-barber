export type Pt = { x: number; y: number }

export type Sample = {
  x: number
  y: number
  tx: number
  ty: number
  s: number // arc length in px from start
  t: number // 0..1 arc fraction
}

export type PathInfo = {
  samples: Sample[]
  left: Pt[]
  right: Pt[]
  total: number
  t1: number // arc fraction where scripted pass 01 ends
  hw: number // swath half-width in px
  clipLen: number // clipper length in px
  bladeW: number // blade width in px
  lanes: number[] // lane centre y in px
  waypoints: Pt[] // raw authored waypoints (pre-fillet), for guides/QA
}

const SAMPLE_STEP = 3.5 // px between arc samples

function dist(a: Pt, b: Pt) {
  return Math.hypot(b.x - a.x, b.y - a.y)
}

function quadBezier(p0: Pt, c: Pt, p1: Pt, steps: number, out: Pt[]) {
  for (let i = 1; i <= steps; i++) {
    const u = i / steps
    const m = 1 - u
    out.push({
      x: m * m * p0.x + 2 * m * u * c.x + u * u * p1.x,
      y: m * m * p0.y + 2 * m * u * c.y + u * u * p1.y,
    })
  }
}

// Rounded corners on the authored polyline so the clipper glides through turns.
function fillet(pts: Pt[], r: number): Pt[] {
  const out: Pt[] = [pts[0]]
  for (let i = 1; i < pts.length - 1; i++) {
    const a = pts[i - 1]
    const b = pts[i]
    const c = pts[i + 1]
    const d1 = dist(a, b)
    const d2 = dist(b, c)
    if (d1 < 0.001 || d2 < 0.001) continue
    const d = Math.min(r, d1 * 0.49, d2 * 0.49)
    const p1: Pt = { x: b.x + ((a.x - b.x) / d1) * d, y: b.y + ((a.y - b.y) / d1) * d }
    const p2: Pt = { x: b.x + ((c.x - b.x) / d2) * d, y: b.y + ((c.y - b.y) / d2) * d }
    out.push(p1)
    quadBezier(p1, b, p2, 9, out)
    out.push(p2)
  }
  out.push(pts[pts.length - 1])
  return out
}

function densify(poly: Pt[], step: number): Pt[] {
  const out: Pt[] = [poly[0]]
  for (let i = 1; i < poly.length; i++) {
    const a = poly[i - 1]
    const b = poly[i]
    const d = dist(a, b)
    const n = Math.max(1, Math.round(d / step))
    for (let k = 1; k <= n; k++) {
      const u = k / n
      out.push({ x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u })
    }
  }
  return out
}

/**
 * The Precision Pass: one continuous authored path.
 *  - PASS 01 (scripted): a single centre lane, left → right, cutting the identity band.
 *  - PASS 02 (user drag): a serpentine over every remaining lane, all turns off-screen.
 * Lane spacing equals the cleared swath, so the lanes tile the viewport exactly.
 */
export function buildPath(vw: number, vh: number): PathInfo {
  const nLanes = vw / vh > 0.75 ? 5 : 4
  const spacing = vh / nLanes
  const lanes: number[] = []
  for (let i = 0; i < nLanes; i++) lanes.push((i + 0.5) * spacing)

  // Clipper length follows the swath, but never wider than the screen allows.
  const clipLen = Math.min(spacing / 0.354, vw * 0.86)
  const bladeW = clipLen * 0.354
  const hw = spacing / 2

  const xL = -0.16 * vw
  const xR = 1.16 * vw
  const centre = vh * 0.5

  const waypoints: Pt[] = [{ x: xL, y: centre }, { x: xR, y: centre }]

  // Lane order for pass 02: descend below the centre first, then climb back to the top.
  let order: number[]
  if (nLanes % 2 === 1) {
    const c = Math.floor(nLanes / 2)
    order = []
    for (let i = c + 1; i < nLanes; i++) order.push(i)
    for (let i = c - 2; i >= 0; i--) order.push(i)
  } else {
    const h2 = nLanes / 2
    order = []
    for (let i = h2; i < nLanes; i++) order.push(i)
    for (let i = h2 - 1; i >= 0; i--) order.push(i)
  }

  let cx = xR
  let cy = centre
  order.forEach((li, j) => {
    const ly = lanes[li]
    waypoints.push({ x: cx, y: ly }) // off-screen vertical connector
    cx = j % 2 === 0 ? xL : xR
    waypoints.push({ x: cx, y: ly }) // the sweep
    cy = ly
  })
  waypoints.push({ x: vw * 1.65, y: Math.max(-vh * 0.05, cy - vh * 0.14) }) // exit

  const poly = fillet(waypoints, spacing * 0.42)
  const pts = densify(poly, SAMPLE_STEP)

  // cumulative length
  const samples: Sample[] = []
  let acc = 0
  samples.push({ x: pts[0].x, y: pts[0].y, tx: 1, ty: 0, s: 0, t: 0 })
  for (let i = 1; i < pts.length; i++) acc += dist(pts[i - 1], pts[i])
  const total = acc
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1]
    const b = pts[i]
    const s = samples[i - 1].s + dist(a, b)
    samples.push({ x: b.x, y: b.y, tx: 0, ty: 0, s, t: s / total })
  }
  // smooth tangents by central difference
  for (let i = 0; i < samples.length; i++) {
    const a = samples[Math.max(0, i - 2)]
    const b = samples[Math.min(samples.length - 1, i + 2)]
    let dx = b.x - a.x
    let dy = b.y - a.y
    const l = Math.hypot(dx, dy) || 1
    dx /= l
    dy /= l
    samples[i].tx = dx
    samples[i].ty = dy
  }

  // arc fraction where pass 01 (the centre lane) ends
  const l1Idx = samples.findIndex((s) => s.x >= xR - 1 && Math.abs(s.y - centre) < spacing * 0.6)
  const t1 = l1Idx > 0 ? samples[l1Idx].t : 0.3

  const left: Pt[] = []
  const right: Pt[] = []
  for (const s of samples) {
    const nx = -s.ty
    const ny = s.tx
    left.push({ x: s.x + nx * hw, y: s.y + ny * hw })
    right.push({ x: s.x - nx * hw, y: s.y - ny * hw })
  }

  return { samples, left, right, total, t1, hw, clipLen, bladeW, lanes, waypoints }
}

// World plane: 10 world units tall, camera canonical top-down.
export const WORLD_H = 10

export function worldWidth(vw: number, vh: number) {
  return WORLD_H * (vw / vh)
}

export function pxToWorld(px: number, py: number, vw: number, vh: number) {
  return {
    x: (px / vw - 0.5) * worldWidth(vw, vh),
    y: (0.5 - py / vh) * WORLD_H,
  }
}

export function sampleAt(samples: Sample[], t: number): Sample {
  const f = Math.min(1, Math.max(0, t)) * (samples.length - 1)
  const i = Math.floor(f)
  const a = samples[i]
  const b = samples[Math.min(samples.length - 1, i + 1)]
  const u = f - i
  return {
    x: a.x + (b.x - a.x) * u,
    y: a.y + (b.y - a.y) * u,
    tx: a.tx,
    ty: a.ty,
    s: a.s,
    t: a.t,
  }
}

export const GAIN = 2.2 // pointer travel → path travel multiplier

/** Constrained drag: only movement projected onto the path tangent advances the pass. */
export function advance(path: PathInfo, t: number, dx: number, dy: number): number {
  const s = sampleAt(path.samples, t)
  const proj = dx * s.tx + dy * s.ty
  let dt = (proj * GAIN) / path.total
  dt = Math.max(-0.004, Math.min(0.05, dt))
  return Math.max(0, Math.min(1, t + dt))
}

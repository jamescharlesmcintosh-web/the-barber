import { Suspense, useEffect, useMemo, useRef } from 'react'
import { Canvas, useFrame, useLoader, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { state } from '../lib/store'
import { pxToWorld, sampleAt, WORLD_H } from '../lib/path'
import { SHOTS, camCtl, path, startExperience } from '../lib/experience'

const MODEL_LEN = 130 // model units along Z (blade tip at +Z)
const TIP_Z = 72
const CAM_FOV = 21.8
const CAM_D = 5 / Math.tan((CAM_FOV / 2) * (Math.PI / 180))
const LIFT = 2.2

/* ---------- environment: procedural studio equirect → PMREM ---------- */
function buildEnvCanvas() {
  const c = document.createElement('canvas')
  c.width = 1024
  c.height = 512
  const x = c.getContext('2d')!

  const g = x.createLinearGradient(0, 0, 0, 512)
  g.addColorStop(0, '#0e1013')
  g.addColorStop(0.4, '#16181c')
  g.addColorStop(0.5, '#2a2d33')
  g.addColorStop(0.54, '#0b0c0e')
  g.addColorStop(1, '#040405')
  x.fillStyle = g
  x.fillRect(0, 0, 1024, 512)

  const soft = (cx: number, cy: number, rx: number, ry: number, color: string, peak: number) => {
    x.save()
    x.translate(cx * 1024, cy * 512)
    x.scale(rx, ry)
    const rg = x.createRadialGradient(0, 0, 0, 0, 0, 1)
    rg.addColorStop(0, color.replace('ALPHA', String(peak)))
    rg.addColorStop(0.5, color.replace('ALPHA', String(peak * 0.62)))
    rg.addColorStop(1, color.replace('ALPHA', '0'))
    x.fillStyle = rg
    x.fillRect(-1, -1, 2, 2)
    x.restore()
  }

  const strip = (cx: number, w: number, top: number, bot: number, color: string) => {
    const lg = x.createLinearGradient(cx * 1024 - w / 2, 0, cx * 1024 + w / 2, 0)
    lg.addColorStop(0, color.replace('ALPHA', '0'))
    lg.addColorStop(0.5, color.replace('ALPHA', '1'))
    lg.addColorStop(1, color.replace('ALPHA', '0'))
    x.fillStyle = lg
    x.fillRect(cx * 1024 - w / 2, top * 512, w, (bot - top) * 512)
  }

  // key + fills
  soft(0.24, 0.29, 210, 145, 'rgba(255,255,255,ALPHA)', 1)
  soft(0.63, 0.24, 165, 100, 'rgba(206,222,242,ALPHA)', 0.92)
  soft(0.87, 0.6, 220, 150, 'rgba(255,196,142,ALPHA)', 0.5)
  soft(0.5, 0.93, 420, 120, 'rgba(132,120,102,ALPHA)', 0.3)
  // vertical strip lights — long specular runs down the chrome body
  strip(0.05, 30, 0.06, 0.52, 'rgba(235,242,250,ALPHA)')
  strip(0.43, 20, 0.1, 0.48, 'rgba(210,222,236,ALPHA)')
  strip(0.74, 16, 0.14, 0.5, 'rgba(255,236,214,ALPHA)')
  return c
}

function EnvSetup() {
  const { gl, scene } = useThree()
  useEffect(() => {
    const tex = new THREE.CanvasTexture(buildEnvCanvas())
    tex.mapping = THREE.EquirectangularReflectionMapping
    tex.colorSpace = THREE.SRGBColorSpace
    const pmrem = new THREE.PMREMGenerator(gl)
    const rt = pmrem.fromEquirectangular(tex)
    scene.environment = rt.texture
    ;(scene as THREE.Scene & { environmentIntensity?: number }).environmentIntensity = 1.0
    tex.dispose()
    pmrem.dispose()
    return () => {
      rt.dispose()
      scene.environment = null
    }
  }, [gl, scene])
  return null
}

function Rig() {
  const gltf = useLoader(GLTFLoader, '/assets/clipper.glb')
  const posRef = useRef<THREE.Group>(null)
  const rollRef = useRef<THREE.Group>(null)
  const innerRef = useRef<THREE.Group>(null)
  const shadowRef = useRef<THREE.Mesh>(null)

  const parts = useMemo(() => {
    const out: Record<string, THREE.Vector3> = {}
    for (const n of ['Tooth 11', 'Taper Lever', 'Main Chrome Body', 'Power Button']) {
      const o = gltf.scene.getObjectByName(n)
      if (o && (o as THREE.Mesh).isMesh) {
        const geo = (o as THREE.Mesh).geometry
        if (!geo.boundingBox) geo.computeBoundingBox()
        out[n] = geo.boundingBox!.getCenter(new THREE.Vector3())
      }
    }
    return out
  }, [gltf])

  const blade = useMemo(() => gltf.scene.getObjectByName('Moving Blade') ?? null, [gltf])

  useEffect(() => {
    gltf.scene.traverse((o) => {
      if (!(o as THREE.Mesh).isMesh) return
      const m = (o as THREE.Mesh).material as THREE.MeshStandardMaterial
      if (!m) return
      m.envMapIntensity = 1.18
      if (m.name === 'Polished Chrome') m.roughness = 0.09
      if (m.name === 'Blade Steel') m.roughness = 0.13
      m.needsUpdate = true
    })
  }, [gltf])

  useEffect(() => {
    const go = () => startExperience()
    const t = window.setTimeout(go, 2600)
    if (document.fonts?.ready) {
      document.fonts.ready.then(() => {
        window.setTimeout(go, 250)
      })
    }
    return () => window.clearTimeout(t)
  }, [])

  const tmpV = useMemo(() => new THREE.Vector3(), [])
  const tmpE = useMemo(() => new THREE.Euler(), [])

  useFrame((st, dt) => {
    const phase = state.phase
    const vw = state.vw
    const vh = state.vh
    const time = st.clock.elapsedTime
    const pos = posRef.current
    const roll = rollRef.current
    const inner = innerRef.current
    const shadow = shadowRef.current
    if (!pos || !roll || !inner) return

    const worldLen = (path.clipLen / vh) * WORLD_H
    const s = worldLen / MODEL_LEN
    inner.scale.setScalar(s)

    const cam = st.camera
    const moving = phase === 'pass1' || phase === 'pass2' || phase === 'auto'

    if (phase === 'black' || phase === 'macro') {
      const shot = SHOTS[Math.max(0, Math.min(SHOTS.length - 1, camCtl.shot))]
      pos.position.set(0, 0, 0.6)
      roll.rotation.set(shot.tilt, 0, shot.roll)

      // aim at the named part, in world space, with the push-in
      const c = parts[shot.part] ?? new THREE.Vector3()
      tmpV.set(c.x, -c.z, c.y).multiplyScalar(s)
      tmpE.set(shot.tilt, 0, shot.roll, 'XYZ')
      tmpV.applyEuler(tmpE)
      tmpV.x += pos.position.x
      tmpV.y += pos.position.y
      tmpV.z += pos.position.z
      const k = 1 - 0.24 * camCtl.dolly
      cam.position.set(
        tmpV.x + shot.offset[0] * k,
        tmpV.y + shot.offset[1] * k,
        tmpV.z + shot.offset[2] * k,
      )
      cam.lookAt(tmpV)
      if (shadow) shadow.visible = true
    } else if (
      phase === 'hairIn' ||
      phase === 'pass1' ||
      phase === 'pass2' ||
      phase === 'auto' ||
      phase === 'await'
    ) {
      cam.position.set(0, 0, CAM_D)
      cam.lookAt(0, 0, 0)
      const sm = sampleAt(path.samples, state.T)
      const w = pxToWorld(sm.x, sm.y, vw, vh)
      const twx = sm.tx
      const twy = -sm.ty
      const hwW = (path.hw / vh) * WORLD_H
      const tipW = TIP_Z * s
      const lead = hwW - tipW
      const vib = moving ? 0.02 : 0.006
      pos.position.set(
        w.x + twx * lead + Math.sin(time * 61.7) * vib,
        w.y + twy * lead + Math.cos(time * 47.3) * vib,
        0.6,
      )
      const theta = Math.atan2(twy, twx)
      roll.rotation.set(0, 0, theta + Math.PI / 2)
      if (shadow) {
        shadow.visible = true
        shadow.position.z = -0.55
      }
    } else {
      // done: park over the studio plinth when it is on screen, else exit stage right
      cam.position.set(0, 0, CAM_D)
      cam.lookAt(0, 0, 0)
      const plinth = document.getElementById('plinth')
      let tx = vw * 1.75
      let ty = vh * 0.42
      let tz = 0.6
      let onStage = false
      if (plinth) {
        const r = plinth.getBoundingClientRect()
        if (r.bottom > 20 && r.top < vh - 20) {
          const c = pxToWorld(r.left + r.width / 2, r.top + r.height / 2, vw, vh)
          tx = c.x
          ty = c.y
          tz = LIFT
          onStage = true
        }
      }
      const ease = 1 - Math.pow(0.0015, Math.min(dt, 0.05))
      pos.position.x += (tx - pos.position.x) * ease
      pos.position.y += (ty - pos.position.y) * ease
      pos.position.z += (tz - pos.position.z) * ease
      if (onStage) {
        roll.rotation.z += dt * 0.42
        roll.rotation.x += (0 - roll.rotation.x) * ease
      } else {
        const sm = path.samples[path.samples.length - 1]
        const w = pxToWorld(sm.x, sm.y, vw, vh)
        const theta = Math.atan2(-sm.ty, sm.tx)
        let d = theta + Math.PI / 2 - roll.rotation.z
        while (d > Math.PI) d -= Math.PI * 2
        while (d < -Math.PI) d += Math.PI * 2
        roll.rotation.z += d * ease
      }
      inner.scale.setScalar(s * (onStage ? 0.92 : 1))
      if (shadow) shadow.position.z = onStage ? -LIFT - 0.12 : -0.55
    }

    if (blade) {
      const spin = phase === 'macro' || moving
      blade.position.x = spin ? Math.sin(time * Math.PI * 2 * 19) * 0.55 : 0
    }
  })

  return (
    <group ref={posRef}>
      <group ref={rollRef}>
        <group ref={innerRef} rotation={[Math.PI / 2, 0, 0]}>
          <primitive object={gltf.scene} />
        </group>
        <mesh ref={shadowRef} position={[0, 0, -0.55]} renderOrder={-1}>
          <planeGeometry args={[7.4, 16.5]} />
          <meshBasicMaterial transparent depthWrite={false} opacity={0.62} color="#000000">
            <canvasTexture
              attach="map"
              args={[
                (() => {
                  const c = document.createElement('canvas')
                  c.width = c.height = 128
                  const x = c.getContext('2d')!
                  const rg = x.createRadialGradient(64, 64, 8, 64, 64, 64)
                  rg.addColorStop(0, 'rgba(0,0,0,1)')
                  rg.addColorStop(0.55, 'rgba(0,0,0,0.72)')
                  rg.addColorStop(1, 'rgba(0,0,0,0)')
                  x.fillStyle = rg
                  x.fillRect(0, 0, 128, 128)
                  return c
                })(),
              ]}
            />
          </meshBasicMaterial>
        </mesh>
      </group>
    </group>
  )
}

export default function ClipperScene() {
  return (
    <div className="webgl" aria-hidden>
      <Canvas
        dpr={[1, 2]}
        gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
        camera={{ fov: CAM_FOV, position: [0, 0, CAM_D], near: 0.1, far: 300 }}
        onCreated={({ gl }) => {
          gl.toneMapping = THREE.ACESFilmicToneMapping
          gl.toneMappingExposure = 1.06
        }}
      >
        <EnvSetup />
        <ambientLight intensity={0.16} />
        <directionalLight position={[6, 8, 10]} intensity={1.7} />
        <directionalLight position={[-7, -3, 6]} intensity={0.35} color="#cfe0ff" />
        <pointLight position={[-4.5, -4, 4]} intensity={9} distance={26} color="#ffcf9a" />
        <Suspense fallback={null}>
          <Rig />
        </Suspense>
      </Canvas>
    </div>
  )
}

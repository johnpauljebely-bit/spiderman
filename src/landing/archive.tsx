import { createRoot, type Root } from 'react-dom/client'
import TextRoll from '@/components/ui/text-roll'
import { to } from '@/lib/paths'
import { VCE_URL } from '@/lib/vce'
import { AVATAR, CARDS, full, thumb } from './cards'

// The landing page's behavior, in plain DOM code: a Fibonacci sphere of cards that you drag to rotate,
// a FLIP lightbox and a full-screen menu. The circle of cards and the headline share one 0x0 point
// (#world), so the words sit in the middle of the ring however you turn it. The grey liquid-glass intro
// is a React component (intro.tsx) that sits on top and calls reveal() when it starts to fade.

const N = CARDS.length
const GA = Math.PI * (3 - Math.sqrt(5))

const HEADLINE = ['Make', 'your', 'logo', 'move.']

const TEMPLATE = `
<div id="stage">
  <div id="world">
    <div id="orb"></div>
    <h1 id="headline"><span class="inner">${HEADLINE.map((w, i) => `<span style="--i:${i}">${w}</span>`).join(' ')}</span></h1>
  </div>
</div>
<div class="vig"></div>
<header class="chrome">
  <div class="brand">
    <div class="wordmark"><img src="${to('/move-logo.svg')}" alt="Move" draggable="false" /></div>
    <a class="back-vce" href="${VCE_URL}"><span aria-hidden="true">&larr;</span> Back to VCE</a>
  </div>
  <button id="menuBtn" class="menu-btn" aria-expanded="false" aria-controls="menu" aria-label="Open menu">
    <span class="menu-label">Menu</span>
    <span class="bars"><i></i><i></i></span>
  </button>
</header>
<div class="bio chrome">
  <div class="who"><img id="avatar" alt="Move" /><b>Move</b></div>
  <p>Move turns any logo into a looping animation. Trace it, tune the reveal and export a GIF, all in your browser. Nothing is ever uploaded.</p>
  <a class="open" href="${to('/app')}">Open Move</a>
</div>
<div class="colophon chrome">Logo Animator 2026</div>
<div class="cue chrome"><s></s>Drag to rotate</div>
<div id="menu">
  <nav>
    <a href="${to('/docs')}">Docs</a>
    <a href="${to('/app')}">Open Move</a>
    <a href="#" data-close-menu>Back to the Sphere</a>
    <a href="${to('/legal')}">Legal</a>
    <a href="${VCE_URL}">Back to VCE</a>
  </nav>
  <div class="addr">Runs in your browser<br />Your logo never leaves your device</div>
</div>
<div id="lit" aria-hidden="true">
  <div class="scrim" data-close></div>
  <div class="plate">
    <div class="shot"><img id="litImg" alt="" /><button class="close" data-close>Close</button></div>
    <div class="meta">
      <div><h2 id="litTitle"></h2><div class="where" id="litWhere"></div></div>
      <p class="note" id="litNote"></p>
    </div>
  </div>
</div>
`

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v))
const q = <T extends HTMLElement>(root: ParentNode, sel: string) => root.querySelector(sel) as T

/** Downscales a still once on a canvas; falls back to the original file if that isn't possible. */
async function decode(url: string, maxWidth: number, blobs: string[]): Promise<string> {
  try {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.decoding = 'async'
    img.src = url
    await img.decode()
    if (img.naturalWidth <= maxWidth) return url
    const scale = maxWidth / img.naturalWidth
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(img.naturalWidth * scale)
    canvas.height = Math.round(img.naturalHeight * scale)
    canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height)
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/webp', 0.88))
    if (!blob) return url
    const blobUrl = URL.createObjectURL(blob)
    blobs.push(blobUrl)
    return blobUrl
  } catch {
    return url
  }
}

export interface Archive {
  /** Fades the page in. Called when the intro starts to leave, or straight away when there is no intro. */
  reveal: () => void
  dispose: () => void
}

export function mountArchive(root: HTMLElement): Archive {
  const body = document.body
  const html = document.documentElement
  root.innerHTML = TEMPLATE

  const stage = q(root, '#stage')
  const world = q(root, '#world')
  const orb = q(root, '#orb')
  const headline = q(root, '#headline')
  const lit = q(root, '#lit')
  const plate = q(lit, '.plate')
  const shot = q(lit, '.shot')
  const litImg = q<HTMLImageElement>(lit, '#litImg')
  const menuBtn = q(root, '#menuBtn')
  const menu = q(root, '#menu')
  const avatar = q<HTMLImageElement>(root, '#avatar')

  const timers = new Set<number>()
  const later = (fn: () => void, ms: number) => {
    const id = window.setTimeout(() => {
      timers.delete(id)
      fn()
    }, ms)
    timers.add(id)
    return id
  }
  const cleanups: (() => void)[] = []
  const on = (target: EventTarget, type: string, fn: (e: any) => void, opts?: AddEventListenerOptions) => {
    target.addEventListener(type, fn as EventListener, opts)
    cleanups.push(() => target.removeEventListener(type, fn as EventListener, opts))
  }
  const blobs: string[] = []
  let disposed = false

  // The menu links roll their letters on hover (TextRoll is a React component, so each label gets its own root).
  const rolls: Root[] = []
  menu.querySelectorAll<HTMLAnchorElement>('nav a').forEach((link) => {
    const label = link.textContent ?? ''
    link.setAttribute('aria-label', label)
    link.textContent = ''
    const rollRoot = createRoot(link)
    rollRoot.render(
      <TextRoll center lineHeight={1.2} className="text-inherit dark:text-inherit whitespace-nowrap">
        {label}
      </TextRoll>,
    )
    rolls.push(rollRoot)
  })

  // ---------------------------------------------------------------- state
  const units = Array.from({ length: N }, (_, i) => {
    const y = 1 - (i / (N - 1)) * 2
    const rad = Math.sqrt(Math.max(0, 1 - y * y))
    const theta = i * GA
    const x = Math.cos(theta) * rad
    const z = Math.sin(theta) * rad
    return { x, y, z }
  })
  const cardEls: HTMLElement[] = []
  const shown: string[] = CARDS.map((c) => thumb(c.id))
  const lastOpacity = new Array<number>(N).fill(-1)
  const lastDim = new Array<number>(N).fill(-1)

  let R = 300
  let persp = 1150
  const spin = 0
  const tilt = -4
  let dragX = 0
  let dragY = 0
  let velX = 0
  let velY = 0
  const PITCH_LIMIT = 32
  let focused = -1
  let raf = 0
  let litToken = 0
  let litSource: HTMLElement | null = null
  let lastW = innerWidth
  let lastH = innerHeight

  const decodeMax = () => (innerWidth <= 380 ? 420 : innerWidth <= 640 ? 520 : innerWidth <= 900 ? 640 : 760)

  // ---------------------------------------------------------------- build cards
  CARDS.forEach((c, i) => {
    const card = document.createElement('div')
    card.className = 'card' + (c.tall ? ' tall' : '')
    card.dataset.idx = String(i)
    card.innerHTML = '<figure><img alt="" draggable="false" /></figure>'
    orb.appendChild(card)
    cardEls.push(card)
  })

  // ---------------------------------------------------------------- layout
  function layout() {
    const w = innerWidth
    const h = innerHeight
    const hr = w <= 380 ? 0.38 : w <= 640 ? 0.42 : 0.46
    const wr = w <= 380 ? 0.48 : w <= 640 ? 0.52 : 0.58
    const floor = w <= 380 ? 108 : w <= 640 ? 120 : 155
    R = Math.max(floor, Math.min(480, h * hr, w * wr))
    const scale = w <= 380 ? 0.44 : w <= 640 ? 0.46 : 0.47
    const cw = Math.round(Math.max(72, R * scale))
    persp = w <= 380 ? 620 : w <= 640 ? 760 : w <= 900 ? 920 : 1150
    html.style.setProperty('--persp', persp + 'px')
    orb.style.setProperty('--cw', cw + 'px')
    units.forEach((u, i) => {
      const lat = (Math.asin(u.y) * 180) / Math.PI
      const lon = (Math.atan2(u.x, u.z) * 180) / Math.PI
      cardEls[i].style.transform = `translate3d(${u.x * R}px, ${-u.y * R}px, ${u.z * R}px) rotateY(${lon}deg) rotateX(${lat}deg)`
    })
  }

  // ---------------------------------------------------------------- camera loop
  function frame() {
    if (disposed) return
    const isLit = body.classList.contains('lit')
    if (!dragging && !isLit) {
      dragX += velX
      dragY += velY
      velX *= 0.94
      velY *= 0.94
      if (Math.abs(velX) < 0.002) velX = 0
      if (Math.abs(velY) < 0.002) velY = 0
    }
    dragY = clamp(dragY, -PITCH_LIMIT - tilt, PITCH_LIMIT - tilt)

    const sx = tilt + dragY
    const sy = spin + dragX
    world.style.transform = `rotateY(${sy}deg) rotateX(${sx}deg)`
    headline.style.transform = `rotateX(${-sx}deg) rotateY(${-sy}deg) translateZ(${R * 0.62}px)`

    const rx = (sx * Math.PI) / 180
    const ry = (sy * Math.PI) / 180
    const cx = Math.cos(rx)
    const sxn = Math.sin(rx)
    const cy = Math.cos(ry)
    const syn = Math.sin(ry)
    const near = persp * 0.66
    for (let i = 0; i < N; i++) {
      const u = units[i]
      const uy = -u.y
      const z1 = uy * sxn + u.z * cx
      const zf = -u.x * syn + z1 * cy
      const base = 0.14 + 0.86 * Math.pow((zf + 1) / 2, 0.85)
      let dim = 1 - base
      let fade = 1
      const absZ = zf * R
      if (absZ > near) fade = Math.max(0, 1 - (absZ - near) / 190)
      if (focused >= 0) {
        dim = Math.min(1, dim + 0.78)
        if (i === focused) fade = 0
      }
      dim = Math.round(dim * 1000) / 1000
      fade = Math.round(fade * 1000) / 1000
      if (fade !== lastOpacity[i]) {
        lastOpacity[i] = fade
        cardEls[i].style.opacity = String(fade)
      }
      if (dim !== lastDim[i]) {
        lastDim[i] = dim
        cardEls[i].style.setProperty('--d', String(dim))
      }
    }
    raf = requestAnimationFrame(frame)
  }

  // ---------------------------------------------------------------- images
  avatar.src = AVATAR
  void decode(AVATAR, 160, blobs).then((url) => {
    if (!disposed) avatar.src = url
  })

  CARDS.forEach((c, i) => {
    void decode(thumb(c.id), decodeMax(), blobs).then((url) => {
      if (disposed) return
      shown[i] = url
      const img = cardEls[i].querySelector('img')!
      img.src = url
      img.classList.add('in')
    })
  })

  // ---------------------------------------------------------------- reveal
  function reveal() {
    if (body.classList.contains('revealed') || disposed) return
    layout()
    body.classList.add('revealed')
  }

  // ---------------------------------------------------------------- opening a shot (lightbox)
  function flipTo(from: DOMRect, opening: boolean) {
    const pr = plate.getBoundingClientRect()
    const dx = from.left + from.width / 2 - (pr.left + pr.width / 2)
    const dy = from.top + from.height / 2 - (pr.top + pr.height / 2)
    const s = Math.max(0.04, from.width / pr.width)
    const away = `translate(${dx}px, ${dy}px) scale(${s})`
    if (opening) {
      plate.style.transition = 'none'
      plate.style.transform = away
      plate.style.opacity = '0'
      void plate.offsetWidth
      plate.style.transition = ''
      plate.style.transform = ''
      plate.style.opacity = ''
    } else {
      plate.style.transform = away
      plate.style.opacity = '0'
    }
  }
  function openShot(idx: number, source: HTMLElement) {
    if (body.classList.contains('lit')) return
    const c = CARDS[idx]
    const token = ++litToken
    focused = idx
    litSource = source
    litImg.src = shown[idx]
    litImg.alt = c.title
    q(lit, '#litTitle').textContent = c.title
    q(lit, '#litWhere').textContent = c.place
    q(lit, '#litNote').textContent = c.note
    shot.classList.toggle('tall', !!c.tall)
    plate.classList.toggle('tall', !!c.tall)
    lit.setAttribute('aria-hidden', 'false')
    body.classList.add('lit')
    flipTo(source.getBoundingClientRect(), true)
    const hi = new Image()
    hi.onload = () => {
      if (token === litToken && body.classList.contains('lit')) litImg.src = hi.src
    }
    hi.src = full(c.id)
  }
  function closeShot() {
    if (!body.classList.contains('lit')) return
    litToken++
    focused = -1
    body.classList.remove('lit')
    lit.setAttribute('aria-hidden', 'true')
    if (litSource) flipTo(litSource.getBoundingClientRect(), false)
    later(() => {
      plate.style.transition = 'none'
      plate.style.transform = ''
      plate.style.opacity = ''
      void plate.offsetWidth
      plate.style.transition = ''
    }, 640)
  }
  lit.addEventListener('click', (e) => {
    if ((e.target as HTMLElement).closest('[data-close]')) closeShot()
  })

  // ---------------------------------------------------------------- menu
  const setMenu = (open: boolean) => {
    body.classList.toggle('menu-open', open)
    menuBtn.setAttribute('aria-expanded', String(open))
    menuBtn.setAttribute('aria-label', open ? 'Close menu' : 'Open menu')
  }
  menuBtn.addEventListener('click', () => setMenu(!body.classList.contains('menu-open')))
  menu.addEventListener('click', (e) => {
    const link = (e.target as HTMLElement).closest('a')
    if (link?.hasAttribute('data-close-menu')) {
      e.preventDefault()
      setMenu(false)
    }
  })

  on(window, 'keydown', (e: KeyboardEvent) => {
    if (e.key !== 'Escape') return
    if (body.classList.contains('lit')) closeShot()
    else if (body.classList.contains('menu-open')) setMenu(false)
  })

  // ---------------------------------------------------------------- drag to rotate
  let dragging = false
  let pointer: { id: number; startX: number; startY: number; lastX: number; lastY: number; moved: number } | null = null
  let downCard: HTMLElement | null = null
  stage.addEventListener('pointerdown', (e) => {
    if (body.classList.contains('lit')) return
    downCard = (e.target as HTMLElement).closest('.card')
    pointer = { id: e.pointerId, startX: e.clientX, startY: e.clientY, lastX: e.clientX, lastY: e.clientY, moved: 0 }
    stage.setPointerCapture(e.pointerId)
    dragging = true
    velX = velY = 0
  })
  stage.addEventListener('pointermove', (e) => {
    if (!pointer || e.pointerId !== pointer.id) return
    const dx = e.clientX - pointer.lastX
    const dy = e.clientY - pointer.lastY
    pointer.lastX = e.clientX
    pointer.lastY = e.clientY
    pointer.moved = Math.max(pointer.moved, Math.hypot(e.clientX - pointer.startX, e.clientY - pointer.startY))
    dragX += dx * 0.13
    dragY -= dy * 0.13
    velX = dx * 0.13
    velY = -dy * 0.13
  })
  const endDrag = (e: PointerEvent) => {
    if (!pointer || e.pointerId !== pointer.id) return
    const slop = e.pointerType === 'touch' ? 14 : 6
    const clicked = pointer.moved < slop && downCard && e.type === 'pointerup'
    const card = downCard
    pointer = null
    dragging = false
    downCard = null
    if (clicked && card) openShot(Number(card.dataset.idx), card)
  }
  stage.addEventListener('pointerup', endDrag)
  stage.addEventListener('pointercancel', endDrag)

  // ---------------------------------------------------------------- resize
  on(window, 'resize', () => {
    if (Math.abs(innerWidth - lastW) < 20 && Math.abs(innerHeight - lastH) < 20) return
    lastW = innerWidth
    lastH = innerHeight
    layout()
  })
  on(window, 'orientationchange', () => {
    later(() => {
      lastW = innerWidth
      lastH = innerHeight
      layout()
    }, 220)
  })
  if (window.visualViewport) {
    on(window.visualViewport, 'resize', () => layout())
  }

  // ---------------------------------------------------------------- go
  layout()
  frame()

  return {
    reveal,
    dispose() {
      disposed = true
      cancelAnimationFrame(raf)
      timers.forEach((id) => window.clearTimeout(id))
      cleanups.forEach((fn) => fn())
      blobs.forEach((url) => URL.revokeObjectURL(url))
      body.classList.remove('revealed', 'lit', 'menu-open')
      html.style.removeProperty('--persp')
      // React won't let a root be unmounted from inside its own effect cleanup, so wait a tick.
      window.setTimeout(() => rolls.forEach((r) => r.unmount()), 0)
      root.innerHTML = ''
    },
  }
}

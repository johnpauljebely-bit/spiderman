const SVG_NS = 'http://www.w3.org/2000/svg'

let offscreenSvg: SVGSVGElement | null = null

function getOffscreenSvg(): SVGSVGElement {
  if (offscreenSvg) return offscreenSvg
  const svg = document.createElementNS(SVG_NS, 'svg')
  svg.setAttribute('width', '0')
  svg.setAttribute('height', '0')
  svg.style.position = 'absolute'
  svg.style.left = '-99999px'
  svg.style.top = '-99999px'
  svg.style.pointerEvents = 'none'
  document.body.appendChild(svg)
  offscreenSvg = svg
  return svg
}

export function withOffscreenPath<T>(d: string, fn: (path: SVGPathElement) => T): T {
  const svg = getOffscreenSvg()
  const path = document.createElementNS(SVG_NS, 'path')
  path.setAttribute('d', d)
  svg.appendChild(path)
  try {
    return fn(path)
  } finally {
    svg.removeChild(path)
  }
}

const lengthCache = new Map<string, number>()

export function getPathLength(d: string): number {
  const cached = lengthCache.get(d)
  if (cached !== undefined) return cached
  const length = withOffscreenPath(d, (path) => path.getTotalLength())
  lengthCache.set(d, length)
  return length
}

export function getPointAtLength(d: string, length: number): { x: number; y: number } {
  return withOffscreenPath(d, (path) => {
    const total = path.getTotalLength()
    const clamped = Math.max(0, Math.min(total, length))
    const pt = path.getPointAtLength(clamped)
    return { x: pt.x, y: pt.y }
  })
}

export function getPathBBox(d: string): { x: number; y: number; width: number; height: number } {
  return withOffscreenPath(d, (path) => {
    const b = path.getBBox()
    return { x: b.x, y: b.y, width: b.width, height: b.height }
  })
}

/** Finds the length-position along the path closest to (x, y), by coarse then fine sampling. */
export function nearestLengthToPoint(d: string, x: number, y: number, samples = 200): number {
  return withOffscreenPath(d, (path) => {
    const total = path.getTotalLength()
    if (total === 0) return 0

    let bestLength = 0
    let bestDist = Infinity
    for (let i = 0; i <= samples; i++) {
      const len = (i / samples) * total
      const pt = path.getPointAtLength(len)
      const dist = (pt.x - x) ** 2 + (pt.y - y) ** 2
      if (dist < bestDist) {
        bestDist = dist
        bestLength = len
      }
    }

    const coarseStep = total / samples
    const refineStart = Math.max(0, bestLength - coarseStep)
    const refineEnd = Math.min(total, bestLength + coarseStep)
    const refineSamples = 20
    for (let i = 0; i <= refineSamples; i++) {
      const len = refineStart + ((refineEnd - refineStart) * i) / refineSamples
      const pt = path.getPointAtLength(len)
      const dist = (pt.x - x) ** 2 + (pt.y - y) ** 2
      if (dist < bestDist) {
        bestDist = dist
        bestLength = len
      }
    }

    return bestLength
  })
}

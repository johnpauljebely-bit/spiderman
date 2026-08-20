import ImageTracer from 'imagetracerjs'
import type { TracedPath } from '../types'

interface TracerOptions {
  numberofcolors: number
  pathomit: number
  scale: number
  strokewidth: number
  linefilter: boolean
  roundcoords: number
  desc: boolean
  viewbox: boolean
  rightangleenhance: boolean
  blurradius: number
  blurdelta: number
  [key: string]: unknown
}

interface Palette {
  r: number
  g: number
  b: number
  a: number
}

interface TracedSubpath {
  isholepath: boolean
}

interface Tracedata {
  layers: TracedSubpath[][]
  palette: Palette[]
  width: number
  height: number
}

interface QuantizeResult {
  array: unknown[][]
  palette: Palette[]
}

interface ImageTracerLib {
  checkoptions(options: Partial<TracerOptions>): TracerOptions
  colorquantization(imgd: ImageData, options: TracerOptions): QuantizeResult
  layeringstep(ii: QuantizeResult, colornum: number): unknown
  pathscan(arr: unknown, pathomit: number): unknown[]
  internodes(paths: unknown[], options: TracerOptions): unknown[]
  batchtracepaths(internodepaths: unknown[], ltres: number, qtres: number): TracedSubpath[]
  svgpathstring(tracedata: Tracedata, lnum: number, pnum: number, options: TracerOptions): string
}

const tracer = ImageTracer as unknown as ImageTracerLib

export interface VectorizeOptions {
  numberOfColors?: number
  pathomit?: number
  /** 0..100. How much the *animated drawing stroke* gets curve-fit (real corners stay sharp, real curves become smooth beziers instead of pixel-jagged). The fill/final logo shape is never touched by this. */
  smoothing?: number
}

export interface VectorizeResult {
  paths: TracedPath[]
  width: number
  height: number
}

const TRANSPARENT_ALPHA_THRESHOLD = 16
// Tight tolerance for the fill: hugs the real detected boundary as closely as imagetracerjs's
// own curve fitter can — this is the "real logo" shape and is never altered further.
const FILL_TOLERANCE = 0.75

export function vectorizeImageData(imgd: ImageData, opts: VectorizeOptions = {}): VectorizeResult {
  const smoothing = Math.max(0, Math.min(100, opts.smoothing ?? 60))
  // Curve-fit tolerance for the stroke: imagetracerjs tries a straight line first and only
  // falls back to a quadratic bezier (or splits further) when a line doesn't fit — so sharp
  // corners naturally stay sharp (a short line always fits) while genuine curves get an actual
  // curve instead of a jagged chain of tiny straight segments.
  const strokeTolerance = FILL_TOLERANCE + (smoothing / 100) * 11

  const options = tracer.checkoptions({
    numberofcolors: opts.numberOfColors ?? 12,
    pathomit: opts.pathomit ?? 8,
    blurradius: 0,
    scale: 1,
    strokewidth: 0,
    linefilter: true,
    roundcoords: 1,
    desc: false,
    viewbox: true,
    rightangleenhance: true,
  })

  const quantized = tracer.colorquantization(imgd, options)
  const width = quantized.array[0].length - 2
  const height = quantized.array.length - 2

  const paths: TracedPath[] = []
  let idCounter = 0

  for (let colornum = 0; colornum < quantized.palette.length; colornum++) {
    const paletteColor = quantized.palette[colornum]
    if (!paletteColor || paletteColor.a < TRANSPARENT_ALPHA_THRESHOLD) continue
    const color = `rgba(${paletteColor.r}, ${paletteColor.g}, ${paletteColor.b}, ${(paletteColor.a / 255).toFixed(3)})`

    // Detect the boundary once, so the fill and stroke fits share identical shape/hole topology
    // and only differ in how tightly the curves are fit to it.
    const scanned = tracer.pathscan(tracer.layeringstep(quantized, colornum), options.pathomit)
    const internodePaths = tracer.internodes(scanned, options)

    const fillLayer = tracer.batchtracepaths(internodePaths, FILL_TOLERANCE, FILL_TOLERANCE)
    const strokeLayer = smoothing > 0 ? tracer.batchtracepaths(internodePaths, strokeTolerance, strokeTolerance) : fillLayer

    const fillTracedata: Tracedata = { layers: [fillLayer], palette: [paletteColor], width, height }
    const strokeTracedata: Tracedata = { layers: [strokeLayer], palette: [paletteColor], width, height }

    for (let pnum = 0; pnum < fillLayer.length; pnum++) {
      // Hole boundaries are already stitched into their parent's cutout by
      // svgpathstring below; drawing them again here would both double the
      // element count and paint solid color back over the hole.
      if (fillLayer[pnum]?.isholepath) continue

      const rawFill = tracer.svgpathstring(fillTracedata, 0, pnum, options)
      const d = rawFill.match(/d="([^"]*)"/)?.[1]?.trim()
      if (!d) continue

      const rawStroke = tracer.svgpathstring(strokeTracedata, 0, pnum, options)
      const strokeD = rawStroke.match(/d="([^"]*)"/)?.[1]?.trim() || d

      // Every separate shape stays its own element so it can be picked,
      // grouped, and resequenced individually.
      paths.push({
        id: `path-${idCounter++}`,
        d,
        strokeD,
        color,
        startLength: 0,
        endLength: null,
        hasFill: true,
      })
    }
  }

  return { paths, width, height }
}

const num = (el: Element, attr: string, fallback = 0): number => {
  const v = parseFloat(el.getAttribute(attr) ?? '')
  return Number.isFinite(v) ? v : fallback
}

/**
 * Converts a non-<path> shape primitive to an equivalent `d` string. Real-world SVG logos exported
 * from design tools routinely mix <path> with <circle>/<rect>/<ellipse>/<polygon>/<polyline>/<line> —
 * without this, those elements were silently invisible (parseSvgText only ever looked at <path>).
 * Returns null for a degenerate shape (zero radius/size) with nothing to draw.
 */
function shapeElementToD(el: Element): string | null {
  switch (el.tagName.toLowerCase()) {
    case 'circle': {
      const cx = num(el, 'cx')
      const cy = num(el, 'cy')
      const r = num(el, 'r')
      if (r <= 0) return null
      return `M ${cx - r} ${cy} A ${r} ${r} 0 1 0 ${cx + r} ${cy} A ${r} ${r} 0 1 0 ${cx - r} ${cy} Z`
    }
    case 'ellipse': {
      const cx = num(el, 'cx')
      const cy = num(el, 'cy')
      const rx = num(el, 'rx')
      const ry = num(el, 'ry')
      if (rx <= 0 || ry <= 0) return null
      return `M ${cx - rx} ${cy} A ${rx} ${ry} 0 1 0 ${cx + rx} ${cy} A ${rx} ${ry} 0 1 0 ${cx - rx} ${cy} Z`
    }
    case 'rect': {
      const x = num(el, 'x')
      const y = num(el, 'y')
      const w = num(el, 'width')
      const h = num(el, 'height')
      if (w <= 0 || h <= 0) return null
      let rx = num(el, 'rx', NaN)
      let ry = num(el, 'ry', NaN)
      if (Number.isNaN(rx) && Number.isNaN(ry)) return `M ${x} ${y} H ${x + w} V ${y + h} H ${x} Z`
      if (Number.isNaN(rx)) rx = ry
      if (Number.isNaN(ry)) ry = rx
      rx = Math.min(rx, w / 2)
      ry = Math.min(ry, h / 2)
      return (
        `M ${x + rx} ${y} H ${x + w - rx} A ${rx} ${ry} 0 0 1 ${x + w} ${y + ry} V ${y + h - ry} ` +
        `A ${rx} ${ry} 0 0 1 ${x + w - rx} ${y + h} H ${x + rx} A ${rx} ${ry} 0 0 1 ${x} ${y + h - ry} ` +
        `V ${y + ry} A ${rx} ${ry} 0 0 1 ${x + rx} ${y} Z`
      )
    }
    case 'line': {
      const x1 = num(el, 'x1')
      const y1 = num(el, 'y1')
      const x2 = num(el, 'x2')
      const y2 = num(el, 'y2')
      return `M ${x1} ${y1} L ${x2} ${y2}`
    }
    case 'polygon':
    case 'polyline': {
      const points = (el.getAttribute('points') ?? '').trim()
      if (!points) return null
      const coords = points.split(/[\s,]+/).map(Number)
      if (coords.length < 4) return null
      let d = `M ${coords[0]} ${coords[1]}`
      for (let i = 2; i + 1 < coords.length; i += 2) d += ` L ${coords[i]} ${coords[i + 1]}`
      if (el.tagName.toLowerCase() === 'polygon') d += ' Z'
      return d
    }
    default:
      return null
  }
}

/** Parses an SVG's shape elements directly, skipping raster tracing entirely. Handles <path> as-is,
 * plus <circle>/<ellipse>/<rect>/<line>/<polygon>/<polyline> converted to equivalent path data. */
export function parseSvgText(svgText: string): VectorizeResult {
  const doc = new DOMParser().parseFromString(svgText, 'image/svg+xml')
  const svgEl = doc.documentElement

  let width = parseFloat(svgEl.getAttribute('width') || '')
  let height = parseFloat(svgEl.getAttribute('height') || '')
  const viewBox = svgEl.getAttribute('viewBox')
  if (viewBox) {
    const parts = viewBox.trim().split(/[\s,]+/).map(Number)
    if (parts.length === 4) {
      width = parts[2]
      height = parts[3]
    }
  }
  if (!width || !height) {
    width = 512
    height = 512
  }

  const shapeEls = Array.from(doc.querySelectorAll('path, circle, ellipse, rect, line, polygon, polyline'))
  const paths: TracedPath[] = shapeEls
    .map((el, i): TracedPath | null => {
      const tag = el.tagName.toLowerCase()
      const d = (tag === 'path' ? el.getAttribute('d')?.trim() : shapeElementToD(el)) ?? null
      if (!d) return null

      const style = el.getAttribute('style') ?? ''
      const styleFill = style.match(/fill:\s*([^;]+)/)?.[1]?.trim()
      const styleStroke = style.match(/stroke:\s*([^;]+)/)?.[1]?.trim()
      const fillAttr = el.getAttribute('fill') ?? styleFill
      const strokeAttr = el.getAttribute('stroke') ?? styleStroke

      // <line> is zero-area by definition — SVG never fills it even if a fill color is set, so it's
      // always stroke-only line art, using its stroke color (or black, matching default SVG stroke-less
      // rendering being invisible — but since the whole point of importing it is to see it, default to
      // showing it in black rather than silently dropping a plain <line fill="..."> with no stroke set).
      if (tag === 'line') {
        return { id: `svg-${i}`, d, strokeD: d, color: strokeAttr && strokeAttr !== 'none' ? strokeAttr : '#000000', startLength: 0, endLength: null, hasFill: false }
      }

      // A real filled shape (the common case) always wins. Only when fill is explicitly absent/none
      // and a stroke color is actually set do we treat this as stroke-only line art — the animated
      // line still draws, but nothing ever fills in behind it (see TracedPath.hasFill).
      if (fillAttr && fillAttr !== 'none') {
        return { id: `svg-${i}`, d, strokeD: d, color: fillAttr, startLength: 0, endLength: null, hasFill: true }
      }
      if (strokeAttr && strokeAttr !== 'none') {
        return { id: `svg-${i}`, d, strokeD: d, color: strokeAttr, startLength: 0, endLength: null, hasFill: false }
      }
      if (fillAttr === 'none') return null
      return { id: `svg-${i}`, d, strokeD: d, color: '#000000', startLength: 0, endLength: null, hasFill: true }
    })
    .filter((p): p is TracedPath => p !== null)

  return { paths, width, height }
}

export function loadImageFromFile(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Failed to load image'))
    img.src = url
  })
}

/** Rasterizes an image element to ImageData, downscaling large images to keep tracing fast. */
export function imageToImageData(img: HTMLImageElement, maxDimension = 640): { imageData: ImageData; width: number; height: number } {
  const naturalWidth = img.naturalWidth || img.width
  const naturalHeight = img.naturalHeight || img.height
  const scale = Math.min(1, maxDimension / Math.max(naturalWidth, naturalHeight))
  const width = Math.max(1, Math.round(naturalWidth * scale))
  const height = Math.max(1, Math.round(naturalHeight * scale))

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')!
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(img, 0, 0, width, height)
  const imageData = ctx.getImageData(0, 0, width, height)
  return { imageData, width, height }
}

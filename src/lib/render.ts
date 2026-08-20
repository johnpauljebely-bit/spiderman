import type { AnimSettings, BackgroundSettings, FrameResult, WipeDirection } from '../types'
import type { Bounds, PreparedPath } from './preparedPath'

export interface RenderScene {
  paths: PreparedPath[]
  logoBounds: Bounds
  background: BackgroundSettings
}

export interface FitTransform {
  scale: number
  offsetX: number
  offsetY: number
}

const PADDING_FRACTION = 0.12

export function computeFitTransform(canvasWidth: number, canvasHeight: number, logoBounds: Bounds): FitTransform {
  const availW = canvasWidth * (1 - PADDING_FRACTION * 2)
  const availH = canvasHeight * (1 - PADDING_FRACTION * 2)
  const safeW = Math.max(1, logoBounds.width)
  const safeH = Math.max(1, logoBounds.height)
  const scale = Math.min(availW / safeW, availH / safeH)
  const offsetX = canvasWidth / 2 - (logoBounds.x + safeW / 2) * scale
  const offsetY = canvasHeight / 2 - (logoBounds.y + safeH / 2) * scale
  return { scale, offsetX, offsetY }
}

function drawBackground(ctx: CanvasRenderingContext2D, width: number, height: number, background: BackgroundSettings) {
  if (background.kind === 'transparent') {
    return
  }
  if (background.kind === 'image' && background.image) {
    const img = background.image
    const imgW = img.naturalWidth || img.width
    const imgH = img.naturalHeight || img.height
    const coverScale = Math.max(width / imgW, height / imgH)
    const drawW = imgW * coverScale
    const drawH = imgH * coverScale
    ctx.drawImage(img, (width - drawW) / 2, (height - drawH) / 2, drawW, drawH)
  } else {
    ctx.fillStyle = background.color
    ctx.fillRect(0, 0, width, height)
  }
}

function createScratchCanvas(width: number, height: number): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Could not create 2D canvas context')
  return { canvas, ctx }
}

const SWEEP_UNIT_VECTORS: Record<WipeDirection, { dx: number; dy: number }> = {
  'left-right': { dx: 1, dy: 0 },
  'right-left': { dx: -1, dy: 0 },
  'top-bottom': { dx: 0, dy: 1 },
  'bottom-top': { dx: 0, dy: -1 },
  // Canvas y grows downward, so "bottom-left to top-right" is +x, -y.
  'diagonal-up': { dx: Math.SQRT1_2, dy: -Math.SQRT1_2 },
  'diagonal-down': { dx: -Math.SQRT1_2, dy: Math.SQRT1_2 },
}

/** Projects the bbox corners onto the sweep direction to get a start anchor point and total sweep distance, for any direction including diagonals. */
function getSweepAxis(bbox: Bounds, direction: WipeDirection) {
  const { dx, dy } = SWEEP_UNIT_VECTORS[direction]
  const corners = [
    { x: bbox.x, y: bbox.y },
    { x: bbox.x + bbox.width, y: bbox.y },
    { x: bbox.x, y: bbox.y + bbox.height },
    { x: bbox.x + bbox.width, y: bbox.y + bbox.height },
  ]
  let minProj = Infinity
  let maxProj = -Infinity
  let originX = bbox.x
  let originY = bbox.y
  for (const c of corners) {
    const proj = c.x * dx + c.y * dy
    if (proj < minProj) {
      minProj = proj
      originX = c.x
      originY = c.y
    }
    if (proj > maxProj) maxProj = proj
  }
  return { originX, originY, dx, dy, axisLength: Math.max(0.0001, maxProj - minProj) }
}

/**
 * Renders the wipe reveal on an isolated scratch canvas, then composites it onto the
 * main canvas with source-over. The destination-in mask below must not run directly
 * against the main canvas — it would erase the alpha of whatever was already painted
 * there (the background), not just this shape's own fill, leaving a punched-through
 * "grey" hole instead of the real background showing through the unrevealed area.
 */
function drawWipeReveal(
  mainCtx: CanvasRenderingContext2D,
  scratch: { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D },
  transform: FitTransform,
  path2d: Path2D,
  bbox: Bounds,
  color: string,
  progress: number,
  direction: WipeDirection,
  softness: number,
) {
  if (progress <= 0.001) return

  const ctx = scratch.ctx
  ctx.clearRect(0, 0, scratch.canvas.width, scratch.canvas.height)
  ctx.save()
  ctx.translate(transform.offsetX, transform.offsetY)
  ctx.scale(transform.scale, transform.scale)

  ctx.clip(path2d)
  ctx.fillStyle = color
  ctx.fillRect(bbox.x - 1, bbox.y - 1, bbox.width + 2, bbox.height + 2)

  const { originX, originY, dx, dy, axisLength } = getSweepAxis(bbox, direction)
  const feather = Math.max(axisLength * 0.02, Math.min(0.6, softness) * axisLength)

  const frontier = progress * (axisLength + 2 * feather) - feather
  const solidEnd = frontier - feather
  const fadeEnd = frontier

  const x0 = originX + dx * solidEnd
  const y0 = originY + dy * solidEnd
  const x1 = originX + dx * fadeEnd
  const y1 = originY + dy * fadeEnd

  const gradient = ctx.createLinearGradient(x0, y0, x1, y1)
  gradient.addColorStop(0, 'rgba(255,255,255,1)')
  gradient.addColorStop(1, 'rgba(255,255,255,0)')

  ctx.globalCompositeOperation = 'destination-in'
  ctx.fillStyle = gradient
  ctx.fillRect(bbox.x - 1, bbox.y - 1, bbox.width + 2, bbox.height + 2)
  ctx.restore()

  mainCtx.drawImage(scratch.canvas, 0, 0)
}

/** Shared by both the reveal's fill style and the fade-out style — same mechanics, independently reversible. */
function resolveFillDirection(style: 'linear' | 'diagonal', reversed: boolean): WipeDirection {
  if (style === 'linear') return reversed ? 'top-bottom' : 'bottom-top'
  return reversed ? 'diagonal-down' : 'diagonal-up'
}

/** Fills `path.d` at the given alpha — the normal case. Stroke-only line art (hasFill: false) has
 * nothing to fill, so it strokes its own outline at that alpha instead, so it still visibly responds. */
function fillOrStrokePath(ctx: CanvasRenderingContext2D, transform: FitTransform, settings: AnimSettings, path: PreparedPath, color: string, alpha: number) {
  if (alpha <= 0.001) return
  ctx.save()
  ctx.globalAlpha = alpha
  if (path.hasFill) {
    ctx.fillStyle = color
    ctx.fill(new Path2D(path.d))
  } else {
    ctx.strokeStyle = color
    ctx.lineWidth = settings.strokeWidth / transform.scale
    ctx.lineJoin = 'round'
    ctx.lineCap = 'round'
    ctx.stroke(new Path2D(path.strokeD))
  }
  ctx.restore()
}

/** Directional wipe reveals (drawWipeReveal) fundamentally need a fillable region, which stroke-only
 * line art doesn't have — it gets a plain progressive dash-stroke reveal instead, driven by the same
 * 0..1 progress value, so it still animates in step with everything else instead of just popping in. */
function strokeReveal(ctx: CanvasRenderingContext2D, transform: FitTransform, settings: AnimSettings, path: PreparedPath, color: string, progress: number) {
  if (progress <= 0.001) return
  ctx.save()
  ctx.translate(transform.offsetX, transform.offsetY)
  ctx.scale(transform.scale, transform.scale)
  ctx.strokeStyle = color
  ctx.lineWidth = settings.strokeWidth / transform.scale
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'
  const drawn = progress * path.totalLength
  ctx.setLineDash([drawn, Math.max(0, path.totalLength - drawn)])
  ctx.lineDashOffset = -path.startLength
  ctx.stroke(new Path2D(path.strokeD))
  ctx.restore()
}

export function drawFrame(
  ctx: CanvasRenderingContext2D,
  canvasWidth: number,
  canvasHeight: number,
  scene: RenderScene,
  frame: FrameResult,
  settings: AnimSettings,
) {
  ctx.clearRect(0, 0, canvasWidth, canvasHeight)
  drawBackground(ctx, canvasWidth, canvasHeight, scene.background)

  const transform = computeFitTransform(canvasWidth, canvasHeight, scene.logoBounds)
  const stateById = new Map(frame.paths.map((p) => [p.id, p]))

  // Ghost preview: the whole logo, faint, drawn once underneath everything else — so the full shape
  // is visible from the start instead of only appearing piece by piece as the reveal catches up to it.
  // 'fill' shows a faint filled silhouette; 'outline' shows just faint line-work, no fill underneath.
  if (settings.ghostOpacity > 0.001) {
    ctx.save()
    ctx.translate(transform.offsetX, transform.offsetY)
    ctx.scale(transform.scale, transform.scale)
    for (const path of scene.paths) {
      if (settings.ghostStyle === 'outline' || !path.hasFill) {
        ctx.globalAlpha = settings.ghostOpacity
        ctx.strokeStyle = path.color
        ctx.lineWidth = settings.strokeWidth / transform.scale
        ctx.lineJoin = 'round'
        ctx.lineCap = 'round'
        ctx.stroke(new Path2D(path.strokeD))
      } else {
        ctx.globalAlpha = settings.ghostOpacity
        ctx.fillStyle = path.color
        ctx.fill(new Path2D(path.d))
      }
    }
    ctx.restore()
  }

  if (settings.style === 'draw-fill') {
    ctx.save()
    ctx.translate(transform.offsetX, transform.offsetY)
    ctx.scale(transform.scale, transform.scale)

    for (const path of scene.paths) {
      const state = stateById.get(path.id)
      if (!state) continue

      if (state.drawnLength > 0.01) {
        ctx.save()
        ctx.strokeStyle = path.color
        ctx.lineWidth = settings.strokeWidth / transform.scale
        ctx.lineJoin = 'round'
        ctx.lineCap = 'round'
        ctx.setLineDash([state.drawnLength, Math.max(0, state.totalLength - state.drawnLength)])
        ctx.lineDashOffset = state.dashOffset
        ctx.stroke(new Path2D(path.strokeD))
        ctx.restore()
      }
      if (state.fillAlpha > 0.001 && settings.fillStyle === 'normal') {
        fillOrStrokePath(ctx, transform, settings, path, path.color, state.fillAlpha)
      }
    }

    ctx.restore()

    if (settings.fillStyle !== 'normal') {
      const scratch = createScratchCanvas(canvasWidth, canvasHeight)
      const direction = resolveFillDirection(settings.fillStyle, settings.fillStyleReverse)
      for (const path of scene.paths) {
        const state = stateById.get(path.id)
        if (!state) continue
        if (path.hasFill) {
          drawWipeReveal(ctx, scratch, transform, new Path2D(path.d), path.bbox, path.color, state.fillAlpha, direction, settings.wipeSoftness)
        } else {
          strokeReveal(ctx, transform, settings, path, path.color, state.fillAlpha)
        }
      }
    }
  } else {
    const scratch = createScratchCanvas(canvasWidth, canvasHeight)
    for (const path of scene.paths) {
      const state = stateById.get(path.id)
      if (!state) continue
      if (path.hasFill) {
        const path2d = new Path2D(path.d)
        drawWipeReveal(ctx, scratch, transform, path2d, path.bbox, path.color, state.wipeProgress, settings.wipeDirection, settings.wipeSoftness)
      } else {
        strokeReveal(ctx, transform, settings, path, path.color, state.wipeProgress)
      }
    }
  }

  // Fade-transition mode: the finished static logo dissolves on top of whatever the reveal is doing
  // underneath, instead of hard-cutting straight to blank. Same normal/linear/diagonal mechanics as
  // the fill style — overlayAlpha already behaves exactly like a reveal "progress" (1 = fully shown,
  // 0 = nothing shown), so it plugs directly into the same wipe-reveal machinery.
  if (frame.overlayAlpha > 0.001) {
    if (settings.fadeOutStyle === 'normal') {
      ctx.save()
      ctx.translate(transform.offsetX, transform.offsetY)
      ctx.scale(transform.scale, transform.scale)
      for (const path of scene.paths) {
        fillOrStrokePath(ctx, transform, settings, path, path.color, frame.overlayAlpha)
      }
      ctx.restore()
    } else {
      const scratch = createScratchCanvas(canvasWidth, canvasHeight)
      const direction = resolveFillDirection(settings.fadeOutStyle, settings.fadeOutReverse)
      for (const path of scene.paths) {
        if (path.hasFill) {
          drawWipeReveal(ctx, scratch, transform, new Path2D(path.d), path.bbox, path.color, frame.overlayAlpha, direction, settings.wipeSoftness)
        } else {
          strokeReveal(ctx, transform, settings, path, path.color, frame.overlayAlpha)
        }
      }
    }
  }
}

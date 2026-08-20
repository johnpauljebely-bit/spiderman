import { GIFEncoder, quantize, applyPalette } from 'gifenc'
import type { AnimSettings, SequenceGroup } from '../types'
import { computeFrame, getTotalDurationMs } from './animate'
import { drawFrame, type RenderScene } from './render'

export interface ExportOptions {
  width: number
  height: number
  fps?: number
  maxColors?: number
}

export async function exportGif(
  scene: RenderScene,
  settings: AnimSettings,
  groups: SequenceGroup[],
  opts: ExportOptions,
  onProgress?: (fraction: number) => void,
): Promise<Blob> {
  const fps = opts.fps ?? 30
  const totalDurationMs = getTotalDurationMs(settings, scene.paths, groups)
  const frameCount = Math.max(1, Math.round((totalDurationMs / 1000) * fps))
  const delayMs = 1000 / fps

  const canvas = document.createElement('canvas')
  canvas.width = opts.width
  canvas.height = opts.height
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) throw new Error('Could not create 2D canvas context')

  const transparent = scene.background.kind === 'transparent'
  const format = transparent ? 'rgba4444' : 'rgb444'

  const frames: Uint8ClampedArray[] = []
  for (let i = 0; i < frameCount; i++) {
    const t = (i / frameCount) * totalDurationMs
    const frame = computeFrame(t, settings, scene.paths, groups)
    drawFrame(ctx, opts.width, opts.height, scene, frame, settings)
    const imageData = ctx.getImageData(0, 0, opts.width, opts.height)
    frames.push(imageData.data.slice())
    onProgress?.(((i + 1) / frameCount) * 0.5)
  }

  const lastFrame = frames[frames.length - 1]
  const maxColors = opts.maxColors ?? 128
  const palette = quantize(lastFrame, maxColors, { format, oneBitAlpha: transparent })
  const transparentIndex = transparent ? palette.findIndex((c) => c[3] === 0) : -1

  const gif = GIFEncoder()
  for (let i = 0; i < frames.length; i++) {
    const index = applyPalette(frames[i], palette, format)
    gif.writeFrame(index, opts.width, opts.height, {
      palette: i === 0 ? palette : undefined,
      delay: delayMs,
      repeat: 0,
      transparent: transparentIndex >= 0,
      transparentIndex: transparentIndex >= 0 ? transparentIndex : undefined,
    })
    onProgress?.(0.5 + ((i + 1) / frames.length) * 0.5)
  }
  gif.finish()

  const bytes = gif.bytes()
  return new Blob([bytes.slice().buffer], { type: 'image/gif' })
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

import type { TracedPath } from '../types'
import { getPathBBox, getPathLength } from './pathGeometry'

export interface Bounds {
  x: number
  y: number
  width: number
  height: number
}

export interface PreparedPath extends TracedPath {
  /** Length of strokeD — what the drawing animation and start/end points are measured along. */
  totalLength: number
  /** Bounding box of the real shape (d) — used for fade-wipe sweeps and hit-testing. */
  bbox: Bounds
}

export function preparePaths(paths: TracedPath[]): PreparedPath[] {
  return paths.map((path) => ({
    ...path,
    totalLength: getPathLength(path.strokeD),
    bbox: getPathBBox(path.d),
  }))
}

export function combinedBounds(paths: PreparedPath[]): Bounds {
  if (paths.length === 0) return { x: 0, y: 0, width: 0, height: 0 }
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const p of paths) {
    minX = Math.min(minX, p.bbox.x)
    minY = Math.min(minY, p.bbox.y)
    maxX = Math.max(maxX, p.bbox.x + p.bbox.width)
    maxY = Math.max(maxY, p.bbox.y + p.bbox.height)
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY }
}

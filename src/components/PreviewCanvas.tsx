import { useEffect, useMemo, useRef, useState } from 'react'
import type { AnimSettings, PickMode, SequenceGroup } from '../types'
import { computeFrame, getTotalDurationMs } from '../lib/animate'
import { getPointAtLength, nearestLengthToPoint } from '../lib/pathGeometry'
import type { PreparedPath } from '../lib/preparedPath'
import { computeFitTransform, drawFrame, type RenderScene } from '../lib/render'

export function PreviewCanvas({
  scene,
  settings,
  groups,
  width = 480,
  height = 480,
  pickMode,
  onPickPoint,
  onAssignShape,
  selectedPathId,
  onSelectPath,
}: {
  scene: RenderScene | null
  settings: AnimSettings
  groups: SequenceGroup[]
  width?: number
  height?: number
  pickMode: PickMode
  onPickPoint: (pathId: string, length: number, field: 'start' | 'end') => void
  onAssignShape: (pathId: string) => void
  selectedPathId: string | null
  onSelectPath: (id: string | null) => void
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rafRef = useRef(0)
  const startRef = useRef(performance.now())
  const [dragging, setDragging] = useState<'start' | 'end' | null>(null)

  useEffect(() => {
    startRef.current = performance.now()
  }, [settings, scene, groups])

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return

    function tick() {
      if (!scene || scene.paths.length === 0) {
        ctx!.clearRect(0, 0, width, height)
        rafRef.current = requestAnimationFrame(tick)
        return
      }
      const totalDuration = getTotalDurationMs(settings, scene.paths, groups)
      const elapsed = (performance.now() - startRef.current) % totalDuration
      const frame = computeFrame(elapsed, settings, scene.paths, groups)
      drawFrame(ctx!, width, height, scene, frame, settings)
      rafRef.current = requestAnimationFrame(tick)
    }

    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [scene, settings, groups, width, height])

  const transform = useMemo(() => {
    if (!scene) return null
    return computeFitTransform(width, height, scene.logoBounds)
  }, [scene, width, height])

  function clientToLogoSpace(clientX: number, clientY: number): { x: number; y: number } | null {
    const canvas = canvasRef.current
    if (!canvas || !transform) return null
    const rect = canvas.getBoundingClientRect()
    const cx = ((clientX - rect.left) / rect.width) * width
    const cy = ((clientY - rect.top) / rect.height) * height
    return { x: (cx - transform.offsetX) / transform.scale, y: (cy - transform.offsetY) / transform.scale }
  }

  function hitTestShape(logoX: number, logoY: number): PreparedPath | null {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!scene || !ctx) return null

    for (let i = scene.paths.length - 1; i >= 0; i--) {
      const p = scene.paths[i]
      if (ctx.isPointInPath(new Path2D(p.d), logoX, logoY)) return p
    }

    let best: PreparedPath | null = null
    let bestDist = Infinity
    for (const p of scene.paths) {
      const centerX = p.bbox.x + p.bbox.width / 2
      const centerY = p.bbox.y + p.bbox.height / 2
      const dist = (centerX - logoX) ** 2 + (centerY - logoY) ** 2
      if (dist < bestDist) {
        bestDist = dist
        best = p
      }
    }
    return best
  }

  function handleClick(e: React.MouseEvent<HTMLCanvasElement>) {
    if (pickMode === 'none' || !scene) return
    const logoPt = clientToLogoSpace(e.clientX, e.clientY)
    if (!logoPt) return
    const hitPath = hitTestShape(logoPt.x, logoPt.y)
    if (!hitPath) return

    if (pickMode === 'assign') {
      onAssignShape(hitPath.id)
      return
    }

    const length = nearestLengthToPoint(hitPath.strokeD, logoPt.x, logoPt.y)
    onSelectPath(hitPath.id)
    onPickPoint(hitPath.id, length, pickMode)
  }

  const selectedPath = scene?.paths.find((p) => p.id === selectedPathId) ?? null
  const showMarkers = pickMode === 'start' || pickMode === 'end'

  function markerPercent(length: number) {
    if (!selectedPath || !transform) return null
    const pt = getPointAtLength(selectedPath.strokeD, length)
    return {
      xPct: ((transform.offsetX + pt.x * transform.scale) / width) * 100,
      yPct: ((transform.offsetY + pt.y * transform.scale) / height) * 100,
    }
  }

  const startMarker = showMarkers && selectedPath ? markerPercent(selectedPath.startLength) : null
  const endMarker = showMarkers && selectedPath?.endLength != null ? markerPercent(selectedPath.endLength) : null

  function beginDrag(field: 'start' | 'end', e: React.PointerEvent<HTMLDivElement>) {
    e.stopPropagation()
    e.preventDefault()
    e.currentTarget.setPointerCapture(e.pointerId)
    setDragging(field)
  }

  function onDragMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!dragging || !selectedPath) return
    const logoPt = clientToLogoSpace(e.clientX, e.clientY)
    if (!logoPt) return
    const length = nearestLengthToPoint(selectedPath.strokeD, logoPt.x, logoPt.y)
    onPickPoint(selectedPath.id, length, dragging)
  }

  function endDrag(e: React.PointerEvent<HTMLDivElement>) {
    e.currentTarget.releasePointerCapture(e.pointerId)
    setDragging(null)
  }

  return (
    <div className="relative" style={{ aspectRatio: '1 / 1' }}>
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        onClick={handleClick}
        className={pickMode !== 'none' ? 'w-full cursor-crosshair rounded-xl' : 'w-full rounded-xl'}
        style={{ aspectRatio: '1 / 1' }}
      />
      {startMarker && (
        <div
          onPointerDown={(e) => beginDrag('start', e)}
          onPointerMove={onDragMove}
          onPointerUp={endDrag}
          title="Start point — drag to adjust"
          className="absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 cursor-grab rounded-full border-2 border-white bg-red-500 shadow-[0_0_0_3px_rgba(0,0,0,0.5)] active:cursor-grabbing"
          style={{ left: `${startMarker.xPct}%`, top: `${startMarker.yPct}%` }}
        />
      )}
      {endMarker && (
        <div
          onPointerDown={(e) => beginDrag('end', e)}
          onPointerMove={onDragMove}
          onPointerUp={endDrag}
          title="End point — drag to adjust"
          className="absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 cursor-grab rounded-full border-2 border-white bg-amber-500 shadow-[0_0_0_3px_rgba(0,0,0,0.5)] active:cursor-grabbing"
          style={{ left: `${endMarker.xPct}%`, top: `${endMarker.yPct}%` }}
        />
      )}
    </div>
  )
}

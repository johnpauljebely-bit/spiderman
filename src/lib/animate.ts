import type { AnimSettings, FrameResult, PathFrameState, SequenceGroup } from '../types'
import { applyEasing } from './easing'
import type { PreparedPath } from './preparedPath'

const MIN_SPEED = 0.05
const UNGROUPED_ID = '__ungrouped__'

function effectiveMs(ms: number, speed: number): number {
  return ms / Math.max(MIN_SPEED, speed)
}

/**
 * Any path not assigned to a custom group becomes its own implicit leading
 * group, so nothing is ever silently excluded from the animation. With zero
 * custom groups (freshly cleared, or never touched) this collapses to a
 * single group containing everything — i.e. simple "all together" playback.
 */
export function resolveGroups(groups: SequenceGroup[], paths: { id: string }[]): SequenceGroup[] {
  const assigned = new Set(groups.flatMap((g) => g.pathIds))
  const leftover = paths.filter((p) => !assigned.has(p.id)).map((p) => p.id)
  const customGroups = groups.filter((g) => g.pathIds.length > 0)

  if (leftover.length === 0) {
    return customGroups.length ? customGroups : [{ id: UNGROUPED_ID, pathIds: paths.map((p) => p.id), gapMs: 0 }]
  }
  return [{ id: UNGROUPED_ID, pathIds: leftover, gapMs: 0 }, ...customGroups]
}

function groupOffsets(settings: AnimSettings, groups: SequenceGroup[]): { offsets: number[]; elementDur: number; activeDurationMs: number } {
  const outlineMs = effectiveMs(settings.outlineDrawMs, settings.speed)
  const fillMs = effectiveMs(settings.fillFadeMs, settings.speed)
  const elementDur = outlineMs + fillMs

  const offsets: number[] = []
  let cursor = 0
  groups.forEach((g, i) => {
    if (i === 0) {
      offsets.push(0)
      cursor = elementDur
    } else {
      const gapMs = effectiveMs(g.gapMs, settings.speed)
      const start = cursor + gapMs
      offsets.push(start)
      cursor = start + elementDur
    }
  })

  const activeDurationMs = offsets.length ? Math.max(...offsets.map((o) => o + elementDur)) : elementDur
  return { offsets, elementDur, activeDurationMs }
}

/** Fully-revealed hold before anything happens — pre-fade or pre-cut, same either way. */
function fullyRevealedPaths(paths: PreparedPath[]): PathFrameState[] {
  return paths.map((path) => ({
    id: path.id,
    dashOffset: -path.startLength,
    drawnLength: path.totalLength,
    totalLength: path.totalLength,
    fillAlpha: 1,
    wipeProgress: 1,
  }))
}

/** Length of stroke to reveal at 100% progress — the full loop, or just the start→end arc if an end point is set. */
function revealLength(path: PreparedPath): number {
  if (path.endLength == null) return path.totalLength
  const arc = (path.endLength - path.startLength + path.totalLength) % path.totalLength
  return arc <= 0.01 ? path.totalLength : arc
}

/**
 * The reveal animation's own per-path state, as a pure function of time since ITS start (which may be
 * negative — meaning it hasn't started yet, correctly rendering as fully blank — or arbitrarily large
 * past its own completion, correctly settling into fully-revealed for the hold-at-end phase).
 */
function computeRevealFrame(tSinceRevealStart: number, settings: AnimSettings, paths: PreparedPath[], groups: SequenceGroup[]): PathFrameState[] {
  const outlineMs = effectiveMs(settings.outlineDrawMs, settings.speed)
  const fillMs = effectiveMs(settings.fillFadeMs, settings.speed)
  const resolved = resolveGroups(groups, paths)
  const { offsets, elementDur } = groupOffsets(settings, resolved)

  const offsetByPathId = new Map<string, number>()
  resolved.forEach((group, i) => {
    for (const pathId of group.pathIds) offsetByPathId.set(pathId, offsets[i])
  })

  return paths.map((path) => {
    const localT = tSinceRevealStart - (offsetByPathId.get(path.id) ?? 0)

    if (settings.style === 'draw-fill') {
      let strokeProgress = 0
      let fillAlpha = 0

      if (localT <= 0) {
        strokeProgress = 0
        fillAlpha = 0
      } else if (localT <= outlineMs) {
        // Laps: split the same outline-draw duration into N equal passes instead of extending it —
        // each pass draws 0→100% then resets, so the pen visibly retraces the shape N times before
        // settling into the fill phase. laps=1 collapses back to a single normal pass.
        const laps = Math.max(1, Math.round(settings.strokeLaps))
        const lapMs = outlineMs / laps
        const lapIndex = lapMs > 0 ? Math.min(laps - 1, Math.floor(localT / lapMs)) : 0
        const lapLocalT = localT - lapIndex * lapMs
        strokeProgress = applyEasing(settings.easing, lapMs > 0 ? lapLocalT / lapMs : 1)
        fillAlpha = 0
      } else {
        strokeProgress = 1
        const fillLocal = localT - outlineMs
        fillAlpha = applyEasing(settings.easing, fillMs > 0 ? Math.min(1, fillLocal / fillMs) : 1)
      }

      return {
        id: path.id,
        dashOffset: -path.startLength,
        drawnLength: strokeProgress * revealLength(path),
        totalLength: path.totalLength,
        fillAlpha,
        wipeProgress: 0,
      }
    }

    // fade-wipe
    const progress = localT <= 0 ? 0 : applyEasing(settings.easing, Math.min(1, localT / elementDur))
    return {
      id: path.id,
      dashOffset: -path.startLength,
      drawnLength: path.totalLength,
      totalLength: path.totalLength,
      fillAlpha: progress,
      wipeProgress: progress,
    }
  })
}

/** Where (in ms from loop start) the reveal animation begins, and how the fade-out overlay should look at a given time. */
function fadeTimeline(settings: AnimSettings) {
  const startHoldMs = effectiveMs(settings.startHoldMs, settings.speed)
  if (settings.fadeOutMs <= 0) {
    return { startHoldMs, revealStart: startHoldMs, fadeOutMs: 0 }
  }
  const fadeOutMs = effectiveMs(settings.fadeOutMs, settings.speed)
  const fadeOverlapMs = Math.min(fadeOutMs, effectiveMs(settings.fadeOverlapMs, settings.speed))
  const revealStart = startHoldMs + Math.max(0, fadeOutMs - fadeOverlapMs)
  return { startHoldMs, revealStart, fadeOutMs }
}

export function getTotalDurationMs(settings: AnimSettings, paths: { id: string }[], groups: SequenceGroup[]): number {
  const holdMs = effectiveMs(settings.holdEndMs, settings.speed)
  const { startHoldMs, revealStart, fadeOutMs } = fadeTimeline(settings)
  const { activeDurationMs } = groupOffsets(settings, resolveGroups(groups, paths))

  const fadeEnd = startHoldMs + fadeOutMs
  const revealEnd = revealStart + activeDurationMs
  const holdStart = Math.max(fadeEnd, revealEnd)
  return Math.max(1, holdStart + holdMs)
}

export function computeFrame(tMs: number, settings: AnimSettings, paths: PreparedPath[], groups: SequenceGroup[]): FrameResult {
  const totalDurationMs = getTotalDurationMs(settings, paths, groups)
  const { startHoldMs, revealStart, fadeOutMs } = fadeTimeline(settings)

  if (tMs < startHoldMs) {
    return { paths: fullyRevealedPaths(paths), totalDurationMs, overlayAlpha: 0 }
  }

  const revealPaths = computeRevealFrame(tMs - revealStart, settings, paths, groups)

  const fadeEnd = startHoldMs + fadeOutMs
  const overlayAlpha = fadeOutMs > 0 && tMs < fadeEnd ? Math.max(0, 1 - (tMs - startHoldMs) / fadeOutMs) : 0

  return { paths: revealPaths, totalDurationMs, overlayAlpha }
}

import type { SequenceGroup } from '../types'
import type { PreparedPath } from './preparedPath'

const MAX_TIERS = 4

/**
 * First-pass heuristic for "just figure out a sensible build order for me": buckets shapes into
 * up to MAX_TIERS size tiers (by bounding-box area, largest first) and plays each tier as its own
 * group with a slight negative gap so tiers cascade into each other instead of ticking through
 * one by one. Big frame/background shapes read first, smaller detail accents layer on last.
 */
export function computeAutoGroups(paths: PreparedPath[], outlineDrawMs: number): SequenceGroup[] {
  if (paths.length === 0) return []

  const ranked = [...paths].sort((a, b) => b.bbox.width * b.bbox.height - a.bbox.width * a.bbox.height)
  const tierCount = Math.min(MAX_TIERS, ranked.length)
  const tiers: PreparedPath[][] = Array.from({ length: tierCount }, () => [])
  ranked.forEach((path, i) => {
    tiers[Math.min(tierCount - 1, Math.floor((i / ranked.length) * tierCount))].push(path)
  })

  const cascadeGapMs = -Math.round(outlineDrawMs * 0.35)
  return tiers
    .filter((tier) => tier.length > 0)
    .map((tier, i) => ({
      id: `auto-${i}`,
      pathIds: tier.map((p) => p.id),
      gapMs: i === 0 ? 0 : cascadeGapMs,
    }))
}

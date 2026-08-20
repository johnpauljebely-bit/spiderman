export interface AutoCalibration {
  numberOfColors: number
  smoothing: number
}

/**
 * Estimates how many real, distinct colors a logo has by bucketing pixels into a coarse grid (so
 * anti-aliased near-duplicate shades collapse together) and counting buckets with a meaningful share
 * of opaque pixels. Anti-aliasing/JPEG-style noise produces thousands of technically-unique colors even
 * for a flat 2-color icon; without this, a naive count would wildly overestimate real color count.
 *
 * A coarse grid alone isn't enough: fringe pixels along an edge (e.g. a flattened semi-transparent
 * white blending toward a dark background) land in buckets like (240,240,240) or (240,216,216) that
 * are each individually "significant" in a thin, edge-heavy shape (mountain outline, plane) even
 * though they're the same logical color as the dominant (255,255,255) bucket. Those get merged into
 * whichever larger, already-accepted cluster they're perceptually close to before counting, so a flat
 * white icon reports as 1 real color instead of 3-4 near-white shades.
 */
export function detectDominantColorCount(
  imageData: ImageData,
  opts: { minColors?: number; maxColors?: number; significanceThreshold?: number; bucketSize?: number; mergeDistance?: number } = {},
): number {
  const { minColors = 2, maxColors = 16, significanceThreshold = 0.008, bucketSize = 24, mergeDistance = 80 } = opts
  const data = imageData.data

  const buckets = new Map<string, number>()
  let totalOpaque = 0

  for (let i = 0; i < data.length; i += 4) {
    const alpha = data[i + 3]
    if (alpha < 32) continue
    totalOpaque++
    const r = Math.round(data[i] / bucketSize) * bucketSize
    const g = Math.round(data[i + 1] / bucketSize) * bucketSize
    const b = Math.round(data[i + 2] / bucketSize) * bucketSize
    const key = `${r},${g},${b}`
    buckets.set(key, (buckets.get(key) ?? 0) + 1)
  }

  if (totalOpaque === 0) return minColors

  const sortedBuckets = [...buckets.entries()]
    .map(([key, count]) => {
      const [r, g, b] = key.split(',').map(Number)
      return { r, g, b, count }
    })
    .sort((a, b) => b.count - a.count)

  const clusters: { r: number; g: number; b: number; count: number }[] = []
  for (const bucket of sortedBuckets) {
    const nearest = clusters.find((c) => {
      const dr = c.r - bucket.r
      const dg = c.g - bucket.g
      const db = c.b - bucket.b
      return Math.sqrt(dr * dr + dg * dg + db * db) <= mergeDistance
    })
    if (nearest) {
      nearest.count += bucket.count
    } else {
      clusters.push({ ...bucket })
    }
  }

  let significant = 0
  for (const cluster of clusters) {
    if (cluster.count / totalOpaque >= significanceThreshold) significant++
  }

  return Math.max(minColors, Math.min(maxColors, significant))
}

/**
 * Picks a starting Colors + Smoothing combo from the image itself instead of a fixed default, so a
 * simple flat icon and a detailed multi-tone logo each land somewhere sane without manual hunting.
 * Fewer real colors means fewer, larger shapes, which can safely take more aggressive smoothing;
 * more colors means finer detail that a high smoothing value would blur away or fragment further.
 */
export function autoCalibrate(imageData: ImageData): AutoCalibration {
  const numberOfColors = detectDominantColorCount(imageData)
  const smoothing = Math.round(Math.max(35, Math.min(75, 75 - numberOfColors * 4)))
  return { numberOfColors, smoothing }
}

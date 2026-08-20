import type { EasingName } from '../types'

const easingFns: Record<EasingName, (t: number) => number> = {
  linear: (t) => t,
  smooth: (t) => t * t * (3 - 2 * t),
  'ease-in': (t) => t * t * t,
  'ease-out': (t) => 1 - (1 - t) ** 3,
  'ease-in-out': (t) => (t < 0.5 ? 4 * t * t * t : 1 - ((-2 * t + 2) ** 3) / 2),
}

export const EASING_OPTIONS: { value: EasingName; label: string }[] = [
  { value: 'linear', label: 'Linear — constant speed' },
  { value: 'smooth', label: 'Smooth — gentle ease both ends' },
  { value: 'ease-in', label: 'Ease In — starts slow, speeds up' },
  { value: 'ease-out', label: 'Ease Out — starts fast, slows to a stop' },
  { value: 'ease-in-out', label: 'Ease In Out — slow, fast, slow' },
]

export function applyEasing(name: EasingName, t: number): number {
  const clamped = Math.max(0, Math.min(1, t))
  return easingFns[name](clamped)
}

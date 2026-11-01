import { useEffect } from 'react'
import Lenis from 'lenis'

/** Momentum/resistance scrolling, used on every page. Both knobs are 45% weaker than the original
 * setup (1.15s glide, 0.85 wheel damping): 1.15 × 0.55 ≈ 0.63, and 0.85 + (1 − 0.85) × 0.45 ≈ 0.92. */
export function SmoothScroll() {
  useEffect(() => {
    const lenis = new Lenis({
      duration: 0.63,
      easing: (t: number) => 1 - Math.pow(1 - t, 4),
      wheelMultiplier: 0.92,
      touchMultiplier: 1,
      // Links to #sections glide there too, stopping where each section's own scroll-margin says (clear of the header).
      anchors: true,
    })

    let rafId: number
    function raf(time: number) {
      lenis.raf(time)
      rafId = requestAnimationFrame(raf)
    }
    rafId = requestAnimationFrame(raf)

    return () => {
      cancelAnimationFrame(rafId)
      lenis.destroy()
    }
  }, [])

  return null
}

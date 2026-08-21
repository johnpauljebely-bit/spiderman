import { useEffect, useState, type ReactNode } from 'react'
import { GooeyLoader } from './GooeyLoader'

const TRANSITION_MS = 700

/** Blank splash screen shown for a fixed duration on every page load, before either the login screen
 * or the app itself — doesn't care which one ends up underneath. Fades out while the real screen
 * blurs into focus, rather than just popping in. */
export function LoadingGate({ children, durationMs = 5000 }: { children: ReactNode; durationMs?: number }) {
  // Landing back here straight from Discord's OAuth redirect (#access_token=...) already feels like
  // its own loading beat — don't stack a second blank splash on top of it before the panel shows up.
  const [skipSplash] = useState(() => window.location.hash.includes('access_token'))
  const [revealing, setRevealing] = useState(skipSplash)
  const [showOverlay, setShowOverlay] = useState(!skipSplash)

  useEffect(() => {
    if (skipSplash) return
    const revealTimer = window.setTimeout(() => setRevealing(true), durationMs)
    const removeTimer = window.setTimeout(() => setShowOverlay(false), durationMs + TRANSITION_MS)
    return () => {
      window.clearTimeout(revealTimer)
      window.clearTimeout(removeTimer)
    }
  }, [skipSplash, durationMs])

  return (
    <>
      <div style={{ filter: revealing ? 'blur(0px)' : 'blur(28px)', transition: `filter ${TRANSITION_MS}ms ease-out` }}>
        {children}
      </div>

      {showOverlay && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-canvas"
          style={{
            opacity: revealing ? 0 : 1,
            transition: `opacity ${TRANSITION_MS}ms ease-out`,
            pointerEvents: revealing ? 'none' : 'auto',
          }}
        >
          <GooeyLoader style={{ fontSize: 22 }} />
        </div>
      )}
    </>
  )
}

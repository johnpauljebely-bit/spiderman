import { useEffect, useState, type ReactNode } from 'react'
import { LiquidGlassLogo } from '../landing/liquid-glass-logo'
import { arrivedFromSite } from '../lib/arrival'
import { SplashContext } from './splash-context'

const TRANSITION_MS = 700

/** The liquid-glass logo intro (black logo on the light plate, like the Andre site's), shown for a fixed
 * duration on direct visits (not click-throughs), before either the login screen or the app itself —
 * doesn't care which one ends up underneath. Fades out while the real screen blurs into focus, rather than just popping in. */
export function LoadingGate({ children, durationMs = 5000 }: { children: ReactNode; durationMs?: number }) {
  // No splash when you got here by clicking through from another page of the site (the landing page's
  // "Open Move", the docs link…) — it's for visits straight to this address. Landing back from Discord's
  // OAuth redirect (#access_token=...) already feels like its own loading beat, so it's skipped there too.
  const [skipSplash] = useState(() => window.location.hash.includes('access_token') || arrivedFromSite())
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
    <SplashContext.Provider value={revealing}>
      <div
        style={{
          // Once the splash is gone the filter goes too: even blur(0) would make this a containing block for fixed children.
          filter: showOverlay ? (revealing ? 'blur(0px)' : 'blur(28px)') : 'none',
          transition: `filter ${TRANSITION_MS}ms ease-out`,
        }}
      >
        {children}
      </div>

      {showOverlay && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-[#e2e2e5]"
          style={{
            opacity: revealing ? 0 : 1,
            transition: `opacity ${TRANSITION_MS}ms ease-out`,
            pointerEvents: revealing ? 'none' : 'auto',
          }}
        >
          <LiquidGlassLogo logo="/move-logo.svg" ending="logo" theme="light" style={{ height: 480, maxHeight: '70svh' }} aria-label="Move" />
        </div>
      )}
    </SplashContext.Provider>
  )
}

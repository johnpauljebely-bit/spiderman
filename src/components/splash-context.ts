import { createContext, useContext } from 'react'

export const SplashContext = createContext(true)

/** False while the splash is still covering the page. Anything timed (like the access-denied countdown)
 * should wait for this, or people would only see the tail end of it. */
export function useSplashLifted() {
  return useContext(SplashContext)
}

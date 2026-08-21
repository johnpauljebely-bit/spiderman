import { useEffect, useRef, useState, type ReactNode } from 'react'
import { AccessDeniedScreen } from './AccessDeniedScreen'
import { LoginScreen } from './LoginScreen'
import { ALLOWED_DISCORD_USER_IDS } from '../lib/allowedUsers'
import { clearSession, consumeTokenFromRedirect, fetchDiscordUser, loadSession, saveSession, type DiscordUser } from '../lib/discordAuth'

type AuthState =
  | { status: 'checking' }
  | { status: 'login'; error: string | null }
  | { status: 'denied'; user: DiscordUser }
  | { status: 'authorized'; user: DiscordUser }

function isAllowed(user: DiscordUser): boolean {
  return ALLOWED_DISCORD_USER_IDS.includes(user.id)
}

/** Gates the whole app behind Discord login + an allowlist. Renders `children` as a function so the
 * authorized user (and a logout handler) can be shown in the app's own header. */
export function AuthGate({ children }: { children: (user: DiscordUser, logout: () => void) => ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: 'checking' })
  // Guards against React StrictMode's deliberate double-invoke of effects in dev: the check below
  // reads AND clears localStorage (clearSession on a disallowed session), so running it twice back
  // to back isn't idempotent — the second run would find nothing left to check and silently overwrite
  // a correctly-set 'denied' state with 'login'. A ref (unlike the effect closure) survives the
  // simulated remount, so this makes sure the real logic only ever runs once per mount.
  const initedRef = useRef(false)

  useEffect(() => {
    if (initedRef.current) return
    initedRef.current = true

    // No cancellation guard here on purpose: `initedRef` above already keeps this from running
    // twice under StrictMode's dev-only double-invoke, and AuthGate lives for the app's whole
    // lifetime otherwise, so there's no real unmount case to guard against. An earlier version
    // returned a cleanup that flipped a `cancelled` flag — but StrictMode calls that cleanup
    // immediately on the throwaway first invocation, which then poisoned the *same* in-flight
    // fetch that invocation had started, so the real Discord-redirect login never got out of
    // 'checking' in dev.
    async function init() {
      const freshToken = consumeTokenFromRedirect()
      if (freshToken) {
        try {
          const user = await fetchDiscordUser(freshToken)
          if (isAllowed(user)) {
            saveSession(user)
            setState({ status: 'authorized', user })
          } else {
            setState({ status: 'denied', user })
          }
        } catch (err) {
          setState({ status: 'login', error: err instanceof Error ? err.message : 'Login failed — try again.' })
        }
        return
      }

      const existing = loadSession()
      if (!existing) {
        setState({ status: 'login', error: null })
        return
      }
      if (isAllowed(existing)) {
        setState({ status: 'authorized', user: existing })
      } else {
        // The allowlist may have changed since they logged in — don't leave a now-disallowed
        // session sitting around.
        clearSession()
        setState({ status: 'denied', user: existing })
      }
    }

    init()
  }, [])

  function logout() {
    clearSession()
    setState({ status: 'login', error: null })
  }

  function backToLogin() {
    clearSession()
    setState({ status: 'login', error: null })
  }

  if (state.status === 'checking') return null
  if (state.status === 'login') return <LoginScreen error={state.error} />
  if (state.status === 'denied') return <AccessDeniedScreen user={state.user} onExpire={backToLogin} />
  return <>{children(state.user, logout)}</>
}

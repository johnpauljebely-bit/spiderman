import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { NotMemberScreen } from './AccessDeniedScreen'
import { LoginScreen } from './LoginScreen'
import { ALLOWED_DISCORD_USER_IDS } from '../lib/allowedUsers'
import { track } from '../lib/analytics'
import {
  clearPendingToken,
  clearSession,
  consumeTokenFromRedirect,
  ExpiredTokenError,
  fetchDiscordUser,
  fetchMembership,
  loadPendingToken,
  loadSession,
  savePendingToken,
  saveSession,
  type DiscordUser,
} from '../lib/discordAuth'

type AuthState =
  | { status: 'checking' }
  | { status: 'login'; error: string | null }
  | { status: 'denied'; user: DiscordUser; token: string }
  | { status: 'authorized'; user: DiscordUser }

/** Paid before Move went free for members: they keep their access, server or not. */
const onPaidList = (user: DiscordUser) => ALLOWED_DISCORD_USER_IDS.includes(user.id)

type CheckResult = { ok: true; user: DiscordUser } | { ok: false; user: DiscordUser } | { error: string }

/** Who the token belongs to and whether they get in: in the Vance Collective server, or on the old paid list. */
async function checkToken(token: string): Promise<CheckResult> {
  try {
    const user = await fetchDiscordUser(token)
    const paid = onPaidList(user)
    // A hiccup on the membership check shouldn't lock out someone who paid
    const member = paid ? await fetchMembership(token).catch(() => false) : await fetchMembership(token)
    if (member || paid) {
      saveSession(user, member)
      clearPendingToken()
      return { ok: true, user }
    }
    savePendingToken(token)
    return { ok: false, user }
  } catch (err) {
    clearPendingToken()
    if (err instanceof ExpiredTokenError) return { error: err.message }
    return { error: err instanceof Error ? err.message : 'Login failed — try again.' }
  }
}

/** Gates the whole app behind Discord login and Vance Collective membership. Renders `children` as a
 * function so the authorized user (and a logout handler) can be shown in the app's own header. */
export function AuthGate({ children }: { children: (user: DiscordUser, logout: () => void) => ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: 'checking' })
  // Guards against React StrictMode's deliberate double-invoke of effects in dev: the check below
  // reads AND clears storage, so running it twice back to back isn't idempotent. A ref (unlike the
  // effect closure) survives the simulated remount, so the real logic only ever runs once per mount.
  const initedRef = useRef(false)

  const apply = useCallback((token: string, result: CheckResult, fresh: boolean) => {
    if ('error' in result) setState({ status: 'login', error: result.error })
    else if (result.ok) {
      if (fresh) track('signin')
      setState({ status: 'authorized', user: result.user })
    } else {
      if (fresh) track('denied')
      setState({ status: 'denied', user: result.user, token })
    }
  }, [])

  useEffect(() => {
    if (initedRef.current) return
    initedRef.current = true

    // No cancellation guard on purpose: `initedRef` already keeps this from running twice under
    // StrictMode, and AuthGate lives for the app's whole lifetime, so there's no real unmount to guard
    // against. (A `cancelled` flag in a cleanup poisoned the in-flight fetch under StrictMode before.)
    async function init() {
      const freshToken = consumeTokenFromRedirect()
      if (freshToken) return apply(freshToken, await checkToken(freshToken), true)

      // Signed in here before, or on Hello Glass / Patch Pixelizer
      const existing = loadSession()
      if (existing && (existing.member || onPaidList(existing.user))) {
        setState({ status: 'authorized', user: existing.user })
        return
      }
      if (existing) clearSession() // the paid list may have changed since they signed in

      // Signed in earlier in this tab but weren't a member yet (say they reloaded after joining): check again
      const pending = loadPendingToken()
      if (pending) return apply(pending, await checkToken(pending), false)

      setState({ status: 'login', error: null })
    }

    init()
  }, [apply])

  /** "I've joined, check again", or coming back to the tab. Resolves true once there's nothing left to wait for. */
  const recheck = useCallback(
    async (token: string) => {
      const result = await checkToken(token)
      if ('error' in result) {
        apply(token, result, false)
        return true
      }
      if (result.ok) {
        track('signin')
        apply(token, result, false)
        return true
      }
      return false
    },
    [apply],
  )

  function logout() {
    clearSession()
    setState({ status: 'login', error: null })
  }

  if (state.status === 'checking') return null
  if (state.status === 'login') return <LoginScreen error={state.error} />
  if (state.status === 'denied') {
    const token = state.token
    return <NotMemberScreen user={state.user} onRecheck={() => recheck(token)} onSwitchAccount={logout} />
  }
  return <>{children(state.user, logout)}</>
}

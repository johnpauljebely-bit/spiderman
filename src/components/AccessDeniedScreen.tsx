import { useEffect, useState } from 'react'
import { useSplashLifted } from './splash-context'
import type { DiscordUser } from '../lib/discordAuth'

const REDIRECT_SECONDS = 10

export function AccessDeniedScreen({ user, onExpire }: { user: DiscordUser; onExpire: () => void }) {
  const [secondsLeft, setSecondsLeft] = useState(REDIRECT_SECONDS)
  const splashLifted = useSplashLifted()

  useEffect(() => {
    if (!splashLifted) return
    if (secondsLeft <= 0) {
      onExpire()
      return
    }
    const timer = window.setTimeout(() => setSecondsLeft((s) => s - 1), 1000)
    return () => window.clearTimeout(timer)
  }, [secondsLeft, onExpire, splashLifted])

  return (
    <div className="flex min-h-screen items-center justify-center px-6 text-ink">
      <div className="surface w-full max-w-sm rounded-[20px] border-red-200 p-8 text-center">
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50">
          <svg viewBox="0 0 24 24" className="h-7 w-7 text-red-600" fill="none">
            <path
              d="M12 9v4m0 4h.01M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
        <h1 className="text-lg font-semibold tracking-tight text-red-700">Access denied</h1>
        <p className="mt-1.5 text-sm text-muted">
          Signed in as <span className="font-medium text-ink">{user.globalName ?? user.username}</span>, but this Discord account isn't
          on the allowed list.
        </p>
        <p className="mt-4 text-xs text-muted">
          Redirecting to sign-in in <span className="font-semibold text-red-700">{secondsLeft}</span>s…
        </p>
        <button
          type="button"
          onClick={onExpire}
          className="mt-5 w-full rounded-full border border-red-200 bg-red-50 py-2.5 text-sm font-medium text-red-700 transition-colors hover:bg-red-100"
        >
          Back to sign-in now
        </button>
      </div>
    </div>
  )
}

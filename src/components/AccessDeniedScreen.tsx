import clsx from 'clsx'
import { useEffect, useRef, useState } from 'react'
import { DiscordIcon } from './LoginScreen'
import { GUILD_INVITE, GUILD_NAME, type DiscordUser } from '../lib/discordAuth'
import { to } from '../lib/paths'

const Check = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden className={className}>
    <path d="M20 6 9 17l-5-5" />
  </svg>
)

/**
 * Signed in, but not in the Vance Collective server yet. Not a dead end: the one thing to do is join,
 * so that's the main button, and coming back to the tab checks again by itself.
 */
export function NotMemberScreen({
  user,
  onRecheck,
  onSwitchAccount,
}: {
  user: DiscordUser
  onRecheck: () => Promise<boolean>
  onSwitchAccount: () => void
}) {
  const [checking, setChecking] = useState(false)
  const [stillOut, setStillOut] = useState(false)
  const [joined, setJoined] = useState(false)
  const busy = useRef(false)
  const lastAuto = useRef(0)
  const name = user.globalName ?? user.username

  async function check(manual: boolean) {
    if (busy.current) return
    busy.current = true
    setChecking(true)
    const done = await onRecheck()
    busy.current = false
    if (!done) {
      setChecking(false)
      if (manual) setStillOut(true)
    }
  }

  // Back from Discord after joining: check without being asked (at most every few seconds)
  useEffect(() => {
    const auto = () => {
      if (document.visibilityState !== 'visible' || Date.now() - lastAuto.current < 3000) return
      lastAuto.current = Date.now()
      check(false)
    }
    document.addEventListener('visibilitychange', auto)
    window.addEventListener('focus', auto)
    return () => {
      document.removeEventListener('visibilitychange', auto)
      window.removeEventListener('focus', auto)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <section className="relative flex min-h-svh items-center justify-center px-6 py-16 text-ink">
      <a href={to('/')} className="app-nav-link absolute start-5 top-7 flex items-center gap-1.5">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden className="size-4">
          <path d="m15 18-6-6 6-6" />
        </svg>
        Home
      </a>

      <div className="w-full max-w-sm">
        <div className="surface mb-6 flex items-center gap-3 rounded-full py-1.5 ps-1.5 pe-4 text-sm">
          {user.avatarUrl ? (
            <img src={user.avatarUrl} alt="" className="size-8 rounded-full" />
          ) : (
            <span aria-hidden className="size-8 rounded-full bg-panel-strong" />
          )}
          <span className="min-w-0 flex-1 truncate text-muted">
            Signed in as <span className="font-medium text-ink">{name}</span>
          </span>
          <button type="button" onClick={onSwitchAccount} className="shrink-0 text-xs text-muted underline underline-offset-2 hover:text-ink">
            Not you?
          </button>
        </div>

        <h1 className="font-display text-[clamp(2rem,4vw,2.6rem)] leading-[1.08] tracking-[-0.005em]">One step left: join the server.</h1>
        <p className="mt-2 text-sm text-muted">
          Move is free for everyone in <span className="text-ink">{GUILD_NAME}</span>, and this account isn&apos;t in it yet. Joining takes a few
          seconds.
        </p>

        <ol className="mt-6 space-y-3 text-sm">
          <li className="flex items-center gap-3">
            <span className="grid size-6 shrink-0 place-items-center rounded-full bg-ink text-black">
              <Check className="size-3.5" />
            </span>
            <span className="text-muted">
              <span className="text-ink">Signed in</span> with Discord
            </span>
          </li>
          <li className="flex items-center gap-3">
            <span className={clsx('grid size-6 shrink-0 place-items-center rounded-full text-xs', joined ? 'bg-ink text-black' : 'surface')}>
              {joined ? <Check className="size-3.5" /> : 2}
            </span>
            <span className="text-muted">
              <span className="text-ink">Join {GUILD_NAME}</span> in Discord
            </span>
          </li>
          <li className="flex items-center gap-3">
            <span className="surface grid size-6 shrink-0 place-items-center rounded-full text-xs">3</span>
            <span className="text-muted">
              <span className="text-ink">Come back here.</span> We&apos;ll check again on our own
            </span>
          </li>
        </ol>

        {stillOut && (
          <p className="mt-5 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300" role="alert">
            Still not showing as a member. If you just joined, give it a few seconds and try again.
          </p>
        )}

        <div className="mt-6 grid gap-2.5">
          <a
            href={GUILD_INVITE}
            target="_blank"
            rel="noreferrer"
            onClick={() => setJoined(true)}
            className="btn btn-primary flex h-11 w-full items-center justify-center gap-2 rounded-full text-sm font-medium"
          >
            <DiscordIcon className="size-4" />
            Join {GUILD_NAME}
          </a>
          <button
            type="button"
            onClick={() => check(true)}
            disabled={checking}
            className={clsx('btn flex h-11 w-full items-center justify-center gap-2 rounded-full text-sm font-medium', checking && 'opacity-60')}
          >
            {checking ? 'Checking with Discord…' : 'I’ve joined, check again'}
          </button>
          <span role="status" className="sr-only">
            {checking ? 'Checking with Discord' : stillOut ? 'Not a member yet' : ''}
          </span>
        </div>

        <p className="mt-6 text-xs text-muted">Paid for Move before? You&apos;re still in: sign in with that Discord account.</p>
      </div>
    </section>
  )
}

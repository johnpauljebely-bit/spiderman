import { getDiscordAuthorizeUrl } from '../lib/discordAuth'

const DISCORD_MARK = (
  <svg viewBox="0 0 127.14 96.36" className="h-5 w-5" fill="currentColor" aria-hidden>
    <path d="M107.7,8.07A105.15,105.15,0,0,0,81.47,0a72.06,72.06,0,0,0-3.36,6.83A97.68,97.68,0,0,0,49,6.83,72.37,72.37,0,0,0,45.64,0,105.89,105.89,0,0,0,19.39,8.09C2.79,32.65-1.71,56.6.54,80.21h0A105.73,105.73,0,0,0,32.71,96.36,77.7,77.7,0,0,0,39.6,85.25a68.42,68.42,0,0,1-10.85-5.18c.91-.66,1.8-1.34,2.66-2a75.57,75.57,0,0,0,64.32,0c.87.71,1.76,1.39,2.66,2a68.68,68.68,0,0,1-10.87,5.19,77,77,0,0,0,6.89,11.1A105.25,105.25,0,0,0,126.6,80.22h0C129.24,52.84,122.09,29.11,107.7,8.07ZM42.45,65.69C36.18,65.69,31,60,31,53s5-12.74,11.43-12.74S54,46,53.89,53,48.84,65.69,42.45,65.69Zm42.24,0C78.41,65.69,73.25,60,73.25,53s5-12.74,11.44-12.74S96.23,46,96.12,53,91.08,65.69,84.69,65.69Z" />
  </svg>
)

/** A simple sparkle mark — the generic "auto-generate" glyph, standing in for the app's own trace
 * → animate pipeline without trying to be a literal illustration of it. */
const APP_MARK = (
  <svg viewBox="0 0 24 24" className="h-7 w-7 text-white" fill="currentColor" aria-hidden>
    <path d="M11 2.5c.6 3.6 1.4 5.9 2.6 7.1 1.2 1.2 3.5 2 7.1 2.6-3.6.6-5.9 1.4-7.1 2.6-1.2 1.2-2 3.5-2.6 7.1-.6-3.6-1.4-5.9-2.6-7.1-1.2-1.2-3.5-2-7.1-2.6 3.6-.6 5.9-1.4 7.1-2.6C9.6 8.4 10.4 6.1 11 2.5Z" />
    <path d="M18.5 1c.3 1.7.7 2.8 1.3 3.4.6.6 1.7 1 3.4 1.3-1.7.3-2.8.7-3.4 1.3-.6.6-1 1.7-1.3 3.4-.3-1.7-.7-2.8-1.3-3.4-.6-.6-1.7-1-3.4-1.3 1.7-.3 2.8-.7 3.4-1.3.6-.6 1-1.7 1.3-3.4Z" opacity={0.55} />
  </svg>
)

export function LoginScreen({ error }: { error: string | null }) {
  return (
    <div className="flex min-h-screen items-center justify-center px-6 text-ink">
      <div className="glass w-full max-w-sm rounded-2xl p-8 text-center">
        <div className="glass-raised mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl">{APP_MARK}</div>
        <h1 className="text-lg font-semibold tracking-tight">Logo Animator</h1>
        <p className="mt-1.5 text-sm text-muted">Sign in with Discord to keep going. You'll stay signed in for 5 days.</p>

        {error && <p className="mt-4 rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-300">{error}</p>}

        <a
          href={getDiscordAuthorizeUrl()}
          className="liquid-btn liquid-btn-accent mt-6 flex w-full items-center justify-center gap-2.5 rounded-full py-3 text-sm font-semibold text-white"
        >
          {DISCORD_MARK}
          Continue with Discord
        </a>
      </div>
    </div>
  )
}

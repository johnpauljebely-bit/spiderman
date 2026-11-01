import clsx from 'clsx'
import { motion, useReducedMotion } from 'motion/react'
import { useEffect, useState, type CSSProperties, type SVGProps } from 'react'
import { getDiscordAuthorizeUrl } from '../lib/discordAuth'
import { useSplashLifted } from './splash-context'

// Layout and motion follow the "Login 3" block from Hirael (MIT, Mohammad Shehadeh): a split screen with
// drifting line art on one side and a single sign-in button on the other. Rebuilt on plain Tailwind
// (no shadcn / Radix) and re-skinned to the app's white-and-black look, with Discord instead of GitHub.

const DiscordIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 127.14 96.36" fill="currentColor" aria-hidden {...props}>
    <path d="M107.7,8.07A105.15,105.15,0,0,0,81.47,0a72.06,72.06,0,0,0-3.36,6.83A97.68,97.68,0,0,0,49,6.83,72.37,72.37,0,0,0,45.64,0,105.89,105.89,0,0,0,19.39,8.09C2.79,32.65-1.71,56.6.54,80.21h0A105.73,105.73,0,0,0,32.71,96.36,77.7,77.7,0,0,0,39.6,85.25a68.42,68.42,0,0,1-10.85-5.18c.91-.66,1.8-1.34,2.66-2a75.57,75.57,0,0,0,64.32,0c.87.71,1.76,1.39,2.66,2a68.68,68.68,0,0,1-10.87,5.19,77,77,0,0,0,6.89,11.1A105.25,105.25,0,0,0,126.6,80.22h0C129.24,52.84,122.09,29.11,107.7,8.07ZM42.45,65.69C36.18,65.69,31,60,31,53s5-12.74,11.43-12.74S54,46,53.89,53,48.84,65.69,42.45,65.69Zm42.24,0C78.41,65.69,73.25,60,73.25,53s5-12.74,11.44-12.74S96.23,46,96.12,53,91.08,65.69,84.69,65.69Z" />
  </svg>
)

const Spinner = (props: SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden {...props}>
    <path d="M21 12a9 9 0 1 1-6.22-8.56" />
  </svg>
)

const BackArrow = (props: SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden {...props}>
    <path d="m15 18-6-6 6-6" />
  </svg>
)

const BrandMark = ({ className }: { className?: string }) => (
  <img src="/move-logo.svg" alt="" draggable={false} className={clsx('select-none invert', className)} />
)

/** Staggered entrance; held until the splash screen has lifted so people actually see it. */
const enter = (index: number, lifted: boolean): CSSProperties => ({
  animationDelay: `${index * 60}ms`,
  animationPlayState: lifted ? 'running' : 'paused',
})

const jitter = (i: number) => {
  const value = Math.sin(i + 1) * 10_000
  return value - Math.floor(value)
}

const FloatingPaths = ({ position }: { position: number }) => {
  const reduceMotion = useReducedMotion()
  const paths = Array.from({ length: 36 }, (_, i) => ({
    id: i,
    d: `M-${380 - i * 5 * position} -${189 + i * 6}C-${380 - i * 5 * position} -${189 + i * 6} -${312 - i * 5 * position} ${216 - i * 6} ${152 - i * 5 * position} ${343 - i * 6}C${616 - i * 5 * position} ${470 - i * 6} ${684 - i * 5 * position} ${875 - i * 6} ${684 - i * 5 * position} ${875 - i * 6}`,
    width: 0.5 + i * 0.03,
  }))

  return (
    <div className="pointer-events-none absolute inset-0">
      <svg className="h-full w-full text-ink" fill="none" viewBox="0 0 696 316">
        {paths.map((path) => (
          <motion.path
            key={path.id}
            d={path.d}
            initial={{ pathLength: 0.3 }}
            animate={reduceMotion ? undefined : { pathLength: 1, pathOffset: [0, 1, 0] }}
            stroke="currentColor"
            className="opacity-60"
            strokeOpacity={0.1 + path.id * 0.03}
            strokeWidth={path.width}
            transition={{ duration: 20 + jitter(path.id) * 10, repeat: Number.POSITIVE_INFINITY, ease: 'linear' }}
          />
        ))}
      </svg>
    </div>
  )
}

export function LoginScreen({ error }: { error: string | null }) {
  const [redirecting, setRedirecting] = useState(false)
  const lifted = useSplashLifted()

  // Coming back with the browser's Back button restores this page as it was — don't leave it stuck on "Redirecting".
  useEffect(() => {
    const reset = () => setRedirecting(false)
    window.addEventListener('pageshow', reset)
    return () => window.removeEventListener('pageshow', reset)
  }, [])

  return (
    <section className="relative min-h-svh overflow-hidden bg-white text-ink lg:grid lg:grid-cols-2">
      <aside className="relative hidden h-full flex-col overflow-hidden border-e border-panel-border bg-white p-10 lg:flex">
        <div aria-hidden className="absolute inset-0" style={{ background: 'linear-gradient(to bottom, transparent, transparent, #fff)' }} />
        <div className="absolute inset-0">
          <FloatingPaths position={1} />
          <FloatingPaths position={-1} />
        </div>

        <div className="enter relative z-10 flex items-center" style={enter(0, lifted)}>
          <BrandMark className="h-5 w-auto" />
        </div>

        <figure className="enter relative z-10 mt-auto flex flex-col gap-3" style={enter(4, lifted)}>
          <p className="max-w-md text-[clamp(1.75rem,2.6vw,2.4rem)] font-semibold leading-[1.1] tracking-[-0.04em]">
            Trace it. Tune it.
            <br />
            Export a loop.
          </p>
          <figcaption className="text-xs uppercase tracking-wide text-faint">Logo animator</figcaption>
        </figure>
      </aside>

      <div className="relative flex min-h-svh flex-col justify-center px-8 lg:min-h-0">
        <div aria-hidden className="pointer-events-none absolute inset-0 z-0 opacity-60">
          <div
            className="absolute end-0 top-0 h-[80rem] w-[35rem] -translate-y-[22rem] rounded-full"
            style={{ background: 'radial-gradient(68.54% 68.72% at 55.02% 31.46%, rgb(12 12 13 / 0.06) 0, rgb(12 12 13 / 0.02) 50%, rgb(12 12 13 / 0.01) 80%)' }}
          />
          <div
            className="absolute end-0 top-0 h-[80rem] w-[15rem] translate-x-[5%] -translate-y-1/2 rounded-full"
            style={{ background: 'radial-gradient(50% 50% at 50% 50%, rgb(12 12 13 / 0.04) 0, rgb(12 12 13 / 0.01) 80%, transparent 100%)' }}
          />
        </div>

        <a href="/" className="enter app-nav-link absolute start-5 top-7 z-10 flex items-center gap-1.5" style={enter(0, lifted)}>
          <BackArrow className="size-4" />
          Home
        </a>

        <div className="relative z-10 mx-auto w-full space-y-6 sm:max-w-sm">
          <div className="enter flex items-center lg:hidden" style={enter(0, lifted)}>
            <BrandMark className="h-5 w-auto" />
          </div>

          <div className="flex flex-col gap-2">
            <h1 style={enter(1, lifted)} className="enter text-[clamp(2.25rem,4vw,3rem)] font-semibold leading-none tracking-[-0.05em]">
              Sign in to Move.
            </h1>
            <p style={enter(2, lifted)} className="enter text-sm text-muted">
              One click with Discord. You&apos;ll stay signed in for 5 days.
            </p>
          </div>

          {error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700" role="alert">
              {error}
            </p>
          )}

          <div style={enter(3, lifted)} className="enter">
            <a
              href={getDiscordAuthorizeUrl()}
              onClick={() => setRedirecting(true)}
              aria-disabled={redirecting}
              className={clsx(
                'btn btn-primary flex h-11 w-full items-center justify-center gap-2 rounded-full text-sm font-semibold text-white',
                redirecting && 'pointer-events-none opacity-60',
              )}
            >
              {redirecting ? <Spinner className="size-4 animate-spin" /> : <DiscordIcon className="size-4" />}
              {redirecting ? 'Redirecting to Discord…' : 'Continue with Discord'}
            </a>
            <span role="status" className="sr-only">
              {redirecting ? 'Redirecting to Discord' : ''}
            </span>
          </div>

          <p style={enter(4, lifted)} className="enter text-xs text-faint">
            Access is limited to approved Discord accounts.
          </p>
        </div>
      </div>
    </section>
  )
}

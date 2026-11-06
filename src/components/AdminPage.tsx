import clsx from 'clsx'
import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { to } from '../lib/paths'

// /admin: Move's analytics, behind one password (api/admin.mjs). Nothing here is linked from the public pages.

interface Day {
  day: string
  visitors: number
  [event: string]: number | string
}
interface Stats {
  days: number
  daily: Day[]
  visitors: number
  totals: Record<string, number>
  countries: Record<string, number>
  devices: Record<string, number>
  referrers: Record<string, number>
}

type State =
  | { kind: 'loading' }
  | { kind: 'login' }
  | { kind: 'setup' }
  | { kind: 'error'; message: string }
  | { kind: 'ready'; stats: Stats }

const num = (v: unknown) => (typeof v === 'number' ? v : 0)
const fmt = (v: number) => v.toLocaleString()

async function load(days: number): Promise<State> {
  // While developing, /admin?demo shows made-up numbers, handy for checking the layout.
  if (import.meta.env.DEV && new URLSearchParams(location.search).has('demo')) return { kind: 'ready', stats: demo(days) }
  const res = await fetch(`/api/admin?days=${days}`, { cache: 'no-store' })
  if (res.status === 401) return { kind: 'login' }
  const body = await res.json().catch(() => ({}))
  if (res.status === 503 && body.error === 'storage') return { kind: 'setup' }
  if (!res.ok) return { kind: 'error', message: body.error ?? `Something went wrong (${res.status}).` }
  return { kind: 'ready', stats: body }
}

export function AdminPage() {
  const [state, setState] = useState<State>({ kind: 'loading' })
  const [days, setDays] = useState(30)

  useEffect(() => {
    document.title = 'Move Admin'
    const robots = document.createElement('meta')
    robots.name = 'robots'
    robots.content = 'noindex, nofollow'
    document.head.appendChild(robots)
    return () => robots.remove()
  }, [])

  const refresh = (d = days) => void load(d).then(setState, (e: Error) => setState({ kind: 'error', message: e.message }))
  useEffect(() => {
    void load(30).then(setState, (e: Error) => setState({ kind: 'error', message: e.message }))
  }, [])

  if (state.kind === 'loading') {
    return (
      <main className="grid min-h-screen place-items-center text-sm text-muted">
        <p>Loading…</p>
      </main>
    )
  }
  if (state.kind === 'login') return <Login onDone={() => refresh()} />

  async function signOut() {
    await fetch('/api/admin?do=logout', { method: 'POST' })
    setState({ kind: 'login' })
  }

  return (
    <main className="mx-auto max-w-5xl px-4 pb-24 pt-6 sm:px-8">
      <header className="flex flex-wrap items-center gap-3 pb-8">
        <a href={to('/')} aria-label="Move home" className="grid h-10 w-10 shrink-0 place-items-center">
          <img src={to('/move-logo.svg')} alt="" className="h-5 w-auto select-none" draggable={false} />
        </a>
        <span className="font-display text-[17px]">Admin</span>
        <div className="ml-auto flex items-center gap-3">
          <div className="app-nav-pill" role="group" aria-label="Time range">
            {[7, 30, 90].map((d) => (
              <button
                key={d}
                type="button"
                aria-pressed={d === days}
                onClick={() => {
                  setDays(d)
                  refresh(d)
                }}
                className={clsx('app-nav-link', d === days && 'bg-white/12 text-ink')}
              >
                {d} days
              </button>
            ))}
          </div>
          <button type="button" onClick={() => void signOut()} className="btn rounded-full px-4 py-2 text-sm">
            Sign out
          </button>
        </div>
      </header>

      {state.kind === 'setup' ? <Setup /> : state.kind === 'error' ? <p className="text-sm text-red-400">{state.message}</p> : <Dashboard s={state.stats} />}
    </main>
  )
}

function Login({ onDone }: { onDone: () => void }) {
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setMessage('')
    const res = await fetch('/api/admin?do=login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    })
    const body = await res.json().catch(() => ({}))
    setBusy(false)
    if (res.ok) onDone()
    else setMessage(body.error ?? "Couldn't sign in.")
  }

  return (
    <main className="grid min-h-screen place-items-center px-4">
      <form onSubmit={(e) => void submit(e)} className="surface w-full max-w-sm rounded-md p-7">
        <img src={to('/move-logo.svg')} alt="Move" className="h-5 w-auto select-none" draggable={false} />
        <h1 className="font-display mt-6 text-[26px]">Admin</h1>
        <label htmlFor="pw" className="label mt-6 block">
          Password
        </label>
        <input
          id="pw"
          type="password"
          autoComplete="current-password"
          autoFocus
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="surface-inset mt-2 w-full rounded-md px-3 py-2.5 text-sm text-ink outline-none focus:border-faint"
        />
        <button type="submit" disabled={busy || !password} className="btn btn-primary mt-5 w-full rounded-full px-4 py-2.5 text-sm font-medium disabled:opacity-50">
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
        {message && (
          <p role="alert" className="mt-4 text-sm text-red-400">
            {message}
          </p>
        )}
      </form>
    </main>
  )
}

function Setup() {
  return (
    <section className="surface rounded-md p-6">
      <h2 className="font-display text-[22px]">Connect analytics storage</h2>
      <p className="mt-2 max-w-xl text-[15px] leading-relaxed text-muted">You&rsquo;re signed in, but there&rsquo;s nowhere to keep the numbers yet.</p>
      <ol className="mt-4 ml-5 max-w-xl list-decimal space-y-2 text-[15px] leading-relaxed text-muted">
        <li>
          Deploy the stats service in <code className="text-ink">stats/</code> to Google Cloud Run (it keeps the numbers in Firestore&rsquo;s free tier).
        </li>
        <li>
          Set <strong className="font-medium text-ink">STATS_URL</strong> and <strong className="font-medium text-ink">STATS_SECRET</strong> in Vercel to its address and the secret it was started with, then redeploy.
        </li>
      </ol>
    </section>
  )
}

const FUNNEL: [string, string][] = [
  ['view', 'Visits'],
  ['app', 'Opened the tool'],
  ['signin', 'Signed in'],
  ['upload', 'Added a logo'],
  ['export', 'Exported a GIF'],
]
const LOOKS: [string, string][] = [
  ['look_clean', 'Clean'],
  ['look_sketchy', 'Hand-drawn'],
  ['look_snappy', 'Snappy'],
  ['look_cinematic', 'Cinematic'],
  ['look_surface', 'Glass fill'],
]
const PAGES: [string, string][] = [
  ['landing', 'Home'],
  ['docs', 'Docs'],
  ['legal', 'Legal'],
  ['app', 'The tool'],
]

function Dashboard({ s }: { s: Stats }) {
  const t = (k: string) => num(s.totals[k])
  const uploads = t('upload_svg') + t('upload_image')
  const counts: Record<string, number> = { ...s.totals, upload: uploads }
  const regions = typeof Intl.DisplayNames === 'function' ? new Intl.DisplayNames(['en'], { type: 'region' }) : null
  const country = (code: string) => {
    if (code === '??') return 'Unknown'
    try {
      return regions?.of(code) ?? code
    } catch {
      return code
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Visitors" value={s.visitors} note="Added up day by day" />
        <Stat label="Visits" value={t('view')} />
        <Stat label="Signed in" value={t('signin')} note={t('denied') ? `${fmt(t('denied'))} turned away` : undefined} />
        <Stat label="GIFs exported" value={t('export')} />
      </div>

      <Card title="Visitors per day">
        <Bars daily={s.daily} />
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        <Card title="From visit to GIF">
          <Rows rows={FUNNEL.map(([k, label]) => [label, num(counts[k])])} of={Math.max(1, num(counts.view))} percent />
        </Card>
        <Card title="Pages opened">
          <Rows rows={PAGES.map(([k, label]) => [label, t(k)])} />
        </Card>
        <Card title="Looks picked">
          <Rows rows={LOOKS.map(([k, label]) => [label, t(k)])} />
        </Card>
        <Card title="Logo files">
          <Rows
            rows={[
              ['SVG', t('upload_svg')],
              ['PNG or JPG', t('upload_image')],
            ]}
          />
        </Card>
        <Card title="Countries">
          <Rows rows={top(s.countries, 8).map(([k, v]) => [country(k), v])} empty="No visits yet." />
        </Card>
        <Card title="Devices">
          <Rows rows={top(s.devices, 4).map(([k, v]) => [k.charAt(0).toUpperCase() + k.slice(1), v])} empty="No visits yet." />
        </Card>
      </div>

      <Card title="Where visitors came from">
        <Rows rows={top(s.referrers, 8)} empty="No referring sites yet. Most visits arrive by typing the address or from an app." />
      </Card>
    </div>
  )
}

const top = (obj: Record<string, number>, n: number): [string, number][] => Object.entries(obj).sort((a, b) => b[1] - a[1]).slice(0, n)

function Stat({ label, value, note }: { label: string; value: number; note?: string }) {
  return (
    <div className="surface rounded-md p-4">
      <p className="label">{label}</p>
      <p className="font-display mt-2 text-[34px] leading-none">{fmt(value)}</p>
      {note && <p className="mt-2 text-xs text-faint">{note}</p>}
    </div>
  )
}

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="surface rounded-md p-5">
      <h2 className="font-display mb-4 text-[18px]">{title}</h2>
      {children}
    </section>
  )
}

function Rows({ rows, of, percent, empty = 'Nothing yet.' }: { rows: [string, number][]; of?: number; percent?: boolean; empty?: string }) {
  const max = of ?? Math.max(1, ...rows.map((r) => r[1]))
  if (!rows.length || rows.every((r) => r[1] === 0)) return <p className="text-sm text-muted">{empty}</p>
  return (
    <ul className="space-y-3">
      {rows.map(([label, value]) => (
        <li key={label}>
          <div className="flex items-baseline justify-between text-sm">
            <span className="text-ink">{label}</span>
            <span className="tabular-nums text-muted">
              {fmt(value)}
              {percent && <span className="ml-2 text-faint">{Math.round((value / max) * 100)}%</span>}
            </span>
          </div>
          <div className="mt-1.5 h-1 rounded-full bg-white/10">
            <div className="h-full rounded-full bg-ink" style={{ width: `${Math.min(100, (value / max) * 100)}%` }} />
          </div>
        </li>
      ))}
    </ul>
  )
}

function Bars({ daily }: { daily: Day[] }) {
  const max = Math.max(1, ...daily.map((d) => d.visitors))
  const label = (day: string) => new Date(`${day}T12:00:00Z`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  return (
    <div>
      <div className="flex h-36 items-end gap-[3px]" role="img" aria-label={`Visitors per day, most in one day: ${max}`}>
        {daily.map((d) => (
          <div key={d.day} className="group relative flex h-full flex-1 items-end" title={`${label(d.day)}: ${d.visitors}`}>
            <div className="w-full rounded-t-sm bg-ink/80 transition-colors group-hover:bg-ink" style={{ height: `${Math.max(d.visitors ? 3 : 1, (d.visitors / max) * 100)}%`, opacity: d.visitors ? 1 : 0.2 }} />
          </div>
        ))}
      </div>
      <div className="mt-2 flex justify-between text-[11px] text-faint">
        <span>{label(daily[0].day)}</span>
        <span>Busiest day: {fmt(max)}</span>
        <span>{label(daily[daily.length - 1].day)}</span>
      </div>
    </div>
  )
}

/** Made-up numbers for /admin?demo while developing. */
function demo(days: number): Stats {
  let seed = 7
  const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647
  const daily: Day[] = []
  const totals: Record<string, number> = {}
  let visitors = 0
  for (let i = days - 1; i >= 0; i--) {
    const day = new Date(Date.now() - i * 864e5).toISOString().slice(0, 10)
    const v = Math.round(8 + rand() * 40 + (days - i) * 0.4)
    const row: Day = { day, visitors: v, view: v + Math.round(rand() * 6), landing: v, docs: Math.round(v * 0.3), legal: Math.round(v * 0.05), app: Math.round(v * 0.55), signin: Math.round(v * 0.3), denied: Math.round(v * 0.06), upload_svg: Math.round(v * 0.12), upload_image: Math.round(v * 0.2), export: Math.round(v * 0.18), look_clean: Math.round(v * 0.2), look_sketchy: Math.round(v * 0.08), look_snappy: Math.round(v * 0.06), look_cinematic: Math.round(v * 0.1), look_surface: Math.round(v * 0.05) }
    daily.push(row)
    visitors += v
    for (const [k, val] of Object.entries(row)) if (typeof val === 'number' && k !== 'visitors') totals[k] = (totals[k] ?? 0) + val
  }
  return { days, daily, visitors, totals, countries: { US: 410, CA: 180, GB: 96, DE: 40, '??': 12 }, devices: { computer: 520, phone: 190, tablet: 28 }, referrers: { 'discord.com': 140, 'youtube.com': 64, 'google.com': 22 } }
}

// Move's own privacy-friendly analytics. No cookies for visitors, no IP addresses stored: only daily counts,
// the country and device type, the referring site, and a visitor hash that changes every day (so nobody can
// be followed from one day to the next).
//
// Where the numbers live:
//   • on Vercel: Firestore (Google Cloud's free tier), behind a tiny service, move-stats (stats/), reached
//     with STATS_URL + STATS_SECRET;
//   • while developing: a JSON file (server/localStore.mjs), so the dashboard works without any setup.
import { createHash, createHmac, timingSafeEqual } from 'node:crypto'
import { localCall } from './localStore.mjs'

const REMOTE = (process.env.STATS_URL ?? '').replace(/\/$/, '')
const SECRET = process.env.STATS_SECRET ?? ''
const remote = () => !!(REMOTE && SECRET)
const local = () => !remote() && !process.env.VERCEL && process.env.NODE_ENV !== 'production'
export const storageReady = () => remote() || local()

/** Events the site may send (anything else is ignored). */
export const EVENTS = [
  'view', // a visit to the site (once per browser session)
  'landing', // opened the home page
  'docs', // opened the docs
  'legal', // opened the legal page
  'app', // opened the tool (before or after signing in)
  'signin', // signed in with Discord and was let in
  'denied', // signed in but wasn't on the list
  'upload_svg', // picked an SVG logo
  'upload_image', // picked a PNG/JPG logo
  'export', // exported a GIF
  'look_clean', // picked a look
  'look_sketchy',
  'look_snappy',
  'look_cinematic',
  'look_surface',
]

/** Talks to whichever store is in use. */
async function call(path, body, days) {
  if (local()) return localCall(path, body, days)
  if (!remote()) return null
  const res = await fetch(`${REMOTE}${path}${days ? `?days=${days}` : ''}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { 'x-move-key': SECRET, 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(15_000),
  })
  if (!res.ok) throw new Error(`Analytics store answered ${res.status}`)
  return res.status === 204 ? null : res.json()
}

export const today = (d = new Date()) => d.toISOString().slice(0, 10)

const BOT = /bot|crawl|spider|slurp|preview|facebookexternalhit|embedly|headless|lighthouse|monitor/i

/** What we note about a visitor: country and device from the request, nothing else kept. */
function visitor(request) {
  const h = request.headers
  const ua = h.get('user-agent') ?? ''
  const ip = (h.get('x-forwarded-for') ?? '').split(',')[0].trim()
  const day = today()
  const salt = process.env.ANALYTICS_SALT ?? process.env.ADMIN_PASSWORD ?? 'move'
  return {
    // Headless Chrome is skipped like any other bot, except while developing (that's how the pages get tested).
    bot: (BOT.test(ua) && !(local() && /headless/i.test(ua))) || !ua,
    day,
    // A daily-rotating hash: counts unique visitors per day, can't be reversed or linked across days.
    id: createHash('sha256').update(`${salt}|${day}|${ip}|${ua}`).digest('hex').slice(0, 24),
    country: (h.get('x-vercel-ip-country') ?? '').toUpperCase().slice(0, 2) || '??',
    device: /iPad|Tablet/i.test(ua) ? 'tablet' : /Mobi|iPhone|Android/i.test(ua) ? 'phone' : 'computer',
  }
}

/** Counts one event. Never throws (analytics must not break the site). */
export async function track(request, name, extra = {}) {
  try {
    if (!storageReady() || !EVENTS.includes(name)) return
    const v = visitor(request)
    if (v.bot) return
    await call('/event', {
      day: v.day,
      name,
      visitor: name === 'view' ? { id: v.id, country: v.country, device: v.device, ref: cleanReferrer(extra.ref) ?? undefined } : undefined,
    })
  } catch {
    // ignore
  }
}

/** Only the referring site's name (e.g. "instagram.com"), never the full address. */
function cleanReferrer(ref) {
  try {
    const host = new URL(String(ref)).hostname.replace(/^www\./, '').toLowerCase()
    if (!host || /vercel\.app$|localhost$/.test(host)) return null
    return host.slice(0, 60)
  } catch {
    return null
  }
}

/** Everything the admin page shows, for the last `days` days. */
export const stats = (days = 30) => call('/stats', undefined, days)

// ---------- the admin password ----------

const sha = (s) => createHash('sha256').update(s).digest()
/** Signing key changes with the password, so changing it signs everyone out. */
const key = () => sha(`move-admin|${process.env.ADMIN_PASSWORD ?? ''}`)
export const adminReady = () => (process.env.ADMIN_PASSWORD ?? '').length >= 8

export function passwordMatches(given) {
  if (!adminReady()) return false
  return timingSafeEqual(sha(String(given ?? '')), sha(process.env.ADMIN_PASSWORD))
}

const WEEK = 7 * 24 * 3600
// "Secure" cookies are dropped on plain-http localhost by some browsers, so it is only set on Vercel.
const secure = () => (process.env.VERCEL ? '; Secure' : '')
export function sessionCookie() {
  const exp = Math.floor(Date.now() / 1000) + WEEK
  const sig = createHmac('sha256', key()).update(String(exp)).digest('base64url')
  return `mv_admin=${exp}.${sig}; Path=/; Max-Age=${WEEK}; HttpOnly${secure()}; SameSite=Strict`
}
export const clearCookie = () => `mv_admin=; Path=/; Max-Age=0; HttpOnly${secure()}; SameSite=Strict`

export function signedIn(request) {
  if (!adminReady()) return false
  const m = /(?:^|;\s*)mv_admin=(\d+)\.([\w-]+)/.exec(request.headers.get('cookie') ?? '')
  if (!m || Number(m[1]) < Date.now() / 1000) return false
  const want = createHmac('sha256', key()).update(m[1]).digest()
  const got = Buffer.from(m[2], 'base64url')
  return got.length === want.length && timingSafeEqual(got, want)
}

/** At most 8 sign-in attempts per 15 minutes from one place (counted by the store). */
export async function loginAllowed(request) {
  const ip = (request.headers.get('x-forwarded-for') ?? '').split(',')[0].trim()
  const who = createHash('sha256').update(`login|${ip}`).digest('hex').slice(0, 24)
  const r = await call('/login', { who }).catch(() => null)
  return !r || r.allowed
}

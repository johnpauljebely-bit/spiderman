// A stand-in for the stats service (stats/) while developing: same questions, same answers, kept in a JSON file
// (.analytics/dev.json, ignored by git). Never used on Vercel.
import fs from 'node:fs'
import path from 'node:path'

const FILE = path.join(process.cwd(), '.analytics', 'dev.json')
const DAY = /^\d{4}-\d{2}-\d{2}$/
const clean = (s, n) => String(s ?? '').slice(0, n)

function read() {
  try {
    return JSON.parse(fs.readFileSync(FILE, 'utf8'))
  } catch {
    return { days: {}, logins: {} }
  }
}
function write(db) {
  fs.mkdirSync(path.dirname(FILE), { recursive: true })
  fs.writeFileSync(FILE, JSON.stringify(db))
}
const bump = (obj, key, by = 1) => {
  obj[key] = (obj[key] ?? 0) + by
}

function event({ day, name, visitor }) {
  if (!DAY.test(day) || !/^[a-z_]{1,20}$/.test(name)) return
  const db = read()
  const d = (db.days[day] ??= { counts: {}, countries: {}, devices: {}, referrers: {}, visitors: [] })
  bump(d.counts, name)
  if (visitor) {
    const { id, country, device, ref } = visitor
    if (/^[0-9a-f]{8,64}$/.test(id ?? '') && !d.visitors.includes(id)) d.visitors.push(id)
    bump(d.countries, clean(country, 2) || '??')
    bump(d.devices, clean(device, 10) || 'unknown')
    if (ref) bump(d.referrers, clean(ref, 60))
  }
  write(db)
}

function stats(days) {
  const db = read()
  const dates = []
  for (let i = days - 1; i >= 0; i--) dates.push(new Date(Date.now() - i * 864e5).toISOString().slice(0, 10))
  const countries = {}
  const devices = {}
  const referrers = {}
  const totals = {}
  const add = (into, from) => {
    for (const [k, v] of Object.entries(from ?? {})) into[k] = (into[k] ?? 0) + v
  }
  const daily = dates.map((day) => {
    const d = db.days[day]
    add(countries, d?.countries)
    add(devices, d?.devices)
    add(referrers, d?.referrers)
    add(totals, d?.counts)
    return { day, visitors: d?.visitors.length ?? 0, ...(d?.counts ?? {}) }
  })
  return { days, daily, visitors: daily.reduce((a, d) => a + d.visitors, 0), totals, countries, devices, referrers }
}

function login({ who }) {
  if (!/^[0-9a-f]{8,64}$/.test(who ?? '')) return { allowed: false }
  const db = read()
  const now = Date.now()
  const cur = db.logins[who]
  const fresh = !cur || now - cur.since > 15 * 60 * 1000
  const count = fresh ? 1 : cur.count + 1
  db.logins[who] = { since: fresh ? now : cur.since, count }
  write(db)
  return { allowed: count <= 8 }
}

/** Same paths as the stats service: POST /event, POST /login, GET /stats?days=. */
export function localCall(pathname, body, days) {
  if (pathname === '/event') return (event(body), null)
  if (pathname === '/login') return login(body)
  if (pathname === '/stats') return stats(days)
  throw new Error('Unknown analytics path')
}

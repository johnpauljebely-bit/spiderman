// Counts site events for Move's own analytics (api/event.mjs). No cookies, nothing personal: just the event's
// name (and, for a visit, which site sent you).
type Event =
  | 'view'
  | 'landing'
  | 'docs'
  | 'legal'
  | 'app'
  | 'signin'
  | 'denied'
  | 'upload_svg'
  | 'upload_image'
  | 'export'
  | 'look_clean'
  | 'look_sketchy'
  | 'look_snappy'
  | 'look_cinematic'
  | 'look_surface'

export function track(n: Event) {
  try {
    const body = JSON.stringify(n === 'view' ? { n, r: document.referrer } : { n })
    if (!navigator.sendBeacon?.('/api/event', new Blob([body], { type: 'application/json' }))) {
      void fetch('/api/event', { method: 'POST', body, keepalive: true, headers: { 'Content-Type': 'application/json' } }).catch(() => undefined)
    }
  } catch {
    // never let counting break the site
  }
}

/** Once per page load: a visit (the first page of a browser session) and which page it was. */
export function trackPage(pathname: string) {
  try {
    if (/^\/admin(\/|$)/.test(pathname)) return
    if (!sessionStorage.getItem('move-seen')) {
      sessionStorage.setItem('move-seen', '1')
      track('view')
    }
  } catch {
    track('view')
  }
  track(/^\/docs(\/|$)/.test(pathname) ? 'docs' : /^\/legal(\/|$)/.test(pathname) ? 'legal' : /^\/app(\/|$)/.test(pathname) ? 'app' : 'landing')
}

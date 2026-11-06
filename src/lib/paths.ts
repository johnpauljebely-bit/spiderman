/**
 * Where Move lives. On the live site the VCE portfolio has the root and Move is served under /anipanel/
 * (vite.config.ts sets that base for builds only); while developing it stays at /. Every address of Move's
 * own pages and public files goes through to(), and routing reads route(), so both work either way.
 * /api stays at the root in both.
 */
export const BASE = import.meta.env.BASE_URL

/** One of Move's own addresses, e.g. to('/app') is /anipanel/app on the live site. */
export const to = (path: string) => BASE + path.replace(/^\//, '')

/** The current page with the base taken off, so it reads /, /app, /docs and so on wherever Move is served. */
export function route(pathname = location.pathname): string {
  if (pathname.startsWith(BASE)) return '/' + pathname.slice(BASE.length)
  return pathname === BASE.slice(0, -1) ? '/' : pathname
}

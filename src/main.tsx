import { lazy, StrictMode, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { trackPage } from './lib/analytics'
import { route, to } from './lib/paths'

// Discord sends people back to the site root (the one address it knows about) with the login token in the
// hash, and `state` names the page that asked (Move's /app, or another VCE tool's gate). Hand it over there.
// On the live site the root is VCE's page, which does the same hand-off.
function returnPath(): string {
  try {
    const part = (new URLSearchParams(location.hash.slice(1)).get('state') ?? '').split('.')[1] ?? ''
    const path = atob(part.replace(/-/g, '+').replace(/_/g, '/'))
    if (/^\/(?!\/)/.test(path) && path !== location.pathname) return path
  } catch {
    /* no state, or not ours */
  }
  return to('/app')
}
if (route() === '/' && /access_token=|[#&]error=/.test(location.hash)) {
  location.replace(returnPath() + location.hash)
} else {
  // Only the page that's actually open loads its code, so the landing page's dark styles never reach the tool.
  const path = route()
  trackPage(path)
  const Page = /^\/docs(\/|$)/.test(path)
    ? lazy(() => import('./components/DocsPage').then((m) => ({ default: m.DocsPage })))
    : /^\/legal(\/|$)/.test(path)
      ? lazy(() => import('./components/LegalPage').then((m) => ({ default: m.LegalPage })))
      : /^\/admin(\/|$)/.test(path)
        ? lazy(() => import('./components/AdminPage').then((m) => ({ default: m.AdminPage })))
        : /^\/app(\/|$)/.test(path)
          ? lazy(() => import('./App.tsx'))
          : lazy(() => import('./landing/Landing.tsx'))

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <Suspense fallback={null}>
        <Page />
      </Suspense>
    </StrictMode>,
  )
}

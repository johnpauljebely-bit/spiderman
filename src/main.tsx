import { lazy, StrictMode, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { trackPage } from './lib/analytics'

// Discord sends people back to "/" (the one address it knows about) with the login token in the hash.
// The tool lives at /app, so hand the token over there.
if (location.pathname === '/' && location.hash.includes('access_token')) {
  location.replace('/app' + location.hash)
} else {
  // Only the page that's actually open loads its code, so the landing page's dark styles never reach the tool.
  const path = location.pathname
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

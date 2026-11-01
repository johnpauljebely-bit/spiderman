/**
 * True when this page load is someone clicking through from another page of this same site (the landing
 * page's "Open Move", the docs link, a "Home" link…). False for a typed address, a bookmark, a link from
 * another website, or a refresh — those are the visits that get the liquid-glass intro.
 */
export function arrivedFromSite(): boolean {
  try {
    const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined
    if (navigation?.type === 'reload') return false
    return document.referrer !== '' && new URL(document.referrer).origin === window.location.origin
  } catch {
    return false
  }
}

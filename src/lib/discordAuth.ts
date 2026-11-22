/**
 * Discord login via the OAuth2 "implicit grant" (response_type=token) — the flow Discord provides
 * specifically for apps with no backend. The browser gets an access token straight from Discord's
 * redirect; nothing here ever needs (or sees) the application's client secret, which can only be used
 * safely from a server. Client IDs are not secret — Discord sends them in the authorize URL by design.
 *
 * Who gets in: anyone in the Vance Collective Discord server (checked with the guilds.members.read scope),
 * plus everyone on the old paid list in allowedUsers.ts. The same check guards Hello Glass and Patch
 * Pixelizer (their copy is gate/vce-gate.js), and they share one sign-in through SHARED_SESSION_KEY.
 * It all runs in the browser, so it keeps casual visitors out rather than being real enforcement.
 */
const DISCORD_CLIENT_ID = '1540136435376590898'
const DISCORD_AUTHORIZE_URL = 'https://discord.com/api/oauth2/authorize'
const DISCORD_API = 'https://discord.com/api/v10'

export const GUILD_ID = '1478912300072173699'
export const GUILD_NAME = 'Vance Collective'
export const GUILD_INVITE = 'https://discord.gg/r8BqJbk7ga'

const SESSION_STORAGE_KEY = 'logo-animator-discord-session'
const SHARED_SESSION_KEY = 'vce-members-session' // read and written by every VCE tool
const PENDING_TOKEN_KEY = 'vce-gate-token' // this tab only: lets "I've joined, check again" work without a new sign-in
const SESSION_TTL_MS = 5 * 24 * 60 * 60 * 1000 // 5 days

export interface DiscordUser {
  id: string
  username: string
  globalName: string | null
  avatarUrl: string | null
}

interface StoredSession {
  user: DiscordUser
  loginAt: number
  member?: boolean
}

export interface Session {
  user: DiscordUser
  member: boolean
}

// Always the site root, wherever the login button was clicked: Discord only accepts redirect addresses
// that were registered for the app, and the root is the one that is. The root page reads `state` to send
// the token on to the page that asked (main.tsx in dev, VCE's index.html on the live site).
function redirectUri(): string {
  return window.location.origin + '/'
}

export function getDiscordAuthorizeUrl(): string {
  const params = new URLSearchParams({
    client_id: DISCORD_CLIENT_ID,
    redirect_uri: redirectUri(),
    response_type: 'token',
    scope: 'identify guilds.members.read',
    state: `move.${btoa(window.location.pathname).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')}`,
  })
  return `${DISCORD_AUTHORIZE_URL}?${params.toString()}`
}

/** Pulls the access token out of the URL fragment Discord redirects back with, then scrubs it from
 * the address bar so it doesn't linger in browser history. Returns null if there's nothing to parse. */
export function consumeTokenFromRedirect(): string | null {
  const hash = window.location.hash
  if (!hash || !hash.includes('access_token')) return null

  const params = new URLSearchParams(hash.slice(1))
  const token = params.get('access_token')
  if (!token) return null

  window.history.replaceState(null, '', window.location.pathname + window.location.search)
  return token
}

async function discordGet(path: string, accessToken: string): Promise<Response> {
  const res = await fetch(DISCORD_API + path, { headers: { Authorization: `Bearer ${accessToken}` } })
  if (res.status === 429) {
    const wait = Math.min(Number(res.headers.get('retry-after')) || 1, 5)
    await new Promise((r) => setTimeout(r, wait * 1000))
    return discordGet(path, accessToken)
  }
  return res
}

export class ExpiredTokenError extends Error {
  constructor() {
    super('Your Discord sign-in expired. Sign in again.')
  }
}

export async function fetchDiscordUser(accessToken: string): Promise<DiscordUser> {
  const res = await discordGet('/users/@me', accessToken)
  if (res.status === 401) throw new ExpiredTokenError()
  if (!res.ok) throw new Error('Discord rejected that login — try again.')
  const data = await res.json()
  const avatarUrl = data.avatar ? `https://cdn.discordapp.com/avatars/${data.id}/${data.avatar}.png?size=64` : null
  return { id: data.id, username: data.username, globalName: data.global_name ?? null, avatarUrl }
}

/** Whether the signed-in account is in the Vance Collective server: Discord answers 200 for a member, 404 if not. */
export async function fetchMembership(accessToken: string): Promise<boolean> {
  const res = await discordGet(`/users/@me/guilds/${GUILD_ID}/member`, accessToken)
  if (res.ok) return true
  if (res.status === 404 || res.status === 403) return false
  if (res.status === 401) throw new ExpiredTokenError()
  throw new Error('Discord didn’t answer. Try again in a moment.')
}

export function savePendingToken(token: string): void {
  try { sessionStorage.setItem(PENDING_TOKEN_KEY, JSON.stringify(token)) } catch { /* private mode */ }
}
export function loadPendingToken(): string | null {
  try { return JSON.parse(sessionStorage.getItem(PENDING_TOKEN_KEY) ?? 'null') } catch { return null }
}
export function clearPendingToken(): void {
  try { sessionStorage.removeItem(PENDING_TOKEN_KEY) } catch { /* private mode */ }
}

export function saveSession(user: DiscordUser, member: boolean): void {
  const session: StoredSession = { user, loginAt: Date.now(), member }
  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session))
  // Members unlock the other VCE tools too (same address on the live site, so they see this)
  if (member) localStorage.setItem(SHARED_SESSION_KEY, JSON.stringify({ user, member: true, at: Date.now() }))
}

/** Returns the signed-in user if a session under 5 days old exists, here or from another VCE tool,
 * clearing it once it's past that — matching Discord back in via the login screen. */
export function loadSession(): Session | null {
  try {
    const raw = localStorage.getItem(SESSION_STORAGE_KEY)
    if (raw) {
      const session = JSON.parse(raw) as StoredSession
      if (Date.now() - session.loginAt <= SESSION_TTL_MS) return { user: session.user, member: !!session.member }
      localStorage.removeItem(SESSION_STORAGE_KEY)
    }
    const shared = JSON.parse(localStorage.getItem(SHARED_SESSION_KEY) ?? 'null')
    if (shared?.user && shared.member && Date.now() - shared.at <= SESSION_TTL_MS) return { user: shared.user, member: true }
  } catch {
    localStorage.removeItem(SESSION_STORAGE_KEY)
  }
  return null
}

export function clearSession(): void {
  localStorage.removeItem(SESSION_STORAGE_KEY)
  localStorage.removeItem(SHARED_SESSION_KEY)
  clearPendingToken()
}

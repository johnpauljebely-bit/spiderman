/**
 * Discord login via the OAuth2 "implicit grant" (response_type=token) — the flow Discord provides
 * specifically for apps with no backend. The browser gets an access token straight from Discord's
 * redirect; nothing here ever needs (or sees) the application's client secret, which can only be used
 * safely from a server. Client IDs are not secret — Discord sends them in the authorize URL by design.
 */
const DISCORD_CLIENT_ID = '1540136435376590898'
const DISCORD_AUTHORIZE_URL = 'https://discord.com/api/oauth2/authorize'
const DISCORD_USER_URL = 'https://discord.com/api/users/@me'

const SESSION_STORAGE_KEY = 'logo-animator-discord-session'
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
}

function redirectUri(): string {
  return window.location.origin + window.location.pathname
}

export function getDiscordAuthorizeUrl(): string {
  const params = new URLSearchParams({
    client_id: DISCORD_CLIENT_ID,
    redirect_uri: redirectUri(),
    response_type: 'token',
    scope: 'identify',
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

export async function fetchDiscordUser(accessToken: string): Promise<DiscordUser> {
  const res = await fetch(DISCORD_USER_URL, { headers: { Authorization: `Bearer ${accessToken}` } })
  if (!res.ok) throw new Error('Discord rejected that login — try again.')
  const data = await res.json()
  const avatarUrl = data.avatar ? `https://cdn.discordapp.com/avatars/${data.id}/${data.avatar}.png?size=64` : null
  return { id: data.id, username: data.username, globalName: data.global_name ?? null, avatarUrl }
}

export function saveSession(user: DiscordUser): void {
  const session: StoredSession = { user, loginAt: Date.now() }
  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session))
}

/** Returns the logged-in user if a session exists and is under 5 days old, clearing it (and
 * returning null) once it's past that — matching Discord back in via the login screen. */
export function loadSession(): DiscordUser | null {
  const raw = localStorage.getItem(SESSION_STORAGE_KEY)
  if (!raw) return null
  try {
    const session = JSON.parse(raw) as StoredSession
    if (Date.now() - session.loginAt > SESSION_TTL_MS) {
      localStorage.removeItem(SESSION_STORAGE_KEY)
      return null
    }
    return session.user
  } catch {
    localStorage.removeItem(SESSION_STORAGE_KEY)
    return null
  }
}

export function clearSession(): void {
  localStorage.removeItem(SESSION_STORAGE_KEY)
}

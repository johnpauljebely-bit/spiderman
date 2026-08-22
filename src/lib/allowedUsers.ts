/**
 * Discord user IDs allowed to sign in. Anyone who authenticates with a Discord account whose ID isn't
 * in this list gets turned away with a countdown back to the login screen. Add or remove IDs here.
 *
 * This check runs entirely in the browser — there's no backend to enforce it server-side — so treat
 * it as a simple "keep casual visitors out" gate, not real access control. Anyone determined enough
 * to read the shipped JS could bypass it; it isn't protecting sensitive data, just the UI.
 */
export const ALLOWED_DISCORD_USER_IDS: readonly string[] = ['1349737404449296414', '1437092615961972940', '1476331786668605441', '1322706810490322986', '1437092615961972940']

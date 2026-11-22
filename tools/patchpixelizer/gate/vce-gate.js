/*
 * VCE members gate. Shared by the VCE tools (Hello Glass, Patch Pixelizer; the Ani Panel has the same
 * check built into its React app). Anyone in the Vance Collective Discord server gets in, free.
 *
 *   <script src="../gate/vce-gate.js" data-tool="Hello Glass" data-home="../" defer></script>
 *
 * How it works: Discord's OAuth "implicit grant" (no server, no client secret). The browser asks
 * Discord for a token with two scopes, `identify` (who you are) and `guilds.members.read` (lets us ask
 * "is this person in that one server?"), then calls /users/@me/guilds/{server}/member: 200 means a
 * member, 404 means not. Discord only redirects to registered addresses, so the token always comes
 * back to the site root; the root page hands it on to the page named in `state` (see the snippet in
 * each tool's index.html and in VCE's index.html).
 *
 * This runs in the browser only. It keeps casual visitors out and asks people to join; someone
 * determined could read the shipped files. Real enforcement needs a server.
 *
 * Keep the copies in sync: badge-pixelizer/gate/ and hello-glass/public/gate/.
 */
(() => {
  const CLIENT_ID = '1540136435376590898'; // the Move / VCE Discord app
  const GUILD_ID = '1478912300072173699'; // Vance Collective
  const GUILD_NAME = 'Vance Collective';
  const INVITE = 'https://discord.gg/r8BqJbk7ga';
  const OWNER = ['1349737404449296414']; // always let the owner in, server or not
  const SESSION_KEY = 'vce-members-session'; // shared with the Ani Panel: one sign-in, every tool
  const TOKEN_KEY = 'vce-gate-token'; // kept for this tab only, to re-check after someone joins
  const NONCE_KEY = 'vce-gate-nonce';
  const JOIN_KEY = 'vce-gate-join-clicked';
  const TTL = 5 * 24 * 60 * 60 * 1000; // 5 days, like the Ani Panel
  const API = 'https://discord.com/api/v10';

  const script = document.currentScript;
  const TOOL = script?.dataset.tool || 'this tool';
  const HOME = script?.dataset.home || '/';
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const store = {
    get(k, s = localStorage) { try { return JSON.parse(s.getItem(k)); } catch { return null; } },
    set(k, v, s = localStorage) { try { s.setItem(k, JSON.stringify(v)); } catch {} },
    del(k, s = localStorage) { try { s.removeItem(k); } catch {} },
  };

  /* ---------- Session ---------- */
  function loadSession() {
    const s = store.get(SESSION_KEY);
    if (!s || !s.user || !s.member || Date.now() - s.at > TTL) return null;
    return s;
  }
  const saveSession = user => store.set(SESSION_KEY, { user, member: true, at: Date.now() });

  /* ---------- Discord ---------- */
  const b64url = s => btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  function authorizeUrl() {
    const nonce = crypto.getRandomValues(new Uint32Array(2)).join('');
    store.set(NONCE_KEY, nonce, sessionStorage);
    const params = new URLSearchParams({
      client_id: CLIENT_ID,
      redirect_uri: `${location.origin}/`,
      response_type: 'token',
      scope: 'identify guilds.members.read',
      state: `${nonce}.${b64url(location.pathname + location.search)}`,
    });
    return `https://discord.com/oauth2/authorize?${params}`;
  }
  // The token Discord sent back, if this page load is the return trip (and it's ours)
  function takeToken() {
    if (!/access_token=/.test(location.hash)) return null;
    const p = new URLSearchParams(location.hash.slice(1));
    history.replaceState(null, '', location.pathname + location.search);
    const nonce = store.get(NONCE_KEY, sessionStorage);
    store.del(NONCE_KEY, sessionStorage);
    if (!nonce || (p.get('state') || '').split('.')[0] !== nonce) return { error: 'That sign-in link expired. Try again.' };
    return { token: p.get('access_token') };
  }
  function returnError() {
    if (!/error=/.test(location.hash)) return null;
    const p = new URLSearchParams(location.hash.slice(1));
    history.replaceState(null, '', location.pathname + location.search);
    return p.get('error') === 'access_denied' ? 'Sign-in was cancelled. Nothing was shared.' : 'Discord couldn’t sign you in. Try again.';
  }
  async function api(path, token) {
    const res = await fetch(API + path, { headers: { Authorization: `Bearer ${token}` } });
    if (res.status === 429) {
      const wait = Number(res.headers.get('retry-after')) || 1;
      await new Promise(r => setTimeout(r, Math.min(wait, 5) * 1000));
      return api(path, token);
    }
    return res;
  }
  async function whoAndMember(token) {
    const me = await api('/users/@me', token);
    if (me.status === 401) throw Object.assign(new Error('expired'), { expired: true });
    if (!me.ok) throw new Error('Discord didn’t answer. Try again in a moment.');
    const d = await me.json();
    const user = {
      id: d.id,
      username: d.username,
      globalName: d.global_name || null,
      avatarUrl: d.avatar ? `https://cdn.discordapp.com/avatars/${d.id}/${d.avatar}.png?size=64` : null,
    };
    if (OWNER.includes(user.id)) return { user, member: true };
    const m = await api(`/users/@me/guilds/${GUILD_ID}/member`, token);
    if (m.ok) return { user, member: true };
    if (m.status === 404 || m.status === 403) return { user, member: false };
    if (m.status === 401) throw Object.assign(new Error('expired'), { expired: true });
    throw new Error('Discord didn’t answer. Try again in a moment.');
  }

  /* ---------- UI ---------- */
  const ICON = {
    discord: '<svg viewBox="0 0 127.14 96.36" aria-hidden="true"><path fill="currentColor" d="M107.7,8.07A105.15,105.15,0,0,0,81.47,0a72.06,72.06,0,0,0-3.36,6.83A97.68,97.68,0,0,0,49,6.83,72.37,72.37,0,0,0,45.64,0,105.89,105.89,0,0,0,19.39,8.09C2.79,32.65-1.71,56.6.54,80.21h0A105.73,105.73,0,0,0,32.71,96.36,77.7,77.7,0,0,0,39.6,85.25a68.42,68.42,0,0,1-10.85-5.18c.91-.66,1.8-1.34,2.66-2a75.57,75.57,0,0,0,64.32,0c.87.71,1.76,1.39,2.66,2a68.68,68.68,0,0,1-10.87,5.19,77,77,0,0,0,6.89,11.1A105.25,105.25,0,0,0,126.6,80.22h0C129.24,52.84,122.09,29.11,107.7,8.07ZM42.45,65.69C36.18,65.69,31,60,31,53s5-12.74,11.43-12.74S54,46,53.89,53,48.84,65.69,42.45,65.69Zm42.24,0C78.41,65.69,73.25,60,73.25,53s5-12.74,11.44-12.74S96.23,46,96.12,53,91.08,65.69,84.69,65.69Z"/></svg>',
    out: '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 7h10v10"/><path d="M7 17 17 7"/></svg>',
    check: '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>',
    back: '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>',
  };
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const CSS = `
  .vg{--vg-ink:#0b0b0c;--vg-mute:rgb(11 11 12/.58);--vg-line:rgb(11 11 12/.1);position:fixed;inset:0;z-index:2147483000;display:grid;place-items:center;padding:16px;
    font:15px/1.5 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;-webkit-font-smoothing:antialiased;color:var(--vg-ink);
    background:rgb(10 12 18/.38);-webkit-backdrop-filter:blur(18px) saturate(1.1);backdrop-filter:blur(18px) saturate(1.1);
    opacity:1;transition:opacity .45s ease}
  .vg.out{opacity:0;pointer-events:none}
  .vg *{box-sizing:border-box}
  .vg-card{position:relative;width:min(420px,100%);padding:28px;border-radius:22px;background:#fff;text-align:left;
    box-shadow:0 0 0 1px rgb(11 11 12/.06),0 24px 60px rgb(0 0 0/.28),0 4px 12px rgb(0 0 0/.08);
    animation:vg-in .5s cubic-bezier(.16,1,.3,1) both}
  @keyframes vg-in{from{opacity:0;transform:translateY(12px) scale(.98)}}
  .vg-top{display:flex;align-items:center;margin-bottom:20px}
  .vg-back{display:inline-flex;align-items:center;gap:4px;font-size:13px;color:var(--vg-mute);text-decoration:none}
  .vg-back svg{width:15px;height:15px}
  .vg-back:hover{color:var(--vg-ink)}
  .vg .vg-card h2{margin:0 0 8px;padding:0;font-family:inherit;font-size:24px;line-height:1.15;font-weight:600;font-style:normal;letter-spacing:-.02em;text-transform:none;color:var(--vg-ink);opacity:1}
  .vg .vg-card p{margin:0;padding:0;font-family:inherit;font-size:15px;line-height:1.5;letter-spacing:0;text-transform:none;color:var(--vg-mute);opacity:1}
  .vg p b{color:var(--vg-ink);font-weight:500}
  .vg-actions{display:grid;gap:10px;margin-top:22px}
  .vg-btn{display:flex;align-items:center;justify-content:center;gap:9px;height:48px;padding:0 18px;border:0;border-radius:999px;
    font-family:inherit;font-size:15px;font-weight:500;line-height:1;cursor:pointer;text-decoration:none;transition:background-color .2s ease,transform .3s cubic-bezier(.16,1,.3,1),box-shadow .2s ease}
  .vg-btn svg{width:18px;height:18px;flex:none}
  .vg-btn.primary{background:var(--vg-ink);color:#fff}
  .vg-btn.primary:hover{background:#2b2b2f}
  .vg-btn.ghost{background:#fff;color:var(--vg-ink);box-shadow:inset 0 0 0 1px rgb(11 11 12/.14)}
  .vg-btn.ghost:hover{box-shadow:inset 0 0 0 1px var(--vg-ink)}
  .vg-btn.ghost svg{width:14px;height:14px;color:var(--vg-mute)}
  .vg-btn:active{transform:scale(.98)}
  .vg-btn[aria-busy="true"]{pointer-events:none;opacity:.75}
  .vg-or{display:flex;align-items:center;gap:10px;margin:2px 0;font-size:12px;color:var(--vg-mute)}
  .vg-or::before,.vg-or::after{content:"";flex:1;height:1px;background:var(--vg-line)}
  .vg-steps{list-style:none;margin:18px 0 0;padding:0;display:grid;gap:10px}
  .vg-steps li{display:flex;gap:12px;align-items:flex-start;font-size:14px;line-height:1.4;color:var(--vg-mute)}
  .vg-steps li b{color:var(--vg-ink);font-weight:500}
  .vg-n{display:grid;place-items:center;flex:none;width:22px;height:22px;border-radius:50%;background:#f1f2f4;color:var(--vg-ink);font-size:12px;font-weight:600}
  .vg-steps li.done .vg-n{background:#e7f6ec;color:#17803d}
  .vg-steps li.done .vg-n svg{width:13px;height:13px}
  .vg .vg-card .vg-fine{margin-top:18px;padding-top:16px;border-top:1px solid var(--vg-line);font-size:12.5px;line-height:1.5}
  .vg .vg-card .vg-alert{margin-top:16px;padding:10px 12px;border-radius:12px;background:#fff4f2;color:#a0331f;font-size:13.5px}
  .vg-who{display:flex;align-items:center;gap:10px;margin-bottom:16px;padding:8px 10px 8px 8px;border-radius:14px;background:#f5f5f7;font-size:13.5px}
  .vg-who img,.vg-who .vg-ph{width:30px;height:30px;border-radius:50%;flex:none;background:#dfe1e6}
  .vg-who span{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--vg-mute)}
  .vg-who span b{color:var(--vg-ink);font-weight:500}
  .vg-link{border:0;background:none;padding:0;font:inherit;font-size:12.5px;color:var(--vg-mute);text-decoration:underline;text-underline-offset:2px;cursor:pointer}
  .vg-link:hover{color:var(--vg-ink)}
  .vg-center{display:grid;justify-items:center;text-align:center;gap:10px;padding:12px 0 4px}
  .vg-spin{width:28px;height:28px;border-radius:50%;border:2.5px solid #e4e6eb;border-top-color:var(--vg-ink);animation:vg-spin .8s linear infinite}
  @keyframes vg-spin{to{transform:rotate(360deg)}}
  .vg-ok{display:grid;place-items:center;width:44px;height:44px;border-radius:50%;background:#e7f6ec;color:#17803d}
  .vg-ok svg{width:22px;height:22px}
  .vg-live{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)}
  @media (max-width:420px){.vg-card{padding:22px}.vg .vg-card h2{font-size:22px}}
  @media (prefers-reduced-motion:reduce){.vg,.vg-card,.vg-btn{transition:none;animation:none}.vg-spin{animation-duration:2s}}
  `;

  let root, card, live;
  function mount() {
    const style = document.createElement('style');
    style.textContent = CSS;
    document.head.append(style);
    root = document.createElement('div');
    root.className = 'vg';
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-modal', 'true');
    root.setAttribute('aria-labelledby', 'vg-title');
    root.innerHTML = '<div class="vg-card"></div><p class="vg-live" role="status" aria-live="polite"></p>';
    card = root.firstChild;
    live = root.lastChild;
    // The tool stays visible behind the frosted glass (a preview of what's inside) but can't be used yet
    for (const el of document.body.children) el.inert = true;
    document.body.append(root);
  }
  function unmount() {
    for (const el of document.body.children) if (el !== root) el.inert = false;
    if (!root) return;
    root.classList.add('out');
    setTimeout(() => root.remove(), reduced ? 0 : 460);
  }
  function show(html, say) {
    card.innerHTML = html;
    if (say) live.textContent = say;
    const first = card.querySelector('[data-focus]');
    if (first) first.focus({ preventScroll: true });
  }
  const top = () => `<div class="vg-top"><a class="vg-back" href="${esc(HOME)}">${ICON.back}Back</a></div>`;
  const fine = `<p class="vg-fine">Discord only tells us your name and whether you’re in ${GUILD_NAME}. Nothing is stored except on this device, and you stay signed in for 5 days on every VCE tool.</p>`;

  // 1. Not signed in. Most people arrive from the server, so signing in comes first; joining is the fallback.
  function viewSignIn(error) {
    const joined = store.get(JOIN_KEY, sessionStorage);
    show(`${top()}
      <h2 id="vg-title">${esc(TOOL)} is free for ${GUILD_NAME}</h2>
      <p>Everyone in the VCE Discord server can use it. Sign in with Discord and we’ll check you’re a member. No payment, no forms.</p>
      ${error ? `<p class="vg-alert" role="alert">${esc(error)}</p>` : ''}
      <div class="vg-actions">
        <a class="vg-btn primary" href="${esc(authorizeUrl())}" data-go data-focus>${ICON.discord}${joined ? 'I’ve joined, continue with Discord' : 'Continue with Discord'}</a>
        <div class="vg-or">Not in the server yet?</div>
        <a class="vg-btn ghost" href="${INVITE}" target="_blank" rel="noopener" data-join>Join ${GUILD_NAME}${ICON.out}</a>
      </div>
      ${fine}`);
  }

  // 2. Signed in but not a member: join, then come back. Re-checks by itself when they return to the tab.
  function viewJoin(user, error) {
    const name = user.globalName || user.username;
    show(`${top()}
      <div class="vg-who">${user.avatarUrl ? `<img src="${esc(user.avatarUrl)}" alt="">` : '<i class="vg-ph"></i>'}
        <span>Signed in as <b>${esc(name)}</b></span><button class="vg-link" type="button" data-switch>Not you?</button></div>
      <h2 id="vg-title">One step left: join the server</h2>
      <p>This account isn’t in <b>${GUILD_NAME}</b> yet. Joining is free and takes a few seconds.</p>
      <ol class="vg-steps">
        <li class="done"><span class="vg-n">${ICON.check}</span><span><b>Signed in</b> with Discord</span></li>
        <li><span class="vg-n">2</span><span><b>Join ${GUILD_NAME}</b> in Discord</span></li>
        <li><span class="vg-n">3</span><span><b>Come back here</b>. We’ll check again on our own</span></li>
      </ol>
      ${error ? `<p class="vg-alert" role="alert">${esc(error)}</p>` : ''}
      <div class="vg-actions">
        <a class="vg-btn primary" href="${INVITE}" target="_blank" rel="noopener" data-join data-focus>${ICON.discord}Join ${GUILD_NAME}</a>
        <button class="vg-btn ghost" type="button" data-recheck>I’ve joined, check again</button>
      </div>
      ${fine}`, `Signed in as ${name}, but not in ${GUILD_NAME} yet.`);
  }

  function viewChecking() {
    show(`<div class="vg-center"><span class="vg-spin" aria-hidden="true"></span><h2 id="vg-title">Checking with Discord…</h2><p>Making sure you’re in ${GUILD_NAME}.</p></div>`, 'Checking with Discord');
  }
  function viewWelcome(user, done) {
    const name = user.globalName || user.username;
    show(`<div class="vg-center"><span class="vg-ok">${ICON.check}</span><h2 id="vg-title">You’re in, ${esc(name)}</h2><p>Thanks for being part of ${GUILD_NAME}.</p></div>`, `Signed in. Welcome, ${name}.`);
    setTimeout(done, reduced ? 400 : 1100);
  }

  /* ---------- Flow ---------- */
  let checking = false;
  async function check(token, quiet) {
    if (checking) return;
    checking = true;
    if (!quiet) viewChecking();
    try {
      const { user, member } = await whoAndMember(token);
      if (member) {
        store.del(TOKEN_KEY, sessionStorage);
        saveSession(user);
        viewWelcome(user, unmount);
      } else {
        store.set(TOKEN_KEY, token, sessionStorage);
        current = user;
        viewJoin(user, quiet === 'manual' ? `Still not showing as a member. If you just joined, give it a few seconds and try again.` : null);
      }
    } catch (e) {
      store.del(TOKEN_KEY, sessionStorage);
      viewSignIn(e.expired ? 'Your Discord sign-in expired. Sign in again.' : e.message);
    } finally {
      checking = false;
    }
  }
  let current = null;

  function start() {
    mount();
    card.addEventListener('click', e => {
      if (e.target.closest('[data-go]')) {
        const b = e.target.closest('[data-go]');
        b.setAttribute('aria-busy', 'true');
        b.lastChild.textContent = 'Opening Discord…';
      } else if (e.target.closest('[data-join]')) {
        store.set(JOIN_KEY, true, sessionStorage);
        // Back on the sign-in view, the main button now reads "I've joined, continue"
        if (!store.get(TOKEN_KEY, sessionStorage)) setTimeout(() => viewSignIn(), 300);
      } else if (e.target.closest('[data-recheck]')) {
        const t = store.get(TOKEN_KEY, sessionStorage);
        if (t) check(t, 'manual');
        else viewSignIn();
      } else if (e.target.closest('[data-switch]')) {
        store.del(TOKEN_KEY, sessionStorage);
        store.del(SESSION_KEY);
        viewSignIn();
      }
    });
    // Coming back from Discord after joining: check again without being asked
    let lastAuto = 0;
    const auto = () => {
      const t = store.get(TOKEN_KEY, sessionStorage);
      if (document.visibilityState !== 'visible' || !t || !current || Date.now() - lastAuto < 3000) return;
      lastAuto = Date.now();
      check(t, true);
    };
    document.addEventListener('visibilitychange', auto);
    addEventListener('focus', auto);
    addEventListener('pageshow', e => { if (e.persisted && root.isConnected && !loadSession()) viewSignIn(); });

    const back = takeToken();
    const err = returnError();
    if (back && back.token) return check(back.token);
    if (back && back.error) return viewSignIn(back.error);
    if (err) return viewSignIn(err);
    const pending = store.get(TOKEN_KEY, sessionStorage);
    if (pending) return check(pending);
    viewSignIn();
  }

  // Signed in already (on this tool or another VCE tool): straight in, no flash of the gate
  const hasReturn = /access_token=|error=/.test(location.hash);
  if (!hasReturn && loadSession()) {
    window.VCEGate = { user: loadSession().user, signOut() { store.del(SESSION_KEY); location.reload(); } };
    return;
  }
  window.VCEGate = { user: null, signOut() { store.del(SESSION_KEY); location.reload(); } };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();

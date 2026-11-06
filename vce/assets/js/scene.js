// The home page: the CRT-on-a-hill clip and the logo as its power button.
// site.js calls VCEScene.arrive() the first time home is shown, and VCEScene.label() on every return.
(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const atHome = () => document.body.classList.contains('at-home');

  const scene = $('.scene');
  const menuBtn = $('#menuBtn');
  const clip = $('#clip');
  const clipOn = $('#clipOn');
  const fx = $('.scene-fx');
  const sky = $('.scene-sky');
  const hero = $('.hero');
  const power = $('.power');
  const mark = $('.power-mark');
  const status = $('#power-status');

  const MEDIA = 'assets/media/';
  const CLIP = { w: 1920, h: 1080, screen: [806, 505, 1077, 724], point: [945, 594] };
  const T = { start: 0.6, idle: 2.3, dusk: 2.7, night: 4.4, launch: 4.72 };
  // clipOn is the clip from 2.3 s to the end, reversed: its time r shows clip time (end − r).
  // Playing it from 0.15 s starts on the last point of light, which then opens back up.
  const ON_FROM = 0.15;
  const FLY_MS = 860;
  // Landing glow: eased fade in, a short held peak, then a long eased fade out
  const LIT = { rise: 380, hold: 260, fade: 1500 };
  const smoother = v => v * v * v * (v * (v * 6 - 15) + 10);
  // Centre of the "c" counter inside wordmark.png, as fractions of the image box
  const TARGET = [0.303, 0.4985];

  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const phone = matchMedia('(max-width: 760px)');

  const clamp01 = v => Math.min(1, Math.max(0, v));
  const smooth = v => v * v * (3 - 2 * v);

  const skyCtx = sky.getContext('2d');
  function paintSky(src, sw, sh) {
    skyCtx.drawImage(src, 0, 0, sw, sh * .14, 0, 0, sky.width, sky.height);
  }

  const poster = new Image();
  poster.onload = () => { if (phone.matches) paintSky(poster, poster.naturalWidth, poster.naturalHeight); };
  poster.src = MEDIA + 'poster.jpg';
  phone.addEventListener('change', () => { if (phone.matches && poster.complete) paintSky(poster, poster.naturalWidth, poster.naturalHeight); });

  function setPressed(off) {
    power.setAttribute('aria-pressed', String(off));
    power.setAttribute('aria-label', `Vance Creative Enterprises. Power button: switch the scene ${off ? 'back on' : 'off'}`);
  }

  /* ---------- Reduced motion: poster and copy, cut between day and night stills ---------- */
  if (reduced) {
    scene.classList.add('is-in');
    const night = new Image();
    night.src = MEDIA + 'poster-night.jpg';
    let off = false;
    window.VCEScene = { arrive() {}, label: () => setPressed(off) };
    power.addEventListener('click', () => {
      if (!atHome()) return;
      off = !off;
      const img = off ? night : poster;
      setPressed(off);
      clip.poster = img.src;
      scene.style.backgroundImage = `url("${img.src}")`;
      if (phone.matches && img.complete) paintSky(img, img.naturalWidth, img.naturalHeight);
      status.textContent = off ? 'Offline' : 'Online';
    });
    return;
  }

  // The clips only load once home is shown, so opening an inner page directly stays light
  const size = matchMedia('(max-width: 900px)').matches ? '720' : '1080';
  function load() {
    if (clip.src) return;
    clip.src = `${MEDIA}scene-${size}.mp4`;
    clip.addEventListener('loadeddata', () => { clipOn.src = `${MEDIA}scene-${size}-on.mp4`; }, { once: true });
  }

  // idle → switchingOn → online → switchingOff → offline → poweringOn → rewinding → online …
  let state = 'idle';
  let dot = null;
  let litFrom = 0;
  let scan = 0;

  const ready = v => v.readyState >= 1
    ? Promise.resolve()
    : new Promise(r => v.addEventListener('loadedmetadata', r, { once: true }));

  function play(v) {
    v.play().catch(() => {
      // Autoplay refused: start on the first gesture instead
      addEventListener('pointerdown', () => v.play().catch(() => {}), { once: true });
    });
  }

  function show(v) {
    clip.classList.toggle('is-hidden', v !== clip);
    clipOn.classList.toggle('is-hidden', v !== clipOn);
  }
  const shown = () => clipOn.classList.contains('is-hidden') ? clip : clipOn;

  async function switchOn() {
    state = 'switchingOn';
    setPressed(false);
    await ready(clip);
    clip.currentTime = T.start;
    play(clip);
    status.textContent = 'Online';
  }

  function switchOff() {
    state = 'switchingOff';
    dot = null;
    setPressed(true);
    play(clip);
  }

  function goOffline() {
    state = 'offline';
    status.textContent = 'Offline';
    // Park the reversed clip on its first frame now, so powering on starts without a blank frame
    ready(clipOn).then(() => { if (state === 'offline') clipOn.currentTime = ON_FROM; });
  }

  // The light leaves the logo and flies back into the screen, which then opens back up
  function powerOn(now) {
    state = 'poweringOn';
    setPressed(false);
    dot = { t0: now, dir: 'in', done: false, onLand: rewind };
  }

  async function rewind() {
    state = 'rewinding';
    await ready(clipOn);
    if (Math.abs(clipOn.currentTime - ON_FROM) > .05) {
      clipOn.currentTime = ON_FROM;
      await new Promise(r => clipOn.addEventListener('seeked', r, { once: true }));
    }
    show(clipOn);
    play(clipOn);
    // Behind it, park the main clip on the colour-bar frame the reversed one ends on
    clip.pause();
    clip.currentTime = T.idle;
  }

  power.addEventListener('click', () => {
    // Off the home page the logo is just a link home (site.js)
    if (!atHome()) return;
    if (state === 'switchingOff' || state === 'poweringOn' || state === 'rewinding') return;
    if (state === 'idle') return arrive();
    if (state === 'offline') return powerOn(performance.now());
    switchOff();
  });

  function arrive() {
    if (state !== 'idle') return;
    load();
    scene.classList.add('is-in');
    layout();
    switchOn();
  }
  window.VCEScene = { arrive, label: () => setPressed(state === 'offline' || state === 'switchingOff') };

  /* ---------- Clip-frame → scene mapping (cover, centre bottom) ---------- */
  const ctx = fx.getContext('2d');
  let W = 0, H = 0, dpr = 1;
  let map = { s: 1, ox: 0, oy: 0 };
  let glints = [];
  const P = (x, y) => [map.ox + x * map.s, map.oy + y * map.s];

  function layout() {
    const r = scene.getBoundingClientRect();
    const v = clip.getBoundingClientRect();
    W = r.width; H = r.height;
    dpr = Math.min(devicePixelRatio || 1, 2);
    fx.width = Math.round(W * dpr);
    fx.height = Math.round(H * dpr);
    const s = Math.max(v.width / CLIP.w, v.height / CLIP.h);
    map = { s, ox: v.left - r.left + (v.width - CLIP.w * s) / 2, oy: v.top - r.top + (v.height - CLIP.h * s) };
    buildGlints(r);
  }

  function buildGlints(r) {
    // Keep the sparkles off the copy, the logo and the menu button
    const pad = 24;
    const boxes = [$('.headline'), $('.lede'), mark, menuBtn].map(el => {
      const b = el.getBoundingClientRect();
      return { l: b.left - r.left - pad, t: b.top - r.top - pad, r: b.right - r.left + pad, b: b.bottom - r.top + pad };
    });
    const xL = Math.max(0, -map.ox / map.s) + 30;
    const xR = Math.min(CLIP.w, (W - map.ox) / map.s) - 30;
    const yT = -map.oy / map.s + 16;
    const yB = 420;
    glints = [];
    for (let tries = 0; glints.length < 22 && tries < 1500; tries++) {
      const cx = xL + Math.random() * (xR - xL);
      const cy = yT + Math.random() * (yB - yT);
      const [x, y] = P(cx, cy);
      if (boxes.some(o => x > o.l && x < o.r && y > o.t && y < o.b)) continue;
      if (cx > 700 && cx < 1180 && cy > 380) continue; // clear of the computer's glow
      if (glints.some(o => Math.hypot(o.cx - cx, o.cy - cy) < 90)) continue;
      glints.push({ cx, cy, r: 3.5 + Math.random() * 5.5, phase: Math.random() * Math.PI * 2, speed: 1.1 + Math.random() * 2.2 });
    }
  }

  function star(x, y, r, a) {
    ctx.globalAlpha = a;
    const glow = ctx.createRadialGradient(x, y, 0, x, y, r * 1.6);
    glow.addColorStop(0, 'rgba(255,255,255,.55)');
    glow.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(x - r * 1.6, y - r * 1.6, r * 3.2, r * 3.2);
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.moveTo(x, y - r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.quadraticCurveTo(x, y, x, y + r);
    ctx.quadraticCurveTo(x, y, x - r, y);
    ctx.quadraticCurveTo(x, y, x, y - r);
    ctx.fill();
  }

  function drawScanline(now) {
    const [x0, y0] = P(CLIP.screen[0], CLIP.screen[1]);
    const [x1, y1] = P(CLIP.screen[2], CLIP.screen[3]);
    const h = y1 - y0;
    const band = 52 * map.s;
    const y = y0 - band + ((now / 1800) % 1) * (h + band);
    ctx.save();
    ctx.beginPath();
    ctx.roundRect ? ctx.roundRect(x0, y0, x1 - x0, h, 18 * map.s) : ctx.rect(x0, y0, x1 - x0, h);
    ctx.clip();
    const g = ctx.createLinearGradient(0, y, 0, y + band);
    g.addColorStop(0, 'rgba(255,255,255,0)');
    g.addColorStop(.5, 'rgba(255,255,255,.10)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.globalAlpha = scan * (.82 + Math.random() * .18);
    ctx.fillStyle = g;
    ctx.fillRect(x0, y, x1 - x0, band);
    ctx.globalAlpha = scan * .025 * Math.random();
    ctx.fillStyle = '#fff';
    ctx.fillRect(x0, y0, x1 - x0, h);
    ctx.restore();
  }

  function target() {
    const r = scene.getBoundingClientRect();
    const m = mark.getBoundingClientRect();
    return [m.left - r.left + m.width * TARGET[0], m.top - r.top + m.height * TARGET[1]];
  }

  // Momentum: the dot picks up speed leaving, arrives fast, carries a little past the target
  // and eases back while it fades. HIT_U is where it first reaches the target.
  const BACK = .8;
  const backOut = t => 1 + (BACK + 1) * (t - 1) ** 3 + BACK * (t - 1) ** 2;
  const flyEase = u => backOut(Math.pow(u, 1.3));
  const HIT_U = Math.pow(1 - BACK / (BACK + 1), 1 / 1.3);

  // One curve between the screen's point of light (a) and the logo (b); 'out' flies a→b, 'in' flies b→a
  function dotAt(u, a, b, c) {
    const e = dot.dir === 'out' ? flyEase(u) : 1 - flyEase(u);
    const k = 1 - e;
    return [k * k * a[0] + 2 * k * e * c[0] + e * e * b[0], k * k * a[1] + 2 * k * e * c[1] + e * e * b[1], e];
  }

  function drawDot(now) {
    const u = clamp01((now - dot.t0) / FLY_MS);
    const a = P(CLIP.point[0], CLIP.point[1]), b = target();
    const c = [a[0] + (b[0] - a[0]) * .15, b[1] + (a[1] - b[1]) * -.08];
    const [x, y, e] = dotAt(u, a, b, c);
    const scale = Math.max(.7, Math.min(1.2, map.s * 1.1));
    // Size follows how far along the trip it is; after the hit it shrinks and fades as the light goes in
    const p = clamp01(dot.dir === 'out' ? e : 1 - e);
    const fade = u < HIT_U ? 1 : 1 - smooth((u - HIT_U) / (1 - HIT_U));
    const core = Math.max(1, (2.4 - 1.2 * p + 4.2 * Math.sin(Math.PI * p)) * scale) * (.55 + .45 * fade);
    const bloom = core * 6;

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';

    // A short comet tail along the path, longer while it's moving fast
    for (let i = 8; i >= 1; i--) {
      const ui = u - i * .02;
      if (ui <= 0) continue;
      const [tx, ty] = dotAt(ui, a, b, c);
      ctx.globalAlpha = fade * .42 * (1 - i / 9);
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(tx, ty, Math.max(.6, core * (1 - i / 10)), 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.globalAlpha = fade;
    const g = ctx.createRadialGradient(x, y, 0, x, y, bloom);
    g.addColorStop(0, 'rgba(255,255,255,.85)');
    g.addColorStop(.18, 'rgba(235,240,255,.38)');
    g.addColorStop(.5, 'rgba(210,220,255,.10)');
    g.addColorStop(1, 'rgba(210,220,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x - bloom, y - bloom, bloom * 2, bloom * 2);
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(x, y, core, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    if (!dot.hit && u >= HIT_U) {
      dot.hit = true;
      dot.onLand && dot.onLand();
    }
    if (u >= 1) dot.done = true;
  }

  /* ---------- Frame loop ---------- */
  let last = performance.now();
  let lastSkyT = -1;
  function frame(now) {
    const dt = Math.min(64, now - last);
    last = now;
    const t = clip.currentTime;

    if (state === 'switchingOn' && t >= T.idle) {
      clip.pause();
      state = 'online';
    }
    if (state === 'switchingOff') {
      if (!dot && t >= T.launch) dot = { t0: now, dir: 'out', done: false, onLand: () => { litFrom = performance.now(); } };
      if (clip.ended && dot && dot.done) goOffline();
    }
    if (state === 'rewinding' && !clipOn.classList.contains('is-hidden') && (clipOn.ended || clipOn.currentTime >= clipOn.duration - .03)
        && !clip.seeking && clip.readyState >= 2) {
      show(clip);
      state = 'online';
      status.textContent = 'Online';
    }

    // The logo glows only when the light lands in it on the way out
    if (litFrom) {
      const el = now - litFrom;
      const lit = el < LIT.rise ? smoother(el / LIT.rise)
        : el < LIT.rise + LIT.hold ? 1
        : 1 - smoother(clamp01((el - LIT.rise - LIT.hold) / LIT.fade));
      power.style.setProperty('--lit', lit.toFixed(3));
      if (el >= LIT.rise + LIT.hold + LIT.fade) litFrom = 0;
    }

    // Hidden behind an inner page: keep the state moving, skip the drawing
    if (!atHome() && !(dot && !dot.done)) {
      requestAnimationFrame(frame);
      return;
    }

    const v = shown();
    // Where the scene is on the clip's own timeline, whichever video is showing
    const sceneT = v === clipOn ? (clip.duration || 4.97) - clipOn.currentTime : t;

    if (phone.matches && v.readyState >= 2 && v.currentTime !== lastSkyT) {
      paintSky(v, v.videoWidth, v.videoHeight);
      lastSkyT = v.currentTime;
    }

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);

    if (state !== 'idle') {
      const night = smooth(clamp01((sceneT - T.dusk) / (T.night - T.dusk)));
      const count = 10 + 12 * night;
      for (let i = 0; i < glints.length; i++) {
        const vis = clamp01(count - i);
        if (!vis) break;
        const g = glints[i];
        const tw = .5 + .5 * Math.sin(now * .001 * g.speed + g.phase);
        const [x, y] = P(g.cx, g.cy);
        star(x, y, g.r * (.6 + .55 * tw), vis * (.12 + .8 * tw * tw) * (.7 + .3 * night));
      }
      ctx.globalAlpha = 1;
    }

    scan = state === 'online' ? Math.min(1, scan + dt / 500) : Math.max(0, scan - dt / 180);
    if (scan > 0) drawScanline(now);

    if (dot && !dot.done) drawDot(now);

    requestAnimationFrame(frame);
  }

  layout();
  addEventListener('resize', layout);
  new ResizeObserver(layout).observe(scene);
  clip.addEventListener('loadedmetadata', layout);
  mark.complete ? layout() : mark.addEventListener('load', layout, { once: true });
  document.fonts && document.fonts.ready.then(layout);
  requestAnimationFrame(frame);
})();

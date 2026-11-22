// Badge Pixelizer landing. The intro wipes misted glass off a night field, the field turns to day,
// and scrolling dissolves it into white tiles. The lens card runs real badges through the tool's own
// pixelize() (src/pixelize.js), right here in the browser.
import { pixelize } from '../src/pixelize.js';

// ---------- constants ----------
const IMAGES = {
  night: 'https://assets.uberdesigner.ai/lucid/night.webp',
  hand: 'https://assets.uberdesigner.ai/lucid/hand.webp',
  day: 'https://assets.uberdesigner.ai/lucid/day.webp',
};
const PATH =
  'M919.486 547.507C899.916 481.274 1030.31 451.248 1074.72 498.165C1090.28 514.612 1103.31 591.523 1019.5 625.5' +
  'C927 663 762.922 637.74 788.275 514.612C804.037 438.067 910.59 386.617 961.741 377.257' +
  'C1088.06 354.142 1125.09 413.127 1153 440.379C1230.39 515.943 1236.2 660.976 992.431 730.647' +
  'C831.999 776.5 631.999 620.5 754 448.5';
const CENTER = { x: 958, y: 555 }; // middle of the wiped patch: the origin of the expansion
const RES = 0.5;                    // fog canvas resolution
const BRUSH = 300;                  // wipe width, comp px
const FOG_BLUR = 17.3;              // comp px
const GRAIN_BLUR = 4.2;             // comp px
const SWEEP = 1.2;                  // seconds for a full wipe at full speed
const RAMP = 0.35;                  // seconds to reach full speed
const WIPE_DELAY = 0.8;             // hand lands at 0.6, the wipe starts 0.2 later
const HAND_PAD = { x: 276.9, y: 66.2 };
const TILE = { desktop: 180, mobile: 104 };
const RING_R = 85.29;
const RING_L = 2 * Math.PI * RING_R;

const OPTS = {
  padding: 0, maxColors: 'auto', merge: 45, removeBg: true, bgTolerance: 30, shape: 'auto', rings: 60,
  symmetry: 'auto', despeckle: true, alphaCut: 50, outline: 'none', outlineColor: '#141b3f',
};
const SAMPLES = [
  { src: 'landing/samples/vec-01.webp', name: 'Alaska Roleplay', wm: true },
  { src: 'landing/samples/vec-02.webp', name: 'Manchester Roleplay', wm: true },
  { src: 'landing/samples/vec-03.webp', name: 'Evergreen Roleplay', wm: true },
  { src: 'landing/samples/vec-04.webp', name: 'Manchester Halloween', wm: true },
  { src: 'landing/samples/spark.jpg', name: 'Spark mark', wm: false },
];
const BADGE = 38;

// ---------- helpers ----------
const $ = (s) => document.querySelector(s);
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const smoothstep = (t) => { const x = clamp(t); return x * x * (3 - 2 * x); };
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const gsap = window.gsap;
const html = document.documentElement;

// Back to VCE: the portfolio's dev server locally, the site root once this lives under it.
document.querySelectorAll('[data-vce]').forEach((a) => (a.href = location.port === '5197' ? 'http://localhost:5203/' : '/'));

const scene = $('#scene'), nightImg = $('#night'), dayImg = $('#day'), glow = $('#glow');
const nav = $('#nav'), hero = $('#top'), clarity = $('#clarity');
const preloader = $('#preloader'), preScene = $('#pre-scene'), fog = $('#fog'), comp = $('#comp');
const handMove = $('#hand-move'), hand = $('[data-hand]'), press = $('[data-press]'), handImg = $('#hand-img');
const counter = $('[data-counter]'), count = $('#count');
const svgPath = $('#wipe-path');
svgPath.setAttribute('d', PATH);
const ring = $('#ring');

function unit() { return $('#probe').getBoundingClientRect().width / 100 || 1; }

// ---------- headline characters: one span per character ----------
function splitChars(root) {
  for (const line of root.querySelectorAll('[data-line]')) {
    const walk = (node) => {
      for (const child of [...node.childNodes]) {
        if (child.nodeType === Node.TEXT_NODE) {
          const frag = document.createDocumentFragment();
          for (const ch of child.textContent) {
            const s = document.createElement('span');
            s.dataset.char = '';
            s.style.cssText = 'display:inline-block;white-space:pre';
            s.textContent = ch;
            frag.appendChild(s);
          }
          child.replaceWith(frag);
        } else if (child.nodeType === Node.ELEMENT_NODE) walk(child);
      }
    };
    walk(line);
  }
}
splitChars($('.hero h1'));
splitChars($('.clarity h2'));

function setRing(v) { ring.style.strokeDasharray = `${(RING_L * v) / 100} ${RING_L}`; }
setRing(0);

// ---------- lens card: a real badge, pixelized live ----------
const lens = { i: 0, fill: 0, cache: new Map() };
const lensCv = $('#lens-badge');

function loadImage(src) {
  return new Promise((ok, bad) => { const i = new Image(); i.onload = () => ok(i); i.onerror = bad; i.src = src; });
}
/** The portfolio copies of the logos carry a small VCE watermark bottom right; clear it before pixelizing. */
function cleanSource(img, watermark) {
  const c = document.createElement('canvas');
  c.width = img.naturalWidth; c.height = img.naturalHeight;
  const x = c.getContext('2d');
  x.drawImage(img, 0, 0);
  if (watermark) x.clearRect(c.width * 0.8, c.height * 0.85, c.width * 0.2, c.height * 0.15);
  return c;
}
/** How many distinct shades a plain resize to the same size keeps. */
function plainShades(src, n) {
  const c = document.createElement('canvas');
  c.width = n; c.height = n;
  const x = c.getContext('2d');
  x.imageSmoothingQuality = 'high';
  const k = Math.min(n / src.width, n / src.height);
  x.drawImage(src, (n - src.width * k) / 2, (n - src.height * k) / 2, src.width * k, src.height * k);
  const d = x.getImageData(0, 0, n, n).data, seen = new Set();
  for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 0) seen.add((d[i] << 16) | (d[i + 1] << 8) | d[i + 2]);
  return seen.size;
}
async function computeSample(i) {
  if (lens.cache.has(i)) return lens.cache.get(i);
  const s = SAMPLES[i];
  const src = cleanSource(await loadImage(s.src), s.wm);
  const res = pixelize(src, { ...OPTS, width: BADGE, height: BADGE });
  const id = new ImageData(res.w, res.h);
  let filled = 0;
  res.idx.forEach((v, k) => { if (v >= 0) { filled++; const [r, g, b] = res.palette[v]; id.data.set([r, g, b, 255], k * 4); } });
  const out = { id, w: res.w, h: res.h, colours: res.report.colours, shades: plainShades(src, BADGE), fill: Math.round((filled / (res.w * res.h)) * 100) };
  lens.cache.set(i, out);
  return out;
}
function paintLens(r, i) {
  lensCv.width = r.w; lensCv.height = r.h;
  lensCv.getContext('2d').putImageData(r.id, 0, 0);
  $('#lens-idx').textContent = String(i + 1).padStart(2, '0');
  $('#lens-name').textContent = SAMPLES[i].name;
  $('#m-size').textContent = `${r.w} × ${r.h} px`;
  $('#m-cols').textContent = `${r.shades.toLocaleString('en-GB')} → ${r.colours}`;
  $('#m-merged').textContent = `${r.fill}%`;
  lens.fill = r.fill;
}
const lensReady = computeSample(0).then((r) => paintLens(r, 0)).catch((e) => console.error(e));
let lensBusy = false;
async function stepLens(d) {
  if (lensBusy) return;
  lensBusy = true;
  const i = (lens.i + d + SAMPLES.length) % SAMPLES.length;
  lensCv.style.opacity = '0';
  try {
    const [r] = await Promise.all([computeSample(i), new Promise((ok) => setTimeout(ok, 180))]);
    lens.i = i;
    paintLens(r, i);
    if (gsap) { const o = { v: 0 }; gsap.to(o, { v: r.fill, duration: reduced ? 0 : 0.9, ease: 'power2.out', onUpdate: () => setRing(o.v) }); } else setRing(r.fill);
  } catch (e) { console.error(e); }
  lensCv.style.opacity = '1';
  lensBusy = false;
}
$('#lens-prev').addEventListener('click', () => stepLens(-1));
$('#lens-next').addEventListener('click', () => stepLens(1));

// ---------- loading (M0) ----------
const st = { loaded: 0, ready: false, shown: 0, expand: 1 };
history.scrollRestoration = 'manual';
scrollTo(0, 0);
html.classList.add('locked');

const prog = { night: [0, 0], hand: [0, 0], day: [0, 0] }, done = new Set();
function updateLoaded() {
  const vals = Object.values(prog);
  const known = vals.every(([, t]) => t > 0);
  const f = known ? vals.reduce((a, [l]) => a + l, 0) / vals.reduce((a, [, t]) => a + t, 0) : done.size / 3;
  st.loaded = Math.max(st.loaded, clamp(f));
}
async function fetchImage(key) {
  const res = await fetch(IMAGES[key], { mode: 'cors' });
  if (!res.ok) throw new Error(`${IMAGES[key]}: ${res.status}`);
  const total = +res.headers.get('Content-Length') || 0;
  prog[key][1] = total;
  if (!res.body || !total) { const b = await res.blob(); done.add(key); updateLoaded(); return b; }
  const reader = res.body.getReader(), chunks = [];
  for (;;) {
    const { done: end, value } = await reader.read();
    if (end) break;
    chunks.push(value);
    prog[key][0] += value.length;
    updateLoaded();
  }
  done.add(key); updateLoaded();
  return new Blob(chunks, { type: res.headers.get('Content-Type') || 'image/webp' });
}
const fonts = () => Promise.all([
  document.fonts.load('400 1em "Geist"'), document.fonts.load('500 1em "Geist"'), document.fonts.load('italic 400 1em "Instrument Serif"'),
]);

const pNight = fetchImage('night'), pHand = fetchImage('hand'), pDay = fetchImage('day');
let nightBitmap = null;

if (!gsap) {
  // the animation library didn't load: show the page as it is
  console.error('GSAP did not load; showing the page without motion');
  preloader.remove();
  nightImg.src = IMAGES.night; dayImg.src = IMAGES.day;
  scene.style.setProperty('--sun', '1'); scene.classList.add('in');
  document.querySelectorAll('[data-reveal]').forEach((el) => (el.style.opacity = '1'));
  lensReady.then(() => setRing(lens.fill));
  html.classList.remove('locked');
} else if (reduced) {
  preloader.remove();
  Promise.all([pNight, pDay]).then(async ([n, d]) => {
    nightImg.src = URL.createObjectURL(n); dayImg.src = URL.createObjectURL(d);
    await dayImg.decode().catch(() => {});
    await fonts();
  }).catch((e) => { console.error(e); dayImg.src = IMAGES.day; }).finally(revealReduced);
} else {
  Promise.all([pNight, pHand]).then(async ([n, h]) => {
    nightBitmap = await createImageBitmap(n);
    nightImg.src = URL.createObjectURL(n);
    handImg.src = URL.createObjectURL(h);
    await handImg.decode().catch(() => {});
    scene.classList.add('in');
    startPreloader();
  }).catch(fail);
  Promise.all([pNight, pHand, pDay]).then(async ([, , d]) => {
    dayImg.src = URL.createObjectURL(d);
    await dayImg.decode();
    await fonts();
    await lensReady;
    st.ready = true;
  }).catch(fail);
}

let failed = false;
function fail(e) {
  if (failed) return;
  failed = true;
  console.error(e);
  cancelAnimationFrame(raf);
  preloader.remove();
  if (!nightImg.src) nightImg.src = IMAGES.night;
  if (!dayImg.src) dayImg.src = IMAGES.day;
  fonts().catch(() => {}).finally(revealReduced);
}

function revealReduced() {
  scene.style.setProperty('--sun', '1');
  scene.classList.add('in');
  html.classList.remove('locked');
  gsap.to('[data-reveal]:not([data-reveal^="clarity"])', { opacity: 1, duration: 0.4, ease: 'power1.out' });
  lensReady.then(() => setRing(lens.fill));
  revealMode = 'fade';
  onScroll();
}

// ---------- preloader (M1) ----------
let fit = { s: 1, ox: 0, oy: 0 }, fogBase = null, raf = 0, t0 = 0, last = 0, wiped = false;
const fctx = fog.getContext('2d');
const length = svgPath.getTotalLength();
const path2d = new Path2D(PATH);

function layoutComp() {
  const W = innerWidth, H = innerHeight;
  const s = Math.max(W / 1920, H / 1080);
  fit = { s, ox: (W - 1920 * s) / 2, oy: (H - 1080 * s) / 2 };
  comp.style.transform = `translate(${fit.ox}px, ${fit.oy}px) scale(${s})`;
  fog.width = Math.round(W * RES); fog.height = Math.round(H * RES);
  fogBase = buildFog(fog.width, fog.height);
}

function buildFog(cw, ch) {
  if (!cw || !ch || !nightBitmap) return null;
  const c = document.createElement('canvas');
  c.width = cw; c.height = ch;
  const x = c.getContext('2d');
  const blur = FOG_BLUR * fit.s * RES, m = 3 * blur;
  const bw = cw + 2 * m, bh = ch + 2 * m, iw = nightBitmap.width, ih = nightBitmap.height;
  const k = Math.max(bw / iw, bh / ih), dw = iw * k, dh = ih * k;
  const dx = -m + (bw - dw) / 2, dy = -m + (bh - dh) / 2;
  const hasFilter = 'filter' in CanvasRenderingContext2D.prototype;
  if (hasFilter) {
    x.filter = `blur(${blur}px)`;
    x.drawImage(nightBitmap, dx, dy, dw, dh);
    x.filter = 'none';
  } else {
    const t = document.createElement('canvas');
    t.width = Math.max(1, Math.round(cw / 12)); t.height = Math.max(1, Math.round(ch / 12));
    const tx = t.getContext('2d');
    tx.drawImage(nightBitmap, dx / 12, dy / 12, dw / 12, dh / 12);
    x.imageSmoothingQuality = 'high';
    x.drawImage(t, 0, 0, cw, ch);
  }
  x.fillStyle = 'rgba(217,217,217,0.15)';
  x.fillRect(0, 0, cw, ch);
  // grain: half the pixels white at 10%, softened into an even haze
  const g = document.createElement('canvas');
  g.width = cw; g.height = ch;
  const gx = g.getContext('2d'), id = gx.createImageData(cw, ch);
  for (let i = 0; i < id.data.length; i += 4) if (Math.random() < 0.5) { id.data[i] = id.data[i + 1] = id.data[i + 2] = 255; id.data[i + 3] = 26; }
  gx.putImageData(id, 0, 0);
  if (hasFilter) x.filter = `blur(${GRAIN_BLUR * fit.s * RES}px)`;
  x.drawImage(g, 0, 0);
  x.filter = 'none';
  return c;
}

function startPreloader() {
  layoutComp();
  addEventListener('resize', layoutComp);
  gsap.to(preScene, { opacity: 1, duration: 0.6, ease: 'power1.out' });
  gsap.fromTo(hand, { y: 160, opacity: 0 }, { y: 0, opacity: 1, duration: 0.6, ease: 'power2.out' });
  gsap.to(press, { opacity: 1, duration: 0.3, delay: 0.4 });
  t0 = last = performance.now();
  raf = requestAnimationFrame(frame);
}

function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  const t = (now - t0) / 1000;
  if (!wiped && t > WIPE_DELAY) {
    const speed = clamp((t - WIPE_DELAY) / RAMP) / SWEEP;
    const cap = st.ready ? 1 : st.loaded * 0.9;
    const next = Math.min(cap, st.shown + speed * dt);
    st.shown = Math.min(1, Math.max(st.shown, next));
  }
  count.textContent = `${String(Math.round(st.shown * 100)).padStart(2, '0')}%`;
  draw();
  if (!wiped && st.ready && st.shown >= 1) { wiped = true; intro(); }
  raf = requestAnimationFrame(frame);
}

function draw() {
  const drawn = st.shown * length;
  const p = svgPath.getPointAtLength(drawn);
  handMove.style.transform = `translate(${p.x - HAND_PAD.x}px, ${p.y - HAND_PAD.y}px)`;
  if (!fog.width || !fog.height || !fogBase) return;
  const ctx = fctx, e = st.expand, f = fit;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalCompositeOperation = 'source-over';
  ctx.clearRect(0, 0, fog.width, fog.height);
  ctx.drawImage(fogBase, 0, 0, fog.width, fog.height);
  if (drawn > 0.5) {
    const k = f.s * e * RES;
    ctx.setTransform(k, 0, 0, k, (f.ox + f.s * CENTER.x * (1 - e)) * RES, (f.oy + f.s * CENTER.y * (1 - e)) * RES);
    ctx.globalCompositeOperation = 'destination-out';
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = BRUSH * (0.35 + 0.65 * smoothstep(st.shown / 0.2));
    ctx.setLineDash([drawn, length + 1]);
    ctx.shadowColor = '#000';
    ctx.shadowBlur = GRAIN_BLUR * 2 * k;
    ctx.stroke(path2d);
    ctx.setLineDash([]);
    ctx.shadowBlur = 0;
  }
}

function endPreloader() {
  cancelAnimationFrame(raf);
  removeEventListener('resize', layoutComp);
  preloader.remove();
  html.classList.remove('locked');
  onScroll();
}

// ---------- intro (M2) ----------
const blurIn = { opacity: 1, filter: 'blur(0px)', duration: 0.6, ease: 'power2.out', clearProps: 'filter' };
function revealChars(tl, root, at) {
  tl.set(root, { opacity: 1 }, at);
  for (const line of root.querySelectorAll('[data-line]')) {
    tl.fromTo(line.querySelectorAll('[data-char]'),
      { opacity: 0, filter: 'blur(18px)', xPercent: -30 },
      { opacity: 1, filter: 'blur(0px)', xPercent: 0, duration: 0.8, ease: 'power2.out', stagger: 0.035, clearProps: 'filter,transform' }, at);
  }
}
function intro() {
  const tl = gsap.timeline();
  tl.to(hand, { y: 900, duration: 0.55, ease: 'power2.in' }, 0);
  tl.to(counter, { opacity: 0, duration: 0.35, ease: 'power1.in' }, 0.1);
  tl.fromTo(nav, { opacity: 0, filter: 'blur(8px)' }, { ...blurIn, duration: 0.5 }, 0.2);
  tl.to(st, { expand: 7, duration: 0.7, ease: 'power2.in', onComplete: endPreloader }, 0.3);
  revealChars(tl, $('.hero h1'), 0.75);
  tl.fromTo('.lead', { opacity: 0, filter: 'blur(10px)' }, blurIn, 1.3);
  tl.fromTo('.demo', { opacity: 0, filter: 'blur(10px)' }, blurIn, 1.5);
  tl.to(glow, { opacity: 1, duration: 0.45, ease: 'power1.out' }, 1.6);
  tl.to(glow, { opacity: 0, duration: 0.9, ease: 'power1.inOut' }, 2.05);
  tl.to(scene, { '--sun': 1, duration: 1.1, ease: 'power2.inOut' }, 1.75);
  tl.fromTo('.lens', { opacity: 0, filter: 'blur(10px)', yPercent: 6 }, { opacity: 1, filter: 'blur(0px)', yPercent: 0, duration: 0.7, ease: 'power2.out', clearProps: 'filter,transform' }, 1.9);
  tl.fromTo('.discover', { opacity: 0, filter: 'blur(10px)' }, blurIn, 1.95);
  const r = { v: 0 };
  tl.to(r, { v: () => lens.fill, duration: 1.2, ease: 'power2.out', onUpdate: () => setRing(r.v) }, 2.1);
}

// ---------- scroll: nav theme (M3), section 2 reveal (M4), tiles (M5) ----------
let tiles = [], rank = [], revealMode = 'motion', revealed = false, scrollRaf = 0;
const io = [];

function order(n) {
  let seed = 7;
  const rand = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
  const ranks = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [ranks[i], ranks[j]] = [ranks[j], ranks[i]];
  }
  return ranks;
}
function buildTiles() {
  const box = $('#tiles');
  box.textContent = '';
  const size = (innerWidth >= 1024 ? TILE.desktop : TILE.mobile) * unit();
  const cols = Math.ceil(innerWidth / size), rows = Math.ceil(innerHeight / size);
  const frag = document.createDocumentFragment();
  tiles = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const el = document.createElement('i');
    const l = Math.round(c * size), t = Math.round(r * size);
    el.style.cssText = `left:${l}px;top:${t}px;width:${Math.round((c + 1) * size) - l}px;height:${Math.round((r + 1) * size) - t}px`;
    frag.appendChild(el);
    tiles.push(el);
  }
  box.appendChild(frag);
  rank = order(tiles.length);
}

function update() {
  scrollRaf = 0;
  const top = clarity.getBoundingClientRect().top;
  // tiles whiten in a fixed random order as section 2 rises
  const q = clamp(1 - top / innerHeight);
  const n = tiles.length, div = Math.max(1, n - 1);
  tiles.forEach((el, i) => {
    const start = 0.2 + (0.55 * rank[i]) / div;
    el.style.opacity = String(clamp((q - start) / 0.15));
  });
  const atTop = top <= innerHeight * 0.1;
  nav.dataset.theme = atTop ? 'light' : 'dark';
  if (atTop && !revealed && !html.classList.contains('locked')) revealClarity();
}
function onScroll() { if (!scrollRaf) scrollRaf = requestAnimationFrame(update); }

function revealClarity() {
  revealed = true;
  if (revealMode === 'fade') {
    gsap.to('[data-reveal^="clarity"]', { opacity: 1, duration: 0.4, ease: 'power1.out' });
    return;
  }
  const tl = gsap.timeline();
  revealChars(tl, $('.clarity h2'), 0);
  tl.fromTo('.clarity-text', { opacity: 0, filter: 'blur(10px)' }, blurIn, 0.45);
  const rise = { opacity: 1, y: 0, duration: 0.7, ease: 'power2.out' };
  let k = 0;
  for (const card of document.querySelectorAll('.card-wrap')) {
    if (card.getBoundingClientRect().top < innerHeight) {
      tl.fromTo(card, { opacity: 0, y: 40 }, rise, 0.6 + 0.2 * k++);
    } else {
      gsap.set(card, { opacity: 0, y: 40 });
      const o = new IntersectionObserver(([e]) => { if (e.isIntersecting) { o.disconnect(); gsap.to(card, rise); } });
      o.observe(card);
      io.push(o);
    }
  }
}

buildTiles();
addEventListener('scroll', onScroll, { passive: true });
addEventListener('resize', () => { buildTiles(); onScroll(); });
update();

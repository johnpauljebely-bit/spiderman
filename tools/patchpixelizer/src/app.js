import { pixelize, rgbToHex, hexToRgb } from './pixelize.js';
import { encodePDN, encodePSD, encodePNG } from './formats.js';

const $ = (s) => document.querySelector(s);
const state = {
  source: null,
  name: 'badge',
  w: 38,
  h: 38,
  idx: null,
  palette: [],
  box: null,
  current: 0,
  tool: 'pencil',
  mirrorDraw: false,
  undo: [],
  redo: [],
};

// ---------- settings ----------
const controls = ['padding', 'maxColors', 'merge', 'removeBg', 'bgTolerance', 'shape', 'rings', 'symmetry', 'despeckle', 'alphaCut', 'outline', 'outlineColor'];
function readOpts() {
  const v = (id) => $('#' + id);
  return {
    width: clamp(parseInt(v('width').value) || 38, 4, 256),
    height: clamp(parseInt(v('height').value) || 38, 4, 256),
    padding: clamp(parseInt(v('padding').value) || 0, 0, 20),
    maxColors: v('maxColors').value === '0' ? 'auto' : parseInt(v('maxColors').value),
    merge: parseInt(v('merge').value),
    removeBg: v('removeBg').checked,
    bgTolerance: parseInt(v('bgTolerance').value),
    shape: v('shape').value,
    rings: parseInt(v('rings').value),
    symmetry: v('symmetry').value,
    despeckle: v('despeckle').checked,
    alphaCut: parseInt(v('alphaCut').value),
    outline: v('outline').value,
    outlineColor: v('outlineColor').value,
  };
}
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

function syncLabels() {
  $('#maxColorsOut').textContent = $('#maxColors').value === '0' ? 'Auto' : $('#maxColors').value;
  $('#mergeOut').textContent = $('#merge').value;
  $('#bgToleranceOut').textContent = $('#bgTolerance').value;
  $('#ringsOut').textContent = $('#rings').value === '0' ? 'Off' : $('#rings').value;
  $('#alphaCutOut').textContent = $('#alphaCut').value + '%';
  $('#outlineColor').hidden = $('#outline').value !== 'custom';
}

let regenTimer = 0;
for (const id of controls) {
  const el = $('#' + id);
  el.addEventListener('input', () => { syncLabels(); clearTimeout(regenTimer); regenTimer = setTimeout(regenerate, 60); });
}
syncLabels();

// ---------- size controls ----------
const sizeEl = { width: $('#width'), height: $('#height') };
let ratio = 1; // height / width while locked
function setDim(which, value, fromUser = true) {
  const v = clamp(Math.round(value) || 0, 4, 256);
  sizeEl[which].value = v;
  if (fromUser && $('#lockRatio').classList.contains('on')) {
    if (which === 'width') sizeEl.height.value = clamp(Math.round(v * ratio), 4, 256);
    else sizeEl.width.value = clamp(Math.round(v / ratio), 4, 256);
  }
  markPreset();
}
function markPreset() {
  const cur = `${sizeEl.width.value}x${sizeEl.height.value}`;
  for (const b of document.querySelectorAll('[data-preset]')) b.classList.toggle('on', b.dataset.preset === cur);
}
function sizeChanged() { clearTimeout(regenTimer); regenTimer = setTimeout(regenerate, 250); }
for (const which of ['width', 'height']) {
  // typing: only react once the number is valid, so "1" on the way to "128" doesn't jump around
  sizeEl[which].addEventListener('input', () => {
    const v = parseInt(sizeEl[which].value);
    if (v >= 4 && v <= 256) { setDim(which, v); sizeChanged(); }
  });
  sizeEl[which].addEventListener('change', () => { setDim(which, parseInt(sizeEl[which].value) || 38); sizeChanged(); });
  sizeEl[which].addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
    e.preventDefault();
    setDim(which, (parseInt(sizeEl[which].value) || 38) + (e.key === 'ArrowUp' ? 1 : -1) * (e.shiftKey ? 10 : 1));
    sizeChanged();
  });
}
for (const b of document.querySelectorAll('[data-step]')) {
  b.addEventListener('click', (e) => {
    const which = b.dataset.step;
    setDim(which, (parseInt(sizeEl[which].value) || 38) + parseInt(b.dataset.d) * (e.shiftKey ? 10 : 1));
    sizeChanged();
  });
}
$('#lockRatio').addEventListener('click', () => {
  const on = !$('#lockRatio').classList.contains('on');
  $('#lockRatio').classList.toggle('on', on);
  $('#lockRatio').setAttribute('aria-pressed', String(on));
  ratio = (parseInt(sizeEl.height.value) || 38) / (parseInt(sizeEl.width.value) || 38);
});
for (const b of document.querySelectorAll('[data-preset]')) {
  b.addEventListener('click', () => {
    const [w, h] = b.dataset.preset.split('x').map(Number);
    setDim('width', w, false); setDim('height', h, false);
    ratio = h / w;
    sizeChanged();
  });
}

// ---------- loading ----------
async function loadFile(file) {
  if (!file || !file.type.startsWith('image/')) return;
  state.name = file.name.replace(/\.[^.]+$/, '') || 'badge';
  // <img> decoding handles SVG too (createImageBitmap rejects SVG blobs)
  const bmp = await new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Could not read that image'));
    img.src = URL.createObjectURL(file);
  }).catch((err) => { $('#sourceMeta').textContent = err.message; return null; });
  if (!bmp) return;
  state.source = bmp;
  const sc = $('#sourcePreview');
  const k = Math.min(1, 240 / Math.max(bmp.width, bmp.height));
  sc.width = Math.round(bmp.width * k); sc.height = Math.round(bmp.height * k);
  sc.getContext('2d').drawImage(bmp, 0, 0, sc.width, sc.height);
  $('#sourceMeta').textContent = `${file.name || 'pasted image'} · ${bmp.width}×${bmp.height}`;
  document.body.classList.add('has-image');
  state.undo = []; state.redo = [];
  regenerate();
}
const drop = $('#drop');
drop.addEventListener('click', () => $('#file').click());
$('#file').addEventListener('change', (e) => loadFile(e.target.files[0]));
for (const ev of ['dragenter', 'dragover']) document.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add('over'); });
for (const ev of ['dragleave', 'drop']) document.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove('over'); });
document.addEventListener('drop', (e) => loadFile(e.dataTransfer.files[0]));
document.addEventListener('paste', (e) => {
  const item = [...(e.clipboardData?.items || [])].find((i) => i.type.startsWith('image/'));
  if (item) loadFile(item.getAsFile());
});

function regenerate() {
  if (!state.source) return;
  if (state.idx) pushUndo();
  const opts = readOpts();
  const res = pixelize(state.source, opts);
  state.w = res.w; state.h = res.h; state.idx = res.idx; state.palette = res.palette; state.box = res.box;
  state.current = Math.min(state.current, Math.max(0, state.palette.length - 1));
  const r = res.report;
  const symText = { off: 'no mirror', shape: 'mirrored shape', full: 'mirrored left/right' }[r.symmetry];
  $('#report').textContent = `${res.w}×${res.h} px · ${r.colours} colours · ${r.circle ? 'circle snapped' : 'free shape'} · ${symText}`;
  render();
}

// ---------- editor ----------
const ed = $('#editor');
const ectx = ed.getContext('2d');
let cell = 14;

function render() {
  if (!state.idx) return;
  drawEditor();
  renderPalette();
  renderPreviews();
}

function drawEditor() {
  const W = state.w, H = state.h;
  const wrap = $('#editorWrap');
  const availW = Math.min(wrap.clientWidth - 2, 760);
  const availH = Math.max(320, Math.min(window.innerHeight - 200, 760));
  cell = Math.max(2, Math.floor(Math.min(availW / W, availH / H)));
  const dpr = window.devicePixelRatio || 1;
  ed.width = W * cell * dpr; ed.height = H * cell * dpr;
  ed.style.width = W * cell + 'px'; ed.style.height = H * cell + 'px';
  ectx.setTransform(dpr, 0, 0, dpr, 0, 0);
  // checkerboard
  const q = Math.max(cell / 2, 4);
  for (let y = 0; y * q < H * cell; y++) for (let x = 0; x * q < W * cell; x++) {
    ectx.fillStyle = (x + y) % 2 ? '#d9d9d9' : '#f4f4f4';
    ectx.fillRect(x * q, y * q, q, q);
  }
  for (let g = 0; g < W * H; g++) {
    const v = state.idx[g];
    if (v < 0) continue;
    ectx.fillStyle = rgbToHex(state.palette[v]);
    ectx.fillRect((g % W) * cell, Math.floor(g / W) * cell, cell, cell);
  }
  if (cell >= 6) {
    ectx.strokeStyle = 'rgba(255,255,255,0.16)';
    ectx.lineWidth = 1;
    ectx.beginPath();
    for (let i = 1; i < W; i++) { ectx.moveTo(i * cell + 0.5, 0); ectx.lineTo(i * cell + 0.5, H * cell); }
    for (let i = 1; i < H; i++) { ectx.moveTo(0, i * cell + 0.5); ectx.lineTo(W * cell, i * cell + 0.5); }
    ectx.stroke();
  }
  if (state.mirrorDraw) {
    const ax = mirrorAxis2() / 2 * cell;
    ectx.strokeStyle = 'rgba(255,80,80,0.8)';
    ectx.setLineDash([4, 4]);
    ectx.beginPath(); ectx.moveTo(ax, 0); ectx.lineTo(ax, H * cell); ectx.stroke();
    ectx.setLineDash([]);
  }
}

function mirrorAxis2() {
  return state.box ? state.box.x * 2 + state.box.w : state.w;
}

function toRGBA() {
  const out = new Uint8ClampedArray(state.w * state.h * 4);
  for (let g = 0; g < state.w * state.h; g++) {
    const v = state.idx[g];
    if (v < 0) continue;
    const c = state.palette[v];
    out[g * 4] = c[0]; out[g * 4 + 1] = c[1]; out[g * 4 + 2] = c[2]; out[g * 4 + 3] = 255;
  }
  return out;
}

function renderPreviews() {
  const W = state.w, H = state.h;
  const tmp = new OffscreenCanvas(W, H);
  tmp.getContext('2d').putImageData(new ImageData(toRGBA(), W, H), 0, 0);
  for (const c of document.querySelectorAll('.pv')) {
    const s = parseInt(c.dataset.scale);
    c.width = W * s; c.height = H * s;
    const x = c.getContext('2d');
    x.imageSmoothingEnabled = false;
    x.clearRect(0, 0, c.width, c.height);
    x.drawImage(tmp, 0, 0, W * s, H * s);
  }
}

function renderPalette() {
  const box = $('#palette');
  box.innerHTML = '';
  const counts = new Array(state.palette.length).fill(0);
  for (const v of state.idx) if (v >= 0) counts[v]++;
  state.palette.forEach((rgb, i) => {
    const sw = document.createElement('div');
    sw.className = 'swatch' + (i === state.current ? ' on' : '');
    sw.innerHTML = `<button class="chip" style="background:${rgbToHex(rgb)}" title="Draw with this colour"></button>
      <label class="hex" title="Change this colour everywhere"><input type="color" value="${rgbToHex(rgb)}"><span>${rgbToHex(rgb).toUpperCase()}</span></label>
      <span class="count">${counts[i]}px</span>`;
    sw.querySelector('.chip').onclick = () => { state.current = i; if (state.tool === 'eraser' || state.tool === 'picker') setTool('pencil'); renderPalette(); };
    const inp = sw.querySelector('input');
    inp.addEventListener('input', () => {
      if (!inp.dataset.pushed) { pushUndo(); inp.dataset.pushed = '1'; }
      state.palette[i] = hexToRgb(inp.value);
      sw.querySelector('.chip').style.background = inp.value;
      sw.querySelector('.hex span').textContent = inp.value.toUpperCase();
      drawEditor();
      renderPreviews();
    });
    box.appendChild(sw);
  });
  const add = document.createElement('label');
  add.className = 'swatch add';
  add.title = 'Add a colour';
  add.innerHTML = `<input type="color" value="#ffffff"><span>+ Add colour</span>`;
  add.querySelector('input').addEventListener('change', (e) => {
    pushUndo();
    state.palette.push(hexToRgb(e.target.value));
    state.current = state.palette.length - 1;
    setTool('pencil');
    render();
  });
  box.appendChild(add);
}

// tools
function setTool(t) {
  state.tool = t;
  for (const b of document.querySelectorAll('[data-tool]')) b.classList.toggle('on', b.dataset.tool === t);
}
for (const b of document.querySelectorAll('[data-tool]')) b.onclick = () => setTool(b.dataset.tool);
$('#mirrorDraw').onclick = () => { state.mirrorDraw = !state.mirrorDraw; $('#mirrorDraw').classList.toggle('on', state.mirrorDraw); render(); };

function snapshot() { return { idx: state.idx.slice(), palette: state.palette.map((c) => c.slice()) }; }
function pushUndo() {
  if (!state.idx) return;
  state.undo.push(snapshot());
  if (state.undo.length > 100) state.undo.shift();
  state.redo = [];
}
function restore(s) { state.idx = s.idx; state.palette = s.palette; state.current = Math.min(state.current, state.palette.length - 1); render(); }
function doUndo() { if (!state.undo.length) return; state.redo.push(snapshot()); restore(state.undo.pop()); }
function doRedo() { if (!state.redo.length) return; state.undo.push(snapshot()); restore(state.redo.pop()); }
$('#undo').onclick = doUndo;
$('#redo').onclick = doRedo;
document.addEventListener('keydown', (e) => {
  if (e.target.matches?.('input, select')) return;
  const mod = e.metaKey || e.ctrlKey;
  if (mod && e.key.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? doRedo() : doUndo(); return; }
  if (mod && e.key.toLowerCase() === 'y') { e.preventDefault(); doRedo(); return; }
  if (mod) return;
  const map = { b: 'pencil', p: 'pencil', e: 'eraser', g: 'fill', f: 'fill', i: 'picker' };
  if (map[e.key]) setTool(map[e.key]);
  if (e.key === 'm') $('#mirrorDraw').click();
});

function cellAt(e) {
  const r = ed.getBoundingClientRect();
  const x = Math.floor((e.clientX - r.left) / cell), y = Math.floor((e.clientY - r.top) / cell);
  if (x < 0 || y < 0 || x >= state.w || y >= state.h) return null;
  return { x, y };
}
function targets(x, y) {
  const t = [[x, y]];
  if (state.mirrorDraw) {
    const xm = mirrorAxis2() - 1 - x;
    if (xm !== x && xm >= 0 && xm < state.w) t.push([xm, y]);
  }
  return t;
}
function paintAt(p, erase) {
  const v = erase ? -1 : state.current;
  for (const [x, y] of targets(p.x, p.y)) state.idx[y * state.w + x] = v;
}
function fillAt(p, erase) {
  const W = state.w, H = state.h;
  const v = erase ? -1 : state.current;
  for (const [sx, sy] of targets(p.x, p.y)) {
    const from = state.idx[sy * W + sx];
    if (from === v) continue;
    const stack = [sy * W + sx];
    while (stack.length) {
      const g = stack.pop();
      if (state.idx[g] !== from) continue;
      state.idx[g] = v;
      const x = g % W, y = (g / W) | 0;
      if (x > 0) stack.push(g - 1); if (x < W - 1) stack.push(g + 1);
      if (y > 0) stack.push(g - W); if (y < H - 1) stack.push(g + W);
    }
  }
}
let drawing = false;
ed.addEventListener('contextmenu', (e) => e.preventDefault());
ed.addEventListener('pointerdown', (e) => {
  if (!state.idx) return;
  const p = cellAt(e);
  if (!p) return;
  const right = e.button === 2;
  if (state.tool === 'picker') {
    const v = state.idx[p.y * state.w + p.x];
    if (v >= 0) { state.current = v; setTool('pencil'); render(); }
    return;
  }
  pushUndo();
  if (state.tool === 'fill') { fillAt(p, right); render(); return; }
  drawing = right ? 'erase' : state.tool === 'eraser' ? 'erase' : 'paint';
  ed.setPointerCapture(e.pointerId);
  paintAt(p, drawing === 'erase');
  render();
});
ed.addEventListener('pointermove', (e) => {
  const p = cellAt(e);
  $('#coords').textContent = p ? `${p.x}, ${p.y}` : '';
  if (!drawing || !p) return;
  paintAt(p, drawing === 'erase');
  render();
});
ed.addEventListener('pointerup', () => { drawing = false; });
ed.addEventListener('pointerleave', () => { $('#coords').textContent = ''; });
window.addEventListener('resize', () => render());

// ---------- export ----------
function download(bytes, ext, mime) {
  const blob = new Blob([bytes], { type: mime });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${state.name}_${state.w}x${state.h}.${ext}`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
function layers() { return [{ name: state.name.slice(0, 60) || 'Badge', rgba: toRGBA() }]; }
$('#dlPdn').onclick = () => state.idx && download(encodePDN(layers(), state.w, state.h), 'pdn', 'application/octet-stream');
$('#dlPsd').onclick = () => state.idx && download(encodePSD(layers(), state.w, state.h), 'psd', 'image/vnd.adobe.photoshop');
$('#dlPng').onclick = () => state.idx && download(encodePNG(toRGBA(), state.w, state.h), 'png', 'image/png');

// preview background swatches
for (const b of document.querySelectorAll('[data-bg]')) {
  b.onclick = () => { document.documentElement.style.setProperty('--fabric', b.dataset.bg); $('#fabric').value = b.dataset.bg; };
}
$('#fabric').addEventListener('input', (e) => document.documentElement.style.setProperty('--fabric', e.target.value));

// exposed for automated checks
window.__badge = { state, regenerate, loadFile, toRGBA };

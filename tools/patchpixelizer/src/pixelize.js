// Image -> tiny pixel-art badge.
// Pipeline: background removal -> crop/fit -> palette (k-means in OKLab, merged so
// big areas get one shade) -> per-pixel majority vote -> shape snap (circle) ->
// border-ring cleanup -> mirror symmetry -> despeckle -> optional outline.

// ---------- colour helpers ----------
const srgbToLin = (c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
const LIN = new Float32Array(256).map((_, i) => srgbToLin(i));
export function toOklab(r, g, b) {
  const lr = LIN[r], lg = LIN[g], lb = LIN[b];
  const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb);
  const m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb);
  const s = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}
const dist2 = (a, b) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;

function mulberry32(seed) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------- stage 1: background removal + crop ----------
function removeBackground(img, w, h, tolerance) {
  const d = img.data;
  const border = [];
  for (let x = 0; x < w; x++) border.push(x, (h - 1) * w + x);
  for (let y = 1; y < h - 1; y++) border.push(y * w, y * w + w - 1);
  let transparent = 0;
  for (const i of border) if (d[i * 4 + 3] < 128) transparent++;
  if (transparent > border.length * 0.5) return; // already cut out

  // 3x3-blurred OKLab copy so JPEG noise and paper grain don't stop the fill
  const lab = new Float32Array(w * h * 3);
  for (let i = 0; i < w * h; i++) { const c = toOklab(d[i * 4], d[i * 4 + 1], d[i * 4 + 2]); lab[i * 3] = c[0]; lab[i * 3 + 1] = c[1]; lab[i * 3 + 2] = c[2]; }
  const blur = new Float32Array(w * h * 3);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let a0 = 0, a1 = 0, a2 = 0, n = 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const j = (ny * w + nx) * 3; a0 += lab[j]; a1 += lab[j + 1]; a2 += lab[j + 2]; n++;
    }
    const i = (y * w + x) * 3; blur[i] = a0 / n; blur[i + 1] = a1 / n; blur[i + 2] = a2 / n;
  }
  const at = (i) => [blur[i * 3], blur[i * 3 + 1], blur[i * 3 + 2]];
  const median = [0, 1, 2].map((k) => {
    const v = border.map((i) => blur[i * 3 + k]).sort((p, q) => p - q);
    return v[v.length >> 1];
  });
  const t = tolerance / 100;
  const globalTol = 0.04 + t * 0.25;
  const localTol = 0.03 + t * 0.06;
  let near = 0;
  for (const i of border) if (Math.sqrt(dist2(at(i), median)) < globalTol) near++;
  if (near < border.length * 0.45) return; // busy background, leave it

  const seen = new Uint8Array(w * h);
  const stack = [];
  for (const i of border) if (Math.sqrt(dist2(at(i), median)) < globalTol) { seen[i] = 1; stack.push(i); }
  const g2 = (globalTol * 1.6) ** 2, l2 = localTol ** 2;
  while (stack.length) {
    const i = stack.pop();
    d[i * 4 + 3] = 0;
    const x = i % w, y = (i / w) | 0;
    const ci = at(i);
    const nb = [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, y > 0 ? i - w : -1, y < h - 1 ? i + w : -1];
    for (const j of nb) {
      if (j < 0 || seen[j]) continue;
      const cj = at(j);
      if (dist2(cj, ci) <= l2 && dist2(cj, median) <= g2) { seen[j] = 1; stack.push(j); }
    }
  }
  // soften the cut: edge pixels still close to the background get partial alpha
  const s2 = (globalTol * 1.2) ** 2;
  for (let i = 0; i < w * h; i++) {
    if (d[i * 4 + 3] === 0) continue;
    const x = i % w, y = (i / w) | 0;
    const touches = (x > 0 && d[(i - 1) * 4 + 3] === 0) || (x < w - 1 && d[(i + 1) * 4 + 3] === 0) ||
      (y > 0 && d[(i - w) * 4 + 3] === 0) || (y < h - 1 && d[(i + w) * 4 + 3] === 0);
    if (touches && dist2([lab[i * 3], lab[i * 3 + 1], lab[i * 3 + 2]], median) <= s2) d[i * 4 + 3] = 100;
  }
}

function alphaBounds(img, w, h) {
  const d = img.data;
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (d[(y * w + x) * 4 + 3] >= 128) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  }
  if (x1 < 0) return { x: 0, y: 0, w, h };
  return { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}

// Returns a supersampled canvas region aligned to the target grid.
// prep: { work: ImageData (w*S × h*S), S, w, h, box: {x,y,w,h} in target pixels }
export function prepare(source, opts) {
  const { width, height, padding, removeBg, bgTolerance } = opts;
  const maxDim = 640;
  const scale = Math.min(1, maxDim / Math.max(source.width, source.height));
  const sw = Math.max(1, Math.round(source.width * scale)), sh = Math.max(1, Math.round(source.height * scale));
  const c1 = new OffscreenCanvas(sw, sh);
  const x1 = c1.getContext('2d', { willReadFrequently: true });
  x1.imageSmoothingQuality = 'high';
  x1.drawImage(source, 0, 0, sw, sh);
  const img = x1.getImageData(0, 0, sw, sh);
  if (removeBg) removeBackground(img, sw, sh, bgTolerance);
  x1.putImageData(img, 0, 0);
  const b = alphaBounds(img, sw, sh);

  const GW = width, GH = height;
  const innerW = Math.max(1, GW - padding * 2), innerH = Math.max(1, GH - padding * 2);
  const k = Math.min(innerW / b.w, innerH / b.h);
  const tw = Math.max(1, Math.min(innerW, Math.round(b.w * k))), th = Math.max(1, Math.min(innerH, Math.round(b.h * k)));
  const ox = Math.floor((GW - tw) / 2), oy = Math.floor((GH - th) / 2);
  // supersampling factor: plenty for small badges, capped so big canvases stay fast
  const S = Math.max(3, Math.min(10, Math.floor(1400 / Math.max(GW, GH))));
  const c2 = new OffscreenCanvas(GW * S, GH * S);
  const x2 = c2.getContext('2d', { willReadFrequently: true });
  x2.imageSmoothingQuality = 'high';
  x2.drawImage(c1, b.x, b.y, b.w, b.h, ox * S, oy * S, tw * S, th * S);
  return { work: x2.getImageData(0, 0, GW * S, GH * S), S, w: GW, h: GH, box: { x: ox, y: oy, w: tw, h: th } };
}

// ---------- stage 2: palette ----------
export function buildPalette(prep, opts) {
  const d = prep.work.data;
  const n = d.length / 4;
  const rnd = mulberry32(1234);
  const samples = [];
  const step = Math.max(1, Math.floor(n / 24000));
  for (let i = 0; i < n; i += step) {
    if (d[i * 4 + 3] < 160) continue;
    samples.push(toOklab(d[i * 4], d[i * 4 + 1], d[i * 4 + 2]));
  }
  if (!samples.length) return [];
  const K = opts.maxColors === 'auto' ? 14 : opts.maxColors;

  // k-means++ init
  const cents = [samples[Math.floor(rnd() * samples.length)].slice()];
  const dmin = new Float32Array(samples.length).fill(Infinity);
  while (cents.length < Math.min(K, samples.length)) {
    let sum = 0;
    const last = cents[cents.length - 1];
    for (let i = 0; i < samples.length; i++) { dmin[i] = Math.min(dmin[i], dist2(samples[i], last)); sum += dmin[i]; }
    if (sum === 0) break;
    let r = rnd() * sum, idx = 0;
    while (r > dmin[idx] && idx < samples.length - 1) { r -= dmin[idx]; idx++; }
    cents.push(samples[idx].slice());
  }
  const assign = new Int32Array(samples.length);
  for (let it = 0; it < 16; it++) {
    const acc = cents.map(() => [0, 0, 0, 0]);
    for (let i = 0; i < samples.length; i++) {
      let bi = 0, bd = Infinity;
      for (let c = 0; c < cents.length; c++) { const dd = dist2(samples[i], cents[c]); if (dd < bd) { bd = dd; bi = c; } }
      assign[i] = bi;
      const a = acc[bi]; a[0] += samples[i][0]; a[1] += samples[i][1]; a[2] += samples[i][2]; a[3]++;
    }
    for (let c = 0; c < cents.length; c++) if (acc[c][3]) cents[c] = [acc[c][0] / acc[c][3], acc[c][1] / acc[c][3], acc[c][2] / acc[c][3]];
  }
  let clusters = cents.map((c, i) => ({ lab: c, count: 0, id: i }));
  for (let i = 0; i < samples.length; i++) clusters[assign[i]].count++;
  clusters = clusters.filter((c) => c.count > 0);

  // merge near-duplicate shades so a big navy area stays one colour
  const mergeT = (0.02 + (opts.merge / 100) * 0.1) ** 2;
  const minShare = opts.maxColors === 'auto' ? 0.012 : 0.004;
  let merged = true;
  while (merged && clusters.length > 1) {
    merged = false;
    let bi = -1, bj = -1, bd = Infinity;
    for (let i = 0; i < clusters.length; i++) for (let j = i + 1; j < clusters.length; j++) {
      const dd = dist2(clusters[i].lab, clusters[j].lab);
      if (dd < bd) { bd = dd; bi = i; bj = j; }
    }
    const small = clusters.reduce((m, c, i) => (c.count < clusters[m].count ? i : m), 0);
    if (bd < mergeT) {
      mergeInto(clusters, bi, bj);
      merged = true;
    } else if (clusters[small].count < samples.length * minShare) {
      // drop anti-aliasing fringe colours into their nearest neighbour
      let nj = -1, nd = Infinity;
      for (let j = 0; j < clusters.length; j++) if (j !== small) { const dd = dist2(clusters[small].lab, clusters[j].lab); if (dd < nd) { nd = dd; nj = j; } }
      clusters[nj].count += clusters[small].count;
      clusters.splice(small, 1);
      merged = true;
    }
  }
  // pick each palette colour as the real source colour nearest its centroid (keeps colours "true")
  const pal = clusters.map((c) => ({ lab: c.lab, rgb: null, best: Infinity, count: c.count }));
  for (let i = 0; i < n; i += step) {
    if (d[i * 4 + 3] < 160) continue;
    const lab = toOklab(d[i * 4], d[i * 4 + 1], d[i * 4 + 2]);
    for (const p of pal) { const dd = dist2(lab, p.lab); if (dd < p.best) { p.best = dd; p.rgb = [d[i * 4], d[i * 4 + 1], d[i * 4 + 2]]; } }
  }
  return pal.filter((p) => p.rgb).sort((a, b) => b.count - a.count).map((p) => ({ rgb: p.rgb, lab: toOklab(...p.rgb) }));
}
function mergeInto(clusters, i, j) {
  const a = clusters[i], b = clusters[j];
  const t = a.count + b.count;
  a.lab = [0, 1, 2].map((k) => (a.lab[k] * a.count + b.lab[k] * b.count) / t);
  a.count = t;
  clusters.splice(j, 1);
}

// ---------- stage 3: sample to grid ----------
// returns { w, h, idx: Int16Array (-1 = transparent), votes: Float32Array[w*h][P], cover }
export function sampleGrid(prep, palette, opts) {
  const { w: GW, h: GH, S } = prep;
  const d = prep.work.data;
  const SW = GW * S;
  const P = palette.length;
  const votes = new Float32Array(GW * GH * P);
  const cover = new Float32Array(GW * GH);
  const cache = new Map();
  const nearest = (r, g, b) => {
    const key = (r << 16) | (g << 8) | b;
    let v = cache.get(key);
    if (v === undefined) {
      const lab = toOklab(r, g, b);
      let bd = Infinity; v = 0;
      for (let p = 0; p < P; p++) { const dd = dist2(lab, palette[p].lab); if (dd < bd) { bd = dd; v = p; } }
      cache.set(key, v);
    }
    return v;
  };
  // centre-weighted votes so thin details survive and edge bleed counts less
  const wts = new Float32Array(S * S);
  for (let sy = 0; sy < S; sy++) for (let sx = 0; sx < S; sx++) {
    const dx = (sx + 0.5) / S - 0.5, dy = (sy + 0.5) / S - 0.5;
    wts[sy * S + sx] = Math.exp(-(dx * dx + dy * dy) / 0.18);
  }
  const wsum = wts.reduce((a, b) => a + b, 0);
  for (let gy = 0; gy < GH; gy++) for (let gx = 0; gx < GW; gx++) {
    const g = gy * GW + gx;
    let a = 0;
    for (let sy = 0; sy < S; sy++) for (let sx = 0; sx < S; sx++) {
      const i = ((gy * S + sy) * SW + gx * S + sx) * 4;
      const al = d[i + 3] / 255;
      const wt = wts[sy * S + sx];
      a += al * wt;
      if (al > 0.5 && P) votes[g * P + nearest(d[i], d[i + 1], d[i + 2])] += wt * al;
    }
    cover[g] = a / wsum;
  }
  const idx = new Int16Array(GW * GH).fill(-1);
  for (let g = 0; g < GW * GH; g++) {
    if (cover[g] < opts.alphaCut / 100 || !P) continue;
    let bp = 0, bv = -1;
    for (let p = 0; p < P; p++) if (votes[g * P + p] > bv) { bv = votes[g * P + p]; bp = p; }
    idx[g] = bp;
  }
  return { w: GW, h: GH, idx, votes, cover, P };
}

// ---------- stage 4: shape ----------
export function detectCircle(grid, box) {
  const { w: GW, h: GH, idx } = grid;
  let area = 0, cx = 0, cy = 0;
  for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) if (idx[y * GW + x] >= 0) { area++; cx += x + 0.5; cy += y + 0.5; }
  if (area < 20) return null;
  cx /= area; cy /= area;
  const aspect = box.w / box.h;
  if (aspect < 0.88 || aspect > 1.12) return null;
  const r = Math.sqrt(area / Math.PI);
  let inter = 0, uni = 0;
  for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) {
    const inC = (x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2 <= r * r;
    const inM = idx[y * GW + x] >= 0;
    if (inC && inM) inter++;
    if (inC || inM) uni++;
  }
  const iou = inter / uni;
  return iou > 0.9 ? { iou } : null;
}

function circleMask(GW, GH, box) {
  const dia = Math.max(box.w, box.h);
  const cx = box.x + box.w / 2, cy = box.y + box.h / 2;
  const r = dia / 2;
  const m = new Uint8Array(GW * GH);
  // threshold slightly inside r gives the classic stepped pixel circle (flat runs on each side)
  const rr = (r - 0.08) ** 2;
  for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) {
    if ((x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2 <= rr) m[y * GW + x] = 1;
  }
  return m;
}

function applyMask(grid, mask) {
  const { w: GW, h: GH, idx, votes, P } = grid;
  for (let g = 0; g < GW * GH; g++) if (!mask[g]) idx[g] = -1;
  // fill newly-included pixels: best vote, else nearest filled neighbour
  for (let pass = 0; pass < GW + GH; pass++) {
    let missing = 0;
    for (let g = 0; g < GW * GH; g++) {
      if (!mask[g] || idx[g] >= 0) continue;
      let bp = -1, bv = 0;
      for (let p = 0; p < P; p++) if (votes[g * P + p] > bv) { bv = votes[g * P + p]; bp = p; }
      if (bp >= 0 && pass === 0) { idx[g] = bp; continue; }
      const x = g % GW, y = (g / GW) | 0;
      const nb = [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]].filter(([a, b]) => a >= 0 && b >= 0 && a < GW && b < GH).map(([a, b]) => idx[b * GW + a]).filter((v) => v >= 0);
      if (nb.length) idx[g] = nb[0]; else missing++;
    }
    if (!missing) break;
  }
}

// chessboard distance from outside (1 = outermost ring)
function depthMap(grid) {
  const { w: GW, h: GH, idx } = grid;
  const depth = new Int16Array(GW * GH);
  const q = [];
  for (let g = 0; g < GW * GH; g++) {
    if (idx[g] < 0) continue;
    const x = g % GW, y = (g / GW) | 0;
    let edge = false;
    for (let dy = -1; dy <= 1 && !edge; dy++) for (let dx = -1; dx <= 1; dx++) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= GW || ny >= GH || idx[ny * GW + nx] < 0) { edge = true; break; }
    }
    if (edge) { depth[g] = 1; q.push(g); }
  }
  for (let h = 0; h < q.length; h++) {
    const g = q[h];
    const x = g % GW, y = (g / GW) | 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= GW || ny >= GH) continue;
      const j = ny * GW + nx;
      if (idx[j] >= 0 && !depth[j]) { depth[j] = depth[g] + 1; q.push(j); }
    }
  }
  return depth;
}

// make each outer ring a single colour when it is clearly meant to be one
function cleanRings(grid, strength) {
  const { w: GW, h: GH, idx, votes, P } = grid;
  const depth = depthMap(grid);
  const maxBand = Math.max(2, Math.round(Math.min(GW, GH) / 7));
  const need = 0.9 - strength * 0.38; // strength 0..1
  for (let band = 1; band <= maxBand; band++) {
    const cells = [];
    for (let g = 0; g < GW * GH; g++) if (depth[g] === band) cells.push(g);
    if (cells.length < 4) break;
    const tally = new Float32Array(P);
    for (const g of cells) tally[idx[g]]++;
    let bp = 0;
    for (let p = 1; p < P; p++) if (tally[p] > tally[bp]) bp = p;
    if (tally[bp] / cells.length < need) break;
    for (const g of cells) idx[g] = bp;
  }
  void votes;
}

// ---------- stage 5: symmetry ----------
export function symmetryScores(grid, box) {
  const { w: GW, h: GH, idx } = grid;
  const axis2 = box.x * 2 + box.w; // x + x' = axis2 - 1
  // colour symmetry ignores pairs that are both the main fill colour, otherwise a big
  // navy field makes asymmetric details (like "FHP" lettering) look symmetric
  const counts = new Map();
  for (const v of idx) if (v >= 0) counts.set(v, (counts.get(v) || 0) + 1);
  let main = -1, mc = 0;
  for (const [v, c] of counts) if (c > mc) { mc = c; main = v; }
  let mPairs = 0, mSame = 0, cPairs = 0, cSame = 0;
  for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) {
    const xm = axis2 - 1 - x;
    if (xm <= x || xm >= GW) continue;
    const a = idx[y * GW + x], b = idx[y * GW + xm];
    if (a < 0 && b < 0) continue;
    mPairs++;
    if ((a >= 0) === (b >= 0)) mSame++;
    if (a >= 0 && b >= 0 && !(a === main && b === main)) { cPairs++; if (a === b) cSame++; }
  }
  let opaque = 0;
  for (const v of idx) if (v >= 0) opaque++;
  return {
    shape: mPairs ? mSame / mPairs : 1,
    colour: cPairs ? cSame / cPairs : 1,
    // mismatched colour pairs relative to badge area: text/lettering pushes this up fast
    colourMismatch: opaque ? (cPairs - cSame) / opaque : 0,
  };
}

function mirror(grid, box, colours) {
  const { w: GW, h: GH, idx, votes, cover, P } = grid;
  const axis2 = box.x * 2 + box.w;
  for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) {
    const xm = axis2 - 1 - x;
    if (xm <= x || xm >= GW) continue;
    const g = y * GW + x, h = y * GW + xm;
    const a = idx[g], b = idx[h];
    if ((a >= 0) !== (b >= 0)) {
      // keep the pixel if the pair is mostly covered on average
      const keep = (cover[g] + cover[h]) / 2 >= 0.45;
      if (keep) { const v = a >= 0 ? a : b; idx[g] = idx[g] >= 0 ? idx[g] : v; idx[h] = idx[h] >= 0 ? idx[h] : v; }
      else { idx[g] = -1; idx[h] = -1; }
    }
    if (colours && idx[g] >= 0 && idx[g] !== idx[h]) {
      let bp = idx[g], bv = -1;
      for (let p = 0; p < P; p++) { const v = votes[g * P + p] + votes[h * P + p]; if (v > bv) { bv = v; bp = p; } }
      idx[g] = idx[h] = bp;
    }
  }
}

// ---------- stage 6: tidy ----------
function despeckle(grid) {
  const { w: GW, h: GH, idx } = grid;
  const out = idx.slice();
  for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) {
    const g = y * GW + x;
    const me = idx[g];
    if (me < 0) continue;
    const nb = [];
    if (x > 0) nb.push(idx[g - 1]); if (x < GW - 1) nb.push(idx[g + 1]);
    if (y > 0) nb.push(idx[g - GW]); if (y < GH - 1) nb.push(idx[g + GW]);
    if (nb.includes(me)) continue;
    const counts = new Map();
    for (const v of nb) if (v >= 0) counts.set(v, (counts.get(v) || 0) + 1);
    for (const [v, c] of counts) if (c >= 3) { out[g] = v; break; }
  }
  idx.set(out);
}

function addOutline(grid, outlineIdx) {
  const { w: GW, h: GH, idx } = grid;
  const add = [];
  for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) {
    const g = y * GW + x;
    if (idx[g] >= 0) continue;
    const touch = (x > 0 && idx[g - 1] >= 0) || (x < GW - 1 && idx[g + 1] >= 0) || (y > 0 && idx[g - GW] >= 0) || (y < GH - 1 && idx[g + GW] >= 0);
    if (touch) add.push(g);
  }
  for (const g of add) idx[g] = outlineIdx;
}

// ---------- full pipeline ----------
export function pixelize(source, opts) {
  // leave a pixel of room so an added outline isn't clipped by the canvas edge
  const prep = prepare(source, opts.outline !== 'none' ? { ...opts, padding: opts.padding + 1 } : opts);
  let palette = buildPalette(prep, opts);
  const grid = sampleGrid(prep, palette, opts);
  const report = { colours: 0, circle: false, symmetry: 'off' };

  const circ = opts.shape === 'circle' || (opts.shape === 'auto' && detectCircle(grid, prep.box));
  if (circ) { applyMask(grid, circleMask(prep.w, prep.h, prep.box)); report.circle = true; }

  if (opts.rings > 0) cleanRings(grid, opts.rings / 100);

  const sym = symmetryScores(grid, prep.box);
  let symMode = opts.symmetry;
  // auto only mirrors colours when the badge is already almost perfectly symmetric
  // (so lettering never gets flipped); otherwise just the silhouette
  if (symMode === 'auto') symMode = sym.colourMismatch < 0.012 && sym.shape > 0.9 ? 'full' : sym.shape > 0.88 ? 'shape' : 'off';
  if (circ && symMode === 'shape') symMode = 'off'; // circle mask is already symmetric
  if (symMode === 'shape' || symMode === 'full') mirror(grid, prep.box, symMode === 'full');
  report.symmetry = symMode;
  report.symScores = sym;

  if (opts.despeckle) despeckle(grid);

  if (opts.outline !== 'none') {
    let oi;
    if (opts.outline === 'darkest') {
      oi = palette.reduce((m, p, i) => (p.lab[0] < palette[m].lab[0] ? i : m), 0);
    } else {
      const rgb = hexToRgb(opts.outlineColor);
      oi = palette.findIndex((p) => p.rgb.every((v, k) => v === rgb[k]));
      if (oi < 0) { palette = [...palette, { rgb, lab: toOklab(...rgb) }]; oi = palette.length - 1; }
    }
    addOutline(grid, oi);
  }

  // drop unused palette entries, renumber
  const used = new Set(grid.idx.filter((v) => v >= 0));
  const remap = new Map();
  const finalPal = [];
  palette.forEach((p, i) => { if (used.has(i)) { remap.set(i, finalPal.length); finalPal.push(p.rgb); } });
  const idx = Int16Array.from(grid.idx, (v) => (v < 0 ? -1 : remap.get(v)));
  report.colours = finalPal.length;
  return { w: prep.w, h: prep.h, idx, palette: finalPal, box: prep.box, report };
}

export function hexToRgb(hex) {
  const h = hex.replace('#', '');
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
}
export function rgbToHex([r, g, b]) {
  return '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('');
}

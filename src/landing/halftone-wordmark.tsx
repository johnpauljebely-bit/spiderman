import { useEffect, useRef } from 'react';
import { hwfRadius, hwfStep, hwfWarmth } from './halftone-physics';

// The footer's giant "Move", printed as halftone dots with the logo standing in for the M. It borrows the
// Halftone Wordmark Footer's mechanics (dots sized by letter coverage, pushed aside by the pointer on springs,
// a shock ring on click) but keeps this site's look: faint white dots, fading out towards the bottom.
const MARK = '/move-logo.svg';
const MARK_ASPECT = 920 / 581;
const FONT = '"Instrument Sans Variable", "Helvetica Neue", Arial, sans-serif';
const GAP = 5; // px between dot centres
const PUSH = 80; // px the pointer reaches
const REST = 0.1; // dot opacity at rest (the old wordmark's colour)
const STIRRED = 0.42; // opacity of a dot pushed well off its place

export function HalftoneWordmark({ className = '' }: { className?: string }) {
  const box = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const root = box.current;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!root || !canvas || !ctx) return;

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let w = 0;
    let h = 0;
    let dpr = 1;
    let px = -1e5;
    let py = -1e5;
    let raf = 0;
    let visible = true;
    let alive = true;
    let ring = { x: 0, y: 0, t: -1 };
    let dots = new Float32Array(0); // x, y, vx, vy, hx, hy, r per dot
    let count = 0;
    const mark = new Image();
    mark.src = MARK;

    const layout = () => {
      w = Math.max(1, Math.round(root.clientWidth));
      const size = w * 0.26;
      h = Math.max(1, Math.round(size * 0.8));
      root.style.height = `${h}px`;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);

      // Set the word once on a 1x mask: the logo as the M, then "ove", sitting on the baseline.
      const mask = document.createElement('canvas');
      mask.width = w;
      mask.height = h;
      const m = mask.getContext('2d', { willReadFrequently: true });
      if (!m) return;
      const baseline = size * 0.78;
      const markH = size * 0.7;
      const markW = markH * MARK_ASPECT;
      const left = w * 0.025;
      if (mark.complete && mark.naturalWidth) m.drawImage(mark, left, baseline - markH, markW, markH);
      m.font = `600 ${size}px ${FONT}`;
      m.letterSpacing = `${-0.05 * size}px`;
      m.textBaseline = 'alphabetic';
      m.fillStyle = '#000';
      m.fillText('ove', left + markW + size * 0.01, baseline);
      const img = m.getImageData(0, 0, w, h).data;

      const tmp: number[] = [];
      for (let gy = 0; gy < Math.ceil(h / GAP); gy++) {
        for (let gx = 0; gx < Math.ceil(w / GAP); gx++) {
          let sum = 0; // coverage: average alpha over a 3×3 sample of the cell
          for (let sy = 0; sy < 3; sy++) {
            for (let sx = 0; sx < 3; sx++) {
              const x = Math.min(w - 1, Math.floor(gx * GAP + ((sx + 0.5) * GAP) / 3));
              const y = Math.min(h - 1, Math.floor(gy * GAP + ((sy + 0.5) * GAP) / 3));
              sum += img[(y * w + x) * 4 + 3];
            }
          }
          const cover = sum / (9 * 255);
          if (cover < 0.06) continue;
          const hx = gx * GAP + GAP / 2;
          const hy = gy * GAP + GAP / 2;
          tmp.push(hx, hy, 0, 0, hx, hy, hwfRadius(cover, GAP));
        }
      }
      dots = new Float32Array(tmp);
      count = tmp.length / 7;
    };

    const draw = (now: number) => {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      const ringAge = ring.t < 0 ? 1e9 : now - ring.t;
      const ringR = ringAge * 0.9;
      let moving = false;
      for (let i = 0; i < count; i++) {
        const j = i * 7;
        let x = dots[j];
        let y = dots[j + 1];
        let vx = dots[j + 2];
        let vy = dots[j + 3];
        const hx = dots[j + 4];
        const hy = dots[j + 5];
        if (!reduced) {
          if (ringAge < 900) {
            const dx = hx - ring.x;
            const dy = hy - ring.y;
            const d = Math.sqrt(dx * dx + dy * dy) + 0.001;
            const band = 1 - Math.min(1, Math.abs(d - ringR) / 26);
            if (band > 0) {
              const f = band * 3.2 * (1 - ringAge / 900);
              vx += (dx / d) * f;
              vy += (dy / d) * f;
            }
          }
          [x, y, vx, vy] = hwfStep(x, y, vx, vy, hx, hy, px, py, PUSH);
          if (Math.abs(vx) + Math.abs(vy) > 0.02 || Math.abs(x - hx) + Math.abs(y - hy) > 0.05) moving = true;
          else {
            x = hx;
            y = hy;
            vx = vy = 0;
          }
          dots[j] = x;
          dots[j + 1] = y;
          dots[j + 2] = vx;
          dots[j + 3] = vy;
        }
        const stir = hwfWarmth(x, y, hx, hy, 28);
        ctx.fillStyle = `rgb(255 255 255 / ${REST + (STIRRED - REST) * stir})`;
        ctx.beginPath();
        ctx.arc(x, y, dots[j + 6], 0, Math.PI * 2);
        ctx.fill();
      }
      return moving || ringAge < 900 || px > -1e4; // sleep once everything is home
    };

    const loop = (now: number) => {
      raf = 0;
      if (visible && draw(now)) raf = requestAnimationFrame(loop);
    };
    const wake = () => {
      if (!raf && visible) raf = requestAnimationFrame(loop);
    };
    const local = (e: PointerEvent) => {
      const b = canvas.getBoundingClientRect();
      return [e.clientX - b.left, e.clientY - b.top];
    };
    const onMove = (e: PointerEvent) => {
      [px, py] = local(e);
      wake();
    };
    const onLeave = () => {
      px = py = -1e5;
      wake();
    };
    const onDown = (e: PointerEvent) => {
      if (reduced) return;
      const [x, y] = local(e);
      ring = { x, y, t: performance.now() };
      wake();
    };
    const relayout = () => {
      if (!alive) return;
      layout();
      draw(performance.now());
      wake();
    };

    // Lay out now, and again once the font and the logo have actually arrived.
    relayout();
    Promise.all([document.fonts.load(`600 100px ${FONT}`), mark.decode().catch(() => {})]).then(relayout);

    root.addEventListener('pointermove', onMove);
    root.addEventListener('pointerleave', onLeave);
    root.addEventListener('pointerdown', onDown);
    let lastWidth = root.clientWidth;
    const resize = new ResizeObserver(() => {
      if (root.clientWidth !== lastWidth) {
        lastWidth = root.clientWidth;
        relayout();
      }
    });
    resize.observe(root);
    const seen = new IntersectionObserver((entries) => {
      visible = entries[0]?.isIntersecting ?? true;
      if (visible) wake();
    });
    seen.observe(root);

    return () => {
      alive = false;
      cancelAnimationFrame(raf);
      resize.disconnect();
      seen.disconnect();
      root.removeEventListener('pointermove', onMove);
      root.removeEventListener('pointerleave', onLeave);
      root.removeEventListener('pointerdown', onDown);
    };
  }, []);

  return (
    <div ref={box} className={`halftone-wordmark ${className}`} aria-hidden="true">
      <canvas ref={canvasRef} />
    </div>
  );
}

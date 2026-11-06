// Menu, routing, inner pages, lightbox and the halftone footer. The home scene lives in scene.js.
(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const body = document.body;
  const projects = window.VCE_PROJECTS || [];
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const pad = n => String(n).padStart(2, '0');

  /* ---------- Menu (Jet PDP) ---------- */
  const menu = $('#menu');
  const menuBtn = $('#menuBtn');
  let menuOpen = false;
  function setMenu(open) {
    menuOpen = open;
    toneDirty = true;
    body.classList.toggle('menu-on', open);
    menu.classList.toggle('open', open);
    menu.setAttribute('aria-hidden', String(!open));
    menu.inert = !open;
    menuBtn.setAttribute('aria-expanded', String(open));
    if (open) {
      hideHint();
      $('.links a', menu).focus({ preventScroll: true });
    }
    else if (menu.contains(document.activeElement) || document.activeElement === body) menuBtn.focus({ preventScroll: true });
  }
  menuBtn.addEventListener('click', () => setMenu(!menuOpen));
  // A different route closes the menu once the wipe covers it, so only same-route clicks close it here
  $$('.links a[href^="#"]', menu).forEach(a => a.addEventListener('click', () => {
    if (routeOf(a.getAttribute('href')).key === current.key) setMenu(false);
  }));
  // No Instagram account linked yet, so that one stays inert
  $$('[data-noop]').forEach(a => a.addEventListener('click', e => e.preventDefault()));

  // Off the home page the logo goes home
  $('.power').addEventListener('click', () => {
    hideHint();
    if (!body.classList.contains('at-home')) location.hash = '#/';
  });

  /* ---------- First visit on this device: an arrow pointing at the logo ---------- */
  const hint = $('#hint');
  const HINT_KEY = 'vce-hint-seen';
  let hintTimer = 0;
  const hintSeen = () => { try { return localStorage.getItem(HINT_KEY) === '1'; } catch { return false; } };
  function queueHint() {
    if (hintTimer || hintSeen()) return;
    hintTimer = setTimeout(showHint, 1700); // once the headline has finished coming in
  }
  function showHint() {
    hintTimer = 0;
    if (hintSeen() || !body.classList.contains('at-home') || menuOpen) return;
    try { localStorage.setItem(HINT_KEY, '1'); } catch {}
    if (matchMedia('(hover: none)').matches) $('.hint-verb', hint).textContent = 'Tap';
    hint.hidden = false;
    requestAnimationFrame(() => requestAnimationFrame(() => hint.classList.add('on')));
  }
  function hideHint() {
    clearTimeout(hintTimer);
    hintTimer = 0;
    if (hint.hidden || hint.classList.contains('off')) return;
    hint.classList.add('off');
    setTimeout(() => { hint.hidden = true; }, 400);
  }

  /* ---------- Content ---------- */
  // Card shapes follow the work, in data.js order: Clothing and Embed Banners wide, the two logo sets square,
  // Misc (a poster cover) upright. See .work-grid in site.css.
  const SPANS = ['wide', 'wide', 'square', 'square', 'tall'];
  $('#workGrid').innerHTML = projects.map((p, i) => `
    <a class="card rv ${SPANS[i % SPANS.length]}${p.contain ? ' contain' : ''}" href="#/work/${p.slug}">
      <figure><img src="${p.cover.sm}" width="${p.cover.w}" height="${p.cover.h}" alt="${esc(p.title)}: cover image" loading="lazy" decoding="async"></figure>
      <div class="card-meta"><span class="num">${pad(i + 1)}</span><h3>${esc(p.title)}</h3><span class="card-tags">${p.tags.map(esc).join(' · ')}</span>${p.price ? `<span class="card-price">${esc(p.price)}</span>` : ''}</div>
    </a>`).join('');

  $('#aboutRows').innerHTML = projects.map((p, i) => `
    <li class="rv"><a href="#/work/${p.slug}"><span class="num">${pad(i + 1)}</span><h3>${esc(p.title)}</h3><p>${esc(p.short)}</p><span class="go">See the work &rarr;</span></a></li>`).join('');

  $('#footWork').innerHTML = projects.slice(0, 4).map(p => `<li><a href="#/work/${p.slug}">${esc(p.title)}</a></li>`).join('')
    + '<li><a href="#/work">All work</a></li>';

  // Two-line title: the last word in italic, as in the other headlines
  function titleLines(title) {
    const words = title.toUpperCase().split(' ');
    const last = words.pop();
    return (words.length ? `<span class="t" data-t>${esc(words.join(' '))}</span>` : '') + `<span class="t it" data-t>${esc(last)}</span>`;
  }

  let shots = [];
  function renderProject(slug) {
    const i = projects.findIndex(p => p.slug === slug);
    const p = projects[i];
    if (!p) return false;
    const next = projects[(i + 1) % projects.length];
    $('#pjCount').textContent = `${pad(i + 1)} / ${pad(projects.length)}`;
    $('#pjTitle').innerHTML = titleLines(p.title);
    $('#pjDesc').textContent = p.desc;
    const rows = [
      ['Role', p.role],
      ['Scope', p.tags.join(' · ')],
      ['In this set', p.video ? 'In-game clip' : `${p.images.length} ${p.images.length === 1 ? 'piece' : 'pieces'}`],
    ];
    $('#pjSpec').innerHTML = rows.map(([k, v]) => `<div><dt>${k}</dt><dd>${esc(v)}</dd></div>`).join('')
      + (p.price ? `<div class="is-price"><dt>Price</dt><dd>${esc(p.price)}${p.price_note ? `<small>${esc(p.price_note)}</small>` : ''}</dd></div>` : '');
    $('#pjCta').textContent = p.cta || 'Start a commission';
    // Beside the title: an illustration, not the work (the work is the gallery below)
    $('#pjCover').innerHTML = `<img src="${p.art.src}" width="${p.art.w}" height="${p.art.h}" alt="">`;
    const g = $('#pjGallery');
    g.className = `gallery wrap ${p.video ? 'single' : p.layout || ''}`;
    shots = p.images;
    g.innerHTML = p.video
      ? `<video src="${p.video}" poster="${p.cover.src}" controls muted loop playsinline preload="metadata"></video>`
      : p.images.map((im, k) => `
        <button class="shot rv" type="button" data-k="${k}" aria-label="Open image ${k + 1} of ${p.images.length}">
          <img src="${im.sm}" width="${im.w}" height="${im.h}" alt="${esc(p.title)}, piece ${k + 1}" loading="lazy" decoding="async">
        </button>`).join('');
    const nx = $('#pjNext');
    nx.href = `#/work/${next.slug}`;
    $('span', nx).textContent = next.title.toUpperCase();
    return true;
  }

  /* ---------- Lightbox ---------- */
  const lb = $('#lightbox');
  // Made here rather than in the markup so there's never an <img> without a src
  const lbImg = lb.insertBefore(document.createElement('img'), lb.firstChild);
  let lbAt = 0;
  let lbFrom = null;
  function showShot(k) {
    lbAt = (k + shots.length) % shots.length;
    const im = shots[lbAt];
    lbImg.src = im.src;
    lbImg.alt = `Image ${lbAt + 1} of ${shots.length}`;
    $('#lbCount').textContent = `${lbAt + 1} / ${shots.length}`;
  }
  function openLightbox(k) {
    lbFrom = document.activeElement;
    showShot(k);
    lb.hidden = false;
    $('.lb-close', lb).focus({ preventScroll: true });
  }
  function closeLightbox() {
    lb.hidden = true;
    lbImg.removeAttribute('src');
    lbFrom && lbFrom.focus({ preventScroll: true });
  }
  $('#pjGallery').addEventListener('click', e => {
    const b = e.target.closest('.shot');
    if (b) openLightbox(Number(b.dataset.k));
  });
  $('.lb-close', lb).addEventListener('click', closeLightbox);
  $('.lb-prev', lb).addEventListener('click', () => showShot(lbAt - 1));
  $('.lb-next', lb).addEventListener('click', () => showShot(lbAt + 1));
  lb.addEventListener('click', e => { if (e.target === lb) closeLightbox(); });

  addEventListener('keydown', e => {
    if (!lb.hidden) {
      if (e.key === 'Escape') closeLightbox();
      else if (e.key === 'ArrowLeft') showShot(lbAt - 1);
      else if (e.key === 'ArrowRight') showShot(lbAt + 1);
      else if (e.key === 'Tab') {
        // Keep focus inside the viewer
        const f = $$('button', lb);
        const at = f.indexOf(document.activeElement);
        e.preventDefault();
        f[(at + (e.shiftKey ? -1 : 1) + f.length) % f.length].focus();
      }
      return;
    }
    if (e.key === 'Escape' && menuOpen) setMenu(false);
  });

  /* ---------- Pages and routing (Jet PDP) ---------- */
  const pageEls = Object.fromEntries($$('[data-page]').map(el => [el.dataset.page, el]));
  const foot = $('#siteFoot');
  const wipeEl = $('#wipe');
  const TITLES = { work: 'Work', about: 'About', services: 'Services', contact: 'Contact' };
  let activePage = null;
  let current = { key: null };
  let busy = false;

  function routeOf(hash) {
    const path = hash.replace(/^#\/?/, '').replace(/\/$/, '');
    const [name, slug] = path.split('/');
    if (name === 'work' && slug && projects.some(p => p.slug === slug)) return { name: 'project', slug, key: `work/${slug}` };
    if (TITLES[name]) return { name, key: name };
    return { name: 'home', key: '' };
  }

  function setTitle(route) {
    const p = route.name === 'project' && projects.find(x => x.slug === route.slug);
    const t = p ? p.title : TITLES[route.name];
    document.title = t ? `${t} | Vance Creative Enterprises` : 'Vance Creative Enterprises';
  }

  function revealInView() {
    if (!activePage) return;
    const vh = innerHeight;
    $$('.t:not(.seen)', activePage).forEach(el => {
      if (el.parentElement.getBoundingClientRect().top < vh * .94) {
        const lines = [...el.parentElement.children];
        el.style.transitionDelay = `${.05 + lines.indexOf(el) * .09}s`;
        el.classList.add('seen');
      }
    });
    $$('.rv:not(.seen)', activePage).forEach(el => {
      if (el.getBoundingClientRect().top < vh * .92) el.classList.add('seen');
    });
  }

  function setPage(route) {
    Object.values(pageEls).forEach(el => el.classList.remove('active'));
    $$('video', pageEls.project).forEach(v => v.pause());
    const home = route.name === 'home';
    body.classList.toggle('at-home', home);
    body.classList.toggle('page-on', !home);
    if (home) {
      activePage = null;
      window.VCEScene && (VCEScene.arrive(), VCEScene.label());
      queueHint();
    } else {
      hideHint();
      if (route.name === 'project') renderProject(route.slug);
      const el = pageEls[route.name];
      activePage = el;
      $$('.seen', el).forEach(n => n.classList.remove('seen'));
      $('.foot-slot', el).append(foot);
      el.classList.add('active');
      el.scrollTop = 0;
      $('.power').setAttribute('aria-label', 'Vance Creative Enterprises, home');
      $('.power').removeAttribute('aria-pressed');
      halftone.relayout();
      revealInView();
    }
    toneDirty = true;
  }
  Object.values(pageEls).forEach(el => el.addEventListener('scroll', () => {
    toneDirty = true;
    revealInView();
  }, { passive: true }));
  addEventListener('resize', () => {
    revealInView();
    toneDirty = true;
  });

  function wipe(midway) {
    busy = true;
    if (reduced) {
      midway();
      busy = false;
      return;
    }
    wipeEl.classList.add('run');
    void wipeEl.offsetWidth;
    wipeEl.classList.add('in');
    setTimeout(() => {
      midway();
      wipeEl.classList.add('out');
      setTimeout(() => {
        $$('i', wipeEl).forEach(s => { s.style.transition = 'none'; });
        wipeEl.classList.remove('run', 'in', 'out');
        void wipeEl.offsetWidth;
        $$('i', wipeEl).forEach(s => { s.style.transition = ''; });
        busy = false;
        const next = routeOf(location.hash);
        if (next.key !== current.key) navigate(next);
      }, 900);
    }, 760);
  }

  function navigate(route) {
    if (route.key === current.key) {
      if (menuOpen) setMenu(false);
      return;
    }
    if (busy) return;
    current = route;
    setTitle(route);
    wipe(() => {
      if (menuOpen) setMenu(false);
      setPage(route);
      (activePage || $('.scene')).focus({ preventScroll: true });
    });
  }

  /* ---------- Menu button tone: light or dark, from whatever sits behind it ---------- */
  let toneDirty = true;
  function updateTone() {
    const r = menuBtn.getBoundingClientRect();
    let light = false;
    if (activePage) {
      for (const el of document.elementsFromPoint(r.left + r.width / 2, r.top + r.height / 2)) {
        if (el.closest('.btn-menu, .wipe, .power')) continue;
        if (el.matches('img, video')) break;
        const cs = getComputedStyle(el);
        if (cs.backgroundImage !== 'none') break;
        const [c0, c1, c2, alpha = 1] = cs.backgroundColor.match(/[\d.]+/g).map(Number);
        if (alpha < .5) continue;
        light = .299 * c0 + .587 * c1 + .114 * c2 > 140;
        break;
      }
    }
    body.classList.toggle('menu-light', light);
  }
  (function tick() {
    if (toneDirty) {
      toneDirty = false;
      updateTone();
    }
    requestAnimationFrame(tick);
  })();

  /* ---------- Footer wordmark: "vce" in halftone dots (the Move footer's mechanics) ---------- */
  const halftone = (() => {
    const root = $('#halftone');
    const canvas = $('canvas', root);
    const ctx = canvas.getContext('2d');
    const GAP = 5; // px between dot centres
    const PUSH = 80; // px the pointer reaches
    const REST = .035; // dot opacity at rest
    const STIRRED = .2; // opacity of a dot pushed well off its place
    const markImg = new Image();
    markImg.src = 'assets/brand/mark.png';
    let w = 0, h = 0, dpr = 1, px = -1e5, py = -1e5, raf = 0, visible = false;
    let ring = { x: 0, y: 0, t: -1 };
    let dots = new Float32Array(0); // x, y, vx, vy, hx, hy, r per dot
    let count = 0;

    const radius = c => Math.sqrt(Math.min(1, Math.max(0, c))) * GAP * .56;
    function step(x, y, vx, vy, hx, hy) {
      const dx = x - px, dy = y - py, d2 = dx * dx + dy * dy;
      if (d2 < PUSH * PUSH) {
        const d = Math.sqrt(d2) + .001;
        const f = (1 - d / PUSH) * 2.6;
        vx += (dx / d) * f;
        vy += (dy / d) * f;
      }
      vx = (vx + (hx - x) * .05) * .84;
      vy = (vy + (hy - y) * .05) * .84;
      return [x + vx, y + vy, vx, vy];
    }

    function layout() {
      // Hidden (its page is off) reads as 0 wide: bail without touching w, or draw() stops clearing
      const cw = Math.round(root.clientWidth);
      if (cw < 2 || !markImg.naturalWidth) return false;
      w = cw;
      const aspect = markImg.naturalWidth / markImg.naturalHeight;
      const markW = w * .95;
      const markH = markW / aspect;
      const top = markH * .04;
      h = Math.round(top + markH * .5); // only the top half: the page ends through the middle of the mark
      root.style.height = `${h}px`;
      dpr = Math.min(devicePixelRatio || 1, 2);
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      // Set the mark once on a 1× mask, then read coverage per cell
      const mask = document.createElement('canvas');
      mask.width = w;
      mask.height = h;
      const m = mask.getContext('2d', { willReadFrequently: true });
      m.drawImage(markImg, w * .025, top, markW, markH);
      const img = m.getImageData(0, 0, w, h).data;
      const tmp = [];
      for (let gy = 0; gy < Math.ceil(h / GAP); gy++) {
        for (let gx = 0; gx < Math.ceil(w / GAP); gx++) {
          let sum = 0; // coverage: average alpha over a 3×3 sample of the cell
          for (let sy = 0; sy < 3; sy++) {
            for (let sx = 0; sx < 3; sx++) {
              const x = Math.min(w - 1, Math.floor(gx * GAP + ((sx + .5) * GAP) / 3));
              const y = Math.min(h - 1, Math.floor(gy * GAP + ((sy + .5) * GAP) / 3));
              sum += img[(y * w + x) * 4 + 3];
            }
          }
          const cover = sum / (9 * 255);
          if (cover < .06) continue;
          const hx = gx * GAP + GAP / 2, hy = gy * GAP + GAP / 2;
          tmp.push(hx, hy, 0, 0, hx, hy, radius(cover));
        }
      }
      dots = new Float32Array(tmp);
      count = tmp.length / 7;
      return true;
    }

    function draw(now) {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const ringAge = ring.t < 0 ? 1e9 : now - ring.t;
      const ringR = ringAge * .9;
      let moving = false;
      for (let i = 0; i < count; i++) {
        const j = i * 7;
        let x = dots[j], y = dots[j + 1], vx = dots[j + 2], vy = dots[j + 3];
        const hx = dots[j + 4], hy = dots[j + 5];
        if (!reduced) {
          if (ringAge < 900) {
            const dx = hx - ring.x, dy = hy - ring.y;
            const d = Math.sqrt(dx * dx + dy * dy) + .001;
            const band = 1 - Math.min(1, Math.abs(d - ringR) / 26);
            if (band > 0) {
              const f = band * 3.2 * (1 - ringAge / 900);
              vx += (dx / d) * f;
              vy += (dy / d) * f;
            }
          }
          [x, y, vx, vy] = step(x, y, vx, vy, hx, hy);
          if (Math.abs(vx) + Math.abs(vy) > .02 || Math.abs(x - hx) + Math.abs(y - hy) > .05) moving = true;
          else { x = hx; y = hy; vx = vy = 0; }
          dots[j] = x; dots[j + 1] = y; dots[j + 2] = vx; dots[j + 3] = vy;
        }
        const stir = Math.min(1, Math.hypot(x - hx, y - hy) / 28);
        ctx.fillStyle = `rgb(255 255 255 / ${REST + (STIRRED - REST) * stir})`;
        ctx.beginPath();
        ctx.arc(x, y, dots[j + 6], 0, Math.PI * 2);
        ctx.fill();
      }
      return moving || ringAge < 900 || px > -1e4; // sleep once everything is home
    }

    const loop = now => {
      raf = 0;
      if (visible && draw(now)) raf = requestAnimationFrame(loop);
    };
    const wake = () => { if (!raf && visible) raf = requestAnimationFrame(loop); };
    const local = e => {
      const b = canvas.getBoundingClientRect();
      return [e.clientX - b.left, e.clientY - b.top];
    };
    root.addEventListener('pointermove', e => { [px, py] = local(e); wake(); });
    root.addEventListener('pointerleave', () => { px = py = -1e5; wake(); });
    root.addEventListener('pointerdown', e => {
      if (reduced) return;
      const [x, y] = local(e);
      ring = { x, y, t: performance.now() };
      wake();
    });

    let lastWidth = 0;
    function relayout() {
      const cw = root.clientWidth;
      if (cw === lastWidth && count) return;
      if (!layout()) return;
      lastWidth = cw;
      draw(performance.now());
      wake();
    }
    new ResizeObserver(() => relayout()).observe(root);
    new IntersectionObserver(entries => {
      visible = entries[0]?.isIntersecting ?? false;
      if (visible) wake();
    }).observe(root);
    Promise.resolve(markImg.decode()).catch(() => {}).then(() => { lastWidth = 0; relayout(); });
    return { relayout };
  })();

  /* ---------- Start ---------- */
  const first = routeOf(location.hash);
  current = first;
  setTitle(first);
  setPage(first);
  addEventListener('hashchange', () => navigate(routeOf(location.hash)));
})();

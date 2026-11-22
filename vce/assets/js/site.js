// Menu, routing, inner pages, lightbox and the halftone footer. The walking-crowd home lives in crowd.js.
(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const body = document.body;
  const projects = window.VCE_PROJECTS || [];
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const pad = n => String(n).padStart(2, '0');

  /* ---------- Search panel (a command menu: type to filter, arrows to move, Enter to open) ---------- */
  const searchEl = $('#search');
  const searchBtn = $('#searchBtn');
  const input = $('#cmdInput');
  const list = $('#cmdList');
  const content = $('#cmdContent');
  const hl = $('.cmd-hl', list);
  const emptyEl = $('#cmdEmpty');
  const touch = matchMedia('(hover: none)').matches;
  const isMac = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
  if (!isMac) $$('.k-mod').forEach(k => { k.textContent = 'Ctrl'; });
  let searchOpen = false;
  let activeId = null;
  let pendingJump = null; // a policy card to scroll to once the legal page is showing

  // Lucide icons (ISC), drawn at 24 and shown at 16
  const ICONS = {
    home: '<path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8"/><path d="M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
    grid: '<rect width="7" height="7" x="3" y="3" rx="1"/><rect width="7" height="7" x="14" y="3" rx="1"/><rect width="7" height="7" x="14" y="14" rx="1"/><rect width="7" height="7" x="3" y="14" rx="1"/>',
    user: '<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
    briefcase: '<path d="M16 20V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/><rect width="20" height="14" x="2" y="6" rx="2"/>',
    message: '<path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/>',
    file: '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M16 13H8"/><path d="M16 17H8"/><path d="M10 9H8"/>',
    sparkles: '<path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"/>',
    type: '<polyline points="4 7 4 4 20 4 20 7"/><line x1="9" x2="15" y1="20" y2="20"/><line x1="12" x2="12" y1="4" y2="20"/>',
    pixels: '<rect width="18" height="18" x="3" y="3" rx="2"/><path d="M3 9h18"/><path d="M3 15h18"/><path d="M9 3v18"/><path d="M15 3v18"/>',
    chat: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
    at: '<circle cx="12" cy="12" r="4"/><path d="M16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-4 8"/>',
    scale: '<path d="m16 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z"/><path d="m2 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z"/><path d="M7 21h10"/><path d="M12 3v18"/><path d="M3 7h2c2 0 5-1 7-2 2 1 5 2 7 2h2"/>',
    out: '<path d="M7 7h10v10"/><path d="M7 17 17 7"/>',
    users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  };
  const icon = (name, cls = 'i') => `<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true">${ICONS[name]}</svg>`;

  // Everything the panel can find. `search: true` groups only show while there's a query.
  function groups() {
    const legal = $('[data-page="legal"]');
    return [
      { label: 'Pages', items: [
        { label: 'Home', desc: 'Start here', icon: 'home', href: '#/', kw: 'start landing' },
        { label: 'Work', desc: 'Everything I’ve made', icon: 'grid', href: '#/work', kw: 'portfolio projects' },
        { label: 'About', desc: 'Who’s behind VCE', icon: 'user', href: '#/about', kw: 'vance designer me' },
        { label: 'Services', desc: 'What I make and how ordering works', icon: 'briefcase', href: '#/services', kw: 'commission order process price' },
        { label: 'Contact', desc: 'Start a commission on Discord', icon: 'message', href: '#/contact', kw: 'hire message dm' },
        { label: 'Legal', desc: 'Order policies and privacy', icon: 'file', href: '#/legal', kw: 'terms rules privacy refunds' },
      ] },
      { label: 'Work', items: projects.map(p => ({
        label: p.title, desc: p.tags.join(' · '), thumb: p.cover.sm, href: `#/work/${p.slug}`,
        meta: p.price || '', kw: `${p.short || ''} ${p.role || ''}`,
      })) },
      { label: 'Tools', items: [
        // Free for everyone in the Vance Collective Discord: each tool asks them to sign in with Discord first
        { label: 'Ani Panel', desc: 'Animate your logo', icon: 'sparkles', href: '/anipanel', meta: 'Free for members', kw: 'animation logo animator move video free discord' },
        { label: 'Hello Glass', desc: 'Liquid glass lettering', icon: 'type', href: '/helloglass/', meta: 'Free for members', kw: 'text type glass video free discord' },
        { label: 'Patch Pixelizer', desc: 'Turn a logo into a pixel patch', icon: 'pixels', href: '/patchpixelizer/', meta: 'Free for members', kw: 'badge uniform pixel art tessera free discord' },
        { label: 'Join Vance Collective', desc: 'The Discord server. Members use every tool free', icon: 'users', href: 'https://discord.gg/r8BqJbk7ga', external: true, kw: 'discord server community invite members free access unlock' },
      ] },
      { label: 'Policies', search: true, items: $$('.policy > li', legal).map(li => ({
        label: $('h3', li).textContent,
        desc: li.closest('section').dataset.toc,
        icon: 'scale', href: '#/legal', jump: li.id, kw: $('p', li).textContent,
      })) },
      { label: 'Elsewhere', items: [
        { label: 'Discord', desc: 'Message me directly', icon: 'chat', href: 'https://discord.com/users/1349737404449296414', external: true, kw: 'dm social' },
        { label: 'Instagram', desc: 'Not linked yet', icon: 'at', disabled: true, meta: 'Soon', kw: 'social' },
      ] },
    ];
  }

  let items = []; // { el, text, group }
  function build() {
    let n = 0;
    content.innerHTML = groups().map((g, gi) => `
      <div class="cmd-group" role="group" aria-labelledby="cmdg${gi}"${g.search ? ' data-search' : ''}>
        <div class="cmd-label" id="cmdg${gi}">${esc(g.label)}</div>
        ${g.items.map(it => `
          <div class="cmd-item" role="option" id="cmdo${n++}" aria-selected="false"${it.disabled ? ' aria-disabled="true"' : ''}
            data-href="${esc(it.href || '')}"${it.jump ? ` data-jump="${esc(it.jump)}"` : ''}${it.external ? ' data-external' : ''}>
            ${it.thumb ? `<img class="cmd-thumb" src="${esc(it.thumb)}" alt="" loading="lazy" decoding="async">` : `<span class="cmd-ico">${icon(it.icon)}</span>`}
            <span class="cmd-text"><span class="cmd-name">${esc(it.label)}</span><span class="cmd-desc">${esc(it.desc || '')}</span></span>
            ${it.meta ? `<span class="cmd-meta">${esc(it.meta)}</span>` : ''}
            ${it.external || (it.href && it.href[0] === '/') ? `<span class="cmd-go">${icon('out')}</span>` : ''}
          </div>`).join('')}
      </div>`).join('');
    const all = groups().flatMap(g => g.items);
    items = $$('.cmd-item', content).map((el, i) => ({ el, text: `${all[i].label} ${all[i].desc || ''} ${all[i].kw || ''}`.toLowerCase() }));
  }

  const visible = () => items.filter(it => !it.el.hidden && !it.el.closest('[hidden]') && it.el.getAttribute('aria-disabled') !== 'true').map(it => it.el);

  function filter(q) {
    const terms = q.toLowerCase().split(/\s+/).filter(Boolean);
    // Remember where rows were, so survivors can slide to their new place (FLIP)
    const before = new Map(items.map(it => [it.el.id, it.el.hidden ? null : it.el.offsetTop]));
    for (const it of items) it.el.hidden = !terms.every(t => it.text.includes(t));
    for (const g of $$('.cmd-group', content)) g.hidden = (g.hasAttribute('data-search') && !terms.length) || !$('.cmd-item:not([hidden])', g);
    const none = !$('.cmd-group:not([hidden])', content);
    emptyEl.hidden = !none;
    emptyEl.innerHTML = none ? `<span class="cmd-empty-ico">${icon('file')}</span><b>No results for “${esc(q.trim())}”</b><span>Try “logo”, “refund” or “discord”.</span>` : '';
    input.setAttribute('aria-expanded', String(!none));
    if (!reduced) {
      for (const it of items) {
        if (it.el.hidden || !it.el.closest('.cmd-group:not([hidden])')) continue;
        const from = before.get(it.el.id);
        if (from == null) it.el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 120, easing: 'ease-out' });
        else if (Math.abs(from - it.el.offsetTop) > .5) it.el.animate([{ translate: `0 ${from - it.el.offsetTop}px` }, { translate: '0 0' }], { duration: 200, easing: 'cubic-bezier(.23,1,.32,1)' });
      }
    }
    // Start on the first row whose own name matches (so "refund" lands on Refunds, not on the Legal page)
    const rows = visible();
    const named = terms.length && rows.find(el => terms.every(t => $('.cmd-name', el).textContent.toLowerCase().includes(t)));
    setActive((named || rows[0])?.id ?? null, true);
    if (named) named.scrollIntoView({ block: 'nearest' });
    paintMatches(terms);
    fitHeight();
  }

  // The list follows its results' height
  function fitHeight() {
    list.style.height = `${content.offsetHeight + (emptyEl.hidden ? 0 : emptyEl.offsetHeight)}px`;
  }

  // One shared highlight slides to the active row
  function setActive(id, jumpTo) {
    activeId = id;
    for (const it of items) {
      const on = it.el.id === id;
      it.el.toggleAttribute('data-active', on);
      it.el.setAttribute('aria-selected', String(on));
    }
    const row = id && document.getElementById(id);
    if (!row) {
      hl.style.opacity = '0';
      input.removeAttribute('aria-activedescendant');
      return;
    }
    input.setAttribute('aria-activedescendant', id);
    const hidden = hl.style.opacity !== '1';
    if (hidden || jumpTo) hl.style.transitionProperty = 'none';
    hl.style.translate = `0 ${row.offsetTop}px`;
    hl.style.height = `${row.offsetHeight}px`;
    hl.style.opacity = '1';
    if (hidden || jumpTo) {
      void hl.offsetHeight;
      hl.style.transitionProperty = '';
    }
  }

  // Matched letters, marked with the CSS Custom Highlight API so the rows' text is never rewritten
  function paintMatches(terms) {
    if (!window.CSS || !CSS.highlights || typeof Highlight === 'undefined') return;
    const ranges = [];
    if (terms.length) {
      for (const it of items) {
        if (it.el.hidden) continue;
        const walker = document.createTreeWalker(it.el, NodeFilter.SHOW_TEXT);
        for (let node = walker.nextNode(); node; node = walker.nextNode()) {
          const text = node.textContent.toLowerCase();
          for (const t of terms) {
            for (let at = text.indexOf(t); at !== -1; at = text.indexOf(t, at + t.length)) {
              const r = new Range();
              r.setStart(node, at);
              r.setEnd(node, at + t.length);
              ranges.push(r);
            }
          }
        }
      }
    }
    CSS.highlights.set('vce-match', new Highlight(...ranges));
  }

  function choose(el) {
    if (!el || el.getAttribute('aria-disabled') === 'true') return;
    el.toggleAttribute('data-running', true);
    setTimeout(() => el.removeAttribute('data-running'), 140);
    const href = el.dataset.href;
    if (el.hasAttribute('data-external')) {
      window.open(href, '_blank', 'noopener');
      setSearch(false);
      return;
    }
    if (href[0] === '/') {
      location.href = href;
      return;
    }
    pendingJump = el.dataset.jump || null;
    // Same page: no hashchange, so close here (and jump, if it's a policy)
    if (routeOf(href).key === current.key) {
      setSearch(false);
      runJump();
    } else location.hash = href;
  }
  function runJump() {
    if (!pendingJump) return;
    const card = document.getElementById(pendingJump);
    pendingJump = null;
    if (!card) return;
    card.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
    card.classList.toggle('flash', false);
    void card.offsetWidth;
    card.classList.toggle('flash', true);
  }

  content.addEventListener('pointermove', e => {
    const el = e.target.closest('.cmd-item:not([aria-disabled="true"])');
    if (el && el.id !== activeId) setActive(el.id);
  });
  content.addEventListener('click', e => choose(e.target.closest('.cmd-item')));
  input.addEventListener('input', () => filter(input.value));
  input.addEventListener('keydown', e => {
    const rows = visible();
    const at = rows.findIndex(r => r.id === activeId);
    let to;
    if (e.key === 'ArrowDown') to = rows[(at + 1) % rows.length];
    else if (e.key === 'ArrowUp') to = rows[(at - 1 + rows.length) % rows.length];
    else if (e.key === 'Home') to = rows[0];
    else if (e.key === 'End') to = rows[rows.length - 1];
    else if (e.key === 'Enter') {
      if (e.isComposing) return;
      e.preventDefault();
      choose(rows[at]);
      return;
    } else if (e.key === 'Escape') {
      // First Escape clears the search, the next one closes
      if (input.value) {
        e.preventDefault();
        e.stopPropagation();
        input.value = '';
        filter('');
      }
      return;
    } else return;
    e.preventDefault();
    if (!to) return;
    list.toggleAttribute('data-repeat', e.repeat);
    setActive(to.id);
    to.scrollIntoView({ block: 'nearest' });
  });
  input.addEventListener('keyup', () => list.removeAttribute('data-repeat'));

  function setSearch(open) {
    if (open === searchOpen) return;
    searchOpen = open;
    if (open) {
      if (menuOpen) setMenu(false);
      if (!items.length) build();
      input.value = '';
      filter('');
    }
    body.classList.toggle('search-on', open);
    searchEl.classList.toggle('open', open);
    searchEl.setAttribute('aria-hidden', String(!open));
    searchEl.inert = !open;
    searchBtn.setAttribute('aria-expanded', String(open));
    if (open) {
      input.focus({ preventScroll: true });
      requestAnimationFrame(() => setActive(activeId, true));
    } else if (searchEl.contains(document.activeElement) || document.activeElement === body) searchBtn.focus({ preventScroll: true });
  }
  searchBtn.addEventListener('click', () => (searchOpen ? input.focus() : setSearch(true)));
  $('#searchScrim').addEventListener('click', () => setSearch(false));
  addEventListener('keydown', e => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      setSearch(!searchOpen);
    } else if (e.key === '/' && !searchOpen && !e.target.closest('input, textarea, [contenteditable]')) {
      e.preventDefault();
      setSearch(true);
    }
  });

  /* ---------- Menu: the round button slides the three sheets in from the right (Jet PDP) ---------- */
  const menu = $('#menu');
  const menuBtn = $('#menuBtn');
  let menuOpen = false;
  function setMenu(open) {
    if (open === menuOpen) return;
    menuOpen = open;
    if (open && searchOpen) setSearch(false);
    body.classList.toggle('menu-on', open);
    menu.classList.toggle('open', open);
    menu.setAttribute('aria-hidden', String(!open));
    menu.inert = !open;
    menuBtn.setAttribute('aria-expanded', String(open));
    menuBtn.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    if (open) $('.links a', menu).focus({ preventScroll: true });
    else if (menu.contains(document.activeElement) || document.activeElement === body) menuBtn.focus({ preventScroll: true });
  }
  menuBtn.addEventListener('click', () => setMenu(!menuOpen));
  // A different route closes the menu once the wipe covers it, so only same-route clicks close it here
  menu.addEventListener('click', e => {
    const a = e.target.closest('a[href^="#"]:not([data-noop])');
    if (a && routeOf(a.getAttribute('href')).key === current.key) setMenu(false);
  });
  // No Instagram account linked yet, so that one stays inert
  $$('[data-noop]').forEach(a => a.addEventListener('click', e => e.preventDefault()));

  /* ---------- Content ---------- */

  // Card shapes follow the work, in data.js order: Clothing and Embed Banners wide, the two logo sets square,
  // Misc (a poster cover) upright. See .work-grid in site.css.
  const SPANS = ['wide', 'wide', 'square', 'square', 'tall'];
  $('#workGrid').innerHTML = projects.map((p, i) => `
    <a class="card rv ${SPANS[i % SPANS.length]}${p.contain ? ' contain' : ''}${p.onBlack ? ' on-black' : ''}" href="#/work/${p.slug}">
      <figure><img src="${p.cover.sm}" width="${p.cover.w}" height="${p.cover.h}" alt="${esc(p.title)}: cover image" loading="lazy" decoding="async"></figure>
      <div class="card-meta"><span class="num">${pad(i + 1)}</span><h3>${esc(p.title)}</h3><span class="card-tags">${p.tags.map(esc).join(' · ')}</span>${p.price ? `<span class="card-price">${esc(p.price)}</span>` : ''}</div>
    </a>`).join('');

  $('#aboutRows').innerHTML = projects.map((p, i) => `
    <li class="rv"><a href="#/work/${p.slug}"><span class="num">${pad(i + 1)}</span><h3>${esc(p.title)}</h3><p>${esc(p.short)}</p><span class="go">See the work &rarr;</span></a></li>`).join('');

  $('#footWork').innerHTML = projects.slice(0, 4).map(p => `<li><a href="#/work/${p.slug}">${esc(p.title)}</a></li>`).join('')
    + '<li><a href="#/work">All work</a></li>';

  // Two-line title: the last word in italic, as in the other headlines
  function titleLines(title) {
    const words = title.split(' ');
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
    g.className = `gallery wrap ${p.video ? 'single' : p.layout || ''}${p.onBlack ? ' on-black' : ''}`;
    shots = p.images;
    g.innerHTML = p.video
      ? `<video src="${p.video}" poster="${p.cover.src}" controls muted loop playsinline preload="metadata"></video>`
      : p.images.map((im, k) => `
        <button class="shot rv" type="button" data-k="${k}" aria-label="Open image ${k + 1} of ${p.images.length}">
          <img src="${im.sm}" width="${im.w}" height="${im.h}" alt="${esc(p.title)}, piece ${k + 1}" loading="lazy" decoding="async">
        </button>`).join('');
    const nx = $('#pjNext');
    nx.href = `#/work/${next.slug}`;
    $('span', nx).textContent = next.title;
    return true;
  }

  /* ---------- Legal: a contents list that jumps within the page and follows your place ---------- */
  const legalPage = $('[data-page="legal"]');
  $('#legalToc').innerHTML = $$('section[data-toc]', legalPage).map(sec => {
    const rows = $$('.policy > li', sec).map((li, i) => {
      li.id = `${sec.id}-${i + 1}`;
      return `<li><button type="button" data-jump="${li.id}"><span class="num">${pad(i + 1)}</span>${esc($('h3', li).textContent)}</button></li>`;
    }).join('');
    return `<div class="toc-group"><button type="button" class="toc-head" data-jump="${sec.id}">${esc(sec.dataset.toc)}</button><ol>${rows}</ol></div>`;
  }).join('');
  legalPage.addEventListener('click', e => {
    const b = e.target.closest('[data-jump]');
    if (!b) return;
    const el = document.getElementById(b.dataset.jump);
    el.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
    if (el.matches('li')) {
      el.classList.toggle('flash', false);
      void el.offsetWidth;
      el.classList.toggle('flash', true);
    }
  });
  // The card nearest the top third of the screen is "here" in the contents
  function markLegal() {
    const line = innerHeight * .34;
    let here = null, best = -Infinity;
    // Cards side by side share a top: the left one of the lowest row above the line wins
    for (const li of $$('.policy > li', legalPage)) {
      const top = li.getBoundingClientRect().top;
      if (top < line && top > best + 1) { best = top; here = li.id; }
    }
    $$('#legalToc [data-jump]').forEach(b => b.classList.toggle('here', b.dataset.jump === here));
  }
  legalPage.addEventListener('scroll', markLegal, { passive: true });

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
    if (e.key === 'Escape') {
      if (searchOpen) setSearch(false);
      else if (menuOpen) setMenu(false);
    }
  });

  /* ---------- Pages and routing (Jet PDP) ---------- */
  const pageEls = Object.fromEntries($$('[data-page]').map(el => [el.dataset.page, el]));
  const foot = $('#siteFoot');
  const wipeEl = $('#wipe');
  const TITLES = { work: 'Work', about: 'About', services: 'Services', contact: 'Contact', legal: 'Legal' };
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
    // The header pill marks where you are; project pages count as Work
    const section = route.name === 'project' ? 'work' : route.name;
    $$('.ice-pill a').forEach(a => a.dataset.route === section ? a.setAttribute('aria-current', 'page') : a.removeAttribute('aria-current'));
    if (home) {
      activePage = null;
      window.VCECrowd && VCECrowd.arrive();
    } else {
      window.VCECrowd && VCECrowd.leave();
      if (route.name === 'project') renderProject(route.slug);
      const el = pageEls[route.name];
      activePage = el;
      $$('.seen', el).forEach(n => n.classList.remove('seen'));
      $('.foot-slot', el).append(foot);
      el.classList.add('active');
      el.scrollTop = 0;
      halftone.relayout();
      revealInView();
      if (route.name === 'legal') runJump();
    }
  }
  Object.values(pageEls).forEach(el => el.addEventListener('scroll', revealInView, { passive: true }));
  addEventListener('resize', revealInView);

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
      if (searchOpen) setSearch(false);
      return;
    }
    if (busy) return;
    current = route;
    setTitle(route);
    wipe(() => {
      if (menuOpen) setMenu(false);
      if (searchOpen) setSearch(false);
      setPage(route);
      (activePage || $('#home')).focus({ preventScroll: true });
    });
  }

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

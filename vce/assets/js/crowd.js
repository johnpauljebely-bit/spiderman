// Home hero: a crowd of Open Peeps walking across the bottom of the screen.
// Plain-JS port of Skiper 39 (Skiper UI, after zadvorsky's CodePen; illustrations by openpeeps.com).
// site.js calls VCECrowd.arrive() / VCECrowd.leave() so it only draws while home is showing.
(() => {
  const canvas = document.getElementById('crowd');
  if (!canvas || !window.gsap) return;
  const ctx = canvas.getContext('2d');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const SRC = canvas.dataset.src;
  const ROWS = 15, COLS = 7; // the sprite sheet: 15 peeps across, 7 down

  const randomRange = (min, max) => min + Math.random() * (max - min);
  const randomIndex = a => (randomRange(0, a.length) | 0);
  const removeFromArray = (a, i) => a.splice(i, 1)[0];
  const removeItem = (a, item) => removeFromArray(a, a.indexOf(item));
  const removeRandom = a => removeFromArray(a, randomIndex(a));

  const img = new Image();
  const stage = { width: 0, height: 0, scale: 1 };
  const allPeeps = [];
  const available = [];
  const crowd = [];
  let running = false, ready = false;

  function createPeep(rect) {
    return {
      rect,
      width: rect[2],
      height: rect[3],
      x: 0, y: 0, anchorY: 0, scaleX: 1, walk: null,
      render(c) {
        c.save();
        c.translate(this.x, this.y);
        c.scale(this.scaleX * stage.scale, stage.scale);
        c.drawImage(img, ...this.rect, 0, 0, this.width, this.height);
        c.restore();
      },
    };
  }

  // Each peep walks the full width, from a random side, at a random depth near the bottom
  function resetPeep(peep) {
    const dir = Math.random() > .5 ? 1 : -1;
    const s = stage.scale;
    const offsetY = (100 - 250 * gsap.parseEase('power2.in')(Math.random())) * s;
    const startY = stage.height - peep.height * s + offsetY;
    let startX, endX;
    if (dir === 1) {
      startX = -peep.width * s;
      endX = stage.width;
      peep.scaleX = 1;
    } else {
      startX = stage.width + peep.width * s;
      endX = 0;
      peep.scaleX = -1;
    }
    peep.x = startX;
    peep.y = startY;
    peep.anchorY = startY;
    return { startY, endX };
  }

  function walk(peep, { startY, endX }) {
    const xDuration = 10, yDuration = .25;
    const tl = gsap.timeline();
    tl.timeScale(randomRange(.5, 1.5));
    tl.to(peep, { duration: xDuration, x: endX, ease: 'none' }, 0);
    tl.to(peep, { duration: yDuration, repeat: xDuration / yDuration, yoyo: true, y: startY - 10 * stage.scale }, 0);
    return tl;
  }

  function addPeep() {
    const peep = removeRandom(available);
    peep.walk = walk(peep, resetPeep(peep)).eventCallback('onComplete', () => {
      removeItem(crowd, peep);
      available.push(peep);
      addPeep();
    });
    if (!running) peep.walk.pause();
    crowd.push(peep);
    crowd.sort((a, b) => a.anchorY - b.anchorY);
    return peep;
  }

  function render() {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    for (const p of crowd) p.render(ctx);
  }

  function resize() {
    if (!ready) return;
    const dpr = Math.min(devicePixelRatio || 1, 2);
    stage.width = canvas.clientWidth;
    stage.height = canvas.clientHeight;
    if (!stage.width || !stage.height) return;
    canvas.width = Math.round(stage.width * dpr);
    canvas.height = Math.round(stage.height * dpr);
    // The tallest a walker can reach is its height plus 150px of depth offset (and a 10px bounce), so size the
    // crowd to the room left under the copy; on narrow screens keep them from getting too big to read as a crowd
    const copy = document.querySelector('.hero-copy');
    const room = canvas.getBoundingClientRect().bottom - (copy ? copy.getBoundingClientRect().bottom : 0) - 28;
    const reach = allPeeps[0].height + 160;
    stage.scale = Math.min(1, Math.max(.42, Math.min(room / reach, stage.width / 640)));
    crowd.forEach(p => p.walk.kill());
    crowd.length = 0;
    available.length = 0;
    available.push(...allPeeps);
    while (available.length) addPeep().walk.progress(Math.random());
    render();
  }

  img.onload = () => {
    const w = img.naturalWidth / ROWS, h = img.naturalHeight / COLS;
    for (let i = 0; i < ROWS * COLS; i++) allPeeps.push(createPeep([(i % ROWS) * w, ((i / ROWS) | 0) * h, w, h]));
    ready = true;
    resize();
    canvas.classList.add('on');
    if (document.body.classList.contains('at-home')) start();
  };
  img.src = SRC;

  function start() {
    if (running || !ready) return;
    if (reduced) { render(); return; } // a still crowd: placed, not walking
    running = true;
    crowd.forEach(p => p.walk.resume());
    gsap.ticker.add(render);
  }
  function stop() {
    if (!running) return;
    running = false;
    crowd.forEach(p => p.walk.pause());
    gsap.ticker.remove(render);
  }

  let rt = 0;
  addEventListener('resize', () => {
    clearTimeout(rt);
    rt = setTimeout(resize, 120);
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stop();
    else if (document.body.classList.contains('at-home')) start();
  });

  window.VCECrowd = {
    arrive() { resize(); start(); },
    leave: stop,
  };
})();

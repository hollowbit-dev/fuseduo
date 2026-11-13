// Fuseduo site v2 motion: cursor-lit dot grid, orbiting hero, scroll story, bento loops.
(() => {
  // asset paths follow wherever this script is served from (hollowbit.dev/fuseduo/ or fuseduo.com/)
  const ASSETS = new URL('.', document.currentScript.src).href;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const icon = (id) => `${ASSETS}apps/${id}.png`;
  const APPS = { notes: '#f6c945', calendar: '#ff5a5f', reminders: '#5aa7ff', mail: '#3b8bff', safari: '#33b5ff', music: '#ff4f6d', photos: '#ffaa3c', messages: '#3ddc6a' };
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const seg = (p, a, b) => clamp((p - a) / (b - a)); // progress inside [a, b]
  const ease = (t) => 1 - (1 - t) ** 3;
  const visible = (el, cb) => new IntersectionObserver(([e]) => cb(e.isIntersecting), { threshold: 0.15 }).observe(el);

  /* cursor-lit grid (and the light on bento tiles) */
  // A 520px spotlight follows the cursor by transform; its dots stay aligned to the page grid.
  const lit = $('.dots-lit');
  let lx = 0, ly = 0, litQueued = false;
  const moveLit = () => { litQueued = false; const x = lx - 260, y = ly - 260; lit.style.transform = `translate3d(${x}px, ${y}px, 0)`; lit.style.backgroundPosition = `${-x}px ${-y}px`; };
  if (lit && matchMedia('(hover: hover)').matches) lit.classList.add('on');
  addEventListener('pointermove', (e) => {
    if (lit) { lx = e.clientX; ly = e.clientY; if (!litQueued) { litQueued = true; requestAnimationFrame(moveLit); } }
    const t = e.target.closest?.('.tile'); if (!t) return;
    const r = t.getBoundingClientRect(); t.style.setProperty('--mx', `${e.clientX - r.left}px`); t.style.setProperty('--my', `${e.clientY - r.top}px`);
  }, { passive: true });

  /* anything scrolled out of view stops animating */
  const offIO = new IntersectionObserver((es) => es.forEach((e) => e.target.classList.toggle('off', !e.isIntersecting)), { rootMargin: '120px 0px' });
  $$('.hero2, .bento, .marquee, .finale, .story-vis, .demo-wrap, .band, .page-head').forEach((n) => offIO.observe(n));

  /* beams: scatter them along the grid */
  $$('.beams').forEach((b) => {
    const cols = ['#a78bfa', '#22d3ee', '#f472b6', '#fbbf24'];
    for (let i = 0; i < 6; i++) {
      const v = document.createElement('i'), h = i % 3 === 2;
      if (h) { v.className = 'h'; v.style.setProperty('--y', `${Math.round(Math.random() * 14 + 2) * 26}px`); }
      else v.style.setProperty('--x', `${Math.round(Math.random() * 60 + 4) * 26}px`);
      v.style.setProperty('--c', cols[i % cols.length]); v.style.setProperty('--t', `${5 + Math.random() * 6}s`); v.style.setProperty('--dl', `${-Math.random() * 10}s`);
      b.append(v);
    }
  });

  /* sparks helper (sprites, no per-frame blur) */
  function sparkLayer(cv) {
    const st = { list: [], on: false, spr: new Map() };
    const sprite = (c) => { if (st.spr.has(c)) return st.spr.get(c); const k = document.createElement('canvas'); k.width = k.height = 32; const g = k.getContext('2d'), gr = g.createRadialGradient(16, 16, 0, 16, 16, 16); gr.addColorStop(0, '#fff'); gr.addColorStop(0.2, c); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, 32, 32); st.spr.set(c, k); return k; };
    const draw = () => {
      const ctx = cv.getContext('2d'), d = Math.min(2, devicePixelRatio || 1);
      ctx.setTransform(d, 0, 0, d, 0, 0); ctx.clearRect(0, 0, cv.width, cv.height); ctx.globalCompositeOperation = 'lighter';
      st.list = st.list.filter((p) => p.life > 0);
      for (const p of st.list) { p.vx *= 0.95; p.vy = p.vy * 0.95 + 0.1; p.x += p.vx; p.y += p.vy; p.life -= p.dc; const s = p.r * (0.4 + p.life * 0.7); ctx.globalAlpha = Math.max(0, p.life); ctx.drawImage(p.img, p.x - s, p.y - s, s * 2, s * 2); }
      if (st.list.length) requestAnimationFrame(draw); else { st.on = false; ctx.clearRect(0, 0, cv.width, cv.height); }
    };
    return (x, y, colors, n = 60, speed = 9) => {
      if (reduce) return;
      const r = cv.getBoundingClientRect(), d = Math.min(2, devicePixelRatio || 1);
      if (cv.width !== Math.round(r.width * d) || cv.height !== Math.round(r.height * d)) { cv.width = Math.round(r.width * d); cv.height = Math.round(r.height * d); }
      for (let i = 0; i < n; i++) { const a = Math.random() * Math.PI * 2, s = 2 + Math.random() * speed; st.list.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 1.2, life: 1, dc: 0.012 + Math.random() * 0.02, r: 7 + Math.random() * 10, img: sprite(colors[i % colors.length]) }); }
      if (!st.on) { st.on = true; requestAnimationFrame(draw); }
    };
  }

  /* ---------- hero: apps orbit the core; pairs fly in and fuse ----------
     The orbit runs on the compositor: each icon has one precomputed elliptical keyframe path, so no
     JavaScript runs per frame. (The first version moved all 8 icons from JS every frame and used ~19%
     of a CPU core while idle.) Stacking order only flips front/back, checked 4 times a second. */
  const orbit = $('.orbit');
  if (orbit) {
    const core = $('.core', orbit), burst = sparkLayer($('.hero-sparks', orbit));
    const RESULTS = [['music', 'notes', 'Listening log'], ['safari', 'notes', 'Save my open tabs'], ['mail', 'reminders', 'Flagged mail to reminders'], ['calendar', 'notes', 'Today’s agenda'], ['photos', 'mail', 'Share today’s photos'], ['calendar', 'music', 'Focus until the next meeting'], ['calendar', 'reminders', 'Prep before meetings'], ['messages', 'calendar', 'Who am I meeting?']];
    const ids = Object.keys(APPS);
    const small = orbit.clientWidth < 720;
    const RX = [small ? 170 : 430, small ? 110 : 285], RY = [small ? 40 : 96, small ? 26 : 64];
    const PERIOD = [52000, 36000], STEPS = 48;
    const pos = (o, turn) => { // turn: 0..1 around the ellipse
      const a = o.a0 + o.dir * turn * Math.PI * 2, depth = (Math.sin(a) + 1) / 2;
      return { x: Math.cos(a) * RX[o.ring], y: Math.sin(a) * RY[o.ring], s: 0.66 + depth * 0.46, front: Math.sin(a) > 0 };
    };
    const tf = (p) => `translate3d(${p.x.toFixed(1)}px, ${p.y.toFixed(1)}px, 0) scale(${p.s.toFixed(3)})`;
    const nodes = ids.map((id, i) => {
      const n = document.createElement('div'); n.className = 'orb-app'; n.style.setProperty('--c', APPS[id]);
      n.innerHTML = `<img src="${icon(id)}" alt="" width="78" height="78">`; orbit.append(n);
      const o = { id, n, ring: i % 2, a0: (i / ids.length) * Math.PI * 2, dir: i % 2 ? -1 : 1 };
      const frames = Array.from({ length: STEPS + 1 }, (_, k) => ({ transform: tf(pos(o, k / STEPS)) }));
      o.anim = reduce ? null : n.animate(frames, { duration: PERIOD[o.ring], iterations: Infinity });
      if (reduce) n.style.transform = tf(pos(o, 0));
      return o;
    });
    const turnOf = (o) => (o.anim ? (o.anim.currentTime % PERIOD[o.ring]) / PERIOD[o.ring] : 0);
    const layer = () => nodes.forEach((o) => { const z = o.flying ? 120 : pos(o, turnOf(o)).front ? 60 : 10; if (o.z !== z) { o.z = z; o.n.style.zIndex = z; } });
    layer(); setInterval(layer, 250);
    visible(orbit, (v) => nodes.forEach((o) => o.anim && (v && !o.flying ? o.anim.play() : o.anim.pause())));
    async function fuseLoop() {
      let k = 0;
      while (true) {
        await wait(reduce ? 1e9 : 2800);
        if (document.hidden || !orbit.getBoundingClientRect().bottom || orbit.getBoundingClientRect().top > innerHeight) continue;
        const [a, b, name] = RESULTS[k++ % RESULTS.length];
        const pair = [a, b].map((id) => nodes.find((o) => o.id === id));
        // freeze each icon where it is, fly it into the core
        await Promise.all(pair.map(async (o, i) => {
          o.flying = true; o.anim?.pause(); layer();
          const here = tf(pos(o, turnOf(o)));
          await wait(i * 120);
          o.flight = o.n.animate([{ transform: here, opacity: 1 }, { transform: 'translate3d(0px, 0px, 0) scale(0.3)', opacity: 0 }], { duration: 760, easing: 'cubic-bezier(.5,0,.2,1)', fill: 'forwards' });
          await o.flight.finished;
        }));
        core.classList.remove('gulp'); void core.offsetWidth; core.classList.add('gulp');
        const r = orbit.getBoundingClientRect();
        burst(r.width / 2, r.height / 2, [APPS[a], APPS[b], '#ffffff', '#a78bfa'], 60, 10);
        const chip = document.createElement('div'); chip.className = 'chip-out';
        chip.innerHTML = `<img src="${icon(a)}" alt=""><img src="${icon(b)}" alt=""><span>${name}<small>Fusion ready · read it, then run it</small></span>`;
        orbit.append(chip);
        const side = k % 2 ? 1 : -1;
        chip.animate([{ transform: 'translate(-50%, -50%) scale(.3)', opacity: 0 }, { transform: `translate(calc(-50% + ${side * 200}px), -150px) scale(1)`, opacity: 1, offset: 0.25 }, { transform: `translate(calc(-50% + ${side * 230}px), -180px) scale(1)`, opacity: 1, offset: 0.8 }, { transform: `translate(calc(-50% + ${side * 250}px), -230px) scale(.9)`, opacity: 0 }], { duration: 2600, easing: 'cubic-bezier(.2,.9,.3,1)' }).finished.then(() => chip.remove());
        await wait(500);
        // fly back out to where each icon left its orbit, then let the orbit carry on
        await Promise.all(pair.map(async (o) => {
          const back = o.n.animate([{ transform: 'translate3d(0px, 0px, 0) scale(0.2)', opacity: 0 }, { transform: tf(pos(o, turnOf(o))), opacity: 1 }], { duration: 900, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'forwards' });
          await back.finished;
          o.flight?.cancel(); back.cancel(); o.flying = false; o.anim?.play(); layer();
        }));
      }
    }
    fuseLoop();
  }

  /* ---------- count-up stats ---------- */
  $$('[data-count]').forEach((el) => visible(el, (v) => {
    if (!v || el.dataset.done) return; el.dataset.done = 1;
    const end = parseFloat(el.dataset.count), dec = (el.dataset.count.split('.')[1] || '').length, t0 = performance.now();
    const f = (t) => { const k = ease(clamp((t - t0) / 1400)); el.textContent = (end * k).toFixed(dec) + (el.dataset.suffix || ''); if (k < 1) requestAnimationFrame(f); };
    requestAnimationFrame(f);
  }));

  /* ---------- scroll story ---------- */
  const story = $('.story');
  if (story) {
    $$('.sv-blob', story).forEach((bl) => { bl.style.color = bl.style.background; });
    const steps = $$('.story-steps li', story), bar = $('.story-bar', story);
    const A = $('.sv-a', story), B = $('.sv-b', story), ba = $('.sv-blob.a', story), bb = $('.sv-blob.b', story), orb = $('.sv-orb', story);
    const cards = $$('.sv-card', story), plan = $('.sv-plan', story), items = $$('.sv-plan li', story), run = $('.sv-run', story), done = $('.sv-done', story);
    const burst = sparkLayer($('canvas', story));
    let fired = false;
    const update = () => {
      const r = story.getBoundingClientRect(), total = r.height - innerHeight;
      const p = total > 0 ? clamp(-r.top / total) : 0;
      bar.style.setProperty('--p', p);
      const stage = Math.min(4, Math.floor(p * 5));
      steps.forEach((li, i) => { li.classList.toggle('on', i === stage); li.classList.toggle('done', i < stage); });
      // 1. drag together
      const d = ease(seg(p, 0.02, 0.18)), gap = 150 * (1 - d);
      // 2. melt into an orb
      const m = seg(p, 0.2, 0.36);
      A.style.transform = `translate(${-gap - 8 * m}px, 0) scale(${1 - m * 0.6}) rotate(${-8 * d}deg)`; A.style.opacity = 1 - m;
      B.style.transform = `translate(${gap + 8 * m}px, 0) scale(${1 - m * 0.6}) rotate(${8 * d}deg)`; B.style.opacity = 1 - m;
      ba.style.opacity = bb.style.opacity = m > 0 && m < 1 ? 1 : 0;
      ba.style.transform = `translate(${-gap * 0.4 + 40 * m}px, 0) scale(${0.6 + m * 0.6})`; bb.style.transform = `translate(${gap * 0.4 - 40 * m}px, 0) scale(${0.6 + m * 0.6})`;
      const o = seg(p, 0.3, 0.4), ideas = seg(p, 0.4, 0.56), toPlan = seg(p, 0.6, 0.7);
      orb.style.opacity = o * (1 - toPlan); orb.style.transform = `scale(${0.6 + o * 0.4 - ideas * 0.4}) translateY(${-ideas * 150}px)`;
      // 3. three ideas fan out (spread scales with the panel)
      const visW = $('.story-vis', story).clientWidth;
      cards.forEach((c, i) => {
        const k = ease(clamp(ideas * 1.4 - i * 0.2)), off = (i - 1);
        c.style.opacity = k * (1 - toPlan);
        const narrow = visW < 560, spread = narrow ? 0 : visW * 0.31;
        c.style.transform = `translate(${off * spread * k}px, ${40 + Math.abs(off) * 20 * k + (narrow ? off * 100 * k : 0)}px) rotate(${off * 6 * k}deg) scale(${0.7 + 0.3 * k})`;
      });
      // 4. the plan checks itself off
      plan.style.opacity = toPlan; plan.style.transform = `scale(${0.85 + 0.15 * ease(toPlan)}) translateY(${(1 - toPlan) * 30}px)`;
      const checks = seg(p, 0.68, 0.8);
      items.forEach((li, i) => li.classList.toggle('ok', checks > (i + 0.5) / items.length));
      // 5. run
      const go = p > 0.86;
      run.classList.toggle('press', p > 0.84 && p < 0.88);
      done.classList.toggle('on', go);
      if (go && !fired) { fired = true; const v = $('.story-vis', story).getBoundingClientRect(), c = run.getBoundingClientRect(); burst(c.left - v.left + c.width / 2, c.top - v.top, ['#4ade80', '#ffffff', '#a78bfa', '#22d3ee', '#f472b6'], 90, 11); }
      if (!go) fired = false;
    };
    let queued = false;
    addEventListener('scroll', () => { if (!queued) { queued = true; requestAnimationFrame(() => { queued = false; update(); }); } }, { passive: true }); addEventListener('resize', update); update();
  }

  /* ---------- bento loops ---------- */
  const term = $('.term');
  if (term) {
    const LINES = [['m', '$ '], ['', 'Fuseduo is looking for Claude…'], ['g', '✓ Found Claude Code, signed in'], ['v', '→ Using your own Claude plan'], ['m', '  (or an API key: your choice in Settings)'], ['g', '✓ Ready to fuse']];
    let running = false;
    visible(term, async (v) => {
      if (!v || running) return; running = true;
      while (true) {
        term.innerHTML = '';
        for (const [cls, text] of LINES) {
          const line = document.createElement('div'); if (cls) line.className = cls; term.append(line);
          for (const ch of text) { line.textContent += ch; await wait(reduce ? 0 : 18); }
          await wait(260);
        }
        const c = document.createElement('span'); c.className = 'caret'; term.append(c);
        await wait(3200);
      }
    });
  }
  const stack = $('.stack');
  if (stack) {
    const cards = $$('.scard', stack);
    let i = 0;
    const lay = () => cards.forEach((c, k) => {
      const pos = (k - i + cards.length) % cards.length;
      c.style.transform = `translateY(${pos * 20 - 20}px) scale(${1 - pos * 0.06})`; c.style.opacity = pos > 2 ? 0 : [1, 0.45, 0.18][pos]; c.style.filter = pos ? `blur(${pos}px)` : 'none'; c.style.zIndex = 10 - pos;
    });
    lay(); setInterval(() => { i = (i + 1) % cards.length; lay(); }, 2400);
  }
  // Best vs Fast: both bars start together, scaled from the real build times (23.8 s vs 8.5 s)
  const race = $('.race');
  if (race) {
    const rows = $$('.race-row', race);
    let running = false;
    visible(race, async (v) => {
      if (!v || running) return; running = true;
      while (true) {
        rows.forEach((r) => { r.classList.remove('won'); const i = $('i', r); i.classList.remove('go'); });
        await wait(600);
        rows.forEach((r) => $('i', r).classList.add('go'));
        await wait(3400); rows[1].classList.add('won');
        await wait(6100); rows[0].classList.add('won');
        await wait(2400);
      }
    });
  }
  const pairs = $('.pairs');
  if (pairs) {
    const imgs = $$('img', pairs), path = $('path', pairs);
    const cycle = () => {
      imgs.forEach((x) => x.classList.remove('hot'));
      let a = Math.floor(Math.random() * imgs.length), b; do { b = Math.floor(Math.random() * imgs.length); } while (b === a);
      const r = pairs.getBoundingClientRect(), c = (n) => { const q = n.getBoundingClientRect(); return [q.left - r.left + q.width / 2, q.top - r.top + q.height / 2]; };
      const [x1, y1] = c(imgs[a]), [x2, y2] = c(imgs[b]);
      path.setAttribute('d', `M${x1} ${y1} Q ${(x1 + x2) / 2} ${Math.min(y1, y2) - 60} ${x2} ${y2}`);
      path.classList.remove('go'); void path.getBBox(); path.classList.add('go');
      imgs[a].classList.add('hot'); imgs[b].classList.add('hot');
    };
    cycle(); setInterval(cycle, 2200);
  }
})();

// Fuseduo: the library, spring-physics dragging, the liquid fusion, the ideas panel and approve-then-run.
const $ = (s, r = document) => r.querySelector(s);
const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };
const svgEl = (markup) => { const t = document.createElement('template'); t.innerHTML = markup.trim(); return t.content.firstChild; }; // static markup only
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const cssVar = (n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
const SPRING = cssVar('--spring') || 'ease-out';
const SPRING_SOFT = cssVar('--spring-soft') || 'ease-out';
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const ICON = {
  star: '<svg viewBox="0 0 24 24"><path d="m12 4 2.4 4.9 5.4.8-3.9 3.8.9 5.4L12 16.4l-4.8 2.5.9-5.4L4.2 9.7l5.4-.8z"/></svg>',
  play: '<svg viewBox="0 0 24 24"><path d="M7 4.5v15l12.5-7.5z"/></svg>',
};

let APPS = [];
let FUSIONS = [];
let PREFS = { favourites: [], recent: [], onboarded: false, view: 'favourites' };
let current = null; // { a, b, ideas, idea, plan, fusionId }
const byId = (id) => APPS.find((a) => a.id === id);
const savePrefs = (patch) => { Object.assign(PREFS, patch); window.fuse.setPrefs(patch); };

// ---------- views ----------
const CAT_COLORS = { Productivity: '#7a8bff', Creative: '#ff7ab8', Developer: '#2fd6c6', Social: '#5ec8ff', 'Fun & media': '#ffb24a', Utilities: '#a3a0b8', Other: '#6f6c82' };
const VIEW_TITLES = { favourites: 'Favourites', recent: 'Recent', all: 'All apps' };
function appsFor(view) {
  if (view === 'favourites') return PREFS.favourites.map(byId).filter(Boolean);
  if (view === 'recent') return PREFS.recent.map(byId).filter(Boolean);
  if (view.startsWith('cat:')) return APPS.filter((a) => a.category === view.slice(4));
  return APPS;
}
function setView(view, { quiet } = {}) {
  if (!VIEW_TITLES[view] && !view.startsWith('cat:')) view = 'favourites';
  PREFS.view = view;
  if (!quiet) savePrefs({ view });
  if ($('#search').value) $('#search').value = '';
  renderNav(); renderBoard(true);
}
function renderNav() {
  $('[data-view="favourites"] em').textContent = PREFS.favourites.filter(byId).length || '';
  $('[data-view="recent"] em').textContent = PREFS.recent.filter(byId).length || '';
  $('[data-view="all"] em').textContent = APPS.length || '';
  const counts = {};
  APPS.forEach((a) => { counts[a.category] = (counts[a.category] || 0) + 1; });
  const cats = Object.keys(CAT_COLORS).filter((c) => counts[c]);
  const box = $('#cats');
  if (box.childElementCount !== cats.length) {
    box.replaceChildren(...cats.map((c) => {
      const b = el('button', 'nav-item'); b.dataset.view = `cat:${c}`;
      const d = el('span', 'cat-dot'); d.style.cssText = `flex:none;--c:${CAT_COLORS[c]}`; d.append(el('i'));
      b.append(d, el('span', '', c), el('em')); return b;
    }));
  }
  cats.forEach((c) => { $(`[data-view="cat:${c}"] em`, box).textContent = counts[c]; });
  const searching = !!$('#search').value.trim();
  document.querySelectorAll('.nav-item').forEach((n) => n.classList.toggle('on', !searching && n.dataset.view === PREFS.view));
  movePill();
}
function movePill() {
  const pill = $('.nav-pill'), on = $('.nav-item.on');
  if (!on) { pill.style.opacity = 0; return; }
  pill.style.opacity = 1;
  pill.style.transform = `translateY(${on.offsetTop}px)`;
}

// ---------- board ----------
function iconEl(app, cls = '') {
  if (!app?.icon) return el('div', `ph ${cls}`);
  const img = el('img', cls); img.src = app.icon; img.alt = ''; img.draggable = false; return img;
}
function tileFor(app, i) {
  const t = el('div', 'tile'); t.dataset.id = app.id; t.title = app.name;
  t.style.setProperty('--c', app.color); t.style.animationDelay = `${Math.min(i, 30) * 14}ms`;
  const star = el('button', `star${PREFS.favourites.includes(app.id) ? ' on' : ''}`); star.title = 'Favourite'; star.setAttribute('aria-label', `Favourite ${app.name}`);
  star.append(svgEl(ICON.star));
  star.addEventListener('pointerdown', (e) => e.stopPropagation());
  star.onclick = (e) => { e.stopPropagation(); toggleFavourite(app, star); };
  t.append(star, iconEl(app), el('span', '', app.name));
  if (drag.on && drag.app.id === app.id) t.classList.add('lifted');
  t.addEventListener('pointerdown', (e) => startDrag(e, t, app));
  return t;
}
function renderBoard(animateTitle) {
  const q = $('#search').value.trim().toLowerCase();
  const view = PREFS.view;
  const list = q ? APPS.filter((a) => a.name.toLowerCase().includes(q)) : appsFor(view);
  const title = q ? 'Search' : VIEW_TITLES[view] || view.slice(4);
  const h1 = $('#viewTitle');
  if (h1.textContent !== title) { h1.textContent = title; if (animateTitle) { h1.classList.remove('swap'); void h1.offsetWidth; h1.classList.add('swap'); } }
  const board = $('#board'); board.replaceChildren();
  board.classList.toggle('favs', !q && view === 'favourites');
  list.forEach((app, i) => board.append(tileFor(app, i)));
  $('#boardStatus').hidden = !!APPS.length || !LOADING;
  renderEmpty(list.length ? null : q ? 'search' : view);
}
function renderEmpty(kind) {
  const box = $('#empty');
  if (!kind || LOADING) { box.hidden = true; return; }
  const copy = {
    favourites: ['Star the apps you use most', 'Hover any app and tap the star. Your favourites stay here, ready to fuse.', true],
    recent: ['Nothing fused yet', 'Apps you fuse show up here so you can mix them again.'],
    search: ['No apps match that search', 'Try part of the name, like “note” or “cal”.'],
  }[kind] || ['No apps here', APPS.length ? 'This shelf is empty.' : 'Fuseduo couldn’t find any apps on this Mac.'];
  const art = el('div', 'empty-art'); art.append(el('span'), el('span'));
  if (copy[2]) art.append(svgEl(ICON.star));
  const acts = el('div');
  if (kind === 'favourites' || kind === 'recent') { const b = el('button', 'btn btn-quiet sm', 'Browse all apps'); b.onclick = () => setView('all'); acts.append(b); }
  box.replaceChildren(art, el('h3', '', copy[0]), el('p', '', copy[1]), acts);
  box.hidden = false;
}
function toggleFavourite(app, star) {
  const on = !PREFS.favourites.includes(app.id);
  const favourites = on ? [...PREFS.favourites, app.id] : PREFS.favourites.filter((x) => x !== app.id);
  savePrefs({ favourites });
  star.classList.toggle('on', on);
  star.classList.remove('pop'); void star.offsetWidth; if (on) star.classList.add('pop');
  renderNav();
  if (PREFS.view === 'favourites' && !on && !$('#search').value) {
    const t = star.closest('.tile');
    t.animate([{ opacity: 1, transform: 'scale(1)' }, { opacity: 0, transform: 'scale(.6)' }], { duration: 260, easing: 'ease-in' }).finished.then(() => renderBoard());
  }
}
function remember(a, b) {
  const recent = [a.id, b.id, ...PREFS.recent.filter((x) => x !== a.id && x !== b.id)].slice(0, 16);
  savePrefs({ recent }); renderNav();
}
// the light on a glass surface follows the pointer
document.addEventListener('pointermove', (e) => {
  const t = e.target.closest?.('.tile, .idea');
  if (!t) return;
  const r = t.getBoundingClientRect();
  t.style.setProperty('--mx', `${e.clientX - r.left}px`); t.style.setProperty('--my', `${e.clientY - r.top}px`);
});

// ---------- dragging with spring physics ----------
const drag = { on: false };
const ghost = $('#ghost');
function center(node) { const r = node.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }
const liveTile = (id) => document.querySelector(`.tile[data-id="${CSS.escape(id)}"]`);

function startDrag(e, tile, app) {
  if (e.button !== 0 || drag.on || drag.pending) return;
  const img = tile.querySelector('img, .ph');
  const home = center(img);
  Object.assign(drag, { pending: true, on: false, app, home, sx: e.clientX, sy: e.clientY, px: e.clientX, py: e.clientY, x: home.x, y: home.y, vx: 0, vy: 0, target: null, returning: false, springNav: null, springTimer: 0 });
  const move = (ev) => {
    drag.px = ev.clientX; drag.py = ev.clientY;
    if (!drag.on && Math.hypot(ev.clientX - drag.sx, ev.clientY - drag.sy) > 5) beginDrag();
    if (drag.on && !drag.returning) { findTarget(); springLoad(); }
  };
  const up = () => {
    removeEventListener('pointermove', move); removeEventListener('pointerup', up); removeEventListener('pointercancel', up);
    drag.pending = false;
    clearSpring();
    if (!drag.on) return;
    const target = drag.target;
    setTarget(null);
    $('#board').classList.remove('dragging');
    if (target) { drag.on = false; ghost.hidden = true; finishOnTarget(target); return; }
    const home = liveTile(drag.app.id);
    if (home) { drag.home = center(home.querySelector('img, .ph')); drag.returning = true; resetHint(); }
    else dissolveGhost();
  };
  addEventListener('pointermove', move); addEventListener('pointerup', up); addEventListener('pointercancel', up);
}
function beginDrag() {
  drag.on = true;
  liveTile(drag.app.id)?.classList.add('lifted');
  $('#board').classList.add('dragging');
  $('img', ghost).src = drag.app.icon || '';
  ghost.style.setProperty('--c', vividHex(drag.app.color));
  ghost.hidden = false;
  setHint(`Drop ${drag.app.name} onto another app.`, true);
  requestAnimationFrame(step);
}
function dissolveGhost() {
  drag.on = false;
  ghost.animate([{ opacity: 1 }, { opacity: 0, transform: `${ghost.style.transform} scale(.4)` }], { duration: 260, easing: 'ease-in' }).finished.then(() => { ghost.hidden = true; });
  resetHint();
}
function findTarget() {
  const under = document.elementsFromPoint(drag.px, drag.py).find((n) => n.classList?.contains('tile') && n.dataset.id !== drag.app.id);
  setTarget(under || null);
  if (under) setHint(`Fuse ${drag.app.name} with ${byId(under.dataset.id)?.name}`, true);
  else setHint(`Drop ${drag.app.name} onto another app.`, true);
}
function setTarget(t) {
  if (drag.target === t) return;
  drag.target?.classList.remove('target');
  drag.target = t;
  t?.classList.add('target');
}
// Hover a sidebar shelf while dragging and it opens, like spring-loaded folders in Finder.
function springLoad() {
  const item = document.elementsFromPoint(drag.px, drag.py).find((n) => n.classList?.contains('nav-item'));
  if (item === drag.springNav) return;
  clearSpring();
  if (!item || item.classList.contains('on')) return;
  drag.springNav = item; item.classList.add('spring');
  drag.springTimer = setTimeout(() => { item.classList.remove('spring'); setView(item.dataset.view); drag.springNav = null; findTarget(); }, 450);
}
function clearSpring() { clearTimeout(drag.springTimer); drag.springNav?.classList.remove('spring'); drag.springNav = null; }
function step() {
  if (!drag.on) return;
  // aim at the pointer; near a target, the target's gravity pulls the icon in
  let tx = drag.returning ? drag.home.x : drag.px, ty = drag.returning ? drag.home.y : drag.py;
  if (drag.target && !drag.returning && drag.target.isConnected) { const c = center(drag.target.querySelector('img, .ph')); tx += (c.x - tx) * 0.45; ty += (c.y - ty) * 0.45; }
  const k = drag.returning ? 0.16 : 0.3, damp = drag.returning ? 0.7 : 0.62;
  drag.vx = (drag.vx + (tx - drag.x) * k) * damp; drag.vy = (drag.vy + (ty - drag.y) * k) * damp;
  drag.x += drag.vx; drag.y += drag.vy;
  const tilt = Math.max(-18, Math.min(18, drag.vx * 0.9));
  const stretch = Math.min(0.12, Math.hypot(drag.vx, drag.vy) * 0.004);
  const s = drag.returning ? 1 : drag.target ? 0.92 : 1.12;
  ghost.style.transform = `translate(${drag.x}px, ${drag.y}px) rotate(${tilt}deg) scale(${s + stretch}, ${s - stretch})`;
  if (!drag.returning) autoScroll();
  if (drag.returning && Math.hypot(drag.home.x - drag.x, drag.home.y - drag.y) < 0.8 && Math.hypot(drag.vx, drag.vy) < 0.3) {
    drag.on = false; ghost.hidden = true; liveTile(drag.app.id)?.classList.remove('lifted'); return;
  }
  requestAnimationFrame(step);
}
function autoScroll() {
  const wrap = $('#boardWrap'), r = wrap.getBoundingClientRect(), edge = 70;
  if (drag.px < r.left) return;
  if (drag.py < r.top + edge && drag.py > r.top - 40) wrap.scrollTop -= (r.top + edge - drag.py) * 0.25;
  else if (drag.py > r.bottom - edge && drag.py < r.bottom + 40) wrap.scrollTop += (drag.py - (r.bottom - edge)) * 0.25;
  else return;
  findTarget();
}
function setHint(text, live) {
  const h = $('#hint');
  if (live) { h.replaceChildren(text); h.classList.add('live'); }
  else { h.replaceChildren(el('span', 'hint-key', 'Drag'), ' one app onto another to fuse them.'); h.classList.remove('live'); }
}
const resetHint = () => setHint();
function finishOnTarget(targetTile) {
  const from = { x: drag.x, y: drag.y };
  liveTile(drag.app.id)?.classList.remove('lifted');
  resetHint();
  fuseApps(drag.app, byId(targetTile.dataset.id), from);
}

// ---------- colour ----------
function hsl(hex) {
  const n = parseInt((hex || '#9b7bff').slice(1), 16), r = (n >> 16) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2, d = max - min;
  let h = 0;
  if (d) h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return { h: Math.round(h * 60 + 360) % 360, s: d ? d / (1 - Math.abs(2 * l - 1)) : 0, l };
}
// Icon averages can be dull (white, grey); push them to a vivid, glowing version of the same hue.
function vivid(hex) {
  const { h, s, l } = hsl(hex);
  return s < 0.12 ? 'hsl(258 90% 70%)' : `hsl(${h} ${Math.max(78, Math.round(s * 100))}% ${Math.min(66, Math.max(56, Math.round(l * 100)))}%)`;
}
const vividHex = vivid; // CSS accepts hsl() wherever a colour goes
const gloss = (hex) => `radial-gradient(circle at 34% 28%, rgba(255,255,255,.95), transparent 26%), radial-gradient(circle at 50% 55%, ${vivid(hex)}, color-mix(in srgb, ${vivid(hex)} 55%, #120d24) 100%)`;

// ---------- sparks (canvas) ----------
const sparks = { list: [], running: false };
function burst(x, y, colors, n = 70) {
  const cv = $('#sparks'), dpr = devicePixelRatio || 1;
  if (cv.width !== innerWidth * dpr) { cv.width = innerWidth * dpr; cv.height = innerHeight * dpr; }
  for (let i = 0; i < n; i++) {
    const ang = Math.random() * Math.PI * 2, sp = 2 + Math.random() * 9;
    sparks.list.push({ x, y, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp - 1.5, life: 1, decay: 0.012 + Math.random() * 0.022, r: 1 + Math.random() * 2.6, c: colors[i % colors.length] });
  }
  if (!sparks.running) { sparks.running = true; requestAnimationFrame(drawSparks); }
}
function drawSparks() {
  const cv = $('#sparks'), ctx = cv.getContext('2d'), dpr = devicePixelRatio || 1;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, innerWidth, innerHeight);
  ctx.globalCompositeOperation = 'lighter';
  sparks.list = sparks.list.filter((p) => p.life > 0);
  for (const p of sparks.list) {
    p.vx *= 0.94; p.vy = p.vy * 0.94 + 0.12; p.x += p.vx; p.y += p.vy; p.life -= p.decay;
    ctx.globalAlpha = Math.max(0, p.life);
    ctx.fillStyle = p.c; ctx.shadowColor = p.c; ctx.shadowBlur = 12;
    ctx.beginPath(); ctx.arc(p.x, p.y, p.r * (0.5 + p.life * 0.6), 0, Math.PI * 2); ctx.fill();
    // a short streak behind each spark
    ctx.globalAlpha = Math.max(0, p.life) * 0.4; ctx.lineWidth = p.r; ctx.strokeStyle = p.c;
    ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - p.vx * 3, p.y - p.vy * 3); ctx.stroke();
  }
  if (sparks.list.length) requestAnimationFrame(drawSparks);
  else { sparks.running = false; ctx.clearRect(0, 0, innerWidth, innerHeight); }
}
// Tiles near the impact get pushed out by the shockwave and spring back.
function ripple(at, skip) {
  document.querySelectorAll('.tile').forEach((t) => {
    if (t === skip) return;
    const c = center(t), dx = c.x - at.x, dy = c.y - at.y, d = Math.hypot(dx, dy);
    if (d > 300 || d < 1) return;
    const push = (1 - d / 300) * 22;
    t.animate([{ transform: 'none' }, { transform: `translate(${(dx / d) * push}px, ${(dy / d) * push}px) scale(${1 - push / 200})` }, { transform: 'none' }],
      { duration: 760, delay: d * 0.7, easing: SPRING_SOFT, composite: 'add' });
  });
}

// ---------- the liquid fusion ----------
async function playFusion(a, b, from) {
  const tTile = liveTile(b.id);
  const to = tTile ? center(tTile.querySelector('img, .ph')) : { x: innerWidth / 2, y: innerHeight / 2 };
  if (reduce) return to;
  const fx = $('#fx'); fx.hidden = false;
  const ba = $('.ba', fx), bb = $('.bb', fx), ia = $('.fx-a', fx), ib = $('.fx-b', fx), flash = $('.flash', fx), rings = fx.querySelectorAll('.ring');
  ba.style.background = gloss(a.color); bb.style.background = gloss(b.color);
  fx.style.setProperty('--ra', vivid(a.color)); fx.style.setProperty('--rb', vivid(b.color));
  ia.src = a.icon || ''; ib.src = b.icon || '';
  const at = (p, extra = '') => `translate(${p.x}px, ${p.y}px) ${extra}`;
  tTile?.classList.add('lifted');
  const o = { fill: 'forwards' };
  // 1. the target braces (squash), the dragged icon dives in; both melt into their colour
  const travel = { duration: 520, easing: 'cubic-bezier(.5,0,.15,1)', ...o };
  ia.animate([{ transform: at(from, 'scale(1.1)'), opacity: 1 }, { transform: at(to, 'scale(.45) rotate(-25deg)'), opacity: 0 }], travel);
  ib.animate([{ transform: at(to), opacity: 1 }, { transform: at(to, 'scale(1.25, .85)'), opacity: 1, offset: 0.35 }, { transform: at(to, 'scale(.8, 1.2)'), opacity: 1, offset: 0.6 }, { transform: at(to, 'scale(.45)'), opacity: 0 }], travel);
  ba.animate([{ transform: at(from, 'scale(.2)') }, { transform: at(from, 'scale(.8)'), offset: 0.25 }, { transform: at(to, 'scale(.95)') }], travel);
  bb.animate([{ transform: at(to, 'scale(.2)') }, { transform: at(to, 'scale(1.05)') }], travel);
  await wait(480);
  // 2. impact: flash, two shockwave rings, sparks in both colours, the board ripples
  flash.animate([{ transform: at(to, 'scale(.2)'), opacity: 0 }, { transform: at(to, 'scale(1)'), opacity: 0.95, offset: 0.25 }, { transform: at(to, 'scale(1.6)'), opacity: 0 }], { duration: 700, easing: 'ease-out', ...o });
  rings.forEach((r, i) => r.animate([{ transform: at(to, 'scale(.2)'), opacity: 1 }, { transform: at(to, `scale(${2.6 + i * 1.2})`), opacity: 0 }], { duration: 760 + i * 180, delay: i * 90, easing: 'cubic-bezier(.1,.7,.2,1)', ...o }));
  burst(to.x, to.y, [vivid(a.color), vivid(b.color), '#ffffff']);
  ripple(to, tTile);
  for (const blob of [ba, bb]) blob.animate([{ transform: at(to, 'scale(.95)') }, { transform: at(to, 'scale(1.5)') }, { transform: at(to, 'scale(1)') }], { duration: 560, easing: SPRING, ...o });
  await wait(440);
  return to;
}
async function flyToOrb(to) {
  const fx = $('#fx');
  if (reduce || fx.hidden) { fx.hidden = true; return; }
  const orb = center($('#orb'));
  const mid = { x: (to.x + orb.x) / 2, y: Math.min(to.y, orb.y) - 120 }; // an arc, not a straight line
  const fly = { duration: 700, easing: 'cubic-bezier(.5,0,.2,1)', fill: 'forwards' };
  const anims = [...fx.querySelectorAll('.blob')].map((b, i) => b.animate([
    { transform: `translate(${to.x}px, ${to.y}px) scale(1)` },
    { transform: `translate(${mid.x + i * 14}px, ${mid.y}px) scale(.8)` },
    { transform: `translate(${orb.x}px, ${orb.y}px) scale(.45)` }], fly));
  await anims[0].finished;
  burst(orb.x, orb.y, ['#ffffff', vivid(current?.a.color), vivid(current?.b.color)], 18);
  fx.hidden = true;
  fx.querySelectorAll('*').forEach((n) => n.getAnimations().forEach((x) => x.cancel()));
  document.querySelectorAll('.tile.lifted').forEach((t) => t.classList.remove('lifted'));
}

// ---------- panel ----------
const body = () => $('#pBody');
const STEPS = ['ideas', 'build', 'review', 'run'];
function setStep(s, done = false) {
  const i = STEPS.indexOf(s);
  document.querySelectorAll('#stepper li').forEach((li, k) => { li.classList.toggle('done', k < i || (done && k === i)); li.classList.toggle('now', k === i); });
  $('#stepper').style.setProperty('--p', (i + (done ? 1 : 0.5)) / STEPS.length);
}
function setTitle(text) {
  const h = $('#pTitle');
  if (h.textContent === text) return;
  h.textContent = text; h.classList.remove('swap'); void h.offsetWidth; h.classList.add('swap');
}
function openPanel(a, b, title) {
  const p = $('#panel');
  p.classList.remove('closing');
  p.style.setProperty('--ca', vivid(a.color)); p.style.setProperty('--cb', vivid(b.color));
  $('#pA').src = a.icon || ''; $('#pB').src = b.icon || '';
  $('#pPair').textContent = `${a.name} + ${b.name}`;
  setTitle(title);
  foot(null);
  p.hidden = false;
}
async function closePanel() {
  const p = $('#panel');
  if (p.hidden) return;
  current = null;
  p.classList.add('closing'); await wait(330); p.hidden = true; p.classList.remove('closing', 'busy');
}
function busy(on, text) { $('#panel').classList.toggle('busy', on); setStage(text || ''); }
async function setStage(text) {
  const s = $('#pStage');
  if (s.textContent === text) return;
  s.classList.add('swap'); await wait(160); s.textContent = text; s.classList.remove('swap');
}
function foot(nodes) { const f = $('#pFoot'); if (!nodes) { f.hidden = true; f.replaceChildren(); return; } f.replaceChildren(...nodes); f.hidden = false; }
const STAGES = { writing: 'Writing the script…', checking: 'Checking that it compiles…', fixing: 'Found a mistake. Fixing it…' };
window.fuse.onStage((s) => { if ($('#panel').classList.contains('busy')) setStage(STAGES[s] || ''); });

function showError(msg, retry) {
  busy(false);
  const acts = [];
  if (/API key|Claude Code/i.test(msg)) { const b = el('button', 'btn btn-primary', 'Open Settings'); b.onclick = openSettings; acts.push(b); }
  if (retry) { const b = el('button', 'btn btn-quiet', 'Try again'); b.onclick = retry; acts.push(b); }
  body().replaceChildren(el('div', 'err', msg));
  foot(acts.length ? acts : null);
}

async function fuseApps(a, b, from) {
  if (!a || !b) return;
  current = { a, b, fusionId: `f${Date.now()}` };
  const mine = current;
  remember(a, b);
  const ideasCall = window.fuse.ideas(a, b); // start thinking while the animation plays
  const startAt = from || center(liveTile(a.id)?.querySelector('img, .ph') || document.body);
  const to = await playFusion(a, b, startAt);
  openPanel(a, b, 'Thinking of fusions…');
  setStep('ideas');
  body().replaceChildren(el('div', 'ghostcard'), el('div', 'ghostcard'), el('div', 'ghostcard'));
  busy(true, 'Claude is looking at what these two can do together.');
  await flyToOrb(to);
  const r = await ideasCall;
  if (current !== mine) return;
  if (!r.ok) return showError(r.error, () => fuseApps(a, b));
  current.ideas = r.data.ideas || [];
  busy(false);
  showIdeas();
}

function showIdeas() {
  setTitle('Pick a fusion');
  setStep('ideas');
  setStage('Three ideas from Claude, or describe your own.');
  const nodes = current.ideas.map((idea, i) => {
    const btn = el('button', 'idea'); btn.style.animationDelay = `${i * 80}ms`;
    btn.append(el('span', 'num', String(i + 1)), el('b', '', idea.title), el('p', '', idea.description));
    btn.onclick = () => build(idea);
    return btn;
  });
  const custom = el('form', 'custom');
  const field = el('label', 'field'); const input = el('input'); input.placeholder = 'Or describe your own…'; field.append(input);
  custom.append(field, el('button', 'btn btn-quiet', 'Build'));
  custom.onsubmit = (e) => { e.preventDefault(); const t = input.value.trim(); if (t) build({ title: t, description: t }); };
  body().replaceChildren(...nodes, custom);
  foot(null);
}

async function build(idea) {
  const mine = current; current.idea = idea;
  setTitle(idea.title);
  setStep('build');
  body().replaceChildren(el('div', 'ghostcard tall'), el('div', 'ghostcard'));
  foot(null);
  busy(true, STAGES.writing);
  const r = await window.fuse.build(current.a, current.b, idea);
  if (current !== mine) return;
  if (!r.ok) return showError(r.error, () => build(idea));
  current.plan = r.data;
  busy(false);
  showPlan();
}

const LANG = { applescript: 'AppleScript', javascript: 'JavaScript', shell: 'Shell' };
function checkIcon() {
  const ns = 'http://www.w3.org/2000/svg', svg = document.createElementNS(ns, 'svg'); svg.setAttribute('viewBox', '0 0 24 24'); svg.classList.add('check');
  const c = document.createElementNS(ns, 'circle'); c.setAttribute('cx', 12); c.setAttribute('cy', 12); c.setAttribute('r', 11);
  const p = document.createElementNS(ns, 'path'); p.setAttribute('d', 'm7 12.5 3.2 3.2L17 9');
  svg.append(c, p); return svg;
}
// A light syntax tint: comments, strings and a few keywords. Built with text nodes, never innerHTML.
const KW = /\b(tell|end|set|to|if|then|else|repeat|return|of|on|try|with|application|activate|do shell script|const|let|var|function|for|in|while|echo|fi|done|do)\b/;
function codeBlock(script, language) {
  const pre = el('pre', 'code');
  const comment = language === 'shell' ? /#.*/ : language === 'javascript' ? /\/\/.*/ : /--.*/;
  for (const line of String(script).split('\n')) {
    const row = el('span');
    let rest = line;
    while (rest) {
      const m = [[comment, 'c'], [/"(?:[^"\\]|\\.)*"?|'(?:[^'\\]|\\.)*'?/, 's'], [KW, 'k']]
        .map(([re, cls]) => { const x = re.exec(rest); return x && { i: x.index, t: x[0], cls }; })
        .filter(Boolean).sort((p, q) => p.i - q.i)[0];
      if (!m) { row.append(rest); break; }
      if (m.i) row.append(rest.slice(0, m.i));
      row.append(el('i', m.cls, m.t));
      rest = rest.slice(m.i + m.t.length);
      if (m.cls === 'c') break;
    }
    if (!line) row.append(' ');
    pre.append(row);
  }
  pre.querySelectorAll('i').forEach((n) => { n.style.fontStyle = n.className === 'c' ? 'italic' : 'normal'; });
  return pre;
}
function sec(title, ...kids) {
  const s = el('section', 'sec'); const h = el('h3'); h.append(title); s.append(h, ...kids); return s;
}
async function showPlan() {
  const { plan, a, b } = current;
  setTitle(plan.name);
  setStep('review');
  setStage('Read what it will do. Nothing runs until you approve.');

  const steps = el('ol', 'steps');
  plan.steps.forEach((s, i) => { const li = el('li', '', s); li.style.animationDelay = `${100 + i * 70}ms`; steps.append(li); });
  const what = sec('What it will do', steps);

  const risk = el('div', `risk ${plan.risk}`);
  const meter = el('div', 'meter'); meter.append(el('i'), el('i'), el('i'));
  risk.append(meter, el('b', '', `${plan.risk[0].toUpperCase()}${plan.risk.slice(1)} risk`));
  const badges = el('div', 'badges');
  badges.append(el('span', 'badge', LANG[plan.language] || plan.language));
  if ('compileError' in plan) badges.append(el('span', `badge ${plan.compileError ? 'high' : 'ok'}`, plan.compileError ? 'Doesn’t compile' : 'Compiles ✓'));
  (plan.permissions || []).forEach((p) => badges.append(el('span', 'badge', p)));
  [...badges.children].forEach((n, i) => { n.style.animationDelay = `${i * 50}ms`; });
  const undo = el('p', 'undo'); undo.append(el('strong', '', 'To undo: '), plan.undo);
  const safety = sec('Safety', risk, badges, undo); safety.style.animationDelay = '80ms';

  const code = el('details', 'sec code-sec'); code.style.animationDelay = '160ms';
  const sum = el('summary'); const h = el('h3'); h.append(el('span', 'chev', '›'), 'The script', el('span', 'grow'), (n => `${n} line${n === 1 ? '' : 's'}`)(String(plan.script).split('\n').length));
  sum.append(h); code.append(sum, codeBlock(plan.script, plan.language));

  const out = el('div', 'result'); out.hidden = true;
  body().replaceChildren(what, safety, code, out);

  const verdict = await window.fuse.check({ language: plan.language, script: plan.script });
  const run = el('button', 'btn btn-primary'); run.append(svgEl(ICON.play), 'Approve and run');
  const saved = FUSIONS.some((f) => f.id === current.fusionId);
  const save = el('button', 'btn btn-quiet', saved ? 'Saved ✓' : 'Save'); save.disabled = saved;
  const back = el('button', 'btn btn-quiet', current.ideas ? 'Other ideas' : 'Close');
  foot([back, save, run]);
  const blocked = !verdict.data?.ok ? `Blocked for safety: ${verdict.data?.reason || verdict.error}` : plan.compileError ? `This script doesn’t compile, so it won’t run:\n${plan.compileError}` : null;
  const showResult = (ok, text) => {
    out.hidden = false; out.className = `result ${ok ? 'ok' : 'bad'}`;
    out.replaceChildren(checkIcon(), el('pre', '', text));
    if (!ok) $('path', out).setAttribute('d', 'M8 8l8 8M16 8l-8 8');
    out.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  };
  if (blocked) { run.disabled = true; showResult(false, blocked); }
  run.onclick = async () => {
    run.classList.add('busy'); run.lastChild.textContent = 'Running…';
    setStep('run');
    const id = FUSIONS.some((f) => f.id === current.fusionId) ? current.fusionId : undefined;
    const r = await window.fuse.run({ language: plan.language, script: plan.script, id });
    const res = r.ok ? r.data : { ok: false, output: r.error };
    setStep('run', res.ok);
    showResult(res.ok, (res.output || '').trim() || (res.ok ? 'Done.' : 'It failed without a message.'));
    if (res.ok) { const c = center(run); burst(c.x, c.y - 10, ['#4ade80', '#ffffff', vivid(a.color)], 34); }
    run.classList.remove('busy'); run.lastChild.textContent = 'Run again';
    if (id) refreshShelf();
  };
  save.onclick = async () => {
    const f = { id: current.fusionId, a: pick(a), b: pick(b), idea: current.idea, plan, savedAt: new Date().toISOString() };
    const r = await window.fuse.saveFusion(f);
    if (r.ok) { FUSIONS = r.data; renderShelf(f.id); save.textContent = 'Saved ✓'; save.disabled = true; toast('Saved to Your fusions.'); }
  };
  back.onclick = () => (current.ideas ? showIdeas() : closePanel());
}
const pick = (x) => ({ id: x.id, name: x.name, icon: x.icon, color: x.color });

// ---------- fusions shelf ----------
function ago(iso) {
  const s = (Date.now() - new Date(iso)) / 1000;
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  const d = Math.floor(s / 86400); return d === 1 ? 'yesterday' : `${d} days ago`;
}
function statusOf(f) {
  if (!f.lastRun) return ['', 'Never run'];
  return f.lastRun.ok ? ['ok', `Ran ${ago(f.lastRun.at)}`] : ['bad', `Failed ${ago(f.lastRun.at)}`];
}
async function refreshShelf() { const r = await window.fuse.fusions(); if (r.ok) { FUSIONS = r.data; renderShelf(); } }
function renderShelf(fresh) {
  const row = $('#shelf'); row.replaceChildren();
  $('#fusionCount').textContent = FUSIONS.length || '';
  if (!FUSIONS.length) {
    const e = el('div', 'shelf-empty'); const mini = el('span', 'mini'); mini.append(el('i'), el('i'));
    e.append(mini, 'Fusions you save live here. Run them again any time in one click.');
    row.append(e); return;
  }
  FUSIONS.forEach((f, i) => {
    const c = el('div', `fcard${f.id === fresh ? ' new' : ''}`); c.title = `${f.plan.name}\nRight-click to delete`; c.style.animationDelay = `${i * 40}ms`;
    c.style.setProperty('--ca', vivid(f.a.color)); c.style.setProperty('--cb', vivid(f.b.color));
    c.setAttribute('role', 'button'); c.tabIndex = 0;
    const duo = el('span', 'duo'); duo.append(iconEl(f.a), iconEl(f.b));
    const [cls, text] = statusOf(f);
    const st = el('span', `fstatus ${cls}`); st.append(el('span', 'dot'), text);
    if (f.runs) st.append(` · ${f.runs} run${f.runs === 1 ? '' : 's'}`);
    const meta = el('span', 'fmeta'); meta.append(el('b', '', f.plan.name), st);
    const play = el('button', 'play'); play.title = 'Run now'; play.setAttribute('aria-label', `Run ${f.plan.name}`); play.append(svgEl(ICON.play));
    play.onclick = async (e) => {
      e.stopPropagation();
      play.classList.add('spin'); st.className = 'fstatus running'; st.replaceChildren(el('span', 'dot'), 'Running…');
      const r = await window.fuse.run({ language: f.plan.language, script: f.plan.script, id: f.id });
      const res = r.ok ? r.data : { ok: false, output: r.error };
      toast(res.ok ? `${f.plan.name}: done.` : `${f.plan.name} failed. Open it to see why.`, res.ok);
      if (res.ok) { const p = center(play); burst(p.x, p.y, ['#4ade80', '#ffffff'], 24); }
      refreshShelf();
    };
    c.append(duo, meta, play);
    const open = () => { current = { a: f.a, b: f.b, idea: f.idea, plan: f.plan, fusionId: f.id }; openPanel(f.a, f.b, f.plan.name); busy(false); showPlan(); };
    c.onclick = open; c.onkeydown = (e) => { if (e.key === 'Enter') open(); };
    c.oncontextmenu = async (e) => { e.preventDefault(); if (confirm(`Delete the fusion “${f.plan.name}”?`)) { const r = await window.fuse.deleteFusion(f.id); if (r.ok) { FUSIONS = r.data; renderShelf(); } } };
    row.append(c);
  });
  if (fresh) row.scrollTo({ left: 0, behavior: 'smooth' });
}
let toastTimer;
function toast(text, ok = true) {
  const t = $('#toast'); t.hidden = false;
  const d = el('span', 'dot'); d.style.background = ok ? 'var(--low)' : 'var(--high)'; d.style.boxShadow = `0 0 8px ${ok ? 'var(--low)' : 'var(--high)'}`;
  t.replaceChildren(d, text);
  t.style.animation = 'none'; void t.offsetWidth; t.style.animation = '';
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { t.hidden = true; }, 3200);
}

// ---------- connection + settings ----------
let CONN = {};
async function refreshKey() {
  const d = (await window.fuse.keyStatus()).data || {};
  CONN = d;
  const text = d.hasKey ? 'Claude API key' : d.claudeCode ? 'Your Claude plan' : 'Connect Claude';
  const cls = d.hasKey || d.claudeCode ? 'ok' : 'warn';
  $('#conn').className = `conn ${cls}`; $('#connText').textContent = text;
  $('#provider').textContent = d.hasKey ? 'Using your Anthropic API key.' : d.claudeCode ? 'Using your Claude plan through Claude Code. No API key needed.' : 'No Claude connection yet. Install Claude Code, or add an API key below.';
  const w = $('#welcomeConn');
  w.className = `welcome-conn ${cls}`;
  w.replaceChildren(el('span', 'dot'), d.hasKey ? 'Connected with your API key.' : d.claudeCode ? 'Connected to your Claude plan through Claude Code.' : 'Needs Claude Code or an API key. You can add one in Settings.');
}
function openSettings() { refreshKey(); $('#keyInput').value = ''; $('#modal').hidden = false; }
$('#settingsBtn').onclick = openSettings;
$('#conn').onclick = openSettings;
$('#modalCancel').onclick = () => { $('#modal').hidden = true; };
$('#modal').onclick = (e) => { if (e.target.id === 'modal') $('#modal').hidden = true; };
$('#keySave').onclick = async () => { const k = $('#keyInput').value.trim(); if (!k) return; await window.fuse.setKey(k); $('#modal').hidden = true; refreshKey(); };
$('#keyClear').onclick = async () => { await window.fuse.setKey(''); $('#modal').hidden = true; refreshKey(); };
$('#getKey').onclick = (e) => { e.preventDefault(); window.fuse.openUrl('https://console.anthropic.com/settings/keys'); };
$('#panelClose').onclick = closePanel;
$('#search').oninput = () => { renderNav(); renderBoard(true); };
$('#nav').addEventListener('click', (e) => { const n = e.target.closest('.nav-item'); if (n) setView(n.dataset.view); });
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') { if (!$('#modal').hidden) $('#modal').hidden = true; else if ($('#search').value && document.activeElement === $('#search')) { $('#search').value = ''; $('#search').oninput(); } else closePanel(); }
  if ((e.metaKey || e.ctrlKey) && e.key === 'f') { e.preventDefault(); $('#search').focus(); }
});
addEventListener('resize', movePill);

// ---------- first launch ----------
function showWelcome() {
  const pair = PREFS.favourites.map(byId).filter((a) => a?.icon).slice(0, 2);
  const [a, b] = pair.length === 2 ? pair : APPS.filter((x) => x.icon).slice(0, 2);
  if (a) $('.demo-a').src = a.icon; if (b) $('.demo-b').src = b.icon;
  if (a && b) { $('.dg.a').style.background = vivid(a.color); $('.dg.b').style.background = vivid(b.color); }
  $('#welcome').hidden = false;
  $('#welcomeGo').onclick = async () => {
    savePrefs({ onboarded: true });
    const w = $('#welcome'); w.classList.add('leaving'); await wait(440); w.hidden = true; w.classList.remove('leaving');
  };
}
// On first launch, favourites start with familiar apps that are actually installed.
const STARTERS = ['com.apple.Notes', 'com.apple.iCal', 'com.apple.reminders', 'com.apple.mail', 'com.apple.Safari', 'com.google.Chrome', 'com.apple.Music', 'com.spotify.client', 'com.apple.Photos', 'com.apple.MobileSMS', 'com.tinyspeck.slackmacgap', 'notion.id', 'com.microsoft.VSCode', 'com.apple.TextEdit', 'com.apple.Terminal', 'com.apple.finder'];

// ---------- start ----------
let LOADING = true;
(async () => {
  const pr = await window.fuse.prefs();
  if (pr.ok) PREFS = { ...PREFS, ...pr.data };
  refreshKey();
  renderNav(); renderBoard();
  const [apps, fusions] = await Promise.all([window.fuse.apps(), window.fuse.fusions()]);
  LOADING = false;
  APPS = apps.ok ? apps.data : [];
  if (!apps.ok) $('#boardStatus').textContent = `Couldn’t list apps: ${apps.error}`;
  if (!pr.data?.favourites) savePrefs({ favourites: STARTERS.filter(byId).slice(0, 12) });
  setView(PREFS.view, { quiet: true });
  FUSIONS = fusions.ok ? fusions.data : [];
  renderShelf();
  if (!PREFS.onboarded) showWelcome();
})();

// test hook: fuse two apps by bundle id without dragging
window.__fuseTest = (aId, bId) => fuseApps(byId(aId), byId(bId));

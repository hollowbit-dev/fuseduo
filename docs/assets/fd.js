// Fuseduo site: the live drag-and-fuse demo, scroll reveals and small touches.
(() => {
  // asset paths follow wherever this script is served from (hollowbit.dev/fuseduo/ or fuseduo.com/)
  const ASSETS = new URL('.', document.currentScript.src).href;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- general ---------- */
  const email = ['hollowbitstudio', 'gmail.com'].join('@');
  $$('[data-email-link]').forEach((a) => { a.href = `mailto:${email}?subject=${encodeURIComponent(a.dataset.emailLink || 'Fuseduo')}`; });
  $$('[data-email]').forEach((n) => { n.textContent = email; });
  // the film: opens in a dialog, plays with sound, stops when closed
  const film = $('#film');
  if (film) {
    const v = $('video', film);
    $$('[data-film]').forEach((b) => b.addEventListener('click', () => { if (!v.src) v.src = v.dataset.src; film.showModal(); v.currentTime = 0; v.play().catch(() => {}); }));
    $('.close', film).addEventListener('click', () => film.close());
    film.addEventListener('click', (e) => { if (e.target === film) film.close(); });
    film.addEventListener('close', () => v.pause());
  }
  const menu = $('.menu-btn');
  if (menu) menu.addEventListener('click', () => { const l = $('.links'); l.classList.toggle('open'); menu.setAttribute('aria-expanded', l.classList.contains('open')); });
  // scroll reveals
  const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { rootMargin: '0px 0px -8% 0px' });
  $$('[data-reveal]').forEach((n) => io.observe(n));
  // light that follows the pointer on cards
  document.addEventListener('pointermove', (e) => {
    const c = e.target.closest?.('.card'); if (!c) return;
    const r = c.getBoundingClientRect();
    c.style.setProperty('--mx', `${e.clientX - r.left}px`); c.style.setProperty('--my', `${e.clientY - r.top}px`);
  });
  // the product shot tilts flat as it scrolls into view
  const shot = $('.shot-in');
  if (shot && !reduce) {
    const tilt = () => {
      const r = shot.getBoundingClientRect(), p = Math.min(1, Math.max(0, (innerHeight - r.top) / (innerHeight * 0.8)));
      shot.style.setProperty('--tilt', `${(1 - p) * 16}deg`); shot.style.setProperty('--sc', 0.92 + p * 0.08);
    };
    let q = false;
    addEventListener('scroll', () => { if (!q) { q = true; requestAnimationFrame(() => { q = false; tilt(); }); } }, { passive: true }); tilt();
  }

  /* ---------- the demo ---------- */
  const stage = $('#stage');
  if (!stage) return;
  const APPS = {
    notes: ['Notes', '#f6c945'], calendar: ['Calendar', '#ff5a5f'], reminders: ['Reminders', '#5aa7ff'], mail: ['Mail', '#3b8bff'],
    safari: ['Safari', '#33b5ff'], music: ['Music', '#ff4f6d'], photos: ['Photos', '#ffaa3c'], messages: ['Messages', '#3ddc6a'],
  };
  const icon = (id) => `${ASSETS}apps/${id}.png`;
  // Example ideas, written by hand for the demo. In the app, Claude writes these for whatever pair you drop.
  const L = 'low', M = 'medium';
  const IDEAS = {
    'calendar+notes': [
      ['Today’s agenda note', 'A new note listing today’s events, in order, ready for notes.', ['Asks Calendar for every event today.', 'Sorts them by start time.', 'Creates a note titled with today’s date and fills it in.'], L, 'Created “Agenda · Today” with 4 events.'],
      ['Meeting notes, pre-filled', 'A note for your next meeting with the time and people already in it.', ['Finds your next event in Calendar.', 'Reads its title, time and invitees.', 'Creates a note with Agenda and Actions headings.'], L, 'Created “Design review · 14:00”.'],
      ['Week ahead', 'A one-page summary of the next seven days.', ['Reads the next 7 days of events.', 'Groups them by day.', 'Writes a tidy “Week ahead” note.'], L, 'Created “Week ahead” with 12 events.'],
    ],
    'music+notes': [
      ['Listening log', 'Adds the song playing right now to a running note, with the time.', ['Reads the song and artist playing in Music.', 'Finds the note “Listening log”, or makes it.', 'Adds a line with the time.'], L, 'Added “Midnight City · M83” to Listening log.'],
      ['Playlist from a note', 'Turns the songs listed in your selected note into a playlist.', ['Reads the lines of the selected note.', 'Searches your library for each song.', 'Makes a new playlist with the matches.'], M, 'Made “From Notes” with 9 of 11 songs.'],
      ['Album notes', 'A note about the album you’re playing, with its track list.', ['Reads the current album in Music.', 'Lists its tracks and length.', 'Creates a note you can write in.'], L, 'Created “Notes on Random Access Memories”.'],
    ],
    'mail+reminders': [
      ['Flagged mail to reminders', 'Every flagged email becomes a reminder that links back to it.', ['Finds flagged emails in your inbox.', 'Skips ones you already have reminders for.', 'Adds a reminder for each, with the sender.'], L, 'Added 3 reminders from flagged mail.'],
      ['Follow-up nudge', 'A reminder in three days to chase the email you’ve selected.', ['Reads the selected email’s subject and sender.', 'Works out the date three days from now.', 'Adds a reminder for that morning.'], L, 'Reminder set for Monday 09:00.'],
      ['Inbox to-do digest', 'Pulls the asks out of today’s mail into one checklist.', ['Reads today’s unread subjects.', 'Picks the ones that ask you for something.', 'Adds them to a “From Mail” list.'], L, 'Added 5 items to “From Mail”.'],
    ],
    'notes+safari': [
      ['Save my open tabs', 'Every open tab’s title and link, saved into one new note.', ['Goes through every Safari window and tab.', 'Collects each page’s title and link.', 'Creates a dated note with the list.'], L, 'Saved 14 tabs to “Tabs · Today”.'],
      ['Quote the page', 'The text you’ve highlighted in Safari, quoted in a note with its link.', ['Reads the selected text in Safari.', 'Gets the page title and address.', 'Adds a quote to your “Clippings” note.'], L, 'Added a quote to Clippings.'],
      ['Reading list note', 'Your Safari Reading List as a checklist note.', ['Reads your Reading List.', 'Makes each item a checklist line.', 'Creates the note.'], L, 'Created “To read” with 8 links.'],
    ],
    'calendar+reminders': [
      ['Due today, blocked out', 'Puts time on your calendar for the reminders due today.', ['Reads reminders due today.', 'Finds free gaps in today’s calendar.', 'Adds a block for each one.'], M, 'Blocked 3 slots this afternoon.'],
      ['Prep before meetings', 'A reminder 15 minutes before each meeting today.', ['Reads today’s events.', 'Works out 15 minutes before each.', 'Adds a timed reminder for each.'], L, 'Added 4 prep reminders.'],
      ['Weekly review', 'A checklist from this week’s events and open reminders.', ['Reads this week’s events.', 'Reads reminders still open.', 'Adds a “Weekly review” list.'], L, 'Created “Weekly review” with 11 items.'],
    ],
    'mail+photos': [
      ['Share today’s photos', 'A new email draft with today’s photos attached. It never sends.', ['Finds photos taken today.', 'Exports them to a temporary folder.', 'Opens a new draft with them attached.'], M, 'Opened a draft with 6 photos attached.'],
      ['Photo of the day', 'Your favourite photo from today in a draft to yourself.', ['Finds today’s favourited photo.', 'Exports a smaller copy.', 'Opens a draft addressed to you.'], M, 'Opened a draft with 1 photo.'],
      ['Receipts from photos', 'Screenshots of receipts gathered into one email draft.', ['Finds screenshots from this week.', 'Picks the ones that look like receipts.', 'Opens a draft with them attached.'], M, 'Opened a draft with 3 receipts.'],
    ],
    'calendar+music': [
      ['Focus until the next meeting', 'Plays a focus playlist and tells you how long you have.', ['Finds your next event today.', 'Works out the free time before it.', 'Starts your “Focus” playlist.'], M, 'Playing Focus · 52 minutes free.'],
      ['Soundtrack the day', 'A playlist sized to fit your free time today.', ['Adds up today’s free time.', 'Picks songs from your library to fill it.', 'Makes a new playlist.'], M, 'Made “Today” · 2 h 10 min.'],
      ['Meeting quiet', 'Pauses music and shows what’s up next.', ['Pauses Music if it’s playing.', 'Reads your next event.', 'Shows its title and time.'], M, 'Paused · next: Standup at 10:00.'],
    ],
  };
  const generic = (a, b) => [
    [`${a} + ${b} workspace`, `Opens ${a} and ${b} side by side, sized to fill your screen.`, [`Opens ${a} and ${b}.`, 'Measures your screen.', 'Puts one window on each half.'], M, `Arranged ${a} and ${b}.`],
    ['Daily snapshot note', `A short dated note of what ${a} and ${b} are showing now.`, [`Reads what’s open in ${a}.`, `Reads what’s open in ${b}.`, 'Writes a dated note in Notes.'], L, 'Created “Snapshot · Today”.'],
    ['Focus on just these two', `Hides every other app and leaves ${a} and ${b}.`, ['Lists the apps that are open.', `Hides all of them except ${a} and ${b}.`, 'Brings both to the front.'], M, 'Hid 7 other apps.'],
  ];
  const ideasFor = (x, y) => IDEAS[[x, y].sort().join('+')] || generic(APPS[x][0], APPS[y][0]);

  // build the board
  const board = $('.board', stage), hint = $('#hint');
  for (const [id, [name, c]] of Object.entries(APPS)) {
    const t = el('div', 'app'); t.dataset.id = id; t.style.setProperty('--c', c);
    const img = el('img'); img.src = icon(id); img.alt = ''; img.draggable = false; img.width = 74; img.height = 74;
    t.append(img, el('span', '', name));
    board.append(t);
  }
  const ghost = $('.ghost', stage), cursor = $('.cursor', stage), panel = $('.dpanel', stage);
  const local = (x, y) => { const r = stage.getBoundingClientRect(); return { x: x - r.left, y: y - r.top }; };
  const centerOf = (n) => { const r = n.getBoundingClientRect(), s = stage.getBoundingClientRect(); return { x: r.left - s.left + r.width / 2, y: r.top - s.top + r.height / 2 }; };
  const setHint = (t, live) => { hint.textContent = t; hint.classList.toggle('live', !!live); };
  const HINT = 'Try it: drag one app onto another';

  /* sparks: sprites drawn once, stamped per frame */
  const cv = $('.sparks', stage), sparks = { list: [], on: false, sprites: new Map() };
  function sprite(color) {
    if (sparks.sprites.has(color)) return sparks.sprites.get(color);
    const c = document.createElement('canvas'); c.width = c.height = 32;
    const g = c.getContext('2d'), gr = g.createRadialGradient(16, 16, 0, 16, 16, 16);
    gr.addColorStop(0, '#fff'); gr.addColorStop(0.2, color); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 32, 32); sparks.sprites.set(color, c); return c;
  }
  function burst(p, colors, n = 54) {
    if (reduce) return;
    const dpr = Math.min(2, devicePixelRatio || 1), r = stage.getBoundingClientRect();
    if (cv.width !== Math.round(r.width * dpr)) { cv.width = Math.round(r.width * dpr); cv.height = Math.round(r.height * dpr); }
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, s = 2 + Math.random() * 8;
      sparks.list.push({ x: p.x, y: p.y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 1.4, life: 1, decay: 0.015 + Math.random() * 0.02, r: 7 + Math.random() * 9, img: sprite(colors[i % colors.length]) });
    }
    if (!sparks.on) { sparks.on = true; requestAnimationFrame(drawSparks); }
  }
  function drawSparks() {
    const ctx = cv.getContext('2d'), dpr = Math.min(2, devicePixelRatio || 1);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, cv.width, cv.height); ctx.globalCompositeOperation = 'lighter';
    sparks.list = sparks.list.filter((p) => p.life > 0);
    for (const p of sparks.list) {
      p.vx *= 0.94; p.vy = p.vy * 0.94 + 0.12; p.x += p.vx; p.y += p.vy; p.life -= p.decay;
      const s = p.r * (0.45 + p.life * 0.65);
      ctx.globalAlpha = Math.max(0, p.life); ctx.drawImage(p.img, p.x - s, p.y - s, s * 2, s * 2);
    }
    if (sparks.list.length) requestAnimationFrame(drawSparks); else { sparks.on = false; ctx.clearRect(0, 0, cv.width, cv.height); }
  }

  /* dragging (real pointer, or the autoplay cursor) */
  const drag = { on: false };
  function begin(tile, p) {
    Object.assign(drag, { on: true, tile, id: tile.dataset.id, x: p.x, y: p.y, px: p.x, py: p.y, vx: 0, vy: 0, target: null, home: centerOf($('img', tile)), back: false });
    drag.x = drag.home.x; drag.y = drag.home.y;
    tile.classList.add('lifted'); stage.classList.add('dragging');
    $('img', ghost).src = icon(drag.id); ghost.hidden = false;
    setHint(`Drop ${APPS[drag.id][0]} onto another app`, true);
    requestAnimationFrame(step);
  }
  function move(p) {
    drag.px = p.x; drag.py = p.y;
    const r = stage.getBoundingClientRect();
    const under = document.elementsFromPoint(p.x + r.left, p.y + r.top).find((n) => n.classList?.contains('app') && n !== drag.tile);
    if (under !== drag.target) {
      drag.target?.classList.remove('target'); drag.target = under || null; under?.classList.add('target');
      setHint(under ? `Fuse ${APPS[drag.id][0]} with ${APPS[under.dataset.id][0]}` : `Drop ${APPS[drag.id][0]} onto another app`, true);
    }
  }
  function end() {
    if (!drag.on) return;
    stage.classList.remove('dragging');
    const t = drag.target; t?.classList.remove('target'); drag.target = null;
    if (t) { drag.on = false; ghost.hidden = true; drag.tile.classList.remove('lifted'); fuse(drag.id, t.dataset.id, { x: drag.x, y: drag.y }); }
    else { drag.back = true; setHint(HINT); }
  }
  function step() {
    if (!drag.on) return;
    let tx = drag.back ? drag.home.x : drag.px, ty = drag.back ? drag.home.y : drag.py;
    if (drag.target && !drag.back) { const c = centerOf($('img', drag.target)); tx += (c.x - tx) * 0.45; ty += (c.y - ty) * 0.45; }
    const k = drag.back ? 0.16 : 0.3, damp = drag.back ? 0.7 : 0.62;
    drag.vx = (drag.vx + (tx - drag.x) * k) * damp; drag.vy = (drag.vy + (ty - drag.y) * k) * damp;
    drag.x += drag.vx; drag.y += drag.vy;
    const tilt = Math.max(-18, Math.min(18, drag.vx * 0.9)), s = drag.back ? 1 : drag.target ? 0.92 : 1.1;
    ghost.style.transform = `translate(${drag.x}px, ${drag.y}px) rotate(${tilt}deg) scale(${s})`;
    if (drag.back && Math.hypot(drag.home.x - drag.x, drag.home.y - drag.y) < 0.8 && Math.hypot(drag.vx, drag.vy) < 0.3) {
      drag.on = false; ghost.hidden = true; drag.tile.classList.remove('lifted'); return;
    }
    requestAnimationFrame(step);
  }
  let userDriven = false;
  stage.addEventListener('pointerdown', (e) => {
    userDriven = true;
    if (auto) { // the visitor takes over from the autoplay cursor
      stopAuto();
      if (drag.on) { drag.target?.classList.remove('target'); drag.target = null; end(); }
      return;
    }
    const tile = e.target.closest('.app');
    if (!tile || busy || drag.on || stage.classList.contains('open')) return;
    e.preventDefault(); tile.setPointerCapture(e.pointerId);
    const start = local(e.clientX, e.clientY); let started = false;
    const mv = (ev) => { const p = local(ev.clientX, ev.clientY); if (!started && Math.hypot(p.x - start.x, p.y - start.y) > 5) { started = true; begin(tile, p); } if (started) move(p); };
    const up = () => { tile.removeEventListener('pointermove', mv); tile.removeEventListener('pointerup', up); tile.removeEventListener('pointercancel', up); if (started) end(); };
    tile.addEventListener('pointermove', mv); tile.addEventListener('pointerup', up); tile.addEventListener('pointercancel', up);
  });

  /* the fusion */
  let busy = false;
  const at = (p, extra = '') => `translate(${p.x}px, ${p.y}px) ${extra}`;
  async function fuse(a, b, from) {
    busy = true;
    const ta = $(`.app[data-id="${a}"]`, stage), tb = $(`.app[data-id="${b}"]`, stage);
    const to = centerOf($('img', tb)); from ||= centerOf($('img', ta));
    const ca = APPS[a][1], cb = APPS[b][1];
    setHint(`Fusing ${APPS[a][0]} and ${APPS[b][0]}…`, true);
    if (!reduce) {
      const ba = $('.blob.a', stage), bb = $('.blob.b', stage), flash = $('.flash', stage);
      ba.style.background = `radial-gradient(circle at 34% 28%, #fff, transparent 26%), ${ca}`; bb.style.background = `radial-gradient(circle at 34% 28%, #fff, transparent 26%), ${cb}`;
      stage.style.setProperty('--ra', ca); stage.style.setProperty('--rb', cb);
      tb.classList.add('lifted');
      const o = { fill: 'forwards' }, travel = { duration: 480, easing: 'cubic-bezier(.5,0,.15,1)', ...o };
      ba.animate([{ transform: at(from, 'scale(.3)'), opacity: 1 }, { transform: at(to, 'scale(.95)'), opacity: 1 }], travel);
      bb.animate([{ transform: at(to, 'scale(.3)'), opacity: 1 }, { transform: at(to, 'scale(1.05)'), opacity: 1 }], travel);
      await wait(460);
      flash.animate([{ transform: at(to, 'scale(.2)'), opacity: 0 }, { transform: at(to, 'scale(1)'), opacity: 0.9, offset: 0.25 }, { transform: at(to, 'scale(1.6)'), opacity: 0 }], { duration: 700, easing: 'ease-out', ...o });
      $$('.ring', stage).forEach((r, i) => r.animate([{ transform: at(to, 'scale(.2)'), opacity: 1 }, { transform: at(to, `scale(${2.4 + i})`), opacity: 0 }], { duration: 760 + i * 160, delay: i * 90, easing: 'cubic-bezier(.1,.7,.2,1)', ...o }));
      burst(to, [ca, cb, '#ffffff']);
      // neighbours get pushed by the shockwave
      $$('.app', stage).forEach((t) => {
        if (t === tb) return;
        const c = centerOf(t), dx = c.x - to.x, dy = c.y - to.y, d = Math.hypot(dx, dy); if (d > 320) return;
        const push = (1 - d / 320) * 20;
        t.animate([{ translate: '0 0' }, { translate: `${(dx / d) * push}px ${(dy / d) * push}px` }, { translate: '0 0' }], { duration: 700, delay: d * 0.6, easing: 'cubic-bezier(.22,1.18,.36,1)' });
      });
      for (const blob of [ba, bb]) blob.animate([{ transform: at(to, 'scale(.95)'), opacity: 1 }, { transform: at(to, 'scale(1.45)'), opacity: 1 }, { transform: at(to, 'scale(.2)'), opacity: 0 }], { duration: 700, easing: 'cubic-bezier(.3,1.4,.6,1)', ...o });
      await wait(520);
      tb.classList.remove('lifted');
    }
    openPanel(a, b);
  }

  /* the panel: ideas → plan → run */
  const dpBody = $('.dp-body', panel), dpFoot = $('.dp-foot', panel);
  const steps = (n) => $$('.dp-steps i', panel).forEach((s, i) => s.classList.toggle('on', i < n));
  const head = (title, stageText) => { $('.dp-title', panel).textContent = title; $('.dp-stage', panel).textContent = stageText; };
  let cur = null;
  async function openPanel(a, b) {
    cur = { a, b, ideas: ideasFor(a, b) };
    panel.style.setProperty('--ca', APPS[a][1]); panel.style.setProperty('--cb', APPS[b][1]);
    $('.dp-pair', panel).replaceChildren(...[a, b].map((id) => { const i = el('img'); i.src = icon(id); i.alt = ''; return i; }), el('span', 'dp-orb'));
    $('.dp-eyebrow', panel).textContent = `${APPS[a][0]} + ${APPS[b][0]}`;
    stage.classList.add('open');
    panel.classList.add('busy'); head('Thinking of fusions…', 'Claude is looking at what these two can do together.'); steps(1);
    dpBody.replaceChildren(el('div', 'ghostcard'), el('div', 'ghostcard'), el('div', 'ghostcard')); dpFoot.replaceChildren();
    setHint('Pick an idea', true);
    const mine = cur;
    await wait(1100);
    if (cur !== mine) return; // reset while thinking
    panel.classList.remove('busy');
    showIdeas();
  }
  function showIdeas() {
    if (!cur) return;
    head('Pick a fusion', 'Three ideas, or describe your own.'); steps(1);
    dpBody.replaceChildren(...cur.ideas.map((idea, i) => {
      const b = el('button', 'idea'); b.style.animationDelay = `${i * 80}ms`;
      b.append(el('span', 'n', String(i + 1)), el('b', '', idea[0]), el('p', '', idea[1]));
      b.onclick = () => { stopAuto(); showPlan(idea); };
      return b;
    }));
    const close = el('button', 'btn btn-glass', 'Try another pair'); close.onclick = () => { stopAuto(); reset(); };
    dpFoot.replaceChildren(close);
  }
  async function showPlan(idea) {
    const mine = cur; if (!mine) return;
    panel.classList.add('busy'); head(idea[0], 'Writing the script…'); steps(2);
    dpBody.replaceChildren(el('div', 'ghostcard'), el('div', 'ghostcard')); dpFoot.replaceChildren();
    await wait(800); if (cur !== mine) return; head(idea[0], 'Checking that it compiles…'); await wait(500); if (cur !== mine) return;
    panel.classList.remove('busy'); head(idea[0], 'Nothing runs until you approve.'); steps(3);
    const what = el('div', 'psec'); what.append(el('h4', '', 'What it will do'));
    const ol = el('ol', 'psteps'); idea[2].forEach((s, i) => { const li = el('li', '', s); li.style.animationDelay = `${120 + i * 90}ms`; ol.append(li); }); what.append(ol);
    const safe = el('div', 'psec'); safe.style.animationDelay = '120ms'; safe.append(el('h4', '', 'Safety'));
    const risk = el('div', `risk ${idea[3]}`); const m = el('span', 'meter'); m.append(el('i'), el('i'), el('i'));
    risk.append(m, idea[3] === 'low' ? 'Low risk' : 'Medium risk');
    const chips = el('div', 'chips'); chips.append(el('span', 'chip', 'AppleScript'), el('span', 'chip ok', 'Compiles ✓'), el('span', 'chip', 'Asks before it runs'));
    safe.append(risk, chips);
    dpBody.replaceChildren(what, safe);
    const back = el('button', 'btn btn-glass', 'Back'); back.onclick = () => { stopAuto(); showIdeas(); };
    const run = el('button', 'btn btn-brand', 'Approve and run');
    run.onclick = async () => {
      stopAuto(); run.classList.add('running'); run.textContent = 'Running…'; steps(4);
      await wait(900); if (cur !== mine) return;
      const res = el('div', 'result');
      res.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="11"/><path d="m7 12.5 3.2 3.2L17 9"/></svg>';
      res.append(el('span', '', idea[4]));
      dpBody.append(res);
      const r = run.getBoundingClientRect(), s = stage.getBoundingClientRect();
      burst({ x: r.left - s.left + r.width / 2, y: r.top - s.top }, ['#4ade80', '#ffffff', APPS[mine.a][1]], 30);
      run.classList.remove('running'); run.textContent = 'Done';
      const again = el('button', 'btn btn-glass', 'Try another pair'); again.onclick = () => { stopAuto(); reset(); };
      dpFoot.replaceChildren(again, run); run.disabled = true;
      setHint('That’s a fusion. Saved ones run again in one click.', true);
    };
    dpFoot.replaceChildren(back, run);
  }
  function reset() {
    stage.classList.remove('open'); busy = false; cur = null; setHint(HINT);
  }

  /* autoplay: when nobody is touching it, a cursor shows the move */
  let auto = null, autoRuns = 0;
  function stopAuto() { if (auto) { auto.stop = true; auto = null; } cursor.classList.remove('on', 'down'); }
  async function glide(run, from, to, ms) {
    const t0 = performance.now();
    return new Promise((res) => {
      const f = (t) => {
        if (run.stop) return res(false);
        const k = Math.min(1, (t - t0) / ms), e = k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2;
        const p = { x: from.x + (to.x - from.x) * e, y: from.y + (to.y - from.y) * e - Math.sin(k * Math.PI) * 40 };
        cursor.style.transform = `translate(${p.x}px, ${p.y}px)`;
        if (drag.on) move(p);
        if (k < 1) requestAnimationFrame(f); else res(true);
      };
      requestAnimationFrame(f);
    });
  }
  const PAIRS = [['music', 'notes'], ['safari', 'notes'], ['mail', 'reminders'], ['calendar', 'notes']];
  async function autoplay() {
    if (userDriven || reduce || auto || busy) return;
    const run = auto = { stop: false };
    const [a, b] = PAIRS[autoRuns++ % PAIRS.length];
    const ta = $(`.app[data-id="${a}"]`, stage), tb = $(`.app[data-id="${b}"]`, stage);
    const pa = centerOf($('img', ta)), pb = centerOf($('img', tb));
    const startAt = { x: pa.x + 60, y: pa.y + 90 };
    cursor.style.transform = `translate(${startAt.x}px, ${startAt.y}px)`; cursor.classList.add('on');
    if (!(await glide(run, startAt, pa, 700))) return;
    cursor.classList.add('down'); await wait(160); if (run.stop) return;
    begin(ta, pa);
    if (!(await glide(run, pa, { x: pb.x + 6, y: pb.y + 4 }, 1300))) { if (drag.on) { drag.target = null; end(); } return; }
    await wait(250); if (run.stop) { end(); return; }
    cursor.classList.remove('down'); end(); cursor.classList.remove('on');
    await wait(2600); if (run.stop) return;
    const first = $('.idea', panel); if (!first) return;
    first.classList.add('pick'); await wait(500); if (run.stop || !cur) return;
    showPlan(cur.ideas[0]);
    await wait(4200); if (run.stop) return;
    reset(); auto = null;
    await wait(1600); autoplay();
  }
  const seen = new IntersectionObserver(([e]) => {
    if (e.isIntersecting) setTimeout(autoplay, 1400);
    else stopAuto();
  }, { threshold: 0.5 });
  seen.observe(stage);
  $('#replay')?.addEventListener('click', () => { userDriven = false; reset(); stopAuto(); autoplay(); });
  setHint(HINT);
})();

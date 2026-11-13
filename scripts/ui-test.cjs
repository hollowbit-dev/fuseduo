// Drives Fuseduo in mock mode with real mouse moves; screenshots each moment. Never runs real scripts (mock script only returns a string).
const { _electron: electron } = require(process.env.HOME + '/.claude/skills/playwright-skill/node_modules/playwright');
const S = (process.env.SHOTS || __dirname + '/shots') + '/';
const scheme = process.argv[2] || 'dark';
(async () => {
  const dir = process.env.HOME + '/Desktop/Fuseduo';
  const data = __dirname + '/data-' + scheme; require('fs').rmSync(data, { recursive: true, force: true });
  const app = await electron.launch({ args: [dir], cwd: dir, env: { ...process.env, FUSE_MOCK: '1', FUSE_DATA_DIR: data } });
  const win = await app.firstWindow(); const errs = [];
  win.on('pageerror', (e) => errs.push(e.message)); win.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
  await win.emulateMedia({ colorScheme: scheme });
  await win.waitForSelector('.welcome:not([hidden])', { timeout: 60000 }); await win.waitForTimeout(2700);
  await win.screenshot({ path: S + scheme + '-1-welcome.png' });
  await win.click('#welcomeGo'); await win.click('#permSkip'); await win.waitForTimeout(1200);
  await win.screenshot({ path: S + scheme + '-2-favourites.png' });
  console.log('fav tiles:', await win.$$eval('.tile', (t) => t.map((x) => x.dataset.id)));
  if (scheme !== 'dark') { await win.click('[data-view="all"]'); await win.waitForTimeout(900); await win.screenshot({ path: S + scheme + '-3-all.png' }); }
  const box = async (id) => (await win.$(`.tile[data-id="${id}"] img`)).boundingBox();
  const ids = await win.$$eval('.tile', (t) => t.map((x) => x.dataset.id));
  const A = ids[0], B = ids[3];
  const a = await box(A), b = await box(B);
  await win.mouse.move(a.x + a.width / 2, a.y + a.height / 2); await win.mouse.down();
  for (let i = 1; i <= 12; i++) { await win.mouse.move(a.x + a.width / 2 + (b.x - a.x) * i / 16, a.y + a.height / 2 + 60 * Math.sin(i / 4)); await win.waitForTimeout(16); }
  await win.screenshot({ path: S + scheme + '-4-drag.png' });
  await win.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 6 }); await win.waitForTimeout(300);
  console.log('target lit:', await win.$eval(`.tile[data-id="${B}"]`, (t) => t.classList.contains('target')), 'hint:', await win.textContent('#hint'));
  await win.screenshot({ path: S + scheme + '-5-magnet.png' });
  await win.mouse.up();
  await win.waitForTimeout(560); await win.screenshot({ path: S + scheme + '-6-impact.png' });
  await win.waitForTimeout(500); await win.screenshot({ path: S + scheme + '-7-fly.png' });
  await win.waitForSelector('.idea', { timeout: 20000 }); await win.waitForTimeout(900);
  await win.screenshot({ path: S + scheme + '-8-ideas.png' });
  await win.click('.idea'); await win.waitForSelector('.sec', { timeout: 20000 }); await win.waitForTimeout(1200);
  await win.click('.code-sec summary'); await win.waitForTimeout(500);
  await win.screenshot({ path: S + scheme + '-9-plan.png' });
  await win.click('#pFoot >> text=Save'); await win.waitForTimeout(400);
  await win.click('#pFoot .btn-primary'); await win.waitForTimeout(1400);
  await win.screenshot({ path: S + scheme + '-10-run.png' });
  await win.click('#panelClose'); await win.waitForTimeout(600);
  // spring-loaded sidebar: drag an app onto "All apps" and hold
  const c = await box(ids[1]); const nav = await (await win.$('[data-view="recent"]')).boundingBox();
  await win.mouse.move(c.x + 30, c.y + 30); await win.mouse.down(); await win.mouse.move(nav.x + 40, nav.y + 14, { steps: 10 }); await win.waitForTimeout(700);
  console.log('spring-loaded view:', await win.textContent('#viewTitle'));
  await win.screenshot({ path: S + scheme + '-11-springload.png' });
  await win.mouse.move(nav.x + 600, nav.y + 500, { steps: 6 }); await win.mouse.up(); await win.waitForTimeout(900);
  console.log('ghost hidden:', await win.$eval('#ghost', (g) => g.hidden), 'lifted left:', await win.$$eval('.tile.lifted', (t) => t.length));
  await win.screenshot({ path: S + scheme + '-12-shelf.png' });
  console.log('shelf:', await win.$$eval('.fcard', (x) => x.map((n) => n.textContent)));
  console.log('errors:', errs);
  await app.close();
})();

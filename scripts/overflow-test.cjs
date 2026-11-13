// Repro: All apps view + a fusion with long idea text in a smaller window. Measures clipping and scrolling.
const { _electron: electron } = require(process.env.HOME + '/.claude/skills/playwright-skill/node_modules/playwright');
(async () => {
  const dir = __dirname + '/..', data = __dirname + '/data-ovf';
  require('fs').rmSync(data, { recursive: true, force: true });
  const app = await electron.launch({ args: [dir], cwd: dir, env: { ...process.env, FUSE_MOCK: '1', FUSE_MOCK_LONG: '1', FUSE_DATA_DIR: data } });
  const win = await app.firstWindow();
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setSize(1100, 720));
  await win.waitForSelector('#welcomeGo'); await win.click('#welcomeGo'); await win.click('#permSkip');
  await win.click('[data-view="all"]'); await win.waitForTimeout(800);
  const board = await win.$eval('#boardWrap', (b) => ({ scrollH: b.scrollHeight, clientH: b.clientHeight, overflowY: getComputedStyle(b).overflowY }));
  await win.mouse.move(500, 400); await win.mouse.wheel(0, 2000); await win.waitForTimeout(400);
  console.log('board:', board, '| scrolled to', await win.$eval('#boardWrap', (b) => b.scrollTop));
  await win.evaluate(() => window.__fuseTest('com.apple.Music', 'com.apple.Notes'));
  await win.waitForSelector('.idea', { timeout: 20000 }); await win.waitForTimeout(900);
  const pb = await win.$eval('#pBody', (b) => ({ scrollH: b.scrollHeight, clientH: b.clientHeight }));
  const clipped = await win.$$eval('.idea', (xs) => xs.map((x) => { const p = x.querySelector('p'); return { idea: x.scrollHeight - x.clientHeight, p: p.scrollHeight - p.clientHeight, h: x.clientHeight }; }));
  await win.mouse.move(900, 500); await win.mouse.wheel(0, 1500); await win.waitForTimeout(400);
  console.log('panel body:', pb, '| scrolled to', await win.$eval('#pBody', (b) => b.scrollTop));
  console.log('ideas clipped px:', JSON.stringify(clipped));
  await win.screenshot({ path: __dirname + '/ovf.png' });
  const covered = await win.evaluate(() => { const p = document.getElementById('panel').getBoundingClientRect(); return [...document.querySelectorAll('.tile')].filter((t) => { const r = t.getBoundingClientRect(); return r.right > p.left + 4 && r.top < p.bottom && r.bottom > p.top; }).length; });
  console.log('tiles hidden behind the panel:', covered);
  // with the panel open, can the board behind still scroll?
  await win.mouse.move(300, 400); await win.mouse.wheel(0, -3000); await win.waitForTimeout(300); await win.mouse.wheel(0, 1200); await win.waitForTimeout(400);
  console.log('board scroll with panel open:', await win.$eval('#boardWrap', (b) => b.scrollTop));
  await app.close(); require('fs').rmSync(data, { recursive: true, force: true });
})();

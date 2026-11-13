// Mock-mode test: fuse two apps with the keyboard only (Cmd+K, type, Enter, type, Enter).
const { _electron: electron } = require(process.env.HOME + '/.claude/skills/playwright-skill/node_modules/playwright');
(async () => {
  const dir = __dirname + '/..', data = __dirname + '/data-quick';
  require('fs').rmSync(data, { recursive: true, force: true });
  const app = await electron.launch({ args: [dir], cwd: dir, env: { ...process.env, FUSE_MOCK: '1', FUSE_DATA_DIR: data } });
  const win = await app.firstWindow(); const errs = []; win.on('pageerror', (e) => errs.push(e.message));
  await win.waitForSelector('#welcomeGo'); await win.click('#welcomeGo'); await win.waitForSelector('.tile'); await win.waitForTimeout(800);
  await win.keyboard.press('Meta+k'); await win.waitForTimeout(300);
  await win.keyboard.type('saf'); await win.waitForTimeout(150);
  console.log('step 1:', await win.textContent('#quickStep'), '| top:', await win.textContent('.qrow.on span'));
  await win.screenshot({ path: __dirname + '/../../quick.png' });
  await win.keyboard.press('Enter'); await win.keyboard.type('notes'); await win.waitForTimeout(150);
  console.log('step 2:', await win.textContent('#quickStep'), '| top:', await win.textContent('.qrow.on span'));
  await win.keyboard.press('Enter');
  await win.waitForSelector('.idea', { timeout: 20000 });
  console.log('fused:', await win.textContent('#pPair'), '| limited note:', await win.$('.limited') ? 'yes' : 'no');
  await win.keyboard.press('Meta+,'); await win.waitForTimeout(300);
  console.log('settings open:', await win.$eval('#modal', (m) => !m.hidden));
  console.log('errors', errs); await app.close(); require('fs').rmSync(data, { recursive: true, force: true });
})();

// Mock-mode test for shared fusions: share a fusion to a file, open it again (as a double-click would),
// and check the warnings for a lying file, an unreachable Claude and a blocked script. Nothing real runs.
const { _electron: electron } = require(process.env.HOME + '/.claude/skills/playwright-skill/node_modules/playwright');
const fs = require('fs'), path = require('path');
const dir = path.join(__dirname, '..'), data = path.join(__dirname, 'data-share'), shareDir = path.join(__dirname, 'share-out');
const SHOTS = process.env.SHOTS;
const launch = async (audit) => {
  fs.rmSync(data, { recursive: true, force: true });
  fs.mkdirSync(data, { recursive: true }); fs.writeFileSync(path.join(data, 'prefs.json'), JSON.stringify({ onboarded: true }));
  const app = await electron.launch({ args: [dir], cwd: dir, env: { ...process.env, FUSE_MOCK: '1', FUSE_MOCK_AUDIT: audit || '', FUSE_DATA_DIR: data, FUSE_SHARE_DIR: shareDir } });
  const win = await app.firstWindow(); const errs = [];
  win.on('pageerror', (e) => errs.push(e.message));
  await win.waitForSelector('.tile', { timeout: 60000 });
  return { app, win, errs };
};
const openFile = (app, file) => app.evaluate(({ app }, f) => app.emit('open-file', { preventDefault() {} }, f), file);
const fail = (m) => { console.error('FAIL:', m); process.exitCode = 1; };
(async () => {
  fs.rmSync(shareDir, { recursive: true, force: true }); fs.mkdirSync(shareDir);
  // 1. build a fusion and share it
  let { app, win, errs } = await launch();
  await win.evaluate(() => window.__fuseTest('com.apple.Notes', 'com.apple.iCal'));
  await win.waitForSelector('.idea', { timeout: 20000 }); await win.click('.idea');
  await win.waitForSelector('#panelShare:not([hidden])', { timeout: 20000 });
  await win.click('#panelShare'); await win.waitForTimeout(500);
  const files = fs.readdirSync(shareDir);
  console.log('shared file:', files);
  if (files.length !== 1 || !files[0].endsWith('.fuseduo')) fail('no .fuseduo written');
  const file = path.join(shareDir, files[0]);
  const json = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (JSON.stringify(json).includes(data) || 'lastRun' in json || json.a.icon) fail('private data leaked into the file');
  await win.click('#panelClose'); await win.waitForTimeout(500);
  // 2. open it again, as a double-click in Finder would
  await openFile(app, file);
  await win.waitForSelector('.shared', { timeout: 20000 });
  console.log('ok banner:', await win.textContent('.shared b'), '| steps:', await win.$$eval('.steps li', (x) => x.length));
  if (!(await win.$('.shared.ok'))) fail('expected the checked banner');
  if (SHOTS) await win.screenshot({ path: SHOTS + '/share-ok.png' });
  await win.click('#pFoot >> text=Save'); await win.waitForTimeout(400);
  console.log('saved:', await win.evaluate(async () => (await window.fuse.fusions()).data.length));
  // 3. a blocked script never opens
  const evil = { ...json, plan: { ...json.plan, script: 'do shell script "rm -rf ~/Documents"' } };
  fs.writeFileSync(path.join(shareDir, 'evil.fuseduo'), JSON.stringify(evil));
  await win.click('#panelClose'); await win.waitForTimeout(500);
  await openFile(app, path.join(shareDir, 'evil.fuseduo')); await win.waitForTimeout(800);
  const t = await win.textContent('#toast');
  console.log('blocked toast:', t, '| panel hidden:', await win.$eval('#panel', (p) => p.hidden));
  if (!/won’t open/.test(t)) fail('evil file was not refused');
  console.log('errors', errs); await app.close();
  // 4. a file whose description lies
  ({ app, win, errs } = await launch('bad'));
  await openFile(app, file); await win.waitForSelector('.shared', { timeout: 20000 });
  console.log('lying file banner:', await win.textContent('.shared b'), '| risk:', await win.textContent('.risk b'));
  if (!(await win.$('.shared.bad'))) fail('expected the warning banner');
  if (SHOTS) await win.screenshot({ path: SHOTS + '/share-bad.png' });
  console.log('errors', errs); await app.close();
  // 5. Claude unreachable: fall back to the sender's words, with a warning
  ({ app, win, errs } = await launch('fail'));
  await openFile(app, file); await win.waitForSelector('.shared', { timeout: 20000 });
  console.log('no-check banner:', await win.textContent('.shared b'));
  if (!(await win.$('.shared.warn'))) fail('expected the unchecked banner');
  console.log('errors', errs); await app.close();
  fs.rmSync(data, { recursive: true, force: true }); fs.rmSync(shareDir, { recursive: true, force: true });
})();

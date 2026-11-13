// Mock-mode test: pick "Mac app", build, Create app; checks the .app (signature, icon, plist) and the permissions screen.
const { _electron: electron } = require(process.env.HOME + '/.claude/skills/playwright-skill/node_modules/playwright');
const { execFileSync } = require('child_process'); const fs = require('fs');
(async () => {
  const dir = __dirname + '/..', data = __dirname + '/data-app', apps = __dirname + '/apps-out';
  for (const d of [data, apps]) fs.rmSync(d, { recursive: true, force: true });
  const app = await electron.launch({ args: [dir], cwd: dir, env: { ...process.env, FUSE_MOCK: '1', FUSE_DATA_DIR: data, FUSE_APPS_DIR: apps } });
  const win = await app.firstWindow(); const errs = []; win.on('pageerror', (e) => errs.push(e.message));
  await win.waitForSelector('#welcomeGo'); await win.click('#welcomeGo'); await win.waitForTimeout(500);
  console.log('permissions step visible:', await win.$eval('#permStep', (e) => !e.hidden), '| rows:', await win.$$eval('.perm-row b', (x) => x.map((n) => n.textContent)));
  await win.screenshot({ path: __dirname + '/perm.png' });
  await win.click('#permSkip'); await win.waitForTimeout(600);
  process.env.NOOP = 1;
  await win.evaluate(() => window.__fuseTest('com.apple.Music', 'com.apple.Notes'));
  await win.waitForSelector('.make-seg'); await win.click('.make-seg button:nth-child(2)');
  await win.click('.idea'); await win.waitForSelector('.badge.app', { timeout: 20000 });
  console.log('footer:', await win.$$eval('#pFoot .btn', (x) => x.map((n) => n.textContent)));
  await win.click('#pFoot >> text=Create app'); await win.waitForSelector('text=Created ✓', { timeout: 30000 });
  const made = fs.readdirSync(apps); console.log('created:', made);
  const a = `${apps}/${made[0]}`;
  console.log('signature:', execFileSync('codesign', ['--verify', '--verbose=1', a], { stdio: 'pipe' }).toString() || 'valid');
  console.log('icon bytes:', fs.statSync(`${a}/Contents/Resources/applet.icns`).size, '| usage text:', execFileSync('/usr/libexec/PlistBuddy', ['-c', 'Print :NSAppleEventsUsageDescription', `${a}/Contents/Info.plist`]).toString().trim());
  console.log('shelf:', await win.$$eval('.fcard b', (x) => x.map((n) => n.textContent)));
  console.log('errors', errs); await app.close();
  fs.rmSync(data, { recursive: true, force: true });
})();

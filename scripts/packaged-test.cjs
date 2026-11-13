// Launches the built .app (mock AI) and checks the board, icons and a fusion work when packaged.
const { _electron: electron } = require(process.env.HOME + '/.claude/skills/playwright-skill/node_modules/playwright');
(async () => {
  const exe = __dirname + '/../dist/mac-arm64/Fuseduo.app/Contents/MacOS/Fuseduo', data = __dirname + '/data-packaged';
  require('fs').rmSync(data, { recursive: true, force: true });
  const app = await electron.launch({ executablePath: exe, env: { ...process.env, FUSE_MOCK: '1', FUSE_DATA_DIR: data } });
  const win = await app.firstWindow(); const errs = []; win.on('pageerror', (e) => errs.push(e.message));
  await win.waitForSelector('#welcomeGo', { timeout: 60000 });
  const demoIcon = await win.$eval('.demo-res', (i) => i.naturalWidth); await win.click('#welcomeGo'); await win.click('#permSkip');
  await win.waitForSelector('.tile img');
  const icons = await win.$$eval('.tile img', (x) => x.filter((i) => i.naturalWidth > 0).length);
  await win.evaluate(() => window.__fuseTest('com.apple.Notes', 'com.apple.iCal'));
  await win.waitForSelector('.idea', { timeout: 20000 });
  console.log('packaged: welcome icon', demoIcon > 0, '| tile icons loaded', icons, '| ideas', await win.$$eval('.idea', (x) => x.length), '| version', await win.evaluate(async () => (await window.fuse.version()).data));
  console.log('errors', errs); await app.close(); require('fs').rmSync(data, { recursive: true, force: true });
})();

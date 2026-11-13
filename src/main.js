// Fuseduo: main process.
// Lists the real apps on this Mac, asks Claude for automation ideas when two apps are fused,
// builds the chosen one as a script, and runs it only after the user approves it.
const { app, BrowserWindow, ipcMain, safeStorage, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const { execFile, spawn } = require('child_process');
const Anthropic = require('@anthropic-ai/sdk').default;
const { listApps } = require('./apps');
const { ideasPrompt, buildPrompt, fixPrompt, refinePrompt, IDEAS_SCHEMA, BUILD_SCHEMA } = require('./prompts');
const os = require('os');
const { checkScript } = require('./guard');

// Speed setting (Settings > Speed). "best" is the default; "fast" was ~3x quicker in testing
// (2026-11-13, via Claude Code: ideas 8.0s -> 4.3s, builds 23.8s -> 8.5s, all builds compiled).
const MODELS = { best: 'claude-opus-5-5', fast: 'claude-sonnet-5-5' };
const FIX_MODEL = 'claude-opus-5-5'; // the one repair pass always uses the strongest model
const modelFor = () => MODELS[readJson('config.json', {}).speed] || MODELS.best;
// FUSE_MOCK=1 (tests only): canned answers instead of calling Claude.
const MOCK = process.env.FUSE_MOCK === '1' ? require('./mock') : null;
const store = (name) => path.join(app.getPath('userData'), name);
const readJson = (name, fallback) => { try { return JSON.parse(fs.readFileSync(store(name), 'utf8')); } catch { return fallback; } };
const writeJson = (name, data) => fs.writeFileSync(store(name), JSON.stringify(data, null, 2));

// ---------- API key: kept encrypted with the OS keychain via safeStorage ----------
function getKey() {
  const cfg = readJson('config.json', {});
  if (cfg.key && safeStorage.isEncryptionAvailable()) {
    try { return safeStorage.decryptString(Buffer.from(cfg.key, 'base64')); } catch { /* fall through */ }
  }
  return process.env.ANTHROPIC_API_KEY || null;
}
function setKey(key) {
  const cfg = readJson('config.json', {});
  if (!key) delete cfg.key;
  else cfg.key = safeStorage.encryptString(key.trim()).toString('base64');
  writeJson('config.json', cfg);
}
function client() {
  const key = getKey();
  if (!key) throw Object.assign(new Error('Add your Anthropic API key in Settings first.'), { code: 'NO_KEY' });
  return new Anthropic({ apiKey: key });
}

// ---------- Claude Code: uses the person's own subscription when there is no API key ----------
// Finding claude needs a login shell (apps opened from Finder don't get the shell's PATH).
// That takes a second or two, so it runs once, async, and the path is remembered in config.json.
let CLAUDE_BIN; // undefined = not looked up yet, null = not installed
let findingBin = null;
function claudeBin() {
  if (CLAUDE_BIN !== undefined) return Promise.resolve(CLAUDE_BIN);
  const saved = readJson('config.json', {}).claudePath;
  if (saved && fs.existsSync(saved)) { CLAUDE_BIN = saved; return Promise.resolve(saved); }
  findingBin ||= new Promise((resolve) => {
    execFile('/bin/zsh', ['-lic', 'command -v claude'], { timeout: 10000, encoding: 'utf8' }, (err, out) => {
      const found = !err && String(out).trim().split('\n').pop();
      CLAUDE_BIN = found && fs.existsSync(found) ? found : null;
      if (CLAUDE_BIN) writeJson('config.json', { ...readJson('config.json', {}), claudePath: CLAUDE_BIN });
      findingBin = null; resolve(CLAUDE_BIN);
    });
  });
  return findingBin;
}
async function askClaudeCode(system, user, schema, effort, model) {
  const bin = await claudeBin();
  return new Promise((resolve, reject) => {
    if (!bin) return reject(Object.assign(new Error('Add an Anthropic API key in Settings, or install Claude Code to use your Claude plan.'), { code: 'NO_KEY' }));
    // Restricted, no tools, no settings or MCP servers: a plain question with a structured answer.
    const args = ['-p', '--output-format', 'json', '--no-session-persistence', '--restricted', '--strict-mcp-config', '--tools', '', '--effort', effort || 'low', '--model', model, '--system-prompt', system, '--json-schema', JSON.stringify(schema)];
    const child = spawn(bin, args, { cwd: app.getPath('temp'), env: { ...process.env, PATH: `${path.dirname(bin)}:${process.env.PATH}` } });
    let out = '', err = '';
    const timer = setTimeout(() => { child.kill(); reject(new Error('Claude Code took too long. Try again.')); }, 240000);
    child.stdout.on('data', (d) => { out += d; });
    child.stderr.on('data', (d) => { err += d; });
    child.on('error', (e) => { clearTimeout(timer); reject(e); });
    child.on('close', () => {
      clearTimeout(timer);
      try {
        const r = JSON.parse(out);
        if (r.is_error || !r.structured_output) return reject(new Error(r.result || 'Claude Code returned no answer. Is it signed in? Run "claude" once in Terminal.'));
        resolve(r.structured_output);
      } catch { reject(new Error((err || out || 'Claude Code failed.').trim().slice(0, 300))); }
    });
    child.stdin.end(user);
  });
}

// One structured call. Server-side fallbacks re-run the request on a fallback model if the first declines.
// Connection (Settings): 'cli' = the person's own Claude Code sign-in and plan, 'key' = their API key,
// 'auto' (default) = the key if one is saved, otherwise Claude Code.
const provider = () => readJson('config.json', {}).provider || 'auto';
async function ask(system, user, schema, effort, model = modelFor()) {
  const p = provider();
  if (p === 'cli' || (p === 'auto' && !getKey())) return askClaudeCode(system, user, schema, effort, model);
  const res = await client().beta.messages.create({
    model,
    max_tokens: 16000,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    system,
    messages: [{ role: 'user', content: user }],
    output_config: { effort, format: { type: 'json_schema', schema } },
  });
  if (res.stop_reason === 'refusal') throw new Error('Claude declined this one. Try a different idea.');
  if (res.stop_reason === 'max_tokens') throw new Error('The answer was cut off. Try again.');
  const text = res.content.filter((b) => b.type === 'text').map((b) => b.text).join('');
  return JSON.parse(text);
}

function friendlyError(e) {
  if (e.code === 'NO_KEY') return e.message;
  if (e instanceof Anthropic.AuthenticationError) return 'That API key was rejected. Check it in Settings.';
  if (e instanceof Anthropic.PermissionDeniedError) return 'This key can’t use that model.';
  if (e instanceof Anthropic.RateLimitError) return 'Too many requests right now. Wait a moment and try again.';
  if (e instanceof Anthropic.APIConnectionError) return 'Couldn’t reach Anthropic. Check your internet.';
  if (e instanceof Anthropic.APIError) return `Anthropic error ${e.status ?? ''}: ${e.message}`;
  return e.message || String(e);
}
const handle = (name, fn) => ipcMain.handle(name, async (_e, ...args) => {
  try { return { ok: true, data: await fn(...args) }; } catch (e) { return { ok: false, error: friendlyError(e) }; }
});

// ---------- compile check (never runs the script) ----------
function compileCheck({ language, script }) {
  return new Promise((resolve) => {
    if (language === 'shell') {
      return execFile('/bin/zsh', ['-n', '-c', script], { timeout: 15000 }, (err, _o, stderr) => resolve(err ? (stderr || err.message).trim() : null));
    }
    const tmp = path.join(os.tmpdir(), `fuse-${process.pid}-${Date.now()}`);
    const src = `${tmp}.${language === 'javascript' ? 'js' : 'applescript'}`;
    fs.writeFileSync(src, script);
    const args = language === 'javascript' ? ['-l', 'JavaScript', '-o', `${tmp}.scpt`, src] : ['-o', `${tmp}.scpt`, src];
    execFile('/usr/bin/osacompile', args, { timeout: 30000 }, (err, _o, stderr) => {
      for (const f of [src, `${tmp}.scpt`]) fs.rmSync(f, { force: true });
      resolve(err ? (stderr || err.message).trim() : null);
    });
  });
}

// ---------- ideas: cached per pair, and shared between a prefetch and the real request ----------
// Hovering one app over another starts the request early, so the ideas are often ready on drop.
const IDEA_TTL = 7 * 24 * 3600 * 1000;
const inflight = new Map();
const pairKey = (a, b) => [a.id, b.id].sort().join('|') + '|' + modelFor();
function getIdeas(a, b, { fresh = false } = {}) {
  if (MOCK) return MOCK.ideas(a, b);
  const key = pairKey(a, b);
  if (!fresh) {
    const hit = readJson('ideas-cache.json', {})[key];
    if (hit && Date.now() - hit.at < IDEA_TTL) return Promise.resolve(hit.data);
    if (inflight.has(key)) return inflight.get(key);
  }
  const p = ask(...ideasPrompt(a, b), IDEAS_SCHEMA, 'low').then((data) => {
    const cache = readJson('ideas-cache.json', {});
    cache[key] = { at: Date.now(), data };
    // keep the newest 200 pairs
    const keep = Object.entries(cache).sort((x, y) => y[1].at - x[1].at).slice(0, 200);
    writeJson('ideas-cache.json', Object.fromEntries(keep));
    return data;
  }).finally(() => inflight.delete(key));
  inflight.set(key, p);
  return p;
}

// Build (or refine): write the script, check it compiles, and let Claude fix it once if it doesn't.
async function buildFusion(sender, a, b, idea, refine) {
  const stage = (s) => { try { sender.send('fuse:stage', s); } catch { /* window closed */ } };
  stage('writing');
  let plan;
  if (refine) plan = MOCK ? await MOCK.refine(a, b, refine.plan, refine.instruction) : await ask(...refinePrompt(a, b, refine.plan, refine.instruction), BUILD_SCHEMA, 'low');
  else plan = MOCK ? await MOCK.build(a, b, idea) : await ask(...buildPrompt(a, b, idea), BUILD_SCHEMA, 'low');
  stage('checking');
  let error = await compileCheck(plan);
  if (error && !MOCK) {
    stage('fixing');
    plan = await ask(...fixPrompt(a, b, plan, error), BUILD_SCHEMA, 'medium', FIX_MODEL);
    stage('checking');
    error = await compileCheck(plan);
  }
  return { ...plan, compileError: error };
}

// ---------- running a script ----------
// One script at a time per fusion id; Stop kills it. macOS errors are turned into plain English.
const running = new Map();
const { explain } = require('./explain');
function runScript({ language, script, id }) {
  return new Promise((resolve) => {
    const verdict = checkScript(language, script);
    if (!verdict.ok) return resolve({ ok: false, output: `Blocked for safety: ${verdict.reason}` });
    const [cmd, args] = language === 'applescript' ? ['/usr/bin/osascript', ['-e', script]]
      : language === 'javascript' ? ['/usr/bin/osascript', ['-l', 'JavaScript', '-e', script]]
      : ['/bin/zsh', ['-c', script]];
    const key = id || 'adhoc';
    const child = execFile(cmd, args, { timeout: 120000, maxBuffer: 1 << 20 }, (err, stdout, stderr) => {
      running.delete(key);
      const output = (stdout || '') + (stderr ? `\n${stderr}` : '') + (err && !stderr ? `\n${err.message}` : '');
      if (child.stopped) return resolve({ ok: false, stopped: true, output: 'Stopped.' });
      if (err?.killed) return resolve({ ok: false, output, why: { kind: 'timeout', text: 'It ran for 2 minutes without finishing, so Fuseduo stopped it.' } });
      resolve({ ok: !err, output, why: err ? explain(output) : null });
    });
    running.set(key, child);
  });
}
function stopScript(id) { const c = running.get(id || 'adhoc'); if (!c) return false; c.stopped = true; c.kill('SIGTERM'); return true; }

// ---------- IPC ----------
// The app list is cached so the board shows instantly; a fresh scan follows in the background.
let scanning = null;
const scanApps = () => (scanning ||= listApps(store('icons')).then((list) => { writeJson('apps.json', list); return list; }).finally(() => { scanning = null; }));
handle('apps:list', async () => {
  const cached = readJson('apps.json', null);
  if (cached?.length) return { apps: cached, cached: true };
  return { apps: await scanApps(), cached: false };
});
handle('apps:refresh', () => scanApps());
handle('key:status', async () => ({ hasKey: !!getKey(), claudeCode: !!(await claudeBin()), speed: readJson('config.json', {}).speed || 'best', provider: provider() }));
handle('provider:set', (p) => { writeJson('config.json', { ...readJson('config.json', {}), provider: ['cli', 'key'].includes(p) ? p : 'auto' }); return true; });
handle('speed:set', (speed) => { writeJson('config.json', { ...readJson('config.json', {}), speed: speed === 'fast' ? 'fast' : 'best' }); return true; });
handle('fuse:prefetch', (a, b) => { getIdeas(a, b).catch(() => {}); return true; });
handle('key:set', (key) => { setKey(key); return true; });
handle('fuse:ideas', (a, b, opts) => getIdeas(a, b, opts));
ipcMain.handle('fuse:build', async (e, a, b, idea) => {
  try { return { ok: true, data: await buildFusion(e.sender, a, b, idea) }; } catch (err) { return { ok: false, error: friendlyError(err) }; }
});
ipcMain.handle('fuse:refine', async (e, a, b, plan, instruction) => {
  try { return { ok: true, data: await buildFusion(e.sender, a, b, null, { plan, instruction }) }; } catch (err) { return { ok: false, error: friendlyError(err) }; }
});
handle('fuse:stop', (id) => stopScript(id));
handle('open:automation', () => { shell.openExternal('x-apple.systempreferences:com.apple.preference.security?Privacy_Automation'); return true; });
handle('fuse:check', (f) => checkScript(f.language, f.script));
handle('fuse:run', async (f) => {
  const r = await runScript(f);
  if (f.id) { // a saved fusion remembers how its last run went
    const all = readJson('fusions.json', []);
    const hit = all.find((x) => x.id === f.id);
    if (hit) { hit.lastRun = { ok: r.ok, at: new Date().toISOString(), output: String(r.output || '').slice(0, 2000) }; hit.runs = (hit.runs || 0) + 1; writeJson('fusions.json', all); }
  }
  return r;
});
handle('prefs:get', () => readJson('prefs.json', {}));
handle('prefs:set', (patch) => { const p = { ...readJson('prefs.json', {}), ...patch }; writeJson('prefs.json', p); return p; });
handle('fusions:list', () => readJson('fusions.json', []));
handle('fusions:save', (f) => {
  const all = readJson('fusions.json', []).filter((x) => x.id !== f.id);
  all.unshift(f); writeJson('fusions.json', all); return all;
});
handle('fusions:delete', (id) => { const all = readJson('fusions.json', []).filter((x) => x.id !== id); writeJson('fusions.json', all); return all; });
// Once a day: ask GitHub for the newest release tag. Nothing about the user is sent.
handle('update:check', async () => {
  const cfg = readJson('config.json', {});
  if (cfg.updates === false || MOCK) return null;
  if (cfg.lastUpdateCheck && Date.now() - cfg.lastUpdateCheck < 864e5) return cfg.latest || null;
  try {
    const r = await fetch('https://api.github.com/repos/hollowbit-dev/fuseduo/releases/latest', { headers: { 'User-Agent': 'Fuseduo' } });
    const latest = r.ok ? (await r.json()).tag_name?.replace(/^v/, '') : null;
    writeJson('config.json', { ...readJson('config.json', {}), lastUpdateCheck: Date.now(), latest });
    return latest;
  } catch { return null; }
});
handle('app:version', () => app.getVersion());
handle('open:url', (url) => { if (/^https:\/\//.test(url)) shell.openExternal(url); return true; });

// ---------- window ----------
app.setName('Fuseduo');
// FUSE_DATA_DIR (tests only): keep test runs away from the real saved fusions and settings.
if (process.env.FUSE_DATA_DIR) app.setPath('userData', process.env.FUSE_DATA_DIR);
// Earlier builds stored data under their working names; bring saved fusions and prefs across once.
function migrateOldData() {
  const now = app.getPath('userData');
  if (process.env.FUSE_DATA_DIR) return;
  for (const name of ['Fuseshaper', 'fuse-prototype']) { // earlier working names
    const old = path.join(app.getPath('appData'), name);
    if (old === now || !fs.existsSync(old)) continue;
    fs.mkdirSync(now, { recursive: true });
    for (const f of ['fusions.json', 'config.json', 'prefs.json']) {
      const from = path.join(old, f), to = path.join(now, f);
      if (fs.existsSync(from) && !fs.existsSync(to)) fs.copyFileSync(from, to);
    }
    const icons = path.join(old, 'icons'); // saves re-extracting every icon on first launch
    if (fs.existsSync(icons) && !fs.existsSync(path.join(now, 'icons'))) fs.cpSync(icons, path.join(now, 'icons'), { recursive: true });
  }
}
function createWindow() {
  if (process.platform === 'darwin' && app.dock) app.dock.setIcon(path.join(__dirname, '..', 'assets', 'icon.png'));
  const win = new BrowserWindow({
    width: 1240, height: 820, minWidth: 900, minHeight: 620,
    titleBarStyle: 'hiddenInset', title: 'Fuseduo', backgroundColor: '#0c0b12', trafficLightPosition: { x: 18, y: 20 },
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, sandbox: true, nodeIntegration: false },
  });
  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));
}
app.whenReady().then(() => { migrateOldData(); createWindow(); });
app.on('window-all-closed', () => app.quit());

module.exports = { runScript };

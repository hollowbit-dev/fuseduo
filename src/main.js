// Fuseduo: main process.
// Lists the real apps on this Mac, asks Claude for automation ideas when two apps are fused,
// builds the chosen one as a script, and runs it only after the user approves it.
const { app, BrowserWindow, ipcMain, safeStorage, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const { execFile, execFileSync, spawn } = require('child_process');
const Anthropic = require('@anthropic-ai/sdk').default;
const { listApps } = require('./apps');
const { ideasPrompt, buildPrompt, fixPrompt, IDEAS_SCHEMA, BUILD_SCHEMA } = require('./prompts');
const os = require('os');
const { checkScript } = require('./guard');

const MODEL = 'claude-opus-5-5';
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
let CLAUDE_BIN;
function claudeBin() {
  if (CLAUDE_BIN !== undefined) return CLAUDE_BIN;
  CLAUDE_BIN = null;
  try { // apps opened from Finder don't get the shell's PATH, so ask a login shell
    const found = execFileSync('/bin/zsh', ['-lic', 'command -v claude'], { timeout: 8000, encoding: 'utf8' }).trim().split('\n').pop();
    if (found && fs.existsSync(found)) CLAUDE_BIN = found;
  } catch { /* not installed */ }
  return CLAUDE_BIN;
}
function askClaudeCode(system, user, schema, effort) {
  return new Promise((resolve, reject) => {
    const bin = claudeBin();
    if (!bin) return reject(Object.assign(new Error('Add an Anthropic API key in Settings, or install Claude Code to use your Claude plan.'), { code: 'NO_KEY' }));
    // Restricted, no tools, no settings or MCP servers: a plain question with a structured answer.
    const args = ['-p', '--output-format', 'json', '--no-session-persistence', '--restricted', '--strict-mcp-config', '--tools', '', '--effort', effort || 'low', '--system-prompt', system, '--json-schema', JSON.stringify(schema)];
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
async function ask(system, user, schema, effort) {
  if (!getKey()) return askClaudeCode(system, user, schema, effort);
  const res = await client().beta.messages.create({
    model: MODEL,
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

// Build: write the script, check it compiles, and let Claude fix it once if it doesn't.
async function buildFusion(sender, a, b, idea) {
  const stage = (s) => { try { sender.send('fuse:stage', s); } catch { /* window closed */ } };
  stage('writing');
  let plan = MOCK ? await MOCK.build(a, b, idea) : await ask(...buildPrompt(a, b, idea), BUILD_SCHEMA, 'low');
  stage('checking');
  let error = await compileCheck(plan);
  if (error && !MOCK) {
    stage('fixing');
    plan = await ask(...fixPrompt(a, b, plan, error), BUILD_SCHEMA, 'medium');
    stage('checking');
    error = await compileCheck(plan);
  }
  return { ...plan, compileError: error };
}

// ---------- running a script ----------
function runScript({ language, script }) {
  return new Promise((resolve) => {
    const verdict = checkScript(language, script);
    if (!verdict.ok) return resolve({ ok: false, output: `Blocked for safety: ${verdict.reason}` });
    const [cmd, args] = language === 'applescript' ? ['/usr/bin/osascript', ['-e', script]]
      : language === 'javascript' ? ['/usr/bin/osascript', ['-l', 'JavaScript', '-e', script]]
      : ['/bin/zsh', ['-c', script]];
    execFile(cmd, args, { timeout: 60000, maxBuffer: 1 << 20 }, (err, stdout, stderr) => {
      resolve({ ok: !err, output: (stdout || '') + (stderr ? `\n${stderr}` : '') + (err && !stderr ? `\n${err.message}` : '') });
    });
  });
}

// ---------- IPC ----------
handle('apps:list', () => listApps(store('icons')));
handle('key:status', () => ({ hasKey: !!getKey(), claudeCode: !!claudeBin() }));
handle('key:set', (key) => { setKey(key); return true; });
handle('fuse:ideas', (a, b) => (MOCK ? MOCK.ideas(a, b) : ask(...ideasPrompt(a, b), IDEAS_SCHEMA, 'low')));
ipcMain.handle('fuse:build', async (e, a, b, idea) => {
  try { return { ok: true, data: await buildFusion(e.sender, a, b, idea) }; } catch (err) { return { ok: false, error: friendlyError(err) }; }
});
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

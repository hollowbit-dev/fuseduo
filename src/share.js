// Shared fusions: the .fuseduo file format.
// A shared file is code written by someone else, so unpack() trusts nothing: every field is checked and
// trimmed, and only plain data comes through (no icons, file paths, run history or output).
// The script still goes through guard.js, a compile check, and Claude's own reading before it can run.

const FORMAT = 'fuseduo';
const VERSION = 1;
const MAX_BYTES = 100_000;
const LANGS = ['applescript', 'javascript', 'shell'];
const RISKS = ['low', 'medium', 'high'];

const text = (x, max) => (typeof x === 'string' ? x.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '').trim().slice(0, max) : '');
const list = (x, maxItems, maxLen) => (Array.isArray(x) ? x.map((s) => text(s, maxLen)).filter(Boolean).slice(0, maxItems) : []);
const appRef = (x) => {
  const id = text(x?.id, 200), name = text(x?.name, 80);
  if (!/^[A-Za-z0-9._-]+$/.test(id) || !name) throw new Error('The file names an app in a way Fuseduo doesn’t recognise.');
  return { id, name };
};

function pack({ a, b, idea, plan }, appVersion) {
  return {
    format: FORMAT, version: VERSION, madeWith: `Fuseduo ${appVersion || ''}`.trim(), sharedAt: new Date().toISOString(),
    a: { id: a.id, name: a.name }, b: { id: b.id, name: b.name },
    idea: idea ? { title: idea.title, description: idea.description } : null,
    plan: {
      name: plan.name, steps: plan.steps, language: plan.language, script: plan.script,
      risk: plan.risk, permissions: plan.permissions || [], undo: plan.undo || '', mode: plan.mode === 'app' ? 'app' : 'script',
    },
  };
}

function unpack(raw) {
  if (typeof raw !== 'string' || Buffer.byteLength(raw) > MAX_BYTES) throw new Error('That file is too big to be a Fuseduo fusion.');
  let d;
  try { d = JSON.parse(raw); } catch { throw new Error('That file isn’t a Fuseduo fusion (it couldn’t be read).'); }
  if (!d || d.format !== FORMAT) throw new Error('That file isn’t a Fuseduo fusion.');
  if (!Number.isInteger(d.version) || d.version > VERSION) throw new Error('This fusion was made with a newer Fuseduo. Update Fuseduo to open it.');
  const p = d.plan || {};
  const language = LANGS.includes(p.language) ? p.language : null;
  if (!language) throw new Error('This fusion uses a script language Fuseduo doesn’t run.');
  const script = typeof p.script === 'string' ? p.script : '';
  if (!script.trim()) throw new Error('This fusion has no script in it.');
  const plan = {
    name: text(p.name, 80) || 'Shared fusion',
    steps: list(p.steps, 30, 400),
    language, script,
    risk: RISKS.includes(p.risk) ? p.risk : 'high', // unknown = assume the worst
    permissions: list(p.permissions, 20, 160),
    undo: text(p.undo, 600),
    mode: p.mode === 'app' ? 'app' : 'script',
  };
  const idea = d.idea && typeof d.idea === 'object' ? { title: text(d.idea.title, 80), description: text(d.idea.description, 400) } : null;
  return { a: appRef(d.a), b: appRef(d.b), idea, plan };
}

// A file name that is safe on macOS.
const fileName = (name) => `${String(name || 'Fusion').replace(/[\/:*?"<>|\\]/g, '').trim().slice(0, 60) || 'Fusion'}.fuseduo`;

const RANK = { low: 0, medium: 1, high: 2 };
const higherRisk = (x, y) => (RANK[x] >= RANK[y] ? x : y);

module.exports = { pack, unpack, fileName, higherRisk, MAX_BYTES };

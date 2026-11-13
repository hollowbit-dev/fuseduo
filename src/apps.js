// Finds the apps installed on this Mac, with names, bundle ids and PNG icons (cached on disk).
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFile } = require('child_process');
const { promisify } = require('util');
const run = promisify(execFile);

const DIRS = ['/Applications', '/Applications/Utilities', '/System/Applications', '/System/Applications/Utilities', path.join(os.homedir(), 'Applications')];
// Background helpers and installers that make no sense to fuse.
const SKIP = /uninstall|installer|helper|updater|crash|agent$|^\.|migration assistant|boot camp|feedback assistant/i;

async function plist(appPath) {
  try {
    const { stdout } = await run('/usr/bin/plutil', ['-convert', 'json', '-o', '-', path.join(appPath, 'Contents', 'Info.plist')]);
    return JSON.parse(stdout);
  } catch { return null; }
}

async function iconFor(appPath, info, cacheDir, id) {
  const out = path.join(cacheDir, `${id.replace(/[^\w.-]/g, '_')}.png`);
  if (fs.existsSync(out)) return out;
  let icon = info.CFBundleIconFile;
  if (icon) {
    if (!icon.endsWith('.icns')) icon += '.icns';
    const src = path.join(appPath, 'Contents', 'Resources', icon);
    if (fs.existsSync(src)) {
      try {
        await run('/usr/bin/sips', ['-s', 'format', 'png', '--resampleHeightWidthMax', '128', src, '--out', out]);
        // new layered icons convert to an empty image: a real 128 px icon is never this small
        if (fs.statSync(out).size > 4000) return out;
        fs.rmSync(out, { force: true });
      } catch { /* fall back */ }
    }
  }
  // Apps that keep their icon in an asset catalog: exported later in one batch by macOS itself.
  PENDING.push([appPath, out]);
  return out;
}

// One JXA run asks NSWorkspace for each remaining icon and writes it as a 128 px PNG.
const PENDING = [];
async function flushNative() {
  if (!PENDING.length) return;
  const jobs = JSON.stringify(PENDING.splice(0));
  const jxa = `ObjC.import('AppKit');
    const jobs = ${jobs};
    for (const [p, out] of jobs) {
      const img = $.NSWorkspace.sharedWorkspace.iconForFile(p);
      img.size = $.NSMakeSize(128, 128);
      const rep = $.NSBitmapImageRep.imageRepWithData(img.TIFFRepresentation);
      const png = rep.representationUsingTypeProperties($.NSBitmapImageFileTypePNG, $({}));
      png.writeToFileAtomically(out, true);
    }`;
  try { await run('/usr/bin/osascript', ['-l', 'JavaScript', '-e', jxa], { timeout: 60000 }); } catch { /* icons fall back to placeholders */ }
}

// The icon's average colour, weighted towards colourful pixels; used for the fusion animation and glows.
function iconColor(file) {
  try {
    const { nativeImage } = require('electron');
    const bmp = nativeImage.createFromPath(file).resize({ width: 16, height: 16 }).toBitmap(); // BGRA
    let r = 0, g = 0, b = 0, w = 0;
    for (let i = 0; i < bmp.length; i += 4) {
      const B = bmp[i], G = bmp[i + 1], R = bmp[i + 2], A = bmp[i + 3];
      if (A < 128) continue;
      const max = Math.max(R, G, B), min = Math.min(R, G, B), sat = max ? (max - min) / max : 0;
      const k = 0.15 + sat * sat;
      r += R * k; g += G * k; b += B * k; w += k;
    }
    if (!w) return '#8b6bff';
    const hex = (v) => Math.round(v / w).toString(16).padStart(2, '0');
    return `#${hex(r)}${hex(g)}${hex(b)}`;
  } catch { return '#8b6bff'; }
}

// Apple's ~20 App Store categories folded into a few shelves for the sidebar.
const CATS = [
  ['Productivity', /productivity|business|reference|education|finance/],
  ['Creative', /graphics|photography|video|music/],
  ['Developer', /developer/],
  ['Social', /social|communication/],
  ['Fun & media', /entertainment|games|news|lifestyle|sports|travel|weather|health|medical|food|books|shopping|kids/],
  ['Utilities', /utilities/],
];
function category(type) {
  const t = String(type || '').toLowerCase();
  return (CATS.find(([, re]) => re.test(t)) || ['Other'])[0];
}

async function pool(items, n, fn) {
  const out = []; let i = 0;
  await Promise.all(Array.from({ length: n }, async () => { while (i < items.length) { const k = i++; out[k] = await fn(items[k]); } }));
  return out;
}

async function listApps(cacheDir) {
  fs.mkdirSync(cacheDir, { recursive: true });
  const paths = [];
  for (const d of DIRS) {
    let names = [];
    try { names = fs.readdirSync(d); } catch { continue; }
    for (const n of names) if (n.endsWith('.app') && !SKIP.test(n.replace(/\.app$/, ''))) paths.push(path.join(d, n));
  }
  const apps = await pool(paths, 8, async (p) => {
    const info = await plist(p);
    if (!info || !info.CFBundleIdentifier) return null;
    const name = info.CFBundleDisplayName || info.CFBundleName || path.basename(p, '.app');
    const icon = await iconFor(p, info, cacheDir, info.CFBundleIdentifier);
    // Scriptable = has an AppleScript dictionary (declared in Info.plist or an .sdef in Resources).
    let scriptable = !!(info.NSAppleScriptEnabled || info.OSAScriptingDefinition);
    if (!scriptable) { try { scriptable = fs.readdirSync(path.join(p, 'Contents', 'Resources')).some((f) => f.endsWith('.sdef')); } catch { /* unreadable */ } }
    return { scriptable, id: info.CFBundleIdentifier, name: path.basename(p, '.app') || name, path: p, icon: icon ? `file://${icon}` : null, system: p.startsWith('/System/'), category: category(info.LSApplicationCategoryType) };
  });
  await flushNative();
  for (const a of apps) {
    if (!a) continue;
    if (a.icon && !fs.existsSync(a.icon.slice(7))) a.icon = null;
    a.color = a.icon ? iconColor(a.icon.slice(7)) : '#8b6bff';
  }
  const seen = new Set();
  return apps.filter((a) => a && !seen.has(a.id) && seen.add(a.id)).sort((a, b) => a.name.localeCompare(b.name));
}

module.exports = { listApps };

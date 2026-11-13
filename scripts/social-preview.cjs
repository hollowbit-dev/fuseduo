// Renders the GitHub social preview card (1280x640): node scripts/social-preview.cjs -> .github/social-preview.png
// Upload it in the repo's Settings > General > Social preview (GitHub has no API for it).
const { chromium } = require(process.env.HOME + '/.claude/skills/playwright-skill/node_modules/playwright');
const fs = require('fs'), path = require('path');
const b64 = (f) => fs.readFileSync(f).toString('base64');
const root = path.join(__dirname, '..'), site = path.join(root, 'docs', 'assets');
const html = `<!doctype html><html><head><style>
@font-face { font-family: Geist; src: url(data:font/woff2;base64,${b64(path.join(site, 'fonts/Geist-Variable.woff2'))}) format('woff2'); font-weight: 100 900; }
* { margin: 0; box-sizing: border-box; }
body { width: 1280px; height: 640px; overflow: hidden; background: #08070e; font-family: Geist; color: #f3f2f8; position: relative; }
.g1 { position: absolute; width: 900px; height: 900px; left: -300px; top: -460px; border-radius: 50%; background: radial-gradient(circle, rgba(122,92,255,.55), transparent 62%); }
.g2 { position: absolute; width: 760px; height: 760px; right: -280px; bottom: -480px; border-radius: 50%; background: radial-gradient(circle, rgba(34,199,192,.3), transparent 62%); }
.dots { position: absolute; inset: 0; background-image: radial-gradient(rgba(255,255,255,.08) 1.3px, transparent 1.6px); background-size: 32px 32px; -webkit-mask: radial-gradient(90% 90% at 30% 20%, #000, transparent); }
.l { position: absolute; left: 76px; top: 82px; width: 520px; }
.brand { display: flex; align-items: center; gap: 20px; }
.brand img { width: 108px; height: 108px; filter: drop-shadow(0 16px 30px rgba(108,92,255,.55)); }
.brand b { font-size: 84px; font-weight: 760; letter-spacing: -.05em; }
h1 { margin-top: 40px; font-size: 46px; line-height: 1.08; letter-spacing: -.04em; font-weight: 720; }
h1 span { background: linear-gradient(100deg, #e9d5ff, #a78bfa 30%, #22d3ee 65%, #f9a8d4); -webkit-background-clip: text; color: transparent; }
.chips { display: flex; gap: 10px; margin-top: 30px; }
.chip { font-size: 19px; font-weight: 600; padding: 8px 16px; border-radius: 99px; background: rgba(255,255,255,.08); box-shadow: inset 0 1px 0 rgba(255,255,255,.12); color: #c9c6d8; }
.repo { position: absolute; left: 76px; bottom: 58px; font-size: 22px; color: #8c88a2; font-weight: 560; }
.repo b { color: #e9e6f5; font-weight: 650; }
.shot { position: absolute; left: 640px; top: 74px; width: 600px; height: 492px; border-radius: 18px; overflow: hidden; box-shadow: 0 0 0 1px rgba(255,255,255,.1), 0 40px 100px rgba(0,0,0,.65); }
.shot img { width: 1240px; display: block; margin-left: -640px; }
</style></head><body><div class="g1"></div><div class="g2"></div><div class="dots"></div>
<div class="l"><div class="brand"><img src="data:image/png;base64,${b64(path.join(site, 'img/icon-256.png'))}"><b>Fuseduo</b></div>
<h1>Drop one Mac app on another. <span>Get an automation.</span></h1>
<div class="chips"><span class="chip">Free</span><span class="chip">Open source</span><span class="chip">macOS</span><span class="chip">Claude</span></div></div>
<div class="repo">github.com/<b>hollowbit-dev/fuseduo</b></div>
<div class="shot"><img src="data:image/webp;base64,${b64(path.join(site, 'img/app-plan.webp'))}"></div>
</body></html>`;
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1280, height: 640 } });
  await p.setContent(html); await p.waitForTimeout(400);
  await p.screenshot({ path: path.join(root, '.github', 'social-preview.png') }); await b.close();
  console.log('wrote .github/social-preview.png');
})();

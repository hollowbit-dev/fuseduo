// Ad-hoc signs the Mac app so Apple Silicon Macs will run it.
// (A paid Apple Developer ID would remove the "unidentified developer" warning; see README.)
const { execFileSync } = require('child_process');
const path = require('path');
exports.default = async function afterPack(ctx) {
  if (ctx.electronPlatformName !== 'darwin') return;
  const app = path.join(ctx.appOutDir, `${ctx.packager.appInfo.productFilename}.app`);
  execFileSync('codesign', ['--force', '--deep', '--sign', '-', app], { stdio: 'inherit' });
};

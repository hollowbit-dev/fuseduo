// Turns common macOS scripting errors into plain English (and a kind the UI can act on).
const OSA = [
  [/-1743|Not authori[sz]ed to send Apple events to ([^.\n]+)/i, (m) => ({ kind: 'automation', app: (m[1] || '').trim(), text: `macOS blocked Fuseduo from controlling ${(m[1] || 'that app').trim()}. Allow it in System Settings › Privacy & Security › Automation, then run it again.` })],
  [/-1712|AppleEvent timed out/i, () => ({ kind: 'timeout', text: 'The app took too long to answer. It may be busy or showing a dialog. Bring it to the front and try again.' })],
  [/-600|Application isn.t running/i, () => ({ kind: 'not-running', text: 'One of the apps isn’t running and couldn’t be started. Open it once yourself, then try again.' })],
  [/-1728|Can.t get /i, () => ({ kind: 'not-found', text: 'The script looked for something that isn’t there right now (an open window, a selected item, a playing song…). Set that up and run it again.' })],
  [/-1708|doesn.t understand/i, () => ({ kind: 'unsupported', text: 'The app doesn’t support one of the commands this script uses. Try Refine and ask for another way to do it.' })],
];
function explain(output) { for (const [re, fn] of OSA) { const m = re.exec(output); if (m) return fn(m); } return null; }
module.exports = { explain };

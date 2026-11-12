// A second line of defence after the prompt: refuse scripts that contain obviously destructive commands.
// This is a coarse filter, not a sandbox. The person still reads and approves every script before it runs.

const RULES = [
  [/\bsudo\b/, 'it asks for administrator rights (sudo)'],
  [/\brm\s+(-[a-zA-Z]*[rf]|.*\*)/, 'it deletes files (rm)'],
  [/\b(rmdir|shred|srm)\b/, 'it deletes files'],
  [/\bmv\s+[^\n]*(~|\$HOME|\/Users\/)[^\n]*\s+\/dev\/null/, 'it throws files away'],
  [/\bdiskutil\s+(erase|partition|zero|secureErase|apfs\s+delete)/i, 'it erases disks'],
  [/\b(shutdown|reboot|halt)\b/, 'it restarts or shuts down the Mac'],
  [/\b(curl|wget)\b[^\n|]*\|\s*(sh|zsh|bash|python|osascript)/, 'it downloads and runs code'],
  [/\b(launchctl|defaults\s+write|csrutil|spctl|systemsetup|networksetup|pmset)\b/, 'it changes system settings'],
  [/\bsecurity\s+(find|dump|delete)/, 'it reads or changes the keychain'],
  [/\bchmod\s+(-R\s+)?[0-7]*7[0-7]*\b|\bchown\b/, 'it changes file permissions'],
  [/\bdelete\s+(every\s+|the\s+|all\s+)?(file|folder|item|message|note|event|track|photo|reminder|contact|playlist|document)s?\b/i, 'it deletes things (AppleScript delete)'],
  [/\bmove\b[^\n]*\bto\s+(the\s+)?trash\b/i, 'it moves things to the Trash'],
  [/\.delete\(\)|\bdelete\(/, 'it deletes things (JavaScript delete)'],
  [/\bempty\s+(the\s+)?trash\b/i, 'it empties the Trash'],
  [/\bsend\s+(it|the\s+message|theMessage|msg|newMessage)\b|\bsend\s+(message|email)/i, 'it sends a message on your behalf'],
  [/do\s+shell\s+script\s+"[^"]*with\s+administrator/i, 'it asks for administrator rights'],
  [/\b(Login\s+Data|Cookies|keychain-db|\.ssh\/)\b/i, 'it reads private browser or key data'],
];

function checkScript(language, script) {
  if (!['applescript', 'javascript', 'shell'].includes(language)) return { ok: false, reason: `unknown language "${language}"` };
  if (typeof script !== 'string' || !script.trim()) return { ok: false, reason: 'the script is empty' };
  if (script.length > 20000) return { ok: false, reason: 'the script is unusually long' };
  for (const [re, reason] of RULES) if (re.test(script)) return { ok: false, reason };
  return { ok: true };
}

module.exports = { checkScript };

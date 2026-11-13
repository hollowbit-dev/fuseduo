// Test-only canned answers (FUSE_MOCK=1), so the UI can be exercised without calling Claude.
// The script is harmless on purpose: it only builds a line of text and returns it.
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
module.exports = {
  async ideas(a, b) {
    await wait(600);
    return { ideas: [
      { title: `${a.name} + ${b.name} workspace`, description: `Opens ${a.name} and ${b.name} side by side, sized to fill your screen, ready to work.` },
      { title: 'Daily snapshot note', description: `Writes a short note with the date and what ${a.name} and ${b.name} are showing, so you can look back later.` },
      { title: 'Focus mode in one click', description: `Hides every other app and leaves just ${a.name} and ${b.name} on screen.` },
    ] };
  },
  async refine(a, b, plan, instruction) {
    await wait(600);
    return { ...plan, steps: [...plan.steps, `Also: ${instruction}`], script: `${plan.script}\n-- refined: ${instruction.replace(/[\r\n]/g, ' ')}` };
  },
  async build(a, b, idea) {
    await wait(700);
    return {
      name: idea.title,
      steps: [
        'Reads today’s date and time.',
        `Builds a one-line snapshot that names ${a.name} and ${b.name}.`,
        'Shows you the snapshot. Nothing else on your Mac changes.',
      ],
      language: 'applescript',
      script: [
        `-- ${idea.title}: ${a.name} + ${b.name}`,
        `set appA to "${a.name}"`,
        `set appB to "${b.name}"`,
        'set stamp to (current date) as string',
        '',
        '-- one line, ready to keep',
        'set snapshot to "Snapshot " & stamp & ": " & appA & " + " & appB',
        'return snapshot',
      ].join('\n'),
      risk: 'low', permissions: [], undo: 'Nothing to undo. It only builds a line of text.',
    };
  },
};

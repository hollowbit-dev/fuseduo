// Test-only canned answers (FUSE_MOCK=1), so the UI can be exercised without an API key.
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
module.exports = {
  async ideas(a, b) {
    await wait(600);
    return { ideas: [
      { title: `${a.name} meets ${b.name}`, description: `Opens ${a.name} and ${b.name} side by side, ready to work.` },
      { title: 'Daily snapshot note', description: `Writes a note on your Desktop listing what ${a.name} and ${b.name} are showing right now.` },
      { title: 'Focus mode in one click', description: `Hides everything except ${a.name} and ${b.name}.` },
    ] };
  },
  async build(a, b, idea) {
    await wait(700);
    return {
      name: idea.title,
      steps: [`Open ${a.name}.`, `Open ${b.name}.`, 'Report back which apps were opened.'],
      language: 'applescript',
      script: `return "Would open ${a.name} and ${b.name}"`,
      risk: 'low', permissions: [], undo: 'Nothing to undo; it only reports back.',
    };
  },
};

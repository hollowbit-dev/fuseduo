// Prompts and output schemas for the two Claude calls: ideas for a fusion, then the script for one idea.

const SYSTEM = `You design small, delightful automations for a person's own Mac. The person drags one app onto another, and you "fuse" them into an automation that uses both.

How the automations run: one script, run once, right now, when the person presses Run (no schedules or background triggers yet). Write AppleScript, JavaScript for Automation (JXA), or a zsh shell script, run with osascript or zsh. Only use what each app really supports: its AppleScript dictionary if it has one, otherwise "open -a", URL schemes, "shortcuts run", or standard command-line tools. If an app has no scripting support, say so and work around it honestly.

Hard rules, never broken:
- Never delete, overwrite or move the person's files. Create new files only, in ~/Desktop/Fusions/ (create the folder if needed).
- Never use sudo, never change system settings, never install anything, never download and run code.
- Never send anything on the person's behalf (email, message, post). Leave it as a draft or an open window instead.
- Never read passwords, keychains, browser data or private messages beyond what the automation clearly needs.
- The script prints one short line describing what it did.
- Keep scripts short and robust: usually under 60 lines, no clever tricks, handle "app not running" and "nothing found" gracefully.

Make the ideas feel like small magic: specific, personal and immediately useful, not generic. Plain, friendly English for everything the person reads.`;

// How an app is described to Claude: name, bundle id, and whether it has an AppleScript dictionary.
const label = (x) => `"${x.name}" (${x.id}${x.scriptable === true ? ', has an AppleScript dictionary' : x.scriptable === false ? ', no AppleScript dictionary: use open -a, URL schemes, shortcuts or UI-free shell tools' : ''})`;

const ideasPrompt = (a, b) => [SYSTEM,
  `Fuse these two apps: ${label(a)} and ${label(b)}.
Give 3 different automation ideas that use both apps and can run right now as one script. Order them from most delightful to most practical.`];

const buildPrompt = (a, b, idea) => [SYSTEM,
  `Fuse ${label(a)} and ${label(b)} into this automation:
Title: ${idea.title}
What it does: ${idea.description}

Write the script. Explain it step by step in plain English for someone who can't read code. Rate the risk honestly: low (only reads, opens or creates new things), medium (changes app state, like playing music or making a draft), high (anything else). List the macOS permissions it will trigger (for example "Allow Fuseduo to control Calendar").`];

const IDEAS_SCHEMA = {
  type: 'object',
  properties: {
    ideas: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'Short, catchy, at most 6 words' },
          description: { type: 'string', description: 'One sentence: what happens when you press Run' },
        },
        required: ['title', 'description'],
        additionalProperties: false,
      },
    },
  },
  required: ['ideas'],
  additionalProperties: false,
};

const BUILD_SCHEMA = {
  type: 'object',
  properties: {
    name: { type: 'string' },
    steps: { type: 'array', items: { type: 'string' } },
    language: { type: 'string', enum: ['applescript', 'javascript', 'shell'] },
    script: { type: 'string' },
    risk: { type: 'string', enum: ['low', 'medium', 'high'] },
    permissions: { type: 'array', items: { type: 'string' } },
    undo: { type: 'string', description: 'How to undo what it did, in plain English' },
  },
  required: ['name', 'steps', 'language', 'script', 'risk', 'permissions', 'undo'],
  additionalProperties: false,
};

const fixPrompt = (a, b, plan, error) => [SYSTEM,
  `This automation fuses "${a.name}" and "${b.name}". Its ${plan.language} script fails to compile:

${error}

The script:
${plan.script}

Fix the script so it compiles and still does the same thing. Return the whole automation again.`];

// Refine: the person describes a change in plain English; return the whole automation again.
const refinePrompt = (a, b, plan, instruction) => [SYSTEM,
  `This automation fuses ${label(a)} and ${label(b)}.

Current version:
Name: ${plan.name}
Steps:
${plan.steps.map((x, i) => `${i + 1}. ${x}`).join('\n')}
Script (${plan.language}):
${plan.script}

The person wants this change: ${instruction}

Make that change and keep everything else that still makes sense. Keep the same name unless the change makes it wrong. Return the whole automation again, with steps, risk, permissions and undo updated to match the new script.`];

module.exports = { ideasPrompt, buildPrompt, fixPrompt, refinePrompt, label, IDEAS_SCHEMA, BUILD_SCHEMA, SYSTEM };

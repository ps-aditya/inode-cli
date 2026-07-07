# Terminal Risk Analyzer

> Know what a command will actually do before you press Enter.

Terminal Risk Analyzer (`tra`) inspects the command you're about to run —
starting with Git — and tells you, in plain language, what it will change,
who it will affect, and whether it can be undone.

```
$ git push --force

This command will:
  ✓ Rewrite remote history
  ✓ Affect 2 collaborators
  ✓ Replace 11 commits

Undo:       Possible — git reflog
Confidence: 99%
```

No AI in the hot path. No network calls. Just fast, deterministic checks
against your actual repo state.

## Why

"I don't want to break my machine" is a feeling most developers already
have. Existing tools either block commands with a blunt warning or say
nothing at all. This project aims to be specific instead: not "this is
dangerous," but exactly what will happen if you proceed.

## Status

Early and under active daily development. See [`ROADMAP.md`](./ROADMAP.md)
and [`docs/plan.md`](./docs/plan.md) for where this is headed and why.

Currently supported: command parsing and a deterministic risk engine for
a handful of Git and filesystem commands (see `ROADMAP.md`). Repo-context
inspection and prediction output are next.

## Getting started

```bash
git clone https://github.com/<your-org>/terminal-risk-analyzer.git
cd terminal-risk-analyzer
npm install
npm run build
```

Check whether a command is risky before you run it:

```bash
node apps/cli/dist/index.js check git push --force
```

```
git push --force

Risk: HIGH

This command will:
  ✓ Rewrites remote history
  ✓ May overwrite commits pushed by collaborators

Undo:       git reflog (on the machine that had the old history)
Confidence: 90%
Rule:       git-force-push
```

Or just inspect how a command gets parsed:

```bash
node apps/cli/dist/index.js parse git push --force
```

```json
{
  "raw": "git push --force",
  "command": "git",
  "subcommand": "push",
  "flags": ["--force"],
  "args": []
}
```

## Project structure

```
terminal-risk-analyzer/
│
├── apps/
│   └── cli/            # The command-line entrypoint (Commander.js)
│
├── packages/
│   ├── parser/         # Turns a raw command string into structured data
│   ├── predictor/       # Combines rules + repo context into a concrete prediction
│   ├── rules/           # JSON-driven risk rules (no AI)
│   ├── output/          # Terminal rendering (chalk / boxen / ora)
│   └── shared/          # Shared TypeScript types
│
├── docs/                # Design notes and the living plan
├── examples/            # Example inputs/outputs for supported commands
└── tests/               # Cross-package / integration tests
```

## Contributing

This project is built in the open, in public daily increments. See
[`CONTRIBUTING.md`](./CONTRIBUTING.md) for how to file issues, pick up a
`good first issue`, and the commit conventions we follow.

## License

[MIT](./LICENSE)

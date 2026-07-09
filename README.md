<h1 align="center">Inode CLI</h1>
<p align="center">
  <img src="assets/logo.svg" alt="inode-cli logo" width="120" height="120">
</p>
<p align="center">
  Know what a terminal command will actually do before you press Enter.
</p>

<p align="center">
  <!-- <a href="https://github.com/ps-aditya/inode-cli/actions/workflows/ci.yml"><img src="https://github.com/ps-aditya/inode-cli/actions/workflows/ci.yml/badge.svg" alt="CI"></a> -->
  <img src="https://img.shields.io/badge/status-early--dev-orange.svg" alt="Status">
  <img src="https://img.shields.io/badge/node-18+-339933.svg" alt="Node">
  <img src="https://img.shields.io/badge/typescript-5.5-3178C6.svg" alt="TypeScript">
  <img src="https://img.shields.io/badge/license-MIT-green.svg" alt="License">
</p>

<p align="center">
  <!-- GIF goes here once recorded — see "What's still needed" below -->
  <img src="assets/demo.gif" alt="inode-cli running against a real git repo, showing a HIGH risk force-push warning" width="100%">
</p>

---

**inode-cli** (`inode`) inspects the command you're about to run — starting with
Git and destructive filesystem operations — and tells you, in plain language,
what it will change, who it will affect, and whether it can be undone. No AI
in the hot path, no network calls: fast, deterministic checks against your
actual repo state.

## Why

"I don't want to break my machine" is a feeling most developers already have.
Existing tools either block a command with a blunt warning or say nothing at
all. `inode-cli` aims to be specific instead of alarming — not "this is
dangerous," but exactly what will happen if you proceed, who it affects, and
how to undo it if you change your mind.

- **What will this actually do?** Rewrites history, deletes files permanently,
  moves a branch pointer — stated plainly, not just flagged as "risky."
- **Who does it affect?** Collaborator impact and protected-branch detection
  come from your real repo state, not a static command blocklist.
- **Can I undo it?** Every match carries an honest undo hint — including
  "not possible" when that's the truth (e.g. `rm -rf`).
- **How sure are you?** A confidence score that's lowered when upstream data
  is stale or unavailable, not just a flat number.
- **Does it slow me down?** No — `inode check` is a manual side-tool you run
  yourself. It never intercepts or blocks a real command.

## Real local run

These are real outputs from the version in this repo, run against an actual
git repository — not fixtures.

```
$ inode check git push --force
⛔ CRITICAL git push --force — rewrites remote history, may overwrite commits
pushed by collaborators, no upstream tracking branch found — remote impact
could not be measured, this is your protected branch (main).
Undo: git reflog (on the machine that had the old history). (70%)
```

```
$ inode check git reset --hard HEAD~1
⚠ HIGH git reset --hard HEAD~1 — discards uncommitted changes in tracked
files, moves the branch pointer, potentially dropping unreachable commits,
this is your protected branch (main).
Undo: git reflog, but uncommitted working-tree changes are gone for good. (90%)
```

```
$ inode check rm -rf node_modules
⛔ CRITICAL rm -rf node_modules — permanently deletes the target and
everything inside it, no trash/recycle bin — deletion bypasses the
filesystem's undo entirely.
Undo: not possible. (95%)
```

Want to know *why* it decided that? Add `--explain`:

```
$ inode check git push --force --explain
⛔ CRITICAL git push --force — rewrites remote history, ...

Rule "git-force-push" — Force push
Matched because all of the following were true:
  • command equals "git"
  • subcommand equals "push"
  • flags includes any of: "--force", "-f"
```

## Install

`inode-cli` isn't published to npm yet — install from source for now:

```bash
git clone https://github.com/ps-aditya/inode-cli.git
cd inode-cli
npm install
npm run build
node apps/cli/dist/index.js check git push --force
```

Once published (tracked in [ROADMAP.md](./ROADMAP.md)):

```bash
npm install -g @inode/cli
inode check git push --force
```

## Common workflows

```bash
# Check whether a command is risky before you run it
inode check git push --force

# Get a plain-language explanation of which rule matched and why
inode check git branch -D old-feature --explain

# Just inspect how a command gets parsed, no risk evaluation
inode parse git push --force

# Inspect the repo context inode is reading from (debug utility)
inode context
```

## Currently supported

The full pipeline — parsing, a deterministic JSON-driven risk engine,
repo-context inspection, and prediction — for:

- `git push --force` / `--force-with-lease`
- `git reset --hard`
- `git branch -D` (force branch delete)
- `git clean -f` / `-fd` / `-fdx`
- `rm -rf` / `rm -f`

See [ROADMAP.md](./ROADMAP.md) for what's shipped sprint-by-sprint and
[docs/plan.md](./docs/plan.md) for the broader product reasoning.

## What you get

| Need | inode-cli gives you |
|---|---|
| Pre-flight risk check | Deterministic HIGH/MEDIUM/LOW/CRITICAL rating from real repo state, not a static blocklist |
| Plain-language impact | "Rewrites remote history, affects 2 collaborators" instead of "this is dangerous" |
| Undo guidance | An honest undo hint per rule, including when there isn't one |
| Confidence you can trust | Score lowered automatically when upstream/remote data is stale or missing |
| Rule transparency | `--explain` shows exactly which conditions matched, no black box |
| Zero workflow disruption | A manual command you run yourself — never intercepts or blocks |

## Project structure

```
inode-cli/
│
├── apps/
│   └── cli/              # Command-line entrypoint (Commander.js) — bin: `inode`
│
├── packages/
│   ├── parser/            # Raw command string -> structured { command, subcommand, flags, args }
│   ├── rules/              # JSON-driven risk rules, no AI (git.rules.json, rm.rules.json)
│   ├── context/            # Reads real repo state: branch, remote, ahead/behind, protected branches
│   ├── predictor/          # Combines rules + context into a concrete, worded prediction
│   ├── output/             # Terminal rendering — single colored line per command (chalk)
│   └── shared/             # Shared TypeScript types across packages
│
├── docs/                  # Product plan, architecture notes
├── examples/
├── tests/
├── ROADMAP.md
└── CONTRIBUTING.md
```

## Contributing

Rule and parser PRs are welcome. A good rule contribution usually includes:

- a JSON rule entry in `packages/rules/src/data/`, not a code change
- a test covering the match and a test covering the near-miss
- an honest `undoHint` — say "not possible" if that's true

Run before sending a PR:

```bash
npm run build
npm test
npm run lint
npm run format:check
```

See [CONTRIBUTING.md](./CONTRIBUTING.md) for the full flow.

## Docs

- [ROADMAP.md](./ROADMAP.md) — sprint-by-sprint build log
- [docs/plan.md](./docs/plan.md) — product objective, success criteria, risks
- [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) — how the pipeline fits together

## License

[MIT](./LICENSE) © 2026 inode-cli contributors

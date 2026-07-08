# Roadmap

This roadmap tracks the MVP sprint plan. See `docs/plan.md` for the broader
product context (objective, success criteria, risks, open questions).

## Sprint 0 — Foundation ✅ (today)

- [x] Repository structure
- [x] TypeScript CLI project (Commander.js)
- [x] ESLint, Prettier, Vitest configured
- [x] Documentation scaffolded
- [x] First commit: `chore: initialize project`

## Sprint 1 — Command Parser ✅ (done)

- [x] Tokenize raw command strings (quote-aware)
- [x] Parse into `{ command, subcommand, flags, args }`
- [x] Unit tests covering common and edge cases
- [x] Wired into CLI as `tra parse <command...>`

## Sprint 2 — Risk Engine ✅ (done)

- [x] JSON-based rule schema (no AI)
- [x] Rule matcher: `ParsedCommand -> RiskAssessment`
- [x] Initial rule set: force push, force-push-with-lease, hard reset,
      branch force-delete, force clean, `rm -rf`, `rm -f`
- [x] Tests per rule
- [x] Wired into CLI as `tra check <command...>`

## Sprint 3 — Context Engine ✅ (done)

- [x] Detect current branch, remote, uncommitted changes
- [x] Detect ahead/behind counts
- [x] Detect protected branches
- [x] Detect contributors on affected history (`getContributorsBetween`,
      ready for the predictor to consume in Sprint 4)
- [x] Wired into CLI as `inode context` (debug utility)
- [x] 10 tests against real temporary git repos (not mocked)

## Sprint 4 — Prediction Engine ✅ (done)

- [x] Combine rule output + repo context into concrete predictions
      ("this will affect 1 collaborator", not "this is dangerous")
- [x] Undo detection (reuses rule-level `undoHint`, e.g. `git reflog`)
- [x] Confidence scoring (raised when upstream data is available,
      lowered when it isn't)
- [x] Wired into CLI: `inode check` now runs the full
      parse → rules → predict pipeline via `analyzeCommand()`
- [x] 8 tests against real temp repos, including a bare "remote" plus
      a second clone simulating a collaborator's unpulled commits

## Output Formatter ✅ (done)

- [x] Render `RiskAssessment` with chalk/boxen — color-coded by risk
      level (green/yellow/red/magenta), boxed panel for anything above
      LOW, quiet single line for LOW risk (per the manifesto's
      "prefer silence over noise")
- [x] Wired into CLI: `inode check` now uses `renderAssessment()`
      instead of manual `console.log` formatting
- [x] `--explain` flag to show which rule matched and why — prints the
      rule name and every condition that had to match (e.g. "command
      equals \"git\"", "flags includes any of: \"--force\", \"-f\"")

## Launch

- [x] Support the first 5 Git commands end-to-end — verified with real
      multi-collaborator repos (bare remote + 3 clones): `git push
    --force`/`--force-with-lease`, `git reset --hard`, `git branch
    -D`, `git clean -f`/`-fd`/`-fdx`, plus `rm -rf`/`rm -f`. Found
      and fixed 2 real bugs in the process (see commits 918a708,
      31a9e0a) — a box-rendering collapse on long undo hints, and a
      confidence score that didn't honestly reflect fetch staleness
- [ ] README with GIF demo
- [ ] Public GitHub launch

We do not launch when it's finished. We launch when someone can say
"Whoa, that's actually useful" — even if that's true for only five Git
commands.

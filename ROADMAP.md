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

## Sprint 3 — Context Engine

- [ ] Detect current branch, remote, uncommitted changes
- [ ] Detect ahead/behind counts
- [ ] Detect protected branches
- [ ] Detect number of contributors on affected history

## Sprint 4 — Prediction Engine

- [ ] Combine rule output + repo context into concrete predictions
      ("this will affect 2 collaborators", not "this is dangerous")
- [ ] Undo detection (e.g. `git reflog` availability)
- [ ] Confidence scoring

## Output Formatter (parallel track)

- [ ] Render `RiskAssessment` with chalk/boxen/ora
- [ ] `--explain` flag to show which rule matched and why

## Launch

- [ ] Support the first 5 Git commands end-to-end
- [ ] README with GIF demo
- [ ] Public GitHub launch

We do not launch when it's finished. We launch when someone can say
"Whoa, that's actually useful" — even if that's true for only five Git
commands.

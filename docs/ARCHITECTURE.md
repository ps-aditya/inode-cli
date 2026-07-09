# Architecture

## Pipeline

```
raw command string
        ↓
  packages/parser        → ParsedCommand { command, subcommand, flags, args }
        ↓
  packages/rules         → JSON rules match ParsedCommand → base RiskAssessment
        ↓
  context collectors     → RepoContext (git branch, remote, dirty state, ahead/behind...)
        ↓
  packages/predictor     → combines base RiskAssessment + RepoContext → final RiskAssessment
        ↓
  packages/output        → renders RiskAssessment to the terminal (chalk only)
```

## Design principles

1. **No AI in the deterministic path.** Parsing and rule-matching are pure,
   fast, and fully explainable. This keeps response times under the <100ms
   target and means every warning can be traced to a specific rule.
2. **TypeScript everywhere.** The team is already fast in TypeScript/Node.
   Winning the "does this help me" question matters more right now than
   language choice. A performance-critical rewrite (e.g. a Rust core) is a
   later decision, not a blocker today.
3. **Specific over generic.** The product's value is concrete predictions
   ("this will affect 2 collaborators"), not generic warnings ("force push
   is dangerous"). Every new rule should aim for the specific version.
4. **Small surface area first.** Supporting five Git commands extremely well
   beats supporting fifty shallowly. See `docs/plan.md` for what's
   deliberately deferred.
5. **Extension, not replacement — currently 100% manual, by design.**
   `inode check <command>` is a separate command you run yourself. It does
   not hook into your shell, does not intercept real execution, and never
   blocks anything — nothing is "on hold" while it runs. This was confirmed
   explicitly after real feedback that the original boxed output _felt_
   like a blocking gate even though it never was one; the fix was both the
   visual redesign (single line, no box) and stating this plainly here so
   it isn't accidentally re-architected into a blocking hook later without
   a deliberate decision to do so. If shell integration is ever built, it
   should stay non-blocking and opt-in — see `plan.md`'s open question on
   this ("Should the product activate automatically or on demand?").

## Package responsibilities

| Package              | Responsibility                                              |
| -------------------- | ----------------------------------------------------------- |
| `packages/shared`    | Shared TypeScript types used across all packages            |
| `packages/parser`    | Raw string → `ParsedCommand`                                |
| `packages/rules`     | `ParsedCommand` → base `RiskAssessment` (JSON rules, no AI) |
| `packages/predictor` | Base `RiskAssessment` + `RepoContext` → final prediction    |
| `packages/output`    | `RiskAssessment` → formatted terminal output                |
| `apps/cli`           | Wires everything together behind a Commander.js CLI         |

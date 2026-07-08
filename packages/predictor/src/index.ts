import type { ParsedCommand, RiskAssessment, RiskEffect } from '@inode/shared';
import { parseCommand } from '@inode/parser';
import { assessRisk } from '@inode/rules';
import {
  collectRepoContext,
  getContributorsBetween,
  getUncommittedFileCount,
  getUpstreamRef,
  isProtectedBranchName,
} from '@inode/context';

function pluralize(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? '' : 's'}`;
}

/**
 * Takes a rule-engine assessment (generic — "force push is dangerous")
 * and sharpens it using real repo state ("this will affect 2
 * collaborators"). This is the only place generic rule effects get
 * replaced with specific numbers — the rule engine itself stays generic
 * and reusable; this is where it meets *your* repo.
 *
 * No AI here either — every number comes from a git command.
 *
 * IMPORTANT CAVEAT (now surfaced directly to the user, not just here):
 * ahead/behind counts and collaborator counts are computed from the
 * local remote-tracking ref (e.g. `origin/main`), which is only as
 * fresh as your last `git fetch`/`git pull`. If a collaborator pushed
 * moments ago and you haven't fetched, this will under-report the real
 * impact. We deliberately do NOT auto-fetch here — that would add a
 * network call and latency to what's meant to be a fast, offline-capable
 * check (see the <100ms success criterion) — so instead we say plainly,
 * in the output itself, that the numbers reflect the last fetch. This
 * tradeoff (speed vs. freshness) is worth revisiting if silent staleness
 * ever causes a real near-miss in practice.
 */
export function predict(
  command: ParsedCommand,
  baseAssessment: RiskAssessment,
  cwd: string = process.cwd(),
): RiskAssessment {
  // Nothing matched, or we're not even in a repo — nothing to sharpen.
  if (baseAssessment.level === 'LOW' || !baseAssessment.matchedRule) {
    return baseAssessment;
  }

  const context = collectRepoContext(cwd);
  if (!context.isGitRepo) {
    return baseAssessment;
  }

  let level = baseAssessment.level;
  let confidence = baseAssessment.confidence;
  const effects: RiskEffect[] = [...baseAssessment.effects];

  switch (baseAssessment.matchedRule) {
    case 'git-force-push':
    case 'git-force-push-with-lease': {
      if (!context.hasRemote) {
        return {
          level: 'LOW',
          confidence: 95,
          effects: [
            {
              description:
                'No remote is configured — this command would fail before changing anything',
            },
          ],
          undoable: true,
          matchedRule: baseAssessment.matchedRule,
        };
      }

      const upstream = getUpstreamRef(cwd);
      if (upstream) {
        const lostCommits = context.behind ?? 0;
        const contributors = getContributorsBetween('HEAD', upstream, cwd);

        effects.length = 0;
        effects.push({ description: 'Rewrites remote history' });
        if (lostCommits > 0) {
          effects.push({
            description: `Replaces ${pluralize(lostCommits, 'commit')} on the remote`,
          });
        }
        if (contributors.length > 0) {
          effects.push({
            description: `Affects ${pluralize(contributors.length, 'collaborator')}`,
          });
        }
        // Deliberately NOT boosting confidence here just because an
        // upstream ref exists. Found in QA: this previously reported the
        // same 99% confidence whether or not the local remote-tracking
        // data was fresh, silently under-reporting real impact right
        // after a collaborator pushed and before a fetch. Confidence
        // should reflect what we actually know, and we genuinely don't
        // know how stale this is — so we say so instead of hiding it.
        effects.push({
          description: `Numbers reflect your last fetch of ${upstream} — run "git fetch" first to be sure this is current`,
        });
      } else {
        effects.push({
          description: 'No upstream tracking branch found — remote impact could not be measured',
        });
        confidence = Math.max(50, confidence - 20);
      }

      if (context.isProtectedBranch) {
        effects.push({ description: `This is your protected branch (${context.currentBranch})` });
        level = 'CRITICAL';
      }
      break;
    }

    case 'git-hard-reset': {
      if (context.hasUncommittedChanges) {
        const fileCount = getUncommittedFileCount(cwd);
        effects.push({
          description: `Discards changes in ${pluralize(fileCount, 'uncommitted file')}`,
        });
      }
      if (context.isProtectedBranch) {
        effects.push({ description: `This is your protected branch (${context.currentBranch})` });
      }
      break;
    }

    case 'git-branch-force-delete': {
      // The branch being deleted is an argument (e.g. "git branch -D
      // old-feature" -> args: ["old-feature"]) — not the branch you're
      // currently on, which is what context.currentBranch/isProtectedBranch
      // describe. These are genuinely different things.
      const targetBranch = command.args[0];
      if (targetBranch && isProtectedBranchName(targetBranch)) {
        effects.push({ description: `"${targetBranch}" is a protected branch name` });
        level = 'HIGH';
      }
      break;
    }

    default:
      break;
  }

  return {
    level,
    confidence,
    effects,
    undoable: baseAssessment.undoable,
    undoHint: baseAssessment.undoHint,
    matchedRule: baseAssessment.matchedRule,
  };
}

/**
 * Convenience wrapper for callers (like the CLI) that just have a raw
 * command string and want the full pipeline: parse -> rules -> predict.
 */
export function analyzeCommand(raw: string, cwd: string = process.cwd()): RiskAssessment {
  const parsed = parseCommand(raw);
  const baseAssessment = assessRisk(parsed);
  return predict(parsed, baseAssessment, cwd);
}

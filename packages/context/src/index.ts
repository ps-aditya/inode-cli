import type { RepoContext } from '@inode/shared';
import { tryGit } from './git';
import { isProtectedBranchName } from './protectedBranches';

/**
 * Collects everything we can determine about the repo at `cwd` with
 * plain git commands. No AI, no network calls — if git can't answer a
 * question quickly and locally, we leave that field undefined rather
 * than guess.
 */
export function collectRepoContext(cwd: string = process.cwd()): RepoContext {
  const isGitRepo = tryGit(['rev-parse', '--is-inside-work-tree'], cwd) === 'true';

  if (!isGitRepo) {
    return { isGitRepo: false };
  }

  const currentBranch = tryGit(['rev-parse', '--abbrev-ref', 'HEAD'], cwd) ?? undefined;

  const statusOutput = tryGit(['status', '--porcelain'], cwd);
  const hasUncommittedChanges = statusOutput === null ? undefined : statusOutput.length > 0;

  const remotes = tryGit(['remote'], cwd);
  const hasRemote = remotes === null ? undefined : remotes.length > 0;

  const context: RepoContext = {
    isGitRepo: true,
    currentBranch,
    isProtectedBranch: currentBranch ? isProtectedBranchName(currentBranch) : undefined,
    hasUncommittedChanges,
    hasRemote,
  };

  // Ahead/behind require an upstream tracking branch. No upstream is a
  // completely normal state (e.g. a brand-new local branch), not an error.
  const upstream = tryGit(['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{u}'], cwd);
  if (upstream) {
    const counts = tryGit(['rev-list', '--left-right', '--count', `${upstream}...HEAD`], cwd);
    if (counts) {
      const [behind, ahead] = counts.split(/\s+/).map((value) => Number.parseInt(value, 10));
      context.behind = Number.isNaN(behind) ? undefined : behind;
      context.ahead = Number.isNaN(ahead) ? undefined : ahead;
    }
  }

  return context;
}

/**
 * Returns the distinct author emails for commits reachable from `head`
 * but not from `base` — i.e. "who wrote the history this command would
 * affect". Used by the predictor (Sprint 4) to turn "force push" into
 * "this will affect 2 collaborators".
 */
export function getContributorsBetween(
  base: string,
  head: string,
  cwd: string = process.cwd(),
): string[] {
  const output = tryGit(['log', '--format=%ae', `${base}..${head}`], cwd);
  if (!output) return [];
  const emails = output.split('\n').filter((line) => line.length > 0);
  return Array.from(new Set(emails));
}

/**
 * Returns the upstream tracking ref for HEAD (e.g. "origin/main"), or
 * null if none is configured. Exposed separately from
 * collectRepoContext() because the predictor needs the ref itself (to
 * diff against), not just the ahead/behind counts derived from it.
 */
export function getUpstreamRef(cwd: string = process.cwd()): string | null {
  return tryGit(['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{u}'], cwd);
}

/** Returns how many files have uncommitted changes (tracked or untracked). */
export function getUncommittedFileCount(cwd: string = process.cwd()): number {
  const output = tryGit(['status', '--porcelain'], cwd);
  if (!output) return 0;
  return output.split('\n').filter((line) => line.length > 0).length;
}

export { isProtectedBranchName } from './protectedBranches';
export type { RepoContext } from '@inode/shared';

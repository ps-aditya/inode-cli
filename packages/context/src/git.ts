import { execFileSync } from 'node:child_process';

/**
 * Runs a git command synchronously and returns trimmed stdout.
 * Throws if git exits non-zero — callers decide whether that's expected
 * (e.g. "no upstream configured") or a real error.
 */
export function git(args: string[], cwd: string): string {
  return execFileSync('git', args, {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
}

/** Runs a git command, returning null instead of throwing on failure. */
export function tryGit(args: string[], cwd: string): string | null {
  try {
    return git(args, cwd);
  } catch {
    return null;
  }
}

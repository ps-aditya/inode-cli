import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { collectRepoContext, getContributorsBetween, isProtectedBranchName } from './index';

function run(args: string[], cwd: string): void {
  execFileSync('git', args, { cwd, stdio: 'ignore' });
}

function initRepo(cwd: string, branch = 'main'): void {
  run(['init', '-q', '-b', branch], cwd);
  run(['config', 'user.email', 'test@example.com'], cwd);
  run(['config', 'user.name', 'Test User'], cwd);
}

function commit(cwd: string, filename: string, content: string, message: string): void {
  writeFileSync(join(cwd, filename), content);
  run(['add', '-A'], cwd);
  run(['commit', '-q', '-m', message], cwd);
}

describe('collectRepoContext', () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'inode-context-'));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('reports isGitRepo: false for a non-git directory', () => {
    expect(collectRepoContext(dir)).toEqual({ isGitRepo: false });
  });

  it('detects the current branch and that main is protected', () => {
    initRepo(dir, 'main');
    commit(dir, 'a.txt', 'hello', 'init');

    const context = collectRepoContext(dir);
    expect(context.isGitRepo).toBe(true);
    expect(context.currentBranch).toBe('main');
    expect(context.isProtectedBranch).toBe(true);
  });

  it('detects a feature branch as not protected', () => {
    initRepo(dir, 'main');
    commit(dir, 'a.txt', 'hello', 'init');
    run(['checkout', '-q', '-b', 'feature/add-thing'], dir);

    const context = collectRepoContext(dir);
    expect(context.currentBranch).toBe('feature/add-thing');
    expect(context.isProtectedBranch).toBe(false);
  });

  it('detects uncommitted changes', () => {
    initRepo(dir, 'main');
    commit(dir, 'a.txt', 'hello', 'init');
    expect(collectRepoContext(dir).hasUncommittedChanges).toBe(false);

    writeFileSync(join(dir, 'a.txt'), 'changed');
    expect(collectRepoContext(dir).hasUncommittedChanges).toBe(true);
  });

  it('detects no remote configured', () => {
    initRepo(dir, 'main');
    commit(dir, 'a.txt', 'hello', 'init');
    expect(collectRepoContext(dir).hasRemote).toBe(false);
  });

  it('detects a configured remote and ahead/behind counts', () => {
    const bareDir = mkdtempSync(join(tmpdir(), 'inode-bare-'));
    try {
      run(['init', '-q', '--bare', '-b', 'main'], bareDir);

      initRepo(dir, 'main');
      commit(dir, 'a.txt', 'hello', 'init');
      run(['remote', 'add', 'origin', bareDir], dir);
      run(['push', '-q', '-u', 'origin', 'main'], dir);

      let context = collectRepoContext(dir);
      expect(context.hasRemote).toBe(true);
      expect(context.ahead).toBe(0);
      expect(context.behind).toBe(0);

      // Commit locally without pushing -> ahead by 1.
      commit(dir, 'b.txt', 'more', 'second commit');
      context = collectRepoContext(dir);
      expect(context.ahead).toBe(1);
      expect(context.behind).toBe(0);
    } finally {
      rmSync(bareDir, { recursive: true, force: true });
    }
  });
});

describe('isProtectedBranchName', () => {
  it('flags common protected branch names', () => {
    expect(isProtectedBranchName('main')).toBe(true);
    expect(isProtectedBranchName('master')).toBe(true);
    expect(isProtectedBranchName('production')).toBe(true);
    expect(isProtectedBranchName('release/1.2')).toBe(true);
    expect(isProtectedBranchName('hotfix/urgent-bug')).toBe(true);
  });

  it('does not flag feature branches', () => {
    expect(isProtectedBranchName('feature/new-thing')).toBe(false);
    expect(isProtectedBranchName('chore/cleanup')).toBe(false);
  });
});

describe('getContributorsBetween', () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'inode-context-contrib-'));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('returns distinct author emails for commits in range', () => {
    initRepo(dir, 'main');
    commit(dir, 'a.txt', '1', 'first');
    const afterFirst = execFileSync('git', ['rev-parse', 'HEAD'], {
      cwd: dir,
      encoding: 'utf8',
    }).trim();

    run(['config', 'user.email', 'other@example.com'], dir);
    run(['config', 'user.name', 'Other User'], dir);
    commit(dir, 'b.txt', '2', 'second');
    commit(dir, 'c.txt', '3', 'third');

    const contributors = getContributorsBetween(afterFirst, 'HEAD', dir);
    expect(contributors).toEqual(['other@example.com']);
  });

  it('returns an empty array for an unknown range', () => {
    initRepo(dir, 'main');
    commit(dir, 'a.txt', '1', 'first');
    expect(getContributorsBetween('nonexistent-ref', 'HEAD', dir)).toEqual([]);
  });
});

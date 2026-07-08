import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { parseCommand } from '@inode/parser';
import { assessRisk } from '@inode/rules';
import { analyzeCommand, predict } from './index';

function run(args: string[], cwd: string): void {
  execFileSync('git', args, { cwd, stdio: 'ignore' });
}

function initRepo(cwd: string, branch = 'main'): void {
  run(['init', '-q', '-b', branch], cwd);
  run(['config', 'user.email', 'test@example.com'], cwd);
  run(['config', 'user.name', 'Test User'], cwd);
}

function commitAs(
  cwd: string,
  filename: string,
  content: string,
  message: string,
  author?: { email: string; name: string },
): void {
  writeFileSync(join(cwd, filename), content);
  run(['add', '-A'], cwd);
  if (author) {
    run(
      [
        '-c',
        `user.email=${author.email}`,
        '-c',
        `user.name=${author.name}`,
        'commit',
        '-q',
        '-m',
        message,
      ],
      cwd,
    );
  } else {
    run(['commit', '-q', '-m', message], cwd);
  }
}

describe('predict', () => {
  let dir: string;
  let bareDir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'inode-predict-'));
    bareDir = mkdtempSync(join(tmpdir(), 'inode-predict-bare-'));
    run(['init', '-q', '--bare', '-b', 'main'], bareDir);
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
    rmSync(bareDir, { recursive: true, force: true });
  });

  it('leaves LOW assessments untouched', () => {
    const command = parseCommand('git status');
    const base = assessRisk(command);
    expect(predict(command, base, dir)).toEqual(base);
  });

  it('reports no remote configured, downgrading to LOW', () => {
    initRepo(dir, 'main');
    commitAs(dir, 'a.txt', '1', 'init');

    const command = parseCommand('git push --force');
    const base = assessRisk(command);
    const result = predict(command, base, dir);

    expect(result.level).toBe('LOW');
    expect(result.effects[0].description).toMatch(/no remote is configured/i);
  });

  it('reports concrete replaced-commits and collaborator counts for a force push', () => {
    initRepo(dir, 'main');
    commitAs(dir, 'shared.txt', '1', 'shared history', {
      email: 'alice@example.com',
      name: 'Alice',
    });
    run(['remote', 'add', 'origin', bareDir], dir);
    run(['push', '-q', '-u', 'origin', 'main'], dir);

    // A collaborator pushes two more commits to the remote that we don't have locally.
    const cloneDir = mkdtempSync(join(tmpdir(), 'inode-predict-clone-'));
    try {
      run(['clone', '-q', bareDir, cloneDir], tmpdir());
      run(['config', 'user.email', 'bob@example.com'], cloneDir);
      run(['config', 'user.name', 'Bob'], cloneDir);
      commitAs(cloneDir, 'b1.txt', '1', 'bob commit 1', { email: 'bob@example.com', name: 'Bob' });
      commitAs(cloneDir, 'b2.txt', '2', 'bob commit 2', { email: 'bob@example.com', name: 'Bob' });
      run(['push', '-q'], cloneDir);
    } finally {
      rmSync(cloneDir, { recursive: true, force: true });
    }

    // Ahead/behind and contributor counts are only as fresh as the local
    // remote-tracking ref — git doesn't know about a collaborator's
    // remote-side commits until you fetch. This mirrors real usage.
    run(['fetch', 'origin'], dir);

    // Our local branch is now 2 commits behind. Force pushing would wipe them.
    const command = parseCommand('git push --force');
    const base = assessRisk(command);
    const result = predict(command, base, dir);

    const descriptions = result.effects.map((e) => e.description);
    expect(descriptions).toContain('Rewrites remote history');
    expect(descriptions).toContain('Replaces 2 commits on the remote');
    expect(descriptions).toContain('Affects 1 collaborator');
    // Confidence should NOT be artificially boosted just because we found
    // an upstream ref — found in QA that this previously hid staleness
    // behind a falsely high number. Instead, a plain-language caveat
    // about fetch freshness should be present.
    expect(result.confidence).toBe(base.confidence);
    expect(descriptions.some((d) => d.includes('last fetch'))).toBe(true);
  });

  it('escalates to CRITICAL on a protected branch', () => {
    initRepo(dir, 'main'); // "main" is a protected branch name
    commitAs(dir, 'a.txt', '1', 'init');
    run(['remote', 'add', 'origin', bareDir], dir);
    run(['push', '-q', '-u', 'origin', 'main'], dir);
    commitAs(dir, 'b.txt', '2', 'local only commit');

    const command = parseCommand('git push --force');
    const base = assessRisk(command);
    const result = predict(command, base, dir);

    expect(result.level).toBe('CRITICAL');
    expect(result.effects.map((e) => e.description)).toContain(
      'This is your protected branch (main)',
    );
  });

  // Regression test: found during end-to-end QA. Before fetching, a
  // collaborator's remote-side commits are invisible to git locally, so
  // "Replaces N commits" / "Affects N collaborators" correctly don't
  // appear yet — but confidence still reported the same 99% as after
  // fetching, silently implying full certainty about a partial picture.
  // Guards against ever reintroducing that confidence boost.
  it('does not report inflated confidence when remote data may be stale (pre-fetch)', () => {
    initRepo(dir, 'main');
    commitAs(dir, 'a.txt', '1', 'shared history');
    run(['remote', 'add', 'origin', bareDir], dir);
    run(['push', '-q', '-u', 'origin', 'main'], dir);

    // A collaborator pushes commits directly to the bare remote. We
    // deliberately do NOT fetch before checking — this is the exact
    // "about to force-push without having fetched" scenario.
    const cloneDir = mkdtempSync(join(tmpdir(), 'inode-predict-stale-clone-'));
    try {
      run(['clone', '-q', bareDir, cloneDir], tmpdir());
      commitAs(cloneDir, 'c.txt', '1', 'a commit we have not fetched', {
        email: 'carol@example.com',
        name: 'Carol',
      });
      run(['push', '-q'], cloneDir);
    } finally {
      rmSync(cloneDir, { recursive: true, force: true });
    }

    const command = parseCommand('git push --force');
    const base = assessRisk(command);
    const result = predict(command, base, dir);
    const descriptions = result.effects.map((e) => e.description);

    // We haven't fetched, so we genuinely can't see Carol's commit yet —
    // that's expected and fine. What matters is confidence isn't
    // artificially inflated, and the freshness caveat is present so the
    // person knows this picture might be incomplete.
    expect(descriptions).not.toContain('Affects 1 collaborator');
    expect(result.confidence).toBe(base.confidence);
    expect(descriptions.some((d) => d.includes('last fetch'))).toBe(true);
  });

  it('reports the number of uncommitted files for a hard reset', () => {
    initRepo(dir, 'main');
    commitAs(dir, 'a.txt', '1', 'init');
    writeFileSync(join(dir, 'a.txt'), 'changed');
    writeFileSync(join(dir, 'b.txt'), 'new');

    const command = parseCommand('git reset --hard HEAD');
    const base = assessRisk(command);
    const result = predict(command, base, dir);

    expect(result.effects.map((e) => e.description)).toContain(
      'Discards changes in 2 uncommitted files',
    );
  });

  it('flags deleting a branch whose name looks protected', () => {
    initRepo(dir, 'main');
    commitAs(dir, 'a.txt', '1', 'init');

    const command = parseCommand('git branch -D release/2.0');
    const base = assessRisk(command);
    const result = predict(command, base, dir);

    expect(result.level).toBe('HIGH');
    expect(result.effects.map((e) => e.description)).toContain(
      '"release/2.0" is a protected branch name',
    );
  });

  it('does not flag deleting an ordinary feature branch', () => {
    initRepo(dir, 'main');
    commitAs(dir, 'a.txt', '1', 'init');

    const command = parseCommand('git branch -D old-feature');
    const base = assessRisk(command);
    const result = predict(command, base, dir);

    expect(result.level).toBe('MEDIUM'); // unchanged from the base rule
  });
});

describe('analyzeCommand', () => {
  it('runs the full parse -> rules -> predict pipeline', () => {
    const dir = mkdtempSync(join(tmpdir(), 'inode-analyze-'));
    try {
      initRepo(dir, 'main');
      commitAs(dir, 'a.txt', '1', 'init');
      const result = analyzeCommand('git status', dir);
      expect(result.level).toBe('LOW');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

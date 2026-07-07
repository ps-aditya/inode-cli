import { describe, expect, it } from 'vitest';
import { parseCommand } from '@tra/parser';
import { assessRisk } from './index';

describe('assessRisk', () => {
  it('flags git push --force as HIGH', () => {
    const result = assessRisk(parseCommand('git push --force'));
    expect(result.level).toBe('HIGH');
    expect(result.matchedRule).toBe('git-force-push');
    expect(result.undoable).toBe(true);
  });

  it('flags git push --force-with-lease as MEDIUM, not HIGH', () => {
    const result = assessRisk(parseCommand('git push --force-with-lease'));
    expect(result.level).toBe('MEDIUM');
    expect(result.matchedRule).toBe('git-force-push-with-lease');
  });

  it('flags git reset --hard as HIGH', () => {
    const result = assessRisk(parseCommand('git reset --hard HEAD~3'));
    expect(result.level).toBe('HIGH');
    expect(result.matchedRule).toBe('git-hard-reset');
  });

  it('flags git branch -D as MEDIUM', () => {
    const result = assessRisk(parseCommand('git branch -D old-feature'));
    expect(result.level).toBe('MEDIUM');
    expect(result.matchedRule).toBe('git-branch-force-delete');
  });

  it('flags rm -rf as CRITICAL and not undoable', () => {
    const result = assessRisk(parseCommand('rm -rf /tmp/foo'));
    expect(result.level).toBe('CRITICAL');
    expect(result.undoable).toBe(false);
    expect(result.matchedRule).toBe('fs-rm-recursive-force');
  });

  it('flags plain rm -f as HIGH (not CRITICAL — no recursion)', () => {
    const result = assessRisk(parseCommand('rm -f /tmp/foo'));
    expect(result.level).toBe('HIGH');
    expect(result.matchedRule).toBe('fs-rm-force');
  });

  it('does not flag a safe command', () => {
    const result = assessRisk(parseCommand('git status'));
    expect(result.level).toBe('LOW');
    expect(result.matchedRule).toBeUndefined();
    expect(result.effects).toEqual([]);
  });

  it('does not flag a plain git push (no force)', () => {
    const result = assessRisk(parseCommand('git push origin main'));
    expect(result.level).toBe('LOW');
  });
});

import { describe, expect, it } from 'vitest';
import { parseCommand } from '@inode/parser';
import { assessRisk, describeRule, getRuleById } from './index';

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

describe('getRuleById', () => {
  it('finds a rule by its id', () => {
    const rule = getRuleById('git-force-push');
    expect(rule).toBeDefined();
    expect(rule?.name).toBe('Force push');
  });

  it('returns undefined for an unknown id', () => {
    expect(getRuleById('not-a-real-rule')).toBeUndefined();
  });
});

describe('describeRule', () => {
  it('explains every condition that had to match', () => {
    const rule = getRuleById('git-force-push');
    expect(rule).toBeDefined();
    const lines = describeRule(rule!);

    expect(lines[0]).toContain('git-force-push');
    expect(lines[0]).toContain('Force push');
    expect(lines.some((line) => line.includes('command equals "git"'))).toBe(true);
    expect(lines.some((line) => line.includes('subcommand equals "push"'))).toBe(true);
    expect(lines.some((line) => line.includes('includes any of') && line.includes('--force'))).toBe(
      true,
    );
  });
});

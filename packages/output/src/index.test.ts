import { describe, expect, it } from 'vitest';
import type { RiskAssessment } from '@inode/shared';
import { renderAssessment } from './index';

describe('renderAssessment', () => {
  it('renders a quiet single line for LOW risk with no effects', () => {
    const assessment: RiskAssessment = {
      level: 'LOW',
      confidence: 100,
      effects: [],
      undoable: true,
    };
    const output = renderAssessment('git status', assessment);
    expect(output).toContain('git status');
    expect(output).toContain('looks safe');
    expect(output).not.toContain('Risk:');
  });

  it('renders the explanatory effect for a LOW assessment that still has one', () => {
    const assessment: RiskAssessment = {
      level: 'LOW',
      confidence: 95,
      effects: [
        {
          description: 'No remote is configured — this command would fail before changing anything',
        },
      ],
      undoable: true,
    };
    const output = renderAssessment('git push --force', assessment);
    expect(output).toContain('No remote is configured');
  });

  it('renders a full panel for HIGH risk with effects, undo, and confidence', () => {
    const assessment: RiskAssessment = {
      level: 'HIGH',
      confidence: 90,
      effects: [
        { description: 'Rewrites remote history' },
        { description: 'Affects 1 collaborator' },
      ],
      undoable: true,
      undoHint: 'git reflog',
      matchedRule: 'git-force-push',
    };
    const output = renderAssessment('git push --force', assessment);
    expect(output).toContain('Risk: HIGH');
    expect(output).toContain('Rewrites remote history');
    expect(output).toContain('Affects 1 collaborator');
    expect(output).toContain('git reflog');
    expect(output).toContain('90%');
    expect(output).toContain('git-force-push');
    expect(output).toContain('git push --force'); // boxen title
  });

  it('renders "Not possible" for undo when undoable is false', () => {
    const assessment: RiskAssessment = {
      level: 'CRITICAL',
      confidence: 95,
      effects: [{ description: 'Permanently deletes the target' }],
      undoable: false,
    };
    const output = renderAssessment('rm -rf /tmp/foo', assessment);
    expect(output).toContain('Not possible');
    expect(output).toContain('Risk: CRITICAL');
  });

  // Regression test: boxen@5 has a real bug where, in a non-TTY
  // environment, a line long enough to need internal wrapping causes it
  // to drop ALL newlines and collapse the entire box into one line. This
  // exact scenario (a long effect description, matching the real
  // fs-rm-recursive-force rule text) reproduced it. Guards against ever
  // reintroducing an unwrapped long line.
  it('keeps proper multi-line output when an effect description is long', () => {
    const assessment: RiskAssessment = {
      level: 'CRITICAL',
      confidence: 95,
      effects: [
        { description: 'Permanently deletes the target and everything inside it' },
        {
          description: "No trash/recycle bin — deletion bypasses the filesystem's undo entirely",
        },
      ],
      undoable: false,
      matchedRule: 'fs-rm-recursive-force',
    };
    const output = renderAssessment('rm -rf /tmp/foo', assessment);
    const lineCount = output.split('\n').length;
    expect(lineCount).toBeGreaterThan(10); // a collapsed box would be 1-3 lines
    expect(output).toContain('deletion bypasses');
    expect(output).toContain('entirely');
  });

  // Regression test: an extremely long raw command (used as the boxen
  // title) hit the exact same collapse bug via a different path — boxen
  // titles can't be wrapped, so we truncate instead. Guards against ever
  // passing an unbounded title straight to boxen again.
  it('keeps proper multi-line output and truncates an extremely long raw command', () => {
    const longRaw = `git push --force ${'x'.repeat(150)}`;
    const assessment: RiskAssessment = {
      level: 'HIGH',
      confidence: 90,
      effects: [{ description: 'Rewrites remote history' }],
      undoable: true,
      undoHint: 'git reflog',
      matchedRule: 'git-force-push',
    };
    const output = renderAssessment(longRaw, assessment);
    const lineCount = output.split('\n').length;
    expect(lineCount).toBeGreaterThan(10);
    expect(output).toContain('…');
    expect(output).not.toContain('x'.repeat(150)); // full unbounded title never reaches boxen
  });
});

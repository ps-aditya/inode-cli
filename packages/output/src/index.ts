import chalk from 'chalk';
import boxen from 'boxen';
import type { RiskAssessment, RiskLevel } from '@inode/shared';

type BoxenColor = 'green' | 'yellow' | 'red' | 'magenta';

const LEVEL_STYLE: Record<RiskLevel, { label: (text: string) => string; boxColor: BoxenColor }> = {
  LOW: { label: (text) => chalk.green(text), boxColor: 'green' },
  MEDIUM: { label: (text) => chalk.yellow.bold(text), boxColor: 'yellow' },
  HIGH: { label: (text) => chalk.red.bold(text), boxColor: 'red' },
  CRITICAL: { label: (text) => chalk.bgRed.white.bold(` ${text} `), boxColor: 'magenta' },
};

// boxen@5 has a real bug: in a non-TTY environment (piped output, CI logs,
// no process.stdout.columns), if any line needs internal wrapping to fit
// its guessed terminal width, it silently drops the newlines between ALL
// rows and collapses the whole box into one unreadable line. Reproduced
// and confirmed empirically — not something we can rely on a future boxen
// patch fixing. The fix: never let any line be long enough to need
// wrapping in the first place. We pre-wrap every line ourselves to a
// width comfortably under the ~71-72 char threshold where this triggers,
// so boxen's internal (buggy) wrap path never runs. (boxen's shipped
// .d.ts for this version doesn't declare a `width` option even though the
// runtime accepts one, so we avoid relying on it entirely and just keep
// every line short.)
const CONTENT_MAX_WIDTH = 68;
const TITLE_MAX_WIDTH = 70; // boxen titles can't be wrapped, so we truncate instead

/** Truncates with an ellipsis rather than letting boxen try to wrap a title (same bug). */
function truncateTitle(raw: string, maxWidth: number): string {
  if (raw.length <= maxWidth) return raw;
  return `${raw.slice(0, maxWidth - 1)}…`;
}

/** Greedy word-wrap. Continuation lines are indented to align under `prefix`. */
function wrapLine(prefix: string, text: string, maxWidth: number): string[] {
  const indent = ' '.repeat(prefix.length);
  const words = text.split(' ');
  const result: string[] = [];
  let current = prefix;
  let isFirstLine = true;

  for (const word of words) {
    const candidate =
      current === (isFirstLine ? prefix : indent) ? current + word : `${current} ${word}`;
    if (candidate.length > maxWidth && current !== (isFirstLine ? prefix : indent)) {
      result.push(current);
      current = `${indent}${word}`;
      isFirstLine = false;
    } else {
      current = candidate;
    }
  }
  result.push(current);
  return result;
}

/**
 * Renders a RiskAssessment for the terminal. Colors degrade gracefully —
 * chalk disables ANSI codes automatically when stdout isn't a TTY (e.g.
 * when piped to a file or captured in a test), so this is safe to snapshot.
 *
 * LOW-risk commands get a single quiet line, matching the manifesto's
 * "prefer silence over noise" principle — most commands are safe, and the
 * UI shouldn't argue with that.
 */
export function renderAssessment(raw: string, assessment: RiskAssessment): string {
  const style = LEVEL_STYLE[assessment.level];
  const displayRaw = truncateTitle(raw, TITLE_MAX_WIDTH);

  if (assessment.level === 'LOW') {
    const [firstEffect] = assessment.effects;
    if (!firstEffect) {
      return chalk.green(`✓ ${displayRaw} — looks safe (no rule matched)`);
    }
    // A LOW assessment can still carry an explanatory effect (e.g. "no
    // remote configured" from the predictor) — show it, just quietly.
    return chalk.green(`✓ ${displayRaw} — ${firstEffect.description}`);
  }

  const lines: string[] = [];
  lines.push(style.label(`Risk: ${assessment.level}`));
  lines.push('');
  lines.push('This command will:');
  for (const effect of assessment.effects) {
    const prefix = `  ${chalk.dim('✓')} `;
    lines.push(...wrapLine(prefix, effect.description, CONTENT_MAX_WIDTH));
  }
  lines.push('');

  const undoText = assessment.undoable ? (assessment.undoHint ?? 'Possible') : 'Not possible';
  const undoColor = assessment.undoable ? chalk.green : chalk.red;
  lines.push(`Undo:       ${undoColor(undoText)}`);
  lines.push(`Confidence: ${assessment.confidence}%`);
  if (assessment.matchedRule) {
    lines.push(chalk.dim(`Rule:       ${assessment.matchedRule}`));
  }

  return boxen(lines.join('\n'), {
    padding: 1,
    margin: { top: 1, bottom: 1, left: 0, right: 0 },
    borderColor: style.boxColor,
    title: displayRaw,
    titleAlignment: 'left',
  });
}

import type { ParsedCommand, RiskAssessment } from '@inode/shared';
import { matchRules } from './matcher';
import gitRules from './data/git.rules.json';
import rmRules from './data/rm.rules.json';
import type { Rule, RuleSet } from './types';

// All known rule sets, combined. Adding a new domain (e.g. Docker) means
// adding a new JSON file here — no other package needs to change.
const allRules: RuleSet = [...(gitRules as Rule[]), ...(rmRules as Rule[])];

const LEVEL_RANK: Record<Rule['level'], number> = {
  LOW: 0,
  MEDIUM: 1,
  HIGH: 2,
  CRITICAL: 3,
};

function toAssessment(rule: Rule): RiskAssessment {
  return {
    level: rule.level,
    confidence: rule.confidence,
    effects: rule.effects.map((description) => ({ description })),
    undoable: rule.undoable,
    undoHint: rule.undoHint,
    matchedRule: rule.id,
  };
}

/**
 * Assesses the risk of a parsed command using deterministic JSON rules.
 * No AI, no network calls — purely a lookup against `allRules`.
 *
 * If multiple rules match, the highest-severity one wins (e.g. a command
 * that happens to match both a MEDIUM and a HIGH rule reports HIGH).
 * If nothing matches, returns a default LOW assessment — most commands
 * are safe, and silence for the unremarkable case is the point.
 */
export function assessRisk(command: ParsedCommand, ruleSet: RuleSet = allRules): RiskAssessment {
  const matches = matchRules(command, ruleSet);

  if (matches.length === 0) {
    return {
      level: 'LOW',
      confidence: 100,
      effects: [],
      undoable: true,
    };
  }

  const highestSeverity = matches.reduce((worst, rule) =>
    LEVEL_RANK[rule.level] > LEVEL_RANK[worst.level] ? rule : worst,
  );

  return toAssessment(highestSeverity);
}

/**
 * Looks up a rule by id — used by `inode check --explain` to show why a
 * command was flagged, after the fact (RiskAssessment only carries the
 * id, not the full rule, to keep that type small and serializable).
 */
export function getRuleById(id: string, ruleSet: RuleSet = allRules): Rule | undefined {
  return ruleSet.find((rule) => rule.id === id);
}

export { matchRules, evaluateRule } from './matcher';
export { describeRule, describeCondition } from './describe';
export type { Rule, RuleCondition, RuleSet } from './types';

import type { ParsedCommand } from '@tra/shared';
import type { Rule, RuleCondition, RuleSet } from './types';

function evaluateCondition(condition: RuleCondition, command: ParsedCommand): boolean {
  const { field, operator, value } = condition;

  if (field === 'command' || field === 'subcommand') {
    const fieldValue = command[field];

    if (operator === 'equals') {
      if (typeof value !== 'string') return false;
      return fieldValue === value;
    }

    if (operator === 'matches') {
      if (typeof value !== 'string' || fieldValue === null) return false;
      return new RegExp(value).test(fieldValue);
    }

    // includes / includesAny don't apply to scalar fields.
    return false;
  }

  // field is 'flags' or 'args' — both are string arrays.
  const items = command[field];

  if (operator === 'includes') {
    if (typeof value !== 'string') return false;
    return items.includes(value);
  }

  if (operator === 'includesAny') {
    if (!Array.isArray(value)) return false;
    return items.some((item) => value.includes(item));
  }

  if (operator === 'matches') {
    if (typeof value !== 'string') return false;
    const pattern = new RegExp(value);
    return items.some((item) => pattern.test(item));
  }

  return false;
}

/** A rule fires only if every one of its conditions matches (logical AND). */
export function evaluateRule(rule: Rule, command: ParsedCommand): boolean {
  return rule.conditions.every((condition) => evaluateCondition(condition, command));
}

/**
 * Evaluates a command against a rule set and returns every rule that
 * matches, in the order they appear in the rule set. Rule sets should be
 * ordered most-specific-first (e.g. "force-push-with-lease" before the
 * generic "force-push" rule would be wrong the other way around) — since
 * both conditions are equally specific here they simply don't overlap.
 */
export function matchRules(command: ParsedCommand, ruleSet: RuleSet): Rule[] {
  return ruleSet.filter((rule) => evaluateRule(rule, command));
}

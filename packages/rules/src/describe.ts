import type { Rule, RuleCondition } from './types';

function formatValue(value: string | string[]): string {
  return Array.isArray(value) ? value.map((v) => `"${v}"`).join(', ') : `"${value}"`;
}

/** Renders one condition as a plain-English sentence fragment. */
export function describeCondition(condition: RuleCondition): string {
  const { field, operator, value } = condition;

  switch (operator) {
    case 'equals':
      return `${field} equals ${formatValue(value)}`;
    case 'includes':
      return `${field} includes ${formatValue(value)}`;
    case 'includesAny':
      return `${field} includes any of: ${formatValue(value)}`;
    case 'matches':
      return `${field} matches the pattern ${formatValue(value)}`;
    default:
      return `${field} ${operator} ${formatValue(value)}`;
  }
}

/**
 * Renders a full explanation of why a rule fired: its name, followed by
 * every condition that had to be true (rules are AND — all conditions
 * matched, not just one). Used by `inode check --explain`.
 */
export function describeRule(rule: Rule): string[] {
  const lines = [
    `Rule "${rule.id}" — ${rule.name}`,
    'Matched because all of the following were true:',
  ];
  for (const condition of rule.conditions) {
    lines.push(`  • ${describeCondition(condition)}`);
  }
  return lines;
}

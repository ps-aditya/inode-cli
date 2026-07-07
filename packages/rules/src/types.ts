import type { RiskLevel } from '@tra/shared';

/**
 * A single condition a rule checks against a ParsedCommand.
 * Deliberately tiny and declarative — no arbitrary code in rule files,
 * so rules stay auditable, fast, and safe to accept from contributors.
 */
export interface RuleCondition {
  /** Which field of the ParsedCommand to inspect. */
  field: 'command' | 'subcommand' | 'flags' | 'args';
  /** How to compare it. */
  operator: 'equals' | 'includes' | 'includesAny' | 'matches';
  /** The value(s) to compare against. */
  value: string | string[];
}

export interface Rule {
  /** Unique, stable id — referenced in RiskAssessment.matchedRule and in issue reports. */
  id: string;
  /** Human-readable name shown with --explain. */
  name: string;
  /** All conditions must match (AND) for the rule to fire. */
  conditions: RuleCondition[];
  level: RiskLevel;
  /** 0-100 base confidence before any context adjustment (Sprint 3/4). */
  confidence: number;
  /** Plain-language effects this command has, in order of importance. */
  effects: string[];
  undoable: boolean;
  undoHint?: string;
}

/** The shape of a rules JSON file: a flat list of rules, evaluated in order. */
export type RuleSet = Rule[];

export function isCommandField(field: RuleCondition['field']): field is 'command' | 'subcommand' {
  return field === 'command' || field === 'subcommand';
}

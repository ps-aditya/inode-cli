/**
 * Branch names/patterns considered "protected" for risk purposes.
 * Deliberately a plain list, not a call to the GitHub/GitLab API — most
 * teams don't want a network call just to check a branch name, and this
 * covers the overwhelming majority of real-world setups.
 */
const PROTECTED_BRANCH_NAMES = new Set(['main', 'master', 'production', 'prod']);
const PROTECTED_BRANCH_PATTERNS = [/^release\//, /^hotfix\//];

export function isProtectedBranchName(branch: string): boolean {
  if (PROTECTED_BRANCH_NAMES.has(branch)) return true;
  return PROTECTED_BRANCH_PATTERNS.some((pattern) => pattern.test(branch));
}

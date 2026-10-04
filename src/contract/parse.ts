import { ActivityDocumentSchema, type ActivityDocument } from './schema';

export type ContractIssue = { path: string; message: string };

export class ContractValidationError extends Error {
  readonly issues: ContractIssue[];

  constructor(issues: ContractIssue[]) {
    super(`Invalid activity document:\n${issues.map((issue) => `  ${issue.path}: ${issue.message}`).join('\n')}`);
    this.name = 'ContractValidationError';
    this.issues = issues;
  }
}

/**
 * Validates an untrusted value against the v0 activity contract and returns a sanitized copy.
 * Unknown fields are dropped. Throws `ContractValidationError` listing every field-level issue.
 */
export function parseActivityDocument(value: unknown): ActivityDocument {
  const result = ActivityDocumentSchema.safeParse(value);
  if (result.success) return result.data;
  throw new ContractValidationError(
    result.error.issues.map((issue) => ({
      path: issue.path.length ? issue.path.map(String).join('.') : '(root)',
      message: issue.message,
    })),
  );
}

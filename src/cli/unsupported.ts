import type { ValidationIssue } from "@/contracts";

const UNSUPPORTED_KEYS = new Set([
  "poll",
  "polls",
  "pollId",
  "miniApp",
  "miniApps",
  "mini-app",
  "mini-apps",
  "photon",
  "spectrum",
]);

const UNSUPPORTED_KINDS = new Set(["poll", "mini-app", "photon"]);

export function findUnsupported(value: unknown, path = "$"): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  visit(value, path, issues);
  return issues;
}

function visit(value: unknown, path: string, issues: ValidationIssue[]): void {
  if (Array.isArray(value)) {
    value.forEach((item, index) => visit(item, `${path}[${index}]`, issues));
    return;
  }
  if (!value || typeof value !== "object") return;
  const record = value as Record<string, unknown>;
  for (const [key, nested] of Object.entries(record)) {
    if (UNSUPPORTED_KEYS.has(key)) {
      issues.push({
        path: path === "$" ? key : `${path}.${key}`,
        message: `Unsupported feature "${key}". Do not translate polls or mini apps into text.`,
      });
    }
    if ((key === "kind" || key === "type") && typeof nested === "string" && UNSUPPORTED_KINDS.has(nested)) {
      issues.push({
        path: path === "$" ? key : `${path}.${key}`,
        message: `Unsupported ${key} "${nested}". Leave the human copy unchanged and stop.`,
      });
    }
    visit(nested, path === "$" ? key : `${path}.${key}`, issues);
  }
}

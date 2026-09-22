import type { ValidationIssue } from "@/contracts";

export function pointer(segments: Array<string | number>): string {
  const encoded = segments.map((segment) =>
    String(segment).replaceAll("~", "~0").replaceAll("/", "~1"),
  );
  return `/${encoded.join("/")}`;
}

export function issue(path: string, code: string, detail: string): ValidationIssue {
  return { path, message: `${code}: ${detail}` };
}

export function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

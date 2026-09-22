import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { validateDemoDouble } from "../contracts/doubles";
import { diagnoseDemo } from "../fixtures/diagnose-demo";

const dir = path.dirname(fileURLToPath(import.meta.url));

type NegativeCase = {
  id: string;
  silentOnFrozenDouble: boolean;
  input: unknown;
  issues: Array<{ path: string; message: string }>;
};

const cases = readdirSync(dir)
  .filter((file) => file.endsWith(".json"))
  .sort()
  .map((file) => JSON.parse(readFileSync(path.join(dir, file), "utf8")) as NegativeCase);

describe("negative fixtures", () => {
  it("covers the required rejection families", () => {
    expect(cases.map((item) => item.id)).toEqual([
      "all-platform-screen",
      "animated-gif",
      "animated-mp4",
      "attachment-download",
      "duplicate-id",
      "edit-removal-final",
      "group-chat",
      "invalid-id",
      "invalid-order",
      "invalid-reply-removal",
      "invalid-timestamp",
      "link-unfurl",
      "macos-list-screen",
      "mini-apps",
      "missing-asset",
      "negative-timestamp",
      "overlapping-arrivals",
      "path-escape",
      "polls",
      "reactions",
      "remote-asset",
      "screen-effect-as-bubble",
      "unknown-kind",
      "unsupported-platform",
    ]);
  });

  it("names a JSON path on every case and does not match a silent skip", () => {
    for (const item of cases) {
      expect(item.issues.length, item.id).toBeGreaterThan(0);
      for (const issue of item.issues) expect(issue.path.length, item.id).toBeGreaterThan(0);
      expect(diagnoseDemo(item.input), item.id).toEqual(item.issues);
      const doubled = validateDemoDouble(item.input);
      expect(doubled.ok, item.id).toBe(item.silentOnFrozenDouble);
    }
  });
});

import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "@playwright/test";
import { installObservers, openFlow } from "./harness";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

test("an agent validates, compiles, and captures a new supported flow without editing app code", async ({ page }) => {
  const flow = {
    id: "agent-authored-check-in",
    title: "Agent authored check-in",
    platform: "ios" as const,
    theme: "light" as const,
    contact: { name: "Alex Morgan", initials: "AM" },
    nowMs: Date.parse("2026-09-21T16:41:00.000Z"),
    draft: "On my way.",
    typing: false,
    screen: "conversation" as const,
    messages: [
      {
        id: "agent-authored-check-in-m01",
        text: "Save me a seat.",
        direction: "incoming" as const,
        atMs: Date.parse("2026-09-21T16:39:00.000Z"),
        status: "read" as const,
      },
      {
        id: "agent-authored-check-in-m02",
        text: "Walking over.",
        direction: "outgoing" as const,
        atMs: Date.parse("2026-09-21T16:40:00.000Z"),
        status: "delivered" as const,
      },
    ],
  };
  const directory = mkdtempSync(path.join(tmpdir(), "imessage-agent-"));
  const file = path.join(directory, "flow.json");
  writeFileSync(file, JSON.stringify(flow));
  const authored = JSON.parse(readFileSync(file, "utf8")) as typeof flow;
  const validated = spawnSync("npx", ["tsx", "src/cli/main.ts", "validate", file, "--json"], { cwd: root, encoding: "utf8" });
  expect(validated.status).toBe(0);
  const compiled = spawnSync("npx", ["tsx", "src/cli/main.ts", "compile", file, "--json", "--out", directory], {
    cwd: root,
    encoding: "utf8",
  });
  expect(compiled.status).toBe(0);
  const artifact = JSON.parse(readFileSync(path.join(directory, `${flow.id}.json`), "utf8")) as {
    compiled: { id: string; events: Array<{ type: string; message?: { text: string } }> };
  };
  expect(artifact.compiled.id).toBe(flow.id);
  expect(artifact.compiled.events.some((event) => event.type === "message" && event.message?.text === "Walking over.")).toBe(true);
  const observers = await installObservers(page);
  const duration = artifact.compiled.events.reduce((max, event) => Math.max(max, "atMs" in event ? Number((event as { atMs: number }).atMs) : 0), 0);
  const shell = await openFlow(page, authored, duration);
  await expect(page.locator('[data-message-id="agent-authored-check-in-m01"]').getByText("Save me a seat.")).toBeVisible();
  await expect(page.locator('[data-message-id="agent-authored-check-in-m02"]').getByText("Walking over.").first()).toBeVisible();
  await expect(shell).toBeVisible();
  expect(observers.pageErrors).toEqual([]);
  expect(observers.consoleErrors).toEqual([]);
  expect(observers.external).toEqual([]);
});

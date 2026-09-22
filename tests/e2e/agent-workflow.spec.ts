import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { expect, test } from "@playwright/test";
import { compileDemo, validateDemo } from "@/compiler";
import { installObservers, openFlow } from "./harness";

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
  const validated = validateDemo(authored);
  expect(validated.ok).toBe(true);
  if (!validated.ok) return;
  const compiled = compileDemo(validated.demo);
  expect(compiled.id).toBe(flow.id);
  expect(compiled.events.some((event) => event.type === "message" && event.message.text === "Walking over.")).toBe(true);
  const observers = await installObservers(page);
  const shell = await openFlow(page, authored, compiled.durationMs);
  await expect(page.getByText("Save me a seat.")).toBeVisible();
  await expect(page.getByText("Walking over.")).toBeVisible();
  await expect(shell).toBeVisible();
  expect(observers.pageErrors).toEqual([]);
  expect(observers.consoleErrors).toEqual([]);
  expect(observers.external).toEqual([]);
});

import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { authoringDocumentSchema } from "@/cli/authoring";
import { runCli } from "@/cli/run";
import { compileDemo, validateDemo } from "@/compiler";
import { contactSchema } from "@/contracts";
import { frameAt } from "@/runtime";
import { makeDeps, parseStdoutJson } from "../cli/helpers";

const photo = "/demo-assets/sunday/avatar.png";
const contact = { name: "Memo · Sunday", initials: "S", photo };
const flow = (avatar: unknown = photo) => ({
  id: "contact-photo-test", title: "Contact artwork", platform: "ios", theme: "light",
  contact: { ...contact, photo: avatar },
  nowMs: 1790452860000, draft: "", typing: false, screen: "conversation",
  messages: [{ id: "m1", text: "Ready to help.", direction: "incoming", atMs: 1790452800000 }],
});

describe("contact avatar assets", () => {
  it("preserves a local avatar through validation, compilation, and runtime projection", () => {
    const authored = authoringDocumentSchema.parse(flow());
    expect(authored.contact).toEqual(contact);
    const result = validateDemo(authored);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.demo.contact).toEqual(contact);
    const compiled = compileDemo(result.demo);
    for (const atMs of [0, compiled.durationMs]) {
      expect(frameAt(compiled, atMs).contact).toEqual(contact);
      expect(frameAt(compiled, atMs).conversations[0].contact).toEqual(contact);
    }
  });

  it("preserves artwork in authored conversation seeds through compilation", () => {
    const next = { ...contact, name: "Sunday support" };
    const result = validateDemo({
      ...flow(),
      conversations: [{ id: "support", contact: next }],
      events: [{ type: "select-conversation", atMs: 1790452801000, conversationId: "support" }],
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(compileDemo(result.demo).conversations?.find((item) => item.id === "support")?.contact).toEqual(next);
  });

  it.each([
    "https://example.com/avatar.png",
    "//example.com/avatar.png",
    "file:///tmp/avatar.png",
    "/demo-assets/../avatar.png",
    "/demo-assets/%2e%2e/avatar.png",
    "/demo-assets/sunday/official-mark.svg",
    "/demo-assets/avatar.mp4",
    "data:image/png;base64,AA==",
  ])("CLI preflight rejects unsafe or unsupported photo %s", async (value) => {
    // The native photo contract accepts URL strings; the render-only CLI owns asset policy.
    expect(contactSchema.safeParse({ ...contact, photo: value }).success).toBe(true);
    const dir = mkdtempSync(path.join(os.tmpdir(), "contact-photo-policy-"));
    try {
      const file = path.join(dir, "flow.json");
      writeFileSync(file, JSON.stringify(flow(value)));
      const { deps, io } = makeDeps({ validateDemo, compileDemo });
      expect(await runCli(["validate", file, "--json"], deps)).toBe(3);
      expect(parseStdoutJson(io.stdout())).toMatchObject({ ok: false, exitCode: 3 });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("retains initials-only contacts without adding an avatar", () => {
    const input = { ...flow(), contact: { name: "Memo", initials: "M" } };
    const result = validateDemo(input);
    expect(result.ok).toBe(true);
    if (result.ok) expect(frameAt(compileDemo(result.demo), 0).contact).toEqual(input.contact);
  });

  it("CLI preflight accepts the artwork and reports a missing avatar as an asset failure", async () => {
    const dir = mkdtempSync(path.join(os.tmpdir(), "contact-photo-"));
    try {
      for (const [src, code] of [[photo, 0], ["/demo-assets/sunday/missing-avatar-test.png", 3]] as const) {
        const file = path.join(dir, "flow.json");
        writeFileSync(file, JSON.stringify(flow(src)));
        const { deps, io } = makeDeps({ validateDemo, compileDemo });
        expect(await runCli(["validate", file, "--json"], deps)).toBe(code);
        const output = parseStdoutJson(io.stdout());
        expect(output).toMatchObject({ ok: code === 0 });
        if (code === 3) expect(JSON.stringify(output)).toContain("Missing asset");
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("CLI preflight also checks contact photos in conversation seeds", async () => {
    const dir = mkdtempSync(path.join(os.tmpdir(), "contact-photo-seed-"));
    try {
      const file = path.join(dir, "flow.json");
      writeFileSync(file, JSON.stringify({
        ...flow(),
        conversations: [{ id: "support", contact: { name: "Sunday support", photo: "/demo-assets/sunday/missing-seed-photo.png" } }],
      }));
      const { deps, io } = makeDeps({ validateDemo, compileDemo });
      expect(await runCli(["validate", file, "--json"], deps)).toBe(3);
      expect(JSON.stringify(parseStdoutJson(io.stdout()))).toContain("missing-seed-photo.png");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

import { mkdtempSync, writeFileSync, rmSync, readdirSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { checkCompanyAuthoring, companyReviewSchema, type CompanyReview } from "@/cli/company-review";
import { authoringDocumentSchema } from "@/cli/authoring";
import { parseArgs } from "@/cli/args";
import { loadDeps } from "@/cli/deps";
import { runCli } from "@/cli/run";
import { captureIo } from "./helpers";

const root = process.cwd();
const dirs: string[] = [];
afterEach(() => { for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true }); });
// Synthetic policy fixtures; this source URL is not provenance for the borrowed test asset.
const review = (): CompanyReview => ({ flowId: "company-test", avatar: { source: "https://company.example/logo.svg" } });
const flow = () => authoringDocumentSchema.parse({
  id: "company-test", title: "Synthetic company review", platform: "ios", theme: "light",
  contact: { name: "Example Company", initials: "EC", photo: "/demo-assets/sunday/avatar.png" },
  nowMs: 102000, startAtMs: 100000, draft: "", typing: false, screen: "conversation",
  messages: [
    { id: "out", text: "Follow up", direction: "outgoing", status: "delivered", atMs: 100000 },
    { id: "in", text: "Confirmed", direction: "incoming", atMs: 101500 },
  ],
  events: [{ type: "status", messageId: "out", status: "read", atMs: 100900 }],
});
const check = (document = flow(), policy = review()) => checkCompanyAuthoring(document, policy, root);

describe("company authoring policy", () => {
  it("accepts a square local avatar and timed outgoing receipt without requiring polls or images", () => {
    expect(check()).toEqual([]);
  });
  it("blocks initials-only contact even though generic validation allows it", () => {
    const document = flow(); delete document.contact.photo;
    expect(check(document)).toEqual([expect.objectContaining({ path: "/contact/photo" })]);
  });
  it("blocks nonsquare avatars and non-HTTP logo sources", () => {
    const document = flow(); document.contact.photo = "/demo-assets/sheet-museum/collection.png";
    expect(check(document)[0].message).toContain("square");
    const policy = review(); policy.avatar = { source: "file:///logo.png" };
    expect(check(flow(), policy)[0].path).toContain("source");
  });
  it("incoming Read status cannot satisfy an outgoing receipt", () => {
    const document = flow(); document.events = []; document.messages[1].status = "read";
    expect(check(document)[0].message).toContain("Delivered → Read");
  });
  it.each([100000, 101500, 101700])("rejects a read at %i that cannot show the transition before the reply", atMs => {
    const document = flow(); document.events![0].atMs = atMs;
    expect(check(document)).not.toEqual([]);
  });
  it("rejects initially Read and a regression before the reply", () => {
    const document = flow(); document.messages[0].status = "read";
    expect(check(document)).not.toEqual([]);
    const regression = flow(); regression.events!.push({ type: "status", messageId: "out", status: "delivered", atMs: 101000 });
    expect(check(regression)).not.toEqual([]);
  });
  it("rejects a response concurrent with delivery", () => {
    const document = flow(); document.messages[1].atMs = document.messages[0].atMs;
    expect(check(document)).not.toEqual([]);
  });
  it("supports explicit delivered progression and a final outgoing receipt", () => {
    const document = flow(); document.messages[0].status = "sent";
    document.events!.push({ type: "status", messageId: "out", status: "delivered", atMs: 100100 });
    document.messages.pop(); expect(check(document)).toEqual([]);
  });
  it("checks each outgoing text before a newer outgoing text hides its receipt", () => {
    const document = flow(); document.messages.splice(1, 0, { id: "out2", text: "More context", direction: "outgoing", status: "delivered", atMs: 100500 });
    expect(check(document)).toHaveLength(2);
  });
  it("does not impose Read on SMS", () => {
    const document = flow(); document.messages[0].service = "sms"; document.events = [];
    expect(check(document)).toEqual([]);
  });
  it("requires the matching flow and distinct outgoing exception targets", () => {
    expect(check(flow(), { ...review(), flowId: "other" })).not.toEqual([]);
    for (const messageId of ["in", "missing"]) {
      expect(check(flow(), { ...review(), receiptExceptions: [{ messageId, basis: "user-request", reason: "Synthetic override", evidence: "Synthetic user quote" }] })).not.toEqual([]);
    }
    const item = { messageId: "out", basis: "preserve-transcript" as const, reason: "Synthetic supplied transcript", evidence: "Synthetic transcript ends at Delivered" };
    expect(check(flow(), { ...review(), receiptExceptions: [item, item] })).not.toEqual([]);
  });
  it("allows evidenced initials and exact transcript exceptions without rewriting the flow", () => {
    const document = flow(); delete document.contact.photo; document.events = [];
    const original = structuredClone(document);
    expect(check(document, { flowId: document.id,
      avatar: { exception: "user-request", reason: "Synthetic initials request", evidence: "Synthetic user quote" },
      receiptExceptions: [{ messageId: "out", basis: "preserve-transcript", reason: "Preserve synthetic receipt", evidence: "Synthetic supplied transcript" }],
    })).toEqual([]);
    expect(document).toEqual(original);
    expect(companyReviewSchema.safeParse({ flowId: document.id, avatar: { exception: "unavailable", reason: "", evidence: "" } }).success).toBe(false);
  });
});

describe("CLI company preflight", () => {
  async function setup(withPhoto: boolean) {
    const dir = mkdtempSync(path.join(os.tmpdir(), "company-review-")); dirs.push(dir);
    const document = flow(); if (!withPhoto) delete document.contact.photo;
    const file = path.join(dir, "flow.json"), policy = path.join(dir, "review.json");
    writeFileSync(file, JSON.stringify(document)); writeFileSync(policy, JSON.stringify(review()));
    const io = captureIo(); const startPreviewServer = vi.fn(), runCaptureEngine = vi.fn();
    const deps = await loadDeps({ io: io.io, startPreviewServer, runCaptureEngine });
    return { dir, file, policy, io, deps, startPreviewServer, runCaptureEngine };
  }
  it("retains generic validation and passes valid reviewed authoring through the real compiler", async () => {
    const s = await setup(false);
    expect(await runCli(["validate", s.file, "--json"], s.deps)).toBe(0);
    expect(await runCli(["validate", s.file, "--company-review", s.policy, "--json"], s.deps)).toBe(2);
    const good = await setup(true);
    expect(await runCli(["compile", good.file, "--company-review", good.policy, "--out", good.dir, "--json"], good.deps)).toBe(0);
    expect(readdirSync(good.dir)).toContain("company-test.json");
  });
  it.each(["compile", "preview", "capture"])("blocks %s before compiled artifacts, server startup, or capture", async command => {
    const s = await setup(false);
    expect(await runCli([command, s.file, "--company-review", s.policy, "--out", path.join(s.dir, "output"), "--json"], s.deps)).toBe(2);
    const entries = readdirSync(s.dir);
    expect(entries.filter(entry => entry !== "output").sort()).toEqual(["flow.json", "review.json"]);
    if (entries.includes("output")) expect(readdirSync(path.join(s.dir, "output"))).toEqual([]);
    expect(s.startPreviewServer).not.toHaveBeenCalled(); expect(s.runCaptureEngine).not.toHaveBeenCalled();
  });
  it("reports missing/malformed review files and rejects unrelated command scopes", async () => {
    const s = await setup(true);
    expect(await runCli(["validate", s.file, "--company-review", s.policy + ".missing", "--json"], s.deps)).toBe(3);
    writeFileSync(s.policy, "{}");
    expect(await runCli(["validate", s.file, "--company-review", s.policy, "--json"], s.deps)).toBe(2);
    expect(() => parseArgs(["generate", s.file, "--company-review", s.policy])).toThrow(/applies to/);
    expect(() => parseArgs(["preview", "--catalogue", "--company-review", s.policy])).toThrow(/applies to/);
  });
});

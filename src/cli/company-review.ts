import { readFileSync } from "node:fs";
import { z } from "zod";
import type { AuthoringDocument } from "./authoring";
import type { ValidationIssue } from "@/contracts";
import { CliError, EXIT_ENVIRONMENT, EXIT_VALIDATION } from "./errors";
import { inspectAsset } from "./preflight";

const nonBlank = z.string().trim().min(1);
const exception = z.object({ reason: nonBlank, evidence: nonBlank }).strict();
/** Separate authoring policy; neither the flow contract nor generic fixtures change. */
export const companyReviewSchema = z.object({
  flowId: nonBlank,
  avatar: z.union([
    z.object({ source: z.string().url() }).strict(),
    exception.extend({ exception: z.enum(["user-request", "unavailable"]) }).strict(),
  ]),
  receiptExceptions: z.array(exception.extend({
    messageId: nonBlank,
    basis: z.enum(["user-request", "preserve-transcript"]),
  }).strict()).optional(),
}).strict();
export type CompanyReview = z.infer<typeof companyReviewSchema>;

export function loadCompanyReview(file: string): CompanyReview {
  let text: string;
  try { text = readFileSync(file, "utf8"); }
  catch { throw new CliError(`Company review file could not be read: ${file}`, EXIT_ENVIRONMENT); }
  try { return companyReviewSchema.parse(JSON.parse(text)); }
  catch { throw new CliError("Company review must match the documented review format", EXIT_VALIDATION); }
}

export function checkCompanyAuthoring(document: AuthoringDocument, review: CompanyReview, repoRoot: string): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const issue = (path: string, message: string) => issues.push({ path, message });
  if (review.flowId !== document.id) issue("/companyReview/flowId", "Review belongs to another flow");
  if ("source" in review.avatar) {
    if (!/^https?:\/\//i.test(review.avatar.source)) issue("/companyReview/avatar/source", "Record the official HTTP(S) logo source");
    if (!document.contact.photo) issue("/contact/photo", "Company avatar is missing; wire the official logo through contact.photo");
    else {
      const asset = inspectAsset(document.contact.photo, repoRoot);
      if (asset.width <= 0 || asset.height <= 0 || asset.width !== asset.height) issue("/contact/photo", "Company avatar must be a square raster asset");
    }
  }

  const messages = [...document.messages].sort((a, b) => a.atMs - b.atMs);
  const outgoing = messages.filter(message => message.direction === "outgoing" &&
    (message.kind ?? "text") === "text" && message.service !== "sms" && !message.removed);
  const exceptions = new Set<string>();
  for (const [index, item] of (review.receiptExceptions ?? []).entries()) {
    if (exceptions.has(item.messageId) || !outgoing.some(message => message.id === item.messageId)) {
      issue(`/companyReview/receiptExceptions/${index}/messageId`, "Receipt exception must name one distinct outgoing iMessage text");
    }
    exceptions.add(item.messageId);
  }
  for (const message of outgoing) {
    if (exceptions.has(message.id)) continue;
    const conversation = message.conversationId;
    // The default precedes the reply; a newer outgoing receipt can replace this label.
    const boundary = messages.find(next => next !== message && next.atMs >= message.atMs && next.conversationId === conversation &&
      (next.kind ?? "text") === "text")?.atMs ?? Infinity;
    let deliveredAt = message.status === "delivered" ? message.atMs : undefined;
    let transitioned = false;
    let status = message.status;
    const events = (document.events ?? []).filter(event => event.type === "status" && event.messageId === message.id)
      .sort((a, b) => a.atMs - b.atMs);
    for (const event of events) {
      if (event.type !== "status" || event.atMs < message.atMs || event.atMs >= boundary) continue;
      if (event.status === "delivered") deliveredAt = event.atMs;
      if (event.status === "read" && deliveredAt !== undefined && event.atMs > deliveredAt) transitioned = true;
      status = event.status;
    }
    if (!transitioned || status !== "read") issue(`/messages/${document.messages.indexOf(message)}/status`,
      `Outgoing message ${message.id} needs a visible Delivered → Read status event before the next text; incoming read status does not satisfy this`);
  }
  return issues;
}

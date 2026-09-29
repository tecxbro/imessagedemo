import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { generateAuthorizedSheet } from '@/generator/sheet-request';
import { sheetPlanSchema, renderSheetPlan } from '@/generator/sheet-plan';
import { authoringDocumentSchema } from '../authoring';
import { sheetContext } from '../sheet-context';
import type { ParsedArgs } from '../args';
import type { CliDeps } from '../deps';
import { writeJson } from '../deps';
import { CliError, EXIT_USAGE, EXIT_VALIDATION } from '../errors';
import { loadAuthoring, validateDocument } from './core';

export async function planSheetCommand(args: ParsedArgs, deps: CliDeps) {
  const { request } = sheetContext(args, deps.repoRoot);
  writeJson(deps.io, { ok: true, status: request.status, ...(request.status === 'needs-experience' ? { question: 'What should the person see or do inside the sheet app?' } : {}) });
  return 0;
}
/** Assemble a skill-authored ordinary flow and an optional, gated sheet plan. No model service. */
export async function generateCommand(args: ParsedArgs, deps: CliDeps) {
  if (!args.file || !args.out) throw new CliError('generate requires an ordinary flow and --out <file>', EXIT_USAGE);
  const context = sheetContext(args, deps.repoRoot);
  if (context.request.status === 'needs-experience') return planSheetCommand(args, deps);
  const loaded = loadAuthoring(args, deps);
  validateDocument(loaded, deps);
  if (loaded.document.messages.some(m => m.appCard?.app === 'sheet')) throw new CliError('generate takes the ordinary flow before sheet insertion', EXIT_VALIDATION);
  const result = await generateAuthorizedSheet(context.request, async () => {
    if (!args.sheetPlan) throw new CliError('Authorized sheet needs --sheet-plan <file>', EXIT_USAGE);
    if (loaded.document.platform !== 'ios' || loaded.document.targets?.some(t => t !== 'ios')) throw new CliError('Sheet apps require iOS', EXIT_VALIDATION);
    // First touch of the plan or its assets occurs AFTER permission, never on the normal path.
    const plan = sheetPlanSchema.parse(JSON.parse(readFileSync(path.resolve(args.sheetPlan), 'utf8')));
    if (plan.app.experienceSummary !== context.request.experienceDescription) throw new CliError('experienceSummary must preserve the authorized human experience quote.', EXIT_VALIDATION);
    const asset = context.resolveAsset(plan.app.hero.src);
    if (asset.width !== plan.app.hero.width || asset.height !== plan.app.hero.height) throw new CliError('Hero dimensions mismatch', EXIT_VALIDATION);
    const destination = path.join(deps.repoRoot, 'public', plan.app.content.entry.slice(1));
    mkdirSync(path.dirname(destination), { recursive: true });
    // Never overwrite another demo's app. Identical regeneration is safe and deterministic.
    const html = renderSheetPlan(plan);
    try { writeFileSync(destination, html, { flag: 'wx' }); }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== 'EEXIST' || readFileSync(destination, 'utf8') !== html) throw error; }
    return plan.app;
  }, context);
  const document = structuredClone(loaded.document);
  if (result.app) {
    document.id = result.app.id;
    if (document.platform !== 'ios' || document.targets?.some(t => t !== 'ios')) throw new CliError('Sheet apps require iOS', EXIT_VALIDATION);
    const atMs = Math.max(0, ...document.messages.map(m => m.atMs), ...(document.events ?? []).map(e => e.atMs)) + 1000;
    document.messages.push({ id: result.app.id, text: result.app.title, direction: 'incoming', atMs, kind: 'app-card', appCard: { app: 'sheet', live: true, url: result.app.content.entry, sheet: result.app } });
  }
  const output = { ...loaded, document: authoringDocumentSchema.parse(document), context };
  validateDocument(output, deps);
  const destination = path.resolve(args.out);
  mkdirSync(path.dirname(destination), { recursive: true });
  writeFileSync(destination, JSON.stringify(document, null, 2) + '\n', { flag: 'wx' });
  writeJson(deps.io, { ok: true, status: result.status, file: destination, sheetCount: result.app ? 1 : 0, sheetAssetsGenerated: 0, sheetContentGenerated: result.app ? 1 : 0, sheetEventsInserted: 0 });
  return 0;
}

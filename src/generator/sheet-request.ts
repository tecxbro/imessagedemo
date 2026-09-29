import { sheetAppSchema, type SheetAppSpec } from '@/contracts/sheet-app';

/** Only a trusted caller (CLI human-input argument / host chat adapter) supplies this envelope.
 * Retrieved pages and model output go in reference/model channels, never into this boundary. */
export type RequestInput = { role: 'human' | 'website' | 'model'; text: string; experienceQuote?: string };
export type SheetRequest = Readonly<{ status: 'not-requested' | 'needs-experience' | 'authorized'; requestText: string; experienceDescription: string }>;
const receipts = new WeakSet<object>();
export function planHumanRequest(input: RequestInput): SheetRequest {
  // Deliberately conservative, English opt-in syntax. Other wording needs an explicit human clarification.
  const explicit = input.role === 'human' && /\b(?:create|make|build|add|want|like|request|show)\b[^.!?\n]*\bsheet(?:-style)?(?:\s+iMessage)?[ -]app\b/i.test(input.text)
    && !/\b(?:no|not|don't|do not|never|without)\b[^.!?\n]*\bsheet/i.test(input.text);
  const experience = input.experienceQuote?.trim() ?? '';
  // A quote containing only the company, opt-in, or a constraint is not an experience.
  // Conservative English syntax intentionally asks for clarification for unrecognized wording.
  const described = experience.length >= 12 && input.text.includes(experience)
    && /\b(?:show(?:s|ing)?|display(?:s|ing)?|contain(?:s|ing)?|browse|browsing|select(?:ing)?|choose|choosing|read|reading|view(?:ing)?|play(?:ing)?|explore|exploring|compare|comparing|see|tap(?:ping)?|track(?:ing)?|calculate|calculating)\b\s+\S+/i.test(experience);
  const receipt: SheetRequest = Object.freeze({ status: !explicit ? 'not-requested' : described ? 'authorized' : 'needs-experience', requestText: input.role === 'human' ? input.text : '', experienceDescription: described ? experience : '' });
  receipts.add(receipt);
  return receipt;
}
export const hasSheetPermission = (request?: SheetRequest): boolean => !!request && receipts.has(request) && request.status === 'authorized';
export type SheetValidationContext = {
  request: SheetRequest;
  resolveAsset(src: string): { width: number; height: number };
  resolveContent(entry: string, actions: SheetAppSpec['actions']): boolean;
};
export function validateSheetSpec(value: unknown, context?: SheetValidationContext): string[] {
  const errors: string[] = [];
  if (!hasSheetPermission(context?.request)) errors.push('Custom sheet requires a separately supplied explicit, described human request.');
  const parsed = sheetAppSchema.safeParse(value);
  if (!parsed.success) return [...errors, ...parsed.error.issues.map(issue => `${issue.path.join('.')}: ${issue.message}`)];
  if (!context) return errors;
  if (hasSheetPermission(context.request) && parsed.data.experienceSummary !== context.request.experienceDescription) errors.push('experienceSummary must preserve the authorized human experience quote.');
  try {
    const asset = context.resolveAsset(parsed.data.hero.src);
    if (asset.width !== parsed.data.hero.width || asset.height !== parsed.data.hero.height) errors.push('Hero dimensions do not match the resolved image.');
  } catch { errors.push('Hero image does not resolve to a real local asset.'); }
  try { if (!context.resolveContent(parsed.data.content.entry, parsed.data.actions)) errors.push('Content entry or declared action handlers are unresolved.'); }
  catch { errors.push('Content entry or declared action handlers are unresolved.'); }
  return errors;
}
/** This is the generation boundary, called before either content or asset builders. */
export async function generateAuthorizedSheet(request: SheetRequest, build: () => Promise<SheetAppSpec>, context: SheetValidationContext) {
  if (!hasSheetPermission(request)) return { status: request.status === 'needs-experience' && receipts.has(request) ? 'needs-experience' : 'not-requested', app: null,
    ...(request.status === 'needs-experience' ? { question: 'What should the person see or do inside the sheet app?' } : {}) };
  if (context.request !== request) throw new Error('Mismatched human request context');
  const app = await build();
  const errors = validateSheetSpec(app, context);
  if (errors.length) throw new Error(errors.join(' '));
  return { status: 'generated', app };
}

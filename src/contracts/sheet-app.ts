import { z } from 'zod';
const text = z.string().trim().min(1);
export const sheetAppSchema = z.object({
  id: text.regex(/^[a-zA-Z0-9_-]+$/), companyName: text, title: text.max(100), description: text.max(400), experienceSummary: text,
  hero: z.object({ src: text.regex(/^\/demo-assets\/(?:[\w-]+\/)*[\w-]+\.(?:png|jpe?g|webp)$/), alt: text,
    width: z.number().int().positive(), height: z.number().int().positive() }).strict(),
  content: z.object({ entry: text.regex(/^\/demo-apps\/(?:[\w-]+\/)*[\w-]+\.html$/) }).strict(),
  actions: z.array(z.object({ id: text, label: text, kind: z.literal('local'), handler: text }).strict()).optional(),
}).strict().superRefine((value, ctx) => {
  const ids = new Set<string>();
  for (const [i, action] of (value.actions ?? []).entries()) {
    if (ids.has(action.id)) ctx.addIssue({ code: 'custom', path: ['actions', i, 'id'], message: 'Duplicate app action id' });
    ids.add(action.id);
  }
});
export type SheetAppSpec = z.infer<typeof sheetAppSchema>;

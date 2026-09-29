import { z } from 'zod';
import { sheetAppSchema } from '@/contracts/sheet-app';
const nonBlank = z.string().trim().min(1);
/** Data-driven local content is experience-specific. No action is inserted by the generator. */
export const sheetPlanSchema = z.object({
  app: sheetAppSchema,
  pages: z.array(z.object({ id: nonBlank, title: nonBlank, body: nonBlank }).strict()).min(1),
  destinations: z.record(z.string(), z.string()).optional(),
}).strict().superRefine((plan, ctx) => {
  const ids = new Set(plan.pages.map(page => page.id));
  if (ids.size !== plan.pages.length) ctx.addIssue({ code: 'custom', path: ['pages'], message: 'Duplicate page id' });
  for (const action of plan.app.actions ?? []) if (!ids.has(plan.destinations?.[action.handler] ?? '')) ctx.addIssue({ code: 'custom', path: ['destinations', action.handler], message: 'Every action must lead to a real page' });
});
export type SheetPlan = z.infer<typeof sheetPlanSchema>;
const escape = (value: string) => value.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
export function renderSheetPlan(plan: SheetPlan): string {
  const { app, pages } = sheetPlanSchema.parse(plan);
  const actions = app.actions ?? [];
  const manifest = JSON.stringify({ actions: actions.map(a => ({ id: a.id, handler: a.handler })), protocol: 1 }).replaceAll('<', '\\u003c');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(app.title)}</title>
<style>*{box-sizing:border-box}html,body{margin:0;height:100%;background:#fdfdfd;color:#272720;font-family:-apple-system,BlinkMacSystemFont,sans-serif}body{overflow:auto;overscroll-behavior:contain}header{padding:54px 25px 23px}small{letter-spacing:.14em;text-transform:uppercase;color:#777269;font-size:10px}h1{font:36px/1.1 Georgia,serif;letter-spacing:-.035em;margin:12px 0}header p{font-size:14px;line-height:1.5;color:#736e66;margin:0}img{display:block;width:100%;aspect-ratio:1.899;object-fit:cover}main{padding:16px 25px 50px}article{padding:14px 0;border-bottom:1px solid #e3ded7}article h2{font:24px Georgia,serif;margin:6px 0 12px}article p{line-height:1.65;font-size:14px;color:#6c685f}nav{display:flex;gap:8px;flex-wrap:wrap;padding-top:20px}button{border:1px solid #d9d3ca;border-radius:24px;background:#eee8df;color:#39342e;padding:11px 15px;font:500 13px -apple-system,sans-serif;cursor:pointer}button:focus-visible{outline:2px solid #007aff}body[data-presentation="compact"]{overflow:hidden;user-select:none}body[data-presentation="compact"] header{position:absolute;top:17%;left:20px;right:20px;padding:0;text-align:center}body[data-presentation="compact"] h1{font-size:clamp(20px,6vw,29px);margin:0}body[data-presentation="compact"] header p,body[data-presentation="compact"] small,body[data-presentation="compact"] main{display:none}body[data-presentation="compact"] img{position:absolute;top:35%;left:15%;width:70%;max-height:50%;object-fit:cover;border-radius:8px}output{display:block;color:#777;font-size:12px;padding:12px 0}</style></head><body>
<header><small>${escape(app.companyName)}</small><h1>${escape(app.title)}</h1><p>${escape(app.description)}</p></header>
<img src="${escape(app.hero.src)}" alt="${escape(app.hero.alt)}">
<main>${pages.map(page => `<article id="${escape(page.id)}" tabindex="-1"><h2>${escape(page.title)}</h2><p>${escape(page.body)}</p></article>`).join('')}
${actions.length ? `<nav aria-label="Collection">${actions.map(action => `<button data-sheet-action="${escape(action.id)}" data-handler="${escape(action.handler)}">${escape(action.label)}</button>`).join('')}</nav><output aria-live="polite"></output>` : ''}</main>
<script src="/demo-apps/sheet-host.js"></script>
<script type="application/json" id="sheet-app-manifest">${manifest}</script>
<script>
const destinations=${JSON.stringify(plan.destinations ?? {}).replaceAll('<','\\u003c')};
const articles=[...document.querySelectorAll('article')];
const notify=type=>parent.postMessage({type,version:1},'*');
for(const button of document.querySelectorAll('[data-sheet-action]')) button.addEventListener('click',()=>{
 const target=document.getElementById(destinations[button.dataset.handler]);
 if(!target)return; for(const article of articles)article.hidden=article!==target;
 document.querySelector('output').textContent='Viewing '+target.querySelector('h2').textContent;
 target.focus(); target.scrollIntoView({block:'nearest'});
});
// sheet-app:presentation and pointer handoff are owned by the shared sheet-host bridge.
window.addEventListener('keydown',event=>{if(event.key==='Escape')notify('sheet-app:close');});
Promise.all([...document.images].map(image=>image.decode())).then(()=>notify('sheet-app:ready'),()=>notify('sheet-app:error'));
</script></body></html>`;
}

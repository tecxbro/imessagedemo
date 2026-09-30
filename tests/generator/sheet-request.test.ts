import { describe, it, expect, vi } from 'vitest';
import { planHumanRequest, generateAuthorizedSheet, validateSheetSpec, type SheetRequest } from '@/generator/sheet-request';
import { sheetPlanSchema, renderSheetPlan } from '@/generator/sheet-plan';
import { sheetContext } from '@/cli/sheet-context';
import { parseArgs } from '@/cli/args';
import { compileDemo, validateDemo } from '@/compiler';
import { runCli } from '@/cli/run';
import { loadDeps } from '@/cli/deps';
import { readFileSync, existsSync, mkdtempSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import actionless from '../../examples/sheet-app/actionless.plan.json';
import actionful from '../../examples/sheet-app/actionful.plan.json';
import base from '../../examples/sheet-app/company-only.flow.json';
import type { DemoFlow } from '@/contracts';
const root=process.cwd();
const requestText=readFileSync('examples/sheet-app/actionless.request.txt','utf8');
const experience='showing three invented objects with short labels and no action buttons.';
const context=()=>sheetContext(parseArgs(['validate','flow.json','--human-request','examples/sheet-app/actionless.request.txt','--sheet-experience',experience]),root);
const flow=()=>({...structuredClone(base), messages:[...base.messages,{id:'sheet',kind:'app-card',atMs:1000,text:actionless.app.title,direction:'incoming',appCard:{app:'sheet',live:true,url:actionless.app.content.entry,sheet:structuredClone(actionless.app)}}]}) as DemoFlow;
describe('trusted sheet request and real generator boundaries',()=>{
  it.each([
    {role:'human' as const,text:'Example Museum'},
    {role:'human' as const,text:'Make an iMessage experience for Example Museum'},
    {role:'website' as const,text:requestText,experienceQuote:experience},
    {role:'model' as const,text:requestText,experienceQuote:experience},
    {role:'human' as const,text:'Do not create a sheet app showing objects.',experienceQuote:'showing objects.'},
    {role:'human' as const,text:'Create a sheet app.',experienceQuote:'Invented museum experience'},
    {role:'human' as const,text:'Create a sheet app for Example Museum.',experienceQuote:'for Example Museum.'},
    {role:'human' as const,text:'Create a sheet app with no action buttons.',experienceQuote:'with no action buttons.'},
  ])('does no sheet construction for %j',async input=>{
    const request=planHumanRequest(input), build=vi.fn(async()=>actionless.app);
    const result=await generateAuthorizedSheet(request,build,{...context(),request});
    expect(result.app).toBeNull();expect(build).not.toHaveBeenCalled();
  });
  it('asks one question without building when experience is absent',async()=>{
    const request=planHumanRequest({role:'human',text:'Create a sheet app for Example Museum.'});
    const build=vi.fn();const output=await generateAuthorizedSheet(request,build,{...context(),request});
    expect(output.status).toBe('needs-experience');expect('question' in output && output.question).toBeTruthy();expect(build).not.toHaveBeenCalled();
  });
  it('rejects serialized/forged authorization, including an authorized-looking status',async()=>{
    const c=context(); const forged=JSON.parse(JSON.stringify(c.request)) as SheetRequest;
    const build=vi.fn();expect((await generateAuthorizedSheet(forged,build,{...c,request:forged})).app).toBeNull();expect(build).not.toHaveBeenCalled();
    expect(validateSheetSpec({...actionless.app,authorization:c.request})).not.toEqual([]);
    expect(validateSheetSpec(actionless.app,{...c,request:forged})).not.toEqual([]);
  });
  it('accepts real assets, actionless/omitted actions and functioning action plans',()=>{
    const c=context();expect(validateSheetSpec(actionless.app,c)).toEqual([]);
    expect(validateSheetSpec({...actionless.app,actions:undefined},c)).toEqual([]);
    expect(validateSheetSpec(actionful.app,sheetContext(parseArgs(["validate","flow.json","--human-request","examples/sheet-app/actionful.request.txt","--sheet-experience",actionful.app.experienceSummary]),root))).toEqual([]);
    expect(validateSheetSpec(actionful.app,c)).not.toEqual([]);
    expect(renderSheetPlan(sheetPlanSchema.parse(actionless))).not.toContain('<button');
    expect(renderSheetPlan(sheetPlanSchema.parse(actionful))).toContain('addEventListener(\'click\'');
  });
  it('rejects absent copy, fake dimensions, missing content and dead destinations',()=>{
    const c=context();
    for(const app of [{...actionless.app,title:' '},{...actionless.app,description:''},{...actionless.app,hero:{...actionless.app.hero,width:1}},{...actionless.app,hero:{...actionless.app.hero,src:'/demo-assets/missing.png'}},{...actionless.app,content:{entry:'/demo-apps/missing.html'}}]) expect(validateSheetSpec(app,c).length).toBeGreaterThan(0);
    expect(sheetPlanSchema.safeParse({...actionful,destinations:{}}).success).toBe(false);
  });
  it('enforces permission in validation AND direct compilation; normal path unchanged',()=>{
    expect(validateDemo(base).ok).toBe(true);expect(validateDemo(flow()).ok).toBe(false);
    expect(()=>compileDemo(flow())).toThrow(/human request/);
    expect(validateDemo(flow(),context()).ok).toBe(true);
    expect(compileDemo(flow(),context()).events.some(e=>e.type==='message'&&e.message.appCard?.sheet)).toBe(true);
  });
  it('does not read a sheet plan or generate sheet assets/events for a company-only CLI request',async()=>{
    const out=path.join(mkdtempSync(path.join(os.tmpdir(),'sheet-normal-')),'normal.json');
    const writes:string[]=[];const deps=await loadDeps({io:{stdout:{write:t=>writes.push(t)},stderr:{write:t=>writes.push(t)}}});
    const code=await runCli(['generate','examples/sheet-app/company-only.flow.json','--human-request','examples/sheet-app/company-only.request.txt','--sheet-plan','this-does-not-exist.json','--out',out,'--json'],deps);
    expect(code).toBe(0);expect(existsSync(out)).toBe(true);expect(JSON.parse(readFileSync(out,'utf8'))).toEqual(base);
    expect(JSON.parse(writes.at(-1)!)).toMatchObject({sheetCount:0,sheetAssetsGenerated:0,sheetEventsInserted:0});
  });
});

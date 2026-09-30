import { test, expect, type Page, type TestInfo } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { playbackBarHeightPx } from '../../src/player/playback';
const root=process.cwd();
const quote={actionless:'showing three invented objects with short labels and no action buttons.',actionful:'where selecting one of three invented objects opens its details inside the app.'};
async function open(page:Page,info:TestInfo,mode:'actionful'|'actionless'='actionful',change?:(flow:any)=>void){
 page.on('pageerror',error=>console.error('SHEET PAGE ERROR',error.message));
 const dir=info.outputPath('compiled');mkdirSync(dir,{recursive:true});
 const flow=JSON.parse(readFileSync(`examples/sheet-app/${mode}.flow.json`,'utf8'));change?.(flow);
 const file=path.join(dir,'flow.json');writeFileSync(file,JSON.stringify(flow));
 execFileSync(path.join(root,'node_modules/.bin/tsx'),['src/cli/main.ts','compile',file,'--human-request',`examples/sheet-app/${mode}.request.txt`,'--sheet-experience',quote[mode],'--out',dir],{cwd:root});
 const artifact=readFileSync(path.join(dir,`${flow.id}.json`),'utf8');
 await page.route('**/__sheet-test.json',route=>route.fulfill({contentType:'application/json',body:artifact}));
 await page.setViewportSize({width:402,height:874+playbackBarHeightPx});
 await page.goto('/tests/e2e/fixtures/sheet-app/index.html');
 await expect(page.locator('[data-slot="mini-app-card"]').first()).toBeVisible();
 return flow;
}
const shell=(page:Page)=>page.locator('[data-slot="sheet-app-shell"]');
const app=(page:Page)=>page.frameLocator('[data-slot="sheet-app-frame"]');
async function expand(page:Page){await page.getByRole('button',{name:/Open (Choose an Object|A Quiet Collection)/}).first().click();await expect(shell(page)).toHaveAttribute('data-phase','expanded');await expect(shell(page)).toHaveAttribute('data-content','ready');}
async function drag(page:Page,to:number){const box=await page.getByRole('button',{name:/^(Collapse|Expand) app$/}).boundingBox();if(!box)throw new Error('handle absent');await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();await page.mouse.move(box.x+box.width/2,to,{steps:15});}
test.beforeEach(({},info)=>{test.skip(!['chromium-ios-light-e2e','webkit-ios-light-e2e'].includes(info.project.name));});
test('real card, working actions, compact/expand, draft/anchor and retained state',async({page},info)=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await open(page,info);
 const initial=await page.locator('[data-slot="message-list"]').evaluate(e=>e.scrollTop);
 const draft=page.locator('[data-slot="ios-composer"] textarea');await expect(draft).toHaveValue('My unfinished note');
 await page.locator('[data-demo-frame]').screenshot({path:info.outputPath('card.png')});await expand(page);
 await expect(page.locator('[data-sheet-close]')).toHaveCount(0);
 await app(page).getByRole('button',{name:'View mirror'}).click();await expect(app(page).getByRole('status')).toHaveText('Viewing The bronze mirror');
 await page.getByRole('button',{name:'Collapse app'}).click();await expect(shell(page)).toHaveAttribute('data-phase','compact');
 await expect(draft).toBeVisible();await expect(draft).not.toHaveAttribute('inert','');
 await expect(app(page).locator('body')).toHaveAttribute('data-presentation','compact');
 await page.locator('[data-demo-frame]').screenshot({path:info.outputPath('compact.png')});
 await page.getByRole('button',{name:'Expand',exact:true}).click();await expect(shell(page)).toHaveAttribute('data-phase','expanded');
 await expect(app(page).getByRole('status')).toHaveText('Viewing The bronze mirror');
 await page.locator('[data-demo-frame]').screenshot({path:info.outputPath('expanded.png')});
 await shell(page).press('Escape');await expect(shell(page)).toHaveAttribute('data-phase','restoring');await expect(shell(page)).toBeHidden();await expect(shell(page)).toHaveAttribute('data-phase','closed');
 await expect(draft).toHaveValue('My unfinished note');expect(await page.locator('[data-slot="message-list"]').evaluate(e=>e.scrollTop)).toBe(initial);
 await expect(page.getByRole('button',{name:'Open Choose an Object'})).toBeFocused();await expand(page);await expect(app(page).getByRole('status')).toHaveText('Viewing The bronze mirror');expect(errors).toEqual([]);
});
test('actionless content and keyboard dismissal under reduced motion',async({page},info)=>{
 await page.emulateMedia({reducedMotion:'reduce'});await open(page,info,'actionless');
 await page.getByRole('button',{name:'Open A Quiet Collection'}).focus();await page.keyboard.press('Enter');
 await expect(shell(page)).toHaveAttribute('data-content','ready');await expect(app(page).getByRole('button')).toHaveCount(0);await expect(app(page).getByRole('heading',{name:'The cobalt bottle'})).toBeVisible();
 await page.locator('[data-demo-frame]').screenshot({path:info.outputPath('actionless.png')});await page.keyboard.press('Escape');await expect(shell(page)).toBeHidden();
});
test('pointer cancellation, single-swipe exit and interruption/reopen keep one instance',async({page},info)=>{
 await open(page,info);await expand(page);await drag(page,410);
 await page.getByRole('button',{name:'Expand app'}).dispatchEvent('pointercancel');await page.mouse.up();await expect(shell(page)).toHaveAttribute('data-phase','expanded');
 await drag(page,790);await page.mouse.up();await expect(shell(page)).toHaveAttribute('data-phase','dismissing');
 // Programmatic preview activation exercises the same handler while the panel is passing it.
 await page.getByRole('button',{name:'Open Choose an Object'}).dispatchEvent('click');await expect(shell(page)).toHaveAttribute('data-phase','expanded');await expect(page.locator('[data-slot="sheet-app-frame"]')).toHaveCount(1);
 await shell(page).press('Escape');await expect(shell(page)).toHaveAttribute('data-phase','closed');
});
test('loading/error/late readiness cannot reopen and retry is functional',async({page},info)=>{
 let release!:()=>void;const blocked=new Promise<void>(resolve=>{release=resolve});
 await page.route('**/demo-apps/sheet-museum-actionful.html',async route=>{await blocked;await route.continue();});
 await open(page,info);await page.getByRole('button',{name:'Open Choose an Object'}).click();await expect(shell(page)).toHaveAttribute('data-content','loading');await shell(page).press('Escape');await expect(shell(page)).toHaveAttribute('data-phase','closed');release();await expect(shell(page)).toHaveAttribute('data-content','ready');await expect(shell(page)).toBeHidden();
 await app(page).locator('body').evaluate(()=>parent.postMessage({type:'sheet-app:expand',version:1},'*'));
 await page.waitForTimeout(100);await expect(shell(page)).toHaveAttribute('data-phase','closed');await expand(page);
});
test('two cards share one app host, timeline seeks, replay clears app state',async({page},info)=>{
 const flow=await open(page,info,'actionful',flow=>{flow.messages.push({...structuredClone(flow.messages[1]),id:'second',atMs:1500});flow.events=[{type:'sheet-app',messageId:'museum-actionful',action:'open',atMs:2000},{type:'sheet-app',messageId:'museum-actionful',action:'close',atMs:4000}];});
 await expect(shell(page)).toHaveAttribute('data-phase','expanded');await expect(shell(page)).toHaveAttribute('data-content','ready');
 await page.evaluate(async()=>{const r=await window.IMESSAGE_DEMO!.seek(5500);await window.IMESSAGE_DEMO!.ready(r.revision);});
 await expect(shell(page)).toHaveAttribute('data-phase','restoring');await expect(shell(page)).toBeHidden();
 await page.evaluate(async()=>{const r=await window.IMESSAGE_DEMO!.seek(6500);await window.IMESSAGE_DEMO!.ready(r.revision);});
 await page.getByRole('button',{name:'Open Choose an Object'}).nth(1).click();await expect(page.locator('[data-slot="sheet-app-frame"]')).toHaveCount(1);await expect(shell(page)).toHaveAttribute('data-phase','expanded');
 await page.evaluate(()=>window.IMESSAGE_DEMO!.reset());await expect(page.locator('[data-slot="sheet-app-frame"]')).toHaveCount(0);
 expect(flow.events).toHaveLength(2);
});
test('smaller/larger viewport keeps sheet usable and content scroll separate from handle',async({page},info)=>{
 await open(page,info);await expand(page);
 for(const width of [320,768]){await page.setViewportSize({width,height:1000});await expect(page.getByRole('button',{name:'Collapse app'})).toBeVisible();await app(page).locator('body').evaluate(e=>{e.scrollTop=200;});await expect(shell(page)).toHaveAttribute('data-phase','expanded');}
});

test('content error exposes retry; long card descriptions wrap without losing controls',async({page},info)=>{
 let first=true;
 await page.route('**/demo-apps/sheet-museum-actionless.html',async route=>{
  if(first){first=false;await route.fulfill({contentType:'text/html',body:"<script>parent.postMessage({type:'sheet-app:error',version:1},'*')</script>"});}else await route.continue();
 });
 await open(page,info,'actionless',flow=>{flow.messages[1].appCard.sheet.description='A collection of three invented objects, with a closer look at the materials, textures, shapes, and everyday details that make each one worth spending a little more time with. Browse at your own pace, without any action buttons.';});
 await page.getByRole('button',{name:'Open A Quiet Collection'}).click();await expect(shell(page)).toHaveAttribute('data-content','error');await expect(page.getByRole('alert')).toContainText('could not load');await page.getByRole('button',{name:'Try again'}).click();await expect(shell(page)).toHaveAttribute('data-content','ready');await shell(page).press('Escape');await expect(shell(page)).toHaveAttribute('data-phase','closed');
});
test('a live close can interrupt a paused scripted sheet and the next seek resumes its timeline',async({page},info)=>{
 await open(page,info,'actionful',flow=>{flow.events=[{type:'sheet-app',messageId:'museum-actionful',action:'open',atMs:2000}];});
 await expect(shell(page)).toHaveAttribute('data-content','ready');await expect(shell(page)).toHaveAttribute('data-phase','expanded');await shell(page).press('Escape');await expect(shell(page)).toHaveAttribute('data-phase','closed');
 await page.evaluate(async()=>{const r=await window.IMESSAGE_DEMO!.seek(3100);await window.IMESSAGE_DEMO!.ready(r.revision);});await expect(shell(page)).toHaveAttribute('data-phase','expanded');
});

test('article scrolling does not drag the sheet and its position survives compact mode',async({page},info)=>{
 await open(page,info,'actionless');await expand(page);
 await app(page).locator('body').evaluate(()=>window.scrollTo(0,200));
 const before=await app(page).locator('body').evaluate(()=>window.scrollY);expect(before).toBeGreaterThan(100);
 const box=(await shell(page).boundingBox())!;
 await page.mouse.move(box.x+80,box.y+120);await page.mouse.down();await page.mouse.move(box.x+80,box.y+220,{steps:8});await page.mouse.up();
 await expect(shell(page)).toHaveAttribute('data-phase','expanded');
 await page.getByRole('button',{name:'Collapse app'}).click();await expect(shell(page)).toHaveAttribute('data-phase','compact');
 await expect(app(page).getByRole('heading',{name:'The terracotta vase'})).toBeHidden();
 await page.getByRole('button',{name:'Expand',exact:true}).click();await expect(shell(page)).toHaveAttribute('data-phase','expanded');
 await expect.poll(()=>app(page).locator('body').evaluate(()=>window.scrollY)).toBe(before);
});

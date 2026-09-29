import { test, expect } from '@playwright/test';
import { mkdirSync, writeFileSync, copyFileSync, existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
const geometry = JSON.parse(readFileSync(new URL('../fixtures/sheet-handoff/geometry-native.json', import.meta.url), 'utf8')) as Array<{ clip: string; source_frame: number; sheet_top_px?: number; sheet_left_px?: number }>;
const checkpoints={A:[0,9,20,21,23,26,32,33,34,35,40,49],B:[83,90,94,95,103,119,122,123,130,140,150,166]};
test('source-aligned full-phone checkpoints and measured shell edges',async({page},info)=>{
 test.skip(info.project.name!=='chromium-ios-light-e2e');
 const dir=path.resolve('artifacts/sheet-reference');mkdirSync(dir,{recursive:true});
 await page.setViewportSize({width:512,height:1112});await page.goto('/tests/e2e/fixtures/sheet-reference/index.html');
 await page.waitForFunction(()=>Boolean((window as any).sheetReference));
 const residuals:Array<Record<string,unknown>>=[];
 const cards:string[]=[];
 const source=process.env.SHEET_HANDOFF_ROOT;
 for(const [clip,frames] of Object.entries(checkpoints))for(const n of frames){
  await page.evaluate(async({clip,n})=>{await (window as any).sheetReference.set(clip,n);},{clip,n});
  const name=`${clip}-n${String(n).padStart(3,'0')}`;
  const row=geometry.find(r=>r.clip===`clip_${clip}`&&r.source_frame===n)!;
  const shell=page.locator('[data-slot="sheet-app-shell"]');
  if(row.sheet_top_px!==undefined){const box=await shell.boundingBox();expect(box).not.toBeNull();const error=box!.y-row.sheet_top_px;expect(Math.abs(error)).toBeLessThan(3);expect(Math.abs(box!.x-Math.min(10,row.sheet_left_px??0))).toBeLessThan(3);residuals.push({clip,n,sourceTop:row.sheet_top_px,renderTop:box!.y,error});}
  else if(clip==='B'&&n>=123)await expect(shell).toBeHidden();
  if(clip==='A'&&(n===33||n===34))await expect(shell).toHaveAttribute('data-content','blank');
  if(clip==='B'&&(n===94||n===95))await expect(shell).toHaveAttribute('data-presentation',n===94?'expanded':'compact');
  await page.locator('[data-reference-frame]').screenshot({path:path.join(dir,name+'.png')});
  let original='';if(source&&existsSync(path.join(source,'keyframes'))){const file=readdirSync(path.join(source,'keyframes')).find(f=>f.startsWith(`clip_${clip}_n${String(n).padStart(3,'0')}_`));if(file){copyFileSync(path.join(source,'keyframes',file),path.join(dir,name+'-source.png'));original=`<img src="${name}-source.png" alt="Source ${name}">`;}else{const jpeg=path.join(source,'reference','native-jpg',`clip_${clip}`,`native_${String(n).padStart(4,'0')}.jpg`);if(existsSync(jpeg)){copyFileSync(jpeg,path.join(dir,name+'-source.jpg'));original=`<img src="${name}-source.jpg" alt="Source ${name} (JPEG review copy)">`;}}}
  cards.push(`<section><h2>${name} · ${(n/30).toFixed(3)} s</h2><div>${original}<img src="${name}.png" alt="Render ${name}"></div></section>`);
 }
 writeFileSync(path.join(dir,'geometry-residuals.json'),JSON.stringify(residuals,null,2));
 writeFileSync(path.join(dir,'index.html'),`<!doctype html><meta charset="utf-8"><title>iMessage sheet comparison</title><style>body{background:#18191b;color:white;font:14px system-ui;margin:24px}section{margin-bottom:36px}section>div{display:flex;gap:12px}img{width:min(44vw,384px);height:auto}h1{font-size:24px}</style><h1>30-fps source (left) / shared renderer (right)</h1><p>Shell edge measurements are separate from host chrome, font and app-art approximations. Fixture linear interpolation is not native 60-fps evidence.</p>${cards.join('')}`);
});

import { test,expect, type Page } from '@playwright/test';
import { mkdirSync,writeFileSync } from 'node:fs';
import path from 'node:path';
const shell=(page:Page)=>page.locator('[data-slot="sheet-app-shell"]');
const output=path.resolve('artifacts/sheet-app-review-v2');
test.use({video:{mode:'on',size:{width:544,height:1144}}});
test.beforeEach(({},info)=>test.skip(!['chromium-ios-light-e2e','webkit-ios-light-e2e'].includes(info.project.name)));
async function open(page:Page){
 await page.setViewportSize({width:544,height:1144});
 await page.goto('/tests/e2e/fixtures/sheet-reference/index.html?interactive=1');
 await page.getByRole('button',{name:'Open Jump Jump'}).last().click();
 await expect(shell(page)).toHaveAttribute('data-phase','expanded');
 await expect(shell(page)).toHaveAttribute('data-content','ready');
}
async function frameRect(page:Page){const b=await page.locator('[data-reference-frame]').boundingBox();if(!b)throw new Error('frame missing');return b;}
test('production host follows reference geometry under a real continuous drag, then restores chat',async({page},info)=>{
 mkdirSync(output,{recursive:true});await open(page);
 const engine=info.project.name.split('-')[0];
 const frame=await frameRect(page),handle=page.getByRole('button',{name:'Collapse app'}),b=(await handle.boundingBox())!;
 await expect(page.getByRole('button',{name:'Close sheet app'})).toHaveCount(0);
 await page.locator('[data-reference-frame]').screenshot({path:path.join(output,`${engine}-live-expanded.png`)});
 await page.mouse.move(b.x+b.width/2,b.y+b.height/2);await page.mouse.down();
 const samples=[];
 const scale=(await page.locator('[data-slot="ios-messages-app"]').boundingBox())!.height/1112;
 for(const [n,top,inset,height] of [[94,395,5,712],[95,437,6,669],[103,661,10,441],[104,680,10,422],[119,949,10,409]]){
  await page.mouse.move(b.x+b.width/2,b.y+b.height/2+(top-79)*scale+.75,{steps:5});
  await expect(shell(page)).toHaveAttribute('data-presentation',n<95?'expanded':'compact');
  const actual=(await shell(page).boundingBox())!;
  expect(Math.abs(actual.y-frame.y-top)).toBeLessThan(3);
  expect(Math.abs(actual.x-frame.x-inset)).toBeLessThan(2);
  expect(Math.abs(actual.height-height)).toBeLessThan(3);
  if(n===103){
   await expect(page.frameLocator('[data-slot="sheet-app-frame"]').getByRole('button',{name:'Expand to Play'})).toBeVisible();
   const composer=(await page.locator('[data-slot="ios-composer"] textarea').boundingBox())!;
   const card=(await page.locator('[data-slot="mini-app-card"]').last().boundingBox())!;
   expect(Math.abs(card.y-frame.y-297)).toBeLessThan(6);
   expect(composer.y+composer.height).toBeLessThan(actual.y+3);
   samples.push({n,top:actual.y-frame.y,height:actual.height,inset:actual.x-frame.x,cardTop:card.y-frame.y,composerBottom:composer.y+composer.height-frame.y});
  }
  await page.locator('[data-reference-frame]').screenshot({path:path.join(output,`${engine}-live-B-n${n}.png`)});
 }
 await page.mouse.move(b.x+b.width/2,frame.y+1230,{steps:4});
 await expect(shell(page)).toHaveAttribute('data-phase','dragging');
 await page.mouse.up();await expect(shell(page)).toHaveAttribute('data-phase','restoring');
 const during=(await page.locator('[data-slot="mini-app-card"]').first().boundingBox())!.y;
 await expect(shell(page)).toHaveAttribute('data-phase','closed');
 const after=(await page.locator('[data-slot="mini-app-card"]').first().boundingBox())!.y;
 expect(after-during).toBeGreaterThan(50);expect(Math.abs(after-frame.y-408)).toBeLessThan(3);
 await page.locator('[data-reference-frame]').screenshot({path:path.join(output,`${engine}-live-restored.png`)});
 writeFileSync(path.join(output,`${engine}-live-geometry.json`),JSON.stringify(samples,null,2));
});
test('dragging the app body hands off only at scroll top; compact expansion retains its live instance',async({page})=>{
 await open(page);
 const before=await page.locator('[data-slot="sheet-app-frame"]').getAttribute('src');
 const box=(await shell(page).boundingBox())!;
 await page.mouse.move(box.x+110,box.y+65);await page.mouse.down();
 await page.mouse.move(box.x+110,box.y+65+582,{steps:20});
 await expect(shell(page)).toHaveAttribute('data-phase','dragging');
 await expect(shell(page)).toHaveAttribute('data-presentation','compact');
 await page.waitForTimeout(150);await page.mouse.up();
 await expect(shell(page)).toHaveAttribute('data-phase','compact');
 await page.frameLocator('[data-slot="sheet-app-frame"]').getByRole('button',{name:'Expand to Play'}).click();
 await expect(shell(page)).toHaveAttribute('data-phase','expanded');
 expect(await page.locator('[data-slot="sheet-app-frame"]').getAttribute('src')).toBe(before);
 await expect(page.locator('[data-slot="sheet-app-frame"]')).toHaveCount(1);
 await page.frameLocator('[data-slot="sheet-app-frame"]').getByRole('button',{name:'▸ Start Game'}).click();
 await page.frameLocator('[data-slot="sheet-app-frame"]').getByRole('button',{name:'Jump again'}).click();
 await expect(page.frameLocator('[data-slot="sheet-app-frame"]').getByRole('status')).toHaveText('1 jump');
 await shell(page).press('Escape');await expect(shell(page)).toHaveAttribute('data-phase','closed');
});

test('keyboard dismissal traverses compact without a pause and finishes restoring after exit',async({page},info)=>{
 await open(page);await page.waitForTimeout(350);
 const start=Date.now();await shell(page).press('Escape');
 await expect(shell(page)).toHaveAttribute('data-presentation','compact');
 await expect(shell(page)).toHaveAttribute('data-phase','restoring');
 await expect(shell(page)).toBeHidden();
 await expect(shell(page)).toHaveAttribute('data-phase','closed');
 expect(Date.now()-start).toBeGreaterThan(2100);
 await page.waitForTimeout(250);
});

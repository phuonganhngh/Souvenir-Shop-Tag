import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
const browser = await chromium.launch({executablePath:process.env.CHROMIUM_PATH || '/usr/bin/chromium',args:['--no-sandbox']});
try {
 for (const file of ['shop.html','restaurant.html']) {
  const page = await browser.newPage({viewport:{width:1440,height:1100}}), errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(`${process.env.DELETION_BASE_URL || 'http://127.0.0.1:4181/'}${file}`);
  await page.locator('.product-row').first().waitFor();
  const list=page.locator('.product-row');
  const state = () => page.evaluate(file => {
   const key = file==='shop.html' ? 'tag-studio-v1' : Object.keys(localStorage).find(k=>k.startsWith('restaurant-tags-menu-'));
   const saved=JSON.parse(localStorage.getItem(key)); return saved.products || saved.menus[saved.meal];
  }, file);
  const original=await state();
  assert.equal(await page.locator('#undo').isDisabled(), true);
  await page.locator('#select-all').uncheck();
  assert.equal(await page.locator('#delete').isDisabled(), true);
  await list.nth(0).locator('[data-action="select"]').check();
  await list.nth(2).locator('[data-action="select"]').check();
  await list.nth(0).locator('[data-action="quantity"]').fill('3');
  await list.nth(0).locator('[data-action="quantity"]').dispatchEvent('change');
  await list.nth(3).locator('[data-action="edit"]').click(); // Editing a different, unchecked item must not choose the delete target.
  const before=await state();
  page.once('dialog',async d=>{assert.match(d.message(),/2(?:商品|品)/);await d.dismiss();});
  await page.locator('#delete').click();
  assert.equal(await list.count(), original.length); assert.equal(await page.locator('#undo').isDisabled(),true);
  page.once('dialog',d=>d.accept());await page.locator('#delete').click();
  assert.deepEqual((await state()).map(p=>p.id),before.filter(p=>!p.selected).map(p=>p.id));
  assert.equal(await page.locator('#preview .preview-item:not(.preview-blank)').count(),0);
  assert.equal(await page.locator('#delete').isDisabled(),true);assert.equal(await page.locator('#undo').isEnabled(),true);
  await page.locator('#edit-form [name="ja"]').fill('削除後に変更した料理');
  await page.reload();await page.locator('.product-row').first().waitFor();
  assert.equal(await page.locator('#undo').isEnabled(),true);
  await page.locator('#undo').click();
  const restored=await state();assert.deepEqual(restored.map(p=>p.id),before.map(p=>p.id));
  assert.deepEqual(restored[0],before[0]);assert.deepEqual(restored[2],before[2]);
  assert.equal(restored[3].ja,'削除後に変更した料理');assert.equal(await page.locator('#undo').isDisabled(),true);
  assert.equal(await page.locator('#preview .preview-item:not(.preview-blank)').count(),2);
  // Deleting and restoring the whole group remains possible after a reload of an empty group.
  await page.locator('#select-all').check();page.once('dialog',d=>d.accept());await page.locator('#delete').click();
  assert.equal(await list.count(),0);
  if(file==='restaurant.html'){
   await page.locator('[data-meal="朝食"]').click();assert.equal(await list.count(),130);assert.equal(await page.locator('#undo').isDisabled(),true);
   await page.locator('[data-meal="夕食"]').click();assert.equal(await list.count(),0);
  }
  await page.reload();assert.equal(await list.count(),0);assert.equal(await page.locator('#undo').isEnabled(),true);
  await page.locator('#undo').click();assert.equal(await list.count(),original.length);
  assert.equal((await state())[3].ja,'削除後に変更した料理');
  // A new import replaces the current dataset and clears previous delete history.
  await page.locator('#select-all').uncheck();await list.nth(0).locator('[data-action="select"]').check();
  page.once('dialog',d=>d.accept());await page.locator('#delete').click();assert.equal(await page.locator('#undo').isEnabled(),true);
  if(file==='restaurant.html'){
   page.once('dialog',d=>d.accept());await page.locator('#excel-input').setInputFiles(new URL('../public/downloads/Restaurant_Menu.xlsx',import.meta.url).pathname);
   await page.waitForFunction(()=>document.querySelector('#notice').textContent.includes('222品を取り込みました'));
  }else{
   const wait=page.waitForEvent('download');await page.locator('#template').click();const download=await wait;
   const fixture = `/tmp/delete-template-${crypto.randomUUID()}.xlsx`; await download.saveAs(fixture);
   await page.locator('#excel-input').setInputFiles(fixture);
   await page.waitForFunction(()=>document.querySelector('#notice').textContent.includes('1商品を取り込みました'));
  }
  assert.equal(await page.locator('#undo').isDisabled(),true);
  await page.setViewportSize({width:390,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  assert.deepEqual(errors,[]);await page.close();
  console.log(`PASS ${file}: delete checked rows independent of editor, cancel, undo after reload, preserve edits/order/quantities/allergies, delete all, meal isolation, import clears history, mobile`);
 }
}finally{await browser.close();}

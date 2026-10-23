import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH || '/usr/bin/chromium',args:['--no-sandbox']});
try{
 for(const file of ['shop.html','restaurant.html']){
  const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(`${process.env.EDITOR_BASE_URL || 'http://127.0.0.1:4182/'}${file}`);
  const list=page.locator('.product-row');await list.first().waitFor();const count=await list.count();
  const actualName=await list.first().locator('.product-name strong').textContent();
  const placeholders=await page.locator('.form-grid input').evaluateAll(els=>els.map(el=>({value:el.value,placeholder:el.placeholder,color:getComputedStyle(el,'::placeholder').color,disabled:el.disabled})));
  assert.ok(placeholders.every(el=>!el.value && el.placeholder.startsWith('例：') && el.color==='rgb(165, 170, 162)' && !el.disabled));
  await page.locator('#select-all').uncheck();await list.first().locator('[data-action="select"]').check();
  assert.equal(await page.locator('#edit-form [name="ja"]').inputValue(),'');
  await list.first().locator('[data-action="edit"]').click();
  assert.equal(await page.locator('#edit-form [name="ja"]').inputValue(),actualName);
  await page.locator('#edit-form [name="ja"]').fill('既存商品の編集');assert.equal(await list.count(),count);
  await list.nth(1).locator('[data-action="select"]').check();assert.equal(await page.locator('#edit-form [name="ja"]').inputValue(),'');
  // Typing into the example field creates a new item, instead of replacing the checked existing item.
  await page.locator('#edit-form [name="ja"]').fill('直接入力の新商品');assert.equal(await list.count(),count+1);
  await page.locator('#edit-form [name="en"]').fill('New item');assert.equal(await list.count(),count+1);
  assert.ok((await list.locator('.product-name strong').allTextContents()).includes('既存商品の編集'));
  await page.reload();await list.first().waitFor();assert.equal(await page.locator('#edit-form [name="ja"]').inputValue(),'');
  assert.equal(await list.count(),count+1);
  await list.first().locator('[data-action="edit"]').click();assert.equal(await page.locator('#edit-form [name="ja"]').inputValue(),'直接入力の新商品');
  assert.equal(await page.locator('#edit-form [name="en"]').inputValue(),'New item');
  await page.locator('#new-entry').click();assert.equal(await page.locator('#edit-form [name="ja"]').inputValue(),'');
  assert.ok((await page.locator('#edit-form [name="ja"]').getAttribute('placeholder')).startsWith('例：'));
  await page.setViewportSize({width:390,height:844});await page.locator('.editor').screenshot({path:`/tmp/${file}-editor-examples.png`});
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  assert.deepEqual(errors,[]);await page.close();
  console.log(`PASS ${file}: muted examples on open/select/reload, explicit editing preserves real data, direct new input creates once, saved edits retained, mobile`);
 }
}finally{await browser.close();}

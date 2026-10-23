import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH || '/usr/bin/chromium',args:['--no-sandbox']});
try{
 for(const [file,reduced] of [['shop.html',9],['restaurant.html',91]]){
  const page=await browser.newPage(), errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(`${process.env.SOURCE_BASE_URL || 'http://127.0.0.1:4182/'}${file}`);await page.locator('.product-row').first().waitFor();
  const original=await page.evaluate(file=>{
   const key=file==='shop.html'?'tag-studio-v1':Object.keys(localStorage).find(k=>k.startsWith('restaurant-tags-menu-'));
   return {key,data:JSON.parse(localStorage.getItem(key))};
  },file);
  const source=file==='shop.html'?original.data.products:original.data.menus['夕食'];assert.equal(source.length,file==='shop.html'?14:92);
  await page.evaluate(({key,data,reduced,file})=>{
   const edited=structuredClone(data);
   const items=file==='shop.html'?edited.products:edited.menus['夕食'];items.splice(reduced);items[0].ja='端末に保存した編集';
   localStorage.setItem(key,JSON.stringify(edited));
  },{...original,reduced,file});
  await page.reload();await page.locator('.product-row').first().waitFor();assert.equal(await page.locator('.product-row').count(),reduced);
  assert.equal(await page.locator('.product-name strong').first().textContent(),'端末に保存した編集');
  assert.match(await page.locator('#notice').textContent(),file==='shop.html'?/9商品.*14商品/:/夕食91品.*夕食92品/);
  page.once('dialog',d=>d.dismiss());await page.locator('#restore-source').click();assert.equal(await page.locator('.product-row').count(),reduced);
  page.once('dialog',d=>d.accept());await page.locator('#restore-source').click();
  assert.equal(await page.locator('.product-row').count(),source.length);
  const restored=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),original.key);
  const names=items=>items.map(({id,...row})=>row);
  if(file==='shop.html')assert.deepEqual(names(restored.products),names(original.data.products));
  else{assert.equal(restored.menus['朝食'].length,130);for(const meal of ['夕食','朝食'])assert.deepEqual(names(restored.menus[meal]),names(original.data.menus[meal]));}
  assert.equal(await page.locator('#undo').isDisabled(),true);
  await page.locator('.product-row').first().locator('[data-action="select"]').uncheck();
  assert.equal(await page.locator('#preview .preview-item:not(.preview-blank)').count(),source.length-1);
  page.once('dialog',d=>d.accept());await page.locator('#restore-source').click();
  assert.equal(await page.locator('#preview .preview-item:not(.preview-blank)').count(),source.length);
  await page.reload();await page.locator('.product-row').first().waitFor();assert.equal(await page.locator('.product-row').count(),source.length);
  await page.setViewportSize({width:390,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  assert.deepEqual(errors,[]);await page.close();console.log(`PASS ${file}: saved ${reduced}-row list stays intact until confirmed; cancel preserves edits; restore loads complete source; reload retains source; mobile`);
 }
}finally{await browser.close();}

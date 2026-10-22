import test from 'node:test';
import assert from 'node:assert/strict';
import { translateProducts, TranslationError } from '../server/translate.js';
import { translationTasks, translationBatches, applyTranslations } from '../src/translation.js';

test('only fills missing translations and preserves later user edits', () => {
  const products = [{id:'1',ja:'じゃがりこ',en:'Official name',ko:'',zh:'',tw:''}];
  assert.deepEqual(translationTasks(products)[0].missing, ['ko','zh','tw']);
  products[0].ko = 'User edit';
  assert.equal(applyTranslations(products, [{id:'1',ja:'じゃがりこ',en:'Overwrite',ko:'Overwrite',zh:'薯条',tw:'薯條'}]), 2);
  assert.equal(products[0].en, 'Official name'); assert.equal(products[0].ko, 'User edit');
  products[0].ja = '別の商品'; products[0].zh = '';
  assert.equal(applyTranslations(products, [{id:'1',ja:'じゃがりこ',zh:'Old result'}]), 0);
});
test('batches Japanese-only imports within provider limits', () => {
  const tasks = translationTasks(Array.from({length:120}, (_, i) => ({id:String(i),ja:'あ'.repeat(200)})));
  const batches = translationBatches(tasks);
  assert.equal(batches.flat().length, 120);
  for (const batch of batches) { assert.ok(batch.length <= 50); assert.ok(batch.reduce((n,p) => n + p.ja.length*p.missing.length, 0) <= 20000); }
});
test('calls the official API for four targets and deduplicates repeated names', async () => {
  const calls = [];
  const result = await translateProducts({ products:[{id:'1',ja:'商品',missing:['en','ko','zh','tw']},{id:'2',ja:'商品',missing:['en']}] }, {
    apiKey:'test-only-key', fetchImpl:async (url, options) => {
      const body = JSON.parse(options.body); calls.push(body);
      assert.equal(url, 'https://translation.googleapis.com/language/translate/v2');
      assert.equal(options.headers['X-Goog-Api-Key'], 'test-only-key');
      assert.deepEqual(body.q, ['商品']); assert.equal(body.source, 'ja'); assert.equal(body.format, 'text');
      return {ok:true,json:async()=>({data:{translations:[{translatedText:`${body.target} product`}]}})};
    },
  });
  assert.deepEqual(calls.map(c=>c.target), ['en','ko','zh-CN','zh-TW']);
  assert.equal(result.products[0].tw, 'zh-TW product'); assert.equal(result.products[1].en, 'en product'); assert.equal(result.products[1].ko, undefined);
});
test('missing credentials, invalid targets and provider failures are explicit errors', async () => {
  const body = {products:[{id:'1',ja:'商品',missing:['en']}]};
  await assert.rejects(translateProducts(body, {apiKey:''}), e => e.status === 503);
  await assert.rejects(translateProducts({products:[{id:'1',ja:'商品',missing:['unknown']}]}, {apiKey:'test'}), e => e.status === 400);
  await assert.rejects(translateProducts(body, {apiKey:'test',fetchImpl:async()=>({ok:false,status:403})}), e=>e instanceof TranslationError && e.status === 503);
  await assert.rejects(translateProducts(body, {apiKey:'test',fetchImpl:async()=>({ok:true,json:async()=>({data:{translations:[]}})})}), e=>e.status === 502);
});

import { chromium } from '@playwright/test';
import Excel from 'exceljs';
import assert from 'node:assert/strict';
import { readFile, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { readMenuWorkbook } from '../src/restaurant-data.js';
const book = new Excel.Workbook(); await book.xlsx.load(await readFile(new URL('../public/downloads/Restaurant_Menu.xlsx', import.meta.url)));
const expected = readMenuWorkbook(book), dir = await mkdtemp(`${tmpdir()}/restaurant-tags-`);
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', args: ['--no-sandbox'] });
try {
 const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } }), errors = [];
 page.on('pageerror', e => errors.push(e.message)); page.on('dialog', dialog => dialog.accept());
 await page.goto(process.env.RESTAURANT_URL || 'http://127.0.0.1:5174/restaurant.html');
 await page.locator('.product-row').first().waitFor();
 assert.equal(await page.locator('.product-row').count(), 92);
 await page.locator('#preview .preview-current .tag-background').evaluate(img => img.decode());
 assert.deepEqual(await page.locator('#preview .preview-current .tag-background').evaluate(img => [img.naturalWidth, img.naturalHeight]), [909, 649]);
 await page.getByRole('button', { name: 'パンナコッタ', exact: false }).click();
 assert.deepEqual(await page.locator('#preview .preview-current .allergen-mark').evaluateAll(nodes => nodes.map(n => Number(n.dataset.allergen))), [3, 8]);
 assert.equal(await page.locator('#preview .preview-current .dish-ja').textContent(), 'パンナコッタ');
 const alignment = await page.locator('#preview .preview-current .tag').evaluate(tag => {
   const r = tag.getBoundingClientRect();
   return [...tag.querySelectorAll('.allergen-mark')].map(el => { const m = el.getBoundingClientRect(); return [(m.x + m.width / 2 - r.x) / r.width * 909, (m.y + m.height / 2 - r.y) / r.height * 649]; });
 });
 assert.ok(Math.abs(alignment[0][0] - 371.5) < 1); assert.ok(Math.abs(alignment[1][0] - 670) < 1); assert.ok(Math.abs(alignment[0][1] - 443) < 1);
 assert.equal(await page.locator('#confirmed, #confirm-selected, #preview-status, .row-status, .preview-caption, #allergy-summary').count(), 0);
 assert.doesNotMatch(await page.locator('body').textContent(), /未確認|この料理のアレルギー表示を確認済み/);
 await page.locator('#edit-form [data-allergen="0"]').check();
 assert.deepEqual(await page.locator('#preview .preview-current .allergen-mark').evaluateAll(nodes => nodes.map(n => Number(n.dataset.allergen))), [0, 3, 8]);
 await page.locator('#edit-form [data-allergen="0"]').uncheck();
 const downloadWait = page.waitForEvent('download'); await page.locator('#export').click(); const download = await downloadWait;
 const exported = new Excel.Workbook(); await exported.xlsx.readFile(await download.path());
 const parsed = readMenuWorkbook(exported); assert.equal(parsed['朝食'].length, 130); assert.equal(parsed['夕食'].length, 92);
 assert.equal(exported.getWorksheet('夕食').columnCount, 17); assert.deepEqual(parsed['夕食'][7].allergens.flatMap((v, i) => v ? [i] : []), [3, 8]);
 await page.reload(); await page.getByRole('button', { name: 'パンナコッタ', exact: false }).click(); assert.deepEqual(await page.locator('#preview .preview-current .allergen-mark').evaluateAll(nodes => nodes.map(n => Number(n.dataset.allergen))), [3, 8]);
 const invalid = new Excel.Workbook(); invalid.addWorksheet('夕食').addRow(['日本語']); const invalidPath = `${dir}/invalid.xlsx`; await invalid.xlsx.writeFile(invalidPath);
 await page.locator('#excel-input').setInputFiles(invalidPath); await page.waitForFunction(() => document.querySelector('#notice').textContent.includes('列がありません'));
 assert.equal(await page.locator('.product-row').count(), 92);
 await page.locator('#excel-input').setInputFiles(new URL('../public/downloads/Restaurant_Menu.xlsx', import.meta.url).pathname);
 await page.waitForFunction(() => document.querySelector('#notice').textContent.includes('222品を取り込みました'));
 await page.evaluate(() => { window.print = () => window.printCalled = (window.printCalled || 0) + 1; });
 for (const meal of ['夕食', '朝食']) {
  await page.locator(`[data-meal="${meal}"]`).click();
  assert.equal(await page.locator('.product-row').count(), expected[meal].length);
  for (const size of ['77,55', '91,65', '154,110']) {
   await page.locator('#size').selectOption(size); const before = await page.evaluate(() => window.printCalled || 0);
   await page.locator('#print').click(); await page.waitForFunction(n => window.printCalled > n, before);
   const [width, height] = size.split(',').map(Number);
   assert.equal(await page.locator('#print-pages .tag').count(), expected[meal].length);
   assert.equal(await page.locator('#print-pages .print-page').count(), Math.ceil(expected[meal].length / (width === 154 ? 2 : 8)));
   const printed = await page.locator('#print-pages .tag').evaluateAll(tags => tags.map(t => ({ ja: t.querySelector('.dish-ja').textContent, marks: [...t.querySelectorAll('.allergen-mark')].map(m => Number(m.dataset.allergen)) })));
   expected[meal].forEach((p, i) => { assert.equal(printed[i].ja, p.ja); assert.deepEqual(printed[i].marks, p.allergens.flatMap((v, j) => v === true ? [j] : [])); });
   await page.emulateMedia({ media: 'print' });
   const measures = await page.locator('#print-pages .tag').evaluateAll(tags => tags.map(t => {
    const n = t.querySelector('.dish-names'), r = t.getBoundingClientRect(); return { w: r.width, h: r.height, excess: n.scrollHeight - n.clientHeight, horizontal: n.scrollWidth - n.clientWidth };
   }));
   for (const m of measures) { assert.ok(Math.abs(m.w - width * 96 / 25.4) < 1); assert.ok(Math.abs(m.h - height * 96 / 25.4) < 1); assert.ok(m.excess <= 1 && m.horizontal <= 1); }
   if (meal === '夕食' && size === '91,65') await page.pdf({ path: `${dir}/restaurant-dinner.pdf`, preferCSSPageSize: true, printBackground: false });
   await page.emulateMedia({ media: 'screen' });
  }
 }
 await page.locator('[data-meal="夕食"]').click(); await page.getByRole('button', { name: 'パンナコッタ', exact: false }).click();
 await page.locator('#preview .preview-current .tag').screenshot({ path: `${dir}/panna-cotta.png` });
 await page.setViewportSize({ width: 390, height: 844 }); await page.waitForTimeout(100);
 assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
 await page.screenshot({ path: `${dir}/mobile.png`, fullPage: true });
 assert.deepEqual(errors, []);
 console.log('PASS: latest workbook, both meals, Panna Cotta marker positions, direct printing without confirmation, edit/export/reimport/persistence, invalid input, all 222 print tags and 456 marks at all three sizes, no clipped names, mobile. Artifacts:', dir);
} finally { await browser.close(); }

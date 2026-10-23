import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', args: ['--no-sandbox'] });
try {
 for (const [path, namesSelector] of [['index.html', '.ja'], ['shop.html', '.ja'], ['restaurant.html', '.dish-ja']]) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } }), errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(`${process.env.PREVIEW_BASE_URL || 'http://127.0.0.1:5174/'}${path}`);
  await page.locator('.product-row').first().waitFor();
  assert.equal(await page.locator('.tag-nav a').count(), 2);
  assert.deepEqual(await page.locator('.tag-nav a').allTextContents(), ['販売タグ', '料理タグ']);
  assert.deepEqual(await page.locator('.tag-nav a').evaluateAll(links => links.map(link => link.getAttribute('href'))), ['./shop.html', './restaurant.html']);
  assert.equal(await page.locator('.tag-nav [aria-current="page"]').textContent(), path === 'restaurant.html' ? '料理タグ' : '販売タグ');
  assert.equal(await page.locator('.topbar .header-title, .topbar .local-badge').count(), 0);
  const list = page.locator('#product-list .product-row');
  const firstName = await list.nth(0).locator('.product-name strong').textContent();
  const secondName = await list.nth(1).locator('.product-name strong').textContent();
  const thirdName = await list.nth(2).locator('.product-name strong').textContent();
  assert.equal(await page.locator('#preview .preview-item').count(), await list.count());
  assert.equal(await page.locator('.preview-caption, #allergy-summary, #preview-status').count(), 0);
  await page.locator('#select-all').uncheck();
  assert.equal(await page.locator('#preview .tag-background').count(), 1);
  assert.equal(await page.locator(`#preview ${namesSelector}`).count(), 0);
  assert.equal(await page.locator('#preview').textContent(), '');
  await list.nth(1).locator('[data-action="select"]').check();
  assert.deepEqual(await page.locator(`#preview ${namesSelector}`).allTextContents(), [secondName]);
  assert.equal(await page.locator('#edit-form [name="ja"]').inputValue(), secondName);
  await list.nth(2).locator('[data-action="select"]').check();
  assert.deepEqual(await page.locator(`#preview ${namesSelector}`).allTextContents(), [secondName, thirdName]);
  assert.equal(await page.locator(`#preview .preview-current ${namesSelector}`).textContent(), thirdName);
  // The selected third tag is visible in the scrollable preview instead of the old second tag.
  assert.ok(await page.locator('#preview').evaluate(root => {
   const r = root.getBoundingClientRect(), item = root.querySelector('.preview-current').getBoundingClientRect();
   return item.top >= r.top - 1 && item.top < r.bottom;
  }));
  await list.nth(0).locator('[data-action="edit"]').click();
  assert.deepEqual(await page.locator(`#preview ${namesSelector}`).allTextContents(), [secondName, thirdName]);
  assert.ok(!(await page.locator('#preview').textContent()).includes(firstName));
  await list.nth(2).locator('[data-action="edit"]').click();
  await page.locator('#edit-form [name="ja"]').fill('選択中の更新');
  assert.deepEqual(await page.locator(`#preview ${namesSelector}`).allTextContents(), [secondName, '選択中の更新']);
  await list.nth(2).locator('[data-action="select"]').uncheck();
  assert.deepEqual(await page.locator(`#preview ${namesSelector}`).allTextContents(), [secondName]);
  await page.reload(); await page.locator('.product-row').first().waitFor();
  assert.deepEqual(await page.locator(`#preview ${namesSelector}`).allTextContents(), [secondName]);
  await page.locator('#search').fill('選択中の更新');
  assert.deepEqual(await page.locator(`#preview ${namesSelector}`).allTextContents(), [secondName]);
  await page.locator('#search').fill('');
  await list.nth(1).locator('[data-action="select"]').uncheck();
  assert.equal(await page.locator(`#preview ${namesSelector}`).count(), 0);
  await page.setViewportSize({ width: 390, height: 844 });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
  await page.locator('.tag-nav a').filter({ hasText: path === 'restaurant.html' ? '販売タグ' : '料理タグ' }).click();
  await page.waitForURL(`**/${path === 'restaurant.html' ? 'shop.html' : 'restaurant.html'}`);
  assert.equal(await page.locator('.tag-nav a').count(), 2);
  assert.deepEqual(errors, []); await page.close();
  console.log(`PASS ${path}: selected-only previews, scroll to new selection, blank when none, live edits, persistence, search, no captions, mobile`);
 }
} finally { await browser.close(); }

import test from 'node:test';
import assert from 'node:assert/strict';
import Excel from 'exceljs';
import { readWorksheet, parsePrice, cellText, headers } from '../src/data.js';

test('accepts JPY formatting but rejects empty, fractional and negative prices', () => {
  assert.equal(parsePrice('￥2,160'), 2160);
  assert.equal(parsePrice(0), 0);
  for (const value of ['', 'abc', -5, 2.5, '1e3']) assert.equal(parsePrice(value), null);
});
test('maps reordered columns, preserves missing tax and formula results', () => {
  const sheet = new Excel.Workbook().addWorksheet('Products');
  sheet.addRow([headers[5], headers[1], headers[0], headers[6]]);
  sheet.addRow([{formula:'100+70',result:170}, 'Sticks', 'じゃがりこ', '']);
  assert.deepEqual(readWorksheet(sheet), [{ja:'じゃがりこ',en:'Sticks',ko:'',zh:'',tw:'',price:'170',note:''}]);
  assert.equal(cellText({richText:[{text:'a'},{text:'b'}]}), 'ab');
});
test('rejects incorrect sheet and invalid rows without partially importing', () => {
  const book = new Excel.Workbook(), notes = book.addWorksheet('Notes');
  notes.addRow(['Field','Explanation']);
  assert.throws(() => readWorksheet(notes), /Cần cột/);
  const sheet = book.addWorksheet('Products');
  sheet.addRow(headers); sheet.addRow(['商品','','','','','bad']);
  assert.throws(() => readWorksheet(sheet), /Dòng 2/);
});

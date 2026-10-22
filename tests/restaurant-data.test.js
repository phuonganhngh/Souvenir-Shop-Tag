import test from 'node:test';
import assert from 'node:assert/strict';
import Excel from 'exceljs';
import { readFile } from 'node:fs/promises';
import { allergenHeaders, nameFields, nameHeaders, parseAllergen, readMenuWorkbook, writeMenuWorkbook } from '../src/restaurant-data.js';
const fixture = new URL('../public/downloads/Restaurant_Menu.xlsx', import.meta.url);
test('latest provided workbook preserves all 222 names and 456 allergy marks, including milk and pork for Panna Cotta', async () => {
  const book = new Excel.Workbook(); await book.xlsx.load(await readFile(fixture));
  const data = readMenuWorkbook(book);
  assert.equal(data['夕食'].length, 92); assert.equal(data['朝食'].length, 130);
  let count = 0;
  for (const [meal, rows] of Object.entries(data)) rows.forEach((p, i) => {
    nameFields.forEach((field, j) => assert.equal(p[field], book.getWorksheet(meal).getCell(i + 2, j + 2).value));
    p.allergens.forEach((value, j) => { assert.equal(value, book.getWorksheet(meal).getCell(i + 2, j + 7).value === '○' ? true : null); if (value) count++; });
    assert.equal(p.confirmed, false);
  });
  assert.equal(count, 456);
  assert.deepEqual(data['夕食'].find(p => p.ja === 'パンナコッタ').allergens.flatMap((v, i) => v === true ? [allergenHeaders[i]] : []), ['乳製品', '豚肉']);
});
test('export and reimport preserve all eleven positions, unentered vs absent, names, and confirmation for both meals', async () => {
  const original = { '朝食': [{ number: 7, ja: 'テスト', en: 'Eggs', ko: '달걀', zh: '鸡蛋', tw: '雞蛋', allergens: [true, false, null, true, null, false, true, null, false, true, true], confirmed: false }], '夕食': [{ number: 8, ja: '確認済み', en: '', ko: '', zh: '', tw: '', allergens: Array(11).fill(false), confirmed: true }] };
  const book = writeMenuWorkbook(new Excel.Workbook(), original), reloaded = new Excel.Workbook(); await reloaded.xlsx.load(await book.xlsx.writeBuffer());
  const result = readMenuWorkbook(reloaded);
  for (const meal of Object.keys(original)) { assert.deepEqual(result[meal][0], { ...original[meal][0], number: String(original[meal][0].number) }); }
  assert.equal(reloaded.getWorksheet('朝食').getCell('J2').value, '○');
  assert.equal(reloaded.getWorksheet('朝食').getCell('I2').value, '');
});
test('matrix follows headers when reordered; unsupported markers and missing columns fail explicitly', () => {
  const book = new Excel.Workbook(), sheet = book.addWorksheet('夕食');
  const headings = ['日本語', ...allergenHeaders.slice().reverse()]; sheet.addRow(headings); sheet.addRow(['順序テスト', ...Array(11).fill('－')]);
  sheet.getCell(2, headings.indexOf('豚肉') + 1).value = '○';
  assert.equal(readMenuWorkbook(book)['夕食'][0].allergens[8], true);
  sheet.getCell(2, 2).value = '不明'; assert.throws(() => readMenuWorkbook(book), /鳥肉/);
  sheet.getCell(1, 2).value = '不正な列'; assert.throws(() => readMenuWorkbook(book), /鳥肉.*列がありません/);
  assert.equal(parseAllergen(''), null); assert.equal(parseAllergen('×'), false); assert.equal(parseAllergen('○'), true);
});

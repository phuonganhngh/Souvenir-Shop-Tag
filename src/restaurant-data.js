export const nameFields = ['ja', 'en', 'ko', 'zh', 'tw'];
export const nameHeaders = ['日本語', 'English', '한국어', '简体中文', '繁體中文（台灣）'];
export const allergenHeaders = ['卵', '小麦', '蕎麦', '乳製品', '落花生', 'カニ', 'エビ', 'くるみ', '豚肉', '牛肉', '鳥肉'];
const normal = value => String(value ?? '').normalize('NFKC').replace(/\s+/g, '').toLowerCase();
export function cellText(value) {
  if (value == null) return '';
  if (typeof value === 'object') {
    if ('formula' in value || 'sharedFormula' in value) {
      if (value.result === undefined) throw new Error('数式の計算結果がありません。Excelで再計算して保存してください。');
      return cellText(value.result);
    }
    if (value.richText) return value.richText.map(run => run.text).join('');
    if ('text' in value) return String(value.text);
    throw new Error('読み取れないセルがあります。文字または数値で入力してください。');
  }
  return String(value).trim();
}
export function parseAllergen(value) {
  const text = normal(cellText(value));
  if (!text) return null;
  if (['○', '〇', '◯', '●', '✓', '✔', '☑', '■', 'x', '1', 'true', 'あり', '有', '有り', '含む', 'はい'].includes(text)) return true;
  if (['×', '-', '－', '—', '0', 'false', 'なし', '無し', '無', '不使用', 'いいえ'].includes(text)) return false;
  throw new Error(`アレルギー欄の「${cellText(value)}」を読み取れません。○・－・空欄で入力してください。`);
}
export function readMenuWorkbook(book) {
  const result = {}, aliases = { 'そば': '蕎麦', 'かに': 'カニ', '蟹': 'カニ', 'えび': 'エビ', '海老': 'エビ', '鶏肉': '鳥肉' };
  let total = 0;
  for (const sheet of book.worksheets) {
    if (!['朝食', '夕食'].includes(sheet.name.trim())) continue;
    const columns = new Map();
    sheet.getRow(1).eachCell((cell, col) => {
      const header = cellText(cell.value);
      const key = normal(aliases[header] || header);
      if (columns.has(key)) throw new Error(`${sheet.name}：見出し「${header}」が重複しています。`);
      columns.set(key, col);
    });
    const required = ['日本語', ...allergenHeaders];
    for (const header of required) if (!columns.has(normal(header))) throw new Error(`${sheet.name}：「${header}」列がありません。`);
    const get = (row, header) => columns.has(normal(header)) ? row.getCell(columns.get(normal(header))).value : null;
    const rows = [];
    sheet.eachRow((row, number) => {
      if (number === 1) return;
      const ja = cellText(get(row, '日本語'));
      if (!ja) {
        if ([...nameHeaders.slice(1), ...allergenHeaders].some(h => cellText(get(row, h)))) throw new Error(`${sheet.name} ${number}行目：日本語の料理名がありません。`);
        return;
      }
      const allergens = allergenHeaders.map(header => {
        try { return parseAllergen(get(row, header)); }
        catch (error) { throw new Error(`${sheet.name} ${number}行目・${header}：${error.message}`); }
      });
      const names = Object.fromEntries(nameFields.map((key, i) => [key, cellText(get(row, nameHeaders[i]))]));
      for (const text of Object.values(names)) if (text.length > 500) throw new Error(`${sheet.name} ${number}行目：料理名は各言語500文字以内で入力してください。`);
      rows.push({ number: cellText(get(row, '番号')) || rows.length + 1, ...names, allergens });
      if (++total > 2000) throw new Error('料理は合計2,000件まで取り込めます。');
    });
    result[sheet.name.trim()] = rows;
  }
  if (!Object.keys(result).length || !total) throw new Error('「朝食」または「夕食」シートに料理データを入力してください。');
  return result;
}
export function writeMenuWorkbook(book, menus) {
  for (const [meal, rows] of Object.entries(menus)) {
    const sheet = book.addWorksheet(meal);
    sheet.addRow(['番号', ...nameHeaders, ...allergenHeaders]);
    rows.forEach((p, i) => sheet.addRow([p.number || i + 1, ...nameFields.map(key => p[key]), ...p.allergens.map(v => v === true ? '○' : v === false ? '－' : '')]));
    sheet.columns.forEach((column, i) => { column.width = i === 0 ? 8 : i < 6 ? 32 : 12; });
    sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF927555' } };
    sheet.views = [{ state: 'frozen', xSplit: 2, ySplit: 1 }];
    sheet.autoFilter = { from: 'A1', to: `Q${Math.max(1, rows.length + 1)}` };
    rows.forEach((p, i) => p.allergens.forEach((value, j) => {
      const cell = sheet.getCell(i + 2, j + 7);
      cell.alignment = { horizontal: 'center' };
      if (value === true) {
        cell.font = { bold: true, color: { argb: 'FF9C0006' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFE4D6' } };
      }
    }));
  }
  return book;
}

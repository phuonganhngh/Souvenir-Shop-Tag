export const fields = ['ja', 'en', 'ko', 'zh', 'tw', 'price', 'note'];
export const headers = ['日本語', 'English', '한국어', '简体中文', '繁體中文（台灣）', '価格 (JPY)', '価格表示・備考'];
export function cellText(value) {
  if (value == null) return '';
  if (typeof value === 'object') {
    if ('result' in value) return cellText(value.result);
    if (value.richText) return value.richText.map(x => x.text).join('');
    if (value.text) return value.text;
    return '';
  }
  return String(value).trim();
}
export function parsePrice(value) {
  const text = cellText(value).replace(/[¥￥,\s]/g, '');
  return /^\d+$/.test(text) && Number.isSafeInteger(Number(text)) ? Number(text) : null;
}
export function validate(product) {
  if (!String(product.ja || '').trim()) return '日本語の商品名を入力してください';
  if (parsePrice(product.price) === null) return '価格は0以上の整数（円）で入力してください';
  return '';
}
export function readWorksheet(sheet) {
  const mapping = {};
  sheet.getRow(1).eachCell((cell, col) => {
    const text = cellText(cell.value).toLowerCase().replace(/\s/g, '');
    const index = headers.findIndex(h => h.toLowerCase().replace(/\s/g, '') === text);
    if (index >= 0) mapping[fields[index]] = col;
  });
  if (!mapping.ja || !mapping.price) throw new Error('1行目に「日本語」と「価格 (JPY)」の列が必要です。Excelテンプレートで見出しを確認してください。');
  if (sheet.rowCount > 2001) throw new Error('1シートにつき商品は最大2,000行です。リストを分割してください。');
  const products = [], errors = [];
  sheet.eachRow((row, number) => {
    if (number === 1) return;
    const product = Object.fromEntries(fields.map(key => [key, mapping[key] ? cellText(row.getCell(mapping[key]).value) : '']));
    if (Object.values(product).every(x => !x)) return;
    const error = validate(product);
    if (error) errors.push(`${number}行目：${error}`);
    products.push(product);
  });
  if (errors.length) throw new Error(errors.slice(0, 8).join('\n') + (errors.length > 8 ? `\n…ほか${errors.length - 8}件のエラー` : ''));
  if (!products.length) throw new Error('シートに商品がありません。');
  return products;
}

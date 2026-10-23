import '@fontsource-variable/noto-sans-jp';
import '@fontsource-variable/noto-sans-kr';
import '@fontsource-variable/noto-sans-sc';
import '@fontsource-variable/noto-sans-tc';
import './style.css';
import { renderSelectedPreview } from './preview.js';
import { tagNavigation } from './navigation.js';
import sample from './sample.json';
import tagTemplate from './assets/souvenir-template.png';
import { fields, headers, parsePrice, validate, readWorksheet } from './data.js';

const $ = selector => document.querySelector(selector);
const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const isPortable = __PORTABLE_BUILD__;
const uid = () => crypto.randomUUID();
const makeProducts = rows => rows.map(p => ({ ...p, id: uid(), selected: true, quantity: 1 }));
let products = makeProducts(sample), activeId = products[0].id, workbook, storageWarning = false;
let settings = { width: 77, height: 55 };
try {
  const saved = JSON.parse(localStorage.getItem('tag-studio-v1'));
  if (saved?.products?.length) {
    products = saved.products;
    const sizeMap = { '90,55':[77,55], '100,60':[91,65], '180,110':[154,110], '77,55':[77,55], '91,65':[91,65], '154,110':[154,110] };
    const [width, height] = sizeMap[`${saved.settings?.width},${saved.settings?.height}`] || [77,55];
    settings = { width, height };
    activeId = products[0].id;
  }
} catch { storageWarning = true; }

document.querySelector('#app').innerHTML = `
<header class="topbar tag-header">${tagNavigation('shop')}<button id="logout" class="button ghost" hidden>ログアウト</button></header>
<main>
  <section class="heading"><div><p class="eyebrow">売店用プライスタグ</p><h1>プライスタグを、<br class="mobile-break">かんたんに。</h1></div></section>

  <div id="notice" class="notice" role="status" hidden></div>
  <div class="workspace">
    <section class="panel data-panel">
      <div class="section-heading"><div><span class="section-number">01</span><h2>商品リスト</h2></div><span id="total" class="pill"></span></div>
<div class="list-instructions"><p><strong>一括追加：</strong>Excelリストをアップロードしてください。ChatGPTまたはGeminiで翻訳し、ChatGPTで翻訳した場合はGeminiで、Geminiで翻訳した場合はChatGPTで照合してください。</p><p><strong>手入力での追加・編集：</strong>「商品を編集」で行えます。</p></div>
      <label class="upload-zone" id="drop-zone" for="excel-input"><span class="upload-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.3" aria-hidden="true"><path d="M12 16V3m-5 5 5-5 5 5M4 15v5a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-5"/></svg></span><strong>Excelファイルを取り込む</strong><span>ファイルをドラッグするか、<u>端末から選択</u></span><small>.xlsx · 最大5 MB・2,000商品</small><input id="excel-input" type="file" accept=".xlsx" hidden></label>
      <div class="upload-options"><button id="template" class="text-button">↓ Excelテンプレート</button></div>

      <div class="list-toolbar"><label class="search">⌕ <input id="search" placeholder="商品名を検索…" aria-label="商品を検索"></label></div>
      <div class="list-columns"><label><input type="checkbox" id="select-all" checked aria-label="すべて選択"> 商品</label><span>価格 / 部数</span></div>
      <div id="product-list" class="product-list"></div>
      <div class="list-footer"><span id="selected-summary"></span><button id="delete" class="text-button danger">編集中の商品を削除</button></div>
      <section class="editor" aria-labelledby="editor-title"><div class="editor-heading"><h3 id="editor-title">商品を編集</h3><button id="new-entry" class="text-button" type="button">新規入力</button></div><form id="edit-form"><div class="form-grid">${fields.map((key, i) => `<label class="${key === 'ja' ? 'wide' : ''}">${['日本語の商品名 *','英語','韓国語','中国語（簡体字）','中国語（繁体字）','販売価格（円）*','税表示・備考'][i]}<input name="${key}" ${key === 'price' ? 'inputmode="numeric"' : ''} placeholder="${key === 'note' ? '例：税込・各種（未確認の場合は空欄）' : ''}"></label>`).join('')}</div><p class="form-hint">商品名と翻訳はExcelの内容をそのまま使用します。自動翻訳や税表示の自動追加は行いません。</p></form><button id="export" type="button" class="button">↓ 編集した商品リストをExcelに書き出す</button></section>
    </section>
    <aside class="preview-column">
      <section class="panel preview-panel"><div class="section-heading"><div><span class="section-number">02</span><h2>タグのプレビュー</h2></div><span class="live"><i></i> 編集中</span></div><div class="preview-stage"><div id="preview" role="region" aria-label="選択した商品のプレビュー" tabindex="0"></div></div></section>
      <section class="panel settings-panel"><div class="section-heading"><div><span class="section-number">03</span><h2>印刷設定</h2></div><span class="pill">A4</span></div>
        <label class="field">タグのサイズ<select id="size"><option value="77,55">77 × 55 mm · 原寸 · 1ページ8枚</option><option value="91,65">91 × 65 mm · 1ページ8枚</option><option value="154,110">154 × 110 mm · 1ページ2枚</option></select></label>

        <div class="print-summary"><span id="print-count"></span><small>A4・縦向き・倍率100%</small></div><button id="print" class="button primary full">▣ &nbsp; 印刷・PDF保存</button><p class="print-hint">印刷画面で「PDFに保存」を選択してください。<br>背景のグラフィックを有効、ヘッダーとフッターを無効にしてください。</p>
      </section>
      <p class="privacy-note">♧ &nbsp; Excelの読み込み・編集・印刷は端末内で処理します。<br>商品データを外部サービスに送信しません。</p>
    </aside>
  </div>
  <footer><span>登別グランドホテル</span></footer>
</main><div id="print-pages" aria-hidden="true"></div>
`;

function notify(message, error = false) {
  $('#notice').textContent = message;
  $('#notice').classList.toggle('error', error);
  $('#notice').hidden = false;
}
function save() {
  try { localStorage.setItem('tag-studio-v1', JSON.stringify({ products, settings })); }
  catch { if (!storageWarning) notify('ブラウザーにデータを保存できません。商品リストをExcelに書き出してください。', true); storageWarning = true; }
}
function active() { return products.find(p => p.id === activeId); }
function copies() { return products.filter(p => p.selected).reduce((sum, p) => sum + p.quantity, 0); }
function perPage() { return Math.floor((190 + 4) / (settings.width + 4)) * Math.floor((277 + 4) / (settings.height + 4)); }
function tag(product) {
  const error = validate(product);
  return `<article class="tag" style="aspect-ratio:${settings.width}/${settings.height}"><img class="tag-background" src="${escape(tagTemplate)}" alt="" aria-hidden="true"><div class="tag-content"><div class="names"><div class="ja">${escape(product.ja)}</div>${['en','ko','zh','tw'].map(key => `<div class="translation" lang="${{en:'en',ko:'ko',zh:'zh-CN',tw:'zh-TW'}[key]}">${escape(product[key])}</div>`).join('')}</div><div class="tag-price">${error ? '<span class="invalid-price">入力内容を確認</span>' : `¥${parsePrice(product.price).toLocaleString('ja-JP')}`}</div>${product.note ? `<div class="tax">${escape(product.note)}</div>` : ''}</div></article>`;
}
function fitTags(root) {
  let valid = true;
  for (const content of root.querySelectorAll('.tag-content')) {
    content.style.setProperty('--name-scale', '1');
    let scale = 1;
    while (content.scrollHeight > content.clientHeight + 1 && scale > .55) {
      scale = Math.round((scale - .05) * 100) / 100;
      content.style.setProperty('--name-scale', String(scale));
    }
    if (content.scrollHeight > content.clientHeight + 1) valid = false;
  }
  return valid;
}
function renderPreview() {
  renderSelectedPreview($('#preview'), products.filter(p => p.selected), activeId, tag,
    `<article class="tag" style="aspect-ratio:${settings.width}/${settings.height}"><img class="tag-background" src="${escape(tagTemplate)}" alt="" aria-hidden="true"></article>`);
  const n = copies();
  $('#print-count').textContent = `${n}枚・A4 ${Math.ceil(n / perPage())}ページ`;
  $('#selected-summary').textContent = `${products.filter(p => p.selected).length}商品を選択・合計${n}枚`;
  $('#print').disabled = n === 0;
  requestAnimationFrame(() => fitTags($('#preview')));
}
function renderList() {
  const query = $('#search').value.toLocaleLowerCase();
  const filtered = products.filter(p => fields.some(f => String(p[f]).toLocaleLowerCase().includes(query)));
  $('#total').textContent = `${products.length}商品`;
  $('#product-list').innerHTML = filtered.map(p => `<div class="product-row ${p.id === activeId ? 'active' : ''}" data-id="${p.id}"><input type="checkbox" data-action="select" aria-label="${escape(p.ja || '新しい商品')}を選択" ${p.selected ? 'checked' : ''}><button class="product-name" data-action="edit"><strong>${escape(p.ja || '新しい商品')}</strong><small>${escape(validate(p) || p.en || 'クリックして編集')}</small></button><span class="row-price">${parsePrice(p.price) !== null ? '¥' + parsePrice(p.price).toLocaleString('ja-JP') : '—'}</span><input type="number" class="quantity" data-action="quantity" min="1" max="100" value="${p.quantity}" aria-label="${escape(p.ja)}の部数"></div>`).join('') || '<p class="empty">該当する商品がありません。</p>';
  $('#select-all').checked = products.length > 0 && products.every(p => p.selected);
  $('#select-all').indeterminate = products.some(p => p.selected) && !products.every(p => p.selected);
  renderPreview();
}
function renderEditor() {
  const product = active();
  for (const key of fields) {
    const input = $('#edit-form').elements.namedItem(key);
    input.value = product?.[key] || '';
    input.disabled = !product;
  }
  $('#delete').disabled = !product;
}
function refresh() { renderList(); renderEditor(); save(); }

$('#edit-form').addEventListener('submit', e => e.preventDefault());
$('#edit-form').addEventListener('input', e => {
  if (!active()) return;
  active()[e.target.name] = e.target.value;
  renderList(); save();
});
$('#product-list').addEventListener('click', e => {
  const button = e.target.closest('[data-action="edit"]');
  if (button) { activeId = button.closest('[data-id]').dataset.id; renderList(); renderEditor(); }
});
$('#product-list').addEventListener('change', e => {
  const row = e.target.closest('[data-id]');
  if (!row) return;
  const p = products.find(p => p.id === row.dataset.id);
  if (e.target.dataset.action === 'select') { p.selected = e.target.checked; if (p.selected) activeId = p.id; }
  if (e.target.dataset.action === 'quantity') p.quantity = Math.min(100, Math.max(1, Math.floor(Number(e.target.value) || 1)));
  renderList(); renderEditor(); save();
});
$('#search').addEventListener('input', renderList);
$('#select-all').addEventListener('change', e => { products.forEach(p => { p.selected = e.target.checked; }); refresh(); });
$('#new-entry').addEventListener('click', () => {
  if (products.length >= 2000) return notify('商品は最大2,000件まで登録できます。', true);
  const p = makeProducts([Object.fromEntries(fields.map(f => [f, '']))])[0];
  products.unshift(p); activeId = p.id; $('#search').value = ''; refresh();
  $('#edit-form').elements.namedItem('ja').focus();
});
$('#delete').addEventListener('click', () => {
  const p = active();
  if (!p || !confirm(`「${p.ja || '新しい商品'}」を削除しますか？`)) return;
  products = products.filter(item => item.id !== activeId); activeId = products[0]?.id; refresh();
});
function replaceProducts(rows) {
  products = makeProducts(rows); activeId = products[0].id; $('#search').value = ''; refresh();
  notify(`${products.length}商品を取り込みました。印刷前に内容を確認してください。`);
}
let excelPromise;
async function excel() { excelPromise ||= import('exceljs').then(m => m.default); return excelPromise; }
async function loadExcel(file) {
  if (!file) return;
  if (!/\.xlsx$/i.test(file.name)) return notify('.xlsx ファイルを選択してください。.xls の場合は、Excelで .xlsx 形式に保存し直してください。', true);
  if (file.size > 5 * 1024 * 1024) return notify('ファイルサイズが5 MBを超えています。ファイルを分割して再度お試しください。', true);
  notify('Excelを読み込んでいます…');
  try {
    const Excel = await excel();
    const next = new Excel.Workbook();
    await next.xlsx.load(await file.arrayBuffer());
    if (!next.worksheets.length) throw new Error('ファイルにシートがありません。');
    const sheet = next.worksheets.find(s => ['商品一覧','Multilingual Products','Product List'].includes(s.name)) || next.worksheets[0];
    replaceProducts(readWorksheet(sheet));
  } catch { notify('Excelを読み込めません。パスワード保護やファイルの破損を確認し、.xlsx 形式で保存し直してください。', true); }
}
$('#excel-input').addEventListener('change', async e => { await loadExcel(e.target.files[0]); e.target.value = ''; });
for (const name of ['dragover','dragleave','drop']) $('#drop-zone').addEventListener(name, e => {
  e.preventDefault(); $('#drop-zone').classList.toggle('dragging', name === 'dragover');
  if (name === 'drop') loadExcel(e.dataTransfer.files[0]);
});
async function downloadExcel(rows, filename) {
  try {
    const Excel = await excel(), book = new Excel.Workbook(), sheet = book.addWorksheet('商品一覧');
    sheet.addRow(['番号', ...headers]);
    rows.forEach((p, i) => sheet.addRow([i + 1, ...fields.map(key => key === 'price' && parsePrice(p[key]) !== null ? parsePrice(p[key]) : p[key])]));
    sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    sheet.getRow(1).fill = { type:'pattern', pattern:'solid', fgColor: { argb:'FF927555' } };
    sheet.columns.forEach((col, i) => { col.width = i === 0 ? 7 : i === 6 ? 16 : 32; });
    const url = URL.createObjectURL(new Blob([await book.xlsx.writeBuffer()], {type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}));
    const a = document.createElement('a'); a.href = url; a.download = filename; a.click(); setTimeout(() => URL.revokeObjectURL(url), 10000);
  } catch { notify('Excelファイルを作成できません。もう一度お試しください。', true); }
}
$('#template').addEventListener('click', () => downloadExcel(sample.slice(0, 1), '商品リスト_テンプレート.xlsx'));
$('#export').addEventListener('click', () => downloadExcel(products, '商品リスト.xlsx'));
$('#size').value = `${settings.width},${settings.height}`;
$('#size').addEventListener('change', e => { [settings.width, settings.height] = e.target.value.split(',').map(Number); renderPreview(); save(); });
async function printTags() {
  const selected = products.filter(p => p.selected), invalid = selected.find(p => validate(p));
  if (invalid) return notify(`「${invalid.ja || '新しい商品'}」を印刷できません：${validate(invalid)}。`, true);
  if (!copies()) return notify('印刷する商品を1件以上選択してください。', true);
  if (copies() > 1000) return notify('1回に印刷できるのは最大1,000枚です。部数を減らすか、商品を分けて印刷してください。', true);
  const tags = selected.flatMap(p => Array.from({length:p.quantity}, () => p));
  const count = perPage();
  let html = '';
  for (let i = 0; i < tags.length; i += count) html += `<section class="print-page" style="--tag-width:${settings.width}mm;--tag-height:${settings.height}mm;grid-template-columns:repeat(${Math.floor(194 / (settings.width + 4))},${settings.width}mm)">${tags.slice(i, i + count).map(tag).join('')}</section>`;
  $('#print-pages').innerHTML = html;
  $('#print-pages').classList.add('preparing');
  await new Promise(resolve => requestAnimationFrame(resolve));
  await document.fonts.ready;
  await Promise.all([...$('#print-pages').querySelectorAll('img')].map(img => img.decode().catch(() => {})));
  const fits = fitTags($('#print-pages'));
  $('#print-pages').classList.remove('preparing');
  if (!fits) return notify('タグに収まらない内容があります。商品名や備考を短くし、印刷前に内容を確認してください。', true);
  window.print();
}
$('#print').addEventListener('click', printTags);
refresh();
new ResizeObserver(() => fitTags($('#preview'))).observe($('#preview'));
document.fonts.ready.then(() => fitTags($('#preview')));
if (storageWarning) notify('このブラウザーではデータの保存が制限されています。画面を閉じる前にExcelに書き出してください。', true);

if (!isPortable && location.protocol !== 'file:') {
  fetch('/api/session?status=1').then(response => response.json()).then(status => {
    $('#logout').hidden = !status.authenticated;
  }).catch(() => {});
}
$('#logout').addEventListener('click', async () => {
  try {
    const response = await fetch('/api/session', {method:'DELETE'});
    if (!response.ok) throw new Error();
    location.reload();
  } catch { notify('ログアウトできません。接続を確認して再度お試しください。', true); }
});

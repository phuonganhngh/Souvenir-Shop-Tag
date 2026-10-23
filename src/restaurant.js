import '@fontsource-variable/noto-sans-jp';
import '@fontsource-variable/noto-sans-kr';
import '@fontsource-variable/noto-sans-sc';
import '@fontsource-variable/noto-sans-tc';
import './style.css';
import './restaurant.css';
import { renderSelectedPreview } from './preview.js';
import { tagNavigation } from './navigation.js';
import { deleteSelected, restoreDeleted, readDeletionHistory } from './deletion.js';
import template from './assets/restaurant-template.png';
import initialMenu from './restaurant-menu.json';
import { nameFields, nameHeaders, allergenHeaders, readMenuWorkbook, writeMenuWorkbook } from './restaurant-data.js';

const inputExamples = { ja: '茶碗蒸し', en: 'Chawanmushi (Steamed Egg Custard)', ko: '일본식 계란찜', zh: '日式茶碗蒸', tw: '日式茶碗蒸' };
const $ = selector => document.querySelector(selector);
const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const storageKey = 'restaurant-tags-menu-20261022-72ec5f55';
const sourceCountLabel = Object.entries(initialMenu).map(([name, items]) => `${name}${items.length}品`).join('・');
const makeMenus = input => Object.fromEntries(Object.entries(input).map(([meal, rows]) => [meal, rows.map(p => ({ ...p, allergens: [...p.allergens], id: crypto.randomUUID(), selected: true, quantity: 1 }))]));
let deletionHistory = {};
let menus = makeMenus(initialMenu), meal = '夕食', activeId, editingId, settings = { width: 91, height: 65 }, storageWarning = false;
try {
  const saved = JSON.parse(localStorage.getItem(storageKey));
  if (saved?.menus && Object.values(saved.menus).every(rows => Array.isArray(rows) && rows.every(p => typeof p.ja === 'string' && p.allergens?.length === 11 && p.allergens.every(v => v === null || typeof v === 'boolean') && typeof p.id === 'string' && Number.isInteger(p.quantity) && p.quantity >= 1 && p.quantity <= 100))) {
    menus = saved.menus;
    deletionHistory = Object.fromEntries(Object.keys(menus).map(name => [name, readDeletionHistory(saved.deletionHistory?.[name])]));
    meal = saved.meal in menus ? saved.meal : Object.keys(menus)[0];
    if (['77,55', '91,65', '154,110'].includes(`${saved.settings?.width},${saved.settings?.height}`)) settings = saved.settings;
  }
} catch { storageWarning = true; }
activeId = menus[meal]?.[0]?.id;
document.body.classList.add('restaurant-app');
$('#app').innerHTML = `
<header class="topbar tag-header">${tagNavigation('restaurant')}</header>
<main><section class="heading"><div><p class="eyebrow">レストラン用・アレルギー表示</p><h1>料理タグを、かんたんに。</h1><p>朝食・夕食のメニューから、5言語の料理名と11項目のアレルギー表示をまとめて印刷。</p></div></section>
<div id="notice" class="notice" role="status" hidden></div>
<div class="workspace"><section class="panel data-panel">
<div class="section-heading"><div><span class="section-number">01</span><h2>メニューとアレルギー</h2></div><span id="total" class="pill"></span></div>
<div class="list-instructions"><p><strong>一括追加：</strong>Excelリストをアップロードしてください。ChatGPTまたはGeminiで翻訳し、ChatGPTで翻訳した場合はGeminiで、Geminiで翻訳した場合はChatGPTで照合してください。</p><p><strong>手入力での追加・編集：</strong>「料理名・アレルギーを編集」で行えます。自動翻訳機能はありません。</p></div>
<label class="upload-zone" id="drop-zone" for="excel-input"><span class="upload-icon">↑</span><strong>メニューExcelを取り込む</strong><span>ドラッグするか、<u>端末から選択</u></span><small>.xlsx · 最大5 MB・合計2,000品</small><input id="excel-input" type="file" accept=".xlsx" hidden></label>
<div class="upload-options"><a class="text-button" href="./downloads/Restaurant_Menu.xlsx" download>↓ 最新のメニューExcel</a><button id="restore-source" class="text-button" type="button">元メニュー（${sourceCountLabel}）を読み込む</button></div>
<div class="meal-tabs" role="group" aria-label="メニューの区分" id="meal-tabs"></div>
<div class="list-toolbar"><label class="search">⌕ <input id="search" placeholder="料理名を検索…" aria-label="料理を検索"></label></div>
<div class="list-columns"><label><input type="checkbox" id="select-all" aria-label="この区分をすべて選択">料理</label><span>部数</span></div>
<div id="product-list" class="product-list"></div><div class="list-footer"><span id="selected-summary"></span><div class="list-actions"><button id="delete" class="text-button danger" type="button">選択した料理を削除</button><button id="undo" class="text-button" type="button" disabled>元に戻す</button></div></div>
<section class="editor" aria-labelledby="editor-title"><div class="editor-heading"><h3 id="editor-title">料理名・アレルギーを編集</h3><button id="new-entry" class="text-button" type="button">新規入力</button></div><form id="edit-form"><div class="form-grid">${nameFields.map((key, i) => `<label class="${key === 'ja' ? 'wide' : ''}">${nameHeaders[i]}${key === 'ja' ? ' *' : ''}<input name="${key}" maxlength="500" placeholder="例：${escape(inputExamples[key])}"></label>`).join('')}</div>
<fieldset class="allergen-editor"><legend>含まれる項目にチェック</legend>${allergenHeaders.map((label, i) => `<label><input type="checkbox" name="allergen-${i}" data-allergen="${i}">${label}</label>`).join('')}</fieldset>
</form>
<button id="export" type="button" class="button full">↓ 編集した全メニューをExcelに書き出す</button><p class="form-hint export-hint">追加・編集した内容を保存するには、新しいExcelファイルとして書き出してください。</p></section>
</section>
<aside class="preview-column"><section class="panel preview-panel"><div class="section-heading"><div><span class="section-number">02</span><h2>タグのプレビュー</h2></div></div><div class="preview-stage"><div id="preview" role="region" aria-label="選択した料理のプレビュー" tabindex="0"></div></div></section>
<section class="panel settings-panel"><div class="section-heading"><div><span class="section-number">03</span><h2>印刷設定</h2></div><span class="pill">A4</span></div>
<label class="field">タグのサイズ<select id="size"><option value="77,55">77 × 55 mm · 1ページ8枚</option><option value="91,65">91 × 65 mm · 1ページ8枚</option><option value="154,110">154 × 110 mm · 1ページ2枚</option></select></label>
<p class="scope-note">表示中の区分で選択した料理を印刷します。Excelの書き出しには朝食・夕食の両方を含めます。</p>
<div class="print-summary"><span id="print-count"></span><small>A4・縦向き・倍率100%</small></div><button id="print" class="button primary full">▣ 印刷・PDF保存</button><p class="print-hint">ヘッダー・フッターは無効、倍率は100%にします。</p></section>
<p class="privacy-note">Excelの取り込み・編集・印刷は端末内で処理します。<br>売店タグとは別に、このブラウザーに自動保存されます。</p></aside></div>
<footer>登別グランドホテル</footer></main><div id="print-pages" aria-hidden="true"></div>
`;
function notify(text, error = false) { $('#notice').textContent = text; $('#notice').classList.toggle('error', error); $('#notice').hidden = false; }
function save() {
  try { localStorage.setItem(storageKey, JSON.stringify({ menus, meal, settings, deletionHistory })); }
  catch { if (!storageWarning) notify('端末に保存できません。画面を閉じる前にExcelに書き出してください。', true); storageWarning = true; }
}
const rows = () => menus[meal] || [];
const active = () => rows().find(p => p.id === activeId);
const editing = () => rows().find(p => p.id === editingId);
const selected = () => rows().filter(p => p.selected);
const copies = () => selected().reduce((n, p) => n + p.quantity, 0);
const perPage = () => Math.floor(194 / (settings.width + 4)) * Math.floor(281 / (settings.height + 4));
function tag(p) {
  return `<article class="tag restaurant-tag" style="aspect-ratio:909/649"><img class="tag-background" src="${escape(template)}" alt="" aria-hidden="true"><div class="dish-names"><div class="dish-ja" lang="ja">${escape(p.ja)}</div>${['en','ko','zh','tw'].map(key => `<div class="dish-translation" lang="${{en:'en',ko:'ko',zh:'zh-CN',tw:'zh-TW'}[key]}">${escape(p[key])}</div>`).join('')}</div><div class="allergen-marks" role="img" aria-label="${escape(p.allergens.flatMap((v, i) => v === true ? [allergenHeaders[i]] : []).join('、') || 'チェックなし')}">${p.allergens.map((value, i) => value === true ? `<span class="allergen-mark" data-allergen="${i}" style="--mark-x:${[192.5, 252.5, 312.5, 371.5, 431, 491.5, 551, 610.5, 670, 730, 789][i] / 909 * 100}%" title="${allergenHeaders[i]}"></span>` : '').join('')}</div></article>`;
}
function fitTags(root) {
  let fits = true;
  root.querySelectorAll('.dish-names').forEach(box => {
    let scale = 1; box.style.setProperty('--dish-scale', scale);
    while ((box.scrollHeight > box.clientHeight + 1 || box.scrollWidth > box.clientWidth + 1) && scale > .28) { scale = Math.round((scale - .04) * 100) / 100; box.style.setProperty('--dish-scale', scale); }
    if (box.scrollHeight > box.clientHeight + 1 || box.scrollWidth > box.clientWidth + 1) fits = false;
  });
  return fits;
}
function renderPreview() {
  renderSelectedPreview($('#preview'), selected(), activeId, tag,
    `<article class="tag restaurant-tag" style="aspect-ratio:909/649"><img class="tag-background" src="${escape(template)}" alt="" aria-hidden="true"></article>`);
  $('#print-count').textContent = `${meal} ${copies()}枚・A4 ${Math.ceil(copies() / perPage())}ページ`;
  $('#selected-summary').textContent = `${selected().length}品を選択・合計${copies()}枚`;
  $('#print').disabled = !copies();
  $('#delete').disabled = !selected().length;
  $('#undo').disabled = !deletionHistory[meal]?.length;
  requestAnimationFrame(() => fitTags($('#preview')));
}
function renderList() {
  const query = $('#search').value.toLocaleLowerCase();
  $('#total').textContent = `全${Object.values(menus).reduce((n, a) => n + a.length, 0)}品`;
  $('#meal-tabs').innerHTML = Object.entries(menus).map(([name, items]) => `<button class="button ${meal === name ? 'primary' : ''}" data-meal="${escape(name)}" aria-pressed="${meal === name}">${escape(name)} <span>${items.length}品</span></button>`).join('');
  $('#product-list').innerHTML = rows().filter(p => nameFields.some(key => String(p[key] || '').toLocaleLowerCase().includes(query))).map(p => `<div class="product-row ${activeId === p.id ? 'active' : ''}" data-id="${p.id}"><input type="checkbox" data-action="select" aria-label="${escape(p.ja || '新しい料理')}を選択" ${p.selected ? 'checked' : ''}><button class="product-name" data-action="edit"><strong>${escape(p.ja || '新しい料理')}</strong><small>${escape(p.en)}</small></button><input type="number" class="quantity" data-action="quantity" value="${p.quantity}" min="1" max="100" aria-label="${escape(p.ja)}の部数"></div>`).join('') || '<p class="empty">料理がありません。</p>';
  $('#select-all').checked = rows().length > 0 && rows().every(p => p.selected);
  $('#select-all').indeterminate = rows().some(p => p.selected) && !rows().every(p => p.selected);
  renderPreview();
}
function renderEditor() {
  const p = editing();
  nameFields.forEach(key => { const input = $('#edit-form').elements.namedItem(key); input.value = p?.[key] || ''; input.disabled = false; });
  $('#edit-form').querySelectorAll('[data-allergen]').forEach(input => { input.checked = p?.allergens[Number(input.dataset.allergen)] === true; input.disabled = false; });
}
function refresh() { renderList(); renderEditor(); save(); }
$('#meal-tabs').addEventListener('click', e => {
  const button = e.target.closest('[data-meal]'); if (!button) return;
  meal = button.dataset.meal; editingId = undefined; activeId = rows()[0]?.id; $('#search').value = ''; refresh();
});
$('#search').addEventListener('input', renderList);
$('#select-all').addEventListener('change', e => { editingId = undefined; rows().forEach(p => p.selected = e.target.checked); refresh(); });
$('#product-list').addEventListener('click', e => { const button = e.target.closest('[data-action="edit"]'); if (button) { activeId = editingId = button.closest('[data-id]').dataset.id; renderList(); renderEditor(); } });
$('#product-list').addEventListener('change', e => {
  const p = rows().find(p => p.id === e.target.closest('[data-id]')?.dataset.id); if (!p) return;
  if (e.target.dataset.action === 'select') { p.selected = e.target.checked; editingId = undefined; if (p.selected) activeId = p.id; }
  if (e.target.dataset.action === 'quantity') p.quantity = Math.max(1, Math.min(100, Math.floor(Number(e.target.value) || 1)));
  renderList(); renderEditor(); save();
});
$('#edit-form').addEventListener('submit', e => e.preventDefault());
$('#edit-form').addEventListener('input', e => {
  if (!nameFields.includes(e.target.name) && e.target.dataset.allergen === undefined) return;
  const p = editing() || createEntry(); if (!p) return;
  if (nameFields.includes(e.target.name)) p[e.target.name] = e.target.value;
  else if (e.target.dataset.allergen !== undefined) p.allergens[Number(e.target.dataset.allergen)] = e.target.checked;
  renderList(); save();
});
function createEntry() {
  if (Object.values(menus).reduce((n, a) => n + a.length, 0) >= 2000) { notify('料理は合計2,000品まで登録できます。', true); return null; }
  const p = makeMenus({ [meal]: [{ ...Object.fromEntries(nameFields.map(k => [k, ''])), allergens: Array(11).fill(null) }] })[meal][0];
  rows().unshift(p); activeId = editingId = p.id; $('#search').value = '';
  return p;
}
$('#new-entry').addEventListener('click', () => {
  if (!createEntry()) return;
  refresh(); $('#edit-form').elements.namedItem('ja').focus();
});
$('#delete').addEventListener('click', () => {
  const count = selected().length;
  if (!count || !confirm(`${meal}の選択した${count}品を削除しますか？削除後は「元に戻す」で復元できます。`)) return;
  const result = deleteSelected(rows());
  (deletionHistory[meal] ||= []).push(result.action); menus[meal] = result.rows;
  if (!active()) activeId = rows()[0]?.id;
  if (!editing()) editingId = undefined;
  refresh(); notify(`${meal}の${count}品を削除しました。「元に戻す」で復元できます。`);
});
$('#undo').addEventListener('click', () => {
  const action = deletionHistory[meal]?.pop(); if (!action) return;
  menus[meal] = restoreDeleted(rows(), action); activeId = action.entries[0].item.id;
  $('#search').value = ''; refresh(); notify(`${meal}の${action.entries.length}品を元に戻しました。`);
});
let excelPromise;
const excel = () => excelPromise ||= import('exceljs').then(m => m.default);
async function loadExcel(file) {
  if (!file) return;
  if (!/\.xlsx$/i.test(file.name) || file.size > 5 * 1024 * 1024) return notify('5 MB以下の .xlsx ファイルを選択してください。', true);
  notify('Excelを読み込んでいます…');
  try {
    const Excel = await excel(), book = new Excel.Workbook(); await book.xlsx.load(await file.arrayBuffer());
    const next = readMenuWorkbook(book);
    if (!confirm('取り込むExcelで朝食・夕食のリスト全体を置き換えます。未保存の編集内容は失われます。続けますか？')) return notify('取り込みをキャンセルしました。');
    deletionHistory = {}; editingId = undefined; menus = makeMenus(next); meal = meal in menus ? meal : Object.keys(menus)[0]; activeId = rows()[0]?.id; $('#search').value = ''; refresh();
    notify(`${Object.values(menus).reduce((n, a) => n + a.length, 0)}品を取り込みました。アレルギー表示を確認してください。`);
  } catch (error) { notify(`取り込みできません：${error.message}`, true); }
}
$('#restore-source').addEventListener('click', () => {
  if (!confirm(`現在の朝食・夕食のリストを元メニュー（${sourceCountLabel}）で置き換えます。追加・編集した内容を残す場合は、先にExcelに書き出してください。続けますか？`)) return;
  deletionHistory = {}; editingId = undefined; menus = makeMenus(initialMenu);
  if (!(meal in menus)) meal = Object.keys(menus)[0];
  activeId = rows()[0]?.id; $('#search').value = ''; refresh();
  notify(`元メニューを読み込みました。${sourceCountLabel}。`);
});
$('#excel-input').addEventListener('change', async e => { await loadExcel(e.target.files[0]); e.target.value = ''; });
for (const event of ['dragover', 'dragleave', 'drop']) $('#drop-zone').addEventListener(event, e => { e.preventDefault(); $('#drop-zone').classList.toggle('dragging', event === 'dragover'); if (event === 'drop') loadExcel(e.dataTransfer.files[0]); });
$('#export').addEventListener('click', async () => {
  try {
    const Excel = await excel(), book = writeMenuWorkbook(new Excel.Workbook(), menus);
    const url = URL.createObjectURL(new Blob([await book.xlsx.writeBuffer()], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
    const a = document.createElement('a'); a.href = url; a.download = 'レストランメニュー.xlsx'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 10000);
  } catch { notify('Excelを書き出せません。もう一度お試しください。', true); }
});
$('#size').value = `${settings.width},${settings.height}`;
$('#size').addEventListener('change', e => { [settings.width, settings.height] = e.target.value.split(',').map(Number); renderPreview(); save(); });
async function printTags() {
  const items = selected(); if (!copies()) return;
  if (items.some(p => !p.ja.trim())) return notify('日本語の料理名が空欄です。', true);
  if (copies() > 1000) return notify('1回に印刷できるのは1,000枚までです。', true);
  const tags = items.flatMap(p => Array.from({ length: p.quantity }, () => p)), n = perPage();
  let html = '';
  for (let i = 0; i < tags.length; i += n) html += `<section class="print-page" style="--tag-width:${settings.width}mm;--tag-height:${settings.height}mm;grid-template-columns:repeat(${Math.floor(194 / (settings.width + 4))},${settings.width}mm)">${tags.slice(i, i + n).map(tag).join('')}</section>`;
  const root = $('#print-pages'); root.innerHTML = html; root.classList.add('preparing');
  await new Promise(resolve => requestAnimationFrame(resolve)); await document.fonts.ready;
  try { await Promise.all([...root.querySelectorAll('img')].map(img => img.decode())); }
  catch { root.classList.remove('preparing'); return notify('背景画像を読み込めません。再読み込みしてください。', true); }
  const fits = fitTags(root); root.classList.remove('preparing');
  if (!fits) return notify('料理名が枠に収まりません。名前を短くして再度お試しください。', true);
  window.print();
}
$('#print').addEventListener('click', printTags);
refresh(); new ResizeObserver(() => fitTags($('#preview'))).observe($('#preview')); document.fonts.ready.then(() => fitTags($('#preview')));
if (storageWarning) notify('端末への保存が制限されています。編集後はExcelに書き出してください。', true);

if (!storageWarning && Object.entries(initialMenu).some(([name, items]) => menus[name]?.length !== items.length)) {
  const currentCounts = Object.entries(menus).map(([name, items]) => `${name}${items.length}品`).join('・');
  notify(`この端末に保存したメニュー（${currentCounts}）を表示しています。元メニューは${sourceCountLabel}です。「元メニューを読み込む」で元の一覧に戻せます。`);
}

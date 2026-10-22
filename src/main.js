import '@fontsource-variable/noto-sans-jp';
import '@fontsource-variable/noto-sans-kr';
import '@fontsource-variable/noto-sans-sc';
import '@fontsource-variable/noto-sans-tc';
import './style.css';
import sample from './sample.json';
import fixedLogo from './assets/hotel-logo.png';
import { fields, headers, parsePrice, validate, readWorksheet } from './data.js';

const $ = selector => document.querySelector(selector);
const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const uid = () => crypto.randomUUID();
const makeProducts = rows => rows.map(p => ({ ...p, id: uid(), selected: true, quantity: 1 }));
let products = makeProducts(sample), activeId = products[0].id, workbook, storageWarning = false;
let settings = { width: 90, height: 55, pattern: true };
try {
  const saved = JSON.parse(localStorage.getItem('tag-studio-v1'));
  if (saved?.products?.length) {
    products = saved.products;
    settings = { width: saved.settings?.width || 90, height: saved.settings?.height || 55, pattern: saved.settings?.pattern ?? true };
    activeId = products[0].id;
  }
} catch { storageWarning = true; }

document.querySelector('#app').innerHTML = `
<header class="topbar"><a class="brand" href="./"><span class="brand-icon">栞</span><span>Tag Studio<small>NOBORIBETSU GRAND HOTEL</small></span></a><span class="local-badge"><i></i> Dữ liệu chỉ lưu trên máy bạn</span><button id="help" class="button ghost">Hướng dẫn <span>↗</span></button></header>
<main>
  <section class="heading"><div><p class="eyebrow">CÔNG CỤ DÀNH CHO CỬA HÀNG</p><h1>Tag giá đẹp.<br class="mobile-break"> Sẵn sàng trong vài phút.</h1><p>Nhập danh sách, kiểm tra và in. Ai cũng có thể tự làm.</p></div><button id="print-top" class="button primary">▣ &nbsp; In / Lưu PDF</button></section>
  <nav class="steps" aria-label="Quy trình"><span><b>1</b> Nhập sản phẩm</span><i>→</i><span><b>2</b> Kiểm tra tag</span><i>→</i><span><b>3</b> In hàng loạt</span></nav>
  <div id="notice" class="notice" role="status" hidden></div>
  <div class="workspace">
    <section class="panel data-panel">
      <div class="section-heading"><div><span class="section-number">01</span><h2>Danh sách sản phẩm</h2></div><span id="total" class="pill"></span></div>
      <label class="upload-zone" id="drop-zone" for="excel-input"><span class="upload-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.3" aria-hidden="true"><path d="M12 16V3m-5 5 5-5 5 5M4 15v5a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-5"/></svg></span><strong>Tải danh sách Excel lên</strong><span>Kéo thả file hoặc <u>chọn từ máy tính</u></span><small>.xlsx · Tối đa 5 MB · 2.000 sản phẩm</small><input id="excel-input" type="file" accept=".xlsx" hidden></label>
      <div class="upload-options"><button id="template" class="text-button">↓ Tải Excel mẫu</button><button id="sample" class="text-button">Dùng danh sách ban đầu</button></div>
      <div id="sheet-control" class="sheet-control" hidden><label for="sheet">Sheet sản phẩm</label><select id="sheet"></select><button class="button" id="import-sheet">Nhập sheet</button></div>
      <div class="list-toolbar"><label class="search">⌕ <input id="search" placeholder="Tìm tên sản phẩm…" aria-label="Tìm sản phẩm"></label><button id="add" class="button">+ Thêm</button></div>
      <div class="list-columns"><label><input type="checkbox" id="select-all" checked aria-label="Chọn tất cả"> SẢN PHẨM</label><span>GIÁ / BẢN IN</span></div>
      <div id="product-list" class="product-list"></div>
      <div class="list-footer"><span id="selected-summary"></span><button id="delete" class="text-button danger">Xóa sản phẩm đang sửa</button></div>
      <details class="editor" open><summary>Chỉnh sửa sản phẩm <span>＋</span></summary><form id="edit-form"><div class="form-grid">${fields.map((key, i) => `<label class="${key === 'ja' ? 'wide' : ''}">${['Tên tiếng Nhật *','Tiếng Anh','Tiếng Hàn','Tiếng Trung giản thể','Tiếng Trung phồn thể','Giá bán (JPY) *','Ghi chú thuế / loại'][i]}<input name="${key}" ${key === 'price' ? 'inputmode="numeric"' : ''} placeholder="${key === 'note' ? 'VD: 税込・各種; để trống nếu chưa xác nhận' : ''}"></label>`).join('')}</div><p class="form-hint">Tên và bản dịch được giữ nguyên từ danh sách. Không tự dịch hoặc tự thêm thuế.</p></form></details>
    </section>
    <aside class="preview-column">
      <section class="panel preview-panel"><div class="section-heading"><div><span class="section-number">02</span><h2>Xem trước tag</h2></div><span class="live"><i></i> Trực tiếp</span></div><div class="preview-stage"><div id="preview"></div></div><div class="preview-caption"><span id="preview-name"></span><span id="size-caption"></span></div></section>
      <section class="panel settings-panel"><div class="section-heading"><div><span class="section-number">03</span><h2>Thiết lập bản in</h2></div><span class="pill">A4</span></div>
        <label class="field">Kích thước tag<select id="size"><option value="90,55">90 × 55 mm · 8 tag / trang</option><option value="100,60">100 × 60 mm · 4 tag / trang</option><option value="180,110">180 × 110 mm · 2 tag / trang</option></select></label>
        <label class="toggle-row"><span>Viền họa tiết màu vàng</span><input type="checkbox" id="pattern" checked></label>
        <div class="print-summary"><span id="print-count"></span><small>Khổ A4 dọc · Tỷ lệ in 100%</small></div><button id="print" class="button primary full">▣ &nbsp; In / Lưu PDF</button><p class="print-hint">Chọn “Lưu dưới dạng PDF” trong cửa sổ in.<br>Bật đồ họa nền, tắt đầu trang và chân trang.</p>
      </section>
      <p class="privacy-note">♧ &nbsp; Excel được xử lý ngay trong trình duyệt.<br>Không cần đăng nhập. Không gửi dữ liệu lên máy chủ.</p>
    </aside>
  </div>
  <footer>TAG STUDIO <span>Đơn giản hóa công việc mỗi ngày.</span><button class="text-button" id="clear">Xóa dữ liệu đã lưu trên máy</button></footer>
</main><div id="print-pages" aria-hidden="true"></div>
<dialog id="guide"><button id="close-guide" class="button close" aria-label="Đóng">×</button><p class="eyebrow">BẮT ĐẦU TRONG 3 BƯỚC</p><h2>Từ danh sách đến tag giá</h2><ol><li><strong>Nhập sản phẩm.</strong> Dùng danh sách có sẵn, tải file .xlsx hoặc bấm “Thêm”. File cần dòng tiêu đề như Excel mẫu; bạn có thể chọn sheet.</li><li><strong>Kiểm tra.</strong> Bấm vào tên sản phẩm để sửa, chọn ô đánh dấu để in và điều chỉnh số bản. Kiểm tra giá, bản dịch và thông tin thuế trước khi in.</li><li><strong>In hoặc lưu PDF.</strong> Chọn khổ A4 dọc, tỷ lệ 100%, bật đồ họa nền, tắt đầu/chân trang. Các tag được chia trang tự động và có viền cắt.</li></ol><p>Chỉ ghi “税込” khi đã xác nhận giá gồm thuế. Logo khách sạn được cố định trên tất cả tag.</p><p>Dữ liệu được tự lưu trong trình duyệt này. Máy khác cần tải lại Excel. Đừng dùng “Xóa dữ liệu” nếu bạn chưa lưu danh sách cần giữ.</p><button id="export" class="button">↓ Xuất danh sách hiện tại ra Excel</button></dialog>`;

function notify(message, error = false) {
  $('#notice').textContent = message;
  $('#notice').classList.toggle('error', error);
  $('#notice').hidden = false;
}
function save() {
  try { localStorage.setItem('tag-studio-v1', JSON.stringify({ products, settings })); }
  catch { if (!storageWarning) notify('Trình duyệt không thể lưu thêm dữ liệu. Hãy xuất Excel để giữ danh sách.', true); storageWarning = true; }
}
function active() { return products.find(p => p.id === activeId); }
function copies() { return products.filter(p => p.selected).reduce((sum, p) => sum + p.quantity, 0); }
function perPage() { return Math.floor((190 + 4) / (settings.width + 4)) * Math.floor((277 + 4) / (settings.height + 4)); }
function tag(product) {
  const error = validate(product);
  return `<article class="tag ${settings.pattern ? 'pattern' : ''}" style="aspect-ratio:${settings.width}/${settings.height}"><div class="tag-content"><div class="hotel-brand"><img class="fixed-hotel-logo" src="${escape(fixedLogo)}" alt="NOBORIBETSU GRAND HOTEL"></div><div class="names"><div class="ja">${escape(product.ja)}</div>${['en','ko','zh','tw'].map(key => `<div class="translation" lang="${{en:'en',ko:'ko',zh:'zh-CN',tw:'zh-TW'}[key]}">${escape(product[key])}</div>`).join('')}</div><div class="tag-price">${error ? '<span class="invalid-price">Kiểm tra dữ liệu</span>' : `¥${parsePrice(product.price).toLocaleString('ja-JP')}`}</div>${product.note ? `<div class="tax">${escape(product.note)}</div>` : ''}</div></article>`;
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
  const product = active();
  $('#preview').innerHTML = product ? tag(product) : '<p class="empty">Thêm sản phẩm để xem tag.</p>';
  $('#preview-name').textContent = product?.ja || 'Chưa có sản phẩm';
  $('#size-caption').textContent = `${settings.width} × ${settings.height} mm`;
  const n = copies();
  $('#print-count').textContent = `${n} tag · ${Math.ceil(n / perPage())} trang A4`;
  $('#selected-summary').textContent = `${products.filter(p => p.selected).length} đã chọn · ${n} bản in`;
  for (const id of ['#print', '#print-top']) $(id).disabled = n === 0;
  requestAnimationFrame(() => fitTags($('#preview')));
}
function renderList() {
  const query = $('#search').value.toLocaleLowerCase();
  const filtered = products.filter(p => fields.some(f => String(p[f]).toLocaleLowerCase().includes(query)));
  $('#total').textContent = `${products.length} sản phẩm`;
  $('#product-list').innerHTML = filtered.map(p => `<div class="product-row ${p.id === activeId ? 'active' : ''}" data-id="${p.id}"><input type="checkbox" data-action="select" aria-label="Chọn ${escape(p.ja || 'sản phẩm mới')}" ${p.selected ? 'checked' : ''}><button class="product-name" data-action="edit"><strong>${escape(p.ja || 'Sản phẩm mới')}</strong><small>${escape(validate(p) || p.en || 'Bấm để chỉnh sửa')}</small></button><span class="row-price">${parsePrice(p.price) !== null ? '¥' + parsePrice(p.price).toLocaleString('ja-JP') : '—'}</span><input type="number" class="quantity" data-action="quantity" min="1" max="100" value="${p.quantity}" aria-label="Số bản ${escape(p.ja)}"></div>`).join('') || '<p class="empty">Không có sản phẩm phù hợp.</p>';
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
  if (e.target.dataset.action === 'select') p.selected = e.target.checked;
  if (e.target.dataset.action === 'quantity') p.quantity = Math.min(100, Math.max(1, Math.floor(Number(e.target.value) || 1)));
  renderList(); save();
});
$('#search').addEventListener('input', renderList);
$('#select-all').addEventListener('change', e => { products.forEach(p => { p.selected = e.target.checked; }); refresh(); });
$('#add').addEventListener('click', () => {
  if (products.length >= 2000) return notify('Tối đa 2.000 sản phẩm.', true);
  const p = makeProducts([Object.fromEntries(fields.map(f => [f, '']))])[0];
  products.unshift(p); activeId = p.id; $('#search').value = ''; refresh();
  $('#edit-form').elements.namedItem('ja').focus();
});
$('#delete').addEventListener('click', () => {
  const p = active();
  if (!p || !confirm(`Xóa “${p.ja || 'Sản phẩm mới'}”?`)) return;
  products = products.filter(item => item.id !== activeId); activeId = products[0]?.id; refresh();
});
function replaceProducts(rows) {
  if (!confirm('Thay danh sách hiện tại? Chọn Hủy nếu bạn cần xuất Excel để lưu các chỉnh sửa trước.')) return;
  products = makeProducts(rows); activeId = products[0].id; $('#search').value = ''; refresh();
  notify(`Đã nhập ${products.length} sản phẩm. Kiểm tra nội dung trước khi in.`);
}
$('#sample').addEventListener('click', () => replaceProducts(sample));
let excelPromise;
async function excel() { excelPromise ||= import('exceljs').then(m => m.default); return excelPromise; }
async function loadExcel(file) {
  if (!file) return;
  if (!/\.xlsx$/i.test(file.name)) return notify('Hãy dùng file .xlsx. Với .xls, hãy lưu lại thành .xlsx trong Excel.', true);
  if (file.size > 5 * 1024 * 1024) return notify('File vượt quá 5 MB. Hãy chia nhỏ file rồi thử lại.', true);
  notify('Đang đọc Excel…');
  try {
    const Excel = await excel();
    const next = new Excel.Workbook();
    await next.xlsx.load(await file.arrayBuffer());
    if (!next.worksheets.length) throw new Error('File không có sheet.');
    workbook = next;
    $('#sheet').innerHTML = workbook.worksheets.map((s, i) => `<option value="${i}">${escape(s.name)}</option>`).join('');
    const index = workbook.worksheets.findIndex(s => s.name === 'Multilingual Products');
    $('#sheet').value = String(Math.max(index, 0));
    $('#sheet-control').hidden = false;
    notify(`Đã đọc “${file.name}”. Chọn sheet rồi bấm “Nhập sheet” để thay danh sách.`);
  } catch { notify('Không đọc được file Excel. Hãy kiểm tra file không bị khóa mật khẩu hoặc hỏng, rồi lưu lại thành .xlsx.', true); }
}
$('#excel-input').addEventListener('change', async e => { await loadExcel(e.target.files[0]); e.target.value = ''; });
$('#import-sheet').addEventListener('click', () => { try { replaceProducts(readWorksheet(workbook.worksheets[Number($('#sheet').value)])); } catch (error) { notify(error.message, true); } });
for (const name of ['dragover','dragleave','drop']) $('#drop-zone').addEventListener(name, e => {
  e.preventDefault(); $('#drop-zone').classList.toggle('dragging', name === 'dragover');
  if (name === 'drop') loadExcel(e.dataTransfer.files[0]);
});
async function downloadExcel(rows, filename) {
  try {
    const Excel = await excel(), book = new Excel.Workbook(), sheet = book.addWorksheet('Multilingual Products');
    sheet.addRow(['No.', ...headers]);
    rows.forEach((p, i) => sheet.addRow([i + 1, ...fields.map(key => key === 'price' && parsePrice(p[key]) !== null ? parsePrice(p[key]) : p[key])]));
    sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    sheet.getRow(1).fill = { type:'pattern', pattern:'solid', fgColor: { argb:'FF927555' } };
    sheet.columns.forEach((col, i) => { col.width = i === 0 ? 7 : i === 6 ? 16 : 32; });
    const url = URL.createObjectURL(new Blob([await book.xlsx.writeBuffer()], {type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}));
    const a = document.createElement('a'); a.href = url; a.download = filename; a.click(); setTimeout(() => URL.revokeObjectURL(url), 10000);
  } catch { notify('Không thể tạo file Excel. Vui lòng thử lại.', true); }
}
$('#template').addEventListener('click', () => downloadExcel(sample.slice(0, 1), 'Tag-gia-mau.xlsx'));
$('#export').addEventListener('click', () => downloadExcel(products, 'Danh-sach-tag-gia.xlsx'));
$('#size').value = `${settings.width},${settings.height}`;
$('#size').addEventListener('change', e => { [settings.width, settings.height] = e.target.value.split(',').map(Number); renderPreview(); save(); });
$('#pattern').checked = settings.pattern;
$('#pattern').addEventListener('change', e => { settings.pattern = e.target.checked; renderPreview(); save(); });
async function printTags() {
  const selected = products.filter(p => p.selected), invalid = selected.find(p => validate(p));
  if (invalid) return notify(`Chưa thể in “${invalid.ja || 'Sản phẩm mới'}”: ${validate(invalid)}.`, true);
  if (!copies()) return notify('Chọn ít nhất một sản phẩm để in.', true);
  if (copies() > 1000) return notify('Mỗi lần in tối đa 1.000 tag. Hãy giảm số bản hoặc chia nhóm sản phẩm.', true);
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
  if (!fits) return notify('Có nội dung quá dài so với tag. Hãy rút gọn tên / ghi chú hoặc kiểm tra lại nội dung trước khi in.', true);
  window.print();
}
$('#print').addEventListener('click', printTags); $('#print-top').addEventListener('click', printTags);
$('#help').addEventListener('click', () => $('#guide').showModal());
$('#close-guide').addEventListener('click', () => $('#guide').close());
$('#clear').addEventListener('click', () => { if (confirm('Xóa toàn bộ chỉnh sửa đã lưu trên trình duyệt này, rồi trở về danh sách ban đầu?')) { localStorage.removeItem('tag-studio-v1'); location.reload(); } });
refresh();
new ResizeObserver(() => fitTags($('#preview'))).observe($('#preview'));
document.fonts.ready.then(() => fitTags($('#preview')));
if (storageWarning) notify('Trình duyệt hạn chế lưu dữ liệu. Hãy xuất Excel trước khi đóng trang.', true);

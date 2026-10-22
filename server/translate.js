export const targets = { en: 'en', ko: 'ko', zh: 'zh-CN', tw: 'zh-TW' };

export class TranslationError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

export async function translateProducts(body, { apiKey = process.env.GOOGLE_TRANSLATE_API_KEY, fetchImpl = fetch } = {}) {
  const products = body?.products;
  if (!Array.isArray(products) || !products.length || products.length > 50) {
    throw new TranslationError(400, '1回につき1〜50商品を指定してください。');
  }
  const ids = new Set();
  let length = 0;
  for (const product of products) {
    if (!product || typeof product.id !== 'string' || product.id.length > 100 || ids.has(product.id) ||
        typeof product.ja !== 'string' || !product.ja.trim() || product.ja.length > 500 ||
        !Array.isArray(product.missing) || !product.missing.length || product.missing.length > 4 || product.missing.some(key => !Object.hasOwn(targets, key))) {
      throw new TranslationError(400, '商品名または翻訳先の指定が正しくありません。');
    }
    ids.add(product.id);
    length += product.ja.length * new Set(product.missing).size;
  }
  if (length > 20000) throw new TranslationError(400, '翻訳する文字数が多すぎます。商品を分けてお試しください。');
  if (!apiKey) throw new TranslationError(503, '自動翻訳の設定が完了していません。管理者による翻訳サービスの設定が必要です。');
  const results = products.map(product => ({ id: product.id, ja: product.ja }));
  for (const [key, target] of Object.entries(targets)) {
    const names = [...new Set(products.filter(p => p.missing.includes(key)).map(p => p.ja))];
    if (!names.length) continue;
    let response;
    try {
      response = await fetchImpl('https://translation.googleapis.com/language/translate/v2', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': apiKey },
        body: JSON.stringify({ q: names, source: 'ja', target, format: 'text' }),
        signal: AbortSignal.timeout(10000),
      });
    } catch {
      throw new TranslationError(502, '翻訳サービスに接続できません。時間をおいて再度お試しください。');
    }
    if (!response.ok) {
      if (response.status === 429) throw new TranslationError(429, '翻訳サービスの利用上限に達しました。時間をおいて再度お試しください。');
      if ([400, 401, 403].includes(response.status)) throw new TranslationError(503, '翻訳サービスの認証・API有効化・請求設定を管理者が確認する必要があります。');
      throw new TranslationError(502, '翻訳サービスでエラーが発生しました。再度お試しください。');
    }
    let translations;
    try { translations = (await response.json())?.data?.translations; } catch { /* checked below */ }
    if (!Array.isArray(translations) || translations.length !== names.length || translations.some(t => typeof t?.translatedText !== 'string' || !t.translatedText.trim() || t.translatedText.length > 4000)) {
      throw new TranslationError(502, '翻訳結果を読み取れませんでした。再度お試しください。');
    }
    const byName = new Map(names.map((name, index) => [name, translations[index].translatedText]));
    products.forEach((product, index) => { if (product.missing.includes(key)) results[index][key] = byName.get(product.ja); });
  }
  return { products: results };
}

let windowStart = Date.now(), requestCount = 0;
export async function translationHandler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  const send = (status, data) => { res.statusCode = status; res.end(JSON.stringify(data)); };
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return send(405, { error: 'POSTを使用してください。' }); }
  if (!String(req.headers['content-type'] || '').startsWith('application/json')) return send(415, { error: 'JSON形式で送信してください。' });
  // Same-origin requests only: no CORS access from downloaded HTML or unrelated sites.
  const origin = req.headers.origin;
  const expectedHost = req.headers.host;
  if (origin) {
    try { if (new URL(origin).host !== expectedHost) return send(403, { error: 'Web版と同じサイトからご利用ください。' }); }
    catch { return send(403, { error: 'アクセス元を確認できません。' }); }
  }
  if (Date.now() - windowStart > 60000) { windowStart = Date.now(); requestCount = 0; }
  if (++requestCount > 40) return send(429, { error: 'リクエストが集中しています。1分ほど待って再度お試しください。' });
  try {
    let body = req.body;
    if (!body) {
      let raw = '';
      req.setEncoding?.('utf8');
      for await (const chunk of req) {
        raw += chunk;
        if (Buffer.byteLength(raw) > 128000) throw new TranslationError(413, 'リクエストが大きすぎます。');
      }
      try { body = JSON.parse(raw); } catch { throw new TranslationError(400, 'JSONの形式が正しくありません。'); }
    } else if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch { throw new TranslationError(400, 'JSONの形式が正しくありません。'); }
    }
    return send(200, await translateProducts(body));
  } catch (error) {
    return send(error.status || 500, { error: error instanceof TranslationError ? error.message : '翻訳処理に失敗しました。再度お試しください。' });
  }
}

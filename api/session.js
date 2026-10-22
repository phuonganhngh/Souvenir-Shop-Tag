import { createSession, verifySession, passwordMatches, passwordConfigured, sessionCookie, loginPage } from '../server/auth.js';
let start = Date.now(), attempts = 0;
export default async function sessionHandler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  const send = (status, body) => { res.statusCode = status; res.setHeader('Content-Type','application/json; charset=utf-8'); res.end(JSON.stringify(body)); };
  const secure = req.headers['x-forwarded-proto'] === 'https' || Boolean(process.env.VERCEL);
  if (req.method === 'GET') {
    if (req.url.includes('status=1')) return send(200, { configured:passwordConfigured(), authenticated:await verifySession(req.headers.cookie) });
    res.setHeader('Content-Type', 'text/html; charset=utf-8'); res.statusCode = passwordConfigured() ? 200 : 503;
    return res.end(loginPage(passwordConfigured()));
  }
  const origin = req.headers.origin;
  if (origin) {
    try { if (new URL(origin).host !== req.headers.host) return send(403, { error:'同じWebサイトから操作してください。' }); }
    catch { return send(403, { error:'アクセス元を確認できません。' }); }
  }
  if (req.method === 'DELETE') { res.setHeader('Set-Cookie', sessionCookie('', secure)); return send(200, { ok:true }); }
  if (req.method !== 'POST') return send(405, { error:'この操作には対応していません。' });
  if (!passwordConfigured()) return send(503, { error:'管理者によるパスワードの設定が必要です。' });
  if (!String(req.headers['content-type'] || '').startsWith('application/json')) return send(415, { error:'JSON形式で送信してください。' });
  if (Date.now() - start > 900000) { start = Date.now(); attempts = 0; }
  if (++attempts > 30) return send(429, { error:'ログインの試行が多すぎます。しばらく待ってからお試しください。' });
  let body = req.body;
  try {
    if (!body) {
      req.setEncoding?.('utf8');
      let raw = ''; for await (const chunk of req) { raw += chunk; if (Buffer.byteLength(raw) > 2048) return send(413, {error:'入力が長すぎます。'}); }
      body = JSON.parse(raw);
    } else if (typeof body === 'string') body = JSON.parse(body);
  } catch { return send(400, { error:'入力内容を確認してください。' }); }
  if (!await passwordMatches(body?.password)) return send(401, { error:'パスワードが正しくありません。' });
  res.setHeader('Set-Cookie', sessionCookie(await createSession(), secure));
  return send(200, { ok:true });
}

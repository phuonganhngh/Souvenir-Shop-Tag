// Vercel serverless endpoint. The key stays in server environment variables.
import { translationHandler } from '../server/translate.js';
import { verifySession } from '../server/auth.js';
export default async function translate(req, res) {
  if (!await verifySession(req.headers.cookie)) {
    res.statusCode = 401; res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.end(JSON.stringify({ error:'ログインが必要です。ページを再読み込みしてください。' }));
  }
  return translationHandler(req, res);
}

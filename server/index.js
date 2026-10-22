import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { translationHandler } from './translate.js';
import { verifySession, passwordConfigured, loginPage } from './auth.js';
import sessionHandler from '../api/session.js';

const root = resolve('dist');
const types = { '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.css':'text/css', '.png':'image/png', '.woff2':'font/woff2', '.svg':'image/svg+xml' };
createServer(async (req, res) => {
  if (req.url.split('?')[0] === '/api/session') return sessionHandler(req, res);
  if (!await verifySession(req.headers.cookie)) {
    const api = req.url.startsWith('/api/');
    res.writeHead(api ? 401 : passwordConfigured() ? 200 : 503, { 'Content-Type':api ? 'application/json; charset=utf-8' : 'text/html; charset=utf-8', 'Cache-Control':'no-store' });
    return res.end(api ? JSON.stringify({error:'ログインが必要です。ページを再読み込みしてください。'}) : loginPage(passwordConfigured()));
  }
  if (req.url.split('?')[0] === '/api/translate') return translationHandler(req, res);
  if (!['GET', 'HEAD'].includes(req.method)) { res.writeHead(405); return res.end(); }
  let pathname;
  try { pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname); }
  catch { res.writeHead(400); return res.end(); }
  const file = resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
  if (!file.startsWith(root + sep)) { res.writeHead(403); return res.end(); }
  try {
    const data = await readFile(file);
    res.writeHead(200, { 'Content-Type':types[extname(file)] || 'application/octet-stream', 'X-Content-Type-Options':'nosniff' });
    res.end(req.method === 'HEAD' ? undefined : data);
  } catch { res.writeHead(404); res.end('Not found'); }
}).listen(Number(process.env.PORT || 8787), '0.0.0.0', () => console.log('プライスタグ用サーバーが起動しました。'));

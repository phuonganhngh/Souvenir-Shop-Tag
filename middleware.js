import { next } from '@vercel/edge';
import { verifySession, passwordConfigured, loginPage } from './server/auth.js';
export default async function middleware(request) {
  if (await verifySession(request.headers.get('cookie'))) return next();
  const api = new URL(request.url).pathname.startsWith('/api/');
  return new Response(api ? JSON.stringify({error:'ログインが必要です。ページを再読み込みしてください。'}) : loginPage(passwordConfigured()), {
    status: api ? 401 : passwordConfigured() ? 200 : 503,
    headers: { 'Content-Type':api ? 'application/json; charset=utf-8' : 'text/html; charset=utf-8', 'Cache-Control':'no-store' },
  });
}
export const config = { matcher: ['/((?!api/session$).*)'] };

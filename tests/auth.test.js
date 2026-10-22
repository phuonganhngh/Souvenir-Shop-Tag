import test from 'node:test';
import assert from 'node:assert/strict';
import { createSession, verifySession, passwordMatches, sessionCookie } from '../server/auth.js';
import middleware from '../middleware.js';

const password = 'test-only-password-123';
test('signed sessions reject tampering, expiry and changed passwords', async () => {
  const now = Date.now(), token = await createSession(password, now), cookie = sessionCookie(token);
  assert.equal(await verifySession(cookie,password,now),true);
  assert.equal(await verifySession(cookie,password,now+28800001),false);
  assert.equal(await verifySession(cookie,'different-password',now),false);
  assert.equal(await verifySession(cookie.replace('hotel_access=', 'hotel_access=1'),password,now),false);
  assert.equal(await verifySession('',password,now),false);
  assert.equal(await passwordMatches(password,password),true);
  assert.equal(await passwordMatches('wrong',password),false);
  assert.match(cookie,/HttpOnly/); assert.match(cookie,/Secure/); assert.match(cookie,/SameSite=Lax/);
});
test('hosting middleware protects the page and API, and passes valid sessions', async () => {
  const original = process.env.APP_PASSWORD; process.env.APP_PASSWORD = password;
  try {
    const page = await middleware(new Request('https://example.com/'));
    assert.match(await page.text(), /type="password"/);
    const api = await middleware(new Request('https://example.com/api/private'));
    assert.equal(api.status,401);
    const cookie = sessionCookie(await createSession(password));
    const authorized = await middleware(new Request('https://example.com/',{headers:{cookie}}));
    assert.equal(authorized.headers.get('x-middleware-next'),'1');
    delete process.env.APP_PASSWORD;
    assert.equal((await middleware(new Request('https://example.com/'))).status,503);
  } finally { if (original === undefined) delete process.env.APP_PASSWORD; else process.env.APP_PASSWORD = original; }
});

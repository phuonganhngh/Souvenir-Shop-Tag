const encoder = new TextEncoder();
const cookieName = 'hotel_access';
export const passwordConfigured = () => (process.env.APP_PASSWORD || '').length >= 8;
const encode = bytes => btoa(String.fromCharCode(...bytes)).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
const decode = value => Uint8Array.from(atob(value.replaceAll('-', '+').replaceAll('_', '/')), c => c.charCodeAt(0));
const keyFor = password => crypto.subtle.importKey('raw', encoder.encode(password), { name:'HMAC', hash:'SHA-256' }, false, ['sign', 'verify']);

export async function createSession(password = process.env.APP_PASSWORD, now = Date.now()) {
  const nonce = crypto.getRandomValues(new Uint8Array(16));
  const payload = `${Math.floor(now / 1000) + 28800}.${encode(nonce)}`;
  const signature = await crypto.subtle.sign('HMAC', await keyFor(password), encoder.encode(payload));
  return `${payload}.${encode(new Uint8Array(signature))}`;
}
export async function verifySession(cookie, password = process.env.APP_PASSWORD, now = Date.now()) {
  if (!password || password.length < 8 || !cookie) return false;
  const token = cookie.split(';').map(s => s.trim()).find(s => s.startsWith(cookieName + '='))?.slice(cookieName.length + 1);
  if (!token || token.length > 200) return false;
  const parts = token.split('.');
  if (parts.length !== 3 || !/^\d+$/.test(parts[0]) || Number(parts[0]) <= now / 1000 || Number(parts[0]) > now / 1000 + 28801) return false;
  try { return await crypto.subtle.verify('HMAC', await keyFor(password), decode(parts[2]), encoder.encode(parts.slice(0, 2).join('.'))); }
  catch { return false; }
}
export async function passwordMatches(input, expected = process.env.APP_PASSWORD) {
  if (typeof input !== 'string' || input.length > 256 || !expected || expected.length < 8) return false;
  const left = new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(input)));
  const right = new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(expected)));
  let difference = 0;
  for (let i = 0; i < left.length; i++) difference |= left[i] ^ right[i];
  return difference === 0;
}
export function sessionCookie(token, secure = true) {
  return `${cookieName}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${token ? 28800 : 0}${secure ? '; Secure' : ''}`;
}

export function loginPage(configured = true) {
  return `<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>ログイン｜プライスタグ作成</title><style>*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;background:#f7f8f5;color:#334737;font:15px system-ui,sans-serif;padding:24px}main{background:#fff;border:1px solid #e3e8de;border-radius:14px;padding:36px;width:100%;max-width:400px}h1{font-size:23px;font-weight:500}p{color:#7c8774;font-size:13px;line-height:1.9}label{display:block;font-size:12px;margin-top:24px}input,button{width:100%;font:inherit;border-radius:7px;padding:13px;margin-top:8px}input{border:1px solid #d9e1d1}button{background:#354f40;color:#fff;border:0;cursor:pointer;margin-top:18px}button:disabled{opacity:.5}#error{color:#a3513a;white-space:pre-line}</style></head><body><main><p>登別グランドホテル</p><h1>プライスタグ作成</h1>${configured ? '<p>ご利用にはパスワードが必要です。</p><form id="login"><label for="password">パスワード</label><input id="password" type="password" autocomplete="current-password" required maxlength="256" autofocus><button>ログイン</button></form><p id="error" role="alert"></p><script>document.querySelector("#login").addEventListener("submit",async e=>{e.preventDefault();const button=e.target.querySelector("button"),error=document.querySelector("#error");button.disabled=true;error.textContent="";try{const response=await fetch("/api/session",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({password:document.querySelector("#password").value})});const result=await response.json();if(!response.ok)throw Error(result.error);location.replace("/");}catch(e){error.textContent=e.message||"接続できません。再度お試しください。";}finally{button.disabled=false;}});</script>' : '<p>管理者によるWeb版の設定が必要です。サーバーに8文字以上のアクセス用パスワードを設定してください。</p>'}</main></body></html>`;
}

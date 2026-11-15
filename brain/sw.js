/* 브레인 루틴 오프라인 지원
 * 앱 파일을 기기에 저장해 인터넷 없이도 열리게 합니다.
 * 파일을 고친 뒤에는 VERSION을 올려 주세요(다음 실행 때 새 버전으로 바뀝니다). */
const VERSION = 'br-v2';
const SHELL = ['./', 'index.html', 'app.js', 'games.js', 'ui.js', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png', 'icons/favicon-64.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const sameApp = url.origin === location.origin && url.pathname.startsWith(new URL('./', location).pathname);
  const font = /fonts\.(googleapis|gstatic)\.com$/.test(url.hostname) || (url.hostname === 'cdn.jsdelivr.net' && url.pathname.includes('/pretendard'));
  if (!sameApp && !font) return;
  // 저장본을 먼저 보여 주고, 뒤에서 새 파일로 바꿔 둠
  e.respondWith(caches.open(VERSION).then(async c => {
    const hit = await c.match(req, { ignoreSearch: sameApp });
    const net = fetch(req).then(res => { if (res && (res.ok || res.type === 'opaque')) c.put(req, res.clone()); return res; }).catch(() => null);
    if (hit) { e.waitUntil(net); return hit; }
    const res = await net;
    if (res) return res;
    if (req.mode === 'navigate') return (await c.match('index.html')) || Response.error();
    return Response.error();
  }));
});

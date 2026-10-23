// Run only after `expo export --platform web`. No service worker in Expo development.
import { createHash } from 'node:crypto';
import { readdir, readFile, writeFile, copyFile } from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve('dist');
const manifest = {
  id: './', name: 'WordMine Next', short_name: 'WordMine',
  description: 'Local-first vocabulary practice. Synthetic preview.',
  start_url: './', scope: './', display: 'standalone',
  background_color: '#141c29', theme_color: '#141c29',
  icons: [192, 512].map(size => ({ src: `./icon-${size}.png`, sizes: `${size}x${size}`, type: 'image/png', purpose: 'any' })),
};
for (const size of [192, 512]) await copyFile(`assets/pwa/icon-${size}.png`, path.join(root, `icon-${size}.png`));
await writeFile(path.join(root, 'manifest.webmanifest'), JSON.stringify(manifest, null, 2));
let html = await readFile(path.join(root, 'index.html'), 'utf8');
html = html.replace('<title>wordmine</title>', '<title>WordMine Next</title>');
html = html.replace('</head>', '<link rel="manifest" href="./manifest.webmanifest"><meta name="theme-color" content="#141c29"><link rel="apple-touch-icon" href="./icon-192.png"></head>');
html = html.replace('</body>', '<script src="./register-sw.js" defer></script></body>');
await writeFile(path.join(root, 'index.html'), html);
await writeFile(path.join(root, 'register-sw.js'), `if ('serviceWorker' in navigator) { window.addEventListener('load', function () { navigator.serviceWorker.register('./sw.js', { scope: './' }).catch(function (error) { console.warn('Offline setup unavailable', error); }); }); }\n`);

async function files(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const all = await Promise.all(entries.map(e => e.isDirectory() ? files(path.join(dir, e.name)) : [path.join(dir, e.name)]));
  return all.flat().filter(f => {
    const relative = path.relative(root, f).split(path.sep).join('/');
    return !['sw.js', 'metadata.json'].includes(path.basename(f)) && !relative.startsWith('sample-pack/');
  });
}
const assets = (await files(root)).sort();
const hash = createHash('sha256');
for (const file of assets) { hash.update(path.relative(root, file)); hash.update(await readFile(file)); }
const cache = `wm-next-shell-${hash.digest('hex').slice(0, 16)}`;
const urls = assets.map(f => `./${path.relative(root, f).split(path.sep).join('/')}`);
await writeFile(path.join(root, 'sw.js'), `const CACHE = ${JSON.stringify(cache)};
const URLS = ${JSON.stringify(urls)}.map(p => new URL(p, self.registration.scope).href);
self.addEventListener('install', event => { event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(URLS))); });
self.addEventListener('activate', event => { event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('wm-next-shell-') && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin || !url.href.startsWith(self.registration.scope)) return;
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(() => caches.open(CACHE).then(cache => cache.match(new URL('./index.html', self.registration.scope).href))));
  } else if (URLS.includes(url.href)) {
    event.respondWith(caches.open(CACHE).then(cache => cache.match(request)).then(cached => cached || fetch(request)));
  }
});
`);
console.log(`PWA: ${cache}; ${urls.length} shell assets. No account/API caching; sample packs are not shell-precached.`);

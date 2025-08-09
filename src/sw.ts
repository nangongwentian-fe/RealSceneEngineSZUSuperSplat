import { version as appVersion } from '../package.json';

// export default null
declare let self: ServiceWorkerGlobalScope;

const cacheName = `superSplat-v${appVersion}`;

const cacheUrls = [
    './',
    './index.html',
    './index.css',
    './index.js',
    './manifest.json',
    './static/icons/logo-192.png',
    './static/icons/logo-512.png',
    './static/images/screenshot-narrow.jpg',
    './static/images/screenshot-wide.jpg'
];

self.addEventListener('install', (event) => {
    console.log(`installing v${appVersion}`);

    // create cache for current version
    event.waitUntil(
        caches.open(cacheName)
        .then((cache) => {
            cache.addAll(cacheUrls);
        })
    );
});

self.addEventListener('activate', () => {
    console.log(`activating v${appVersion}`);

    // delete the old caches once this one is activated
    caches.keys().then((names) => {
        for (const name of names) {
            if (name !== cacheName) {
                caches.delete(name);
            }
        }
    });
});

self.addEventListener('fetch', (event) => {
    const requestUrl = new URL(event.request.url);

    // 仅处理同源请求，避免对外部（跨域）文件重复下载
    if (requestUrl.origin !== self.location.origin) {
        // 对于跨域资源，直接让浏览器默认行为即可
        return;
    }

    event.respondWith(
        caches.match(event.request)
        .then(response => response ?? fetch(event.request))
    );
});

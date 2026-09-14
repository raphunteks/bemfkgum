/**
 * SERVICE WORKER DINONAKTIFKAN (TIDAK MENGGUNAKAN PWA INSTALLATION OFFLINE)
 * Mendukung manifest.json asli untuk Android, iOS, dan Chrome tanpa Service Worker.
 */
self.addEventListener('install', () => {
    self.skipWaiting();
});

self.addEventListener('activate', () => {
    self.registration.unregister().catch(() => {});
});

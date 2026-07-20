/**
 * ==============================================================
 * SERVICE WORKER UNTUK PWA BEM KBMFKG UMI
 * (Berdasarkan referensi Workbox dari PWABuilder)
 * ==============================================================
 */

// Nama Cache yang akan digunakan oleh Workbox
const CACHE = "pwabuilder-offline";

// Mengimpor library Workbox dari CDN Google (Sesuai dengan Gbr 2)
importScripts("https://storage.googleapis.com/workbox-cdn/releases/5.1.2/workbox-sw.js");

// Event Listener untuk pesan 'SKIP_WAITING' 
// Berguna jika ada update pada Service Worker (memaksa install SW baru)
self.addEventListener("message", (event) => {
    if (event.data && event.data.type === "SKIP_WAITING") {
        self.skipWaiting();
    }
});

// Registrasi Rute menggunakan Strategi Stale-While-Revalidate
// Pendekatan ini sangat baik: 
// Akan merender halaman dari Cache secara instan, 
// sementara di background ia akan mendownload versi terbaru (revalidate) ke cache untuk kunjungan berikutnya.
workbox.routing.registerRoute(
    new RegExp("/*"), // Menangkap semua request/path pada website
    new workbox.strategies.StaleWhileRevalidate({
        cacheName: CACHE, // Menggunakan cacheName "pwabuilder-offline" yang sudah dideklarasikan di atas
    })
);
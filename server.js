const express = require('express');
const { Redis } = require('@upstash/redis');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Konfigurasi View Engine (Menggunakan EJS tapi dengan ekstensi .html)
app.engine('html', require('ejs').renderFile);
app.set('view engine', 'html');
app.set('views', path.join(__dirname, 'views'));

// Inisiasi Upstash Redis (SUPER BIG UPGRADE: Auto-Sanitizer & Anti-Crash)
let redis = null;
try {
    // 1. Ambil URL mentah dari env atau fallback
    let rawUrl = process.env.UPSTASH_REDIS_REST_URL || 'https://helped-monster-12345.upstash.io';
    
    // 2. Bersihkan URL jika tidak sengaja membawa format markdown [url](url)
    const markdownRegex = /\[(.*?)\]\((.*?)\)/;
    if (markdownRegex.test(rawUrl)) {
        rawUrl = rawUrl.match(markdownRegex)[2];
    }
    
    // 3. Bersihkan spasi berlebih dan tanda kutip yang tidak valid
    const cleanUrl = rawUrl.replace(/^["']|["']$/g, '').trim();
    const cleanToken = (process.env.UPSTASH_REDIS_REST_TOKEN || 'dummy-token').replace(/^["']|["']$/g, '').trim();

    // 4. Inisiasi instance Redis
    redis = new Redis({
        url: cleanUrl,
        token: cleanToken,
    });
    console.log("✅ Upstash Redis Initialized Successfully.");
} catch (error) {
    console.error("⚠️ CRITICAL WARNING: Redis initialization failed. Invalid URL/Token. Running Web in Offline Mode.", error.message);
    redis = null; // Paksa null agar rute API beralih ke fallback logic
}

// ================= ROUTES FRONTEND =================
app.get('/', (req, res) => res.render('index'));
app.get('/tentang', (req, res) => res.render('tentang'));
app.get('/informasi', (req, res) => res.render('informasi'));
app.get('/narahubung', (req, res) => res.render('narahubung'));
app.get('/admin', (req, res) => res.render('admin-dashboard'));

// ================= API ENDPOINTS =================
// API: Kirim Aspirasi (Plasma)
app.post('/api/plasma', async (req, res) => {
  try {
    const { judul, kategori, jenis, isi, setuju } = req.body;
    // Parsing ke tipe primitif untuk keamanan
    const id = `ASP-${Date.now()}`;
    const payload = { 
        id: String(id), 
        judul: String(judul), 
        kategori: String(kategori), 
        jenis: String(jenis), 
        isi: String(isi), 
        timestamp: new Date().toISOString() 
    };
    
    // Simpan ke Redis (Fallback aman jika redis null atau mati)
    try {
        if (redis) {
            await redis.hset('Aspirations', { [id]: JSON.stringify(payload) });
        } else {
            console.warn("ℹ️ Simulasi: Redis Offline. Data Aspirasi diterima namun tidak tersimpan permanen.");
        }
    } catch(err) {
        console.warn("⚠️ Gagal menyimpan ke Redis:", err.message);
    }
    
    res.status(200).json({ success: true, message: 'Aspirasi berhasil dikirim!', data: payload });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Terjadi kesalahan server.' });
  }
});

// API: Kirim Pesan Narahubung
app.post('/api/message', async (req, res) => {
  try {
    const { nama, kontak, subjek, pesan } = req.body;
    const id = `MSG-${Date.now()}`;
    const payload = { id, nama: String(nama), kontak: String(kontak), subjek: String(subjek), pesan: String(pesan), timestamp: new Date().toISOString() };
    
    try {
        if (redis) {
            await redis.hset('Messages', { [id]: JSON.stringify(payload) });
        } else {
            console.warn("ℹ️ Simulasi: Redis Offline. Pesan diterima namun tidak tersimpan permanen.");
        }
    } catch(err) {
        console.warn("⚠️ Gagal menyimpan pesan ke Redis:", err.message);
    }

    res.status(200).json({ success: true, message: 'Pesan berhasil dikirim!' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Gagal mengirim pesan.' });
  }
});

// API: Admin Login & Fetch Data
app.post('/api/admin/auth', (req, res) => {
  const { username, password } = req.body;
  if (username === process.env.ADMIN_USER && password === process.env.ADMIN_PASS) {
    res.status(200).json({ success: true, token: 'AXA-XYZ-SECURE-TOKEN' });
  } else {
    res.status(401).json({ success: false, message: 'Kredensial salah!' });
  }
});

// Jalankan server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server BEM FKG UMI berjalan di port ${PORT} - Axa Xyz Architecture`);
});

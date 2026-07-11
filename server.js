// FILE: server.js
const express = require('express');
const { Redis } = require('@upstash/redis');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

app.engine('html', require('ejs').renderFile);
app.set('view engine', 'html');
app.set('views', path.join(__dirname, 'views'));

// INISIASI UPSTASH REDIS DENGAN KREDENSIAL ASLI
let redis = null;
try {
    const rawUrl = process.env.UPSTASH_REDIS_REST_URL || 'https://merry-hedgehog-35658.upstash.io';
    const cleanUrl = rawUrl.replace(/^["']|["']$/g, '').trim();
    const cleanToken = (process.env.UPSTASH_REDIS_REST_TOKEN || 'AYtKAAIncDIzYmQyNWM4YTM2Y2E0ODZkOTJlNTYwNzBjMzMyNWQxZHAyMzU2NTg').replace(/^["']|["']$/g, '').trim();

    redis = new Redis({ url: cleanUrl, token: cleanToken });
    console.log("✅ Sistem Database Upstash Redis Berhasil Terkoneksi.");
} catch (error) {
    console.error("⚠️ Peringatan: Redis gagal inisiasi. Berjalan di Mode Offline.", error.message);
    redis = null; 
}

// ================= ROUTES FRONTEND =================
app.get('/', (req, res) => res.render('index'));
app.get('/tentang', (req, res) => res.render('tentang'));
app.get('/informasi', (req, res) => res.render('informasi'));
app.get('/narahubung', (req, res) => res.render('narahubung'));
app.get('/admin', (req, res) => res.render('admin-dashboard'));

// ================= API ENDPOINTS: MANAJEMEN ORGANISASI =================
// GET Struktur Organisasi
app.get('/api/org', async (req, res) => {
    try {
        if (!redis) throw new Error("Redis Offline");
        const data = await redis.get('Org_Structure');
        res.status(200).json({ success: true, data: data || null });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Gagal mengambil data organisasi.' });
    }
});

// POST Struktur Organisasi (Update Profil Pimpinan & Departemen)
app.post('/api/org', async (req, res) => {
    try {
        if (!redis) throw new Error("Redis Offline");
        // Sanitasi input memastikan bentuknya string JSON murni
        const payload = JSON.stringify(req.body);
        await redis.set('Org_Structure', payload);
        res.status(200).json({ success: true, message: 'Struktur Organisasi berhasil diperbarui!' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Gagal menyimpan struktur.' });
    }
});

// ================= API ENDPOINTS: TRANSAKSIONAL =================
// GET Semua Data Interaksi (Aspirasi & Pesan)
app.get('/api/interactions', async (req, res) => {
    try {
        if (!redis) throw new Error("Redis Offline");
        const aspirasi = await redis.hgetall('Aspirations') || {};
        const pesan = await redis.hgetall('Messages') || {};
        
        // Parse data dari Hash Redis
        const parsedAspirasi = Object.values(aspirasi).map(item => JSON.parse(item));
        const parsedPesan = Object.values(pesan).map(item => JSON.parse(item));

        res.status(200).json({ success: true, aspirasi: parsedAspirasi, pesan: parsedPesan });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Gagal mengambil data dari database.' });
    }
});

app.post('/api/plasma', async (req, res) => {
  try {
    const { judul, kategori, jenis, isi, setuju } = req.body;
    const id = `ASP-${Date.now()}`;
    const payload = { id: String(id), judul: String(judul), kategori: String(kategori), jenis: String(jenis), isi: String(isi), timestamp: new Date().toISOString() };
    
    if (redis) await redis.hset('Aspirations', { [id]: JSON.stringify(payload) });
    res.status(200).json({ success: true, message: 'Aspirasi berhasil dikirim ke Database BEM!', data: payload });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Terjadi kesalahan server.' });
  }
});

app.post('/api/message', async (req, res) => {
  try {
    const { nama, kontak, subjek, pesan } = req.body;
    const id = `MSG-${Date.now()}`;
    const payload = { id, nama: String(nama), kontak: String(kontak), subjek: String(subjek), pesan: String(pesan), timestamp: new Date().toISOString() };
    
    if (redis) await redis.hset('Messages', { [id]: JSON.stringify(payload) });
    res.status(200).json({ success: true, message: 'Pesan terkirim!' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Gagal mengirim pesan.' });
  }
});

// DELETE Endpoint (Aspirasi / Pesan)
app.post('/api/delete', async (req, res) => {
    try {
        const { type, id } = req.body;
        if (!redis) throw new Error("Redis Offline");
        
        if(type === 'aspirasi') await redis.hdel('Aspirations', id);
        if(type === 'pesan') await redis.hdel('Messages', id);
        
        res.status(200).json({ success: true, message: 'Data berhasil dihapus dari Database.' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Gagal menghapus data.' });
    }
});

// AUTH ADMIN
app.post('/api/admin/auth', (req, res) => {
  const { username, password } = req.body;
  if (username === process.env.ADMIN_USER && password === process.env.ADMIN_PASS) {
    res.status(200).json({ success: true, token: 'AXA-XYZ-SECURE-TOKEN' });
  } else {
    res.status(401).json({ success: false, message: 'Kredensial salah!' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server BEM FKG UMI (Upstash Redis) berjalan di port ${PORT}`));

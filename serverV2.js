// FILE: serverV2.js
const express = require('express');
const { Redis } = require('@upstash/redis');
const cors = require('cors');
const path = require('path');
const bodyParser = require('body-parser');
require('dotenv').config();

const app = express();

// Konfigurasi CORS & Limit Body-Parser (Super Tinggi untuk Base64 & Bulk Excel)
app.use(cors());
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));

// Routing Static Files & Favicon
app.get('/favicon.ico', (req, res) => res.sendFile(path.join(__dirname, 'public/img/bemfkgumi.png')));
app.get('/favicon.png', (req, res) => res.sendFile(path.join(__dirname, 'public/img/bemfkgumi.png')));
app.use('/public', express.static(path.join(__dirname, 'public')));
app.use('/css', express.static(path.join(__dirname, 'public/css')));
app.use('/img', express.static(path.join(__dirname, 'public/img')));
app.use('/js', express.static(path.join(__dirname, 'public/js')));

app.engine('html', require('ejs').renderFile);
app.set('view engine', 'html');
app.set('views', path.join(__dirname, 'views'));

// ================= INISIASI UPSTASH REDIS =================
const redisUrl = process.env.KV_REST_API_URL || 'https://merry-hedgehog-35658.upstash.io';
const redisToken = process.env.KV_REST_API_TOKEN || 'AYtKAAIncDIzYmQyNWM4YTM2Y2E0ODZkOTJlNTYwNzBjMzMyNWQxZHAyMzU2NTg';

let redis = null;
try {
    redis = new Redis({ url: redisUrl, token: redisToken });
    console.log("✅ Sistem Database Upstash Redis Berhasil Terkoneksi (V2 - Ekosistem BEM Lengkap).");
} catch (error) {
    console.error("⚠️ Peringatan: Redis gagal inisiasi.", error.message);
}

// Utility: Safe JSON Parser Anti-Crash
const safeParse = (data, fallbackData) => {
    if (!data) return fallbackData;
    try {
        return typeof data === 'string' ? JSON.parse(data) : data;
    } catch (error) {
        return fallbackData;
    }
};

// ================= MIDDLEWARE AUTHENTICATION =================
const verifyToken = (req, res, next) => {
    const bearerHeader = req.headers['authorization'];
    if (typeof bearerHeader !== 'undefined') {
        const bearer = bearerHeader.split(' ');
        const bearerToken = bearer[1];
        if (bearerToken === 'AXA-XYZ-SECURE-TOKEN') { 
            next(); 
        } else {
            res.status(403).json({ success: false, message: 'Token Invalid atau Kedaluwarsa' });
        }
    } else {
        res.status(403).json({ success: false, message: 'Akses Ditolak: Token Tidak Ditemukan' });
    }
};

// ================= ENDPOINT AUTENTIKASI ADMIN =================
app.post('/api/admin/auth', (req, res) => {
    const { username, password } = req.body;
    const validUser = process.env.ADMIN_USER || 'bemfkgumi2026';
    const validPass = process.env.ADMIN_PASS || 'bemfkgumi999';

    if (username === validUser && password === validPass) {
        res.status(200).json({ success: true, token: 'AXA-XYZ-SECURE-TOKEN' });
    } else {
        res.status(401).json({ success: false, message: 'Kredensial salah!' });
    }
});

// ================= RUTE FRONTEND ADMIN & PDDIKTI =================
app.get('/admin-linktree', (req, res) => res.render('admin-dashboardV3'));
app.get('/admin-qrcode', (req, res) => res.render('admin-dashboardV4'));
app.get('/admin-mhs', (req, res) => res.render('admin-dashboardV5'));
app.get('/carimhs', (req, res) => res.render('carimhs'));
app.get('/carimhs/detail', (req, res) => res.render('carimhs-detail'));

// ================= RUTE FRONTEND PUBLIK DENGAN SSR SEO =================
app.get('/link/:slug', async (req, res) => {
    const slug = req.params.slug;
    let seoData = {
        title: 'BEM KBMFKG UMI - Linktree',
        desc: 'Tautan resmi dan informasi terbaru dari BEM KBMFKG UMI.',
        image: 'https://bemkbmfkgumi.com/img/bemfkgumi.png',
        url: `https://bemkbmfkgumi.com/link/${slug}`
    };

    try {
        if(redis) {
            const trees = await redis.hgetall('BEM_Linktrees') || {};
            const treeArr = Object.values(trees).map(item => safeParse(item, {}));
            const tree = treeArr.find(t => t.slug === slug);
            
            if(tree) {
                seoData.title = tree.settings?.seoTitle || tree.profile?.title || seoData.title;
                seoData.desc = tree.profile?.bio || seoData.desc;
                let img = tree.profile?.image || seoData.image;
                if(img.startsWith('/')) img = `https://bemkbmfkgumi.com${img}`;
                seoData.image = img;
            }
        }
    } catch(e) { console.error("Gagal memuat SSR SEO:", e); }

    res.render('bem-linktree', { slug: slug, seo: seoData });
});


// ================= ENDPOINT API UPLOAD GAMBAR (FOTO MHS/LOGO) =================
app.post('/api/upload', async (req, res) => {
    try {
        if(!redis) throw new Error("Redis Offline");
        const { filename, base64 } = req.body;
        
        if(!filename || !base64) return res.status(400).json({ success: false, message: "File kosong." });
        
        // Mempertahankan ekstensi file asli (.jpg/.png/.jpeg)
        let safeName = filename.toLowerCase().replace(/[^a-z0-9.]+/g, '-').replace(/(^-|-$)+/g, '');
        const uniqueFilename = `file-${Date.now()}-${safeName}`;
        
        await redis.hset('BEM_Files', { [uniqueFilename]: JSON.stringify({ filename: safeName, data: base64 }) });
        
        const fileUrl = `/api/uploads/${uniqueFilename}`;
        res.status(200).json({ success: true, url: fileUrl });
    } catch (e) {
        res.status(500).json({ success: false, message: "Gagal memproses file upload." });
    }
});

app.get('/api/uploads/:filename', async (req, res) => {
    try {
        if(!redis) return res.status(503).send("Server Storage Offline");
        const fileDataStr = await redis.hget('BEM_Files', req.params.filename);
        if(!fileDataStr) return res.status(404).send("File tidak ditemukan.");
        
        const fileObj = safeParse(fileDataStr, null);
        if(!fileObj || !fileObj.data) return res.status(400).send("Data korup.");
        
        const parts = fileObj.data.split(',');
        if (parts.length !== 2) return res.status(400).send("Base64 tidak valid.");
        
        let mimeType = 'application/octet-stream';
        const headerMatch = parts[0].match(/^data:(.*?);base64/);
        if (headerMatch && headerMatch[1]) mimeType = headerMatch[1];

        const buffer = Buffer.from(parts[1], 'base64');
        res.type(mimeType);
        
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        res.setHeader('Pragma', 'cache');
        res.setHeader('Expires', new Date(Date.now() + 31536000000).toUTCString());
        
        res.send(buffer);
    } catch(e) {
        res.status(500).send("Gagal memuat file.");
    }
});

// ================= ENDPOINT API PDDIKTI MHS (DATABASE MAHASISWA) =================
const MHS_HASH_KEY = 'BEM_MHS_DB';

// GET ALL MHS & SEARCH (SUPPORT ANGKATAN, NIM, NAMA)
app.get('/api/mhs', async (req, res) => {
    try {
        if(!redis) throw new Error("Redis Offline");
        const allData = await redis.hgetall(MHS_HASH_KEY);
        
        let resultArray = [];
        if (allData) {
            for (const [nim, dataStr] of Object.entries(allData)) {
                resultArray.push(safeParse(dataStr, {}));
            }
        }
        
        // Fitur Filter Search
        if (req.query.q) {
            const q = req.query.q.toLowerCase();
            resultArray = resultArray.filter(m => 
                (m.nim && m.nim.toLowerCase().includes(q)) || 
                (m.nama && m.nama.toLowerCase().includes(q)) ||
                (m.angkatan && m.angkatan.toString().toLowerCase().includes(q))
            );
        }

        res.json({ success: true, data: resultArray });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Gagal mengambil database' });
    }
});

// GET SINGLE MHS DETAIL
app.get('/api/mhs/:nim', async (req, res) => {
    try {
        if(!redis) throw new Error("Redis Offline");
        const { nim } = req.params;
        const dataStr = await redis.hget(MHS_HASH_KEY, nim);
        
        if (!dataStr) return res.status(404).json({ success: false, message: 'Data Mahasiswa tidak ditemukan' });
        
        res.json({ success: true, data: safeParse(dataStr, {}) });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Gagal mengambil data' });
    }
});

// POST BULK UPLOAD (EXCEL DATA TO REDIS PIPELINE)
app.post('/api/mhs/bulk', verifyToken, async (req, res) => {
    try {
        if(!redis) throw new Error("Redis Offline");
        const { students } = req.body;
        if (!students || !Array.isArray(students)) {
            return res.status(400).json({ success: false, message: 'Format data tidak valid' });
        }

        const p = redis.pipeline();
        students.forEach(std => {
            if (std.nim && std.nama) {
                if(!std.foto) std.foto = '/img/bemprofilmhs.png';
                p.hset(MHS_HASH_KEY, { [std.nim]: JSON.stringify(std) });
            }
        });
        await p.exec();

        res.json({ success: true, message: `Berhasil sinkronisasi ${students.length} mahasiswa` });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Gagal melakukan sinkronisasi database' });
    }
});

// POST SINGLE MHS (CREATE)
app.post('/api/mhs', verifyToken, async (req, res) => {
    try {
        if(!redis) throw new Error("Redis Offline");
        const std = req.body;
        if (!std.nim || !std.nama) return res.status(400).json({ success: false, message: 'NIM dan Nama Wajib Diisi' });
        
        if(!std.foto) std.foto = '/img/bemprofilmhs.png';

        await redis.hset(MHS_HASH_KEY, { [std.nim]: JSON.stringify(std) });
        res.json({ success: true, message: 'Data Mahasiswa Berhasil Dibuat' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Gagal menyimpan data' });
    }
});

// PUT SINGLE MHS (UPDATE)
app.put('/api/mhs/:nim', verifyToken, async (req, res) => {
    try {
        if(!redis) throw new Error("Redis Offline");
        const { nim } = req.params;
        const std = req.body;
        
        const exists = await redis.hexists(MHS_HASH_KEY, nim);
        if (!exists) return res.status(404).json({ success: false, message: 'Data Mahasiswa tidak ditemukan' });

        std.nim = nim; 
        if(!std.foto) std.foto = '/img/bemprofilmhs.png';
        
        await redis.hset(MHS_HASH_KEY, { [nim]: JSON.stringify(std) });
        res.json({ success: true, message: 'Data Mahasiswa Berhasil Diperbarui' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Gagal memperbarui data' });
    }
});

// DELETE SINGLE MHS
app.delete('/api/mhs/:nim', verifyToken, async (req, res) => {
    try {
        if(!redis) throw new Error("Redis Offline");
        const { nim } = req.params;
        await redis.hdel(MHS_HASH_KEY, nim);
        res.json({ success: true, message: 'Data Mahasiswa Terhapus' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Gagal menghapus data' });
    }
});

// ================= ENDPOINT API LINKTREE & QR CODES (EXISTING) =================
app.get('/api/linktrees', async (req, res) => {
    try {
        if(!redis) throw new Error("Redis Offline");
        const trees = await redis.hgetall('BEM_Linktrees') || {};
        const parsedTrees = Object.values(trees).map(item => safeParse(item, {}));
        res.status(200).json({ success: true, data: parsedTrees });
    } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

app.get('/api/linktrees/:slug', async (req, res) => {
    try {
        if(!redis) throw new Error("Redis Offline");
        const trees = await redis.hgetall('BEM_Linktrees') || {};
        const treeArr = Object.values(trees).map(item => safeParse(item, {}));
        const tree = treeArr.find(t => t.slug === req.params.slug);
        
        if(!tree) return res.status(404).json({ success: false, message: "Linktree tidak ditemukan" });
        res.status(200).json({ success: true, data: tree });
    } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

app.post('/api/linktrees/save', verifyToken, async (req, res) => {
    try {
        if(!redis) throw new Error("Redis Offline");
        const payload = req.body;
        
        payload.slug = payload.slug.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/(^-|-$)+/g, '');
        if(!payload.id) payload.id = `LNK-${Date.now()}`;
        
        const trees = await redis.hgetall('BEM_Linktrees') || {};
        const treeArr = Object.values(trees).map(item => safeParse(item, {}));
        const isSlugTaken = treeArr.some(t => t.slug === payload.slug && t.id !== payload.id);
        
        if(isSlugTaken) {
            payload.slug = payload.slug + '-' + Math.floor(Math.random() * 1000); 
        }
        
        await redis.hset('BEM_Linktrees', { [payload.id]: JSON.stringify(payload) });
        res.status(200).json({ success: true, message: "Linktree disimpan!", data: payload });
    } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

app.delete('/api/linktrees/:id', verifyToken, async (req, res) => {
    try {
        if(!redis) throw new Error("Redis Offline");
        await redis.hdel('BEM_Linktrees', req.params.id);
        res.status(200).json({ success: true, message: "Dihapus" });
    } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

app.get(['/api/qrcodes', '/api/qrcodes/'], async (req, res) => {
    try {
        if(!redis) throw new Error("Redis Offline");
        const keys = await redis.keys('BEM_QRCodes:*');
        let parsedQRs = [];
        if(keys && keys.length > 0) {
            const raw = await redis.mget(...keys);
            parsedQRs = raw.filter(i => i != null).map(item => safeParse(item, {}));
            parsedQRs.sort((a, b) => {
                const dateA = a.updatedAt ? new Date(a.updatedAt) : new Date(0);
                const dateB = b.updatedAt ? new Date(b.updatedAt) : new Date(0);
                return dateB - dateA;
            });
        }
        res.status(200).json({ success: true, data: parsedQRs });
    } catch (e) { 
        res.status(500).json({ success: false, message: e.message }); 
    }
});

app.post('/api/qrcodes/save', verifyToken, async (req, res) => {
    try {
        if(!redis) throw new Error("Redis Offline");
        const payload = req.body;
        if(!payload.id) payload.id = `QR-${Date.now()}`;
        payload.updatedAt = new Date().toISOString();
        const redisKey = `BEM_QRCodes:${payload.id}`;
        await redis.set(redisKey, JSON.stringify(payload));
        res.status(200).json({ success: true, message: "Desain QR Code disimpan ke Cloud!", data: payload });
    } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

app.delete('/api/qrcodes/:id', verifyToken, async (req, res) => {
    try {
        if(!redis) throw new Error("Redis Offline");
        await redis.del(`BEM_QRCodes:${req.params.id}`);
        res.status(200).json({ success: true, message: "QR Code Permanen Dihapus" });
    } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Backend Server V2 berjalan di port ${PORT}`));

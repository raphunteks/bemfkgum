// FILE: serverV2.js
const express = require('express');
const { Redis } = require('@upstash/redis');
const cors = require('cors');
const path = require('path');
const crypto = require('crypto');
require('dotenv').config();

const app = express();

// ================= KONFIGURASI CORS & LIMIT REQUEST =================
// Mengizinkan header Authorization dan metode mutasi agar request preflight (OPTIONS) lolos tanpa blokir
const corsOptions = {
    origin: true,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin']
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

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
    console.log("✅ Sistem Database Upstash Redis Berhasil Terkoneksi (V2 - Linktree, QR Code, MHS & Pegawai).");
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

// ================= MIDDLEWARE AUTHENTICATION (SUPER ROBUST) =================
const verifyToken = (req, res, next) => {
    // Lewatkan request preflight OPTIONS langsung ke handler CORS
    if (req.method === 'OPTIONS') return next();

    const bearerHeader = req.headers['authorization'] || req.headers['Authorization'];
    
    if (typeof bearerHeader !== 'undefined' && bearerHeader) {
        const parts = bearerHeader.split(' ');
        const bearerToken = parts.length === 2 ? parts[1] : parts[0];
        const validSecret = process.env.ADMIN_TOKEN || 'AXA-XYZ-SECURE-TOKEN';

        if (bearerToken === validSecret || bearerToken === 'AXA-XYZ-SECURE-TOKEN') {
            return next();
        } else {
            return res.status(403).json({ success: false, message: 'Token Invalid atau Kedaluwarsa' });
        }
    } else {
        return res.status(403).json({ success: false, message: 'Akses Ditolak: Token Tidak Ditemukan' });
    }
};

// ================= ENDPOINT AUTENTIKASI ADMIN (SECURITY) =================
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

// ================= ENDPOINT API UPLOAD GAMBAR =================
app.post('/api/upload', async (req, res) => {
    try {
        if(!redis) throw new Error("Redis Offline");
        const { filename, base64 } = req.body;
        
        if(!filename || !base64) return res.status(400).json({ success: false, message: "File kosong." });
        
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

// ================= REDIS KEYS CONFIGURATION =================
const MHS_HASH_KEY = 'BEM_MHS_DB';
const MHS_SCHEMA_KEY = 'BEM_MHS_FORM_SCHEMA'; 
const MHS_LAST_UPDATE_KEY = 'BEM_LAST_UPDATE_MHS';

const CIVITAS_HASH_KEY = 'BEM_CIVITAS_DB'; 
const DOSEN_SCHEMA_KEY = 'BEM_DOSEN_FORM_SCHEMA';
const CIVITAS_SCHEMA_KEY = 'BEM_CIVITAS_FORM_SCHEMA';
const CIVITAS_LAST_UPDATE_KEY = 'BEM_LAST_UPDATE_CIVITAS';

// Helper Function: Generate Indo Formatted Date
function getIndoFormattedDate() {
    const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
    const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
    // Setting timezone to Asia/Makassar (WITA)
    const options = { timeZone: 'Asia/Makassar', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric' };
    const formatter = new Intl.DateTimeFormat([], options);
    const dateStr = formatter.format(new Date());
    
    const d = new Date(dateStr);
    
    const dayName = days[d.getDay() || new Date().getDay()];
    const date = d.getDate() || new Date().getDate();
    const monthName = months[d.getMonth() || new Date().getMonth()];
    const year = d.getFullYear() || new Date().getFullYear();
    const h = (d.getHours() || new Date().getHours()).toString().padStart(2, '0');
    const m = (d.getMinutes() || new Date().getMinutes()).toString().padStart(2, '0');
    
    return `${dayName}, ${date} ${monthName} ${year}, Jam ${h}:${m} WITA`;
}

// ================= ENDPOINT API MAHASISWA =================
app.get('/api/mhs/schema', async (req, res) => {
    try {
        if(!redis) throw new Error("Redis Offline");
        const schema = await redis.get(MHS_SCHEMA_KEY);
        res.json({ success: true, data: safeParse(schema, []) });
    } catch (error) { res.status(500).json({ success: false, message: 'Gagal mengambil skema' }); }
});

app.post('/api/mhs/schema', verifyToken, async (req, res) => {
    try {
        if(!redis) throw new Error("Redis Offline");
        await redis.set(MHS_SCHEMA_KEY, JSON.stringify(req.body));
        res.json({ success: true, message: 'Skema Berhasil Disimpan' });
    } catch (error) { res.status(500).json({ success: false, message: 'Gagal menyimpan skema' }); }
});

app.get('/api/mhs', async (req, res) => {
    try {
        if(!redis) throw new Error("Redis Offline");
        const allData = await redis.hgetall(MHS_HASH_KEY);
        const lastUpdate = await redis.get(MHS_LAST_UPDATE_KEY) || '-';
        
        let resultArray = [];
        if (allData) {
            for (const [id, dataStr] of Object.entries(allData)) { resultArray.push(safeParse(dataStr, {})); }
        }
        if (req.query.q) {
            const q = req.query.q.toLowerCase();
            resultArray = resultArray.filter(m => Object.values(m).some(val => String(val).toLowerCase().includes(q)));
        }
        res.json({ success: true, data: resultArray, lastUpdate: lastUpdate });
    } catch (error) { res.status(500).json({ success: false, message: 'Gagal mengambil database' }); }
});

app.get('/api/mhs/:id', async (req, res) => {
    try {
        if(!redis) throw new Error("Redis Offline");
        const dataStr = await redis.hget(MHS_HASH_KEY, req.params.id);
        if (!dataStr) return res.status(404).json({ success: false, message: 'Data tidak ditemukan' });
        res.json({ success: true, data: safeParse(dataStr, {}) });
    } catch (error) { res.status(500).json({ success: false, message: 'Gagal mengambil data' }); }
});

app.post('/api/mhs/bulk', verifyToken, async (req, res) => {
    try {
        if(!redis) throw new Error("Redis Offline");
        const { students } = req.body;
        if (!students || !Array.isArray(students)) return res.status(400).json({ success: false, message: 'Format data tidak valid' });
        
        const p = redis.pipeline();
        let successCount = 0;

        students.forEach(std => { 
            // ROBUST ID EXTRACTION (Menangkap semua kemungkinan penamaan STAMBUK)
            let idMhs = std.nim_profesi && std.nim_profesi !== '-' && std.nim_profesi !== '' ? std.nim_profesi : null;
            if(!idMhs) idMhs = std['STAMBUK/NIM PROFESI'] && std['STAMBUK/NIM PROFESI'] !== '-' ? std['STAMBUK/NIM PROFESI'] : null;
            if(!idMhs) idMhs = std.nim_sarjana && std.nim_sarjana !== '-' ? std.nim_sarjana : null;
            if(!idMhs) idMhs = std['STAMBUK/NIM SARJANA'] && std['STAMBUK/NIM SARJANA'] !== '-' ? std['STAMBUK/NIM SARJANA'] : null;
            if(!idMhs) idMhs = std.nim || std.NIM;

            if (idMhs && idMhs !== '' && idMhs !== '-') {
                std.nim = idMhs;
                p.hset(MHS_HASH_KEY, { [idMhs]: JSON.stringify(std) }); 
                successCount++;
            }
        });

        await p.exec();
        if(successCount === 0) return res.status(400).json({ success: false, message: 'Tidak ada data valid dengan Identifier (NIM/STAMBUK) yang ditemukan pada file Excel.' });
        
        await redis.set(MHS_LAST_UPDATE_KEY, getIndoFormattedDate());
        res.json({ success: true, message: `Berhasil sinkronisasi ${successCount} mahasiswa ke database.` });
    } catch (error) { 
        console.error(error);
        res.status(500).json({ success: false, message: 'Gagal melakukan sinkronisasi database' }); 
    }
});

app.post('/api/mhs', verifyToken, async (req, res) => {
    try {
        if(!redis) throw new Error("Redis Offline");
        const std = req.body;
        
        let idMhs = std.nim_profesi && std.nim_profesi !== '-' && std.nim_profesi !== '' ? std.nim_profesi : null;
        if(!idMhs) idMhs = std.nim_sarjana && std.nim_sarjana !== '-' ? std.nim_sarjana : null;
        if(!idMhs) idMhs = std.nim;

        if (!idMhs || idMhs === '-' || idMhs === '') return res.status(400).json({ success: false, message: 'NIM / STAMBUK Wajib Diisi (Identifier Database)' });
        
        std.nim = idMhs; 
        await redis.hset(MHS_HASH_KEY, { [idMhs]: JSON.stringify(std) }); 
        await redis.set(MHS_LAST_UPDATE_KEY, getIndoFormattedDate());
        res.json({ success: true, message: 'Data Mahasiswa Berhasil Dibuat' });
    } catch (error) { res.status(500).json({ success: false, message: 'Gagal menyimpan data' }); }
});

app.put('/api/mhs/:id', verifyToken, async (req, res) => {
    try {
        if(!redis) throw new Error("Redis Offline");
        const { id } = req.params;
        const exists = await redis.hexists(MHS_HASH_KEY, id);
        if (!exists) return res.status(404).json({ success: false, message: 'Data Mahasiswa tidak ditemukan' });
        
        req.body.nim = id; 
        await redis.hset(MHS_HASH_KEY, { [id]: JSON.stringify(req.body) }); 
        await redis.set(MHS_LAST_UPDATE_KEY, getIndoFormattedDate());
        res.json({ success: true, message: 'Data Mahasiswa Berhasil Diperbarui' });
    } catch (error) { res.status(500).json({ success: false, message: 'Gagal memperbarui data' }); }
});

app.delete('/api/mhs/:id', verifyToken, async (req, res) => {
    try {
        if(!redis) throw new Error("Redis Offline");
        await redis.hdel(MHS_HASH_KEY, req.params.id);
        await redis.set(MHS_LAST_UPDATE_KEY, getIndoFormattedDate());
        res.json({ success: true, message: 'Data Mahasiswa Terhapus' });
    } catch (error) { res.status(500).json({ success: false, message: 'Gagal menghapus data' }); }
});

// ================= ENDPOINT API PEGAWAI (DOSEN & CIVITAS) =================

app.get('/api/civitas/schema/dosen', async (req, res) => {
    try {
        if(!redis) throw new Error("Redis Offline");
        const schema = await redis.get(DOSEN_SCHEMA_KEY);
        res.json({ success: true, data: safeParse(schema, []) });
    } catch (error) { res.status(500).json({ success: false, message: 'Gagal mengambil skema Dosen' }); }
});

app.post('/api/civitas/schema/dosen', verifyToken, async (req, res) => {
    try {
        if(!redis) throw new Error("Redis Offline");
        await redis.set(DOSEN_SCHEMA_KEY, JSON.stringify(req.body));
        res.json({ success: true, message: 'Skema Dosen Berhasil Disimpan' });
    } catch (error) { res.status(500).json({ success: false, message: 'Gagal menyimpan skema Dosen' }); }
});

app.get('/api/civitas/schema/civitas', async (req, res) => {
    try {
        if(!redis) throw new Error("Redis Offline");
        const schema = await redis.get(CIVITAS_SCHEMA_KEY);
        res.json({ success: true, data: safeParse(schema, []) });
    } catch (error) { res.status(500).json({ success: false, message: 'Gagal mengambil skema Civitas' }); }
});

app.post('/api/civitas/schema/civitas', verifyToken, async (req, res) => {
    try {
        if(!redis) throw new Error("Redis Offline");
        await redis.set(CIVITAS_SCHEMA_KEY, JSON.stringify(req.body));
        res.json({ success: true, message: 'Skema Civitas Berhasil Disimpan' });
    } catch (error) { res.status(500).json({ success: false, message: 'Gagal menyimpan skema Civitas' }); }
});

// Get All Pegawai
app.get('/api/civitas', async (req, res) => {
    try {
        if(!redis) throw new Error("Redis Offline");
        const allData = await redis.hgetall(CIVITAS_HASH_KEY);
        const lastUpdate = await redis.get(CIVITAS_LAST_UPDATE_KEY) || '-';
        
        let resultArray = [];
        if (allData) {
            for (const [id, dataStr] of Object.entries(allData)) {
                resultArray.push(safeParse(dataStr, {}));
            }
        }
        if (req.query.q) {
            const q = req.query.q.toLowerCase();
            resultArray = resultArray.filter(p => Object.values(p).some(val => String(val).toLowerCase().includes(q)));
        }
        res.json({ success: true, data: resultArray, lastUpdate: lastUpdate });
    } catch (error) { res.status(500).json({ success: false, message: 'Gagal mengambil database pegawai' }); }
});

// GET SINGLE PEGAWAI
app.get('/api/civitas/:id', async (req, res) => {
    try {
        if(!redis) throw new Error("Redis Offline");
        const dataStr = await redis.hget(CIVITAS_HASH_KEY, req.params.id);
        if (!dataStr) return res.status(404).json({ success: false, message: 'Data Pegawai tidak ditemukan' });
        res.json({ success: true, data: safeParse(dataStr, {}) });
    } catch (error) { res.status(500).json({ success: false, message: 'Gagal mengambil data pegawai' }); }
});

app.post('/api/civitas/bulk', verifyToken, async (req, res) => {
    try {
        if(!redis) throw new Error("Redis Offline");
        const { pegawai } = req.body;
        if (!pegawai || !Array.isArray(pegawai)) return res.status(400).json({ success: false, message: 'Format data tidak valid' });
        
        const p = redis.pipeline();
        let successCount = 0;

        pegawai.forEach(peg => {
            const pegId = peg.nip || peg.nidn || peg.NIP || peg.NIDN;
            if (pegId && pegId !== '-' && pegId !== '') {
                peg.nip = pegId;
                p.hset(CIVITAS_HASH_KEY, { [pegId]: JSON.stringify(peg) });
                successCount++;
            }
        });

        await p.exec();
        if(successCount === 0) return res.status(400).json({ success: false, message: 'Tidak ada data valid dengan Identifier (NIDN/NIP) yang ditemukan pada file Excel.' });

        await redis.set(CIVITAS_LAST_UPDATE_KEY, getIndoFormattedDate());
        res.json({ success: true, message: `Berhasil sinkronisasi ${successCount} pegawai` });
    } catch (error) { res.status(500).json({ success: false, message: 'Gagal melakukan sinkronisasi database pegawai' }); }
});

app.post('/api/civitas', verifyToken, async (req, res) => {
    try {
        if(!redis) throw new Error("Redis Offline");
        const peg = req.body;
        const idPegawai = peg.nip || peg.nidn || peg.NIP || peg.NIDN;
        if (!idPegawai || idPegawai === '-' || idPegawai === '') return res.status(400).json({ success: false, message: 'NIP / NIDN Wajib Diisi (Identifier Database)' });

        peg.nip = idPegawai;
        await redis.hset(CIVITAS_HASH_KEY, { [idPegawai]: JSON.stringify(peg) });
        await redis.set(CIVITAS_LAST_UPDATE_KEY, getIndoFormattedDate());
        res.json({ success: true, message: 'Data Pegawai Berhasil Dibuat' });
    } catch (error) { res.status(500).json({ success: false, message: 'Gagal menyimpan data pegawai' }); }
});

app.put('/api/civitas/:id', verifyToken, async (req, res) => {
    try {
        if(!redis) throw new Error("Redis Offline");
        const { id } = req.params;
        const exists = await redis.hexists(CIVITAS_HASH_KEY, id);
        if (!exists) return res.status(404).json({ success: false, message: 'Data Pegawai tidak ditemukan' });

        req.body.nip = id;
        await redis.hset(CIVITAS_HASH_KEY, { [id]: JSON.stringify(req.body) });
        await redis.set(CIVITAS_LAST_UPDATE_KEY, getIndoFormattedDate());
        res.json({ success: true, message: 'Data Pegawai Berhasil Diperbarui' });
    } catch (error) { res.status(500).json({ success: false, message: 'Gagal memperbarui data pegawai' }); }
});

app.delete('/api/civitas/:id', verifyToken, async (req, res) => {
    try {
        if(!redis) throw new Error("Redis Offline");
        await redis.hdel(CIVITAS_HASH_KEY, req.params.id);
        await redis.set(CIVITAS_LAST_UPDATE_KEY, getIndoFormattedDate());
        res.json({ success: true, message: 'Data Pegawai Terhapus' });
    } catch (error) { res.status(500).json({ success: false, message: 'Gagal menghapus data pegawai' }); }
});

// ================= ENDPOINT API LINKTREE =================
function getMakassarDateInfo() {
    const now = new Date();
    // Makassar is WITA (UTC+8)
    const wita = new Date(now.getTime() + 8 * 60 * 60 * 1000);
    const todayStr = wita.toISOString().slice(0, 10); // YYYY-MM-DD
    
    // ISO week number
    const temp = new Date(wita.getTime());
    temp.setHours(0, 0, 0, 0);
    temp.setDate(temp.getDate() + 3 - (temp.getDay() + 6) % 7);
    const week1 = new Date(temp.getFullYear(), 0, 4);
    const weekNum = 1 + Math.round(((temp.getTime() - week1.getTime()) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7);
    const weekStr = `${temp.getFullYear()}-W${weekNum}`;

    return { todayStr, weekStr };
}

app.get('/api/linktrees', async (req, res) => {
    try {
        if(!redis) throw new Error("Redis Offline");
        const trees = await redis.hgetall('BEM_Linktrees') || {};
        const parsedTrees = Object.values(trees).map(item => safeParse(item, {}));
        res.status(200).json({ success: true, data: parsedTrees });
    } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// Analytics Overview
app.get('/api/linktrees/analytics/overview', async (req, res) => {
    try {
        if (!redis) throw new Error("Redis Offline");
        const trees = await redis.hgetall('BEM_Linktrees') || {};
        const treeArr = Object.values(trees).map(item => safeParse(item, {}));
        const { todayStr, weekStr } = getMakassarDateInfo();

        let totalViewsToday = 0;
        let totalViewsWeek = 0;
        let totalViewsAllTime = 0;

        const items = await Promise.all(treeArr.map(async (tree) => {
            const slug = tree.slug;
            const title = tree.profile?.title || tree.title || slug;
            const statsKey = `BEM_Linktree_Stats:${slug}`;
            const stats = await redis.hgetall(statsKey) || {};

            let total = parseInt(stats.total, 10) || 0;
            let today = parseInt(stats.today, 10) || 0;
            let week = parseInt(stats.week, 10) || 0;

            if (stats.today_date !== todayStr) today = 0;
            if (stats.week_num !== weekStr) week = 0;

            totalViewsToday += today;
            totalViewsWeek += week;
            totalViewsAllTime += total;

            return {
                id: tree.id,
                slug: slug,
                title: title,
                today: today,
                week: week,
                total: total,
                viewsToday: today,
                viewsWeek: week,
                totalViews: total
            };
        }));

        res.status(200).json({
            success: true,
            data: {
                items,
                totalViewsToday,
                totalViewsWeek,
                totalViewsAllTime
            }
        });
    } catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
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

// Unique View Tracking Endpoint dengan Deduplikasi Anti-Spam / Anti-Duplicate
app.post('/api/linktrees/:slug/view', async (req, res) => {
    try {
        const slug = req.params.slug;
        if (!slug) return res.status(400).json({ success: false, message: "Slug diperlukan" });

        const { todayStr, weekStr } = getMakassarDateInfo();

        if (!redis) {
            return res.status(200).json({
                success: true,
                stats: { today: 1, week: 1, total: 1, viewsToday: 1, viewsWeek: 1, totalViews: 1 },
                isNew: true
            });
        }

        const rawIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '';
        const ip = String(rawIp).split(',')[0].trim();
        const ua = String(req.headers['user-agent'] || '').slice(0, 120);
        const visitorId = String(req.body.visitorId || '');

        const visitorFingerprint = crypto.createHash('md5').update(`${ip}_${ua}_${visitorId}`).digest('hex');
        const dedupKey = `BEM_Linktree_Dedup:${slug}:${visitorFingerprint}`;
        const statsKey = `BEM_Linktree_Stats:${slug}`;

        const alreadySeen = await redis.get(dedupKey);

        let stats = await redis.hgetall(statsKey) || {};
        let total = parseInt(stats.total, 10) || 0;
        let today = parseInt(stats.today, 10) || 0;
        let todayDate = stats.today_date || '';
        let week = parseInt(stats.week, 10) || 0;
        let weekNum = stats.week_num || '';

        // Reset jika pergantian hari atau minggu
        if (todayDate !== todayStr) {
            today = 0;
            todayDate = todayStr;
        }
        if (weekNum !== weekStr) {
            week = 0;
            weekNum = weekStr;
        }

        if (!alreadySeen) {
            total += 1;
            today += 1;
            week += 1;

            // Kunci deduplikasi aktif selama 24 jam (86400 detik)
            await redis.set(dedupKey, '1', { ex: 86400 });
            await redis.hset(statsKey, {
                total: String(total),
                today: String(today),
                today_date: todayDate,
                week: String(week),
                week_num: weekNum,
                lastVisit: new Date().toISOString()
            });
        }

        res.status(200).json({
            success: true,
            stats: { today, week, total, viewsToday: today, viewsWeek: week, totalViews: total },
            isNew: !alreadySeen
        });
    } catch (e) {
        console.error("Gagal mencatat linktree view:", e);
        res.status(500).json({ success: false, message: e.message });
    }
});

// Endpoint Pembacaan Statistik Kunjungan Linktree
app.get('/api/linktrees/:slug/stats', async (req, res) => {
    try {
        const slug = req.params.slug;
        const { todayStr, weekStr } = getMakassarDateInfo();

        if (!redis) {
            return res.status(200).json({ success: true, stats: { today: 0, week: 0, total: 0, viewsToday: 0, viewsWeek: 0, totalViews: 0 } });
        }

        const statsKey = `BEM_Linktree_Stats:${slug}`;
        let stats = await redis.hgetall(statsKey) || {};
        let total = parseInt(stats.total, 10) || 0;
        let today = parseInt(stats.today, 10) || 0;
        let week = parseInt(stats.week, 10) || 0;

        if (stats.today_date !== todayStr) today = 0;
        if (stats.week_num !== weekStr) week = 0;

        res.status(200).json({ success: true, stats: { today, week, total, viewsToday: today, viewsWeek: week, totalViews: total } });
    } catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
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

// ================= ENDPOINT API QR CODES =================
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
        console.error("Gagal load QR Codes:", e.message);
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
    } catch (e) { 
        res.status(500).json({ success: false, message: e.message }); 
    }
});

app.delete('/api/qrcodes/:id', verifyToken, async (req, res) => {
    try {
        if(!redis) throw new Error("Redis Offline");
        await redis.del(`BEM_QRCodes:${req.params.id}`);
        res.status(200).json({ success: true, message: "QR Code Permanen Dihapus" });
    } catch (e) { 
        res.status(500).json({ success: false, message: e.message }); 
    }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Backend Server V2 berjalan di port ${PORT}`));

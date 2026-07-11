// FILE: server.js
const express = require('express');
const { Redis } = require('@upstash/redis');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Memastikan file statis bisa diakses langsung oleh Express (Berguna jika Vercel.json melempar route kemari)
app.use(express.static(path.join(__dirname, 'public')));

app.engine('html', require('ejs').renderFile);
app.set('view engine', 'html');
app.set('views', path.join(__dirname, 'views'));

// ================= INISIASI UPSTASH REDIS (SUPER UPGRADE ENV) =================
const redisUrl = process.env.KV_REST_API_URL || 'https://merry-hedgehog-35658.upstash.io';
const redisToken = process.env.KV_REST_API_TOKEN || 'AYtKAAIncDIzYmQyNWM4YTM2Y2E0ODZkOTJlNTYwNzBjMzMyNWQxZHAyMzU2NTg';

let redis = null;
try {
    redis = new Redis({ 
        url: redisUrl, 
        token: redisToken 
    });
    console.log("✅ Sistem Database Upstash Redis Berhasil Terkoneksi.");
} catch (error) {
    console.error("⚠️ Peringatan: Redis gagal inisiasi. Backend berjalan di Mode Offline.", error.message);
}

// ================= DATA SEED (STRUKTUR BEM KBMFKG UMI LENGKAP) =================
const defaultOrg = {
    visi: "MENJADIKAN BEM KBMFKG UMI ORGANISASI YANG PROGRESIF, BERPRESTASI, DAN BERLANDASKAN NILAI-NILAI ISLAMI DALAM MENYALURKAN ASPIRASI MAHASISWA UNTUK KEMAJUAN BERSAMA.",
    misi: [
        "Menampung dan menyalurkan aspirasi mahasiswa secara transparan dan aktif.",
        "Mendorong dan memfasilitasi pengembangan prestasi akademik dan non-akademik mahasiswa.",
        "Mengintegrasikan nilai-nilai islami dalam program kerja dan kegiatan organisasi.",
        "Membangun lingkungan kampus yang harmonis, berakhlak mulia, dan berdaya saing.",
        "Meningkatkan kapasitas dan kualitas kader melalui pendidikan dan pelatihan berprinsip islami."
    ],
    pimpinan: [
        { jabatan: "Ketua BEM KBMFKG UMI", nama: "Ailan Alif Wajdi Daya", foto: "/img/bemfkgumi.png" },
        { jabatan: "Wakil Ketua BEM KBMFKG UMI", nama: "Akram Husain", foto: "/img/bemfkgumi.png" },
        { jabatan: "Sekretaris BEM KBMFKG UMI", nama: "Dian Sancika Rizky. S", foto: "/img/bemfkgumi.png" },
        { jabatan: "Bendahara BEM KBMFKG UMI", nama: "Nurul Amelia Limbu. S", foto: "/img/bemfkgumi.png" }
    ],
    departemen: [
        { nama: "Dept. Character of Building", anggota: [{jabatan: "Koordinator", nama: "Muh. Ersa Aditya", foto: "/img/bemfkgumi.png"}, {jabatan: "Anggota", nama: "Denta Ahmad Arkana M", foto: "/img/bemfkgumi.png"}, {jabatan: "Anggota", nama: "Muhammad Rizky", foto: "/img/bemfkgumi.png"}, {jabatan: "Anggota", nama: "Salsabila Putri M", foto: "/img/bemfkgumi.png"}, {jabatan: "Anggota", nama: "Absabrina Aulia R", foto: "/img/bemfkgumi.png"}, {jabatan: "Anggota", nama: "Faida Shaima Nawal", foto: "/img/bemfkgumi.png"}] },
        { nama: "Dept. of Science Education and Research", anggota: [{jabatan: "Koordinator", nama: "Muh. Alif Perdana Putra", foto: "/img/bemfkgumi.png"}, {jabatan: "Anggota", nama: "Fatahillah Fadhillah", foto: "/img/bemfkgumi.png"}, {jabatan: "Anggota", nama: "Fini", foto: "/img/bemfkgumi.png"}, {jabatan: "Anggota", nama: "Annisa Rshikhah Afsa", foto: "/img/bemfkgumi.png"}, {jabatan: "Anggota", nama: "Rekha Al-Syam", foto: "/img/bemfkgumi.png"}, {jabatan: "Anggota", nama: "Farah Luthfiyyah", foto: "/img/bemfkgumi.png"}] },
        { nama: "Dept. of Islamic", anggota: [{jabatan: "Koordinator", nama: "Maysar Ma'ruf", foto: "/img/bemfkgumi.png"}, {jabatan: "Anggota", nama: "Ahmad Syafii", foto: "/img/bemfkgumi.png"}, {jabatan: "Anggota", nama: "Ramadani Qurrata Ayunin", foto: "/img/bemfkgumi.png"}, {jabatan: "Anggota", nama: "Salwa Nariyah", foto: "/img/bemfkgumi.png"}, {jabatan: "Anggota", nama: "Nayla Dwi Ramadhani", foto: "/img/bemfkgumi.png"}, {jabatan: "Anggota", nama: "Nayla Dzakiyah N.S", foto: "/img/bemfkgumi.png"}] },
        { nama: "Dept. of Sekretariat", anggota: [{jabatan: "Koordinator", nama: "Febrio Arya Pradana", foto: "/img/bemfkgumi.png"}, {jabatan: "Anggota", nama: "Andi Muhammad Dwiansyah", foto: "/img/bemfkgumi.png"}, {jabatan: "Anggota", nama: "Andi Nabila Azzahra", foto: "/img/bemfkgumi.png"}, {jabatan: "Anggota", nama: "Raidah Hanisah", foto: "/img/bemfkgumi.png"}, {jabatan: "Anggota", nama: "Andi Wilda", foto: "/img/bemfkgumi.png"}, {jabatan: "Anggota", nama: "Rima Aulia", foto: "/img/bemfkgumi.png"}] },
        { nama: "Dept. of Treasure", anggota: [{jabatan: "Koordinator", nama: "Putri Amaliah", foto: "/img/bemfkgumi.png"}, {jabatan: "Anggota", nama: "Jiyaad Taqi Rozan", foto: "/img/bemfkgumi.png"}, {jabatan: "Anggota", nama: "Aliyah Restu Pratiwi A", foto: "/img/bemfkgumi.png"}, {jabatan: "Anggota", nama: "Fardah Naisa", foto: "/img/bemfkgumi.png"}, {jabatan: "Anggota", nama: "Israwati Amanda", foto: "/img/bemfkgumi.png"}, {jabatan: "Anggota", nama: "Nayla", foto: "/img/bemfkgumi.png"}] },
        { nama: "Dept. of Art and Sport", anggota: [{jabatan: "Koordinator", nama: "Ilham Subhan Rafikal", foto: "/img/bemfkgumi.png"}, {jabatan: "Anggota", nama: "Fajak Ryamizard Kasvari", foto: "/img/bemfkgumi.png"}, {jabatan: "Anggota", nama: "M. Raihan Prayoga Amirul", foto: "/img/bemfkgumi.png"}, {jabatan: "Anggota", nama: "Annesa Fatimah Azzahra", foto: "/img/bemfkgumi.png"}, {jabatan: "Anggota", nama: "Azizah Umaimah Arif", foto: "/img/bemfkgumi.png"}, {jabatan: "Anggota", nama: "Nadira Ramadhani", foto: "/img/bemfkgumi.png"}] },
        { nama: "Dept. of Dedication Humanity", anggota: [{jabatan: "Koordinator", nama: "Moh. Rayyan Ghazali", foto: "/img/bemfkgumi.png"}, {jabatan: "Anggota", nama: "Muh. Yusuf Wahyuni", foto: "/img/bemfkgumi.png"}, {jabatan: "Anggota", nama: "Darul Rizkyansyah", foto: "/img/bemfkgumi.png"}, {jabatan: "Anggota", nama: "Situ Aisyah Rahmat", foto: "/img/bemfkgumi.png"}, {jabatan: "Anggota", nama: "Wisma Rahfah", foto: "/img/bemfkgumi.png"}, {jabatan: "Anggota", nama: "Nurul Alifiyah Arrahma A", foto: "/img/bemfkgumi.png"}] },
        { nama: "Dept. of Study and Strategy", anggota: [{jabatan: "Koordinator", nama: "Irfan Maulana Irwan", foto: "/img/bemfkgumi.png"}, {jabatan: "Anggota", nama: "Saiful S", foto: "/img/bemfkgumi.png"}, {jabatan: "Anggota", nama: "Andi Putra Istiqamah", foto: "/img/bemfkgumi.png"}, {jabatan: "Anggota", nama: "Hildan Nilan Cahaya", foto: "/img/bemfkgumi.png"}, {jabatan: "Anggota", nama: "Zilfy Rukmana Tutu", foto: "/img/bemfkgumi.png"}, {jabatan: "Anggota", nama: "Ilmi Ramadhani", foto: "/img/bemfkgumi.png"}] },
        { nama: "Dept. of Information and Communication", anggota: [{jabatan: "Koordinator", nama: "Silviyananda", foto: "/img/bemfkgumi.png"}, {jabatan: "Anggota", nama: "Muh. Syauqi Zahran. B", foto: "/img/bemfkgumi.png"}, {jabatan: "Anggota", nama: "Daegal Fauza Iryanto", foto: "/img/bemfkgumi.png"}, {jabatan: "Anggota", nama: "Zahwa Alzahra", foto: "/img/bemfkgumi.png"}, {jabatan: "Anggota", nama: "Zaneta Zahra Zulaikha", foto: "/img/bemfkgumi.png"}, {jabatan: "Anggota", nama: "Novita Widyantari", foto: "/img/bemfkgumi.png"}] }
    ]
};

const defaultSettings = {
    headerText: "BEM KBMFKG UMI",
    footerSlogan: "Kabinet Ananta Anardhaya",
    footerAlamat: "Jl. Pajonga Dg. Ngalle No. 27 A, Pa'batong, Kec. Mamajang, Kota Makassar, Sulawesi Selatan",
    logo1: "/img/bemfkgumi.png",
    logo2: "/img/bemfkgumi.png",
    logo3: "/img/bemfkgumi.png"
};

// ================= ROUTES FRONTEND =================
app.get('/', (req, res) => res.render('index'));
app.get('/tentang', (req, res) => res.render('tentang'));
app.get('/informasi', (req, res) => res.render('informasi'));
app.get('/narahubung', (req, res) => res.render('narahubung'));
app.get('/admin', (req, res) => res.render('admin-dashboard'));

// ================= UTILITY: SAFE JSON PARSER (ANTI-CRASH) =================
// Fungsi ini memastikan server TIDAK AKAN crash jika data Redis corrupt
const safeParse = (data, fallbackData) => {
    if (!data) return fallbackData;
    try {
        return typeof data === 'string' ? JSON.parse(data) : data;
    } catch (error) {
        console.error("⚠️ Data terdeteksi korup, menggunakan fallback data.");
        return fallbackData;
    }
};

// ================= API ENDPOINTS: MANAJEMEN KONTEN (CMS) =================
app.get('/api/content', async (req, res) => {
    try {
        if(!redis) throw new Error("Redis Offline");
        let org = await redis.get('Org_Structure');
        let proker = await redis.get('Proker_Data');
        let kalender = await redis.get('Kalender_Data');
        let dokumentasi = await redis.get('Dokumentasi_Data');
        let settings = await redis.get('Settings_Data');

        res.status(200).json({ 
            success: true, 
            org: safeParse(org, defaultOrg),
            proker: safeParse(proker, []),
            kalender: safeParse(kalender, []),
            dokumentasi: safeParse(dokumentasi, []),
            settings: safeParse(settings, defaultSettings)
        });
    } catch (error) {
        // FALLBACK AMAN: Tetap mengirim data statis agar halaman TIDAK BLANK
        res.status(200).json({ success: false, org: defaultOrg, proker: [], kalender: [], dokumentasi: [], settings: defaultSettings });
    }
});

// BUG FIX: Menggabungkan 2 route app.post yang sebelumnya duplikat/bertumpuk
app.post('/api/content/:type', async (req, res) => {
    try {
        if(!redis) throw new Error("Redis Offline");
        const type = req.params.type;
        
        // Selalu ubah ke String sebelum dilempar ke Redis untuk mencegah bug serialisasi Object
        const payload = JSON.stringify(req.body); 
        
        if (type === 'org') await redis.set('Org_Structure', payload);
        else if (type === 'proker') await redis.set('Proker_Data', payload);
        else if (type === 'kalender') await redis.set('Kalender_Data', payload);
        else if (type === 'dokumentasi') await redis.set('Dokumentasi_Data', payload);
        else if (type === 'settings') await redis.set('Settings_Data', payload);
        else return res.status(400).json({ success: false, message: "Tipe Endpoint Tidak Valid" });

        res.status(200).json({ success: true, message: `Data ${type} berhasil diperbarui di Redis!` });
    } catch (error) {
        console.error("Gagal simpan:", error);
        res.status(500).json({ success: false, message: 'Gagal menyimpan data ke Redis.' });
    }
});


// ================= API ENDPOINTS: TRANSAKSIONAL =================
app.get('/api/interactions', async (req, res) => {
    try {
        if(!redis) throw new Error("Redis Offline");
        const aspirasi = await redis.hgetall('Aspirations') || {};
        const pesan = await redis.hgetall('Messages') || {};
        
        // Parse Hash values dengan perlindungan Anti-Crash (Safe Parse Map)
        const parsedAspirasi = Object.values(aspirasi).map(item => safeParse(item, {}));
        const parsedPesan = Object.values(pesan).map(item => safeParse(item, {}));
        
        res.status(200).json({ success: true, aspirasi: parsedAspirasi, pesan: parsedPesan });
    } catch (error) {
        res.status(200).json({ success: false, aspirasi: [], pesan: [] });
    }
});

app.post('/api/plasma', async (req, res) => {
  try {
    const { judul, kategori, jenis, isi, setuju } = req.body;
    const id = `ASP-${Date.now()}`;
    const payload = { id: String(id), judul: String(judul), kategori: String(kategori), jenis: String(jenis), isi: String(isi), timestamp: new Date().toISOString() };
    if (redis) await redis.hset('Aspirations', { [id]: JSON.stringify(payload) });
    res.status(200).json({ success: true, message: 'Aspirasi berhasil dikirim!' });
  } catch (error) { res.status(500).json({ success: false }); }
});

app.post('/api/message', async (req, res) => {
  try {
    const { nama, kontak, subjek, pesan } = req.body;
    const id = `MSG-${Date.now()}`;
    const payload = { id, nama: String(nama), kontak: String(kontak), subjek: String(subjek), pesan: String(pesan), timestamp: new Date().toISOString() };
    if (redis) await redis.hset('Messages', { [id]: JSON.stringify(payload) });
    res.status(200).json({ success: true, message: 'Pesan terkirim!' });
  } catch (error) { res.status(500).json({ success: false }); }
});

app.post('/api/delete-interaction', async (req, res) => {
    try {
        const { type, id } = req.body;
        if(type === 'aspirasi' && redis) await redis.hdel('Aspirations', id);
        if(type === 'pesan' && redis) await redis.hdel('Messages', id);
        res.status(200).json({ success: true });
    } catch (error) { res.status(500).json({ success: false }); }
});

app.post('/api/admin/auth', (req, res) => {
  const { username, password } = req.body;
  
  // BUG FIX: Proteksi jika ENV belum di-setting di Vercel, selalu pastikan ada Fallback login
  const validUser = process.env.ADMIN_USER || 'bemfkgumi2026';
  const validPass = process.env.ADMIN_PASS || 'bemfkgumi999';

  if (username === validUser && password === validPass) {
    res.status(200).json({ success: true, token: 'AXA-XYZ-SECURE-TOKEN' });
  } else {
    res.status(401).json({ success: false, message: 'Kredensial salah!' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server BEM KBMFKG UMI berjalan di port ${PORT}`));

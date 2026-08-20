// FILE: server.js
const express = require('express');
const { Redis } = require('@upstash/redis');
const cors = require('cors');
const path = require('path');
const xlsx = require('xlsx'); // PACKAGE BARU UNTUK EXPORT EXCEL FORM
require('dotenv').config();

const app = express();

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// ================= SUPER BIG UPGRADE: ANTI-CACHE UNTUK REALTIME LIVE UPDATE =================
// Memastikan semua request API tidak di-cache oleh browser sehingga data selalu REALTIME dari Redis
app.use('/api', (req, res, next) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('Surrogate-Control', 'no-store');
    next();
});

// ================= STATIC FILES & VERCEL ROUTING FIX =================
// Memastikan file statis bisa diakses langsung oleh Express (Default)
app.use(express.static(path.join(__dirname, 'public')));

// SUPER UPGRADE: Sinkronisasi mutlak dengan vercel.json routing
// Menangkap rewrite internal dari Vercel agar CSS dan Gambar tidak BLANK (404)
app.use('/public', express.static(path.join(__dirname, 'public')));
app.use('/css', express.static(path.join(__dirname, 'public/css')));
app.use('/img', express.static(path.join(__dirname, 'public/img')));
app.use('/js', express.static(path.join(__dirname, 'public/js')));

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
    console.log("✅ Sistem Database Upstash Redis Berhasil Terkoneksi. (REALTIME DUAL-ENGINE MODE)");
} catch (error) {
    console.error("⚠️ Peringatan: Redis gagal inisiasi. Backend berjalan di Mode Offline.", error.message);
}

// ================= UTILITY: SAFE JSON PARSER (ANTI-CRASH) =================
const safeParse = (data, fallbackData) => {
    if (!data) return fallbackData;
    try {
        return typeof data === 'string' ? JSON.parse(data) : data;
    } catch (error) {
        console.error("⚠️ Data terdeteksi korup, menggunakan fallback data.");
        return fallbackData;
    }
};

// Fungsi krusial untuk mencegah XML Sitemap error karena karakter ilegal (seperti '&' pada URL Gambar)
const escapeXml = (unsafe) => {
    if (!unsafe) return '';
    return unsafe.replace(/[<>&'"]/g, (c) => {
        switch (c) {
            case '<': return '&lt;';
            case '>': return '&gt;';
            case '&': return '&amp;';
            case '\'': return '&apos;';
            case '"': return '&quot;';
            default: return c;
        }
    });
};

// ================= DATA SEED (STRUKTUR BEM KBMFKG UMI LENGKAP 100% UTUH) =================
const defaultOrg = {
    visi: "MENJADIKAN BEM KBMFKG UMI ORGANISASI YANG PROGRESIF, BERPRESTASI, DAN BERLANDASKAN NILAI-NILAI ISLAMI DALAM MENYALURKAN ASPIRASI MAHASISWA UNTUK KEMAJUAN BERSAMA.",
    misi: [
        "MENAMPUNG DAN MENYALURKAN ASPIRASI MAHASISWA SECARA TRANSPARAN DAN AKTIF.",
        "MENDORONG DAN MEMFASILITASI PENGEMBANGAN PRESTASI AKADEMIK DAN NON-AKADEMIK MAHASISWA.",
        "MENGINTEGRASIKAN NILAI-NILAI ISLAMI DALAM PROGRAM KERJA DAN KEGIATAN ORGANISASI.",
        "MEMBANGUN LINGKUNGAN KAMPUS YANG HARMONIS, BERAKHLAK MULIA, DAN BERDAYA SAING.",
        "MENINGKATKAN KAPASITAS DAN KUALITAS KADER MELALUI PENDIDIKAN DAN PELATIHAN BERPRINSIP ISLAMI."
    ],
    artiKabinet: {
        kata1: "ANANTA",
        arti1: "SEMANGAT PERJUANGAN TANPA BATAS",
        kata2: "ANARDHAYA",
        arti2: "SESUATU YANG ABADI",
        kesimpulan: "DAPAT DIARTIKAN SEBAGAI PERJUANGAN YANG TAK TERBATAS DAN TIDAK RUSAK/HANCUR, MENGGAMBARKAN SESUATU YANG ABADI, KEKAL, DAN TIDAK TERHALANG OLEH WAKTU."
    },
    pimpinan: [
        { jabatan: "Ketua BEM KBMFKG UMI", nama: "Ailan Alif Wajdi Daya", foto: "/img/bemfkgumi.png" },
        { jabatan: "Wakil Ketua BEM KBMFKG UMI", nama: "Akram Husain", foto: "/img/bemfkgumi.png" },
        { jabatan: "Sekretaris BEM KBMFKG UMI", nama: "Dian Sancika Rizky. S", foto: "/img/bemfkgumi.png" },
        { jabatan: "Bendahara BEM KBMFKG UMI", nama: "Nurul Amelia Limbu. S", foto: "/img/bemfkgumi.png" }
    ],
    departemen: [
        { nama: "Dept. of Information and Communication", anggota: [{jabatan: "Koordinator", nama: "Silviyananda", foto: "/img/bemfkgumi.png"}, {jabatan: "Anggota", nama: "Muh. Syauqi Zahran. B", foto: "/img/bemfkgumi.png"}, {jabatan: "Anggota", nama: "Daegal Fauza Iryanto", foto: "/img/bemfkgumi.png"}, {jabatan: "Anggota", nama: "Zahwa Alzahra", foto: "/img/bemfkgumi.png"}, {jabatan: "Anggota", nama: "Zaneta Zahra Zulaikha", foto: "/img/bemfkgumi.png"}, {jabatan: "Anggota", nama: "Novita Widyantari", foto: "/img/bemfkgumi.png"}] },
        { nama: "Dept. of Science Education and Research", anggota: [{jabatan: "Koordinator", nama: "Muh. Alif Perdana Putra", foto: "/img/bemfkgumi.png"}, {jabatan: "Anggota", nama: "Fatahillah Fadhillah", foto: "/img/bemfkgumi.png"}] },
        { nama: "Dept. of Islamic", anggota: [{jabatan: "Koordinator", nama: "Maysar Ma'ruf", foto: "/img/bemfkgumi.png"}, {jabatan: "Anggota", nama: "Ahmad Syafii", foto: "/img/bemfkgumi.png"}] },
        { nama: "Dept. of Sekretariat", anggota: [{jabatan: "Koordinator", nama: "Febrio Arya Pradana", foto: "/img/bemfkgumi.png"}, {jabatan: "Anggota", nama: "Andi Muhammad Dwiansyah", foto: "/img/bemfkgumi.png"}] },
        { nama: "Dept. of Treasure", anggota: [{jabatan: "Koordinator", nama: "Putri Amaliah", foto: "/img/bemfkgumi.png"}, {jabatan: "Anggota", nama: "Jiyaad Taqi Rozan", foto: "/img/bemfkgumi.png"}] },
        { nama: "Dept. of Art and Sport", anggota: [{jabatan: "Koordinator", nama: "Ilham Subhan Rafikal", foto: "/img/bemfkgumi.png"}, {jabatan: "Anggota", nama: "Fajak Ryamizard Kasvari", foto: "/img/bemfkgumi.png"}] },
        { nama: "Dept. of Dedication Humanity", anggota: [{jabatan: "Koordinator", nama: "Moh. Rayyan Ghazali", foto: "/img/bemfkgumi.png"}, {jabatan: "Anggota", nama: "Muh. Yusuf Wahyuni", foto: "/img/bemfkgumi.png"}] },
        { nama: "Dept. of Study and Strategy", anggota: [{jabatan: "Koordinator", nama: "Irfan Maulana Irwan", foto: "/img/bemfkgumi.png"}, {jabatan: "Anggota", nama: "Saiful S", foto: "/img/bemfkgumi.png"}] }
    ]
};

const defaultProker = [
    {
        id: "pubmed",
        slug: "pubmed",
        dept: "DEPT. INFOCOM",
        namaProker: "PUBMED",
        bgImage: "/img/bannerprokerdeskripsi.png",
        fotoPengurus: "/img/bemfkgumi.png",
        shortDesc: "Membuat konten-konten menarik yang memuat tentang informasi (berita, pemberitahuan, peringatan hari besar, isu-isu yang berkembang)",
        sasaranPeserta: "Ruang lingkup internal hingga eksternal FKG-UMI.",
        targetPelaksanaan: "Triwulan I",
        startDate: "2026-01-01",
        endDate: "2026-12-31",
        performer: "Pengurus Dept. Infocom",
        anggaran: "Rp. 7.000.000,-",
        koordinator: "Silviyananda",
        penanggungJawab: "Silvy Ananda, Muh. Syauqi Zahran. B, Daegal Fauza Iryanto, Zahwa Alzahra Djohan, Zaneta Zahra Zulaikha, Novita Widyantari",
        latarBelakang: "Memasuki Era Revolusi Industri 5.0 yang lebih menitik beratkan pada pengembangan teknologi. Sehingga dengan hal ini kita akan memaksimalkan penyampaian informasi (Berita, Pemberitahuan, Peringatan Hari Besar), serta edukasi kepada seluruh warga KBMFKG-UMI melalui seluruh akun media sosial BEM KBMFKG-UMI yaitu meliputi :\n1. Instagram.\n2. Whatsapp.\n3. Facebook.\n4. Youtube.\n5. Tiktok.",
        tujuan: "Memberikan kemudahan akses informasi yang cepat dan akurat kepada seluruh civitas akademika.",
        swot: "Strength: Tim yang solid dan melek teknologi.\nWeakness: Keterbatasan alat dokumentasi tingkat tinggi.\nOpportunity: Banyaknya platform sosial media yang bisa dijangkau.\nThreat: Algoritma sosial media yang sering berubah.",
        parameterKeberhasilan: "Semua media informasi (platform digital & cetak) dapat memberikan konten dan informasi baik seputar internal maupun eksternal ruang lingkup FKG-UMI."
    }
];

const defaultSettings = {
    headerText: "BEM KBMFKG UMI",
    footerSlogan: "Kabinet Ananta Anardhaya",
    footerAlamat: "Jl. Pajonga Dg. Ngalle No. 27 A, Pa'batong, Kec. Mamajang, Kota Makassar, Sulawesi Selatan",
    logo1: "/img/logoumi.png",
    logo2: "/img/logofkgumi.png",
    logo3: "/img/bemfkgumi.png"
};

const defaultTeam = [
    { category: "FullStack Development", members: [ { nama: "drg. M. Aksa Arsyad, S.KG", foto: "/img/axaprofil.jpg", ig: "https://www.instagram.com/axaaxyz_01" } ] },
    { category: "Backend Development", members: [ { nama: "Silvy Ananda", foto: "/img/bemfkgumi.png", ig: "https://www.instagram.com/oenandaa" }, { nama: "Muh. Sauqi Zahran. B", foto: "/img/bemfkgumi.png", ig: "https://www.instagram.com/sauqizhran" } ] },
    { category: "Frontend Development", members: [ { nama: "Daegal Fauza Iryanto", foto: "/img/bemfkgumi.png", ig: "https://www.instagram.com/daegalfauzaaa" }, { nama: "Zahwa Alzahra Djohan", foto: "/img/bemfkgumi.png", ig: "https://www.instagram.com/zahwadjohan" } ] },
    { category: "UI/UX Design (CSS)", members: [ { nama: "Zaneta Zahra Zulaikha", foto: "/img/bemfkgumi.png", ig: "https://www.instagram.com/zanetazahraa" }, { nama: "Novita Widyantari", foto: "/img/bemfkgumi.png", ig: "https://www.instagram.com/novvwdyn__" } ] }
];

const defaultSejarah = [
    { tahun: "2025-2026", kabinet: "Kabinet Ananta Anardhaya", logo: "/img/bemfkgumi.png", ketua: "Ailan Alif Wajdi Daya", wakil: "Akram Husain" },
    { tahun: "2024-2025", kabinet: "Kabinet Cakra Abhipraya", logo: "/img/bemfkgumi.png", ketua: "Faisal Trista Alfarizi, S.KG", wakil: "Muhammad Fachri Aras, S.KG" },
    { tahun: "2023-2024", kabinet: "Kabinet Satya Bimantara", logo: "/img/bemfkgumi.png", ketua: "Andi Fajrin Perdana Sam, S.KG", wakil: "Ibnu Rusyd, S.KG" },
    { tahun: "2023", kabinet: "Kabinet Aswara Karya", logo: "/img/bemfkgumi.png", ketua: "Aditya Dwianugrah Wiratman, S.KG", wakil: "Nur. Muhammad Syafaat, S.KG" },
    { tahun: "2022", kabinet: "Kabinet Dedikasi Karsa", logo: "/img/bemfkgumi.png", ketua: "drg. Amdhan Syarief", wakil: "Marwati Sumardi, S.KG" },
    { tahun: "2021", kabinet: "Kabinet Aksi Adhikari", logo: "/img/bemfkgumi.png", ketua: "drg. Fahri Muhammad", wakil: "drg. Ayu Lestari" },
    { tahun: "2020", kabinet: "Kabinet Progresif", logo: "/img/bemfkgumi.png", ketua: "drg. Muhammad Ajis", wakil: "drg. Andriani T" },
    { tahun: "2018-2019", kabinet: "Kabinet Bersatu", logo: "/img/bemfkgumi.png", ketua: "drg. Muh. Sulaihi Ramadhan", wakil: "drg. Sri Devi" },
    { tahun: "2017-2018", kabinet: "Kabinet Sinergis", logo: "/img/bemfkgumi.png", ketua: "drg. Faisal Ramadhan", wakil: "drg, Satria Nur Fathanah" },
    { tahun: "2016-2017", kabinet: "Kabinet Harmoni", logo: "/img/bemfkgumi.png", ketua: "drg. Zulfahmi Duwila", wakil: "drg. Abd. Rahman Abdal Basri Makassau" },
    { tahun: "2015-2016", kabinet: "Kabinet X", logo: "/img/bemfkgumi.png", ketua: "drg. Muh. Rizky Adipratama Yusuf", wakil: "drg. Muhammad Hidayatullah" },
    { tahun: "2014-2015", kabinet: "Kabinet X", logo: "/img/bemfkgumi.png", ketua: "drg. Dian Rickyrianto Azis", wakil: "drg. Bima Anugrah" }
];

const defaultFilosofi = {
    logo: [
        { elemen: "Bulan Bintang", arti: "Merupakan lambang keislaman.", makna: "Melambangkan persatuan umat dan rahmat bagi alam semesta." },
        { elemen: "Tongkat", arti: "Merupakan lambang Aesculapius.", makna: "Sebagai identitas mahasiswa kedokteran yang harus bisa mandiri dalam bekerja dan mengobati selain itu dapat juga berperan sebagai penopang. Ketika seseorang sedang menderita suatu penyakit." },
        { elemen: "Ular", arti: "Merupakan lambang kesehatan.", makna: "Sebagai calon dokter gigi kita memiliki sifat-sifat seperti ular yaitu, Ular berganti kulit, maksudnya dengan berganti kulit bagaikan orang dulunya sakit dan melalui pertolongan dokter, orang tersebut dapat sembuh dari penyakitnya. 1) Ular dapat bersifat beracun dan bersifat mengobati, hal ini dihubungkan obat-obatan yang digunakan saat ini. Selain memiliki efek menyembuhkan, lambang ular juga bersifat racun apabila penggunaan dosis salah ataupun berlebihan. 2) Ular memiliki taring yang mencerminkan kekuatan dan jati diri mahasiswa." },
        { elemen: "Molar", arti: "Gigi yang paling sering digunakan dan paling kuat.", makna: "Sebagai mahasiswa FKG UMI, diharapkan sering bermanfaat di lingkungan masyarakat dan kuat menghadapi masalah-masalah yang ada." },
        { elemen: "Perahu Phinisi", arti: "Merupakan lambang khas asli Sulawesi Selatan.", makna: "Diharapkan seluruh Mahasiswa/I dan Lulusan FKG UMI nantinya bisa menghadapi tantangan, rintangan, serta mampu bersaing dimanapun kita berada." },
        { elemen: "Segitiga", arti: "Segitiga sama kaki terbalik berwarna ungu.", makna: "Diharapkan dari Mahasiswa dan Lulusan FKG UMI dapat mewujudkan visi Persatuan Dokter Gigi Indonesia." },
        { elemen: "Angka 2014", arti: "Tahun Berdirinya Organisasi.", makna: "KBMFKG-UMI didirikan pada tahun 2014." }
    ],
    warna: [
        { warna: "Hijau", hex: "#10b981", makna: "Melambangkan kesuburan dan harapan." },
        { warna: "Ungu", hex: "#8b5cf6", makna: "Melambangkan ambisi, empati, dan pencerahan." },
        { warna: "Putih", hex: "#ffffff", makna: "Melambangkan kedamaian." },
        { warna: "Kuning", hex: "#f59e0b", makna: "Melambangkan kedewasaan, kemuliaan, dan kelestarian." },
        { warna: "Merah", hex: "#ef4444", makna: "Melambangkan keadilan, keberanian, dan tanggung responsabilidad." },
        { warna: "Hitam", hex: "#111827", makna: "Melambangkan kejujuran dan keilmuan." }
    ]
};

const defaultKontak = {
    alamat: "Jl. Pajonga Dg. Ngalle No. 27 A, Pa'batong, Kec. Mamajang, Kota Makassar, Sulawesi Selatan",
    email: "admin@bemkbmfkgumi.com",
    wa: "+62 813-4879-1099",
    waName: "Silvyananda",
    mapsIframe: '<iframe src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d2034501.8037647426!2d117.10876464843753!3d-5.162069646776987!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x2dbf1d606370a527%3A0xdb175c222d9d580b!2sUniversitas%20Muslim%20Indonesia%2C%20Fakultas%20Kedokteran%20Gigi!5e0!3m2!1sid!2sid!4v1783856471813!5m2!1sid!2sid" width="100%" height="100%" style="border:0;" allowfullscreen="" loading="lazy referrerpolicy="strict-origin-when-cross-origin"></iframe>'
};

const defaultRadar = [
    { 
        departemen: "Dept. of Art and Sport", 
        embed: '<script src="https://elfsightcdn.com/platform.js" async></script>\n<div class="elfsight-app-d45c7363-2d29-4b5f-b704-ea3501da1023" data-elfsight-app-lazy></div>' 
    }
];

const defaultKalender = [
    {
        id: "umi-amal-senyuman-uas-vol-iv", 
        slug: "umi-amal-senyuman-uas-vol-iv",
        nama: "UMI Amal Senyuman (UAS) Vol. IV",
        dept: "Dept. of Dedication Humanity",
        tglMulai: "2026-07-24",
        tglSelesai: "2026-07-26",
        banner: "/img/bemfkgumi.png",
        deskripsi: "WELCOME TO UAS VOL. IV\n\nSaatnya membawa nama himpunan menuju arena pengabdian terbesar di FKG UMI! Kegiatan ini merupakan wujud nyata Tridharma Perguruan Tinggi yang menjunjung tinggi nilai kemanusiaan dan kepedulian sosial.",
        lokasi: "Desa Binaan FKG UMI",
        targetPeserta: "Seluruh Mahasiswa FKG UMI",
        statusDaftar: "Buka",
        linkDaftar: "https://bit.ly/DaftarUASVol4",
        kepanitiaan: [
            {
                namaDivisi: "Inti Kegiatan",
                anggota: [
                    { nama: "Fajri", jabatan: "Steering Committee" },
                    { nama: "Rizky", jabatan: "Ketua Panitia" },
                    { nama: "Dian", jabatan: "Sekretaris" },
                    { nama: "Amelia", jabatan: "Bendahara" }
                ]
            },
            {
                namaDivisi: "Divisi Acara",
                anggota: [
                    { nama: "Syauqi", jabatan: "Koordinator" },
                    { nama: "Ananda", jabatan: "Anggota" }
                ]
            }
        ]
    }
];

// Google Apps Script API Endpoint untuk Artikel
const GAS_ARTIKEL_URL = "https://script.google.com/macros/s/AKfycbyLBA_p2AF41FqQXJn2GxINtaCJKzjVaDiWVq4nBe6X-fDi4cLJA02jaTMiB03VCTE/exec";

// ================= ROUTES FRONTEND UTAMA =================
app.get('/favicon.ico', (req, res) => res.sendFile(path.join(__dirname, 'public/img/bemfkgumi.png')));
app.get('/favicon.png', (req, res) => res.sendFile(path.join(__dirname, 'public/img/bemfkgumi.png')));

app.get('/', (req, res) => res.render('index'));
app.get('/tentang', (req, res) => res.render('tentang'));
app.get('/berita', (req, res) => res.render('berita'));
app.get('/informasi', (req, res) => res.render('informasi'));
app.get('/narahubung', (req, res) => res.render('narahubung'));
app.get('/radarbem', (req, res) => res.render('radarbem'));
app.get('/admin', (req, res) => res.render('admin-dashboard'));
app.get('/ourteam', (req, res) => res.render('ourteam'));

// Rute Dinamis Proker
app.get('/proker-deskripsi', (req, res) => res.render('proker-deskripsi'));
app.get('/proker-deskripsi/:slug', (req, res) => res.render('proker-deskripsi'));
app.get('/proker-detail', (req, res) => req.query.id ? res.redirect(301, `/proker-detail/${req.query.id}`) : res.render('proker-detail'));
app.get('/proker-detail/:slug', (req, res) => res.render('proker-detail'));

// ROUTES BEM-FORM & ADMIN DASHBOARD V2
app.get('/admin-v2', (req, res) => res.render('admin-dashboardV2'));
app.get('/form/:slug', (req, res) => res.render('bem-form', { slug: req.params.slug }));

// ============================================================================
// SUPER BIG UPGRADE: API SYSTEM UPLOAD FILE (REALTIME & FOLDER STRUCTURE UI)
// Berdasarkan gambar 6 & 7, kunci tersimpan sebagai String: BEM_Files:1787225019662-sertifikat-bab-i.png
// ============================================================================

app.post('/api/upload', async (req, res) => {
    try {
        if(!redis) throw new Error("Redis Offline");
        const { filename, base64 } = req.body;
        
        if(!filename || !base64) return res.status(400).json({ success: false, message: "File kosong atau tidak valid." });
        
        // 🔒 SAFETY CHECK: Upstash Redis free-tier strict 1MB Request Limit Guard
        const sizeInBytes = Buffer.byteLength(base64, 'utf8');
        if (sizeInBytes > 1048000) { 
            console.warn(`⚠️ Peringatan Kapasitas: File ${filename} mendekati/melebihi batas Upstash 1MB. (Size: ${sizeInBytes} bytes)`);
        }

        let safeName = filename.toLowerCase().replace(/[^a-z0-9.]+/g, '-').replace(/(^-|-$)+/g, '');
        const uniqueFilename = `${Date.now()}-${safeName}`;
        
        // Simpan sbg STRING murni -> BEM_Files:1234-nama.jpg (Sesuai GBR 6 & 7)
        const redisKey = `BEM_Files:${uniqueFilename}`;
        await redis.set(redisKey, JSON.stringify({ filename: safeName, data: base64 }));
        
        const fileUrl = `/api/uploads/${uniqueFilename}`;
        res.status(200).json({ success: true, url: fileUrl });
    } catch (e) {
        console.error(e);
        res.status(500).json({ success: false, message: "Gagal memproses file upload." });
    }
});

app.get('/api/uploads/:filename', async (req, res) => {
    try {
        if(!redis) return res.status(503).send("Server Storage Offline");
        
        // Ambil Data sesuai String Key GBR 6 & 7
        const redisKey = `BEM_Files:${req.params.filename}`;
        const fileDataStr = await redis.get(redisKey);
        
        if(!fileDataStr) return res.status(404).send("File tidak ditemukan.");
        
        const fileObj = safeParse(fileDataStr, null);
        if(!fileObj || !fileObj.data) return res.status(400).send("Data file korup.");
        
        const parts = fileObj.data.split(',');
        if (parts.length !== 2) return res.status(400).send("Format Base64 tidak valid.");
        
        let mimeType = 'application/octet-stream';
        const headerMatch = parts[0].match(/^data:(.*?);base64/);
        if (headerMatch && headerMatch[1]) {
            mimeType = headerMatch[1];
        }

        const base64Data = parts[1];
        const buffer = Buffer.from(base64Data, 'base64');
        
        res.type(mimeType);
        
        if(!mimeType.startsWith('image/')) {
            res.setHeader('Content-Disposition', `attachment; filename="${fileObj.filename}"`);
        }
        res.send(buffer);
    } catch(e) {
        console.error("Error Loading File:", e);
        res.status(500).send("Gagal memuat file.");
    }
});

// ============================================================================
// API ENDPOINTS BEM-FORM (DUAL-ENGINE FETCHING: HASH & STRING)
// Sesuai Screenshot GBR 4 (BEM_Forms:FRM-...) & GBR 5 (BEM_Forms HASH)
// ============================================================================

app.get('/api/forms', async (req, res) => {
    try {
        if(!redis) throw new Error("Redis Offline");
        
        let allForms = [];

        // ENGINE 1: Ambil data jika tersimpan dalam format HASH `BEM_Forms` (Sesuai GBR 5)
        const hashForms = await redis.hgetall('BEM_Forms');
        if (hashForms) {
            Object.values(hashForms).forEach(formStr => {
                const parsed = typeof formStr === 'string' ? JSON.parse(formStr) : formStr;
                allForms.push(parsed);
            });
        }

        // ENGINE 2: Ambil data jika tersimpan dalam format STRING pattern `BEM_Forms:*` (Sesuai GBR 4)
        const stringKeys = await redis.keys('BEM_Forms:*');
        if (stringKeys.length > 0) {
            const stringForms = await redis.mget(...stringKeys);
            stringForms.forEach(formStr => {
                if (formStr) {
                    const parsed = typeof formStr === 'string' ? JSON.parse(formStr) : formStr;
                    allForms.push(parsed);
                }
            });
        }
        
        // Hilangkan Duplikat (Bila tersimpan di kedua tempat dengan ID yang sama)
        const uniqueForms = Array.from(new Map(allForms.map(item => [item.id, item])).values());
        
        res.status(200).json({ success: true, data: uniqueForms });
    } catch (e) { res.status(500).json({ success: false }); }
});

app.get('/api/forms/:slug', async (req, res) => {
    try {
        if(!redis) throw new Error("Redis Offline");
        
        let allForms = [];

        const hashForms = await redis.hgetall('BEM_Forms');
        if (hashForms) {
            Object.values(hashForms).forEach(formStr => {
                const parsed = typeof formStr === 'string' ? JSON.parse(formStr) : formStr;
                allForms.push(parsed);
            });
        }

        const stringKeys = await redis.keys('BEM_Forms:*');
        if (stringKeys.length > 0) {
            const stringForms = await redis.mget(...stringKeys);
            stringForms.forEach(formStr => {
                if (formStr) {
                    const parsed = typeof formStr === 'string' ? JSON.parse(formStr) : formStr;
                    allForms.push(parsed);
                }
            });
        }
        
        const form = allForms.find(f => f.slug === req.params.slug);
        
        if(!form) return res.status(404).json({ success: false, message: "Form tidak ditemukan" });
        res.status(200).json({ success: true, data: form });
    } catch (e) { res.status(500).json({ success: false }); }
});

app.post('/api/forms/save', async (req, res) => {
    try {
        if(!redis) throw new Error("Redis Offline");
        const formData = req.body;
        
        formData.slug = formData.slug.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
        if(!formData.id) formData.id = `FRM-${Date.now()}`;
        
        if(formData.sections && Array.isArray(formData.sections)) {
            formData.sections.forEach((sec, idx) => {
                if(!sec.stepName || sec.stepName.trim() === '') {
                    sec.stepName = `Tahap ${idx + 1}`; 
                }
            });
        }

        if (!formData.settings) formData.settings = {};
        const defaultFormSettings = {
            collectEmail: 'none', limitOne: false, editResponse: false, confirmationMessage: 'Jawaban Anda telah dicatat.', deadline: '',
            isQuiz: false, quizRelease: 'immediate', quizShowMissed: true, quizShowCorrect: true, quizShowPoints: true, quizDefaultPoints: 0,
            sendCopy: 'none', showProgress: false, shuffleQuestions: false, showSubmitAnother: true, showSummary: false, disableAutoSave: false,
            defaultRequired: false
        };
        formData.settings = { ...defaultFormSettings, ...formData.settings };

        if(!formData.theme) formData.theme = {};
        const defaultTheme = {
            headerFont: 'Outfit', headerFontSize: 28, headerFontWeight: 700,
            questionFont: 'Plus Jakarta Sans', questionFontSize: 14, questionFontWeight: 600,
            textFont: 'Plus Jakarta Sans', textFontSize: 12, textFontWeight: 400,
            color: '#8b5cf6', bgColor: '#f5f3ff', headerImage: ''
        };
        formData.theme = { ...defaultTheme, ...formData.theme };
        
        // Selalu simpan di struktur String yang mutakhir (Sesuai GBR 4)
        const redisKey = `BEM_Forms:${formData.id}`;
        await redis.set(redisKey, JSON.stringify(formData));
        
        // Kita juga pastikan menimpa Hash lawas (GBR 5) agar benar-benar tersinkronisasi 100%
        await redis.hset('BEM_Forms', { [formData.id]: JSON.stringify(formData) });
        
        res.status(200).json({ success: true, message: "Form berhasil disimpan", id: formData.id });
    } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

app.delete('/api/forms/:id', async (req, res) => {
    try {
        if(!redis) throw new Error("Redis Offline");
        const formId = req.params.id;
        
        // Hapus dari Format STRING dan HASH sekalian agar tidak tersisa bangkai data
        await redis.del(`BEM_Forms:${formId}`);
        await redis.hdel('BEM_Forms', formId);
        
        // Hapus seluruh respons terkait (Sesuai GBR 2/3 BEM_Responses:FRM-...)
        const resKeys = await redis.keys(`BEM_Responses:${formId}:*`);
        if(resKeys.length > 0) {
            await redis.del(...resKeys);
        }
        
        res.status(200).json({ success: true, message: "Form dan respons berhasil dihapus permanen." });
    } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// Submit Jawaban Form (Untuk Publik)
app.post('/api/forms/submit', async (req, res) => {
    try {
        if(!redis) throw new Error("Redis Offline");
        const { formId, responses, email } = req.body;
        const resId = `RES-${Date.now()}`;
        
        // Cek STRING Dulu, kalau tidak ada, cek HASH (Dual Engine Validation)
        let formStr = await redis.get(`BEM_Forms:${formId}`);
        if(!formStr) {
            formStr = await redis.hget('BEM_Forms', formId);
        }
        
        const formObj = safeParse(formStr, null);

        if (!formObj) return res.status(404).json({ success: false, message: "Formulir tidak valid atau telah dihapus." });

        if (formObj.isActive === false) return res.status(403).json({ success: false, message: "Formulir telah ditutup oleh Admin." });
        if (formObj.settings && formObj.settings.deadline) {
            if (new Date() > new Date(formObj.settings.deadline)) {
                return res.status(403).json({ success: false, message: "Batas waktu pengisian formulir telah berlalu." });
            }
        }

        // VALIDASI BATASI 1 JAWABAN (Sesuai GBR 2 & 3 - BEM_Responses adalah string pattern)
        if (formObj.settings && formObj.settings.limitOne && email) {
            const keys = await redis.keys(`BEM_Responses:${formId}:*`);
            if(keys.length > 0) {
                const rawData = await redis.mget(...keys);
                const hasAnswered = rawData.some(r => {
                    let parsed = typeof r === 'string' ? JSON.parse(r) : r;
                    return parsed && parsed.email === email;
                });
                if (hasAnswered) {
                    return res.status(403).json({ success: false, message: "Akses ditolak: Email ini sudah digunakan untuk mengisi formulir." });
                }
            }
        }

        // AUTO-GRADING SYSTEM
        let totalScore = 0;
        let maxScore = 0;
        let isQuiz = formObj.settings && formObj.settings.isQuiz;

        if (isQuiz && formObj.sections) {
            formObj.sections.forEach(sec => {
                if(sec.questions) {
                    sec.questions.forEach(q => {
                        let pts = parseInt(q.points) || formObj.settings.quizDefaultPoints || 0;
                        let ans = responses[q.id];

                        if (['pilihan_ganda', 'dropdown', 'jawaban_singkat'].includes(q.type)) {
                            maxScore += pts;
                            if (q.correctAnswers && q.correctAnswers.includes(ans)) {
                                totalScore += pts;
                            }
                        } else if (q.type === 'kotak_centang') {
                            maxScore += pts;
                            let ansArr = Array.isArray(ans) ? ans : [ans];
                            let corrArr = q.correctAnswers || [];
                            let isCorrect = ansArr.length > 0 && ansArr.length === corrArr.length && corrArr.every(c => ansArr.includes(c));
                            if (isCorrect) totalScore += pts;
                        } else if (['kisi_pilihan_ganda', 'kisi_kotak_centang'].includes(q.type)) {
                            if(q.rows) {
                                q.rows.forEach((r, rIdx) => {
                                    let rowPts = (q.rowPoints && q.rowPoints[rIdx]) ? parseInt(q.rowPoints[rIdx]) : 0;
                                    maxScore += rowPts;
                                    
                                    let rAns = responses[`${q.id}_row_${rIdx}`];
                                    let rAnsArr = Array.isArray(rAns) ? rAns : [rAns];
                                    let rCorrArr = (q.gridCorrectAnswers && q.gridCorrectAnswers[rIdx]) ? q.gridCorrectAnswers[rIdx] : [];
                                    
                                    if (q.type === 'kisi_pilihan_ganda') {
                                        if (rCorrArr.includes(rAns)) totalScore += rowPts;
                                    } else {
                                        let isCorrect = rAnsArr.length > 0 && rAnsArr.length === rCorrArr.length && rCorrArr.every(c => rAnsArr.includes(c));
                                        if (isCorrect) totalScore += rowPts;
                                    }
                                });
                            }
                        }
                    });
                }
            });
        }

        const payload = {
            id: resId, 
            formId: formId, 
            email: email,
            timestamp: new Date().toISOString(),
            answers: responses,
            score: isQuiz ? totalScore : null,
            maxScore: isQuiz ? maxScore : null
        };
        
        // Simpan langsung ke struktur Kunci string tersendiri (GBR 2 & GBR 3 - BEM_Responses:FRM:RES)
        const redisKey = `BEM_Responses:${formId}:${resId}`;
        await redis.set(redisKey, JSON.stringify(payload));
        
        res.status(200).json({ success: true, message: "Jawaban berhasil dikirim!" });
    } catch (e) { 
        console.error(e);
        res.status(500).json({ success: false, message: "Terjadi kesalahan server internal." }); 
    }
});

// ============================================================================
// CRUD JAWABAN (EDIT & DELETE SPECIFIC RESPONSE)
// ============================================================================

app.get('/api/forms/:id/responses', async (req, res) => {
    try {
        if(!redis) throw new Error("Redis Offline");
        const formId = req.params.id;
        
        // Sesuai GBR 2 & 3, Responses disimpan sebagai string di BEM_Responses:FRM-xxx:RES-xxx
        const keys = await redis.keys(`BEM_Responses:${formId}:*`);
        let responses = [];
        
        if(keys.length > 0) {
            const raw = await redis.mget(...keys);
            responses = raw.map(r => typeof r === 'string' ? JSON.parse(r) : r);
        }
        
        res.status(200).json({ success: true, data: responses });
    } catch (e) { res.status(500).json({ success: false }); }
});

app.put('/api/forms/:formId/responses/:resId', async (req, res) => {
    try {
        if(!redis) throw new Error("Redis Offline");
        const { formId, resId } = req.params;
        const { answers, email } = req.body;
        
        const redisKey = `BEM_Responses:${formId}:${resId}`;
        const existingStr = await redis.get(redisKey);
        
        if(!existingStr) return res.status(404).json({ success: false, message: "Data respon tidak ditemukan." });
        
        let existingObj = typeof existingStr === 'string' ? JSON.parse(existingStr) : existingStr;
        
        if(email !== undefined) existingObj.email = email;
        if(answers !== undefined) existingObj.answers = answers;

        await redis.set(redisKey, JSON.stringify(existingObj));
        res.status(200).json({ success: true, message: "Jawaban berhasil diperbarui." });
    } catch(e) {
        res.status(500).json({ success: false, message: "Gagal memperbarui jawaban." });
    }
});

app.delete('/api/forms/:formId/responses/:resId', async (req, res) => {
    try {
        if(!redis) throw new Error("Redis Offline");
        const { formId, resId } = req.params;
        
        await redis.del(`BEM_Responses:${formId}:${resId}`);
        
        res.status(200).json({ success: true, message: "Jawaban berhasil dihapus." });
    } catch(e) {
        res.status(500).json({ success: false, message: "Gagal menghapus jawaban." });
    }
});

// EXPORT KE EXCEL (.XLSX)
app.get('/api/forms/:id/export', async (req, res) => {
    try {
        if(!redis) throw new Error("Redis Offline");
        const formId = req.params.id;
        
        let formStr = await redis.get(`BEM_Forms:${formId}`);
        if(!formStr) {
            formStr = await redis.hget('BEM_Forms', formId); // Fallback to Hash Engine
        }
        if(!formStr) return res.status(404).send("Form tidak ditemukan");
        const form = typeof formStr === 'string' ? JSON.parse(formStr) : formStr;

        const keys = await redis.keys(`BEM_Responses:${formId}:*`);
        let responses = [];
        if(keys.length > 0) {
            const raw = await redis.mget(...keys);
            responses = raw.map(r => typeof r === 'string' ? JSON.parse(r) : r);
        }

        const excelData = responses.map((resp, index) => {
            let row = { 
                "No": index + 1, 
                "Timestamp (Waktu)": new Date(resp.timestamp).toLocaleString('id-ID'),
                "Email Responden": resp.email || "-"
            };
            
            if (form.settings && form.settings.isQuiz) {
                row["Skor Total"] = `${resp.score !== null ? resp.score : 0} / ${resp.maxScore || 0}`;
            }

            form.sections.forEach(sec => {
                sec.questions.forEach(q => {
                    if(q.type !== 'title_only') {
                        if (q.type === 'kisi_pilihan_ganda' || q.type === 'kisi_kotak_centang') {
                            if (q.rows && Array.isArray(q.rows)) {
                                q.rows.forEach((rowName, rIdx) => {
                                    let ans = resp.answers[`${q.id}_row_${rIdx}`];
                                    if(Array.isArray(ans)) ans = ans.join(', '); 
                                    row[`${q.title || "Grid"} [${rowName}]`] = ans || "";
                                });
                            }
                        } else {
                            let ans = resp.answers[q.id];
                            if(Array.isArray(ans)) ans = ans.join(', '); 
                            row[q.title || "Pertanyaan Tanpa Judul"] = ans || "";
                        }
                    }
                });
            });
            return row;
        });

        const worksheet = xlsx.utils.json_to_sheet(excelData);
        const workbook = xlsx.utils.book_new();
        xlsx.utils.book_append_sheet(workbook, worksheet, "Data Responden");

        const excelBuffer = xlsx.write(workbook, { bookType: 'xlsx', type: 'buffer' });

        res.setHeader('Content-Disposition', `attachment; filename="Hasil_Form_${form.slug}.xlsx"`);
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.send(excelBuffer);

    } catch (e) {
        console.error(e);
        res.status(500).send("Gagal menggenerate File Excel Server.");
    }
});

// ============================================================================
// DYNAMIC SEO SITEMAP & ROBOTS.TXT GENERATOR
// ============================================================================

app.get('/robots.txt', (req, res) => {
    const domain = "https://bemkbmfkgumi.com";
    res.header('Content-Type', 'text/plain');
    res.send(`User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /api/\n\nSitemap: ${domain}/sitemap.xml\n`);
});

app.get('/sitemap.xml', async (req, res) => {
    try {
        const domain = "https://bemkbmfkgumi.com";
        
        const formatSitemapDate = (dateStr) => {
            try {
                const fallback = new Date().toISOString().split('T')[0];
                if (!dateStr) return fallback;
                
                if (dateStr.includes('T')) return new Date(dateStr).toISOString().split('T')[0];
                
                if (dateStr.includes('-')) {
                    const parts = dateStr.split('-');
                    if (parts[0].length === 4) {
                        const d = new Date(dateStr);
                        return isNaN(d) ? fallback : d.toISOString().split('T')[0];
                    }
                    if (parts.length === 3 && parts[2].length === 4) {
                        const d = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
                        return isNaN(d) ? fallback : d.toISOString().split('T')[0];
                    }
                }
                const parsed = new Date(dateStr);
                return isNaN(parsed) ? fallback : parsed.toISOString().split('T')[0];
            } catch (e) { return new Date().toISOString().split('T')[0]; }
        };

        const today = formatSitemapDate(); 
        
        let prokerData = defaultProker;
        let kalenderData = defaultKalender;

        if(redis) {
            // Murni Key Sesuai Upstash: Proker_Data & Kalender_Data (Tanpa Prefix apapun)
            const rawProker = await redis.get('Proker_Data');
            const rawKalender = await redis.get('Kalender_Data');
            prokerData = safeParse(rawProker, defaultProker);
            kalenderData = safeParse(rawKalender, defaultKalender);
        }

        let xmlUrls = `
    <!-- ========================================= -->
    <!-- HALAMAN UTAMA & PRIORITAS TINGGI          -->
    <!-- ========================================= -->
    <url>
        <loc>${domain}/</loc>
        <lastmod>${today}</lastmod>
        <changefreq>daily</changefreq>
        <priority>1.0</priority>
        <image:image>
            <image:loc>${domain}/img/bemfkgumi.png</image:loc>
            <image:title>Logo Resmi BEM KBMFKG UMI</image:title>
            <image:caption>Badan Eksekutif Mahasiswa Fakultas Kedokteran Gigi UMI</image:caption>
        </image:image>
    </url>

    <!-- ========================================= -->
    <!-- PUSAT INFORMASI & SUB-TAB (SPA ROUTING)   -->
    <!-- ========================================= -->
    <url><loc>${domain}/informasi</loc><lastmod>${today}</lastmod><changefreq>daily</changefreq><priority>0.9</priority></url>
    <url><loc>${domain}/informasi#proker</loc><lastmod>${today}</lastmod><changefreq>daily</changefreq><priority>0.85</priority></url>
    <url><loc>${domain}/informasi#kalender</loc><lastmod>${today}</lastmod><changefreq>daily</changefreq><priority>0.85</priority></url>
    <url><loc>${domain}/informasi#timeline</loc><lastmod>${today}</lastmod><changefreq>weekly</changefreq><priority>0.85</priority></url>
    <url><loc>${domain}/informasi#galeri</loc><lastmod>${today}</lastmod><changefreq>weekly</changefreq><priority>0.85</priority></url>
    <url><loc>${domain}/informasi#plasma</loc><lastmod>${today}</lastmod><changefreq>weekly</changefreq><priority>0.85</priority></url>

    <!-- ========================================= -->
    <!-- TENTANG KAMI & SUB-SECTION (SPA ROUTING)  -->
    <!-- ========================================= -->
    <url><loc>${domain}/tentang</loc><lastmod>${today}</lastmod><changefreq>weekly</changefreq><priority>0.9</priority></url>
    <url><loc>${domain}/tentang#visimisi</loc><lastmod>${today}</lastmod><changefreq>monthly</changefreq><priority>0.85</priority></url>
    <url><loc>${domain}/tentang#struktur</loc><lastmod>${today}</lastmod><changefreq>weekly</changefreq><priority>0.85</priority></url>
    <url><loc>${domain}/tentang#filosofi</loc><lastmod>${today}</lastmod><changefreq>monthly</changefreq><priority>0.85</priority></url>
    <url><loc>${domain}/tentang#sejarah-pembentukan</loc><lastmod>${today}</lastmod><changefreq>monthly</changefreq><priority>0.85</priority></url>
    <url><loc>${domain}/tentang#sejarah</loc><lastmod>${today}</lastmod><changefreq>monthly</changefreq><priority>0.85</priority></url>

    <!-- ========================================= -->
    <!-- HALAMAN PROFIL & KONTAK                   -->
    <!-- ========================================= -->
    <url><loc>${domain}/berita</loc><lastmod>${today}</lastmod><changefreq>daily</changefreq><priority>0.9</priority></url>
    <url><loc>${domain}/ourteam</loc><lastmod>${today}</lastmod><changefreq>monthly</changefreq><priority>0.8</priority></url>
    <url><loc>${domain}/narahubung</loc><lastmod>${today}</lastmod><changefreq>monthly</changefreq><priority>0.6</priority></url>

    <!-- ========================================= -->
    <!-- INDUK ROUTING KEGIATAN & DEPARTEMEN       -->
    <!-- ========================================= -->
    <url><loc>${domain}/proker-deskripsi</loc><lastmod>${today}</lastmod><changefreq>weekly</changefreq><priority>0.7</priority></url>
    <url><loc>${domain}/proker-detail</loc><lastmod>${today}</lastmod><changefreq>daily</changefreq><priority>0.7</priority></url>`;

        if (Array.isArray(prokerData) && prokerData.length > 0) {
            xmlUrls += `\n\n    <!-- DIRECT DYNAMIC SEO URLs (PROKER & DEPARTEMEN) -->`;
            prokerData.forEach(p => {
                const slug = p.slug || p.id;
                let img = p.bgImage || p.fotoPengurus || `/img/bannerprokerdeskripsi.png`;
                if (img.startsWith('/')) img = `${domain}${img}`;
                if (slug) {
                    const itemLastMod = formatSitemapDate(p.startDate);
                    xmlUrls += `
    <url>
        <loc>${domain}/proker-deskripsi/${escapeXml(slug)}</loc>
        <lastmod>${itemLastMod}</lastmod>
        <changefreq>weekly</changefreq>
        <priority>0.8</priority>
        <image:image>
            <image:loc>${escapeXml(img)}</image:loc>
            <image:title>${escapeXml(p.dept || 'Departemen BEM FKG UMI')}</image:title>
        </image:image>
    </url>`;
                }
            });
        }

        if (Array.isArray(kalenderData) && kalenderData.length > 0) {
            xmlUrls += `\n\n    <!-- DIRECT DYNAMIC SEO URLs (EVENT KALENDER) -->`;
            kalenderData.forEach(k => {
                const slug = k.slug || k.id;
                const img = k.banner || `${domain}/img/bemfkgumi.png`;
                if (slug) {
                    const itemLastMod = formatSitemapDate(k.tglMulai);
                    xmlUrls += `
    <url>
        <loc>${domain}/proker-detail/${escapeXml(slug)}</loc>
        <lastmod>${itemLastMod}</lastmod>
        <changefreq>daily</changefreq>
        <priority>0.9</priority>
        <image:image>
            <image:loc>${escapeXml(img)}</image:loc>
            <image:title>${escapeXml(k.nama || 'Event BEM FKG UMI')}</image:title>
        </image:image>
    </url>`;
                }
            });
        }

        try {
            const gasReq = await fetch(`${GAS_ARTIKEL_URL}?action=getArticles&page=1&limit=100`);
            if(gasReq.ok) {
                const gasRes = await gasReq.json();
                const articles = gasRes.data || [];
                if (articles.length > 0) {
                    xmlUrls += `\n\n    <!-- DIRECT DYNAMIC SEO URLs (ARTIKEL/E-ZINE) -->`;
                    articles.forEach(art => {
                        const slug = art.Slug_URL || art.ID_Berita;
                        const img = art.Gambar_URL || `${domain}/img/bemfkgumi.png`;
                        const itemLastMod = formatSitemapDate(art.Tgl_Rilis);
                        if(slug) {
                            xmlUrls += `
    <url>
        <loc>${domain}/berita?article=${escapeXml(slug)}</loc>
        <lastmod>${itemLastMod}</lastmod>
        <changefreq>weekly</changefreq>
        <priority>0.85</priority>
        <image:image>
            <image:loc>${escapeXml(img)}</image:loc>
            <image:title>${escapeXml(art.Judul || 'Artikel BEM KBMFKG UMI')}</image:title>
            <image:caption>${escapeXml(art.Kategori || 'Berita')}</image:caption>
        </image:image>
    </url>`;
                        }
                    });
                }
            }
        } catch(e) {
            console.warn("⚠️ Sitemap: Gagal sinkronisasi artikel", e);
        }

        const sitemapXML = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"
        xsi:schemaLocation="http://www.sitemaps.org/schemas/sitemap/0.9
        http://www.sitemaps.org/schemas/sitemap/0.9/sitemap.xsd">
${xmlUrls}
</urlset>`;

        res.header('Content-Type', 'application/xml');
        res.send(sitemapXML.trim());
    } catch (error) {
        console.error("Sitemap Gen Error:", error);
        res.status(500).send("Internal Server Error generating Sitemap");
    }
});

// ================= API CMS ENDPOINTS (ZERO-DELAY MGET DENGAN KEYS ASLI) =================
app.get('/api/content', async (req, res) => {
    try {
        if(!redis) throw new Error("Redis Offline");
        
        // MGET (MULTI-GET) UNTUK ZERO DELAY
        // Menggunakan KEY ASLI MURNI sesuai screenshot struktur utama Anda.
        const keysToFetch = [
            'Org_Structure', 'Proker_Data', 'Kalender_Data', 'Dokumentasi_Data',
            'Settings_Data', 'Team_Data', 'Sejarah_Data', 'Filosofi_Data',
            'Kontak_Data', 'Radar_Data'
        ];

        // 10 Kunci ditarik sekaligus hanya dalam hitungan milidetik
        const rawData = await redis.mget(...keysToFetch);

        const [
            org, proker, kalender, dokumentasi, 
            settings, team, sejarah, filosofi, kontak, radar
        ] = rawData;

        // Parsing dengan Data Default Utuh (Fallback 100%)
        let parsedOrg = safeParse(org, defaultOrg);
        if (!parsedOrg.misi || !Array.isArray(parsedOrg.misi) || parsedOrg.misi.length === 0) parsedOrg.misi = defaultOrg.misi;
        if (!parsedOrg.artiKabinet) parsedOrg.artiKabinet = defaultOrg.artiKabinet;

        res.status(200).json({ 
            success: true, 
            org: parsedOrg,
            proker: safeParse(proker, defaultProker),
            kalender: safeParse(kalender, defaultKalender),
            dokumentasi: safeParse(dokumentasi, []),
            settings: safeParse(settings, defaultSettings),
            team: safeParse(team, defaultTeam),
            sejarah: safeParse(sejarah, defaultSejarah),
            filosofi: safeParse(filosofi, defaultFilosofi),
            kontak: safeParse(kontak, defaultKontak),
            radar: safeParse(radar, defaultRadar)
        });
    } catch (error) {
        // Fallback Utama Jika Redis Error (Mengirim Semua Data Master)
        res.status(200).json({ success: false, org: defaultOrg, proker: defaultProker, kalender: defaultKalender, dokumentasi: [], settings: defaultSettings, team: defaultTeam, sejarah: defaultSejarah, filosofi: defaultFilosofi, kontak: defaultKontak, radar: defaultRadar });
    }
});

app.post('/api/content/:type', async (req, res) => {
    try {
        if(!redis) throw new Error("Redis Offline");
        const type = req.params.type;
        
        let bodyData = req.body; 
        
        if ((type === 'kalender' || type === 'proker') && Array.isArray(bodyData)) {
            bodyData.forEach(item => {
                let textToSlug = item.slug || item.id || item.nama || item.namaProker || item.dept || "kegiatan";
                let safeSlug = textToSlug.toString().toLowerCase().trim()
                    .replace(/\s+/g, '-')
                    .replace(/[^\w\-]+/g, '')
                    .replace(/\-\-+/g, '-')
                    .replace(/^-+/, '')
                    .replace(/-+$/, '');
                
                item.slug = safeSlug;
                item.id = safeSlug; 
            });
        }

        const payload = JSON.stringify(bodyData); 
        
        // Pemetaan MURNI untuk disimpan kembali ke Redis tanpa Prefix aneh-aneh
        const dbMapping = {
            'org': 'Org_Structure', 'proker': 'Proker_Data', 'kalender': 'Kalender_Data', 
            'dokumentasi': 'Dokumentasi_Data', 'settings': 'Settings_Data', 'team': 'Team_Data', 
            'sejarah': 'Sejarah_Data', 'filosofi': 'Filosofi_Data', 'kontak': 'Kontak_Data', 'radar': 'Radar_Data'
        };
        
        if (dbMapping[type]) {
            const redisKey = dbMapping[type]; 
            await redis.set(redisKey, payload);
            res.status(200).json({ success: true, message: `Data ${type} berhasil diperbarui di Redis!` });
        } else {
            return res.status(400).json({ success: false, message: "Tipe Endpoint Tidak Valid" });
        }
    } catch (error) {
        res.status(500).json({ success: false, message: 'Gagal menyimpan data ke Redis.' });
    }
});

// ================= SUPER UPGRADE: API ADMIN DASHBOARD STATS =================
app.get('/api/admin/stats', async (req, res) => {
    try {
        if(!redis) throw new Error("Redis Offline");
        
        // Menghitung Forms (Hitung Hash Forms + Hitung String Forms)
        const hashForms = await redis.hkeys('BEM_Forms');
        const stringFormKeys = await redis.keys('BEM_Forms:*');
        const totalForms = (hashForms ? hashForms.length : 0) + stringFormKeys.length;
        
        // Menghitung Responses
        const responseKeys = await redis.keys('BEM_Responses:*:*');
        const totalResponses = responseKeys.length;
        
        // Sesuai GBR 1 (Tipe STRING Pattern untuk Message dan Aspirasi)
        const aspirasiKeys = await redis.keys('BEM_Aspirations:*');
        const totalAspirasi = aspirasiKeys.length;
        
        const messageKeys = await redis.keys('BEM_Messages:*'); // GBR 1: BEM_Messages:MSG-...
        const totalPesan = messageKeys.length;
        
        res.status(200).json({ 
            success: true, 
            data: { 
                totalForms, 
                totalResponses, 
                totalAspirasi, 
                totalPesan 
            }
        });
    } catch (e) {
        res.status(500).json({ success: false, message: "Gagal mengambil statistik." });
    }
});

// ================= API ENDPOINTS: TRANSAKSIONAL (MGET STRING KEYS FIX Sesuai GBR 1) =================
app.get('/api/interactions', async (req, res) => {
    try {
        if(!redis) throw new Error("Redis Offline");
        
        // AMBIL DATA ASPIRASI STRING VIA MGET
        const aspirasiKeys = await redis.keys('BEM_Aspirations:*');
        let aspirasi = [];
        if(aspirasiKeys.length > 0) {
            const raw = await redis.mget(...aspirasiKeys);
            aspirasi = raw.filter(i => i != null)
                          .map(i => typeof i === 'string' ? JSON.parse(i) : i)
                          .sort((a,b) => new Date(b.timestamp) - new Date(a.timestamp));
        }

        // AMBIL DATA PESAN STRING VIA MGET (Cocok dengan GBR 1: BEM_Messages:MSG-1786632166001)
        const messageKeys = await redis.keys('BEM_Messages:*');
        let pesan = [];
        if(messageKeys.length > 0) {
            const raw = await redis.mget(...messageKeys);
            pesan = raw.filter(i => i != null)
                       .map(i => typeof i === 'string' ? JSON.parse(i) : i)
                       .sort((a,b) => new Date(b.timestamp) - new Date(a.timestamp));
        }
        
        res.status(200).json({ success: true, aspirasi, pesan });
    } catch (error) {
        console.error("API Interactions Error:", error);
        res.status(200).json({ success: false, aspirasi: [], pesan: [] });
    }
});

app.post('/api/plasma', async (req, res) => {
  try {
    const { judul, kategori, jenis, isi, bukti } = req.body;
    const id = `ASP-${Date.now()}`;
    const payload = { id: String(id), judul: String(judul), kategori: String(kategori), jenis: String(jenis), isi: String(isi), bukti: bukti || null, timestamp: new Date().toISOString() };
    
    // Simpan sebagai STRING Sesuai Format Upstash Anda
    if (redis) await redis.set(`BEM_Aspirations:${id}`, JSON.stringify(payload));
    res.status(200).json({ success: true, message: 'Aspirasi berhasil dikirim!' });
  } catch (error) { res.status(500).json({ success: false }); }
});

app.post('/api/message', async (req, res) => {
  try {
    const { nama, kontak, subjek, pesan } = req.body;
    const id = `MSG-${Date.now()}`;
    const payload = { id, nama: String(nama), kontak: String(kontak), subjek: String(subjek), pesan: String(pesan), timestamp: new Date().toISOString() };
    
    // Simpan sebagai STRING Sesuai Format Upstash Anda (GBR 1)
    if (redis) await redis.set(`BEM_Messages:${id}`, JSON.stringify(payload));
    res.status(200).json({ success: true, message: 'Pesan terkirim!' });
  } catch (error) { res.status(500).json({ success: false }); }
});

app.post('/api/delete-interaction', async (req, res) => {
    try {
        const { type, id } = req.body;
        // Hapus Kunci STRING Spesifik
        if(type === 'aspirasi' && redis) await redis.del(`BEM_Aspirations:${id}`);
        if(type === 'pesan' && redis) await redis.del(`BEM_Messages:${id}`);
        res.status(200).json({ success: true });
    } catch (error) { res.status(500).json({ success: false }); }
});

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

// SUPER UPGRADE: GLOBAL ERROR HANDLER
app.use((err, req, res, next) => {
    console.error("🔥 Server Error Intercepted:", err.stack);
    res.status(500).json({ success: false, message: "Terjadi kesalahan internal server." });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server BEM KBMFKG UMI berjalan di port ${PORT}`));

// FILE: server.js
const express = require('express');
const { Redis } = require('@upstash/redis');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const compression = require('compression');
const xlsx = require('xlsx'); // PACKAGE BARU UNTUK EXPORT EXCEL FORM
const crypto = require('crypto');
require('dotenv').config();

// ================= PROCESS SAFETY NET (CRITICAL ANTI-CRASH) =================
process.on('unhandledRejection', (reason, promise) => {
    console.error('⚠️ [CRITICAL FAILSAFE] Unhandled Rejection at:', promise, 'reason:', reason);
});
process.on('uncaughtException', (err) => {
    console.error('⚠️ [CRITICAL FAILSAFE] Uncaught Exception:', err);
});

const app = express();

// ================= SUPER BIG UPGRADE: HTTP GZIP / BROTLI COMPRESSION =================
// Mengurangi transfer payload CSS (132KB -> 22KB), HTML (64KB -> 11KB), dan JSON hingga 80%
app.use(compression({
    level: 6,
    threshold: 1024,
    filter: (req, res) => {
        if (req.headers['x-no-compression']) return false;
        return compression.filter(req, res);
    }
}));

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// ================= SUPER BIG UPGRADE: ANTI-CACHE & IMAGE CACHE BYPASS =================
// Memastikan request API realtime tidak di-cache, KECUALI untuk aset gambar uploads & endpoint SWR cache
app.use('/api', (req, res, next) => {
    // SEO UPGRADE: Bypass Anti-Cache untuk Gambar agar bisa diindeks Google Images
    if (req.path.startsWith('/uploads/')) {
        return next();
    }
    // Bypass Anti-Cache untuk endpoint yang dikelola oleh Zero-Delay In-Memory SWR Cache
    if (req.path === '/content' || req.path === '/articles') {
        return next();
    }
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('Surrogate-Control', 'no-store');
    next();
});

// ================= STATIC FILES & VERCEL ROUTING FIX (CACHE OPTIMIZED) =================
const staticOptions = {
    maxAge: '7d',
    etag: true,
    lastModified: true
};

// SUPER UPGRADE: Content Negotiation untuk Otomatisasi Serving Format WebP (Hemat 97% Bandwidth)
app.use('/img', (req, res, next) => {
    const accept = req.headers.accept || '';
    if (accept.includes('image/webp')) {
        const ext = path.extname(req.path).toLowerCase();
        if (ext === '.png' || ext === '.jpg' || ext === '.jpeg') {
            const webpRelativePath = req.path.replace(/\.(png|jpe?g)$/i, '.webp');
            const webpFullPath = path.join(__dirname, 'public/img', webpRelativePath);
            if (fs.existsSync(webpFullPath)) {
                res.setHeader('Vary', 'Accept');
                res.setHeader('Content-Type', 'image/webp');
                res.setHeader('Cache-Control', 'public, max-age=604800, immutable');
                return res.sendFile(webpFullPath);
            }
        }
    }
    next();
});

// Memastikan file statis bisa diakses langsung oleh Express dengan Cache-Control
app.use(express.static(path.join(__dirname, 'public'), staticOptions));

// SUPER UPGRADE: Sinkronisasi mutlak dengan vercel.json routing
app.use('/public', express.static(path.join(__dirname, 'public'), staticOptions));
app.use('/css', express.static(path.join(__dirname, 'public/css'), staticOptions));
app.use('/img', express.static(path.join(__dirname, 'public/img'), staticOptions));
app.use('/js', express.static(path.join(__dirname, 'public/js'), staticOptions));

// SUPER UPGRADE: Route Manifest.json Resmi untuk Dukungan Android, iOS, dan Chrome
app.get('/manifest.json', (req, res) => {
    res.setHeader('Content-Type', 'application/manifest+json; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.sendFile(path.join(__dirname, 'manifest.json'));
});

// Graceful Unregister Service Worker handler untuk membersihkan sisa instalasi lama di browser
app.get('/sw.js', (req, res) => {
    res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.sendFile(path.join(__dirname, 'sw.js'));
});

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
function safeParse(data, fallbackData) {
    if (!data) return fallbackData;
    try {
        return typeof data === 'string' ? JSON.parse(data) : data;
    } catch (error) {
        console.error("⚠️ Data terdeteksi korup, menggunakan fallback data.");
        return fallbackData;
    }
}

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

// SEO UPGRADE: Filter Base64 agar tidak masuk ke Sitemap dan membuat GSC Error
const sanitizeImageUrl = (imgStr, domain) => {
    if (!imgStr) return `${domain}/img/bemfkgumi.png`;
    // FIX GSC 100%: Otomatis membuang string base64 dan menggantinya dengan placeholder yang valid bagi Googlebot
    if (imgStr.startsWith('data:image/')) return `${domain}/img/bemfkgumi.png`;
    if (imgStr.startsWith('/')) return `${domain}${imgStr}`;
    return imgStr;
};

// ================= DATA SEED (STRUKTUR BEM KBMFKG UMI LENGKAP 100% UTUH) =================
const defaultOrg = {
    namaKabinet: "Kabinet Ananta Anardhaya",
    periode: "2025 - 2026",
    sambutan: {
        judul: "\"Bergerak Bersama,\nMerajut Asa\"",
        teks1: "Assalamu'alaikum Warahmatullahi Wabarakatuh.\n\nSelamat datang di official website BEM KBMFKG UMI. Di era digital ini, kami berkomitmen untuk menjadikan BEM sebagai wadah yang tidak hanya menampung aspirasi, tetapi juga <strong>mewujudkan aksi nyata</strong>.",
        teks2: "Kabinet Ananta Anardhaya hadir dengan semangat kolaborasi tiada batas. Kami percaya bahwa setiap mahasiswa FKG UMI memiliki potensi luar biasa. Mari kita satukan langkah, sinergikan pikiran, dan rajut masa depan almamater yang lebih gemilang.",
        foto: "/img/bemfkgumi.png"
    },
    quote: {
        teks: "Kabinet Ananta Anardhaya adalah tentang <span>merangkai</span> yang tercerai, <span>menyatukan</span> yang berjalan sendiri, dan <span>mengubah</span> harapan menjadi kerja bersama. Bukan tentang siapa yang paling lantang, tapi siapa yang paling konsisten <span>merajut perubahan</span>.",
        author: "Ailan Alif Wajdi Daya",
        jabatan: "Ketua BEM KBMFKG UMI"
    },
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
        { nama: "Dept. of Information and Communication", anggota: [{ jabatan: "Koordinator", nama: "Silviyananda", foto: "/img/bemfkgumi.png" }, { jabatan: "Anggota", nama: "Muh. Syauqi Zahran. B", foto: "/img/bemfkgumi.png" }, { jabatan: "Anggota", nama: "Daegal Fauza Iryanto", foto: "/img/bemfkgumi.png" }, { jabatan: "Anggota", nama: "Zahwa Alzahra", foto: "/img/bemfkgumi.png" }, { jabatan: "Anggota", nama: "Zaneta Zahra Zulaikha", foto: "/img/bemfkgumi.png" }, { jabatan: "Anggota", nama: "Novita Widyantari", foto: "/img/bemfkgumi.png" }] },
        { nama: "Dept. of Science Education and Research", anggota: [{ jabatan: "Koordinator", nama: "Muh. Alif Perdana Putra", foto: "/img/bemfkgumi.png" }, { jabatan: "Anggota", nama: "Fatahillah Fadhillah", foto: "/img/bemfkgumi.png" }] },
        { nama: "Dept. of Islamic", anggota: [{ jabatan: "Koordinator", nama: "Maysar Ma'ruf", foto: "/img/bemfkgumi.png" }, { jabatan: "Anggota", nama: "Ahmad Syafii", foto: "/img/bemfkgumi.png" }] },
        { nama: "Dept. of Sekretariat", anggota: [{ jabatan: "Koordinator", nama: "Febrio Arya Pradana", foto: "/img/bemfkgumi.png" }, { jabatan: "Anggota", nama: "Andi Muhammad Dwiansyah", foto: "/img/bemfkgumi.png" }] },
        { nama: "Dept. of Treasure", anggota: [{ jabatan: "Koordinator", nama: "Putri Amaliah", foto: "/img/bemfkgumi.png" }, { jabatan: "Anggota", nama: "Jiyaad Taqi Rozan", foto: "/img/bemfkgumi.png" }] },
        { nama: "Dept. of Art and Sport", anggota: [{ jabatan: "Koordinator", nama: "Ilham Subhan Rafikal", foto: "/img/bemfkgumi.png" }, { jabatan: "Anggota", nama: "Fajak Ryamizard Kasvari", foto: "/img/bemfkgumi.png" }] },
        { nama: "Dept. of Dedication Humanity", anggota: [{ jabatan: "Koordinator", nama: "Moh. Rayyan Ghazali", foto: "/img/bemfkgumi.png" }, { jabatan: "Anggota", nama: "Muh. Yusuf Wahyuni", foto: "/img/bemfkgumi.png" }] },
        { nama: "Dept. of Study and Strategy", anggota: [{ jabatan: "Koordinator", nama: "Irfan Maulana Irwan", foto: "/img/bemfkgumi.png" }, { jabatan: "Anggota", nama: "Saiful S", foto: "/img/bemfkgumi.png" }] }
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
    { category: "FullStack Development", members: [{ nama: "drg. M. Aksa Arsyad, S.KG", foto: "/img/axaprofil.jpg", ig: "https://www.instagram.com/axaaxyz_01" }] },
    { category: "Backend Development", members: [{ nama: "Silvy Ananda", foto: "/img/bemfkgumi.png", ig: "https://www.instagram.com/oenandaa" }, { nama: "Muh. Sauqi Zahran. B", foto: "/img/bemfkgumi.png", ig: "https://www.instagram.com/sauqizhran" }] },
    { category: "Frontend Development", members: [{ nama: "Daegal Fauza Iryanto", foto: "/img/bemfkgumi.png", ig: "https://www.instagram.com/daegalfauzaaa" }, { nama: "Zahwa Alzahra Djohan", foto: "/img/bemfkgumi.png", ig: "https://www.instagram.com/zahwadjohan" }] },
    { category: "UI/UX Design (CSS)", members: [{ nama: "Zaneta Zahra Zulaikha", foto: "/img/bemfkgumi.png", ig: "https://www.instagram.com/zanetazahraa" }, { nama: "Novita Widyantari", foto: "/img/bemfkgumi.png", ig: "https://www.instagram.com/novvwdyn__" }] }
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

// MENDUKUNG KEY BIAYAREGISTRASI PADA DATA DEFAULT KALENDER
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
        biayaRegistrasi: "Gratis / Tidak Dipungut Biaya", // BIAYA REGISTRASI
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

// ================= ROUTES FRONTEND UTAMA =================
app.get('/favicon.ico', (req, res) => res.sendFile(path.join(__dirname, 'public/img/bemfkgumi.png')));
app.get('/favicon.png', (req, res) => res.sendFile(path.join(__dirname, 'public/img/bemfkgumi.png')));

app.get('/', (req, res) => res.render('index'));

// =========================================================================
// SUPER BIG UPGRADE: SSR DINAMIS CLEAN URL /tentang & /tentang/:slug
// Mendukung Pengindeksan Gold Standard Google Search Console (GSC)
// =========================================================================
async function getOrgDataForSSR() {
    if (typeof contentMemoryCache !== 'undefined' && contentMemoryCache && contentMemoryCache.org) {
        return contentMemoryCache.org;
    }
    if (redis) {
        try {
            const rawOrg = await redis.get('Org_Structure');
            if (rawOrg) {
                const parsed = safeParse(rawOrg, defaultOrg);
                if (!parsed.namaKabinet) parsed.namaKabinet = defaultOrg.namaKabinet;
                if (!parsed.periode) parsed.periode = defaultOrg.periode;
                return parsed;
            }
        } catch (e) {
            console.error("SSR Org Fetch Error:", e);
        }
    }
    return defaultOrg;
}

const validTentangTabs = ['visimisi', 'struktur', 'filosofi', 'sejarah-pembentukan', 'sejarah'];

app.get('/tentang', async (req, res) => {
    const org = await getOrgDataForSSR();
    res.render('tentang', {
        activeSection: null,
        siteUrl: 'https://bemkbmfkgumi.com',
        orgData: org
    });
});

app.get('/tentang/:section', async (req, res, next) => {
    const section = req.params.section;
    if (validTentangTabs.includes(section)) {
        const org = await getOrgDataForSSR();
        res.render('tentang', {
            activeSection: section,
            siteUrl: 'https://bemkbmfkgumi.com',
            orgData: org
        });
    } else {
        next();
    }
});
app.get('/narahubung', (req, res) => res.render('narahubung'));
app.get('/radarbem', (req, res) => res.render('radarbem'));
app.get('/admin', (req, res) => res.render('admin-dashboard'));
app.get('/ourteam', (req, res) => res.render('ourteam'));

// =========================================================================
// SUPER BIG UPGRADE SEO ROUTING: INFORMASI & DETAIL (CLEAN URL HIERARCHY)
// Mencegah masalah Soft 404 pada Google Search Console
// =========================================================================

// 1. Redirect URL Lama ke URL Baru (301 Permanent Redirect) untuk menjaga SEO GSC
app.get('/proker-deskripsi/:slug', (req, res) => res.redirect(301, `/informasi/proker/proker-deskripsi/${req.params.slug}`));
app.get('/proker-detail/:slug', (req, res) => res.redirect(301, `/informasi/kalender/proker-detail/${req.params.slug}`));
app.get('/proker-deskripsi', (req, res) => res.redirect(301, '/informasi/proker'));
app.get('/proker-detail', (req, res) => req.query.id ? res.redirect(301, `/informasi/kalender/proker-detail/${req.query.id}`) : res.redirect(301, '/informasi/kalender'));

// 2. Induk Routing Informasi (Default ke Tab Proker)
app.get('/informasi', (req, res) => res.redirect(301, '/informasi/proker'));

// 3. SSR Dinamis Tab Informasi (proker, kalender, timeline, galeri, plasma)
const validInfoTabs = ['proker', 'kalender', 'timeline', 'galeri', 'plasma'];
app.get('/informasi/:tab', (req, res, next) => {
    const tab = req.params.tab;
    if (validInfoTabs.includes(tab)) {
        res.render('informasi', { activeTab: tab, siteUrl: 'https://bemkbmfkgumi.com' });
    } else {
        next();
    }
});

// 4. Hirarki Clean URL untuk Proker Deskripsi (Full SSR Support untuk cegah Soft 404 GSC)
app.get('/informasi/proker/proker-deskripsi/:slug', async (req, res) => {
    let prokerData = null;
    let orgDepartemen = [];

    if (redis) {
        try {
            const rawProker = await redis.get('Proker_Data');
            const rawOrg = await redis.get('Org_Structure');

            const allProker = safeParse(rawProker, defaultProker);
            const orgStructure = safeParse(rawOrg, defaultOrg);

            orgDepartemen = orgStructure.departemen || [];
            let foundProker = allProker.find(p => p.slug === req.params.slug || p.id === req.params.slug);

            // FIX BASE64 GSC ISSUE (Mencegah "Halaman tidak dapat diindeks: Soft 404")
            if (foundProker) {
                const domain = 'https://bemkbmfkgumi.com';
                foundProker.bgImage = sanitizeImageUrl(foundProker.bgImage, domain);
                foundProker.fotoPengurus = sanitizeImageUrl(foundProker.fotoPengurus, domain);
                prokerData = foundProker;
            }
        } catch (e) {
            console.error("SSR Proker Fetch Error:", e);
        }
    }

    res.render('proker-deskripsi', {
        slug: req.params.slug,
        siteUrl: 'https://bemkbmfkgumi.com',
        prokerData: prokerData,
        orgDepartemen: orgDepartemen
    });
});

// 5. Hirarki Clean URL untuk Detail Kalender & Timeline (Full SSR Support)
app.get('/informasi/kalender/proker-detail/:slug', async (req, res) => {
    let eventData = null;
    if (redis) {
        try {
            const rawKalender = await redis.get('Kalender_Data');
            const allKalender = safeParse(rawKalender, defaultKalender);
            let foundEvent = allKalender.find(ev => ev.slug === req.params.slug || ev.id === req.params.slug);

            // FIX BASE64 GSC ISSUE
            if (foundEvent) {
                const domain = 'https://bemkbmfkgumi.com';
                foundEvent.banner = sanitizeImageUrl(foundEvent.banner, domain);
                eventData = foundEvent;
            }
        } catch (e) { }
    }
    res.render('proker-detail', { slug: req.params.slug, sourceTab: 'kalender', siteUrl: 'https://bemkbmfkgumi.com', eventData: eventData });
});

app.get('/informasi/timeline/proker-detail/:slug', async (req, res) => {
    let eventData = null;
    if (redis) {
        try {
            const rawKalender = await redis.get('Kalender_Data');
            const allKalender = safeParse(rawKalender, defaultKalender);
            let foundEvent = allKalender.find(ev => ev.slug === req.params.slug || ev.id === req.params.slug);

            // FIX BASE64 GSC ISSUE
            if (foundEvent) {
                const domain = 'https://bemkbmfkgumi.com';
                foundEvent.banner = sanitizeImageUrl(foundEvent.banner, domain);
                eventData = foundEvent;
            }
        } catch (e) { }
    }
    res.render('proker-detail', { slug: req.params.slug, sourceTab: 'timeline', siteUrl: 'https://bemkbmfkgumi.com', eventData: eventData });
});

// =========================================================================
// ROUTES ADMIN DASHBOARD (V2 Form, V3 Linktree, V4 QR Code, V5 Database Mhs)
// =========================================================================
app.get('/admin-v2', (req, res) => res.render('admin-dashboardV2'));
app.get('/admin-linktree', (req, res) => res.render('admin-dashboardV3'));
app.get('/admin-qrcode', (req, res) => res.render('admin-dashboardV4'));
app.get('/admin-mhs', (req, res) => res.render('admin-dashboardV5'));
app.get('/carimhs', (req, res) => res.render('carimhs'));
app.get('/carimhs/detail', (req, res) => res.render('carimhs-detail'));

// RUTE PUBLIK LINKTREE DENGAN SSR SEO
app.get('/link/:slug', async (req, res) => {
    const slug = req.params.slug;
    let seoData = {
        title: 'BEM KBMFKG UMI - Linktree',
        desc: 'Tautan resmi dan informasi terbaru dari BEM KBMFKG UMI.',
        image: 'https://bemkbmfkgumi.com/img/bemfkgumi.png',
        url: `https://bemkbmfkgumi.com/link/${slug}`
    };

    try {
        if (redis) {
            const trees = await redis.hgetall('BEM_Linktrees') || {};
            const treeArr = Object.values(trees).map(item => safeParse(item, {}));
            const tree = treeArr.find(t => t.slug === slug);

            if (tree) {
                seoData.title = tree.settings?.seoTitle || tree.profile?.title || seoData.title;
                seoData.desc = tree.profile?.bio || seoData.desc;
                let img = tree.profile?.image || seoData.image;
                if (img.startsWith('/')) img = `https://bemkbmfkgumi.com${img}`;
                seoData.image = img;
            }
        }
    } catch (e) { console.error("Gagal memuat SSR SEO Linktree:", e); }

    res.render('bem-linktree', { slug: slug, seo: seoData });
});

// =========================================================================
// UPGRADE SSR UNTUK FORM BEM: Menyuntikkan Data Form ke UI dari Backend
// =========================================================================
app.get('/form/:slug', async (req, res) => {
    let formData = null;
    if (redis) {
        try {
            let allForms = [];
            // ENGINE 1: Ambil data dari format HASH (Legacy)
            const hashForms = await redis.hgetall('BEM_Forms');
            if (hashForms) {
                Object.values(hashForms).forEach(formStr => {
                    allForms.push(safeParse(formStr, null));
                });
            }

            // ENGINE 2: Ambil data dari format STRING (New Pattern)
            const stringKeys = await redis.keys('BEM_Forms:*');
            if (stringKeys.length > 0) {
                const stringForms = await redis.mget(...stringKeys);
                stringForms.forEach(formStr => {
                    if (formStr) allForms.push(safeParse(formStr, null));
                });
            }

            // Hapus duplikat dan cari form yang diminta
            const uniqueForms = Array.from(new Map(allForms.filter(f => f != null).map(item => [item.id, item])).values());
            formData = uniqueForms.find(f => f.slug === req.params.slug);
        } catch (e) {
            console.error("SSR Form Fetch Error:", e);
        }
    }

    res.render('bem-form', {
        slug: req.params.slug,
        siteUrl: 'https://bemkbmfkgumi.com',
        formData: formData
    });
});


// ============================================================================
// SUPER BIG UPGRADE: SSR ROUTING UNTUK BERITA & KATEGORI DINAMIS (SEO ENTERPRISE)
// ============================================================================

// Fungsi Helper untuk menarik semua artikel dari Redis (Menjadi fondasi SSR)
async function getArticlesAndCategories() {
    if (!redis) return { articles: [], categories: [] };
    try {
        const keys = await redis.keys('BEM_Articles:*');
        if (keys.length === 0) return { articles: [], categories: [] };
        const raw = await redis.mget(...keys);
        const articles = raw.filter(a => a != null).map(a => typeof a === 'string' ? safeParse(a, null) : a).filter(Boolean);

        // Ekstrak nama kategori yang unik
        const categories = [...new Set(articles.map(a => a.Kategori).filter(Boolean))];
        return { articles, categories };
    } catch (e) {
        return { articles: [], categories: [] };
    }
}

// 1. Route Indeks Berita Default (/berita)
app.get('/berita', async (req, res) => {
    // SUPER UPGRADE SEO FIX (Halaman Perujuk GSC): Lempar artikel terbaru ke SSR HTML agar Googlebot melihat tautan fisik
    const { articles, categories } = await getArticlesAndCategories();
    const sortedArticles = articles.sort((a, b) => new Date(b.Tgl_Rilis || 0) - new Date(a.Tgl_Rilis || 0));

    res.render('berita', {
        articleInfo: null,
        siteUrl: 'https://bemkbmfkgumi.com',
        currentCategory: 'All',
        categorySlug: null,
        categories: categories,
        latestArticles: sortedArticles.slice(0, 20) // SSR Fix
    });
});

// 2. Route Dinamis Kategori Berita (/berita/kategori/:kategori_slug)
app.get('/berita/kategori/:kategori_slug', async (req, res) => {
    const { articles, categories } = await getArticlesAndCategories();
    const catSlugReq = req.params.kategori_slug;

    // Konversi slug kembali menjadi nama Kategori asli
    let actualCategoryName = 'All';
    const sampleArticle = articles.find(a => {
        if (!a.Kategori) return false;
        const catSlug = a.Kategori.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
        return catSlug === catSlugReq;
    });

    if (sampleArticle) {
        actualCategoryName = sampleArticle.Kategori;
    }

    const sortedArticles = articles.sort((a, b) => new Date(b.Tgl_Rilis || 0) - new Date(a.Tgl_Rilis || 0));

    res.render('berita', {
        articleInfo: null,
        siteUrl: 'https://bemkbmfkgumi.com',
        currentCategory: actualCategoryName,
        categorySlug: catSlugReq,
        categories: categories,
        latestArticles: sortedArticles.slice(0, 20) // SSR Fix
    });
});

// 3. Route Dinamis Detail Artikel (/berita/:slug)
// SUPER UPGRADE: Mencegat request Googlebot ke URL spesifik artikel (SSR)
app.get('/berita/:slug', async (req, res) => {
    const { articles, categories } = await getArticlesAndCategories();
    let articleInfo = null;

    if (articles.length > 0) {
        let foundArt = articles.find(a => (a.Slug_URL || a.ID_Berita) === req.params.slug);

        // FIX BASE64 GSC ISSUE PADA BERITA
        if (foundArt) {
            const domain = 'https://bemkbmfkgumi.com';
            foundArt.Gambar_URL = sanitizeImageUrl(foundArt.Gambar_URL, domain);
            articleInfo = foundArt;
        }
    }

    // Mengirim Data Artikel (Metadata) ke dalam File HTML EJS
    res.render('berita', {
        articleInfo: articleInfo,
        siteUrl: 'https://bemkbmfkgumi.com',
        currentSlug: req.params.slug,
        currentCategory: articleInfo ? articleInfo.Kategori : 'All',
        categorySlug: null,
        categories: categories,
        latestArticles: []
    });
});

// ============================================================================
// SUPER BIG UPGRADE: API SYSTEM UPLOAD FILE (REALTIME & FOLDER STRUCTURE UI)
// Berdasarkan gambar 6 & 7, kunci tersimpan sebagai String: BEM_Files:1787225019662-sertifikat-bab-i.png
// ============================================================================
app.post('/api/upload', async (req, res) => {
    try {
        if (!redis) throw new Error("Redis Offline");
        const { filename, base64 } = req.body;

        if (!filename || !base64) return res.status(400).json({ success: false, message: "File kosong atau tidak valid." });

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
        if (!redis) return res.status(503).send("Server Storage Offline");

        const filename = req.params.filename;
        let fileObj = null;

        // 1. Cek String Key BEM_Files:<filename> (Sesuai format GBR 6 & 7)
        const rawStringVal = await redis.get(`BEM_Files:${filename}`);
        if (rawStringVal) {
            fileObj = typeof rawStringVal === 'string' ? safeParse(rawStringVal, null) : rawStringVal;
        }

        // 2. Jika tidak ditemukan di String Key, Cek Redis Hash 'BEM_Files'
        if (!fileObj || !fileObj.data) {
            const rawHashVal = await redis.hget('BEM_Files', filename);
            if (rawHashVal) {
                fileObj = typeof rawHashVal === 'string' ? safeParse(rawHashVal, null) : rawHashVal;
            }
        }

        // 3. Fallback Variasi Prefix: Toleransi nama file dengan atau tanpa awalan 'file-'
        if (!fileObj || !fileObj.data) {
            const alternateFilename = filename.startsWith('file-')
                ? filename.replace(/^file-/, '')
                : `file-${filename}`;

            const altStringVal = await redis.get(`BEM_Files:${alternateFilename}`);
            if (altStringVal) {
                fileObj = typeof altStringVal === 'string' ? safeParse(altStringVal, null) : altStringVal;
            } else {
                const altHashVal = await redis.hget('BEM_Files', alternateFilename);
                if (altHashVal) {
                    fileObj = typeof altHashVal === 'string' ? safeParse(altHashVal, null) : altHashVal;
                }
            }
        }

        if (!fileObj || !fileObj.data) return res.status(404).send("File tidak ditemukan.");

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

        // SEO SUPER UPGRADE: Pastikan Googlebot Image dapat meng-cache dan merayapi ini
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        res.setHeader('Pragma', 'cache');
        res.setHeader('Expires', new Date(Date.now() + 31536000000).toUTCString());
        res.removeHeader('Surrogate-Control');

        if (!mimeType.startsWith('image/')) {
            res.setHeader('Content-Disposition', `attachment; filename="${fileObj.filename || filename}"`);
        }
        res.send(buffer);
    } catch (e) {
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
        if (!redis) throw new Error("Redis Offline");

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

        // HITUNG RESPON REAL-TIME UNTUK SETIAP FORM (Kunci BEM_Responses:FRM-...:RES-...)
        try {
            const allResKeys = await redis.keys('BEM_Responses:*:*');
            const countMap = {};
            if (allResKeys && allResKeys.length > 0) {
                allResKeys.forEach(k => {
                    const parts = k.split(':');
                    if (parts.length >= 3) {
                        const fId = parts[1];
                        countMap[fId] = (countMap[fId] || 0) + 1;
                    }
                });
            }
            uniqueForms.forEach(form => {
                form.responseCount = countMap[form.id] || 0;
            });
        } catch (resErr) {
            console.error("Gagal menghitung responseCount form:", resErr);
            uniqueForms.forEach(form => {
                if (typeof form.responseCount !== 'number') form.responseCount = 0;
            });
        }

        res.status(200).json({ success: true, data: uniqueForms });
    } catch (e) { res.status(500).json({ success: false }); }
});

app.get('/api/forms/:slug', async (req, res) => {
    try {
        if (!redis) throw new Error("Redis Offline");

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

        if (!form) return res.status(404).json({ success: false, message: "Form tidak ditemukan" });
        res.status(200).json({ success: true, data: form });
    } catch (e) { res.status(500).json({ success: false }); }
});

app.post('/api/forms/save', async (req, res) => {
    try {
        if (!redis) throw new Error("Redis Offline");
        const formData = req.body;

        formData.slug = formData.slug.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
        if (!formData.id) formData.id = `FRM-${Date.now()}`;

        if (formData.sections && Array.isArray(formData.sections)) {
            formData.sections.forEach((sec, idx) => {
                if (!sec.stepName || sec.stepName.trim() === '') {
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

        if (!formData.theme) formData.theme = {};
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
        if (!redis) throw new Error("Redis Offline");
        const formId = req.params.id;

        // Hapus dari Format STRING dan HASH sekalian agar tidak tersisa bangkai data
        await redis.del(`BEM_Forms:${formId}`);
        await redis.hdel('BEM_Forms', formId);

        // Hapus seluruh respons terkait (Sesuai GBR 2/3 BEM_Responses:FRM-...)
        const resKeys = await redis.keys(`BEM_Responses:${formId}:*`);
        if (resKeys.length > 0) {
            await redis.del(...resKeys);
        }

        res.status(200).json({ success: true, message: "Form dan respons berhasil dihapus permanen." });
    } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// Submit Jawaban Form (Untuk Publik)
app.post('/api/forms/submit', async (req, res) => {
    try {
        if (!redis) throw new Error("Redis Offline");
        const { formId, responses, email } = req.body;
        const resId = `RES-${Date.now()}`;

        // Cek STRING Dulu, kalau tidak ada, cek HASH (Dual Engine Validation)
        let formStr = await redis.get(`BEM_Forms:${formId}`);
        if (!formStr) {
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
            if (keys.length > 0) {
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
                if (sec.questions) {
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
                            if (q.rows) {
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
        if (!redis) throw new Error("Redis Offline");
        const formId = req.params.id;

        // Sesuai GBR 2 & 3, Responses disimpan sebagai string di BEM_Responses:FRM-xxx:RES-xxx
        const keys = await redis.keys(`BEM_Responses:${formId}:*`);
        let responses = [];

        if (keys.length > 0) {
            const raw = await redis.mget(...keys);
            responses = raw.map(r => typeof r === 'string' ? JSON.parse(r) : r);
        }

        res.status(200).json({ success: true, data: responses });
    } catch (e) { res.status(500).json({ success: false }); }
});

app.put('/api/forms/:formId/responses/:resId', async (req, res) => {
    try {
        if (!redis) throw new Error("Redis Offline");
        const { formId, resId } = req.params;
        const { answers, email } = req.body;

        const redisKey = `BEM_Responses:${formId}:${resId}`;
        const existingStr = await redis.get(redisKey);

        if (!existingStr) return res.status(404).json({ success: false, message: "Data respon tidak ditemukan." });

        let existingObj = typeof existingStr === 'string' ? JSON.parse(existingStr) : existingStr;

        if (email !== undefined) existingObj.email = email;
        if (answers !== undefined) existingObj.answers = answers;

        await redis.set(redisKey, JSON.stringify(existingObj));
        res.status(200).json({ success: true, message: "Jawaban berhasil diperbarui." });
    } catch (e) {
        res.status(500).json({ success: false, message: "Gagal memperbarui jawaban." });
    }
});

app.delete('/api/forms/:formId/responses/:resId', async (req, res) => {
    try {
        if (!redis) throw new Error("Redis Offline");
        const { formId, resId } = req.params;

        await redis.del(`BEM_Responses:${formId}:${resId}`);

        res.status(200).json({ success: true, message: "Jawaban berhasil dihapus." });
    } catch (e) {
        res.status(500).json({ success: false, message: "Gagal menghapus jawaban." });
    }
});

// EXPORT KE EXCEL (.XLSX)
app.get('/api/forms/:id/export', async (req, res) => {
    try {
        if (!redis) throw new Error("Redis Offline");
        const formId = req.params.id;

        let formStr = await redis.get(`BEM_Forms:${formId}`);
        if (!formStr) {
            formStr = await redis.hget('BEM_Forms', formId); // Fallback to Hash Engine
        }
        if (!formStr) return res.status(404).send("Form tidak ditemukan");
        const form = typeof formStr === 'string' ? JSON.parse(formStr) : formStr;

        const keys = await redis.keys(`BEM_Responses:${formId}:*`);
        let responses = [];
        if (keys.length > 0) {
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
                    if (q.type !== 'title_only') {
                        if (q.type === 'kisi_pilihan_ganda' || q.type === 'kisi_kotak_centang') {
                            if (q.rows && Array.isArray(q.rows)) {
                                q.rows.forEach((rowName, rIdx) => {
                                    let ans = resp.answers[`${q.id}_row_${rIdx}`];
                                    if (Array.isArray(ans)) ans = ans.join(', ');
                                    row[`${q.title || "Grid"} [${rowName}]`] = ans || "";
                                });
                            }
                        } else {
                            let ans = resp.answers[q.id];
                            if (Array.isArray(ans)) ans = ans.join(', ');
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
    res.send(`User-agent: *\nAllow: /\nAllow: /api/uploads/\nDisallow: /admin\nDisallow: /api/\n\nSitemap: ${domain}/sitemap.xml\n`);
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

        if (redis) {
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
    <!-- PUSAT INFORMASI & SUB-TAB (CLEAN ROUTING) -->
    <!-- ========================================= -->
    <url><loc>${domain}/informasi</loc><lastmod>${today}</lastmod><changefreq>daily</changefreq><priority>0.9</priority></url>
    <url><loc>${domain}/informasi/proker</loc><lastmod>${today}</lastmod><changefreq>daily</changefreq><priority>0.9</priority></url>
    <url><loc>${domain}/informasi/kalender</loc><lastmod>${today}</lastmod><changefreq>daily</changefreq><priority>0.9</priority></url>
    <url><loc>${domain}/informasi/timeline</loc><lastmod>${today}</lastmod><changefreq>weekly</changefreq><priority>0.9</priority></url>
    <url><loc>${domain}/informasi/galeri</loc><lastmod>${today}</lastmod><changefreq>weekly</changefreq><priority>0.85</priority></url>
    <url><loc>${domain}/informasi/plasma</loc><lastmod>${today}</lastmod><changefreq>weekly</changefreq><priority>0.85</priority></url>

    <!-- ========================================= -->
    <!-- TENTANG KAMI & SUB-SECTION (SSR CLEAN URL) -->
    <!-- ========================================= -->
    <url><loc>${domain}/tentang</loc><lastmod>${today}</lastmod><changefreq>weekly</changefreq><priority>0.9</priority></url>
    <url><loc>${domain}/tentang/visimisi</loc><lastmod>${today}</lastmod><changefreq>monthly</changefreq><priority>0.85</priority></url>
    <url><loc>${domain}/tentang/struktur</loc><lastmod>${today}</lastmod><changefreq>weekly</changefreq><priority>0.85</priority></url>
    <url><loc>${domain}/tentang/filosofi</loc><lastmod>${today}</lastmod><changefreq>monthly</changefreq><priority>0.85</priority></url>
    <url><loc>${domain}/tentang/sejarah-pembentukan</loc><lastmod>${today}</lastmod><changefreq>monthly</changefreq><priority>0.85</priority></url>
    <url><loc>${domain}/tentang/sejarah</loc><lastmod>${today}</lastmod><changefreq>monthly</changefreq><priority>0.85</priority></url>

    <!-- ========================================= -->
    <!-- HALAMAN PROFIL & KONTAK                   -->
    <!-- ========================================= -->
    <url><loc>${domain}/berita</loc><lastmod>${today}</lastmod><changefreq>daily</changefreq><priority>0.9</priority></url>
    <url><loc>${domain}/ourteam</loc><lastmod>${today}</lastmod><changefreq>monthly</changefreq><priority>0.8</priority></url>
    <url><loc>${domain}/narahubung</loc><lastmod>${today}</lastmod><changefreq>monthly</changefreq><priority>0.6</priority></url>

    <!-- ========================================= -->
    <!-- INDUK ROUTING KEGIATAN & DEPARTEMEN       -->
    <!-- ========================================= -->
    <url><loc>${domain}/informasi/proker</loc><lastmod>${today}</lastmod><changefreq>weekly</changefreq><priority>0.7</priority></url>
    <url><loc>${domain}/informasi/kalender</loc><lastmod>${today}</lastmod><changefreq>daily</changefreq><priority>0.7</priority></url>`;

        if (Array.isArray(prokerData) && prokerData.length > 0) {
            xmlUrls += `\n\n    <!-- DIRECT DYNAMIC SEO URLs (PROKER & DEPARTEMEN) -->`;
            prokerData.forEach(p => {
                const slug = p.slug || p.id;
                let img = sanitizeImageUrl(p.bgImage || p.fotoPengurus, domain);
                if (slug) {
                    const itemLastMod = formatSitemapDate(p.startDate);
                    xmlUrls += `
    <url>
        <loc>${domain}/informasi/proker/proker-deskripsi/${escapeXml(slug)}</loc>
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
                const img = sanitizeImageUrl(k.banner, domain);
                if (slug) {
                    const itemLastMod = formatSitemapDate(k.tglMulai);
                    xmlUrls += `
    <url>
        <loc>${domain}/informasi/kalender/proker-detail/${escapeXml(slug)}</loc>
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

        // ================= SUPER BIG UPGRADE: DYNAMIC SEO ARTIKEL DARI REDIS LOKAL =================
        // FIX SITEMAP KANONIS: Format URL diubah menjadi Clean URL Path (/berita/slug)
        try {
            if (redis) {
                const articleKeys = await redis.keys('BEM_Articles:*');
                if (articleKeys.length > 0) {
                    const rawArticles = await redis.mget(...articleKeys);
                    const articles = rawArticles.filter(a => a != null).map(a => typeof a === 'string' ? safeParse(a, null) : a).filter(Boolean);

                    if (articles.length > 0) {
                        xmlUrls += `\n\n    <!-- DIRECT DYNAMIC SEO URLs (ARTIKEL/PUBMED) -->`;
                        articles.forEach(art => {
                            const slug = art.Slug_URL || art.ID_Berita;
                            const img = sanitizeImageUrl(art.Gambar_URL, domain);
                            const itemLastMod = formatSitemapDate(art.Tgl_Rilis);
                            if (slug) {
                                xmlUrls += `
    <url>
        <loc>${domain}/berita/${escapeXml(slug)}</loc>
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
            }
        } catch (e) {
            console.warn("⚠️ Sitemap: Gagal sinkronisasi artikel lokal", e);
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

// ================= ZERO-DELAY IN-MEMORY CACHE ENGINE (RAM SPEED < 1ms) =================
let contentMemoryCache = null;
let contentMemoryTime = 0;
let contentMemoryEtag = null;
const CONTENT_CACHE_TTL = 60 * 1000; // 60 Detik di RAM Node.js

const invalidateContentCache = () => {
    contentMemoryCache = null;
    contentMemoryTime = 0;
    contentMemoryEtag = null;
    console.log("⚡ [CACHE] In-Memory Cache /api/content Berhasil Dikosongkan (Realtime Refresh).");
};

let articlesMemoryCache = null;
let articlesMemoryTime = 0;
const ARTICLES_CACHE_TTL = 30 * 1000; // 30 Detik di RAM Node.js

const invalidateArticlesCache = () => {
    articlesMemoryCache = null;
    articlesMemoryTime = 0;
    console.log("⚡ [CACHE] In-Memory Cache /api/articles Berhasil Dikosongkan (Realtime Refresh).");
};

// ================= API ENDPOINTS: ARTIKEL (PUBMED TERINTEGRASI PENUH LOKAL REDIS) =================

// Ambil Seluruh Data Berita (Support Pagination & Filter Kategori + In-Memory Micro-Cache)
app.get('/api/articles', async (req, res) => {
    try {
        if (!redis) throw new Error("Redis Offline");
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const category = req.query.category || 'All';
        const now = Date.now();

        let articles = [];

        // 1. Cek In-Memory Cache RAM Server
        if (articlesMemoryCache && (now - articlesMemoryTime < ARTICLES_CACHE_TTL)) {
            articles = articlesMemoryCache;
        } else {
            // Ambil Seluruh Data Berita Dari Namespace `BEM_Articles:*`
            const keys = await redis.keys('BEM_Articles:*');
            if (keys.length > 0) {
                const raw = await redis.mget(...keys);
                articles = raw.filter(i => i != null).map(i => typeof i === 'string' ? safeParse(i, null) : i).filter(Boolean);
            }
            // Sortir Artikel dari Tanggal Terbaru (Descending)
            articles.sort((a, b) => new Date(b.Tgl_Rilis || 0) - new Date(a.Tgl_Rilis || 0));
            articlesMemoryCache = articles;
            articlesMemoryTime = now;
        }

        // 2. Filter berdasarkan Kategori
        let filteredArticles = articles;
        if (category !== 'All') {
            filteredArticles = articles.filter(a => a.Kategori === category);
        }

        // 3. Proses Pagination
        const startIndex = (page - 1) * limit;
        const endIndex = page * limit;
        const paginatedArticles = filteredArticles.slice(startIndex, endIndex);

        res.setHeader('Cache-Control', 'public, max-age=15, stale-while-revalidate=60');
        res.status(200).json({ success: true, data: paginatedArticles, total: filteredArticles.length });
    } catch (e) {
        res.status(500).json({ success: false, data: [] });
    }
});

// Increment Jumlah View Berita
app.post('/api/articles/view/:id', async (req, res) => {
    try {
        if (!redis) throw new Error("Redis Offline");
        const key = `BEM_Articles:${req.params.id}`;
        const raw = await redis.get(key);

        if (raw) {
            let art = typeof raw === 'string' ? JSON.parse(raw) : raw;
            art.Jumlah_View = (parseInt(art.Jumlah_View) || 0) + 1;
            await redis.set(key, JSON.stringify(art));
            invalidateArticlesCache();
        }
        res.status(200).json({ success: true });
    } catch (e) { res.status(500).json({ success: false }); }
});

// Increment Jumlah Like Berita
app.post('/api/articles/like/:id', async (req, res) => {
    try {
        if (!redis) throw new Error("Redis Offline");
        const key = `BEM_Articles:${req.params.id}`;
        const raw = await redis.get(key);

        if (raw) {
            let art = typeof raw === 'string' ? JSON.parse(raw) : raw;
            art.Jumlah_Like = (parseInt(art.Jumlah_Like) || 0) + 1;
            await redis.set(key, JSON.stringify(art));
            invalidateArticlesCache();
        }
        res.status(200).json({ success: true });
    } catch (e) { res.status(500).json({ success: false }); }
});

// ADMIN: Simpan atau Edit Berita
app.post('/api/articles/save', async (req, res) => {
    try {
        if (!redis) throw new Error("Redis Offline");
        let art = req.body;

        if (!art.ID_Berita) art.ID_Berita = `ART-${Date.now()}`;
        if (!art.Slug_URL) art.Slug_URL = art.Judul.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
        if (!art.Tgl_Rilis) art.Tgl_Rilis = new Date().toISOString();
        if (!art.Jumlah_View) art.Jumlah_View = 0;
        if (!art.Jumlah_Like) art.Jumlah_Like = 0;

        await redis.set(`BEM_Articles:${art.ID_Berita}`, JSON.stringify(art));
        invalidateArticlesCache(); // Kosongkan cache artikel seketika
        res.status(200).json({ success: true, message: "Artikel berhasil disimpan", id: art.ID_Berita });
    } catch (e) { res.status(500).json({ success: false }); }
});

// ADMIN: Hapus Berita
app.delete('/api/articles/:id', async (req, res) => {
    try {
        if (redis) await redis.del(`BEM_Articles:${req.params.id}`);
        invalidateArticlesCache(); // Kosongkan cache artikel seketika
        res.status(200).json({ success: true, message: "Artikel dihapus." });
    } catch (e) { res.status(500).json({ success: false }); }
});

// ================= API CMS ENDPOINTS (ZERO-DELAY MULTI-TIER CACHE DENGAN ETAG & MGET) =================
app.get('/api/content', async (req, res) => {
    try {
        const clientEtag = req.headers['if-none-match'];
        const now = Date.now();

        // 1. LAYER 1: MEMORY RAM CACHE & ETAG 304 NOT MODIFIED (< 1ms RESPONSE)
        if (contentMemoryCache && (now - contentMemoryTime < CONTENT_CACHE_TTL)) {
            if (clientEtag && clientEtag === contentMemoryEtag) {
                return res.status(304).end(); // 304 Not Modified (0 byte payload)
            }
            res.setHeader('Cache-Control', 'no-cache, must-revalidate');
            res.setHeader('ETag', contentMemoryEtag);
            return res.status(200).json(contentMemoryCache);
        }

        if (!redis) throw new Error("Redis Offline");

        // 2. LAYER 2: UPSTASH REDIS MGET
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
        if (!parsedOrg.namaKabinet) parsedOrg.namaKabinet = defaultOrg.namaKabinet;
        if (!parsedOrg.periode) parsedOrg.periode = defaultOrg.periode;
        if (!parsedOrg.sambutan) {
            parsedOrg.sambutan = { ...defaultOrg.sambutan };
        } else {
            if (!parsedOrg.sambutan.judul) parsedOrg.sambutan.judul = defaultOrg.sambutan.judul;
            if (!parsedOrg.sambutan.teks1) parsedOrg.sambutan.teks1 = defaultOrg.sambutan.teks1;
            if (!parsedOrg.sambutan.teks2) parsedOrg.sambutan.teks2 = defaultOrg.sambutan.teks2;
            if (!parsedOrg.sambutan.foto) parsedOrg.sambutan.foto = defaultOrg.sambutan.foto;
        }
        if (!parsedOrg.quote) {
            parsedOrg.quote = { ...defaultOrg.quote };
        } else {
            if (!parsedOrg.quote.teks) parsedOrg.quote.teks = defaultOrg.quote.teks;
            if (!parsedOrg.quote.author) parsedOrg.quote.author = defaultOrg.quote.author;
            if (!parsedOrg.quote.jabatan) parsedOrg.quote.jabatan = defaultOrg.quote.jabatan;
        }
        // SUPER BIG UPGRADE: Sinkronisasi 1 Format Pasti Nama Ketua BEM ke Quote Author
        if (parsedOrg.pimpinan && Array.isArray(parsedOrg.pimpinan) && parsedOrg.pimpinan.length > 0) {
            const foundKetua = parsedOrg.pimpinan.find(p => p && /ketua\s*bem/i.test(p.jabatan || '')) || parsedOrg.pimpinan[0];
            if (foundKetua && foundKetua.nama && foundKetua.nama.trim()) {
                parsedOrg.quote.author = foundKetua.nama.trim();
            }
        }
        if (!parsedOrg.misi || !Array.isArray(parsedOrg.misi) || parsedOrg.misi.length === 0) parsedOrg.misi = defaultOrg.misi;
        if (!parsedOrg.artiKabinet) parsedOrg.artiKabinet = defaultOrg.artiKabinet;

        const responsePayload = {
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
        };

        // Buat ETag berbasis Hash MD5 dari Payload
        const payloadString = JSON.stringify(responsePayload);
        const etag = '"' + crypto.createHash('md5').update(payloadString).digest('hex') + '"';

        // Simpan ke RAM Server
        contentMemoryCache = responsePayload;
        contentMemoryTime = now;
        contentMemoryEtag = etag;

        if (clientEtag && clientEtag === etag) {
            return res.status(304).end();
        }

        res.setHeader('Cache-Control', 'no-cache, must-revalidate');
        res.setHeader('ETag', etag);
        res.status(200).json(responsePayload);
    } catch (error) {
        // Fallback Utama Jika Redis Error (Mengirim Semua Data Master)
        res.status(200).json({ success: false, org: defaultOrg, proker: defaultProker, kalender: defaultKalender, dokumentasi: [], settings: defaultSettings, team: defaultTeam, sejarah: defaultSejarah, filosofi: defaultFilosofi, kontak: defaultKontak, radar: defaultRadar });
    }
});

app.post('/api/content/:type', async (req, res) => {
    try {
        if (!redis) throw new Error("Redis Offline");
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

        if (type === 'org' && bodyData && typeof bodyData === 'object') {
            if (Array.isArray(bodyData.pimpinan) && bodyData.pimpinan.length > 0) {
                const coreTitles = ['Ketua BEM', 'Wakil Ketua BEM', 'Sekretaris BEM', 'Bendahara BEM'];
                for (let i = 0; i < Math.min(4, bodyData.pimpinan.length); i++) {
                    if (!bodyData.pimpinan[i].jabatan || !/ketua|sekretaris|bendahara/i.test(bodyData.pimpinan[i].jabatan)) {
                        bodyData.pimpinan[i].jabatan = coreTitles[i];
                    }
                }
                const foundKetua = bodyData.pimpinan.find(p => p && /ketua\s*bem/i.test(p.jabatan || '')) || bodyData.pimpinan[0];
                if (foundKetua && foundKetua.nama && foundKetua.nama.trim()) {
                    if (!bodyData.quote) bodyData.quote = {};
                    bodyData.quote.author = foundKetua.nama.trim();
                }
            }
        }

        // Proteksi Integritas Data Developer Team: Pastikan FullStack Development & Lead Developer selalu terjaga
        if (type === 'team' && Array.isArray(bodyData)) {
            let fsCat = bodyData.find(c => c && /fullstack/i.test(c.category || ''));
            if (!fsCat) {
                fsCat = { category: "FullStack Development", members: [] };
                bodyData.unshift(fsCat);
            }
            if (!Array.isArray(fsCat.members)) fsCat.members = [];
            let leadDev = fsCat.members.find(m => m && /aksa/i.test(m.nama || ''));
            if (!leadDev) {
                fsCat.members.unshift({
                    nama: "M. Aksa Arsyad, drg., S.KG",
                    foto: "/img/axaprofil.jpg",
                    ig: "https://www.instagram.com/axaaxyz_"
                });
            } else {
                leadDev.nama = leadDev.nama || "M. Aksa Arsyad, drg., S.KG";
                leadDev.foto = leadDev.foto || "/img/axaprofil.jpg";
                leadDev.ig = leadDev.ig || "https://www.instagram.com/axaaxyz_";
            }
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
            invalidateContentCache(); // KOSONGKAN IN-MEMORY CACHE SERVER INSTAN AGAR REALTIME
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
        if (!redis) throw new Error("Redis Offline");

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

        // Bonus Update: Menghitung total artikel
        const articleKeys = await redis.keys('BEM_Articles:*');
        const totalArticles = articleKeys.length;

        res.status(200).json({
            success: true,
            data: {
                totalForms,
                totalResponses,
                totalAspirasi,
                totalPesan,
                totalArticles
            }
        });
    } catch (e) {
        res.status(500).json({ success: false, message: "Gagal mengambil statistik." });
    }
});

// ================= API ENDPOINT: VERIFIKASI PIN ADMIN/DEVELOPER DARI .ENV =================
app.post('/api/verify-pin', (req, res) => {
    try {
        const { pin } = req.body;
        const serverPin = process.env.PIN || '999';
        if (pin && String(pin).trim() === String(serverPin).trim()) {
            return res.status(200).json({ success: true, message: "PIN berhasil diverifikasi." });
        }
        return res.status(403).json({ success: false, message: "PIN salah! Akses ditolak." });
    } catch (err) {
        return res.status(500).json({ success: false, message: "Gagal memproses verifikasi PIN." });
    }
});

// ================= API ENDPOINTS: TRANSAKSIONAL (ULTRA-FAST PARALLEL + RAM CACHE) =================
let interactionsMemoryCache = null;
let interactionsMemoryTime = 0;
const INTERACTIONS_CACHE_TTL = 30 * 1000; // 30 Detik di RAM Node.js

const invalidateInteractionsCache = () => {
    interactionsMemoryCache = null;
    interactionsMemoryTime = 0;
    console.log("⚡ [CACHE] In-Memory Cache /api/interactions Berhasil Dikosongkan (Realtime Refresh).");
};

app.get('/api/interactions', async (req, res) => {
    try {
        if (!redis) throw new Error("Redis Offline");
        const now = Date.now();

        // 1. Cek In-Memory Cache RAM Server (Ultra-Fast 0ms Latency)
        if (interactionsMemoryCache && (now - interactionsMemoryTime < INTERACTIONS_CACHE_TTL)) {
            res.setHeader('Cache-Control', 'public, max-age=10, stale-while-revalidate=30');
            return res.status(200).json({ success: true, ...interactionsMemoryCache });
        }

        // 2. Fetch Kunci Paralel Menggunakan Promise.all
        const [aspirasiKeys, messageKeys] = await Promise.all([
            redis.keys('BEM_Aspirations:*'),
            redis.keys('BEM_Messages:*')
        ]);

        // 3. Fetch Data Paralel Menggunakan Promise.all
        const [rawAspirasi, rawPesan] = await Promise.all([
            aspirasiKeys.length > 0 ? redis.mget(...aspirasiKeys) : Promise.resolve([]),
            messageKeys.length > 0 ? redis.mget(...messageKeys) : Promise.resolve([])
        ]);

        const aspirasi = rawAspirasi.filter(i => i != null)
            .map(i => typeof i === 'string' ? safeParse(i, null) : i)
            .filter(Boolean)
            .sort((a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0));

        const pesan = rawPesan.filter(i => i != null)
            .map(i => typeof i === 'string' ? safeParse(i, null) : i)
            .filter(Boolean)
            .sort((a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0));

        // Simpan ke Cache RAM Server
        interactionsMemoryCache = { aspirasi, pesan };
        interactionsMemoryTime = now;

        res.setHeader('Cache-Control', 'public, max-age=10, stale-while-revalidate=30');
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

        // Simpan sebagai STRING Sesuai Format Upstash
        if (redis) await redis.set(`BEM_Aspirations:${id}`, JSON.stringify(payload));
        invalidateInteractionsCache(); // Real-time Invalidation
        res.status(200).json({ success: true, message: 'Aspirasi berhasil dikirim!' });
    } catch (error) { res.status(500).json({ success: false }); }
});

app.post('/api/message', async (req, res) => {
    try {
        const { nama, kontak, subjek, pesan } = req.body;
        const id = `MSG-${Date.now()}`;
        const payload = { id, nama: String(nama), kontak: String(kontak), subjek: String(subjek), pesan: String(pesan), timestamp: new Date().toISOString() };

        // Simpan sebagai STRING Sesuai Format Upstash
        if (redis) await redis.set(`BEM_Messages:${id}`, JSON.stringify(payload));
        invalidateInteractionsCache(); // Real-time Invalidation
        res.status(200).json({ success: true, message: 'Pesan terkirim!' });
    } catch (error) { res.status(500).json({ success: false }); }
});

app.post('/api/delete-interaction', async (req, res) => {
    try {
        const { type, id } = req.body;
        // Hapus Kunci STRING Spesifik
        if (type === 'aspirasi' && redis) await redis.del(`BEM_Aspirations:${id}`);
        if (type === 'pesan' && redis) await redis.del(`BEM_Messages:${id}`);
        invalidateInteractionsCache(); // Real-time Invalidation
        res.status(200).json({ success: true });
    } catch (error) { res.status(500).json({ success: false }); }
});

app.post('/api/admin/auth', (req, res) => {
    const { username, password } = req.body;

    const validUser = process.env.ADMIN_USER || 'bemfkgumi2026';
    const validPass = process.env.ADMIN_PASS || 'bemfkgumi999';

    if (username === validUser && password === validPass) {
        res.status(200).json({ success: true, token: process.env.ADMIN_TOKEN || 'AXA-XYZ-SECURE-TOKEN' });
    } else {
        res.status(401).json({ success: false, message: 'Kredensial salah!' });
    }
});

// ================= MIDDLEWARE AUTHENTICATION (SUPER ROBUST) =================
const verifyToken = (req, res, next) => {
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

// ================= REDIS KEYS CONFIGURATION FOR MHS, CIVITAS, LINKTREE, QR =================
const MHS_HASH_KEY = 'BEM_MHS_DB';
const MHS_SCHEMA_KEY = 'BEM_MHS_FORM_SCHEMA';
const MHS_LAST_UPDATE_KEY = 'BEM_LAST_UPDATE_MHS';

const CIVITAS_HASH_KEY = 'BEM_CIVITAS_DB';
const DOSEN_SCHEMA_KEY = 'BEM_DOSEN_FORM_SCHEMA';
const CIVITAS_SCHEMA_KEY = 'BEM_CIVITAS_FORM_SCHEMA';
const CIVITAS_LAST_UPDATE_KEY = 'BEM_LAST_UPDATE_CIVITAS';

// Helper Function: Generate Indo Formatted Date (WITA)
function getIndoFormattedDate() {
    try {
        const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
        const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
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
    } catch (e) {
        return new Date().toLocaleString('id-ID', { timeZone: 'Asia/Makassar' }) + ' WITA';
    }
}

// ================= ENDPOINT API MAHASISWA =================
app.get('/api/mhs/schema', async (req, res) => {
    try {
        if (!redis) throw new Error("Redis Offline");
        const schema = await redis.get(MHS_SCHEMA_KEY);
        res.json({ success: true, data: safeParse(schema, []) });
    } catch (error) { res.status(500).json({ success: false, message: 'Gagal mengambil skema' }); }
});

app.post('/api/mhs/schema', verifyToken, async (req, res) => {
    try {
        if (!redis) throw new Error("Redis Offline");
        await redis.set(MHS_SCHEMA_KEY, JSON.stringify(req.body));
        res.json({ success: true, message: 'Skema Berhasil Disimpan' });
    } catch (error) { res.status(500).json({ success: false, message: 'Gagal menyimpan skema' }); }
});

app.get('/api/mhs', async (req, res) => {
    try {
        if (!redis) throw new Error("Redis Offline");
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
        if (!redis) throw new Error("Redis Offline");
        const dataStr = await redis.hget(MHS_HASH_KEY, req.params.id);
        if (!dataStr) return res.status(404).json({ success: false, message: 'Data tidak ditemukan' });
        res.json({ success: true, data: safeParse(dataStr, {}) });
    } catch (error) { res.status(500).json({ success: false, message: 'Gagal mengambil data' }); }
});

app.post('/api/mhs/bulk', verifyToken, async (req, res) => {
    try {
        if (!redis) throw new Error("Redis Offline");
        const { students } = req.body;
        if (!students || !Array.isArray(students)) return res.status(400).json({ success: false, message: 'Format data tidak valid' });

        const p = redis.pipeline();
        let successCount = 0;

        students.forEach(std => {
            let idMhs = std.nim_profesi && std.nim_profesi !== '-' && std.nim_profesi !== '' ? std.nim_profesi : null;
            if (!idMhs) idMhs = std['STAMBUK/NIM PROFESI'] && std['STAMBUK/NIM PROFESI'] !== '-' ? std['STAMBUK/NIM PROFESI'] : null;
            if (!idMhs) idMhs = std.nim_sarjana && std.nim_sarjana !== '-' ? std.nim_sarjana : null;
            if (!idMhs) idMhs = std['STAMBUK/NIM SARJANA'] && std['STAMBUK/NIM SARJANA'] !== '-' ? std['STAMBUK/NIM SARJANA'] : null;
            if (!idMhs) idMhs = std.nim || std.NIM;

            if (idMhs && idMhs !== '' && idMhs !== '-') {
                std.nim = idMhs;
                p.hset(MHS_HASH_KEY, { [idMhs]: JSON.stringify(std) });
                successCount++;
            }
        });

        await p.exec();
        if (successCount === 0) return res.status(400).json({ success: false, message: 'Tidak ada data valid dengan Identifier (NIM/STAMBUK) yang ditemukan pada file Excel.' });

        await redis.set(MHS_LAST_UPDATE_KEY, getIndoFormattedDate());
        res.json({ success: true, message: `Berhasil sinkronisasi ${successCount} mahasiswa ke database.` });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Gagal melakukan sinkronisasi database' });
    }
});

app.post('/api/mhs', verifyToken, async (req, res) => {
    try {
        if (!redis) throw new Error("Redis Offline");
        const std = req.body;

        let idMhs = std.nim_profesi && std.nim_profesi !== '-' && std.nim_profesi !== '' ? std.nim_profesi : null;
        if (!idMhs) idMhs = std.nim_sarjana && std.nim_sarjana !== '-' ? std.nim_sarjana : null;
        if (!idMhs) idMhs = std.nim;

        if (!idMhs || idMhs === '-' || idMhs === '') return res.status(400).json({ success: false, message: 'NIM / STAMBUK Wajib Diisi (Identifier Database)' });

        std.nim = idMhs;
        await redis.hset(MHS_HASH_KEY, { [idMhs]: JSON.stringify(std) });
        await redis.set(MHS_LAST_UPDATE_KEY, getIndoFormattedDate());
        res.json({ success: true, message: 'Data Mahasiswa Berhasil Dibuat' });
    } catch (error) { res.status(500).json({ success: false, message: 'Gagal menyimpan data' }); }
});

app.put('/api/mhs/:id', verifyToken, async (req, res) => {
    try {
        if (!redis) throw new Error("Redis Offline");
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
        if (!redis) throw new Error("Redis Offline");
        await redis.hdel(MHS_HASH_KEY, req.params.id);
        await redis.set(MHS_LAST_UPDATE_KEY, getIndoFormattedDate());
        res.json({ success: true, message: 'Data Mahasiswa Terhapus' });
    } catch (error) { res.status(500).json({ success: false, message: 'Gagal menghapus data' }); }
});

// ================= ENDPOINT API PEGAWAI (DOSEN & CIVITAS) =================
app.get('/api/civitas/schema/dosen', async (req, res) => {
    try {
        if (!redis) throw new Error("Redis Offline");
        const schema = await redis.get(DOSEN_SCHEMA_KEY);
        res.json({ success: true, data: safeParse(schema, []) });
    } catch (error) { res.status(500).json({ success: false, message: 'Gagal mengambil skema Dosen' }); }
});

app.post('/api/civitas/schema/dosen', verifyToken, async (req, res) => {
    try {
        if (!redis) throw new Error("Redis Offline");
        await redis.set(DOSEN_SCHEMA_KEY, JSON.stringify(req.body));
        res.json({ success: true, message: 'Skema Dosen Berhasil Disimpan' });
    } catch (error) { res.status(500).json({ success: false, message: 'Gagal menyimpan skema Dosen' }); }
});

app.get('/api/civitas/schema/civitas', async (req, res) => {
    try {
        if (!redis) throw new Error("Redis Offline");
        const schema = await redis.get(CIVITAS_SCHEMA_KEY);
        res.json({ success: true, data: safeParse(schema, []) });
    } catch (error) { res.status(500).json({ success: false, message: 'Gagal mengambil skema Civitas' }); }
});

app.post('/api/civitas/schema/civitas', verifyToken, async (req, res) => {
    try {
        if (!redis) throw new Error("Redis Offline");
        await redis.set(CIVITAS_SCHEMA_KEY, JSON.stringify(req.body));
        res.json({ success: true, message: 'Skema Civitas Berhasil Disimpan' });
    } catch (error) { res.status(500).json({ success: false, message: 'Gagal menyimpan skema Civitas' }); }
});

app.get('/api/civitas', async (req, res) => {
    try {
        if (!redis) throw new Error("Redis Offline");
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

app.get('/api/civitas/:id', async (req, res) => {
    try {
        if (!redis) throw new Error("Redis Offline");
        const dataStr = await redis.hget(CIVITAS_HASH_KEY, req.params.id);
        if (!dataStr) return res.status(404).json({ success: false, message: 'Data Pegawai tidak ditemukan' });
        res.json({ success: true, data: safeParse(dataStr, {}) });
    } catch (error) { res.status(500).json({ success: false, message: 'Gagal mengambil data pegawai' }); }
});

app.post('/api/civitas/bulk', verifyToken, async (req, res) => {
    try {
        if (!redis) throw new Error("Redis Offline");
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
        if (successCount === 0) return res.status(400).json({ success: false, message: 'Tidak ada data valid dengan Identifier (NIDN/NIP) yang ditemukan pada file Excel.' });

        await redis.set(CIVITAS_LAST_UPDATE_KEY, getIndoFormattedDate());
        res.json({ success: true, message: `Berhasil sinkronisasi ${successCount} pegawai` });
    } catch (error) { res.status(500).json({ success: false, message: 'Gagal melakukan sinkronisasi database pegawai' }); }
});

app.post('/api/civitas', verifyToken, async (req, res) => {
    try {
        if (!redis) throw new Error("Redis Offline");
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
        if (!redis) throw new Error("Redis Offline");
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
        if (!redis) throw new Error("Redis Offline");
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
        if (!redis) throw new Error("Redis Offline");
        const trees = await redis.hgetall('BEM_Linktrees') || {};
        const parsedTrees = Object.values(trees).map(item => safeParse(item, {}));
        res.status(200).json({ success: true, data: parsedTrees });
    } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// Analytics Overview (harus sebelum /api/linktrees/:slug agar tidak tertukar slug)
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
        if (!redis) throw new Error("Redis Offline");
        const trees = await redis.hgetall('BEM_Linktrees') || {};
        const treeArr = Object.values(trees).map(item => safeParse(item, {}));
        const tree = treeArr.find(t => t.slug === req.params.slug);

        if (!tree) return res.status(404).json({ success: false, message: "Linktree tidak ditemukan" });
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
        if (!redis) throw new Error("Redis Offline");
        const payload = req.body;

        payload.slug = payload.slug.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/(^-|-$)+/g, '');
        if (!payload.id) payload.id = `LNK-${Date.now()}`;

        const trees = await redis.hgetall('BEM_Linktrees') || {};
        const treeArr = Object.values(trees).map(item => safeParse(item, {}));
        const isSlugTaken = treeArr.some(t => t.slug === payload.slug && t.id !== payload.id);

        if (isSlugTaken) {
            payload.slug = payload.slug + '-' + Math.floor(Math.random() * 1000);
        }

        await redis.hset('BEM_Linktrees', { [payload.id]: JSON.stringify(payload) });
        res.status(200).json({ success: true, message: "Linktree disimpan!", data: payload });
    } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

app.delete('/api/linktrees/:id', verifyToken, async (req, res) => {
    try {
        if (!redis) throw new Error("Redis Offline");
        await redis.hdel('BEM_Linktrees', req.params.id);
        res.status(200).json({ success: true, message: "Dihapus" });
    } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// ================= ENDPOINT API QR CODES =================
app.get(['/api/qrcodes', '/api/qrcodes/'], async (req, res) => {
    try {
        if (!redis) throw new Error("Redis Offline");

        const keys = await redis.keys('BEM_QRCodes:*');
        let parsedQRs = [];

        if (keys && keys.length > 0) {
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
        if (!redis) throw new Error("Redis Offline");
        const payload = req.body;

        if (!payload.id) payload.id = `QR-${Date.now()}`;
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
        if (!redis) throw new Error("Redis Offline");
        await redis.del(`BEM_QRCodes:${req.params.id}`);
        res.status(200).json({ success: true, message: "QR Code Permanen Dihapus" });
    } catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
});

// ============================================================================
// API ENDPOINTS AI ASISTEN REDAKSI & JURNALIS BEM KBMFKG-UMI
// Sesuai Spesifikasi: AI ASISTEN_BERITA_BEM KBMFKG UMI.md & 9Router Proxy
// ============================================================================

const AI_EDITORIAL_SYSTEM_PROMPT = `Anda adalah AI Asisten Redaksi & Jurnalis Resmi BEM KBMFKG-UMI (Badan Eksekutif Mahasiswa Keluarga Besar Mahasiswa Fakultas Kedokteran Gigi Universitas Muslim Indonesia).
Tugas Anda adalah memandu admin/redaksi menyusun artikel atau berita kegiatan secara terstruktur, faktual, sistematis, anti-halusinasi, dan siap dipublikasikan.

ATURAN ANTI-HALUSINASI SANGAT KETAT (WAJIB DIPATUHI):
1. DILARANG MENGARANG nama pejabat, gelar, jabatan, tanggal, hari, waktu, lokasi, jumlah peserta/penerima manfaat, hasil kegiatan, kutipan langsung, maupun data statistik apapun.
2. DILARANG MENGARANG kehadiran tokoh/pimpinan jika tidak disebutkan oleh pengguna.
3. DILARANG MENGARANG pernyataan atau isi sambutan. Jika pengguna hanya memberikan poin sambutan, gunakan kalimat tidak langsung (misal: "Dalam sambutannya, ... menyampaikan bahwa ...").
4. Jika ada informasi penting yang belum tersedia, jangan mengarang. Tandai secara transparan atau tanyakan dengan sopan dan terarah kepada pengguna.

ATURAN ANTI-FIELD TERLARANG (SANGAT KRUSIAL):
1. DILARANG membuat Keyword Tags / Tags.
2. DILARANG membuat Caption Foto.
3. DILARANG membuat Alt Text.
Field-field tersebut TIDAK DIGUNAKAN di website BEM KBMFKG-UMI. Hanya gunakan field: Judul, Kategori, Tanggal Rilis, Deskripsi Singkat (SEO Meta 1-2 kalimat), dan Isi Artikel (Paragraf berita).

ALUR KERJA EDITORIAL 10 TAHAP:
Tahap 1: Identitas Kegiatan (Nama kegiatan, tema/tagline, kategori).
Tahap 2: Waktu Kegiatan (Tanggal, hari, jam pelaksanaan).
Tahap 3: Lokasi Kegiatan (Tempat, gedung/ruangan, kota/kabupaten, provinsi).
Tahap 4: Tokoh & Pejabat Hadir (Universitas, Fakultas, BEM/Panitia, Narasumber/Mitra Eksternal).
Tahap 5: Penyelenggara & Panitia.
Tahap 6: Rangkaian Acara (Pembukaan, inti, penyerahan, penutup).
Tahap 7: Tujuan, Manfaat, & Sasaran Kegiatan.
Tahap 8: Kutipan/Poin Sambutan.
Tahap 9: Perumusan Alternatif Judul (1, 3, 5, atau 10 opsi judul jurnalisme informatif, menarik, tanpa clickbait).
Tahap 10: Konfirmasi Judul, Deskripsi Singkat (SEO Meta), dan Penyusunan Isi Artikel Lengkap (Lead 5W+1H, Detail, Sambutan, Penutup) + Editorial Check.

GAYA BAHASA:
Bahasa Indonesia baku jurnalistik profesional, objektif, humanis, mengalir, rapi, dan mudah dipahami civitas akademika serta masyarakat umum.

FORMAT RESPON:
Anda WAJIB memberikan respons HANYA berupa blok JSON valid tanpa teks pengantar di luar blok:
\`\`\`json
{
  "reply": "Pesan penjelasan editorial Anda dalam format Markdown rapi...",
  "stage": "01_informasi | 02_waktu_lokasi | 03_tokoh | 04_rangkaian | 05_substansi | 06_judul | 07_deskripsi | 08_artikel | 09_review | 10_final",
  "stepNumber": 1, // integer 1 sampai 10
  "draft": {
    "eventName": "...",
    "theme": "...",
    "category": "...", // Rekomendasikan salah satu dari 10 Kategori Resmi BEM KBMFKG UMI: Program Kerja Unggulan BEM KBMFKG UMI (UAS, BERKAH, KULKAS, WOHD, DENTIVE, MS, DHC), Pengabdian Masyarakat & Bakti Sosial Kesehatan Gigi, Seminar, Webinar & Kuliah Tamu Kedokteran Gigi, Pengkaderan/Kaderisasi & Latihan Dasar Kegawatdaruratan (LDK), Pelantikan, Rapat Kerja (Raker), Laporan Pertanggung Jawaban Triwulan (LPJ TW), Pramuktamar & Muktamar, Prestasi & Delegasi Ilmiah Mahasiswa, Advokasi, Mengkaji Implementasi Program Kerja (MIPK), & Pengumpulan Aspirasi Mahasiswa (PLASMA), Kajian Strategis, Kebijakan Isu Kesehatan & Jurnalistik, Dies Natalis & Peringatan Milad Fakultas/BEM, Studi Banding, Kemitraan Eksternal & Kerjasama Antar Lembaga.
    "date": "...",
    "time": "...",
    "location": "...",
    "city": "...",
    "province": "...",
    "organizer": "...",
    "attendees": ["Nama - Jabatan"],
    "eventSequence": ["Acara 1", "Acara 2"],
    "purpose": "...",
    "beneficiaries": "...",
    "quotes": ["..."],
    "selectedTitle": "...",
    "shortDescription": "...",
    "articleBody": "..."
  },
  "titleOptions": ["Judul 1", "Judul 2", ...], // Jika pada tahap judul
  "readyToPublish": false // true jika naskah final sudah lengkap dan lolos editorial check
}
\`\`\`
ATURAN STRING JSON:
Pastikan SEMUA tanda kutip ganda di dalam teks string (seperti di shortDescription, articleBody, quotes, dan reply) SELALU di-escape dengan backslash (\\\") atau gunakan tanda kutip tunggal ('...'). Dilarang keras menghasilkan unescaped quotes!`;

function parseResilientEditorialJSON(rawContent) {
    if (!rawContent) return null;

    // 1. Ekstraksi blok ```json ... ``` jika ada
    let jsonStr = rawContent.trim();
    const codeBlockMatch = rawContent.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
    if (codeBlockMatch) {
        jsonStr = codeBlockMatch[1].trim();
    } else {
        const firstBrace = jsonStr.indexOf('{');
        const lastBrace = jsonStr.lastIndexOf('}');
        if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
            jsonStr = jsonStr.substring(firstBrace, lastBrace + 1);
        }
    }

    // Attempt 1: Direct JSON.parse
    try {
        return JSON.parse(jsonStr);
    } catch (e1) {}

    // Attempt 2: Perbaiki trailing commas
    try {
        const noTrailing = jsonStr.replace(/,\s*([}\]])/g, '$1');
        return JSON.parse(noTrailing);
    } catch (e2) {}

    // Attempt 3: Sanitasi unescaped double quotes di dalam value baris per baris
    try {
        const lines = jsonStr.split('\n');
        const fixedLines = lines.map(line => {
            const m = line.match(/^(\s*"[^"]+"\s*:\s*")(.*)(",?\s*)$/);
            if (m) {
                let val = m[2].replace(/(?<!\\)"/g, "'");
                return m[1] + val + m[3];
            }
            return line;
        });
        const repaired = fixedLines.join('\n').replace(/,\s*([}\]])/g, '$1');
        return JSON.parse(repaired);
    } catch (e3) {}

    // Attempt 4: RegEx Fallback Extractor
    try {
        const fallback = {
            reply: "",
            stage: "10_final",
            stepNumber: 10,
            draft: {},
            titleOptions: [],
            readyToPublish: false
        };

        const stageMatch = jsonStr.match(/"stage"\s*:\s*"([^"]+)"/);
        if (stageMatch) fallback.stage = stageMatch[1];

        const stepMatch = jsonStr.match(/"stepNumber"\s*:\s*(\d+)/);
        if (stepMatch) fallback.stepNumber = parseInt(stepMatch[1], 10);

        const replyMatch = jsonStr.match(/"reply"\s*:\s*"([\s\S]*?)(?="\s*,\s*"stage"|"\s*,\s*"stepNumber"|"\s*,\s*"draft")/);
        if (replyMatch) fallback.reply = replyMatch[1].replace(/\\n/g, '\n').replace(/\\"/g, '"');

        const titleMatch = jsonStr.match(/"selectedTitle"\s*:\s*"([^"\\]*(?:\\.[^"\\]*)*)"/);
        if (titleMatch) fallback.draft.selectedTitle = titleMatch[1].replace(/\\"/g, '"');

        const descMatch = jsonStr.match(/"shortDescription"\s*:\s*"([\s\S]*?)"\s*,\s*"articleBody"/);
        if (descMatch) fallback.draft.shortDescription = descMatch[1].replace(/\\"/g, '"');

        const bodyMatch = jsonStr.match(/"articleBody"\s*:\s*"([\s\S]*?)"\s*}/);
        if (bodyMatch) fallback.draft.articleBody = bodyMatch[1].replace(/\\n/g, '\n').replace(/\\"/g, '"');

        const eventMatch = jsonStr.match(/"eventName"\s*:\s*"([^"\\]*(?:\\.[^"\\]*)*)"/);
        if (eventMatch) fallback.draft.eventName = eventMatch[1];

        const catMatch = jsonStr.match(/"category"\s*:\s*"([^"\\]*(?:\\.[^"\\]*)*)"/);
        if (catMatch) fallback.draft.category = catMatch[1];

        const dateMatch = jsonStr.match(/"date"\s*:\s*"([^"\\]*(?:\\.[^"\\]*)*)"/);
        if (dateMatch) fallback.draft.date = dateMatch[1];

        const locMatch = jsonStr.match(/"location"\s*:\s*"([^"\\]*(?:\\.[^"\\]*)*)"/);
        if (locMatch) fallback.draft.location = locMatch[1];

        const orgMatch = jsonStr.match(/"organizer"\s*:\s*"([^"\\]*(?:\\.[^"\\]*)*)"/);
        if (orgMatch) fallback.draft.organizer = orgMatch[1];

        const purpMatch = jsonStr.match(/"purpose"\s*:\s*"([^"\\]*(?:\\.[^"\\]*)*)"/);
        if (purpMatch) fallback.draft.purpose = purpMatch[1];

        const titleOptMatch = jsonStr.match(/"titleOptions"\s*:\s*\[([\s\S]*?)\]/);
        if (titleOptMatch) {
            const titles = [];
            const tRegex = /"([^"\\]*(?:\\.[^"\\]*)*)"/g;
            let tm;
            while ((tm = tRegex.exec(titleOptMatch[1])) !== null) {
                titles.push(tm[1].replace(/\\"/g, '"'));
            }
            fallback.titleOptions = titles;
        }

        if (fallback.draft.selectedTitle || fallback.draft.articleBody || fallback.reply) {
            return fallback;
        }
    } catch (e4) {}

    return null;
}

app.post('/api/ai/editorial', async (req, res) => {
    try {
        const apiKey = process.env.APIKEY_9ROUTER;
        let baseUrl = process.env.BASEURL_9ROUTER || 'http://43.134.43.146:20128/v1/chat/completions';
        const model = process.env.MODELSCOMBOS_9ROUTER || 'bemfkgumi-combos';

        if (!apiKey) {
            return res.status(500).json({
                success: false,
                message: "Konfigurasi layanan AI (API Key) belum tersedia di server. Hubungi administrator."
            });
        }

        // Normalisasi URL
        let targetUrl = baseUrl.trim();
        if (targetUrl.includes('/v1chat/completions')) {
            targetUrl = targetUrl.replace('/v1chat/completions', '/v1/chat/completions');
        } else if (!targetUrl.includes('/v1/chat/completions')) {
            targetUrl = targetUrl.replace(/\/+$/, '') + '/v1/chat/completions';
        }

        const { 
            messages = [], 
            draft = {}, 
            message = '', 
            conversation_history = [], 
            current_stage = '01_informasi', 
            collected_facts = {} 
        } = req.body;

        // Susun payload percakapan
        const payloadMessages = [
            { role: 'system', content: AI_EDITORIAL_SYSTEM_PROMPT }
        ];

        // Sisipkan draft konteks fakta jika sudah ada
        const activeDraft = { ...(draft || {}), ...(collected_facts || {}) };
        if (activeDraft && Object.keys(activeDraft).length > 0) {
            payloadMessages.push({
                role: 'system',
                content: `KONTEKS DRAFT FAKTA SAAT INI (Tahapan Redaksi: ${current_stage}):\n${JSON.stringify(activeDraft, null, 2)}\n\nLanjutkan berdasarkan fakta di atas. Perbarui field draft yang sesuai dengan informasi baru dari pengguna.`
            });
        }

        // Masukkan riwayat pesan
        const historyList = (messages && messages.length > 0) ? messages : (conversation_history || []);
        historyList.forEach(m => {
            if (m.role && m.content) {
                payloadMessages.push({ role: m.role, content: m.content });
            }
        });

        // Masukkan user message jika belum ada di history
        if (message && (!historyList.length || historyList[historyList.length - 1].content !== message)) {
            payloadMessages.push({ role: 'user', content: message });
        }

        // Pastikan setidaknya ada 1 user message
        if (!payloadMessages.some(m => m.role === 'user')) {
            payloadMessages.push({ role: 'user', content: "Halo, saya ingin meliput kegiatan BEM FKG UMI." });
        }

        // Request ke 9Router dengan abort controller timeout (60 detik)
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 60000);

        const response = await fetch(targetUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: model,
                messages: payloadMessages,
                stream: false,
                temperature: 0.7
            }),
            signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
            const errText = await response.text();
            console.error("9Router AI Error:", response.status, errText);
            return res.status(502).json({
                success: false,
                message: "Asisten AI sedang sibuk atau tidak dapat dihubungi. Silakan coba kembali."
            });
        }

        const data = await response.json();
        const rawContent = data.choices?.[0]?.message?.content || "";

        // Parse JSON dari output model secara tangguh
        let parsed = parseResilientEditorialJSON(rawContent);

        if (!parsed) {
            // Fallback jika model menjawab dalam format teks biasa
            parsed = {
                reply: rawContent,
                stage: current_stage || "01_informasi",
                stepNumber: 1,
                draft: activeDraft || {},
                titleOptions: [],
                readyToPublish: false
            };
        }

        // Bersihkan teks pesan agar TIDAK PERNAH memuat blok ```json mentah ke pengguna
        let assistantMessage = parsed.reply || "";
        if (!assistantMessage || assistantMessage.includes("```json")) {
            if (rawContent.includes("```json")) {
                const textBeforeCode = rawContent.split("```json")[0].trim();
                if (textBeforeCode && textBeforeCode.length > 10) {
                    assistantMessage = textBeforeCode;
                } else if (parsed.draft && (parsed.draft.articleBody || parsed.draft.selectedTitle)) {
                    assistantMessage = `## ✅ Naskah Berita Siap Publikasi\n\n**Judul:** ${parsed.draft.selectedTitle || "Naskah Berita"}\n\n${parsed.draft.shortDescription ? `*${parsed.draft.shortDescription}*\n\n---\n\n` : ""}${parsed.draft.articleBody || ""}`;
                }
            } else {
                assistantMessage = rawContent;
            }
        }
        // Hapus segala sisa blok ```json dari pesan chat
        assistantMessage = assistantMessage.replace(/```(?:json)?[\s\S]*?```/gi, '').trim();
        if (!assistantMessage && parsed.draft && (parsed.draft.articleBody || parsed.draft.selectedTitle)) {
            assistantMessage = `## ✅ Naskah Berita Siap Publikasi\n\nNaskah artikel telah selesai disusun dan terverifikasi sesuai kode etik jurnalistik. Silakan periksa pratinjau di panel samping atau klik **"Masukkan ke Form Tambah Artikel"** untuk mempublikasikannya.`;
        }

        // Tentukan tahap & stepNumber (1..10)
        const stage = parsed.stage || current_stage || "01_informasi";
        let stepNumber = parsed.stepNumber;
        if (!stepNumber) {
            const s = String(stage).toLowerCase();
            if (s.includes('10') || s.includes('final')) stepNumber = 10;
            else if (s.includes('9') || s.includes('review') || s.includes('editorial_check') || s.includes('qc')) stepNumber = 9;
            else if (s.includes('8') || s.includes('artikel')) stepNumber = 8;
            else if (s.includes('7') || s.includes('deskripsi') || s.includes('meta')) stepNumber = 7;
            else if (s.includes('6') || s.includes('judul') || s.includes('title')) stepNumber = 6;
            else if (s.includes('5') || s.includes('substansi') || s.includes('manfaat') || s.includes('tujuan')) stepNumber = 5;
            else if (s.includes('4') || s.includes('rangkaian') || s.includes('acara')) stepNumber = 4;
            else if (s.includes('3') || s.includes('tokoh') || s.includes('pejabat')) stepNumber = 3;
            else if (s.includes('2') || s.includes('waktu') || s.includes('lokasi')) stepNumber = 2;
            else stepNumber = 1;
        }

        // Gabungkan seluruh fakta dengan pemetaan 5W+1H komprehensif
        const facts = { ...(activeDraft || {}), ...(parsed.draft || {}) };

        // 1. WHAT (Nama Kegiatan / Tema)
        const mappedWhat = facts.eventName || facts.theme || facts.what || facts.event || facts.namaKegiatan || activeDraft.what || "";

        // 2. WHO (Penyelenggara / Tokoh / Hadir)
        let mappedWho = facts.organizer || activeDraft.who || "";
        if (Array.isArray(facts.attendees) && facts.attendees.length > 0) {
            const attendeesStr = facts.attendees.slice(0, 2).join(', ') + (facts.attendees.length > 2 ? ' dll' : '');
            mappedWho = mappedWho ? `${mappedWho} (${attendeesStr})` : attendeesStr;
        } else if (facts.who) {
            mappedWho = facts.who;
        }

        // 3. WHEN (Hari, Tanggal, Jam)
        const whenParts = [facts.date, facts.time].filter(Boolean);
        const mappedWhen = whenParts.length > 0 ? whenParts.join(' • ') : (facts.when || facts.eventDate || activeDraft.when || "");

        // 4. WHERE (Lokasi, Kota, Provinsi)
        const whereParts = [facts.location, facts.city, facts.province].filter(Boolean);
        const mappedWhere = whereParts.length > 0 ? whereParts.join(', ') : (facts.where || activeDraft.where || "");

        // 5. WHY (Tujuan / Latar Belakang)
        const mappedWhy = facts.purpose || facts.why || facts.objective || facts.tujuan || activeDraft.why || "";

        // 6. HOW (Rangkaian Acara / Penerima Manfaat)
        let mappedHow = activeDraft.how || "";
        if (Array.isArray(facts.eventSequence) && facts.eventSequence.length > 0) {
            mappedHow = facts.eventSequence.slice(0, 3).join(' ➔ ') + (facts.eventSequence.length > 3 ? '...' : '');
        } else if (facts.beneficiaries) {
            mappedHow = facts.beneficiaries;
        } else if (facts.how) {
            mappedHow = facts.how;
        }

        // 7. KUTIPAN (Pernyataan Tokoh / Narasumber)
        let mappedQuote = activeDraft.quote || "";
        if (Array.isArray(facts.quotes) && facts.quotes.length > 0) {
            mappedQuote = facts.quotes.join('; ');
        } else if (facts.quotes) {
            mappedQuote = String(facts.quotes);
        } else if (facts.quote) {
            mappedQuote = facts.quote;
        }

        const collectedFacts = {
            what: mappedWhat,
            who: mappedWho,
            when: mappedWhen,
            where: mappedWhere,
            why: mappedWhy,
            how: mappedHow,
            quote: mappedQuote
        };

        const titleOptions = parsed.titleOptions || parsed.options || [];

        // Build article draft jika ada judul / naskah
        let articleDraft = null;
        const selectedTitle = facts.selectedTitle || (parsed.draft && parsed.draft.selectedTitle) || (titleOptions.length === 1 ? titleOptions[0] : "");
        const articleBody = facts.articleBody || (parsed.draft && parsed.draft.articleBody) || "";
        const shortDescription = facts.shortDescription || (parsed.draft && parsed.draft.shortDescription) || "";
        const category = facts.category || (parsed.draft && parsed.draft.category) || "Pengabdian Masyarakat";
        const dateRelease = facts.date ? facts.date.split(',').pop().trim() : (facts.eventDate || new Date().toISOString().split('T')[0]);

        if (selectedTitle || articleBody || shortDescription) {
            articleDraft = {
                judul: selectedTitle || (facts.eventName ? `BEM FKG UMI Gelar ${facts.eventName}` : ""),
                kategori: category,
                slug: selectedTitle ? selectedTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '') : "",
                penulis: "Humas BEM FKG UMI",
                meta_desc: shortDescription,
                konten_bersih: articleBody,
                tgl_rilis: dateRelease
            };
        }

        res.status(200).json({
            success: true,
            stage: stage,
            stepNumber: stepNumber,
            assistant_message: assistantMessage,
            collected_facts: collectedFacts,
            options: titleOptions,
            article_draft: articleDraft,
            is_complete: parsed.readyToPublish || (stepNumber === 10),
            data: parsed
        });
    } catch (e) {
        console.error("Kesalahan API Editorial:", e);
        if (e.name === 'AbortError') {
            return res.status(504).json({
                success: false,
                message: "Permintaan AI membutuhkan waktu terlalu lama. Silakan coba kembali."
            });
        }
        res.status(500).json({
            success: false,
            message: "Gagal memproses permintaan editorial dengan AI."
        });
    }
});

// ============================================================================
// MANAJEMEN RIWAYAT SESI AI ASISTEN BERITA (REDIS PERSISTENCE)
// ============================================================================
app.get('/api/ai/editorial/sessions', async (req, res) => {
    try {
        if (!redis) throw new Error("Redis Offline");
        const keys = await redis.keys('BEM_AI_Sessions:*');
        let sessions = [];
        if (keys && keys.length > 0) {
            const rawSessions = await redis.mget(...keys);
            rawSessions.forEach(str => {
                if (str) {
                    try {
                        const parsed = typeof str === 'string' ? JSON.parse(str) : str;
                        sessions.push(parsed);
                    } catch (pe) {}
                }
            });
        }
        sessions.sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0));
        res.status(200).json({ success: true, sessions: sessions, data: sessions });
    } catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
});

app.post('/api/ai/editorial/sessions', async (req, res) => {
    try {
        if (!redis) throw new Error("Redis Offline");
        const session = req.body;
        if (!session.id) session.id = `AISES-${Date.now()}`;
        session.updatedAt = new Date().toISOString();

        const redisKey = `BEM_AI_Sessions:${session.id}`;
        await redis.set(redisKey, JSON.stringify(session));

        res.status(200).json({ success: true, message: "Sesi disimpan ke Riwayat Cloud", data: session });
    } catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
});

app.delete('/api/ai/editorial/sessions/:id', async (req, res) => {
    try {
        if (!redis) throw new Error("Redis Offline");
        await redis.del(`BEM_AI_Sessions:${req.params.id}`);
        res.status(200).json({ success: true, message: "Sesi berhasil dihapus dari Riwayat" });
    } catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
});

app.delete('/api/ai/editorial/sessions', async (req, res) => {
    try {
        if (!redis) throw new Error("Redis Offline");
        const keys = await redis.keys('BEM_AI_Sessions:*');
        if (keys && keys.length > 0) {
            await redis.del(...keys);
        }
        res.status(200).json({ success: true, message: "Seluruh riwayat sesi dibersihkan" });
    } catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
});

// SUPER UPGRADE: GLOBAL ERROR HANDLER
app.use((err, req, res, next) => {
    console.error("🔥 Server Error Intercepted:", err.stack);
    res.status(500).json({ success: false, message: "Terjadi kesalahan internal server." });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server BEM KBMFKG UMI berjalan di port ${PORT}`));

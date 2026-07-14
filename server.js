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
    console.log("✅ Sistem Database Upstash Redis Berhasil Terkoneksi.");
} catch (error) {
    console.error("⚠️ Peringatan: Redis gagal inisiasi. Backend berjalan di Mode Offline.", error.message);
}

// ================= DATA SEED (STRUKTUR BEM KBMFKG UMI LENGKAP) =================
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

// ================= BIG UPGRADE: DUMMY DEPT INFOCOM =================
const defaultProker = [
    {
        id: "pubmed",
        dept: "DEPT. INFOCOM",
        bgImage: "/img/bemfkgumi.png",
        shortDesc: "PubMed (PublikasiMedia Elektronik & Media Cetak) BukuKBMFKG-UMI",
        lokasi: "RK 01",
        targetPelaksanaan: "Triwulan I",
        koordinator: "Silvyananda",
        penanggungJawab: "Silvy Ananda, Muh. Syauqi Zahran. B, Daegal Fauza Iryanto, Zahwa Alzahra Djohan, Zaneta Zahra Zulaikha, Novita Widyantari",
        deskripsiLengkap: [
            "Menginformasikan setiap agenda kegiatan yang akan dilaksanakan oleh lembaga KBMFKG-UMI. Mendokumentasi serta menginformasikan kegiatan internal maupun eksternal yang sedang atau telah berlangsung.",
            "Menyosialisasikan informasi tentang kesehatan khususnya kesehatan gigi dan mulut melalui media cetak dan media sosial."
        ]
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
    { category: "FullStack Development", members: [ { nama: "drg. M. Aksa Arsyad, S.KG", foto: "/img/bemfkgumi.png", ig: "https://www.instagram.com/axaaxyz_01" } ] },
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
    { tahun: "2021", kabinet: "Kabinet X", logo: "/img/bemfkgumi.png", ketua: "drg. Fahri Muhammad", wakil: "drg. Ayu Lestari" },
    { tahun: "2020", kabinet: "Kabinet X", logo: "/img/bemfkgumi.png", ketua: "drg. Muhammad Ajis", wakil: "drg. Andriani T" },
    { tahun: "2018-2019", kabinet: "Kabinet X", logo: "/img/bemfkgumi.png", ketua: "drg. Muh. Sulaihi Ramadhan", wakil: "drg. Sri Devi" },
    { tahun: "2017-2018", kabinet: "Kabinet X", logo: "/img/bemfkgumi.png", ketua: "drg. Faisal Ramadhan", wakil: "drg, Satria Nur Fathanah" },
    { tahun: "2016-2017", kabinet: "Kabinet X", logo: "/img/bemfkgumi.png", ketua: "drg. Zulfahmi Duwila", wakil: "drg. Abd. Rahman Abdal Basri Makassau" },
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
        { warna: "Merah", hex: "#ef4444", makna: "Melambangkan keadilan, keberanian, dan tanggung jawab." },
        { warna: "Hitam", hex: "#111827", makna: "Melambangkan kejujuran dan keilmuan." }
    ]
};

const defaultKontak = {
    alamat: "Jl. Pajonga Dg. Ngalle No. 27 A, Pa'batong, Kec. Mamajang, Kota Makassar, Sulawesi Selatan",
    email: "admin@bemkbmfkgumi.com",
    wa: "+62 813-4879-1099",
    waName: "Silvyananda",
    mapsIframe: '<iframe src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d2034501.8037647426!2d117.10876464843753!3d-5.162069646776987!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x2dbf1d606370a527%3A0xdb175c222d9d580b!2sUniversitas%20Muslim%20Indonesia%2C%20Fakultas%20Kedokteran%20Gigi!5e0!3m2!1sid!2sid!4v1783856471813!5m2!1sid!2sid" width="100%" height="100%" style="border:0;" allowfullscreen="" loading="lazy" referrerpolicy="strict-origin-when-cross-origin"></iframe>'
};

// ================= BIG UPGRADE: STRUKTUR DATA KALENDER DENGAN SLUG =================
const defaultKalender = [
    {
        id: "umi-amal-senyuman-uas-vol-iv", // Disinkronkan dengan slug
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

// ================= ROUTES FRONTEND =================
app.get('/favicon.ico', (req, res) => res.sendFile(path.join(__dirname, 'public/img/bemfkgumi.png')));
app.get('/favicon.png', (req, res) => res.sendFile(path.join(__dirname, 'public/img/bemfkgumi.png')));

app.get('/', (req, res) => res.render('index'));
app.get('/tentang', (req, res) => res.render('tentang'));
app.get('/informasi', (req, res) => res.render('informasi'));
app.get('/narahubung', (req, res) => res.render('narahubung'));
app.get('/admin', (req, res) => res.render('admin-dashboard'));
app.get('/ourteam', (req, res) => res.render('ourteam'));

// ================= BIG UPGRADE: RUTE DYNAMIC SEO URL PROKER DESKRIPSI (DEPARTEMEN) & KEGIATAN =================
// Rute untuk menangani Klik UI Card Departemen
app.get('/proker-deskripsi', (req, res) => res.render('proker-deskripsi'));
app.get('/proker-deskripsi/:slug', (req, res) => {
    res.render('proker-deskripsi'); 
});

// Rute untuk detail spesifik suatu kegiatan (dari Kalender/Timeline)
app.get('/proker-detail', (req, res) => {
    if (req.query.id) {
        return res.redirect(301, `/proker-detail/${req.query.id}`);
    }
    res.render('proker-detail'); 
});

app.get('/proker-detail/:slug', (req, res) => {
    res.render('proker-detail'); 
});

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

// ================= API ENDPOINTS: MANAJEMEN KONTEN (CMS) =================
app.get('/api/content', async (req, res) => {
    try {
        if(!redis) throw new Error("Redis Offline");
        let org = await redis.get('Org_Structure');
        let proker = await redis.get('Proker_Data');
        let kalender = await redis.get('Kalender_Data');
        let dokumentasi = await redis.get('Dokumentasi_Data');
        let settings = await redis.get('Settings_Data');
        let team = await redis.get('Team_Data');
        let sejarah = await redis.get('Sejarah_Data');
        let filosofi = await redis.get('Filosofi_Data'); 
        let kontak = await redis.get('Kontak_Data');

        let parsedOrg = safeParse(org, defaultOrg);
        
        if (!parsedOrg.misi || !Array.isArray(parsedOrg.misi) || parsedOrg.misi.length === 0) {
            parsedOrg.misi = defaultOrg.misi;
        }
        if (!parsedOrg.artiKabinet) {
            parsedOrg.artiKabinet = defaultOrg.artiKabinet;
        }

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
            kontak: safeParse(kontak, defaultKontak)
        });
    } catch (error) {
        res.status(200).json({ success: false, org: defaultOrg, proker: defaultProker, kalender: defaultKalender, dokumentasi: [], settings: defaultSettings, team: defaultTeam, sejarah: defaultSejarah, filosofi: defaultFilosofi, kontak: defaultKontak });
    }
});

app.post('/api/content/:type', async (req, res) => {
    try {
        if(!redis) throw new Error("Redis Offline");
        const type = req.params.type;
        
        let bodyData = req.body; 
        
        // Auto-Generate & Sanitize Slug Kalender (SEO URL)
        if (type === 'kalender' && Array.isArray(bodyData)) {
            bodyData.forEach(evt => {
                let textToSlug = evt.slug && evt.slug.trim() !== '' ? evt.slug : (evt.nama || evt.id);
                let safeSlug = textToSlug.toString().toLowerCase()
                    .replace(/\s+/g, '-')
                    .replace(/[^\w\-]+/g, '')
                    .replace(/\-\-+/g, '-')
                    .replace(/^-+/, '')
                    .replace(/-+$/, '');
                
                evt.slug = safeSlug;
                evt.id = safeSlug; 
            });
        }

        const payload = JSON.stringify(bodyData); 
        
        if (type === 'org') await redis.set('Org_Structure', payload);
        else if (type === 'proker') await redis.set('Proker_Data', payload);
        else if (type === 'kalender') await redis.set('Kalender_Data', payload);
        else if (type === 'dokumentasi') await redis.set('Dokumentasi_Data', payload);
        else if (type === 'settings') await redis.set('Settings_Data', payload);
        else if (type === 'team') await redis.set('Team_Data', payload);
        else if (type === 'sejarah') await redis.set('Sejarah_Data', payload);
        else if (type === 'filosofi') await redis.set('Filosofi_Data', payload); 
        else if (type === 'kontak') await redis.set('Kontak_Data', payload);
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
        
        const parsedAspirasi = Object.values(aspirasi).map(item => safeParse(item, {}));
        const parsedPesan = Object.values(pesan).map(item => safeParse(item, {}));
        
        res.status(200).json({ success: true, aspirasi: parsedAspirasi, pesan: parsedPesan });
    } catch (error) {
        res.status(200).json({ success: false, aspirasi: [], pesan: [] });
    }
});

app.post('/api/plasma', async (req, res) => {
  try {
    const { judul, kategori, jenis, isi, bukti } = req.body;
    const id = `ASP-${Date.now()}`;
    const payload = { id: String(id), judul: String(judul), kategori: String(kategori), jenis: String(jenis), isi: String(isi), bukti: bukti || null, timestamp: new Date().toISOString() };
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

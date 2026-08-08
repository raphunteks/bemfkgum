// FILE: server.js
const express = require('express');
const { Redis } = require('@upstash/redis');
const cors = require('cors');
const path = require('path');
const xlsx = require('xlsx'); 
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
app.use(express.static(path.join(__dirname, 'public')));
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
    console.log("✅ Sistem Database Upstash Redis Berhasil Terkoneksi. (REALTIME NAMESPACE MODE)");
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

// ================= DATA SEED (STRUKTUR BEM KBMFKG UMI LENGKAP) =================
// (Bagian Data Seed Tetap Sama)
const defaultOrg = { visi: "MENJADIKAN BEM KBMFKG UMI ORGANISASI YANG PROGRESIF...", misi: ["MENAMPUNG ASPIRASI..."], artiKabinet: {}, pimpinan: [], departemen: [] };
const defaultProker = [];
const defaultSettings = { headerText: "BEM KBMFKG UMI", footerSlogan: "Kabinet Ananta Anardhaya", footerAlamat: "Makassar", logo1: "/img/logoumi.png", logo2: "/img/logofkgumi.png", logo3: "/img/bemfkgumi.png" };
const defaultTeam = [];
const defaultSejarah = [];
const defaultFilosofi = { logo: [], warna: [] };
const defaultKontak = {};
const defaultRadar = [];
const defaultKalender = [];
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
app.get('/proker-deskripsi', (req, res) => res.render('proker-deskripsi'));
app.get('/proker-deskripsi/:slug', (req, res) => res.render('proker-deskripsi'));
app.get('/proker-detail', (req, res) => req.query.id ? res.redirect(301, `/proker-detail/${req.query.id}`) : res.render('proker-detail'));
app.get('/proker-detail/:slug', (req, res) => res.render('proker-detail'));
app.get('/admin-v2', (req, res) => res.render('admin-dashboardV2'));
app.get('/form/:slug', (req, res) => res.render('bem-form', { slug: req.params.slug }));

// ============================================================================
// SUPER BIG UPGRADE: API SYSTEM UPLOAD FILE (REALTIME & FOLDER STRUCTURE UI)
// Sekarang muncul di Upstash Data Browser sebagai folder `BEM_Files` -> `[timestamp]-namafile`
// ============================================================================

app.post('/api/upload', async (req, res) => {
    try {
        if(!redis) throw new Error("Redis Offline");
        const { filename, base64 } = req.body;
        
        if(!filename || !base64) return res.status(400).json({ success: false, message: "File kosong atau tidak valid." });
        
        const sizeInBytes = Buffer.byteLength(base64, 'utf8');
        if (sizeInBytes > 1048000) console.warn(`⚠️ Peringatan Kapasitas: File melebihi batas 1MB.`);

        let safeName = filename.toLowerCase().replace(/[^a-z0-9.]+/g, '-').replace(/(^-|-$)+/g, '');
        const uniqueFilename = `${Date.now()}-${safeName}`;
        
        // UPGRADE NAMESPACE KEY: Menggunakan ":" untuk membuat struktur Folder di Upstash UI!
        const redisKey = `BEM_Files:${uniqueFilename}`;
        
        await redis.set(redisKey, JSON.stringify({ filename: safeName, data: base64 }));
        
        console.log(`🟢 [REALTIME] File Baru Tersimpan di Upstash: ${redisKey}`);

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
        
        // Panggil langsung menggunakan struktur namespace folder
        const redisKey = `BEM_Files:${req.params.filename}`;
        const fileDataStr = await redis.get(redisKey);
        
        if(!fileDataStr) return res.status(404).send("File tidak ditemukan.");
        
        const fileObj = safeParse(fileDataStr, null);
        if(!fileObj || !fileObj.data) return res.status(400).send("Data file korup.");
        
        const parts = fileObj.data.split(',');
        if (parts.length !== 2) return res.status(400).send("Format Base64 tidak valid.");
        
        let mimeType = 'application/octet-stream';
        const headerMatch = parts[0].match(/^data:(.*?);base64/);
        if (headerMatch && headerMatch[1]) mimeType = headerMatch[1];

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
// API ENDPOINTS BEM-FORM (CRUD & SUBMIT DENGAN UPSTASH FOLDER STRUCTURE)
// ============================================================================

app.get('/api/forms', async (req, res) => {
    try {
        if(!redis) throw new Error("Redis Offline");
        
        // UPGRADE: Fetch multiple keys menggunakan pattern matching (Folder BEM_Forms)
        const keys = await redis.keys('BEM_Forms:*');
        let forms = [];
        
        if(keys.length > 0) {
            const rawForms = await redis.mget(...keys);
            forms = rawForms.map(item => typeof item === 'string' ? JSON.parse(item) : item);
        }
        
        res.status(200).json({ success: true, data: forms });
    } catch (e) { res.status(500).json({ success: false }); }
});

app.get('/api/forms/:slug', async (req, res) => {
    try {
        if(!redis) throw new Error("Redis Offline");
        const keys = await redis.keys('BEM_Forms:*');
        let form = null;
        
        if(keys.length > 0) {
            const rawForms = await redis.mget(...keys);
            const forms = rawForms.map(item => typeof item === 'string' ? JSON.parse(item) : item);
            form = forms.find(f => f.slug === req.params.slug);
        }
        
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
                if(!sec.stepName || sec.stepName.trim() === '') sec.stepName = `Tahap ${idx + 1}`;
            });
        }

        if (!formData.settings) formData.settings = {};
        const defaultFormSettings = {
            collectEmail: 'none', limitOne: false, editResponse: false, confirmationMessage: 'Jawaban Anda telah dicatat.', deadline: '',
            isQuiz: false, quizRelease: 'immediate', quizShowMissed: true, quizShowCorrect: true, quizShowPoints: true, quizDefaultPoints: 0,
            sendCopy: 'none', showProgress: false, shuffleQuestions: false, showSubmitAnother: true, showSummary: false, disableAutoSave: false, defaultRequired: false
        };
        formData.settings = { ...defaultFormSettings, ...formData.settings };

        if(!formData.theme) formData.theme = {};
        const defaultTheme = {
            headerFont: 'Outfit', headerFontSize: 28, headerFontWeight: 700, questionFont: 'Plus Jakarta Sans', questionFontSize: 14, questionFontWeight: 600,
            textFont: 'Plus Jakarta Sans', textFontSize: 12, textFontWeight: 400, color: '#8b5cf6', bgColor: '#f5f3ff', headerImage: ''
        };
        formData.theme = { ...defaultTheme, ...formData.theme };
        
        // Simpan langsung sebagai Kunci Spesifik (BEM_Forms:FRM-123)
        const redisKey = `BEM_Forms:${formData.id}`;
        await redis.set(redisKey, JSON.stringify(formData));
        
        console.log(`🟢 [REALTIME] Form Tersimpan/Diperbarui: ${redisKey}`);
        res.status(200).json({ success: true, message: "Form berhasil disimpan", id: formData.id });
    } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

app.delete('/api/forms/:id', async (req, res) => {
    try {
        if(!redis) throw new Error("Redis Offline");
        const formId = req.params.id;
        
        // Hapus Form
        await redis.del(`BEM_Forms:${formId}`);
        
        // Hapus Seluruh Respons yang terkait (BEM_Responses:FRM-123:*)
        const resKeys = await redis.keys(`BEM_Responses:${formId}:*`);
        if(resKeys.length > 0) {
            await redis.del(...resKeys);
        }
        
        console.log(`🔴 [REALTIME] Form dan Respons Terhapus untuk ID: ${formId}`);
        res.status(200).json({ success: true, message: "Form dan respons berhasil dihapus permanen." });
    } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// Submit Jawaban Form (Publik)
app.post('/api/forms/submit', async (req, res) => {
    try {
        if(!redis) throw new Error("Redis Offline");
        const { formId, responses, email } = req.body;
        const resId = `RES-${Date.now()}`;
        
        const formStr = await redis.get(`BEM_Forms:${formId}`);
        const formObj = safeParse(formStr, null);

        if (!formObj) return res.status(404).json({ success: false, message: "Formulir tidak valid atau telah dihapus." });

        if (formObj.isActive === false) return res.status(403).json({ success: false, message: "Formulir ditutup." });
        if (formObj.settings && formObj.settings.deadline && (new Date() > new Date(formObj.settings.deadline))) {
            return res.status(403).json({ success: false, message: "Batas waktu telah berlalu." });
        }

        // Limit One Check via Scanning (Karena sudah dipisah per Kunci)
        if (formObj.settings && formObj.settings.limitOne && email) {
            const keys = await redis.keys(`BEM_Responses:${formId}:*`);
            if(keys.length > 0) {
                const rawData = await redis.mget(...keys);
                const hasAnswered = rawData.some(r => {
                    let parsed = typeof r === 'string' ? JSON.parse(r) : r;
                    return parsed && parsed.email === email;
                });
                if (hasAnswered) return res.status(403).json({ success: false, message: "Email ini sudah digunakan." });
            }
        }

        let totalScore = 0, maxScore = 0;
        let isQuiz = formObj.settings && formObj.settings.isQuiz;

        if (isQuiz && formObj.sections) {
            formObj.sections.forEach(sec => {
                if(sec.questions) {
                    sec.questions.forEach(q => {
                        let pts = parseInt(q.points) || formObj.settings.quizDefaultPoints || 0;
                        let ans = responses[q.id];

                        if (['pilihan_ganda', 'dropdown', 'jawaban_singkat'].includes(q.type)) {
                            maxScore += pts;
                            if (q.correctAnswers && q.correctAnswers.includes(ans)) totalScore += pts;
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
            id: resId, formId: formId, email: email, timestamp: new Date().toISOString(), answers: responses,
            score: isQuiz ? totalScore : null, maxScore: isQuiz ? maxScore : null
        };
        
        // Simpan langsung ke struktur Kunci folder terpisah untuk tiap responden
        const redisKey = `BEM_Responses:${formId}:${resId}`;
        await redis.set(redisKey, JSON.stringify(payload));
        
        console.log(`🟢 [REALTIME] Jawaban Masuk: ${redisKey}`);
        res.status(200).json({ success: true, message: "Jawaban berhasil dikirim!" });
    } catch (e) { 
        console.error(e);
        res.status(500).json({ success: false, message: "Terjadi kesalahan server internal." }); 
    }
});

// Ambil Daftar Jawaban 
app.get('/api/forms/:id/responses', async (req, res) => {
    try {
        if(!redis) throw new Error("Redis Offline");
        const formId = req.params.id;
        const keys = await redis.keys(`BEM_Responses:${formId}:*`);
        let responses = [];
        if(keys.length > 0) {
            const raw = await redis.mget(...keys);
            responses = raw.map(r => typeof r === 'string' ? JSON.parse(r) : r);
        }
        res.status(200).json({ success: true, data: responses });
    } catch (e) { res.status(500).json({ success: false }); }
});

// UPDATE & DELETE Jawaban Tertentu
app.put('/api/forms/:formId/responses/:resId', async (req, res) => {
    try {
        if(!redis) throw new Error("Redis Offline");
        const { formId, resId } = req.params;
        const { answers, email } = req.body;
        
        const redisKey = `BEM_Responses:${formId}:${resId}`;
        const existingStr = await redis.get(redisKey);
        
        if(!existingStr) return res.status(404).json({ success: false, message: "Data tidak ditemukan." });
        
        let existingObj = typeof existingStr === 'string' ? JSON.parse(existingStr) : existingStr;
        if(email !== undefined) existingObj.email = email;
        if(answers !== undefined) existingObj.answers = answers;

        await redis.set(redisKey, JSON.stringify(existingObj));
        res.status(200).json({ success: true, message: "Jawaban diperbarui." });
    } catch(e) { res.status(500).json({ success: false, message: "Gagal memperbarui jawaban." }); }
});

app.delete('/api/forms/:formId/responses/:resId', async (req, res) => {
    try {
        if(!redis) throw new Error("Redis Offline");
        const { formId, resId } = req.params;
        await redis.del(`BEM_Responses:${formId}:${resId}`);
        res.status(200).json({ success: true, message: "Jawaban dihapus." });
    } catch(e) { res.status(500).json({ success: false, message: "Gagal menghapus jawaban." }); }
});

// EXPORT KE EXCEL (.XLSX) 
app.get('/api/forms/:id/export', async (req, res) => {
    try {
        if(!redis) throw new Error("Redis Offline");
        const formId = req.params.id;
        
        const formStr = await redis.get(`BEM_Forms:${formId}`);
        if(!formStr) return res.status(404).send("Form tidak ditemukan");
        const form = typeof formStr === 'string' ? JSON.parse(formStr) : formStr;

        const keys = await redis.keys(`BEM_Responses:${formId}:*`);
        let responses = [];
        if(keys.length > 0) {
            const raw = await redis.mget(...keys);
            responses = raw.map(r => typeof r === 'string' ? JSON.parse(r) : r);
        }

        const excelData = responses.map((resp, index) => {
            let row = { "No": index + 1, "Timestamp (Waktu)": new Date(resp.timestamp).toLocaleString('id-ID'), "Email Responden": resp.email || "-" };
            if (form.settings && form.settings.isQuiz) row["Skor Total"] = `${resp.score !== null ? resp.score : 0} / ${resp.maxScore || 0}`;

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
    } catch (e) { res.status(500).send("Gagal menggenerate File Excel Server."); }
});

// ================= API CMS ENDPOINTS (CMS V1 - NAMESPACE FOLDER) =================
app.get('/api/content', async (req, res) => {
    try {
        if(!redis) throw new Error("Redis Offline");
        // Gunakan Prefix BEM_CMS: agar rapi di UI Upstash
        let org = await redis.get('BEM_CMS:Org_Structure');
        let proker = await redis.get('BEM_CMS:Proker_Data');
        let kalender = await redis.get('BEM_CMS:Kalender_Data');
        let dokumentasi = await redis.get('BEM_CMS:Dokumentasi_Data');
        let settings = await redis.get('BEM_CMS:Settings_Data');
        let team = await redis.get('BEM_CMS:Team_Data');
        let sejarah = await redis.get('BEM_CMS:Sejarah_Data');
        let filosofi = await redis.get('BEM_CMS:Filosofi_Data'); 
        let kontak = await redis.get('BEM_CMS:Kontak_Data');
        let radar = await redis.get('BEM_CMS:Radar_Data');

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
                let safeSlug = textToSlug.toString().toLowerCase().trim().replace(/\s+/g, '-').replace(/[^\w\-]+/g, '').replace(/\-\-+/g, '-').replace(/^-+/, '').replace(/-+$/, '');
                item.slug = safeSlug;
                item.id = safeSlug; 
            });
        }

        const payload = JSON.stringify(bodyData); 
        
        // Simpan dalam format Kunci Terstruktur (Folder BEM_CMS)
        const dbMapping = {
            'org': 'Org_Structure', 'proker': 'Proker_Data', 'kalender': 'Kalender_Data', 'dokumentasi': 'Dokumentasi_Data',
            'settings': 'Settings_Data', 'team': 'Team_Data', 'sejarah': 'Sejarah_Data', 'filosofi': 'Filosofi_Data', 
            'kontak': 'Kontak_Data', 'radar': 'Radar_Data'
        };
        
        if (dbMapping[type]) {
            const redisKey = `BEM_CMS:${dbMapping[type]}`;
            await redis.set(redisKey, payload);
            console.log(`🟢 [REALTIME] CMS Konten Diperbarui: ${redisKey}`);
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
        
        // Perhitungan Menggunakan Keys Lengkap agar Cepat (Realtime Count)
        const formKeys = await redis.keys('BEM_Forms:*');
        const totalForms = formKeys.length;
        
        const responseKeys = await redis.keys('BEM_Responses:*:*');
        const totalResponses = responseKeys.length;
        
        const aspirasiKeys = await redis.keys('BEM_Aspirations:*');
        const totalAspirasi = aspirasiKeys.length;
        
        const messageKeys = await redis.keys('BEM_Messages:*');
        const totalPesan = messageKeys.length;
        
        res.status(200).json({ success: true, data: { totalForms, totalResponses, totalAspirasi, totalPesan } });
    } catch (e) {
        res.status(500).json({ success: false, message: "Gagal mengambil statistik." });
    }
});

// ================= API ENDPOINTS: TRANSAKSIONAL =================
app.get('/api/interactions', async (req, res) => {
    try {
        if(!redis) throw new Error("Redis Offline");
        
        const aspirasiKeys = await redis.keys('BEM_Aspirations:*');
        let aspirasi = [];
        if(aspirasiKeys.length > 0) {
            const raw = await redis.mget(...aspirasiKeys);
            aspirasi = raw.map(i => typeof i === 'string' ? JSON.parse(i) : i);
        }

        const messageKeys = await redis.keys('BEM_Messages:*');
        let pesan = [];
        if(messageKeys.length > 0) {
            const raw = await redis.mget(...messageKeys);
            pesan = raw.map(i => typeof i === 'string' ? JSON.parse(i) : i);
        }
        
        res.status(200).json({ success: true, aspirasi, pesan });
    } catch (error) {
        res.status(200).json({ success: false, aspirasi: [], pesan: [] });
    }
});

app.post('/api/plasma', async (req, res) => {
  try {
    const { judul, kategori, jenis, isi, bukti } = req.body;
    const id = `ASP-${Date.now()}`;
    const payload = { id: String(id), judul: String(judul), kategori: String(kategori), jenis: String(jenis), isi: String(isi), bukti: bukti || null, timestamp: new Date().toISOString() };
    
    if (redis) {
        await redis.set(`BEM_Aspirations:${id}`, JSON.stringify(payload));
        console.log(`🟢 [REALTIME] Aspirasi Masuk: BEM_Aspirations:${id}`);
    }
    res.status(200).json({ success: true, message: 'Aspirasi berhasil dikirim!' });
  } catch (error) { res.status(500).json({ success: false }); }
});

app.post('/api/message', async (req, res) => {
  try {
    const { nama, kontak, subjek, pesan } = req.body;
    const id = `MSG-${Date.now()}`;
    const payload = { id, nama: String(nama), kontak: String(kontak), subjek: String(subjek), pesan: String(pesan), timestamp: new Date().toISOString() };
    
    if (redis) {
        await redis.set(`BEM_Messages:${id}`, JSON.stringify(payload));
        console.log(`🟢 [REALTIME] Pesan Masuk: BEM_Messages:${id}`);
    }
    res.status(200).json({ success: true, message: 'Pesan terkirim!' });
  } catch (error) { res.status(500).json({ success: false }); }
});

app.post('/api/delete-interaction', async (req, res) => {
    try {
        const { type, id } = req.body;
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

// SITEMAP.XML GENERATOR
app.get('/robots.txt', (req, res) => {
    const domain = "https://bemkbmfkgumi.com";
    res.header('Content-Type', 'text/plain');
    res.send(`User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /api/\n\nSitemap: ${domain}/sitemap.xml\n`);
});

app.get('/sitemap.xml', async (req, res) => {
    try {
        const domain = "https://bemkbmfkgumi.com";
        const formatSitemapDate = (dateStr) => { /* Helper Function */ 
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
            const rawProker = await redis.get('BEM_CMS:Proker_Data');
            const rawKalender = await redis.get('BEM_CMS:Kalender_Data');
            prokerData = safeParse(rawProker, defaultProker);
            kalenderData = safeParse(rawKalender, defaultKalender);
        }

        let xmlUrls = `
    <url><loc>${domain}/</loc><lastmod>${today}</lastmod><changefreq>daily</changefreq><priority>1.0</priority></url>
    <url><loc>${domain}/informasi</loc><lastmod>${today}</lastmod><changefreq>daily</changefreq><priority>0.9</priority></url>
    <url><loc>${domain}/tentang</loc><lastmod>${today}</lastmod><changefreq>weekly</changefreq><priority>0.9</priority></url>
    <url><loc>${domain}/berita</loc><lastmod>${today}</lastmod><changefreq>daily</changefreq><priority>0.9</priority></url>
    <url><loc>${domain}/ourteam</loc><lastmod>${today}</lastmod><changefreq>monthly</changefreq><priority>0.8</priority></url>
    <url><loc>${domain}/narahubung</loc><lastmod>${today}</lastmod><changefreq>monthly</changefreq><priority>0.6</priority></url>
    <url><loc>${domain}/proker-deskripsi</loc><lastmod>${today}</lastmod><changefreq>weekly</changefreq><priority>0.7</priority></url>
    <url><loc>${domain}/proker-detail</loc><lastmod>${today}</lastmod><changefreq>daily</changefreq><priority>0.7</priority></url>`;

        if (Array.isArray(prokerData) && prokerData.length > 0) {
            prokerData.forEach(p => {
                if (p.slug || p.id) {
                    xmlUrls += `\n<url><loc>${domain}/proker-deskripsi/${escapeXml(p.slug || p.id)}</loc><lastmod>${formatSitemapDate(p.startDate)}</lastmod><changefreq>weekly</changefreq><priority>0.8</priority></url>`;
                }
            });
        }
        if (Array.isArray(kalenderData) && kalenderData.length > 0) {
            kalenderData.forEach(k => {
                if (k.slug || k.id) {
                    xmlUrls += `\n<url><loc>${domain}/proker-detail/${escapeXml(k.slug || k.id)}</loc><lastmod>${formatSitemapDate(k.tglMulai)}</lastmod><changefreq>daily</changefreq><priority>0.9</priority></url>`;
                }
            });
        }
        
        const sitemapXML = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${xmlUrls}
</urlset>`;

        res.header('Content-Type', 'application/xml');
        res.send(sitemapXML.trim());
    } catch (error) {
        res.status(500).send("Internal Server Error generating Sitemap");
    }
});

app.use((err, req, res, next) => {
    console.error("🔥 Server Error Intercepted:", err.stack);
    res.status(500).json({ success: false, message: "Terjadi kesalahan internal server." });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server BEM KBMFKG UMI berjalan di port ${PORT}`));

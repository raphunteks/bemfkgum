// FILE: public/js/protect-devtools.js

// ================= THEME ENGINE (LIGHT/DARK MODE SAFEGUARD) =================
// Menjalankan inisialisasi tema sebelum DOM dirender (Mencegah FOUC/Berkedip)
(function() {
    try {
        const savedTheme = localStorage.getItem('axa_theme') || localStorage.getItem('theme');
        if (savedTheme === 'dark') {
            document.documentElement.setAttribute('data-theme', 'dark');
        } else {
            document.documentElement.setAttribute('data-theme', 'light');
        }
    } catch(e) {}
})();

// Fungsi Toggle Tema (Fail-safe delegator)
function toggleTheme() {
    if (window.ThemeEngine && typeof window.ThemeEngine.toggle === 'function') {
        window.ThemeEngine.toggle();
        return;
    }
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const next = isDark ? 'light' : 'dark';
    if (next === 'dark') {
        document.documentElement.setAttribute('data-theme', 'dark');
        if (document.body) document.body.setAttribute('data-theme', 'dark');
        try {
            localStorage.setItem('axa_theme', 'dark');
            localStorage.setItem('theme', 'dark');
        } catch(e) {}
    } else {
        document.documentElement.setAttribute('data-theme', 'light');
        if (document.body) document.body.setAttribute('data-theme', 'light');
        try {
            localStorage.setItem('axa_theme', 'light');
            localStorage.setItem('theme', 'light');
        } catch(e) {}
    }
    const themeCheckbox = document.getElementById('checkboxTheme');
    if (themeCheckbox) themeCheckbox.checked = (next === 'dark');
}

// Sinkronisasi status checkbox toggle secara idempoten (Mencegah Double-Listener Bug)
document.addEventListener('DOMContentLoaded', () => {
    const themeCheckbox = document.getElementById('checkboxTheme');
    if (themeCheckbox && !themeCheckbox._themeEngineBound && !themeCheckbox._protectDevtoolsBound) {
        themeCheckbox._protectDevtoolsBound = true;
        themeCheckbox.checked = document.documentElement.getAttribute('data-theme') === 'dark';
        themeCheckbox.addEventListener('change', (e) => {
            if (window.ThemeEngine && typeof window.ThemeEngine.setTheme === 'function') {
                window.ThemeEngine.setTheme(e.target.checked ? 'dark' : 'light');
            } else {
                toggleTheme();
            }
        });
    }
});


// ============================================================================
// SUPER BIG UPGRADE: SECURITY ENGINE (MULTI-PLATFORM DEVTOOLS PROTECTOR)
// Mendukung Proteksi Penuh Lintas OS: macOS (Opt+Cmd+I, Opt+Cmd+J, dll) & Windows/Linux
// ============================================================================

(function() {
    // 1. Blokir Klik Kanan (Context Menu) di seluruh viewport
    document.addEventListener('contextmenu', function (e) {
        e.preventDefault();
        e.stopPropagation();
        return false;
    }, { capture: true, passive: false });

    // 2. Multi-Platform Keyboard Shortcut Interceptor (Capture Phase)
    function interceptDevToolsShortcuts(e) {
        if (!e) return;

        var key = (e.key || '').toUpperCase();
        var code = (e.code || '').toUpperCase();
        var keyCode = e.keyCode || e.which || 0;

        // A. F12 (Windows / Linux / Standard DevTools Key)
        if (key === 'F12' || code === 'F12' || keyCode === 123) {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            return false;
        }

        // B. macOS Shortcuts: Option (altKey) + Command (metaKey)
        // - Opt + Cmd + I: Web Inspector / Elements (Chrome, Safari, Edge di Mac)
        // - Opt + Cmd + J: JavaScript Console (Chrome, Edge di Mac)
        // - Opt + Cmd + C: Inspect Element / Element Picker (Chrome, Safari di Mac)
        // - Opt + Cmd + U: View Page Source (Safari Mac)
        // - Opt + Cmd + K: Web Console (Firefox Mac)
        // - Opt + Cmd + E: Network Tab (Firefox Mac)
        // - Opt + Cmd + S: Debugger (Firefox Mac)
        if (e.altKey && e.metaKey) {
            if (
                key === 'I' || code === 'KEYI' || keyCode === 73 ||
                key === 'J' || code === 'KEYJ' || keyCode === 74 ||
                key === 'C' || code === 'KEYC' || keyCode === 67 ||
                key === 'U' || code === 'KEYU' || keyCode === 85 ||
                key === 'K' || code === 'KEYK' || keyCode === 75 ||
                key === 'E' || code === 'KEYE' || keyCode === 69 ||
                key === 'S' || code === 'KEYS' || keyCode === 83
            ) {
                e.preventDefault();
                e.stopPropagation();
                e.stopImmediatePropagation();
                return false;
            }
        }

        // C. macOS Shortcuts: Command (metaKey) + Shift (shiftKey)
        // - Cmd + Shift + C: Inspect Element (Chrome/Safari Mac)
        // - Cmd + Shift + I: DevTools (Chrome/Safari Mac)
        // - Cmd + Shift + J: Console (Chrome Mac)
        // - Cmd + Shift + K: Web Console (Firefox Mac)
        // - Cmd + Shift + E: Network (Firefox Mac)
        // - Cmd + Shift + S: Debugger (Firefox Mac)
        if (e.metaKey && e.shiftKey) {
            if (
                key === 'C' || code === 'KEYC' || keyCode === 67 ||
                key === 'I' || code === 'KEYI' || keyCode === 73 ||
                key === 'J' || code === 'KEYJ' || keyCode === 74 ||
                key === 'K' || code === 'KEYK' || keyCode === 75 ||
                key === 'E' || code === 'KEYE' || keyCode === 69 ||
                key === 'S' || code === 'KEYS' || keyCode === 83
            ) {
                e.preventDefault();
                e.stopPropagation();
                e.stopImmediatePropagation();
                return false;
            }
        }

        // D. Windows / Linux Shortcuts: Ctrl (ctrlKey) + Shift (shiftKey)
        // - Ctrl + Shift + I: DevTools (Chrome, Edge, Firefox, Brave)
        // - Ctrl + Shift + J: Console (Chrome, Edge)
        // - Ctrl + Shift + C: Inspect Element (Chrome, Edge, Firefox)
        // - Ctrl + Shift + K: Web Console (Firefox Windows)
        // - Ctrl + Shift + E: Network (Firefox Windows)
        // - Ctrl + Shift + S: Debugger (Firefox Windows)
        if (e.ctrlKey && e.shiftKey) {
            if (
                key === 'I' || code === 'KEYI' || keyCode === 73 ||
                key === 'J' || code === 'KEYJ' || keyCode === 74 ||
                key === 'C' || code === 'KEYC' || keyCode === 67 ||
                key === 'K' || code === 'KEYK' || keyCode === 75 ||
                key === 'E' || code === 'KEYE' || keyCode === 69 ||
                key === 'S' || code === 'KEYS' || keyCode === 83
            ) {
                e.preventDefault();
                e.stopPropagation();
                e.stopImmediatePropagation();
                return false;
            }
        }

        // E. View Page Source: Ctrl + U (Windows) atau Cmd + U (macOS)
        if ((e.ctrlKey || e.metaKey) && (key === 'U' || code === 'KEYU' || keyCode === 85)) {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            return false;
        }

        // F. Save Webpage / Asset Scraping: Ctrl + S (Windows) atau Cmd + S (macOS)
        if ((e.ctrlKey || e.metaKey) && (key === 'S' || code === 'KEYS' || keyCode === 83)) {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            return false;
        }
    }

    // Pasang listener pada capture phase untuk mendahului semua event handling
    document.addEventListener('keydown', interceptDevToolsShortcuts, { capture: true, passive: false });
    document.addEventListener('keyup', interceptDevToolsShortcuts, { capture: true, passive: false });

    // 3. Cegah dragging gambar atau tautan ke tab baru untuk membongkar URL aset
    document.addEventListener('dragstart', function(e) {
        if (e.target && (e.target.nodeName === 'IMG' || e.target.nodeName === 'A')) {
            e.preventDefault();
            e.stopPropagation();
            return false;
        }
    }, { capture: true, passive: false });

    // 4. Visual Security Banner Safeguard di Web Console
    try {
        const titleStyle = 'font-size: 22px; font-weight: 900; color: #ef4444; background: #fee2e2; padding: 6px 12px; border-radius: 6px; border: 2px solid #ef4444;';
        const bodyStyle = 'font-size: 13px; font-weight: 600; color: #16a34a; line-height: 1.6;';
        console.log('%c⛔ STOP! SISTEM KEAMANAN AKTIF', titleStyle);
        console.log('%cArea ini dipantau oleh Protokol Keamanan BEM KBMFKG UMI. Segala bentuk inspeksi elemen, manipulasi kode, atau peretasan dilarang.', bodyStyle);
    } catch(e) {}
})();

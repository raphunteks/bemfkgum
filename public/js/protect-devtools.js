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


// ================= SECURITY ENGINE (PROTECT DEVTOOLS) =================
// Blokir klik kanan (context menu)
document.addEventListener('contextmenu', function (e) {
  e.preventDefault();
}, { capture: true });

// Cegah beberapa shortcut DevTools dasar
document.addEventListener('keydown', function (e) {
  // F12
  if (e.key === 'F12') {
    e.preventDefault();
    e.stopPropagation();
    return false;
  }

  // Ctrl+Shift+I / Ctrl+Shift+J / Ctrl+Shift+C
  if (e.ctrlKey && e.shiftKey) {
    var k = e.key.toUpperCase();
    if (k === 'I' || k === 'J' || k === 'C') {
      e.preventDefault();
      e.stopPropagation();
      return false;
    }
  }

  // Ctrl+U (View Source)
  if (e.ctrlKey && e.key.toUpperCase() === 'U') {
    e.preventDefault();
    e.stopPropagation();
    return false;
  }
}, { capture: true });

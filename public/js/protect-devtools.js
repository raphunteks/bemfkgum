// FILE: public/js/protect-devtools.js

// ================= THEME ENGINE (LIGHT/DARK MODE) =================
// Menjalankan inisialisasi tema sebelum DOM dirender (Mencegah FOUC/Berkedip)
(function() {
    const savedTheme = localStorage.getItem('axa_theme');
    // Jika tidak ada data tersimpan, default akan menggunakan LIGHT MODE (Putih)
    if (savedTheme === 'dark') {
        document.documentElement.setAttribute('data-theme', 'dark');
    } else {
        document.documentElement.removeAttribute('data-theme');
    }
})();

// Fungsi Toggle Tema (Dipanggil oleh Tombol Switch)
function toggleTheme() {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    if (isDark) {
        document.documentElement.removeAttribute('data-theme');
        localStorage.setItem('axa_theme', 'light');
    } else {
        document.documentElement.setAttribute('data-theme', 'dark');
        localStorage.setItem('axa_theme', 'dark');
    }
}

// Sinkronisasi status checkbox toggle saat halaman sudah selesai dimuat
document.addEventListener('DOMContentLoaded', () => {
    const themeCheckbox = document.getElementById('checkboxTheme');
    if (themeCheckbox) {
        themeCheckbox.checked = document.documentElement.getAttribute('data-theme') === 'dark';
        themeCheckbox.addEventListener('change', toggleTheme);
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

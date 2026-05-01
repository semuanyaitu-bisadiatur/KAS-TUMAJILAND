// ============================================
// 🔥 EDIT VERSI DI FILE INI SAJA!
// ============================================

const APP_VERSION = '1.1.4';  // ← GANTI INI SAJA SETIAP UPDATE

// Auto-generate cache name dari versi
const CACHE_NAME = 'kas-perumahan-' + APP_VERSION.replace(/\./g, '-');

// Export untuk digunakan file lain
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { APP_VERSION, CACHE_NAME };
}

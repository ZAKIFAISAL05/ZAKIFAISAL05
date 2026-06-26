'use strict';

// Restore theme secepat mungkin supaya tidak flash ke tema default.
(function restoreTheme() {
  try {
    const savedTheme = localStorage.getItem('gs-theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
  } catch (error) {
    document.documentElement.setAttribute('data-theme', 'light');
  }
})();

// Render ulang icon Feather setelah DOM siap.
document.addEventListener('DOMContentLoaded', function () {
  if (window.feather && typeof window.feather.replace === 'function') {
    window.feather.replace();
  }
});

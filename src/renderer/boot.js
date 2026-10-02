'use strict';

(async function () {
  const L = window.L;

  // Тема оформления графиков под тёмный интерфейс.
  if (window.Chart) {
    Chart.defaults.color = '#9aa5c7';
    Chart.defaults.font.family = 'Segoe UI, system-ui, sans-serif';
    Chart.defaults.borderColor = 'rgba(255,255,255,0.06)';
    Chart.defaults.plugins.legend.labels.color = '#e8ecf8';
  }

  // Навигация по разделам.
  document.querySelectorAll('.nav-item').forEach((btn) => {
    btn.addEventListener('click', () => L.go(btn.dataset.view));
  });

  // Закрытие модального окна.
  document.getElementById('modalClose').addEventListener('click', L.closeModal);
  document.getElementById('modalOverlay').addEventListener('click', (e) => {
    if (e.target.id === 'modalOverlay') L.closeModal();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !document.getElementById('modalOverlay').hidden) L.closeModal();
  });

  // Пункты меню приложения (Файл → Экспорт/Импорт).
  window.api.onMenu('menu:export', async () => {
    const res = await window.api.exportData();
    if (res && res.ok) L.toast('Данные сохранены в файл', 'success');
  });
  window.api.onMenu('menu:import', async () => {
    const res = await window.api.importData();
    if (res && res.ok) {
      await L.reload();
      L.toast('Данные импортированы', 'success');
      L.go('dashboard');
    } else if (res && res.error) {
      L.toast('Ошибка импорта: ' + res.error, 'error');
    }
  });

  // Старт.
  await L.reload();
  L.go('dashboard');
})();

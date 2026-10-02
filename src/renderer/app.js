'use strict';

/**
 * Ядро интерфейса LifeHub: кэш данных, роутинг между разделами,
 * вспомогательные функции (деньги, даты, DOM, модалки, уведомления).
 * Разделы регистрируют себя в L.views из своих файлов.
 */
window.L = (function () {
  const L = {
    state: null,
    views: {},
    current: 'dashboard',
    chart: null, // активный график на текущем экране (чтобы уничтожать)
    charts: [],
  };

  // ---- Палитра для меток / категорий ----
  L.palette = [
    '#6c8cff', '#8b7bff', '#35d08a', '#ff6b7a', '#ffcc5c',
    '#ff9f5a', '#46d7e0', '#ff78c4', '#9b8cff', '#5ad1a8',
  ];

  // ---- Загрузка состояния ----
  L.reload = async function () {
    L.state = await window.api.getState();
    const name = (L.state.settings && L.state.settings.appName) || 'LifeHub';
    const brand = document.getElementById('brandName');
    if (brand) brand.textContent = name;
    return L.state;
  };

  L.currency = function () {
    return (L.state && L.state.settings && L.state.settings.currency) || '₽';
  };

  // ---- Форматирование ----
  L.money = function (n) {
    const v = Number(n) || 0;
    const sign = v < 0 ? '−' : '';
    const abs = Math.abs(v);
    const str = abs.toLocaleString('ru-RU', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    });
    return sign + str + ' ' + L.currency();
  };

  L.todayStr = function () {
    return L.dateStr(new Date());
  };

  L.dateStr = function (d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return y + '-' + m + '-' + day;
  };

  L.parseDate = function (s) {
    if (!s) return null;
    const parts = String(s).slice(0, 10).split('-');
    if (parts.length !== 3) return null;
    return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
  };

  const MONTHS = [
    'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
    'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря',
  ];
  const MONTHS_NOM = [
    'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
    'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь',
  ];
  const DOW = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

  L.MONTHS_NOM = MONTHS_NOM;
  L.DOW = DOW;

  L.fmtDate = function (s) {
    const d = L.parseDate(s);
    if (!d) return '';
    return d.getDate() + ' ' + MONTHS[d.getMonth()] + ' ' + d.getFullYear();
  };

  L.fmtDateShort = function (s) {
    const d = L.parseDate(s);
    if (!d) return '';
    return d.getDate() + ' ' + MONTHS[d.getMonth()];
  };

  // Человеко-понятная разница дат ("сегодня", "завтра", "через 3 дня", "2 дня назад")
  L.relDays = function (s) {
    const d = L.parseDate(s);
    if (!d) return '';
    const today = L.parseDate(L.todayStr());
    const diff = Math.round((d - today) / 86400000);
    if (diff === 0) return 'сегодня';
    if (diff === 1) return 'завтра';
    if (diff === -1) return 'вчера';
    if (diff > 0) return 'через ' + diff + ' ' + L.plural(diff, 'день', 'дня', 'дней');
    const a = -diff;
    return a + ' ' + L.plural(a, 'день', 'дня', 'дней') + ' назад';
  };

  L.plural = function (n, one, few, many) {
    const m10 = n % 10;
    const m100 = n % 100;
    if (m10 === 1 && m100 !== 11) return one;
    if (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) return few;
    return many;
  };

  L.monthKey = function (s) {
    return String(s).slice(0, 7); // YYYY-MM
  };

  L.escape = function (s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  };

  // ---- DOM helper ----
  L.h = function (tag, attrs, children) {
    const el = document.createElement(tag);
    if (attrs) {
      for (const k in attrs) {
        if (k === 'class') el.className = attrs[k];
        else if (k === 'html') el.innerHTML = attrs[k];
        else if (k === 'text') el.textContent = attrs[k];
        else if (k === 'dataset') Object.assign(el.dataset, attrs[k]);
        else if (k.startsWith('on') && typeof attrs[k] === 'function') {
          el.addEventListener(k.slice(2).toLowerCase(), attrs[k]);
        } else if (attrs[k] != null && attrs[k] !== false) {
          el.setAttribute(k, attrs[k]);
        }
      }
    }
    if (children != null) {
      const arr = Array.isArray(children) ? children : [children];
      for (const c of arr) {
        if (c == null || c === false) continue;
        el.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
      }
    }
    return el;
  };

  // ---- Роутинг ----
  L.go = function (name) {
    if (!L.views[name]) return;
    L.current = name;

    document.querySelectorAll('.nav-item').forEach((b) => {
      b.classList.toggle('active', b.dataset.view === name);
    });

    L.render();
  };

  L.render = function () {
    const view = L.views[L.current];
    if (!view) return;

    // Чистим прошлые графики, чтобы не текла память.
    L.destroyCharts();

    const titleEl = document.getElementById('viewTitle');
    const subEl = document.getElementById('viewSubtitle');
    const actionsEl = document.getElementById('topbarActions');
    const content = document.getElementById('content');

    titleEl.textContent = view.title || '';
    subEl.textContent = typeof view.subtitle === 'function' ? view.subtitle() : view.subtitle || '';
    actionsEl.innerHTML = '';
    if (view.actions) {
      const nodes = view.actions();
      (Array.isArray(nodes) ? nodes : [nodes]).forEach((n) => n && actionsEl.appendChild(n));
    }

    content.innerHTML = '';
    content.scrollTop = 0;
    view.render(content);
  };

  // Перерисовать текущий экран после изменения данных.
  L.refresh = async function () {
    await L.reload();
    L.render();
  };

  // ---- Charts ----
  L.registerChart = function (c) {
    L.charts.push(c);
    return c;
  };
  L.destroyCharts = function () {
    L.charts.forEach((c) => {
      try {
        c.destroy();
      } catch (_) { /* no-op */ }
    });
    L.charts = [];
  };

  // ---- CRUD обёртки (пишут в хранилище и обновляют экран) ----
  L.add = async function (collection, item) {
    const r = await window.api.add(collection, item);
    await L.reload();
    return r;
  };
  L.update = async function (collection, id, patch) {
    const r = await window.api.update(collection, id, patch);
    await L.reload();
    return r;
  };
  L.remove = async function (collection, id) {
    const r = await window.api.remove(collection, id);
    await L.reload();
    return r;
  };

  // ---- Модальное окно ----
  const overlay = () => document.getElementById('modalOverlay');

  L.openModal = function (opts) {
    const { title, body, footer } = opts;
    document.getElementById('modalTitle').textContent = title || '';
    const bodyEl = document.getElementById('modalBody');
    const footEl = document.getElementById('modalFoot');
    bodyEl.innerHTML = '';
    footEl.innerHTML = '';

    if (typeof body === 'string') bodyEl.innerHTML = body;
    else if (body) bodyEl.appendChild(body);

    (footer || []).forEach((b) => footEl.appendChild(b));

    overlay().hidden = false;

    // Автофокус на первом поле.
    const first = bodyEl.querySelector('input, select, textarea');
    if (first) setTimeout(() => first.focus(), 30);
  };

  L.closeModal = function () {
    overlay().hidden = true;
    document.getElementById('modalBody').innerHTML = '';
    document.getElementById('modalFoot').innerHTML = '';
  };

  // Подтверждение действия.
  L.confirm = function (message, onYes, opts) {
    opts = opts || {};
    const yes = L.h('button', { class: 'btn ' + (opts.danger ? 'danger' : 'primary') }, opts.yesText || 'Да');
    const no = L.h('button', { class: 'btn ghost' }, 'Отмена');
    yes.addEventListener('click', async () => {
      L.closeModal();
      await onYes();
    });
    no.addEventListener('click', L.closeModal);
    L.openModal({
      title: opts.title || 'Подтверждение',
      body: L.h('p', { class: 'muted', style: 'margin:0;line-height:1.5' }, message),
      footer: [no, yes],
    });
  };

  // ---- Уведомления ----
  L.toast = function (message, type) {
    const box = document.getElementById('toasts');
    const t = L.h('div', { class: 'toast ' + (type || '') }, message);
    box.appendChild(t);
    setTimeout(() => {
      t.style.transition = 'opacity .3s, transform .3s';
      t.style.opacity = '0';
      t.style.transform = 'translateX(20px)';
      setTimeout(() => t.remove(), 300);
    }, 2600);
  };

  // ---- Пустое состояние ----
  L.empty = function (emoji, big, small) {
    return L.h('div', { class: 'empty' }, [
      L.h('div', { class: 'emoji' }, emoji),
      L.h('div', { class: 'big' }, big),
      small ? L.h('div', { class: 'muted' }, small) : null,
    ]);
  };

  // ---- Поле формы (label + control) ----
  L.field = function (label, control, hint) {
    return L.h('div', { class: 'field' }, [
      label ? L.h('label', {}, label) : null,
      control,
      hint ? L.h('div', { class: 'hint' }, hint) : null,
    ]);
  };

  return L;
})();

'use strict';

(function (L) {
  L.views.settings = {
    title: 'Настройки',
    subtitle: 'Параметры приложения, категории, бюджеты и резервные копии',
    actions: function () {
      return null;
    },
    render: function (root) {
      const s = L.state.settings;

      // ---- Общие ----
      const appName = L.h('input', { type: 'text', value: s.appName || 'LifeHub' });
      const currency = L.h('input', { type: 'text', value: s.currency || '₽', maxlength: '6', style: 'max-width:120px' });
      const saveGeneral = L.h('button', { class: 'btn primary' }, 'Сохранить');
      saveGeneral.addEventListener('click', async () => {
        await window.api.setSettings({ appName: appName.value.trim() || 'LifeHub', currency: currency.value.trim() || '₽' });
        await L.reload();
        L.toast('Настройки сохранены', 'success');
        L.render();
      });

      root.appendChild(
        L.h('div', { class: 'card mb' }, [
          L.h('div', { class: 'section-title' }, 'Общие'),
          L.h('div', { class: 'field-row' }, [
            L.field('Название приложения', appName),
            L.field('Валюта', currency, 'Символ или код: ₽, $, €, ₸, USD…'),
          ]),
          L.h('div', { class: 'flex', style: 'justify-content:flex-end' }, [saveGeneral]),
        ])
      );

      // ---- Категории ----
      root.appendChild(categoriesCard());

      // ---- Бюджеты ----
      root.appendChild(budgetsCard());

      // ---- Резервные копии ----
      const exportBtn = L.h('button', { class: 'btn' }, '⬇️ Экспортировать данные');
      exportBtn.addEventListener('click', doExport);
      const importBtn = L.h('button', { class: 'btn' }, '⬆️ Импортировать данные');
      importBtn.addEventListener('click', doImport);

      root.appendChild(
        L.h('div', { class: 'card mb' }, [
          L.h('div', { class: 'section-title' }, 'Резервные копии'),
          L.h('p', { class: 'muted tiny', style: 'margin-top:0' },
            'Все данные хранятся локально на этом компьютере. Делайте экспорт, чтобы перенести данные или сохранить копию. Импорт заменит текущие данные.'),
          L.h('div', { class: 'flex gap-sm wrap' }, [exportBtn, importBtn]),
        ])
      );

      // ---- Опасная зона ----
      const clearBtn = L.h('button', { class: 'btn danger' }, 'Очистить все данные');
      clearBtn.addEventListener('click', () =>
        L.confirm(
          'Удалить ВСЕ данные без возможности восстановления? Рекомендуем сначала сделать экспорт.',
          async () => {
            await clearAll();
            await L.reload();
            L.toast('Все данные удалены');
            L.go('dashboard');
          },
          { danger: true, yesText: 'Да, удалить всё', title: 'Очистка данных' }
        )
      );
      root.appendChild(
        L.h('div', { class: 'card' }, [
          L.h('div', { class: 'section-title' }, 'Опасная зона'),
          L.h('div', { class: 'flex between wrap', style: 'gap:12px' }, [
            L.h('div', { class: 'muted tiny' }, 'Полностью очистить финансы, задачи, привычки, цели, заметки и события.'),
            clearBtn,
          ]),
        ])
      );
    },
  };

  function categoriesCard() {
    const cats = JSON.parse(JSON.stringify(L.state.categories));

    function list(type) {
      const wrap = L.h('div', { class: 'flex wrap gap-sm' });
      function redraw() {
        wrap.innerHTML = '';
        cats[type].forEach((c, i) => {
          const del = L.h('button', { class: 'icon-btn', style: 'width:20px;height:20px;font-size:12px' }, '✕');
          del.addEventListener('click', () => {
            cats[type].splice(i, 1);
            redraw();
          });
          wrap.appendChild(L.h('span', { class: 'pill gray', style: 'padding-right:4px' }, [c, del]));
        });
        const input = L.h('input', { type: 'text', placeholder: '+ добавить', style: 'max-width:140px;padding:5px 10px' });
        input.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' && input.value.trim()) {
            cats[type].push(input.value.trim());
            redraw();
          }
        });
        wrap.appendChild(input);
      }
      redraw();
      return wrap;
    }

    const save = L.h('button', { class: 'btn primary' }, 'Сохранить категории');
    save.addEventListener('click', async () => {
      await window.api.setCategories(cats);
      await L.reload();
      L.toast('Категории сохранены', 'success');
    });

    return L.h('div', { class: 'card mb' }, [
      L.h('div', { class: 'section-title' }, 'Категории финансов'),
      L.field('Расходы', list('expense'), 'Enter — добавить, ✕ — удалить'),
      L.field('Доходы', list('income')),
      L.h('div', { class: 'flex', style: 'justify-content:flex-end' }, [save]),
    ]);
  }

  function budgetsCard() {
    const budgets = Object.assign({}, L.state.budgets);
    const expenseCats = L.state.categories.expense;

    const rows = expenseCats.map((c) => {
      const input = L.h('input', {
        type: 'number', min: '0', step: '100', value: budgets[c] || '',
        placeholder: 'без лимита', style: 'max-width:160px',
      });
      input.dataset.cat = c;
      return L.h('div', { class: 'flex between', style: 'padding:6px 0' }, [
        L.h('span', { style: 'font-weight:600' }, c),
        input,
      ]);
    });

    const save = L.h('button', { class: 'btn primary' }, 'Сохранить бюджеты');
    save.addEventListener('click', async () => {
      const next = {};
      save.closest('.card').querySelectorAll('input[data-cat]').forEach((inp) => {
        const v = parseFloat(inp.value);
        if (v > 0) next[inp.dataset.cat] = v;
      });
      await window.api.setBudgets(next);
      await L.reload();
      L.toast('Бюджеты сохранены', 'success');
    });

    return L.h('div', { class: 'card mb' }, [
      L.h('div', { class: 'section-title' }, 'Месячные бюджеты по категориям'),
      L.h('p', { class: 'muted tiny', style: 'margin-top:0' }, 'Установите лимит расходов на месяц — прогресс будет виден в разделе «Финансы».'),
      L.h('div', {}, rows),
      L.h('div', { class: 'flex', style: 'justify-content:flex-end;margin-top:10px' }, [save]),
    ]);
  }

  async function doExport() {
    const res = await window.api.exportData();
    if (res && res.ok) L.toast('Данные сохранены в файл', 'success');
    else if (res && !res.canceled) L.toast('Не удалось сохранить', 'error');
  }

  async function doImport() {
    const res = await window.api.importData();
    if (res && res.ok) {
      await L.reload();
      L.toast('Данные импортированы', 'success');
      L.go('dashboard');
    } else if (res && res.error) {
      L.toast('Ошибка импорта: ' + res.error, 'error');
    } else if (res && !res.canceled) {
      L.toast('Импорт не выполнен', 'error');
    }
  }

  async function clearAll() {
    const collections = ['transactions', 'tasks', 'habits', 'goals', 'notes', 'events'];
    for (const col of collections) {
      const items = await window.api.list(col);
      for (const it of items.slice()) {
        await window.api.remove(col, it.id);
      }
    }
    await window.api.setBudgets({});
  }
})(window.L);

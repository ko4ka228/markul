'use strict';

(function (L) {
  let month = null; // YYYY-MM, активный месяц
  let search = '';

  function curMonth() {
    if (!month) month = L.todayStr().slice(0, 7);
    return month;
  }

  function shiftMonth(delta) {
    const [y, m] = curMonth().split('-').map(Number);
    const d = new Date(y, m - 1 + delta, 1);
    month = L.dateStr(d).slice(0, 7);
    L.render();
  }

  function monthLabel(key) {
    const [y, m] = key.split('-').map(Number);
    return L.MONTHS_NOM[m - 1] + ' ' + y;
  }

  function txInMonth(key) {
    return L.state.transactions.filter((t) => L.monthKey(t.date) === key);
  }

  function sum(arr, type) {
    return arr.filter((t) => t.type === type).reduce((s, t) => s + (Number(t.amount) || 0), 0);
  }

  function openForm(type, tx) {
    const cats = L.state.categories;
    const t = tx || {
      type: type || 'expense',
      amount: '',
      category: '',
      note: '',
      date: L.todayStr(),
    };
    let curType = t.type;

    const typeSeg = L.h('div', { class: 'seg' }, [
      ['expense', 'Расход'],
      ['income', 'Доход'],
    ].map(([k, label]) => {
      const b = L.h('button', { class: curType === k ? 'active' : '' }, label);
      b.addEventListener('click', () => {
        curType = k;
        typeSeg.querySelectorAll('button').forEach((x) => x.classList.remove('active'));
        b.classList.add('active');
        rebuildCats();
      });
      return b;
    }));

    const amount = L.h('input', { type: 'number', step: '0.01', min: '0', value: t.amount, placeholder: '0' });
    const category = L.h('select', {});
    function rebuildCats() {
      category.innerHTML = '';
      (cats[curType] || []).forEach((c) => {
        category.appendChild(L.h('option', { value: c, selected: t.category === c ? 'selected' : false }, c));
      });
    }
    rebuildCats();

    const date = L.h('input', { type: 'date', value: t.date });
    const note = L.h('textarea', { placeholder: 'Комментарий (необязательно)' }, t.note || '');

    const save = L.h('button', { class: 'btn primary' }, tx ? 'Сохранить' : 'Добавить');
    save.addEventListener('click', async () => {
      const val = parseFloat(amount.value);
      if (!val || val <= 0) {
        L.toast('Введите сумму больше нуля', 'error');
        amount.focus();
        return;
      }
      const payload = {
        type: curType,
        amount: val,
        category: category.value || 'Другое',
        date: date.value || L.todayStr(),
        note: note.value.trim(),
      };
      if (tx) {
        await L.update('transactions', tx.id, payload);
        L.toast('Операция обновлена', 'success');
      } else {
        await L.add('transactions', payload);
        L.toast('Операция добавлена', 'success');
      }
      // Перейти на месяц операции, чтобы она была видна.
      month = L.monthKey(payload.date);
      L.closeModal();
      L.render();
    });
    const cancel = L.h('button', { class: 'btn ghost' }, 'Отмена');
    cancel.addEventListener('click', L.closeModal);

    L.openModal({
      title: tx ? 'Редактировать операцию' : 'Новая операция',
      body: L.h('div', {}, [
        L.field('Тип', typeSeg),
        L.h('div', { class: 'field-row' }, [
          L.field('Сумма', amount),
          L.field('Дата', date),
        ]),
        L.field('Категория', category),
        L.field('Комментарий', note),
      ]),
      footer: [cancel, save],
    });
  }

  function txRow(tx) {
    const isInc = tx.type === 'income';
    const edit = L.h('button', { class: 'icon-btn', title: 'Редактировать' }, '✏️');
    edit.addEventListener('click', () => openForm(tx.type, tx));
    const del = L.h('button', { class: 'icon-btn', title: 'Удалить' }, '🗑');
    del.addEventListener('click', () =>
      L.confirm('Удалить операцию на ' + L.money(tx.amount) + '?', async () => {
        await L.remove('transactions', tx.id);
        L.toast('Операция удалена');
        L.render();
      }, { danger: true, yesText: 'Удалить' })
    );

    const dot = L.h('div', { class: 'dot', style: 'background:' + (isInc ? 'var(--green)' : 'var(--red)') });

    return L.h('div', { class: 'row' }, [
      dot,
      L.h('div', { class: 'grow' }, [
        L.h('div', { class: 'title' }, tx.category),
        L.h('div', { class: 'sub' }, L.fmtDate(tx.date) + (tx.note ? ' · ' + tx.note : '')),
      ]),
      L.h('div', { class: (isInc ? 'pos' : 'neg'), style: 'font-weight:700;white-space:nowrap' },
        (isInc ? '+' : '−') + L.money(tx.amount).replace('−', '')),
      L.h('div', { class: 'actions' }, [edit, del]),
    ]);
  }

  L.views.finance = {
    title: 'Финансы',
    subtitle: function () {
      const bal = sum(L.state.transactions, 'income') - sum(L.state.transactions, 'expense');
      return 'Общий баланс: ' + L.money(bal);
    },
    actions: function () {
      const exp = L.h('button', { class: 'btn' }, '− Расход');
      exp.addEventListener('click', () => openForm('expense', null));
      const inc = L.h('button', { class: 'btn primary' }, '＋ Доход');
      inc.addEventListener('click', () => openForm('income', null));
      return [exp, inc];
    },
    render: function (root) {
      const key = curMonth();
      const tx = txInMonth(key);
      const income = sum(tx, 'income');
      const expense = sum(tx, 'expense');
      const net = income - expense;
      const allBalance = sum(L.state.transactions, 'income') - sum(L.state.transactions, 'expense');

      // --- Переключатель месяца ---
      const prev = L.h('button', { class: 'icon-btn' }, '‹');
      prev.addEventListener('click', () => shiftMonth(-1));
      const next = L.h('button', { class: 'icon-btn' }, '›');
      next.addEventListener('click', () => shiftMonth(1));
      root.appendChild(
        L.h('div', { class: 'flex between mb' }, [
          L.h('div', { class: 'flex gap-sm' }, [
            prev,
            L.h('div', { style: 'font-weight:700;font-size:15px;min-width:150px;text-align:center' }, monthLabel(key)),
            next,
          ]),
        ])
      );

      // --- Статистика ---
      root.appendChild(
        L.h('div', { class: 'grid cols-4 mb' }, [
          stat('Баланс (всего)', L.money(allBalance), '💼', allBalance >= 0 ? 'pos' : 'neg'),
          stat('Доходы за месяц', L.money(income), '📈', 'pos'),
          stat('Расходы за месяц', L.money(expense), '📉', 'neg'),
          stat('Итог месяца', (net >= 0 ? '+' : '−') + L.money(Math.abs(net)), '🧮', net >= 0 ? 'pos' : 'neg'),
        ])
      );

      // --- Графики ---
      root.appendChild(
        L.h('div', { class: 'grid cols-2 mb' }, [
          L.h('div', { class: 'card' }, [
            L.h('div', { class: 'section-title' }, 'Расходы по категориям'),
            L.h('div', { class: 'chart-wrap' }, [L.h('canvas', { id: 'chExpCat' })]),
          ]),
          L.h('div', { class: 'card' }, [
            L.h('div', { class: 'section-title' }, 'Доходы и расходы по месяцам'),
            L.h('div', { class: 'chart-wrap' }, [L.h('canvas', { id: 'chMonths' })]),
          ]),
        ])
      );

      // --- Бюджеты ---
      const budgets = L.state.budgets || {};
      const budgetCats = Object.keys(budgets).filter((c) => budgets[c] > 0);
      if (budgetCats.length) {
        const spentByCat = {};
        tx.filter((t) => t.type === 'expense').forEach((t) => {
          spentByCat[t.category] = (spentByCat[t.category] || 0) + Number(t.amount);
        });
        root.appendChild(
          L.h('div', { class: 'card mb' }, [
            L.h('div', { class: 'section-title' }, ['Бюджеты на месяц', L.h('span', { class: 'tiny muted' }, 'настройка в разделе «Настройки»')]),
            L.h('div', { class: 'grid', style: 'gap:14px' }, budgetCats.map((c) => {
              const spent = spentByCat[c] || 0;
              const limit = budgets[c];
              const pct = Math.min(100, Math.round((spent / limit) * 100));
              const over = spent > limit;
              return L.h('div', {}, [
                L.h('div', { class: 'flex between tiny mb', style: 'margin-bottom:6px' }, [
                  L.h('span', { style: 'font-weight:600' }, c),
                  L.h('span', { class: over ? 'neg' : 'muted' }, L.money(spent) + ' / ' + L.money(limit)),
                ]),
                L.h('div', { class: 'progress' }, [
                  L.h('span', { style: 'width:' + pct + '%;' + (over ? 'background:var(--red)' : '') }),
                ]),
              ]);
            })),
          ])
        );
      }

      // --- Список операций ---
      const searchInput = L.h('input', {
        type: 'text', placeholder: '🔎 Поиск по операциям…', value: search, style: 'max-width:260px',
      });
      const listWrap = L.h('div', {});
      searchInput.addEventListener('input', (e) => {
        search = e.target.value;
        renderList();
      });

      root.appendChild(
        L.h('div', { class: 'card' }, [
          L.h('div', { class: 'section-title' }, ['Операции за ' + monthLabel(key).toLowerCase(), searchInput]),
          listWrap,
        ])
      );

      function renderList() {
        listWrap.innerHTML = '';
        let items = tx.slice();
        if (search.trim()) {
          const q = search.trim().toLowerCase();
          items = items.filter(
            (t) => t.category.toLowerCase().includes(q) || (t.note || '').toLowerCase().includes(q)
          );
        }
        items.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
        if (!items.length) {
          listWrap.appendChild(L.empty('💸', 'Операций нет', 'Добавьте доход или расход кнопками сверху'));
          return;
        }
        listWrap.appendChild(L.h('div', { class: 'row-list' }, items.map(txRow)));
      }
      renderList();

      // --- Рисуем графики после вставки canvas ---
      drawExpenseByCategory(tx);
      drawMonths();
    },
  };

  function stat(label, value, ico, cls) {
    return L.h('div', { class: 'stat' }, [
      L.h('div', { class: 'stat-ico' }, ico),
      L.h('div', { class: 'stat-label' }, label),
      L.h('div', { class: 'stat-value ' + (cls || '') }, value),
    ]);
  }

  function drawExpenseByCategory(tx) {
    const canvas = document.getElementById('chExpCat');
    if (!canvas) return;
    const byCat = {};
    tx.filter((t) => t.type === 'expense').forEach((t) => {
      byCat[t.category] = (byCat[t.category] || 0) + Number(t.amount);
    });
    const labels = Object.keys(byCat);
    if (!labels.length) {
      emptyChart(canvas, 'Нет расходов за месяц');
      return;
    }
    const data = labels.map((l) => byCat[l]);
    const colors = labels.map((_, i) => L.palette[i % L.palette.length]);
    L.registerChart(new Chart(canvas, {
      type: 'doughnut',
      data: { labels, datasets: [{ data, backgroundColor: colors, borderWidth: 0 }] },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '62%',
        plugins: {
          legend: { position: 'right', labels: { boxWidth: 12, padding: 10 } },
          tooltip: {
            callbacks: { label: (c) => c.label + ': ' + L.money(c.parsed) },
          },
        },
      },
    }));
  }

  function drawMonths() {
    const canvas = document.getElementById('chMonths');
    if (!canvas) return;
    // Последние 6 месяцев.
    const keys = [];
    const [y, m] = curMonth().split('-').map(Number);
    for (let i = 5; i >= 0; i--) {
      const d = new Date(y, m - 1 - i, 1);
      keys.push(L.dateStr(d).slice(0, 7));
    }
    const inc = keys.map((k) => sum(txInMonth(k), 'income'));
    const exp = keys.map((k) => sum(txInMonth(k), 'expense'));
    const labels = keys.map((k) => {
      const [, mm] = k.split('-').map(Number);
      return L.MONTHS_NOM[mm - 1].slice(0, 3);
    });
    if (!inc.some((v) => v) && !exp.some((v) => v)) {
      emptyChart(canvas, 'Нет данных');
      return;
    }
    L.registerChart(new Chart(canvas, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          { label: 'Доходы', data: inc, backgroundColor: '#35d08a', borderRadius: 6 },
          { label: 'Расходы', data: exp, backgroundColor: '#ff6b7a', borderRadius: 6 },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { labels: { boxWidth: 12 } },
          tooltip: { callbacks: { label: (c) => c.dataset.label + ': ' + L.money(c.parsed.y) } },
        },
        scales: {
          x: { grid: { display: false } },
          y: { ticks: { callback: (v) => (v >= 1000 ? v / 1000 + 'k' : v) } },
        },
      },
    }));
  }

  function emptyChart(canvas, text) {
    const ctx = canvas.getContext('2d');
    ctx.save();
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#6b7699';
    ctx.font = '13px Segoe UI, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(text, canvas.width / 2, canvas.height / 2);
    ctx.restore();
  }

  L._finance = { emptyChart };
})(window.L);

'use strict';

(function (L) {
  function sum(arr, type) {
    return arr.filter((t) => t.type === type).reduce((s, t) => s + (Number(t.amount) || 0), 0);
  }

  function stat(label, value, ico, cls, onClick) {
    const el = L.h('div', { class: 'stat', style: onClick ? 'cursor:pointer' : '' }, [
      L.h('div', { class: 'stat-ico' }, ico),
      L.h('div', { class: 'stat-label' }, label),
      L.h('div', { class: 'stat-value ' + (cls || '') }, value),
    ]);
    if (onClick) el.addEventListener('click', onClick);
    return el;
  }

  L.views.dashboard = {
    title: 'Сводка',
    subtitle: function () {
      const d = new Date();
      const wd = ['Воскресенье', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота'][d.getDay()];
      return wd + ', ' + L.fmtDate(L.todayStr());
    },
    actions: function () {
      return null;
    },
    render: function (root) {
      const today = L.todayStr();
      const monthKey = today.slice(0, 7);
      const monthTx = L.state.transactions.filter((t) => L.monthKey(t.date) === monthKey);

      const balance = sum(L.state.transactions, 'income') - sum(L.state.transactions, 'expense');
      const income = sum(monthTx, 'income');
      const expense = sum(monthTx, 'expense');
      const activeTasks = L.state.tasks.filter((t) => !t.done).length;

      // --- Статистика ---
      root.appendChild(
        L.h('div', { class: 'grid cols-4 mb' }, [
          stat('Баланс', L.money(balance), '💼', balance >= 0 ? 'pos' : 'neg', () => L.go('finance')),
          stat('Доходы за месяц', L.money(income), '📈', 'pos', () => L.go('finance')),
          stat('Расходы за месяц', L.money(expense), '📉', 'neg', () => L.go('finance')),
          stat('Активных задач', String(activeTasks), '✅', '', () => L.go('tasks')),
        ])
      );

      root.appendChild(
        L.h('div', { class: 'grid cols-2 mb' }, [todayTasksCard(), habitsTodayCard()])
      );

      root.appendChild(
        L.h('div', { class: 'grid cols-2' }, [upcomingCard(), spendChartCard()])
      );

      drawSpend(monthTx);
    },
  };

  function todayTasksCard() {
    const today = L.todayStr();
    const tasks = L.state.tasks
      .filter((t) => !t.done && (!t.due || t.due <= today))
      .sort((a, b) => (a.due || '9999').localeCompare(b.due || '9999'))
      .slice(0, 6);

    const head = L.h('div', { class: 'section-title' }, [
      'Задачи на сегодня',
      linkMore(() => L.go('tasks')),
    ]);

    let body;
    if (!tasks.length) {
      body = L.h('div', { class: 'muted tiny', style: 'padding:14px 0' }, 'На сегодня активных задач нет 🎉');
    } else {
      body = L.h('div', { class: 'row-list' }, tasks.map((t) => {
        const overdue = t.due && t.due < today;
        const check = L.h('div', { class: 'checkbox' }, '✓');
        check.addEventListener('click', async () => {
          await L.update('tasks', t.id, { done: true, completedAt: new Date().toISOString() });
          L.render();
        });
        return L.h('div', { class: 'row' }, [
          check,
          L.h('div', { class: 'grow' }, [
            L.h('div', { class: 'title truncate' }, t.title),
            t.due ? L.h('div', { class: 'sub' }, L.h('span', { class: 'pill ' + (overdue ? 'red' : 'blue') }, L.relDays(t.due))) : null,
          ]),
        ]);
      }));
    }
    return L.h('div', { class: 'card' }, [head, body]);
  }

  function habitsTodayCard() {
    const today = L.todayStr();
    const habits = L.state.habits;
    const head = L.h('div', { class: 'section-title' }, ['Привычки сегодня', linkMore(() => L.go('habits'))]);

    let body;
    if (!habits.length) {
      body = L.h('div', { class: 'muted tiny', style: 'padding:14px 0' }, 'Привычек пока нет');
    } else {
      body = L.h('div', { class: 'row-list' }, habits.slice(0, 6).map((hb) => {
        const done = !!(hb.history || {})[today];
        const check = L.h('div', { class: 'checkbox ' + (done ? 'checked' : ''), style: done ? 'background:' + hb.color + ';border-color:' + hb.color : '' }, '✓');
        check.addEventListener('click', async () => {
          const history = Object.assign({}, hb.history || {});
          if (history[today]) delete history[today];
          else history[today] = true;
          await L.update('habits', hb.id, { history });
          L.render();
        });
        return L.h('div', { class: 'row' }, [
          check,
          L.h('div', { class: 'grow' }, L.h('div', { class: 'title truncate ' + (done ? 'strike' : '') }, hb.name)),
          L.h('span', { class: 'dot', style: 'background:' + hb.color }),
        ]);
      }));
    }
    return L.h('div', { class: 'card' }, [head, body]);
  }

  function upcomingCard() {
    const today = L.todayStr();
    const events = L.state.events
      .filter((e) => e.date >= today)
      .sort((a, b) => (a.date + (a.time || '')).localeCompare(b.date + (b.time || '')))
      .slice(0, 6);

    const head = L.h('div', { class: 'section-title' }, ['Ближайшие события', linkMore(() => L.go('calendar'))]);
    let body;
    if (!events.length) {
      body = L.h('div', { class: 'muted tiny', style: 'padding:14px 0' }, 'Запланированных событий нет');
    } else {
      body = L.h('div', { class: 'row-list' }, events.map((e) =>
        L.h('div', { class: 'row' }, [
          L.h('span', { class: 'dot', style: 'background:' + (e.color || L.palette[0]) }),
          L.h('div', { class: 'grow' }, [
            L.h('div', { class: 'title truncate' }, e.title),
            L.h('div', { class: 'sub' }, L.fmtDateShort(e.date) + ' · ' + L.relDays(e.date) + (e.time ? ' · ' + e.time : '')),
          ]),
        ])
      ));
    }
    return L.h('div', { class: 'card' }, [head, body]);
  }

  function spendChartCard() {
    return L.h('div', { class: 'card' }, [
      L.h('div', { class: 'section-title' }, 'Расходы этого месяца'),
      L.h('div', { class: 'chart-wrap sm' }, [L.h('canvas', { id: 'chDashSpend' })]),
    ]);
  }

  function drawSpend(monthTx) {
    const canvas = document.getElementById('chDashSpend');
    if (!canvas) return;
    const byCat = {};
    monthTx.filter((t) => t.type === 'expense').forEach((t) => {
      byCat[t.category] = (byCat[t.category] || 0) + Number(t.amount);
    });
    const labels = Object.keys(byCat);
    if (!labels.length) {
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#6b7699';
      ctx.font = '13px Segoe UI, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Расходов пока нет', canvas.width / 2, canvas.height / 2);
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
          legend: { position: 'right', labels: { boxWidth: 12, padding: 8, font: { size: 11 } } },
          tooltip: { callbacks: { label: (c) => c.label + ': ' + L.money(c.parsed) } },
        },
      },
    }));
  }

  function linkMore(onClick) {
    const a = L.h('button', { class: 'btn ghost sm' }, 'Открыть →');
    a.addEventListener('click', onClick);
    return a;
  }
})(window.L);

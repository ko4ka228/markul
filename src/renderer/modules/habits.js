'use strict';

(function (L) {
  const DAYS_SHOWN = 14;

  function openForm(habit) {
    const h = habit || { name: '', color: L.palette[0], history: {} };
    let color = h.color;

    const name = L.h('input', { type: 'text', value: h.name, placeholder: 'Например: Зарядка, Чтение, Вода…' });

    const swatches = L.h('div', { class: 'swatches' }, L.palette.map((c) => {
      const s = L.h('div', { class: 'swatch ' + (c === color ? 'sel' : ''), style: 'background:' + c });
      s.addEventListener('click', () => {
        color = c;
        swatches.querySelectorAll('.swatch').forEach((x) => x.classList.remove('sel'));
        s.classList.add('sel');
      });
      return s;
    }));

    const save = L.h('button', { class: 'btn primary' }, habit ? 'Сохранить' : 'Добавить');
    save.addEventListener('click', async () => {
      const val = name.value.trim();
      if (!val) {
        L.toast('Введите название привычки', 'error');
        name.focus();
        return;
      }
      if (habit) {
        await L.update('habits', habit.id, { name: val, color });
        L.toast('Привычка обновлена', 'success');
      } else {
        await L.add('habits', { name: val, color, history: {}, archived: false });
        L.toast('Привычка добавлена', 'success');
      }
      L.closeModal();
      L.render();
    });
    const cancel = L.h('button', { class: 'btn ghost' }, 'Отмена');
    cancel.addEventListener('click', L.closeModal);
    name.addEventListener('keydown', (e) => e.key === 'Enter' && save.click());

    L.openModal({
      title: habit ? 'Редактировать привычку' : 'Новая привычка',
      body: L.h('div', {}, [L.field('Название', name), L.field('Цвет', swatches)]),
      footer: [cancel, save],
    });
  }

  async function toggleDay(habit, dateStr) {
    const history = Object.assign({}, habit.history || {});
    if (history[dateStr]) delete history[dateStr];
    else history[dateStr] = true;
    await L.update('habits', habit.id, { history });
    L.render();
  }

  function streak(history) {
    let count = 0;
    const d = L.parseDate(L.todayStr());
    // Если сегодня не отмечено — считаем со вчера (чтобы серия не обнулялась в начале дня).
    if (!history[L.dateStr(d)]) d.setDate(d.getDate() - 1);
    while (history[L.dateStr(d)]) {
      count++;
      d.setDate(d.getDate() - 1);
    }
    return count;
  }

  function bestStreak(history) {
    const dates = Object.keys(history).filter((k) => history[k]).sort();
    let best = 0;
    let cur = 0;
    let prev = null;
    for (const ds of dates) {
      const d = L.parseDate(ds);
      if (prev && (d - prev) === 86400000) cur++;
      else cur = 1;
      best = Math.max(best, cur);
      prev = d;
    }
    return best;
  }

  function last30Rate(history) {
    const today = L.parseDate(L.todayStr());
    let done = 0;
    for (let i = 0; i < 30; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      if (history[L.dateStr(d)]) done++;
    }
    return Math.round((done / 30) * 100);
  }

  function habitCard(habit) {
    const history = habit.history || {};
    const today = L.parseDate(L.todayStr());
    const st = streak(history);
    const best = bestStreak(history);
    const rate = last30Rate(history);

    // Ряд последних дней.
    const days = [];
    for (let i = DAYS_SHOWN - 1; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const ds = L.dateStr(d);
      const done = !!history[ds];
      const cell = L.h('div', {
        class: 'habit-day ' + (done ? 'done' : ''),
        title: L.fmtDate(ds),
        style: done ? 'background:' + habit.color : '',
      }, String(d.getDate()));
      cell.addEventListener('click', () => toggleDay(habit, ds));
      days.push(cell);
    }

    const todayStr = L.todayStr();
    const doneToday = !!history[todayStr];
    const toggleBtn = L.h('button', {
      class: 'btn sm ' + (doneToday ? '' : 'primary'),
    }, doneToday ? '✓ Сегодня' : 'Отметить сегодня');
    toggleBtn.addEventListener('click', () => toggleDay(habit, todayStr));

    const edit = L.h('button', { class: 'icon-btn', title: 'Редактировать' }, '✏️');
    edit.addEventListener('click', () => openForm(habit));
    const del = L.h('button', { class: 'icon-btn', title: 'Удалить' }, '🗑');
    del.addEventListener('click', () =>
      L.confirm('Удалить привычку «' + habit.name + '»? Вся история отметок будет потеряна.', async () => {
        await L.remove('habits', habit.id);
        L.toast('Привычка удалена');
        L.render();
      }, { danger: true, yesText: 'Удалить' })
    );

    return L.h('div', { class: 'card' }, [
      L.h('div', { class: 'flex between mb' }, [
        L.h('div', { class: 'flex gap-sm' }, [
          L.h('div', { class: 'dot', style: 'background:' + habit.color + ';width:14px;height:14px' }),
          L.h('div', { style: 'font-weight:700;font-size:15px' }, habit.name),
        ]),
        L.h('div', { class: 'actions', style: 'opacity:1' }, [toggleBtn, edit, del]),
      ]),
      L.h('div', { class: 'flex gap-sm mb', style: 'flex-wrap:wrap' }, [
        L.h('span', { class: 'pill ' + (st > 0 ? 'green' : 'gray') }, '🔥 Серия: ' + st + ' ' + L.plural(st, 'день', 'дня', 'дней')),
        L.h('span', { class: 'pill blue' }, '🏆 Рекорд: ' + best),
        L.h('span', { class: 'pill yellow' }, '📊 30 дней: ' + rate + '%'),
      ]),
      L.h('div', { class: 'habit-days' }, days),
    ]);
  }

  L.views.habits = {
    title: 'Привычки',
    subtitle: function () {
      const n = L.state.habits.length;
      const doneToday = L.state.habits.filter((h) => (h.history || {})[L.todayStr()]).length;
      if (!n) return 'Формируйте полезные привычки';
      return 'Сегодня выполнено ' + doneToday + ' из ' + n;
    },
    actions: function () {
      const btn = L.h('button', { class: 'btn primary' }, '＋ Новая привычка');
      btn.addEventListener('click', () => openForm(null));
      return btn;
    },
    render: function (root) {
      const habits = L.state.habits;
      if (!habits.length) {
        root.appendChild(L.empty('🔥', 'Привычек пока нет', 'Добавьте первую привычку и отмечайте её каждый день'));
        return;
      }
      root.appendChild(L.h('div', { class: 'grid cols-2' }, habits.map(habitCard)));
    },
  };
})(window.L);

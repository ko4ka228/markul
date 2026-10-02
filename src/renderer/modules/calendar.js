'use strict';

(function (L) {
  let viewMonth = null; // YYYY-MM

  function cur() {
    if (!viewMonth) viewMonth = L.todayStr().slice(0, 7);
    return viewMonth;
  }

  function shift(delta) {
    const [y, m] = cur().split('-').map(Number);
    viewMonth = L.dateStr(new Date(y, m - 1 + delta, 1)).slice(0, 7);
    L.render();
  }

  function eventsOn(dateStr) {
    return L.state.events.filter((e) => e.date === dateStr);
  }

  function tasksOn(dateStr) {
    return L.state.tasks.filter((t) => t.due === dateStr && !t.done);
  }

  function openEventForm(dateStr, ev) {
    const e = ev || { title: '', date: dateStr || L.todayStr(), time: '', note: '', color: L.palette[0] };
    let color = e.color || L.palette[0];

    const title = L.h('input', { type: 'text', value: e.title, placeholder: 'Название события' });
    const date = L.h('input', { type: 'date', value: e.date });
    const time = L.h('input', { type: 'time', value: e.time || '' });
    const note = L.h('textarea', { placeholder: 'Детали (необязательно)' }, e.note || '');
    const swatches = L.h('div', { class: 'swatches' }, L.palette.map((c) => {
      const s = L.h('div', { class: 'swatch ' + (c === color ? 'sel' : ''), style: 'background:' + c });
      s.addEventListener('click', () => {
        color = c;
        swatches.querySelectorAll('.swatch').forEach((x) => x.classList.remove('sel'));
        s.classList.add('sel');
      });
      return s;
    }));

    const save = L.h('button', { class: 'btn primary' }, ev ? 'Сохранить' : 'Добавить');
    save.addEventListener('click', async () => {
      const val = title.value.trim();
      if (!val) {
        L.toast('Введите название события', 'error');
        title.focus();
        return;
      }
      const payload = { title: val, date: date.value, time: time.value, note: note.value.trim(), color };
      if (ev) {
        await L.update('events', ev.id, payload);
        L.toast('Событие обновлено', 'success');
      } else {
        await L.add('events', payload);
        L.toast('Событие добавлено', 'success');
      }
      viewMonth = L.monthKey(payload.date);
      L.closeModal();
      L.render();
    });
    const cancel = L.h('button', { class: 'btn ghost' }, 'Отмена');
    cancel.addEventListener('click', L.closeModal);

    L.openModal({
      title: ev ? 'Редактировать событие' : 'Новое событие',
      body: L.h('div', {}, [
        L.field('Название', title),
        L.h('div', { class: 'field-row' }, [L.field('Дата', date), L.field('Время', time)]),
        L.field('Цвет', swatches),
        L.field('Детали', note),
      ]),
      footer: [cancel, save],
    });
  }

  function openDay(dateStr) {
    const evs = eventsOn(dateStr).sort((a, b) => (a.time || '').localeCompare(b.time || ''));
    const tasks = tasksOn(dateStr);

    const body = L.h('div', {});
    if (!evs.length && !tasks.length) {
      body.appendChild(L.h('p', { class: 'muted', style: 'margin:0 0 4px' }, 'На этот день ничего не запланировано.'));
    }

    if (tasks.length) {
      body.appendChild(L.h('div', { class: 'section-title', style: 'font-size:13px' }, 'Задачи (дедлайн)'));
      body.appendChild(L.h('div', { class: 'row-list mb' }, tasks.map((t) =>
        L.h('div', { class: 'row' }, [
          L.h('span', { class: 'dot', style: 'background:var(--accent)' }),
          L.h('div', { class: 'grow' }, t.title),
          L.h('span', { class: 'pill gray' }, 'задача'),
        ])
      )));
    }

    if (evs.length) {
      body.appendChild(L.h('div', { class: 'section-title', style: 'font-size:13px' }, 'События'));
      body.appendChild(L.h('div', { class: 'row-list' }, evs.map((e) => {
        const edit = L.h('button', { class: 'icon-btn' }, '✏️');
        edit.addEventListener('click', () => openEventForm(dateStr, e));
        const del = L.h('button', { class: 'icon-btn' }, '🗑');
        del.addEventListener('click', () =>
          L.confirm('Удалить событие «' + e.title + '»?', async () => {
            await L.remove('events', e.id);
            L.toast('Событие удалено');
            L.closeModal();
            L.render();
          }, { danger: true, yesText: 'Удалить' })
        );
        return L.h('div', { class: 'row' }, [
          L.h('span', { class: 'dot', style: 'background:' + (e.color || L.palette[0]) }),
          L.h('div', { class: 'grow' }, [
            L.h('div', { class: 'title' }, e.title),
            (e.time || e.note) ? L.h('div', { class: 'sub' }, [e.time ? '🕒 ' + e.time : '', e.note || ''].filter(Boolean).join(' · ')) : null,
          ]),
          L.h('div', { class: 'actions', style: 'opacity:1' }, [edit, del]),
        ]);
      })));
    }

    const add = L.h('button', { class: 'btn primary' }, '＋ Событие');
    add.addEventListener('click', () => openEventForm(dateStr, null));
    const close = L.h('button', { class: 'btn ghost' }, 'Закрыть');
    close.addEventListener('click', L.closeModal);

    L.openModal({ title: L.fmtDate(dateStr), body, footer: [close, add] });
  }

  L.views.calendar = {
    title: 'Календарь',
    subtitle: function () {
      const n = L.state.events.length;
      return n + ' ' + L.plural(n, 'событие', 'события', 'событий') + ' всего';
    },
    actions: function () {
      const today = L.h('button', { class: 'btn' }, 'Сегодня');
      today.addEventListener('click', () => {
        viewMonth = L.todayStr().slice(0, 7);
        L.render();
      });
      const add = L.h('button', { class: 'btn primary' }, '＋ Событие');
      add.addEventListener('click', () => openEventForm(L.todayStr(), null));
      return [today, add];
    },
    render: function (root) {
      const key = cur();
      const [y, m] = key.split('-').map(Number);

      const prev = L.h('button', { class: 'icon-btn' }, '‹');
      prev.addEventListener('click', () => shift(-1));
      const next = L.h('button', { class: 'icon-btn' }, '›');
      next.addEventListener('click', () => shift(1));

      root.appendChild(
        L.h('div', { class: 'flex gap-sm mb' }, [
          prev,
          L.h('div', { style: 'font-weight:700;font-size:16px;min-width:170px;text-align:center' }, L.MONTHS_NOM[m - 1] + ' ' + y),
          next,
        ])
      );

      const grid = L.h('div', { class: 'cal-grid' });
      // Заголовки дней недели.
      L.DOW.forEach((d) => grid.appendChild(L.h('div', { class: 'cal-dow' }, d)));

      // Первый день месяца и смещение (неделя начинается с понедельника).
      const first = new Date(y, m - 1, 1);
      let startOffset = (first.getDay() + 6) % 7; // Пн=0 … Вс=6
      const daysInMonth = new Date(y, m, 0).getDate();
      const todayStr = L.todayStr();

      // Ячейки предыдущего месяца (для заполнения).
      const prevDays = new Date(y, m - 1, 0).getDate();
      for (let i = startOffset - 1; i >= 0; i--) {
        const d = new Date(y, m - 2, prevDays - i);
        grid.appendChild(cell(d, true, todayStr));
      }
      for (let d = 1; d <= daysInMonth; d++) {
        grid.appendChild(cell(new Date(y, m - 1, d), false, todayStr));
      }
      // Добор до полных недель.
      const total = startOffset + daysInMonth;
      const tail = (7 - (total % 7)) % 7;
      for (let i = 1; i <= tail; i++) {
        grid.appendChild(cell(new Date(y, m, i), true, todayStr));
      }

      root.appendChild(grid);

      function cell(dateObj, other, todayStr) {
        const ds = L.dateStr(dateObj);
        const evs = eventsOn(ds);
        const tks = tasksOn(ds);
        const items = [];
        evs.slice(0, 3).forEach((e) =>
          items.push(L.h('div', { class: 'cal-ev', style: 'border-left-color:' + (e.color || L.palette[0]) },
            (e.time ? e.time + ' ' : '') + e.title))
        );
        tks.slice(0, Math.max(0, 3 - evs.length)).forEach((t) =>
          items.push(L.h('div', { class: 'cal-ev', style: 'border-left-color:var(--muted-2)' }, '✓ ' + t.title))
        );
        const extra = (evs.length + tks.length) - items.length;
        if (extra > 0) items.push(L.h('div', { class: 'tiny muted' }, '+' + extra + ' ещё'));

        const c = L.h('div', {
          class: 'cal-cell ' + (other ? 'other' : '') + (ds === todayStr ? ' today' : ''),
        }, [L.h('div', { class: 'cal-daynum' }, String(dateObj.getDate())), ...items]);
        c.addEventListener('click', () => openDay(ds));
        return c;
      }
    },
  };
})(window.L);

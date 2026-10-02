'use strict';

(function (L) {
  let tab = 'goals'; // goals | notes

  // ---------------- Цели ----------------
  function openGoalForm(goal) {
    const g = goal || { title: '', note: '', target: '', current: 0, unit: '', deadline: '' };

    const title = L.h('input', { type: 'text', value: g.title, placeholder: 'Например: Накопить на отпуск' });
    const target = L.h('input', { type: 'number', step: 'any', value: g.target, placeholder: '100' });
    const current = L.h('input', { type: 'number', step: 'any', value: g.current, placeholder: '0' });
    const unit = L.h('input', { type: 'text', value: g.unit, placeholder: 'шт, ₽, кг, книг…' });
    const deadline = L.h('input', { type: 'date', value: g.deadline || '' });
    const note = L.h('textarea', { placeholder: 'Описание (необязательно)' }, g.note || '');

    const save = L.h('button', { class: 'btn primary' }, goal ? 'Сохранить' : 'Добавить');
    save.addEventListener('click', async () => {
      const val = title.value.trim();
      if (!val) {
        L.toast('Введите название цели', 'error');
        title.focus();
        return;
      }
      const payload = {
        title: val,
        target: parseFloat(target.value) || 0,
        current: parseFloat(current.value) || 0,
        unit: unit.value.trim(),
        deadline: deadline.value || '',
        note: note.value.trim(),
      };
      if (goal) {
        await L.update('goals', goal.id, payload);
        L.toast('Цель обновлена', 'success');
      } else {
        await L.add('goals', Object.assign({ done: false }, payload));
        L.toast('Цель добавлена', 'success');
      }
      L.closeModal();
      L.render();
    });
    const cancel = L.h('button', { class: 'btn ghost' }, 'Отмена');
    cancel.addEventListener('click', L.closeModal);

    L.openModal({
      title: goal ? 'Редактировать цель' : 'Новая цель',
      body: L.h('div', {}, [
        L.field('Название', title),
        L.h('div', { class: 'field-row' }, [
          L.field('Текущее значение', current),
          L.field('Цель', target),
          L.field('Единица', unit),
        ]),
        L.field('Срок', deadline),
        L.field('Описание', note),
      ]),
      footer: [cancel, save],
    });
  }

  function adjustProgress(goal, delta) {
    const step = goal.target ? Math.max(1, Math.round(goal.target / 20)) : 1;
    let next = (Number(goal.current) || 0) + delta * step;
    if (next < 0) next = 0;
    const done = goal.target ? next >= goal.target : goal.done;
    L.update('goals', goal.id, { current: next, done }).then(() => L.render());
  }

  function goalCard(goal) {
    const target = Number(goal.target) || 0;
    const current = Number(goal.current) || 0;
    const pct = target ? Math.min(100, Math.round((current / target) * 100)) : goal.done ? 100 : 0;
    const complete = goal.done || (target && current >= target);

    const minus = L.h('button', { class: 'icon-btn', title: 'Убавить' }, '−');
    minus.addEventListener('click', () => adjustProgress(goal, -1));
    const plus = L.h('button', { class: 'icon-btn', title: 'Прибавить' }, '＋');
    plus.addEventListener('click', () => adjustProgress(goal, 1));

    const edit = L.h('button', { class: 'icon-btn', title: 'Редактировать' }, '✏️');
    edit.addEventListener('click', () => openGoalForm(goal));
    const del = L.h('button', { class: 'icon-btn', title: 'Удалить' }, '🗑');
    del.addEventListener('click', () =>
      L.confirm('Удалить цель «' + goal.title + '»?', async () => {
        await L.remove('goals', goal.id);
        L.toast('Цель удалена');
        L.render();
      }, { danger: true, yesText: 'Удалить' })
    );

    const meta = [];
    if (target) meta.push(L.h('span', { class: 'pill blue' }, current + ' / ' + target + (goal.unit ? ' ' + goal.unit : '')));
    if (goal.deadline) {
      const overdue = !complete && goal.deadline < L.todayStr();
      meta.push(L.h('span', { class: 'pill ' + (overdue ? 'red' : 'gray') }, '🏁 ' + L.fmtDateShort(goal.deadline) + ' · ' + L.relDays(goal.deadline)));
    }
    if (complete) meta.push(L.h('span', { class: 'pill green' }, '✓ Достигнуто'));

    return L.h('div', { class: 'card' }, [
      L.h('div', { class: 'flex between mb' }, [
        L.h('div', { style: 'font-weight:700;font-size:15px' }, goal.title),
        L.h('div', { class: 'actions', style: 'opacity:1' }, [minus, plus, edit, del]),
      ]),
      goal.note ? L.h('div', { class: 'muted tiny mb', style: 'margin-bottom:10px' }, goal.note) : null,
      L.h('div', { class: 'flex gap-sm wrap mb', style: 'margin-bottom:10px' }, meta),
      L.h('div', { class: 'progress' }, [L.h('span', { style: 'width:' + pct + '%' })]),
      L.h('div', { class: 'tiny muted', style: 'margin-top:6px;text-align:right' }, pct + '%'),
    ]);
  }

  // ---------------- Заметки ----------------
  function openNoteForm(note) {
    const n = note || { title: '', body: '' };
    const title = L.h('input', { type: 'text', value: n.title, placeholder: 'Заголовок' });
    const body = L.h('textarea', { placeholder: 'Текст заметки…', style: 'min-height:160px' }, n.body || '');

    const save = L.h('button', { class: 'btn primary' }, note ? 'Сохранить' : 'Добавить');
    save.addEventListener('click', async () => {
      const val = title.value.trim();
      if (!val && !body.value.trim()) {
        L.toast('Введите заголовок или текст', 'error');
        return;
      }
      const payload = { title: val || 'Без названия', body: body.value };
      if (note) {
        await L.update('notes', note.id, payload);
        L.toast('Заметка обновлена', 'success');
      } else {
        await L.add('notes', payload);
        L.toast('Заметка добавлена', 'success');
      }
      L.closeModal();
      L.render();
    });
    const cancel = L.h('button', { class: 'btn ghost' }, 'Отмена');
    cancel.addEventListener('click', L.closeModal);

    L.openModal({
      title: note ? 'Редактировать заметку' : 'Новая заметка',
      body: L.h('div', {}, [L.field('Заголовок', title), L.field('Текст', body)]),
      footer: [cancel, save],
    });
  }

  function noteCard(note) {
    const edit = L.h('button', { class: 'icon-btn', title: 'Редактировать' }, '✏️');
    edit.addEventListener('click', () => openNoteForm(note));
    const del = L.h('button', { class: 'icon-btn', title: 'Удалить' }, '🗑');
    del.addEventListener('click', () =>
      L.confirm('Удалить заметку «' + note.title + '»?', async () => {
        await L.remove('notes', note.id);
        L.toast('Заметка удалена');
        L.render();
      }, { danger: true, yesText: 'Удалить' })
    );
    const card = L.h('div', { class: 'card' }, [
      L.h('div', { class: 'flex between mb' }, [
        L.h('div', { style: 'font-weight:700' }, note.title),
        L.h('div', { class: 'actions', style: 'opacity:1' }, [edit, del]),
      ]),
      note.body ? L.h('div', { class: 'note-body' }, note.body) : null,
      L.h('div', { class: 'tiny muted', style: 'margin-top:10px' }, 'Изменено ' + L.fmtDate((note.updatedAt || note.createdAt || '').slice(0, 10))),
    ]);
    card.addEventListener('dblclick', () => openNoteForm(note));
    return card;
  }

  // ---------------- Представление ----------------
  L.views.goals = {
    title: 'Цели и заметки',
    subtitle: function () {
      const g = L.state.goals.length;
      const n = L.state.notes.length;
      return g + ' ' + L.plural(g, 'цель', 'цели', 'целей') + ' · ' + n + ' ' + L.plural(n, 'заметка', 'заметки', 'заметок');
    },
    actions: function () {
      const btn = L.h('button', { class: 'btn primary' }, tab === 'goals' ? '＋ Новая цель' : '＋ Новая заметка');
      btn.addEventListener('click', () => (tab === 'goals' ? openGoalForm(null) : openNoteForm(null)));
      return btn;
    },
    render: function (root) {
      const seg = L.h('div', { class: 'seg mb' }, [
        ['goals', '🎯 Цели'],
        ['notes', '📝 Заметки'],
      ].map(([k, label]) => {
        const b = L.h('button', { class: tab === k ? 'active' : '' }, label);
        b.addEventListener('click', () => {
          tab = k;
          L.render();
        });
        return b;
      }));
      root.appendChild(seg);

      if (tab === 'goals') {
        const goals = L.state.goals;
        if (!goals.length) {
          root.appendChild(L.empty('🎯', 'Целей пока нет', 'Поставьте цель и отслеживайте прогресс'));
          return;
        }
        const sorted = goals.slice().sort((a, b) => {
          const ad = (a.done || (a.target && a.current >= a.target)) ? 1 : 0;
          const bd = (b.done || (b.target && b.current >= b.target)) ? 1 : 0;
          return ad - bd;
        });
        root.appendChild(L.h('div', { class: 'grid cols-2' }, sorted.map(goalCard)));
      } else {
        const notes = L.state.notes;
        if (!notes.length) {
          root.appendChild(L.empty('📝', 'Заметок пока нет', 'Запишите мысль, идею или что угодно'));
          return;
        }
        const sorted = notes.slice().sort((a, b) => ((a.updatedAt || '') < (b.updatedAt || '') ? 1 : -1));
        root.appendChild(L.h('div', { class: 'grid cols-3' }, sorted.map(noteCard)));
      }
    },
  };
})(window.L);

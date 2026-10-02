'use strict';

(function (L) {
  const PRIO = {
    high: { label: 'Высокий', pill: 'red' },
    med: { label: 'Средний', pill: 'yellow' },
    low: { label: 'Низкий', pill: 'gray' },
  };

  let filter = 'active'; // all | active | done
  let search = '';

  function openForm(task) {
    const t = task || { title: '', note: '', priority: 'med', due: '' };

    const title = L.h('input', { type: 'text', value: t.title, placeholder: 'Что нужно сделать?' });
    const note = L.h('textarea', { placeholder: 'Заметка (необязательно)' }, t.note || '');
    const priority = L.h('select', {}, Object.keys(PRIO).map((k) =>
      L.h('option', { value: k, selected: t.priority === k ? 'selected' : false }, PRIO[k].label)
    ));
    const due = L.h('input', { type: 'date', value: t.due || '' });

    const save = L.h('button', { class: 'btn primary' }, task ? 'Сохранить' : 'Добавить');
    save.addEventListener('click', async () => {
      const val = title.value.trim();
      if (!val) {
        L.toast('Введите название задачи', 'error');
        title.focus();
        return;
      }
      const payload = {
        title: val,
        note: note.value.trim(),
        priority: priority.value,
        due: due.value || '',
      };
      if (task) {
        await L.update('tasks', task.id, payload);
        L.toast('Задача обновлена', 'success');
      } else {
        await L.add('tasks', Object.assign({ done: false, completedAt: null }, payload));
        L.toast('Задача добавлена', 'success');
      }
      L.closeModal();
      L.render();
    });
    const cancel = L.h('button', { class: 'btn ghost' }, 'Отмена');
    cancel.addEventListener('click', L.closeModal);

    title.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') save.click();
    });

    L.openModal({
      title: task ? 'Редактировать задачу' : 'Новая задача',
      body: L.h('div', {}, [
        L.field('Название', title),
        L.h('div', { class: 'field-row' }, [L.field('Приоритет', priority), L.field('Срок', due)]),
        L.field('Заметка', note),
      ]),
      footer: [cancel, save],
    });
  }

  async function toggle(task) {
    await L.update('tasks', task.id, {
      done: !task.done,
      completedAt: !task.done ? new Date().toISOString() : null,
    });
    L.render();
  }

  function taskRow(task) {
    const today = L.todayStr();
    const overdue = task.due && !task.done && task.due < today;
    const prio = PRIO[task.priority] || PRIO.med;

    const check = L.h('div', { class: 'checkbox ' + (task.done ? 'checked' : '') }, '✓');
    check.addEventListener('click', () => toggle(task));

    const subParts = [];
    if (task.due) {
      subParts.push(
        L.h('span', { class: 'pill ' + (overdue ? 'red' : 'blue') },
          '📅 ' + L.fmtDateShort(task.due) + ' · ' + L.relDays(task.due))
      );
    }
    subParts.push(L.h('span', { class: 'pill ' + prio.pill }, prio.label));
    if (task.note) subParts.push(L.h('span', { class: 'pill gray' }, '📝'));

    const edit = L.h('button', { class: 'icon-btn', title: 'Редактировать' }, '✏️');
    edit.addEventListener('click', () => openForm(task));
    const del = L.h('button', { class: 'icon-btn', title: 'Удалить' }, '🗑');
    del.addEventListener('click', () =>
      L.confirm('Удалить задачу «' + task.title + '»?', async () => {
        await L.remove('tasks', task.id);
        L.toast('Задача удалена');
        L.render();
      }, { danger: true, yesText: 'Удалить' })
    );

    return L.h('div', { class: 'row' }, [
      check,
      L.h('div', { class: 'grow' }, [
        L.h('div', { class: 'title ' + (task.done ? 'strike' : '') }, task.title),
        L.h('div', { class: 'sub flex wrap gap-sm' }, subParts),
      ]),
      L.h('div', { class: 'actions' }, [edit, del]),
    ]);
  }

  L.views.tasks = {
    title: 'Задачи',
    subtitle: function () {
      const active = L.state.tasks.filter((t) => !t.done).length;
      return active + ' ' + L.plural(active, 'активная задача', 'активные задачи', 'активных задач');
    },
    actions: function () {
      const btn = L.h('button', { class: 'btn primary' }, '＋ Новая задача');
      btn.addEventListener('click', () => openForm(null));
      return btn;
    },
    render: function (root) {
      const tasks = L.state.tasks;

      // Панель фильтров + поиск
      const seg = L.h('div', { class: 'seg' },
        [['active', 'Активные'], ['all', 'Все'], ['done', 'Выполненные']].map(([k, label]) => {
          const b = L.h('button', { class: filter === k ? 'active' : '' }, label);
          b.addEventListener('click', () => {
            filter = k;
            L.render();
          });
          return b;
        })
      );
      const searchInput = L.h('input', {
        type: 'text',
        placeholder: '🔎 Поиск…',
        value: search,
        style: 'max-width:260px',
      });
      searchInput.addEventListener('input', (e) => {
        search = e.target.value;
        renderList();
      });

      root.appendChild(
        L.h('div', { class: 'flex between wrap mb', style: 'gap:12px' }, [seg, searchInput])
      );

      const listWrap = L.h('div', {});
      root.appendChild(listWrap);

      function renderList() {
        listWrap.innerHTML = '';
        let items = tasks.slice();
        if (filter === 'active') items = items.filter((t) => !t.done);
        if (filter === 'done') items = items.filter((t) => t.done);
        if (search.trim()) {
          const q = search.trim().toLowerCase();
          items = items.filter(
            (t) =>
              t.title.toLowerCase().includes(q) ||
              (t.note || '').toLowerCase().includes(q)
          );
        }

        // Сортировка: невыполненные сначала, затем по сроку, затем по приоритету.
        const prioRank = { high: 0, med: 1, low: 2 };
        items.sort((a, b) => {
          if (a.done !== b.done) return a.done ? 1 : -1;
          const ad = a.due || '9999';
          const bd = b.due || '9999';
          if (ad !== bd) return ad < bd ? -1 : 1;
          return (prioRank[a.priority] ?? 1) - (prioRank[b.priority] ?? 1);
        });

        if (!items.length) {
          listWrap.appendChild(
            L.empty('🗒️', 'Задач нет', filter === 'done' ? 'Выполненные задачи появятся здесь' : 'Добавьте первую задачу кнопкой справа сверху')
          );
          return;
        }
        const list = L.h('div', { class: 'row-list' }, items.map(taskRow));
        listWrap.appendChild(list);
      }

      renderList();
    },
  };
})(window.L);

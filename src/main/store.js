'use strict';

const fs = require('fs');
const path = require('path');

/**
 * Хранилище данных LifeHub.
 *
 * Данные лежат локально в одном JSON-файле в папке пользователя
 * (app.getPath('userData')). Нет нативных зависимостей — приложение
 * собирается и запускается без компиляции C++ модулей.
 *
 * Слой намеренно сделан абстрактным (коллекции + CRUD), чтобы в будущем
 * его можно было заменить на SQLite или облачную синхронизацию,
 * не трогая остальной код.
 */

const COLLECTIONS = ['transactions', 'tasks', 'habits', 'goals', 'notes', 'events'];

function defaultData() {
  return {
    version: 1,
    settings: {
      currency: '₽',
      theme: 'dark',
      appName: 'LifeHub',
      firstDayOfWeek: 1, // понедельник
    },
    categories: {
      income: ['Зарплата', 'Подработка', 'Подарок', 'Проценты', 'Другое'],
      expense: ['Еда', 'Транспорт', 'Жильё', 'Развлечения', 'Здоровье', 'Покупки', 'Связь', 'Другое'],
    },
    budgets: {}, // { "Еда": 15000, ... } — месячный лимит по категории расходов
    transactions: [],
    tasks: [],
    habits: [],
    goals: [],
    notes: [],
    events: [],
  };
}

class Store {
  constructor(filePath) {
    this.filePath = filePath;
    this.data = null;
    this._load();
  }

  _load() {
    try {
      if (fs.existsSync(this.filePath)) {
        const raw = fs.readFileSync(this.filePath, 'utf-8');
        const parsed = JSON.parse(raw);
        this.data = this._migrate(parsed);
      } else {
        this.data = defaultData();
        this._persist();
      }
    } catch (err) {
      // Если файл повреждён — делаем резервную копию и начинаем заново,
      // чтобы приложение не падало при старте.
      console.error('[store] ошибка чтения данных:', err);
      try {
        if (fs.existsSync(this.filePath)) {
          const backup = this.filePath + '.corrupted-' + Date.now();
          fs.copyFileSync(this.filePath, backup);
          console.error('[store] повреждённый файл сохранён как', backup);
        }
      } catch (_) { /* no-op */ }
      this.data = defaultData();
      this._persist();
    }
  }

  // Приведение старых данных к актуальной структуре (на будущее).
  _migrate(parsed) {
    const base = defaultData();
    const merged = Object.assign({}, base, parsed);
    merged.settings = Object.assign({}, base.settings, parsed.settings || {});
    merged.categories = Object.assign({}, base.categories, parsed.categories || {});
    merged.budgets = Object.assign({}, base.budgets, parsed.budgets || {});
    for (const c of COLLECTIONS) {
      if (!Array.isArray(merged[c])) merged[c] = [];
    }
    return merged;
  }

  _persist() {
    const dir = path.dirname(this.filePath);
    fs.mkdirSync(dir, { recursive: true });
    // Атомарная запись: сначала во временный файл, затем переименование.
    const tmp = this.filePath + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(this.data, null, 2), 'utf-8');
    fs.renameSync(tmp, this.filePath);
  }

  _assertCollection(collection) {
    if (!COLLECTIONS.includes(collection)) {
      throw new Error('Неизвестная коллекция: ' + collection);
    }
  }

  _genId() {
    return (
      Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10)
    );
  }

  // ---- Весь срез данных ----
  getState() {
    return this.data;
  }

  // ---- Коллекции (CRUD) ----
  list(collection) {
    this._assertCollection(collection);
    return this.data[collection];
  }

  add(collection, item) {
    this._assertCollection(collection);
    const now = new Date().toISOString();
    const record = Object.assign(
      { id: this._genId(), createdAt: now, updatedAt: now },
      item
    );
    this.data[collection].push(record);
    this._persist();
    return record;
  }

  update(collection, id, patch) {
    this._assertCollection(collection);
    const arr = this.data[collection];
    const idx = arr.findIndex((r) => r.id === id);
    if (idx === -1) return null;
    arr[idx] = Object.assign({}, arr[idx], patch, {
      id,
      updatedAt: new Date().toISOString(),
    });
    this._persist();
    return arr[idx];
  }

  remove(collection, id) {
    this._assertCollection(collection);
    const arr = this.data[collection];
    const idx = arr.findIndex((r) => r.id === id);
    if (idx === -1) return false;
    arr.splice(idx, 1);
    this._persist();
    return true;
  }

  // ---- Настройки ----
  getSettings() {
    return this.data.settings;
  }

  setSettings(patch) {
    this.data.settings = Object.assign({}, this.data.settings, patch);
    this._persist();
    return this.data.settings;
  }

  // ---- Категории ----
  getCategories() {
    return this.data.categories;
  }

  setCategories(categories) {
    this.data.categories = Object.assign({}, this.data.categories, categories);
    this._persist();
    return this.data.categories;
  }

  // ---- Бюджеты ----
  getBudgets() {
    return this.data.budgets;
  }

  setBudgets(budgets) {
    this.data.budgets = Object.assign({}, budgets);
    this._persist();
    return this.data.budgets;
  }

  // ---- Экспорт / импорт ----
  exportAll() {
    return JSON.stringify(this.data, null, 2);
  }

  importAll(jsonString) {
    const parsed = JSON.parse(jsonString);
    this.data = this._migrate(parsed);
    this._persist();
    return this.data;
  }
}

module.exports = { Store, defaultData, COLLECTIONS };

'use strict';

const { app, BrowserWindow, ipcMain, dialog, Menu, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const { Store } = require('./store');

let store;
let mainWindow;

function getDataFilePath() {
  return path.join(app.getPath('userData'), 'lifehub-data.json');
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 940,
    minHeight: 600,
    backgroundColor: '#0f1221',
    title: 'LifeHub',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  mainWindow.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));

  // Внешние ссылки открываем в системном браузере, а не внутри приложения.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });
}

function buildMenu() {
  const isMac = process.platform === 'darwin';
  const template = [
    {
      label: 'Файл',
      submenu: [
        {
          label: 'Экспорт данных (бэкап)…',
          accelerator: 'CmdOrCtrl+E',
          click: () => mainWindow && mainWindow.webContents.send('menu:export'),
        },
        {
          label: 'Импорт данных…',
          accelerator: 'CmdOrCtrl+I',
          click: () => mainWindow && mainWindow.webContents.send('menu:import'),
        },
        { type: 'separator' },
        isMac ? { role: 'close', label: 'Закрыть' } : { role: 'quit', label: 'Выход' },
      ],
    },
    {
      label: 'Правка',
      submenu: [
        { role: 'undo', label: 'Отменить' },
        { role: 'redo', label: 'Повторить' },
        { type: 'separator' },
        { role: 'cut', label: 'Вырезать' },
        { role: 'copy', label: 'Копировать' },
        { role: 'paste', label: 'Вставить' },
        { role: 'selectAll', label: 'Выделить всё' },
      ],
    },
    {
      label: 'Вид',
      submenu: [
        { role: 'reload', label: 'Обновить' },
        { role: 'resetZoom', label: 'Сбросить масштаб' },
        { role: 'zoomIn', label: 'Увеличить' },
        { role: 'zoomOut', label: 'Уменьшить' },
        { type: 'separator' },
        { role: 'togglefullscreen', label: 'Полный экран' },
        { role: 'toggleDevTools', label: 'Инструменты разработчика' },
      ],
    },
    {
      label: 'Справка',
      submenu: [
        {
          label: 'О программе LifeHub',
          click: () => {
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: 'О программе',
              message: 'LifeHub',
              detail:
                'Трекер жизни: финансы, задачи, привычки, цели, заметки и календарь.\n' +
                'Версия ' + app.getVersion() + '\n\n' +
                'Данные хранятся локально на вашем компьютере:\n' +
                getDataFilePath(),
              buttons: ['OK'],
            });
          },
        },
        {
          label: 'Папка с данными',
          click: () => shell.showItemInFolder(getDataFilePath()),
        },
      ],
    },
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

// ---------------------------------------------------------------------------
// IPC: мост между интерфейсом и хранилищем
// ---------------------------------------------------------------------------
function registerIpc() {
  ipcMain.handle('state:get', () => store.getState());

  ipcMain.handle('collection:list', (_e, collection) => store.list(collection));
  ipcMain.handle('collection:add', (_e, collection, item) => store.add(collection, item));
  ipcMain.handle('collection:update', (_e, collection, id, patch) =>
    store.update(collection, id, patch)
  );
  ipcMain.handle('collection:remove', (_e, collection, id) => store.remove(collection, id));

  ipcMain.handle('settings:get', () => store.getSettings());
  ipcMain.handle('settings:set', (_e, patch) => store.setSettings(patch));

  ipcMain.handle('categories:get', () => store.getCategories());
  ipcMain.handle('categories:set', (_e, categories) => store.setCategories(categories));

  ipcMain.handle('budgets:get', () => store.getBudgets());
  ipcMain.handle('budgets:set', (_e, budgets) => store.setBudgets(budgets));

  // Экспорт: системный диалог сохранения файла.
  ipcMain.handle('data:export', async () => {
    const stamp = new Date().toISOString().slice(0, 10);
    const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
      title: 'Экспорт данных LifeHub',
      defaultPath: 'lifehub-backup-' + stamp + '.json',
      filters: [{ name: 'LifeHub backup', extensions: ['json'] }],
    });
    if (canceled || !filePath) return { ok: false, canceled: true };
    fs.writeFileSync(filePath, store.exportAll(), 'utf-8');
    return { ok: true, filePath };
  });

  // Импорт: системный диалог выбора файла.
  ipcMain.handle('data:import', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
      title: 'Импорт данных LifeHub',
      filters: [{ name: 'LifeHub backup', extensions: ['json'] }],
      properties: ['openFile'],
    });
    if (canceled || !filePaths || !filePaths[0]) return { ok: false, canceled: true };

    const confirm = await dialog.showMessageBox(mainWindow, {
      type: 'warning',
      title: 'Импорт данных',
      message: 'Заменить все текущие данные данными из файла?',
      detail: 'Текущие данные будут перезаписаны. Рекомендуем сначала сделать экспорт (бэкап).',
      buttons: ['Отмена', 'Заменить'],
      defaultId: 0,
      cancelId: 0,
    });
    if (confirm.response !== 1) return { ok: false, canceled: true };

    try {
      const raw = fs.readFileSync(filePaths[0], 'utf-8');
      store.importAll(raw);
      return { ok: true, state: store.getState() };
    } catch (err) {
      return { ok: false, error: String(err && err.message ? err.message : err) };
    }
  });
}

app.whenReady().then(() => {
  store = new Store(getDataFilePath());
  registerIpc();
  buildMenu();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

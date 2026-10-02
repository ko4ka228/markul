'use strict';

const { contextBridge, ipcRenderer } = require('electron');

/**
 * Безопасный мост между интерфейсом (renderer) и основным процессом.
 * Интерфейс работает без доступа к Node — только через этот API.
 */
contextBridge.exposeInMainWorld('api', {
  getState: () => ipcRenderer.invoke('state:get'),

  list: (collection) => ipcRenderer.invoke('collection:list', collection),
  add: (collection, item) => ipcRenderer.invoke('collection:add', collection, item),
  update: (collection, id, patch) =>
    ipcRenderer.invoke('collection:update', collection, id, patch),
  remove: (collection, id) => ipcRenderer.invoke('collection:remove', collection, id),

  getSettings: () => ipcRenderer.invoke('settings:get'),
  setSettings: (patch) => ipcRenderer.invoke('settings:set', patch),

  getCategories: () => ipcRenderer.invoke('categories:get'),
  setCategories: (categories) => ipcRenderer.invoke('categories:set', categories),

  getBudgets: () => ipcRenderer.invoke('budgets:get'),
  setBudgets: (budgets) => ipcRenderer.invoke('budgets:set', budgets),

  exportData: () => ipcRenderer.invoke('data:export'),
  importData: () => ipcRenderer.invoke('data:import'),

  // События из меню приложения.
  onMenu: (channel, handler) => {
    const allowed = ['menu:export', 'menu:import'];
    if (!allowed.includes(channel)) return;
    ipcRenderer.on(channel, () => handler());
  },
});

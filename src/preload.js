const { contextBridge, ipcRenderer } = require('electron');

const call = (ch) => (...args) => ipcRenderer.invoke(ch, ...args);
contextBridge.exposeInMainWorld('fuse', {
  apps: call('apps:list'),
  refreshApps: call('apps:refresh'),
  prefetch: call('fuse:prefetch'),
  setSpeed: call('speed:set'),
  setProvider: call('provider:set'),
  keyStatus: call('key:status'),
  setKey: call('key:set'),
  ideas: call('fuse:ideas'),
  build: call('fuse:build'),
  refine: call('fuse:refine'),
  stop: call('fuse:stop'),
  openAutomation: call('open:automation'),
  onStage: (fn) => ipcRenderer.on('fuse:stage', (_e, s) => fn(s)),
  check: call('fuse:check'),
  run: call('fuse:run'),
  fusions: call('fusions:list'),
  saveFusion: call('fusions:save'),
  deleteFusion: call('fusions:delete'),
  openUrl: call('open:url'),
  checkUpdate: call('update:check'),
  version: call('app:version'),
  prefs: call('prefs:get'),
  setPrefs: call('prefs:set'),
});

// Adds "Join the Hollowbit Discord" to the Help menu.
const { app, Menu, MenuItem, shell } = require('electron');

const DISCORD_URL = 'https://discord.gg/ENSTjVpJj8';

function addDiscordMenu() {
  const item = new MenuItem({ label: 'Join the Hollowbit Discord', click: () => shell.openExternal(DISCORD_URL) });
  let menu = Menu.getApplicationMenu();
  if (!menu) {
    const isMac = process.platform === 'darwin';
    menu = Menu.buildFromTemplate([
      ...(isMac ? [{ role: 'appMenu' }] : []),
      { role: 'fileMenu' }, { role: 'editMenu' }, { role: 'viewMenu' }, { role: 'windowMenu' },
      { role: 'help', submenu: [] },
    ]);
  }
  let help = menu.items.find((i) => i.role === 'help');
  if (!help) { help = new MenuItem({ role: 'help', submenu: [] }); menu.append(help); }
  // Swap Electron's own "Learn More" etc. for our link.
  const sub = new Menu();
  sub.append(item);
  menu = Menu.buildFromTemplate(menu.items.map((i) => (i === help ? { role: 'help', submenu: sub } : i)));
  Menu.setApplicationMenu(menu);
}

module.exports = { addDiscordMenu, DISCORD_URL };

const { app, BrowserWindow, globalShortcut, Tray, Menu, ipcMain, net } = require('electron');
const path = require('path');
const Store = require('electron-store');

const store = new Store();
let mainWindow = null;
let reportWindow = null;
let tray = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    },
    show: false,
    icon: path.join(__dirname, 'assets/icon.png')
  });

  mainWindow.loadFile('index.html');

  // Show window when ready
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // Hide to tray instead of closing
  mainWindow.on('close', (event) => {
    if (!app.isQuitting) {
      event.preventDefault();
      mainWindow.hide();
    }
    return false;
  });
}

function createTray() {
  tray = new Tray(path.join(__dirname, 'assets/tray-icon.png'));
  
  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Show App',
      click: () => {
        mainWindow.show();
      }
    },
    {
      label: 'Quit',
      click: () => {
        app.isQuitting = true;
        app.quit();
      }
    }
  ]);

  tray.setToolTip('TimeTracker');
  tray.setContextMenu(contextMenu);
  
  tray.on('click', () => {
    mainWindow.isVisible() ? mainWindow.hide() : mainWindow.show();
  });
}

app.whenReady().then(() => {
  createWindow();
  createTray();

  // Register global hotkey (Ctrl+Shift+T or Cmd+Shift+T)
  const ret = globalShortcut.register('CommandOrControl+Shift+T', () => {
    if (mainWindow.isVisible()) {
      mainWindow.hide();
    } else {
      mainWindow.show();
      mainWindow.focus();
    }
  });

  if (!ret) {
    console.log('Global shortcut registration failed');
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});

// IPC Handlers for data persistence
ipcMain.handle('store-get', (event, key) => {
  return store.get(key);
});

ipcMain.handle('store-set', (event, key, value) => {
  store.set(key, value);
  return true;
});

ipcMain.handle('store-delete', (event, key) => {
  store.delete(key);
  return true;
});

// Open report window
ipcMain.handle('open-report', () => {
  if (reportWindow && !reportWindow.isDestroyed()) {
    reportWindow.focus();
    return;
  }

  reportWindow = new BrowserWindow({
    width: 1000,
    height: 800,
    minWidth: 700,
    minHeight: 500,
    title: 'TimeTracker — Report',
    parent: mainWindow,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    },   
    icon: path.join(__dirname, 'assets/icon.png')
  });

  reportWindow.loadFile('report.html');

  reportWindow.once('ready-to-show', () => {
    reportWindow.show();
  });

  reportWindow.on('closed', () => {
    reportWindow = null;
  });

  // Remove default menu bar so only print shortcut works
  reportWindow.setMenuBarVisibility(false);
});

ipcMain.handle('logTime', async (event, { domain, credentials, issueKey, timeSpent, started }) => {
  return new Promise((resolve, reject) => {
    const request = net.request({

      method: 'POST',
      url: `${domain}/rest/api/3/issue/${issueKey}/worklog`,
    });
    request.setHeader('authority', 'firemon.atlassian.net')
    request.setHeader('Authorization', `Basic ${credentials}`);
    request.setHeader('Content-Type', 'application/json');
    request.setHeader('Accept', '*/*');
    request.setHeader('X-Atlassian-Token', 'no-check');

    let body = '';
    request.on('response', (response) => {
      response.on('data', (chunk) => { body += chunk; });
      response.on('end', () => {
        if (response.statusCode >= 200 && response.statusCode < 300) {
          resolve(JSON.parse(body));
        } else {
          reject(new Error(`Jira API error: ${response.statusCode} - ${body}`));
        }
      });
    });
    request.on('error', reject);
    request.write(JSON.stringify({ timeSpent, started }));
    request.end();
  });
});

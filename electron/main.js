// VoiceScript desktop shell.
// Serves index.html from a private app:// origin (a secure context, so the
// microphone, clipboard, Web Workers and the model cache all behave like
// they do on an https site) and opens it in a single window.
const { app, BrowserWindow, protocol, net, session, shell } = require('electron');
const path = require('path');
const { pathToFileURL } = require('url');

const ROOT = path.join(__dirname, '..');
const ALLOWED_FILES = new Set(['index.html']);

protocol.registerSchemesAsPrivileged([
  {
    scheme: 'app',
    privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true },
  },
]);

function createWindow() {
  const win = new BrowserWindow({
    width: 1100,
    height: 820,
    minWidth: 420,
    minHeight: 560,
    title: 'VoiceScript',
    backgroundColor: '#07080a',
    titleBarStyle: 'hiddenInset',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
    },
  });

  // Links that try to open a new window go to the default browser instead.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (e, url) => {
    if (!url.startsWith('app://voicescript/')) {
      e.preventDefault();
      if (/^https?:/.test(url)) shell.openExternal(url);
    }
  });

  // Make room for the macOS window buttons and let the header drag the window.
  win.webContents.on('dom-ready', () => {
    win.webContents.insertCSS(`
      header { padding-left: 92px !important; -webkit-app-region: drag; user-select: none; }
      header button, header select, header a, header input, header label { -webkit-app-region: no-drag; }
    `);
  });

  win.loadURL('app://voicescript/index.html');
}

app.whenReady().then(() => {
  protocol.handle('app', (request) => {
    const { pathname } = new URL(request.url);
    const file = decodeURIComponent(pathname).replace(/^\/+/, '') || 'index.html';
    if (!ALLOWED_FILES.has(file)) return new Response('Not found', { status: 404 });
    return net.fetch(pathToFileURL(path.join(ROOT, file)).toString());
  });

  const ALLOWED_PERMISSIONS = new Set(['media', 'clipboard-sanitized-write', 'clipboard-read']);
  session.defaultSession.setPermissionRequestHandler((wc, permission, callback) => {
    callback(ALLOWED_PERMISSIONS.has(permission));
  });
  session.defaultSession.setPermissionCheckHandler((wc, permission) => ALLOWED_PERMISSIONS.has(permission));

  // macOS shows its own microphone prompt the first time you record.
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

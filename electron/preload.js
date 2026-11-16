// Lets index.html know it is running inside the desktop app.
const { contextBridge } = require('electron');
contextBridge.exposeInMainWorld('voiceScriptApp', { desktop: true, platform: process.platform });

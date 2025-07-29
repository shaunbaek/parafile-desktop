// Simple script to test if tray functionality works
const { app, BrowserWindow, Tray, Menu, nativeImage } = require('electron');
const path = require('path');

let mainWindow;
let tray;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 400,
    height: 300,
    show: true,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  mainWindow.loadURL('data:text/html,<h1>ParaFile Test Window</h1><p>Close this window to test tray functionality</p>');
  
  mainWindow.on('close', (event) => {
    event.preventDefault();
    mainWindow.hide();
    console.log('Window hidden - check system tray');
  });
}

function createTray() {
  // Create empty icon for testing
  const icon = nativeImage.createEmpty();
  tray = new Tray(icon);
  
  tray.setToolTip('ParaFile Test');
  
  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Show Window',
      click: () => {
        console.log('Menu clicked - showing window');
        mainWindow.show();
      }
    },
    {
      label: 'Quit',
      click: () => {
        app.quit();
      }
    }
  ]);
  
  tray.setContextMenu(contextMenu);
  
  tray.on('click', () => {
    console.log('Tray clicked!');
    if (mainWindow.isVisible()) {
      mainWindow.hide();
      console.log('Window hidden');
    } else {
      mainWindow.show();
      console.log('Window shown');
    }
  });

  console.log('Tray created successfully');
}

app.whenReady().then(() => {
  createWindow();
  createTray();
});

app.on('window-all-closed', () => {
  // Don't quit - keep in tray
});

console.log('Starting ParaFile tray test...');
console.log('1. Close the window to hide it');
console.log('2. Click the tray icon to show it again');
console.log('3. Check console for debug messages');
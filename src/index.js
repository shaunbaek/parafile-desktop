const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('node:path');
require('dotenv').config();

// Services
const configManager = require('./config/configManager');
const fileMonitor = require('./services/fileMonitor');
const documentProcessor = require('./services/documentProcessor');

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require('electron-squirrel-startup')) {
  app.quit();
}

let mainWindow;
let isMonitoring = false;

const createWindow = () => {
  // Create the browser window.
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 900,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: true,
      contextIsolation: false
    },
  });

  // Load the index.html of the app.
  mainWindow.loadFile(path.join(__dirname, 'index.html'));

  // Only open DevTools in development
  // mainWindow.webContents.openDevTools();
};

// App ready
app.whenReady().then(() => {
  createWindow();
  setupIPCHandlers();
  setupFileMonitor();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// Quit when all windows are closed
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    fileMonitor.stop();
    app.quit();
  }
});

// Setup IPC handlers
function setupIPCHandlers() {
  // Config management
  ipcMain.handle('config:load', async () => {
    return await configManager.load();
  });

  ipcMain.handle('config:addCategory', async (event, category) => {
    return await configManager.addCategory(category);
  });

  ipcMain.handle('config:updateCategory', async (event, index, category) => {
    return await configManager.updateCategory(index, category);
  });

  ipcMain.handle('config:deleteCategory', async (event, index) => {
    return await configManager.deleteCategory(index);
  });

  ipcMain.handle('config:addVariable', async (event, variable) => {
    return await configManager.addVariable(variable);
  });

  ipcMain.handle('config:updateVariable', async (event, index, variable) => {
    return await configManager.updateVariable(index, variable);
  });

  ipcMain.handle('config:deleteVariable', async (event, index) => {
    return await configManager.deleteVariable(index);
  });

  ipcMain.handle('config:updateSettings', async (event, settings) => {
    return await configManager.updateSettings(settings);
  });

  // File monitoring
  ipcMain.handle('monitor:start', async (event, folderPath) => {
    if (!isMonitoring) {
      const fs = require('fs');
      
      // Validate the folder path exists and is accessible
      try {
        const stats = fs.statSync(folderPath);
        if (!stats.isDirectory()) {
          throw new Error('Selected path is not a directory');
        }
      } catch (error) {
        mainWindow.webContents.send('monitor:error', `Invalid folder path: ${error.message}`);
        return false;
      }
      
      fileMonitor.start(folderPath);
      isMonitoring = true;
      mainWindow.webContents.send('monitor:status', true);
    }
    return true;
  });

  ipcMain.handle('monitor:stop', async () => {
    if (isMonitoring) {
      fileMonitor.stop();
      isMonitoring = false;
      mainWindow.webContents.send('monitor:status', false);
    }
    return true;
  });

  ipcMain.handle('monitor:status', async () => {
    return isMonitoring;
  });

  // Dialog
  ipcMain.handle('dialog:openDirectory', async () => {
    return await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory']
    });
  });
}

// Setup file monitor event handlers
function setupFileMonitor() {
  fileMonitor.on('file-detected', async (fileInfo) => {
    try {
      const config = await configManager.load();
      const result = await documentProcessor.processDocument(fileInfo, config);
      
      mainWindow.webContents.send('file:processed', result);
      
      if (result.success) {
        console.log(`Successfully processed: ${result.fileName} -> ${result.newName}`);
      } else {
        console.error(`Failed to process: ${result.fileName} - ${result.error}`);
      }
    } catch (error) {
      console.error('Error processing document:', error);
      mainWindow.webContents.send('monitor:error', error.message);
    }
  });

  fileMonitor.on('error', (error) => {
    console.error('File monitor error:', error);
    mainWindow.webContents.send('monitor:error', error.message);
  });

  fileMonitor.on('started', () => {
    console.log('File monitoring started');
    isMonitoring = true;
    if (mainWindow) {
      mainWindow.webContents.send('monitor:status', true);
    }
  });

  fileMonitor.on('stopped', () => {
    console.log('File monitoring stopped');
    isMonitoring = false;
    if (mainWindow) {
      mainWindow.webContents.send('monitor:status', false);
    }
  });
}

// Command line handling
if (process.argv.length > 2) {
  const command = process.argv[2];
  
  if (command === 'monitor') {
    // Start monitoring service without GUI
    console.log('Starting monitoring service...');
    
    // Prevent GUI from opening
    app.whenReady().then(async () => {
      const config = await configManager.load();
      if (!config.watched_folder) {
        console.error('No watched folder configured. Please run the GUI first to configure.');
        app.quit();
        return;
      }
      
      fileMonitor.start(config.watched_folder);
      console.log(`Monitoring folder: ${config.watched_folder}`);
      
      fileMonitor.on('file-detected', async (fileInfo) => {
        try {
          const result = await documentProcessor.processDocument(fileInfo, config);
          if (result.success) {
            console.log(`✓ ${result.fileName} -> ${result.newName} [${result.category}]`);
          } else {
            console.error(`✗ ${result.fileName} - ${result.error}`);
          }
        } catch (error) {
          console.error('Error processing document:', error);
        }
      });
    });
    
    // Override the GUI creation
    createWindow = () => {};
  }
}
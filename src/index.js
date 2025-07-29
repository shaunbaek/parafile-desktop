const { app, BrowserWindow, ipcMain, dialog, Tray, Menu, nativeImage, globalShortcut } = require('electron');
const path = require('node:path');
require('dotenv').config();

// Services
const configManager = require('./config/configManager');
const fileMonitor = require('./services/fileMonitor');
const documentProcessor = require('./services/documentProcessor');
const autoLauncher = require('./utils/autoLauncher');

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require('electron-squirrel-startup')) {
  app.quit();
}

let mainWindow;
let isMonitoring = false;
let tray = null;
let isQuitting = false;

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
    icon: path.join(__dirname, 'assets/icon.png'),
    show: false, // Don't show until ready
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#FBFDFB'
  });

  // Load the index.html of the app.
  mainWindow.loadFile(path.join(__dirname, 'index.html'));

  // Show window when ready
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // Handle window close to minimize to tray instead
  mainWindow.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault();
      mainWindow.hide();
    }
  });

  // Only open DevTools in development
  // mainWindow.webContents.openDevTools();
};

// Create system tray
function createTray() {
  try {
    // Create a tray icon
    const iconPath = path.join(__dirname, 'assets/tray-icon.png');
    let trayIcon;
    
    try {
      trayIcon = nativeImage.createFromPath(iconPath);
      if (trayIcon.isEmpty()) {
        // Fallback to a simple template icon
        trayIcon = nativeImage.createEmpty();
      }
    } catch (error) {
      console.log('Using empty icon due to error:', error.message);
      trayIcon = nativeImage.createEmpty();
    }
    
    tray = new Tray(trayIcon);
    
    // Set tooltip
    tray.setToolTip('ParaFile - Document Organizer');
    
    // Create context menu
    updateTrayMenu();
    
    // Click to show/hide window (works on Windows and Linux)
    tray.on('click', () => {
      console.log('Tray icon clicked');
      showMainWindow();
    });
    
    // Double-click for macOS compatibility
    tray.on('double-click', () => {
      console.log('Tray icon double-clicked');
      showMainWindow();
    });
    
    console.log('System tray created successfully');
  } catch (error) {
    console.error('Failed to create system tray:', error);
  }
}

// Function to properly show the main window
function showMainWindow() {
  if (mainWindow) {
    if (mainWindow.isVisible() && mainWindow.isFocused()) {
      console.log('Hiding window');
      mainWindow.hide();
    } else {
      console.log('Showing and focusing window');
      mainWindow.show();
      
      // Ensure window is brought to front on all platforms
      if (process.platform === 'darwin') {
        app.focus();
      }
      
      mainWindow.focus();
      mainWindow.setAlwaysOnTop(true);
      mainWindow.setAlwaysOnTop(false);
    }
  }
}

// Update tray menu based on monitoring status
async function updateTrayMenu() {
  const config = await configManager.load();
  const watchedFolder = config.watched_folder ? path.basename(config.watched_folder) : 'No folder selected';
  
  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Open ParaFile',
      click: () => {
        showMainWindow();
      }
    },
    {
      type: 'separator'
    },
    {
      label: isMonitoring ? '⏸️ Stop Monitoring' : '▶️ Start Monitoring',
      click: async () => {
        if (isMonitoring) {
          fileMonitor.stop();
          isMonitoring = false;
        } else {
          const config = await configManager.load();
          if (config.watched_folder) {
            fileMonitor.start(config.watched_folder);
            isMonitoring = true;
          }
        }
        updateTrayMenu();
      },
      enabled: config.watched_folder ? true : false
    },
    {
      label: `📁 ${watchedFolder}`,
      enabled: false
    },
    {
      label: `📊 Status: ${isMonitoring ? 'Monitoring' : 'Stopped'}`,
      enabled: false
    },
    {
      type: 'separator'
    },
    {
      label: 'Open Watched Folder',
      click: () => {
        if (config.watched_folder) {
          require('electron').shell.openPath(config.watched_folder);
        }
      },
      enabled: config.watched_folder ? true : false
    },
    {
      type: 'separator'
    },
    {
      label: 'Settings',
      click: () => {
        showMainWindow();
      }
    },
    {
      type: 'separator'
    },
    {
      label: 'Quit ParaFile',
      click: () => {
        isQuitting = true;
        app.quit();
      }
    }
  ]);
  
  tray.setContextMenu(contextMenu);
}

// App ready
app.whenReady().then(() => {
  createWindow();
  createTray();
  setupIPCHandlers();
  setupFileMonitor();
  setupGlobalShortcuts();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// Setup global shortcuts
function setupGlobalShortcuts() {
  try {
    // Register a global shortcut to show/hide the window
    globalShortcut.register('CommandOrControl+Shift+P', () => {
      console.log('Global shortcut triggered');
      showMainWindow();
    });
    
    console.log('Global shortcut registered: Ctrl+Shift+P (Cmd+Shift+P on Mac)');
  } catch (error) {
    console.log('Could not register global shortcut:', error.message);
  }
}

// Failsafe: Create a way to reopen window via file system
function createFailsafe() {
  const fs = require('fs');
  const failsafePath = path.join(app.getPath('userData'), 'show-window.txt');
  
  // Watch for a special file that can trigger window showing
  if (fs.existsSync(failsafePath)) {
    fs.unlinkSync(failsafePath);
  }
  
  const watcher = require('chokidar').watch(failsafePath);
  watcher.on('add', () => {
    console.log('Failsafe triggered - showing window');
    showMainWindow();
    // Clean up the file
    setTimeout(() => {
      if (fs.existsSync(failsafePath)) {
        fs.unlinkSync(failsafePath);
      }
    }, 1000);
  });
}

// Don't quit when all windows are closed (keep in tray)
app.on('window-all-closed', () => {
  // Do nothing - keep app running in tray
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

  // Auto-launch
  ipcMain.handle('auto-launch:isEnabled', async () => {
    return await autoLauncher.isEnabled();
  });

  ipcMain.handle('auto-launch:toggle', async () => {
    return await autoLauncher.toggle();
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
        
        // Show system notification when app is in background
        if (!mainWindow.isVisible()) {
          const { Notification } = require('electron');
          if (Notification.isSupported()) {
            new Notification({
              title: 'Document Processed',
              body: `${result.fileName} → ${result.category}`,
              icon: path.join(__dirname, 'assets/icon.png')
            }).show();
          }
        }
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
    updateTrayMenu();
  });

  fileMonitor.on('stopped', () => {
    console.log('File monitoring stopped');
    isMonitoring = false;
    if (mainWindow) {
      mainWindow.webContents.send('monitor:status', false);
    }
    updateTrayMenu();
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
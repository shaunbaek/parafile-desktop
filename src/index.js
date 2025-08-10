const { app, BrowserWindow, ipcMain, dialog, Tray, Menu, nativeImage, globalShortcut, Notification, shell } = require('electron');
const path = require('node:path');
const fs = require('fs');
require('dotenv').config();

// Services
const configManager = require('./config/configManager');
const fileMonitor = require('./services/fileMonitor');
const documentProcessor = require('./services/documentProcessor');
const aiService = require('./services/aiService');
const AutoUpdaterService = require('./services/autoUpdater');
const textExtractor = require('./services/textExtractor');

// Initialize auto-updater
let autoUpdater = null;

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require('electron-squirrel-startup')) {
  app.quit();
}

let mainWindow;
let logWindow = null;
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
  mainWindow.once('ready-to-show', async () => {
    mainWindow.show();
    
    // Auto-start monitoring if configured
    const config = await configManager.load();
    if (config.auto_start_monitoring && config.watched_folder && config.openai_api_key) {
      console.log('Auto-starting file monitoring...');
      setTimeout(async () => {
        try {
          fileMonitor.start(config.watched_folder);
          isMonitoring = true;
          mainWindow.webContents.send('monitor:status', true);
          mainWindow.webContents.send('monitor:auto-started', true);
          updateTrayMenu();
          console.log('File monitoring auto-started successfully');
        } catch (error) {
          console.error('Failed to auto-start monitoring:', error);
          mainWindow.webContents.send('monitor:error', `Failed to auto-start monitoring: ${error.message}`);
        }
      }, 2000); // Delay to ensure renderer is ready
    }
  });

  // Handle window close based on user preference
  mainWindow.on('close', async (event) => {
    if (!isQuitting) {
      event.preventDefault();
      
      // Ask renderer for the minimize to tray preference
      const shouldMinimize = await mainWindow.webContents.executeJavaScript('localStorage.getItem("minimizeToTray") === "true"');
      
      if (shouldMinimize) {
        mainWindow.hide();
      } else {
        isQuitting = true;
        app.quit();
      }
    }
  });

  // Only open DevTools in development
  // mainWindow.webContents.openDevTools();
};

// Create processing log window
const createLogWindow = () => {
  // Don't create if already exists
  if (logWindow && !logWindow.isDestroyed()) {
    logWindow.focus();
    return logWindow;
  }

  logWindow = new BrowserWindow({
    width: 1400,
    height: 800,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    },
    icon: path.join(__dirname, 'assets/icon.png'),
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#FBFDFB',
    parent: mainWindow,
    modal: false
  });

  logWindow.loadFile(path.join(__dirname, 'processing-log.html'));

  logWindow.on('closed', () => {
    logWindow = null;
  });

  return logWindow;
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
            // Test API key before starting
            if (config.openai_api_key) {
              try {
                const { OpenAI } = require('openai');
                const openai = new OpenAI({ apiKey: config.openai_api_key });
                await openai.models.list();
                
                fileMonitor.start(config.watched_folder);
                isMonitoring = true;
              } catch (error) {
                console.error('API key validation failed:', error);
                // Show notification if main window exists
                if (mainWindow) {
                  mainWindow.webContents.send('monitor:error', 'Invalid OpenAI API key. Please check your settings.');
                }
              }
            } else {
              // Show notification if main window exists
              if (mainWindow) {
                mainWindow.webContents.send('monitor:error', 'OpenAI API key not configured. Please set it in Settings.');
              }
            }
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
  
  // Initialize auto-updater
  if (process.env.NODE_ENV !== 'development') {
    autoUpdater = new AutoUpdaterService();
    // Check for updates after 3 seconds
    setTimeout(() => {
      autoUpdater.checkForUpdates();
    }, 3000);
  }

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

// Get file list for search based on scope
async function getFileList(scope, watchedFolder) {
  const fileList = [];
  const supportedExtensions = [
    '.pdf', '.doc', '.docx',  // Documents
    '.csv', '.xlsx', '.xls',  // Spreadsheets
    '.png', '.jpg', '.jpeg', '.gif', '.bmp', '.tiff', '.webp'  // Images
  ];
  
  try {
    let searchPaths = [];
    
    if (scope === 'watched') {
      if (!watchedFolder || !fs.existsSync(watchedFolder)) {
        return [];
      }
      searchPaths = [watchedFolder];
    } else {
      // Computer-wide search - common document locations
      const os = require('os');
      const commonPaths = [
        path.join(os.homedir(), 'Documents'),
        path.join(os.homedir(), 'Downloads'),
        path.join(os.homedir(), 'Desktop')
      ];
      
      searchPaths = commonPaths.filter(p => fs.existsSync(p));
    }
    
    for (const searchPath of searchPaths) {
      await scanDirectory(searchPath, fileList, supportedExtensions, scope === 'computer' ? 2 : 10); // Limit depth for computer-wide
    }
    
    return fileList;
  } catch (error) {
    console.error('Error getting file list:', error);
    return [];
  }
}

// Recursively scan directory for supported files
async function scanDirectory(dirPath, fileList, extensions, maxDepth, currentDepth = 0) {
  if (currentDepth > maxDepth) return;
  
  try {
    const items = fs.readdirSync(dirPath);
    
    for (const item of items) {
      const itemPath = path.join(dirPath, item);
      const stats = fs.statSync(itemPath);
      
      if (stats.isDirectory()) {
        // Skip hidden directories and node_modules
        if (!item.startsWith('.') && item !== 'node_modules') {
          await scanDirectory(itemPath, fileList, extensions, maxDepth, currentDepth + 1);
        }
      } else if (stats.isFile()) {
        const ext = path.extname(item).toLowerCase();
        if (extensions.includes(ext)) {
          let content = '';
          
          try {
            // Extract a small preview of the document content
            const fileType = ext.substring(1); // Remove the dot
            const result = await textExtractor.extractText(itemPath, fileType);
            content = result.text ? result.text.substring(0, 500) : '';
          } catch (extractError) {
            // If extraction fails, still include the file but without content
            console.log(`Could not extract content from ${itemPath}:`, extractError.message);
          }
          
          fileList.push({
            filename: item,
            path: itemPath,
            content: content
          });
        }
      }
    }
  } catch (error) {
    console.log(`Could not scan directory ${dirPath}:`, error.message);
  }
}

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


  // API testing
  ipcMain.handle('api:testKey', async (event, apiKey) => {
    try {
      const { OpenAI } = require('openai');
      const openai = new OpenAI({ apiKey });
      
      // Simple test call to validate the API key
      await openai.models.list();
      
      return { success: true };
    } catch (error) {
      let errorMessage = 'Unknown error';
      
      if (error.status === 401) {
        errorMessage = 'Invalid API key';
      } else if (error.status === 429) {
        errorMessage = 'Rate limit exceeded or insufficient credits';
      } else if (error.code === 'ENOTFOUND') {
        errorMessage = 'Network connection failed';
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      return { success: false, error: errorMessage };
    }
  });

  // AI variable generation
  ipcMain.handle('api:generateVariable', async (event, prompt) => {
    try {
      const config = await configManager.load();
      if (!config.openai_api_key) {
        throw new Error('OpenAI API key not configured');
      }
      
      aiService.initialize(config.openai_api_key);
      const result = await aiService.generateVariableSuggestion(prompt, config.expertise);
      
      return { success: true, suggestion: result };
    } catch (error) {
      console.error('Error generating variable suggestion:', error);
      return { success: false, error: error.message };
    }
  });
  
  // AI pattern generation
  ipcMain.handle('api:generatePattern', async (event, data) => {
    try {
      const config = await configManager.load();
      if (!config.openai_api_key) {
        throw new Error('OpenAI API key not configured');
      }
      
      aiService.initialize(config.openai_api_key);
      const result = await aiService.generatePattern(data, config.expertise);
      
      return result;
    } catch (error) {
      console.error('Error generating pattern:', error);
      return { success: false, error: error.message };
    }
  });

  // AI category suggestion generation
  ipcMain.handle('api:generateCategorySuggestion', async (event, prompt) => {
    try {
      const config = await configManager.load();
      if (!config.openai_api_key) {
        throw new Error('OpenAI API key not configured');
      }
      
      aiService.initialize(config.openai_api_key);
      const result = await aiService.generateCategorySuggestion(prompt, config.expertise);
      
      return { success: true, suggestion: result };
    } catch (error) {
      console.error('Error generating category suggestion:', error);
      return { success: false, error: error.message };
    }
  });

  // AI description evaluation
  ipcMain.handle('api:evaluateDescription', async (event, variableName, description) => {
    try {
      const config = await configManager.load();
      if (!config.openai_api_key) {
        throw new Error('OpenAI API key not configured');
      }
      
      aiService.initialize(config.openai_api_key);
      const result = await aiService.evaluateVariableDescription(variableName, description, config.expertise);
      
      return { success: true, evaluation: result };
    } catch (error) {
      console.error('Error evaluating description:', error);
      return { success: false, error: error.message };
    }
  });

  // AI short description generation
  ipcMain.handle('api:generateShortDescription', async (event, variableName, description) => {
    try {
      const config = await configManager.load();
      if (!config.openai_api_key) {
        throw new Error('OpenAI API key not configured');
      }
      
      aiService.initialize(config.openai_api_key);
      const shortDescription = await aiService.generateShortDescription(variableName, description, config.expertise);
      
      return { success: true, shortDescription };
    } catch (error) {
      console.error('Error generating short description:', error);
      return { success: false, error: error.message };
    }
  });

  // AI file search
  ipcMain.handle('ai:searchFiles', async (event, data) => {
    try {
      const config = await configManager.load();
      if (!config.openai_api_key) {
        throw new Error('OpenAI API key not configured');
      }
      
      // Get file list based on scope
      const fileList = await getFileList(data.scope, config.watched_folder);
      
      // Perform AI search
      aiService.initialize(config.openai_api_key);
      const searchData = {
        query: data.query,
        fileList: fileList
      };
      
      const result = await aiService.searchFiles(searchData, config.expertise);
      return result;
    } catch (error) {
      console.error('Error searching files:', error);
      return { success: false, error: error.message };
    }
  });

  // Open file in system
  ipcMain.handle('file:open', async (event, filePath) => {
    try {
      await shell.openPath(filePath);
      return { success: true };
    } catch (error) {
      console.error('Error opening file:', error);
      return { success: false, error: error.message };
    }
  });

  // Processing log management
  ipcMain.handle('log:load', async () => {
    return await configManager.loadLog();
  });

  ipcMain.handle('log:clear', async () => {
    return await configManager.clearLog();
  });

  ipcMain.handle('log:addCorrection', async (event, logId, correction) => {
    const result = await configManager.addLogCorrection(logId, correction);
    
    // Notify log window of update if it exists
    if (logWindow && !logWindow.isDestroyed()) {
      logWindow.webContents.send('log:updated');
    }
    
    return result;
  });

  // Open processing log window
  ipcMain.handle('window:openLog', async () => {
    createLogWindow();
    return true;
  });
}

// Setup file monitor event handlers
function setupFileMonitor() {
  fileMonitor.on('file-detected', async (fileInfo) => {
    try {
      const config = await configManager.load();
      const result = await documentProcessor.processDocument(fileInfo, config);
      
      // Log the processing result
      try {
        await configManager.addLogEntry({
          originalName: result.fileName,
          parafileName: result.newName,
          category: result.category,
          reasoning: result.reasoning,
          success: result.success
        });
        
        // Notify log window of update if it exists
        if (logWindow && !logWindow.isDestroyed()) {
          logWindow.webContents.send('log:updated');
        }
      } catch (logError) {
        console.error('Error logging processing result:', logError);
      }
      
      mainWindow.webContents.send('file:processed', result);
      
      if (result.success) {
        console.log(`Successfully processed: ${result.fileName} -> ${result.newName}`);
        
        // Show system notification based on user preference
        const config = await configManager.load();
        if (config.enable_desktop_notifications && Notification.isSupported()) {
          new Notification({
            title: 'Document Processed',
            body: `${result.fileName} → ${result.newName} (${result.category})`,
            icon: path.join(__dirname, 'assets/icon.png')
          }).show();
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

  fileMonitor.on('file-moved-by-user', async (fileInfo) => {
    console.log(`User moved file: ${fileInfo.fileName} to ${fileInfo.path}`);
    
    // Log this as a user action (no processing, just logging)
    try {
      await configManager.addLogEntry({
        originalName: fileInfo.fileName,
        parafileName: fileInfo.fileName, // Same name since user moved it
        category: 'User Moved',
        reasoning: `File was manually moved by user to: ${path.dirname(fileInfo.path)}`,
        success: true
      });
      
      // Notify log window of update if it exists
      if (logWindow && !logWindow.isDestroyed()) {
        logWindow.webContents.send('log:updated');
      }
    } catch (logError) {
      console.error('Error logging user file move:', logError);
    }
    
    // Notify main window
    if (mainWindow) {
      mainWindow.webContents.send('file:user-moved', {
        fileName: fileInfo.fileName,
        newPath: fileInfo.path
      });
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
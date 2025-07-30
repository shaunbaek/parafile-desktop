const chokidar = require('chokidar');
const path = require('path');
const { EventEmitter } = require('events');

class FileMonitor extends EventEmitter {
  constructor() {
    super();
    this.watcher = null;
    this.isRunning = false;
    this.processedFiles = new Set(); // Files we've already processed
    this.parafileMovedFiles = new Set(); // Files moved by ParaFile itself
    this.rootWatchPath = null;
  }

  start(folderPath) {
    if (this.isRunning) {
      return;
    }

    // Validate the folder path
    if (!folderPath || folderPath.trim() === '') {
      this.emit('error', new Error('No folder path specified'));
      return;
    }

    this.rootWatchPath = path.resolve(folderPath);
    console.log(`Starting file monitor for root path: ${this.rootWatchPath}`);

    // Watch the folder and ALL subdirectories recursively
    const watchPattern = [
      folderPath,
      path.join(folderPath, '**/*')  // Explicitly watch all subdirectories
    ];
    
    this.watcher = chokidar.watch(watchPattern, {
      ignored: [
        /(^|[\/\\])\../,  // Ignore dotfiles
        /node_modules/,    // Ignore node_modules
        /\.app\//,         // Ignore app bundles on macOS
        /^\/dev\//,        // Ignore /dev directory
        /^\/Volumes\/.*\/dev\//, // Ignore /dev on mounted volumes
        /\.git\//,         // Ignore .git directories
        /\.DS_Store$/,     // Ignore macOS metadata files
        /Thumbs\.db$/      // Ignore Windows thumbnail cache
      ],
      persistent: true,
      ignoreInitial: true,
      awaitWriteFinish: {
        stabilityThreshold: 2000,
        pollInterval: 100
      },
      followSymlinks: false,
      usePolling: false,
      interval: 100,
      binaryInterval: 300,
      alwaysStat: false,
      depth: undefined,  // No depth limit for unlimited recursion
      ignorePermissionErrors: true,
      atomic: true       // Handle atomic file operations better
    });

    this.watcher
      .on('add', (filePath) => this.handleFileEvent(filePath, 'add'))
      .on('change', (filePath) => this.handleFileEvent(filePath, 'change'))
      .on('unlink', (filePath) => this.handleFileEvent(filePath, 'unlink'))
      .on('error', error => {
        // Filter out common non-critical errors
        if (error.code === 'EBADF' || error.code === 'ENOENT') {
          console.warn('Non-critical file system error:', error.message);
          return;
        }
        this.emit('error', error);
      })
      .on('ready', () => {
        console.log(`File monitor ready. Recursively watching: ${folderPath} (including all subdirectories)`);
        this.isRunning = true;
        this.emit('started');
      });
  }

  handleFileEvent(filePath, eventType) {
    const ext = path.extname(filePath).toLowerCase();
    
    if (ext === '.pdf' || ext === '.docx' || ext === '.doc') {
      const absolutePath = path.resolve(filePath);
      const fileName = path.basename(filePath);
      
      // Check if this file was moved by ParaFile itself
      if (this.parafileMovedFiles.has(absolutePath) || this.parafileMovedFiles.has(fileName)) {
        console.log(`Ignoring ParaFile-moved file: ${fileName}`);
        return;
      }
      
      if (eventType === 'add') {
        // Check if we've already processed this file (by name, not path)
        if (this.processedFiles.has(fileName)) {
          console.log(`File already processed, user moved: ${fileName}`);
          // This is a user-moved file, emit a different event
          this.emit('file-moved-by-user', {
            path: filePath,
            fileName: fileName,
            type: ext.substring(1)
          });
          return;
        }
        
        console.log(`New file detected: ${fileName} at ${filePath}`);
        this.processedFiles.add(fileName);
        
        this.emit('file-detected', { 
          path: filePath, 
          type: ext.substring(1),
          eventType 
        });
        
        // Keep track of processed files for 10 minutes to avoid reprocessing
        setTimeout(() => {
          this.processedFiles.delete(fileName);
        }, 600000); // 10 minutes
        
      } else if (eventType === 'unlink') {
        console.log(`File removed: ${fileName}`);
        // Don't remove from processedFiles immediately, in case it's being moved
        
      } else {
        console.log(`Ignoring ${eventType} event for: ${fileName}`);
      }
    }
  }

  // Method to mark a file as moved by ParaFile (to be called from fileOrganizer)
  markFileAsMoved(originalPath, newPath) {
    const originalName = path.basename(originalPath);
    const newName = path.basename(newPath);
    
    console.log(`Marking as ParaFile-moved: ${originalName} -> ${newName}`);
    
    this.parafileMovedFiles.add(path.resolve(originalPath));
    this.parafileMovedFiles.add(path.resolve(newPath));
    this.parafileMovedFiles.add(originalName);
    this.parafileMovedFiles.add(newName);
    
    // Clean up the moved files set after 30 seconds
    setTimeout(() => {
      this.parafileMovedFiles.delete(path.resolve(originalPath));
      this.parafileMovedFiles.delete(path.resolve(newPath));
      this.parafileMovedFiles.delete(originalName);
      this.parafileMovedFiles.delete(newName);
    }, 30000);
  }

  stop() {
    if (this.watcher) {
      this.watcher.close();
      this.watcher = null;
      this.isRunning = false;
      this.processedFiles.clear();
      this.parafileMovedFiles.clear();
      this.rootWatchPath = null;
      this.emit('stopped');
    }
  }

  getStatus() {
    return this.isRunning;
  }
}

module.exports = new FileMonitor();
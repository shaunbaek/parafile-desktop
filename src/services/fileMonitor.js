const chokidar = require('chokidar');
const path = require('path');
const { EventEmitter } = require('events');

class FileMonitor extends EventEmitter {
  constructor() {
    super();
    this.watcher = null;
    this.isRunning = false;
    this.processedFiles = new Set();
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
      const fileKey = `${filePath}-${eventType}`;
      
      if (eventType === 'add' || (eventType === 'change' && !this.processedFiles.has(fileKey))) {
        this.processedFiles.add(fileKey);
        this.emit('file-detected', { 
          path: filePath, 
          type: ext.substring(1),
          eventType 
        });
        
        setTimeout(() => {
          this.processedFiles.delete(fileKey);
        }, 60000);
      }
    }
  }

  stop() {
    if (this.watcher) {
      this.watcher.close();
      this.watcher = null;
      this.isRunning = false;
      this.processedFiles.clear();
      this.emit('stopped');
    }
  }

  getStatus() {
    return this.isRunning;
  }
}

module.exports = new FileMonitor();
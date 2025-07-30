const fs = require('fs').promises;
const path = require('path');
const fileMonitor = require('./fileMonitor');

class FileOrganizer {
  async processFile(filePath, category, newName, config) {
    const fileDir = path.dirname(filePath);
    const fileExt = path.extname(filePath);
    const baseNewName = newName + fileExt;
    
    let targetDir, targetPath;
    
    if (config.enable_organization) {
      targetDir = path.join(config.watched_folder, category);
      await this.ensureDirectory(targetDir);
    } else {
      targetDir = fileDir;
    }
    
    targetPath = await this.getUniqueFilePath(targetDir, baseNewName);
    
    try {
      await fs.rename(filePath, targetPath);
      
      // Notify file monitor that this file was moved by ParaFile
      fileMonitor.markFileAsMoved(filePath, targetPath);
      
      return {
        success: true,
        originalPath: filePath,
        newPath: targetPath,
        category: category,
        newName: path.basename(targetPath)
      };
    } catch (error) {
      console.error('Error moving file:', error);
      return {
        success: false,
        error: error.message,
        originalPath: filePath
      };
    }
  }

  async ensureDirectory(dirPath) {
    try {
      await fs.access(dirPath);
    } catch {
      await fs.mkdir(dirPath, { recursive: true });
    }
  }

  async getUniqueFilePath(directory, filename) {
    const ext = path.extname(filename);
    const baseName = path.basename(filename, ext);
    let counter = 0;
    let uniquePath = path.join(directory, filename);
    
    while (true) {
      try {
        await fs.access(uniquePath);
        counter++;
        const newName = `${baseName}_${counter}${ext}`;
        uniquePath = path.join(directory, newName);
      } catch {
        return uniquePath;
      }
    }
  }

  async cleanupEmptyFolders(baseDir) {
    try {
      const entries = await fs.readdir(baseDir, { withFileTypes: true });
      
      for (const entry of entries) {
        if (entry.isDirectory()) {
          const dirPath = path.join(baseDir, entry.name);
          await this.cleanupEmptyFolders(dirPath);
          
          const subEntries = await fs.readdir(dirPath);
          if (subEntries.length === 0) {
            await fs.rmdir(dirPath);
          }
        }
      }
    } catch (error) {
      console.error('Error cleaning up folders:', error);
    }
  }
}

module.exports = new FileOrganizer();
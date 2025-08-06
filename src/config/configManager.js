const fs = require('fs').promises;
const path = require('path');
const { app } = require('electron');

class ConfigManager {
  constructor() {
    this.configPath = path.join(app.getPath('userData'), 'config.json');
    this.logPath = path.join(app.getPath('userData'), 'processing-log.json');
    this.defaultConfig = {
      watched_folder: '',
      enable_organization: true,
      openai_api_key: '',
      expertise: 'general',
      categories: [
        {
          name: 'General',
          description: 'Default category for uncategorized documents',
          naming_pattern: '{original_name}'
        }
      ],
      variables: [
        {
          name: 'original_name',
          description: 'The original filename without extension'
        }
      ]
    };
  }

  async load() {
    try {
      const data = await fs.readFile(this.configPath, 'utf8');
      const config = JSON.parse(data);
      return this.validateAndRepair(config);
    } catch (error) {
      if (error.code === 'ENOENT') {
        await this.save(this.defaultConfig);
        return this.defaultConfig;
      }
      console.error('Error loading config:', error);
      return this.defaultConfig;
    }
  }

  async save(config) {
    try {
      const validatedConfig = this.validateAndRepair(config);
      await fs.writeFile(this.configPath, JSON.stringify(validatedConfig, null, 2));
      return true;
    } catch (error) {
      console.error('Error saving config:', error);
      return false;
    }
  }

  validateAndRepair(config) {
    if (!config || typeof config !== 'object') {
      return this.defaultConfig;
    }

    const repaired = {
      watched_folder: config.watched_folder || '',
      enable_organization: config.enable_organization !== false,
      openai_api_key: config.openai_api_key || '',
      expertise: config.expertise || 'general',
      categories: Array.isArray(config.categories) ? config.categories : [],
      variables: Array.isArray(config.variables) ? config.variables : []
    };

    const hasGeneral = repaired.categories.some(cat => cat.name === 'General');
    if (!hasGeneral) {
      repaired.categories.push(this.defaultConfig.categories[0]);
    }

    const hasOriginalName = repaired.variables.some(v => v.name === 'original_name');
    if (!hasOriginalName) {
      repaired.variables.push(this.defaultConfig.variables[0]);
    }

    repaired.categories = repaired.categories.filter(cat => 
      cat && cat.name && cat.description && cat.naming_pattern
    );

    repaired.variables = repaired.variables.filter(v => 
      v && v.name && v.description
    );

    return repaired;
  }

  async addCategory(category) {
    const config = await this.load();
    config.categories.push(category);
    await this.save(config);
    return config;
  }

  async updateCategory(index, category) {
    const config = await this.load();
    if (config.categories[index] && config.categories[index].name !== 'General') {
      config.categories[index] = category;
      await this.save(config);
    }
    return config;
  }

  async deleteCategory(index) {
    const config = await this.load();
    if (config.categories[index] && config.categories[index].name !== 'General') {
      config.categories.splice(index, 1);
      await this.save(config);
    }
    return config;
  }

  async addVariable(variable) {
    const config = await this.load();
    config.variables.push(variable);
    await this.save(config);
    return config;
  }

  async updateVariable(index, variable) {
    const config = await this.load();
    if (config.variables[index] && config.variables[index].name !== 'original_name') {
      config.variables[index] = variable;
      await this.save(config);
    }
    return config;
  }

  async deleteVariable(index) {
    const config = await this.load();
    if (config.variables[index] && config.variables[index].name !== 'original_name') {
      config.variables.splice(index, 1);
      await this.save(config);
    }
    return config;
  }

  async updateSettings(settings) {
    const config = await this.load();
    if (settings.watched_folder !== undefined) {
      config.watched_folder = settings.watched_folder;
    }
    if (settings.enable_organization !== undefined) {
      config.enable_organization = settings.enable_organization;
    }
    if (settings.openai_api_key !== undefined) {
      config.openai_api_key = settings.openai_api_key;
    }
    if (settings.expertise !== undefined) {
      config.expertise = settings.expertise;
    }
    await this.save(config);
    return config;
  }

  // Processing Log Management
  async loadLog() {
    try {
      const data = await fs.readFile(this.logPath, 'utf8');
      const logs = JSON.parse(data);
      return Array.isArray(logs) ? logs : [];
    } catch (error) {
      if (error.code === 'ENOENT') {
        return [];
      }
      console.error('Error loading processing log:', error);
      return [];
    }
  }

  async saveLog(logs) {
    try {
      // Keep only the last 100 entries
      const trimmedLogs = logs.slice(-100);
      await fs.writeFile(this.logPath, JSON.stringify(trimmedLogs, null, 2));
      return true;
    } catch (error) {
      console.error('Error saving processing log:', error);
      return false;
    }
  }

  async addLogEntry(entry) {
    const logs = await this.loadLog();
    const logEntry = {
      id: Date.now() + Math.random(), // Unique ID
      timestamp: new Date().toISOString(),
      originalName: entry.originalName,
      parafileName: entry.parafileName,
      category: entry.category,
      reasoning: entry.reasoning,
      success: entry.success,
      corrected: false,
      corrections: []
    };
    
    logs.push(logEntry);
    await this.saveLog(logs);
    return logEntry;
  }

  async updateLogEntry(id, updates) {
    const logs = await this.loadLog();
    const index = logs.findIndex(log => log.id === id);
    
    if (index >= 0) {
      logs[index] = { ...logs[index], ...updates };
      await this.saveLog(logs);
      return logs[index];
    }
    
    return null;
  }

  async clearLog() {
    try {
      await fs.writeFile(this.logPath, JSON.stringify([], null, 2));
      return true;
    } catch (error) {
      console.error('Error clearing processing log:', error);
      return false;
    }
  }

  async isFileAlreadyProcessed(filename) {
    const logs = await this.loadLog();
    // Check if this filename exists as a parafileName in the log
    return logs.some(log => log.parafileName === filename && log.success);
  }

  async addLogCorrection(id, correction) {
    const logs = await this.loadLog();
    const index = logs.findIndex(log => log.id === id);
    
    if (index >= 0) {
      if (!logs[index].corrections) {
        logs[index].corrections = [];
      }
      
      logs[index].corrections.push({
        timestamp: new Date().toISOString(),
        oldCategory: logs[index].category,
        newCategory: correction.newCategory,
        feedback: correction.feedback,
        user: 'user' // Could be extended for multi-user scenarios
      });
      
      logs[index].corrected = true;
      logs[index].category = correction.newCategory; // Update the display category
      
      await this.saveLog(logs);
      return logs[index];
    }
    
    return null;
  }
}

module.exports = new ConfigManager();
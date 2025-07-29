const fs = require('fs').promises;
const path = require('path');
const { app } = require('electron');

class ConfigManager {
  constructor() {
    this.configPath = path.join(app.getPath('userData'), 'config.json');
    this.defaultConfig = {
      watched_folder: '',
      enable_organization: true,
      openai_api_key: '',
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
    await this.save(config);
    return config;
  }
}

module.exports = new ConfigManager();